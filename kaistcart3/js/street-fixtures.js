import * as THREE from '../lib/three.module.min.js';
import {crossingSurvey, transitStops} from './street-inventory.js';
import {isMotorRoad} from './explore-surfaces.js';

// A marked crossing follows the direction of its pedestrian way, which can be
// skew to the road centreline. Only paint crossings with a mapped marking.
export function paintMappedCrossings(roadIndex, face, quad, markings, colour) {
  let count = 0;
  for (const crossing of crossingSurvey) {
    if (crossing.marking === 'no' || crossing.marking === 'unknown') continue;
    // The E3 court crossing is painted on its surveyed raised table.
    if(crossing.way===210339936 && crossing.p[0]===317 && crossing.p[1]===293.4)continue;
    const [x,z] = crossing.p;
    const hit = roadIndex.nearest(x,z,9,r => crossing.way ? r.id === crossing.way : isMotorRoad(r));
    if (!hit || hit.distance > hit.s.road.width/2+1.2) continue;
    const {s,along} = hit, half = s.road.width/2-.23;
    const angle = crossing.angle*Math.PI/180;
    const across = Math.cos(angle)*s.dz-Math.sin(angle)*s.dx;
    const longitudinal = Math.cos(angle)*s.dx+Math.sin(angle)*s.dz;
    const skew = Math.abs(across)>.5 ? longitudinal/across : 0;
    const width = Math.min(6,Math.max(2.1,crossing.width || (crossing.marking==='zebra:double'?4.2:3.2)));
    const paint = (v0,v1,u0,u1) => {
      const point=(v,u)=>face(s,along+u*skew+v,u,.035);
      quad(markings,point(v0,u0),point(v0,u1),point(v1,u1),point(v1,u0),colour);
    };
    const rim = crossing.marking==='ladder' || crossing.marking==='lines';
    if (rim) for (const side of [-1,1]) {
      // Break the thin outside rails into short strips so they follow the camber.
      for (let u=-half;u<half;u+=1.5) paint(side*width/2-.07,side*width/2+.07,u,Math.min(half,u+1.5));
    }
    if (crossing.marking!=='lines') {
      const stripes = Math.max(2,Math.round(2*half/.9)), pitch = 2*half/stripes;
      for (let i=0;i<stripes;i++) {
        const u=-half+pitch*(i+.5), radius=pitch*.25;
        if (crossing.marking==='zebra:double') {
          paint(-width/2,-.14,u-radius,u+radius); paint(.14,width/2,u-radius,u+radius);
        } else paint(-width/2,width/2,u-radius,u+radius);
      }
    }
    count++;
  }
  return count;
}

const up=[0,1,0], uv=[0,0], colours=new Map();
function shade(hex) {
  if (!colours.has(hex)) colours.set(hex,new THREE.Color(hex));
  return colours.get(hex);
}
// Model coordinates are metres along the verge, up from the surface, and out
// from the carriageway. Correct winding in MB also supports the opposite verge.
function localGeometry(batch,project,tx,tz,nx,nz) {
  const panel=(a,b,c,d,n,hex) => batch.quad(project(...a),project(...b),project(...c),project(...d),
    [n[0]*tx+n[2]*nx,n[1],n[0]*tz+n[2]*nz],uv,uv,uv,uv,shade(hex));
  const box=(u,y,v,width,height,depth,color) => {
    const a=u-width/2,b=u+width/2,c=v-depth/2,d=v+depth/2,h=y+height;
    panel([a,y,c],[b,y,c],[b,h,c],[a,h,c],[0,0,-1],color);
    panel([a,y,d],[b,y,d],[b,h,d],[a,h,d],[0,0,1],color);
    panel([a,y,c],[a,y,d],[a,h,d],[a,h,c],[-1,0,0],color);
    panel([b,y,c],[b,y,d],[b,h,d],[b,h,c],[1,0,0],color);
    panel([a,h,c],[b,h,c],[b,h,d],[a,h,d],up,color);
    panel([a,y,c],[b,y,c],[b,y,d],[a,y,d],[0,-1,0],color);
  };
  return {box,panel};
}

