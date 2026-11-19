// April 2025 vegetation form and roadside composition from user captures 1–55.
// Positions, species, crown sizes and heights are visual estimates, not a tree survey.
// Source images are not used as textures. This module changes no ground/collision data.
import * as THREE from '../lib/three.module.min.js';
import { isStreetscapeManaged } from './campus-streetscape.js';

const ZONES = [
  {id:'west-screen-extension',from:1110,to:1316,side:1,kind:'sculpted',spacing:4.1,gap:1.1,height:[4.6,5.9],width:[5.4,6.7],photos:[2,3,4,5,7,8,9],outer:24},
  {id:'west-screen-pines',from:1120,to:1300,side:1,kind:'pine',spacing:25,gap:9,height:[10.8,13.4],width:[7.3,9.3],photos:[2,3,4,5,7,8,9],outer:27},
  {id:'west-dorm-cherries',from:1044,to:1313,side:-1,kind:'cherry',spacing:15.5,gap:2.4,height:[6.5,8.5],width:[5.8,7.3],photos:[1,2,3,4,5,7,8,9],outer:22},
  {id:'west-dorm-low-shrubs',from:1048,to:1310,side:-1,kind:'shrub',spacing:9.5,gap:3.2,height:[.6,.95],width:[1.8,2.7],photos:[1,2,3,4,5,7,8,9],outer:22},
  {id:'w11-terrace-cherries',from:1325,to:1397,side:1,kind:'cherry',spacing:14,gap:3,height:[7,9],width:[6,8],photos:[10,11,12,13,14],outer:26},
  {id:'w11-terrace-shrubs',from:1330,to:1395,side:1,kind:'shrub',spacing:6.5,gap:3.8,height:[.55,.85],width:[1.5,2.3],photos:[10,11,12,13,14],outer:26},
  {id:'w10-hill-bare-trees',from:1360,to:1398,side:-1,kind:'bare',spacing:13,gap:17,height:[11,15],width:[6.8,9],photos:[11,12,13,14],outer:38},
  {id:'w11-east-lawn-trees',from:1405,to:1495,side:-1,kind:'bare',spacing:15,gap:4,height:[8.8,12],width:[5.2,7.2],photos:[15,16,17,18],outer:26},
  {id:'w11-east-low-shrubs',from:1405,to:1495,side:-1,kind:'shrub',spacing:10,gap:3.6,height:[.6,1],width:[1.8,2.8],photos:[15,16,17,18],outer:26},
  {id:'areum-corner-cherries',from:1492,to:1515,side:-1,kind:'cherry',spacing:16,gap:3.5,height:[8.5,10],width:[8,9.5],photos:[19],outer:27},
  {id:'areum-corner-pines',from:1488,to:1516,side:-1,kind:'pine',spacing:25,gap:11,height:[11,13.8],width:[7.7,9.5],photos:[18,19],outer:30},
  {id:'north-dorm-pine-row',from:1517,to:1609,side:1,kind:'pine',spacing:25,gap:7,height:[10.5,13.5],width:[7.5,9.8],photos:[20,21,22,23,24],outer:29},
  {id:'north-dorm-cherries',from:1522,to:1614,side:1,kind:'cherry',spacing:18,gap:2.8,height:[7.5,9.8],width:[7,8.8],photos:[20,22,23,24],outer:26},
  {id:'north-dorm-shrubs',from:1517,to:1614,side:1,kind:'shrub',spacing:8.5,gap:3.4,height:[.6,1],width:[1.9,2.8],photos:[20,21,22,23,24],outer:26},
  {id:'north-south-bank-cherries',from:1518,to:1613,side:-1,kind:'cherry',spacing:21,gap:5.8,height:[8,10],width:[7,9],photos:[20,21,22,23,24],outer:28},
  {id:'n17-n18-topiary',from:1649,to:1688,side:1,kind:'sculpted',spacing:11,gap:4,height:[2.1,3.2],width:[2.5,3.6],photos:[27,28,29,30],outer:20},
  {id:'n12-front-low-hedge',from:1673,to:1702,side:-1,kind:'shrub',spacing:6,gap:2.7,height:[.6,.95],width:[1.8,2.5],photos:[29,30,31],outer:17},
  {id:'north-dome-pines',from:1725,to:1790,side:1,kind:'pine',spacing:24,gap:7,height:[11,14],width:[8,10.5],photos:[33,34,35],outer:31},
  {id:'n10-service-bare-row',from:1722,to:1750,side:-1,kind:'bare',spacing:13,gap:5,height:[10.5,14],width:[5.8,7.5],photos:[32,33],outer:24},
  {id:'n9-north-cherries',from:1770,to:1845,side:1,kind:'cherry',spacing:19,gap:4.2,height:[7.7,9.5],width:[6.5,8.5],photos:[35,36,37],outer:26},
  {id:'n9-wall-topiary',from:1760,to:1810,side:-1,kind:'sculpted',spacing:9,gap:2.3,height:[3.2,4.4],width:[3.6,4.7],photos:[34,35,36],outer:19},
  {id:'n5-north-deciduous',from:1845,to:1900,side:1,kind:'bare',spacing:15,gap:3.5,height:[10,13],width:[6.5,8],photos:[38,39],outer:24},
  {id:'n5-north-shrubs',from:1845,to:1900,side:1,kind:'shrub',spacing:8,gap:3,height:[.65,.9],width:[2,2.7],photos:[38,39],outer:24},
  {id:'n5-wall-evergreens',from:1845,to:1898,side:-1,kind:'sculpted',spacing:10,gap:2,height:[3,4.3],width:[3.3,4.5],photos:[38,39],outer:18},
  {id:'n6-n1-cherries',from:1900,to:1962,side:1,kind:'cherry',spacing:17,gap:4,height:[7.5,9.5],width:[6.6,8.4],photos:[40,41,42,43],outer:27},
  {id:'n1-front-pines',from:1918,to:1960,side:1,kind:'pine',spacing:24,gap:11,height:[11,14],width:[8,10],photos:[41,42,43],outer:31},
  {id:'n1-right-lawn',from:1900,to:1975,side:-1,kind:'shrub',spacing:8.8,gap:4.6,height:[.65,1.1],width:[2.1,3],photos:[40,41,42,43,44],outer:27},
  {id:'n1-right-pines',from:1908,to:1956,side:-1,kind:'pine',spacing:31,gap:11,height:[9.5,12.5],width:[7.5,9],photos:[40,41,42,43],outer:31},
  {id:'e13-road-cherries',from:1985,to:2045,side:1,kind:'cherry',spacing:18,gap:4,height:[7.5,9],width:[6.2,8.3],photos:[45,46,47],outer:28},
  {id:'e13-woodland-trunks',from:1990,to:2040,side:1,kind:'bare',spacing:18,gap:17,height:[11,15],width:[6.5,8],photos:[45,46,47],outer:38},
  {id:'e13-right-shrubs',from:1985,to:2043,side:-1,kind:'shrub',spacing:8,gap:4,height:[.7,1],width:[2,2.9],photos:[45,46,47],outer:25},
  {id:'e15-entrance-evergreen',from:2070,to:2094,side:1,kind:'sculpted',spacing:10,gap:3.5,height:[2.5,3.4],width:[3,4],photos:[48,49],outer:18},
  {id:'n3-east-open-lawn',from:2093,to:2124,side:-1,kind:'bare',spacing:17,gap:6,height:[6.8,8.7],width:[4.4,6],photos:[50,51],outer:26},
  {id:'n3-south-terrace-pines',from:2130,to:2182,side:-1,kind:'pine',spacing:22,gap:6,height:[10.5,14],width:[7.7,9.5],photos:[53,54],outer:29},
  {id:'n3-south-low-hedges',from:2132,to:2180,side:-1,kind:'shrub',spacing:7.5,gap:3,height:[.6,1],width:[2,2.8],photos:[53,54],outer:29}
];

