import * as THREE from '../lib/three.module.min.js';

// Subtract the part inside a set of half-planes. Work in the original lawn
// triangle's barycentric coordinates so surviving soil keeps its exact slope,
// vertex colours and shading, including at the edge of a narrow footpath.
function subtract(poly,planes){
  const outside=[];
  let inside=poly;
  for(const [a,du,dv] of planes){
    const next=[],remainder=[];
    for(let i=0;i<inside.length;i++){
      const p=inside[i],q=inside[(i+1)%inside.length];
      const dp=a+du*p[0]+dv*p[1],dq=a+du*q[0]+dv*q[1];
      (dp>=0?next:remainder).push(p);
      if((dp>0 && dq<0)||(dp<0 && dq>0)){
        const t=dp/(dp-dq),v=[p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t];
        next.push(v);remainder.push(v);
      }else if(dp===0 && dq<0)remainder.push(p);
      else if(dp<0 && dq===0)remainder.push(q);
    }
    if(next.length<3)return null;
    if(remainder.length>=3)outside.push(remainder);
    inside=next;
  }
  let twiceArea=0;
  for(let i=0;i<inside.length;i++){
    const p=inside[i],q=inside[(i+1)%inside.length];
    twiceArea+=p[0]*q[1]-q[0]*p[1];
  }
  return Math.abs(twiceArea)>1e-10?outside:null;
}

function cell(axis,x){
  let lo=0,hi=axis.length-1;
  while(hi-lo>1){const mid=(lo+hi)>>>1;if(axis[mid]<=x)lo=mid;else hi=mid;}
  return lo;
}

function hasSoilArea(poly){
  let twiceArea=0,perimeter=0;
  for(let k=0;k<poly.length;k++){
    const p=poly[k],q=poly[(k+1)%poly.length];
    twiceArea+=p[0]*q[1]-p[1]*q[0];
    perimeter+=Math.hypot(q[0]-p[0],q[1]-p[1]);
  }
  // The broadest grid cell is five metres. Ignore sub-millimetre slivers
  // created by finite precision along an edge shared by two paving meshes.
  return twiceArea>perimeter*.00002;
}

// Probe the final clipped lawn on either side of a candidate cut edge.
// Internal triangulation edges and hairline cracks between two paved faces
// have no exposed soil bank.
function lawnCovers(tiles,columns,bounds,tileSize,x,z){
  if(x<bounds.x0 || x>=bounds.x1 || z<bounds.z0 || z>=bounds.z1)return false;
  const tile=tiles[Math.floor((z-bounds.z0)/tileSize)*columns+Math.floor((x-bounds.x0)/tileSize)];
  const xs=tile.grid.x,zs=tile.grid.z,col=cell(xs,x),row=cell(zs,z);
  const rx=(x-xs[col])/(xs[col+1]-xs[col]),rz=(z-zs[row])/(zs[row+1]-zs[row]);
  const half=rx+rz>1,polys=tile.faces.get((row*tile.nx+col)*2+Number(half));
  if(!polys)return true;
  const u=half?1-rx:rz,v=half?rx+rz-1:rx;
  return polys.some(poly=>poly.every((p,k)=>{
    const q=poly[(k+1)%poly.length];
    return (q[0]-p[0])*(v-p[1])-(q[1]-p[1])*(u-p[0])>=-1e-12;
  }));
}

