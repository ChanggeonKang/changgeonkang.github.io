// Nubzuki Kart — KAIST Fun Run GP: game loop, driving physics, camera, HUD.
import * as THREE from '../lib/three.module.min.js';
import { W, loadWorld, updateWorld, hAt, gAt, surfAt, coursePos, clamp, mod, lerp, rng, DS } from './world.js';
import { makeNubzuki, poseKart } from './kart.js';
import { Vehicle, RIDE } from './vehicle-physics.js';
import { FixedStepper, syncRacer, updateProgress, resolveWalls } from './race-sim.js';
import { resolveCourseBarrier } from './course-barriers.js';
import { LapTracker, normalizeName } from './time-attack.js';
import { createRecordsClient, recordDevice } from './leaderboard.js';
import { stabilizeVehicle } from './stabilize.js';
import { FINISH_GRACE_TICKS, inputMask, ReplayUpload } from './replay-upload.js';
import { snapshotLeader, compareSplit, timingProgress } from './split-times.js';
import { ROLLOVER_RECOVERY_SECONDS, advanceRolloverTimer, recoverOverturned } from './rollover-recovery.js';
import { Particles, Skids, Post } from './fx.js';
import { Sfx } from './audio.js';

const $ = id => document.getElementById(id);
const Q = new URLSearchParams(location.search);
document.documentElement.classList.toggle('mobile-device', recordDevice() === 'mobile');
const rnd = rng(99);
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
const fmt = t => { const m = Math.floor(t / 60), s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(2); };
function officialTime(ms) {
  const seconds = Math.floor(ms / 1000) % 60;
  return Math.floor(ms / 60000) + ':' + String(seconds).padStart(2, '0') + '.' + String(ms % 1000).padStart(3, '0');
}

// ───────────────────────── renderer ─────────────────────────
const renderer = new THREE.WebGLRenderer({ canvas: $('gl'), antialias: true, powerPreference: 'high-performance' });
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
const scene = new THREE.Scene();
scene.background = W.horizon.clone();
scene.fog = new THREE.Fog(W.horizon.clone(), 420, 2700);
const camera = new THREE.PerspectiveCamera(60, 1, 0.3, 9000);
scene.add(new THREE.HemisphereLight(0xd8eaff, 0x77885f, .45));
const sun = new THREE.DirectionalLight(0xfff0d6, 2.9);
sun.castShadow = true; sun.shadow.bias = -0.0003; sun.shadow.normalBias = .5;
Object.assign(sun.shadow.camera, { left: -80, right: 80, top: 80, bottom: -80, near: 20, far: 620 });
scene.add(sun, sun.target);
const post = new Post(renderer);

const QUAL = [{ pr: 1.5, shadow: 2048, msaa: 4 }, { pr: 1, shadow: 1024, msaa: 2 }, { pr: .8, shadow: 0, msaa: 0 }];
let qual = clamp(parseInt(Q.get('q') || '0', 10) || 0, 0, 2), slowT = 0, ema = 16;
function applyQuality() {
  const q = QUAL[qual];
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, q.pr));
  sun.castShadow = q.shadow > 0;
  if (q.shadow && sun.shadow.mapSize.x !== q.shadow) { sun.shadow.mapSize.set(q.shadow, q.shadow); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
  resize();
}
function resize() {
  const w = innerWidth || 800, h = innerHeight || 600;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  const v = renderer.getDrawingBufferSize(new THREE.Vector2());
  post.setSize(v.x, v.y, QUAL[qual].msaa);
}
addEventListener('resize', resize);

// ───────────────────────── state ─────────────────────────
const keys = { up: false, down: false, left: false, right: false, drift: false };
const KEYMAP = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ShiftLeft: 'drift', ShiftRight: 'drift' };
const heldCodes = new Set(), heldPointers = new Map();
function updateKey(key) { keys[key] = [...heldCodes].some(code => KEYMAP[code] === key) || [...heldPointers.values()].includes(key); }
function clearInputs() { heldCodes.clear(); heldPointers.clear(); for (const key in keys) keys[key] = false; }
let touchMode = matchMedia('(pointer:coarse)').matches;
let state = 'load'; // load → title → count → race → finish (+ pause)
let T = 0, raceT = 0, countT = 0, finT = 0, helpT = 0;
const sfx = new Sfx();
const P = { name: 'You', color: 0x2f95e8, x: 0, z: 0, th: 0, vx: 0, vz: 0, vf: 0, vl: 0, wy: 0, steer: 0, drift: false, grip: 1,
  prog: 0, lost: false, off: false, wrong: 0, shake: 0, flipT: 0, recoveryT: 0, recoveryRetry: 0, done: 0, time: 0, body: new Vehicle({ groundAt: gAt, surfaceAt: surfAt }), mesh: null };
