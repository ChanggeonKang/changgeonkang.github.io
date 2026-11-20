// The road meshes, tyre surface and minimap all use the same mapped centre lines.
export const isMotorRoad = road => ['street', 'service', 'parking'].includes(road.roadClass);
export const roadLift = road => isMotorRoad(road) ? .2 : .12;
export const isPassage = road => Boolean(road.tunnel || road.covered || road.layer < 0 || road.t === 'corridor');
// Surface arcades have an exterior opening. A path ending at a closed door,
// an underground corridor, or an elevated link does not open that facade.
export const isFacadePassage = road => road.tunnel === 'building_passage' ||
  Boolean(road.covered && !road.layer && !road.tunnel && road.t !== 'corridor');
const key = (x, z) => x * 16384 + z;
const cellSize = 32;

export function prepareRoads(roads) {
  const cells = new Map(), ways = new Map(), nodes = new Map();
  for (const road of roads) {
    const segments = [], total = road.p.length;
    let length = 0;
    for (let i = 1; i < total; i++) {
      const a = road.p[i - 1], b = road.p[i], dx = b[0] - a[0], dz = b[1] - a[1], span = Math.hypot(dx, dz);
      if (span < .02) continue;
      const ids = [road.nodes?.[i - 1] ?? a.join(','), road.nodes?.[i] ?? b.join(',')];
      const s = { a, b, road, dx: dx / span, dz: dz / span, span, start: length, ids };
      segments.push(s);
      length += span;
      for (let end = 0; end < 2; end++) {
        const id = ids[end], p = end ? b : a;
        if (!nodes.has(id)) nodes.set(id, { p, neighbours: new Set(), motor: new Set(), halfWidth: 0 });
        const n = nodes.get(id);
        n.neighbours.add(ids[1 - end]);
        if (isMotorRoad(road)) {
          n.motor.add(ids[1 - end]);
          n.halfWidth = Math.max(n.halfWidth, road.width / 2);
          if(road.drivable && !road.bridge)n.groundCar=true;
        }
      }
      const r = road.width / 2 + 1;
      for (let ix = Math.floor((Math.min(a[0], b[0]) - r) / cellSize); ix <= Math.floor((Math.max(a[0], b[0]) + r) / cellSize); ix++) {
        for (let iz = Math.floor((Math.min(a[1], b[1]) - r) / cellSize); iz <= Math.floor((Math.max(a[1], b[1]) + r) / cellSize); iz++) {
          const k = key(ix, iz);
          if (!cells.has(k)) cells.set(k, []);
          cells.get(k).push(s);
        }
      }
    }
    ways.set(road, { segments, length });
  }
  function nearest(x, z, radius = 12, accepts = () => true) {
    let best = null, bestSq = radius * radius;
    for (let ix = Math.floor((x - radius) / cellSize); ix <= Math.floor((x + radius) / cellSize); ix++) {
      for (let iz = Math.floor((z - radius) / cellSize); iz <= Math.floor((z + radius) / cellSize); iz++) {
        for (const s of cells.get(key(ix, iz)) || []) {
          if (!accepts(s.road)) continue;
          const along = Math.max(0, Math.min(s.span, (x - s.a[0]) * s.dx + (z - s.a[1]) * s.dz));
          const px = s.a[0] + s.dx * along, pz = s.a[1] + s.dz * along;
          const dsq = (x - px) ** 2 + (z - pz) ** 2;
          if (dsq >= bestSq) continue;
          bestSq = dsq;
          best = { s, x: px, z: pz, along, distance: Math.sqrt(dsq) };
        }
      }
    }
    return best;
  }
  return { ways, nodes, nearest };
}

