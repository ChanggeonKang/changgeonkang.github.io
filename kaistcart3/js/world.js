// World: terrain, course, roads, buildings, vegetation, props, sky.
import * as THREE from '../lib/three.module.min.js';
import {buildStreetFixtures} from './street-fixtures.js';
import { buildLandmarks } from './landmarks.js';
import { campusName, buildingProfile } from './campus-identity.js';
import { buildParking } from './campus-parking.js';
import { buildStreetscape, isStreetscapeManaged } from './campus-streetscape.js';
import { buildCapturedLandscape, isCaptureLandscapeManaged } from './capture-landscaping.js';
import { buildCapturedArchitecture } from './capture-architecture.js';
import { buildCapturedRoadside, capturedRoadStyles, capturedSpeedMarks, capturedBumps } from './capture-roadside.js';
import { buildGate } from './campus-gate.js';
import { locateHumps } from './campus-humps.js';
import { APPROACH, indexHumpPavement, indexPavement } from './hump-pavement.js';
import { leafyCrown, leafSprayMaterial } from './campus-canopy.js';
import { buildKaimaruGarden } from './kaimaru-garden.js';
import { buildRoadElevationField, roadHeightOffset } from './road-elevation-field.js';
import { createDrivingAccess } from './drivable-access.js';
import { mappedRoadBoundaries } from './mapped-road-boundaries.js';
import { trackSceneryDistance } from './scenery-distance.js';
import { applyObservedGrades } from './capture-elevation.js';
import { buildCaptureEast, isCaptureEastManaged, eastRoadStyles, eastSpeedMarks, eastBumps } from './capture-extension-east.js';
import { buildCaptureWest, isCaptureWestManaged, westRoadStyles, westSpeedMarks, westBumps } from './capture-extension-west.js';
import { buildExploreRoads } from './explore-roads.js';
import { buildExploreGrounds } from './explore-grounds.js';
import { buildOutdoorTheater } from './explore-theater.js';
import { buildKaimaru } from './kaimaru.js';
import { buildAccessEdges } from './explore-curbs.js';
import { partitionCampusBatches } from './explore-visibility.js';
import { buildStreetviewDetails,streetviewPalette } from './streetview-buildings.js';
import { facadeFinish, finishLandmarkMaterials } from './facade-materials.js';
import { prepareRoads, prepareSurfaceGrid } from './explore-surfaces.js';
import { buildVestibule, lineArcades, planDoorways, ringSign } from './building-interiors.js';

const referenceRoadStyles = [...capturedRoadStyles, ...eastRoadStyles, ...westRoadStyles];
const referenceSpeedMarks = [...capturedSpeedMarks, ...eastSpeedMarks, ...westSpeedMarks];
const referenceBumps = [...capturedBumps, ...eastBumps, ...westBumps];

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
  horizon: new THREE.Color(0xb2cede),
  sky: null, env: null,
};

// ───────────────────────── height / surface queries ─────────────────────────
export function hAt(x, z) {
  const height = naturalTerrain(x,z), field = W.roadElevation?.field;
  return field ? height + roadHeightOffset(field,x,z) : height;
}
function sampleHeight(t, x, z) {
  const u = clamp((x - t.x0) / t.gs, 0, t.w - 1), v = clamp((z - t.z0) / t.gs, 0, t.h - 1);
  const i = Math.min(t.w - 2, Math.floor(u)), j = Math.min(t.h - 2, Math.floor(v)), fu = u - i, fv = v - j, d = t.d, o = j * t.w + i;
  return (d[o] * (1 - fu) * (1 - fv) + d[o + 1] * fu * (1 - fv) + d[o + t.w] * (1 - fu) * fv + d[o + t.w + 1] * fu * fv) * VS;
}
function naturalTerrain(x, z) {
  const t = W.D.terrain, extended = W.D.terrainExtended;
  const xx = clamp(x, t.x0, t.x0 + (t.w - 1) * t.gs), zz = clamp(z, t.z0, t.z0 + (t.h - 1) * t.gs);
  if (!extended || x === xx && z === zz) return sampleHeight(t, xx, zz);
  const f = clamp(Math.hypot(x - xx, z - zz) / 125, 0, 1);
  return sampleHeight(extended, x, z) + (sampleHeight(t, xx, zz) - sampleHeight(extended, xx, zz)) * (1 - f*f*(3-2*f));
}
function inPoly(x, z, p) {
  let c = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const a = p[i], b = p[j];
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}
// One-metre occupancy of the open campus: grass 0, walks 1, streets 2, water 8, solid 9.
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
let humpPavement;
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
export const gAt = (x, z, referenceHeight = Infinity) => {
  const list = bumpGrid.get(Math.floor(x / BCELL) * 4096 + Math.floor(z / BCELL));
  if(!list?.length || !humpPavement)return baseSurfaceAt(x,z,referenceHeight);
  const k=(Math.floor(z)-W.G.z0)*W.G.w+Math.floor(x)-W.G.x0;
  if(W.G.lowerDecks.has(k) && referenceHeight<W.G.decks.get(k)-.45)return baseSurfaceAt(x,z,referenceHeight);
  let height = -Infinity, approach = 0;
  for (const b of list) {
    const ex = x - b.x, ez = z - b.z, al = ex * b.dx + ez * b.dz, la = ex * b.dz - ez * b.dx, s = b.surface;
    const distance=Math.max(0,Math.abs(al)-b.length/2,Math.abs(la)-b.hw);
    approach=Math.max(approach,1-distance/APPROACH);
    if (!s || Math.abs(al) > b.length / 2 + 1e-7 || Math.abs(la) > b.hw + 1e-7) continue;
    const u = clamp((al / b.length + .5) * s.na, 0, s.na), v = clamp((la / (b.hw * 2) + .5) * s.nl, 0, s.nl);
    const i = Math.min(s.na - 1, Math.floor(u)), j = Math.min(s.nl - 1, Math.floor(v)), fu = u - i, fv = v - j, o = i * (s.nl + 1) + j;
    const a = s.heights[o], c = s.heights[o + s.nl + 1], e = s.heights[o + s.nl + 2], d = s.heights[o + 1];
    // Same a-c-e / a-e-d triangles emitted by MB.quad below. Tyres query the
    // rendered surface itself, including its per-feature dimensions and terrain.
    const y = fu >= fv ? a * (1 - fu) + c * (fu - fv) + e * fv : a * (1 - fv) + e * fu + d * (fv - fu);
    height = Math.max(height, y);
  }
  if(Number.isFinite(height))return height;
  const base=baseSurfaceAt(x,z,referenceHeight);
  if(approach<=0)return base;
  const pavement=humpPavement.heightAt(x,z);
  return Number.isFinite(pavement) ? lerp(base,pavement,approach*approach*(3-2*approach)) : base;
};
const baseSurfaceAt = (x,z,referenceHeight = Infinity) => {
  const G = W.G;
  const i = Math.floor(x) - G.x0, j = Math.floor(z) - G.z0;
  const k=j*G.w+i, deck=G.decks.get(k);
  if(deck!==undefined && (!G.lowerDecks.has(k) || referenceHeight >= deck - .45))return deck;
  return hAt(x,z) + liftAt(x,z);
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
  W.roadElevation = null;
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
    return { name: campusName(m), idx: bi };
  });
  buildRoadElevation();
}

