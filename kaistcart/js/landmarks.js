// Photo-informed, code-native landmark approximations. No third-party image textures.
// References: references/official/{chung-moon-soul-e16,sports-complex-n3,
// library-e9,satellite-antenna}.jpg, official Campus_Map_202605.pdf, and
// references/commons/sports-complex-AhmadElq-2019.jpg. See audit/landmark-geometry.json.
// Only the original OSM footprint is geographically sourced. Heights, tower placement,
// facade divisions and structural details below are visual estimates, NOT surveyed.
import * as THREE from '../lib/three.module.min.js';

export const LANDMARK_REFS = new Set(['E16', 'N3', 'E9', 'E13', 'W4-1', 'W4-2']);
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

// Round convex footprint corners inward only. Concave corners keep the source
// vertex, so the curve never cuts across an external courtyard or a road.
function roundedRing(p, fraction = .22) {
  const sign = areaSign(p), q = [];
  p.forEach((b, i) => {
    const a = p[(i + p.length - 1) % p.length], c = p[(i + 1) % p.length];
    const cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    if (cross * sign < .01) { q.push(b); return; }
    const start = b.map((v, k) => mix(v, a[k], fraction)), end = b.map((v, k) => mix(v, c[k], fraction));
    for (let j = 0; j <= 8; j++) {
      const t = j / 8; q.push(b.map((v, k) => (1 - t) ** 2 * start[k] + 2 * (1 - t) * t * v + t * t * end[k]));
    }
  });
  return q;
}
const sliceRect = (p, a, b) => [
  p[0].map((v, k) => mix(v, p[1][k], a)), p[0].map((v, k) => mix(v, p[1][k], b)),
  p[3].map((v, k) => mix(v, p[2][k], b)), p[3].map((v, k) => mix(v, p[2][k], a))
];
function fitRectangle(p, sizes, prefer = 'south') {
  let longest = 0, u = [1, 0];
  p.forEach((a, i) => { const b = p[(i + 1) % p.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L > longest) { longest = L; u = [(b[0] - a[0]) / L, (b[1] - a[1]) / L]; } });
  const v = [-u[1], u[0]], xs = p.map(a => a[0]), zs = p.map(a => a[1]);
  for (const [w, d] of sizes) {
    let best = null, score = -Infinity;
    for (let x = Math.min(...xs) + 1; x < Math.max(...xs); x += 1.5) for (let z = Math.min(...zs) + 1; z < Math.max(...zs); z += 1.5) {
      const s = prefer === 'north' ? -z : prefer === 'east' ? x : z;
      if (s <= score) continue;
      const q = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [x + a * w * u[0] / 2 + b * d * v[0] / 2, z + a * w * u[1] / 2 + b * d * v[1] / 2]);
      if (ringInside(q, p)) { best = q; score = s; }
    }
    if (best) return best;
  }
  return null;
}
function faceNormal(a, b, sign) { const L = Math.hypot(b[0] - a[0], b[1] - a[1]); return [sign * (b[1] - a[1]) / L, 0, -sign * (b[0] - a[0]) / L]; }
function faceClock(metal, a, b, normal, centerT, y, radius) {
  const center = [mix(a[0], b[0], centerT) + normal[0] * .025, y, mix(a[1], b[1], centerT) + normal[2] * .025], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const u = [(b[0] - a[0]) / L, 0, (b[1] - a[1]) / L];
  const point = (x, h) => [center[0] + u[0] * x, y + h, center[2] + u[2] * x];
  for (let j = 0; j < 40; j++) {
    const a0 = j / 40 * Math.PI * 2, a1 = (j + 1) / 40 * Math.PI * 2;
    metal.tri(center, point(Math.cos(a0) * radius, Math.sin(a0) * radius), point(Math.cos(a1) * radius, Math.sin(a1) * radius), tint(0xe6dfc7), normal);
  }
  const stroke = (a0, r0, r1, width) => {
    const c = Math.cos(a0), s = Math.sin(a0), w = width / 2;
    const points = [point(c * r0 - s * w, s * r0 + c * w), point(c * r1 - s * w, s * r1 + c * w), point(c * r1 + s * w, s * r1 - c * w), point(c * r0 + s * w, s * r0 - c * w)].map(p => [p[0] + normal[0] * .012, p[1], p[2] + normal[2] * .012]);
    metal.quad(...points, tint(0x243e46), normal);
  };
  for (let j = 0; j < 12; j++) stroke(j / 12 * Math.PI * 2, radius * .77, radius * .92, .1);
  stroke(Math.PI * .5, 0, radius * .72, .14); stroke(Math.PI * -.18, 0, radius * .52, .2);
}

