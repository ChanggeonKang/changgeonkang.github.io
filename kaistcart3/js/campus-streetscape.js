// W4 western approach: source-informed sightline composition, not a tree survey.
// User-supplied nearby Naver link: https://naver.me/xIF5lerm. The attached
// reference image's exact panorama ID has not been independently matched.
// Keep the low sculpted evergreen screen in front of pines and existing mapped
// apartment towers. No source photo is used as a runtime texture.
import * as THREE from '../lib/three.module.min.js';
import { buildingProfile } from './campus-identity.js';
import { isCaptureWestParkingOverride } from './capture-extension-west.js';

const cache = new WeakMap();
const APARTMENTS = new Set([595786755,595786482,595787016,495824296]);
function samples(C) {
  if (!C || !C.n) return [];
  if (!cache.has(C)) {
    const list=[];
    for(let i=0;i<C.n;i++)if(C.x[i]<-350&&C.x[i]>-560&&C.z[i]>=235&&C.z[i]<=465&&C.tx[i]<-.2&&C.tz[i]<-.6)list.push({i,x:C.x[i],z:C.z[i],tx:C.tx[i],tz:C.tz[i],half:C.halfWidth?.[i]??5});
    cache.set(C,list);
  }
  return cache.get(C);
}
function nearest(x,z,list) {
  let result=null, best=Infinity;
  for(const a of list){const dx=x-a.x,dz=z-a.z,d=Math.hypot(dx,dz);if(d<best){best=d;result={...a,distance:d,side:dx*a.tz-dz*a.tx,along:dx*a.tx+dz*a.tz};}}
  return result;
}
/** Exclude generic random trees only in the photographed western planted strip. */
export function isStreetscapeManaged(x,z,C) {
  const a=nearest(x,z,samples(C));
  return !!a&&Math.abs(a.along)<4&&a.side>a.half+.5&&a.side<a.half+23;
}
export function getStreetscapeZones(C) {
  return [{name:'W4 west sculpted-evergreen and pine screen',samples:samples(C).map(a=>({x:a.x,z:a.z,tx:a.tx,tz:a.tz,inner:a.half+.5,outer:a.half+23})),estimated:true}];
}
function random(seed){let s=seed>>>0;return()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296);}
const transform=(x,y,z,sx=1,sy=1,sz=1,rz=0)=>new THREE.Matrix4().compose(new THREE.Vector3(x,y,z),new THREE.Quaternion().setFromEuler(new THREE.Euler(0,0,rz)),new THREE.Vector3(sx,sy,sz));
function merge(parts,foliage=false){
  const pos=[],nor=[],cols=[],uv=[];
  for (const [input, matrix, colour=0xffffff] of parts) {
    const g = input.index ? input.toNonIndexed() : input;
    const {position, normal, uv: inputUV} = g.attributes;
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix), v = new THREE.Vector3(), c = new THREE.Color(colour);
    for (let i = 0; i < position.count; i++) {
      v.fromBufferAttribute(position,i).applyMatrix4(matrix);
      pos.push(v.x,v.y,v.z);
      const mottling = foliage ? .87 + .13 * Math.sin(v.x*89 + v.y*121 + v.z*103) : 1;
      v.fromBufferAttribute(normal,i).applyMatrix3(normalMatrix).normalize();
      nor.push(v.x,v.y,v.z);
      cols.push(c.r*mottling,c.g*mottling,c.b*mottling);
      if (foliage) uv.push(inputUV.getX(i),inputUV.getY(i));
    }
    if (g !== input) g.dispose();
    input.dispose();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor,3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols,3));
  if (foliage) g.setAttribute('uv', new THREE.Float32BufferAttribute(uv,2));
  g.computeBoundingSphere();
  return g;
}
// A small seamless, mipmapped spray pattern breaks up the smooth topiary at
// driver height. Both rows share this generated texture and their existing draws.
function evergreenTexture() {
  const size = 128, pixels = new Uint8Array(size * size * 4), rand = random(20426);
  for (let i = 0; i < pixels.length; i += 4) {
    const shade = 171 + Math.floor(rand() * 42);
    pixels.set([shade, shade, shade, 255], i);
  }
  for (let clump = 0; clump < 380; clump++) {
    const x = size * rand(), y = size * rand(), angle = rand() * Math.PI * 2;
    const shade = 76 + Math.floor(179 * rand());
    for (let spray = -1; spray <= 1; spray++) {
      const dx = Math.cos(angle + spray * .5), dy = Math.sin(angle + spray * .5);
      for (let step = 0; step < 4; step++) {
        const u = (Math.floor(x + dx * step) + size) % size, v = (Math.floor(y + dy * step) + size) % size;
        const i = (v * size + u) * 4;
        pixels[i] = shade; pixels[i + 1] = Math.min(255, shade + 5); pixels[i + 2] = Math.floor(shade * .93);
      }
    }
  }
  const tex = new THREE.DataTexture(pixels, size, size);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(3, 2);
  tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}
