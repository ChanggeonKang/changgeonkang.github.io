// User April 2025 captures 56–78 (+ 77_left/right), individually reviewed.
// Procedural geometry only: unchanged OSM footprints, estimated facade/plant sizes.
// This module does not mutate terrain, road alignment, collision or source data.
import * as THREE from '../lib/three.module.min.js';
import {campusName} from './campus-identity.js';

export const eastRoadStyles=Object.freeze([
  {from:35,to:100,center:'double',edges:'white',photos:[56,57,58]},
  {from:101,to:186,center:'single',edges:'yellow',photos:[59,60]},
  {from:187,to:211,center:'dashed',edges:'yellow',photos:[61]},
  {from:212,to:635,center:'single',edges:'yellow',photos:[62,63,64,65,66,67,68,69,70,71,72,73,74,75,76,77,78]}
]);
export const eastSpeedMarks=Object.freeze([{progress:359,photos:[67]},{progress:576,photos:[76]},{progress:607,photos:[77]}]);
export const eastBumps=Object.freeze([
  {progress:94,progressRange:[84,104],photoNumbers:[58],evidence:'Yellow/white hump foreground at the E6-5 west approach; aligned to existing OSM node11740688257 within camera-position uncertainty.',matchedOsmId:11740688257},
  {progress:413,progressRange:[403,423],photoNumbers:[69],evidence:'Yellow/white hump immediately south-east of E19 at the bend.'},
  {progress:487,progressRange:[477,497],photoNumbers:[71],evidence:'Hump ahead on the southern straight; matched to existing OSM node13895389602. Separate from the following junction hump.',matchedOsmId:13895389602},
  {progress:504,progressRange:[494,514],photoNumbers:[73],evidence:'Yellow/white hump foreground at the E2-1 junction; matched to existing OSM node13895374977.',matchedOsmId:13895374977},
  {progress:588,progressRange:[578,598],photoNumbers:[76],evidence:'Raised yellow/white crossing east of the main-gate junction; matched to existing OSM node13895377385.',matchedOsmId:13895377385},
  {progress:608,progressRange:[598,618],photoNumbers:[77],evidence:'Separate yellow/white crossing west of the main-gate junction.'}
].map(v=>Object.freeze({...v,heightM:.1,lengthM:3.6,confidence:'approximate',dimensionStatus:'Conventional game assumption, not measured from screenshots. Location uncertainty approximately ±20m.'})));

