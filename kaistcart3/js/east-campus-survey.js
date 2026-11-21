import * as THREE from '../lib/three.module.min.js';
import {GRANDSTAND,buildEastStand,buildEastTrack} from './east-athletics.js';
import {sejongParts} from './sejong-parts.js';
import {buildSejongEntrance,buildClinicRamp,buildClinicShell,clinicId} from './east-entrances.js';
import {buildPondLandmarks} from './duck-pond-landmarks.js';
import {buildKiBuilding,kiBuildingId} from './ki-building.js';
import {buildEastGarage,eastGarageId} from './east-parking-garage.js';
import {buildIbsCampus,ibsBuildingId} from './ibs-campus.js';
import {buildNanoBuilding,nanoBuildingId} from './nano-building.js';
import {buildWoodedApproach} from './wooded-approach.js';
import {finishSurveyFoliage,maple,redPine} from './east-campus-plants.js';
import { up, color, vector, frame, at, panel, reverseFrame, box, solid, column, groundPoint, strip, groundPatch, plaque } from './east-campus-shapes.js';

// Mapped footprints; detail dimensions are estimates from public street photography.
const MUSEUM = 1524994428, EAST_GATE = 456884560, MUSEUM_PARKING = 503477364;
// The E8 wings are built by the captured eastern architecture pass. Its
// mapped open galleries have their own closed lobby and canopy here, so a
// second, generic under-building lining would seal the pedestrian openings.
export const eastSurveyBuildingIds = new Set([MUSEUM,EAST_GATE,GRANDSTAND,kiBuildingId,clinicId,eastGarageId,ibsBuildingId,nanoBuildingId,78058763,1524891713,1524542411,...sejongParts.map(part=>part.id)]);
function pattern(kind) {
  const canvas=document.createElement('canvas');
  canvas.width=kind==='brick'?256:128;canvas.height=kind==='brick'?128:128;
  const ctx=canvas.getContext('2d'), w=canvas.width, h=canvas.height;
  ctx.fillStyle=kind==='brick'?'#b0a39c':'#b8b6af';ctx.fillRect(0,0,w,h);
  if(kind==='brick'){
    // Running bond repeats after eight courses. The seam wraps at the tile edges.
    const tone=['#fffcf9','#f1e8e1','#eee9e7','#f5eeed','#f6efe9'];
    for(let row=0;row<8;row++)for(let col=-1;col<9;col++){
      const x=(col+(row%2)*.5)*32,y=row*16;
      const wrappedCol=(col+8)%8;
      ctx.fillStyle=tone[(13*row+3*wrappedCol+25)%tone.length];ctx.fillRect(x+1,y+1,30,14);
    }
  }else{
    ctx.fillStyle='#f3f0ea';ctx.fillRect(1,1,w-2,h-2);
    for(let x=7;x<w;x+=8){ctx.fillStyle=(x%3===0)?'#ddd9d4':'#e6e2db';ctx.fillRect(x,2,1,h-4);}
  }
  const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;
  tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.anisotropy=4;
  if(kind==='brick')tex.repeat.set(1/1.84,1/.63);
  return tex;
}
function museum(b,hAt,B,group){
  const p=b.p, f=frame(p[1],p[2]), L=f.length;
  const ground=p.map(q=>hAt(...q)),low=Math.min(...ground)-.6,high=Math.max(...ground);
  const soffit=high+3.05,top=soffit+9.9;
  const limestone=color(0xe4d7bd), cap=color(0xb7b6ac), frameColor=color(0x536161);
  const green=color(0x44716e),darkGreen=color(0x31494b),concrete=color(0xc0bdb0);
  // The ground floor closes behind the colonnade; neither the street-facing
  // glazing nor any doorway opens a sightline through the building's far wall.
  const setback=2.35, inner=p.map(q=>[...q]);
  for(const i of [1,2]) inner[i]=[p[i][0]-f.n[0]*setback,p[i][1]-f.n[1]*setback];
  solid(B.glass,inner,low,soffit,darkGreen);
  for(let u=1.1;u<L;u+=2.05) panel(B.trim,f,u,u+.075,low,soffit,-setback+.025,frameColor);
  for(let u=0;u<L;u+=1.05){
    const hiU=Math.min(L,u+1.05),lo=groundPoint(f,u,-setback,hAt,.14),hi=groundPoint(f,hiU,-setback,hAt,.14);
    const loY=lo[1],hiY=hi[1];
    strip(B.trim,lo,hi,groundPoint(f,hiU,.08,hAt,.16),groundPoint(f,u,.08,hAt,.16),up,concrete);
    // A rail breaks up the tall reflective lobby where the forecourt descends.
    B.trim.quad(at(f,u,loY+2.3,-setback+.035),at(f,hiU,hiY+2.3,-setback+.035),at(f,hiU,hiY+2.37,-setback+.035),at(f,u,loY+2.37,-setback+.035),
      vector(...f.n),[0,0],[1,0],[1,.07],[0,.07],frameColor);
  }
  const balconyFace=frame(p[1],p[2]);
  // The deep soffit is the underside of the slab, visible from the parking aisle.
  B.trim.quad(at(f,0,soffit),at(f,L,soffit),at(f,L,soffit,-setback),at(f,0,soffit,-setback),
    [0,-1,0],[0,0],[L,0],[L,setback],[0,setback],color(0xabaaa3));
  const projected=THREE.ShapeUtils.area(p.map(q=>new THREE.Vector2(...q)));
  for(let i=0;i<p.length;i++){
    if(i===1)continue;
    const side=frame(p[i],p[(i+1)%p.length]),o=projected>0?side:reverseFrame(side);
    panel(B.stone,o,0,o.length,soffit,top,0,limestone);
    panel(B.trim,o,0,o.length,top,top+.2,0,cap);
  }
  const openings=[[L*.112,L*.125,soffit+5.45,soffit+7.02],[L*.283,L*.297,soffit+5.45,soffit+7.02],
    [L*.493,L*.702,soffit+.9,top-1.75]];
  let last=0;
  for(const [s,e,bt,rt] of openings){
    panel(B.stone,balconyFace,last,s,soffit,top,0,limestone);
    panel(B.stone,balconyFace,s,e,soffit,bt,0,limestone);panel(B.stone,balconyFace,s,e,rt,top,0,limestone);
    box(B.trim,f,s-.025,s+.085,-.33,.006,bt,rt,cap);box(B.trim,f,e-.085,e+.025,-.33,.006,bt,rt,cap);
    box(B.trim,f,s,e,-.33,.005,bt,bt+.07,cap);box(B.trim,f,s,e,-.33,.005,rt-.065,rt,cap);
    panel(B.glass,f,s,e,bt,rt,-.27,(e-s)>2?green:darkGreen);
    if(e-s>2){
      const mullion=color(0x718887);
      for(let i=1;i<8;i++){const u=s+(e-s)*i/8;panel(B.trim,f,u-.035,u+.035,bt,rt,-.24,mullion);}
      panel(B.trim,f,s,e,bt+(rt-bt)*.65,bt+(rt-bt)*.65+.075,-.24,mullion);
    }
    last=e;
  }
  panel(B.stone,balconyFace,last,L,soffit,top,0,limestone);
  panel(B.trim,f,0,L,top,top+.2,0,cap);
  solid(B.trim,p,top+.19,top+.2,cap,false);
  for(let i=0;i<10;i++){
    const [x,,z]=at(f,1.05+i*(L-2.1)/9,0,-.62);
    column(B.trim,x,z,.31,hAt(x,z)-.25,soffit,concrete);
  }
  for(const [u,w] of [[L*.48,5.6],[L*.7,6.4]]){
    box(B.trim,f,u-w/2,u+w/2,-8.75,-5.7,top+.18,top+2.05,color(0xc7c4b7));
    for(let s=u-w*.32;s<u+w*.32;s+=.23)panel(B.trim,f,s,s+.10,top+.55,top+1.67,-5.68,frameColor);
  }
  plaque(group,'KAIST 미술관',f,L*.89,top-.96,.04,6.1,.74,'#fdf8e8');
  plaque(group,'KAIST ART MUSEUM',f,L*.075,top-.95,.04,5.6,.57,'#fdf8e8');
  return {footprint:b.id,top,source:'702/732 November 2026 and KAIST museum opening photograph'};
}
function guardPost(b,hAt,B,group){
  const p=b.p,f=frame(p[3],p[2]),L=f.length;
  const ground=p.map(q=>hAt(...q)),base=Math.min(...ground)-.3,
    sill=Math.max(...ground)+.98,eave=sill+1.75;
  const brick=color(0x824a40),roof=color(0x77483f),rim=color(0xd0c6af),glass=color(0x344c4f);
  solid(B.brick,p,base,sill,brick);solid(B.glass,p,sill,eave,glass);
  // Mapped narrow guardhouse. Its public-facing window wraps two corners.
  for(let i=0;i<4;i++){
    const a=p[i],next=p[(i+1)%4],side=frame(a,next);
    for(let u=.1;u<side.length;u+=2.2)panel(B.trim,side,u,u+.075,sill,eave,.02,color(0x443d39));
  }
  const roofRing=p.map(q=>{const mid=[p.reduce((s,q)=>s+q[0],0)/4,p.reduce((s,q)=>s+q[1],0)/4];return[q[0]+(q[0]-mid[0])*.13,q[1]+(q[1]-mid[1])*.13];});
  solid(B.trim,roofRing,eave,eave+.17,rim);
  const ridge0=at(f,L*.35,eave+1.62,3.9),ridge1=at(f,L*.65,eave+1.62,3.9);
  const e=roofRing.map(q=>[q[0],eave+.18,q[1]]);
  const roofTri=(a,b,c)=>{const normal=new THREE.Vector3().subVectors(new THREE.Vector3(...b),new THREE.Vector3(...a)).cross(new THREE.Vector3().subVectors(new THREE.Vector3(...c),new THREE.Vector3(...a))).normalize();if(normal.y<0)normal.negate();B.brick.tri(a,b,c,normal.toArray(),[a[0],a[2]],[b[0],b[2]],[c[0],c[2]],roof);};
  roofTri(e[0],e[1],ridge1);roofTri(e[0],ridge1,ridge0);roofTri(e[1],e[2],ridge1);
  roofTri(e[2],e[3],ridge0);roofTri(e[2],ridge0,ridge1);roofTri(e[3],e[0],ridge0);
  const face=reverseFrame(f);
  plaque(group,'KAIST',face,L/2,eave-.28,.14,4.7,.31,'#ffffff','#294e66');
  return {footprint:b.id,top:eave+1.62,source:'725 November 2026'};
}
function gateway(hAt,B){
  // The inner pair stands in the verge between the two-lane carriageway and
  // the mapped footway. The larger outer pair stands beyond the footway.
  const f=frame([425.15,-381.24],[428.15,-381.24]),brick=color(0x835047),ridge=color(0x794a42);
  const pylon=(u,out,span,depth,height)=>{
    const [x,,z]=at(f,u,0,out),base=hAt(x,z)-.27,top=base+height;
    const a=u-span/2,b=u+span/2,c=out-depth/2,d=out+depth/2,r=.30;
    const ring=[[a+r,c],[b-r,c],[b,c+r],[b,d-r],[b-r,d],[a+r,d],[a,d-r],[a,c+r]]
      .map(([a,c])=>{const [x,,z]=at(f,a,0,c);return [x,z];});
    solid(B.brick,ring,base,top,brick);solid(B.brick,ring,top,top+.20,ridge);
    for(const dir of [-1,1]){
      const side=dir>0?f:reverseFrame(f),start=dir>0?a:side.length-b,end=dir>0?b:side.length-a;
      const sOut=dir>0?d:-c;
      panel(B.brick,side,start+.39,start+.54,base+.38,top-.35,sOut+.035,ridge);
      panel(B.brick,side,end-.54,end-.39,base+.38,top-.35,sOut+.035,ridge);
    }
  };
  for(const side of [-1,1]){
    pylon(2.35,side*7.95,4.1,1.45,7.35);
    pylon(.15,side*13.05,6.2,1.56,9.55);
  }
}

