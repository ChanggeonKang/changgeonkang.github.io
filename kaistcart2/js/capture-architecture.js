// Code-native facades inferred from user-supplied April 2025 captures.
// Footprints are unchanged OSM source geometry. Storey height, roofs, materials,
// facade divisions and decorative equipment are visual estimates, not surveys.
// No screenshot pixels or third-party photographs are used as runtime textures.
import * as THREE from '../lib/three.module.min.js';
import { buildingProfile, campusName } from './campus-identity.js';

const C = n => new THREE.Color(n), mix=(a,b,t)=>a+(b-a)*t;
const PALETTE={brick:C(0x86584f),brickDark:C(0x674c46),white:C(0xd8d9d0),cream:C(0xc8c7b7),glass:C(0x426872),frame:C(0xaeb8b5),roof:C(0x654e4b),pink:C(0xc8aca4),gold:C(0xb4a35e),blue:C(0x4c8297),silver:C(0xacb6b7)};
const CONFIG={
  'W4-3':{style:'tower',photos:[2,3],color:0xe0ddd2,accent:0xc8aca4},
  'W4-4':{style:'tower',photos:[2,3],color:0xe1e4dc,accent:0xc9aaa6},
  'W5-2':{style:'village',photos:[4,5],floors:4,color:0xe0dfd4},
  'W5-4':{style:'village',photos:[4,5,7],floors:4,color:0xe0dfd4},
  W6:{style:'greyDorm',photos:[5,7,8],color:0xbcbfc0,accent:0xa77954},
  W11:{style:'faculty',photos:[9,10,11,15,16],color:0xc9cecb,accent:0xa6a05b},
  W10:{style:'service',photos:[12,13,14],height:6.3,color:0xdbded7},
  N16:{style:'archedDorm',photos:[20,21,22,23],floors:5,color:0x985c51},
  N14:{style:'brickDorm',photos:[24,25,26],floors:5,color:0x976052},
  N17:{style:'yellowDorm',photos:[27,28,29],floors:5,color:0x956356},
  N18:{style:'brickDorm',photos:[30],floors:5,color:0x976453},
  N12:{style:'brickHall',photos:[29,30,31],floors:3,color:0x85584c},
  N15:{style:'brickHall',photos:[31],floors:2,color:0x906054},
  N10:{style:'ventHall',photos:[32,33],height:10.7,color:0x815c50},
  N9:{style:'workshop',photos:[34,35,36],height:6.2,color:0x855c50},
  N5:{style:'deepEave',photos:[37,38,39],height:14.4,color:0x76534b},
  N6:{style:'facultyClub',photos:[40,41],height:8.8,color:0x8d6253},
  N1:{style:'itc',photos:[40,41,42,43],color:0xd4d9d4,accent:0xb9a952},
  N2:{style:'deepEave',photos:[48,49],height:12.4,color:0x855c50},
  E15:{style:'auditorium',photos:[47,48,49,50,51,52],height:10.2,color:0x79594c},
  E14:{style:'academic',photos:[55],color:0xceccc0,confidence:'medium; footprint-relative image match, label not legible'},
  'E16-1':{style:'academicGlass',photos:[55],height:18.2,color:0xcac9c1,confidence:'medium; footprint-relative image match, label not legible'}
};
const sign=p=>Math.sign(p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[1]-b[0]*a[1];},0))||1;
function inside(x,z,p){let r=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const a=p[i],b=p[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])r=!r;}return r;}
function dist(x,z,p){let d=Infinity;for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length],dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1)));d=Math.min(d,Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz));}return d;}
function validRing(q,p){return q.every((a,i)=>{const b=q[(i+1)%q.length],n=Math.max(1,Math.ceil(Math.hypot(a[0]-b[0],a[1]-b[1])));for(let k=0;k<=n;k++){const x=mix(a[0],b[0],k/n),z=mix(a[1],b[1],k/n);if(!inside(x,z,p)&&dist(x,z,p)>.004)return false;}return true;});}
class Batch{
  constructor(){this.p=[];this.n=[];this.c=[];}
  tri(a,b,c,color,normal){let n=new THREE.Vector3().subVectors(new THREE.Vector3(...b),new THREE.Vector3(...a)).cross(new THREE.Vector3().subVectors(new THREE.Vector3(...c),new THREE.Vector3(...a)));if(n.lengthSq()<1e-12)return;if(normal&&n.dot(new THREE.Vector3(...normal))<0)[b,c]=[c,b];n=normal||n.normalize().toArray();for(const v of[a,b,c]){this.p.push(...v);this.n.push(...n);this.c.push(color.r,color.g,color.b);}}
  quad(a,b,c,d,color,n){this.tri(a,b,c,color,n);this.tri(a,c,d,color,n);}
  geometry(g,color,p){const q=g.index?g.toNonIndexed():g,A=q.attributes.position,N=q.attributes.normal;let ok=true;for(let i=0;i<A.count;i++)if(!inside(A.getX(i),A.getZ(i),p)&&dist(A.getX(i),A.getZ(i),p)>.002){ok=false;break;}if(ok)for(let i=0;i<A.count;i++){this.p.push(A.getX(i),A.getY(i),A.getZ(i));this.n.push(N.getX(i),N.getY(i),N.getZ(i));this.c.push(color.r,color.g,color.b);}if(q!==g)q.dispose();g.dispose();return ok;}
  mesh(material,name){const g=new THREE.BufferGeometry();for(const [key,a]of[['position',this.p],['normal',this.n],['color',this.c]])g.setAttribute(key,new THREE.Float32BufferAttribute(a,3));g.computeBoundingBox();g.computeBoundingSphere();const m=new THREE.Mesh(g,material);m.name=name;m.castShadow=true;m.receiveShadow=true;return m;}
}
function faces(p,fn){const s=sign(p);p.forEach((a,i)=>{const b=p[(i+1)%p.length],L=Math.hypot(b[0]-a[0],b[1]-a[1]);if(L>.02)fn(a,b,L,[s*(b[1]-a[1])/L,0,-s*(b[0]-a[0])/L],i);});}
function panel(B,a,b,t0,t1,y0,y1,c,n){if(t1<=t0||y1<=y0)return;B.quad([mix(a[0],b[0],t0),y0,mix(a[1],b[1],t0)],[mix(a[0],b[0],t1),y0,mix(a[1],b[1],t1)],[mix(a[0],b[0],t1),y1,mix(a[1],b[1],t1)],[mix(a[0],b[0],t0),y1,mix(a[1],b[1],t0)],c,n);}
function roof(B,p,y,c){for(const t of THREE.ShapeUtils.triangulateShape(p.map(a=>new THREE.Vector2(...a)),[]))B.tri(...t.map(i=>[p[i][0],y,p[i][1]]),c,[0,1,0]);}
function volume(B,p,y0,y1,c){faces(p,(a,b,L,n)=>panel(B,a,b,0,1,y0,y1,c,n));roof(B,p,y1,c);}
function clip(p,axis,value,less){let q=[];p.forEach((a,i)=>{const b=p[(i+1)%p.length],da=(a[axis]-value)*(less?1:-1),db=(b[axis]-value)*(less?1:-1);if(da<=0)q.push(a);if((da<=0)!==(db<=0)){const t=da/(da-db);q.push([mix(a[0],b[0],t),mix(a[1],b[1],t)]);}});return q;}
function rectInside(p,x,z,w,d){const q=[[x-w/2,z-d/2],[x+w/2,z-d/2],[x+w/2,z+d/2],[x-w/2,z+d/2]];return validRing(q,p)?q:null;}
function inset(p,d){const s=sign(p),out=[];for(let i=0;i<p.length;i++){const a=p[(i+p.length-1)%p.length],b=p[i],c=p[(i+1)%p.length],u=[b[0]-a[0],b[1]-a[1]],v=[c[0]-b[0],c[1]-b[1]],lu=Math.hypot(...u),lv=Math.hypot(...v);if(lu<.01||lv<.01)return p;u[0]/=lu;u[1]/=lu;v[0]/=lv;v[1]/=lv;const n1=[-s*u[1],s*u[0]],n2=[-s*v[1],s*v[0]],den=1+n1[0]*n2[0]+n1[1]*n2[1];if(den<.15)return p;out.push([b[0]+d*(n1[0]+n2[0])/den,b[1]+d*(n1[1]+n2[1])/den]);}return validRing(out,p)?out:p;}
function hipRoof(B,p,y,rise,color){
  const sample=a=>[a[0],y+Math.min(rise,dist(a[0],a[1],p)*.65),a[1]];
  function tri(a,b,c,level=0){const ab=Math.hypot(a[0]-b[0],a[1]-b[1]),bc=Math.hypot(b[0]-c[0],b[1]-c[1]),ca=Math.hypot(c[0]-a[0],c[1]-a[1]);if(Math.max(ab,bc,ca)<3||level>=7){const va=sample(a),vb=sample(b),vc=sample(c);if((vb[2]-va[2])*(vc[0]-va[0])-(vb[0]-va[0])*(vc[2]-va[2])<0)B.tri(va,vc,vb,color);else B.tri(va,vb,vc,color);return;}const m=(a,b)=>[(a[0]+b[0])/2,(a[1]+b[1])/2];if(ab>=bc&&ab>=ca){const q=m(a,b);tri(a,q,c,level+1);tri(q,b,c,level+1);}else if(bc>=ca){const q=m(b,c);tri(a,b,q,level+1);tri(a,q,c,level+1);}else{const q=m(c,a);tri(a,b,q,level+1);tri(q,b,c,level+1);}}
  for(const t of THREE.ShapeUtils.triangulateShape(p.map(a=>new THREE.Vector2(...a)),[]))tri(...t.map(i=>p[i]));
}
function windows(B,p,base,H,{floors=3,width=2.5,ratio=.64,windowHeight=1.5,band=false,skip=()=>false}={}){
  faces(p,(a,b,L,n)=>{if(skip(a,b,L,n))return;const count=Math.max(1,Math.round(L/width));for(let f=0;f<floors;f++){const y=base+.95+f*(H-.8)/floors;if(band){panel(B.glass,a,b,.035,.965,y,Math.min(base+H-.45,y+windowHeight),PALETTE.glass,n);for(let j=1;j<count;j++)panel(B.detail,a,b,j/count-.025/L,j/count+.025/L,y,y+windowHeight,PALETTE.frame,n);}else for(let j=0;j<count;j++){const t=(j+.5)/count,w=ratio/count;panel(B.glass,a,b,t-w/2,t+w/2,y,Math.min(base+H-.45,y+windowHeight),PALETTE.glass,n);panel(B.detail,a,b,t-.035/L,t+.035/L,y,y+windowHeight,PALETTE.frame,n);panel(B.detail,a,b,t-w/2,t+w/2,y-.06,y+.02,PALETTE.white,n);}}});
}
function arch(B,a,b,base,top,n){const L=Math.hypot(b[0]-a[0],b[1]-a[1]),w=Math.min(4.4,L*.26),r=w/2,center=.5,cap=top-1.8-r,lo=base+3.8;panel(B.glass,a,b,center-r/L,center+r/L,lo,cap,PALETTE.blue,n);const pt=(dx,y)=>[mix(a[0],b[0],center+dx/L),y,mix(a[1],b[1],center+dx/L)];for(let j=0;j<20;j++){const u=j/20*Math.PI,v=(j+1)/20*Math.PI;B.glass.tri(pt(0,cap),pt(Math.cos(u)*r,cap+Math.sin(u)*r),pt(Math.cos(v)*r,cap+Math.sin(v)*r),PALETTE.blue,n);}for(let y=lo+2;y<cap;y+=2)panel(B.detail,a,b,center-r/L,center+r/L,y,y+.08,PALETTE.frame,n);panel(B.detail,a,b,center-.05/L,center+.05/L,lo,cap+r,PALETTE.frame,n);}
function buildOne(B,b,p,base,cfg){
  const profile=buildingProfile(b), style=cfg.style, H=cfg.height||((cfg.floors||b.lv||0)>0?(cfg.floors||b.lv)*(style.includes('Dorm')||style==='tower'||style==='faculty'?3.05:3.6)+.8:profile.height);
  const floors=cfg.floors||b.lv||Math.max(1,Math.round(H/3.3)), color=C(cfg.color), top=base+H;
  const deep=['deepEave','brickHall','facultyClub','ventHall','auditorium'].includes(style), wall=deep?inset(p,.62):p;
  volume(B.wall,p,base,base+.25,PALETTE.cream);volume(B.wall,wall,base+.25,top,color);
  const feature=[];
  if(style==='service'){
    windows(B,wall,base+H*.62,H*.32,{floors:1,width:6,ratio:.24,windowHeight:.7});windows(B,wall,base,H,{floors:1,width:12,ratio:.2,windowHeight:2.8});feature.push('low white laboratory','sparse clerestory windows');
  }else if(style==='workshop'){
    windows(B,wall,base,H,{floors:1,width:5,ratio:.7,windowHeight:2.7});faces(p,(a,b,L,n)=>panel(B.detail,a,b,0,1,top-1.5,top,PALETTE.white,n));
    for(let x=-61;x<0;x+=9.2){const z=-485.5,points=[new THREE.Vector3(x,base+2.8,z),new THREE.Vector3(x,top-1,z),new THREE.Vector3(x,top+.7,z+.3),new THREE.Vector3(x,top+.9,z+2.6)];B.detail.geometry(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),14,.36,8,false),PALETTE.silver,p);}
    feature.push('white flat parapet','seven curved silver extraction ducts');
  }else if(style==='deepEave'){
    windows(B,wall,base,H,{floors:3,width:5.2,ratio:.63,windowHeight:1.3});faces(wall,(a,b,L,n)=>{for(let s=0;s<L;s+=7.2)panel(B.detail,a,b,s/L,Math.min(1,(s+.36)/L),base+.2,top,PALETTE.brickDark,n);});feature.push('deep roof eave','brick piers','three narrow window levels');
  }else if(style==='facultyClub'){
    windows(B,wall,base,H,{floors:2,width:5,ratio:.35,windowHeight:1.3});faces(wall,(a,b,L,n)=>{if(n[2]>.8&&L>10){panel(B.glass,a,b,.37,.7,base+1.2,top-.65,PALETTE.blue,n);for(let y=base+2;y<top-.6;y+=1.5)panel(B.detail,a,b,.37,.7,y,y+.09,PALETTE.frame,n);}});feature.push('compact brick faculty club','large south teal window','tiled hipped roof');
  }else if(style==='auditorium'){
    windows(B,wall,base,H,{floors:2,width:7,ratio:.24,windowHeight:1.65});const hall=clip(clip(wall,0,105,true),1,-222,true);if(hall.length>2&&validRing(hall,p)){volume(B.wall,hall,top,base+18.5,color);faces(hall,(a,b,L,n)=>{windows(B,[a,b,[b[0]-n[0]*.1,b[1]-n[2]*.1],[a[0]-n[0]*.1,a[1]-n[2]*.1]],base+12,5.5,{floors:1,width:5.5,ratio:.12,windowHeight:2.2});for(const y of[7.6,11.3])panel(B.detail,a,b,0,1,base+y,base+y+.22,PALETTE.brick,n);});hipRoof(B.detail,hall,base+18.6,2.2,PALETTE.roof);}feature.push('high mostly solid auditorium hall','layered broad roof planes','slit windows');
  }else if(style==='ventHall'){
    windows(B,wall,base,H,{floors:2,width:4.3,ratio:.75,windowHeight:2.1});faces(wall,(a,b,L,n)=>{panel(B.detail,a,b,0,1,base+3.3,base+4.6,PALETTE.white,n);for(let s=.2;s<L;s+=5.2)panel(B.detail,a,b,s/L,Math.min(1,(s+.42)/L),base,top,PALETTE.white,n);});const q=rectInside(p,-165,-482,6,5);if(q){volume(B.wall,q,base,base+24,PALETTE.white);faces(q,(a,b,L,n)=>{panel(B.glass,a,b,.08,.92,base+20.4,base+21.8,PALETTE.blue,n);for(let j=0;j<5;j++)panel(B.detail,a,b,.12+j*.16,.16+j*.16,base+20,base+22.7,PALETTE.white,n);});const v=q.map(a=>[a[0],base+24+(a[0]+168)*.36,a[1]]);B.wall.quad(...v,PALETTE.white,[0,1,0]);}feature.push('white colonnade bands','slanted-top white vent tower');
  }else if(style==='itc'){
    windows(B,wall,base,H,{floors,width:4.3,ratio:.54,windowHeight:1.65});faces(wall,(a,b,L,n)=>{if(n[0]<-.7){panel(B.glass,a,b,.45,.65,base+3,top-2,PALETTE.blue,n);for(let f=2;f<floors;f++)panel(B.detail,a,b,.42,.68,base+f*3.6,base+f*3.6+.32,C(cfg.accent),n);}for(let s=3;s<L;s+=13)panel(B.detail,a,b,s/L,Math.min(1,(s+.7)/L),base+5,top-1,PALETTE.white,n);});feature.push('pale irregular footprint','yellow window-core accents','blue grouped glazing');
  }else if(style==='academic'||style==='academicGlass'){
    windows(B,wall,base,H,{floors:style==='academicGlass'?5:floors,width:2.7,band:true,windowHeight:1.6});if(style==='academicGlass')faces(wall,(a,b,L,n)=>{if(L>20)panel(B.glass,a,b,.35,.6,base+1,top-.7,PALETTE.blue,n);});feature.push('pale academic facade','horizontal dark glazing bands');
  }else{
    const dorm=['brickDorm','archedDorm','yellowDorm','brickHall'].includes(style);
    const isFaculty=style==='faculty';
    windows(B,wall,base,H,{floors,width:style==='village'?3.8:3.2,ratio:isFaculty?.66:.52,windowHeight:style==='tower'?1.55:1.7,skip:(a,b,L)=>isFaculty&&L<12});
    faces(wall,(a,b,L,n)=>{
      if(style==='greyDorm'){if(n[0]<-.7){panel(B.detail,a,b,.02,.98,base+.3,base+6.2,C(cfg.accent),n);for(let f=1;f<Math.min(3,floors);f++)for(let j=0;j<Math.max(1,Math.round(L/3.2));j++){const count=Math.max(1,Math.round(L/3.2));panel(B.glass,a,b,(j+.25)/count,(j+.75)/count,base+.8+f*2.6,base+2.1+f*2.6,PALETTE.glass,n);}}}
      if(style==='tower'){if(L<13)panel(B.detail,a,b,0,1,base+.3,top,C(cfg.accent),n);else for(let f=1;f<floors;f++)panel(B.detail,a,b,0,1,base+f*3.05,base+f*3.05+.15,PALETTE.white,n);}
      if(isFaculty){if(L<13){panel(B.detail,a,b,0,1,base+.3,top-7,C(cfg.accent),n);panel(B.detail,a,b,0,1,top-7,top,PALETTE.white,n);}else for(let f=1;f<floors;f++){panel(B.detail,a,b,0,1,base+f*3.05,base+f*3.05+.25,PALETTE.white,n);}}
      if(dorm)panel(B.detail,a,b,0,1,base+3.05,base+3.45,PALETTE.white,n);
      if(style==='village')for(let f=1;f<floors;f++){panel(B.detail,a,b,.02,.98,base+f*3.6,base+f*3.6+.3,PALETTE.white,n);for(let j=0;j<L/6;j++)panel(B.detail,a,b,(j*6+1)/L,Math.min(.98,(j*6+3.2)/L),base+f*3.6+.35,base+f*3.6+1.05,PALETTE.blue,n);}
      if(style==='yellowDorm'&&n[2]>.7){if((a[0]+b[0])/2>-289&&(a[0]+b[0])/2<-275){panel(B.detail,a,b,0,1,base+1,top+2.2,C(0xd3bd62),n);panel(B.glass,a,b,.2,.73,base+1.6,top+1.9,PALETTE.blue,n);}else if(L>18)for(let f=2;f<5;f++)panel(B.detail,a,b,.34,.7,base+f*3.05,base+f*3.05+.62,C(0xd3bd62),n);}
    });
    if(style==='archedDorm'){let chosen;faces(wall,(a,b,L,n)=>{if(n[2]>.7&&L>12&&(!chosen||L>chosen[2]))chosen=[a,b,L,n];});if(chosen)arch(B,chosen[0],chosen[1],base,top,chosen[3]);feature.push('red brick dormitory','white belt','tall arched blue-glass stair opening');}
    else feature.push(style==='yellowDorm'?'yellow vertical glass core and three yellow balcony bands':style==='faculty'?'mustard end walls and white-grey residential bands':style==='tower'?'white tower and pink end-wall panels':style==='greyDorm'?'gray dormitory with orange lower facade':style==='village'?'white balcony housing with blue panels and red dormer roof':'brick dormitory with white belt and repeated windows');
  }
  if(deep){volume(B.detail,p,top,top+.48,PALETTE.roof);hipRoof(B.detail,p,top+.48,style==='facultyClub'?2.9:1.8,PALETTE.roof);}
  if(style==='village'){
    hipRoof(B.detail,p,top,3.0,C(0x89544d));faces(p,(a,b,L,n)=>{if(L<18)return;for(let s=5;s<L-3;s+=9){const t=s/L,w=1.9/L;panel(B.detail,a,b,t-w/2,t+w/2,top+.2,top+1.4,PALETTE.white,n);panel(B.glass,a,b,t-w*.36,t+w*.36,top+.4,top+1.1,PALETTE.glass,n);const p0=[mix(a[0],b[0],t-w/2),top+1.4,mix(a[1],b[1],t-w/2)],p1=[mix(a[0],b[0],t),top+2,mix(a[1],b[1],t)],p2=[mix(a[0],b[0],t+w/2),top+1.4,mix(a[1],b[1],t+w/2)];B.detail.tri(p0,p1,p2,PALETTE.white,n);}});
  }
  if(style==='tower'){const q=inset(p,.75);faces(q,(a,b,L,n)=>{if(L<8)return;panel(B.detail,a,b,0,1,top+2.5,top+3.1,PALETTE.pink,n);for(let s=.5;s<L;s+=6)panel(B.detail,a,b,s/L,Math.min(1,(s+.55)/L),top,top+3.1,PALETTE.white,n);});}
  return {heightM:H,top:base+(style==='auditorium'?20.8:style==='ventHall'?26.3:H+(style==='tower'?3.1:deep?3.4:style==='village'?3:style==='yellowDorm'?2.2:0)),features:feature,heightBasis:cfg.height?'photo-informed approximate height':b.lv?'OSM levels multiplied by estimated storey height':profile.source};
}
function buildDome(B,b,p,base){
  const x=-120.55,z=-532.7,r=5.6,segments=48,rings=14;volume(B.wall,p,base,base+2.4,PALETTE.white);
  const point=(j,k)=>{const a=j/segments*Math.PI*2,t=k/rings*Math.PI/2,rr=r*Math.cos(t)*(1+.08*Math.sin(t*2));return[x+Math.cos(a)*rr,base+2.4+7.5*Math.sin(t),z+Math.sin(a)*rr];};
  for(let k=0;k<rings;k++)for(let j=0;j<segments;j++){const q=[point(j,k),point(j+1,k),point(j+1,k+1),point(j,k+1)];if(q.every(a=>inside(a[0],a[2],p)))B.detail.quad(...q.reverse(),j%6===0?C(0xb6c4c8):C(0xe0e4df));}
  return{heightM:9.9,top:base+9.9,features:['white segmented dome','low pale drum'],heightBasis:'photo-informed approximate; unnamed source footprint'};
}