const CONFIG={
 E11:{style:'glassPiers',height:19.4,floors:4,color:0xc3bdc0,photos:[56,57],panoramas:['SQ8t-HRG5_9Frj7gCadegQ','gzRHmQU-JJvVRlUtg2zDFw']},
 'E6-5':{style:'labTower',height:26,floors:7,color:0xd3d0c2,photos:[58]},
 'E6-4':{style:'chemistryBrick',height:20.2,floors:5,color:0xa56850,photos:[58,59,63]},
 'E6-6':{style:'ribs',height:23.6,floors:6,color:0xc3c9cd,photos:[59,60,62]},
 E12:{style:'energy',height:7.4,floors:1,color:0xe3e4df,photos:[59,60],panoramas:['ldSUrvpB1oPzh1g5zi2vcw','hMLCrbvpbzQJMGEB8s9CTA']},
 E10:{style:'framedBrick',height:8.4,floors:2,color:0x865b52,photos:[61]},
 E8:{style:'dorm',height:13.3,floors:4,color:0xc3b9a1,photos:[62]},
 E22:{style:'ibsFins',height:23.6,floors:5,color:0xc7cecc,photos:[64,65,66]},
 'E3-3':{style:'service',height:8.4,floors:2,color:0xd8d9d0,photos:[66]},
 E19:{style:'nanoGlass',height:25.2,floors:6,color:0xc9cfce,photos:[67,68,69,70]},
 E18:{style:'ribbon',height:14.6,floors:4,color:0x9b9d94,photos:[68]},
 'E2-1':{style:'ribbon',height:20.4,floors:5,color:0xd6dad4,photos:[73,74]}
};
const ID_CONFIG={
 1524527051:{style:'parkingFins',height:15.2,floors:4,color:0xcdd6d5,photos:[67],confidence:'medium footprint-relative match; not a legible source reference'},
 543304604:{style:'ribbon',height:19.1,floors:5,color:0xe0e2dc,photos:[71,72],confidence:'medium; candidate E3-1 slab, source has no reference so no new ref assigned'},
 1524577593:{style:'socTower',height:22.5,floors:6,color:0xd9dedc,photos:[71,72],confidence:'E3-5 footprint and KAIST exterior confirmed; bay widths and elevation are approximate'},
 1290618742:{style:'gasStore',height:4.2,floors:1,color:0xd4d6cf,photos:[69],confidence:'medium; OSM names this a cooling-gas store, tank dimensions are visual estimates'}
};
const mix=(a,b,t)=>a+(b-a)*t,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function inPoly(x,z,p){let r=false;for(let i=0,j=p.length-1;i<p.length;j=i++)if((p[i][1]>z)!==(p[j][1]>z)&&x<(p[j][0]-p[i][0])*(z-p[i][1])/(p[j][1]-p[i][1])+p[i][0])r=!r;return r;}
function distance(x,z,a,b){const dx=b[0]-a[0],dz=b[1]-a[1],t=clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1),0,1);return Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz);}
function boundary(x,z,p){return Math.min(...p.map((a,i)=>distance(x,z,a,p[(i+1)%p.length])));}
class Batch{
 constructor(){this.p=[];this.n=[];this.c=[];}
 tri(a,b,c,color,normal){const u=new THREE.Vector3(...b).sub(new THREE.Vector3(...a)),v=new THREE.Vector3(...c).sub(new THREE.Vector3(...a)),n=u.cross(v);if(n.lengthSq()<1e-12)return;if(normal&&n.dot(new THREE.Vector3(...normal))<0)[b,c]=[c,b];const N=normal||n.normalize().toArray(),C=new THREE.Color(color);for(const p of[a,b,c]){this.p.push(...p);this.n.push(...N);this.c.push(C.r,C.g,C.b);}}
 quad(a,b,c,d,color,n){this.tri(a,b,c,color,n);this.tri(a,c,d,color,n);}
 add(g,m,color,p=null){const q=g.index?g.toNonIndexed():g,P=q.attributes.position,N=q.attributes.normal,A=new THREE.Vector3(),B=new THREE.Vector3(),nm=new THREE.Matrix3().getNormalMatrix(m),out=[],norm=[],col=new THREE.Color(color);for(let i=0;i<P.count;i++){A.fromBufferAttribute(P,i).applyMatrix4(m);if(p&&!inPoly(A.x,A.z,p)&&boundary(A.x,A.z,p)>.002){if(q!==g)q.dispose();g.dispose();return false;}out.push(A.x,A.y,A.z);B.fromBufferAttribute(N,i).applyMatrix3(nm).normalize();norm.push(B.x,B.y,B.z);}this.p.push(...out);this.n.push(...norm);for(let i=0;i<P.count;i++)this.c.push(col.r,col.g,col.b);if(q!==g)q.dispose();g.dispose();return true;}
 box(x,y,z,w,h,d,color,p=null,rotation=0){return this.add(new THREE.BoxGeometry(w,h,d),new THREE.Matrix4().compose(new THREE.Vector3(x,y,z),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),rotation),new THREE.Vector3(1,1,1)),color,p);}
 mesh(name,material){if(!this.p.length)return null;const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(this.p,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(this.n,3));g.setAttribute('color',new THREE.Float32BufferAttribute(this.c,3));g.computeBoundingSphere();const m=new THREE.Mesh(g,material);m.name=name;m.castShadow=true;m.receiveShadow=true;return m;}
}
function faces(p,fn){const s=Math.sign(p.reduce((v,a,i)=>{const b=p[(i+1)%p.length];return v+a[0]*b[1]-b[0]*a[1];},0))||1;for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length],L=Math.hypot(b[0]-a[0],b[1]-a[1]);if(L>.01)fn(a,b,L,[s*(b[1]-a[1])/L,0,-s*(b[0]-a[0])/L],i);}}
function panel(B,a,b,t0,t1,y0,y1,c,n){t0=clamp(t0,0,1);t1=clamp(t1,0,1);if(t1<=t0||y1<=y0)return;const pt=(t,y)=>[mix(a[0],b[0],t),y,mix(a[1],b[1],t)];B.quad(pt(t0,y0),pt(t1,y0),pt(t1,y1),pt(t0,y1),c,n);}
function roof(B,p,y,c){for(const t of THREE.ShapeUtils.triangulateShape(p.map(q=>new THREE.Vector2(...q)),[]))B.tri(...t.map(i=>[p[i][0],y,p[i][1]]),c,[0,1,0]);}
function interior(p,r){const xs=p.map(a=>a[0]),zs=p.map(a=>a[1]);let best=null,clear=r;for(let x=Math.min(...xs)+r;x<Math.max(...xs)-r;x+=2)for(let z=Math.min(...zs)+r;z<Math.max(...zs)-r;z+=2){if(inPoly(x,z,p)){const d=boundary(x,z,p);if(d>clear){best=[x,z];clear=d;}}}return best;}
// KAIST's E3-5 exterior (news.kaist.ac.kr/news/html/news/?mode=V&mng_no=46670)
// and captures 71–72 show four rows of punched upper windows above two glazed
// levels. Its blue end glazing wraps the corner. The separate solar carports
// are oriented to the mapped parking bays, not the building.
function socFacade(B, p, base, height) {
 const axis = ([x,z]) => x * .53 + z * .85;
 const endBay = Math.max(...p.map(axis)) - 9;
 const step = height / 6;
 faces(p, (a,b,length,normal) => {
  const strip = (batch,left,right,low,high,color) => panel(batch,a,b,left,right,base+low,base+high,color,normal);
  const bays = Math.max(1, Math.round(length / 3.55));
  strip(B.glass,0,1,.3,2*step,0x48869a);
  for(let j=0; j<bays; j++){
   const left = j/bays, right = (j+1)/bays;
   const glazedEnd = mix(axis(a),axis(b),(left+right)/2) >= endBay;
   if(glazedEnd){
    strip(B.glass,left,right,2*step,height-1,j%2 ? 0x397d90 : 0x458798);
   }else{
    for(let f=2; f<6; f++){
     const low = f*step+.48, high = Math.min((f+1)*step-.72,height-1.12);
     strip(B.glass,left+.15/bays,right-.11/bays,low,high,0x426c80);
     strip(B.detail,left+.15/bays,right-.11/bays,low,low+.22,0x749aa4);
    }
   }
   const mullionTop = glazedEnd ? height-.18 : 2*step;
   strip(B.detail,left,left+.07/length,.3,mullionTop,0xaab8b9);
   strip(B.glass,left,right,height-1,height-.18,0x448d9f);
   for(let f=1; f<6; f++){
    if(f<2 || glazedEnd) strip(B.detail,left,right,f*step-.04,f*step+.04,0xb0bdbc);
    else for(const drop of [.06,.29,.52]) strip(B.detail,left,right,f*step-drop-.10,f*step-drop,0xadb5b6);
   }
  }
 });
}
// The E12 service plant faces the science road. In the November panorama
// hMLCrbvpbzQJMGEB8s9CTA and captures 59/60, its ductwork rises above a
// white parapet and a faceted flue flares into a hood below a red rim.
function energyPlant(B,p,base,height) {
 const top=base+height;
 faces(p,(a,b,length,normal)=>{
  if(length<8)return;
  const bays=Math.max(1,Math.round(length/15));
  for(let bay=0;bay<bays;bay++){
   const left=(bay+.08)/bays,right=(bay+.92)/bays;
   panel(B.detail,a,b,left,right,base+.16,base+3.52,0x735850,normal);
   panel(B.glass,a,b,left,right,base+3.62,base+4.68,0x39454a,normal);
   const lights=Math.max(2,Math.round(length*(right-left)/1.9));
   for(let j=1;j<lights;j++){
    const t=mix(left,right,j/lights);
    panel(B.detail,a,b,t-.04/length,t+.04/length,base+3.62,base+4.68,0x8a918e,normal);
   }
  }
  panel(B.detail,a,b,0,1,top-.14,top,0xbac2bf,normal);
 });
 const x=219,z=-132;
 // Lower shaft, flared collar, tapered octagonal hood, and coloured rim.
 for(const [bottom,upper,lowerRadius,upperRadius,color] of [
  [height,14.6,1.50,1.47,0xd3d7d4],[14.6,15.65,1.47,2.57,0xb0b9bb],
  [15.65,16.32,2.57,2.57,0xa6afb1],[16.32,18.55,2.48,1.83,0xc1c9c8],
  [18.55,20.30,1.83,1.65,0xd3d8d5],[20.30,21.12,1.65,1.55,0xa54f50]
 ]){
  const shell=new THREE.CylinderGeometry(upperRadius,lowerRadius,upper-bottom,8,1,false,Math.PI/8);
  B.detail.add(shell,new THREE.Matrix4().makeTranslation(x,base+(bottom+upper)/2,z),color,p);
 }
 const rotation=.56, along=[Math.cos(rotation),-Math.sin(rotation)], front=[-along[1],along[0]];
 // Louvered housings visible on either side of the flue above the low roof.
 for(const [cx,cz,width,depth,rise] of [[194.4,-134.4,9.2,5,2.85],[233.5,-145,11.6,4.8,2.55]]){
  const piece=(u,v,y,w,h,d,col)=>B.detail.box(cx+along[0]*u+front[0]*v,top+y,cz+along[1]*u+front[1]*v,w,h,d,col,p,rotation);
  piece(0,0,rise/2,width,rise,depth,0x9aa4a4);
  piece(0,0,rise+.05,width+.12,.12,depth+.12,0xc7ceca);
  piece(0,depth/2+.015,rise*.5,width-.5,rise-.45,.045,0x56666b);
  for(let y=.44;y<rise-.15;y+=.37)piece(0,depth/2+.06,y,width-.45,.095,.09,0xaab3b1);
 }
}

