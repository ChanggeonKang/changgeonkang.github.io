// OSM parking polygons, with illustrative stalls and parked cars. Individual
// spaces, occupancy, colours and vehicle positions are NOT surveyed references.
// No downloaded images or additional collision geometry are used here.
import * as THREE from '../lib/three.module.min.js';

const WIDTH = 2.6, DEPTH = 5, AISLE = 6, CAR_CAP = 120;
const ASPHALT_LIFT = .207, PAINT_LIFT = .218;
const mix = (a, b, t) => a + (b - a) * t;
const midpoint = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
function inside(a, p) {
  let hit = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const b = p[i], c = p[j];
    if ((b[1] > a[1]) !== (c[1] > a[1]) && a[0] < (c[0] - b[0]) * (a[1] - b[1]) / (c[1] - b[1]) + b[0]) hit = !hit;
  }
  return hit;
}
function area(p) { return Math.abs(p.reduce((s, a, i) => { const b = p[(i + 1) % p.length]; return s + a[0] * b[1] - b[0] * a[1]; }, 0)) / 2; }
function clip(p, axis, bound, keepGreater) {
  const q = [], distance = a => (a[axis] - bound) * (keepGreater ? 1 : -1);
  p.forEach((a, i) => {
    const b = p[(i + 1) % p.length], da = distance(a), db = distance(b);
    if (da >= 0) q.push(a);
    if ((da >= 0) !== (db >= 0)) { const t = da / (da - db); q.push([mix(a[0], b[0], t), mix(a[1], b[1], t)]); }
  });
  return q;
}
// surfAt is the world's one-metre raster. For every non-parking cell in the
// bounds, check polygon/cell intersection. A road cannot slip between samples.
function surfaceClear(p, surfAt) {
  const xs = p.map(a => a[0]), zs = p.map(a => a[1]);
  for (let z = Math.floor(Math.min(...zs)); z <= Math.floor(Math.max(...zs)); z++) for (let x = Math.floor(Math.min(...xs)); x <= Math.floor(Math.max(...xs)); x++) {
    if (surfAt(x + .5, z + .5) === 2) continue;
    let q = clip(p, 0, x, true); q = clip(q, 0, x + 1, false); q = clip(q, 1, z, true); q = clip(q, 1, z + 1, false);
    if (q.length >= 3 && area(q) > 1e-7) return false;
  }
  return true;
}
function surfaceContainsParking(p, surfAt) {
  const xs=p.map(a=>a[0]),zs=p.map(a=>a[1]);
  for(let z=Math.floor(Math.min(...zs));z<=Math.floor(Math.max(...zs));z++)for(let x=Math.floor(Math.min(...xs));x<=Math.floor(Math.max(...xs));x++){
    if(surfAt(x+.5,z+.5)!==2)continue;
    let q=clip(p,0,x,true);q=clip(q,0,x+1,false);q=clip(q,1,z,true);q=clip(q,1,z+1,false);
    if(q.length>=3&&area(q)>1e-7)return true;
  }
  return false;
}
function rectangleInside(q, p) {
  if (!q.every(a => inside(a, p))) return false;
  for (let i = 0; i < q.length; i++) for (let j = 0; j < p.length; j++) {
    const a = q[i], b = q[(i + 1) % q.length], c = p[j], d = p[(j + 1) % p.length];
    if (cross(a, b, c) * cross(a, b, d) < -1e-10 && cross(c, d, a) * cross(c, d, b) < -1e-10) return false;
  }
  return true;
}
function random(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
function hash(text) { let h = 2166136261; for (const c of String(text)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }

class GroundBatch {
  constructor() { this.positions = []; this.normals = []; this.uv = []; }
  triangle(a, b, c, hAt, lift) {
    // Collinear OSM boundary nodes can become vertical slivers after height
    // sampling. They have no paved area and must not become render triangles.
    if (Math.abs(cross(a,b,c)) < 1e-5) return;
    let q = [a, b, c].map(p => new THREE.Vector3(p[0], hAt(p[0], p[1]) + lift, p[1]));
    if (!q.every(p => Number.isFinite(p.y))) return;
    let n = q[1].clone().sub(q[0]).cross(q[2].clone().sub(q[0]));
    if (n.lengthSq() < 1e-10) return;
    if (n.y < 0) { [q[1], q[2]] = [q[2], q[1]]; n.negate(); }
    n.normalize();
    for (const v of q) { this.positions.push(v.x, v.y, v.z); this.normals.push(n.x, n.y, n.z); this.uv.push(v.x / 5, v.z / 5); }
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.computeBoundingBox(); g.computeBoundingSphere(); return g;
  }
}
function paveTriangle(batch, q, hAt, surfAt, depth = 0) {
  if (Math.abs(cross(...q)) < 1e-5) return;
  const lengths = q.map((a, i) => { const b = q[(i + 1) % 3]; return Math.hypot(a[0] - b[0], a[1] - b[1]); });
  const longest = Math.max(...lengths);
  if (longest <= 8) {
    if (surfaceClear(q, surfAt)) { batch.triangle(...q, hAt, ASPHALT_LIFT); return; }
    if (!surfaceContainsParking(q, surfAt)) return;
  }
  if (longest <= .65 || depth > 24) return;
  const edge = lengths.indexOf(longest), a = q[edge], b = q[(edge + 1) % 3], c = q[(edge + 2) % 3], m = midpoint(a, b);
  paveTriangle(batch, [a, m, c], hAt, surfAt, depth + 1); paveTriangle(batch, [m, b, c], hAt, surfAt, depth + 1);
}
function stripe(batch, a, b, hAt, width = .11) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < .1) return;
  const dx = (b[1] - a[1]) / L * width / 2, dz = -(b[0] - a[0]) / L * width / 2, n = Math.ceil(L / 2);
  for (let i = 0; i < n; i++) {
    const p = [mix(a[0], b[0], i / n), mix(a[1], b[1], i / n)], q = [mix(a[0], b[0], (i + 1) / n), mix(a[1], b[1], (i + 1) / n)];
    const v = [[p[0] + dx, p[1] + dz], [q[0] + dx, q[1] + dz], [q[0] - dx, q[1] - dz], [p[0] - dx, p[1] - dz]];
    batch.triangle(v[0], v[1], v[2], hAt, PAINT_LIFT); batch.triangle(v[0], v[2], v[3], hAt, PAINT_LIFT);
  }
}
function axes(p) {
  let best = 0, u = [1, 0];
  p.forEach((a, i) => { const b = p[(i + 1) % p.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L > best) { best = L; u = [(b[0] - a[0]) / L, (b[1] - a[1]) / L]; } });
  const v = [-u[1], u[0]], pu = p.map(a => a[0] * u[0] + a[1] * u[1]), pv = p.map(a => a[0] * v[0] + a[1] * v[1]);
  return { u, v, minU: Math.min(...pu), maxU: Math.max(...pu), minV: Math.min(...pv), maxV: Math.max(...pv) };
}
function merged(parts) {
  const positions = [], normals = [], colours = [];
  for (const [g0, matrix, colour] of parts) {
    const g = g0.index ? g0.toNonIndexed() : g0, P = g.attributes.position, N = g.attributes.normal, normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix), v = new THREE.Vector3(), color = new THREE.Color(colour);
    for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i).applyMatrix4(matrix); positions.push(...v.toArray()); v.fromBufferAttribute(N, i).applyMatrix3(normalMatrix).normalize(); normals.push(...v.toArray()); colours.push(color.r, color.g, color.b); }
    if (g !== g0) g.dispose(); g0.dispose();
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3)); g.computeBoundingSphere(); return g;
}
function box(w, h, l, x, y, z, colour = 0xffffff) { return [new THREE.BoxGeometry(w, h, l), new THREE.Matrix4().makeTranslation(x, y, z), colour]; }
function canopy() {
  const p = [[-.79,1.01,-1.23],[.79,1.01,-1.23],[.79,1.01,1.2],[-.79,1.01,1.2],[-.66,1.62,-.83],[.66,1.62,-.83],[.66,1.62,.58],[-.66,1.62,.58]];
  const triangles = [[0,1,5],[0,5,4],[1,2,6],[1,6,5],[2,3,7],[2,7,6],[3,0,4],[3,4,7],[4,5,6],[4,6,7]];
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(triangles.flatMap(t => [...t].reverse().flatMap(i => p[i])), 3)); g.computeVertexNormals(); return g;
}
function cars(scene, placements, hAt) {
  if (!placements.length) return [];
  const bodyGeo = merged([box(1.8,.57,4.28,0,.72,0),box(1.34,.11,1.48,0,1.65,-.12),box(.09,.55,.1,-.76,1.3,-.08),box(.09,.55,.1,.76,1.3,-.08)]);
  const trimGeo = merged([box(1.64,.13,.08,0,.5,2.15,0x596268),box(1.64,.13,.08,0,.5,-2.15,0x596268),box(.44,.14,.055,-.57,.84,2.16,0xdce4d8),box(.44,.14,.055,.57,.84,2.16,0xdce4d8),box(.4,.12,.055,-.57,.84,-2.16,0x824a48),box(.4,.12,.055,.57,.84,-2.16,0x824a48)]);
  const body = new THREE.InstancedMesh(bodyGeo, new THREE.MeshStandardMaterial({vertexColors:true,roughness:.36,metalness:.32}), placements.length);
  const glass = new THREE.InstancedMesh(canopy(), new THREE.MeshStandardMaterial({color:0x344a54,roughness:.18,metalness:.55}), placements.length);
  const trim = new THREE.InstancedMesh(trimGeo, new THREE.MeshStandardMaterial({vertexColors:true,roughness:.48,metalness:.35}), placements.length);
  const wheelGeo = new THREE.CylinderGeometry(.32,.32,.2,10); wheelGeo.rotateZ(Math.PI / 2);
  const wheels = new THREE.InstancedMesh(wheelGeo, new THREE.MeshStandardMaterial({color:0x222729,roughness:.92}), placements.length * 4);
  const palette = [0xd3d5d3,0xb8bfc1,0x6e7c87,0x354651,0x737879,0xe6e4dc,0x495b63,0x7b5550];
  placements.forEach((a, i) => {
    const sign = a.facing, u = a.u.map(v => v * sign), v = a.v.map(n => n * sign), x = a.x, z = a.z;
    const du = (hAt(x + u[0], z + u[1]) - hAt(x - u[0], z - u[1])) / 2, dv = (hAt(x + v[0], z + v[1]) - hAt(x - v[0], z - v[1])) / 2;
    const right = new THREE.Vector3(u[0],du,u[1]).normalize(), forward0 = new THREE.Vector3(v[0],dv,v[1]).normalize(), up = forward0.clone().cross(right).normalize(), forward = right.clone().cross(up).normalize();
    const matrix = new THREE.Matrix4().makeBasis(right,up,forward); matrix.setPosition(x,hAt(x,z)+ASPHALT_LIFT,z);
    body.setMatrixAt(i,matrix); glass.setMatrixAt(i,matrix); trim.setMatrixAt(i,matrix); body.setColorAt(i,new THREE.Color(palette[a.colour % palette.length]));
    for (let k = 0; k < 4; k++) wheels.setMatrixAt(i * 4 + k, matrix.clone().multiply(new THREE.Matrix4().makeTranslation(k % 2 ? .87 : -.87,.32,k < 2 ? -1.39 : 1.39)));
    a.matrix = matrix.toArray();
  });
  [body,glass,trim,wheels].forEach((m,i)=>{m.name=['parking-car-bodies','parking-car-glass','parking-car-trim','parking-car-wheels'][i];m.instanceMatrix.needsUpdate=true;if(m.instanceColor)m.instanceColor.needsUpdate=true;m.computeBoundingSphere();m.castShadow=true;m.receiveShadow=true;scene.add(m);});
  return [body,glass,trim,wheels];
}
function vehiclesOverlap(a,b) {
  const d=[b.x-a.x,b.z-a.z];
  for(const axis of [a.u,a.v,b.u,b.v]){
    const dot=(u,v)=>u[0]*v[0]+u[1]*v[1], extent=1.08*(Math.abs(dot(a.u,axis))+Math.abs(dot(b.u,axis)))+2.3*(Math.abs(dot(a.v,axis))+Math.abs(dot(b.v,axis)));
    if(Math.abs(dot(d,axis))>extent)return false;
  }
  return true;
}