function buildRoadElevation() {
  const C = W.C, sigmaM = 40, radius = Math.ceil(4 * sigmaM / C.ds);
  const raw = new Float64Array(C.n), heights = new Float64Array(C.n), weights = [];
  for (let i = 0; i < C.n; i++) raw[i] = sampleHeight(W.D.terrain, C.x[i], C.z[i]);
  for (let k = -radius; k <= radius; k++) weights.push(Math.exp(-.5 * (k * C.ds / sigmaM) ** 2));
  const total = weights.reduce((s, w) => s + w, 0);
  for (let i = 0; i < C.n; i++) {
    let sum = 0;
    for (let k = -radius; k <= radius; k++) sum += raw[mod(i + k, C.n)] * weights[k + radius];
    heights[i] = sum / total;
  }
  const observed = applyObservedGrades(C, heights);
  heights.set(observed.heights);
  const cellSize = 32, cells = new Map();
  for (let i = 0; i < C.n; i++) {
    const j = (i + 1) % C.n, margin = Math.max(C.halfWidth[i], C.halfWidth[j]) + 14;
    for (let ix = Math.floor((Math.min(C.x[i], C.x[j]) - margin) / cellSize); ix <= Math.floor((Math.max(C.x[i], C.x[j]) + margin) / cellSize); ix++) {
      for (let iz = Math.floor((Math.min(C.z[i], C.z[j]) - margin) / cellSize); iz <= Math.floor((Math.max(C.z[i], C.z[j]) + margin) / cellSize); iz++) {
        const key = ix * 8192 + iz;
        if (!cells.has(key)) cells.set(key, []);
        cells.get(key).push(i);
      }
    }
  }
  const field = buildRoadElevationField(C, heights, raw, naturalTerrain);
  W.roadElevation = { raw, heights, cells, cellSize, field, sigmaM, cornerKernelSigmaM: 7, crownSlope: .015, observations: observed.metadata,
    measured: false, source: 'GEDTM30 centreline with user-described local grade corrections, continuous 7 m corner kernel; inferred 1.5% crown, with grade corrections tapering over 63 m into adjoining streets' };
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
  // THREE's default key stringifies onBeforeCompile. These closures have the
  // same function text but different GLSL, so each patch needs its own key.
  mat.customProgramCacheKey = () => JSON.stringify([vHead, vBody, fHead, fColor, fRough]);
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
  const D=W.D,b=D.bounds;
  const grass = () => patch(new THREE.MeshStandardMaterial({color:0x718448,roughness:1,metalness:0,vertexColors:true,envMapIntensity:.5}), {
    fColor:`
      float n1=vnoise(vWp.xz*.02), n2=vnoise(vWp.xz*.21), n3=vnoise(vWp.xz*1.7);
      diffuseColor.rgb *= mix(.74,1.16,n1*.5+n2*.32+n3*.18);
      diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(1.2,1.07,.72),smoothstep(.57,.89,vnoise(vWp.xz*.008+7.3))*.43);`
  });
  const mat=grass(), waters=[...W.waterLevels].map(([a,y])=>({a,y,...polygonBounds(a.p)}));
  const cover=D.areas.filter(a=>['wood','shrub','grass','garden','playground','traffic_island'].includes(a.k)).map(a=>({a,...polygonBounds(a.p)}));
  const contains=(x,z,entry)=>x>=entry.x0 && x<=entry.x1 && z>=entry.z0 && z<=entry.z1 && inPoly(x,z,entry.a.p) &&
    !(entry.a.holes || []).some(p=>inPoly(x,z,p));
  const colors={wood:[.57,.69,.55],shrub:[.67,.78,.62],grass:[1.14,1.13,1.10],garden:[.86,1.02,.75],playground:[1.22,1.09,.73],traffic_island:[.93,.94,.72]};
  const tileSize=160;
  for(let z0=b.z0;z0<b.z1;z0+=tileSize)for(let x0=b.x0;x0<b.x1;x0+=tileSize){
    const x1=Math.min(x0+tileSize,b.x1),z1=Math.min(z0+tileSize,b.z1);
    const overlaps=r=>r.x0<=x1 && r.x1>=x0 && r.z0<=z1 && r.z1>=z0;
    const localWater=waters.filter(overlaps), localCover=cover.filter(overlaps);
    const nx=Math.ceil((x1-x0)/5), nz=Math.ceil((z1-z0)/5);
    const pos=[],rgb=[],indices=[];
    for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){
      const x=x0+i*(x1-x0)/nx,z=z0+j*(z1-z0)/nz;
      let y=hAt(x,z);
      // Give the coarser five-metre lawn mesh a shallow bed beneath mapped
      // pavement. It cannot protrude through a compound-camber road or a bay.
      const G=W.G,gi=Math.floor(x)-G.x0,gj=Math.floor(z)-G.z0;
      if(gi>=0&&gj>=0&&gi<G.w&&gj<G.h){
        const cell=gj*G.w+gi;
        if(G.lotMask[cell] || G.mappedLane[cell])y-=.16;
      }
      for (const r of localWater) if(contains(x,z,r)) y=Math.min(y,r.y-.75);
      const area=localCover.find(r=>contains(x,z,r));
      pos.push(x,y,z);rgb.push(...(area?colors[area.a.k]:[1,1,1]));
    }
    for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const a=j*(nx+1)+i,c=a+nx+1;indices.push(a,c,a+1,a+1,c,c+1);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('color',new THREE.Float32BufferAttribute(rgb,3));g.setIndex(indices);g.computeVertexNormals();
    const m=new THREE.Mesh(g,mat);m.name='Campus terrain';m.receiveShadow=true;scene.add(m);
  }
  const ex=D.terrainExtended;
  if(!ex)return;
  const mb=new MB(),one=col(0xa2b68d),step=100;
  // Include the precise inner edges in the coarse outer mesh so there are no gaps.
  const axis=(lo,hi,inLo,inHi)=>{
    const out=[inLo,inHi];for(let v=lo;v<=hi;v+=step)out.push(v);
    return [...new Set(out)].sort((a,b)=>a-b);
  };
  const xx=axis(ex.x0,ex.x0+(ex.w-1)*ex.gs,b.x0,b.x1),zz=axis(ex.z0,ex.z0+(ex.h-1)*ex.gs,b.z0,b.z1);
  const point=(x,z)=>[x,naturalTerrain(x,z)-.02,z];
  for(let i=1;i<xx.length;i++)for(let j=1;j<zz.length;j++){
    const x=xx[i-1],z=zz[j-1],x1=xx[i],z1=zz[j];
    if(x>=b.x0&&x1<=b.x1&&z>=b.z0&&z1<=b.z1)continue;
    mb.quad(point(x,z),point(x,z1),point(x1,z1),point(x1,z),UP,[0,0],[0,1],[1,1],[1,0],one);
  }
  const ag=mb.geo();ag.computeVertexNormals();scene.add(new THREE.Mesh(ag,mat));
}

