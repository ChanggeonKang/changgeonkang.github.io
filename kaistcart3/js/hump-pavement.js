// Tyres and entrance floors query the triangles actually submitted to WebGL.
// Keep compact triangle references for the whole campus, and decode only the
// handful of cells around a moving kart into planes for repeated wheel probes.
const CELL = 4;
const substrates = new Set(['Mapped campus streets and service lanes','West campus block-paved motor lane','Sejong Hall paved driveway and forecourt','Mapped walks, cycleways and steps',
  'Mapped trails and gravel paths','Campus terrain','Campus plazas and pedestrian squares','campus-parking-asphalt']);

// Quantising the source fingerprint to millimetres tolerates harmless
// floating-point differences between browser engines.
export function hashNumbers(hash,numbers,scale=1){
  for(let i=0;i<numbers.length;i++)hash=Math.imul(hash^Math.round(numbers[i]*scale),16777619);
  return hash>>>0;
}

function clip(points,axis,edge,sign){
  const out=[];
  for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length],da=(a[axis]-edge)*sign,db=(b[axis]-edge)*sign;
    if(da>=0)out.push(a);
    if((da<0 && db>0) || (da>0 && db<0)){
      const f=da/(da-db);
      out.push([a[0]+f*(b[0]-a[0]),a[1]+f*(b[1]-a[1])]);
    }
  }
  return out;
}

// An asphalt fan can end between two of the fine hump vertices. Check the
// actual overlap polygon, including the diagonal shared by the two hump
// triangles. A difference of two planes attains its maximum at a vertex.
function clearPavementSeams(b,triangles){
  const {na,nl,heights}=b.surface, stride=nl+1;
  const corrections=new Float64Array(heights.length);
  const toGrid=(x,z)=>[((x-b.x)*b.dx+(z-b.z)*b.dz)/b.length*na+na/2,
    ((x-b.x)*b.dz-(z-b.z)*b.dx)/b.width*nl+nl/2];
  for(const t of triangles){
    const vertices=[toGrid(t.ax,t.az),toGrid(t.bx,t.bz),toGrid(t.cx,t.cz)];
    const us=vertices.map(p=>p[0]),vs=vertices.map(p=>p[1]);
    const i0=Math.max(0,Math.floor(Math.min(...us))),i1=Math.min(na-1,Math.floor(Math.max(...us)));
    const j0=Math.max(0,Math.floor(Math.min(...vs))),j1=Math.min(nl-1,Math.floor(Math.max(...vs)));
    const gradX=t.ux*t.uy+t.vx*t.vy,gradZ=t.uz*t.uy+t.vz*t.vy;
    const du=(gradX*b.dx+gradZ*b.dz)*b.length/na,dv=(gradX*b.dz-gradZ*b.dx)*b.width/nl;
    for(let i=i0;i<=i1;i++)for(let j=j0;j<=j1;j++){
      const o=i*stride+j,ha=heights[o],hc=heights[o+stride],he=heights[o+stride+1],hd=heights[o+1];
      const plane=t.ay+(i-us[0])*du+(j-vs[0])*dv;
      if(plane<=ha+.0001 && plane+du<=hc+.0001 && plane+du+dv<=he+.0001 && plane+dv<=hd+.0001)continue;
      let polygon=clip(clip(vertices,0,i,1),0,i+1,-1);
      polygon=clip(clip(polygon,1,j,1),1,j+1,-1);
      if(polygon.length<3)continue;
      let lift=0;
      const measure=(u,v)=>{
        const top=u>=v ? ha+(hc-ha)*u+(he-hc)*v : ha+(he-hd)*u+(hd-ha)*v;
        lift=Math.max(lift,plane+du*u+dv*v-top);
      };
      for(let k=0;k<polygon.length;k++){
        const p=polygon[k],q=polygon[(k+1)%polygon.length];
        const u=p[0]-i,v=p[1]-j,u1=q[0]-i,v1=q[1]-j,pa=u-v,qa=u1-v1;
        measure(u,v);
        if(pa*qa<0){const cross=u+(u1-u)*pa/(pa-qa);measure(cross,cross);}
      }
      if(lift>.0001)for(const k of [o,o+1,o+stride,o+stride+1])corrections[k]=Math.max(corrections[k],lift);
    }
  }
  for(let k=0;k<heights.length;k++)heights[k]+=corrections[k];
}

