import {BufferAttribute} from '../lib/three.module.min.js';
import {indexPavement} from './hump-pavement.js';

const width=1.5,cell=8,tolerance=.00035;

class Edges {
  grid=new Map();
  visit(x0,z0,x1,z1,fn){
    for(let j=Math.floor(z0/cell);j<=Math.floor(z1/cell);j++)
      for(let i=Math.floor(x0/cell);i<=Math.floor(x1/cell);i++)fn(i*16384+j);
  }
  add(ax,az,bx,bz,extra){
    const length=Math.hypot(bx-ax,bz-az);
    if(length<tolerance)return;
    const e={ax,az,bx,bz,dx:(bx-ax)/length,dz:(bz-az)/length,length,...extra};
    this.visit(Math.min(ax,bx)-tolerance,Math.min(az,bz)-tolerance,Math.max(ax,bx)+tolerance,Math.max(az,bz)+tolerance,key=>{
      if(!this.grid.has(key))this.grid.set(key,[]);
      this.grid.get(key).push(e);
    });
  }
  nearby(x0,z0,x1,z1){
    const found=new Set();
    this.visit(x0,z0,x1,z1,key=>{
      for(const e of this.grid.get(key)||[]){
        if(Math.min(e.ax,e.bx)<=x1&&Math.max(e.ax,e.bx)>=x0&&Math.min(e.az,e.bz)<=z1&&Math.max(e.az,e.bz)>=z0)found.add(e);
      }
    });
    return found;
  }
}

const along=(e,x,z)=>(x-e.ax)*e.dx+(z-e.az)*e.dz;
const across=(e,x,z)=>(x-e.ax)*e.dz-(z-e.az)*e.dx;

// Retain only the straight edges shared by an ordinary lot and a trimmed
// road triangle. Other nearby kerbs, medians, bridges and paths do not grade
// the asphalt. Coalesce the intervals from neighbouring triangles and fans.
function contacts(streets,flags){
  const ringEdges=new Edges(),hits=new Set();
  for(const lot of streets.userData.ordinaryLots)for(const ring of [lot.p,...lot.holes||[]]){
    for(let i=0;i<ring.length;i++)ringEdges.add(...ring[i],...ring[(i+1)%ring.length],{spans:[]});
  }
  const p=streets.geometry.attributes.position.array;
  for(let k=0;k<p.length;k+=9){
    if(flags[k/3]!==2)continue;
    const x0=Math.min(p[k],p[k+3],p[k+6])-tolerance,x1=Math.max(p[k],p[k+3],p[k+6])+tolerance;
    const z0=Math.min(p[k+2],p[k+5],p[k+8])-tolerance,z1=Math.max(p[k+2],p[k+5],p[k+8])+tolerance;
    for(const e of ringEdges.nearby(x0,z0,x1,z1))for(let j=0;j<3;j++){
      const a=k+3*j,b=k+3*((j+1)%3);
      if(Math.abs(across(e,p[a],p[a+2]))>tolerance || Math.abs(across(e,p[b],p[b+2]))>tolerance)continue;
      const u=along(e,p[a],p[a+2]),v=along(e,p[b],p[b+2]);
      const low=Math.max(0,Math.min(u,v)),high=Math.min(e.length,Math.max(u,v));
      if(high-low>tolerance){e.spans.push([low,high]);hits.add(e);}
    }
  }
  for(const e of hits){
    e.stops=e.spans.flat();
    e.spans.sort((a,b)=>a[0]-b[0]);const merged=[];
    for(const span of e.spans){
      const last=merged.at(-1);
      if(last&&span[0]<=last[1]+tolerance)last[1]=Math.max(last[1],span[1]);
      else merged.push(span);
    }
    e.spans=merged;
  }
  return hits;
}

// Store the lot's actual piecewise-linear edge, including each place where
// the parking tessellation changes slope inside a longer road edge.
function contactHeights(hits,lot,road){
  const edges=new Edges();
  for(const e of hits)for(const [low,high] of e.spans){
    const x0=e.ax+e.dx*low,z0=e.az+e.dz*low,x1=e.ax+e.dx*high,z1=e.az+e.dz*high;
    const stops=[low,high,...e.stops.filter(t=>t>low+tolerance&&t<high-tolerance)];
    for(const f of lot.trianglesIn(Math.min(x0,x1)-tolerance,Math.min(z0,z1)-tolerance,Math.max(x0,x1)+tolerance,Math.max(z0,z1)+tolerance)){
      for(const [x,z] of [[f.ax,f.az],[f.bx,f.bz],[f.cx,f.cz]]){
        const t=along(e,x,z);
        if(t>low+tolerance && t<high-tolerance && Math.abs(across(e,x,z))<tolerance)stops.push(t);
      }
    }
    stops.sort((a,b)=>a-b);let last;
    for(const t of stops){
      if(last&&t-last.t<tolerance)continue;
      const x=e.ax+t*e.dx,z=e.az+t*e.dz;
      const sample=index=>Math.max(index.heightAt(x,z),index.heightAt(x+e.dz*tolerance,z-e.dx*tolerance),
        index.heightAt(x-e.dz*tolerance,z+e.dx*tolerance));
      const y=sample(lot)-sample(road);
      if(last&&Number.isFinite(last.y)&&Number.isFinite(y))edges.add(last.x,last.z,x,z,{da:last.y,db:y});
      last={x,y,z,t};
    }
  }
  return edges;
}

