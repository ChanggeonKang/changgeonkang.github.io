import * as THREE from '../lib/three.module.min.js';

// KAIST International Scholar's Handbook, p. 57, W9 Outdoor Theater photo:
// https://indico.cern.ch/event/801577/attachments/1801881/3076941/KAISTHandbook.pdf#page=57
// The open seating follows the uphill side of OSM 78058716. The separate
// stage canopy footprint is 1527786067. Individual treads and roof ribs are estimates.
export function buildOutdoorTheater(scene,D,height,MB) {
  const theater=D.buildings.find(b=>b.id===78058716),stage=D.buildings.find(b=>b.id===1527786067);
  if(!theater || !stage)return null;
  const solid=new MB(),center=[-346,-104],angle=.795,ux=Math.cos(angle),uz=Math.sin(angle),vx=-uz,vz=ux;
  const p=(u,v,y)=>[center[0]+u*ux+v*vx,y,center[1]+u*uz+v*vz];
  const toLocal=([x,z])=>[(x-center[0])*ux+(z-center[1])*uz,(x-center[0])*vx+(z-center[1])*vz];
  const footprint=theater.p.map(toLocal),shade=c=>new THREE.Color(c);
  const stone=shade(0xb7ad99),face=shade(0x888374),wood=shade(0x897763),roof=shade(0xb6bcb1);
  const up=[0,1,0],uv=[0,0],quad=(a,b,c,d,n,color)=>solid.quad(a,b,c,d,n,uv,uv,uv,uv,color);
  const floor=height(...center)+.78;
  const ground=(u,v)=>{const q=p(u,v,0);return height(q[0],q[2]);};
  function bounds(u) {
    const cross=[];
    for(let i=0;i<footprint.length;i++){
      const a=footprint[i],b=footprint[(i+1)%footprint.length];
      if((a[0]>u)!==(b[0]>u))cross.push(a[1]+(u-a[0])*(b[1]-a[1])/(b[0]-a[0]));
    }
    return [Math.min(...cross),Math.max(...cross)];
  }
  const rows=18;
  function tread(u,row) {
    const [min,max]=bounds(u),front=Math.max(min+.4,16.4-.012*u*u);
    return front+(max-1.1-front)*row/rows;
  }
  for(let row=0;row<rows;row++)for(let col=0;col<46;col++){
    const l=-25+col*1.08,r=l+1.08;
    const l0=tread(l,row),l1=tread(l,row+1),r0=tread(r,row),r1=tread(r,row+1);
    if(![l0,l1,r0,r1].every(Number.isFinite) || Math.min(l1-l0,r1-r0)<.12)continue;
    const yl=Math.max(ground(l,l1)+.12,floor+.12+row*.46),yr=Math.max(ground(r,r1)+.12,floor+.12+row*.46);
    const a=p(l,l0,yl),b=p(r,r0,yr),c=p(r,r1,yr),d=p(l,l1,yl);
    quad(a,b,c,d,up,stone);
    quad(p(l,l0,yl-.70),p(r,r0,yr-.70),b,a,[-vx,0,-vz],face);
    // Dark rows separated by the pale stair aisles visible in the handbook.
    if(Math.abs(l)>1.0 && Math.abs(l-13)>1 && Math.abs(l+13)>1) {
      const u=l0+(l1-l0)*.58,v=r0+(r1-r0)*.58;
      quad(p(l,u,yl+.05),p(r,v,yr+.05),p(r,r1-.08,yr+.05),p(l,l1-.08,yl+.05),up,wood);
    }
  }
  const stageSurface=shade(0xb4a796),steel=shade(0x526572),rear=shade(0x8b968e);
  const frontRoof=9.4,backRoof=-5.0,halfU=10.6;
  quad(p(-12,-5.2,floor),p(12,-5.2,floor),p(12,11.4,floor),p(-12,11.4,floor),up,stageSurface);
  quad(p(-12,11.4,floor-.9),p(12,11.4,floor-.9),p(12,11.4,floor),p(-12,11.4,floor),[vx,0,vz],face);
  // A curved barrel canopy with a visible open mouth and slender frames.
  const arch=(u,t,lift=0)=>p(u,backRoof+(frontRoof-backRoof)*t,floor+4.65+2.85*Math.sin(Math.PI*t)+lift);
  for(let k=0;k<18;k++){
    const a=k/18,b=(k+1)/18;
    const slope=2.85*Math.PI*Math.cos(Math.PI*(a+b)/2)/(frontRoof-backRoof);
    const normal=new THREE.Vector3(-vx*slope,1,-vz*slope).normalize().toArray();
    quad(arch(-halfU,a),arch(halfU,a),arch(halfU,b),arch(-halfU,b),normal,roof);
    quad(arch(halfU,a,-.13),arch(-halfU,a,-.13),arch(-halfU,b,-.13),arch(halfU,b,-.13),normal.map(v=>-v),shade(0xa4a89f));
    for(const side of [-1,1]){
      const u=side*halfU;
      quad(arch(u,a,-.20),arch(u,b,-.20),arch(u,b),arch(u,a),[side*ux,0,side*uz],steel);
    }
  }
  quad(p(-8.6,backRoof+.5,floor),p(8.6,backRoof+.5,floor),p(8.6,backRoof+.5,floor+3.9),p(-8.6,backRoof+.5,floor+3.9),[vx,0,vz],rear);
  const mesh=new THREE.Mesh(solid.geo(),new THREE.MeshStandardMaterial({vertexColors:true,roughness:.78}));
  mesh.name='W9 hillside theater and covered stage';mesh.castShadow=mesh.receiveShadow=true;scene.add(mesh);
  const braces=[];
  for(const side of [-1,1])for(const [v,end] of [[backRoof,.15],[frontRoof,.85]]){
    braces.push([p(side*halfU*.98,v,floor),arch(side*halfU*.98,end,-.15)]);
    braces.push([p(side*halfU*.83,v,floor),arch(side*halfU*.98,end,-.15)]);
  }
  const posts=new THREE.InstancedMesh(new THREE.CylinderGeometry(.11,.13,1,7),new THREE.MeshStandardMaterial({color:0x425867,roughness:.66}),braces.length);
  const y=new THREE.Vector3(0,1,0);
  braces.forEach(([a,b],i)=>{
    const p=new THREE.Vector3(...a),q=new THREE.Vector3(...b),delta=q.clone().sub(p);
    posts.setMatrixAt(i,new THREE.Matrix4().compose(p.lerp(q,.5),new THREE.Quaternion().setFromUnitVectors(y,delta.clone().normalize()),new THREE.Vector3(1,delta.length(),1)));
  });
  posts.name='W9 stage canopy braces';posts.castShadow=true;scene.add(posts);
  return {ids:new Set([theater.id,stage.id]),label:{ref:'W9',name:'Outdoor Theater',x:center[0],z:center[1],y:floor+10.7}};
}
