import { isMotorRoad } from './explore-surfaces.js';

// The old circuit stored a fallback width on every hump, even when the source
// specified no width. Only a width tag on the hump is an actual dimension.
export function humpWidth(road, feature) {
  const clearWidth = Math.max(.5, road.width - .40);
  const tagged = ['osm:traffic_calming:width','osm:width'].includes(feature.dimensionSources?.width);
  if (tagged && feature.width > 0) return Math.min(feature.width, clearWidth);
  return clearWidth;
}

export function locateHumps(network, campusFeatures, index, course, observations) {
  const old = new Map(campusFeatures.map(b => [b.id, b]));
  const placed = [], byId = new Map();
  function attach(snap, feature, ci) {
    if (!snap) return;
    const {s, x, z, along} = snap, road = s.road;
    const segments = index.ways.get(road).segments, at = s.start + along;
    const short = feature.type === 'bump' || feature.type === 'mini_bumps';
    const length = feature.length ?? (short ? .6 : 3.6);
    // Average the two tangents at a bend. Road nodes and capture estimates
    // often sit exactly at the seam between two segments.
    const reach = length / 2;
    let dx=0, dz=0;
    for (const e of segments) {
      const overlap = Math.min(at+reach,e.start+e.span) - Math.max(at-reach,e.start);
      if (overlap>0) { dx += e.dx*overlap; dz += e.dz*overlap; }
    }
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
    const x=course.x[ci], z=course.z[ci];
    const snap = index.nearest(x,z,8,r=>r.drivable && isMotorRoad(r));
    if (!snap || snap.distance>snap.s.road.width/2+2) continue;
    const matched = byId.get(observation.matchedOsmId) || placed.find(b=>
      b.roadWayId===snap.s.road.id && Math.hypot(b.x-snap.x,b.z-snap.z)<10);
    if (matched) { matched.ci=ci; continue; }
    attach(snap,{source:'street-level capture',photoNumbers:observation.photoNumbers,
      height:observation.heightM,length:observation.lengthM},ci);
  }
  return placed;
}