function random(seed){let s=seed>>>0;return()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296);}
const cache=new WeakMap();
function prepared(C){
  if(cache.has(C))return cache.get(C);
  const cells=new Map(),cell=48;
  for(let i=0;i<C.n;i++){const key=`${Math.floor(C.x[i]/cell)},${Math.floor(C.z[i]/cell)}`;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(i);}
  const state={cells,cell};cache.set(C,state);return state;
}
function nearby(x,z,C){const{cells,cell}=prepared(C),cx=Math.floor(x/cell),cz=Math.floor(z/cell),out=[];for(let ix=cx-1;ix<=cx+1;ix++)for(let iz=cz-1;iz<=cz+1;iz++)out.push(...(cells.get(`${ix},${iz}`)||[]));return out;}
function closest(x,z,C){let best=null,d2=Infinity;for(const i of nearby(x,z,C)){const dx=x-C.x[i],dz=z-C.z[i],q=dx*dx+dz*dz;if(q<d2){d2=q;best={i,side:dx*C.tz[i]-dz*C.tx[i],half:C.halfWidth[i],distance:Math.sqrt(q)};}}return best;}
export function isCaptureLandscapeManaged(x,z,C){
  if(!C?.n)return false;const a=closest(x,z,C);if(!a)return false;
  return ZONES.some(v=>a.i>=v.from&&a.i<=v.to&&a.side*v.side>a.half+.25&&a.side*v.side<a.half+v.outer);
}
export function getCaptureLandscapeZones(){return ZONES.map(a=>({...a,photos:[...a.photos],estimated:true,source:'User April 2025 captures; see audit/capture-review-*.json'}));}
function inPoly(x,z,p){let c=false;for(let i=0,j=p.length-1;i<p.length;j=i++)if((p[i][1]>z)!==(p[j][1]>z)&&x<(p[j][0]-p[i][0])*(z-p[i][1])/(p[j][1]-p[i][1])+p[i][0])c=!c;return c;}
function segmentDistance(x,z,a,b){const dx=b[0]-a[0],dz=b[1]-a[1],l=dx*dx+dz*dz,t=l?Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/l)):0;return Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t);}
function margin(x,z,C){let m=Infinity;for(const i of nearby(x,z,C)){const j=(i+1)%C.n,d=segmentDistance(x,z,[C.x[i],C.z[i]],[C.x[j],C.z[j]]);m=Math.min(m,d-Math.max(C.halfWidth[i],C.halfWidth[j]));}return m;}
function allowed(x,z,r,D,C,surfAt){
  if(surfAt(x,z)!==0||isStreetscapeManaged(x,z,C)||margin(x,z,C)<r+.8)return false;
  // Exact footprint tests complement the 1 m raster at narrow building corners.
  for(const b of D.buildings){const p=b.p;if(inPoly(x,z,p))return false;for(let i=0;i<p.length;i++)if(segmentDistance(x,z,p[i],p[(i+1)%p.length])<r+.4)return false;}
  for(const a of D.areas)if((a.k==='water'||a.k==='pitch')&&inPoly(x,z,a.p))return false;
  for(let iz=Math.floor(z-r);iz<=Math.floor(z+r);iz++)for(let ix=Math.floor(x-r);ix<=Math.floor(x+r);ix++){
    const s=surfAt(ix+.5,iz+.5);if(s!==2&&s!==3&&s!==8&&s!==9)continue;
    const nx=Math.max(ix,Math.min(ix+1,x)),nz=Math.max(iz,Math.min(iz+1,z));if(Math.hypot(nx-x,nz-z)<r+.05)return false;
  }
  return true;
}
function merge(parts){
  const positions=[],normals=[],colors=[],v=new THREE.Vector3(),n=new THREE.Vector3();
  for(const{g,m,c=0xffffff}of parts){const geo=g.index?g.toNonIndexed():g,P=geo.attributes.position,N=geo.attributes.normal,nm=new THREE.Matrix3().getNormalMatrix(m),colour=new THREE.Color(c);
    for(let i=0;i<P.count;i++){v.fromBufferAttribute(P,i).applyMatrix4(m);n.fromBufferAttribute(N,i).applyMatrix3(nm).normalize();positions.push(v.x,v.y,v.z);normals.push(n.x,n.y,n.z);colors.push(colour.r,colour.g,colour.b);}if(geo!==g)geo.dispose();g.dispose();}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.computeBoundingSphere();return g;
}
function blob(x,y,z,sx,sy,sz,c,detail=0){return{g:new THREE.IcosahedronGeometry(1,detail),m:new THREE.Matrix4().compose(new THREE.Vector3(x,y,z),new THREE.Quaternion(),new THREE.Vector3(sx,sy,sz)),c};}
function branch(a,b,r1,r2){const A=new THREE.Vector3(...a),B=new THREE.Vector3(...b),d=B.clone().sub(A),q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),d.clone().normalize());return{g:new THREE.CylinderGeometry(r2,r1,d.length(),5),m:new THREE.Matrix4().compose(A.add(B).multiplyScalar(.5),q,new THREE.Vector3(1,1,1)),c:0xffffff};}
function template(kind){
  const wood=[],leaf=[],rand=random(kind==='cherry'?6071:kind==='bare'?3077:8131);
  if(kind==='cherry'||kind==='bare'){
    wood.push(branch([0,0,0],[.015,.48,0],.021,.011));
    for(let k=0;k<7;k++){
      const a=k*Math.PI*2/7+.3,y=.28+k*.046,ex=Math.cos(a)*(.25+rand()*.07),ez=Math.sin(a)*(.25+rand()*.07),ey=.64+rand()*.19;
      wood.push(branch([.01,y,0],[ex,ey,ez],.008,.0035));
      for(let j=0;j<3;j++){
        const t=.43+j*.25,b=[ex*t,y+(ey-y)*t,ez*t],an=a+(j-1)*.65,e=[ex*(.9+j*.12)+Math.cos(an)*.1,ey+.05+rand()*.14,ez*(.9+j*.12)+Math.sin(an)*.1];
        wood.push(branch(b,e,.0035,.001));
        const count=kind==='cherry'?3:1;
        for(let f=0;f<count;f++){const u=.43+rand()*.57,x=b[0]+(e[0]-b[0])*u,z=b[2]+(e[2]-b[2])*u,cy=b[1]+(e[1]-b[1])*u,s=kind==='cherry'?.043+rand()*.02:.025;
          leaf.push(blob(x,cy,z,s,kind==='cherry'?s*.68:s*.55,s*.9,kind==='cherry'?[0xf4e8df,0xfbf5e9,0xe7d6cc][f%3]:0x9a8c65));}
      }
    }
    // Upright leader and thin fork keep silhouette open above the side branches.
    wood.push(branch([.015,.43,0],[.025,.96,.015],.006,.0015));
  }else if(kind==='pine'){
    wood.push(branch([0,0,0],[.025,.96,0],.022,.007));
    for(let k=0;k<8;k++){const a=k*2.4,y=.57+k*.047,r=.22+(k%3)*.045,x=Math.cos(a)*r,z=Math.sin(a)*r;wood.push(branch([.015,y-.15,0],[x,y,z],.009,.003));leaf.push(blob(x,y,z,.23,.075,.21,k%2?0x496449:0x36573c,1));}
    leaf.push(blob(.02,.98,0,.22,.07,.2,0x456444,1));
  }else if(kind==='sculpted'){
    wood.push(branch([0,0,0],[0,.88,0],.035,.014));
    for(let k=0;k<5;k++){const y=.18+k*.17,r=.46-k*.047;leaf.push(blob((k%2?.04:-.025),y,0,r,.15,r*.84,k%2?0x596c3b:0x435b35,1));}
    leaf.push(blob(-.3,.3,.02,.22,.15,.26,0x4b6239,1),blob(.24,.53,.01,.22,.15,.25,0x536b3d,1));
  }else{
    leaf.push(blob(0,.48,0,.5,.46,.44,0x526c35,1),blob(.2,.4,.06,.32,.34,.34,0x617a3e,1));
  }
  const foliage=merge(leaf),trunk=wood.length?merge(wood):null;let radius=0,maxY=0;for(const g of[foliage,trunk].filter(Boolean)){const P=g.attributes.position;for(let i=0;i<P.count;i++){radius=Math.max(radius,Math.hypot(P.getX(i),P.getZ(i)));maxY=Math.max(maxY,P.getY(i));}}
  return{foliage,trunk,radius,maxY};
}
function instances(scene,kind,plants,t){
  if(!plants.length){t.foliage.dispose();t.trunk?.dispose();return[];}
  const meshes=[],matrices=plants.map(p=>new THREE.Matrix4().compose(new THREE.Vector3(p.x,p.y,p.z),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),p.rotation),new THREE.Vector3(p.width,p.height,p.width)));
  for(const[geometry,name,wood]of[[t.foliage,'crown',false],[t.trunk,'branches',true]]){if(!geometry)continue;
    const material=new THREE.MeshStandardMaterial({vertexColors:true,color:wood?(kind==='pine'?0x75614a:0x675447):0xffffff,roughness:1,envMapIntensity:.35});
    const m=new THREE.InstancedMesh(geometry,material,plants.length);m.name=`capture-${kind}-${name}`;plants.forEach((p,i)=>m.setMatrixAt(i,matrices[i]));m.instanceMatrix.needsUpdate=true;m.computeBoundingSphere();m.castShadow=true;m.receiveShadow=true;scene.add(m);meshes.push(m);
  }return meshes;
}
export function buildCapturedLandscape(scene,D,C,hAt,surfAt){
  const kinds=['cherry','bare','pine','sculpted','shrub'],templates=Object.fromEntries(kinds.map(k=>[k,template(k)])),plants=Object.fromEntries(kinds.map(k=>[k,[]])),models=[],rand=random(20250455),zoneCounts={};
  for(const zone of ZONES){let count=0;const t=templates[zone.kind],step=Math.max(1,Math.round(zone.spacing/(C.ds||2)));
    for(let i=zone.from;i<=Math.min(zone.to,C.n-1);i+=step){const height=zone.height[0]+rand()*(zone.height[1]-zone.height[0]),width=zone.width[0]+rand()*(zone.width[1]-zone.width[0]),radius=t.radius*width,off=(C.halfWidth[i]+radius+zone.gap)*zone.side,along=(rand()-.5)*1.3;
      const x=C.x[i]+C.tz[i]*off+C.tx[i]*along,z=C.z[i]-C.tx[i]*off+C.tz[i]*along;if(!allowed(x,z,radius,D,C,surfAt))continue;
      // Suppress cross-zone duplicates while allowing intentionally joined hedge lobes.
      if(zone.kind!=='shrub'&&zone.kind!=='sculpted'&&Object.values(plants).flat().some(a=>a.kind!=='shrub'&&Math.hypot(a.x-x,a.z-z)<Math.min(a.radius,radius)*1.15))continue;
      const y=hAt(x,z);if(!Number.isFinite(y))continue;plants[zone.kind].push({kind:zone.kind,zone:zone.id,progress:i,x,y,z,height,width,radius,rotation:rand()*Math.PI*2,courseClearanceM:margin(x,z,C)-radius,photos:[...zone.photos],estimated:true});count++;
    }zoneCounts[zone.id]=count;
  }
  for(const k of kinds)models.push(...instances(scene,k,plants[k],templates[k]));
  const all=Object.values(plants).flat(),metadata={source:'User-supplied Naver captures 1–55, April 2025; per-image audits retain location uncertainty',positions:'Estimated composition on existing course/OSM footprints, not individual surveyed trees',season:'Early spring: airy pale blossoms, visible deciduous branches, dark pines and clipped evergreen shrubs',counts:Object.fromEntries(kinds.map(k=>[k,plants[k].length])),zoneCounts,drawCalls:models.length,triangles:models.reduce((n,m)=>n+(m.geometry.index?m.geometry.index.count:m.geometry.attributes.position.count)/3*m.count,0),minimumCourseClearanceM:Math.min(...all.map(a=>a.courseClearanceM)),existingW4StreetscapePreserved:true,physicalSurfaceChanged:false,collisionAdded:false};
  models.forEach(m=>m.userData.captureLandscape=metadata);return{models,plants,metadata,zones:getCaptureLandscapeZones()};
}
