import * as THREE from '../lib/three.module.min.js';
import { isMotorRoad, physicalBarrier, roadLift } from './explore-surfaces.js';

const up = [0, 1, 0], uv = p => [p[0] / 4, p[2] / 4];
const paint = new THREE.Color(0xf1ede2), yellow = new THREE.Color(0xdbb45c);
const palette = {
  street: 0x92928f, service: 0x8b8c89, parking: 0x858782, walk: 0xc0a893,
  cycle: 0xb19686, trail: 0xa28a6a, steps: 0xaaa79b, gravel: 0xa69b87,
  redCourt: 0x9d746e, redPavers: 0xb0756c
};
function surfaceStyle(r) {
  // The E14 arrival court and E15 auditorium approach have red surfacing in
  // the linked public views. Only colour the approach ways visible there.
  if(r.id===220224724)return 'redCourt';
  if(r.id===503477355)return 'redPavers';
  if (/gravel|unpaved|ground|dirt|earth|sand/.test(r.surface || '')) return 'gravel';
  if (r.surface === 'asphalt') return 'street';
  if (r.surface === 'wood') return 'trail';
  return r.roadClass;
}

export function buildExploreRoads(scene, world, height, texture, MB, flat, referenceRoadStyles) {
  const { D, C, roadIndex } = world;
  const asphalt = new MB(), paving = new MB(), unsealed = new MB(), markings = new MB(), walls = new MB();
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
  const quad = (batch, a, b, c, d, colour) => batch.quad(a, b, c, d, up, uv(a), uv(b), uv(c), uv(d), colour);
  const face = (s, along, offset, y) => {
    const x = s.a[0] + s.dx * along + s.dz * offset, z = s.a[1] + s.dz * along - s.dx * offset;
    const way = roadIndex.ways.get(s.road), deck = way.deck, f = (s.start + along) / way.length;
    const base = deck ? deck[0] + f * (deck[1] - deck[0]) : height(x, z);
    return [x, Math.max(way.fordLevel ?? -Infinity,base + pavementLift(s.road,x,z)) + y, z];
  };
  const strip = (s, a, b, left, right, lift, batch, colour) =>
    quad(batch, face(s, a, left, lift), face(s, a, right, lift), face(s, b, right, lift), face(s, b, left, lift), colour);
  const masks = new Map();
  // A strip crossing a shared node leaves triangles uncovered at sharp bends.
  // Fill the joint once using the incident road's actual width and material.
  for (const [road, way] of roadIndex.ways) {
    const style = surfaceStyle(road), colour = colours[style] || colours.walk, motor = isMotorRoad(road);
    const batch = style === 'gravel' || style === 'trail' ? unsealed : style === 'redPavers' ? paving : motor || style === 'street' ? asphalt : paving;
    const half = road.width / 2;
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
      for (let j = 0; j < count; j++) {
        const a = s.span * j / count, b = s.span * (j + 1) / count, mid = (a + b) / 2;
        strip(s, a, b, half, -half, 0, batch, colour);
        if (mid < junction[0] || s.span - mid < junction[1]) continue;
        if (!motor || half < 2.45) continue;
        const captured = courseStyle(s.a[0] + s.dx * mid, s.a[1] + s.dz * mid, s.dx, s.dz);
        const center = captured?.center || (road.roadClass === 'street' && road.width >= 6.5 ? (road.oneway ? 'none' : 'single') : 'none');
        if (center === 'single' || center === 'dashed' && Math.floor((s.start + mid) / 4) % 2 === 0) strip(s, a, b, .07, -.07, .016, markings, yellow);
        if (center === 'double') {
          strip(s, a, b, .20, .07, .016, markings, yellow);
          strip(s, a, b, -.07, -.20, .016, markings, yellow);
        }
        if (captured?.edges === 'white' || captured?.edges === 'yellow') {
          for (const sign of [-1,1]) strip(s, a, b, sign * (half - .20), sign * (half - .32), .016, markings, captured.edges === 'yellow' ? yellow : paint);
        }
        if ((road.lanes || 0) >= 4 && Math.floor((s.start + mid) / 4) % 2 === 0) {
          for (const sign of [-1, 1]) strip(s, a, b, sign * (half * .5 - .055), sign * (half * .5 + .055), .022, markings, paint);
        }
      }
      // Each join uses a fan constrained to its width. Keep the original node
      // IDs so unrelated grades and adjacent parallel lanes do not connect.
      for (let i = 0; i < 2; i++) {
        const id = s.ids[i], before = masks.get(id);
        if (!before || (motor && !before.motor) || motor === before.motor && half > before.half) {
          masks.set(id, { s, along: i ? s.span : 0, half, motor, batch, colour });
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
    const ctr = face(s, along, 0, 0), sides = Math.max(8, Math.min(24, Math.ceil(half * 2)));
    const ring = [];
    for (let i = 0; i < sides; i++) {
      const angle = i / sides * Math.PI * 2;
      const x = ctr[0] + Math.cos(angle) * half, z = ctr[2] + Math.sin(angle) * half;
      const y = roadIndex.ways.get(s.road).deck ? ctr[1] : height(x, z) + pavementLift(s.road,x,z);
      ring.push([x, y, z]);
    }
    for (let i = 0; i < sides; i++) {
      const a = ring[i], b = ring[(i + 1) % sides];
      batch.tri(ctr, a, b, up, uv(ctr), uv(a), uv(b), colour);
    }
  }
  for (const [x, z] of D.crossings) {
    const snap = roadIndex.nearest(x, z, 9, isMotorRoad);
    if (!snap || snap.distance > snap.s.road.width / 2 + 1.2) continue;
    const { s, along } = snap, half = s.road.width / 2 - .40;
    for (let o = -half + .12; o + .47 <= half; o += .94) {
      strip(s, along - 1.5, along + 1.5, o, o + .47, .033, markings, paint);
    }
  }
  const finish = (mb, name, mat, offset) => {
    if (!mb.p.length) return;
    flat(scene, mb, new THREE.MeshStandardMaterial({vertexColors:true, roughness:.93, ...mat}), offset).name = name;
  };
  finish(asphalt, 'Mapped campus streets and service lanes', {map:texture.asphalt}, 3);
  finish(paving, 'Mapped walks, cycleways and steps', {map:texture.paver}, 2);
  finish(unsealed, 'Mapped trails and gravel paths', {map:texture.asphalt}, 2);
  finish(markings, 'Crosswalks, lane paint and step nosings', {}, 5);

  const rail = new THREE.Color(0x788483), cap = new THREE.Color(0xadb0a7), stone = new THREE.Color(0x8e9187), hedge = new THREE.Color(0x546a43);
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
    if (!physicalBarrier(f)) continue;
    const full = f.t.includes('wall') || f.t === 'hedge', top = f.height || (full ? 1.4 : f.t === 'guard_rail' ? .72 : 1.13);
    for (let i = 1; i < f.p.length; i++) {
      const a = f.p[i - 1], b = f.p[i], dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz), steps = Math.ceil(len / 2.15);
      for (let j = 0; j < steps; j++) {
        const p = [a[0] + dx * j / steps, a[1] + dz * j / steps], q = [a[0] + dx * (j + 1) / steps, a[1] + dz * (j + 1) / steps];
        const mx = (p[0]+q[0])/2, mz = (p[1]+q[1])/2;
        const road = roadIndex.nearest(mx, mz, 13);
        if (road && road.distance < road.s.road.width / 2 + .15) continue;
        if (full) {
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
