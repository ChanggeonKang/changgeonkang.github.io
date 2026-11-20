import * as THREE from '../lib/three.module.min.js';

// Trace the union of the actual driving areas. A driveway connected to a
// parking polygon or to another street has no edge at the join.
export function vehicleContours(grid) {
  const {d,w,h,x0,z0}=grid,stride=w+1,edges=new Map();
  function add(a,b){const next=edges.get(a);if(next)next.push(b);else edges.set(a,[b]);}
  for(let z=0;z<h;z++)for(let x=0;x<w;x++){
    const k=z*w+x;if(!d[k])continue;
    const a=z*stride+x;
    // An excerpt boundary can cut through a real road. Do not cap it with stone.
    if(z>0 && !d[k-w])add(a,a+1);
    if(x<w-1 && !d[k+1])add(a+1,a+stride+1);
    if(z<h-1 && !d[k+w])add(a+stride+1,a+stride);
    if(x>0 && !d[k-1])add(a+stride,a);
  }
  const contours=[];
  for(const [start] of edges){
    let k=start;const vertices=[];
    for(;;){
      vertices.push([x0+k%stride,z0+Math.floor(k/stride)]);
      const next=edges.get(k);if(!next)break;
      const to=next.pop();if(!next.length)edges.delete(k);
      k=to;
      if(k===start){vertices.push(vertices[0]);break;}
    }
    if(vertices.length<3)continue;
    const original=vertices.slice();
    for(let i=1;i<original.length-1;i++){
      const a=original[i-1],p=original[i],b=original[i+1];
      vertices[i]=[(a[0]+6*p[0]+b[0])/8,(a[1]+6*p[1]+b[1])/8];
    }
    // Remove the one-metre occupancy staircase while staying inside its
    // half-diagonal measurement precision. The game keeps the original mask.
    const keep=new Uint8Array(vertices.length), stack=[[0,vertices.length-1]];
    keep[0]=keep[vertices.length-1]=1;
    while(stack.length){
      const [l,r]=stack.pop(),a=vertices[l],b=vertices[r],dx=b[0]-a[0],dz=b[1]-a[1],den=dx*dx+dz*dz || 1;
      let best=.63*.63,index=-1;
      for(let i=l+1;i<r;i++){
        const x=vertices[i][0]-a[0],z=vertices[i][1]-a[1],t=Math.min(1,Math.max(0,(x*dx+z*dz)/den));
        const dist=(x-t*dx)**2+(z-t*dz)**2;
        if(dist>best){best=dist;index=i;}
      }
      if(index>=0){keep[index]=1;stack.push([l,index],[index,r]);}
    }
    contours.push(vertices.filter((_,i)=>keep[i]));
  }
  return contours;
}

