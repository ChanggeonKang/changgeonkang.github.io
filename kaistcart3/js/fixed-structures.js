import {resolveWallContact} from './vehicle-physics.js';

// Clockwise plan of the rounded kart, in the same coordinates as its normal
// road-boundary probes. A thin pole can pass between two probes as the kart
// rotates, so use the closest point on each segment for these fixtures.
const outline=[[-.58,1.07],[0,1.08],[.58,1.07],[.73,.72],[.73,-.75],[.62,-1.05],
  [0,-1.05],[-.62,-1.05],[-.73,-.75],[-.73,.72]];
const cell=10,key=(x,z)=>Math.floor(x/cell)*16384+Math.floor(z/cell);

export function withFixedPosts(access,posts,ground){
  const bins=new Map();
  for(const post of posts){
    const radius=post.r+1.40;
    for(let i=Math.floor((post.x-radius)/cell);i<=Math.floor((post.x+radius)/cell);i++){
      for(let j=Math.floor((post.z-radius)/cell);j<=Math.floor((post.z+radius)/cell);j++){
        const id=i*16384+j;
        if(!bins.has(id))bins.set(id,[]);
        bins.get(id).push(post);
      }
    }
  }
  function postHit(x,z,th,level){
    const nearby=bins.get(key(x,z));
    if(!nearby)return null;
    const base=Number.isFinite(level)?level:ground(x,z,level),s=Math.sin(th),c=Math.cos(th);
    for(const p of nearby){
      if(base>p.top || base+1.3<p.base)continue;
      const wx=p.x-x,wz=p.z-z,px=c*wx-s*wz,pz=s*wx+c*wz;
      if(Math.abs(px)>.73+p.r || Math.abs(pz)>1.08+p.r)continue;
      let nearest=Infinity,hx=0,hz=0,inside=true;
      for(let i=0;i<outline.length;i++){
        const a=outline[i],b=outline[(i+1)%outline.length],u=b[0]-a[0],v=b[1]-a[1];
        const dx=px-a[0],dz=pz-a[1],t=Math.max(0,Math.min(1,(dx*u+dz*v)/(u*u+v*v)));
        if(u*dz-v*dx>0)inside=false;
        const ox=a[0]+t*u-px,oz=a[1]+t*v-pz,dsq=ox*ox+oz*oz;
        if(dsq<nearest){nearest=dsq;hx=ox;hz=oz;}
      }
      if(!inside && nearest>=p.r*p.r)continue;
      let d=Math.sqrt(nearest);
      if(d<.000001){hx=-px;hz=-pz;d=Math.hypot(hx,hz)||1;}
      const scale=(inside?-1:1)/d;
      const nx=(hx*c+hz*s)*scale,nz=(-hx*s+hz*c)*scale;
      return {nx,nz,point:[p.x+p.r*nx,p.z+p.r*nz]};
    }
    return null;
  }
  function isPost(x,z,level){
    const nearby=bins.get(key(x,z));
    if(!nearby)return false;
    const base=Number.isFinite(level)?level:ground(x,z,level);
    return nearby.some(p=>base<=p.top && base+1.3>=p.base && (p.x-x)**2+(p.z-z)**2<=p.r*p.r);
  }
  return {...access,isPost,postHit,
    isFree:(x,z,h)=>(access.isFree||access.isDrivable)(x,z,h) && !isPost(x,z,h),
    canPlace:(x,z,th,h)=>access.canPlace(x,z,th,h) && !postHit(x,z,th,h)};
}

export function resolvePost(body,previous,access,level,hit){
  const dx=body.x-previous.x,dz=body.z-previous.z;
  let lo=0,hi=1;
  if(access.canPlace(previous.x,previous.z,body.th,level)){
    for(let i=0;i<10;i++){
      const t=(lo+hi)*.5;
      if(access.canPlace(previous.x+dx*t,previous.z+dz*t,body.th,level))lo=t;else hi=t;
    }
  }else if(access.canPlace(previous.x,previous.z,previous.th,level))body.q=previous.q;
  body.x=previous.x+dx*lo;body.z=previous.z+dz*lo;
  return resolveWallContact(body,hit.nx,hit.nz,[hit.point],{friction:.08,restitution:.08});
}
