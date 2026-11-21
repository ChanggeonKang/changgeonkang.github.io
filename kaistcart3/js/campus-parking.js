// Mapped parking polygons use surveyed bay rows where a street/overhead view
// resolves their layout. Occupancy, colours and unsurveyed bays are estimates.
// Campus Drive uses the rendered placements to keep the occupied bays solid.
import * as THREE from '../lib/three.module.min.js';
import { isCaptureWestParkingOverride } from './capture-extension-west.js';
import { makeParkedCar, varyRoof } from './parked-car-model.js';
import { administrationPaving } from './administration-court.js';
import { trimParkingApproaches } from './parking-approaches.js';

const WIDTH = 2.6, DEPTH = 5, AISLE = 6, CAR_CAP = 380;
const ASPHALT_LIFT = .186, PAINT_LIFT = .214;
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
    if (surfAt(x + .5, z + .5) === 2 && !isCaptureWestParkingOverride(x + .5,z + .5)) continue;
    let q = clip(p, 0, x, true); q = clip(q, 0, x + 1, false); q = clip(q, 1, z, true); q = clip(q, 1, z + 1, false);
    if (q.length >= 3 && area(q) > 1e-7) return false;
  }
  return true;
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

function observedRows(lot,record,line,rand,stalls,candidates){
  for(const row of lot.surveyRows){
    const [ax,az]=row.first,[bx,bz]=row.last,length=Math.hypot(bx-ax,bz-az);
    const u=[(bx-ax)/length,(bz-az)/length],v=[-u[1],u[0]],pitch=length/(row.count-1);
    for(let i=0;i<row.count;i++){
      const x=ax+u[0]*pitch*i,z=az+u[1]*pitch*i;
      const q=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([a,b])=>
        [x+a*u[0]*pitch/2+b*v[0]*2.42,z+a*u[1]*pitch/2+b*v[1]*2.42]);
      const kind=row.kindByBay?.[i]||row.kind;
      if(kind==='normal'){
        line(q[0],q[3]);line(q[1],q[2]);
        if(row.facing===1||row.bothEndLines)line(q[0],q[1]);
        if(row.facing!==1||row.bothEndLines)line(q[2],q[3]);
      }
      const bay={lotId:lot.id,x,z,u,v,facing:row.facing,corners:q,kind,observed:true};
      stalls.push(bay);record.stalls++;
      // The two short drop-off spurs in front of W3 reach the edge of these
      // bays in the OSM network. Leave both manoeuvring areas and blue bays open.
      if(row.clear || kind==='accessible' || rand()>(row.occupancy??.70))continue;
      candidates.push({...bay,colour:Math.floor(rand()*8),priority:rand()-1.0,record});
    }
  }
}

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
function paveTriangle(batch,q,hAt) {
  if(Math.abs(cross(...q))<1e-5)return;
  const lengths=q.map((a,i)=>Math.hypot(a[0]-q[(i+1)%3][0],a[1]-q[(i+1)%3][1]));
  const longest=Math.max(...lengths);
  if(longest<=3.5){
    const x=(q[0][0]+q[1][0]+q[2][0])/3,z=(q[0][1]+q[1][1]+q[2][1])/3;
    if(!isCaptureWestParkingOverride(x,z))batch.triangle(...q,hAt,ASPHALT_LIFT);
    return;
  }
  const i=lengths.indexOf(longest),a=q[i],b=q[(i+1)%3],c=q[(i+2)%3],m=midpoint(a,b);
  paveTriangle(batch,[a,m,c],hAt);paveTriangle(batch,[m,b,c],hAt);
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
export function addParkedCars(scene, placements, hAt) {
  if (!placements.length) return [];
  const model=makeParkedCar(),paint=(roughness,metalness)=>varyRoof(new THREE.MeshStandardMaterial({vertexColors:true,roughness,metalness}));
  const body=new THREE.InstancedMesh(model.body,paint(.32,.32),placements.length);
  const glass=new THREE.InstancedMesh(model.glass,paint(.19,.42),placements.length);
  const trim=new THREE.InstancedMesh(model.trim,paint(.48,.28),placements.length);
  const depth=varyRoof(new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking}),'shadow');
  for(const mesh of [body,glass,trim])mesh.customDepthMaterial=depth;
  const tyre=new THREE.CylinderGeometry(.32,.32,.194,16).rotateZ(Math.PI/2);
  const hub=new THREE.CylinderGeometry(.215,.215,.197,16).rotateZ(Math.PI/2);
  const wheelParts=[[tyre,new THREE.Matrix4(),0x25282a],[hub,new THREE.Matrix4(),0x596268]];
  for(let i=0;i<5;i++){
    const spoke=new THREE.BoxGeometry(.202,.33,.042),m=new THREE.Matrix4().makeRotationX(i*Math.PI/5);
    wheelParts.push([spoke,m,0x929a9b]);
  }
  const wheels=new THREE.InstancedMesh(merged(wheelParts),new THREE.MeshStandardMaterial({vertexColors:true,roughness:.77}),placements.length*4);
  const palette=[0xe5e7e5,0xc4c7c8,0x63727f,0x343e44,0x818587,0xf3f1e9,0x596269,0x70494b];
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

