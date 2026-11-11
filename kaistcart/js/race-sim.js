// Race controls and collision response shared by the browser and offline checks.
// AI requests pedals/steering; it never writes a vehicle onto the course spline.
import { resolveWallContact } from './vehicle-physics.js';
export const PHYSICS_STEP = 1 / 240;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mod = (v, n) => ((v % n) + n) % n;
export function angleDifference(a, b) { return Math.atan2(Math.sin(a - b), Math.cos(a - b)); }

export class FixedStepper {
  constructor(step = PHYSICS_STEP) { this.step = step; this.remainder = 0; }
  reset() { this.remainder = 0; }
  advance(elapsed, callback) {
    if (!Number.isFinite(elapsed) || elapsed < 0) throw new Error('Invalid elapsed time');
    this.remainder += elapsed;
    let steps = 0;
    while (this.remainder + 1e-12 >= this.step) {
      callback(this.step); this.remainder -= this.step; steps++;
    }
    this.remainder = Math.max(0, this.remainder);
    return steps;
  }
}

export function syncRacer(r) {
  const b = r.body;
  for (const k of ['x', 'z', 'th', 'vx', 'vz', 'vf', 'vl', 'wy']) r[k] = b[k];
  r.grip = b.load;
  r.drift = !b.parameters.noSlide && b.contacts > 0 && Math.abs(b.vl) > 1.8;
  r.boost = 0;
}

export function updateProgress(r, C) {
  const previous = r.prog || 0, start = Math.floor(previous);
  let best = Infinity, bestIndex = start;
  for (let i = start - 25; i <= start + 70; i++) {
    const k = mod(i, C.n), distance = (C.x[k] - r.x) ** 2 + (C.z[k] - r.z) ** 2;
    if (distance < best) { best = distance; bestIndex = i; }
  }
  r.lost = best > 35 ** 2;
  r.off = best > (C.halfWidth?.[mod(bestIndex, C.n)] || 5) ** 2;
  if (!r.lost) r.prog = bestIndex;
  return Math.sqrt(best);
}

export function aiControls(r, W, coursePos) {
  const C = W.C, ds = C.ds || 2, speed = Math.max(0, r.body.vf);
  const near = mod(Math.floor(r.prog), C.n);
  const lookM = clamp(4.5 + speed * .42, 5, 15);
  const look = Math.floor(lookM / ds);
  const width = C.halfWidth?.[mod(near + look, C.n)] || 5;
  const offset = clamp(r.offTarget || 0, -Math.max(0, width - 1.6), Math.max(0, width - 1.6));
  const target = {};
  coursePos(r.prog + look, offset, target);
  const dx = target.x - r.x, dz = target.z - r.z;
  const distance = Math.max(1, Math.hypot(dx, dz));
  const alpha = angleDifference(Math.atan2(dx, dz), r.body.th);
  // Pure pursuit computes a wheel angle; the tyre forces produce yaw.
  const steeringAngle = Math.atan2(2 * 1.9 * Math.sin(alpha), distance);
  // Positive yaw turns toward +X, which is screen-left in the rear chase view.
  const steer = clamp(-steeringAngle / .48, -1, 1);
  let targetSpeed = r.base || 18;
  const preview = Math.ceil((12 + speed * speed / 8) / ds);
  for (let j = 0; j <= preview; j += 2) {
    const index = mod(near + j, C.n), curve = C.k[index];
    const cornerSpeed = Math.sqrt(4.5 / Math.max(curve, .001));
    const approachSpeed = Math.sqrt(cornerSpeed ** 2 + 2 * 3.2 * j * ds);
    targetSpeed = Math.min(targetSpeed, approachSpeed);
    if (C.slow[index]) targetSpeed = Math.min(targetSpeed, Math.sqrt(8.5 ** 2 + 2 * 3.2 * j * ds));
  }
  if (Math.abs(alpha) > .7) targetSpeed = Math.min(targetSpeed, 5);
  if (r.off) targetSpeed = Math.min(targetSpeed, 6);
  const error = targetSpeed - speed;
  return { throttle: clamp(error * .3, 0, 1), brake: clamp(-error * .25, 0, 1), steer, handbrake: false };
}