const tmp = { x: 0, z: 0, th: 0 }, v3 = new THREE.Vector3(), v2 = new THREE.Vector2();
let dust, glow, skids;
const stepper = new FixedStepper();
let reverseHold = 0, telemetry = false, frameMs = 16.7;
let lap, replay = null, practice = false, starting = false, finishGrace = 0, localFinishAt = 0;
const records = createRecordsClient();
let leaderboardEntries = [], leaderboardLeader = null, leaderSnapshot = null;

function placeGrid() {
  coursePos(0, 0, tmp);
  Object.assign(P, { x: tmp.x, z: tmp.z, th: tmp.th, vx: 0, vz: 0, vf: 0, vl: 0, wy: 0, steer: 0, drift: false, grip: 1,
    prog: 0, lost: false, off: false, wrong: 0, shake: 0, flipT: 0, recoveryT: 0, recoveryRetry: 0, done: 0, time: 0 });
  P.body.reset(P.x, P.z, P.th); stabilizeVehicle(P.body); syncRacer(P); reverseHold = 0; stepper.reset();
  finishGrace = 0; localFinishAt = 0;
  lap = new LapTracker(W.C.n); raceT = 0; cam.snap = true; leaderSnapshot = null;
  clearInputs();
  if (skids) skids.clear();
}

// ───────────────────────── driving physics ─────────────────────────
const ev = { J: 0, hit: 0 };
function stepPlayer(dt, input) {
  const st = input ? (keys.right ? 1 : 0) - (keys.left ? 1 : 0) : 0;
  P.steer += (st - P.steer) * (1 - Math.exp(-dt * 7));
  reverseHold = input && keys.down && Math.abs(P.body.vf) < .7 ? reverseHold + dt : 0;
  const reversing = reverseHold > .35 || (input && keys.down && P.body.vf < -.3);
  const controls = {
    throttle: input && keys.up ? 1 : reversing ? -.45 : 0,
    brake: input ? (keys.down && !reversing ? 1 : 0) : 1,
    flip: Boolean(input && keys.down),
    steer: P.steer,
    drift: Boolean(input && keys.drift),
    handbrake: false,
  };
  const previous = { x: P.body.x, z: P.body.z, q: [...P.body.q] };
  const impulse = P.body.step(dt, controls);
  ev.J += impulse / P.body.parameters.mass;
  ev.hit = Math.max(ev.hit, resolveWalls(P.body, previous, surfAt));
  ev.hit = Math.max(ev.hit, resolveCourseBarrier(P.body, previous, W.C, P.prog, dt));
  stabilizeVehicle(P.body);
  syncRacer(P);
  P.recoveryT = Math.max(0, (P.recoveryT || 0) - dt);
  P.recoveryRetry = Math.max(0, (P.recoveryRetry || 0) - dt);
  P.flipT = input ? advanceRolloverTimer(P.body, P.flipT, dt) : 0;
  if (input && P.flipT >= ROLLOVER_RECOVERY_SECONDS && !P.recoveryRetry) {
    const recovered = recoverOverturned(P.body, W.C, P.prog, surfAt);
    if (recovered.recovered) {
      stabilizeVehicle(P.body); syncRacer(P); P.flipT = 0; P.steer = 0; reverseHold = 0; P.recoveryT = 1.5; P.recoveryRetry = 0; cam.snap = true;
      // Race time, checkpoint times and the active record session continue.
      // Recovery consumes the two overturned seconds; it is never a pause.
    } else P.recoveryRetry = .25;
  }
}
function trackProgress(dt) {
  const C = W.C;
  updateProgress(P, C);
  lap.advance(timingProgress(P, C), raceT * 1000);
  const k = mod(Math.floor(P.prog), C.n);
  const along = Math.sin(P.th) * C.tx[k] + Math.cos(P.th) * C.tz[k];
  P.wrong = along < -.4 && P.vf > 3 ? P.wrong + dt : 0;
}