function crownLobe(seed, detail) {
  const geometry = new THREE.IcosahedronGeometry(1, detail), p = geometry.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    // The same position gets the same scale on both sides of each UV seam.
    const offset = .065 * Math.sin(13*x + 7*z + seed) * Math.cos(11*y - 4*z)
      + .032 * Math.cos(21*z - 9*x + seed);
    p.setXYZ(i, x*(1+offset), y*(1+offset), z*(1+offset));
  }
  return geometry;
}
function clippedCrown(understory=false,distant=false){
  const lobes=understory
    ? [[-.11,.33,.04,.37,.32,.35],[.14,.48,-.06,.35,.30,.32],[-.07,.68,.03,.37,.25,.30],[.12,.79,.06,.26,.19,.25]]
    : [[0,.2,0,.38,.19,.31],[.03,.43,.02,.34,.18,.29],[-.04,.65,-.015,.31,.18,.28],[.015,.85,0,.28,.17,.25],[-.2,.35,.01,.19,.15,.23],[.17,.59,.02,.2,.16,.22]];
  const detail=distant?0:understory?1:2;
  return merge(lobes.map(([x,y,z,a,b,c],i)=>[crownLobe(i+.4,detail),transform(x,y,z,a,b,c),i%2?0xe9edde:0xffffff]),true);
}

