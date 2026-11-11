// Temporary race barriers. The renderer and collision solver share these exact
// closed inner faces; horizontal containment applies even while airborne.
// This module is renderer-free so the full circuit can be tested in Node.
import { resolveWallContact } from './vehicle-physics.js';
export const COURSE_BARRIER = Object.freeze({ height: .92, thickness: .28, skin: .025,
  halfWidth: 1.12, front: 1.10, rear: 1.50, bottom: -.35, top: 1.15,
  maxSweepDistance: .15, maxSweepAngle: .035, cellSize: 16 });
const cache = new WeakMap();
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const key = (x, z) => `${x},${z}`;

function addToGrid(grid, id, x0, z0, x1, z1) {
  const s = COURSE_BARRIER.cellSize;
  for (let x = Math.floor(x0 / s); x <= Math.floor(x1 / s); x++) for (let z = Math.floor(z0 / s); z <= Math.floor(z1 / s); z++) {
    const k = key(x, z), list = grid.get(k) || []; list.push(id); grid.set(k, list);
  }
}
function nearby(grid, x0, z0, x1, z1) {
  const ids = new Set(), s = COURSE_BARRIER.cellSize;
  for (let x = Math.floor(x0 / s); x <= Math.floor(x1 / s); x++) for (let z = Math.floor(z0 / s); z <= Math.floor(z1 / s); z++) {
    for (const id of grid.get(key(x, z)) || []) ids.add(id);
  }
  return ids;
}
function bounds(points) {
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const p of points) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]); }
  return { x0, z0, x1, z1 };
}

export function getCourseBarriers(C) {
  if (cache.has(C)) return cache.get(C);
  const sides = [[], []], outer = [[], []], segments = [], quads = [], segmentGrid = new Map(), quadGrid = new Map();
  for (let side = 0; side < 2; side++) {
    const sign = side ? -1 : 1;
    for (let i = 0; i < C.n; i++) {
      const hw = C.halfWidth?.[i] || 5, nx = C.tz[i] * sign, nz = -C.tx[i] * sign;
      sides[side].push([C.x[i] + nx * hw, C.z[i] + nz * hw]);
      outer[side].push([C.x[i] + nx * (hw + COURSE_BARRIER.thickness), C.z[i] + nz * (hw + COURSE_BARRIER.thickness)]);
    }
    for (let i = 0; i < C.n; i++) {
      const j = (i + 1) % C.n, a = sides[side][i], b = sides[side][j], dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
      if (length < 1e-7) continue;
      let nx = -dz / length, nz = dx / length;
      const mx = (C.x[i] + C.x[j]) / 2 - (a[0] + b[0]) / 2, mz = (C.z[i] + C.z[j]) / 2 - (a[1] + b[1]) / 2;
      if (nx * mx + nz * mz < 0) { nx = -nx; nz = -nz; }
      const id = segments.length;
      segments.push({ a, b, outerA: outer[side][i], outerB: outer[side][j], nx, nz, side, index: i, length });
      addToGrid(segmentGrid, id, Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1]));
    }
  }
  for (let i = 0; i < C.n; i++) {
    const j = (i + 1) % C.n, p = [sides[0][i], sides[1][i], sides[1][j], sides[0][j]], box = bounds(p);
    quads.push(p); addToGrid(quadGrid, i, box.x0, box.z0, box.x1, box.z1);
  }
  const result = { sides, outer, segments, segmentGrid, quads, quadGrid, closed: true };
  cache.set(C, result); return result;
}