function e16(b, p, base, batches) {
  const { stone, metal, glass } = batches;
  const pink = tint(0xc49483), pale = tint(0xdad6c3), teal = tint(0x376a70), frame = tint(0x92a29b), dark = tint(0x25484d);
  const podium = base + 9.2, curved = roundedRing(p, .3), sign = areaSign(curved);
  volume(stone, p, base, base + .22, pink);
  volume(stone, curved, base + .22, podium, pink, tint(0x999a91));
  walls(metal, curved, podium - .2, podium, tint(0xafa49a));
  let perimeter = 0;
  curved.forEach((a, i) => {
    const q = curved[(i + 1) % curved.length], L = Math.hypot(q[0] - a[0], q[1] - a[1]);
    if (L < .02) return;
    const normal = faceNormal(a, q, sign);
    // Continuous ground glazing follows the rounded podium. Pink piers and small
    // second-floor openings are placed in metre intervals across segment joins.
    for (let t = 0; t < L; t += Math.min(.55, L - t)) {
      const end = Math.min(L, t + .55), s = perimeter + (t + end) / 2;
      if (s % 5.4 >= .55) facade(glass, a, q, t / L, end / L, base + .45, base + 4.8, dark, normal);
      if (s % 4.2 < 1.5) facade(glass, a, q, t / L, end / L, base + 5.7, base + 7.9, teal, normal);
      if (s % 1.6 < .15) facade(metal, a, q, t / L, Math.min(end / L, (t + .09) / L), base + .45, base + 4.8, frame, normal);
    }
    for (const y of [2.4, 5.05, 8.3]) facade(metal, a, q, 0, 1, base + y, base + y + .035, tint(0x9f786c), normal);
    perimeter += L;
  });
  const tower = fitTower(p);
  if (!tower) return { top: podium, note: 'Tower omitted because no inscribed footprint rectangle could be found' };
  const top = base + 41, curtain = sliceRect(tower, 0, .88), core = sliceRect(tower, .88, 1);
  // Captures 52–54 show large pale-pink wall fields on the road-facing long
  // elevation, rather than an almost entirely glazed tower. Corner cores and
  // the narrow middle strip remain teal; small paired windows puncture stone.
  volume(stone, curtain, podium, top - 2.1, tint(0xc8b9b5), tint(0x8b9997));
  const signT = areaSign(curtain);
  curtain.forEach((a, i) => {
    const q = curtain[(i + 1) % curtain.length], L = Math.hypot(q[0] - a[0], q[1] - a[1]), normal = faceNormal(a, q, signT);
    const strips = L > 15 ? [[0,.13],[.49,.68],[.91,1]] : [[.05,.95]];
    for (const [lo,hi] of strips) {
      facade(glass,a,q,lo,hi,podium,top-2.1,teal,normal);
      for(let s=lo*L;s<hi*L;s+=2.2)facade(metal,a,q,s/L,Math.min(hi,(s+.08)/L),podium,top-2.1,frame,normal);
      for(let y=podium+2.7;y<top-2.1;y+=2.7)facade(metal,a,q,lo,hi,y,y+.09,frame,normal);
    }
    if(L>15){
      for(let y=podium+1.6;y<top-3;y+=2.7)for(const [lo,hi]of[[.21,.28],[.32,.4],[.75,.83]]){
        facade(glass,a,q,lo,hi,y,y+.78,teal,normal);
        facade(metal,a,q,lo,hi,y-.04,y+.02,frame,normal);
      }
      facade(metal,a,q,.455,.488,podium+.8,top-3,tint(0x3e4a4d),normal);
      for(let y=podium+1;y<top-3;y+=.25)facade(metal,a,q,.455,.488,y,y+.07,tint(0x87918e),normal);
    }
    facade(metal, a, q, 0, 1, top - 2.3, top - 1.7, tint(0x507b7b), normal);
  });
  // A real opening is formed from separate solid pieces, rather than painting a
  // black square on the wall. Its size/location remain photo-informed estimates.
  volume(stone, core, podium, top - 6.2, pale);
  volume(stone, sliceRect([core[0], core[3], core[2], core[1]], 0, .16), top - 6.2, top, pale);
  volume(stone, sliceRect([core[0], core[3], core[2], core[1]], .39, .51), top - 6.2, top, pale);
  volume(stone, sliceRect([core[0], core[3], core[2], core[1]], .73, 1), top - 6.2, top, pale);
  volume(stone, core, top - 1.05, top, pale);
  const ca = core[1], cb = core[2], cn = faceNormal(ca, cb, areaSign(core));
  faceClock(metal, ca, cb, cn, .86, top - 2.65, 1.05);
  for (let y = podium + 1; y < top - 6.5; y += 2.7) facade(glass, ca, cb, .18, .38, y, y + 1.55, teal, cn);
  // Long narrow window strip in the pale vertical service core.
  for (const [a, q] of [[core[0], core[1]], [core[2], core[3]]]) {
    const n = faceNormal(a, q, areaSign(core));
    facade(glass, a, q, .26, .51, podium + .8, top - 6.2, dark, n);
    for (let y = podium + 2.7; y < top - 6.2; y += 2.7) facade(metal, a, q, .26, .51, y, y + .12, frame, n);
  }
  return { top, towerFootprint: tower, podiumFootprint: curved, podiumHeightM: 9.2, approximateHeightM: 41, capturePhotos:[52,53,54], features: ['curved pink podium', 'pale pink wall fields with small horizontal windows', 'teal corner cores and central glazing', 'dark vertical louvers', 'pale clock core', 'two open upper apertures'] };
}