// E17's three mapped courts share one screened perimeter. Preserve openings
// around the individual pitches rather than drawing a fence around each court.
function eastTennis(W,hAt,B,group){
  const courtIds=[1529523894,1529523895,1529523896];
  const courts=W.D.areas.filter(a=>courtIds.includes(a.id));
  if(courts.length!==3)return;
  // OSM sports-centre way 1524851740, including the bevels in the east corner.
  const edges=[[491.7,-48.1],[493.3,-49.1],[537.7,-77.4],[556,-49.1],[558.1,-45.8],[512.1,-16.6],[505,-27.5]];
  const foot=color(0x756b62),fence=color(0x4b7868),screen=color(0x417666),wire=color(0x355f53);
  function railRun(f,s,e){
    const amount=Math.max(1,Math.round((e-s)/2.55));
    for(let i=0;i<amount;i++){
      const a=s+(e-s)*i/amount,b=s+(e-s)*(i+1)/amount;
      const va=groundPoint(f,a,0,hAt),vb=groundPoint(f,b,0,hAt),n=vector(...f.n);
      const patch=(batch,low,top,shade)=>{
        const p=(v,h)=>[v[0],v[1]+h,v[2]];
        strip(batch,p(va,low),p(vb,low),p(vb,top),p(va,top),n,shade);
      };
      patch(B.trim,-.2,.42,foot);patch(B.screen,.42,2.33,screen);patch(B.wire,2.33,4.6,wire);
      patch(B.trim,4.55,4.62,fence);
      column(B.trim,va[0],va[2],.055,va[1]+.35,va[1]+4.64,fence);
    }
  }
  for(let i=0;i<edges.length;i++){
    const f=frame(edges[i],edges[(i+1)%edges.length]);
    if(i===1){
      // Gate and the A/B boards on the parking-row side, seen in panorama 716.
      railRun(f,0,1.8);railRun(f,3.3,f.length);
      for(const [u,letter] of [[f.length*.17,'A'],[f.length*.50,'B'],[f.length*.83,'C']]){
        plaque(group,letter,f,u,groundPoint(f,u,0,hAt,3.04)[1],.09,.76,.79,'#152861','#f2f1e4');
      }
    }else railRun(f,0,f.length);
  }
  for(const court of courts){
    const p=court.p,mid=(a,b)=>[(a[0]+b[0])*.5,(a[1]+b[1])*.5];
    const f=frame(mid(p[0],p[3]),mid(p[1],p[2]));
    const a=groundPoint(f,-.25,0,hAt,.16),b=groundPoint(f,f.length+.25,0,hAt,.16);
    strip(B.wire,a,b,[b[0],b[1]+.99,b[2]],[a[0],a[1]+.99,a[2]],vector(...f.n),color(0x353e3b));
    for(const end of [a,b])column(B.trim,end[0],end[2],.057,end[1]-.06,end[1]+1.02,fence);
    for(const v of [0,.5]){
      const u=v*f.length;
      const left=groundPoint(f,u,0,hAt,1.12),right=groundPoint(f,u+f.length*.5,0,hAt,1.12);
      if(v===0)right[1]-=.10;else left[1]-=.10;
      strip(B.screen,left,right,[right[0],right[1]+.045,right[2]],[left[0],left[1]+.045,left[2]],vector(...f.n),color(0xe8e8d9));
    }
  }
  for(const [i,u] of [[1,12],[1,36],[4,14],[4,36]]){
    const f=frame(edges[i],edges[(i+1)%edges.length]);
    const v=groundPoint(f,u,-.85,hAt),y=v[1],black=color(0x3b4445);
    column(B.trim,v[0],v[2],.088,y-.12,y+6.85,black);
    box(B.trim,f,u-1.02,u+1.02,-1.0,-.75,y+6.70,y+6.78,black);
    for(const side of [-1,1])box(B.trim,f,u+side*.87-.22,u+side*.87+.22,-1.43,-.72,y+6.56,y+6.74,black);
  }
  return {facility:'East Tennis Courts (E17)',way:1524851740,courts:courtIds,panoramas:['Htttm0pTeDEriOd6fqRFwQ','KEczB7aqyJIelgXhvGyGJA']};
}
function wireTexture(){
  const c=document.createElement('canvas');c.width=c.height=128;
  const ctx=c.getContext('2d');
  ctx.fillStyle='#fff';ctx.fillRect(0,0,5,128);ctx.fillRect(0,0,128,3);
  const map=new THREE.CanvasTexture(c);map.wrapS=map.wrapT=THREE.RepeatWrapping;
  map.repeat.set(13,6);map.anisotropy=4;map.colorSpace=THREE.SRGBColorSpace;return map;
}
function bike(f,u,d,B,hAt,seed){
  const base=groundPoint(f,u,d,hAt,.10)[1],n=vector(...f.n);
  const p=(a,h,out=.0)=>at(f,u+a,base+h,d+out);
  const rubber=color(0x343735),steel=color(0x8e9896),paint=color([0x587a87,0x45484a,0x8c5350,0x5e7566][seed%4]);
  function brace(a,b,w,c,out=.0){
    const du=b[0]-a[0],dh=b[1]-a[1],l=Math.hypot(du,dh),
      ox=-dh*w/(2*l),oy=du*w/(2*l);
    strip(B.cycles,p(a[0]+ox,a[1]+oy,out),p(b[0]+ox,b[1]+oy,out),
      p(b[0]-ox,b[1]-oy,out),p(a[0]-ox,a[1]-oy,out),n,c);
  }
  for(const x of [-.48,.48]){
    for(let k=0;k<12;k++){
      const a=k*Math.PI/6,b=(k+1)*Math.PI/6;
      const point=(t,r)=>p(x+Math.cos(t)*r,.32+Math.sin(t)*r);
      strip(B.cycles,point(a,.32),point(b,.32),point(b,.28),point(a,.28),n,rubber);
    }
    for(const angle of [0,60,120]){
      const dx=Math.cos(angle*Math.PI/180)*.28,dy=Math.sin(angle*Math.PI/180)*.28;
      brace([x-dx,.32-dy],[x+dx,.32+dy],.013,steel);
    }
  }
  for(const [a,b] of [[[-.48,.32],[-.19,.68]],[[-.48,.32],[0,.33]],[[-.19,.68],[0,.33]],
    [[-.19,.68],[.30,.72]],[[.30,.72],[0,.33]],[[.30,.72],[.48,.32]],[[.3,.72],[.27,.93]]])brace(a,b,.038,paint,.02);
  brace([-.3,.70],[-.12,.70],.056,rubber,.024);brace([.17,.92],[.38,.92],.032,steel);
}
function eastCycleShelters(W,hAt,B){
  // Both bicycle polygons flank service lane 504188913. Their outer nine
  // metres carry the transverse silver arches visible from the E8 entrance.
  const f=frame([401.9,-95.4],[396.3,-68.1]),sides=[
    {side:-1,way:1524847863},{side:1,way:1524847864}
  ],shade=color(0x979b8e),metal=color(0xaeb4af),leg=color(0xc9c7b7),ground=color(0xb09185);
  for(const ring of [
    [[392.6,-101.6],[384.8,-97],[380,-73.6],[394.0,-70.45],[398.42,-92.34]],
    [[413.6,-97.1],[418.3,-89.7],[413.7,-66.2],[399.25,-69.50],[403.87,-91.52]]
  ])groundPatch(B.brick,ring,hAt,color(0xb1988d));
  let placed=0,cycles=0;
  for(const {side} of sides)for(let row=0;row<6;row++){
    const u=2.5+row*4.12,outer=side*(row===5?12.8:14.05),inner=side*4.65;
    const ends=[groundPoint(f,u,inner,hAt),groundPoint(f,u,outer,hAt)];
    if(ends.some(p=>W.access.isDrivable(p[0],p[2])))continue;
    const floor=Math.max(...ends.map(p=>p[1])),roofY=floor+2.14,width=2.72;
    for(let k=0;k<6;k++){
      const a=-width/2+width*k/6,b=-width/2+width*(k+1)/6;
      const rise=v=>.23*Math.cos(Math.PI*v/width);
      const A=at(f,u+a,roofY+rise(a),inner),B1=at(f,u+a,roofY+rise(a),outer),
        C=at(f,u+b,roofY+rise(b),outer),D=at(f,u+b,roofY+rise(b),inner);
      strip(B.screen,A,B1,C,D,up,shade);
      if(k===0||k===5)strip(B.trim,A,B1,[B1[0],B1[1]-.075,B1[2]],[A[0],A[1]-.075,A[2]],vector(...f.u),metal);
    }
    const lowD=Math.min(inner,outer),hiD=Math.max(inner,outer);
    for(const d of [inner+.10*side,(inner+outer)/2,outer-.10*side]){
      const y=groundPoint(f,u,d,hAt)[1];
      box(B.trim,f,u-.105,u+.105,d-.11,d+.11,y-.1,roofY+.20,leg);
      box(B.trim,f,u-width/2,u+width/2,d-.039,d+.039,roofY-.06,roofY+.02,metal);
    }
    for(let k=0;k<6;k++){
      const d=inner+(outer-inner)*(k+.52)/6;
      if((k+row+(side+1))%5!==0){bike(f,u+.12*(k%3-1),d,B,hAt,k+row+side+1);cycles++;}
      const g1=groundPoint(f,u-width/2-.32,d,hAt,.05), g2=groundPoint(f,u+width/2+.32,d,hAt,.05);
      if(k===0||k===5)strip(B.trim,g1,g2,[g2[0],g2[1]+.055,g2[2]],[g1[0],g1[1]+.055,g1[2]],vector(...f.n),ground);
    }
    for(const uOff of [-.57,.57])box(B.trim,f,u+uOff-.028,u+uOff+.028,lowD+.14,hiD-.14,floor+.27,floor+.32,metal);
    placed++;
  }
  return {facility:'Sejong bicycle courts',ways:sides.map(s=>s.way),bays:placed,bicycles:cycles,panoramas:['DWVthHdi5zfPEJt-MrA4yQ','Q4NIe6H_SijYgvd_VjaaXA']};
}

