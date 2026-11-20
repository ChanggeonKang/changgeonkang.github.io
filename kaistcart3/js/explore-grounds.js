import * as THREE from '../lib/three.module.min.js';

// Only draw regulation markings when a mapped rectangle has a plausible
// aspect for one playing field. The OSM outline controls position and heading.
export function buildExploreGrounds(scene, data, height, MB, flat, textures) {
  const courts=new MB(), paving=new MB(), paint=new MB(), up=[0,1,0];
  const tint=hex=>new THREE.Color(hex), white=tint(0xe7e5d5), plaza=tint(0xc6b9a6);
  const sports={tennis:0x668b72,badminton:0x738f77,basketball:0xb07962,soccer:0x6f995e,futsal:0x759a73,baseball:0x82965b};
  const coords=p=>[p[0]/1.6,p[2]/1.6], midpoint=(a,b)=>[(a[0]+b[0])/2,(a[1]+b[1])/2];
  const at=(p,h)=>[p[0],height(...p)+h,p[1]];
  function triangle(a,b,c,batch,color,h) {
    const p=[a,b,c], edges=p.map((v,i)=>Math.hypot(v[0]-p[(i+1)%3][0],v[1]-p[(i+1)%3][1]));
    const longest=Math.max(...edges),i=edges.indexOf(longest);
    if(longest>8){
      const x=p[i],y=p[(i+1)%3],z=p[(i+2)%3],m=midpoint(x,y);
      triangle(x,m,z,batch,color,h);triangle(m,y,z,batch,color,h);return;
    }
    const A=at(a,h),B=at(b,h),C=at(c,h);
    batch.tri(A,B,C,up,coords(A),coords(B),coords(C),color);
  }
  function stripe(a,b) {
    const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
    if(length<.02)return;
    const nx=dz/length*.065,nz=-dx/length*.065,n=Math.ceil(length/4);
    for(let j=0;j<n;j++){
      const x=a[0]+dx*j/n,z=a[1]+dz*j/n,x1=a[0]+dx*(j+1)/n,z1=a[1]+dz*(j+1)/n;
      const vertices=[[x+nx,z+nz],[x-nx,z-nz],[x1-nx,z1-nz],[x1+nx,z1+nz]].map(p=>at(p,.097));
      paint.quad(...vertices,up,...vertices.map(coords),white);
    }
  }
  for(const area of data.areas) {
    const isPlaza=area.k==='plaza';
    if(!isPlaza && area.k!=='pitch')continue;
    const p=area.p,holes=area.holes || [];
    // The photographed western five-court complex already has bespoke paint and nets.
    if(!isPlaza && p.length===4 && p.every(([x,z])=>x>-500 && x< -423 && z> -345 && z< -317))continue;
    const points=[...p,...holes.flat()],color=isPlaza?plaza:tint(sports[area.sport]||0x819365);
    for(const [i,j,k] of THREE.ShapeUtils.triangulateShape(p.map(q=>new THREE.Vector2(...q)),holes.map(r=>r.map(q=>new THREE.Vector2(...q))))) {
      triangle(points[i],points[j],points[k],isPlaza?paving:courts,color,isPlaza?.115:.075);
    }
    if(!sports[area.sport] || p.length!==4 || holes.length)continue;
    const lengths=p.map((q,i)=>Math.hypot(q[0]-p[(i+1)%4][0],q[1]-p[(i+1)%4][1]));
    const k=lengths[0]>lengths[1]?0:1, length=lengths[k],width=lengths[(k+1)%4];
    if(width<4 || length/width<1.15 || length/width>3.2)continue;
    if((area.sport==='tennis' || area.sport==='badminton') && (width>19 || length>42))continue;
    const corner=[0,1,2,3].map(i=>p[(k+i)%4]);
    const uv=(u,v)=>[0,1].map(i=>(1-v)*(corner[0][i]*(1-u)+corner[1][i]*u)+v*(corner[3][i]*(1-u)+corner[2][i]*u));
    const mark=(u,v,u1,v1)=>stripe(uv(u,v),uv(u1,v1)), lo=.045,hi=.955;
    mark(lo,lo,hi,lo);mark(hi,lo,hi,hi);mark(hi,hi,lo,hi);mark(lo,hi,lo,lo);
    mark(.5,lo,.5,hi);
    if(area.sport==='tennis' || area.sport==='badminton'){
      mark(lo,.15,hi,.15);mark(lo,.85,hi,.85);mark(.24,.15,.24,.85);mark(.76,.15,.76,.85);mark(.24,.5,.76,.5);
    }else if(['soccer','futsal','basketball'].includes(area.sport)){
      const radius=Math.min(width*.17,length*.085);
      for(let i=0;i<32;i++){
        const a=i*Math.PI/16,b=(i+1)*Math.PI/16;
        mark(.5+Math.cos(a)*radius/length,.5+Math.sin(a)*radius/width,.5+Math.cos(b)*radius/length,.5+Math.sin(b)*radius/width);
      }
      for(const end of [false,true]){
        const x=end?hi:lo,x1=end?.80:.20;
        mark(x,.27,x1,.27);mark(x1,.27,x1,.73);mark(x1,.73,x,.73);
      }
    }
  }
  for(const [batch,name,map] of [[courts,'Campus playing fields',textures.asphalt],[paving,'Campus plazas and pedestrian squares',textures.paver],[paint,'Field and court markings',null]]){
    if(!batch.p.length)continue;
    flat(scene,batch,new THREE.MeshStandardMaterial({map,vertexColors:true,roughness:.95}),map?1:4).name=name;
  }
}