function n3(b, p, base, batches) {
  const { stone, metal, glass } = batches;
  const silver = tint(0xcbd0d1), darkSilver = tint(0x778b90), teal = tint(0x407d8b), concrete = tint(0xb2b0a5);
  const shell = roundedRing(p, .27);
  const cx = p.reduce((s, a) => s + a[0], 0) / p.length, cz = p.reduce((s, a) => s + a[1], 0) / p.length;
  const lower = shell.map(a => [mix(a[0], cx, .24), mix(a[1], cz, .24)]);
  volume(stone, p, base, base + .32, concrete);
  if (ringInside(lower, p)) volume(glass, lower, base + .32, base + 6.6, tint(0x34545c));
  const top = base + 18.5, sign = areaSign(shell);
  let perimeter = 0;
  shell.forEach((a, i) => {
    const q = shell[(i + 1) % shell.length], dx = q[0] - a[0], dz = q[1] - a[1], L = Math.hypot(dx, dz);
    if (L < .02) return;
    const normal = [sign * dz / L, 0, -sign * dx / L];
    const fascia0 = base + 6.0 + (a[1] + 330) / 115 * 3.1;
    const fascia1 = base + 6.0 + (q[1] + 330) / 115 * 3.1;
    glass.quad([a[0], fascia0 + 1.1, a[1]], [q[0], fascia1 + 1.1, q[1]], [q[0], top - 1.1, q[1]], [a[0], top - 1.1, a[1]], teal, normal);
    metal.quad([a[0], fascia0, a[1]], [q[0], fascia1, q[1]], [q[0], fascia1 + 1.4, q[1]], [a[0], fascia0 + 1.4, a[1]], silver, normal);
    facade(metal, a, q, 0, 1, top - 1.1, top, silver, normal);
    // The entry-facing elevation in captures 51–53 has a silver S-like ribbon
    // splitting two upper glass openings. It follows the existing rounded shell
    // exactly; the curve and belt width are photo estimates, not measured plans.
    if(normal[0]>.18){
      const ribbon=z=>base+11.3+3.7*Math.tanh((z+283)/10.5);
      const parts=Math.max(1,Math.ceil(L/1.2));
      for(let j=0;j<parts;j++){
        const t0=j/parts,t1=(j+1)/parts,x0=mix(a[0],q[0],t0),z0=mix(a[1],q[1],t0),x1=mix(a[0],q[0],t1),z1=mix(a[1],q[1],t1),y0=ribbon(z0),y1=ribbon(z1);
        metal.quad([x0,y0-.7,z0],[x1,y1-.7,z1],[x1,Math.min(top-.9,y1+.7),z1],[x0,Math.min(top-.9,y0+.7),z0],silver,normal);
      }
    }
    for (let j = Math.ceil(perimeter / 1.65) * 1.65; j < perimeter + L; j += 1.65) {
      const t = (j - perimeter) / L, bottom = mix(fascia0, fascia1, t) + 1.4;
      facade(metal, a, q, Math.max(0, t - .055 / L), Math.min(1, t + .055 / L), bottom, top - 1.1, darkSilver, normal);
    }
    for (const y of [base + 11.4, base + 14.1]) if (y > Math.max(fascia0, fascia1) + 1.4) facade(metal, a, q, 0, 1, y, y + .09, darkSilver, normal);
    const la = lower[i], lb = lower[(i + 1) % lower.length];
    metal.quad([a[0], fascia0, a[1]], [q[0], fascia1, q[1]], [lb[0], base + 6.1, lb[1]], [la[0], base + 6.1, la[1]], tint(0x555e61));
    perimeter += L;
  });
  // The photographed entry has large flared columns below the cantilever.
  for (const [x, z, height, radius] of [[-51,-316,6.5,2.8],[-30,-303,7.1,2.6],[-19,-276,7.7,2.4],[-32,-245,8.1,2.5]]) {
    const circle = Array.from({ length: 24 }, (_, k) => [x + Math.cos(k * Math.PI / 12) * radius, z + Math.sin(k * Math.PI / 12) * radius]);
    if (ringInside(circle, p)) metal.geometry(new THREE.CylinderGeometry(radius, .9, height, 20), x, base + .32 + height / 2, z, silver);
  }
  const stair = fitRectangle(p, [[16, 8], [12, 7]], 'north');
  if (stair) for (let i = 0; i < 18; i++) volume(stone, sliceRect(stair, i / 18, 1), base + .32 + i * .26, base + .32 + (i + 1) * .26, concrete);
  roof(metal, shell, top, silver);
  return { top, approximateHeightM: 18.5, shellFootprint: shell, lowerFootprint: lower, capturePhotos:[50,51,52,53,54], features: ['rounded glass shell', 'S-shaped silver front ribbon', 'sweeping silver belt', 'inset lower storey', 'flared support columns', 'entry stair'] };
}

