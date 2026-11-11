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
  const pos=[],nor=[],cols=[];
  for(const [input,matrix,colour=0xffffff]of parts){const g=input.index?input.toNonIndexed():input,P=g.attributes.position,N=g.attributes.normal,nm=new THREE.Matrix3().getNormalMatrix(matrix),v=new THREE.Vector3(),c=new THREE.Color(colour);
    for(let i=0;i<P.count;i++){v.fromBufferAttribute(P,i).applyMatrix4(matrix);pos.push(v.x,v.y,v.z);const mottling=foliage?.87+.13*Math.sin(v.x*89+v.y*121+v.z*103):1;v.fromBufferAttribute(N,i).applyMatrix3(nm).normalize();nor.push(v.x,v.y,v.z);cols.push(c.r*mottling,c.g*mottling,c.b*mottling);}if(g!==input)g.dispose();input.dispose();}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));g.setAttribute('color',new THREE.Float32BufferAttribute(cols,3));g.computeBoundingSphere();return g;
}
function foliageTemplate(kind){
  const lobes=kind==='sculpted'?[[0,.2,0,.38,.19,.31],[.03,.43,.02,.34,.18,.29],[-.04,.65,-.015,.31,.18,.28],[.015,.85,0,.28,.17,.25],[-.2,.35,.01,.19,.15,.23],[.17,.59,.02,.2,.16,.22]]:
    [[0,.87,0,.29,.13,.27],[-.18,.68,.04,.27,.12,.24],[.19,.73,-.04,.27,.12,.25],[-.03,.99,-.04,.23,.1,.23],[.03,.58,.16,.24,.12,.22],[-.13,.82,-.18,.23,.11,.2],[.16,.89,.13,.22,.11,.2]];
  return merge(lobes.map(([x,y,z,a,b,c],i)=>[new THREE.IcosahedronGeometry(1,2),transform(x,y,z,a,b,c),i%2?0xe9edde:0xffffff]),true);
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
function addPlants(scene,list,kind,crown,trunk){
  if(!list.length){crown.dispose();trunk.dispose();return[];}
  const leaf=new THREE.InstancedMesh(crown,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.96,envMapIntensity:.4}),list.length);
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

export function buildStreetscape(scene,D,C,hAt,surfAt){
  const list=samples(C),rand=random(20260426),plants={sculpted:[],pine:[]},models=[];
  const templates={sculpted:foliageTemplate('sculpted'),pine:foliageTemplate('pine')};
  for(const[kind,stride]of[['sculpted',2],['pine',4]]){
    const template=templates[kind],unitRadius=radiusOf(template);
    for(let k=kind==='pine'?1:0;k<list.length;k+=stride){const a=list[k],height=kind==='sculpted'?4.7+rand()*1.25:11.5+rand()*3.7,width=height*(kind==='sculpted'?.96:.69),radius=unitRadius*width;
      const off=a.half+radius+(kind==='sculpted'?1.25:7.3),along=(rand()-.5)*.9,x=a.x+a.tz*off+a.tx*along,z=a.z-a.tx*off+a.tz*along;
      if(!permitted(x,z,radius,C,surfAt))continue;const y=hAt(x,z);if(!Number.isFinite(y))continue;
      plants[kind].push({x,y,z,height,width,radius,rotation:rand()*Math.PI*2,light:kind==='sculpted'?.255+rand()*.045:.27+rand()*.05,courseClearanceM:courseMargin(x,z,C)-radius,estimated:true});
    }models.push(...addPlants(scene,plants[kind],kind,template,trunkTemplate(kind)));
  }
  const apartments=apartmentDetails(scene,D,hAt);models.push(...apartments.models);
  const metadata={area:'W4-1/W4-2 western approach',source:'User streetview frame and OSM building footprints/levels',nearbyReferenceLink:'https://naver.me/xIF5lerm',referenceDates:'Attached frame appears to show clipped 2026-04; separate linked panoramas were reported by root as 2025-04. They are not treated as the same capture.',treePositions:'Estimated roadside rows; not individual surveyed trees',sculptedEvergreens:plants.sculpted.length,pines:plants.pine.length,drawCalls:models.length,minimumCourseClearanceM:Math.min(...Object.values(plants).flat().map(a=>a.courseClearanceM)),collisionAdded:false};
  models.forEach(m=>{m.userData.streetscape=metadata;});return{models,plants,apartments:apartments.records,zones:getStreetscapeZones(C),metadata};
}