function bridgeWalkMaterial(){
  const size=256,c=document.createElement('canvas');c.width=c.height=size;
  const ctx=c.getContext('2d');ctx.fillStyle='#96928f';ctx.fillRect(0,0,size,size);
  for(let j=0;j<14;j++)for(let i=-1;i<10;i++){
    const seed=(Math.imul(j+7,2654435761)^Math.imul((i+9)%9+4,668265263))>>>0;
    const grey=[195,203,211,218,222,224][seed%6],w=size/9,h=size/14;
    ctx.fillStyle='rgb('+grey+','+(grey-2)+','+(grey-3)+')';
    ctx.fillRect(Math.floor((i+(j%2)*.5)*w)+.8,Math.floor(j*h)+.65,Math.ceil(w)-1.2,Math.ceil(h)-1.1);
  }
  const map=new THREE.CanvasTexture(c);map.wrapS=map.wrapT=THREE.RepeatWrapping;map.anisotropy=4;map.colorSpace=THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({map,vertexColors:true,roughness:.94});
}

function buildPondBridge(world,batch,markings,pavers) {
  // NAVER n_7GLZxlnNHu8dtldnCqdw (October 2026): yellow chrysanthemums in a
  // continuous stone planter, arched openings and large posts at the abutments.
  const road=world.explore.roads.find(r=>r.id===426204521), way=world.roadIndex.ways.get(road);
  if (!way?.deck) return;
  const s=way.segments[0], deck=u=>way.deck[0]+(way.deck[1]-way.deck[0])*u/way.length+.2;
  // The northbound view shows a pedestrian-warning diamond in each lane.
  const asphaltPoint=(u,y,v)=>[s.a[0]+s.dx*u-s.dz*v,deck(u)+y,s.a[1]+s.dz*u+s.dx*v];
  const stripe=localGeometry(markings,asphaltPoint,s.dx,s.dz,-s.dz,s.dx);
  for(const lane of [road.width/8,road.width*3/8]) {
    const u=way.length*.70, outer=[[u-1.6,lane],[u,lane+.54],[u+1.6,lane],[u,lane-.54]], inner=[[u-1.28,lane],[u,lane+.405],[u+1.28,lane],[u,lane-.405]];
    const onRoad=p=>[p[0],.038,p[1]];
    for(let i=0;i<4;i++)stripe.panel(onRoad(outer[i]),onRoad(outer[(i+1)%4]),onRoad(inner[(i+1)%4]),onRoad(inner[i]),up,0xe0dfd9);
  }
  const approaches=[504338794,504338795].map(id=>world.explore.roads.find(r=>r.id===id));
  const trim=0x898285, stone=0x9d9190, shadow=0x685f61;
  for (const sidewalk of approaches) {
    if (!sidewalk) continue;
    const cx=s.a[0]+s.dx*s.span/2, cz=s.a[1]+s.dz*s.span/2;
    const offset=(sidewalk.p[0][0]-cx)*s.dz-(sidewalk.p[0][1]-cz)*s.dx;
    const side=Math.sign(offset), outer=Math.abs(offset)+sidewalk.width/2;
    const nx=s.dz*side,nz=-s.dx*side;
    const project=(u,y,v)=>[s.a[0]+s.dx*u+nx*v,deck(u)+y,s.a[1]+s.dz*u+nz*v];
    const {panel,box}=localGeometry(batch,project,s.dx,s.dz,nx,nz);
    const v=outer+.10, span=way.length-.8, bays=Math.round(span/2.9), pitch=span/bays;
    box(way.length/2,-.45,(road.width/2+outer)/2,way.length,.43,outer-road.width/2,shadow);
    // Two warm brick bands enclose the grey walking surface. They have the
    // same deck slope as the stone edge, including at both abutments.
    const inner=road.width/2+.17,edge=outer-.10;
    const pavement=(lo,hi,hex)=>{
      if(hi<=lo)return;
      const pts=[[.32,lo],[way.length-.32,lo],[way.length-.32,hi],[.32,hi]];
      pavers.quad(...pts.map(([u,w])=>project(u,.081,w)),up,...pts.map(([u,w])=>[u/1.75,w/1.75]),shade(hex));
    };
    // Pink-to-violet brick beside the kerb, with a wider band of tan paving
    // alongside the planters. Both bands are visible along the viewing axis.
    pavement(inner,inner+.47,0xab9da9);
    pavement(inner+.47,edge-.94,0xb2afba);
    pavement(edge-.94,edge,0xbca69a);
    box(way.length/2,.026,road.width/2+.05,way.length,.065,.16,trim);
    box(way.length/2,.07,v,span,.11,.29,trim);
    box(way.length/2,.89,v,span,.10,.4,stone);
    box(way.length/2,.98,v,span,.17,.46,trim);
    box(way.length/2,1.145,v,span,.035,.35,0x43513c);
    for (let i=0;i<bays;i++) {
      const a=.4+i*pitch, b=a+pitch, endInset=.16;
      box(a,.17,v,endInset*2,.72,.22,stone);
      // Stone spandrels, with an open semicircular void in the wall below.
      const arch=(j)=>[a+endInset+(b-a-2*endInset)*j/8,.22+.43*Math.sin(j*Math.PI/8)];
      for (let j=0;j<8;j++) {
        const [ua,ha]=arch(j),[ub,hb]=arch(j+1);
        for(const sign of [-1,1]) {
          const edge=v+sign*.115;
          panel([ua,ha,edge],[ub,hb,edge],[ub,.895,edge],[ua,.895,edge],[0,0,sign],stone);
        }
        panel([ua,ha,v-.115],[ub,hb,v-.115],[ub,hb,v+.115],[ua,ha,v+.115],[0,-1,0],shadow);
      }
      for(let k=0;k<3;k++){
        const u=a+(k+.5)*pitch/3,half=pitch*.158;
        // Light planter boxes have a visible joint on either side, including
        // the shaded face seen looking along the bridge from the shuttle stop.
        for(const dir of [-1,1]){
          panel([u-half+.04,1.06,v+.18*dir],[u+half-.04,1.06,v+.18*dir],[u+half,1.21,v+.24*dir],[u-half,1.21,v+.24*dir],[0,.2,dir],0xb6b6bf);
          panel([u-half,1.22,v+.199*dir],[u+half,1.22,v+.199*dir],[u+half,1.31,v+.166*dir],[u-half,1.31,v+.166*dir],[0,.22,dir],0x546630);
        }
        box(u,1.19,v,half*2+.016,.036,.50,0xcac9ce);
        for(let j=0;j<5;j++){
          const flowerU=u+(j-2)*half*.39,flowerV=v+.06*Math.sin(i*2.4+k*1.7+j*2.3);
          const r=half*.39,h=1.36+.028*Math.cos(i*7+k+j*1.7);
          const bloom=[0xcba20c,0xd4a90d,0xe3b80d,0xf4ca24,0xe4bb12][(i+k+j)%5];
          const centre=project(flowerU,h+.07,flowerV);
          for(let n=0;n<6;n++){
            const t=n*Math.PI/3,w=t+Math.PI/3;
            const rim=v1=>[flowerU+r*Math.cos(v1),h-.015,flowerV+r*.79*Math.sin(v1)];
            const low=v1=>[flowerU+r*.97*Math.cos(v1),1.19,flowerV+r*.85*Math.sin(v1)];
            const normal=[.52*Math.cos(t+.52),.82,.52*Math.sin(t+.52)];
            batch.tri(project(...rim(t)),project(...rim(w)),centre,[normal[0]*s.dx+normal[2]*nx,normal[1],normal[0]*s.dz+normal[2]*nz],uv,uv,uv,shade(bloom));
            panel(low(t),low(w),rim(w),rim(t),[Math.cos(t+.52),.25,Math.sin(t+.52)],(j+n)%3?bloom:0x72813e);
          }
        }
      }
    }
    for (const u of [.32,way.length-.32]) {
      box(u,.015,v,.61,1.12,.65,stone); box(u,1.13,v,.69,.105,.74,trim);
    }
  }
}

