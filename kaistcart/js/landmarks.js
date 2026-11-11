// Photo-informed, code-native landmark approximations. No third-party image textures.
// References: references/official/{chung-moon-soul-e16,sports-complex-n3}.jpg
// and references/commons/sports-complex-AhmadElq-2019.jpg.
// Only the original OSM footprint is geographically sourced. Heights, tower placement,
// facade divisions and structural details below are visual estimates, NOT surveyed.
import * as THREE from '../lib/three.module.min.js';

export const LANDMARK_REFS = new Set(['E16', 'N3']);
const UP = [0, 1, 0];
const mix = (a, b, t) => a + (b - a) * t;
const tint = n => new THREE.Color(n);

function inside(x, z, p) {
  let hit = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const a = p[i], b = p[j];
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) hit = !hit;
  }
  return hit;
}
function ringInside(q, p) {
  return q.every((a, i) => {
    const b = q[(i + 1) % q.length];
    const steps = Math.max(2, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / .4));
    for (let k = 0; k <= steps; k++) if (!inside(mix(a[0], b[0], k / steps), mix(a[1], b[1], k / steps), p)) return false;
    return true;
  });
}
function areaSign(p) {
  return Math.sign(p.reduce((s, a, i) => { const b = p[(i + 1) % p.length]; return s + a[0] * b[1] - b[0] * a[1]; }, 0)) || 1;
}

