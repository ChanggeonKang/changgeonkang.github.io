import {buildingProfile} from './campus-identity.js';

const TILE=24, key=(x,z)=>x*65536+z;
function inRing(x,z,ring){
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const a=ring[i],b=ring[j];
    if((a[1]>z)!==(b[1]>z) && x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  return inside;
}

/** Index the mapped building volumes once. A chase boom is at most a few
 * metres long, so only buildings in the cells directly behind the kart matter. */
export function createCameraClearance(buildings,grid,groundAt){
  const tiles=new Map();
  for(const b of buildings){
    if(b.p.length<3)continue;
    let x0=Infinity,x1=-Infinity,z0=Infinity,z1=-Infinity,low=Infinity,high=-Infinity;
    for(const [x,z] of b.p){
      const y=groundAt(x,z);
      x0=Math.min(x,x0);x1=Math.max(x,x1);z0=Math.min(z,z0);z1=Math.max(z,z1);
      low=Math.min(low,y);high=Math.max(high,y);
    }
    const mid=(low+high)/2,floor=b.t==='roof'?Math.max(2.6,b.minHeight||0):b.minHeight||0;
    const bottom=floor?mid+floor:low-1;
    const solid={b,x0,x1,z0,z1,bottom,top:Math.max(bottom+.28,mid+buildingProfile(b).height)};
    for(let i=Math.floor(x0/TILE);i<=Math.floor(x1/TILE);i++)for(let j=Math.floor(z0/TILE);j<=Math.floor(z1/TILE);j++){
      const k=key(i,j);
      if(!tiles.has(k))tiles.set(k,[]);
      tiles.get(k).push(solid);
    }
  }
  function blocked(x,y,z){
    const nearby=tiles.get(key(Math.floor(x/TILE),Math.floor(z/TILE)));
    if(!nearby)return false;
    const ix=Math.floor(x)-grid.x0,iz=Math.floor(z)-grid.z0;
    // The same openings are cut out of the visible facades and their shadows.
    if(ix>=0 && ix<grid.w && iz>=0 && iz<grid.h){
      const clearance=grid.portals[iz*grid.w+ix];
      if(clearance && y<clearance-48)return false;
    }
    for(const s of nearby){
      if(x<s.x0||x>s.x1||z<s.z0||z>s.z1||y<s.bottom||y>s.top)continue;
      if(inRing(x,z,s.b.p)&&!s.b.holes?.some(h=>inRing(x,z,h)))return true;
    }
    return false;
  }
  return function visibleFraction(origin,eye,lensRadius){
    const dx=eye.x-origin.x,dy=eye.y-origin.y,dz=eye.z-origin.z;
    const distance=Math.hypot(dx,dy,dz);
    if(distance<.01)return 1;
    const span=Math.hypot(dx,dz)||1;
    const sideX=lensRadius*dz/span,sideZ=-lensRadius*dx/span;
    const steps=Math.ceil(distance/.28);
    const touches=t=>{
      const x=origin.x+dx*t,y=origin.y+dy*t,z=origin.z+dz*t;
      return blocked(x,y,z)||blocked(x+sideX,y,z+sideZ)||blocked(x-sideX,y,z-sideZ)||
        blocked(x,y+lensRadius,z)||blocked(x,y-lensRadius,z);
    };
    for(let i=1;i<=steps;i++){
      if(!touches(i/steps))continue;
      let clear=(i-1)/steps,hit=i/steps;
      for(let j=0;j<5;j++){
        const mid=(clear+hit)/2;
        if(touches(mid))hit=mid;else clear=mid;
      }
      return Math.max(0,clear-.04/distance);
    }
    return 1;
  };
}