// Road strips and the five-metre terrain grid have different diagonals.
// Where a ridge reaches the top of a paved face, trim only their projected
// overlap. Keep the lawn everywhere else, including underneath elevated decks.
export function cutTerrainUnderPavement(scene,bounds,tileSize){
  const surfaceNames=new Set(['Mapped campus streets and service lanes','West campus block-paved motor lane',
    'Sejong Hall paved driveway and forecourt','Mapped walks, cycleways and steps','Mapped trails and gravel paths',
    'Campus plazas and pedestrian squares','Campus playing fields','campus-parking-asphalt']);
  const columns=Math.ceil((bounds.x1-bounds.x0)/tileSize),tiles=[];
  for(const mesh of scene.children){
    const grid=mesh.userData.terrainAxes;
    if(!grid)continue;
    const i=Math.round((grid.x[0]-bounds.x0)/tileSize),j=Math.round((grid.z[0]-bounds.z0)/tileSize);
    tiles[j*columns+i]={mesh,grid,nx:grid.x.length-1,pos:mesh.geometry.attributes.position.array,faces:new Map(),floor:new Map()};
    delete mesh.userData.terrainAxes;
  }
  const initial=[[0,0],[1,0],[0,1]],margin=.035;
  for(const surface of scene.children){
    if(!surfaceNames.has(surface.name))continue;
    const geometry=surface.geometry,p=geometry.attributes.position.array,idx=geometry.index?.array;
    for(let k=0,n=idx?.length??p.length/3;k<n;k+=3){
      const a=idx?idx[k]*3:k*3,b=idx?idx[k+1]*3:a+3,c=idx?idx[k+2]*3:a+6;
      const x=p[a],z=p[a+2],dx1=p[b]-x,dz1=p[b+2]-z,dx2=p[c]-x,dz2=p[c+2]-z;
      const det=dx1*dz2-dx2*dz1;
      if(Math.abs(det)<1e-9)continue;
      const sign=Math.sign(det),dy1=p[b+1]-p[a+1],dy2=p[c+1]-p[a+1];
      const gx=(dy1*dz2-dy2*dz1)/det,gz=(dx1*dy2-dx2*dy1)/det;
      const xmin=Math.min(x,p[b],p[c]),xmax=Math.max(x,p[b],p[c]);
      const zmin=Math.min(z,p[b+2],p[c+2]),zmax=Math.max(z,p[b+2],p[c+2]);
      const left=Math.max(0,Math.floor((xmin-bounds.x0)/tileSize)),right=Math.min(columns-1,Math.floor((xmax-bounds.x0)/tileSize));
      const top=Math.max(0,Math.floor((zmin-bounds.z0)/tileSize)),bottom=Math.min(Math.ceil(tiles.length/columns)-1,Math.floor((zmax-bounds.z0)/tileSize));
      for(let j=top;j<=bottom;j++)for(let i=left;i<=right;i++){
        const tile=tiles[j*columns+i],{grid,nx,pos,faces}=tile;
        const col0=cell(grid.x,xmin),col1=cell(grid.x,xmax),row0=cell(grid.z,zmin),row1=cell(grid.z,zmax);
        for(let row=row0;row<=row1;row++)for(let col=col0;col<=col1;col++)for(let half=0;half<2;half++){
          const id=(row*nx+col)*2+half,v0=(row*(nx+1)+col)*3,step=(nx+1)*3;
          const s=half?v0+3:v0,t=v0+step,u=half?v0+step+3:v0+3;
          const d0=pos[s+1]-p[a+1]-gx*(pos[s]-x)-gz*(pos[s+2]-z)+margin;
          const d1=pos[t+1]-p[a+1]-gx*(pos[t]-x)-gz*(pos[t+2]-z)+margin;
          const d2=pos[u+1]-p[a+1]-gx*(pos[u]-x)-gz*(pos[u+2]-z)+margin;
          if(Math.max(d0,d1,d2)<=0)continue;
          let pieces=faces.get(id);if(pieces && !pieces.length)continue;
          const planes=[[d0,d1-d0,d2-d0]];
          for(const [from,to] of [[a,b],[b,c],[c,a]]){
            const px=p[from],pz=p[from+2],lx=p[to]-px,lz=p[to+2]-pz;
            const first=sign*(lx*(pos[s+2]-pz)-lz*(pos[s]-px));
            planes.push([first,sign*(lx*(pos[t+2]-pos[s+2])-lz*(pos[t]-pos[s])),
              sign*(lx*(pos[u+2]-pos[s+2])-lz*(pos[u]-pos[s]))]);
          }
          const updated=[];let changed=false;
          for(const piece of pieces||[initial]){
            const rest=subtract(piece,planes);
            if(rest){updated.push(...rest);changed=true;}else updated.push(piece);
          }
          if(changed){
            faces.set(id,updated);
            tile.floor.set(id,Math.min(tile.floor.get(id)??Infinity,p[a+1]-.06,p[b+1]-.06,p[c+1]-.06));
          }
        }
      }
    }
  }
  for(const tile of tiles)for(const [id,polys] of tile.faces)tile.faces.set(id,polys.filter(hasSoilArea));
  for(const tile of tiles){
    if(!tile.faces.size)continue;
    const g=tile.mesh.geometry,attrs=Object.entries(g.attributes),orig=g.index.array,indices=[];
    const values=Object.fromEntries(attrs.map(([key,attr])=>[key,Array.from(attr.array)]));
    for(let i=0;i<orig.length;i+=3){
      const pieces=tile.faces.get(i/3),a=orig[i],b=orig[i+1],c=orig[i+2];
      if(!pieces){indices.push(a,b,c);continue;}
      for(const poly of pieces){
        const start=values.position.length/3;
        for(const [u,v] of poly)for(const [key,attr] of attrs){
          const source=attr.array,n=attr.itemSize;
          for(let d=0;d<n;d++)values[key].push(source[a*n+d]*(1-u-v)+source[b*n+d]*u+source[c*n+d]*v);
        }
        for(let j=1;j+1<poly.length;j++)indices.push(start,start+j,start+j+1);
        // The road can be a metre below the hillside. Close exposed cut
        // edges down to the actual pavement so a low camera sees earth.
        for(let j=0;j<poly.length;j++){
          const s=start+j,t=start+(j+1)%poly.length,verts=values.position;
          const dx=verts[t*3]-verts[s*3],dz=verts[t*3+2]-verts[s*3+2],len=Math.hypot(dx,dz);
          const floor=tile.floor.get(i/3);
          if(len<.001 || Math.max(verts[s*3+1],verts[t*3+1])<=floor)continue;
          const mx=(verts[t*3]+verts[s*3])/2,mz=(verts[t*3+2]+verts[s*3+2])/2;
          const ox=-dz*.0005/len,oz=dx*.0005/len;
          if(!lawnCovers(tiles,columns,bounds,tileSize,mx-ox,mz-oz) ||
              lawnCovers(tiles,columns,bounds,tileSize,mx+ox,mz+oz))continue;
          const side=verts.length/3;
          for(const [v,lower] of [[s,false],[s,true],[t,false],[t,true]]){
            verts.push(verts[v*3],lower?Math.min(verts[v*3+1],floor):verts[v*3+1],verts[v*3+2]);
            values.normal.push(-dz/len,0,dx/len);
            values.color.push(values.color[v*3]*.91,values.color[v*3+1]*.79,values.color[v*3+2]*.66);
            values.bankExposure.push(values.bankExposure[v]);
          }
          indices.push(side,side+1,side+2,side+2,side+1,side+3);
        }
      }
    }
    for(const [key,attr] of attrs)g.setAttribute(key,new THREE.Float32BufferAttribute(values[key],attr.itemSize));
    g.setIndex(indices);
  }
}
