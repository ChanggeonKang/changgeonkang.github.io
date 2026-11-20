import * as T from '../lib/three.module.min.js';
import {FixtureInstances} from './survey-fixture-instances.js';
import {addBridgeGallery,galleryCurve} from './bridge-gallery.js';

const roadId=472047942, walkIds=[491722981,472047932];
export const isKaistBridgeWalk=id=>walkIds.includes(id);
const ramps=new Set([979941427,979941428,979948501,510063393,923331513,979941429]);
const hue=n=>new T.Color(n),up=[0,1,0],down=[0,-1,0],uv=p=>[p[0]/4,p[2]/4];
const concrete=hue(0xb6b6a9),soffit=hue(0x92948d),curb=hue(0xc5c4b8);
const walking=hue(0xc9bca4),rail=0xcfcebd,post=0xb5b6ad;
const mix=(a,b,t)=>a+(b-a)*t,clamp=t=>Math.max(0,Math.min(1,t));
const face=(batch,a,b,c,d,n,colour)=>batch.quad(a,b,c,d,n,uv(a),uv(b),uv(c),uv(d),colour);

// Concrete beneath the six separately mapped approach spans. The cycleway
// stays clear below them and their top faces remain the ordinary asphalt.
export function addKaistRampShell(batch,s,a,b,point){
  if(!ramps.has(s.road.id))return;
  const half=s.road.width/2, p=(t,v,h)=>point(s,t,v,h);
  for(const sign of [-1,1]){
    const q=sign*half,n=[sign*s.dz,0,-sign*s.dx];
    face(batch,p(a,q,-.025),p(b,q,-.025),p(b,q,-.39),p(a,q,-.39),n,concrete);
  }
  face(batch,p(a,-half,-.39),p(a,half,-.39),p(b,half,-.39),p(b,-half,-.39),down,soffit);
}