// ───────────────────────── effects ─────────────────────────
function effects(dt) {
  const b = P.body, s = Math.sin(P.th), c = Math.cos(P.th), spd = Math.hypot(P.vx, P.vz), gy = gAt(P.x, P.z), grounded = b.contacts > 0;
  const rx = P.x - s * 1.1, rz = P.z - c * 1.1, surf = surfAt(P.x, P.z);
  if (b.landed > .22) { // touchdown after a real flight
    const pw = clamp(b.landed * 1.4, .3, 1.5);
    for (let i = 0; i < 16 * pw; i++) { const a = rnd() * 6.28, v = 2 + rnd() * 4; dust.emit(P.x + Math.cos(a) * .8, gy + .15, P.z + Math.sin(a) * .8, Math.cos(a) * v + P.vx * .3, .6 + rnd(), Math.sin(a) * v + P.vz * .3, .7 + rnd() * .5, .9, 2.6, .62, .57, .5, .45); }
    sfx.thump(pw); P.shake = Math.max(P.shake, clamp(pw * .7, 0, 1));
  }
  b.landed = 0;
  if (ev.J > 2.2 && grounded) { P.shake = Math.max(P.shake, clamp(ev.J * .1, 0, .8)); }
  if (ev.hit > 6) { sfx.thump(clamp(ev.hit / 25, .2, 1)); P.shake = Math.max(P.shake, clamp(ev.hit / 30, 0, .8)); }
  ev.J = 0; ev.hit = 0;
  if (grounded && surf === 0 && spd > 5 && rnd() < dt * 40) dust.emit(rx + (rnd() - .5), gy + .15, rz + (rnd() - .5), (rnd() - .5) * 2, .8 + rnd(), (rnd() - .5) * 2, .8, .7, 2.2, .50, .42, .30, .4);
  if (P.drift && grounded) {
    for (const sg of [1, -1]) {
      const wx = rx + c * .55 * sg, wz = rz - s * .55 * sg;
      if (rnd() < dt * 50) dust.emit(wx, gy + .12, wz, -P.vx * .1 + (rnd() - .5), .5 + rnd() * .6, -P.vz * .1 + (rnd() - .5), .5, .5, 2.4, .8, .8, .82, .3);
      if (surf >= 2) skids.add(sg > 0 ? 0 : 1, wx, gy + .02, wz, c, -s, .16);
    }
  } else skids.stop();
  const sc = renderer.getDrawingBufferSize(v2).y / (2 * Math.tan(camera.fov * Math.PI / 360));
  dust.update(dt, sc); glow.update(dt, sc);
  P.shake = Math.max(0, P.shake - dt * 2.4);
  sfx.update(clamp(spd / b.parameters.maxSpeed, 0, 1.2), keys.up && state === 'race' ? 1 : 0, b.driftActive ? clamp(Math.abs(P.vl) / 7, 0, 1) * (grounded ? 1 : 0) : 0, grounded, surf === 0, false);
}

// ───────────────────────── camera ─────────────────────────
const cam = { pos: new THREE.Vector3(), look: new THREE.Vector3(), yaw: 0, y: 0, snap: true };
function updateCamera(dt) {
  const gy = gAt(P.x, P.z);
  if (state === 'load' || state === 'title' || state === 'finish') { // showcase orbit
    const a = (state === 'finish' ? P.th + Math.PI * .75 + finT * .25 : T * .16 + 2.4), r = state === 'finish' ? 8 : 6.4;
    v3.set(P.x + Math.sin(a) * r, gy + (state === 'finish' ? 3 : 2.1), P.z + Math.cos(a) * r);
    if (state === 'finish' && !cam.snap) cam.pos.lerp(v3, 1 - Math.exp(-dt * 2.5)); else cam.pos.copy(v3);
    cam.snap = false; cam.y = gy; cam.yaw = P.th;
    camera.position.copy(cam.pos); camera.lookAt(P.x, P.body.y - RIDE + .7, P.z);
    if (camera.fov !== 50) { camera.fov = 50; camera.updateProjectionMatrix(); }
    return;
  }
  const spd = Math.hypot(P.vx, P.vz);
  const travelYaw = Math.atan2(P.vx, P.vz);
  let ty = P.th;
  if (!P.body.contacts) ty = spd > 1 ? travelYaw : cam.yaw;
  else if (spd > 4 && P.vf > 0) ty += angDiff(travelYaw, P.th) * .55;
  if (cam.snap) { cam.yaw = P.th; cam.y = gy; }
  cam.yaw += angDiff(ty, cam.yaw) * (1 - Math.exp(-dt * 5.5));
  cam.y += (gy * .7 + (P.body.y - RIDE) * .3 - cam.y) * (1 - Math.exp(-dt * 5)); // follows the ground more than the kart, so a jump reads as a jump
  const s = Math.sin(cam.yaw), c = Math.cos(cam.yaw), back = 6.9 + clamp(spd / 30, 0, 1) * 1.7;
  v3.set(P.x - s * back, cam.y + 3.1, P.z - c * back);
  v3.y = Math.max(v3.y, gAt(v3.x, v3.z) + 1.1);
  if (cam.snap) { cam.pos.copy(v3); cam.snap = false; } else cam.pos.lerp(v3, 1 - Math.exp(-dt * 10));
  camera.position.copy(cam.pos);
  if (P.shake > 0) { camera.position.x += (Math.random() - .5) * P.shake * .45; camera.position.y += (Math.random() - .5) * P.shake * .45; }
  cam.look.set(P.x + s * 4.5, cam.y + 1.1 + (P.body.y - RIDE - gy) * .45, P.z + c * 4.5);
  camera.lookAt(cam.look);
  camera.rotateZ(clamp(-P.wy * .035, -.08, .08));
  const fov = 60 + clamp(spd / 34, 0, 1) * 9;
  if (Math.abs(camera.fov - fov) > .05) { camera.fov += (fov - camera.fov) * Math.min(1, dt * 4); camera.updateProjectionMatrix(); }
}