// ───────────────────────── roads ─────────────────────────
let TEX;
function makeTextures() {
  const r = rng(77);
  TEX = {
    asphalt: canvasTex(256, 256, (x, w, h) => {
      const pixels=x.createImageData(w,h);
      for(let i=0;i<pixels.data.length;i+=4){
        const v=188+(r()+r()+r()-1.5)*26;
        pixels.data[i]=v+2;pixels.data[i+1]=v+1;pixels.data[i+2]=v;pixels.data[i+3]=255;
      }
      x.putImageData(pixels,0,0);
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
      x.fillStyle = '#e1dfcf'; x.fillRect(0, 0, w, h);
      x.fillStyle = '#dfb64a';
      for (let i = -2; i < 4; i++) { x.beginPath(); x.moveTo(i * 64, 0); x.lineTo(i * 64 + 32, 0); x.lineTo(i * 64 + 32 + 128, 128); x.lineTo(i * 64 + 128, 128); x.fill(); }
      x.fillStyle='rgba(102,99,88,.25)';
      for(let i=0;i<2000;i++)x.fillRect(r()*w,r()*h, .65+r()*2.1, .65+r());
    }),
  };
  TEX.paver.repeat.set(2.55,2.55);
}
function prepareBumps() {
  const D = W.D, C = W.C;
  W.bumps = locateHumps(W.explore, D.bumps, W.roadIndex, C, referenceBumps);
  W.courseBumps = W.bumps.filter(b => b.ci >= 0).map(b => b.ci).sort((a, b) => a - b);
  C.slow = new Uint8Array(C.n);
  for (const ci of W.courseBumps) for (let i = ci - 16; i <= ci + 1; i++) C.slow[mod(i, C.n)] = 1;
  bumpGrid = new Map();
  humpPavement = undefined;
  for (const b of W.bumps) {
    const r = Math.hypot(b.hw+APPROACH,b.length/2+APPROACH);
    for (let ix = Math.floor((b.x - r) / BCELL); ix <= Math.floor((b.x + r) / BCELL); ix++)
      for (let iz = Math.floor((b.z - r) / BCELL); iz <= Math.floor((b.z + r) / BCELL); iz++) {
        const k = ix * 4096 + iz;
        if (!bumpGrid.has(k)) bumpGrid.set(k, []);
        bumpGrid.get(k).push(b);
      }
  }
}
function buildBumps(scene) {
  humpPavement = indexHumpPavement(W.bumps,scene.children);
  // Construct the height samples once. Mesh and collision both use these exact
  // triangles; the smooth profile above supplies the samples, not a second collider.
  for (const b of W.bumps) {
    const na = Math.max(12, Math.ceil(b.length / .18 / 2) * 2), nl = Math.max(8, Math.ceil(b.hw * 2 / .3 / 2) * 2);
    const heights = new Float64Array((na + 1) * (nl + 1));
    for (let ia = 0; ia <= na; ia++) for (let il = 0; il <= nl; il++) {
      const al = -b.length / 2 + ia * b.length / na, la = -b.hw + il * 2 * b.hw / nl;
      const x = b.x + b.dx * al + b.dz * la, z = b.z + b.dz * al - b.dx * la;
      const bed=humpPavement.heightAt(x,z);
      heights[ia * (nl + 1) + il] = (Number.isFinite(bed)?bed:baseSurfaceAt(x,z)) + bumpH(x, z);
    }
    b.surface = { na, nl, heights };
    humpPavement.fitSeams(b);
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
  const m = new THREE.Mesh(g, mat); m.name='Painted speed humps'; m.receiveShadow = true; scene.add(m);
}

// ───────────────────────── buildings ─────────────────────────
const GLASS = new Set(['N1', 'E4', 'N3', 'E16', 'E16-1', 'E9', 'N27', 'N26']);
const REAL = { 'N13-1': [0xc2532c, 1], N3: [0xb4b9c0, 2], E16: [0xcdb894, 2], E11: [0xd3c2a0, 1], ...streetviewPalette };
function buildBuildings(scene) {
  const D = W.D, mb = new MB(true), specialized = buildLandmarks(scene, D, hAt), captured = buildCapturedArchitecture(scene, D, hAt);
  const east = buildCaptureEast(scene, D, W.C, hAt, surfAt), west = buildCaptureWest(scene, D, W.C, hAt, surfAt);
  const labels = [...specialized.labels, ...captured.labels, ...east.labels, ...west.labels];
  const theater=buildOutdoorTheater(scene,D,hAt,MB);
  if(theater)labels.push(theater.label);
  W.capturedEast = east.metadata; W.capturedWest = west.metadata;
  W.capturedArchitecture = captured.metadata;
  const BRICK = [0xa5553c, 0xb0644a, 0x9a5a48, 0xb86a4c], STONE = [0xd6c4a2, 0xcdb994, 0xdccdb0, 0xc9bda8, 0xbfb5a3, 0xd9d2c4],
    APT = [0xe6e2d8, 0xd9d4c8, 0xcfd2d6], MISC = [0xcfc8ba, 0xb9b2a4, 0xa9a59c, 0xc4a58a, 0xb7bcc2];
  const roofC = col(0x8b8f94), roofD = col(0x6f7378), interior=new MB();
  const doorRegions=D.buildings.flatMap(b=>(b.entrances||[]).map(([x,z])=>({x,z,radius:3})));
  const entryPavement=indexPavement(doorRegions,scene.children);
  D.buildings.forEach((b, bi) => {
    lineArcades(interior,b,W.G,hAt,Math.max(...b.p.map(q=>hAt(...q)))+buildingProfile(b).height);
    if(b.ref==='N11'){labels.push(buildKaimaru(scene,b,hAt,MB));return;}
    if(theater?.ids.has(b.id))return;
    if (specialized.handledRefs.has(b.ref) || captured.handledIds.has(b.id) || east.handledIds.has(b.id) || west.handledIds.has(b.id)) return;
    const p = b.p, n = p.length;
    if (n < 3) return;
    let lo = 1e9, hi = -1e9, cx = 0, cz = 0, area = 0;
    for (let i = 0; i < n; i++) {
      const q = p[i], r = p[(i + 1) % n], y = hAt(q[0], q[1]);
      lo = Math.min(lo, y); hi = Math.max(hi, y); cx += q[0] / n; cz += q[1] / n;
      area += q[0] * r[1] - r[0] * q[1];
    }
    // Keep every mapped building. Course clearance is solved before mesh creation.
    const profile = buildingProfile(b), tall = b.lv >= 10;
    let style = GLASS.has(b.ref) ? 2 : profile.residential ? 0 : 1;
    const pal = style === 2 ? [0xaab4bc, 0xc2c6c8] : tall ? APT : profile.residential ? BRICK : b.ref ? STONE : MISC;
    let wc = col(pal[(bi * 7 + n) % pal.length]);
    if (REAL[b.ref]) { wc = col(REAL[b.ref][0]); style = REAL[b.ref][1]; }
    const hh = profile.height, floor = b.t === 'roof' ? Math.max(2.6, b.minHeight || 0) : b.minHeight || 0;
    const base = floor>0 ? (lo + hi)/2 + floor : lo - 1, top = Math.max(base + .28, (lo + hi) / 2 + (b.t === 'roof' && !b.hh ? floor + .30 : hh)), H = top - base, seed = (bi * 0.6180339) % 1;
    const doors=planDoorways(b,W.G,hAt,top,entryPavement.heightAt);
    for(const door of doors)buildVestibule(interior,door);
    const holes=b.holes || [];
    for(const ring of [p,...holes]){
      const sgn=ringSign(ring)*(ring===p?1:-1);
      for(let i=0;i<ring.length;i++){
        const a=ring[i],c=ring[(i+1)%ring.length],dx=c[0]-a[0],dz=c[1]-a[1],len=Math.hypot(dx,dz);
        if(len<.05)continue;
        const nr=[sgn*dz/len,0,-sgn*dx/len],ex=[len,H,style+profile.floorHeight/10,seed];
        const panel=(u,v,y0,y1)=>{
          if(v-u<.00001 || y1<=y0)return;
          mb.quad([a[0]+dx*u,y0,a[1]+dz*u],[a[0]+dx*v,y0,a[1]+dz*v],
            [a[0]+dx*v,y1,a[1]+dz*v],[a[0]+dx*u,y1,a[1]+dz*u],
            nr,[len*u,y0-base],[len*v,y0-base],[len*v,y1-base],[len*u,y1-base],wc,ex);
        };
        const start=ring===p && doors.find(d=>d.vertex===i);
        const end=ring===p && doors.find(d=>d.vertex===(i+1)%ring.length);
        const u=start?start.half/len:0,v=end?1-end.half/len:1;
        panel(u,v,base,top);
        for(const [door,l,r] of [[start,0,u],[end,v,1]])if(door){
          panel(l,r,base,door.threshold);panel(l,r,door.y+door.height,top);
        }
      }
    }
    const roofPoints = [...p,...holes.flat()];
    const tris = THREE.ShapeUtils.triangulateShape(p.map(q => new THREE.Vector2(...q)), holes.map(h=>h.map(q=>new THREE.Vector2(...q)))), rex = [0, 0, -1, seed];
    const roofColor = profile.redRoof ? col(0x974c38) : roofC;
    for (const t of tris) mb.tri([roofPoints[t[0]][0], top, roofPoints[t[0]][1]], [roofPoints[t[1]][0], top, roofPoints[t[1]][1]], [roofPoints[t[2]][0], top, roofPoints[t[2]][1]], UP, [0, 0], [0, 0], [0, 0], roofColor, rex);
    if(floor>0)for(const t of tris){
      const vertices=t.map(i=>[roofPoints[i][0],base,roofPoints[i][1]]);
      mb.tri(...vertices,[0,-1,0],[0,0],[0,0],[0,0],roofD,rex);
    }
    const A = Math.abs(area) / 2;
    if (A > 350) for (let k = 0; k < Math.min(4, 1 + A / 900); k++) { // rooftop plant boxes
      const sx = 2 + rnd() * 4, sz = 2 + rnd() * 4, sh = 1.4 + rnd() * 1.8, ox = cx + (rnd() - .5) * Math.sqrt(A) * .6, oz = cz + (rnd() - .5) * Math.sqrt(A) * .6;
      if (![[-1, -1], [1, -1], [1, 1], [-1, 1]].every(q => {
        const x=ox+q[0]*sx,z=oz+q[1]*sz;
        return inPoly(x,z,p)&&!holes.some(hole=>inPoly(x,z,hole));
      })) continue;
      const c4 = [[ox - sx, oz - sz], [ox + sx, oz - sz], [ox + sx, oz + sz], [ox - sx, oz + sz]];
      for (let i = 0; i < 4; i++) {
        const a = c4[i], c = c4[(i + 1) % 4], dx = c[0] - a[0], dz = c[1] - a[1], len = Math.hypot(dx, dz);
        mb.quad([a[0], top, a[1]], [c[0], top, c[1]], [c[0], top + sh, c[1]], [a[0], top + sh, a[1]], [dz / len, 0, -dx / len], [0, 0], [0, 0], [0, 0], [0, 0], roofD, rex);
      }
      mb.quad([c4[0][0], top + sh, c4[0][1]], [c4[1][0], top + sh, c4[1][1]], [c4[2][0], top + sh, c4[2][1]], [c4[3][0], top + sh, c4[3][1]], UP, [0, 0], [0, 0], [0, 0], [0, 0], roofC, rex);
    }
    if (b.ref) labels.push({ ref: b.ref, name: campusName(b), en: b.en || '', x: cx, y: top + 3, z: cz });
  });
  const mat = patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .86, metalness: 0 }), {
    vHead: 'attribute vec4 aInfo; varying vec4 vInfo; varying vec2 vBuv; varying vec3 vWallNormal;',
    vBody: 'vInfo = aInfo; vBuv = uv; vWallNormal = mat3(modelMatrix) * normal;',
    fHead: 'varying vec4 vInfo; varying vec2 vBuv; varying vec3 vWallNormal; float winMask;' + facadeFinish,
    fColor: `
      winMask = 0.0;
      float style = floor(vInfo.z + 0.001);
      if (style > -0.5) {
        float wallLen = vInfo.x, bh = vInfo.y;
        diffuseColor.rgb = facadeWall(diffuseColor.rgb, vBuv);
        diffuseColor.rgb *= mix(0.80, 1.0, smoothstep(0.0, 5.0, vBuv.y)) * mix(0.94, 1.04, vnoise(vec2(vBuv.x * 0.15 + vInfo.w * 40.0, vBuv.y * 0.6)));
        if (wallLen > 2.4) {
          float nCol = max(1.0, floor(wallLen / (style > 1.5 ? 2.2 : 3.3) + 0.5));
          float cu = vBuv.x / wallLen * nCol, fl = vBuv.y / max(2.5, fract(vInfo.z) * 10.0);
          float fwx = fwidth(cu) * 1.2, fwy = fwidth(fl) * 1.2, fx = fract(cu), fy = fract(fl);
          vec4 e = style < 0.5 ? vec4(0.22, 0.78, 0.34, 0.80) : style < 1.5 ? vec4(0.05, 0.95, 0.38, 0.80) : vec4(0.045, 0.955, 0.10, 0.93);
          float wx = smoothstep(e.x - fwx, e.x + fwx, fx) - smoothstep(e.y - fwx, e.y + fwx, fx);
          float wy = smoothstep(e.z - fwy, e.z + fwy, fy) - smoothstep(e.w - fwy, e.w + fwy, fy);
          float cov = (e.y - e.x) * (e.w - e.z), far = smoothstep(0.25, 0.6, max(fwx, fwy));
          float win = mix(wx * wy, cov, far) * step(vBuv.y, bh - 1.3) * step(1.0, fl + 0.72);
          float hsh = h21(vec2(floor(cu) + vInfo.w * 91.0, floor(fl) + vInfo.w * 53.0));
          vec3 glass = mix(vec3(0.05, 0.09, 0.13), vec3(0.10, 0.20, 0.22), hsh);
          if (style > 1.5) glass = mix(vec3(0.07, 0.17, 0.22), vec3(0.14, 0.30, 0.33), hsh);
          float blind = step(.74, hsh) * smoothstep(.45 + .25 * fract(hsh * 239.), .58 + .25 * fract(hsh * 239.), fy);
          glass = facadeGlass(glass, vWp, vWallNormal);
          glass = mix(glass, vec3(.32,.35,.35), blind * .72 * (1.0 - far));
          float divider = facadeJoint(cu * 2.0, .014) * (1.0 - far);
          float transom = facadeJoint(fl - mix(.68,.73,step(1.5,style)), .013);
          glass = mix(glass, vec3(.075,.095,.099), max(divider,transom) * .85);
          // Sun and shadow sides of the reveal frame the actual window opening.
          float hood = 1.0 - smoothstep(0.0, .065, max(e.w - fy, 0.0));
          float jamb = 1.0 - smoothstep(0.0, .032, max(fx - e.x, 0.0));
          glass *= 1.0 - .33 * max(hood, jamb) * (1.0 - far);
          float sill = wx * (1.0 - smoothstep(.005,.022 + fwy, abs(fy - e.z))) * (1.0 - far);
          diffuseColor.rgb *= 1.0 + .18 * sill;
          diffuseColor.rgb = mix(diffuseColor.rgb, glass, win);
          winMask = win * (1.0 - step(0.83, hsh) * 0.7);
        }
      }`,
    fRough: 'roughnessFactor = mix(roughnessFactor, 0.19, winMask); metalnessFactor = mix(metalnessFactor, 0.22, winMask);',
  });
  const m = new THREE.Mesh(mb.geo(), mat);
  m.name='Campus building envelopes and courtyard walls';
  m.castShadow = true; m.receiveShadow = true;
  scene.add(m);
  const inside=new THREE.Mesh(interior.geo(),new THREE.MeshStandardMaterial({vertexColors:true,roughness:.87}));
  inside.name='Recessed entrances and lined building passages';
  inside.userData.passageLining=true;
  inside.castShadow=true;inside.receiveShadow=true;scene.add(inside);
  for (const l of labels) {
    const name = campusName(D.buildings.find(b => b.ref === l.ref) || l);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex(l.ref, name), transparent: true, depthWrite: false }));
    s.scale.set(13, 3.25, 1); s.position.set(l.x, l.y, l.z);
    (W.buildingLabels ||= []).push(s);
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
  const water = new THREE.MeshStandardMaterial({ color: 0x315c60, roughness: .18, metalness: .28, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const trees = [];
  let pond = null;
  for (const a of D.areas) {
    if (a.p.length < 3) continue;
    if (a.k === 'water') {
      const outline = new THREE.Shape(a.p.map(p => new THREE.Vector2(p[0], -p[1])));
      for (const hole of a.holes || []) outline.holes.push(new THREE.Path(hole.map(p => new THREE.Vector2(p[0], -p[1]))));
      const g = new THREE.ShapeGeometry(outline);
      g.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(g,water);
      m.position.y=W.waterLevels.get(a);m.receiveShadow=true;
      scene.add(m);
      if (/오리|Duck|석림/i.test([a.name,a.nameKo].join(' '))) pond = a;
    }
  }
  const clear = (x, z, r) => !isStreetscapeManaged(x, z, C) && !isCaptureLandscapeManaged(x, z, C) && !isCaptureEastManaged(x,z) && !isCaptureWestManaged(x,z) && surfAt(x, z) === 0 && surfAt(x + r, z) === 0 && surfAt(x - r, z) === 0 && surfAt(x, z + r) === 0 && surfAt(x, z - r) === 0;
  const stems = new Map();
  const cell=(x,z)=>Math.floor(x/6)*8192+Math.floor(z/6);
  const tryTree=(x,z,height,clearance)=>{
    if(!clear(x,z,clearance))return false;
    for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++){
      if((stems.get(cell(x+6*i,z+6*j))||[]).some(t=>Math.hypot(x-t[0],z-t[1])<3.2))return false;
    }
    const k=cell(x,z);if(!stems.has(k))stems.set(k,[]);stems.get(k).push([x,z]);
    trees.push([x,z,height]);return true;
  };
  // Tree tags and rows take precedence over neighbouring satellite crown peaks.
  for(const tree of D.trees || []){const [x,z]=Array.isArray(tree)?tree:[tree.x,tree.z];tryTree(x,z,0,.65);}
  // This frontage has two lines of mature street trees in the May panoramas.
  // Keep the central approach to the N11 stairs between the near-side trunks.
  for(const [x,z,h] of [[-272,-390,8.6],[-262,-391,7.9],[-254,-391,8.1],[-243.2,-391.8,7.3],[-238,-391,8.5],
    [-231,-391,8.4],[-218,-392,7.7],[-269,-376,8.6],[-258,-376,9.6],[-233,-375,9.3]])
    tryTree(x,z,h,.6);
  for(const row of D.treeRows){
    let next=2;
    for(let i=1;i<row.p.length;i++){
      const a=row.p[i-1],b=row.p[i],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);
      for(;next<len;next+=7.5)tryTree(a[0]+dx*next/len,a[1]+dz*next/len,0,.7);
      next-=len;
    }
  }
  for(const [x,z,height] of W.canopy.crowns){
    if(tryTree(x,z,height,.65))continue;
    // A crown can overhang a kerb. Keep any inferred stem on actual greenspace.
    if(surfAt(x,z)!==1 && surfAt(x,z)!==2)continue;
    for(let i=0;i<8;i++){
      const angle=i*Math.PI/4,off=Math.min(3.3,height*.25);
      if(tryTree(x+Math.cos(angle)*off,z+Math.sin(angle)*off,height,.65))break;
    }
  }
  W.canopyTreeCount=trees.length;
  const white = col(0xffffff), leafMaterial=leafSprayMaterial(rng(822));
  const branch = new THREE.CylinderGeometry(.018, .027, .3, 6);
  const trunkG = merged([[new THREE.CylinderGeometry(.014, .029, .56, 8), M4(0, .28, 0), white],
    [branch,M4(.068,.49,0,.70,1,.70,0,0,-.55),white], [branch,M4(-.073,.51,.03,.67,1,.67,.18,0,.6),white],
    [branch,M4(.03,.605,-.08,.55,1,.55,-.48,.1,-.2),white], [branch,M4(.135,.606,.03,.35,.70,.35,.3,0,-.40),white],
    [branch,M4(-.144,.63,.07,.38,.82,.38,.3,0,.42),white]]);
  const trunkM = patch(new THREE.MeshStandardMaterial({color:0x776d5f,roughness:1}),{
    vBody:'vWp=(modelMatrix*instanceMatrix*vec4(transformed,1.)).xyz;',
    fColor:`float barkAxis=vWp.x*.82+vWp.z*.56;
      float bark=vnoise(vec2(barkAxis*23.,vWp.y*3.2))+vnoise(vec2(barkAxis*59.,vWp.y*13.))*.33;
      diffuseColor.rgb*=mix(.73,1.18,smoothstep(.30,.99,bark));`
  });
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color(), e = new THREE.Euler();
  const make = (list, seed) => {
    if (!list.length) return;
    const mesh = new THREE.InstancedMesh(leafyCrown(seed), leafMaterial, list.length);
    const tr = new THREE.InstancedMesh(trunkG, trunkM, list.length);
    const far = new THREE.InstancedMesh(leafyCrown(seed,true), leafMaterial,list.length), instances = [];
    list.forEach(([x, z, observedHeight], i) => {
      const h = observedHeight || (8.5 + rnd() * 5.5), y = hAt(x, z) + liftAt(x, z), wide=.83+rnd()*.38;
      q.setFromEuler(e.set(0, rnd() * 6.28, 0));
      m4.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(h * wide, h, h * wide)); mesh.setMatrixAt(i, m4);
      const treeMatrix = m4.clone();
      m4.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(h * 1.1, h, h * 1.1)); tr.setMatrixAt(i, m4);
      mesh.setColorAt(i, c.setHSL(.273 + (rnd() - .5) * .072, .29+rnd()*.12, .38+rnd()*.13, THREE.SRGBColorSpace));
      far.setMatrixAt(i, treeMatrix); far.setColorAt(i, c); instances.push({ x, z, matrix: treeMatrix, color: c.clone() });
    });
    mesh.castShadow = tr.castShadow = true; mesh.receiveShadow = true;
    mesh.name='Near deciduous tree crowns';tr.name='Mapped tree trunks';far.name='Distant deciduous tree crowns';
    scene.add(mesh, tr);
    // Pack only nearby crowns into the detailed draw.
    mesh.frustumCulled = far.frustumCulled = false; far.receiveShadow = true;
    scene.add(far); (W.treeLods ||= []).push({ near: mesh, far, instances });
  };
  for(let variant=0;variant<3;variant++)make(trees.filter((_,i)=>i%3===variant),1201+variant*754);

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
  const gm = new THREE.InstancedMesh(gooseG, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .8 }), geese.length);
  geese.forEach(([x, z], i) => { const s = .9 + rnd() * .2; m4.compose(new THREE.Vector3(x, hAt(x, z) + liftAt(x, z), z), q.setFromEuler(e.set(0, rnd() * 6.28, 0)), new THREE.Vector3(s, s, s)); gm.setMatrixAt(i, m4); });
  gm.castShadow = true; scene.add(gm);
}

