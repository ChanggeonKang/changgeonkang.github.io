import * as THREE from '../lib/three.module.min.js';
import { isMotorRoad, physicalBarrier, roadLift } from './explore-surfaces.js';
import { paintMappedCrossings } from './street-fixtures.js';
import { createHumpPaintMask } from './road-paint-mask.js';
import { paintGateAvenue } from './gate-avenue-garden.js';
import { isSportsRedLane, paintCampusWarnings } from './central-road-paint.js';
import { northwestBoulderSection, northwestBallNets } from './northwest-streetviews.js';
import {addKaistRampShell,buildKaistBridge,isKaistBridgeWalk} from './kaist-bridge.js';
import {groundPatch} from './east-campus-shapes.js';
import {sejongPaverTexture} from './sejong-pavers.js';
import {paintWestGwahak} from './gwahak-road-paint.js';

const up = [0, 1, 0], uv = p => [p[0] / 4, p[2] / 4];
const paint = new THREE.Color(0xf1ede2), yellow = new THREE.Color(0xdbb45c);
const palette = {
  street: 0x92928f, service: 0x8b8c89, parking: 0x858782, walk: 0xc0a893,
  cycle: 0xb19686, trail: 0xa28a6a, steps: 0xaaa79b, gravel: 0xa69b87,
  redCourt: 0x9d746e, redPavers: 0xb0756c, sejongPavers: 0xe3ddd5, westBlocks:0xbcb4a7, bridgeConcrete:0xd1cabb,
  sharedLotAsphalt:0x747b80
};
function surfaceStyle(r) {
  if(r.id===471328452 || r.id===471328455)return 'sharedLotAsphalt';
  if(r.id===220113387||r.id===504188967)return 'westBlocks';
  if(r.id===472047942)return 'bridgeConcrete';
  // Sejong Hall's drive and the three spokes below its entrance canopy are
  // laid in pale interlocking blocks. The separate bicycle bays use red bricks.
  if(r.id===504188913 || r.id>=1524891719 && r.id<=1524891721)return 'sejongPavers';
  // The E14 arrival court and E15 auditorium approach have red surfacing in
  // the linked public views. Only colour the approach ways visible there.
  if(r.id===220224724)return 'redCourt';
  if(r.id===503477355)return 'redPavers';
  if (/gravel|unpaved|ground|dirt|earth|sand/.test(r.surface || '')) return 'gravel';
  if (r.surface === 'asphalt') return 'street';
  if (r.surface === 'wood') return 'trail';
  return r.roadClass;
}

// A separately surveyed footpath can be closer to a railing than the
// centreline of a much wider street. Clip against the entire car surface,
// including the rail thickness, before tessellating the visible remainder.
function roadsideSpans(a,b,depth,access) {
  const dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);
  if(len<.02)return [];
  const nx=dz*depth/len,nz=-dx*depth/len;
  const point=t=>[a[0]+dx*t,a[1]+dz*t];
  const clear=t=>{
    const [x,z]=point(t);
    return !access.isDrivable(x,z) && !access.isDrivable(x+nx,z+nz) && !access.isDrivable(x-nx,z-nz);
  };
  const spans=[],steps=Math.ceil(len/.45);
  let open=clear(0),start=0;
  for(let i=1;i<=steps;i++){
    const end=i/steps,nextOpen=clear(end);
    if(nextOpen===open)continue;
    let lo=(i-1)/steps,hi=end;
    for(let j=0;j<9;j++){
      const mid=(hi+lo)/2;
      if(clear(mid)===open)lo=mid;else hi=mid;
    }
    if(open)spans.push([point(start),point(lo)]);
    else start=hi;
    open=nextOpen;
  }
  if(open)spans.push([point(start),b]);
  return spans;
}