// ───────────────────────── HUD ─────────────────────────
const hud = { last: {}, dots: [] };
function setText(id, v) { if (hud.last[id] !== v) { hud.last[id] = v; $(id).textContent = v; } }
function buildHud() {
  const C = W.C, cv = $('mini'), S = cv.width;
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (let i = 0; i < C.n; i++) { x0 = Math.min(x0, C.x[i]); x1 = Math.max(x1, C.x[i]); z0 = Math.min(z0, C.z[i]); z1 = Math.max(z1, C.z[i]); }
  const sc = (S - 44) / Math.max(x1 - x0, z1 - z0);
  hud.m = { sc, ox: S / 2 - (x0 + x1) / 2 * sc, oz: S / 2 - (z0 + z1) / 2 * sc };
  hud.base = document.createElement('canvas'); hud.base.width = hud.base.height = S;
  const c = hud.base.getContext('2d');
  c.lineJoin = 'round';
  for (const [lw, st] of [[11, 'rgba(0,0,0,.5)'], [6, '#ffffff']]) {
    c.lineWidth = lw; c.strokeStyle = st; c.beginPath();
    for (let i = 0; i <= C.n; i += 2) { const k = i % C.n; c.lineTo(C.x[k] * sc + hud.m.ox, C.z[k] * sc + hud.m.oz); }
    c.closePath(); c.stroke();
  }
  c.fillStyle = '#ffd23f';
  for (const ci of W.courseBumps) c.fillRect(C.x[ci] * sc + hud.m.ox - 2.5, C.z[ci] * sc + hud.m.oz - 2.5, 5, 5);
  c.fillStyle = '#111'; c.fillRect(C.x[0] * sc + hud.m.ox - 7, C.z[0] * sc + hud.m.oz - 7, 14, 14);
  c.fillStyle = '#fff'; c.fillRect(C.x[0] * sc + hud.m.ox - 7, C.z[0] * sc + hud.m.oz - 7, 7, 7); c.fillRect(C.x[0] * sc + hud.m.ox, C.z[0] * sc + hud.m.oz, 7, 7);
  const dot = document.createElement('i'); dot.className = 'me'; $('prog').replaceChildren(dot); hud.dots = [dot];
  $('chipLen').textContent = (C.len / 1000).toFixed(2) + ' km lap';
  $('chipBump').textContent = W.courseBumps.length + ' speed bumps';
}
const formatGap = (ms, unit = ' s') => (ms > 0 ? '+' : ms < 0 ? '−' : '') + (Math.abs(ms) / 1000).toFixed(3) + unit;
const gapTrend = ms => ms < 0 ? 'ahead' : ms > 0 ? 'behind' : 'level';
function updateSplitHud() {
  const visible = state === 'race' || state === 'finish' || state === 'pause';
  show('splitPanel', visible);
  const officialSplits = replay?.result?.run?.splitsMs;
  const splits = officialSplits || lap.splitsMs, count = splits.length;
  setText('splitHeading', leaderSnapshot ? 'VS #1 AT START · ' + leaderSnapshot.name : 'LEADER COMPARISON');
  setText('splitCheckpoint', 'CHECKPOINT ' + String(count).padStart(2, '0') + ' / 32');
  const valid = Boolean(officialSplits) || lap.valid;
  const comparison = valid ? compareSplit(splits, leaderSnapshot) : null;
  const trend = comparison ? gapTrend(comparison.gapMs) : 'neutral';
  $('splitPanel').dataset.trend = trend;
  $('compactSplit').dataset.trend = trend;
  setText('compactSplit', visible && comparison ? formatGap(comparison.gapMs, '') : '');
  $('splitSector').dataset.trend = comparison ? gapTrend(comparison.sectorGapMs) : 'neutral';
  if (!valid) {
    setText('splitDelta', '—'); setText('splitStatus', 'Invalid route'); setText('splitSector', 'Pause to restart');
  } else if (comparison) {
    setText('splitDelta', formatGap(comparison.gapMs));
    setText('splitStatus', comparison.gapMs < 0 ? 'Ahead at this checkpoint' : comparison.gapMs > 0 ? 'Behind at this checkpoint' : 'Level at this checkpoint');
    setText('splitSector', 'Last sector ' + formatGap(comparison.sectorGapMs));
  } else if (leaderSnapshot) {
    setText('splitDelta', '—'); setText('splitStatus', 'First comparison at checkpoint 1');
    setText('splitSector', 'Leader lap ' + fmt(leaderSnapshot.timeMs / 1000));
  } else {
    setText('splitDelta', count ? fmt(splits[count - 1] / 1000) : '—');
    setText('splitStatus', count ? 'Your time · no leader splits yet' : 'No leader splits yet');
    setText('splitSector', count ? 'Last sector ' + fmt((splits[count - 1] - (splits[count - 2] || 0)) / 1000) : 'First ranked finish sets the reference');
  }
}
function updateHud(dt) {
  const C = W.C, spd = Math.hypot(P.vx, P.vz) * 3.6;
  setText('spd', Math.round(spd));
  $('arc').setAttribute('stroke-dasharray', (311 * clamp(spd / (P.body.parameters.maxSpeed * 3.6), 0, 1)).toFixed(1) + ' 415');
  $('arc').setAttribute('stroke', P.body.contacts ? '#7fd0ff' : '#ffd23f');
  if (touchMode) setText('tB', P.body.contacts ? 'BRAKE' : 'FLIP');
  setText('time', fmt(P.done ? P.time : raceT));
  setText('driverName', P.name);
  setText('runMode', practice ? 'PRACTICE' : replay?.terminal && replay.result?.status !== 'finished' ? 'UNRANKED LAP' : 'TIME ATTACK');
  setText('checkpointStatus', 'CHECKPOINT ' + (replay?.result?.run?.splitsMs?.length ?? lap.checkpoints.length) + ' / 32');
  updateSplitHud();
  const leftM = Math.max(0, (C.n - P.prog) * (W.C.ds || DS));
  setText('left', leftM >= 1000 ? (leftM / 1000).toFixed(2) + ' km to go' : Math.round(leftM / 10) * 10 + ' m to go');
  hud.dots[0].style.left = clamp(P.prog / C.n * 100, 0, 100) + '%';
  const k = P.prog < 0 ? 0 : mod(Math.floor(P.prog), C.n);
  const nx = W.landmarks.find(m => m.idx > k + 4 && m.idx > 0) || { name: 'Finish line', idx: C.n };
  setText('nextName', nx.name); setText('nextDist', Math.round((nx.idx - k) * (W.C.ds || DS) / 10) * 10 + ' m');
  $('loadIbar').style.width = clamp(P.body.load / 2, 0, 1) * 100 + '%';
  setText('contactLabel', P.body.contacts ? (P.body.driftActive ? 'DRIFT · ' : '') + 'Contact ' + P.body.load.toFixed(1) + ' × static load' : 'Airborne · no contact');
  if (telemetry) setText('telemetryText', 'Pitch ' + (P.body.p * 180 / Math.PI).toFixed(1) + '° · Roll ' + (P.body.r * 180 / Math.PI).toFixed(1) + '° · Vertical ' + P.body.vy.toFixed(2) + ' m/s · ' + Math.round(1000 / frameMs) + ' FPS');
  $('telemetry').dataset.state = JSON.stringify({ x:P.x, z:P.z, heading:P.th, speed:spd, progress:P.prog, up:P.body.up, fps:1000/frameMs, checkpoints:lap.checkpoints.length, valid:lap.valid, mode:practice?'practice':'ranked' });
  setText('msg', state !== 'race' ? '' : P.done ? 'Finish line' : !lap.valid ? 'Invalid route · pause to restart' : P.flipT >= ROLLOVER_RECOVERY_SECONDS ? 'Recovering · clock keeps running' : P.flipT > .2 ? 'Auto recovery in ' + (ROLLOVER_RECOVERY_SECONDS - P.flipT).toFixed(1) + ' s · clock keeps running' : P.recoveryT > 0 ? 'Recovered · keep driving' : P.wrong > .8 ? 'Wrong way' : '');
  if (helpT > 0) { helpT -= dt; if (helpT <= 0) $('help').style.opacity = 0; }
  // minimap
  const c = $('mini').getContext('2d'), S = $('mini').width, m = hud.m;
  c.clearRect(0, 0, S, S); c.drawImage(hud.base, 0, 0);
  const mapHeading = !P.body.contacts && spd > 4 ? Math.atan2(P.vx, P.vz) : P.th;
  c.save(); c.translate(P.x * m.sc + m.ox, P.z * m.sc + m.oz); c.rotate(-mapHeading + Math.PI);
  c.fillStyle = '#2f95e8'; c.strokeStyle = '#fff'; c.lineWidth = 3.5;
  c.beginPath(); c.moveTo(0, -15); c.lineTo(10, 10); c.lineTo(0, 5); c.lineTo(-10, 10); c.closePath(); c.fill(); c.stroke(); c.restore();
}
function showCount(n, go) {
  const L = $('lights'), N = $('countN');
  L.classList.toggle('go', !!go); L.classList.toggle('hidden', n === '');
  [...L.children].forEach((b, i) => b.classList.toggle('on', !go && typeof n === 'number' && i <= 3 - n));
  if (N.textContent !== String(n)) { N.textContent = n; N.classList.remove('pop'); void N.offsetWidth; N.classList.add('pop'); }
}
function renderRecords() {
  for (const id of ['leaderboardTable', 'resTable']) {
    const table = $(id); table.replaceChildren();
    const head = table.createTHead().insertRow();
    for (const label of ['Rank', 'Nickname', 'Timing', 'Lap time']) { const cell = document.createElement('th'); cell.textContent = label; head.appendChild(cell); }
    const body = table.createTBody();
    for (const entry of leaderboardEntries.slice(0, 10)) {
      const row = body.insertRow();
      if (entry.name === P.name) row.className = 'me';
      for (const value of [entry.rank, entry.name, 'Server replay']) row.insertCell().textContent = String(value);
      const time = row.insertCell();
      time.textContent = officialTime(entry.timeMs);
      if (entry.device === 'mobile') {
        const badge = document.createElement('span');
        badge.className = 'record-device';
        badge.textContent = 'Mobile';
        time.appendChild(badge);
      }
    }
    if (!leaderboardEntries.length) { const cell = body.insertRow().insertCell(); cell.colSpan = 4; cell.textContent = 'Be the first to set a lap time.'; }
  }
}
async function refreshRecords() {
  $('leaderboardStatus').textContent = 'Loading online records…';
  try {
    const data = await records.list();
    leaderboardEntries = data.entries;
    leaderboardLeader = snapshotLeader(data.leader);
    renderRecords();
    $('leaderboardStatus').textContent = 'Best verified lap per nickname on the 130 km/h course.';
  } catch (error) { $('leaderboardStatus').textContent = error.message; }
}
function finishRace() {
  if (state === 'finish') return;
  P.done = 1;
  raceT = P.time;
  state = 'finish';
  finT = localFinishAt ? Math.min(2.4, (performance.now() - localFinishAt) / 1000) : 0;
  show('pause', false); show('touch', false); sfx.fanfare();
}

