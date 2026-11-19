// A positive wheel angle turns the kart right. Device axes stay attached to the
// hardware, so subtracting a measured neutral works on either landscape side.
const RAD = Math.PI / 180;
const DEAD_ZONE = 2;
const FULL_LOCK = 42;
const STREAM_TIMEOUT = 2200;
const FIRST_SAMPLE_TIMEOUT = 4000;
const SOURCE_SYNC_WINDOW = 140;

function emptySample() {
  return { at: -Infinity, rawAngle: null, angle: 0, center: null, flat: false };
}

function wheelInput(angle) {
  const travel = Math.max(0, Math.abs(angle) - DEAD_ZONE);
  return Math.sign(angle) * Math.min(1, travel / (FULL_LOCK - DEAD_ZONE));
}

function updateSample(sample, x, y, magnitude, now, smooth) {
  const dt = now - sample.at;
  sample.at = now;
  // Looking straight down at a horizontal display leaves gravity with no
  // measurable direction in its plane. Don't amplify that noise into a turn.
  sample.flat = magnitude < .01 || Math.hypot(x, y) < .30 * magnitude;
  if (sample.flat) {
    sample.rawAngle = null;
    return;
  }
  const raw = Math.atan2(-x, y) / RAD;
  const previous = sample.rawAngle ?? sample.angle;
  const delta = ((raw - previous + 540) % 360 + 360) % 360 - 180;
  const unwrapped = previous + delta;
  sample.angle = smooth && sample.rawAngle !== null && dt < 300
    ? sample.angle + (unwrapped - sample.angle) * (1 - Math.exp(-dt / 32))
    : unwrapped;
  sample.rawAngle = unwrapped;
}

/**
 * Call enable() directly from a tap, then center() with the phone held in its
 * straight-ahead position. read() is synchronous and safe in a physics frame.
 */