/** Seat the parked wheels on the displayed surface, including changes of
 * crossfall between the front and rear axles of an individual parking space. */
export function fitParkedVehicles(parking,ground){
  if(!parking.cars.length)return;
  const [body,glass,trim,wheels]=parking.models.slice(-4);
  const attr=wheels.geometry.getAttribute('position'),rimPoints=[],seen=new Set();
  for(let i=0;i<attr.count;i++){
    const p=new THREE.Vector3().fromBufferAttribute(attr,i);
    // The bottom half supports the vehicle. Ignore duplicated side/cap vertices.
    const id=p.toArray().map(x=>x.toFixed(4)).join(',');
    if(p.y>0 || seen.has(id))continue;
    seen.add(id);rimPoints.push(p);
  }
  const wheelOffsets=[[-.87,-1.39],[.87,-1.39],[-.87,1.39],[.87,1.39]];
  const sample=new THREE.Vector3();
  parking.cars.forEach((car,i)=>{
    const [ux,uz]=car.u.map(k=>k*car.facing),[vx,vz]=car.v.map(k=>k*car.facing);
    const h=wheelOffsets.map(([u,v])=>ground(car.x+u*ux+v*vx,car.z+u*uz+v*vz));
    if(!h.every(Number.isFinite))return;
    const du=(h[1]+h[3]-h[0]-h[2])/(4*.87),dv=(h[2]+h[3]-h[0]-h[1])/(4*1.39);
    const right=new THREE.Vector3(ux,du,uz).normalize();
    const up=new THREE.Vector3(vx,dv,vz).cross(right).normalize(),fwd=right.clone().cross(up).normalize();
    const basis=new THREE.Matrix4().makeBasis(right,up,fwd).setPosition(car.x,h.reduce((a,b)=>a+b,0)*.25,car.z);
    for(const mesh of [body,glass,trim])mesh.setMatrixAt(i,basis);
    car.matrix=basis.toArray();
    wheelOffsets.forEach(([u,v],k)=>{
      const wheel=basis.clone().multiply(new THREE.Matrix4().makeTranslation(u,.32,v));
      let lift=-Infinity;
      for(const local of rimPoints){
        sample.copy(local).applyMatrix4(wheel);
        const surface=ground(sample.x,sample.z);
        if(Number.isFinite(surface))lift=Math.max(lift,surface-sample.y);
      }
      if(Number.isFinite(lift))wheel.elements[13]+=lift;
      wheels.setMatrixAt(i*4+k,wheel);
    });
  });
  for(const mesh of [body,glass,trim,wheels]){mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();}
}