export function buildExploreRoads(scene, world, height, texture, MB, flat, referenceRoadStyles, streetDatum=height) {
  const { D, C, roadIndex } = world;
  const asphalt = new MB(), paving = new MB(), unsealed = new MB(), markings = new MB(), walls = new MB();
  const hexDrive=new MB(),sejongDrive=new MB();
  const bridgeStructure=new MB();
  const colours = Object.fromEntries(Object.entries(palette).map(([k, v]) => [k, new THREE.Color(v)]));
  const photoStyles = referenceRoadStyles.map(style => ({...style}));
  const pavementLift=(road,x,z)=>{
    const G=world.G,k=(Math.floor(z)-G.z0)*G.w+Math.floor(x)-G.x0;
    return !isMotorRoad(road) && G.lotMask[k] ? .23 : roadLift(road);
  };
  const courseStyle = (x, z, dx, dz) => {
    const R = world.roadElevation;
    const nearby = R.cells.get(Math.floor(x / R.cellSize) * 8192 + Math.floor(z / R.cellSize)) || [];
    let nearest = -1, bestSq = 25;
    for (const i of nearby) {
      if (Math.abs(C.tx[i] * dx + C.tz[i] * dz) < .90) continue;
      const dsq = (x - C.x[i]) ** 2 + (z - C.z[i]) ** 2;
      if (dsq < bestSq) { bestSq = dsq; nearest = i; }
    }
    if (nearest < 0) return null;
    return photoStyles.find(s => s.from <= nearest && nearest <= s.to) || null;
  };
  const maskHumpPaint = createHumpPaintMask(world.bumps);
  const lotUV=p=>[p[0]/5,p[2]/5];
  const quad = (batch, a, b, c, d, colour) => {
    const pieces = batch === markings ? maskHumpPaint(a,b,c,d) : null;
    const texCoord=colour===colours.sharedLotAsphalt?lotUV:uv;
    if (!pieces) return batch.quad(a, b, c, d, up, texCoord(a), texCoord(b), texCoord(c), texCoord(d), colour);
    for (const vertices of pieces) for (let i=2;i<vertices.length;i++) {
      const [p,q,r] = [vertices[0],vertices[i-1],vertices[i]];
      batch.tri(p,q,r,up,uv(p),uv(q),uv(r),colour);
    }
  };
  function bridgeBed(s,x,z,way){
    const {segments,length,deck}=way;
    const station=s.start+(x-s.a[0])*s.dx+(z-s.a[1])*s.dz;
    const frac=Math.min(1,Math.max(0,station/length));
    let bed=deck[0]+frac*(deck[1]-deck[0]);
    const reach=Math.min(length/2,Math.max(6,s.road.width));
    const start=station<length/2,end=start?segments[0]:segments.at(-1);
    const distance=start?station:length-station,endpoint=start?end.a:end.b;
    if(distance>=reach || !roadIndex.nodes.get(end.ids[start?0:1]).groundCar)return bed;
    if(distance<=0)return streetDatum(x,z);
    // Match the actual transverse grade of the approach at its abutment,
    // fading to the surveyed deck plane without following the riverbed.
    const across=(x-endpoint[0])*end.dz-(z-endpoint[1])*end.dx;
    const abutment=streetDatum(endpoint[0]+across*end.dz,endpoint[1]-across*end.dx);
    const t=1-distance/reach;
    return bed+(abutment-deck[start?0:1])*t*t*(3-2*t);
  }
  const roadVertex = (s, along, x, z, y) => {
    const way = roadIndex.ways.get(s.road);
    const base = way.deck ? bridgeBed(s,x,z,way) : isMotorRoad(s.road)?streetDatum(x,z):height(x,z);
    return [x, Math.max(way.fordLevel ?? -Infinity,base + pavementLift(s.road,x,z)) + y, z];
  };
  const face = (s,along,o,y)=>roadVertex(s,along,s.a[0]+s.dx*along+s.dz*o,s.a[1]+s.dz*along-s.dx*o,y);
  function strip(s,a,b,left,right,lift,batch,colour){
    const p=[face(s,a,left,lift),face(s,a,right,lift),face(s,b,right,lift),face(s,b,left,lift)];
    if(s.road.id!==1526783583 || batch!==asphalt)return quad(batch,...p,colour);
    // At the W13 barrier driveway asphalt ends at the edge of the block
    // lane. The mapped branch's centre line goes all the way to its axis.
    const edge=v=>(v[0]+227.7)*.98765+(v[2]-366.6)*.15672-2.74;
    const clipped=[];
    for(let i=0;i<4;i++){
      const x=p[i],y=p[(i+1)%4],ex=edge(x),ey=edge(y);
      if(ex>=0)clipped.push(x);
      if((ex>=0)!==(ey>=0)){
        const t=ex/(ex-ey);
        clipped.push(x.map((v,k)=>v+(y[k]-v)*t));
      }
    }
    for(let i=2;i<clipped.length;i++){
      const [x,y,z]=[clipped[0],clipped[i-1],clipped[i]];
      batch.tri(x,y,z,up,uv(x),uv(y),uv(z),colour);
    }
  }
  const masks = new Map();
  const cornerStyle = new Map();
  // A strip crossing a shared node leaves triangles uncovered at sharp bends.
  // Fill the joint once using the incident road's actual width and material.
  for (const [road, way] of roadIndex.ways) {
    if(isKaistBridgeWalk(road.id))continue;
    if(road.sharedParkingSurface)continue;
    const style = surfaceStyle(road), colour = colours[style] || colours.walk, motor = isMotorRoad(road);
    const batch = style === 'westBlocks' ? hexDrive : style === 'sejongPavers' ? sejongDrive : style === 'gravel' || style === 'trail' ? unsealed : style === 'redPavers' ? paving : motor || style === 'street' ? asphalt : paving;
    const half = road.width / 2;
    if(road.drivable)cornerStyle.set(road.id,{road,colour,batch});
    for (const s of way.segments) {
      if(road.ford==='stepping_stones'){
        const stones=Math.ceil(s.span/.94);
        for(let j=0;j<stones;j++){
          const a=s.span*j/stones+.055,b=s.span*(j+1)/stones-.055;
          const width=half*(.88+.1*Math.sin(s.start+j));
          if(b>a)strip(s,a,b,width,-width,.005,unsealed,colours.gravel);
        }
        continue;
      }
      const count = Math.ceil(s.span / 3);
      const junction = s.ids.map(id => {
        const n = roadIndex.nodes.get(id);
        return n.motor.size >= 3 ? n.halfWidth + 1 : 0;
      });
      // Parallel markings on adjacent survey segments share an end section.
      // At a hard bend keep the stripe on the rounded asphalt envelope.
      const offsets=s.ids.map((id,end)=>{
        const n=roadIndex.nodes.get(id);
        if(n.motor.size!==2 || !motor)return [s.dz,-s.dx];
        const neighbour=[...n.motor].find(k=>k!==s.ids[1-end]),p=roadIndex.nodes.get(neighbour)?.p;
        if(!p)return [s.dz,-s.dx];
        const sign=end?1:-1,dx=(p[0]-n.p[0])*sign,dz=(p[1]-n.p[1])*sign,span=Math.hypot(dx,dz);
        if(span<.02)return [s.dz,-s.dx];
        const ox=s.dz+dz/span,oz=-s.dx-dx/span,den=1+(s.dx*dx+s.dz*dz)/span;
        if(den<.1)return [s.dz,-s.dx];
        const scale=Math.max(den, Math.hypot(ox,oz)/(1+.12/half));
        return [ox/scale,oz/scale];
      });
      const paintFace=(t,o,y)=>{
        const blend=Math.min(s.span/2,Math.max(1.25,half)),u=Math.max(0,1-t/blend),v=Math.max(0,1-(s.span-t)/blend);
        const ox=s.dz*(1-u-v)+offsets[0][0]*u+offsets[1][0]*v,oz=-s.dx*(1-u-v)+offsets[0][1]*u+offsets[1][1]*v;
        return roadVertex(s,t,s.a[0]+s.dx*t+ox*o,s.a[1]+s.dz*t+oz*o,y);
      };
      const line=(a,b,left,right,y,colour,dashed=false)=>{
        const part=(from,to)=>quad(markings,paintFace(from,left,y),paintFace(from,right,y),paintFace(to,right,y),paintFace(to,left,y),colour);
        if(!dashed){part(a,b);return;}
        for(let dash=Math.floor((s.start+a)/8)*8-s.start;dash<b;dash+=8){
          const from=Math.max(a,dash),to=Math.min(b,dash+4);
          if(to>from)part(from,to);
        }
      };
      for (let j = 0; j < count; j++) {
        const from = s.span * j / count, to = s.span * (j + 1) / count;
        // One quad across a four-lane street cuts through its crown and the
        // banks at a bridge end. Sample at approximately one lane-width.
        const strips=motor?Math.ceil(road.width/3.3):1;
        // The block-paved aisle gives way to an asphalt apron before the
        // main road, visible straight ahead in the g6FoUO6 panorama.
        const apron=style==='westBlocks' && s.ids[1]===352963331 && (from+to)/2>s.span-6;
        const middle=(from+to)/2;
        const red=isSportsRedLane(road.id,s.a[0]+s.dx*middle,s.a[1]+s.dz*middle);
        const bedColour=red?colours.redCourt:apron?colours.street:colour;
        for(let k=0;k<strips;k++)strip(s,from,to,half-road.width*k/strips,half-road.width*(k+1)/strips,0,apron?asphalt:batch,bedColour);
        if(road.bridge)addKaistRampShell(bridgeStructure,s,from,to,face);
        const a=Math.max(junction[0],from),b=Math.min(s.span-junction[1],to),mid=(a+b)/2;
        if (b<=a || !motor || half < 2.45) continue;
        // Both sides of the divided E1 avenue have a yellow kerb line and
        // white dashes between lanes, visible in the October 2026 panorama.
        const gateAvenue=road.id===468250683 || road.id===468250686;
        const engineering=road.id===77338232 && s.a[1]>=160;
        const clinicAisle=road.id===220229549 && s.a[0]>=630 && s.a[0]<662;
        const doubleCentre=[426204521,472047942,979941424,1255160783,1524928894,37972561].includes(road.id);
        const captured = road.id===1528343975 ? {center:road.lanes===1?'none':'double',edges:'yellow'} : road.id===78059219 ? {center:'single',edges:'white'} : clinicAisle ? {center:'dashed'} : engineering ? {center:'single',edges:'yellow'} :
          gateAvenue || road.id===504188913 ? {edges:'yellow'} : doubleCentre ? {center:'double',edges:'yellow'} :
          courseStyle(s.a[0] + s.dx * mid,s.a[1] + s.dz * mid,s.dx,s.dz);
        const center = road.oneway ? 'none' : captured?.center || (road.roadClass === 'street' && road.width >= 6.5 ? 'single' : 'none');
        if (center === 'single' || center === 'dashed')line(a,b,.07,-.07,.016,yellow,center==='dashed');
        if (center === 'double') {
          line(a,b,.20,.07,.016,yellow);
          line(a,b,-.07,-.20,.016,yellow);
        }
        if (captured?.edges === 'white' || captured?.edges === 'yellow') {
          for (const sign of [-1,1])line(a,b,sign*(half-.20),sign*(half-.32),.016,captured.edges==='yellow'?yellow:paint);
        }
        if(engineering){
          // In the November view the curb marking doubles on approach to
          // the KRAFTON table. The two stop lines serve opposite directions.
          for(let end=0;end<2;end++){
            if(s.ids[end]!==13895889542)continue;
            const fromEnd=d=>end?s.span-d:d;
            const lo=Math.max(a,Math.min(fromEnd(2.92),fromEnd(12.2)));
            const hi=Math.min(b,Math.max(fromEnd(2.92),fromEnd(12.2)));
            if(hi>lo)for(const sign of [-1,1])line(lo,hi,sign*(half-.37),sign*(half-.45),.016,yellow);
            for(const [distance,width] of [[5.65,.24],[7.25,.24]]){
              const middle=fromEnd(distance),start=Math.max(a,middle-width/2),stop=Math.min(b,middle+width/2);
              const sign=end?-1:1;
              if(stop>start)line(start,stop,sign*.15,sign*(half-.48),.020,paint);
            }
          }
        }
        if (road.oneway && road.lanes>1) {
          for(let lane=1;lane<road.lanes;lane++){
            const offset=half*(2*lane/road.lanes-1);
            line(a,b,offset-.055,offset+.055,.022,paint,true);
          }
        } else if ((road.lanes || 0) >= 4) {
          for(const sign of [-1,1]){
            if(road.id===37972561 && sign===1 && s.start+mid<66)continue;
            line(a,b,sign*(half*.5-.055),sign*(half*.5+.055),.022,paint,true);
          }
        }
      }
      // Each join uses a fan constrained to its width. Keep the original node
      // IDs so unrelated grades and adjacent parallel lanes do not connect.
      for (let i = 0; i < 2; i++) {
        const id = s.ids[i], before = masks.get(id);
        if (!before || (motor && !before.motor) || motor === before.motor && half > before.half) {
          const at=i?s.b:s.a;
          masks.set(id, { s, along: i ? s.span : 0, half, motor, batch, colour:isSportsRedLane(road.id,...at)?colours.redCourt:colour });
        }
      }
      if (road.roadClass === 'steps') {
        for (let p = .30 - s.start % .6; p < s.span - .08; p += .6) {
          if (p < 0) continue;
          strip(s, p, p + .065, half * .94, -half * .94, .017, markings, colours.steps.clone().multiplyScalar(.66));
        }
      }
    }
  }
  for (const { s, along, half, batch, colour } of masks.values()) {
    const ctr = face(s, along, 0, 0), sides = Math.max(12,Math.ceil(Math.PI / Math.acos(1 - .022 / half)));
    const bands=isMotorRoad(s.road)?Math.ceil(half/3.3):1;
    let inner;
    for(let band=1;band<=bands;band++){
      const ring=[];
      for(let i=0;i<sides;i++){
        const angle=i/sides*Math.PI*2,radius=half*band/bands;
        ring.push(roadVertex(s,along,ctr[0]+Math.cos(angle)*radius,ctr[2]+Math.sin(angle)*radius,0));
      }
      for(let i=0;i<sides;i++){
        const j=(i+1)%sides;
        if(inner)quad(batch,inner[i],ring[i],ring[j],inner[j],colour);
        else {
          const texCoord=colour===colours.sharedLotAsphalt?lotUV:uv;
          batch.tri(ctr,ring[i],ring[j],up,texCoord(ctr),texCoord(ring[i]),texCoord(ring[j]),colour);
        }
      }
      inner=ring;
    }
  }
  // The same civil corner radius used by the drivable polygon also gets
  // asphalt. This closes the unpaved wedge between turning cars and the kerb.
  for(const [id,ring] of world.access.outlines.corners){
    const style=cornerStyle.get(id);
    if(!style)continue;
    const points=ring.map(([x,z])=>new THREE.Vector2(x,z));
    const vertices=ring.map(([x,z])=>[x,streetDatum(x,z)+roadLift(style.road),z]);
    for(const [i,j,k] of THREE.ShapeUtils.triangulateShape(points,[])){
      const a=vertices[i],b=vertices[k],c=vertices[j];
      style.batch.tri(a,b,c,up,uv(a),uv(b),uv(c),style.colour);
    }
  }
  paintMappedCrossings(roadIndex,face,quad,markings,paint);
  paintWestGwahak(roadIndex,face,quad,markings,yellow);
  paintCampusWarnings(roadIndex,face,quad,markings,paint,yellow);
  paintGateAvenue(roadIndex,face,quad,markings,paint);
  buildKaistBridge(scene,world,streetDatum,asphalt,bridgeStructure);
  const finish = (mb, name, mat, offset) => {
    if (!mb.p.length) return;
    flat(scene, mb, new THREE.MeshStandardMaterial({vertexColors:true, roughness:.93, ...mat}), offset).name = name;
  };
  finish(asphalt, 'Mapped campus streets and service lanes', {map:texture.asphalt}, 3);
  finish(hexDrive,'West campus block-paved motor lane',{map:texture.hexDrive},3);
  const court=D.areas.find(a=>a.id==='sejong-turning-court');
  if(court){
    // The overhead photo traces the visible kerb, then loses the paving in
    // the shadow of the canopy. The entrance panorama shows blocks all the
    // way to the three doors. Follow the back edge of roof way 1530600485
    // so the tyres can roll between the drop-off and the turning court.
    const porchBack=[[388.7,-106.6],[398,-112.8],[413.5,-109.5],[419,-101.6]];
    const paving=[court.p[0],...porchBack,...court.p.slice(3)];
    groundPatch(sejongDrive,paving,(x,z)=>streetDatum(x,z)+.13,colours.sejongPavers,.25);
  }
  finish(sejongDrive,'Sejong Hall paved driveway and forecourt',{map:sejongPaverTexture()},3);
  finish(paving, 'Mapped walks, cycleways and steps', {map:texture.paver}, 2);
  finish(unsealed, 'Mapped trails and gravel paths', {map:texture.asphalt}, 2);
  finish(markings, 'Crosswalks, lane paint and step nosings', {}, 5);
  finish(bridgeStructure,'KAIST Bridge deck and fascias',{},1);

  const rail = new THREE.Color(0x788483), cap = new THREE.Color(0xadb0a7), stone = new THREE.Color(0x8e9187), hedge = new THREE.Color(0x546a43);
  const tennisIron=new THREE.Color(0x424544),tennisPier=new THREE.Color(0xc7c2b5);
  const beam = (a, b, low, high, depth, colour) => {
    const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz) || 1, nx = dz / len, nz = -dx / len;
    const vertex = (p, side, h) => [p[0] + nx * side, height(...p) + h, p[1] + nz * side];
    const flank = (p, q, r, t, normal, c) => walls.quad(p,q,r,t,normal,uv(p),uv(q),uv(r),uv(t),c);
    for (const side of [-1,1]) {
      flank(vertex(a, depth * side, low), vertex(b, depth * side, low), vertex(b, depth * side, high), vertex(a, depth * side, high), [nx * side,0,nz * side], colour);
    }
    flank(vertex(a, depth, high), vertex(b, depth, high), vertex(b, -depth, high), vertex(a, -depth, high), up, colour);
  };
  for (const f of D.barriers) {
    if (!physicalBarrier(f) || northwestBallNets.has(f.id)) continue;
    const full = f.t.includes('wall') || f.t === 'hedge', top = f.height || (full ? 1.4 : f.t === 'guard_rail' ? .72 : 1.13);
    for (let i = 1; i < f.p.length; i++) for(const [a,b] of roadsideSpans(f.p[i-1],f.p[i],full?.18:.055,world.access)){
      if (northwestBoulderSection(f,i)) continue;
      const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz), steps = Math.ceil(len / 2.15);
      for (let j = 0; j < steps; j++) {
        const p = [a[0] + dx * j / steps, a[1] + dz * j / steps], q = [a[0] + dx * (j + 1) / steps, a[1] + dz * (j + 1) / steps];
        const mx = (p[0]+q[0])/2, mz = (p[1]+q[1])/2;
        const road = roadIndex.nearest(mx, mz, 13);
        const tennisRailing=f.id===484468907;
        if (!tennisRailing && road && road.distance < road.s.road.width / 2 + .15) continue;
        if (tennisRailing) {
          const between=t=>[p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t];
          const postWidth=f=>Math.min(1,f*steps/len);
          beam(p,between(postWidth(.19)),0,1.22,.095,tennisPier);
          beam(p,q,1.04,1.10,.035,tennisIron);
          beam(p,q,.30,.35,.035,tennisIron);
          for(let k=1;k<7;k++)beam(between(k/7),between(Math.min(1,k/7+postWidth(.035))),.35,1.04,.025,tennisIron);
        } else if (full) {
          beam(p,q,-.15,top,.15,f.t === 'hedge' ? hedge : stone);
          if (f.t !== 'hedge') beam(p,q,top,top+.08,.18,cap);
        } else {
          const t = Math.min(1,.10 * steps / (len || 1));
          beam(p,[p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t],0,top+.02,.047,rail);
          beam(p,q,top-.07,top,.045,cap);
          beam(p,q,top*.48,top*.48+.07,.035,rail);
        }
      }
    }
  }
  finish(walls, 'OpenStreetMap fences, retaining walls and railings', {}, 1);
}