// Dense central foliage and staggered boughs make an uneven pine silhouette.
function pineCrown(distant=false){
  const rand=random(30471), parts=[];
  const spray=(x,y,z,sx,sy,sz,az,tilt,shade)=>{
    const rotation=new THREE.Quaternion().setFromEuler(new THREE.Euler(0,-az,tilt,'YXZ'));
    const matrix=new THREE.Matrix4().compose(new THREE.Vector3(x,y,z),rotation,new THREE.Vector3(sx,sy,sz));
    parts.push([crownLobe(rand()*13,distant?0:1),matrix,shade]);
  };
  for(let k=0;k<7;k++){
    const t=k/6,az=k*2.4,r=.23*(1-.48*t);
    spray(.035*Math.cos(az),.37+.56*t,.035*Math.sin(az),r,.135,r*.9,az,.04,0xd8e4d9);
  }
  for(let k=0;k<19;k++){
    const t=k/18,az=k*2.39996+rand()*.32;
    const span=.30+.11*Math.sin(t*Math.PI)-.18*t,reach=span*(.5+rand()*.22);
    spray(Math.cos(az)*reach,.32+t*.61+(rand()-.5)*.06,Math.sin(az)*reach,
      span*(.63+rand()*.22),.048+rand()*.046,span*(.35+rand()*.2),az,-.10+rand()*.31,k%2?0xd9e6d9:0xb9d0bf);
  }
  return merge(parts,true);
}
function trunkTemplate(kind){
  const a=kind==='sculpted'?.85:.97;
  return merge([[new THREE.CylinderGeometry(.017,.028,a,7),transform(0,a/2,0),0xffffff],
    [new THREE.CylinderGeometry(.009,.014,.4,6),transform(.07,.52,0,1,1,1,-.58),0xd4c4af],
    [new THREE.CylinderGeometry(.008,.013,.38,6),transform(-.08,.68,.025,1,1,1,.68),0xd4c4af]]);
}
function radiusOf(g){const P=g.attributes.position;let r=0;for(let i=0;i<P.count;i++)r=Math.max(r,Math.hypot(P.getX(i),P.getZ(i)));return r;}
function courseMargin(x,z,C){
  let margin=Infinity;
  for(let i=0;i<C.n;i++){const j=(i+1)%C.n,dx=C.x[j]-C.x[i],dz=C.z[j]-C.z[i],l2=dx*dx+dz*dz,t=l2?Math.max(0,Math.min(1,((x-C.x[i])*dx+(z-C.z[i])*dz)/l2)):0;
    const d=Math.hypot(x-C.x[i]-t*dx,z-C.z[i]-t*dz),w=(C.halfWidth?.[i]??5)*(1-t)+(C.halfWidth?.[j]??5)*t;margin=Math.min(margin,d-w);}
  return margin;
}
function permitted(x,z,r,C,surfAt,plantedVerge=false){
  const surface=surfAt(x,z);
  // Captures 94–97 show shrubs in the roadside strip included in a large
  // parking polygon. Its mapped access lanes and buildings still take priority.
  if((surface!==0&&!(plantedVerge&&surface===2))||courseMargin(x,z,C)<r+.75)return false;
  // Check the complete crown disc against the one-metre surface raster, so a
  // building corner cannot slip between perimeter samples of a rounded crown.
  for(let iz=Math.floor(z-r);iz<=Math.floor(z+r);iz++)for(let ix=Math.floor(x-r);ix<=Math.floor(x+r);ix++){
    const s=surfAt(ix+.5,iz+.5);if(s!==3&&s!==8&&s!==9)continue;
    const nx=Math.max(ix,Math.min(ix+1,x)),nz=Math.max(iz,Math.min(iz+1,z));if(Math.hypot(nx-x,nz-z)<r+.001)return false;
  }
  return true;
}
function addPlants(scene,list,kind,crown,trunk,leafMap){
  if(!list.length){crown.dispose();trunk?.dispose();return[];}
  const leaf=new THREE.InstancedMesh(crown,new THREE.MeshStandardMaterial({map:leafMap,vertexColors:true,roughness:.96,envMapIntensity:.4}),list.length);
  const wood=trunk&&new THREE.InstancedMesh(trunk,new THREE.MeshStandardMaterial({vertexColors:true,color:kind==='sculpted'?0x62513e:0x705d49,roughness:1}),list.length);
  const matrix=new THREE.Matrix4(),rotation=new THREE.Quaternion(),colour=new THREE.Color();
  list.forEach((a,i)=>{rotation.setFromAxisAngle(new THREE.Vector3(0,1,0),a.rotation);matrix.compose(new THREE.Vector3(a.x,a.y,a.z),rotation,new THREE.Vector3(a.width,a.height,a.width));leaf.setMatrixAt(i,matrix);wood?.setMatrixAt(i,matrix);leaf.setColorAt(i,colour.setHSL(kind==='pine'?.31:.255,kind==='pine'?.24:.29,a.light,THREE.SRGBColorSpace));a.matrix=matrix.toArray();});
  for(const[m,suffix]of[[leaf,'crowns'],[wood,'trunks']]){if(!m)continue;m.name=`w4-${kind}-${suffix}`;m.instanceMatrix.needsUpdate=true;if(m.instanceColor)m.instanceColor.needsUpdate=true;m.computeBoundingSphere();m.castShadow=true;m.receiveShadow=true;scene.add(m);}return[leaf,wood].filter(Boolean);
}
class Facades{
  constructor(){this.p=[];this.n=[];this.c=[];}
  quad(a,b,c,d,n,colour){const col=new THREE.Color(colour);for(let t of[[a,b,c],[a,c,d]]){const v=new THREE.Vector3(...t[1]).sub(new THREE.Vector3(...t[0])).cross(new THREE.Vector3(...t[2]).sub(new THREE.Vector3(...t[0])));if(v.dot(new THREE.Vector3(...n))<0)[t[1],t[2]]=[t[2],t[1]];for(const q of t){this.p.push(...q);this.n.push(...n);this.c.push(col.r,col.g,col.b);}}}
  face(a,b,t0,t1,y0,y1,n,colour){const at=t=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t],p=at(t0),q=at(t1);this.quad([p[0],y0,p[1]],[q[0],y0,q[1]],[q[0],y1,q[1]],[p[0],y1,p[1]],n,colour);}
  mesh(name,material){if(!this.p.length){material.dispose();return null;}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(this.p,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(this.n,3));g.setAttribute('color',new THREE.Float32BufferAttribute(this.c,3));g.computeBoundingSphere();const m=new THREE.Mesh(g,material);m.name=name;m.receiveShadow=true;return m;}
}
function apartmentDetails(scene,D,hAt){
  const glass=new Facades(),frames=new Facades(),records=[];
  for(const b of D.buildings||[]){if(!APARTMENTS.has(b.id))continue;const p=b.p,e=p.map(a=>hAt(...a)),profile=buildingProfile(b),base=Math.min(...e)-1,top=(Math.min(...e)+Math.max(...e))/2+profile.height,sgn=Math.sign(p.reduce((s,a,i)=>{const q=p[(i+1)%p.length];return s+a[0]*q[1]-q[0]*a[1];},0))||1;
    for(let i=0;i<p.length;i++){const a=p[i],q=p[(i+1)%p.length],dx=q[0]-a[0],dz=q[1]-a[1],L=Math.hypot(dx,dz);if(L<.1)continue;const n=[sgn*dz/L,0,-sgn*dx/L];
      if(L>22){const count=Math.max(1,Math.round(L/4.7));for(let c=0;c<count;c++){glass.face(a,q,(c+.1)/count,(c+.86)/count,base+2.5,top-1.3,n,c%3?0x73918f:0x627b7b);frames.face(a,q,(c+.86)/count,(c+1)/count,base+2.5,top-1.3,n,0xd9dcd5);}for(let y=base+3.1;y<top-1.2;y+=profile.floorHeight)frames.face(a,q,0,1,y,y+.28,n,0xd9ded8);}
      else if(n[0]>.25){frames.face(a,q,0,1,base+2,top,n,0xe0e2dc);const digits=String(b.name||'').replace(/\D/g,'');if(digits){const chars={0:[1,1,1,1,1,1,0],1:[0,1,1,0,0,0,0],2:[1,1,0,1,1,0,1],9:[1,1,1,1,0,1,1]};const rects=[[.12,.84,.72,1],[.72,.5,.88,.88],[.72,.08,.88,.5],[.12,0,.72,.16],[0,.08,.16,.5],[0,.5,.16,.88],[.12,.43,.72,.59]];
        for(let k=0;k<digits.length;k++)for(let s=0;s<7;s++)if(chars[digits[k]]?.[s]){const r=rects[s],left=(L-digits.length*1.65)/2+k*1.65;frames.face(a,q,(left+r[0]*1.4)/L,(left+r[2]*1.4)/L,top-9+r[1]*2.4,top-9+r[3]*2.4,n,0x778789);}}}
    }records.push({id:b.id,sourceLevels:b.lv,sourceFootprint:b.p,heightM:profile.height,heightSource:profile.source,name:b.name,reference:'Apartment 101 visible behind the evergreen screen in the user frame; other neighbouring mapped apartment facades are an approximate continuation.'});
  }
  const models=[glass.mesh('w4-background-apartment-glazing',new THREE.MeshStandardMaterial({vertexColors:true,roughness:.28,metalness:.28,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2})),frames.mesh('w4-background-apartment-panels',new THREE.MeshStandardMaterial({vertexColors:true,roughness:.83,metalness:.03,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3}))].filter(Boolean);models.forEach(m=>scene.add(m));return{models,records};
}