export function indexPavement(bounds,meshes) {
  const x0=Math.floor(bounds.x0/CELL), z0=Math.floor(bounds.z0/CELL);
  const w=Math.floor(bounds.x1/CELL)-x0+1,h=Math.floor(bounds.z1/CELL)-z0+1;
  const positions=[],indices=[],paintable=[];
  let fingerprint=2166136261;
  for(const m of meshes)if(substrates.has(m.name)){
    positions.push(m.geometry.attributes.position.array);
    indices.push(m.geometry.index?.array);
    paintable.push(m.name!=='Campus terrain' && m.name!=='Mapped trails and gravel paths');
    fingerprint=hashNumbers(fingerprint,positions.at(-1),1000);
    if(indices.at(-1))fingerprint=hashNumbers(fingerprint,indices.at(-1));
  }
  const numMeshes=positions.length,offsets=new Uint32Array(w*h+1);
  let entries;
  // Two passes avoid keeping a JS array (and boxed numbers) per square of
  // road. Every reference addresses the original mesh buffers directly.
  function populate(cursor){
    for(let mesh=0;mesh<numMeshes;mesh++){
      const pos=positions[mesh],idx=indices[mesh],count=idx?.length??pos.length/3;
      for(let k=0;k<count;k+=3){
        const a=idx?idx[k]*3:k*3,b=idx?idx[k+1]*3:a+3,c=idx?idx[k+2]*3:a+6;
        const ax=pos[a],az=pos[a+2],bx=pos[b],bz=pos[b+2],cx=pos[c],cz=pos[c+2];
        if(Math.abs((bx-ax)*(cz-az)-(bz-az)*(cx-ax))<1e-10)continue;
        const left=Math.max(0,Math.floor(Math.min(ax,bx,cx)/CELL)-x0);
        const right=Math.min(w-1,Math.floor(Math.max(ax,bx,cx)/CELL)-x0);
        const top=Math.max(0,Math.floor(Math.min(az,bz,cz)/CELL)-z0);
        const bottom=Math.min(h-1,Math.floor(Math.max(az,bz,cz)/CELL)-z0);
        const ref=(k/3)*numMeshes+mesh;
        for(let j=top;j<=bottom;j++)for(let i=left;i<=right;i++){
          const bin=i+j*w;
          if(cursor)entries[cursor[bin]++]=ref;
          else offsets[bin+1]++;
        }
      }
    }
  }
  populate(null);
  for(let i=1;i<offsets.length;i++)offsets[i]+=offsets[i-1];
  entries=new Uint32Array(offsets.at(-1));
  populate(offsets.slice(0,-1));
  function plane(ref){
    const m=ref%numMeshes, k=(ref-m)/numMeshes*3,pos=positions[m],idx=indices[m];
    const a=idx?idx[k]*3:k*3,b=idx?idx[k+1]*3:a+3,c=idx?idx[k+2]*3:a+6;
    const ax=pos[a],az=pos[a+2],bx=pos[b],bz=pos[b+2],cx=pos[c],cz=pos[c+2],ay=pos[a+1];
    const det=(bx-ax)*(cz-az)-(bz-az)*(cx-ax);
    return {ax,az,bx,bz,cx,cz,ay,ux:(cz-az)/det,uz:(ax-cx)/det,vx:(az-bz)/det,vz:(bx-ax)/det,uy:pos[b+1]-ay,vy:pos[c+1]-ay,paintable:paintable[m]};
  }
  const cache=Array(32);
  function heightAt(x,z,ceiling=Infinity){
    const i=Math.floor(x/CELL)-x0,j=Math.floor(z/CELL)-z0;
    if(i<0||j<0||i>=w||j>=h)return -Infinity;
    const bin=i+j*w,slot=bin%cache.length;
    let tile=cache[slot];
    if(tile?.bin!==bin){
      const triangles=[];
      for(let k=offsets[bin];k<offsets[bin+1];k++)triangles.push(plane(entries[k]));
      cache[slot]=tile={bin,triangles};
    }
    let top=-Infinity;
    for(const t of tile.triangles){
      const dx=x-t.ax,dz=z-t.az, u=t.ux*dx+t.uz*dz,v=t.vx*dx+t.vz*dz;
      if(u<-.000001 || v<-.000001 || u+v>1.000001)continue;
      const y=t.ay+t.uy*u+t.vy*v;
      if(y<=ceiling && y>top)top=y;
    }
    return top;
  }
  function trianglesIn(minX,minZ,maxX,maxZ){
    const refs=new Set();
    const left=Math.max(0,Math.floor(minX/CELL)-x0),right=Math.min(w-1,Math.floor(maxX/CELL)-x0);
    const top=Math.max(0,Math.floor(minZ/CELL)-z0),bottom=Math.min(h-1,Math.floor(maxZ/CELL)-z0);
    for(let j=top;j<=bottom;j++)for(let i=left;i<=right;i++){
      const bin=i+j*w;
      for(let k=offsets[bin];k<offsets[bin+1];k++)refs.add(entries[k]);
    }
    return Array.from(refs,plane);
  }
  function fitSeams(b){
    const radius=Math.hypot(b.hw,b.length/2);
    clearPavementSeams(b,trianglesIn(b.x-radius,b.z-radius,b.x+radius,b.z+radius));
  }
  // At the edge of a bridge or a cut in a parking slab the visible road can
  // change level abruptly. Keep the two sides of that edge independent.
  function edgeProfile(ax,az,bx,bz){
    const dx=bx-ax,dz=bz-az,facets=[],cuts=[0,1];
    for(const t of trianglesIn(Math.min(ax,bx),Math.min(az,bz),Math.max(ax,bx),Math.max(az,bz))){
      const u=(ax-t.ax)*t.ux+(az-t.az)*t.uz,v=(ax-t.ax)*t.vx+(az-t.az)*t.vz;
      const du=dx*t.ux+dz*t.uz,dv=dx*t.vx+dz*t.vz;
      let start=0,end=1;
      for(const [offset,rate] of [[u,du],[v,dv],[1-u-v,-du-dv]]){
        if(Math.abs(rate)<1e-12){if(offset<0){end=-1;break;}}
        else if(rate>0)start=Math.max(start,-offset/rate);
        else end=Math.min(end,-offset/rate);
      }
      if(end-start<=1e-7)continue;
      facets.push({start,end,y:t.ay+u*t.uy+v*t.vy,dy:du*t.uy+dv*t.vy});
      cuts.push(start,end);
    }
    for(let i=1;i<facets.length;i++)for(let j=0;j<i;j++){
      const a=facets[i],b=facets[j],cross=(b.y-a.y)/(a.dy-b.dy);
      if(cross>Math.max(a.start,b.start)&&cross<Math.min(a.end,b.end))cuts.push(cross);
    }
    cuts.sort((a,b)=>a-b);
    const pieces=[];
    for(let i=1;i<cuts.length;i++){
      const start=cuts[i-1],end=cuts[i],mid=(start+end)*.5;
      if(end-start<1e-7)continue;
      let height=-Infinity,face=null;
      for(const f of facets)if(mid>=f.start&&mid<=f.end&&f.y+mid*f.dy>height){
        face=f;height=f.y+mid*f.dy;
      }
      const previous=pieces.at(-1);
      if(previous&&previous.face===face)previous.end=end;
      else pieces.push({start,end,face});
    }
    return pieces;
  }
  return {heightAt,fitSeams,trianglesIn,edgeProfile,fingerprint};
}
