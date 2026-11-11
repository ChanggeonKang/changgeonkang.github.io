// World: terrain, course, roads, buildings, vegetation, props, sky.
import * as THREE from '../lib/three.module.min.js';
import { buildLandmarks } from './landmarks.js';

export const VS = 1;          // preserve source elevation scale (source resolution remains limited)
export const DS = 2;          // course sample spacing (m)
export const HALF_W = 5;      // course half width (m)
export const ROAD_LIFT = 0.3; // course surface above terrain
export const CURB_H = 0.15;
export const BUMP_L = 1.8, BUMP_H = 0.10; // unmeasured conventional hump defaults, not a site survey

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const mod = (a, n) => ((a % n) + n) % n;
export const lerp = (a, b, t) => a + (b - a) * t;
export function rng(seed) { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
const rnd = rng(20261111);

export const W = {
  D: null, C: null, G: null, bumps: [], courseBumps: [], landmarks: [],
  sun: new THREE.Vector3(0.5, 0.62, 0.6).normalize(),
  horizon: new THREE.Color().setRGB(0.70, 0.84, 0.97),
  sky: null, env: null,
};

// ───────────────────────── height / surface queries ─────────────────────────
export function hAt(x, z) {
  const t = W.D.terrain;
  const u = clamp((x - t.x0) / t.gs, 0, t.w - 1.001), v = clamp((z - t.z0) / t.gs, 0, t.h - 1.001);
  const i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j, d = t.d, o = j * t.w + i;
  return (d[o] * (1 - fu) * (1 - fv) + d[o + 1] * fu * (1 - fv) + d[o + t.w] * (1 - fu) * fv + d[o + t.w + 1] * fu * fv) * VS;
}
function inPoly(x, z, p) {
  let c = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const a = p[i], b = p[j];
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}
// surface grid (1 m): 0 grass, 1 footpath/sidewalk, 2 road, 3 course, 8 water, 9 building
export function surfAt(x, z) {
  const G = W.G, i = Math.floor(x) - G.x0, j = Math.floor(z) - G.z0;
  if (i < 0 || j < 0 || i >= G.w || j >= G.h) return 9;
  return G.d[j * G.w + i];
}
function liftAt(x, z) { // smooth (bilinear) road/curb height above terrain
  const G = W.G, fx = x - G.x0 - .5, fz = z - G.z0 - .5, i = Math.floor(fx), j = Math.floor(fz);
  if (i < 0 || j < 0 || i >= G.w - 1 || j >= G.h - 1) return 0;
  const u = fx - i, v = fz - j, o = j * G.w + i, L = G.lift;
  return (L[o] * (1 - u) * (1 - v) + L[o + 1] * u * (1 - v) + L[o + G.w] * (1 - u) * v + L[o + G.w + 1] * u * v) / 200;
}
const BCELL = 16;
let bumpGrid = new Map();
function bumpProfile(b, ex, ez) {
  const halfLength = (b.length || BUMP_L * 2) / 2, height = b.height ?? BUMP_H;
  const al = ex * b.dx + ez * b.dz;
  if (al > halfLength || al < -halfLength) return 0;
  const la = Math.abs(ex * b.dz - ez * b.dx);
  if (la > b.hw) return 0;
  const c = Math.cos(al / halfLength * Math.PI / 2), e = clamp((b.hw - la) / .8, 0, 1);
  return height * c * c * e * e * (3 - 2 * e);
}
export function bumpH(x, z) {
  const list = bumpGrid.get(Math.floor(x / BCELL) * 4096 + Math.floor(z / BCELL));
  if (!list) return 0;
  let h = 0;
  for (let i = 0; i < list.length; i++) { const b = list[i], v = bumpProfile(b, x - b.x, z - b.z); if (v > h) h = v; }
  return h;
}
function bumpSurfaceVertex(b, ia, il, na, nl) {
  const al = -b.length / 2 + ia * b.length / na, la = -b.hw + il * 2 * b.hw / nl;
  const x = b.x + b.dx * al + b.dz * la, z = b.z + b.dz * al - b.dx * la;
  const y = b.surface && na === b.surface.na && nl === b.surface.nl ? b.surface.heights[ia * (nl + 1) + il] : gAt(x, z);
  return [x, y, z, la / 1.8, al / 1.8];
}
/** Ground height including road surfaces, curbs and speed bumps. */
export const gAt = (x, z) => {
  const list = bumpGrid.get(Math.floor(x / BCELL) * 4096 + Math.floor(z / BCELL));
  let height = -Infinity;
  for (const b of list || []) {
    const ex = x - b.x, ez = z - b.z, al = ex * b.dx + ez * b.dz, la = ex * b.dz - ez * b.dx, s = b.surface;
    if (!s || Math.abs(al) > b.length / 2 + 1e-7 || Math.abs(la) > b.hw + 1e-7) continue;
    const u = clamp((al / b.length + .5) * s.na, 0, s.na), v = clamp((la / (b.hw * 2) + .5) * s.nl, 0, s.nl);
    const i = Math.min(s.na - 1, Math.floor(u)), j = Math.min(s.nl - 1, Math.floor(v)), fu = u - i, fv = v - j, o = i * (s.nl + 1) + j;
    const a = s.heights[o], c = s.heights[o + s.nl + 1], e = s.heights[o + s.nl + 2], d = s.heights[o + 1];
    // Same a-c-e / a-e-d triangles emitted by MB.quad below. Tyres query the
    // rendered surface itself, including its per-feature dimensions and terrain.
    const y = fu >= fv ? a * (1 - fu) + c * (fu - fv) + e * fv : a * (1 - fv) + e * fu + d * (fv - fu);
    height = Math.max(height, y);
  }
  return Number.isFinite(height) ? height : hAt(x, z) + liftAt(x, z) + bumpH(x, z);
};
/** Finite-difference ground normal. All dimensions and derivatives are in metres. */
export function groundNormal(x, z, out = {}) {
  const e = .04, nx = -(gAt(x + e, z) - gAt(x - e, z)) / (2 * e), nz = -(gAt(x, z + e) - gAt(x, z - e)) / (2 * e);
  const L = Math.hypot(nx, 1, nz); out.x = nx / L; out.y = 1 / L; out.z = nz / L; return out;
}

/** Position on the course. prog: sample index (float), off: + left / − right. */
export function coursePos(prog, off, out) {
  const C = W.C, i0 = Math.floor(prog), f = prog - i0, a = mod(i0, C.n), b = mod(i0 + 1, C.n);
  const tx = C.tx[a] + (C.tx[b] - C.tx[a]) * f, tz = C.tz[a] + (C.tz[b] - C.tz[a]) * f;
  out.x = C.x[a] + (C.x[b] - C.x[a]) * f + tz * off;
  out.z = C.z[a] + (C.z[b] - C.z[a]) * f - tx * off;
  out.th = Math.atan2(tx, tz);
  return out;
}

// ───────────────────────── course ─────────────────────────
function nearestFootprint(x, z, limit = 16) {
  let best = { distance: limit, nx: 0, nz: 0, buildingIndex: -1 };
  for (const b of W.footprints) {
    if (x < b.x0 - limit || x > b.x1 + limit || z < b.z0 - limit || z > b.z1 + limit) continue;
    let d = Infinity, qx = x, qz = z;
    for (let j = 0; j < b.p.length; j++) {
      const a = b.p[j], c = b.p[(j + 1) % b.p.length], dx = c[0] - a[0], dz = c[1] - a[1], den = dx * dx + dz * dz;
      const t = den ? clamp(((x - a[0]) * dx + (z - a[1]) * dz) / den, 0, 1) : 0;
      const px = a[0] + dx * t, pz = a[1] + dz * t, dd = Math.hypot(x - px, z - pz);
      if (dd < d) { d = dd; qx = px; qz = pz; }
    }
    const inside = inPoly(x, z, b.p), signed = inside ? -d : d;
    if (signed < best.distance) {
      let nx = inside ? qx - x : x - qx, nz = inside ? qz - z : z - qz;
      if (d < 1e-6) { nx = x - (b.x0 + b.x1) / 2; nz = z - (b.z0 + b.z1) / 2; }
      const L = Math.hypot(nx, nz) || 1;
      best = { distance: signed, nx: nx / L, nz: nz / L, buildingIndex: b.index };
    }
  }
  return best;
}

function resampleLoop(points, spacing) {
  const lengths = [], cumulative = [0];
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length], d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    lengths.push(d); cumulative.push(cumulative[cumulative.length - 1] + d);
  }
  const total = cumulative[cumulative.length - 1], n = Math.max(3, Math.round(total / spacing)), ds = total / n, result = [];
  let edge = 0;
  for (let i = 0; i < n; i++) {
    const s = i * ds; while (edge < points.length - 1 && cumulative[edge + 1] < s) edge++;
    const a = points[edge], b = points[(edge + 1) % points.length], f = (s - cumulative[edge]) / (lengths[edge] || 1);
    result.push([lerp(a[0], b[0], f), lerp(a[1], b[1], f)]);
  }
  return result;
}