// In photos 99–100 the low stone wall follows the edge of the W4-1
// parking lot behind the sidewalk. The driveways at either end stay open.
function buildParkingWall(scene, D, C, hAt) {
  const lot = D.parking?.find(p => p.id === 1258801990);
  if (!lot || C.n <= 1046) return null;
  const course = samples(C), stones = new Facades();
  const front = lot.p.find((a, i) => {
    const b = lot.p[(i + 1) % lot.p.length];
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 35) return false;
    return [a, b].every(p => {
      const s = nearest(...p, course);
      return s && s.side < -s.half && s.side > -s.half - 4 && Math.abs(s.along) < 3;
    });
  });
  if (!front) return null;
  const back = lot.p[(lot.p.indexOf(front) + 1) % lot.p.length];
  const length = Math.hypot(back[0] - front[0], back[1] - front[1]);
  const tx = (back[0] - front[0]) / length, tz = (back[1] - front[1]) / length;
  const station = nearest(...front, course);
  const sign = (C.x[station.i] - front[0]) * tz - (C.z[station.i] - front[1]) * tx > 0 ? 1 : -1;
  const nx = sign * tz, nz = -sign * tx;
  const face = [nx, 0, nz], reverse = [-nx, 0, -nz];
  const at = (s, depth, height) => {
    const x = front[0] + tx*s, z = front[1] + tz*s;
    return [x + nx*depth, hAt(x, z) + height, z + nz*depth];
  };
  const start = 1.8, end = length - 1.8, cap = .92;
  const colours = [0x5c584d, 0x635f52, 0x56584e, 0x6e685a];
  const count = Math.ceil((end - start) / 1.4), span = (end - start) / count;
  for (let i = 0; i < count; i++) {
    const a = start + i*span, b = a + span;
    stones.quad(at(a,0,.17), at(b,0,.17), at(b,0,cap), at(a,0,cap), face, 0x45473e);
    stones.quad(at(b,-.29,.17), at(a,-.29,.17), at(a,-.29,cap), at(b,-.29,cap), reverse, 0x59594f);
    stones.quad(at(a,.025,cap), at(b,.025,cap), at(b,-.315,cap), at(a,-.315,cap), [0,1,0], 0x888476);
  }
  for (let row = 0; row < 3; row++) {
    const bottom = .20 + row*.245, top = bottom + .225;
    for (let i = 0; i <= count; i++) {
      const s = start + (i - (row % 2)*.5)*span;
      const a = Math.max(start,s + .013), b = Math.min(end,s + span - .013);
      if (a >= b) continue;
      stones.quad(at(a,.012,bottom), at(b,.012,bottom), at(b,.012,top), at(a,.012,top), face, colours[(i*7 + row*5) % colours.length]);
    }
  }
  for (const [s, direction] of [[start,-1],[end,1]]) {
    stones.quad(at(s,0,.17), at(s,-.29,.17), at(s,-.29,cap), at(s,0,cap), [direction*tx,0,direction*tz], 0x625f53);
  }
  const wall = stones.mesh('W4-1 parking lot stone wall',new THREE.MeshStandardMaterial({vertexColors:true,roughness:.95}));
  wall.castShadow = true;
  scene.add(wall);
  return wall;
}

