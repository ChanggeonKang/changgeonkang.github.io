// SI-unit, six-degree-of-freedom vehicle prototype. All dimensions and tuning below
// are explicit engineering assumptions for the fictional character, not a calibrated real vehicle.
// THREE right-handed coordinates: +Y up, character nose +Z. From the rear
// looking forward, driver/screen right is -local X. Positive steering turns
// right; mathematical THREE yaw/heading therefore decreases on a right turn.
export const VEHICLE_DEFAULTS = Object.freeze({
  mass: 220, gravity: 9.81, wheelbase: 1.90, track: 1.24,
  inertia: Object.freeze([125, 160, 95]), // body-axis moments, kg m²
  wheelRadius: 0.14, wheelInertia: 0.65,
  suspensionMountY: -0.10, suspensionRestLength: 0.26,
  springRate: 9500, damperRate: 1000, maxCompression: 0.18,
  bumpStopRate: 65000, bumpStopDamper: 1100,
  longitudinalStiffness: 9, corneringStiffness: 7, rearCorneringStiffness: 12, // multiples of normal force
  tractionSlip: .10, tractionResponseTime: .08, maxEngineWheelSpeed: 280,
  maxSteeringAngle: 0.48, engineTorque: 190, enginePower: 11000,
  brakeTorquePerWheel: 140, handbrakeTorquePerWheel: 180,
  rollingResistance: 0.018, airDensity: 1.225, dragArea: 0.65,
  chassisContactStiffness: 80000, chassisContactDamping: 1800,
  chassisFriction: 0.65, maxStep: 1 / 240,
});
export const RIDE = -VEHICLE_DEFAULTS.suspensionMountY + VEHICLE_DEFAULTS.suspensionRestLength
  + VEHICLE_DEFAULTS.wheelRadius - VEHICLE_DEFAULTS.mass * VEHICLE_DEFAULTS.gravity / (4 * VEHICLE_DEFAULTS.springRate);

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const norm = a => scale(a, 1 / (Math.hypot(...a) || 1));
const rotate = (q, v) => {
  const t = scale(cross(q, v), 2), c = cross(q, t);
  return [v[0] + q[3] * t[0] + c[0], v[1] + q[3] * t[1] + c[1], v[2] + q[3] * t[2] + c[2]];
};
const unrotate = (q, v) => rotate([-q[0], -q[1], -q[2], q[3]], v);
function quaternionFromBasis(r, u, f) {
  const m00 = r[0], m01 = u[0], m02 = f[0], m10 = r[1], m11 = u[1], m12 = f[1], m20 = r[2], m21 = u[2], m22 = f[2];
  const trace = m00 + m11 + m22;
  let x, y, z, w, s;
  if (trace > 0) { s = Math.sqrt(trace + 1) * 2; w = s / 4; x = (m21 - m12) / s; y = (m02 - m20) / s; z = (m10 - m01) / s; }
  else if (m00 > m11 && m00 > m22) { s = Math.sqrt(1 + m00 - m11 - m22) * 2; w = (m21 - m12) / s; x = s / 4; y = (m01 + m10) / s; z = (m02 + m20) / s; }
  else if (m11 > m22) { s = Math.sqrt(1 + m11 - m00 - m22) * 2; w = (m02 - m20) / s; x = (m01 + m10) / s; y = s / 4; z = (m12 + m21) / s; }
  else { s = Math.sqrt(1 + m22 - m00 - m11) * 2; w = (m10 - m01) / s; x = (m02 + m20) / s; y = (m12 + m21) / s; z = s / 4; }
  return [x, y, z, w];
}

/** Horizontal wall contact manifold, inelastic normal impulses and Coulomb
 * friction. Contact points are [worldX, worldY, worldZ], or [worldX, worldZ]
 * for an explicitly two-dimensional footprint. Vertical velocity is preserved,
 * while all three angular components respond at the actual contact height.
 * No wheel speed or chassis speed is assigned by this solver.
 */