function buildCourse() {
  const D = W.D;
  W.footprints = D.buildings.map((b, index) => ({ p: b.p, index,
    x0: Math.min(...b.p.map(p => p[0])), x1: Math.max(...b.p.map(p => p[0])),
    z0: Math.min(...b.p.map(p => p[1])), z1: Math.max(...b.p.map(p => p[1])) }));
  const pts = D.course.map(p => [p[0], p[1]]);
  const f = pts[0], l = pts[pts.length - 1];
  if (Math.hypot(f[0] - l[0], f[1] - l[1]) < .5) pts.pop();
  const rs = [];
  let carry = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    let s = carry;
    for (; s < L; s += DS) rs.push([a[0] + (b[0] - a[0]) * s / L, a[1] + (b[1] - a[1]) * s / L]);
    carry = s - L;
  }
  let cur = rs;
  for (let it = 0; it < 4; it++) { // round the corners
    const n = cur.length, nx = [];
    for (let i = 0; i < n; i++) {
      let sx = 0, sz = 0;
      for (let k = -3; k <= 3; k++) { const q = cur[mod(i + k, n)]; sx += q[0]; sz += q[1]; }
      nx.push([sx / 7, sz / 7]);
    }
    cur = nx;
  }
  // Correct only the local sections that lack building clearance. These alignment
  // edits and adaptive widths are game assumptions, never labelled as surveyed roads.
  const preClearance = cur.map(p => [...p]);
  for (let pass = 0; pass < 6; pass++) {
    const next = cur.map((p, i) => {
      const a = cur[mod(i - 1, cur.length)], b = cur[mod(i + 1, cur.length)];
      const x = p[0] * .8 + (a[0] + b[0]) * .1, z = p[1] * .8 + (a[1] + b[1]) * .1;
      const near = nearestFootprint(x, z, 8), push = Math.max(0, 4.6 - near.distance);
      return [x + near.nx * push, z + near.nz * push];
    });
    cur = next;
  }
  const maxAlignmentCorrection = Math.max(...cur.map((p, i) => Math.hypot(p[0] - preClearance[i][0], p[1] - preClearance[i][1])));
  cur = resampleLoop(cur, DS);
  const n = cur.length;
  const C = W.C = { n, x: new Float32Array(n), z: new Float32Array(n), tx: new Float32Array(n), tz: new Float32Array(n), k: new Float32Array(n),
    halfWidth: new Float32Array(n), clearance: new Float32Array(n), len: 0, ds: DS,
    alignment: { source: 'OSM route with corner smoothing and local building-clearance corrections', measured: false, maxCorrectionM: maxAlignmentCorrection },
    widthSource: 'assumed game width, locally reduced to preserve building footprints' };
  for (let i = 0; i < n; i++) { C.x[i] = cur[i][0]; C.z[i] = cur[i][1]; }
  for (let i = 0; i < n; i++) {
    const j = mod(i + 1, n); C.len += Math.hypot(C.x[j] - C.x[i], C.z[j] - C.z[i]);
    const clearance = nearestFootprint(C.x[i], C.z[i], 16).distance;
    C.clearance[i] = clearance; C.halfWidth[i] = Math.min(HALF_W, Math.max(.5, clearance - 1.1));
  }
  C.ds = C.len / n;
  // Limit expansion to a gentle taper; the lower-envelope filter never increases
  // an unsafe width. The 1.1m clearance also covers the 1m collision raster.
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < n; i++) C.halfWidth[i] = Math.min(C.halfWidth[i], C.halfWidth[mod(i - 1, n)] + .12);
    for (let i = n - 1; i >= 0; i--) C.halfWidth[i] = Math.min(C.halfWidth[i], C.halfWidth[mod(i + 1, n)] + .12);
  }
  for (let i = 0; i < n; i++) {
    const a = mod(i - 1, n), b = mod(i + 1, n), dx = C.x[b] - C.x[a], dz = C.z[b] - C.z[a], L = Math.hypot(dx, dz) || 1;
    C.tx[i] = dx / L; C.tz[i] = dz / L;
  }
  for (let i = 0; i < n; i++) {
    const a = mod(i - 3, n), b = mod(i + 3, n);
    const cross = C.tx[a] * C.tz[b] - C.tz[a] * C.tx[b], dot = C.tx[a] * C.tx[b] + C.tz[a] * C.tz[b];
    C.k[i] = Math.abs(Math.atan2(cross, dot)) / (6 * C.ds);
  }
  let prev = 0;
  W.landmarks = D.landmarks.map((m, li) => {
    let best = 1e18, bi = prev;
    const span = li === 0 ? 1 : Math.floor(n / 3);
    for (let i = prev; i < Math.min(n, prev + span); i++) {
      const d = (C.x[i] - m.x) ** 2 + (C.z[i] - m.z) ** 2;
      if (d < best) { best = d; bi = i; }
    }
    prev = bi;
    return { name: m.name, idx: bi };
  });
}

const ROAD = { // [width, class]  class 1 = footpath, 2 = drivable
  service: [6, 2], unclassified: [6.5, 2], residential: [6, 2], tertiary: [8, 2], tertiary_link: [6, 2], living_street: [6, 2],
  pedestrian: [4.5, 1], cycleway: [3.5, 1], footway: [2.2, 1], path: [1.8, 1], track: [2.5, 1],
  secondary: [14, 2], secondary_link: [7, 2], primary: [20, 2], primary_link: [8, 2],
};
function buildGrid() {
  const D = W.D, C = W.C, b = D.bounds, w = b.x1 - b.x0, h = b.z1 - b.z0;
  const d = new Uint8Array(w * h), road = new Uint8Array(w * h), near = new Uint8Array(w * h), side = new Uint8Array(w * h);
  const G = W.G = { x0: b.x0, z0: b.z0, w, h, d, lift: new Uint8Array(w * h) };
  const cell = (x, z) => { const i = Math.floor(x) - G.x0, j = Math.floor(z) - G.z0; return i < 0 || j < 0 || i >= w || j >= h ? -1 : j * w + i; };
  const fillPoly = (p, val) => {
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (const q of p) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); z0 = Math.min(z0, q[1]); z1 = Math.max(z1, q[1]); }
    for (let z = Math.floor(z0); z <= z1; z++) for (let x = Math.floor(x0); x <= x1; x++) {
      const k = cell(x, z);
      if (k >= 0 && inPoly(x + .5, z + .5, p)) d[k] = val;
    }
  };
  const stamp = (x, z, r, fn) => {
    const r2 = r * r, R = Math.ceil(r);
    for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
      if (dx * dx + dz * dz > r2) continue;
      const k = cell(x + dx, z + dz);
      if (k >= 0) fn(k);
    }
  };
  for (let i = 0; i < C.n; i++) stamp(C.x[i], C.z[i], C.halfWidth[i] - .5, k => { near[k] = 1; });
  for (const a of D.areas) if (a.k === 'water') fillPoly(a.p, 8);
  for (const pass of [1, 2]) for (const r of D.roads) {
    const R = ROAD[r.t]; if (!R || R[1] !== pass) continue;
    for (let k = 1; k < r.p.length; k++) {
      const a = r.p[k - 1], c = r.p[k], L = Math.hypot(c[0] - a[0], c[1] - a[1]), n = Math.max(1, Math.ceil(L));
      for (let s = 0; s <= n; s++) {
        const x = a[0] + (c[0] - a[0]) * s / n, z = a[1] + (c[1] - a[1]) * s / n, ck = cell(x, z), own = ck >= 0 && near[ck];
        stamp(x, z, R[0] / 2, q => { d[q] = pass; if (pass === 2 && !own) road[q] = 1; });
      }
    }
  }
  for (const bl of D.buildings) fillPoly(bl.p, 9);
  // Building occupancy is authoritative. Clearance is resolved in course geometry,
  // never by erasing a building or its collision cells to make room for the road.
  for (let i = 0; i < C.n; i++) stamp(C.x[i], C.z[i], C.halfWidth[i] + .1, k => { if (d[k] !== 9 && d[k] !== 8) d[k] = 3; });
  // junction gaps (where another road meets the course edge) and sidewalks
  C.side = [new Uint8Array(C.n), new Uint8Array(C.n)];
  for (let s = 0; s < 2; s++) {
    const sg = s ? -1 : 1, raw = new Uint8Array(C.n);
    for (let i = 0; i < C.n; i++) for (const off of [C.halfWidth[i] + 1.4, C.halfWidth[i] + 2.6]) {
      const k = cell(C.x[i] + C.tz[i] * off * sg, C.z[i] - C.tx[i] * off * sg);
      if (k < 0 || road[k] || d[k] === 3 || d[k] === 8 || d[k] === 9 || C.clearance[i] < C.halfWidth[i] + 3.3) raw[i] = 1;
    }
    for (let i = 0; i < C.n; i++) {
      let g = 0;
      for (let q = -3; q <= 3; q++) g |= raw[mod(i + q, C.n)];
      C.side[s][i] = g ? 0 : 1;
    }
    for (let i = 0; i < C.n; i++) {
      if (!C.side[s][i]) continue;
      for (let off = C.halfWidth[i] + .5; off <= C.halfWidth[i] + 2.3; off += .45) for (const fr of [0, .5]) {
        const j = mod(i + 1, C.n);
        const x = lerp(C.x[i] + C.tz[i] * off * sg, C.x[j] + C.tz[j] * off * sg, fr), z = lerp(C.z[i] - C.tx[i] * off * sg, C.z[j] - C.tx[j] * off * sg, fr);
        const k = cell(x, z);
        if (k >= 0 && d[k] !== 3 && d[k] !== 9 && d[k] !== 8) { d[k] = 1; side[k] = 1; }
      }
    }
  }
  for (let k = 0; k < d.length; k++) {
    const v = side[k] ? ROAD_LIFT + CURB_H : d[k] === 3 ? ROAD_LIFT : d[k] === 2 ? .2 : d[k] === 1 ? .12 : 0;
    G.lift[k] = Math.round(v * 200);
  }
}

