import {Color,ShapeUtils,Vector2} from '../lib/three.module.min.js';

const uv=[0,0],up=[0,1,0],down=[0,-1,0];
const plaster=new Color(0xa59e8e), floorStone=new Color(0x837e73), ceiling=new Color(0xbab5a7);
const frame=new Color(0x434b49), glazing=new Color(0x38545b), baseboard=new Color(0x6e7067);
function quad(batch,a,b,c,d,n,colour){batch.quad(a,b,c,d,n,uv,uv,uv,uv,colour);}
function tri(batch,a,b,c,n,colour){batch.tri(a,b,c,n,uv,uv,uv,colour);}
export function ringSign(p){
  return Math.sign(p.reduce((a,[x,z],i)=>{const q=p[(i+1)%p.length];return a+x*q[1]-z*q[0];},0)) || 1;
}
function contains(px,pz,ring){
  let hit=false;
  for(let k=0,j=ring.length-1;k<ring.length;j=k++){
    const q=ring[k],r=ring[j];
    if((q[1]>pz)!==(r[1]>pz) && px<(r[0]-q[0])*(pz-q[1])/(r[1]-q[1])+q[0])hit=!hit;
  }
  return hit;
}
function cell(grid,x,z){
  const i=Math.floor(x)-grid.x0,j=Math.floor(z)-grid.z0;
  return i>=0 && j>=0 && i<grid.w && j<grid.h ? grid.portals[i+j*grid.w] : 0;
}

// Ordinary mapped doors end at an opaque, recessed lobby. Only use a straight
// stretch with room on both sides of the tagged node and inside the footprint.
export function planDoorways(building,grid,hAt,top,pavementAt=hAt){
  const p=building.p, sign=ringSign(p), doors=[];
  if(!building.entrances || building.minHeight>0 || building.t==='roof')return doors;
  for(const [x,z,kind] of building.entrances){
    const i=p.findIndex(q=>q[0]===x && q[1]===z);
    if(i<0)continue;
    const a=p[(i+p.length-1)%p.length],b=p[(i+1)%p.length];
    const ax=x-a[0],az=z-a[1],bx=b[0]-x,bz=b[1]-z;
    const la=Math.hypot(ax,az),lb=Math.hypot(bx,bz),len=Math.hypot(b[0]-a[0],b[1]-a[1]);
    if(!len || ax*bx+az*bz<.998*la*lb)continue;
    const half=Math.min(kind==='main'?1.55:1.07,la-.14,lb-.14);
    if(half<.58)continue;
    const tx=(b[0]-a[0])/len,tz=(b[1]-a[1])/len,nx=sign*tz,nz=-sign*tx;
    const depth=kind==='main'?1.8:1.25,height=kind==='main'?2.85:2.45;
    if(doors.some(d=>Math.hypot(x-d.x,z-d.z)<half+d.half+.3))continue;
    const clear=[-half,0,half].every(u=>[.18,depth*.5,depth].every(v=>{
      const px=x+tx*u-nx*v,pz=z+tz*u-nz*v;
      return !cell(grid,px,pz) && contains(px,pz,p) && !building.holes?.some(h=>contains(px,pz,h));
    }));
    if(!clear || cell(grid,x,z))continue;
    const surface=(u,v)=>{
      const px=x+tx*u-nx*v,pz=z+tz*u-nz*v;
      const rendered=pavementAt(px,pz);
      return Number.isFinite(rendered)?rendered:hAt(px,pz);
    };
    let y=-Infinity,threshold=Infinity;
    for(let col=0;col<=8;col++)for(let row=0;row<=6;row++){
      const floor=surface(half*(col/4-1),depth*row/6);
      y=Math.max(y,floor+.045);
      if(!row)threshold=Math.min(threshold,floor+.02);
    }
    if(top>=y+height+.15)doors.push({x,z,y,threshold,surface,height,depth,half,tx,tz,nx,nz,vertex:i});
  }
  return doors;
}