// In the western straight's front views, the clipped crowns overlap at eye
// level. The tall pine belt ends before the low nursery roofs appear at W5.
function plantWesternVerge(D,C,hAt,surfAt,templates){
  const plants={sculpted:[],understory:[],pine:[]},rand=random(20261120);
  const radii=Object.fromEntries(Object.entries(templates).map(([k,g])=>[k,radiusOf(g)]));
  const entrances=(D.roads||[]).filter(r=>!['path','footway','steps'].includes(r.t)).flatMap(r=>
    r.p.slice(1).map((b,k)=>({a:r.p[k],b,id:r.id,half:(r.width||3)/2})))
    .filter(({a,b})=>Math.min(a[0],b[0])< -281 && Math.max(a[0],b[0])> -388 && Math.min(a[1],b[1])<627 && Math.max(a[1],b[1])>455);
  const outsideEntrance=(x,z,i)=>entrances.every(({a,b,id,half})=>{
    const dx=b[0]-a[0],dz=b[1]-a[1],u=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1)));
    // The south road footprint runs parallel inside the photographed tree
    // strip. Its turns across the strip still represent driveway openings.
    if(id===92189927&&Math.abs(dx*C.tx[i]+dz*C.tz[i])>.93*Math.hypot(dx,dz))return true;
    return Math.hypot(x-a[0]-u*dx,z-a[1]-u*dz)>half+.22;
  });
  const buildings=(D.buildings||[]).map(({p})=>({p,minX:Math.min(...p.map(v=>v[0])),maxX:Math.max(...p.map(v=>v[0])),
    minZ:Math.min(...p.map(v=>v[1])),maxZ:Math.max(...p.map(v=>v[1]))})).filter(b=>b.minX< -275&&b.maxX> -630&&b.minZ<635&&b.maxZ>100);
  const clearsCorners=(x,z,r)=>buildings.every(({p,minX,maxX,minZ,maxZ})=>{
    if(x+r<minX||x-r>maxX||z+r<minZ||z-r>maxZ)return true;
    return p.every((a,k)=>{
      const b=p[(k+1)%p.length],dx=b[0]-a[0],dz=b[1]-a[1],u=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1)));
      return Math.hypot(x-a[0]-dx*u,z-a[1]-dz*u)>r+.12;
    });
  });
  function plant(i,kind,height,width,depths,light){
    if(i>=C.n)return;
    const radius=radii[kind]*width, along=(rand()-.5)*.82, rotation=rand()*2*Math.PI;
    for(const depth of depths){
      const off=C.halfWidth[i]+depth,x=C.x[i]+C.tz[i]*off+C.tx[i]*along,z=C.z[i]-C.tx[i]*off+C.tz[i]*along;
      const verge=i>=898 && i<=976 && isCaptureWestParkingOverride(x,z) && outsideEntrance(x,z,i);
      if(!permitted(x,z,radius,C,surfAt,verge)||!clearsCorners(x,z,radius))continue;
      const y=hAt(x,z);if(!Number.isFinite(y))continue;
      plants[kind].push({x,y,z,height,width,radius,rotation,light,courseClearanceM:courseMargin(x,z,C)-radius,estimated:true});
      return;
    }
  }
  for(let i=898;i<=1110;i+=2){
    const h=4.25+rand()*1.4,w=h*(1.04+rand()*.13);
    plant(i,'sculpted',h,w,[radii.sculpted*w+1.05,4.9,5.7],.32+rand()*.07);
  }
  for(let sample=898;sample<=1108;sample+=1.5){
    const i=Math.round(sample),low=Math.min(1,Math.max(0,(i-1060)/37));
    const h=4.9-2.0*low+rand()*.78,w=6.1+rand()*1.05;
    plant(i,'understory',h,w,[5.65+rand()*.6,4.85,6.8,7.7],.265+rand()*.045);
  }
  for(let i=898;i<=1074;i+=3){
    const taper=Math.min(1,Math.max(0,(1074-i)/13));
    const h=(12.5+rand()*3.9)*(.64+.36*taper),w=9.1+rand()*2.1;
    plant(i,'pine',h,w,[7.55+rand()*1.85,6.65,6.05,10.3,12.5],.3+rand()*.055);
  }
  // Behind the service turn, the front row alone frames the base of a
  // distant building. Photo 97 shows another bank of foliage in that gap.
  for(let i=967;i<=976;i++){
    plant(i,'understory',5.0+rand()*1.15,6.8+rand(),[10.5,12.2,13.8,16.5,24.6],.28+rand()*.055);
  }
  for(const i of [968,972,974]){
    plant(i,'pine',15.7+rand()*2.1,10.6,[12.9,15.1,16.6,24.9],.31+rand()*.04);
  }
  return plants;
}