function building(B,b,cfg,hAt){
 const p=b.p,ref=b.ref,base=Math.min(...p.map(a=>hAt(...a)))-.4,H=cfg.height,top=base+H,style=cfg.style;
 faces(p,(a,b,L,n)=>panel(B.wall,a,b,0,1,base,top,cfg.color,n));roof(B.wall,p,top,0x78817e);
 if(style==='socTower'){
  socFacade(B,p,base,H);
  return {base,height:H,top,footprintPreserved:true,sourcePhotos:cfg.photos,style,dimensionStatus:'Six above-ground floors confirmed by KAIST; metric height estimated.',confidence:cfg.confidence};
 }
 if(style==='energy'){
  energyPlant(B,p,base,H);
  return{base,height:H,top,footprintPreserved:true,sourcePhotos:cfg.photos,panoramas:cfg.panoramas,style,
   confidence:'Facade, equipment and flue silhouette matched to photos 59–60 and the November street view; heights and positions estimated.'};
 }
 faces(p,(a,b,L,n)=>{
  if(L<1.2)return;const slots=Math.max(1,Math.round(L/(style==='ibsFins'?1.35:style==='ribs'?.85:3.1)));
  if(style==='ribs'){
   // E6-6's street-facing screen is silver, with glazing recessed in thin
   // horizontal bands and fine metal ribs continuing over the openings.
   const step=H/cfg.floors;
   for(let f=0;f<cfg.floors;f++){
    const sill=base+(f+.28)*step;
    panel(B.glass,a,b,0,1,sill,sill+step*.28,0x4c5c64,n);
   }
   for(let j=0;j<slots;j++){
    const t=(j+.5)/slots;
    panel(B.detail,a,b,t-.043/L,t+.043/L,base+.15,top-.12,j%5===0?0x99a6af:0xabb5bd,n);
   }
  }else if(['ibsFins','parkingFins'].includes(style)){
   panel(B.glass,a,b,.012,.988,base+.45,top-.4,0x477481,n);
   for(let j=0;j<slots;j++){const t=(j+.5)/slots,w=(style==='parkingFins'?.48:.19)/slots;panel(B.detail,a,b,t-w/2,t+w/2,base+.5,top-.3,style==='parkingFins'?[0xb9c6d0,0xe1e0d3,0x829aaf,0xd1c69b][j%4]:cfg.color,n);}
   for(let f=0;f<=cfg.floors;f++){const y=base+f*H/cfg.floors;panel(B.detail,a,b,0,1,y,Math.min(top,y+(style==='ibsFins'?.65:.3)),cfg.color,n);}
  }else if(style==='chemistryBrick'){
   const floor=H/cfg.floors, bays=Math.max(1,Math.round(L/7.4));
   panel(B.glass,a,b,0,1,base+.12,base+floor-.22,0x33464a,n);
   for(let f=1;f<cfg.floors;f++){
    const sill=base+f*floor+.44;
    for(let j=0;j<bays;j++){
     const left=(j+.08)/bays,right=(j+.92)/bays;
     panel(B.glass,a,b,left,right,sill,sill+1.86,0x354448,n);
     for(let m=1;m<=2;m++){const t=mix(left,right,m/3);panel(B.detail,a,b,t-.035/L,t+.035/L,sill,sill+1.86,0x596366,n);}
    }
    for(const lift of [0,.25])panel(B.detail,a,b,0,1,sill+2.03+lift,sill+2.07+lift,0xc18a70,n);
   }
  }else if(style==='glassPiers' && -.54*n[0]-.84*n[2]>.8){
   // At E11 the pale stone is the broad face of each bay. The teal glazing
   // and near-black stair slots occupy one side. November stations 29 and 65.
   const bays=Math.max(1,Math.round(L/14.5));
   for(let bay=0;bay<bays;bay++){
    const left=(bay+.585)/bays,right=(bay+.955)/bays;
    panel(B.glass,a,b,right,(bay+1)/bays,base+.28,top-.6,0x354a51,n);
    for(let f=0;f<cfg.floors;f++){
     const low=base+.28+(H-5.23)*f/cfg.floors,high=base+.28+(H-5.23)*(f+1)/cfg.floors;
     panel(B.glass,a,b,left,right,low,high,[0x567e88,0x6a969d,0x719da3,0x65999e][f],n);
     if(f)panel(B.detail,a,b,left,right,low-.1,low+.1,0x485c61,n);
    }
    for(let j=1;j<=2;j++){
     const t=mix(left,right,j/3);
     panel(B.detail,a,b,t-.035/L,t+.035/L,base+.28,top-4.95,0x54666b,n);
    }
    panel(B.glass,a,b,(bay+.006)/bays,right,top-3.21,top-1.55,0x648fab,n);
    for(let y=base+1.15;y<top-3.3;y+=1.26)panel(B.detail,a,b,(bay+.004)/bays,left,y,y+.037,0xb4afb1,n);
    for(let j=1;j<=3;j++){
     const t=mix(bay/bays,left,j/4);
     panel(B.detail,a,b,t-.023/L,t+.023/L,base+.12,top-3.3,0xb5afb0,n);
    }
   }
  }else if(style==='glassPiers'){
   panel(B.glass,a,b,.025,.975,base+.8,top-1,0x527e88,n);
   const bays=Math.max(1,Math.round(L/9));
   for(let j=0;j<=bays;j++)panel(B.detail,a,b,j/bays-.75/L,j/bays+.75/L,base,top-3,cfg.color,n);
   for(let f=1;f<cfg.floors;f++)panel(B.detail,a,b,0,1,base+f*H/cfg.floors,base+f*H/cfg.floors+.13,0x9ba9a8,n);
  }else if(style==='labTower'&&L<18){
   panel(B.glass,a,b,.47,.54,base+.6,top-2.4,0x47747b,n);
  }else{
   const band=['ribbon','labTower','nanoGlass','service'].includes(style),F=cfg.floors;
   for(let f=0;f<F;f++){
    const y=base+.75+f*(H-.5)/F,wh=style==='nanoGlass'?H/F*.7:1.6;
    if(band){panel(B.glass,a,b,.025,.975,y,Math.min(top-.45,y+wh),style==='nanoGlass'?0x3c6077:0x45656b,n);for(let j=1;j<Math.max(2,Math.round(L/2.5));j++){const t=j/Math.round(L/2.5);panel(B.detail,a,b,t-.025/L,t+.025/L,y,y+wh,0xa4b5b4,n);}}
    else for(let j=0;j<slots;j++){const t=(j+.5)/slots,w=.61/slots;panel(B.glass,a,b,t-w/2,t+w/2,y,y+wh,0x4b686d,n);panel(B.detail,a,b,t-w/2,t+w/2,y-.08,y,0xbabeb4,n);}
    if(style==='framedBrick'){panel(B.detail,a,b,0,1,y-.7,y-.4,0xd5d8d0,n);for(let j=0;j<=slots;j++)panel(B.detail,a,b,Math.max(0,j/slots-.14/L),Math.min(1,j/slots+.14/L),base,top,0xc9d0c8,n);}
   }
  }
  // Fine facade joints add scale without external texture assets.
  if(style==='brick')for(let y=base+.2;y<top;y+=.28)panel(B.detail,a,b,0,1,y,y+.018,0x6e514a,n);
  if(ref==='E2-1'&&L>6&&L<14){panel(B.detail,a,b,.05,.95,base,top,0x707a7b,n);panel(B.glass,a,b,.45,.55,base+1,top-1,0x3f646b,n);}
 });
 if(style==='glassPiers'){
  // Low dark roof monitor behind the stone parapet, visible on approach.
  B.detail.box(48,top+.52,-52,14,.98,2.9,0x899298,p,.57);
  B.detail.box(48,top+1.07,-52,17.6,.18,3.6,0x566169,p,.57);
 }
 if(style==='dorm'){
  // Triangulated low hipped facets preserve concave source wings too.
  for(const indices of THREE.ShapeUtils.triangulateShape(p.map(q=>new THREE.Vector2(...q)),[])){
   const t=indices.map(i=>p[i]),q=[t.reduce((s,a)=>s+a[0],0)/3,t.reduce((s,a)=>s+a[1],0)/3];
   for(let i=0;i<3;i++)B.detail.tri([t[i][0],top,t[i][1]],[t[(i+1)%3][0],top,t[(i+1)%3][1]],[q[0],top+Math.min(2.1,boundary(...q,p)*.55),q[1]],0x575d55,[0,1,0]);
  }
 }
 if(style==='gasStore'){
  const q=interior(p,3.2);if(q)for(const dx of[-2,2]){const x=q[0]+dx,z=q[1];B.detail.add(new THREE.CylinderGeometry(1.65,1.65,12.5,16),new THREE.Matrix4().makeTranslation(x,base+6.25,z),0xe2e4db,p);B.detail.add(new THREE.SphereGeometry(1.65,12,6,0,Math.PI*2,0,Math.PI/2),new THREE.Matrix4().makeTranslation(x,base+12.5,z),0xe2e4db,p);}
 }
 return{base,height:H,top,footprintPreserved:true,sourcePhotos:cfg.photos,...(cfg.panoramas && {panoramas:cfg.panoramas}),style,dimensionStatus:'Visual estimates; not surveyed; original OSM footprint retained',confidence:cfg.confidence||'high building match; approximate dimensions'};
}