function e9(b, p, base, { stone, metal, glass }) {
  const white = tint(0xe0e4dc), recess = tint(0x536b70), bronze = tint(0x333b3d), sign = areaSign(p);
  const box = fitRectangle(p, [[34,19], [30,18], [26,16]], 'south'), top = base + 26.8;
  let body = p;
  if (box) {
    const u = [box[1][0]-box[0][0],box[1][1]-box[0][1]], L = Math.hypot(...u); u[0] /= L; u[1] /= L;
    const limit = box[1][0]*u[0]+box[1][1]*u[1]-6, clipped=[];
    p.forEach((a,i)=>{const b=p[(i+1)%p.length], da=a[0]*u[0]+a[1]*u[1]-limit, db=b[0]*u[0]+b[1]*u[1]-limit;
      if(da<=0)clipped.push(a);if((da<=0)!==(db<=0)){const t=da/(da-db);clipped.push([mix(a[0],b[0],t),mix(a[1],b[1],t)]);}});
    if(clipped.length>=3)body=clipped;
  }
  volume(stone, p, base, base + .4, tint(0xa9b2ab));
  volume(glass, p, base + .4, base + 4.8, tint(0x4b7278));
  volume(stone, p, base + 4.8, base + 6.4, white);
  volume(glass, p, base + 6.4, base + 9.1, tint(0x4b7278), tint(0xa2aaa3));
  volume(stone, body, base + 9.1, base + 18.5, white, tint(0xa2aaa3));
  body.forEach((a, i) => {
    const q = body[(i + 1) % body.length], L = Math.hypot(q[0] - a[0], q[1] - a[1]);
    if (L < .1) return;
    const normal = faceNormal(a, q, sign);
    facade(stone, a, q, 0, 1, base + 4.8, base + 6.4, white, normal);
    facade(stone, a, q, 0, 1, base + 9.1, base + 9.7, white, normal);
    const cols = Math.max(1, Math.round(L / 1.32)), step = L / cols;
    // Deep-looking perforated lattice: dark recessed pane, white bars and slim
    // inner shadow edge. All layers remain on or inside the mapped perimeter.
    for (let j = 0; j < cols; j++) {
      const t0 = j / cols, t1 = (j + 1) / cols;
      facade(stone, a, q, t0, Math.min(t1, t0 + .4 / step / cols), base + 9.7, base + 18.5, white, normal);
      for (let y = 9.7; y < 18.4; y += 1.27) {
        facade(stone, a, q, t0, t1, base + y, base + y + .42, white, normal);
        if (y + .42 < 18.15) facade(glass, a, q, Math.min(t1, t0 + .4 / L), t1, base + y + .42, base + Math.min(y + 1.27,18.15), tint(0x48626a), normal);
        facade(metal, a, q, Math.min(t1, t0 + .4 / L), t1, base + y + .42, base + y + .54, recess, normal);
      }
      if (j % 3 === 0) facade(metal, a, q, t0, Math.min(t1, t0 + .11 / L), base + .4, base + 9.1, tint(0xbbcbc7), normal);
    }
    facade(stone, a, q, 0, 1, base + 18.15, base + 18.5, white, normal);
  });
  if (box) {
    volume(metal, box, base + 18.5, top, bronze);
    box.forEach((a, i) => {
      const q = box[(i + 1) % box.length], L = Math.hypot(q[0] - a[0], q[1] - a[1]), normal = faceNormal(a, q, areaSign(box));
      facade(glass, a, q, .045, .955, base + 19.5, top - 1.1, tint(i % 2 ? 0x718e85 : 0xa5ab87), normal);
      for (let j = 1; j < L / 2.3; j++) facade(metal, a, q, j * 2.3 / L, Math.min(.955, (j * 2.3 + .12) / L), base + 19.5, top - 1.1, bronze, normal);
      facade(metal, a, q, .045, .955, base + 22.7, base + 22.83, bronze, normal);
    });
    // A narrow inset support and dark soffit make the top framed reading room
    // distinct from the white lattice volume, without overhanging the footprint.
    metal.quad(...box.map(a=>[a[0],base+18.5,a[1]]),tint(0x707770),[0,-1,0]);
  }
  return { top: box ? top : base + 18.5, approximateHeightM: box ? 26.8 : 18.5, upperFrameFootprint: box, features: ['white perforated lattice', 'glazed lower levels', 'dark projecting upper reading-room frame'] };
}

