// A wide asphalt quad spans the road crown. Its two rendered triangles can
// stand well above (or below) a fresh terrain sample taken between its ends.
// Keep only the pavement triangles in the immediate neighbourhood of a hump.
const CELL = 4;
export const APPROACH = 5;
const cellKey = (x,z) => x * 16384 + z;
const substrates = new Set(['Mapped campus streets and service lanes','Mapped walks, cycleways and steps',
  'Mapped trails and gravel paths','Campus terrain','Campus plazas and pedestrian squares','campus-parking-asphalt']);

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

export function indexHumpPavement(humps, meshes) {
  return indexPavement(humps.map(b=>({x:b.x,z:b.z,radius:Math.hypot(b.hw+APPROACH,b.length/2+APPROACH)})),meshes);
}

export function indexPavement(regions, meshes) {
  const cells = new Map();
  for (const b of regions) {
    const radius=b.radius;
    for(let i=Math.floor((b.x-radius)/CELL);i<=Math.floor((b.x+radius)/CELL);i++)
      for(let j=Math.floor((b.z-radius)/CELL);j<=Math.floor((b.z+radius)/CELL);j++)cells.set(cellKey(i,j),[]);
  }
  for(const mesh of meshes) {
    if(!substrates.has(mesh.name))continue;
    const pos=mesh.geometry.attributes.position, index=mesh.geometry.index?.array;
    for(let k=0,count=index?.length ?? pos.count;k<count;k+=3){
      const a=index?index[k]:k,b=index?index[k+1]:k+1,c=index?index[k+2]:k+2;
      const ax=pos.getX(a),az=pos.getZ(a),bx=pos.getX(b),bz=pos.getZ(b),cx=pos.getX(c),cz=pos.getZ(c);
      const x0=Math.floor(Math.min(ax,bx,cx)/CELL),x1=Math.floor(Math.max(ax,bx,cx)/CELL);
      const z0=Math.floor(Math.min(az,bz,cz)/CELL),z1=Math.floor(Math.max(az,bz,cz)/CELL);
      let plane;
      for(let i=x0;i<=x1;i++)for(let j=z0;j<=z1;j++){
        const bin=cells.get(cellKey(i,j));
        if(!bin)continue;
        if(!plane){
          const det=(bx-ax)*(cz-az)-(bz-az)*(cx-ax);
          if(Math.abs(det)<1e-10)continue;
          const ay=pos.getY(a);
          plane={ax,az,ay,bx,bz,cx,cz, ux:(cz-az)/det,uz:(ax-cx)/det,vx:(az-bz)/det,vz:(bx-ax)/det,
            uy:pos.getY(b)-ay,vy:pos.getY(c)-ay};
        }
        bin.push(plane);
      }
    }
  }
  function heightAt(x,z){
    let top=-Infinity;
    const triangles=cells.get(cellKey(Math.floor(x/CELL),Math.floor(z/CELL)));
    if(triangles)for(const t of triangles){
      const dx=x-t.ax,dz=z-t.az, u=t.ux*dx+t.uz*dz,v=t.vx*dx+t.vz*dz;
      if(u<-.000001 || v<-.000001 || u+v>1.000001)continue;
      const y=t.ay+t.uy*u+t.vy*v;
      if(y>top)top=y;
    }
    return top;
  }
  function fitSeams(b){
    const radius=Math.hypot(b.hw,b.length/2),triangles=new Set();
    for(let i=Math.floor((b.x-radius)/CELL);i<=Math.floor((b.x+radius)/CELL);i++)
      for(let j=Math.floor((b.z-radius)/CELL);j<=Math.floor((b.z+radius)/CELL);j++)
        for(const t of cells.get(cellKey(i,j)) || [])triangles.add(t);
    clearPavementSeams(b,triangles);
  }
  return {heightAt,fitSeams};
}