// Static walls use the existing collision grid, sampled over the vehicle footprint.
// This is a conservative footprint approximation, not detailed bodywork collision.
export function resolveWalls(b, previous, surfaceAt) {
  const attemptedX = b.x, attemptedZ = b.z;
  const s = Math.sin(b.th), c = Math.cos(b.th);
  const points = [[-.72, -1.05], [.72, -1.05], [-.72, 1.05], [.72, 1.05], [0, 0]];
  const footprintHit = (px, pz) => {
    for (const [lx, lz] of points) {
      const x = px + lx * c + lz * s, z = pz - lx * s + lz * c;
      if (surfaceAt(x, z) === 9) return { x, z };
    }
    return null;
  };
  const hit = footprintHit(b.x, b.z);
  if (!hit) return 0;
  let nx = 0, nz = 0;
  for (let i = 0; i < 16; i++) {
    const a = i * Math.PI / 8, x = Math.sin(a), z = Math.cos(a);
    if (surfaceAt(hit.x + x * 1.1, hit.z + z * 1.1) !== 9) { nx += x; nz += z; }
  }
  let n = Math.hypot(nx, nz);
  if (n < .01) { nx = previous.x - b.x; nz = previous.z - b.z; n = Math.hypot(nx, nz); }
  if (n < .001) { nx = -s; nz = -c; n = 1; }
  nx /= n; nz /= n;
  if (!footprintHit(previous.x, previous.z)) {
    b.x = previous.x; b.z = previous.z;
  } else {
    // Rotation or another racer can invalidate the previous footprint. Restoring
    // that already-penetrating pose every frame prevents even outward escape.
    // Find a nearby valid pose first; do not add a velocity or energy boost.
    const originX = b.x, originZ = b.z;
    let safe = false;
    for (let distance = .05; distance <= 2.01; distance += .05) {
      const x = originX + nx * distance, z = originZ + nz * distance;
      if (!footprintHit(x, z)) { b.x = x; b.z = z; safe = true; break; }
    }
    // Corners can have no single useful grid normal. A bounded local search
    // resolves those cases without searching/teleporting across the whole map.
    for (let distance = .25; !safe && distance <= 2; distance += .25) {
      for (let i = 0; i < 16; i++) {
        const angle = Math.atan2(nx, nz) + i * Math.PI / 8;
        const x = originX + Math.sin(angle) * distance, z = originZ + Math.cos(angle) * distance;
        if (!footprintHit(x, z)) { b.x = x; b.z = z; safe = true; break; }
      }
    }
    // If a pose starts unusually deep inside a solid, retain outward movement
    // rather than permanently pinning it to the same invalid position.
    if (!safe && (b.x - previous.x) * nx + (b.z - previous.z) * nz <= 0) {
      b.x = previous.x; b.z = previous.z;
    }
  }
  const manifold = points.map(([lx, lz]) => [b.x + lx * c + lz * s, b.z - lx * s + lz * c]);
  const projection = p => p[0] * nx + p[1] * nz, minimum = Math.min(...manifold.map(projection));
  const tangentBefore = -b.vx * nz + b.vz * nx;
  const approach = resolveWallContact(b, nx, nz, manifold.filter(p => projection(p) < minimum + .015));
  const tangentAfter = -b.vx * nz + b.vz * nx;
  const fraction = Math.abs(tangentBefore) > 1e-8 ? clamp(tangentAfter / tangentBefore, 0, 1) : 0;
  const tangentMove = (-(attemptedX - b.x) * nz + (attemptedZ - b.z) * nx) * fraction;
  const slideX = b.x - nz * tangentMove, slideZ = b.z + nx * tangentMove;
  if (!footprintHit(slideX, slideZ)) { b.x = slideX; b.z = slideZ; }
  return approach;
}

export function resolveRacerContacts(racers, surfaceAt) {
  for (let i = 0; i < racers.length; i++) for (let j = i + 1; j < racers.length; j++) {
    const a = racers[i].body, b = racers[j].body;
    if (Math.abs(a.y - b.y) > 1.2) continue;
    const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), min = 1.9;
    if (d >= min || d < .0001) continue;
    const previousA = { x: a.x, z: a.z }, previousB = { x: b.x, z: b.z };
    const nx = dx / d, nz = dz / d, correction = (min - d) * .5;
    a.x -= nx * correction; a.z -= nz * correction; b.x += nx * correction; b.z += nz * correction;
    const relative = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
    if (relative < 0) {
      // All racers share the same chassis mass: equal and opposite impulse.
      const delta = -(1 + .08) * relative / 2;
      a.vx -= nx * delta; a.vz -= nz * delta; b.vx += nx * delta; b.vz += nz * delta;
    }
    if (surfaceAt) {
      resolveWalls(a, previousA, surfaceAt);
      resolveWalls(b, previousB, surfaceAt);
    }
  }
  racers.forEach(syncRacer);
}