function tennisThreshold(W,hAt,B){
  const gate=W.explore.vehicleGates.find(g=>g.id===910330595);
  if(!gate || gate.passable)return;
  const [x,z]=gate.p,dx=Math.cos(gate.heading),dz=-Math.sin(gate.heading),width=gate.width;
  const f=frame([x-dx*width/2,z-dz*width/2],[x+dx*width/2,z+dz*width/2]),base=hAt(x,z)+.14;
  const pier=color(0x666665),cap=color(0x777877),beam=color(0x414341);
  for(const u of [-.05,width*.765,width+.065]){
    box(B.trim,f,u-.23,u+.23,-.22,.22,base-.32,base+1.13,pier);
    for(const y of [.36,.74,1.09])box(B.trim,f,u-.24,u+.24,-.23,.23,base+y,base+y+.033,cap);
  }
  for(const y of [.40,.83])box(B.trim,f,.10,width*.765-.16,-.09,.09,base+y,base+y+.16,beam);
  for(let u=.17;u<width*.76-.1;u+=.83)box(B.trim,f,u,u+.06,-.063,.063,base+.08,base+.97,beam);
  // The soft cones outline the same closed cross-section as the collision.
  for(let j=0;j<5;j++){
    const u=.12+(width-.24)*j/4,[cx,,cz]=at(f,u,0,.62),y=hAt(cx,cz)+.18;
    box(B.trim,f,u-.22,u+.22,.40,.84,y-.025,y+.037,color(0x384b40));
    const vertex=(a,r,h)=>[cx+r*Math.cos(a),y+h,cz+r*Math.sin(a)];
    for(let k=0;k<10;k++){
      const a=k*Math.PI/5,b=(k+1)*Math.PI/5,normal=[Math.cos((a+b)/2),.27,Math.sin((a+b)/2)];
      for(const [h0,h1,r0,r1,c] of [[.03,.37,.17,.085,0x427b60],[.37,.46,.085,.063,0xc4d1bd],[.46,.59,.063,.03,0x427b60]]){
        strip(B.trim,vertex(a,r0,h0),vertex(b,r0,h0),vertex(b,r1,h1),vertex(a,r1,h1),normal,color(c));
      }
    }
  }
  for(const side of [-1,1]){
    const foot=side<0?-.34:width+.34;
    const coords=[[foot,-2],[foot+side*.9,-4.3],[foot+side*3.5,-7.6]];
    for(let i=0;i<coords.length-1;i++){
      const [lo,ld]=coords[i],[hi,hd]=coords[i+1],p=at(f,lo,0,ld),q=at(f,hi,0,hd),edge=frame([p[0],p[2]],[q[0],q[2]]);
      const base1=hAt(p[0],p[2])-.03,base2=hAt(q[0],q[2])-.03;
      strip(B.screen,at(edge,0,base1),at(edge,edge.length,base2),at(edge,edge.length,base2+.40),at(edge,0,base1+.40),vector(...edge.n),pier);
      strip(B.trim,at(edge,0,base1+.40,-.16),at(edge,edge.length,base2+.40,-.16),at(edge,edge.length,base2+.40,.16),at(edge,0,base1+.40,.16),up,cap);
    }
    for(const [b,d,s] of [[2.2,3.5,1.13],[3.1,-1.4,1.31],[5.1,3.7,1.40],[5.6,-6.4,1.68],[7.3,-2.7,1.6]]){
      const [tx,,tz]=at(f,foot+b*side,0,d);
      if(!W.access.isDrivable(tx,tz))maple(B,tx,hAt(tx,tz),tz,s,b*side+d,side===1?0x765849:0x594743);
    }
    const [px,,pz]=at(f,foot+8.4*side,0,2.4);
    if(!W.access.isDrivable(px,pz))redPine(B,px,hAt(px,pz),pz,4.7,8.8,side+1);
  }
  return {facility:'East tennis approach',gate:gate.id,panoramas:['j8RCm3qzU5wF3Gqkt1y9jQ','1lQteXRrP-NLiIC0dlXROQ']};
}