export function buildAccessEdges(scene,W,surfaceAt,MB,flat) {
  const access=W.access, geometry=new MB(),up=[0,1,0],uv=[0,0],bounds=W.D.bounds;
  const shades=[0xb6b7ad,0xb9b9af,0xb3b3ab,0xaaaea8].map(x=>new THREE.Color(x));
  const front=new THREE.Color(0x9a9e98),tactile=new THREE.Color(0xdaa84f),tactileDot=new THREE.Color(0xe7bc66);
  const crossingEdges=[],roadIndex=W.roadIndex,gateData=W.explore.vehicleGates||[],posts=[],postBins=new Map(),arms=[],fixtures=[];
  const near=(a,x,z,r)=>(a[0]-x)**2+(a[1]-z)**2<r*r;
  const bin=(x,z,size)=>Math.floor(x/size)*65536+Math.floor(z/size);
  const carRoad=r=>r.drivable===true;
  const quad=(a,b,c,d,n,color)=>geometry.quad(a,b,c,d,n,uv,uv,uv,uv,color);
  const ground=(x,z)=>surfaceAt(x,z);
  const inBounds=(x,z)=>x>bounds.x0+1&&x<bounds.x1-1&&z>bounds.z0+1&&z<bounds.z1-1;
  const closeToSourceGate=(x,z,r)=>gateData.some(g=>near(g.p,x,z,r));
  const sourceKerbs=W.explore.kerbs || [];
  const flush=sourceKerbs.filter(k=>k.t==='flush'||k.t==='lowered').map(k=>k.p);
  const raised=sourceKerbs.filter(k=>k.t==='raised').map(k=>k.p);
  for(const [x,z] of W.D.crossings){
    const hit=roadIndex.nearest(x,z,7,carRoad);
    if(!hit || hit.distance>hit.s.road.width/2+1)continue;
    for(const side of [-1,1]){
      const o=side*hit.s.road.width/2,ex=hit.x+hit.s.dz*o,ez=hit.z-hit.s.dx*o;
      crossingEdges.push([ex,ez]);
      const nx=side*hit.s.dz,nz=-side*hit.s.dx,tx=hit.s.dx,tz=hit.s.dz;
      const point=(u,v,y)=>[ex+tx*u+nx*v,y,ez+tz*u+nz*v];
      const mid=point(0,.65,0);
      if(access.isDrivable(mid[0],mid[2]) || ![1,2].includes(W.G.d[(Math.floor(mid[2])-W.G.z0)*W.G.w+Math.floor(mid[0])-W.G.x0]))continue;
      const pp=(u,v,lift)=>{const p=point(u,v,0);p[1]=ground(p[0],p[2])+lift;return p;};
      quad(pp(-.85,.34,.024),pp(.85,.34,.024),pp(.85,.83,.024),pp(-.85,.83,.024),up,tactile);
      for(let row=0;row<2;row++)for(let col=-4;col<=4;col++){
        const u=col*.16,v=.46+row*.20,d=.025;
        quad(pp(u-d,v-d,.032),pp(u+d,v-d,.032),pp(u+d,v+d,.032),pp(u-d,v+d,.032),up,tactileDot);
      }
    }
  }

  const drops=new Map();
  for(const point of [...crossingEdges,...flush]){
    const id=bin(...point,8);if(!drops.has(id))drops.set(id,[]);
    drops.get(id).push(point);
  }
  const dropped=(x,z)=>{
    const id=bin(x,z,8);
    for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++){
      for(const p of drops.get(id+dx*65536+dz)||[])if(near(p,x,z,1.95))return true;
    }
    return false;
  };
  const allow=access.isDrivable.bind(access);
  const kerbTiles=new Map(),faces=[[0,1],[1,2],[2,3],[3,4]],vec=new THREE.Vector3();
  let kerbMetres=0, concretePieces=0;
  for(const line of vehicleContours(access.grid)){
    for(let i=1;i<line.length;i++){
      const a=line[i-1],b=line[i],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
      if(length<.2)continue;
      const n=Math.ceil(length/2.8),nx=dz/length,nz=-dx/length;
      for(let j=0;j<n;j++){
        const u=j/n,v=(j+1)/n,m=(u+v)/2,x=a[0]+dx*m,z=a[1]+dz*m;
        if(!inBounds(x,z) || closeToSourceGate(x,z,1.8))continue;
        // Do not draw a horizontal bar across a grade-separated street or
        // through a building wall. A real facade is its own boundary.
        const outsideX=x+nx*.85,outsideZ=z+nz*.85;
        const outside=(Math.floor(outsideZ)-W.G.z0)*W.G.w+Math.floor(outsideX)-W.G.x0;
        if(allow(outsideX,outsideZ) || W.G.d[outside]===9 || W.G.d[outside]===8)continue;
        const low=dropped(x,z) && !raised.some(p=>near(p,x,z,1.1)),h=low?.017:.14;
        const top=shades[(concretePieces++ + Math.floor((x+z)*.7))&3];
        const key=bin(x,z,160);
        if(!kerbTiles.has(key))kerbTiles.set(key,{p:[],n:[],c:[],index:[]});
        const tile=kerbTiles.get(key),first=tile.p.length/3;
        for(const f of [u,v]){
          const px=a[0]+dx*f,pz=a[1]+dz*f,y=ground(px-nx*.65,pz-nz*.65);
          for(const [off,raise,normal,vertical,col] of [[.015,-.08,-1,0,front],[.015,h-.018,-.9,.35,front],
                [.045,h,-.16,.99,top],[.245,h,.3,.95,top],[.245,-.18,1,0,front]]){
            tile.p.push(px+nx*off,y+raise,pz+nz*off);vec.set(nx*normal,vertical,nz*normal).normalize();
            tile.n.push(vec.x,vec.y,vec.z);tile.c.push(col.r,col.g,col.b);
          }
        }
        for(const [left,right] of faces)tile.index.push(first+left,first+5+right,first+right,first+left,first+5+left,first+5+right);
        kerbMetres+=length/n;
      }
    }
  }
  const kerbMat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.94});
  for(const tile of kerbTiles.values()){
    const g=new THREE.BufferGeometry();
    for(const [key,values] of [['position',tile.p],['normal',tile.n],['color',tile.c]])g.setAttribute(key,new THREE.Float32BufferAttribute(values,3));
    g.setIndex(tile.index);
    const mesh=new THREE.Mesh(g,kerbMat);mesh.name='Roadside kerbs and dropped pedestrian crossings';mesh.receiveShadow=true;scene.add(mesh);
  }
  if(geometry.p.length)flat(scene,geometry,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.94}),4).name='Tactile crossing pads';

  function post(x,z,kind=0){
    const id=bin(x,z,2);
    for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)for(const p of postBins.get(id+dx*65536+dz)||[])if(near(p,x,z,.67))return;
    if(!postBins.has(id))postBins.set(id,[]);
    postBins.get(id).push([x,z]);
    posts.push([x,ground(x,z),z,kind]);
  }
  for(const gate of gateData){
    if(!inBounds(...gate.p))continue;
    const [x,z]=gate.p,dr=roadIndex.nearest(x,z,8,r=>r.nodes?.includes(gate.id)),width=gate.width || dr?.s.road.width || 2.4;
    const angle=gate.heading??(dr?Math.atan2(dr.s.dx,dr.s.dz):0),nx=Math.cos(angle),nz=-Math.sin(angle);
    if(['gate','lift_gate','swing_gate','chain','cable_barrier'].includes(gate.t)){
      const offset=width/2+.16,ax=x+nx*offset,az=z+nz*offset;
      post(ax,az,2);
      arms.push({x:ax,z:az,y:ground(ax,az)+.79,nx,nz,width,raised:gate.passable,type:gate.t});
    }else if(['planter','barrier_board','cycle_barrier'].includes(gate.t)){
      fixtures.push({x,z,y:ground(x,z),nx,nz,type:gate.t});
    }else if(!gate.passable)post(x,z,1);
  }

  // At a mapped pedestrian entrance use posts beyond the carriageway. Test
  // both directions and the complete road/lot mask, keeping driveways open.
  const entrances=[];
  for(const [road,way] of roadIndex.ways){
    if(road.drivable || !['walk','cycle','steps','trail'].includes(road.roadClass))continue;
    for(const s of way.segments){
      const n=Math.ceil(s.span/1.3);
      let previous=allow(s.a[0],s.a[1]);
      for(let i=1;i<=n;i++){
        const f=i/n,x=s.a[0]+s.dx*s.span*f,z=s.a[1]+s.dz*s.span*f,inside=allow(x,z);
        if(inside===previous)continue;
        const sign=previous?1:-1;previous=inside;
        const along=Math.min(s.span,Math.max(0,(i-.5)*s.span/n+sign*1.05));
        const px=s.a[0]+s.dx*along,pz=s.a[1]+s.dz*along;
        if(!inBounds(px,pz)||allow(px,pz)||closeToSourceGate(px,pz,3)||entrances.some(p=>near(p,px,pz,2.6)))continue;
        const service=roadIndex.nearest(px,pz,10,carRoad);
        if(!service || Math.abs(service.s.dx*s.dx+service.s.dz*s.dz)>.82)continue;
        if(W.G.d[(Math.floor(pz)-W.G.z0)*W.G.w+Math.floor(px)-W.G.x0]!==1)continue;
        entrances.push([px,pz]);
        const span=Math.max(.8,Math.min(road.width-.40,4.8)),intervals=Math.max(1,Math.ceil(span/1.52));
        for(let j=0;j<=intervals;j++){
          const o=-span/2+span*j/intervals,ex=px+s.dz*o,ez=pz-s.dx*o;
          if(!allow(ex,ez))post(ex,ez);
        }
      }
    }
  }
  const transform=new THREE.Matrix4(),color=new THREE.Color(),position=new THREE.Vector3(),quat=new THREE.Quaternion(),scale=new THREE.Vector3();
  const material=new THREE.MeshStandardMaterial({roughness:.59,metalness:.36});
  for(const [radius,len,above,band] of [[.088,.72,.36,false],[.089,.08,.60,true],[.089,.035,.725,true]]){
    const mesh=new THREE.InstancedMesh(new THREE.CylinderGeometry(radius,radius,len,8),material,posts.length);
    mesh.name=band?'Reflective bollard bands':'Pedestrian access bollards';
    posts.forEach(([x,y,z,kind],i)=>{
      transform.makeTranslation(x,y+above,z);mesh.setMatrixAt(i,transform);
      const c=band?(kind===2?0xffded1:0xecc879):(kind===2?0xb1553f:kind===1?0x858982:0x565d5b);
      mesh.setColorAt(i,color.setHex(c));
    });
    mesh.castShadow=true;mesh.computeBoundingSphere();scene.add(mesh);
  }
  const pieces=[],upVec=new THREE.Vector3(0,1,0);
  const beam=(a,b,width,depth,c)=>{
    const dir=new THREE.Vector3(b[0]-a[0],b[1]-a[1],b[2]-a[2]),span=dir.length();
    if(span<.005)return;
    quat.setFromUnitVectors(upVec,dir.divideScalar(span));scale.set(width,span,depth);
    position.set((a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2);
    pieces.push([transform.compose(position,quat,scale).clone(),c]);
  };
  for(const {x,y,z,nx,nz,width,raised,type} of arms){
    const folding=raised && (type==='gate'||type==='swing_gate'),tilt=raised&&!folding?Math.PI*.46:0;
    const dx=folding?-nz:-nx*Math.cos(tilt),dz=folding?nx:-nz*Math.cos(tilt),dy=Math.sin(tilt);
    const line=(f,h)=>[x+dx*width*f,y+dy*width*f+h,z+dz*width*f];
    if(type==='lift_gate'){
      for(let j=0;j<6;j++)beam(line(j/6,0),line((j+1)/6,0),.09,.10,j%2?0xe9e5d3:0xb5594a);
    }else if(type==='gate'||type==='swing_gate'){
      beam(line(0,.14),line(1,.14),.065,.065,0x777c73);
      beam(line(0,-.35),line(1,-.35),.06,.06,0x777c73);
      const bars=Math.max(3,Math.ceil(width/.55));
      for(let j=0;j<=bars;j++)beam(line(j/bars,-.35),line(j/bars,.14),.032,.032,0x7f857d);
    }else{
      for(let j=0;j<8;j++)beam(line(j/8,-.25*Math.sin(j*Math.PI/8)),line((j+1)/8,-.25*Math.sin((j+1)*Math.PI/8)),.035,.035,0x706e60);
    }
  }
  for(const {x,y,z,nx,nz,type} of fixtures){
    const point=(o,h,along=0)=>[x+nx*o-nz*along,y+h,z+nz*o+nx*along];
    if(type==='planter'){
      beam(point(0,.04),point(0,.53),.86,.86,0x999486);
      beam(point(0,.52),point(0,1.10),.73,.77,0x69794c);
    }else if(type==='barrier_board'){
      for(const side of [-1,1])beam(point(side*.46,0),point(side*.46,.83),.042,.052,0x717779);
      beam(point(-.55,.68),point(.55,.68),.28,.08,0xc9844d);
    }else{
      for(const side of [-1,1])beam(point(side*.48,0),point(side*.48,.83),.055,.055,0x929999);
      beam(point(-.48,.83),point(.48,.83),.055,.055,0x929999);
    }
  }
  const arm=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),material,pieces.length);
  pieces.forEach(([matrix,c],i)=>{arm.setMatrixAt(i,matrix);arm.setColorAt(i,color.setHex(c));});
  arm.name='Mapped vehicle gates';arm.castShadow=true;arm.computeBoundingSphere();scene.add(arm);
  return {curbMetres:Math.round(kerbMetres),pedestrianEntrances:entrances.length,bollards:posts.length,gateArms:arms.length};
}
