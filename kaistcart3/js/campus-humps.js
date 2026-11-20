import { isMotorRoad } from './explore-surfaces.js';

// The old circuit stored a fallback width on every hump, even when the source
// specified no width. Only a width tag on the hump is an actual dimension.
export function humpWidth(road, feature) {
  const clearWidth = Math.max(.5, road.width - .40);
  const tagged = ['osm:traffic_calming:width','osm:width'].includes(feature.dimensionSources?.width);
  if (tagged && feature.width > 0) return Math.min(feature.width, clearWidth);
  return clearWidth;
}

// At a survey way boundary, continue across a degree-two road node. At a
// fork the surveyed host determines the direction; never average in a feeder.
function sampleWay(index, road, station) {
  const {segments,length}=index.ways.get(road);
  if(station>=0 && station<=length){
    const s=segments.find(s=>s.start+s.span>=station) || segments.at(-1);
    const offset=Math.min(s.span,Math.max(0,station-s.start));
    return [s.a[0]+s.dx*offset,s.a[1]+s.dz*offset];
  }
  const front=station<0, s=front?segments[0]:segments.at(-1);
  let left=front?-station:station-length, node=s.ids[front?0:1], from=s.ids[front?1:0];
  let dirX=front?-s.dx:s.dx, dirZ=front?-s.dz:s.dz;
  while(left>0){
    const current=index.nodes.get(node), next=current.motor.size===2?[...current.motor].find(k=>k!==from):undefined;
    const p=current.p, q=index.nodes.get(next)?.p;
    if(!q)return [p[0]+dirX*left,p[1]+dirZ*left];
    const span=Math.hypot(q[0]-p[0],q[1]-p[1]);
    if(span<.02)return p;
    dirX=(q[0]-p[0])/span;dirZ=(q[1]-p[1])/span;
    if(left<=span)return [p[0]+dirX*left,p[1]+dirZ*left];
    left-=span;from=node;node=next;
  }
}

function snapPhoto(index,course,ci){
  // A panorama can sit centimetres nearer a crossing driveway than the
  // carriageway it was taken on. Compare both approaches over twelve metres.
  const route=[-3,0,3].map(offset=>{
    const i=(ci+offset+course.n)%course.n;
    return [course.x[i],course.z[i]];
  });
  const candidates=new Set();
  for(const p of route){
    const hit=index.nearest(...p,8,r=>r.drivable && isMotorRoad(r));
    if(hit)candidates.add(hit.s.road);
  }
  let best=null,score=Infinity;
  for(const road of candidates){
    const hits=route.map(p=>index.nearest(...p,14,r=>r===road));
    const middle=hits[1];
    if(!middle || middle.distance>road.width/2+2)continue;
    const s=middle.s, parallel=Math.abs(course.tx[ci]*s.dx+course.tz[ci]*s.dz);
    const error=middle.distance+4*(1-parallel)+(hits[0]?.distance??14)*.25+(hits[2]?.distance??14)*.25;
    if(error<score){score=error;best=middle;}
  }
  return best;
}

export function locateHumps(network, campusFeatures, index, course, observations) {
  const old = new Map(campusFeatures.map(b => [b.id, b]));
  const placed = [], byId = new Map();
  function attach(snap, feature, ci) {
    if (!snap) return;
    const {s, x, z, along} = snap, road = s.road;
    const at = s.start + along;
    const short = feature.type === 'bump' || feature.type === 'mini_bumps';
    const length = feature.length ?? (short ? .6 : 3.6);
    // Average the two tangents at a bend. Road nodes and capture estimates
    // often sit exactly at the seam between two segments.
    const reach = Math.max(length / 2,Math.min(5,road.width/2));
    const before=sampleWay(index,road,at-reach), after=sampleWay(index,road,at+reach);
    const dx=after[0]-before[0], dz=after[1]-before[1];
    const span = Math.hypot(dx,dz);
    const width = humpWidth(road, feature);
    const hump = {...feature, x, z, ci, roadWayId:road.id, width, hw:width/2, length,
      height:feature.height ?? (short ? .05 : .10), dx:span>.01?dx/span:s.dx, dz:span>.01?dz/span:s.dz};
    placed.push(hump);
    if (feature.id) byId.set(feature.id,hump);
  }
  for (const feature of network.trafficCalming ?? campusFeatures) {
    const hostId=feature.roadWayId ?? feature.provenance?.roadWayId;
    const onHost = r => isMotorRoad(r) && r.id===hostId && r.nodes.includes(feature.id);
    attach(index.nearest(feature.x,feature.z,1,onHost), {...old.get(feature.id),...feature}, -1);
  }
  for (const observation of observations) {
    const ci = Math.round(observation.progress) % course.n;
    const snap = snapPhoto(index,course,ci);
    if (!snap || snap.distance>snap.s.road.width/2+2) continue;
    const matched = byId.get(observation.matchedOsmId) || placed.find(b=>
      b.roadWayId===snap.s.road.id && Math.hypot(b.x-snap.x,b.z-snap.z)<10);
    if (matched) { matched.ci=ci; continue; }
    attach(snap,{source:'street-level capture',photoNumbers:observation.photoNumbers,
      height:observation.heightM,length:observation.lengthM},ci);
  }
  return placed;
}