/** Returns render meshes and approximation metadata; creates no collision objects. */
export function buildParking(scene, D, hAt, surfAt, TEX = {}) {
  const asphalt = new GroundBatch(), paint = new GroundBatch(), lots = [], stalls = [], candidates = [], models = [];
  for (const lot of D?.parking || []) {
    if (!Array.isArray(lot.p) || lot.p.length < 3 || lot.p.some(a=>!Array.isArray(a)||a.length<2||!a.every(Number.isFinite))) continue;
    const p = lot.p.filter((a,i)=>Array.isArray(a)&&a.length>=2&&a.every(Number.isFinite)&&(i===0||Math.hypot(a[0]-lot.p[i-1][0],a[1]-lot.p[i-1][1])>.01)).map(a=>a.slice(0,2));
    if(p.length>3&&Math.hypot(p[0][0]-p.at(-1)[0],p[0][1]-p.at(-1)[1])<.01)p.pop();
    if(p.length<3||area(p)<12)continue;
    const groundStart=asphalt.positions.length/3, paintStart=paint.positions.length/3;
    for (const triangle of THREE.ShapeUtils.triangulateShape(p.map(a=>new THREE.Vector2(...a)),[])) paveTriangle(asphalt,triangle.map(i=>p[i]),hAt,surfAt);
    const A = axes(p), rand = random(hash(lot.id)), point = (u,v) => [A.u[0]*u+A.v[0]*v,A.u[1]*u+A.v[1]*v], lineKeys = new Set();
    const line = (a,b) => {const key=[a,b].map(p=>p.map(v=>v.toFixed(3)).join(',')).sort().join('|');if(!lineKeys.has(key)){lineKeys.add(key);stripe(paint,a,b,hAt);}};
    const record = {id:lot.id,name:lot.name||'',source:lot.source||'OpenStreetMap parking polygon',polygon:p,stalls:0,illustrativeCars:0,groundVertexStart:groundStart,groundVertexCount:asphalt.positions.length/3-groundStart,paintVertexStart:paintStart}; lots.push(record);
    for(let row=0;row<200;row++){
      const centerV=A.minV+.8+DEPTH/2+Math.floor(row/2)*(DEPTH*2+AISLE)+(row%2?(DEPTH+AISLE):0);
      if(centerV+DEPTH/2+.15>A.maxV)break;
      for(let col=0;col<1000;col++){
        const centerU=A.minU+.8+WIDTH/2+col*WIDTH+Math.floor(col/10)*6.2;
        if(centerU+WIDTH/2+.15>A.maxU)break;
        // Reserve paint's full width and terrain-tilted vehicle margin inside
        // the source polygon, and reject any overlap with non-parking cells.
        const q=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([u,v])=>point(centerU+u*(WIDTH/2+.09),centerV+v*(DEPTH/2+.09)));
        if(!rectangleInside(q,p)||!surfaceClear(q,surfAt))continue;
        const inner=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([u,v])=>point(centerU+u*WIDTH/2,centerV+v*(DEPTH/2-.06)));
        line(inner[0],inner[3]);line(inner[1],inner[2]);line(row%2?inner[2]:inner[0],row%2?inner[3]:inner[1]);
        const center=point(centerU,centerV), s={lotId:lot.id,x:center[0],z:center[1],u:A.u,v:A.v,facing:row%2?1:-1,corners:q};stalls.push(s);record.stalls++;
        const slope=Math.max(Math.abs(hAt(s.x+1,s.z)-hAt(s.x-1,s.z)),Math.abs(hAt(s.x,s.z+1)-hAt(s.x,s.z-1)))/2;
        const choice=rand();if(choice<.48&&Number.isFinite(slope)&&slope<.12)candidates.push({...s,colour:Math.floor(rand()*8),priority:rand(),record});
      }
    }
    record.paintVertexCount=paint.positions.length/3-paintStart;
  }
  for(const [batch,name,material] of [[asphalt,'campus-parking-asphalt',new THREE.MeshStandardMaterial({color:0x747b80,map:TEX?.asphalt||null,roughness:.94,polygonOffset:true,polygonOffsetFactor:-2.5,polygonOffsetUnits:-2.5})],[paint,'campus-parking-markings',new THREE.MeshStandardMaterial({color:0xd8d9d1,roughness:.88,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4})]]){
    if(!batch.positions.length){material.dispose();continue;}const mesh=new THREE.Mesh(batch.geometry(),material);mesh.name=name;mesh.receiveShadow=true;scene.add(mesh);models.push(mesh);
  }
  const placements=[];
  for(const a of candidates.sort((a,b)=>a.priority-b.priority)){
    if(placements.some(b=>Math.hypot(a.x-b.x,a.z-b.z)<6&&vehiclesOverlap(a,b)))continue;
    placements.push(a);if(placements.length===CAR_CAP)break;
  }
  placements.forEach(a=>{a.record.illustrativeCars++;delete a.record;});models.push(...cars(scene,placements,hAt));
  const metadata={source:'OSM parking polygons; stalls and vehicles are illustrative estimates',stallWidthM:WIDTH,stallDepthM:DEPTH,aisleWidthM:AISLE,carCap:CAR_CAP,parkingLots:lots.length,stalls:stalls.length,cars:placements.length,drawCalls:models.length,collisionAdded:false};
  models.forEach(m=>{m.userData.parking=metadata;});
  return {models,lots,stalls,cars:placements,metadata};
}