export function buildVestibule(batch,d){
  const {x,z,y,height:h,half:w,depth,tx,tz,nx,nz}=d;
  const at=(u,v,back)=>[x+tx*u-nx*back,y+v,z+tz*u-nz*back];
  const across=(u,v,low,high,s,colour)=>quad(batch,at(u,low,s),at(v,low,s),at(v,high,s),at(u,high,s),[nx,0,nz],colour);
  const apron=Math.min(.55,depth*.45);
  // The sidewalk may climb sideways across the threshold. A short stone
  // apron follows that edge before joining the level interior floor.
  for(let i=0;i<8;i++)for(let j=0;j<2;j++){
    const point=(col,row)=>{
      const u=w*(col/4-1),v=apron*row/2;
      const height=Math.max(d.surface(u,v)+.024,d.y*row/2+(d.surface(u,0)+.03)*(1-row/2));
      return at(u,height-y,v);
    };
    quad(batch,point(i,j),point(i+1,j),point(i+1,j+1),point(i,j+1),up,floorStone);
  }
  quad(batch,at(-w,0,apron),at(w,0,apron),at(w,0,depth),at(-w,0,depth),up,floorStone);
  quad(batch,at(-w,h,0),at(w,h,0),at(w,h,depth),at(-w,h,depth),down,ceiling);
  for(const side of [-1,1]){
    const normal=[-tx*side,0,-tz*side];
    const jamb=(lo,hi,colour)=>quad(batch,at(w*side,lo,0),at(w*side,lo,depth),at(w*side,hi,depth),at(w*side,hi,0),normal,colour);
    jamb(d.threshold-y-.02,.16,baseboard);jamb(.16,h,plaster);
  }
  across(-w,w,0,h,depth,plaster);
  const jamb=Math.min(w*.80,.97),head=h-.28;
  across(-jamb,jamb,.035,head,depth-.015,frame);
  for(const side of [-1,1]){
    const left=side<0?-jamb+.06:.03,right=side<0?-.03:jamb-.06;
    across(left,right,.20,head-.10,depth-.03,glazing);
    across(left,right,.92,.967,depth-.04,baseboard);
  }
}

// Intersect a footprint triangle with one square of the *same* opening map
// used to cut the facade. This keeps courtyard corners, sloping passages and
// exits exact for both procedural buildings and the hand-built landmarks.
function clip(poly,axis,edge,sign){
  const out=[];
  for(let i=0;i<poly.length;i++){
    const a=poly[(i+poly.length-1)%poly.length],b=poly[i];
    const da=(a[axis]-edge)*sign,db=(b[axis]-edge)*sign;
    if((da>=0)!==(db>=0)){
      const t=da/(da-db);
      out.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);
    }
    if(db>=0)out.push(b);
  }
  return out;
}
export function lineArcades(batch,building,grid,hAt,top){
  if(building.minHeight>=2 || ['roof','carport','bridge'].includes(building.t))return;
  const p=building.p, holes=building.holes||[], points=[...p,...holes.flat()];
  const xs=p.map(q=>q[0]),zs=p.map(q=>q[1]);
  const x0=Math.max(grid.x0,Math.floor(Math.min(...xs))),x1=Math.min(grid.x0+grid.w-1,Math.floor(Math.max(...xs)));
  const z0=Math.max(grid.z0,Math.floor(Math.min(...zs))),z1=Math.min(grid.z0+grid.h-1,Math.floor(Math.max(...zs)));
  const active=[];
  for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++)if(cell(grid,x,z))active.push([x,z]);
  if(!active.length)return;
  const vec=q=>new Vector2(...q);
  const triangles=ShapeUtils.triangulateShape(p.map(vec),holes.map(r=>r.map(vec)));
  for(const t of triangles){
    const triangle=t.map(i=>points[i]),xs=triangle.map(q=>q[0]),zs=triangle.map(q=>q[1]);
    const l=Math.min(...xs),r=Math.max(...xs),n=Math.min(...zs),s=Math.max(...zs);
    for(const [x,z] of active){
      if(x>=r || x+1<=l || z>=s || z+1<=n)continue;
      const poly=clip(clip(clip(clip(triangle,0,x,1),0,x+1,-1),1,z,1),1,z+1,-1);
      if(poly.length<3)continue;
      const cap=Math.min(top-.03,cell(grid,x,z)-48),at=(q,y)=>[q[0],y,q[1]];
      for(let j=2;j<poly.length;j++)tri(batch,at(poly[0],cap),at(poly[j-1],cap),at(poly[j],cap),down,ceiling);
      for(let i=0;i<poly.length;i++){
        const a=poly[i],b=poly[(i+1)%poly.length];
        if(Math.hypot(a[0]-b[0],a[1]-b[1])<.0001)continue;
        const on=(axis,v)=>Math.abs(a[axis]-v)<1e-6 && Math.abs(b[axis]-v)<1e-6;
        let dx=0,dz=0;
        if(on(0,x))dx=-1;else if(on(0,x+1))dx=1;else if(on(1,z))dz=-1;else if(on(1,z+1))dz=1;else continue;
        const adjacent=cell(grid,x+dx,z+dz);
        // Another open cell is the same room, regardless of its building tag.
        // A change of ceiling elevation needs only a short vertical reveal.
        if(adjacent && adjacent-48>=cap)continue;
        const floorA=adjacent?adjacent-48:hAt(...a)-.16,floorB=adjacent?adjacent-48:hAt(...b)-.16;
        quad(batch,at(a,floorA),at(b,floorB),at(b,cap),at(a,cap),[-dx,0,-dz],plaster);
      }
    }
  }
}