// ───────────────────────── mesh helpers ─────────────────────────
const UP = [0, 1, 0];
class MB {
  constructor(extra) { this.p = []; this.n = []; this.u = []; this.c = []; this.x = extra ? [] : null; }
  tri(a, b, c, n, ua, ub, uc, col, ex) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    if ((uy * vz - uz * vy) * n[0] + (uz * vx - ux * vz) * n[1] + (ux * vy - uy * vx) * n[2] < 0) { let t = b; b = c; c = t; t = ub; ub = uc; uc = t; }
    this.p.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    this.n.push(n[0], n[1], n[2], n[0], n[1], n[2], n[0], n[1], n[2]);
    this.u.push(ua[0], ua[1], ub[0], ub[1], uc[0], uc[1]);
    if (col) this.c.push(col.r, col.g, col.b, col.r, col.g, col.b, col.r, col.g, col.b);
    if (ex) this.x.push(ex[0], ex[1], ex[2], ex[3], ex[0], ex[1], ex[2], ex[3], ex[0], ex[1], ex[2], ex[3]);
  }
  quad(a, b, c, d, n, ua, ub, uc, ud, col, ex) { this.tri(a, b, c, n, ua, ub, uc, col, ex); this.tri(a, c, d, n, ua, uc, ud, col, ex); }
  geo() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
    if (this.c.length) g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    if (this.x) g.setAttribute('aInfo', new THREE.Float32BufferAttribute(this.x, 4));
    return g;
  }
}
function canvasTex(w, h, draw, repeat = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
const NOISE_GLSL = `
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y); }`;
/** Add a world-position varying + custom fragment code to a standard material. */
function patch(mat, { vHead = '', vBody = '', fHead = '', fColor = '', fRough = '' }) {
  mat.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp;\n' + vHead)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWp = (modelMatrix * vec4(transformed, 1.0)).xyz;\n' + vBody);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp;\n' + NOISE_GLSL + fHead)
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + fColor)
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n' + fRough);
  };
  return mat;
}
function flat(scene, mb, mat, offset, shadow = true) {
  mat.polygonOffset = true; mat.polygonOffsetFactor = -offset; mat.polygonOffsetUnits = -offset;
  const m = new THREE.Mesh(mb.geo(), mat);
  m.receiveShadow = shadow;
  scene.add(m);
  return m;
}
function merged(parts) { // [[geometry, matrix, color]] → one non-indexed geometry with vertex colours
  const p = [], n = [], c = [], v = new THREE.Vector3(), nm = new THREE.Matrix3();
  for (const [g0, m, col] of parts) {
    const g = g0.index ? g0.toNonIndexed() : g0, P = g.attributes.position, N = g.attributes.normal;
    nm.getNormalMatrix(m);
    for (let i = 0; i < P.count; i++) {
      v.fromBufferAttribute(P, i).applyMatrix4(m); p.push(v.x, v.y, v.z);
      v.fromBufferAttribute(N, i).applyMatrix3(nm).normalize(); n.push(v.x, v.y, v.z);
      c.push(col.r, col.g, col.b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
  return g;
}
const M4 = (x, y, z, sx = 1, sy = sx, sz = sx, rx = 0, ry = 0, rz = 0) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
const col = h => new THREE.Color(h);

// ───────────────────────── terrain ─────────────────────────
function buildTerrain(scene) {
  const D = W.D, t = D.terrain, S = t.gs / 2, w = (t.w - 1) * 2 + 1, h = (t.h - 1) * 2 + 1;
  const pos = new Float32Array(w * h * 3), colr = new Float32Array(w * h * 3), idx = [];
  const woods = D.areas.filter(a => a.k === 'wood').map(a => {
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (const q of a.p) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); z0 = Math.min(z0, q[1]); z1 = Math.max(z1, q[1]); }
    return { p: a.p, x0, x1, z0, z1 };
  });
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const x = t.x0 + i * S, z = t.z0 + j * S, o = (j * w + i) * 3;
    pos[o] = x; pos[o + 1] = hAt(x, z); pos[o + 2] = z;
    let wood = 0;
    for (const a of woods) if (x > a.x0 && x < a.x1 && z > a.z0 && z < a.z1 && inPoly(x, z, a.p)) { wood = 1; break; }
    colr[o] = wood ? .5 : 1; colr[o + 1] = wood ? .62 : 1; colr[o + 2] = wood ? .5 : 1;
  }
  for (let j = 0; j < h - 1; j++) for (let i = 0; i < w - 1; i++) { const a = j * w + i, b = a + w; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(colr, 3));
  g.setIndex(idx); g.computeVertexNormals();
  const grass = () => patch(new THREE.MeshStandardMaterial({ color: 0x6fa24a, roughness: 1, metalness: 0, vertexColors: true }), {
    fColor: `
      float n1 = vnoise(vWp.xz * 0.02), n2 = vnoise(vWp.xz * 0.21), n3 = vnoise(vWp.xz * 1.7);
      diffuseColor.rgb *= mix(0.74, 1.16, n1 * 0.5 + n2 * 0.32 + n3 * 0.18);
      diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.22, 1.08, 0.62), smoothstep(0.58, 0.85, vnoise(vWp.xz * 0.008 + 7.3)) * 0.55);`,
  });
  const m = new THREE.Mesh(g, grass());
  m.receiveShadow = true;
  scene.add(m);
  // apron: continue the edge heights far beyond the playable area
  const b = D.bounds, AS = 50, ext = 2600, mb = new MB(), one = col(0xffffff);
  for (let x = b.x0 - ext; x < b.x1 + ext; x += AS) for (let z = b.z0 - ext; z < b.z1 + ext; z += AS) {
    if (x >= b.x0 && x + AS <= b.x1 && z >= b.z0 && z + AS <= b.z1) continue;
    const P = (px, pz) => [px, hAt(px, pz) - .05, pz];
    mb.quad(P(x, z), P(x, z + AS), P(x + AS, z + AS), P(x + AS, z), UP, [0, 0], [0, 1], [1, 1], [1, 0], one);
  }
  const ag = mb.geo(); ag.computeVertexNormals();
  scene.add(new THREE.Mesh(ag, grass()));
}