export function rasterPolygon(grid, polygon, value) {
  // Scan all rings together, preserving mapped courtyards and islands.
  const rings = [polygon.p, ...(polygon.holes || [])].filter(p => p.length >= 3);
  if (!rings.length) return;
  const outerZ = rings[0].map(p => p[1]);
  const z0 = Math.max(grid.z0, Math.ceil(Math.min(...outerZ) - .5));
  const z1 = Math.min(grid.z0 + grid.h - 1, Math.floor(Math.max(...outerZ) - .5));
  for (let z = z0; z <= z1; z++) {
    const y = z + .5, edges = [];
    for (const p of rings) {
      for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
        const a = p[j], b = p[i];
        if ((a[1] > y) !== (b[1] > y)) edges.push(a[0] + (y - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
      }
    }
    edges.sort((a, b) => a - b);
    const row = (z - grid.z0) * grid.w;
    for (let i = 1; i < edges.length; i += 2) {
      const a = Math.max(0, Math.ceil(edges[i - 1] - .5) - grid.x0);
      const b = Math.min(grid.w, Math.ceil(edges[i] - .5) - grid.x0);
      if (b > a) grid.d.fill(value, row + a, row + b);
    }
  }
}

export function rasterSegment(grid, a, b, radius, write) {
  const dx = b[0] - a[0], dz = b[1] - a[1], den = dx * dx + dz * dz || 1;
  // Bound the scan around the long axis. This also keeps diagonal roads cheap.
  const z0 = Math.max(grid.z0, Math.floor(Math.min(a[1], b[1]) - radius));
  const z1 = Math.min(grid.z0 + grid.h - 1, Math.ceil(Math.max(a[1], b[1]) + radius));
  const left = Math.min(a[0], b[0]) - radius, right = Math.max(a[0], b[0]) + radius;
  for (let z = z0; z <= z1; z++) {
    const offset = z + .5 - a[1], at = a[0] + offset * dx / (dz || 1), margin = radius * Math.sqrt(den) / Math.abs(dz || 1);
    const xmin = dz ? Math.max(left, at - margin) : left, xmax = dz ? Math.min(right, at + margin) : right;
    const x0 = Math.max(grid.x0, Math.floor(xmin)), x1 = Math.min(grid.x0 + grid.w - 1, Math.ceil(xmax));
    for (let x = x0; x <= x1; x++) {
      const t = Math.max(0, Math.min(1, ((x + .5 - a[0]) * dx + offset * dz) / den));
      if ((x + .5 - a[0] - dx * t) ** 2 + (offset - dz * t) ** 2 <= radius * radius) {
        write((z - grid.z0) * grid.w + x - grid.x0, t);
      }
    }
  }
}

export function physicalBarrier(b) {
  return ['wall', 'city_wall', 'fence', 'retaining_wall', 'guard_rail', 'hedge', 'handrail', 'railing', 'chain', 'cable_barrier'].includes(b.t);
}

export function prepareSurfaceGrid(data, index, terrainAt) {
  const b = data.bounds, w = b.x1 - b.x0, h = b.z1 - b.z0;
  const grid = { x0:b.x0, z0:b.z0, w,h, d:new Uint8Array(w*h), lift:new Uint8Array(w*h),
    mappedLane:new Uint8Array(w*h), portals:new Uint8Array(w*h), decks:new Map(), lowerDecks:new Set() };
  for (const plaza of data.areas) if (plaza.k === 'plaza') rasterPolygon(grid, plaza, 1);
  for (const lot of data.parking) rasterPolygon(grid, lot, 2);
  grid.lotMask=Uint8Array.from(grid.d,d=>d===2?1:0);
  for (const a of data.areas) if (a.k === 'water') rasterPolygon(grid, a, 8);
  for (const building of data.buildings) if (building.t !== 'roof' && !(building.minHeight >= 2)) rasterPolygon(grid, building, 9);
  const original=grid.d.slice(), lower=new Uint8Array(w*h);
  const insideBuilding=(x,z)=>original[(Math.floor(z)-b.z0)*w+Math.floor(x)-b.x0]===9;
  const crossesBuilding=(s,t)=>{
    const along=t*s.span;
    for(const delta of [0,-2.4,2.4]){
      const distance=Math.max(0,Math.min(s.span,along+delta));
      const x=s.a[0]+s.dx*distance, z=s.a[1]+s.dz*distance;
      if(insideBuilding(x+s.dz*.55,z-s.dx*.55) && insideBuilding(x-s.dz*.55,z+s.dx*.55))return true;
    }
    return false;
  };
  const adjacentSolid=k=>original[k]===9 || original[k+1]===9 || original[k-1]===9 ||
    original[k+w]===9 || original[k-w]===9 || original[k+w+1]===9 || original[k-w-1]===9 || original[k+w-1]===9 || original[k-w+1]===9;
  for (const motor of [false, true]) {
    for (const [road, way] of index.ways) {
      if (isMotorRoad(road) !== motor) continue;
      const width = road.width / 2, type = motor ? 2 : 1, lift = Math.round(roadLift(road) * 200);
      const first = road.p[0], last = road.p.at(-1), bridge = Boolean(road.bridge);
      if (bridge) way.deck = [terrainAt(...first), terrainAt(...last)];
      for (const s of way.segments) rasterSegment(grid, s.a, s.b, width, (k, t) => {
        if (grid.d[k] === 8 && !bridge && !road.ford && !isPassage(road)) return;
        // Wider kerbs or a driveway running beside a glazed lobby can touch
        // its wall. Cut only an arcade or an actual through-driving corridor.
        if(adjacentSolid(k) && (isFacadePassage(road) || (motor && !road.layer && crossesBuilding(s,t)))){
          const x=b.x0+k%w+.5,z=b.z0+Math.floor(k/w)+.5;
          grid.portals[k]=Math.max(1,Math.min(255,Math.ceil(terrainAt(x,z)+3.75+48)));
        }
        grid.d[k] = type;
        grid.lift[k] = !motor && grid.lotMask[k] ? 46 : lift;
        grid.mappedLane[k] = 1;
        if (bridge) {
          const fraction = (s.start + s.span * t) / way.length;
          grid.decks.set(k, way.deck[0] + fraction * (way.deck[1] - way.deck[0]) + roadLift(road));
        } else if(way.fordLevel!==undefined){
          const x=b.x0+k%w+.5,z=b.z0+Math.floor(k/w)+.5;
          grid.decks.set(k,Math.max(terrainAt(x,z)+roadLift(road),way.fordLevel));
        } else lower[k]=1;
      });
    }
  }
  // A narrow underpass must carry all four wheel probes across the deck edge.
  for(const k of grid.decks.keys()){
    for(let dz=-3;dz<=3 && !grid.lowerDecks.has(k);dz++)for(let dx=-3;dx<=3;dx++){
      if(dx*dx+dz*dz<=9 && lower[k+dz*w+dx]){grid.lowerDecks.add(k);break;}
    }
  }
  // At a shared bridge end the approach and deck are one carriageway.
  // Treating its round end cap as an underpass makes an invisible wall where
  // the metre-grid deck and the exact pavement outline cross a cell differently.
  for(const [road,way] of index.ways)if(road.drivable && road.bridge && way.segments.length){
    const start=way.segments[0],finish=way.segments.at(-1);
    for(const [id,p] of [[start.ids[0],start.a],[finish.ids[1],finish.b]]){
      if(!index.nodes.get(id).groundCar)continue;
      rasterSegment(grid,p,p,road.width/2+Math.SQRT1_2,k=>{
        const deck=grid.decks.get(k);
        if(deck===undefined)return;
        const x=b.x0+k%w+.5,z=b.z0+Math.floor(k/w)+.5;
        if(Math.abs(deck-(terrainAt(x,z)+roadLift(road)))<1)grid.lowerDecks.delete(k);
      });
    }
  }
  for (const fence of data.barriers) {
    if (!physicalBarrier(fence)) continue;
    for (let i = 1; i < fence.p.length; i++) rasterSegment(grid, fence.p[i - 1], fence.p[i], .57, k => {
      // A mapped gate or path through an enclosure must remain an opening.
      if (!grid.lift[k] && grid.d[k] === 0) grid.d[k] = 9;
    });
  }
  for (let i = 0; i < grid.d.length; i++) if (!grid.lift[i]) grid.lift[i]=grid.d[i]===2?40:grid.d[i]===1?24:0;
  return grid;
}