const cross2 = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
function hull(points) {
  points.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const lower = [], upper = [];
  for (const p of points) { while (lower.length > 1 && cross2(lower[lower.length - 2], lower[lower.length - 1], p) <= 1e-10) lower.pop(); lower.push(p); }
  for (let i = points.length - 1; i >= 0; i--) { const p = points[i]; while (upper.length > 1 && cross2(upper[upper.length - 2], upper[upper.length - 1], p) <= 1e-10) upper.pop(); upper.push(p); }
  lower.pop(); upper.pop(); return lower.concat(upper);
}
function rotate(q, x, y, z) {
  const tx = 2 * (q[1] * z - q[2] * y), ty = 2 * (q[2] * x - q[0] * z), tz = 2 * (q[0] * y - q[1] * x);
  return [x + q[3] * tx + q[1] * tz - q[2] * ty, y + q[3] * ty + q[2] * tx - q[0] * tz,
    z + q[3] * tz + q[0] * ty - q[1] * tx];
}
function bodyCorners(body) {
  const B = COURSE_BARRIER, q = body.q || [0, Math.sin((body.th || 0) / 2), 0, Math.cos((body.th || 0) / 2)], points = [];
  for (const x of [-B.halfWidth, B.halfWidth]) for (const y of [B.bottom, B.top]) for (const z of [-B.rear, B.front]) {
    const p = rotate(q, x, y, z); points.push([body.x + p[0], (body.y || 0) + p[1], body.z + p[2]]);
  }
  return points;
}
export function courseBarrierFootprint(body) {
  return hull(bodyCorners(body).map(p => [p[0], p[2]]));
}
function segmentHitsHull(segment, polygon) {
  let low = 0, high = 1;
  const a = segment.a, b = segment.b;
  for (let i = 0; i < polygon.length; i++) {
    const p = polygon[i], q = polygon[(i + 1) % polygon.length], da = cross2(p, q, a), db = cross2(p, q, b), delta = db - da;
    if (Math.abs(delta) < 1e-12) { if (da < -1e-9) return false; continue; }
    const t = -da / delta;
    if (delta > 0) low = Math.max(low, t); else high = Math.min(high, t);
    if (low > high + 1e-10) return false;
  }
  return high >= 0 && low <= 1;
}
function contacts(body, geometry) {
  const polygon = courseBarrierFootprint(body), box = bounds(polygon), result = [];
  for (const id of nearby(geometry.segmentGrid, box.x0, box.z0, box.x1, box.z1)) {
    const segment = geometry.segments[id];
    if (!segmentHitsHull(segment, polygon)) continue;
    let minimum = Infinity;
    for (const p of polygon) minimum = Math.min(minimum, (p[0] - segment.a[0]) * segment.nx + (p[1] - segment.a[1]) * segment.nz);
    if (minimum < COURSE_BARRIER.skin) result.push({ ...segment, depth: COURSE_BARRIER.skin - minimum });
  }
  return result;
}
function contactPoints(body, hit) {
  const polygon = bodyCorners(body);
  const distance = p => (p[0] - hit.a[0]) * hit.nx + (p[2] - hit.a[1]) * hit.nz;
  const minimum = Math.min(...polygon.map(distance)), dx = hit.b[0] - hit.a[0], dz = hit.b[1] - hit.a[1];
  return polygon.filter(p => distance(p) < minimum + .015).map(p => {
    const t = clamp(((p[0] - hit.a[0]) * dx + (p[2] - hit.a[1]) * dz) / (hit.length ** 2), 0, 1);
    return [hit.a[0] + dx * t, p[1], hit.a[1] + dz * t];
  });
}
export function courseBarrierContactDepth(body, C) {
  return contacts(body, getCourseBarriers(C)).reduce((depth, hit) => Math.max(depth, hit.depth), 0);
}