export function buildEastSurvey(scene,W,hAt,MB){
  const group=new THREE.Group();group.name='KAIST Art Museum and eastern campus';
  const kinds=['stone','brick','glass','trim','screen','wire','cycles','track','leaf'];
  const materials=Object.fromEntries(kinds.map(kind=>[kind,new THREE.MeshStandardMaterial({
      vertexColors:true,roughness:kind==='glass'?.29:.85,metalness:kind==='glass'?.32:.035,
      map:kind==='wire'?wireTexture():kind==='stone'||kind==='brick'?pattern(kind):null,
      side:['wire','screen','cycles'].includes(kind)?THREE.DoubleSide:THREE.FrontSide,
      alphaTest:kind==='wire'?.025:0,transparent:kind==='wire',depthWrite:kind!=='wire'
    })]));
  finishSurveyFoliage(materials.leaf);
  const details=[],facilities=[];
  const find=id=>W.D.buildings.find(b=>b.id===id);
  function site(name,build,modelledPassages=false){
    const B=Object.fromEntries(kinds.map(k=>[k,new MB()]));
    build(B);
    for(const [kind,batch] of Object.entries(B)){
      if(!batch.p.length)continue;
      const mat=modelledPassages?materials[kind].clone():materials[kind];
      const mesh=new THREE.Mesh(batch.geo(),mat);mesh.name=name+' · '+kind;
      if(modelledPassages)mesh.userData.passageLining=true;
      mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
    }
  }
  site('Art Museum',B=>{const b=find(MUSEUM);if(b)details.push(museum(b,hAt,B,group));});
  site('East Gate',B=>{const b=find(EAST_GATE);if(b)details.push(guardPost(b,hAt,B,group));gateway(hAt,B);});
  site('East Field',B=>{
    const b=find(GRANDSTAND);if(b)facilities.push(buildEastStand(b,hAt,B,group,W.access));
    facilities.push(buildEastTrack(W,hAt,B));
  });
  site('East Tennis Courts',B=>facilities.push(eastTennis(W,hAt,B,group),tennisThreshold(W,hAt,B)));
  // The central lobby has closed glazing behind its modelled open canopy.
  // An additional raster cut for the three mapped approach lines removes its pitched roof.
  site('Sejong Hall',B=>facilities.push(eastCycleShelters(W,hAt,B),buildSejongEntrance(W,hAt,B,group)),true);
  site('KAIST Clinic',B=>{const b=find(clinicId);if(b)details.push(buildClinicShell(b,hAt,B,group,W));facilities.push(buildClinicRamp(W,hAt,B));});
  site('Eastern parking garage',B=>{const b=find(eastGarageId);if(b)facilities.push(buildEastGarage(b,hAt,B,group));},true);
  site('IBS KAIST Campus',B=>{const b=find(ibsBuildingId);if(b)details.push(buildIbsCampus(b,hAt,B));});
  site('National Nanofab Center',B=>{const b=find(nanoBuildingId);if(b)details.push(buildNanoBuilding(b,hAt,B,group));});
  site('Wooded east approach',B=>facilities.push(buildWoodedApproach(W,hAt,B)));
  site('KI Building',B=>{const b=find(kiBuildingId);if(b)details.push(buildKiBuilding(b,hAt,B));});
  site('Duck Pond',B=>facilities.push(buildPondLandmarks(W,hAt,B,group)));
  group.userData.facilities=facilities.filter(Boolean);
  group.userData.details=details; scene.add(group); return group;
}