// ───────────────────────── roads ─────────────────────────
let TEX;
function makeTextures() {
  const r = rng(77);
  TEX = {
    asphalt: canvasTex(256, 256, (x, w, h) => {
      x.fillStyle = '#bdbdbd'; x.fillRect(0, 0, w, h);
      for (let i = 0; i < 9000; i++) { const v = 150 + r() * 105 | 0; x.fillStyle = `rgba(${v},${v},${v},${.25 + r() * .5})`; x.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2); }
      x.strokeStyle = 'rgba(70,70,70,.35)'; x.lineWidth = 1;
      for (let i = 0; i < 5; i++) { x.beginPath(); let px = r() * w, py = r() * h; x.moveTo(px, py); for (let k = 0; k < 6; k++) { px += (r() - .5) * 50; py += (r() - .5) * 50; x.lineTo(px, py); } x.stroke(); }
    }),
    paver: canvasTex(256, 256, (x, w, h) => {
      x.fillStyle = '#d9d9d9'; x.fillRect(0, 0, w, h);
      for (let j = 0; j < 8; j++) for (let i = 0; i < 4; i++) {
        const v = 195 + r() * 55 | 0; x.fillStyle = `rgb(${v},${v},${v})`;
        x.fillRect(((i + (j & 1) * .5) * 64) % w + 1, j * 32 + 1, 62, 30);
        if (j & 1 && i === 3) x.fillRect(1 - 32, j * 32 + 1, 62, 30);
      }
    }),
    bump: canvasTex(128, 128, (x, w, h) => {
      x.fillStyle = '#f4f4f0'; x.fillRect(0, 0, w, h);
      x.fillStyle = '#f5c518';
      for (let i = -2; i < 4; i++) { x.beginPath(); x.moveTo(i * 64, 0); x.lineTo(i * 64 + 32, 0); x.lineTo(i * 64 + 32 + 128, 128); x.lineTo(i * 64 + 128, 128); x.fill(); }
    }),
  };
}
function buildRoads(scene) {
  const D = W.D, mbs = { 1: new MB(), 2: new MB() }, c1 = col(0xb59a86), c2 = col(0x7d8087);
  for (const r of D.roads) {
    const R = ROAD[r.t]; if (!R) continue;
    const hw = R[0] / 2, lift = R[1] === 2 ? .2 : .12, mb = mbs[R[1]], cc = R[1] === 2 ? c2 : c1;
    const p = [];
    for (let k = 0; k < r.p.length; k++) {
      if (k) {
        const a = r.p[k - 1], b = r.p[k], n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 5);
        for (let s = 1; s < n; s++) p.push([a[0] + (b[0] - a[0]) * s / n, a[1] + (b[1] - a[1]) * s / n]);
      }
      p.push(r.p[k]);
    }
    let pl = null, pr = null, dist = 0;
    for (let k = 0; k < p.length; k++) {
      const a = p[Math.max(0, k - 1)], b = p[Math.min(p.length - 1, k + 1)];
      let dx = b[0] - a[0], dz = b[1] - a[1]; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
      if (k) dist += Math.hypot(p[k][0] - p[k - 1][0], p[k][1] - p[k - 1][1]);
      const lx = p[k][0] + dz * hw, lz = p[k][1] - dx * hw, rx = p[k][0] - dz * hw, rz = p[k][1] + dx * hw;
      const l = [lx, hAt(lx, lz) + lift, lz, dist / 4], rr = [rx, hAt(rx, rz) + lift, rz, dist / 4];
      if (pl) mb.quad(pl, pr, rr, l, UP, [0, pl[3]], [hw / 2, pr[3]], [hw / 2, rr[3]], [0, l[3]], cc);
      pl = l; pr = rr;
    }
  }
  flat(scene, mbs[1], new THREE.MeshStandardMaterial({ map: TEX.paver, vertexColors: true, roughness: .95 }), 1);
  flat(scene, mbs[2], new THREE.MeshStandardMaterial({ map: TEX.asphalt, vertexColors: true, roughness: .92 }), 2);
}

function buildCourseMesh(scene) {
  const C = W.C, road = new MB(), lines = new MB(), walk = new MB(), curb = new MB();
  const asph = col(0x565a63), white = col(0xf2f2ee), yellow = col(0xf2c230), red = col(0xd8382e), grey = col(0xb9b7b0), dark = col(0x17191e), pave = col(0xb08a76);
  const offset = (off, i) => typeof off === 'function' ? off(mod(i, C.n)) : off;
  const P = (i, off, lift) => { const a = mod(i, C.n), o = offset(off, i), x = C.x[a] + C.tz[a] * o, z = C.z[a] - C.tx[a] * o; return [x, hAt(x, z) + lift, z]; };
  const strip = (mb, i, o0, o1, lift, c, v0, v1) => mb.quad(P(i, o0, lift), P(i, o1, lift), P(i + 1, o1, lift), P(i + 1, o0, lift), UP,
    [offset(o0, i) / 4, v0], [offset(o1, i) / 4, v0], [offset(o1, i + 1) / 4, v1], [offset(o0, i + 1) / 4, v1], c);
  for (let i = 0; i < C.n; i++) {
    const v0 = i * C.ds / 4, v1 = (i + 1) * C.ds / 4;
    strip(road, i, a => C.halfWidth[a], a => -C.halfWidth[a], ROAD_LIFT, asph, v0, v1);
    strip(lines, i, .19, .07, ROAD_LIFT + .015, yellow, v0, v1);       // double yellow centre line
    strip(lines, i, -.07, -.19, ROAD_LIFT + .015, yellow, v0, v1);
    for (const s of [1, -1]) strip(lines, i, a => s * (C.halfWidth[a] - .3), a => s * (C.halfWidth[a] - .45), ROAD_LIFT + .015, white, v0, v1);
    for (let s = 0; s < 2; s++) {
      if (!C.side[s][i] || !C.side[s][mod(i + 1, C.n)]) continue;
      const sg = s ? -1 : 1, e0 = a => sg * C.halfWidth[a], e1 = a => sg * (C.halfWidth[a] + .32), e2 = a => sg * (C.halfWidth[a] + 2.3), top = ROAD_LIFT + CURB_H;
      const cc = (i & 1) ? grey : col(0xa9aaa6);
      strip(curb, i, e0, e1, top, cc, v0, v1);
      const a = mod(i, C.n), nrm = [-C.tz[a] * sg, 0, C.tx[a] * sg];   // curb face looks at the road
      curb.quad(P(i, e0, ROAD_LIFT - .05), P(i + 1, e0, ROAD_LIFT - .05), P(i + 1, e0, top), P(i, e0, top), nrm, [0, v0], [0, v1], [.1, v1], [.1, v0], cc);
      strip(walk, i, e1, e2, top - .01, pave, v0 * 2, v1 * 2);
      walk.quad(P(i, e2, top - .01), P(i + 1, e2, top - .01), P(i + 1, e2, -.4), P(i, e2, -.4), [C.tz[a] * sg, 0, -C.tx[a] * sg], [0, v0], [0, v1], [.3, v1], [.3, v0], pave);
    }
  }
  // start / finish chequer
  const mid = (i, off) => { const A = P(Math.floor(i), off, ROAD_LIFT + .02), B = P(Math.floor(i) + 1, off, ROAD_LIFT + .02), f = i - Math.floor(i); return [lerp(A[0], B[0], f), lerp(A[1], B[1], f), lerp(A[2], B[2], f)]; };
  for (let r = 0; r < 3; r++) for (let q = 0; q < 10; q++) {
    const o0 = -HALF_W + q, o1 = o0 + 1, i0 = r * .5 - .75;
    lines.quad(mid(i0, o0), mid(i0, o1), mid(i0 + .5, o1), mid(i0 + .5, o0), UP, [0, 0], [1, 0], [1, 1], [0, 1], (q + r) & 1 ? white : dark);
  }
  // zebra crossings (real OSM positions near the course)
  const used = [];
  for (const c of W.D.crossings || []) {
    let best = 49, bi = -1;
    for (let i = 0; i < C.n; i++) { const d = (C.x[i] - c[0]) ** 2 + (C.z[i] - c[1]) ** 2; if (d < best) { best = d; bi = i; } }
    if (bi < 8 || bi > C.n - 8 || used.some(u => Math.abs(u - bi) < 6) || W.courseBumps.some(u => Math.abs(u - bi) < 4)) continue;
    used.push(bi);
    const crossingHalfWidth = Math.min(C.halfWidth[bi], C.halfWidth[mod(bi - 1, C.n)], C.halfWidth[mod(bi + 1, C.n)]);
    for (let o = -crossingHalfWidth + .9; o < crossingHalfWidth - 1; o += 1.05)
      lines.quad(mid(bi - .9, o), mid(bi - .9, o + .55), mid(bi + .9, o + .55), mid(bi + .9, o), UP, [0, 0], [1, 0], [1, 1], [0, 1], white);
  }
  flat(scene, road, new THREE.MeshStandardMaterial({ map: TEX.asphalt, bumpMap: TEX.asphalt, bumpScale: .008, vertexColors: true, roughness: .92 }), 3);
  flat(scene, lines, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .75 }), 5);
  flat(scene, walk, new THREE.MeshStandardMaterial({ map: TEX.paver, vertexColors: true, roughness: .95 }), 3);
  const cm = flat(scene, curb, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .85 }), 4);
  cm.castShadow = false;
}

