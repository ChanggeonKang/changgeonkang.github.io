// Paint is interrupted at the edge of a yellow-and-white speed hump. Cut
// existing paint triangles in 3D so their remaining ends retain the camber.
function splitPolygon(polygon, nx, nz, distance) {
  const inside = [], outside = [];
  let previous = polygon.at(-1);
  let from = previous[0] * nx + previous[2] * nz - distance;
  for (const point of polygon) {
    const to = point[0] * nx + point[2] * nz - distance;
    if ((from > 0 && to < 0) || (from < 0 && to > 0)) {
      const fraction = from / (from - to);
      const edge = previous.map((v, i) => v + fraction * (point[i] - v));
      inside.push(edge);
      outside.push(edge);
    }
    if (to <= 0) inside.push(point);
    if (to >= 0) outside.push(point);
    previous = point;
    from = to;
  }
  return {inside, outside};
}

function subtract(polygon, planes) {
  const remainder = [];
  for (const [nx, nz, distance] of planes) {
    const {inside, outside} = splitPolygon(polygon, nx, nz, distance);
    if (outside.length >= 3) remainder.push(outside);
    if (inside.length < 3) break;
    polygon = inside;
  }
  return remainder;
}

export function createHumpPaintMask(humps) {
  const cells = new Map(), cellSize = 16;
  const key = (x, z) => x * 16384 + z;
  function visit(x0, z0, x1, z1, fn) {
    for (let i = Math.floor(x0 / cellSize); i <= Math.floor(x1 / cellSize); i++) {
      for (let j = Math.floor(z0 / cellSize); j <= Math.floor(z1 / cellSize); j++) fn(key(i, j));
    }
  }
  for (const {x, z, dx, dz, length, hw} of humps) {
    const half = length / 2;
    const rx = Math.abs(dx) * half + Math.abs(dz) * hw, rz = Math.abs(dz) * half + Math.abs(dx) * hw;
    const planes = [[dx, dz, half], [-dx, -dz, half], [dz, -dx, hw], [-dz, dx, hw]]
      .map(([nx, nz, extent]) => [nx, nz, x * nx + z * nz + extent]);
    const mask = {x0:x-rx, x1:x+rx, z0:z-rz, z1:z+rz, planes};
    visit(mask.x0, mask.z0, mask.x1, mask.z1, k => {
      if (!cells.has(k)) cells.set(k, []);
      cells.get(k).push(mask);
    });
  }
  return (a, b, c, d) => {
    const x0 = Math.min(a[0],b[0],c[0],d[0]), x1 = Math.max(a[0],b[0],c[0],d[0]);
    const z0 = Math.min(a[2],b[2],c[2],d[2]), z1 = Math.max(a[2],b[2],c[2],d[2]);
    const overlap = new Set();
    visit(x0, z0, x1, z1, k => {
      for (const mask of cells.get(k) || []) {
        if (x1 > mask.x0 && x0 < mask.x1 && z1 > mask.z0 && z0 < mask.z1) overlap.add(mask);
      }
    });
    if (!overlap.size) return null;
    let polygons = [[a,b,c], [a,c,d]];
    for (const mask of overlap) polygons = polygons.flatMap(polygon => subtract(polygon, mask.planes));
    return polygons;
  };
}
