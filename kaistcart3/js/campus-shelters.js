import * as T from '../lib/three.module.min.js';
import {FixtureInstances} from './survey-fixture-instances.js';

// Some picnic shelters are tagged both building=yes and amenity=shelter.
// A mapped footprint describes their roof rather than a multi-storey facade.
// Eaves, seats and cladding are estimates where a street view is obscured.
const screened=new Set([1526678771,1526678772,1528041913,1527898785]);
export function buildCampusShelters(scene,buildings,skip,terrain,roads){
  const frames=new FixtureInstances(),pos=[],rgb=[],shade=new T.Color(),models=[];
  function tri(a,b,c,colour){
    shade.setHex(colour);
    for(const p of [a,b,c]){pos.push(...p);rgb.push(shade.r,shade.g,shade.b);}
  }
  function quad(a,b,c,d,colour){tri(a,b,c,colour);tri(a,c,d,colour);}
  for(const b of buildings){
    if(!b.shelterType||skip.has(b.id))continue;
    const ring=b.p,cx=ring.reduce((sum,p)=>sum+p[0]/ring.length,0),cz=ring.reduce((sum,p)=>sum+p[1]/ring.length,0);
    const soil=terrain(cx,cz),low=soil+Math.min(b.hh-.46,2.60),peak=soil+b.hh;
    const sheltered=screened.has(b.id)||b.shelterType==='shelter';
    const apron=ring.map(([x,z])=>[.88*x+.12*cx,.88*z+.12*cz]);
    const pt=(p,h)=>[p[0],h,p[1]];
    const road=roads.nearest(cx,cz,40,r=>r.drivable);
    let exit=0,maxSide=0,far=Infinity,axis=0;
    for(let i=0;i<ring.length;i++){
      const p=ring[i],q=ring[(i+1)%ring.length],len=Math.hypot(q[0]-p[0],q[1]-p[1]);
      if(len>maxSide){maxSide=len;axis=i;}
      if(road){const distance=Math.hypot((p[0]+q[0])*.5-road.x,(p[1]+q[1])*.5-road.z);
        if(distance<far){exit=i;far=distance;}}
    }
    const apex=[cx,peak,cz];
    for(let i=0;i<ring.length;i++){
      const p=ring[i],q=ring[(i+1)%ring.length],a=apron[i],c=apron[(i+1)%ring.length];
      const dx=c[0]-a[0],dz=c[1]-a[1],len=Math.hypot(dx,dz),yaw=Math.atan2(-dz,dx);
      const at=(t,y)=>new T.Vector3(a[0]+dx*t,y,a[1]+dz*t);
      if(len<.12)continue;
      tri(pt(p,low+.09),pt(q,low+.09),apex,sheltered?0x716e63:0x656c61);
      quad(pt(p,low),pt(q,low),pt(q,low+.09),pt(p,low+.09),0x55594f);
      const share=(s,t)=>[p[0]+(cx-p[0])*t+(q[0]-p[0])*s*(1-t),
        low+.09+(peak-low-.09)*t+.012,p[1]+(cz-p[1])*t+(q[1]-p[1])*s*(1-t)];
      for(let k=.57;k<len;k+=.65)
        quad(share(k/len,0),share((k+.042)/len,0),share((k+.042)/len,.84),share(k/len,.84),0x757a70);
      const base=terrain(...a)-.10;
      if(ring.length<=6||i%2===0)frames.box(at(0,(base+low)/2),.115,low-base,.115,yaw,0x4e483b);
      if(len>.8)frames.box(at(.5,low-.085),len,.15,.095,yaw,0x645a47);
      if(sheltered && i!==exit&&(i===(exit+1)%ring.length||i===(exit+2)%ring.length)){
        // Lattice panels leave the road-facing side and the entrance open.
        for(let t=.14;t<len-.06;t+=.21){
          const xy=at(t/len,0),bottom=terrain(xy.x,xy.z)+.24,top=low-.27;
          if(top>bottom)frames.box(at(t/len,(bottom+top)/2),.147,top-bottom,.063,yaw,0x79664d);
        }
      }
    }
    const p=apron[axis],q=apron[(axis+1)%ring.length],dx=q[0]-p[0],dz=q[1]-p[1];
    const L=Math.max(.1,Math.hypot(dx,dz)),yaw=Math.atan2(-dz,dx),length=Math.min(2.35,L*.62);
    if(length>.62){
      const bx=cx*.49+(p[0]+q[0])*.255,bz=cz*.49+(p[1]+q[1])*.255,seat=terrain(bx,bz)+.45;
      frames.box(new T.Vector3(bx,seat,bz),length,.09,.34,yaw,0x8b775c);
      for(const sign of [-1,1]){
        const u=sign*length*.35,x=bx+u*dx/L,z=bz+u*dz/L,ground=terrain(x,z)-.04;
        frames.box(new T.Vector3(x,(ground+seat)/2,z),.09,seat-ground,.26,yaw,0x50564b);
      }
    }
    models.push({id:b.id,x:cx,z:cz,top:peak});
  }
  if(pos.length){
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));
    g.setAttribute('color',new T.Float32BufferAttribute(rgb,3));g.computeVertexNormals();g.computeBoundingSphere();
    const mesh=new T.Mesh(g,new T.MeshStandardMaterial({vertexColors:true,side:T.DoubleSide,roughness:.88}));
    mesh.name='Mapped campus shelters';mesh.userData.shelters=models;mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);
  }
  frames.put(scene,'Campus shelter posts, lattice and seats');
}