function buildKaimaruCanopy(world,ground,terrain,batch,markings) {
  // May 2023 NAVER view fX_slKi1gDvR2KwFMBCrHg, yaw -116: an open-sided
  // shelter next to the painted boarding bay, west of the parked OLEV shuttle.
  const hit=world.roadIndex.nearest(-286,-382.7,8,r=>r.id===468996775);
  if(!hit)return;
  const {s}=hit, nx=s.dz,nz=-s.dx, offset=s.road.width/2+.55;
  const x=hit.x+nx*offset,z=hit.z+nz*offset;
  const project=(u,y,v)=>[x+s.dx*u+nx*v,ground(x+s.dx*u+nx*v,z+s.dz*u+nz*v)+y,z+s.dz*u+nz*v];
  const {box,panel}=localGeometry(batch,project,s.dx,s.dz,nx,nz);
  // Red brick waiting strip and raised edge on the south verge.
  box(0,.02,.80,6.7,.095,1.80,0x9e7667);
  box(0,.02,-.11,6.7,.095,.13,0xb5b2a4);
  for (const u of [-2.4,0,2.4]) {
    box(u,.115,1.43,.11,2.12,.12,0xdfded0);
    box(u,.115,.13,.085,2.09,.095,0xd2d0c4);
    box(u,2.13,.82,.10,.075,1.67,0xc9c9bb);
  }
  // Curved open roof. The camera shows a pale body and a mustard fascia.
  const profile=[[-.16,2.20],[.18,2.29],[.60,2.35],[1.02,2.35],[1.44,2.29],[1.76,2.21]];
  for(let i=1;i<profile.length;i++){
    const [v0,h0]=profile[i-1],[v1,h1]=profile[i];
    panel([-2.58,h0,v0],[2.58,h0,v0],[2.58,h1,v1],[-2.58,h1,v1],up,0xc7bd93);
    panel([-2.58,h0-.055,v0],[2.58,h0-.055,v0],[2.58,h1-.055,v1],[-2.58,h1-.055,v1],[0,-1,0],0xb9af93);
  }
  box(0,2.10,-.15,5.19,.105,.08,0xc3a45c);
  // Open boarding box continues toward the east on the south lane. Only the
  // painted outline can be identified from the unobstructed part of the view.
  const roadPoint=(u,y,v)=>{
    const xx=x+s.dx*u+nx*v,zz=z+s.dz*u+nz*v;
    return [xx,terrain(xx,zz)+.2+y,zz];
  };
  const paint=localGeometry(markings,roadPoint,s.dx,s.dz,nx,nz);
  const rect=(a,b,c,d)=>paint.panel([a,.033,c],[b,.033,c],[b,.033,d],[a,.033,d],up,0xd8ad53);
  for(let u=-8;u<2;u+=1){rect(u,u+1,-.86,-.76);rect(u,u+1,-2.05,-1.95);}
  rect(-8,-7.9,-2.05,-.76);rect(1.90,2,-2.05,-.76);
}