const ZONES=[
 {id:'e11-open-lawn',from:35,to:104,side:-1,kind:'bare',step:13,gap:5,height:8,width:5,photos:[56,57]},
 {id:'e11-lawn-shrubs',from:35,to:104,side:-1,kind:'shrub',step:5,gap:3,height:.8,width:2.1,photos:[56,57]},
 {id:'energy-cloud-pruned',from:135,to:192,side:1,kind:'sculpted',step:6,gap:3,height:6.8,width:4.8,photos:[59,60]},
 {id:'chemistry-cherries',from:127,to:177,side:-1,kind:'cherry',step:9,gap:4,height:8.1,width:6.4,photos:[58,59,60]},
 {id:'science-east-cherries',from:210,to:341,side:-1,kind:'cherry',step:9,gap:3,height:7.8,width:6.3,photos:[61,62,63,64,65,66]},
 {id:'sejong-parking-cherries',from:213,to:257,side:1,kind:'cherry',step:12,gap:5,height:8.5,width:7,photos:[62,63]},
 {id:'ibs-young-staked-trees',from:269,to:336,side:1,kind:'bare',step:8,gap:3,height:5.2,width:2.8,photos:[64,65,66]},
 {id:'nano-east-cherries',from:344,to:435,side:-1,kind:'cherry',step:9,gap:3,height:8.4,width:6.6,photos:[67,68,69,70]},
 {id:'nano-east-pines',from:380,to:445,side:-1,kind:'pine',step:15,gap:10,height:10.5,width:7.5,photos:[68,69,70]},
 {id:'nano-left-shrubs',from:348,to:436,side:1,kind:'shrub',step:5,gap:3,height:.85,width:2.2,photos:[67,68,69,70]},
 {id:'south-evergreen-screen',from:433,to:533,side:1,kind:'conifer',step:10,gap:20,height:14,width:7.5,photos:[70,71,72,73,74]},
 {id:'south-left-bare-row',from:435,to:577,side:1,kind:'bare',step:9,gap:3.2,height:8.3,width:4.9,photos:[70,71,72,73,74,75]},
 {id:'south-left-clipped-row',from:431,to:581,side:1,kind:'shrub',step:5,gap:2.6,height:.75,width:2.2,photos:[70,71,72,73,74,75,76]},
 {id:'south-right-bare-row',from:444,to:578,side:-1,kind:'bare',step:9,gap:3.5,height:8.7,width:5.2,photos:[71,72,73,74,75]},
 {id:'south-right-clipped-row',from:441,to:632,side:-1,kind:'shrub',step:5,gap:3.4,height:.8,width:2.3,photos:[71,72,73,74,75,76,77,78]},
 {id:'gate-pines-north',from:564,to:632,side:-1,kind:'pine',step:13,gap:10,height:13,width:9.4,photos:[75,76,77,'77_right',78]},
 {id:'gate-pines-south',from:580,to:624,side:1,kind:'pine',step:13,gap:11,height:12.5,width:8.7,photos:[76,77,'77_left',78]},
 {id:'gate-west-bare',from:609,to:636,side:-1,kind:'bare',step:9,gap:4.5,height:8.8,width:5.5,photos:[77,78]}
];
let managed=[];
// Suppress generic tree centres only in the actual accepted photographic plant
// crowns. This avoids blanket removal of the surrounding campus woodland.
export function isCaptureEastManaged(x,z){return managed.some(p=>(x-p.x)**2+(z-p.z)**2<(p.radius+2.5)**2);}