export function resolveWallContact(body, nx, nz, points, { friction = .45, restitution = 0 } = {}) {
  const mass = body.parameters?.mass || VEHICLE_DEFAULTS.mass;
  const inertia = body.parameters?.inertia || VEHICLE_DEFAULTS.inertia;
  const q = body.q || [0, Math.sin((body.th || 0) / 2), 0, Math.cos((body.th || 0) / 2)];
  const normal = norm([nx, 0, nz]), tangent = [-normal[2], 0, normal[0]];
  body.angularVelocity ||= [0, 0, 0];
  const inverseInertia = value => {
    const local = unrotate(q, value);
    return rotate(q, local.map((v, i) => v / inertia[i]));
  };
  const velocity = arm => add([body.vx, body.vy || 0, body.vz], cross(body.angularVelocity, arm));
  const denominator = (arm, axis) => 1 / mass + dot(axis, cross(inverseInertia(cross(arm, axis)), arm));
  const apply = (arm, axis, amount) => {
    const impulse = scale(axis, amount);
    body.vx += impulse[0] / mass; body.vz += impulse[2] / mass;
    body.angularVelocity = add(body.angularVelocity, inverseInertia(cross(arm, impulse)));
  };
  let approach = 0;
  const contacts = (points?.length ? points : [[body.x, body.z]]).map(point => {
    const arm = [point[0] - body.x, point.length === 3 ? point[1] - (body.y || 0) : 0,
      point[point.length - 1] - body.z], vn = dot(velocity(arm), normal);
    approach = Math.max(approach, -vn);
    return { arm, normalMass: denominator(arm, normal), tangentMass: denominator(arm, tangent),
      target: -restitution * Math.min(0, vn), normalImpulse: 0, tangentImpulse: 0 };
  });
  for (let iteration = 0; iteration < 10; iteration++) for (const contact of contacts) {
    const { arm } = contact;
    const normalImpulse = Math.max(0, contact.normalImpulse + (contact.target - dot(velocity(arm), normal)) / contact.normalMass);
    apply(arm, normal, normalImpulse - contact.normalImpulse); contact.normalImpulse = normalImpulse;
    const tangentImpulse = clamp(contact.tangentImpulse - dot(velocity(arm), tangent) / contact.tangentMass,
      -friction * normalImpulse, friction * normalImpulse);
    apply(arm, tangent, tangentImpulse - contact.tangentImpulse); contact.tangentImpulse = tangentImpulse;
  }
  return approach;
}

/** A complete vehicle, with public SI position/linear velocity and quaternion q.
 * Constructor does not query the world. Call reset only after map initialization.
 * step(dt, {throttle:-1..1, brake:0..1, steer:-1..1, handbrake:boolean}) returns
 * accumulated chassis/bump-stop normal impulse in N s. Wheels and chassis are
 * unilateral contacts; steering/drive cannot rotate the chassis in free flight.
 */
export class Vehicle {
  constructor({ groundAt = () => 0, surfaceAt = () => 2, parameters = {} } = {}) {
    this.groundAt = groundAt; this.surfaceAt = surfaceAt;
    this.parameters = { ...VEHICLE_DEFAULTS, ...parameters, inertia: [...(parameters.inertia || VEHICLE_DEFAULTS.inertia)] };
    const p = this.parameters;
    this.rideHeight = -p.suspensionMountY + p.suspensionRestLength + p.wheelRadius - p.mass * p.gravity / (4 * p.springRate);
    this.x = 0; this.y = this.rideHeight; this.z = 0;
    this.vx = 0; this.vy = 0; this.vz = 0;
    this.q = [0, 0, 0, 1]; this.angularVelocity = [0, 0, 0];
    this.wheels = [];
    for (const z of [p.wheelbase / 2, -p.wheelbase / 2]) for (const x of [-p.track / 2, p.track / 2]) {
      this.wheels.push({ x, z, omega: 0, angle: 0, compression: 0, normalLoad: 0, grounded: false, slipRatio: 0, slipAngle: 0 });
    }
    // Simple convex support samples, positioned relative to the center of mass.
    this.hardPoints = [
      [-0.48, -0.29, 0.70, false], [0.48, -0.29, 0.70, false],
      [-0.48, -0.29, -0.70, false], [0.48, -0.29, -0.70, false],
      [-1.10, 0.50 - this.rideHeight, 0.95, false], [1.10, 0.50 - this.rideHeight, 0.95, false],
      [0, 1.55 - this.rideHeight, -0.30, true], [0, 0.30 - this.rideHeight, -1.40, false],
    ];
    this.load = 0; this.contacts = 0; this.airT = 0; this.landed = 0; this.roof = false;
    this.normalImpulse = 0; this.hardImpulse = 0; this.steer = 0;
  }

  get right() { return rotate(this.q, [-1, 0, 0]); }
  get upward() { return rotate(this.q, [0, 1, 0]); }
  get forward() { return rotate(this.q, [0, 0, 1]); }
  get th() { const f = this.forward; return Math.atan2(f[0], f[2]); }
  get p() { return Math.asin(clamp(this.forward[1], -1, 1)); }
  get r() { const r = this.right, u = this.upward; return Math.atan2(-r[1], u[1]); }
  get up() { return this.upward[1]; }
  get wy() { return this.angularVelocity[1]; }
  get wp() { return dot(this.angularVelocity, this.right); }
  get wr() { return dot(this.angularVelocity, this.forward); }
  get vf() { return dot([this.vx, this.vy, this.vz], this.forward); }
  get vl() { return dot([this.vx, this.vy, this.vz], this.right); }