function buildBumps(scene) {
  const D = W.D, C = W.C;
  W.bumps = [];
  for (const b of D.bumps || []) {
    let best = 1e18, bi = -1;
    for (let i = 0; i < C.n; i++) { const d = (C.x[i] - b.x) ** 2 + (C.z[i] - b.z) ** 2; if (d < best) { best = d; bi = i; } }
    if (best < 49) {
      const taggedWidth = b.dimensionSources?.width?.startsWith('osm:'), hw = Math.min(C.halfWidth[bi], taggedWidth ? b.width / 2 : C.halfWidth[bi]);
      const directionLength = Math.hypot(C.tx[bi], C.tz[bi]) || 1;
      W.bumps.push({ ...b, x: C.x[bi], z: C.z[bi], dx: C.tx[bi] / directionLength, dz: C.tz[bi] / directionLength, hw, width: hw * 2,
        height: b.height ?? BUMP_H, length: b.length || BUMP_L * 2, ci: bi, snapDistanceM: Math.sqrt(best), sourceWidth: b.width,
        dimensionSources: { ...b.dimensionSources, width: taggedWidth ? b.dimensionSources.width : 'assumed:rendered-road-width' } });
    } else {
      const R = ROAD[b.t]; if (!R || R[1] !== 2 || surfAt(b.x, b.z) === 3) continue;
      const directionLength = Math.hypot(b.dx, b.dz) || 1, width = b.width || R[0];
      W.bumps.push({ ...b, dx: b.dx / directionLength, dz: b.dz / directionLength, hw: width / 2, width,
        height: b.height ?? BUMP_H, length: b.length || BUMP_L * 2, ci: -1, snapDistanceM: 0 });
    }
  }
  W.courseBumps = W.bumps.filter(b => b.ci >= 0).map(b => b.ci).sort((a, b) => a - b);
  C.slow = new Uint8Array(C.n);
  for (const ci of W.courseBumps) for (let i = ci - 16; i <= ci + 1; i++) C.slow[mod(i, C.n)] = 1;
  bumpGrid = new Map();
  for (const b of W.bumps) {
    const r = b.hw + b.length / 2;
    for (let ix = Math.floor((b.x - r) / BCELL); ix <= Math.floor((b.x + r) / BCELL); ix++)
      for (let iz = Math.floor((b.z - r) / BCELL); iz <= Math.floor((b.z + r) / BCELL); iz++) {
        const k = ix * 4096 + iz;
        if (!bumpGrid.has(k)) bumpGrid.set(k, []);
        bumpGrid.get(k).push(b);
      }
  }
  // Construct the height samples once. Mesh and collision both use these exact
  // triangles; the smooth profile above supplies the samples, not a second collider.
  for (const b of W.bumps) {
    const na = Math.max(12, Math.ceil(b.length / .18 / 2) * 2), nl = Math.max(8, Math.ceil(b.hw * 2 / .3 / 2) * 2);
    const heights = new Float64Array((na + 1) * (nl + 1));
    for (let ia = 0; ia <= na; ia++) for (let il = 0; il <= nl; il++) {
      const al = -b.length / 2 + ia * b.length / na, la = -b.hw + il * 2 * b.hw / nl;
      const x = b.x + b.dx * al + b.dz * la, z = b.z + b.dz * al - b.dx * la;
      heights[ia * (nl + 1) + il] = hAt(x, z) + liftAt(x, z) + bumpH(x, z);
    }
    b.surface = { na, nl, heights };
  }
  const mb = new MB(), one = col(0xffffff);
  for (const b of W.bumps) {
    const { na: NA, nl } = b.surface;
    // The renderer and offline diagnostics share the same gAt-sampled vertices.
    const V = (ia, il) => bumpSurfaceVertex(b, ia, il, NA, nl);
    for (let ia = 0; ia < NA; ia++) for (let il = 0; il < nl; il++) {
      const a = V(ia, il), c = V(ia + 1, il), e = V(ia + 1, il + 1), d = V(ia, il + 1);
      mb.quad(a, c, e, d, UP, [a[3], a[4]], [c[3], c[4]], [e[3], e[4]], [d[3], d[4]], one);
    }
  }
  const g = mb.geo(); g.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ map: TEX.bump, roughness: .8, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 });
  const m = new THREE.Mesh(g, mat); m.receiveShadow = true; scene.add(m);
}