// November 2026 street views at 58–59 show an opaque silver link, its blue
// forked steelwork and a timber bench on the lawn beside the mapped footway.
function e6Courtyard(B,D,C,hAt,surfAt){
 const chemistry=D.buildings.find(b=>b.ref==='E6-4'), science=D.buildings.find(b=>b.ref==='E6-6');
 if(!chemistry||!science)return null;
 // These two attachment lines sit just inside the facing source footprints.
 const start=[231.7,-53.4],end=[236.1,-74.8],width=4.1;
 const dx=end[0]-start[0],dz=end[1]-start[1],length=Math.hypot(dx,dz);
 const angle=Math.atan2(dx,dz);
 const at=(along,across)=>[start[0]+(dx*along+dz*across)/length,start[1]+(dz*along-dx*across)/length];
 if(![-1,1].every(sign=>inPoly(...at(0,sign*width/2),chemistry.p)&&inPoly(...at(length,sign*width/2),science.p)))return null;
 const soffit=(hAt(...start)+hAt(...end))*.5+8.4, wallHeight=3.35;
 function box(along,across,y,w,h,d,color){
  const [x,z]=at(along,across);
  B.detail.box(x,y,z,w,h,d,color,null,angle);
 }
 box(length/2,0,soffit+wallHeight/2,width,wallHeight,length,0xb4bec5);
 box(length/2,0,soffit,width+.14,.23,length,0x495866);
 box(length/2,0,soffit+wallHeight,width+.14,.14,length,0xc4cdd0);
 const panels=Math.ceil(length/1.8);
 for(const side of [-1,1]){
  for(let j=1;j<panels;j++){
   box(j*length/panels,side*width/2,soffit+wallHeight/2,.035,wallHeight-.12,.04,0x9ea9b2);
  }
 }
 const supports=[];
 function steel(from,to,width){
  const a=new THREE.Vector3(...from),b=new THREE.Vector3(...to),axis=b.clone().sub(a);
  const geometry=new THREE.BoxGeometry(width,axis.length(),width);
  const rotation=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),axis.normalize());
  B.detail.add(geometry,new THREE.Matrix4().compose(a.lerp(b,.5),rotation,new THREE.Vector3(1,1,1)),0x35759c);
 }
 for(const across of [-1.38,1.38]){
  const station=length*.48,[x,z]=at(station,across),ground=hAt(x,z),joint=[x,soffit-3.6,z];
  box(station,across,ground+.08,.63,.24,.73,0x8f9692);
  steel([x,ground+.12,z],joint,.29);
  for(const ahead of [-3.25,3.25]){
   const [ex,ez]=at(station+ahead,across);
   steel(joint,[ex,soffit-.06,ez],.29);
  }
  supports.push([x,z]);
 }
 // The central grass and paved approach are already drawn from the map.
 // The bench stands behind the roadside path and faces the course.
 const bench=[197.3,-73],heading=.18;
 if(free(...bench,1.3,D,C,surfAt)){
  const [x,z]=bench,y=hAt(x,z);
  const benchPoint=(u,v)=>[x+Math.cos(heading)*u+Math.sin(heading)*v,z-Math.sin(heading)*u+Math.cos(heading)*v];
  for(const u of [-.74,.74]){
   const [px,pz]=benchPoint(u,0);
   const base=Math.min(...[-.045,.045].flatMap(du=>[-.215,.215].map(v=>hAt(...benchPoint(u+du,v)))))-.04;
   B.detail.box(px,(base+y+.44)*.5,pz,.09,y+.44-base,.43,0x424b4d,null,heading);
   const [bx,bz]=benchPoint(u,.22);
   B.detail.box(bx,y+.65,bz,.08,.52,.07,0x424b4d,null,heading);
  }
  for(const off of [-.17,0,.17]){
   const [px,pz]=benchPoint(0,off);
   B.detail.box(px,y+.46,pz,2.05,.065,.145,0x704f41,null,heading);
  }
  const [bx,bz]=benchPoint(0,.24);
  for(const lift of [.67,.82])B.detail.box(bx,y+lift,bz,2.05,.115,.06,0x795647,null,heading);
 }
 return {attachments:[{ref:chemistry.ref,point:start},{ref:science.ref,point:end}],width,length,soffit,wallHeight,supports,
  sourceViews:['2026-11-20-B-midpoint','2026-11-20-B-e6-right'],dimensions:'Estimated from two street views and the mapped building outlines.'};
}
function courseMargin(x,z,C){let d=Infinity;for(let i=0;i<C.n;i++){const j=(i+1)%C.n;d=Math.min(d,distance(x,z,[C.x[i],C.z[i]],[C.x[j],C.z[j]])-Math.max(C.halfWidth[i],C.halfWidth[j]));}return d;}
function free(x,z,r,D,C,surfAt,grass=true){
 if(grass&&surfAt(x,z)!==0||courseMargin(x,z,C)<r+1)return false;
 for(const b of D.buildings)if(inPoly(x,z,b.p)||boundary(x,z,b.p)<r+.45)return false;
 for(const a of D.areas)if(['water','pitch'].includes(a.k)&&inPoly(x,z,a.p))return false;
 for(let k=0;k<12;k++){const a=k*Math.PI/6,s=surfAt(x+Math.cos(a)*r,z+Math.sin(a)*r);if([2,3,8,9].includes(s))return false;}
 return true;
}
function random(seed){let s=seed>>>0;return()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296);}
function treeTemplate(kind){
 const wood=new Batch(),leaf=new Batch(),rand=random(6789),branch=(a,b,r)=>{const A=new THREE.Vector3(...a),B=new THREE.Vector3(...b),d=B.clone().sub(A);wood.add(new THREE.CylinderGeometry(r*.45,r,d.length(),5),new THREE.Matrix4().compose(A.add(B).multiplyScalar(.5),new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize()),new THREE.Vector3(1,1,1)),kind==='pine'?0x805e46:0x715c49);},blob=(x,y,z,sx,sy,sz,c,detail=0)=>leaf.add(new THREE.IcosahedronGeometry(1,detail),new THREE.Matrix4().compose(new THREE.Vector3(x,y,z),new THREE.Quaternion(),new THREE.Vector3(sx,sy,sz)),c);
 if(kind==='cherry'||kind==='bare'){
  branch([0,0,0],[.015,.9,0],.021);for(let j=0;j<8;j++){const a=j*2.399,y=.28+j*.06,e=[Math.cos(a)*.31,.64+rand()*.27,Math.sin(a)*.31];branch([0,y,0],e,.008);for(let k=0;k<3;k++){const t=.43+k*.24,q=[e[0]*t,y+(e[1]-y)*t,e[2]*t],v=[e[0]+Math.cos(a+k-1)*.09,e[1]+.06+rand()*.09,e[2]+Math.sin(a+k-1)*.09];branch(q,v,.0035);if(kind==='cherry')for(let n=0;n<3;n++){const u=.5+n*.23;blob(mix(q[0],v[0],u),mix(q[1],v[1],u),mix(q[2],v[2],u),.05,.035,.05,n%2?0xf4e9df:0xfff6e9);}}}
 }else if(kind==='pine'){
  branch([0,0,0],[.045,.98,.01],.025);for(let j=0;j<9;j++){const a=j*2.399,y=.57+j*.044,x=Math.cos(a)*.25,z=Math.sin(a)*.25;branch([.02,y-.2,0],[x,y,z],.009);blob(x,y,z,.23,.075,.21,j%2?0x486947:0x35583b,1);}
 }else if(kind==='conifer'){
  branch([0,0,0],[0,.98,0],.023);for(let j=0;j<6;j++){const y=.26+j*.12,r=.42-j*.055;leaf.add(new THREE.ConeGeometry(r,.34,8),new THREE.Matrix4().makeTranslation(0,y,0),j%2?0x3c5844:0x304c3a);}
 }else if(kind==='sculpted'){
  branch([0,0,0],[0,.94,0],.03);for(let j=0;j<5;j++)blob(j%2?.04:-.04,.2+j*.17,0,.44-j*.045,.14,.35-j*.03,j%2?0x536b3b:0x405b35,1);
 }else blob(0,.45,0,.5,.42,.45,0x516b35,1);
 const make=B=>{const m=B.mesh('template',new THREE.MeshStandardMaterial());if(!m)return null;const g=m.geometry;m.material.dispose();return g;};const trunk=make(wood),crown=make(leaf);let radius=0;for(const g of[trunk,crown].filter(Boolean)){const P=g.attributes.position;for(let i=0;i<P.count;i++)radius=Math.max(radius,Math.hypot(P.getX(i),P.getZ(i)));}return{trunk,crown,radius};
}
function vegetation(scene,D,C,hAt,surfAt){
 const kinds=['cherry','bare','pine','sculpted','conifer','shrub'],templates=Object.fromEntries(kinds.map(k=>[k,treeTemplate(k)])),plants=[],models=[],counts={},rand=random(20250478),details=new Batch();
 for(const zone of ZONES){let count=0;const t=templates[zone.kind];for(let i=zone.from;i<=zone.to;i+=zone.step){const width=zone.width*(.92+rand()*.16),height=zone.height*(.92+rand()*.16),radius=t.radius*width,off=zone.side*(C.halfWidth[i]+radius+zone.gap),x=C.x[i]+C.tz[i]*off,z=C.z[i]-C.tx[i]*off;if(!free(x,z,radius,D,C,surfAt))continue;if(zone.kind!=='shrub'&&plants.some(a=>a.kind!=='shrub'&&Math.hypot(a.x-x,a.z-z)<Math.min(radius,a.radius)*1.3))continue;const p={kind:zone.kind,zone:zone.id,progress:i,x,y:hAt(x,z),z,width,height,radius,rotation:rand()*Math.PI*2,photos:zone.photos,estimated:true};plants.push(p);count++;
   if(zone.id==='ibs-young-staked-trees'){for(const dx of[-.5,.5])details.box(x+dx,p.y+1.1,z,.06,2.2,.06,0x8b7555);details.box(x,p.y+1.65,z,1.08,.07,.07,0x8b7555);}
  }counts[zone.id]=count;}
 const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,envMapIntensity:.3});
 for(const kind of kinds){const a=plants.filter(p=>p.kind===kind),t=templates[kind];for(const [name,g]of Object.entries(t)){if(name==='radius'||!g)continue;if(!a.length){g.dispose();continue;}const m=new THREE.InstancedMesh(g,material,a.length);m.name=`east-${kind}-${name}`;a.forEach((p,i)=>m.setMatrixAt(i,new THREE.Matrix4().compose(new THREE.Vector3(p.x,p.y,p.z),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),p.rotation),new THREE.Vector3(p.width,p.height,p.width))));m.instanceMatrix.needsUpdate=true;m.computeBoundingSphere();m.castShadow=true;m.receiveShadow=true;scene.add(m);models.push(m);}}
 const stakes=details.mesh('east-tree-support-stakes',material);if(stakes){scene.add(stakes);models.push(stakes);}managed=plants;return{models,plants,zoneCounts:counts};
}
// November 2026 E3 street views, facing the parking lot from photos 71–72.
// Two separate curved roofs are visible. The dimensions and post spacing are
// estimates. The front row follows the southeast edge of OSM lot 504338839.
function e3SolarParking(batch, data, hAt) {
 if (!data.parking?.some(lot => lot.id === 504338839)) return [];
 const anchor = new THREE.Vector2(368.8, 300.8);
 const along = new THREE.Vector2(323.5, 291.4).sub(anchor).normalize();
 const inward = new THREE.Vector2(-along.y, along.x);
 const world = (u, v) => [anchor.x + u * along.x + v * inward.x, anchor.y + u * along.y + v * inward.y];
 const rows = [
  {name:'verge', panorama:'cbTYSEqsy7psd9LCN8hziA', start:2, end:44, front:-1.1, back:5.2, postsAt:-.25, bays:6},
  {name:'interior', panorama:'76nJgVy54Z3xDQc7SjFM1g', start:-16, end:11, front:18.4, back:24.05, postsAt:18.23, bays:4}
 ];
 const steel = 0x78858a, underside = 0x485256, edge = 0xb2bdc0;
 const up = new THREE.Vector3(0,1,0);
 function tube(a,b,radius,color,sides) {
  const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b);
  const delta = end.clone().sub(start);
  const transform = new THREE.Matrix4().compose(start.add(end).multiplyScalar(.5),
   new THREE.Quaternion().setFromUnitVectors(up,delta.clone().normalize()),new THREE.Vector3(1,1,1));
  batch.add(new THREE.CylinderGeometry(radius,radius,delta.length(),sides),transform,color);
 }
 return rows.map(row => {
  const {start,end,front,back,postsAt,bays} = row;
  const middle = (front+back)/2, width = back-front;
  const groundStart = hAt(...world(start,postsAt)), groundEnd = hAt(...world(end,postsAt));
  const roofY = (u,v) => mix(groundStart,groundEnd,(u-start)/(end-start)) + 3.82 - .49*((v-middle)/(width/2))**2;
  const surface = (u,v,offset=0) => {const [x,z]=world(u,v); return [x,roofY(u,v)+offset,z];};
  const sections = 4, panelColumns = Math.round((end-start)/2.1);
  for (let section=0; section<sections; section++) {
   const v0 = mix(front,back,section/sections), v1 = mix(front,back,(section+1)/sections);
   // Winding faces the underside towards the driver. The top panel faces use
   // the opposite winding; inset seams expose the lighter backing between them.
   batch.quad(surface(start,v0,-.095),surface(end,v0,-.095),surface(end,v1,-.095),surface(start,v1,-.095),underside);
   batch.quad(surface(start,v1),surface(end,v1),surface(end,v0),surface(start,v0),edge);
   // Interpolate on the flat facet so the modules cannot intersect the substrate.
   const panelPoint = (u,t) => {
    const a=surface(u,v0,.018), b=surface(u,v1,.018);
    return a.map((coord,i)=>mix(coord,b[i],t));
   };
   for (let col=0; col<panelColumns; col++) {
    const u0=mix(start,end,col/panelColumns)+.027, u1=mix(start,end,(col+1)/panelColumns)-.027;
    batch.quad(panelPoint(u0,.982),panelPoint(u1,.982),panelPoint(u1,.018),panelPoint(u0,.018),(section+col)%5 ? 0x354658 : 0x3e4d60);
   }
   for (const u of [start,end]) batch.quad(surface(u,v0,-.095),surface(u,v1,-.095),surface(u,v1),surface(u,v0),edge,
    [along.x*(u===start?-1:1),0,along.y*(u===start?-1:1)]);
  }
  for (const v of [front,back]) batch.quad(surface(start,v,-.095),surface(end,v,-.095),surface(end,v),surface(start,v),edge,
   [inward.x*(v===front?-1:1),0,inward.y*(v===front?-1:1)]);
  const supports = [];
  for (let i=0;i<=bays;i++) {
   const u = mix(start+.7,end-.7,i/bays), [x,z] = world(u,postsAt), ground = hAt(x,z);
   const postTop = surface(u,postsAt,-.13);
   tube([x,ground+.02,z],postTop,.122,steel,8);
   tube([x,ground+.02,z],[x,ground+.25,z],.23,0x9c9e95,8);
   const knee = [x,postTop[1]-.88,z];
   tube(knee,surface(u,middle+.49,-.11),.069,steel,6);
   if (i<bays) tube(knee,surface(u+1.18,postsAt,-.12),.05,steel,6);
   if (i>0) tube(knee,surface(u-1.18,postsAt,-.12),.05,steel,6);
   tube(surface(u,front,-.17),surface(u,middle,-.17),.08,steel,6);
   tube(surface(u,middle,-.17),surface(u,back,-.17),.08,steel,6);
   supports.push([x,z]);
  }
  return {kind:'solar-parking-roof',row:row.name,photos:[71,72],panorama:row.panorama,captureMonth:'2026-11',supports,
   footprint:[world(start,front),world(end,front),world(end,back),world(start,back)],estimated:true};
 });
}