const stopNames = {
  '한국과학기술원 북문':'KAIST North Gate', '한국과학기술원 대강당':'Auditorium',
  '한국과학기술원 본관':'Main Administration', '한국과학기술원 오리연못':'Duck Pond',
  '한국과학기술원 교수회관':'Faculty Club', '카이스트 셔틀버스 정류소':'KAIST Shuttle',
  'KAIST Shuttle Bus Stop':'KAIST Shuttle','카이스트':'KAIST','한빛아파트':'Hanbit Apartments',
  '대전지방기상청':'Meteorological Office','구성삼거리':'Guseong Junction',
  '한국생명공학연구원':'KRIBB','한국지질자원연구원':'KIGAM','원자력안전기술원':'KINS'
};
function signage(stops) {
  const canvas=document.createElement('canvas'),tw=256,th=128,cols=4,rows=Math.ceil((stops.length+1)/cols);
  canvas.width=cols*tw;canvas.height=rows*th;
  const ctx=canvas.getContext('2d');
  for (let i=0;i<stops.length;i++) {
    const x=(i%cols)*tw,y=Math.floor(i/cols)*th, stop=stops[i];
    ctx.fillStyle='#145b80';ctx.fillRect(x,y,tw,th);ctx.fillStyle='#ebece1';ctx.fillRect(x+6,y+7,tw-12,th-14);
    ctx.fillStyle='#145b80';ctx.fillRect(x+6,y+7,tw-12,45);
    ctx.fillStyle='#f5f5ec';ctx.font='bold 28px sans-serif';ctx.textBaseline='middle';ctx.fillText(stop.ref?'BUS STOP':'KAIST SHUTTLE',x+15,y+31,tw-29);
    ctx.fillStyle='#162c38';ctx.font='bold 24px sans-serif';ctx.fillText(stopNames[stop.name] || stop.name,x+14,y+78,tw-28);
    ctx.fillStyle='#52676a';ctx.font='16px sans-serif';ctx.fillText(stop.ref || 'Campus service',x+14,y+105,tw-28);
  }
  const x=stops.length%cols*tw,y=Math.floor(stops.length/cols)*th;
  ctx.fillStyle='#a93442';ctx.fillRect(x,y,tw,th);
  ctx.fillStyle='#fff5eb';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.font='bold 47px sans-serif';ctx.fillText('정지',x+tw/2,y+43,tw*.74);
  ctx.font='bold 35px sans-serif';ctx.fillText('STOP',x+tw/2,y+85,tw*.55);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;
  const coords=i=>{
    const x=(i%cols)*tw,y=Math.floor(i/cols)*th;
    const l=(x+1)/canvas.width,r=(x+tw-1)/canvas.width,t=1-(y+1)/canvas.height,b=1-(y+th-1)/canvas.height;
    return [[l,b],[r,b],[r,t],[l,t]];
  };
  return {texture,coords};
}

