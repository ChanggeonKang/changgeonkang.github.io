import * as T from '../lib/three.module.min.js';

// These two stretches are covered in both directions by DNCv3UI and WNAIQBQ
// (November 2026). Stations run southeast along the engineering service street.
export function engineeringTreeSites(){
  const sites=[];
  function row(a,b,offset,stations,heights,hues){
    const length=Math.hypot(b[0]-a[0],b[1]-a[1]),dx=(b[0]-a[0])/length,dz=(b[1]-a[1])/length;
    stations.forEach((s,i)=>sites.push([a[0]+dx*s+dz*offset,a[1]+dz*s-dx*offset,
      heights[i%heights.length],hues[i%hues.length]]));
  }
  const a=[276.4,279.7],b=[307.8,326.8],c=[210.6,178.2],d=[243.5,228.8];
  row(a,b,-6.65,[6.3,13.9,21.2,29.2,37.5,45.2,52.6,59.1],[7.4,8.8,7.7,6.9],[0x997641,0x697c45,0x8a553f,0x879343]);
  row(a,b,6.45,[21,33.5,45.4],[5.1,5.7,5.0],[0x8a9047,0x6f8248]);
  row(c,d,-6.7,[-18,-10,0,9,18,28,39],[6.6,7.5,7.2],[0x899452,0x758144]);
  row(c,d,8.6,[-4,5,11.6,18,25.8,34],[5.8,6.5,5.5],[0x84904a,0x7b843f]);
  return sites;
}

function delineator(){
  const pos=[],norm=[],col=[],colour=new T.Color();
  // Thin flexible stem, foot flange, two silver sleeves and a red cap.
  for(const [bottom,upper,r0,r1,tint] of [
    [0,.048,.153,.147,0xb75b3f],[.048,.11,.106,.072,0xc85639],
    [.11,.34,.072,.061,0xd46343],[.34,.393,.061,.06,0xe4e1cc],
    [.393,.45,.060,.058,0xc85b42],[.45,.50,.058,.056,0xe4e1cf],
    [.50,.55,.056,.048,0xc6593f]]){
    const indexed=new T.CylinderGeometry(r1,r0,upper-bottom,10),g=indexed.toNonIndexed();
    const p=g.attributes.position,n=g.attributes.normal;
    colour.setHex(tint);
    for(let i=0;i<p.count;i++){
      pos.push(p.getX(i),p.getY(i)+(bottom+upper)/2,p.getZ(i));
      norm.push(n.getX(i),n.getY(i),n.getZ(i));col.push(colour.r,colour.g,colour.b);
    }
    indexed.dispose();g.dispose();
  }
  const g=new T.BufferGeometry();
  for(const [name,values] of [['position',pos],['normal',norm],['color',col]])g.setAttribute(name,new T.Float32BufferAttribute(values,3));
  g.computeBoundingSphere();return g;
}

export function engineeringDelineators(scene,W,ground){
  const road=W.explore.roads.find(r=>r.id===77338232),way=W.roadIndex.ways.get(road);
  if(!way)return;
  const posts=[];
  for(const s of way.segments){
    if(s.a[1]<160 || s.b[1]>338)continue;
    for(let u=Math.ceil((s.start+1)/4.7)*4.7-s.start;u<s.span-.2;u+=4.7){
      const x=s.a[0]+s.dx*u,z=s.a[1]+s.dz*u;
      if(s.ids.some((id,i)=>W.roadIndex.nodes.get(id).motor.size>2 && (i?s.span-u:u)<5.2))continue;
      if(W.explore.crossings.some(p=>Math.hypot(x-p[0],z-p[1])<3.8))continue;
      posts.push({x,z,y:ground(x,z),bendX:0,bendZ:0});
    }
  }
  const mesh=new T.InstancedMesh(delineator(),new T.MeshStandardMaterial({vertexColors:true,roughness:.76}),posts.length);
  mesh.name='Engineering street flexible lane dividers';mesh.castShadow=true;mesh.receiveShadow=true;
  const model=new T.Object3D();
  function set(i){
    const p=posts[i];
    model.position.set(p.x,p.y,p.z);model.rotation.set(p.bendZ,0,-p.bendX);model.updateMatrix();
    mesh.setMatrixAt(i,model.matrix);
  }
  for(let i=0;i<posts.length;i++)set(i);
  mesh.computeBoundingSphere();scene.add(mesh);
  let previous=0;
  return (t,kart)=>{
    const dt=Math.min(.12,Math.max(0,t-previous));previous=t;
    if(!kart||!dt)return;
    let changed=false;
    for(let i=0;i<posts.length;i++){
      const p=posts[i],dx=p.x-kart.x,dz=p.z-kart.z,dist=Math.hypot(dx,dz);
      let bx=0,bz=0;
      if(dist<1.30 && Math.abs(kart.body.y-p.y)<1.1){
        const vx=kart.vx*.06+dx,vz=kart.vz*.06+dz,n=Math.hypot(vx,vz)||1;
        const tilt=Math.min(1,(1.30-dist)*1.4)*1.05;bx=vx/n*tilt;bz=vz/n*tilt;
      }
      if(!bx&&!bz&&Math.abs(p.bendX)+Math.abs(p.bendZ)<.003)continue;
      const blend=1-Math.exp(-dt*(bx||bz?20:7));
      p.bendX+=(bx-p.bendX)*blend;p.bendZ+=(bz-p.bendZ)*blend;
      set(i);changed=true;
    }
    if(changed)mesh.instanceMatrix.needsUpdate=true;
  };
}