export function createMobileWheel(host = window) {
  const now = () => host.performance.now();
  const displayAngle = () => host.screen?.orientation?.angle ?? host.orientation ?? 0;
  let orientation, motion, display, listeningSince;
  let phase = 'idle', generation = 0, permission;
  function resetPose() {
    orientation = emptySample();
    motion = emptySample();
    display = displayAngle();
    listeningSince = now();
  }
  resetPose();

  function checkDisplay() {
    if (displayAngle() !== display) resetPose();
  }
  // Align independent sensor zeroes when switching sources. This also handles
  // devices whose motion convention gives the opposite gravity vector.
  function alignSamples() {
    if (orientation.flat || motion.flat || Math.abs(orientation.at - motion.at) > SOURCE_SYNC_WINDOW) return;
    if (orientation.center === null && motion.center !== null)
      orientation.center = orientation.angle - (motion.angle - motion.center);
    else if (motion.center === null && orientation.center !== null)
      motion.center = motion.angle - (orientation.angle - orientation.center);
  }
  function onOrientation(event) {
    if (host.document?.visibilityState === 'hidden') return;
    checkDisplay();
    const { beta, gamma } = event;
    if (!Number.isFinite(beta) || !Number.isFinite(gamma)) {
      orientation = emptySample();
      return;
    }
    // Earth-up in device coordinates is the third row of the W3C Z-X'-Y''
    // rotation matrix. Heading (alpha) has no effect on a steering wheel.
    const x = -Math.cos(beta * RAD) * Math.sin(gamma * RAD);
    const y = Math.sin(beta * RAD);
    updateSample(orientation, x, y, 1, now(), false);
    alignSamples();
  }
  function onMotion(event) {
    if (host.document?.visibilityState === 'hidden') return;
    checkDisplay();
    const gravity = event.accelerationIncludingGravity;
    if (!gravity || ![gravity.x, gravity.y, gravity.z].every(Number.isFinite)) return;
    const linear = event.acceleration;
    const hasLinear = linear && [linear.x, linear.y, linear.z].every(Number.isFinite);
    const x = gravity.x - (hasLinear ? linear.x : 0);
    const y = gravity.y - (hasLinear ? linear.y : 0);
    const z = gravity.z - (hasLinear ? linear.z : 0);
    const magnitude = Math.hypot(x, y, z);
    // Ignore free fall and hard shakes before accepting the accelerometer as
    // a gravity estimate (values are in m/s²).
    if (magnitude < 5 || magnitude > 15) return;
    updateSample(motion, x, y, magnitude, now(), true);
    alignSamples();
  }

  function activeSample(time) {
    // Orientation is fused and stationary readings can be change-driven. A
    // fresh motion stream covers long, steady corners and detects signal loss.
    if (time - orientation.at <= SOURCE_SYNC_WINDOW) return orientation;
    const latest = orientation.at >= motion.at ? orientation : motion;
    if (time - latest.at <= STREAM_TIMEOUT) return latest;
    if (motion.at === -Infinity && orientation.at !== -Infinity) return orientation;
    return null;
  }
  function reading() {
    checkDisplay();
    const zero = status => ({ status, angle: 0, steer: 0 });
    if (phase !== 'listening') return zero(phase);
    const time = now(), sample = activeSample(time);
    if (!sample) {
      const received = orientation.at !== -Infinity || motion.at !== -Infinity;
      return zero(received || time - listeningSince >= FIRST_SAMPLE_TIMEOUT ? 'stale' : 'waiting');
    }
    if (sample.flat) return zero('flat');
    if (sample.center === null) return zero('uncentered');
    const angle = sample.angle - sample.center;
    return {status:'ready', angle, steer:wheelInput(angle)};
  }
  function center() {
    if (phase !== 'listening') return false;
    checkDisplay();
    const time = now(), sample = activeSample(time);
    if (!sample || sample.flat) return false;
    for (const other of [orientation, motion]) {
      other.center = !other.flat && (other === sample || time - other.at <= SOURCE_SYNC_WINDOW) ? other.angle : null;
    }
    return true;
  }
  function onHidden() {
    if (host.document?.visibilityState === 'hidden') resetPose();
  }
  function stop() {
    generation++;
    phase = 'idle';
    permission = null;
    host.removeEventListener('deviceorientation', onOrientation);
    host.removeEventListener('devicemotion', onMotion);
    host.removeEventListener('pagehide', resetPose);
    host.removeEventListener('orientationchange', checkDisplay);
    host.screen?.orientation?.removeEventListener?.('change', checkDisplay);
    host.document?.removeEventListener('visibilitychange', onHidden);
    resetPose();
  }
  function grant(eventName, api) {
    if (!api && !('on' + eventName in host)) return Promise.resolve('missing');
    try {
      return Promise.resolve(api?.requestPermission ? api.requestPermission() : 'granted')
        .catch(() => 'denied');
    } catch { return Promise.resolve('denied'); }
  }
  function enable() {
    if (phase === 'listening') return Promise.resolve(reading().status);
    if (phase === 'requesting') return permission;
    if (host.isSecureContext === false) {
      phase = 'unavailable';
      return Promise.resolve(phase);
    }
    const attempt = ++generation;
    phase = 'requesting';
    // Invoke both before the first await so both retain the tap's activation
    // on browsers that require explicit sensor permission.
    permission = Promise.all([
      grant('deviceorientation', host.DeviceOrientationEvent),
      grant('devicemotion', host.DeviceMotionEvent)
    ]).then(([angles, gravity]) => {
      if (generation !== attempt) return reading().status;
      if (angles !== 'granted' && gravity !== 'granted') {
        phase = angles === 'missing' && gravity === 'missing' ? 'unavailable' : 'denied';
        return phase;
      }
      resetPose();
      phase = 'listening';
      if (angles === 'granted') host.addEventListener('deviceorientation', onOrientation);
      if (gravity === 'granted') host.addEventListener('devicemotion', onMotion);
      host.addEventListener('pagehide', resetPose);
      host.addEventListener('orientationchange', checkDisplay);
      host.screen?.orientation?.addEventListener?.('change', checkDisplay);
      host.document?.addEventListener('visibilitychange', onHidden);
      return reading().status;
    });
    return permission;
  }
  return {enable, center, read:reading, stop};
}