export function buildStreetscape(scene,D,C,hAt,surfAt,mobile=false){
  const templates={sculpted:clippedCrown(),understory:clippedCrown(true),pine:pineCrown()}, leafMap=evergreenTexture();
  const plants=plantWesternVerge(D,C,hAt,surfAt,templates),models=[];
  for(const [kind,crown] of Object.entries(templates)){
    if(mobile)crown.userData.distantCrown=kind==='pine'?pineCrown(true):clippedCrown(kind==='understory',true);
    models.push(...addPlants(scene,plants[kind],kind,crown,kind==='understory'?null:trunkTemplate(kind),leafMap));
  }
  const apartments=apartmentDetails(scene,D,hAt);models.push(...apartments.models);
  const wall = buildParkingWall(scene,D,C,hAt);
  if(wall)models.push(wall);
  const metadata={area:'Western straight from KISTI to the W5 greenhouses',source:'Spring captures 94–102 and 1–7, W4 side panorama, April and November 2026 lap survey',nearbyReferenceLink:'https://map.naver.com/p?c=17.00,0,0,0,adh&p=eHoxrH85VcgXrs-quPz5Wg,-26,10,80,Float',treePositions:'Estimated roadside rows; not individual surveyed trees',sculptedEvergreens:plants.sculpted.length,understory:plants.understory.length,pines:plants.pine.length,drawCalls:models.length,minimumCourseClearanceM:Math.min(...Object.values(plants).flat().map(a=>a.courseClearanceM)),collisionAdded:false};
  models.forEach(m=>{m.userData.streetscape=metadata;});return{models,plants,apartments:apartments.records,zones:getStreetscapeZones(C),metadata};
}