  _ground(x, z) {
    const e = 0.06, height = this.groundAt(x, z);
    const gx = (this.groundAt(x + e, z) - this.groundAt(x - e, z)) / (2 * e);
    const gz = (this.groundAt(x, z + e) - this.groundAt(x, z - e)) / (2 * e);
    return { height, normal: norm([-gx, 1, -gz]) };
  }

  reset(x, z, heading = 0, groundOverride) {
    const ground = this._ground(x, z), u = ground.normal;
    const horizontal = [Math.sin(heading), 0, Math.cos(heading)];
    const f = norm(add(horizontal, scale(u, -dot(horizontal, u))));
    // A rotation matrix needs its canonical +X column (driver-left), not the
    // driver-right vector used for steering and lateral speed.
    this.q = quaternionFromBasis(norm(cross(u, f)), u, f);
    this.x = x; this.z = z; this.y = (groundOverride ?? ground.height) + this.rideHeight / Math.max(0.2, u[1]);
    this.vx = 0; this.vy = 0; this.vz = 0; this.angularVelocity = [0, 0, 0];
    this.load = 1; this.contacts = 4; this.airT = 0; this.landed = 0; this.roof = false; this.steer = 0;
    this.normalImpulse = 0; this.hardImpulse = 0;
    for (const w of this.wheels) { w.omega = 0; w.angle = 0; w.compression = 0; w.normalLoad = 0; w.grounded = false; w.slipRatio = 0; w.slipAngle = 0; }
    return this;
  }

  translate(dx, dz) { this.x += dx; this.z += dz; }

  _inverseInertia(worldVector) {
    const v = unrotate(this.q, worldVector), i = this.parameters.inertia;
    return rotate(this.q, [v[0] / i[0], v[1] / i[1], v[2] / i[2]]);
  }

  applyImpulse(ix, iy, iz, worldContact) {
    const m = this.parameters.mass;
    this.vx += ix / m; this.vy += iy / m; this.vz += iz / m;
    if (worldContact) {
      const point = Array.isArray(worldContact) ? worldContact : [worldContact.x, worldContact.y, worldContact.z];
      const r = [point[0] - this.x, point[1] - this.y, point[2] - this.z];
      this.angularVelocity = add(this.angularVelocity, this._inverseInertia(cross(r, [ix, iy, iz])));
    }
  }

  velocityAt(point) {
    return add([this.vx, this.vy, this.vz], cross(this.angularVelocity, [point[0] - this.x, point[1] - this.y, point[2] - this.z]));
  }

  _friction(x, z) {
    const surface = this.surfaceAt(x, z);
    if (surface && typeof surface === 'object') return Math.max(0, surface.friction ?? 1.05);
    return surface === 0 ? 0.60 : surface === 8 ? 0.30 : surface === 1 ? 0.85 : 1.05;
  }

  step(dt, controls = {}) {
    if (!Number.isFinite(dt) || dt <= 0) return 0;
    const count = Math.max(1, Math.ceil(dt / this.parameters.maxStep)), h = dt / count;
    const input = {
      throttle: clamp(controls.throttle || 0, -1, 1), brake: clamp(controls.brake || 0, 0, 1),
      steer: clamp(controls.steer || 0, -1, 1), handbrake: Boolean(controls.handbrake),
    };
    let hardImpulse = 0, normalImpulse = 0;
    for (let i = 0; i < count; i++) { this._integrate(h, input); hardImpulse += this.hardImpulse; normalImpulse += this.normalImpulse; }
    this.hardImpulse = hardImpulse; this.normalImpulse = normalImpulse;
    return hardImpulse;
  }