function adjustment(x,z,edges){
  let nearest=width*width,offset=0;
  for(const e of edges){
    const t=Math.min(e.length,Math.max(0,along(e,x,z)));
    const rx=x-e.ax-e.dx*t,rz=z-e.az-e.dz*t,d2=rx*rx+rz*rz;
    if(d2<nearest){nearest=d2;offset=e.da+(e.db-e.da)*t/e.length;}
  }
  const t=1-Math.sqrt(nearest)/width;
  return offset*t*t*(3-2*t);
}

// Keep the road's own crossfall and blend just the measured height error.
// Refine a shared edge only if its original linear interpolation misses the
// transition curve; unchanged road triangles keep their existing vertices.
export function gradeParkingSeams(scene,bounds){
  const streets=scene.getObjectByName('Mapped campus streets and service lanes');
  const parking=scene.getObjectByName('campus-parking-asphalt');
  const g=streets?.geometry,flags=g?.attributes.parkingContact?.array;
  if(!flags)return;
  g.deleteAttribute('parkingContact');
  const hits=contacts(streets,flags);
  delete streets.userData.ordinaryLots;
  if(!parking||!hits.size)return;
  const seams=contactHeights(hits,indexPavement(bounds,[parking]),indexPavement(bounds,[streets]));
  const p=g.attributes.position.array,edits=[];
  let newCount=p.length/3;
  for(let k=0;k<p.length;k+=9){
    if(!flags[k/3])continue;
    const x=p[k],z=p[k+2],dx=p[k+3]-x,dz=p[k+5]-z,ex=p[k+6]-x,ez=p[k+8]-z;
    const edges=seams.nearby(Math.min(x,p[k+3],p[k+6])-width,Math.min(z,p[k+5],p[k+8])-width,
      Math.max(x,p[k+3],p[k+6])+width,Math.max(z,p[k+5],p[k+8])+width);
    if(!edges.size)continue;
    const dy=p[k+4]-p[k+1],ey=p[k+7]-p[k+1],vertices=[];
    let changed=false;
    function vertex(u,v){
      const px=x+u*dx+v*ex,pz=z+u*dz+v*ez,delta=adjustment(px,pz,edges);
      if(Math.abs(delta)>1e-7)changed=true;
      return {u,v,x:px,z:pz,y:p[k+1]+u*dy+v*ey+delta,delta};
    }
    function subdivide(a,b,c){
      const corners=[a,b,c];let chosen=0,longest=0,mid,refine=false;
      for(let i=0;i<3;i++){
        const s=corners[i],t=corners[(i+1)%3],length=(s.x-t.x)**2+(s.z-t.z)**2;
        if(length<=.40**2)continue;
        const m=vertex((s.u+t.u)/2,(s.v+t.v)/2);
        if(length>=3.5**2 || Math.abs(m.delta-(s.delta+t.delta)/2)>=.0018)refine=true;
        if(length>longest){chosen=i;longest=length;mid=m;}
      }
      if(!refine){vertices.push(a,b,c);return;}
      const s=corners[chosen],t=corners[(chosen+1)%3],w=corners[(chosen+2)%3];
      subdivide(s,mid,w);subdivide(mid,t,w);
    }
    subdivide(vertex(0,0),vertex(1,0),vertex(0,1));
    if(changed){edits.push({at:k/3,vertices});newCount+=vertices.length-3;}
  }
  if(!edits.length)return;
  for(const [name,attr] of Object.entries(g.attributes)){
    const src=attr.array,n=attr.itemSize,dst=new src.constructor(newCount*n);
    let next=0,write=0;
    for(const {at,vertices} of edits){
      dst.set(src.subarray(next*n,at*n),write);write+=(at-next)*n;
      for(const {u,v,y} of vertices)for(let c=0;c<n;c++){
        const i=at*n+c;
        dst[write++]=name==='position'&&c===1?y:src[i]+u*(src[i+n]-src[i])+v*(src[i+2*n]-src[i]);
      }
      next=at+3;
    }
    dst.set(src.subarray(next*n),write);g.setAttribute(name,new BufferAttribute(dst,n,attr.normalized));
  }
  g.boundingBox=null;g.boundingSphere=null;
}
