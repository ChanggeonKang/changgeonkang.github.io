// W4 western approach: source-informed sightline composition, not a tree survey.
// User-supplied nearby Naver link: https://naver.me/xIF5lerm. The attached
// reference image's exact panorama ID has not been independently matched.
// Keep the low sculpted evergreen screen in front of pines and existing mapped
// apartment towers. No source photo is used as a runtime texture.
import * as THREE from '../lib/three.module.min.js';
import { buildingProfile } from './campus-identity.js';

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
function crownLobe(seed) {
  const geometry = new THREE.IcosahedronGeometry(1, 2), p = geometry.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    // The same position gets the same scale on both sides of each UV seam.
    const offset = .065 * Math.sin(13*x + 7*z + seed) * Math.cos(11*y - 4*z)
      + .032 * Math.cos(21*z - 9*x + seed);
    p.setXYZ(i, x*(1+offset), y*(1+offset), z*(1+offset));
  }
  return geometry;
}
function foliageTemplate(kind){
  const lobes=kind==='sculpted'?[[0,.2,0,.38,.19,.31],[.03,.43,.02,.34,.18,.29],[-.04,.65,-.015,.31,.18,.28],[.015,.85,0,.28,.17,.25],[-.2,.35,.01,.19,.15,.23],[.17,.59,.02,.2,.16,.22]]:
    [[0,.84,0,.29,.17,.27],[-.18,.64,.04,.28,.13,.24],[.19,.69,-.04,.29,.14,.25],[-.03,.96,-.04,.21,.13,.21],[.03,.53,.16,.26,.13,.24],[-.13,.78,-.18,.24,.15,.22],[.16,.85,.13,.22,.14,.21],[.05,.72,.13,.22,.14,.23],[0,1.03,0,.13,.12,.13]];
  return merge(lobes.map(([x,y,z,a,b,c],i)=>[crownLobe(i+.4),transform(x,y,z,a,b,c),i%2?0xe9edde:0xffffff]),true);
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
function permitted(x,z,r,C,surfAt){
  if(surfAt(x,z)!==0||courseMargin(x,z,C)<r+.75)return false;
  // Check the complete crown disc against the one-metre surface raster, so a
  // building corner cannot slip between perimeter samples of a rounded crown.
  for(let iz=Math.floor(z-r);iz<=Math.floor(z+r);iz++)for(let ix=Math.floor(x-r);ix<=Math.floor(x+r);ix++){
    const s=surfAt(ix+.5,iz+.5);if(s!==3&&s!==8&&s!==9)continue;
    const nx=Math.max(ix,Math.min(ix+1,x)),nz=Math.max(iz,Math.min(iz+1,z));if(Math.hypot(nx-x,nz-z)<r+.001)return false;
  }
  return true;
}
function addPlants(scene,list,kind,crown,trunk,leafMap){
  if(!list.length){crown.dispose();trunk.dispose();return[];}
  const leaf=new THREE.InstancedMesh(crown,new THREE.MeshStandardMaterial({map:leafMap,vertexColors:true,roughness:.96,envMapIntensity:.4}),list.length);
  const wood=new THREE.InstancedMesh(trunk,new THREE.MeshStandardMaterial({vertexColors:true,color:kind==='sculpted'?0x62513e:0x705d49,roughness:1}),list.length);
  const matrix=new THREE.Matrix4(),rotation=new THREE.Quaternion(),colour=new THREE.Color();
  list.forEach((a,i)=>{rotation.setFromAxisAngle(new THREE.Vector3(0,1,0),a.rotation);matrix.compose(new THREE.Vector3(a.x,a.y,a.z),rotation,new THREE.Vector3(a.width,a.height,a.width));leaf.setMatrixAt(i,matrix);wood.setMatrixAt(i,matrix);leaf.setColorAt(i,colour.setHSL(kind==='sculpted'?.255:.31,kind==='sculpted'?.29:.22,a.light,THREE.SRGBColorSpace));a.matrix=matrix.toArray();});
  for(const[m,suffix]of[[leaf,'crowns'],[wood,'trunks']]){m.name=`w4-${kind}-${suffix}`;m.instanceMatrix.needsUpdate=true;if(m.instanceColor)m.instanceColor.needsUpdate=true;m.computeBoundingSphere();m.castShadow=true;m.receiveShadow=true;scene.add(m);}return[leaf,wood];
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

export function buildStreetscape(scene,D,C,hAt,surfAt){
  const list=samples(C),rand=random(20260426),plants={sculpted:[],pine:[]},models=[];
  const templates={sculpted:foliageTemplate('sculpted'),pine:foliageTemplate('pine')}, leafMap=evergreenTexture();
  for(const[kind,stride]of[['sculpted',2],['pine',4]]){
    const template=templates[kind],unitRadius=radiusOf(template);
    for(let k=kind==='pine'?1:0;k<list.length;k+=stride){const a=list[k],height=kind==='sculpted'?4.45+rand()*1.5:11.5+rand()*3.7,width=height*(kind==='sculpted'?1.09:.69),radius=unitRadius*width;
      const off=a.half+radius+(kind==='sculpted'?.94:7.3),along=(rand()-.5)*.9,x=a.x+a.tz*off+a.tx*along,z=a.z-a.tx*off+a.tz*along;
      if(!permitted(x,z,radius,C,surfAt))continue;const y=hAt(x,z);if(!Number.isFinite(y))continue;
      plants[kind].push({x,y,z,height,width,radius,rotation:rand()*Math.PI*2,light:kind==='sculpted'?.315+rand()*.06:.28+rand()*.045,courseClearanceM:courseMargin(x,z,C)-radius,estimated:true});
    }models.push(...addPlants(scene,plants[kind],kind,template,trunkTemplate(kind),leafMap));
  }
  const apartments=apartmentDetails(scene,D,hAt);models.push(...apartments.models);
  const wall = buildParkingWall(scene,D,C,hAt);
  if(wall)models.push(wall);
  const metadata={area:'W4-1/W4-2 western approach',source:'User spring captures, November 2026 W4-1 side and forward panoramas, OSM building and parking footprints',nearbyReferenceLink:'https://map.naver.com/p?c=17.00,0,0,0,adh&p=eHoxrH85VcgXrs-quPz5Wg,-26,10,80,Float',treePositions:'Estimated roadside rows; not individual surveyed trees',sculptedEvergreens:plants.sculpted.length,pines:plants.pine.length,drawCalls:models.length,minimumCourseClearanceM:Math.min(...Object.values(plants).flat().map(a=>a.courseClearanceM)),collisionAdded:false};
  models.forEach(m=>{m.userData.streetscape=metadata;});return{models,plants,apartments:apartments.records,zones:getStreetscapeZones(C),metadata};
}