  _integrate(dt, input) {
    const p = this.parameters, u = this.upward, f = this.forward, right = this.right;
    const force = [0, -p.mass * p.gravity, 0], torque = [0, 0, 0];
    let normalSum = 0, contacts = 0, hardImpulse = 0, roof = false;
    const applyForce = (v, point) => {
      for (let i = 0; i < 3; i++) force[i] += v[i];
      if (point) {
        const t = cross([point[0] - this.x, point[1] - this.y, point[2] - this.z], v);
        for (let i = 0; i < 3; i++) torque[i] += t[i];
      }
    };
    this.steer += (input.steer - this.steer) * (1 - Math.exp(-dt * 10));
    const rearAngularSpeed = (Math.abs(this.wheels[2].omega) + Math.abs(this.wheels[3].omega)) / 2;
    const engineTorque = input.throttle * (input.throttle < 0 ? 0.45 : 1)
      * Math.min(p.engineTorque, p.enginePower / Math.max(20, rearAngularSpeed));

    for (const wheel of this.wheels) {
      const rear = wheel.z < 0, steering = rear ? 0 : this.steer * p.maxSteeringAngle;
      const mount = add([this.x, this.y, this.z], rotate(this.q, [wheel.x, p.suspensionMountY, wheel.z]));
      let length = p.suspensionRestLength, sample, center, alignment = 0;
      wheel.grounded = false; wheel.normalLoad = 0; wheel.compression = 0; wheel.slipRatio = 0; wheel.slipAngle = 0;
      // Sphere contact along the suspension axis; local plane iterations include road slope.
      if (u[1] > 0.15) for (let i = 0; i < 3; i++) {
        center = add(mount, scale(u, -length)); sample = this._ground(center[0], center[2]);
        alignment = dot(sample.normal, u);
        if (alignment <= 0.15) break;
        length += ((center[1] - sample.height) * sample.normal[1] - p.wheelRadius) / alignment;
      }

      let tireForceLong = 0, normalLoad = 0, rollingVelocity = 0;
      if (u[1] > 0.15 && alignment > 0.15 && length < p.suspensionRestLength) {
        center = add(mount, scale(u, -length)); sample = this._ground(center[0], center[2]);
        const n = sample.normal, point = add(center, scale(n, -p.wheelRadius));
        const velocity = this.velocityAt(point), compression = p.suspensionRestLength - length;
        const compressionRate = -dot(velocity, n) / Math.max(0.15, dot(n, u));
        const stop = Math.max(0, compression - p.maxCompression);
        const stopForce = stop > 0 ? p.bumpStopRate * stop + p.bumpStopDamper * Math.max(0, compressionRate) : 0;
        normalLoad = Math.max(0, (p.springRate * compression + p.damperRate * compressionRate + stopForce) / Math.max(0.15, dot(n, u)));
        wheel.compression = compression; wheel.normalLoad = normalLoad; wheel.grounded = normalLoad > 1;
        if (wheel.grounded) contacts++;
        normalSum += normalLoad; hardImpulse += stopForce * dt;
        applyForce(scale(n, normalLoad), point);

        const steered = add(scale(f, Math.cos(steering)), scale(right, Math.sin(steering)));
        const tangentForward = norm(add(steered, scale(n, -dot(steered, n))));
        const tangentRight = norm(cross(tangentForward, n));
        const longitudinal = dot(velocity, tangentForward), lateral = dot(velocity, tangentRight);
        rollingVelocity = longitudinal;
        const treadSpeed = wheel.omega * p.wheelRadius;
        const slipRatio = (treadSpeed - longitudinal) / Math.max(2, Math.abs(treadSpeed), Math.abs(longitudinal));
        const slipAngle = Math.atan2(lateral, Math.max(2, Math.abs(longitudinal)));
        let fx = p.longitudinalStiffness * normalLoad * slipRatio;
        // A modest rear stiffness bias makes the chassis mildly understeer;
        // either axle can still slide when the combined friction circle saturates.
        let fy = -(rear ? p.rearCorneringStiffness : p.corneringStiffness) * normalLoad * slipAngle;
        const limit = this._friction(point[0], point[2]) * normalLoad, demand = Math.hypot(fx, fy);
        if (demand > limit && demand > 0) { const k = limit / demand; fx *= k; fy *= k; }
        tireForceLong = fx;
        wheel.slipRatio = slipRatio; wheel.slipAngle = slipAngle;
        wheel.longitudinalForce = fx; wheel.lateralForce = fy; wheel.frictionLimit = limit;
        applyForce(add(scale(tangentForward, fx), scale(tangentRight, fy)), point);
      } else { wheel.longitudinalForce = 0; wheel.lateralForce = 0; wheel.frictionLimit = 0; }

      // Wheel angular momentum couples engine/brake torque to road traction.
      let driveTorque = rear ? engineTorque / 2 : 0;
      if (driveTorque) {
        // Engine torque control, not a velocity/yaw clamp: a spinning driven
        // wheel otherwise uses up rear lateral grip throughout a steering
        // reversal. Reduce only drive torque; existing wheel momentum still
        // decelerates through the same tyre/road reaction force.
        const sign = Math.sign(driveTorque);
        if (wheel.grounded) {
          const targetOmega = (rollingVelocity + sign * p.tractionSlip * Math.max(2, Math.abs(rollingVelocity))) / p.wheelRadius;
          const trackingTorque = tireForceLong * p.wheelRadius + p.wheelInertia * (targetOmega - wheel.omega) / p.tractionResponseTime;
          driveTorque = sign * Math.min(Math.abs(driveTorque), Math.max(0, sign * trackingTorque));
        }
        // Finite no-load engine speed also bounds wheel spin while airborne.
        driveTorque *= clamp((p.maxEngineWheelSpeed - Math.abs(wheel.omega)) / 40, 0, 1);
      }
      wheel.driveTorque = driveTorque;
      let nextOmega = wheel.omega + (driveTorque - tireForceLong * p.wheelRadius) * dt / p.wheelInertia;
      const resistTorque = p.brakeTorquePerWheel * input.brake
        + (rear && input.handbrake ? p.handbrakeTorquePerWheel : 0)
        + p.rollingResistance * normalLoad * p.wheelRadius;
      nextOmega -= clamp(nextOmega, -resistTorque * dt / p.wheelInertia, resistTorque * dt / p.wheelInertia);
      wheel.omega = nextOmega; wheel.angle += nextOmega * dt;
    }

    for (const hp of this.hardPoints) {
      const point = add([this.x, this.y, this.z], rotate(this.q, hp));
      const sample = this._ground(point[0], point[2]), n = sample.normal;
      const penetration = (sample.height - point[1]) * n[1];
      if (penetration <= 0) continue;
      const velocity = this.velocityAt(point), vn = dot(velocity, n);
      const fn = Math.max(0, p.chassisContactStiffness * penetration - p.chassisContactDamping * vn);
      if (fn <= 0) continue;
      applyForce(scale(n, fn), point);
      const tangentVelocity = add(velocity, scale(n, -vn)), speed = Math.hypot(...tangentVelocity);
      if (speed > 1e-7) {
        const direction = scale(tangentVelocity, 1 / speed), arm = [point[0] - this.x, point[1] - this.y, point[2] - this.z];
        const effectiveInverseMass = 1 / p.mass + dot(direction, cross(this._inverseInertia(cross(arm, direction)), arm));
        const friction = Math.min(p.chassisFriction * fn, speed / (effectiveInverseMass * dt));
        applyForce(scale(direction, -friction), point);
      }
      normalSum += fn; hardImpulse += fn * dt; contacts++; roof ||= hp[3];
    }

    const velocity = [this.vx, this.vy, this.vz], speed = Math.hypot(...velocity);
    applyForce(scale(velocity, -0.5 * p.airDensity * p.dragArea * speed));
    this.vx += force[0] / p.mass * dt; this.vy += force[1] / p.mass * dt; this.vz += force[2] / p.mass * dt;
    this.x += this.vx * dt; this.y += this.vy * dt; this.z += this.vz * dt;

    const bodyOmega = unrotate(this.q, this.angularVelocity), inertia = p.inertia;
    const bodyMomentum = [bodyOmega[0] * inertia[0], bodyOmega[1] * inertia[1], bodyOmega[2] * inertia[2]];
    const bodyTorque = unrotate(this.q, torque), gyroscopic = cross(bodyOmega, bodyMomentum);
    const angularAcceleration = rotate(this.q, [(bodyTorque[0] - gyroscopic[0]) / inertia[0], (bodyTorque[1] - gyroscopic[1]) / inertia[1], (bodyTorque[2] - gyroscopic[2]) / inertia[2]]);
    this.angularVelocity = add(this.angularVelocity, scale(angularAcceleration, dt));
    const w = this.angularVelocity, q = this.q;
    const dq = [w[0] * q[3] + w[1] * q[2] - w[2] * q[1], -w[0] * q[2] + w[1] * q[3] + w[2] * q[0], w[0] * q[1] - w[1] * q[0] + w[2] * q[3], -w[0] * q[0] - w[1] * q[1] - w[2] * q[2]];
    for (let i = 0; i < 4; i++) q[i] += 0.5 * dq[i] * dt;
    const qLength = Math.hypot(...q); for (let i = 0; i < 4; i++) q[i] /= qLength;

    this.load = normalSum / (p.mass * p.gravity); this.contacts = contacts; this.roof = roof;
    this.normalImpulse = normalSum * dt; this.hardImpulse = hardImpulse;
    if (!contacts) this.airT += dt;
    else { if (this.airT > 0.1) this.landed = Math.max(this.landed, this.airT); this.airT = 0; }
    if (![this.x, this.y, this.z, this.vx, this.vy, this.vz, ...q, ...this.angularVelocity].every(Number.isFinite)) throw new Error('Vehicle physics produced a non-finite state.');
  }
}