// ───────────────────────── buildings ─────────────────────────
const GLASS = new Set(['N1', 'E4', 'N3', 'E16', 'E16-1', 'E9', 'N27', 'N26']);
const REAL = { 'N13-1': [0xc2532c, 1], N3: [0xb4b9c0, 2], E16: [0xcdb894, 2], E11: [0xd3c2a0, 1] }; // seen in street-level photos
function buildBuildings(scene) {
  const D = W.D, mb = new MB(true), specialized = buildLandmarks(scene, D, hAt), labels = [...specialized.labels];
  const BRICK = [0xa5553c, 0xb0644a, 0x9a5a48, 0xb86a4c], STONE = [0xd6c4a2, 0xcdb994, 0xdccdb0, 0xc9bda8, 0xbfb5a3, 0xd9d2c4],
    APT = [0xe6e2d8, 0xd9d4c8, 0xcfd2d6], MISC = [0xcfc8ba, 0xb9b2a4, 0xa9a59c, 0xc4a58a, 0xb7bcc2];
  const roofC = col(0x8b8f94), roofD = col(0x6f7378);
  D.buildings.forEach((b, bi) => {
    if (specialized.handledRefs.has(b.ref)) return;
    const p = b.p, n = p.length;
    if (n < 3) return;
    let lo = 1e9, hi = -1e9, cx = 0, cz = 0, area = 0;
    for (let i = 0; i < n; i++) {
      const q = p[i], r = p[(i + 1) % n], y = hAt(q[0], q[1]);
      lo = Math.min(lo, y); hi = Math.max(hi, y); cx += q[0] / n; cz += q[1] / n;
      area += q[0] * r[1] - r[0] * q[1];
    }
    // Keep every mapped building. Course clearance is solved before mesh creation.
    const nm = (b.en || '') + ' ' + (b.name || '');
    const tall = !b.ref && b.lv >= 10;
    let style = GLASS.has(b.ref) ? 2 : (/Hall|Village|Apartment|Housing|Dorm|관$/.test(nm) || tall) ? 0 : b.ref ? 1 : bi % 3 ? 1 : 0;
    const pal = style === 2 ? [0xaab4bc, 0xc2c6c8] : tall ? APT : /Hall|Village|Housing|Dorm/.test(nm) ? BRICK : b.ref ? STONE : MISC;
    let wc = col(pal[(bi * 7 + n) % pal.length]);
    if (REAL[b.ref]) { wc = col(REAL[b.ref][0]); style = REAL[b.ref][1]; }
    const hh = b.hh || (b.lv ? b.lv * 3.7 : 6 + ((bi * 37) % 9)) + .9, base = lo - 1, top = hi + hh, H = top - base, sgn = area > 0 ? 1 : -1, seed = (bi * 0.6180339) % 1;
    for (let i = 0; i < n; i++) {
      const a = p[i], c = p[(i + 1) % n], dx = c[0] - a[0], dz = c[1] - a[1], len = Math.hypot(dx, dz);
      if (len < .05) continue;
      const nr = [sgn * dz / len, 0, -sgn * dx / len], ex = [len, H, style, seed];
      mb.quad([a[0], base, a[1]], [c[0], base, c[1]], [c[0], top, c[1]], [a[0], top, a[1]], nr, [0, 0], [len, 0], [len, H], [0, H], wc, ex);
    }
    const tris = THREE.ShapeUtils.triangulateShape(p.map(q => new THREE.Vector2(q[0], q[1])), []), rex = [0, 0, -1, seed];
    for (const t of tris) mb.tri([p[t[0]][0], top, p[t[0]][1]], [p[t[1]][0], top, p[t[1]][1]], [p[t[2]][0], top, p[t[2]][1]], UP, [0, 0], [0, 0], [0, 0], roofC, rex);
    const A = Math.abs(area) / 2;
    if (A > 350) for (let k = 0; k < Math.min(4, 1 + A / 900); k++) { // rooftop plant boxes
      const sx = 2 + rnd() * 4, sz = 2 + rnd() * 4, sh = 1.4 + rnd() * 1.8, ox = cx + (rnd() - .5) * Math.sqrt(A) * .6, oz = cz + (rnd() - .5) * Math.sqrt(A) * .6;
      if (![[-1, -1], [1, -1], [1, 1], [-1, 1]].every(q => inPoly(ox + q[0] * sx, oz + q[1] * sz, p))) continue;
      const c4 = [[ox - sx, oz - sz], [ox + sx, oz - sz], [ox + sx, oz + sz], [ox - sx, oz + sz]];
      for (let i = 0; i < 4; i++) {
        const a = c4[i], c = c4[(i + 1) % 4], dx = c[0] - a[0], dz = c[1] - a[1], len = Math.hypot(dx, dz);
        mb.quad([a[0], top, a[1]], [c[0], top, c[1]], [c[0], top + sh, c[1]], [a[0], top + sh, a[1]], [dz / len, 0, -dx / len], [0, 0], [0, 0], [0, 0], [0, 0], roofD, rex);
      }
      mb.quad([c4[0][0], top + sh, c4[0][1]], [c4[1][0], top + sh, c4[1][1]], [c4[2][0], top + sh, c4[2][1]], [c4[3][0], top + sh, c4[3][1]], UP, [0, 0], [0, 0], [0, 0], [0, 0], roofC, rex);
    }
    if (b.ref) labels.push({ ref: b.ref, en: b.en || '', x: cx, y: top + 5, z: cz });
  });
  const mat = patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .86, metalness: 0 }), {
    vHead: 'attribute vec4 aInfo; varying vec4 vInfo; varying vec2 vBuv;', vBody: 'vInfo = aInfo; vBuv = uv;',
    fHead: 'varying vec4 vInfo; varying vec2 vBuv; float winMask;',
    fColor: `
      winMask = 0.0;
      float style = vInfo.z;
      if (style > -0.5) {
        float wallLen = vInfo.x, bh = vInfo.y;
        diffuseColor.rgb *= mix(0.80, 1.0, smoothstep(0.0, 5.0, vBuv.y)) * mix(0.94, 1.04, vnoise(vec2(vBuv.x * 0.15 + vInfo.w * 40.0, vBuv.y * 0.6)));
        if (wallLen > 2.4) {
          float nCol = max(1.0, floor(wallLen / (style > 1.5 ? 2.2 : 3.3) + 0.5));
          float cu = vBuv.x / wallLen * nCol, fl = vBuv.y / 3.7;
          float fwx = fwidth(cu) * 1.2, fwy = fwidth(fl) * 1.2, fx = fract(cu), fy = fract(fl);
          vec4 e = style < 0.5 ? vec4(0.22, 0.78, 0.34, 0.80) : style < 1.5 ? vec4(0.05, 0.95, 0.38, 0.80) : vec4(0.045, 0.955, 0.10, 0.93);
          float wx = smoothstep(e.x - fwx, e.x + fwx, fx) - smoothstep(e.y - fwx, e.y + fwx, fx);
          float wy = smoothstep(e.z - fwy, e.z + fwy, fy) - smoothstep(e.w - fwy, e.w + fwy, fy);
          float cov = (e.y - e.x) * (e.w - e.z), far = smoothstep(0.25, 0.6, max(fwx, fwy));
          float win = mix(wx * wy, cov, far) * step(vBuv.y, bh - 1.3) * step(1.0, fl + 0.72);
          float hsh = h21(vec2(floor(cu) + vInfo.w * 91.0, floor(fl) + vInfo.w * 53.0));
          vec3 glass = mix(vec3(0.05, 0.09, 0.13), vec3(0.10, 0.20, 0.22), hsh);
          if (style > 1.5) glass = mix(vec3(0.07, 0.17, 0.22), vec3(0.14, 0.30, 0.33), hsh);
          glass = mix(glass, vec3(0.62, 0.60, 0.55), step(0.83, hsh) * (1.0 - far) * 0.7);
          diffuseColor.rgb = mix(diffuseColor.rgb, glass, win);
          winMask = win * (1.0 - step(0.83, hsh) * 0.7);
        }
      }`,
    fRough: 'roughnessFactor = mix(roughnessFactor, 0.07, winMask); metalnessFactor = mix(metalnessFactor, 0.9, winMask);',
  });
  const m = new THREE.Mesh(mb.geo(), mat);
  m.castShadow = true; m.receiveShadow = true;
  scene.add(m);
  for (const l of labels) {
    const name = l.en.length > 26 ? l.en.slice(0, 25) + '…' : l.en;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex(l.ref, name), transparent: true, depthWrite: false }));
    s.scale.set(13, 3.25, 1); s.position.set(l.x, l.y, l.z);
    scene.add(s);
  }
}
function labelTex(ref, name) {
  return canvasTex(512, 128, (x, w, h) => {
    x.fillStyle = 'rgba(12,28,56,.78)'; x.beginPath(); x.roundRect(4, 4, w - 8, h - 8, 30); x.fill();
    x.fillStyle = '#7fd0ff'; x.font = '800 58px "Segoe UI",Arial,sans-serif'; x.textBaseline = 'middle';
    const rw = x.measureText(ref).width;
    x.fillText(ref, 28, h / 2 + 2);
    x.fillStyle = '#fff'; x.font = '600 30px "Segoe UI",Arial,sans-serif';
    x.fillText(name, 28 + rw + 22, h / 2 + 3, w - rw - 78);
  }, false);
}