function roadside(scene,D,C,hAt,surfAt){
 const B=new Batch(),items=[];
 // Pink/grey paving follows the actual terrain at vertices and is omitted at
 // connecting mapped roads, footprints and water. No terrain editing occurs.
 const ranges=[[45,105,-1],[217,340,-1],[269,336,1],[347,435,-1],[438,633,-1]];
 for(const[from,to,side]of ranges)for(let i=from;i<to;i+=2){const j=Math.min(to,i+2),q=[];let ok=true;for(const[k,extra]of[[i,1.05],[j,1.05],[j,3.8],[i,3.8]]){const off=(C.halfWidth[k]+extra)*side,x=C.x[k]+C.tz[k]*off,z=C.z[k]-C.tx[k]*off,s=surfAt(x,z);if([2,3,8,9].includes(s)||D.buildings.some(b=>inPoly(x,z,b.p)))ok=false;q.push([x,hAt(x,z)+.08,z]);}if(!ok)continue;B.quad(...q,i%4?0xb5b4ac:0xa5aaa7,[0,1,0]);const m=q.map(a=>[...a]);m[0]=q[0].map((v,k)=>mix(v,q[3][k],.64));m[1]=q[1].map((v,k)=>mix(v,q[2][k],.64));B.quad(...m.map(a=>[a[0],a[1]+.004,a[2]]),0xbba39b,[0,1,0]);items.push({kind:'sidewalk',progress:i,points:q,photos:from<200?[56,57]:from<347?[61,62,63,64,65,66]:[67,68,69,70,71,72,73,74,75,76,77,78]});}
 // The visible curved bicycle roofs are represented as small open shelters.
 for(const spec of[{i:455,side:-1,photos:[71]},{i:558,side:1,photos:[75]}]){const i=spec.i,off=spec.side*(C.halfWidth[i]+8),x=C.x[i]+C.tz[i]*off,z=C.z[i]-C.tx[i]*off,r=5.2;if(!free(x,z,r,D,C,surfAt,false))continue;const y=hAt(x,z),angle=Math.atan2(C.tx[i],C.tz[i]);for(const d of[-3.8,0,3.8]){const px=x+C.tx[i]*d,pz=z+C.tz[i]*d;B.box(px,y+1.15,pz,.08,2.3,.08,0x64867b,null,angle);}B.box(x,y+2.38,z,2.5,.12,8.8,0x719d96,null,angle);items.push({kind:'bicycle-shelter',x,z,radius:r,photos:spec.photos,estimated:true});}
 const solarParkingRows=e3SolarParking(B,D,hAt);
 const m=B.mesh('east-paving-and-shelters',new THREE.MeshStandardMaterial({vertexColors:true,roughness:.9}));if(m)scene.add(m);return{models:m?[m]:[],items,solarParkingRows};
}