function e13(b, p, base, { stone, metal, glass }) {
  const white = tint(0xd8ddd7), steel = tint(0xa7b0b1), dark = tint(0x65767d), roofY = base + 11.6;
  volume(stone, p, base, roofY, white, tint(0xa5b0a9));
  const sign = areaSign(p);
  p.forEach((a, i) => {
    const q = p[(i + 1) % p.length], L = Math.hypot(q[0] - a[0], q[1] - a[1]);
    if (L < 1) return;
    const n = faceNormal(a, q, sign), count = Math.max(1, Math.floor(L / 3));
    for (let j = 0; j < count; j++) for (let floor = 0; floor < 3; floor++) facade(glass, a, q, (j + .15) / count, (j + .82) / count, base + 1 + floor * 3.3, base + 2.8 + floor * 3.3, tint(0x52727b), n);
  });
  // Official illustrated campus map places the large dish on E13's eastern
  // rooftop; the roof anchor and facing below are estimates, not measured points.
  const x = 406, z = -282, radius = 6.5;
  const circle = Array.from({ length: 48 }, (_, i) => [x + Math.cos(i * Math.PI / 24) * radius, z + Math.sin(i * Math.PI / 24) * radius]);
  if (!ringInside(circle, p)) return { top: roofY, approximateHeightM: 11.6, note: 'Antenna omitted: eastern roof cannot contain the 13m dish' };
  metal.geometry(new THREE.CylinderGeometry(.8, 1.7, 7, 8), x, roofY + 3.5, z, white);
  const centerY = roofY + 8, bowlDepth = 1.6, segments = 48, rings = 6;
  const point = (r, angle) => [x + Math.cos(angle) * r, centerY + bowlDepth * (r / radius) ** 2, z + Math.sin(angle) * r];
  for (let ring = 0; ring < rings; ring++) for (let j = 0; j < segments; j++) {
    const r0 = ring / rings * radius, r1 = (ring + 1) / rings * radius, a0 = j / segments * Math.PI * 2, a1 = (j + 1) / segments * Math.PI * 2;
    const pts = [point(r0,a0),point(r1,a0),point(r1,a1),point(r0,a1)];
    metal.quad(...[...pts].reverse(), ring % 2 ? tint(0xe2e6e2) : tint(0xd6dddb));
    metal.quad(...pts.map(v => [v[0],v[1]-.12,v[2]]), steel);
  }
  const strut = (a, b, r, color) => {
    const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b), delta = vb.clone().sub(va), center = va.clone().add(vb).multiplyScalar(.5);
    const g = new THREE.CylinderGeometry(r, r, delta.length(), 6); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0), delta.normalize())); metal.geometry(g, ...center.toArray(), color);
  };
  for (let j = 0; j < 24; j++) {
    const a = j / 24 * Math.PI * 2, r0 = point(0,a), r1 = point(radius,a), r2 = point(radius,(j+1)/24*Math.PI*2);
    strut([x,centerY-1.9,z], [r1[0],r1[1]-.15,r1[2]], .055, dark);
    strut([r0[0],r0[1]-.15,r0[2]], [r1[0],r1[1]-.15,r1[2]], .05, dark);
    // Rim struts are kept slightly inboard so their thickness cannot leave E13.
    strut(r1,r2,.06,steel);
  }
  const focus = [x, centerY + 5.4, z];
  for (let j = 0; j < 3; j++) strut(point(radius * .92,j / 3 * Math.PI * 2),focus,.065,white);
  metal.geometry(new THREE.CylinderGeometry(.17,.17,.75,8),x,focus[1]+.25,z,dark);
  return { top: focus[1] + .65, approximateBuildingHeightM: 11.6, antennaDiameterM: 13, antennaCenter: [x,z], antennaPlacement: 'eastern rooftop in official illustrated campus map; center and vertical orientation approximate', features: ['13m parabolic dish', 'radial backing truss', 'tripod feed', 'tapered rooftop pedestal'] };
}