function pointInPolygon(x, z, p) {
  let inside = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const a = p[i], b = p[j];
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
export function courseContainsPoint(x, z, C) {
  const g = getCourseBarriers(C);
  for (const id of nearby(g.quadGrid, x, z, x, z)) if (pointInPolygon(x, z, g.quads[id])) return true;
  return false;
}
export function courseContainsBody(body, C) {
  const p = courseBarrierFootprint(body);
  if (!courseContainsPoint(body.x, body.z, C)) return false;
  for (let i = 0; i < p.length; i++) {
    const a = p[i], b = p[(i + 1) % p.length];
    for (let f = 0; f < 1; f += .25) if (!courseContainsPoint(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, C)) return false;
  }
  return true;
}

/** Resolve the swept pose after each physics step, and again after racer contact
 * corrections. previous is the pre-step {x,z,q:[...body.q]} snapshot. Returns
 * maximum approach speed in m/s for collision sound/feedback. No progress/spline
 * position is assigned, and horizontal impulses cannot add kinetic energy.
 */
export function resolveCourseBarrier(body, previous, C, progress, dt = body.parameters?.maxStep || 1 / 240) {
  const geometry = getCourseBarriers(C), dx = body.x - previous.x, dz = body.z - previous.z;
  let endQ = body.q ? [...body.q] : null;
  const startQ = previous.q && endQ ? [...previous.q] : endQ;
  const qAngle = (a, b) => 2 * Math.acos(clamp(Math.abs(a.reduce((s, q, i) => s + q * b[i], 0)), 0, 1));
  const mixQ = (a, b, t) => {
    const sign = a.reduce((s, q, i) => s + q * b[i], 0) < 0 ? -1 : 1;
    const q = a.map((v, i) => v * (1 - t) + b[i] * sign * t), norm = Math.hypot(...q) || 1;
    return q.map(v => v / norm);
  };
  const angle = startQ && endQ ? qAngle(startQ, endQ) : 0;
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / COURSE_BARRIER.maxSweepDistance), Math.ceil(angle / COURSE_BARRIER.maxSweepAngle));
  let sx = dx / steps, sz = dz / steps;
  body.x = previous.x; body.z = previous.z;
  if (startQ) body.q = startQ;
  let approach = 0, constrained = false, correctionX = 0, correctionZ = 0;
  for (let step = 1; step <= steps; step++) {
    const from = { x: body.x, z: body.z, q: body.q ? [...body.q] : null };
    body.x += sx; body.z += sz;
    if (endQ && from.q) body.q = mixQ(from.q, endQ, Math.min(1 / (steps - step + 1), COURSE_BARRIER.maxSweepAngle / Math.max(1e-9, qAngle(from.q, endQ))));
    for (let iteration = 0; iteration < 10; iteration++) {
      const hits = contacts(body, geometry);
      if (!hits.length) break;
      constrained = true;
      const target = { x: body.x, z: body.z, q: body.q ? [...body.q] : null };
      const hit = hits.reduce((a, b) => sx * a.nx + sz * a.nz < sx * b.nx + sz * b.nz ? a : b);
      body.x = from.x; body.z = from.z; if (from.q) body.q = from.q;
      if (!contacts(body, geometry).length) {
        // Find first contact along this actual motion/rotation. Retreat is bounded
        // to one <=15cm microstep; finite segment corners cannot cause a metre-
        // scale projection onto an infinite wall plane or onto the course spline.
        let low = 0, high = 1;
        for (let search = 0; search < 14; search++) {
          const t = (low + high) / 2;
          body.x = from.x + (target.x - from.x) * t; body.z = from.z + (target.z - from.z) * t;
          if (from.q && target.q) body.q = mixQ(from.q, target.q, t);
          if (contacts(body, geometry).length) high = t; else low = t;
        }
        const safe = Math.max(0, low - 1e-5);
        body.x = from.x + (target.x - from.x) * safe; body.z = from.z + (target.z - from.z) * safe;
        if (from.q && target.q) {
          body.q = mixQ(from.q, target.q, safe);
        }
      } else {
        // Only an already-overlapping input (e.g. another racer's positional
        // separation) uses local depenetration. Normal driving uses swept contact.
        body.x = target.x + hit.nx * hit.depth; body.z = target.z + hit.nz * hit.depth;
        correctionX += hit.nx * hit.depth; correctionZ += hit.nz * hit.depth;
        if (target.q) body.q = target.q;
      }
      const tangentBefore = -body.vx * hit.nz + body.vz * hit.nx;
      approach = Math.max(approach, resolveWallContact(body, hit.nx, hit.nz, contactPoints(body, hit)));
      // The attempted orientation belongs to the pre-impact angular velocity.
      // Reusing it at every microstep pins a sliding car to the wall while its
      // speedometer continues to report the unconsumed tangential velocity.
      if (body.q) endQ = [...body.q];
      const motionNormal = sx * hit.nx + sz * hit.nz;
      if (motionNormal < 0) { sx -= motionNormal * hit.nx; sz -= motionNormal * hit.nz; }
      const tangentAfter = -body.vx * hit.nz + body.vz * hit.nx;
      const slidingFraction = Math.abs(tangentBefore) > 1e-8 ? clamp(tangentAfter / tangentBefore, 0, 1) : 0;
      sx *= slidingFraction; sz *= slidingFraction;
      // Consume the unobstructed tangent part of this microstep after contact.
      // A second wall/corner vetoes the move rather than crossing another face.
      const remaining = (-(target.x - body.x) * hit.nz + (target.z - body.z) * hit.nx) * slidingFraction;
      const safeX = body.x, safeZ = body.z;
      body.x -= hit.nz * remaining; body.z += hit.nx * remaining;
      const blocking = contacts(body, geometry);
      if (blocking.length) {
        body.x = safeX; body.z = safeZ;
        // At a join/corner, a second face may block the proposed slide. It is
        // another velocity constraint as well as a positional constraint;
        // discarding only its movement would again leave a fictitious speed.
        for (const second of blocking) {
          approach = Math.max(approach, resolveWallContact(body, second.nx, second.nz, contactPoints(body, second)));
          const inward = sx * second.nx + sz * second.nz;
          if (inward < 0) { sx -= inward * second.nx; sz -= inward * second.nz; }
        }
      }
    }
  }
  if (constrained && body.parameters?.noSlide && dt > 0) {
    // Grip assistance and the swept rigid boundary are both position
    // constraints. Reconstruct their shared admissible horizontal velocity
    // after projection, rather than carrying a blocked tyre velocity forward.
    // Never restore energy already dissipated by the physical impact impulse.
    const actualX = (body.x - previous.x - correctionX) / dt, actualZ = (body.z - previous.z - correctionZ) / dt;
    const admissible = Math.hypot(actualX, actualZ), remaining = Math.hypot(body.vx, body.vz);
    const ratio = admissible > 1e-10 ? Math.min(1, remaining / admissible) : 0;
    body.vx = actualX * ratio; body.vz = actualZ * ratio;
  }
  return approach;
}