// ───────────────────────── vegetation, water, props ─────────────────────────
function buildNature(scene) {
  const D = W.D, C = W.C, b = D.bounds;
  const water = new THREE.MeshStandardMaterial({ color: 0x2a6f8e, roughness: .06, metalness: .65, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const turf = new THREE.MeshStandardMaterial({ color: 0x3e9a4c, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const trees = { conifer: [], leaf: [], cherry: [] };
  let pond = null;
  for (const a of D.areas) {
    if (a.p.length < 3) continue;
    if (a.k === 'water' || a.k === 'pitch') {
      let lo = 1e9, hi = -1e9;
      for (const p of a.p) { const y = hAt(p[0], p[1]); lo = Math.min(lo, y); hi = Math.max(hi, y); }
      const g = new THREE.ShapeGeometry(new THREE.Shape(a.p.map(p => new THREE.Vector2(p[0], -p[1]))));
      g.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(g, a.k === 'water' ? water : turf);
      m.position.y = (a.k === 'water' ? lo : (lo + hi) / 2) + .3; m.receiveShadow = true;
      scene.add(m);
      if (a.name) pond = a;
    } else if (a.k === 'wood') {
      let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
      for (const q of a.p) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); z0 = Math.min(z0, q[1]); z1 = Math.max(z1, q[1]); }
      const n = Math.min(900, (x1 - x0) * (z1 - z0) / 120);
      for (let i = 0; i < n; i++) {
        const x = x0 + rnd() * (x1 - x0), z = z0 + rnd() * (z1 - z0);
        if (inPoly(x, z, a.p) && surfAt(x, z) === 0) (rnd() < .55 ? trees.conifer : trees.leaf).push([x, z, 1]);
      }
    }
  }
  const clear = (x, z, r) => surfAt(x, z) === 0 && surfAt(x + r, z) === 0 && surfAt(x - r, z) === 0 && surfAt(x, z + r) === 0 && surfAt(x, z - r) === 0;
  for (let i = 0; i < 1300; i++) { // scattered campus trees
    const x = b.x0 + rnd() * (b.x1 - b.x0), z = b.z0 + rnd() * (b.z1 - b.z0);
    if (clear(x, z, 3)) (rnd() < .2 ? trees.conifer : rnd() < .2 ? trees.cherry : trees.leaf).push([x, z, 1]);
  }
  for (let i = 0; i < C.n; i += 8) for (const sg of [1, -1]) { // street trees (cherry blossom stretches)
    const off = (C.halfWidth[i] + 4 + rnd() * 1.2) * sg, x = C.x[i] + C.tz[i] * off, z = C.z[i] - C.tx[i] * off;
    if (!clear(x, z, 1.5)) continue;
    (Math.sin(i * .011) > .35 ? trees.cherry : trees.leaf).push([x, z, .8]);
  }
  const ico = new THREE.IcosahedronGeometry(1, 1), white = col(0xffffff);
  const leafG = merged([[ico, M4(0, .7, 0, .3, .27, .3), white], [ico, M4(.17, .59, .06, .22, .2, .22), white], [ico, M4(-.16, .61, -.08, .23, .21, .23), white], [ico, M4(.02, .58, -.18, .2, .18, .2), white]]);
  const coneG = merged([[new THREE.ConeGeometry(.2, .5, 9), M4(0, .45, 0), white], [new THREE.ConeGeometry(.16, .45, 9), M4(0, .68, 0), white], [new THREE.ConeGeometry(.11, .38, 9), M4(0, .87, 0), white]]);
  const trunkG = new THREE.CylinderGeometry(.045, .07, .5, 7); trunkG.translate(0, .25, 0);
  const trunkM = new THREE.MeshStandardMaterial({ color: 0x6a4d35, roughness: 1 });
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color(), e = new THREE.Euler();
  const make = (list, geo, hue, sat, lig, hmin, hmax, wide) => {
    if (!list.length) return;
    const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .95 }), list.length);
    const tr = new THREE.InstancedMesh(trunkG, trunkM, list.length);
    list.forEach(([x, z, sc], i) => {
      const h = (hmin + rnd() * (hmax - hmin)) * sc, y = hAt(x, z) + liftAt(x, z);
      q.setFromEuler(e.set(0, rnd() * 6.28, 0));
      m4.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(h * wide, h, h * wide)); mesh.setMatrixAt(i, m4);
      m4.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(h * 1.1, h, h * 1.1)); tr.setMatrixAt(i, m4);
      mesh.setColorAt(i, c.setHSL(hue + (rnd() - .5) * .05, sat, lig + (rnd() - .5) * .1));
    });
    mesh.castShadow = tr.castShadow = true; mesh.receiveShadow = true;
    scene.add(mesh, tr);
  };
  make(trees.conifer, coneG, .36, .42, .25, 8, 14, 1);
  make(trees.leaf, leafG, .28, .5, .36, 6.5, 10, 1.25);
  make(trees.cherry, leafG, .93, .75, .86, 5.5, 8, 1.3);

  // lamp posts
  const metal = col(0x3a3f47), lampG = merged([[new THREE.CylinderGeometry(.07, .1, 7, 8), M4(0, 3.5, 0), metal],
    [new THREE.BoxGeometry(.09, .09, 1.7), M4(0, 6.95, .8), metal], [new THREE.BoxGeometry(.3, .1, .7), M4(0, 6.9, 1.6), col(0xe9e6da)]]);
  const lamps = [];
  for (let i = 12, k = 0; i < C.n; i += 22, k++) {
    const s = k & 1, sg = s ? -1 : 1;
    if (!C.side[s][i]) continue;
    const off = (C.halfWidth[i] + 2) * sg, x = C.x[i] + C.tz[i] * off, z = C.z[i] - C.tx[i] * off;
    lamps.push([x, z, Math.atan2(-C.tz[i] * sg, C.tx[i] * sg)]);
  }
  const lm = new THREE.InstancedMesh(lampG, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .6, metalness: .3 }), lamps.length);
  lamps.forEach(([x, z, ry], i) => { m4.compose(new THREE.Vector3(x, hAt(x, z) + ROAD_LIFT + CURB_H, z), q.setFromEuler(e.set(0, ry, 0)), new THREE.Vector3(1, 1, 1)); lm.setMatrixAt(i, m4); });
  lm.castShadow = true; scene.add(lm);

  // KAIST geese
  const gw = col(0xf7f5ee), go = col(0xf08a1c), sph = new THREE.SphereGeometry(1, 12, 9);
  const gooseG = merged([[sph, M4(0, .36, 0, .2, .19, .32), gw], [sph, M4(0, .4, -.28, .1, .09, .14), gw],
    [new THREE.CylinderGeometry(.045, .06, .42, 8), M4(0, .64, .24, 1, 1, 1, .25), gw], [sph, M4(0, .87, .31, .075, .07, .09), gw],
    [new THREE.ConeGeometry(.035, .13, 6), M4(0, .86, .44, 1, 1, 1, Math.PI / 2), go],
    [new THREE.CylinderGeometry(.018, .018, .2, 5), M4(.07, .1, 0), go], [new THREE.CylinderGeometry(.018, .018, .2, 5), M4(-.07, .1, 0), go]]);
  const geese = [];
  if (pond) for (let i = 0; i < pond.p.length; i += 9) {
    let cx = 0, cz = 0; for (const p of pond.p) { cx += p[0] / pond.p.length; cz += p[1] / pond.p.length; }
    const p = pond.p[i], dx = p[0] - cx, dz = p[1] - cz, L = Math.hypot(dx, dz) || 1;
    for (let k = 0; k < 2; k++) { const x = p[0] + dx / L * (2 + rnd() * 3) + rnd() * 2, z = p[1] + dz / L * (2 + rnd() * 3) + rnd() * 2; if (surfAt(x, z) < 2) geese.push([x, z]); }
  }
  for (let i = 60; i < C.n; i += 173) { // a gaggle by the roadside every few hundred metres
    const sg = (i / 173 | 0) & 1 ? 1 : -1;
    for (let k = 0; k < 3; k++) {
      const j = mod(i + k * 2, C.n), off = (C.halfWidth[j] + 3.4 + rnd() * 2.5) * sg, x = C.x[j] + C.tz[j] * off, z = C.z[j] - C.tx[j] * off;
      if (surfAt(x, z) < 2) geese.push([x, z]);
    }
  }
  const gm = new THREE.InstancedMesh(gooseG, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .8 }), geese.length);
  geese.forEach(([x, z], i) => { const s = 1.5 + rnd() * .5; m4.compose(new THREE.Vector3(x, hAt(x, z) + liftAt(x, z), z), q.setFromEuler(e.set(0, rnd() * 6.28, 0)), new THREE.Vector3(s, s, s)); gm.setMatrixAt(i, m4); });
  gm.castShadow = true; scene.add(gm);
}