export function buildCaptureEast(scene,D,C,hAt,surfAt){
 const B={wall:new Batch(),glass:new Batch(),detail:new Batch()},handledIds=new Set(),labels=[],buildings=[],ranges=[];
 for(const b of D.buildings){const cfg=CONFIG[b.ref]||ID_CONFIG[b.id];if(!cfg)continue;const starts=Object.fromEntries(Object.entries(B).map(([k,v])=>[k,v.p.length/3]));const info=building(B,b,cfg,hAt);for(const[k,v]of Object.entries(B))ranges.push({batch:k,id:b.id,start:starts[k],count:v.p.length/3-starts[k]});handledIds.add(b.id);const x=b.p.reduce((s,p)=>s+p[0],0)/b.p.length,z=b.p.reduce((s,p)=>s+p[1],0)/b.p.length;const name=campusName(b);if(b.ref)labels.push({ref:b.ref,name,en:name,x,y:info.top+1,z});buildings.push({id:b.id,ref:b.ref,...info});}
 const e6Link=e6Courtyard(B,D,C,hAt,surfAt);
 // Glass and facade ribs share the exact source boundary with the wall.
 // Bias depth, not x/z, so grazing-angle precision cannot produce stippling.
 const models=[];for(const[k,v]of Object.entries(B)){const layer=k==='glass'?-2:k==='detail'?-3:0;const m=v.mesh(`east-buildings-${k}`,new THREE.MeshStandardMaterial({vertexColors:true,roughness:k==='glass'?.3:.84,metalness:k==='glass'?.18:0,polygonOffset:layer!==0,polygonOffsetFactor:layer,polygonOffsetUnits:layer}));if(m){m.renderOrder=k==='glass'?1:k==='detail'?2:0;scene.add(m);models.push(m);}}
 const nature=vegetation(scene,D,C,hAt,surfAt),road=roadside(scene,D,C,hAt,surfAt);models.push(...nature.models,...road.models);
 const metadata={source:'Direct review of 25 user April 2025 captures, audit/capture-review-56-78.json',sourceImages:[...Array.from({length:23},(_,i)=>`${i+56}.png`),'77_left.png','77_right.png'],buildingCount:buildings.length,buildings,buildingVertexRanges:ranges,plantCounts:Object.fromEntries(['cherry','bare','pine','sculpted','conifer','shrub'].map(k=>[k,nature.plants.filter(p=>p.kind===k).length])),zoneCounts:nature.zoneCounts,drawCalls:models.length,triangles:models.reduce((s,m)=>s+(m.geometry.index?.count||m.geometry.attributes.position.count)/3*(m.isInstancedMesh?m.count:1),0),assumptions:'All facade heights, decorative equipment and individual vegetation positions are estimated. Source footprints retained. No photograph pixels distributed.',retainedModels:['E16-1 existing capture architecture','E9 official landmark model','existing gate pylons/guardhouse','W16 west-extension ownership'],e6Link,notReconstructed:['Bicycle shelters: candidate locations rejected by mapped pavement/road clearance; images retained as evidence','Some parking-edge tree rows: conservative crown tests reject mapped parking overlap; see zero-count zones','77_right central avenue median: off race alignment; preserve source road geometry'],physicalSurfaceChanged:false,courseGeometryChanged:false};
 metadata.solarParkingRows=road.solarParkingRows;
 return{handledIds,labels,metadata,models,plants:nature.plants,roadsideItems:road.items,zones:ZONES};
}