function updateResultTime() {
  const verified = replay?.result?.status === 'finished';
  const ms = verified ? replay.result.run.timeMs : Math.round(P.time * 1000);
  $('resTimeLabel').textContent = verified ? 'Official time' : 'Local time';
  $('resTime').textContent = officialTime(ms);
  show('resDevice', verified && replay.result.run.device === 'mobile');
  $('resSplit').textContent = leaderSnapshot ? formatGap(ms - leaderSnapshot.timeMs) + ' vs #1 ' + leaderSnapshot.name + ' at start' : 'No leader reference at the start of this run.';
  show('retrySaveBtn', Boolean(replay?.error && !replay.terminal));
  if (practice) {
    $('resBest').textContent = 'Practice complete.';
  } else if (verified) {
    $('resBest').textContent = 'Server replay verified · saved online';
  } else if (replay.terminal) {
    $('resBest').textContent = 'Unranked lap · ' + (replay.error?.message || 'The server replay did not complete the course.');
  } else if (replay.error) {
    $('resBest').textContent = 'Verification interrupted. ' + replay.error.message;
  } else {
    const percent = Math.floor(100 * replay.confirmed / Math.max(1, replay.total));
    $('resBest').textContent = 'Verifying your driving inputs… ' + percent + '%';
  }
}

