import { physicalBarrier, rasterPolygon, rasterSegment } from './explore-surfaces.js';
import { resolveWalls } from './race-sim.js';
import { indexRoadBoundary, sampleRoadGrid } from './road-boundary-index.js';

// Rounded front corners preserve space to turn in tight entrances. The same
// outline governs spawning, movement and recovery.
const hull = [[-.58,1.07],[.58,1.07],[-.73,.72],[.73,.72],[-.73,-.75],[.73,-.75],
  [-.62,-1.05],[.62,-1.05],[0,1.08],[0,-1.05],[-.73,0],[.73,0],[0,0]];

function hasChassisClearance(isDrivable,x,z,heading,groundHint=Infinity){
  const s=Math.sin(heading),c=Math.cos(heading);
  for(const [lx,lz] of hull)if(!isDrivable(x+lx*c+lz*s,z-lx*s+lz*c,groundHint))return false;
  return true;
}

export function createDrivingAccess(data, network, index, surfaceGrid, outlines) {
  if(outlines){
    const {bounds}=data, grid=sampleRoadGrid(outlines.rings,bounds);
    const pavement=indexRoadBoundary(outlines.rings,bounds), bridge=indexRoadBoundary(outlines.deck,bounds);
    const lower=indexRoadBoundary(outlines.under,bounds);
    const isDrivable=(x,z,level=Infinity)=>{
      if(!pavement(x,z))return false;
      const k=(Math.floor(z)-grid.z0)*grid.w+Math.floor(x)-grid.x0;
      const deck=surfaceGrid.decks.get(k);
      if(deck===undefined || !surfaceGrid.lowerDecks.has(k))return true;
      if(level>=deck-.45)return bridge(x,z);
      return !bridge(x,z) || lower(x,z);
    };
    return {grid,outlines,isDrivable,canPlace:(x,z,heading,level)=>hasChassisClearance(isDrivable,x,z,heading,level)};
  }
  const { x0,z0,x1,z1 } = data.bounds;
  const w=x1-x0,h=z1-z0,d=new Uint8Array(w*h);
  const grid={x0,z0,w,h,d};
  // An explicitly permitted open surface can be driven across even if each
  // possible movement across the parking area has no OSM centre line.
  for(const area of data.areas)if(area.drivable)rasterPolygon(grid,area,1);
  for(const area of data.areas)if(!area.drivable&&['grass','wood','water','pitch','plaza','parking'].includes(area.k))rasterPolygon(grid,area,0);
  for(const area of data.areas)if(area.drivable && area.driveEntrances?.length && area.motorAccess!=='adjacent_parking_bays'){
    // Keep the perimeter between a lot and a neighbouring street closed.
    // Actual entry/exit lanes are restored at their full mapped width below.
    for(const ring of [area.p,...(area.holes||[])])for(let i=0;i<ring.length;i++){
      rasterSegment(grid,ring[i],ring[(i+1)%ring.length],1,k=>{d[k]=0;});
    }
  }
  for(const barrier of data.barriers||[])if(physicalBarrier(barrier)){
    for(let i=1;i<barrier.p.length;i++)rasterSegment(grid,barrier.p[i-1],barrier.p[i],.6,k=>{d[k]=0;});
  }
  // A dedicated sidewalk or stair inside a car park is still a pedestrian
  // route. Mapped road intersections are painted back over their crossings.
  for(const [road,way] of index.ways)if(!road.drivable && !road.bridge && !road.tunnel){
    for(const s of way.segments)rasterSegment(grid,s.a,s.b,road.width/2,k=>{d[k]=0;});
  }
  const drivesAtNode=new Map();
  for(const [road,way] of index.ways){
    if(!road.drivable)continue;
    for(const s of way.segments){
      const bit=road.bridge?2:1;
      rasterSegment(grid,s.a,s.b,road.width/2,k=>{d[k]|=bit;});
      for(const node of s.ids){
        if(!drivesAtNode.has(node))drivesAtNode.set(node,[]);
        drivesAtNode.get(node).push(s);
      }
    }
  }
  for(let i=0;i<d.length;i++)if(surfaceGrid.d[i]===8 || surfaceGrid.d[i]===9)d[i]=0;

  for(const gate of network.vehicleGates||[]){
    if(gate.passable)continue;
    const roads=drivesAtNode.get(gate.id) || [];
    if(!roads.length)continue;
    const [x,z]=gate.p;
    // A barrier on a mapped drive way spans that particular entrance.
    // Unrelated nearby pedestrian gates cannot close a parallel carriageway.
    for(const s of roads){
      const half=s.road.width/2+.75;
      rasterSegment(grid,[x+s.dz*half,z-s.dx*half],[x-s.dz*half,z+s.dx*half],.85,k=>{d[k]&=~(s.road.bridge?2:1);});
    }
  }
  function cellAllowed(i, j, level){
    if(i<0||j<0||i>=w||j>=h)return 0;
    const k=j*w+i,bits=d[k];
    if(!bits)return 0;
    const deck=surfaceGrid.decks.get(k);
    if(deck===undefined)return bits&1;
    const upper=level>=deck-.45 || !surfaceGrid.lowerDecks.has(k);
    return Number(Boolean(bits&(upper?2:1)));
  }
  function isDrivable(x,z,groundHint=Infinity){
    const fx=x-x0-.5, fz=z-z0-.5, i=Math.floor(fx),j=Math.floor(fz),u=fx-i,v=fz-j;
    const value=(cellAllowed(i,j,groundHint)*(1-u)+cellAllowed(i+1,j,groundHint)*u)*(1-v)
        +(cellAllowed(i,j+1,groundHint)*(1-u)+cellAllowed(i+1,j+1,groundHint)*u)*v;
    return value>=.5;
  }
  function canPlace(x,z,heading,groundHint=Infinity){
    return hasChassisClearance(isDrivable,x,z,heading,groundHint);
  }
  return {grid,isDrivable,canPlace};
}

/** Resolve only the part of motion that crosses a car-access boundary. The
 * ordinary wall impulse retains tangent velocity at a glancing curb impact. */
export function resolveDrivingBoundary(body,previous,access) {
  const ground=body.y-body.rideHeight, dx=body.x-previous.x,dz=body.z-previous.z;
  const distance=Math.hypot(dx,dz),steps=Math.max(1,Math.ceil(distance/.28));
  for(let i=1;i<steps;i++){
    const t=i/steps,px=previous.x+dx*t,pz=previous.z+dz*t;
    if(!access.canPlace(px,pz,body.th,ground)){body.x=px;body.z=pz;break;}
  }
  if(access.canPlace(body.x,body.z,body.th,ground))return 0;
  const occupied=(x,z)=>access.isDrivable(x,z,ground)?2:9;
  const impact=resolveWalls(body,previous,occupied,hull);
  if(!access.canPlace(body.x,body.z,body.th,ground) && access.canPlace(previous.x,previous.z,previous.th,ground)){
    // Turning in place can rotate a corner into a narrow wall even when the
    // centre did not move. Keep the last physically valid pose in that case.
    body.x=previous.x;body.z=previous.z;
    body.q=previous.q;
    body.angularVelocity[1]*=.25;
  }
  return impact;
}