/** Three shared draw calls regardless of building count. No DOM or textures. */
export function buildCapturedArchitecture(scene,D={},hAt=()=>0){
  const result={handledIds:new Set(),labels:[],models:[],metadata:{reference:'map_resource/*.png, April 2025 screenshot UI',scope:'code-native, photo-informed approximations',drawCalls:0,models:[],excludedUncertain:['distant water tower in 55','unverified N5/N6 overhead connection','KBSI external building identity']}};
  const B={wall:new Batch(),glass:new Batch(),detail:new Batch()};
  for(const b of D.buildings||[]){const cfg=CONFIG[b.ref],dome=b.id===1534507881;if((!cfg&&!dome)||!b.p||b.p.length<3)continue;
    const p=b.p.filter((a,i)=>i===0||Math.hypot(a[0]-b.p[i-1][0],a[1]-b.p[i-1][1])>.01).map(a=>[...a]);if(p.length>3&&Math.hypot(p[0][0]-p.at(-1)[0],p[0][1]-p.at(-1)[1])<.01)p.pop();if(p.some(a=>!a.every(Number.isFinite)))continue;
    const heights=p.map(a=>hAt(...a));if(!heights.every(Number.isFinite))continue;const base=Math.min(...heights)-.65,start=Object.fromEntries(Object.entries(B).map(([k,v])=>[k,v.p.length/3]));
    const detail=dome?buildDome(B,b,p,base):buildOne(B,b,p,base,cfg),ranges=Object.fromEntries(Object.entries(B).map(([k,v])=>[k,[start[k],v.p.length/3]]));
    const model={id:b.id,ref:b.ref||'',name:campusName(b),sourceFootprint:p,baseElevationM:base,...detail,capturePhotos:dome?[32,33]:cfg.photos,matchConfidence:cfg?.confidence||'high route/building identification; approximate facade dimensions',geometryRanges:ranges};
    result.models.push(model);result.metadata.models.push(model);result.handledIds.add(b.id);if(b.ref)result.labels.push({ref:b.ref,name:campusName(b),en:campusName(b),x:p.reduce((s,a)=>s+a[0],0)/p.length,z:p.reduce((s,a)=>s+a[1],0)/p.length,y:detail.top+5});
  }
  for(const [kind,b]of Object.entries(B)){if(!b.p.length)continue;const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:kind==='glass'?.24:kind==='detail'?.64:.86,metalness:kind==='glass'?.35:kind==='detail'?.14:.01,polygonOffset:true,polygonOffsetFactor:kind==='glass'?-2:kind==='detail'?-3:0,polygonOffsetUnits:kind==='glass'?-2:kind==='detail'?-3:0});const mesh=b.mesh(material,`captured-architecture-${kind}`);mesh.userData={captureArchitecture:true,kind};scene.add(mesh);result.metadata.drawCalls++;}
  result.metadata.triangles=Object.values(B).reduce((s,b)=>s+b.p.length/9,0);return result;
}