function replayChanged(upload) {
  if (upload !== replay) {
    if (state === 'title' && upload.result?.status === 'finished') void refreshRecords();
    return;
  }
  if (upload.result?.status === 'finished') {
    P.time = upload.result.run.timeMs / 1000;
    finishRace();
    void refreshRecords();
  }
  if (!$('results').classList.contains('hidden')) updateResultTime();
}

function showResults() {
  $('resTitle').textContent = 'FINISH';
  $('resSub').textContent = P.name + ' · ' + (W.C.len / 1000).toFixed(2) + ' KM';
  updateResultTime(); renderRecords(); show('results', true);
}

// ───────────────────────── flow ─────────────────────────
function show(id, on) { $(id).classList.toggle('hidden', !on); }
async function startRace(isPractice = false) {
  if (starting) return;
  const name = normalizeName($('playerName').value);
  if (!name.valid) { $('nameError').textContent = name.error; toTitle(false); $('playerName').focus(); return; }
  $('nameError').textContent = ''; starting = true;
  for (const id of ['startBtn', 'practiceBtn', 'againBtn', 'titleBtn', 'restartBtn', 'quitBtn']) $(id).disabled = true;
  $('startBtn').textContent = 'Connecting…';
  sfx.init();
  try {
    const session = isPractice ? null : await records.start(name.name);
    const upload = session ? new ReplayUpload(session, records, replayChanged) : null;
    if (replay && !replay.closed) replay.dispose();
    replay = upload;
    P.name = name.name; $('playerName').value = P.name;
    try { localStorage.setItem('kaistcart3-nickname', P.name); } catch {}
    practice = isPractice;
    placeGrid();
    leaderSnapshot = snapshotLeader(isPractice ? leaderboardLeader : session.leader);
    $('touch').style.display = touchMode ? 'block' : 'none';
    show('title', false); show('results', false); show('pause', false); show('hud', true); show('touch', touchMode);
    $('help').style.opacity = 1; helpT = 9;
    state = 'count'; countT = 4.2; hud.beep = 4; last = 0;
    showCount('');
  } catch (error) { toTitle(false); $('nameError').textContent = error.message; }
  finally { starting = false; for (const id of ['startBtn', 'practiceBtn', 'againBtn', 'titleBtn', 'restartBtn', 'quitBtn']) $(id).disabled = false; $('startBtn').textContent = 'Start time attack'; }
}
function toTitle(refresh = true) {
  if (replay && !replay.closed) replay.dispose();
  replay = null; placeGrid(); state = 'title'; show('title', true); show('results', false); show('pause', false); show('hud', false); show('touch', false); sfx.quiet(); if (refresh) void refreshRecords();
}
let pausedState = 'race';
function setPause(on) { if (on && (state === 'race' || state === 'count')) { clearInputs(); pausedState = state; state = 'pause'; show('pause', true); show('touch', false); sfx.quiet(); } else if (!on && state === 'pause') { state = pausedState; last = 0; show('pause', false); show('touch', touchMode); } }
$('startBtn').onclick = () => startRace(); $('againBtn').onclick = () => startRace(practice);
$('restartBtn').onclick = () => { toTitle(false); void startRace(practice); };
$('practiceBtn').onclick = () => startRace(true);
$('retrySaveBtn').onclick = () => { replay?.retry(); updateResultTime(); };
$('refreshRecordsBtn').onclick = refreshRecords;
$('pauseBtn').onclick = () => setPause(true);
$('titleBtn').onclick = () => toTitle(); $('quitBtn').onclick = () => toTitle(); $('resumeBtn').onclick = () => setPause(false);
addEventListener('keydown', e => {
  if (e.target instanceof HTMLElement && e.target.matches('input, textarea, select')) {
    if (e.code === 'Enter' && state === 'title' && !$('startBtn').disabled && !e.isComposing) { e.preventDefault(); void startRace(); }
    return;
  }
  if (state !== 'race' && state !== 'count' && state !== 'pause') return;
  if (KEYMAP[e.code]) { heldCodes.add(e.code); updateKey(KEYMAP[e.code]); e.preventDefault(); }
  if (e.repeat) return;
  if (e.code === 'KeyM') sfx.setMuted(!sfx.muted);
  if (e.code === 'KeyT') { telemetry = !telemetry; $('telemetry').classList.toggle('hidden', !telemetry); }
  if (e.code === 'Escape' || e.code === 'KeyP') setPause(state !== 'pause');
});
addEventListener('keyup', e => { if (KEYMAP[e.code]) { heldCodes.delete(e.code); updateKey(KEYMAP[e.code]); e.preventDefault(); } });
addEventListener('blur', () => { clearInputs(); setPause(true); });
document.addEventListener('visibilitychange', () => { if (document.hidden) setPause(true); });
for (const [id, k] of [['tL', 'left'], ['tR', 'right'], ['tB', 'down'], ['tA', 'up'], ['tD', 'drift']]) {
  const el = $(id);
  el.addEventListener('pointerdown', e => { heldPointers.set(e.pointerId, k); updateKey(k); el.setPointerCapture(e.pointerId); e.preventDefault(); });
  for (const evn of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(evn, e => { heldPointers.delete(e.pointerId); updateKey(k); });
}
$('qualitySelect').onchange = e => { qual = e.target.value === 'auto' ? 0 : Number(e.target.value); applyQuality(); };
addEventListener('touchstart', () => { touchMode = true; if (state === 'race' || state === 'count') { $('touch').style.display = 'block'; show('touch', true); } }, { passive: true });

// ───────────────────────── main loop ─────────────────────────
function simulate(dt) {
  T += dt;
  if (state === 'count') {
    countT -= dt;
    const n = Math.ceil(countT - 1);
    if (n !== hud.beep && n >= 0 && n <= 3) { hud.beep = n; sfx.beep(n ? 440 : 880, n ? .16 : .5); }
    if (countT > 4) showCount(''); else if (n >= 1) showCount(n); else showCount('GO', true);
    if (countT <= 1) state = 'race';
  }
  const racing = state === 'race';
  if (racing) {
    if (countT > 0) { countT -= dt; if (countT <= 0) showCount(''); }
    raceT += dt;
  }
  const mask = racing && replay ? inputMask(keys) : 0;
  stepPlayer(dt, racing);
  if (racing) {
    trackProgress(dt);
    if (lap.completed && !P.done) {
      P.done = 1; P.time = lap.splitsMs.at(-1) / 1000;
      localFinishAt = performance.now();
      finishGrace = replay && !replay.terminal ? FINISH_GRACE_TICKS : 0;
    } else if (finishGrace > 0) finishGrace--;
    // Continue sampling real controls across the line for a short window.
    // An acknowledgement may finish this race before the local crossing.
    const final = Boolean(P.done && (finishGrace === 0 || replay?.terminal));
    replay?.capture(mask, final);
    if (final) finishRace();
  } else if (state === 'finish') {
    finT += dt;
    if (finT > 2.4 && $('results').classList.contains('hidden')) showResults();
  }
}
function tick(dt) {
  if (state === 'load') return;
  if (state !== 'pause') {
    stepper.advance(dt, simulate);
    poseKart(P.mesh, P, dt, T);
    effects(dt);
  }
  updateCamera(dt);
  if (window.__headless) return;
  sun.target.position.set(P.x, gAt(P.x, P.z), P.z);
  sun.position.copy(sun.target.position).addScaledVector(W.sun, 300);
  updateWorld(T, camera);
  if (state !== 'title') updateHud(dt);
  const spd = Math.hypot(P.vx, P.vz), racing = state === 'race' || state === 'count';
  if (post.ok && qual < 2) post.render(scene, camera, racing ? clamp((spd - 20) / 25, 0, .4) : 0, 0, T);
  else renderer.render(scene, camera);
}
let last = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const raw = last ? (now - last) / 1000 : 0; last = now;
  if (raw > 0 && raw < .5) frameMs += (raw * 1000 - frameMs) * .05;
  if (raw > .5 && (state === 'race' || state === 'count')) setPause(true);
  if (state === 'race' && raw < .5 && $('qualitySelect').value === 'auto') {
    ema += (raw * 1000 - ema) * .05;
    slowT = ema > 25 ? slowT + raw : 0;
    if (slowT > 3 && qual < 2) { qual++; slowT = 0; ema = 16; applyQuality(); }
  }
  // Racing elapsed time is accumulated at 240 Hz, independent of rendering cadence.
  // Background tabs and long stalls pause visibly instead of silently losing race time.
  tick(state === 'pause' ? Math.min(raw, .05) : Math.min(raw, .5));
}

async function init() {
  applyQuality();
  let n = 0;
  await loadWorld(scene, renderer, msg => { n++; $('loadMsg').textContent = msg + '…'; $('loadI').style.width = Math.min(95, n * 13) + '%'; });
  dust = new Particles(scene, 420, false); glow = new Particles(scene, 320, true); skids = new Skids(scene);
  P.mesh = makeNubzuki(scene, { body: P.color, accent: 0xf4f4f4, helmet: 0xffffff });
  placeGrid();
  buildHud();
  $('loadI').style.width = '100%'; $('loadMsg').textContent = ''; show('loadBar', false);
  $('startBtn').disabled = false; $('practiceBtn').disabled = false; $('startBtn').textContent = 'Start time attack';
  try { $('playerName').value = localStorage.getItem('kaistcart3-nickname') || ''; } catch {}
  toTitle();
}
requestAnimationFrame(frame);
init().catch(e => { console.error(e); $('loadMsg').textContent = 'Failed to load: ' + e.message; });