function buildWestExit(world,ground,solid,signs,atlas){
  // In the g6FoUO6 south-facing panorama the stop sign stands inside the
  // right grass verge. The orange convex mirror is nearer the main road.
  const square=atlas.coords(transitStops.length);
  for(const [x,z,heading,mirror] of [[-234.25,385.4,2.98,false],[-235.3,388.1,2.48,true]]){
    if(world.access.isDrivable(x,z))continue;
    const y=ground(x,z),cx=Math.sin(heading),cz=Math.cos(heading);
    const project=(u,v,d)=>[x+cz*u+cx*d,y+v,z-cx*u+cz*d];
    const {box}=localGeometry(solid,project,cz,-cx,cx,cz);
    const h=mirror?2.23:1.73,radius=mirror?.40:.32,n=mirror?20:8,normal=[cx,0,cz];
    box(0,-.12,-.045,mirror?.058:.047,h+.10,mirror?.058:.047,mirror?0xb45d36:0xa3a6a2);
    const front=mirror?solid:signs,rim=shade(mirror?0xbc6139:0xc5c5bf);
    for(let i=0;i<n;i++){
      const a=2*Math.PI*(i+.5)/n,b=a+2*Math.PI/n;
      const at=(angle,r,d)=>project(r*Math.cos(angle),h+r*Math.sin(angle),d);
      const rimNormal=[cz*Math.cos((a+b)/2),Math.sin((a+b)/2),-cx*Math.cos((a+b)/2)];
      solid.quad(at(a,radius,-.06),at(b,radius,-.06),at(b,radius,.006),at(a,radius,.006),rimNormal,uv,uv,uv,uv,rim);
      solid.tri(project(0,h,-.06),at(a,radius,-.06),at(b,radius,-.06),[-cx,0,-cz],uv,uv,uv,rim);
      const faceRadius=radius-(mirror?.027:.011);
      solid.quad(at(a,faceRadius,.006),at(a,radius,.006),at(b,radius,.006),at(b,faceRadius,.006),normal,uv,uv,uv,uv,rim);
      const map=(u,v)=>[square[0][0]+(square[2][0]-square[0][0])*(.5+.5*u),square[0][1]+(square[2][1]-square[0][1])*(.5+.5*v)];
      const tint=mirror?shade(Math.sin((a+b)/2)>.12?0xb4c6cc:0xa3ae9e):shade(0xffffff);
      front.tri(project(0,h,mirror?.061:.006),at(a,faceRadius,.006),at(b,faceRadius,.006),normal,
        map(0,0),map(Math.cos(a),Math.sin(a)),map(Math.cos(b),Math.sin(b)),tint);
    }
  }
}