function buildProps(scene) {
  const C = W.C, m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1);
  const poleM = new THREE.MeshStandardMaterial({ color: 0x8d949c, roughness: .5, metalness: .6 });
  // Green and white delineators beside E11 and the E10 bend, seen at driver
  // height. The short runs end before the entrances; bases clear the race lane.
  const green = col(0x18824b), reflective = col(0xdfebe1);
  const coneShape = merged([
    [new THREE.BoxGeometry(.33,.045,.33),M4(0,.023,0),green],
    [new THREE.CylinderGeometry(.075,.128,.23,8),M4(0,.16,0),green],
    [new THREE.CylinderGeometry(.061,.075,.075,8),M4(0,.3125,0),reflective],
    [new THREE.CylinderGeometry(.035,.061,.115,8),M4(0,.4075,0),green]
  ]);
  const coneStations = [66,69,73,97,128,131,135,181,184,187,190];
  const cones = new THREE.InstancedMesh(coneShape,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.82}),coneStations.length);
  coneStations.forEach((i,j)=>{
    const offset = C.halfWidth[i]+.37;
    const x=C.x[i]-C.tz[i]*offset, z=C.z[i]+C.tx[i]*offset;
    const curb=C.side[1][i] && C.side[1][(i+1)%C.n];
    const y=hAt(x,z)+(curb ? ROAD_LIFT+CURB_H : liftAt(x,z));
    cones.setMatrixAt(j,m4.compose(new THREE.Vector3(x,y,z),q.setFromEuler(e.set(0,Math.atan2(C.tx[i],C.tz[i]),0)),one));
  });
  cones.name='Science road curb delineators'; cones.castShadow=true; scene.add(cones);
  // speed-bump warning signs, 30 m ahead of each bump
  const signTex = canvasTex(128, 128, (x) => {
    x.translate(64, 64);
    x.fillStyle = '#c42925'; x.beginPath(); x.moveTo(0, -57); x.lineTo(59, 49); x.lineTo(-59, 49); x.closePath(); x.fill();
    x.fillStyle = '#f4ca35'; x.beginPath(); x.moveTo(0, -39); x.lineTo(44, 40); x.lineTo(-44, 40); x.closePath(); x.fill();
    x.strokeStyle = '#191c1e'; x.lineWidth = 7; x.lineCap = 'round';
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
        vec3 hor = vec3(0.445, 0.617, 0.730), col = mix(hor, vec3(0.035, 0.14, 0.42), pow(h, 0.55));
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
}

export function updateWorld(t, camera) {
  W.updateSceneDistance?.(camera.position);
  if (W.sky) { W.sky.position.copy(camera.position); W.sky.material.uniforms.uTime.value = t; }
  const direction = camera.getWorldDirection(W.treeViewDirection ||= new THREE.Vector3());
  const heading = Math.atan2(direction.x,direction.z);
  const halfFov = Math.atan(Math.tan(camera.fov * Math.PI / 360) * camera.aspect);
  if (!W.treeLodCamera || W.treeLodCamera.distanceToSquared(camera.position) > 144 ||
      Math.cos(heading - W.treeLodHeading) < .992 || Math.abs(halfFov-W.treeLodFov)>.035) {
    (W.treeLodCamera ||= new THREE.Vector3()).copy(camera.position);
    W.treeLodHeading = heading; W.treeLodFov = halfFov;
    const cut = Math.cos(halfFov+.48), vx=Math.sin(heading), vz=Math.cos(heading);
    for (const lod of W.treeLods || []) {
      let near = 0, far = 0;
      for (const tree of lod.instances) {
        const dx=tree.x-camera.position.x,dz=tree.z-camera.position.z,d2=dx*dx+dz*dz;
        // Nearby trees cast visible shadows from behind the camera. Further
        // trees only need the viewing wedge, widened for motion between updates.
        if(d2>90**2 && dx*vx+dz*vz < cut*Math.sqrt(d2))continue;
        const close = d2 < 220 ** 2;
        const mesh = close ? lod.near : lod.far, index = close ? near++ : far++;
        mesh.setMatrixAt(index, tree.matrix); mesh.setColorAt(index, tree.color);
      }
      lod.near.count = near; lod.far.count = far;
      for (const mesh of [lod.near, lod.far]) { mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true; }
    }
  }
  for (const s of W.buildingLabels || []) {
    const distance = s.position.distanceTo(camera.position);
    s.material.opacity = clamp((260 - distance) / 110, 0, .92);
    s.visible = distance < 260;
  }
}

// Many photo-authored facades have their own glass, trim and floor meshes.
// Clip the same narrow arcade out of every building material and its shadow.
function applyArcadeOpenings(objects) {
  const G=W.G, texture=new THREE.DataTexture(G.portals,G.w,G.h,THREE.RedFormat);
  texture.magFilter=texture.minFilter=THREE.NearestFilter;
  texture.unpackAlignment=1;texture.needsUpdate=true;
  const bounds=new THREE.Vector4(G.x0,G.z0,G.w,G.h), seen=new Set();
  const clip=material=>{
    if(seen.has(material))return;
    seen.add(material);
    const before=material.onBeforeCompile, previousKey=material.customProgramCacheKey();
    material.customProgramCacheKey=()=>previousKey+' campus passage';
    material.onBeforeCompile=function(shader,renderer){
      before.call(this,shader,renderer);
      shader.uniforms.passageMap={value:texture};
      shader.uniforms.passageBounds={value:bounds};
      shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vPassageWorld;')
        .replace('#include <project_vertex>',`#include <project_vertex>
          vec4 passageLocal=vec4(transformed,1.0);
          #ifdef USE_INSTANCING
          passageLocal=instanceMatrix*passageLocal;
          #endif
          vPassageWorld=(modelMatrix*passageLocal).xyz;`);
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform sampler2D passageMap; uniform vec4 passageBounds; varying vec3 vPassageWorld;')
        .replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
          vec2 passageUV=(vPassageWorld.xz-passageBounds.xy)/passageBounds.zw;
          float clearance=texture2D(passageMap,passageUV).r*255.0-48.0;
          if(clearance>-47.5 && vPassageWorld.y<clearance && all(greaterThanEqual(passageUV,vec2(0.0))) && all(lessThan(passageUV,vec2(1.0)))) discard;`);
    };
    material.needsUpdate=true;
  };
  const depth=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking});
  clip(depth);
  for(const root of objects)root.traverse(m=>{
    if(!m.isMesh || m.userData.passageLining)return;
    for(const material of Array.isArray(m.material)?m.material:[m.material])clip(material);
    if(m.castShadow)m.customDepthMaterial=depth;
  });
}
function cleanRing(p) {
  const a = p[0], b = p.at(-1);
  return p.length>3 && a[0] === b[0] && a[1] === b[1] ? p.slice(0,-1) : p;
}
function polygonBounds(p) {
  let x0=Infinity,z0=Infinity,x1=-Infinity,z1=-Infinity;
  for(const [x,z] of p){ x0=Math.min(x,x0); z0=Math.min(z,z0); x1=Math.max(x,x1); z1=Math.max(z,z1); }
  return {x0,x1,z0,z1};
}
export function initializeMapData(campus,network,terrain=campus.terrain) {
  // Reconstruct the photo registration from its original calibrated references
  // before adding any new buildings. It positions observed scenery, never roads.
  W.D=campus;
  W.explore=network;
  buildCourse();
  const prior=new Map(campus.buildings.map(b=>[b.id,b]));
  const buildings=network.buildings.map(b=>{
    const old=prior.get(b.id) || {};
    return {...old,...b,p:cleanRing(b.p),holes:(b.holes || []).map(cleanRing),lv:b.levels||old.lv||0,hh:b.h||old.hh||0,
      en:b.en||old.en||'',ref:b.ref||old.ref||'',name:b.name||old.name||''};
  });
  const areas=network.areas.flatMap(a=>[
    {...a,k:a.t,p:cleanRing(a.p),holes:(a.holes || []).map(cleanRing)},
    ...(a.aprons || []).map((ring,i)=>({id:a.id+'-apron-'+i,k:'parking',t:'parking',p:cleanRing(ring),holes:[],
      drivable:a.drivable,motorAccess:'adjacent_parking_bays',apronOnly:true}))
  ]);
  W.D={...campus,terrain,...{bounds:network.bounds,roads:network.roads,buildings,areas,trees:network.trees || [],
    barriers:network.barriers || [],crossings:network.crossings || [],treeRows:network.treeRows || [],
    parking:areas.filter(a=>a.k==='parking')}};
  W.roadIndex=prepareRoads(network.roads);
  const bridgeLevels=[];
  for (const [road,way] of W.roadIndex.ways) {
    if (!road.bridge) continue;
    const start=hAt(...road.p[0]), end=hAt(...road.p.at(-1));
    // The coarse terrain model measures nearby banks. Keep the estimated high
    // water line below each mapped deck and preserve its gentle approach grade.
    const clearance=road.drivable?1.3:.85;
    for (const segment of way.segments) {
      const samples=Math.max(1,Math.ceil(segment.span/2));
      for (let i=0;i<=samples;i++) {
        const along=segment.span*i/samples;
        bridgeLevels.push([segment.a[0]+segment.dx*along,segment.a[1]+segment.dz*along,
          start+(end-start)*(segment.start+along)/way.length-clearance]);
      }
    }
  }
  W.waterLevels=new Map(areas.filter(a=>a.k==='water').map(a=>{
    const shore=a.p.map(p=>hAt(p[0],p[1])).sort((a,b)=>a-b);
    let level=shore[Math.floor(shore.length/2)]+.05;
    for (const [x,z,limit] of bridgeLevels) if (limit<level && inPoly(x,z,a.p) && !a.holes.some(hole=>inPoly(x,z,hole))) level=limit;
    return [a,level];
  }));
  for(const [r,way] of W.roadIndex.ways)if(r.ford){
    const water=[...W.waterLevels].find(([a])=>r.p.some(([x,z])=>inPoly(x,z,a.p) && !a.holes.some(p=>inPoly(x,z,p))));
    if(water)way.fordLevel=water[1]+.18;
  }
  W.G=prepareSurfaceGrid(W.D,W.roadIndex,hAt);
  prepareBumps();
  W.access=createDrivingAccess(W.D,network,W.roadIndex,W.G,mappedRoadBoundaries);
  const C=W.C;
  C.side=[new Uint8Array(C.n),new Uint8Array(C.n)];
  for(let i=0;i<C.n;i++)for(let s=0;s<2;s++){
    const off=(C.halfWidth[i]+1.4)*(s?-1:1);
    C.side[s][i]=surfAt(C.x[i]+C.tz[i]*off,C.z[i]-C.tx[i]*off)===0 ? 1 : 0;
  }
  return W;
}

export async function loadWorld(scene, renderer, progress) {
  const step = async (msg, fn) => { progress(msg); await new Promise(r => setTimeout(r, 0)); fn(); };
  progress('Loading the Daejeon campus');
  const download=async name=>{
    const response=await fetch(new URL('../data/'+name,import.meta.url));
    if(!response.ok)throw Error('Campus map unavailable ('+response.status+')');
    return response.json();
  };
  const [campus,network,terrain,canopy]=await Promise.all([download('campus.json'),download('explore-map.json?v=pond-entrances-1'),download('terrain-approaches.json'),download('canopy.json')]);
  W.canopy=canopy;
  W.scene=scene;
  await step('Opening campus roads and paths',()=>{initializeMapData(campus,network,terrain);makeTextures();});
  await step('Painting the sky', () => buildSky(scene, renderer));
  await step('Shaping the hills and ponds', () => buildTerrain(scene));
  await step('Paving campus streets', () => {
    buildExploreGrounds(scene,W.D,hAt,MB,flat,TEX);
    buildExploreRoads(scene,W,hAt,TEX,MB,flat,referenceRoadStyles);
    W.accessScenery=buildAccessEdges(scene,W,baseSurfaceAt,MB,flat,hAt);
  });
  await step('Raising campus buildings', () => {
    const start=scene.children.length;
    buildBuildings(scene);
    finishLandmarkMaterials(scene.children.slice(start));
    buildStreetviewDetails(scene,W.D,hAt,surfAt);
    applyArcadeOpenings(scene.children.slice(start));
  });
  await step('Planting streets and gardens', () => {
    const parkingSurface=(x,z)=>{
      const k=(Math.floor(z)-W.G.z0)*W.G.w+Math.floor(x)-W.G.x0;
      return W.G.mappedLane[k] ? 3 : surfAt(x,z);
    };
    buildParking(scene,W.D,hAt,parkingSurface,TEX);
    buildBumps(scene);
    buildGate(scene,W.D,hAt); buildNature(scene);
    buildKaimaruGarden(scene,hAt,surfAt,rng(702));
    buildStreetscape(scene,W.D,W.C,hAt,surfAt);
    W.capturedLandscape=buildCapturedLandscape(scene,W.D,W.C,hAt,surfAt).metadata;
    W.capturedRoadside=buildCapturedRoadside(scene,W.D,W.C,hAt,surfAt).metadata;
    buildProps(scene);
    buildStreetFixtures(scene,W,baseSurfaceAt,hAt,MB,flat);
    partitionCampusBatches(scene,W.treeLods || []);
    W.updateSceneDistance=trackSceneryDistance(scene);
  });
}
