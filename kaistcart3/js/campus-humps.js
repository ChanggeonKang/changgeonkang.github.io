import { isMotorRoad } from './explore-surfaces.js';

// The old circuit stored a fallback width on every hump, even when the source
// specified no width. Only a width tag on the hump is an actual dimension.
export function humpWidth(road, feature) {
  const clearWidth = Math.max(.5, road.width - .40);
  if(feature.carriagewaySide)return Math.max(.5,(clearWidth-.40)/2);
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

export function locateHumps(network, campusFeatures, index, course, observations, access) {
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
    const width = humpWidth(road, feature), tangentX=span>.01?dx/span:s.dx,tangentZ=span>.01?dz/span:s.dz;
    // The N0 median separates two physically staggered humps. Centre each
    // half on its two-lane carriageway, preserving the gap at the yellow lines.
    const lateral=feature.carriagewaySide?(feature.carriagewaySide==='north'?1:-1)*Math.sign(tangentX)*(.20+width/2):0;
    const hump = {...feature, x:x+tangentZ*lateral, z:z-tangentX*lateral, ci, roadWayId:road.id, width, hw:width/2, length,
      height:feature.height ?? (short ? .05 : .10), dx:tangentX, dz:tangentZ};
    placed.push(hump);
    if (feature.id) byId.set(feature.id,hump);
  }
  const features=network.trafficCalming ?? campusFeatures;
  // The two mapped hump nodes straddle a single zebra on Daehak-ro 291beonga-gil.
  // Both November 2026 approaches show yellow entry ramps and a shared deck.
  const westRamps=features.filter(f=>f.roadWayId===456970374 && [13901505309,13901505310].includes(f.id));
  if(westRamps.length===2){
    const [a,b]=westRamps,centre=index.nearest((a.x+b.x)/2,(a.z+b.z)/2,1,r=>r.id===a.roadWayId);
    if(centre){
      const rampSpacing=Math.hypot(a.x-b.x,a.z-b.z),plateau=4;
      attach(centre,{id:'west-raised-crossing',sourceIds:[a.id,b.id],type:'table',paint:'yellow-crossing',height:.10,
        plateau,length:2*rampSpacing-plateau,panorama:'s0bOQ3dzY2ZAy-RhBSLyzw',
        source:'November 2026 north and south views of the raised west crossing'},-1);
      for(const ramp of westRamps)byId.set(ramp.id,placed.at(-1));
    }
  }
  for (const feature of features) {
    if(byId.has(feature.id))continue;
    const hostId=feature.roadWayId ?? feature.provenance?.roadWayId;
    const onHost = r => isMotorRoad(r) && r.id===hostId && r.nodes.includes(feature.id);
    attach(index.nearest(feature.x,feature.z,1,onHost), {...old.get(feature.id),...feature}, -1);
  }
  // November 2026 panorama WNAIQBQp-P9GfHtbMREE-w shows a raised red
  // approach on each side of the mapped E3-5 zebra. Dimensions are estimated.
  const crossingNode=13895889542,street=network.roads.find(r=>r.id===77338232 && r.nodes.includes(crossingNode));
  if(street){
    const p=street.p[street.nodes.indexOf(crossingNode)];
    const table={type:'table',paint:'red-crossing',length:5.9,height:.095,plateau:3.35,
      source:'November 2026 street view at mapped E3-5 crossing',panorama:'WNAIQBQp-P9GfHtbMREE-w'};
    const existing=placed.find(b=>b.roadWayId===street.id && Math.hypot(b.x-p[0],b.z-p[1])<1.2);
    if(existing)Object.assign(existing,table);
    else attach(index.nearest(...p,1,r=>r===street),{...table,id:crossingNode},-1);
  }
  // FoSSrk and dL4nZS show the second table on the School of Computing
  // access road in opposite directions. Its centre is farther north than
  // the pedestrian routing node. The white zebra on the garage spur is flat.
  const court=index.nearest(318.25,287.95,2,r=>r.id===210339936);
  if(court)attach(court,{id:'E3-computing-court',type:'table',paint:'red-crossing',
    length:5.55,height:.09,plateau:3.0,panorama:'FoSSrkL7NuzYk7OTq80WJQ',
    source:'November 2026 views from the court and garage spur, and overhead paint extents'},-1);
  // November street view and the orthophoto of the N0 guardhouse identify
  // two sites absent from the traffic-calming nodes. Horizontal dimensions
  // are image estimates; the conventional .10 m profile is not a survey.
  const gateRoad=r=>r.id===1280479120;
  for(const [id,x,length,carriagewaySide] of [
    ['N0-inner',366.2,4.5,null],
    ['N0-guard-north',414.6,3.4,'north'],
    ['N0-guard-south',412.1,3.4,'south']
  ]){
    const snap=index.nearest(x,-381.4,2,gateRoad);
    attach(snap,{id,type:'hump',length,carriagewaySide,panorama:'ZQ4h5XZbmu48J8E9BTTpoQ',
      source:'November 2026 east gate street view and overhead imagery'},-1);
  }
  const woodland=r=>r.id===78059219;
  for(const [id,x,z,length] of [['woodland-straight',606.20,-382.00,3.7],['woodland-bend',572.25,-364.23,3.4]]){
    const snap=index.nearest(x,z,1,woodland);
    attach(snap,{id,type:'hump',length,paint:'longitudinal-bars',panorama:'SV9_mfDWqGD__6YPmBgBRg',
      source:'October 2026 woodland lane view and overhead footprint'},-1);
  }
  // The striped hump ahead of panorama 812 spans just the narrow tennis
  // access. The four-lane avenue beyond the railing stays level here.
  const tennis=index.nearest(-508.59,-314.42,1.5,r=>r.id===1528343975 && r.lanes===1);
  attach(tennis,{id:'tennis-access',type:'hump',length:3.5,paint:'diagonal-bars',
    panorama:'A2wGJ0u1vlbrz1dfaR5C-g',source:'November 2026 tennis lane view and overhead footprint'},-1);
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
  // November panoramas on the W8 avenue and both N3 red approaches were
  // checked against the overhead footprints. The two avenues have very
  // different stripe bearings despite having the same untagged OSM type.
  for(const b of placed){
    // Along the tennis lane the surveyed iron railing cuts into the OSM
    // road strip. The asphalt hump stops inside the drainage gutter on
    // each side. Keep its visual paint and its tyre surface on that span.
    if(b.roadWayId===1528343975 && access){
      const span=sign=>{
        let limit=b.hw;
        for(const at of [-.45,0,.45])for(let t=.04;t<limit+.32;t+=.04){
          const x=b.x+b.dx*at*b.length+b.dz*t*sign,z=b.z+b.dz*at*b.length-b.dx*t*sign;
          if(!access.isDrivable(x,z)){limit=Math.min(limit,Math.max(0,t-.36));break;}
        }
        return limit;
      };
      const left=span(-1),right=span(1),offset=(right-left)/2;
      b.x+=b.dz*offset;b.z-=b.dx*offset;b.width=left+right;b.hw=b.width/2;
    }
    if([12994559449,13899794015,13899794016,13899794017,13899794018].includes(b.id))
      b.paint='longitudinal-bars';
    if(b.id===13899444976 || b.id===13899444977)b.paint='diagonal-bars';
  }
  return placed;
}