function westDorm(b, p, base, { stone, metal, glass }) {
  // The user's April-2026 streetview frame identifies W4-2 in blue, with the
  // yellow-finned W4-1 in front. Footprints/levels are OSM; all facade dimensions
  // and the inferred 3.2m storey height are approximate, not a measured elevation.
  const floors=b.lv|| (b.ref==='W4-1'?6:8), top=base+floors*3.2+1.1, white=tint(0xe0e3dc), dark=tint(0x34565c), accent=tint(b.ref==='W4-1'?0xbba544:0x4c91bc), sign=areaSign(p);
  volume(stone,p,base,top,white,tint(0xb9c1bf));
  p.forEach((a,i)=>{
    const q=p[(i+1)%p.length], L=Math.hypot(q[0]-a[0],q[1]-a[1]);if(L<1)return;
    const n=faceNormal(a,q,sign), count=Math.max(1,Math.round(L/2.25));
    const roadFace=n[0]<-.25, shortEnd=L>8&&L<20;
    if(b.ref==='W4-2'&&shortEnd&&n[1]===0&&n[2]<-.1)facade(metal,a,q,0,1,base+3.3,top-.35,accent,n);
    for(let j=0;j<count;j++){
      const t0=j/count,t1=(j+1)/count;
      for(let floor=1;floor<floors;floor++){
        const lo=base+floor*3.2+.2,hi=base+(floor+1)*3.2-.15;
        facade(glass,a,q,t0+.35/count,t0+.69/count,lo,hi,dark,n);
        facade(metal,a,q,t0+.35/count,t0+.69/count,lo+1.55,lo+1.62,tint(0x859b9d),n);
      }
      facade(glass,a,q,t0+.08/count,t0+.88/count,base+.45,base+2.65,dark,n);
      if(roadFace){
        facade(metal,a,q,t0+.72/count,t0+.9/count,base+3.3,top-.35,b.ref==='W4-1'?accent:white,n);
        // A slim folded return gives the coloured upright a visible side face.
        // The return goes inward, preserving the exact OSM boundary.
        const t=t0+.72/count, x=mix(a[0],q[0],t),z=mix(a[1],q[1],t),x1=x-n[0]*.28,z1=z-n[2]*.28;
        if(inside(x1,z1,p))metal.quad([x,base+3.3,z],[x1,base+3.3,z1],[x1,top-.35,z1],[x,top-.35,z],tint(b.ref==='W4-1'?0x94853e:0xa9b7b6));
      }
    }
    facade(metal,a,q,0,1,base+2.75,base+3.3,white,n);
    facade(metal,a,q,0,1,top-.35,top,white,n);
  });
  const plant=fitRectangle(p,[[7,4],[5,3]],'north');if(plant)volume(stone,plant,top,top+2.3,tint(0xbcc4c0));
  return {top:top+(plant?2.3:0),approximateHeightM:floors*3.2+1.1,sourceLevels:floors,features:['white vertical panel facade',b.ref==='W4-1'?'yellow upright fins':'white upright fins and blue end panel','glazed ground floor'],photoReference:'User-attached streetview image (exact panorama ID not matched); separately supplied nearby Naver link https://naver.me/xIF5lerm. Dimensions and individual fin placement estimated'};
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
    const builders = { E16: e16, N3: n3, E9: e9, E13: e13, 'W4-1':westDorm, 'W4-2':westDorm };
    const detail = builders[b.ref](b, p, base, batches);
    const group = new THREE.Group(); group.name = `landmark-${b.ref}`;
    group.userData = { ref: b.ref, sourceFootprint: p, baseElevationM: base, ...detail,
      fidelity: 'photo-informed approximation; footprint from source data, heights and details not surveyed',
      reference: b.ref.startsWith('W4-')?'https://naver.me/xIF5lerm':`references/official/${({ E16:'chung-moon-soul-e16', N3:'sports-complex-n3', E9:'library-e9', E13:'satellite-antenna' })[b.ref]}.jpg` };
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
    result.labels.push({ ref: b.ref, name: b.ref.startsWith('W4-')?(b.en||b.ref):b.name || b.ref, en: b.en || b.name || '', x: p.reduce((s, a) => s + a[0], 0) / p.length,
      z: p.reduce((s, a) => s + a[1], 0) / p.length, y: detail.top + 5 });
  }
  return result;
}