/** Returns render meshes and approximation metadata; creates no collision objects. */
export function buildParking(scene, D, hAt, surfAt, TEX = {}) {
  const asphalt = new GroundBatch(), paint = new GroundBatch(), lots = [], stalls = [], candidates = [], models = [];
  const blockRanges=[];
  for (const lot of D?.parking || []) {
    if(lot.id==='sejong-turning-court')continue; // The driveway supplies the continuous block-paved surface.
    if (!Array.isArray(lot.p) || lot.p.length < 3 || lot.p.some(a=>!Array.isArray(a)||a.length<2||!a.every(Number.isFinite))) continue;
    const p = lot.p.filter((a,i)=>Array.isArray(a)&&a.length>=2&&a.every(Number.isFinite)&&(i===0||Math.hypot(a[0]-lot.p[i-1][0],a[1]-lot.p[i-1][1])>.01)).map(a=>a.slice(0,2));
    if(p.length>3&&Math.hypot(p[0][0]-p.at(-1)[0],p[0][1]-p.at(-1)[1])<.01)p.pop();
    if(p.length<3 || area(p)<.01)continue;
    const groundStart=asphalt.positions.length/3, paintStart=paint.positions.length/3;
    const holes=lot.holes || [], points=[...p,...holes.flat()];
    for (const triangle of THREE.ShapeUtils.triangulateShape(p.map(a=>new THREE.Vector2(...a)),holes.map(r=>r.map(a=>new THREE.Vector2(...a))))) {
      paveTriangle(asphalt,triangle.map(i=>points[i]),hAt);
    }
    if(lot.id===504188968||lot.id===503892533||String(lot.id).startsWith('503892533-apron-'))
      blockRanges.push([groundStart,asphalt.positions.length/3,lot.id===504188968?1:2]);
    if(lot.apronOnly || area(p)<12)continue;
    const A = axes(p), rand = random(hash(lot.id)), point = (u,v) => [A.u[0]*u+A.v[0]*v,A.u[1]*u+A.v[1]*v], lineKeys = new Set();
    const line = (a,b) => {const key=[a,b].map(p=>p.map(v=>v.toFixed(3)).join(',')).sort().join('|');if(!lineKeys.has(key)){lineKeys.add(key);stripe(paint,a,b,hAt);}};
    const record = {id:lot.id,name:lot.name||'',source:lot.source||'OpenStreetMap parking polygon',polygon:p,stalls:0,illustrativeCars:0,groundVertexStart:groundStart,groundVertexCount:asphalt.positions.length/3-groundStart,paintVertexStart:paintStart}; lots.push(record);
    if(lot.surveyRows){
      observedRows(lot,record,line,rand,stalls,candidates);
      record.paintVertexCount=paint.positions.length/3-paintStart;
      continue;
    }
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
        // The November W4-1 panorama shows the row of filled bays behind the
        // low wall. Prioritise its verified parking spaces within the same fleet.
        const westDormFront = lot.id === 1258801990;
        const choice=rand();
        if ((westDormFront || choice<.48) && Number.isFinite(slope) && slope<.12) {
          candidates.push({...s,colour:Math.floor(rand()*8),priority:rand()-(westDormFront?1:0),record});
        }
      }
    }
    record.paintVertexCount=paint.positions.length/3-paintStart;
  }
  for(const [batch,name,material] of [[asphalt,'campus-parking-asphalt',new THREE.MeshStandardMaterial({color:0x747b80,map:TEX?.asphalt||null,roughness:.94,polygonOffset:true,polygonOffsetFactor:-2.5,polygonOffsetUnits:-2.5})],[paint,'campus-parking-markings',new THREE.MeshStandardMaterial({color:0xd8d9d1,roughness:.88,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4})]]){
    if(!batch.positions.length){material.dispose();continue;}
    const geometry=batch.geometry();
    let materials=material;
    if(batch===asphalt&&TEX.hexDrive&&blockRanges.length){
      const blocks=material.clone();blocks.color.setHex(0xb0aaa3);blocks.map=TEX.hexDrive;
      let cursor=0;
      for(const [from,to,materialIndex] of blockRanges){
        if(from>cursor)geometry.addGroup(cursor,from-cursor,0);
        if(to>from)geometry.addGroup(from,to-from,materialIndex);
        cursor=to;
      }
      if(cursor<geometry.attributes.position.count)geometry.addGroup(cursor,geometry.attributes.position.count-cursor,0);
      materials=[material,blocks,administrationPaving(material,TEX.hexDrive)];
      trimParkingApproaches(scene,D,inside);
    }
    const mesh=new THREE.Mesh(geometry,materials);mesh.name=name;mesh.receiveShadow=true;scene.add(mesh);models.push(mesh);
  }
  const placements=[];
  for(const a of candidates.sort((a,b)=>a.priority-b.priority)){
    if(placements.some(b=>Math.hypot(a.x-b.x,a.z-b.z)<6&&vehiclesOverlap(a,b)))continue;
    placements.push(a);if(placements.length===CAR_CAP)break;
  }
  placements.forEach(a=>{a.record.illustrativeCars++;delete a.record;});models.push(...addParkedCars(scene,placements,hAt));
  const metadata={source:'OSM lots with photographed bay layouts at the library, clinic, engineering and western halls. Individual vehicle occupancy is illustrative.',photoOverride:'Captures 94–97 exclude the planted strip 1–7m beyond the western road edge',stallWidthM:WIDTH,stallDepthM:DEPTH,aisleWidthM:AISLE,carCap:CAR_CAP,parkingLots:lots.length,stalls:stalls.length,cars:placements.length,drawCalls:models.length,collisionAdded:false};
  models.forEach(m=>{m.userData.parking=metadata;});
  return {models,lots,stalls,cars:placements,metadata};
}
