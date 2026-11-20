// At each x meridian, cache the exact z coordinates at which pavement starts
// or ends. A query only crosses edges inside its own 12 m tile, even in large
// parking areas or on long diagonal streets. Winding at holes uses the same
// even-odd convention as the curb rings.
export function indexRoadBoundary(rings, bounds) {
  const tile = 12;
  const {x0,x1,z0,z1} = bounds;
  const columns = Math.ceil((x1-x0)/tile), rows = Math.ceil((z1-z0)/tile);
  // Offset the meridian from the centimetre-quantized source vertices to
  // avoid vertex coincidences at an axis-aligned edge.
  const origin = x0 - .000001;
  const crossings = Array.from({length: columns+1}, () => []);
  const cells = new Map();
  for (const ring of rings) {
    for (let j=0,i=ring.length-1; j<ring.length; i=j++) {
      const [ax,az]=ring[i], [bx,bz]=ring[j], dx=bx-ax, dz=bz-az;
      const left=Math.min(ax,bx), right=Math.max(ax,bx);
      const c0=Math.max(0,Math.floor((left-origin)/tile)), c1=Math.min(columns,Math.floor((right-origin)/tile));
      const r0=Math.max(0,Math.floor((Math.min(az,bz)-z0)/tile)), r1=Math.min(rows-1,Math.floor((Math.max(az,bz)-z0)/tile));
      const edge=[ax,az,bz,dz ? dx/dz : 0];
      for(let c=c0;c<=c1;c++) {
        const meridian=origin+c*tile;
        if(left<meridian && meridian<right) crossings[c].push(az + (meridian-ax)*dz/dx);
        if(dz===0)continue;
        for(let r=r0;r<=r1;r++) {
          const id=r*(columns+1)+c;
          if(!cells.has(id))cells.set(id,[]);
          cells.get(id).push(edge);
        }
      }
    }
  }
  for(const line of crossings)line.sort((a,b)=>a-b);
  return (x,z)=>{
    if(x<x0 || x>=x1 || z<z0 || z>=z1)return false;
    const c=Math.floor((x-origin)/tile),r=Math.floor((z-z0)/tile),line=crossings[c];
    let l=0,h=line.length;
    while(l<h){const m=(l+h)>>1;if(line[m]<=z)l=m+1;else h=m;}
    let inside=l & 1;
    const edges=cells.get(r*(columns+1)+c);
    if(edges){
      const start=origin+c*tile;
      for(const [ax,az,bz,slope] of edges){
        if((az>z)===(bz>z))continue;
        const at=ax+(z-az)*slope;
        if(at>start && at<=x)inside^=1;
      }
    }
    return Boolean(inside);
  };
}

// The one-metre preview/diagnostic mask is sampled from the vector geometry.
// Tyre and chassis positions are tested against the vector geometry itself.
export function sampleRoadGrid(rings, bounds) {
  const {x0,x1,z0,z1}=bounds, w=x1-x0,h=z1-z0;
  const d=new Uint8Array(w*h), lines=Array.from({length:h},()=>[]);
  for(const ring of rings)for(let j=0,i=ring.length-1;j<ring.length;i=j++){
    const [ax,az]=ring[i],[bx,bz]=ring[j];
    const start=Math.max(z0,Math.ceil(Math.min(az,bz)-.5)),end=Math.min(z1,Math.ceil(Math.max(az,bz)-.5));
    for(let z=start;z<end;z++)lines[z-z0].push(ax+(z+.5-az)*(bx-ax)/(bz-az));
  }
  for(let r=0;r<h;r++){
    const line=lines[r].sort((a,b)=>a-b);
    for(let i=1;i<line.length;i+=2){
      const a=Math.max(x0,Math.ceil(line[i-1]-.5)),b=Math.min(x1,Math.ceil(line[i]-.5));
      if(b>a)d.fill(1,r*w+a-x0,r*w+b-x0);
    }
  }
  return {x0,z0,w,h,d};
}