// The full bridge is 25.9 m wide in Daejeon's completion notice. The
// mapped footways trace its two outer promenades. Public views from both
// ends show silver multi-rail parapets and a separate barrier beside cars.
export function buildKaistBridge(scene,world,streetDatum,paving,structure){
  const ways=[...world.roadIndex.ways],main=ways.find(([r])=>r.id===roadId);
  if(!main)return;
  const [road,way]=main,first=road.p[0],last=road.p.at(-1);
  const length=Math.hypot(last[0]-first[0],last[1]-first[1]),dx=(last[0]-first[0])/length,dz=(last[1]-first[1])/length;
  const local=([x,z])=>({s:(x-first[0])*dx+(z-first[1])*dz,q:(x-first[0])*dz-(z-first[1])*dx});
  const at=(s,q,y)=>[first[0]+s*dx+q*dz,y,first[1]+s*dz-q*dx];
  const interpolate=(points,s)=>{
    let i=1;
    while(i<points.length-1&&s>points[i].s)i++;
    const a=points[i-1],b=points[i],t=clamp((s-a.s)/(b.s-a.s));
    return mix(a.q,b.q,t);
  };
  const centre=road.p.map(local),fixtures=new FixtureInstances();
  const tracks=walkIds.map(id=>ways.find(([r])=>r.id===id)?.[0]);
  if(tracks.some(r=>!r))return;
  const walks=tracks.map(r=>({profile:r.p.map(local),ends:[r.p[0],r.p.at(-1)].map(p=>streetDatum(...p)+.12),width:r.width}));
  const drivingY=s=>mix(way.deck[0],way.deck[1],clamp(s/length))+.20;
  function section(walk,side,s){
    const p=walk.profile,start=p[0].s,end=p.at(-1).s;
    const centreQ=interpolate(p,s),ordinaryOuter=centreQ+side*walk.width/2;
    const outer=ordinaryOuter+side*4.42*galleryCurve(s);
    const kerb=interpolate(centre,s)+side*(road.width/2+.008);
    const full=clamp(Math.min(s+1,length+1-s)/6);
    let inner=mix(centreQ-side*walk.width/2,kerb,full);
    const legal=q=>{const [x,,z]=at(s,q,0);return world.access.isDrivable(x,z,Infinity);};
    if(legal(inner) && !legal(outer)){
      let a=inner,b=outer;
      for(let i=0;i<12;i++){const m=(a+b)/2;if(legal(m))a=m;else b=m;}
      inner=b;
    }
    const top=drivingY(s)+.135;
    const y=s<0?mix(walk.ends[0],top,clamp((s-start)/(-start))):
      s>length?mix(top,walk.ends[1],clamp((s-length)/(end-length))):top;
    return {s,inner,outer,ordinaryOuter,y,at:(q,h)=>at(s,q,y+h)};
  }
  const vec=p=>new T.Vector3(...p);
  function beam(a,b,r,colour){fixtures.rod(vec(a),vec(b),r,colour);}
  const loops=[];
  for(const [i,walk] of walks.entries()){
    const side=i?1:-1,profile=walk.profile,start=profile[0].s,end=profile.at(-1).s;
    const intervals=Math.ceil((end-start)/2.9);
    const stations=[0,6,99.6,161.2,length-6,length,...profile.map(p=>p.s)];
    for(let k=0;k<=intervals;k++)stations.push(mix(start,end,k/intervals));
    const rows=[...new Set(stations)].sort((a,b)=>a-b).map(s=>section(walk,side,s));
    loops.push(s=>section(walk,side,s));
    for(let k=1;k<rows.length;k++){
      const a=rows[k-1],b=rows[k],normal=[side*dz,0,-side*dx];
      face(paving,a.at(a.inner,0),a.at(a.outer,0),b.at(b.outer,0),b.at(b.inner,0),up,walking);
      face(structure,a.at(a.outer,.02),b.at(b.outer,.02),b.at(b.outer,-.66),a.at(a.outer,-.66),normal,concrete);
      face(structure,a.at(a.inner,0),b.at(b.inner,0),b.at(b.inner,-.15),a.at(a.inner,-.15),normal.map(n=>-n),curb);
      face(structure,a.at(a.inner,-.66),a.at(a.outer,-.66),b.at(b.outer,-.66),b.at(b.inner,-.66),down,soffit);
      if(b.s-a.s<.025)continue;
      for(const [height,r] of [[.28,.023],[.49,.023],[.70,.024],[.91,.030],[1.10,.057]]){
        beam(a.at(a.outer-side*.07,height),b.at(b.outer-side*.07,height),r,rail);
      }
      for(const [height,r] of [[.37,.073],[.70,.060]]){
        beam(a.at(a.inner+side*.16,height),b.at(b.inner+side*.16,height),r,rail);
      }
    }
    for(let k=0;k<=intervals;k++){
      const t=section(walk,side,mix(start,end,k/intervals));
      for(const [q,h,r] of [[t.outer-side*.07,1.11,.075],[t.inner+side*.16,.72,.066]]){
        beam(t.at(q,-.035),t.at(q,h),r,post);
      }
    }
    const yaw=Math.atan2(dx,dz);
    for(let k=0;k<8;k++){
      const sec=section(walk,side,k*32+.8),q=sec.inner+side*.42;
      beam(sec.at(q,0),sec.at(q,7.15),.075,0x747b72);
      beam(sec.at(q+side*.24,7.05),sec.at(q-side*1.4,7.19),.053,0x656c65);
      fixtures.box(vec(sec.at(q-side*1.48,7.18)),.69,.085,.26,yaw,0x69716c);
      fixtures.box(vec(sec.at(q-side*1.48,7.132)),.58,.024,.20,yaw,0xdedfd0);
    }
    addBridgeGallery(s=>section(walk,side,s),side,fixtures,structure,beam,yaw);
  }
  const sections=Math.ceil(length/3);
  for(let i=0;i<sections;i++){
    const s=length*i/sections,t=length*(i+1)/sections;
    const [la,ra]=loops.map(f=>f(s)),[lb,rb]=loops.map(f=>f(t));
    face(structure,la.at(la.inner,-.66),ra.at(ra.inner,-.66),rb.at(rb.inner,-.66),lb.at(lb.inner,-.66),down,soffit);
  }
  // Six paired river piers in the completion view. Leave the mapped
  // riverside footpaths clear, including where they pass under the deck.
  const yaw=Math.atan2(dx,dz),index=world.roadIndex;
  for(const station of [13,41,73,125,179,213]){
    const clear=s=>[-7.4,7.4].every(q=>{
      const [x,,z]=at(s,q,0),path=index.nearest(x,z,6,r=>!r.bridge);
      return !path||path.distance>path.s.road.width/2+1.45;
    });
    const s=[station,station-3,station+3,station-6,station+6].find(clear);
    if(s===undefined)continue;
    const cap=drivingY(s)-.525;
    fixtures.box(vec(at(s,0,cap-.15)),18.5,.3,1.56,yaw,0xabafa4);
    for(const q of [-7.4,7.4]){
      const [x,,z]=at(s,q,0),bottom=Math.min(streetDatum(x,z)-.85,.3),height=cap-.28-bottom;
      fixtures.box(vec(at(s,q,bottom+height/2)),1.35,height,1.48,yaw,0xb6b7ac);
    }
  }
  fixtures.put(scene,'KAIST Bridge metal parapets');
}