// One draw call per material family per building. Normals and vertex colours are
// explicit, so landmark construction also works in Node without Canvas or WebGL.
class Batch {
  constructor() { this.positions = []; this.normals = []; this.colors = []; }
  tri(a, b, c, color, normal) {
    const ab = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const ac = new THREE.Vector3(c[0] - a[0], c[1] - a[1], c[2] - a[2]);
    const n = ab.cross(ac);
    if (n.lengthSq() < 1e-12) return;
    if (normal && n.dot(new THREE.Vector3(...normal)) < 0) [b, c] = [c, b];
    const nn = normal || n.normalize().toArray();
    for (const v of [a, b, c]) { this.positions.push(...v); this.normals.push(...nn); this.colors.push(color.r, color.g, color.b); }
  }
  quad(a, b, c, d, color, normal) { this.tri(a, b, c, color, normal); this.tri(a, c, d, color, normal); }
  geometry(g, x, y, z, color) {
    const q = g.index ? g.toNonIndexed() : g;
    const pos = q.attributes.position, nor = q.attributes.normal;
    for (let i = 0; i < pos.count; i++) {
      this.positions.push(pos.getX(i) + x, pos.getY(i) + y, pos.getZ(i) + z);
      this.normals.push(nor.getX(i), nor.getY(i), nor.getZ(i)); this.colors.push(color.r, color.g, color.b);
    }
    if (q !== g) q.dispose(); g.dispose();
  }
  mesh(material, name) {
    if (!this.positions.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    g.computeBoundingBox(); g.computeBoundingSphere();
    const m = new THREE.Mesh(g, material); m.name = name; m.castShadow = true; m.receiveShadow = true;
    return m;
  }
}

function roof(batch, p, y, color) {
  const triangles = THREE.ShapeUtils.triangulateShape(p.map(q => new THREE.Vector2(q[0], q[1])), []);
  for (const t of triangles) batch.tri(...t.map(i => [p[i][0], y, p[i][1]]), color, UP);
}
function walls(batch, p, bottom, top, color) {
  const sign = areaSign(p);
  for (let i = 0; i < p.length; i++) {
    const a = p[i], b = p[(i + 1) % p.length], dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
    if (length < .02) continue;
    batch.quad([a[0], bottom, a[1]], [b[0], bottom, b[1]], [b[0], top, b[1]], [a[0], top, a[1]], color, [sign * dz / length, 0, -sign * dx / length]);
  }
}
function volume(batch, p, bottom, top, color, roofColor = color) {
  walls(batch, p, bottom, top, color); roof(batch, p, top, roofColor);
}

// Facade rectangles stay on the source footprint plane. polygonOffset on glass
// avoids coplanar flicker without moving glass into roads or beyond the footprint.
function facade(batch, a, b, t0, t1, y0, y1, color, normal) {
  const x0 = mix(a[0], b[0], t0), z0 = mix(a[1], b[1], t0), x1 = mix(a[0], b[0], t1), z1 = mix(a[1], b[1], t1);
  batch.quad([x0, y0, z0], [x1, y0, z1], [x1, y1, z1], [x0, y1, z0], color, normal);
}

function fitTower(p) {
  // The E16 tower is in the northern wing in the reference map. Search for an
  // inscribed rectangle there, keeping every edge inside the original polygon.
  let length = 0, u = [1, 0];
  p.forEach((a, i) => { const b = p[(i + 1) % p.length], d = Math.hypot(b[0] - a[0], b[1] - a[1]); if (d > length) { length = d; u = [(b[0] - a[0]) / d, (b[1] - a[1]) / d]; } });
  const v = [-u[1], u[0]], xs = p.map(a => a[0]), zs = p.map(a => a[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
  for (const [w, d] of [[28, 10], [24, 9], [20, 8], [16, 7]]) {
    let best = null, score = Infinity;
    for (let x = minX + 2; x < maxX - 2; x += 1.5) for (let z = minZ + 2; z < maxZ - 2; z += 1.5) {
      const q = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) => [x + sx * w * .5 * u[0] + sz * d * .5 * v[0], z + sx * w * .5 * u[1] + sz * d * .5 * v[1]]);
      if (z < score && ringInside(q, p)) { best = q; score = z; }
    }
    if (best) return best;
  }
  return null;
}

function e16(b, p, base, batches) {
  const { stone, metal, glass } = batches;
  const pink = tint(0xb98c7e), pale = tint(0xd6cfbb), teal = tint(0x42767b), frame = tint(0xa6aaa1), dark = tint(0x27484e);
  const podium = base + 9.2;
  volume(stone, p, base, podium, pink, tint(0x9a9991));
  walls(metal, p, podium - .28, podium, tint(0xafa49a));
  const sign = areaSign(p);
  p.forEach((a, i) => {
    const q = p[(i + 1) % p.length], dx = q[0] - a[0], dz = q[1] - a[1], L = Math.hypot(dx, dz);
    if (L < 2.5) return;
    const normal = [sign * dz / L, 0, -sign * dx / L], count = Math.max(1, Math.floor(L / 3.2));
    for (let j = 0; j < count; j++) for (const [lo, hi] of [[.6, 3.4], [5.3, 7.8]])
      facade(glass, a, q, (j + .14) / count, (j + .86) / count, base + lo, base + hi, j % 4 ? teal : dark, normal);
  });
  const tower = fitTower(p);
  if (!tower) return { top: podium, note: 'Tower omitted because no inscribed footprint rectangle could be found' };
  const top = base + 39;
  volume(glass, tower, podium, top - .5, teal, tint(0x6b8c91));
  walls(metal, tower, top - .5, top, pale); roof(metal, tower, top, tint(0x8d9997));
  const signT = areaSign(tower);
  tower.forEach((a, i) => {
    const q = tower[(i + 1) % tower.length], dx = q[0] - a[0], dz = q[1] - a[1], L = Math.hypot(dx, dz), normal = [signT * dz / L, 0, -signT * dx / L];
    const count = Math.max(1, Math.round(L / 2.2));
    for (let j = 0; j <= count; j++) facade(metal, a, q, Math.max(0, j / count - .07 / L), Math.min(1, j / count + .07 / L), podium, top, frame, normal);
    for (let y = podium + 3.2; y < top - .5; y += 3.2) facade(metal, a, q, 0, 1, y, y + .14, frame, normal);
    // Pale end core from the photo; it remains on the inscribed tower face.
    if (L < 14) facade(metal, a, q, 0, .28, podium, top, pale, normal);
  });
  return { top, towerFootprint: tower, podiumHeightM: 9.2, approximateHeightM: 39 };
}

function n3(b, p, base, batches) {
  const { stone, metal, glass } = batches;
  const silver = tint(0xbfc4c6), darkSilver = tint(0x858f91), teal = tint(0x3d6775), concrete = tint(0xb2b0a5);
  const cx = p.reduce((s, a) => s + a[0], 0) / p.length, cz = p.reduce((s, a) => s + a[1], 0) / p.length;
  const lower = p.map(a => [mix(a[0], cx, .14), mix(a[1], cz, .14)]);
  volume(stone, p, base, base + .32, concrete);
  if (ringInside(lower, p)) volume(glass, lower, base + .32, base + 6.6, tint(0x34545c));
  const top = base + 18.5, sign = areaSign(p);
  p.forEach((a, i) => {
    const q = p[(i + 1) % p.length], dx = q[0] - a[0], dz = q[1] - a[1], L = Math.hypot(dx, dz);
    if (L < .02) return;
    const normal = [sign * dz / L, 0, -sign * dx / L], count = Math.max(1, Math.ceil(L / 2.25));
    const fascia0 = base + 6.0 + Math.sin(i / p.length * Math.PI * 2) * 1.2;
    const fascia1 = base + 6.0 + Math.sin((i + 1) / p.length * Math.PI * 2) * 1.2;
    facade(glass, a, q, 0, 1, base + 5.5, top - 1.1, teal, normal);
    metal.quad([a[0], fascia0, a[1]], [q[0], fascia1, q[1]], [q[0], fascia1 + 1.4, q[1]], [a[0], fascia0 + 1.4, a[1]], silver, normal);
    facade(metal, a, q, 0, 1, top - 1.1, top, silver, normal);
    for (let j = 0; j <= count; j++) facade(metal, a, q, Math.max(0, j / count - .085 / L), Math.min(1, j / count + .085 / L), base + 5.5, top - 1.1, darkSilver, normal);
    for (const y of [base + 9.8, base + 13.5]) facade(metal, a, q, 0, 1, y, y + .12, darkSilver, normal);
    if (L > 10) {
      const x = mix((a[0] + q[0]) / 2, cx, .13), z = mix((a[1] + q[1]) / 2, cz, .13), radius = 1.05;
      const circle = Array.from({ length: 16 }, (_, k) => [x + Math.cos(k * Math.PI / 8) * radius, z + Math.sin(k * Math.PI / 8) * radius]);
      if (ringInside(circle, p)) metal.geometry(new THREE.CylinderGeometry(.82, radius, 6.5, 12), x, base + 3.57, z, silver);
    }
  });
  roof(metal, p, top, silver);
  // Roof seams follow triangulated source footprint; roof and shell stay within it.
  return { top, approximateHeightM: 18.5, lowerFootprint: lower };
}

/** Build source-footprint landmarks, return refs safe to omit from generic buildings. */
export function buildLandmarks(scene, D, hAt) {
  const result = { handledRefs: new Set(), labels: [], models: [] };
  for (const b of D.buildings || []) {
    if (!LANDMARK_REFS.has(b.ref) || b.p?.length < 3) continue;
    const p = b.p.filter((a, i) => i === 0 || Math.hypot(a[0] - b.p[i - 1][0], a[1] - b.p[i - 1][1]) > .01).map(a => [...a]);
    if (p.length > 3 && Math.hypot(p[0][0] - p.at(-1)[0], p[0][1] - p.at(-1)[1]) < .01) p.pop();
    if (p.length < 3 || p.some(a => a.length < 2 || !a.every(Number.isFinite))) continue;
    const elevations = p.map(a => hAt(a[0], a[1]));
    if (!elevations.every(Number.isFinite)) continue;
    const base = Math.min(...elevations) - .65;
    const batches = { stone: new Batch(), metal: new Batch(), glass: new Batch() };
    const detail = b.ref === 'E16' ? e16(b, p, base, batches) : n3(b, p, base, batches);
    const group = new THREE.Group(); group.name = `landmark-${b.ref}`;
    group.userData = { ref: b.ref, sourceFootprint: p, baseElevationM: base, ...detail,
      fidelity: 'photo-informed approximation; footprint from source data, heights and details not surveyed',
      reference: b.ref === 'E16' ? 'references/official/chung-moon-soul-e16.jpg' : 'references/official/sports-complex-n3.jpg' };
    const materials = {
      stone: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .78, metalness: .04, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
      metal: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .36, metalness: .64, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
      glass: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .17, metalness: .55 })
    };
    // Coplanar layers: glass windows over stone, then framing over glass.
    // Bias changes depth only, keeping all x/z coordinates inside the footprint.
    materials.glass.polygonOffset = true; materials.glass.polygonOffsetFactor = -1.5; materials.glass.polygonOffsetUnits = -1.5;
    for (const kind of ['stone', 'glass', 'metal']) { const mesh = batches[kind].mesh(materials[kind], `${b.ref}-${kind}`); if (mesh) group.add(mesh); else materials[kind].dispose(); }
    scene.add(group); result.models.push(group); result.handledRefs.add(b.ref);
    result.labels.push({ ref: b.ref, en: b.en || b.name || '', x: p.reduce((s, a) => s + a[0], 0) / p.length,
      z: p.reduce((s, a) => s + a[1], 0) / p.length, y: detail.top + 5 });
  }
  return result;
}
