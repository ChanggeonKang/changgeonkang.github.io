import {BufferGeometry,Color,Float32BufferAttribute,InstancedMesh,Vector3} from '../lib/three.module.min.js';

// At 40 m a wheel covers about four pixels on the small drawing buffer.
// Keep its original radius, width and metal hub, and omit the five spokes.
function distantWheel(){
  const p=[],n=[],c=[],indices=[],tread=new Color(0x282b2d),rim=new Color(0x454a4c),hub=new Color(0x919899);
  function vertex(x,y,z,nx,ny,nz,colour){
    const index=p.length/3;
    p.push(x,y,z);n.push(nx,ny,nz);c.push(colour.r,colour.g,colour.b);
    return index;
  }
  const sides=8;
  for(let i=0;i<sides;i++){
    const angle=i*2*Math.PI/sides,dy=Math.cos(angle),dz=Math.sin(angle);
    vertex(-.097,.32*dy,.32*dz,0,dy,dz,tread);
    vertex(.097,.32*dy,.32*dz,0,dy,dz,tread);
  }
  for(let i=0;i<sides;i++){
    const a=2*i,b=2*((i+1)%sides);
    indices.push(a,b,b+1,a,b+1,a+1);
  }
  for(const side of [-1,1]){
    const x=side*.0985,centre=vertex(x,0,0,side,0,0,hub),first=p.length/3;
    for(let i=0;i<sides;i++){
      const a=i*2*Math.PI/sides;
      vertex(x,.32*Math.cos(a),.32*Math.sin(a),side,0,0,rim);
    }
    for(let i=0;i<sides;i++){
      const a=first+i,b=first+(i+1)%sides;
      if(side>0)indices.push(centre,a,b);else indices.push(centre,b,a);
    }
  }
  const mesh=new BufferGeometry();
  mesh.setAttribute('position',new Float32BufferAttribute(p,3));mesh.setAttribute('normal',new Float32BufferAttribute(n,3));
  mesh.setAttribute('color',new Float32BufferAttribute(c,3));mesh.setIndex(indices);mesh.computeBoundingSphere();
  return mesh;
}

export function mobileParkingDisplay(scene,parking){
  const body=parking.models.find(m=>m.name==='parking-car-bodies');
  const glass=parking.models.find(m=>m.name==='parking-car-glass');
  const trim=parking.models.find(m=>m.name==='parking-car-trim');
  const wheels=parking.models.find(m=>m.name==='parking-car-wheels');
  if(!body||!glass||!trim||!wheels)return;
  // The collision index uses all placements. Packing these instance buffers
  // controls only which vehicles and wheel spokes reach the mobile renderer.
  const matrices=body.instanceMatrix.array.slice(),wheelMatrices=wheels.instanceMatrix.array.slice(),colours=body.instanceColor.array.slice();
  const simple=new InstancedMesh(distantWheel(),wheels.material,wheels.count);
  simple.name='Distant parked wheels';simple.receiveShadow=true;simple.castShadow=true;scene.add(simple);
  for(const m of [body,glass,trim,wheels,simple]){m.userData.cameraPacked=true;m.frustumCulled=false;}
  const previous=new Vector3(Infinity,Infinity,Infinity);
  let lastHeading=0,lastFov=0;
  return (position,heading,halfFov)=>{
    if(previous.distanceToSquared(position)<16 && Math.cos(heading-lastHeading)>.999 && Math.abs(halfFov-lastFov)<.018)return;
    previous.copy(position);lastHeading=heading;lastFov=halfFov;
    const cut=Math.cos(halfFov+.26),tx=Math.sin(heading),tz=Math.cos(heading);
    let cars=0,nearWheels=0,farWheels=0,trimCount=0;
    for(let i=0;i<parking.cars.length;i++){
      const dx=parking.cars[i].x-position.x,dz=parking.cars[i].z-position.z,d2=dx*dx+dz*dz;
      if(d2>555*555 || d2>62*62 && dx*tx+dz*tz<cut*Math.sqrt(d2))continue;
      const at=i*16,offset=cars*16,keepTrim=d2<165*165;
      for(let j=0;j<16;j++){
        const value=matrices[at+j];
        body.instanceMatrix.array[offset+j]=value;glass.instanceMatrix.array[offset+j]=value;
        if(keepTrim)trim.instanceMatrix.array[trimCount*16+j]=value;
      }
      if(keepTrim)trimCount++;
      for(let j=0;j<3;j++)body.instanceColor.array[cars*3+j]=colours[i*3+j];
      cars++;
      const specific=d2<39*39,wheel=specific?wheels:simple;
      const wheelOffset=(specific?nearWheels:farWheels)*16;
      for(let j=0;j<64;j++)wheel.instanceMatrix.array[wheelOffset+j]=wheelMatrices[i*64+j];
      if(specific)nearWheels+=4;else farWheels+=4;
    }
    body.count=glass.count=cars;trim.count=trimCount;wheels.count=nearWheels;simple.count=farWheels;
    for(const mesh of [body,glass,trim,wheels,simple])mesh.instanceMatrix.needsUpdate=true;
    body.instanceColor.needsUpdate=true;
  };
}