function buildProps(scene) {
  const C = W.C, m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1);
  const poleM = new THREE.MeshStandardMaterial({ color: 0x8d949c, roughness: .5, metalness: .6 });
  // speed-bump warning signs, 30 m ahead of each bump
  const signTex = canvasTex(128, 128, (x) => {
    x.translate(64, 64); x.rotate(Math.PI / 4);
    x.fillStyle = '#111'; x.fillRect(-44, -44, 88, 88); x.fillStyle = '#f5c518'; x.fillRect(-39, -39, 78, 78);
    x.rotate(-Math.PI / 4); x.strokeStyle = '#111'; x.lineWidth = 7; x.lineCap = 'round';
    x.beginPath(); x.moveTo(-30, 12); x.lineTo(-14, 12); x.quadraticCurveTo(0, -18, 14, 12); x.lineTo(30, 12); x.stroke();
  }, false);
  const n = W.courseBumps.length;
  const plates = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.15, 1.15), new THREE.MeshStandardMaterial({ map: signTex, transparent: true, alphaTest: .5, roughness: .5, side: THREE.DoubleSide }), n);
  const poleG = new THREE.CylinderGeometry(.045, .045, 2.6, 6); poleG.translate(0, 1.3, 0);
  const poles = new THREE.InstancedMesh(poleG, poleM, n);
  W.courseBumps.forEach((ci, i) => {
    const k = mod(ci - Math.round(30 / C.ds), C.n), off = -(C.halfWidth[k] + 1.1), x = C.x[k] + C.tz[k] * off, z = C.z[k] - C.tx[k] * off, y = hAt(x, z) + liftAt(x, z);
    m4.compose(new THREE.Vector3(x, y, z), q.identity(), one); poles.setMatrixAt(i, m4);
    m4.compose(new THREE.Vector3(x - C.tx[k] * .06, y + 2.5, z - C.tz[k] * .06), q.setFromEuler(e.set(0, Math.atan2(-C.tx[k], -C.tz[k]), 0)), one); plates.setMatrixAt(i, m4);
  });
  plates.castShadow = poles.castShadow = true;
  scene.add(plates, poles);
  // landmark direction boards
  for (const m of W.landmarks.slice(1)) {
    const i = m.idx, off = -(C.halfWidth[i] + 3.4), x = C.x[i] + C.tz[i] * off, z = C.z[i] - C.tx[i] * off, y = hAt(x, z) + liftAt(x, z);
    const tex = canvasTex(512, 128, (c, w, h) => {
      c.fillStyle = '#134a9c'; c.fillRect(0, 0, w, h); c.strokeStyle = '#fff'; c.lineWidth = 6; c.strokeRect(7, 7, w - 14, h - 14);
      c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '700 44px "Segoe UI",Arial,sans-serif';
      c.fillText(m.name, w / 2, h / 2 + 2, w - 40);
    }, false);
    const g = new THREE.Group(), board = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.1, .08),
      [poleM, poleM, poleM, poleM, new THREE.MeshStandardMaterial({ map: tex, roughness: .5 }), poleM]);
    board.position.y = 3.6; g.add(board);
    for (const s of [-1.6, 1.6]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, 4.2, 6), poleM); p.position.set(s, 2.1, -.08); g.add(p); }
    g.position.set(x, y, z); g.rotation.y = Math.atan2(-C.tx[i], -C.tz[i]);
    g.traverse(o => { o.castShadow = true; });
    scene.add(g);
  }
  // start / finish gantry
  const g = new THREE.Group(), th = Math.atan2(C.tx[0], C.tz[0]), span = HALF_W * 2 + 3;
  const truss = new THREE.MeshStandardMaterial({ color: 0x1d2b46, roughness: .45, metalness: .7 });
  for (const s of [1, -1]) { const t = new THREE.Mesh(new THREE.BoxGeometry(.7, 8.6, .7), truss); t.position.set(s * span / 2, 4.3, 0); g.add(t); }
  const ban = canvasTex(1024, 160, (c, w, h) => {
    const gr = c.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#0d3f94'); gr.addColorStop(.5, '#1f7fe8'); gr.addColorStop(1, '#0d3f94');
    c.fillStyle = gr; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { c.fillStyle = (i + j) & 1 ? '#fff' : '#111'; c.fillRect(i * 40, j * 40, 40, 40); c.fillRect(w - 160 + i * 40, j * 40, 40, 40); }
    c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = 'italic 900 92px "Segoe UI",Arial,sans-serif';
    c.fillText('KAIST FUN RUN GP', w / 2, h / 2 + 6, w - 380);
  }, false);
  const bm = new THREE.MeshStandardMaterial({ map: ban, roughness: .6 });
  const beam = new THREE.Mesh(new THREE.BoxGeometry(span + .7, 1.9, .6), [truss, truss, truss, truss, bm, bm]);
  beam.position.y = 7.7; g.add(beam);
  g.position.set(C.x[0], hAt(C.x[0], C.z[0]) + ROAD_LIFT, C.z[0]); g.rotation.y = th;
  g.traverse(o => { o.castShadow = true; });
  scene.add(g);
}

// ───────────────────────── sky ─────────────────────────
function buildSky(scene, renderer) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uSun: { value: W.sun }, uTime: { value: 0 } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform vec3 uSun; uniform float uTime; varying vec3 vDir;
      ${NOISE_GLSL}
      float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = p * 2.03 + vec2(17.1, 3.7); a *= 0.5; } return s; }
      void main(){
        vec3 d = normalize(vDir);
        float h = max(d.y, 0.0), sd = max(dot(d, uSun), 0.0);
        vec3 hor = vec3(0.70, 0.84, 0.97), col = mix(hor, vec3(0.13, 0.36, 0.82), pow(h, 0.55));
        col += vec3(1.0, 0.86, 0.62) * (pow(sd, 420.0) * 7.0 + pow(sd, 14.0) * 0.22);
        if (d.y > 0.015) {
          vec2 uv = d.xz / (d.y + 0.14) * 1.25 + vec2(uTime * 0.006, uTime * 0.002);
          float c = fbm(uv), m = smoothstep(0.50, 0.80, c) * smoothstep(0.015, 0.22, d.y);
          col = mix(col, mix(vec3(0.80, 0.85, 0.93), vec3(1.05), smoothstep(0.5, 0.9, c)) * (0.92 + 0.5 * pow(sd, 4.0)), m * 0.92);
        }
        col = mix(col, hor, smoothstep(0.0, -0.06, d.y));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const geo = new THREE.SphereGeometry(4200, 32, 20);
  W.sky = new THREE.Mesh(geo, mat); W.sky.renderOrder = -10; W.sky.frustumCulled = false;
  scene.add(W.sky);
  // image-based lighting from the same sky
  const es = new THREE.Scene(); es.add(new THREE.Mesh(geo, mat));
  const pm = new THREE.PMREMGenerator(renderer);
  W.env = pm.fromScene(es, 0, 1, 9000).texture;
  scene.environment = W.env;
  pm.dispose();
  // distant hills to close the horizon
  const N = 96, pos = [], colr = [], idx = [], r = rng(5), hs = [];
  for (let i = 0; i < N; i++) hs.push(70 + 150 * (.5 + .5 * Math.sin(i * .37 + 1.3) * Math.sin(i * .11)) + r() * 35);
  for (let i = 0; i <= N; i++) {
    const a = i / N * Math.PI * 2, R = 3300, x = Math.cos(a) * R, z = Math.sin(a) * R, hh = hs[i % N];
    pos.push(x, -20, z, x, hh, z); colr.push(.52, .66, .70, .50, .63, .74);
    if (i < N) { const o = i * 2; idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2); }
  }
  const hg = new THREE.BufferGeometry();
  hg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); hg.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3)); hg.setIndex(idx);
  const hills = new THREE.Mesh(hg, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide }));
  hills.renderOrder = -9; W.hills = hills;
  scene.add(hills);
}

export function updateWorld(t, camera) {
  if (W.sky) { W.sky.position.copy(camera.position); W.sky.material.uniforms.uTime.value = t; }
  if (W.hills) W.hills.position.set(camera.position.x, 0, camera.position.z);
}

export async function loadWorld(scene, renderer, progress) {
  const step = async (msg, fn) => { progress(msg); await new Promise(r => setTimeout(r, 0)); fn(); };
  progress('Downloading campus map');
  W.D = await (await fetch('data/campus.json')).json();
  await step('Tracing the Fun Run course', () => { buildCourse(); buildGrid(); makeTextures(); });
  await step('Painting the sky', () => buildSky(scene, renderer));
  await step('Shaping the hills', () => buildTerrain(scene));
  await step('Paving roads', () => { buildRoads(scene); buildBumps(scene); buildCourseMesh(scene); });
  await step('Raising buildings', () => buildBuildings(scene));
  await step('Planting trees', () => { buildNature(scene); buildProps(scene); });
}