function shadeMuseumPaving(mesh,attr,clipToLot,ring){
  // Parking geometry may also carry a second material for separate block-paved lots.
  // Museum vertices are part of its first, asphalt draw group.
  const original=Array.isArray(mesh.material)?mesh.material[0]:mesh.material,g=mesh.geometry;
  g.setAttribute('museumPaving',new THREE.BufferAttribute(attr,1));
  const applyBase=original.onBeforeCompile.bind(original),baseCache=original.customProgramCacheKey();
  // The aisle mesh overlaps the parking polygon; its ends meet the campus
  // roadway. Clip in the fragment shader so no asphalt outside the lot changes.
  const clip=clipToLot?ring.map((a,i)=>{
    const b=ring[(i+1)%ring.length];
    return `if((${a[1].toFixed(2)}>p.y)!=(${b[1].toFixed(2)}>p.y)&&p.x<(${(b[0]-a[0]).toFixed(3)})*(p.y-(${a[1].toFixed(2)}))/(${((b[1]-a[1])||.001).toFixed(3)})+(${a[0].toFixed(2)})) inside=!inside;`;
  }).join('\n'):'inside=true;';
  original.onBeforeCompile=(shader,renderer)=>{
    applyBase(shader,renderer);
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute float museumPaving; varying float vMuseumPaving; varying vec2 vMuseumGround;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nvMuseumPaving=museumPaving;vMuseumGround=position.xz;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
      varying float vMuseumPaving; varying vec2 vMuseumGround;
      bool insideMuseumPaving(vec2 p){bool inside=false; ${clip} return inside;}`)
      .replace('#include <map_fragment>',`#include <map_fragment>
      if(vMuseumPaving>.5&&insideMuseumPaving(vMuseumGround)){
        vec2 p=vec2(dot(vMuseumGround,vec2(.568,.823)),dot(vMuseumGround,vec2(.823,-.568)));
        vec2 cell=p/vec2(.24,.12);cell.x+=.5*mod(floor(cell.y),2.);
        vec2 edge=.5-abs(fract(cell)-.5);
        vec2 aa=max(vec2(.015),fwidth(cell));
        float joint=min(smoothstep(0.,.038+aa.x,edge.x),smoothstep(0.,.055+aa.y,edge.y));
        float distant=smoothstep(.26,.9,max(aa.x,aa.y));
        float shade=fract(sin(dot(floor(cell),vec2(13.7,77.3)))*4213.17);
        vec3 brick=mix(vec3(.246,.24,.227),vec3(.315,.308,.29),shade);
        diffuseColor.rgb=mix(mix(vec3(.188,.185,.176),brick,joint),vec3(.272,.267,.25),distant);
        vec2 offset=vMuseumGround-vec2(64.6,-10.6);
        vec2 bay=vec2(dot(offset,vec2(.56815,.82292)),dot(offset,vec2(.82292,-.56815)));
        float moduleX=bay.x<30.?bay.x-.42:bay.x-51.2;
        if(moduleX>=0. && moduleX<8.12 && bay.y<3.54 && bay.y>=-.8){
          float u=mod(moduleX,2.71),v=bay.y;
          float stroke=1.-smoothstep(.045,.085,min(min(u,2.71-u),min(abs(v-3.46),abs(v-2.63))));
          if(v>2.63)stroke=max(stroke,1.-smoothstep(.06,.11,abs(fract((u+v)/.6)-.5)));
          vec2 icon=vec2(u-1.35,v-1.18);
          float wheel=abs(length(icon+vec2(.09,.12))-.36);
          float head=length(icon-vec2(-.10,.55))-.097;
          float back=length(icon-vec2(-.10,clamp(icon.y,.05,.38)));
          float seat=length(icon-vec2(clamp(icon.x,-.1,.22),.08));
          float foot=length(icon-vec2(.22+clamp(-icon.y,0.,.20)*.58,-clamp(-icon.y,0.,.20)));
          float symbol=1.-smoothstep(.035,.065,min(min(wheel,head),min(back,min(seat,foot))));
          diffuseColor.rgb=mix(vec3(.029,.165,.383),vec3(.82,.84,.80),max(symbol,stroke));
        }
      }`);
  };
  original.customProgramCacheKey=()=>baseCache+';museum-pavers-2-'+clipToLot;original.needsUpdate=true;
}
/** Brick paving uses the same triangles as the parking surface and its aisle. */
export function finishEastSurveyPaving(scene,parking){
  const lot=parking?.lots.find(lot=>lot.id===MUSEUM_PARKING);
  const mesh=scene.getObjectByName('campus-parking-asphalt');
  if(!mesh||!lot?.groundVertexCount)return;
  const attr=new Uint8Array(mesh.geometry.getAttribute('position').count);
  attr.fill(1,lot.groundVertexStart,lot.groundVertexStart+lot.groundVertexCount);
  shadeMuseumPaving(mesh,attr,false,lot.polygon);
  const road=scene.getObjectByName('Mapped campus streets and service lanes');
  if(!road)return;
  const pos=road.geometry.getAttribute('position'),range=new THREE.Box2().setFromPoints(lot.polygon.map(q=>new THREE.Vector2(...q)));
  const mask=new Uint8Array(pos.count);
  for(let i=0;i<pos.count;i+=3){
    if(Math.max(pos.getX(i),pos.getX(i+1),pos.getX(i+2))<range.min.x || Math.min(pos.getX(i),pos.getX(i+1),pos.getX(i+2))>range.max.x ||
       Math.max(pos.getZ(i),pos.getZ(i+1),pos.getZ(i+2))<range.min.y || Math.min(pos.getZ(i),pos.getZ(i+1),pos.getZ(i+2))>range.max.y)continue;
    mask.fill(1,i,i+3);
  }
  shadeMuseumPaving(road,mask,true,lot.polygon);
}
