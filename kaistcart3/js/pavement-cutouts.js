import * as THREE from '../lib/three.module.min.js';
import {subtractPavementPolygon} from './paint-surface.js';

const cellSize=16;
function cells(x0,z0,x1,z1,visit){
  for(let x=Math.floor(x0/cellSize);x<=Math.floor(x1/cellSize);x++)
    for(let z=Math.floor(z0/cellSize);z<=Math.floor(z1/cellSize);z++)visit(x*16384+z);
}

export class PavementCutouts {
  grid=new Map();
  // Each mask is convex. addPolygon triangulates a surveyed outline with holes.
  add(ring){
    ring=ring.filter((p,i)=>{
      const q=ring[(i+ring.length-1)%ring.length];
      return Math.abs(p[0]-q[0])+Math.abs(p[1]-q[1])>1e-8;
    });
    if(ring.length<3)return;
    const x=ring.map(p=>p[0]),z=ring.map(p=>p[1]);
    const x0=Math.min(...x),z0=Math.min(...z),x1=Math.max(...x),z1=Math.max(...z);
    const area=ring.reduce((sum,a,i)=>{const b=ring[(i+1)%ring.length];return sum+a[0]*b[1]-b[0]*a[1];},0);
    if(Math.abs(area)<1e-7)return;
    const sign=Math.sign(area);
    const planes=ring.map(([ax,az],i)=>{
      const [bx,bz]=ring[(i+1)%ring.length],dx=sign*(bx-ax),dz=sign*(bz-az);
      return p=>dx*(p[1]-az)-dz*(p[0]-ax);
    });
    const mask={x0,z0,x1,z1,planes};
    cells(x0,z0,x1,z1,key=>{
      if(!this.grid.has(key))this.grid.set(key,[]);
      this.grid.get(key).push(mask);
    });
  }
  addPolygon(outer,holes=[]){
    const open=ring=>ring.length>1&&ring[0][0]===ring.at(-1)[0]&&ring[0][1]===ring.at(-1)[1]?ring.slice(0,-1):ring;
    outer=open(outer);holes=holes.map(open).filter(ring=>ring.length>=3);
    if(outer.length<3)return;
    const points=[...outer,...holes.flat()];
    const vectors=ring=>ring.map(([x,z])=>new THREE.Vector2(x,z));
    for(const indices of THREE.ShapeUtils.triangulateShape(vectors(outer),holes.map(vectors)))
      this.add(indices.map(i=>points[i]));
  }
  overlapping(x0,z0,x1,z1){
    let found;
    cells(x0,z0,x1,z1,key=>{
      for(const mask of this.grid.get(key)||[])
        if(x0<mask.x1&&mask.x0<x1&&z0<mask.z1&&mask.z0<z1)(found??=new Set()).add(mask);
    });
    return found;
  }
}

// Road batches store three full vertices per triangle. Keep untouched runs
// in-place in the same order, interpolating UVs and heights only at new edges.
export function trimPavementMesh(mesh,cutouts,accept){
  if(!mesh || !cutouts.grid.size)return;
  const g=mesh.geometry,pos=g.attributes.position.array,edits=[];
  let count=g.attributes.position.count;
  for(let k=0;k<pos.length;k+=9){
    const x=pos[k],z=pos[k+2],bx=pos[k+3],bz=pos[k+5],cx=pos[k+6],cz=pos[k+8];
    const masks=cutouts.overlapping(Math.min(x,bx,cx),Math.min(z,bz,cz),Math.max(x,bx,cx),Math.max(z,bz,cz));
    if(!masks)continue;
    if(accept&&!accept(g,k/3))continue;
    const original=[[x,z],[bx,bz],[cx,cz]],dx=bx-x,dz=bz-z,ex=cx-x,ez=cz-z,det=dx*ez-dz*ex;
    if(Math.abs(det)<1e-9)continue;
    let pieces=[original];
    for(const mask of masks){
      pieces=pieces.flatMap(p=>subtractPavementPolygon(p,mask.planes));
      if(!pieces.length)break;
    }
    if(pieces.length===1&&pieces[0]===original)continue;
    const vertices=[];
    for(const poly of pieces){
      for(let i=1;i+1<poly.length;i++)for(const p of [poly[0],poly[i],poly[i+1]]){
        const px=p[0]-x,pz=p[1]-z;
        vertices.push([(px*ez-pz*ex)/det,(dx*pz-dz*px)/det]);
      }
    }
    edits.push({at:k/3,vertices});count+=vertices.length-3;
  }
  if(!edits.length)return;
  for(const [name,attr] of Object.entries(g.attributes)){
    const src=attr.array,n=attr.itemSize,dst=new src.constructor(count*n);
    let start=0,write=0;
    for(const {at,vertices} of edits){
      dst.set(src.subarray(start*n,at*n),write);write+=(at-start)*n;
      for(const [u,v] of vertices)for(let c=0;c<n;c++){
        const i=at*n+c;
        dst[write++]=src[i]+u*(src[i+n]-src[i])+v*(src[i+2*n]-src[i]);
      }
      start=at+3;
    }
    dst.set(src.subarray(start*n),write);
    g.setAttribute(name,new THREE.BufferAttribute(dst,n,attr.normalized));
  }
  g.boundingBox=null;g.boundingSphere=null;
}