export function buildStreetFixtures(scene,world,ground,terrain,MB,flat) {
  const solid=new MB(),glass=new MB(),signs=new MB(),markings=new MB(),pavers=new MB(),atlas=signage(transitStops);
  const platforms=[];
  for (let i=0;i<transitStops.length;i++) {
    const stop=transitStops[i], [sx,sz]=stop.p;
    const hit=world.roadIndex.nearest(sx,sz,32,r=>r.roadClass==='street');
    if (!hit) continue;
    const {s}=hit, side=Math.sign((sx-hit.x)*s.dz-(sz-hit.z)*s.dx) || 1;
    const nx=s.dz*side,nz=-s.dx*side;
    // Some platform points sit on a road centreline or in a mapped driveway.
    // Offset only enough to set each foundation entirely on the roadside.
    const open=(x,z)=>{
      const g=world.G,k=(Math.floor(z)-g.z0)*g.w+Math.floor(x)-g.x0;
      return x>=g.x0 && x<g.x0+g.w && z>=g.z0 && z<g.z0+g.h && g.d[k]!==8 && g.d[k]!==9 && !world.access.isDrivable(x,z);
    };
    let x,z,fit=false;
    const room=(u,v)=>open(x+s.dx*u+nx*v,z+s.dz*u+nz*v);
    for (let slide=0;slide<=4;slide+=.45) {
      const offset=Math.max(hit.distance,s.road.width/2+.5)+slide;
      x=hit.x+nx*offset;z=hit.z+nz*offset;
      if (room(0,0) && room(0,-.14)) { fit=true;break; }
    }
    if (!fit) continue;
    // Shared shuttle and city boarding points sometimes occupy one platform.
    const earlier=platforms.find(p=>Math.hypot(p.x-x,p.z-z)<2.8 && p.nx*nx+p.nz*nz>.7);
    if (earlier) continue;
    const y0=ground(x,z), project=(u,y,v)=>[x+s.dx*u+nx*v,y0+y,z+s.dz*u+nz*v];
    const {box}=localGeometry(solid,project,s.dx,s.dz,nx,nz);
    const {panel}=localGeometry(glass,project,s.dx,s.dz,nx,nz);
    const steel=0x42535a, aluminum=0xb0bec0;
    const shelter=stop.shelter && [-1.98,0,1.98].every(u=>[.22,1.50].every(v=>room(u,v)));
    const signU=shelter?1.76:0;
    box(signU,0,.05,.15,.12,.26,aluminum);box(signU,.12,.05,.082,2.37,.082,steel);
    box(signU,1.99,.04,.81,.47,.065,0x667d80);
    const a=signU-.387,b=signU+.387, coords=atlas.coords(i);
    const signPoints=[[a,2.01,0],[b,2.01,0],[b,2.44,0],[a,2.44,0]];
    // The board reads left-to-right when seen from the roadway on either verge.
    if(side<0)coords.splice(0,4,coords[1],coords[0],coords[3],coords[2]);
    signs.quad(...signPoints.map(p=>project(...p)),[-nx,0,-nz],...coords,shade(0xffffff));
    if (shelter) {
      const half=1.98;
      box(0,2.41,.89,half*2+.18,.15,1.83,steel);box(0,2.56,.90,half*2+.22,.046,1.89,0xb8c7c8);
      for (const u of [-half,0,half])box(u,0,1.49,.07,2.41,.07,steel);
      for (const u of [-half,half])box(u,0,.27,.07,2.41,.07,steel);
      const glassColour=0x89b2bd;
      for(const [a,b] of [[-half+.04,-.04],[.04,half-.04]])panel([a,.31,1.49],[b,.31,1.49],[b,2.34,1.49],[a,2.34,1.49],[0,0,-1],glassColour);
      for(const u of [-half,half])panel([u,.31,.30],[u,.31,1.46],[u,2.34,1.46],[u,2.34,.30],[Math.sign(u),0,0],glassColour);
      for (const y of [.86,1.08])box(0,y,1.477,3.94,.034,.021,aluminum);
      if(stop.bench){
        for(const u of [-.98,.98])box(u,0,1.02,.11,.44,.30,steel);
        for(let slat=0;slat<4;slat++)box(0,.43,.86+slat*.103,2.75,.056,.086,0x9a7861);
        box(0,.62,1.22,2.75,.20,.054,0x9a7861);
      }
      if(stop.bin){box(1.61,0,1.02,.33,.67,.34,0x738387);box(1.61,.67,1.02,.36,.07,.37,steel);}
    }
    platforms.push({x,z,nx,nz,shelter});
  }
  buildPondBridge(world,solid,markings,pavers);
  buildWestExit(world,ground,solid,signs,atlas);
  if(pavers.p.length)flat(scene,pavers,bridgeWalkMaterial(),3).name='Duck Pond bridge pavers';
  buildKaimaruCanopy(world,ground,terrain,solid,markings);
  const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.78});
  if(solid.p.length){const mesh=flat(scene,solid,material,1);mesh.name='Street furniture · Duck Pond bridge and transit stops';mesh.castShadow=true;}
  if(glass.p.length)flat(scene,glass,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.33,side:THREE.DoubleSide,transparent:true,opacity:.31,depthWrite:false}),1).name='Street furniture · shelter glazing';
  if(markings.p.length)flat(scene,markings,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.92}),5).name='Street furniture · approach paint';
  if(signs.p.length)flat(scene,signs,new THREE.MeshStandardMaterial({map:atlas.texture,roughness:.83}),1).name='Street furniture · platform names';
  return {platforms:platforms.length,shelters:platforms.filter(p=>p.shelter).length};
}
