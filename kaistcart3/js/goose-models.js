import * as T from '../lib/three.module.min.js';

// Closed cross-sections share vertices so the breast, neck and flights catch
// a continuous highlight even when the flock is close to the street camera.
function skin(rings) {
  const sides=rings[0].length, xyz=[], indices=[];
  for(const ring of rings)for(const p of ring)xyz.push(...p);
  for(let i=1;i<rings.length;i++)for(let j=0;j<sides;j++){
    const a=(i-1)*sides+j,b=(i-1)*sides+(j+1)%sides;
    indices.push(a,b,a+sides,b,b+sides,a+sides);
  }
  const end=(rings.length-1)*sides;
  for(let j=1;j<sides-1;j++)indices.push(0,j+1,j,end,end+j,end+j+1);
  const g=new T.BufferGeometry();
  g.setAttribute('position',new T.Float32BufferAttribute(xyz,3));g.setIndex(indices);g.computeVertexNormals();
  return g;
}

const crossSection=(count,point)=>Array.from({length:count},(_,i)=>point(2*Math.PI*i/count));
const oval=(x,y,z,rx,ry,rz,sides=8,rings=5)=>new T.SphereGeometry(1,sides,rings).scale(rx,ry,rz).translate(x,y,z);

function hull(rows,sides=14) {
  return skin(rows.map(([z,y,rx,ry])=>crossSection(sides,t=>[rx*Math.cos(t), y+ry*Math.sin(t), z])));
}

// A coloured body part uses one draw for the whole flock, including details
// such as the eyes, nostrils and overlapping primary feathers.
function join(parts,mirror=false) {
  const positions=[],normals=[],colors=[],indices=[],color=new T.Color();
  for(const [g,tint] of parts){
    color.setHex(tint);
    const p=g.attributes.position,n=g.attributes.normal,first=positions.length/3;
    for(let i=0;i<p.count;i++){
      positions.push(mirror?-p.getX(i):p.getX(i),p.getY(i),p.getZ(i));
      normals.push(mirror?-n.getX(i):n.getX(i),n.getY(i),n.getZ(i));
      colors.push(color.r,color.g,color.b);
    }
    for(let i=0;i<g.index.count;i+=3){
      const a=first+g.index.getX(i),b=first+g.index.getX(i+1),c=first+g.index.getX(i+2);
      if(mirror)indices.push(a,c,b);else indices.push(a,b,c);
    }
  }
  const result=new T.BufferGeometry();
  for(const [name,data] of [['position',positions],['normal',normals],['color',colors]])result.setAttribute(name,new T.Float32BufferAttribute(data,3));
  result.setIndex(indices);return result;
}

function neckGeometry() {
  const rows=[[-.04,-.018,.083],[.032,.005,.087],[.105,.027,.067],[.19,.034,.051],
    [.27,.02,.045],[.347,.008,.043],[.404,.016,.044],[.44,.044,.049]];
  return skin(rows.map(([y,z,r],i)=>{
    const a=rows[Math.max(0,i-1)],b=rows[Math.min(rows.length-1,i+1)];
    const dy=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dy,dz);
    return crossSection(12,t=>[Math.cos(t)*r,y+Math.sin(t)*r*dz/len,z-Math.sin(t)*r*dy/len]);
  }));
}

function wingParts() {
  const ribbon=rows=>skin(rows.map(([x,y,z,chord,depth])=>crossSection(10,t=>[x,y-Math.sin(t)*depth,z+Math.cos(t)*chord])));
  const parts=[[ribbon([[-.015,0,.022,.045,.022],[.06,.014,.020,.103,.039],[.16,.025,.012,.122,.041],
    [.28,.027,-.013,.117,.035],[.40,.018,-.041,.091,.025],[.51,.005,-.07,.051,.014],
    [.57,-.002,-.086,.007,.004]]),0xf1eee3]];
  for(let i=0;i<5;i++){
    const z=-.132+i*.035,len=.465+i*.034;
    parts.push([ribbon([[.215,.010,z+.049,.029,.010],[.32,.008,z+.024,.035,.014],
      [len-.067,.002,z-.018,.026,.010],[len,-.012,z-.060,.002,.002]]),[0xc3c0b7,0xd1cec3,0xdbd9cd,0xe6e2d7,0xefede4][i]]);
  }
  return parts;
}

function footGeometry() {
  // Three toe tips and the web between them, broad and flat at the front.
  const shape=new T.Shape();
  shape.moveTo(-.018,-.03);
  for(const [x,z] of [[-.041,.064],[-.028,.061],[0,.102],[.023,.064],[.043,.079],[.025,.03],[.018,-.018],[.011,-.033]])shape.lineTo(x,z);
  shape.closePath();
  const foot=new T.ExtrudeGeometry(shape,{depth:.011,bevelEnabled:false});
  // ExtrudeGeometry is non-indexed. Reuse triangle order when assembling.
  foot.setIndex(Array.from({length:foot.attributes.position.count},(_,i)=>i));
  foot.rotateX(Math.PI/2).translate(0,.015,.003);
  const shank=new T.CylinderGeometry(.014,.012,.153,8).rotateX(-.10).translate(0,.096,-.002);
  return join([[shank,0xdb852c],[foot,0xeb973c],[oval(0,.026,-.001,.021,.020,.025),0xe99435]]);
}

export function createGooseModels(scene,count) {
  const flock=new T.Group();flock.name='Duck Pond goose flock';flock.visible=false;scene.add(flock);
  const material=new T.MeshStandardMaterial({vertexColors:true,roughness:.86});
  const sphere=new T.Sphere();
  function batch(name,geometry,n=count){
    const mesh=new T.InstancedMesh(geometry,material,n);
    mesh.name='Goose '+name;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
    mesh.castShadow=mesh.receiveShadow=true;mesh.boundingSphere=sphere;flock.add(mesh);
    return mesh;
  }
  const body=batch('bodies',join([[hull([[-.481,.435,.010,.008],[-.39,.398,.088,.061],[-.29,.352,.150,.13],
    [-.14,.340,.194,.175],[.016,.341,.200,.185],[.16,.361,.164,.170],[.25,.392,.110,.130],[.277,.421,.047,.061]]),0xf6f3e9]]));
  const neck=batch('necks',join([[neckGeometry(),0xf9f6ed]]));
  const face=[[oval(0,.01,.022,.064,.067,.084,14,9),0xfbf8f0],
    [hull([[.067,-.004,.043,.030],[.093,-.008,.043,.027],[.132,-.016,.037,.023],[.168,-.021,.025,.013],[.181,-.021,.009,.006]],12),0xec8b2c],
    [oval(0,-.026,.131,.036,.007,.043),0xcf7728],[oval(0,-.020,.170,.017,.008,.013),0xffbd69]];
  for(const side of [-1,1])face.push([oval(side*.057,.019,.051,.009,.013,.013),0xe3bd8d],
    [oval(side*.063,.02,.052,.006,.009,.009),0x302d28],
    [oval(side*.035,.001,.117,.0035,.0028,.008),0x975826]);
  const head=batch('heads and bills',join(face));
  const wings=wingParts();
  const left=batch('left wings',join(wings,true)),right=batch('right wings',join(wings));
  const feet=batch('webbed feet',footGeometry(),count*2);

  const root=new T.Object3D(),part=new T.Object3D(),world=new T.Matrix4(),headAt=new T.Vector3();
  const tint=new T.Color();
  for(let i=0;i<count;i++){
    const shade=1-(i*7%11)*.006;tint.setRGB(shade,shade,shade);
    for(const mesh of [body,neck,head,left,right])mesh.setColorAt(i,tint);
  }
  function place(mesh,index,x,y,z,pitch=0,yaw=0,roll=0,span=1){
    part.position.set(x,y,z);part.rotation.set(pitch,yaw,roll,'YZX');part.scale.set(span,1,1);part.updateMatrix();
    world.multiplyMatrices(root.matrix,part.matrix);mesh.setMatrixAt(index,world);
  }
  const bounds=new T.Box3(),point=new T.Vector3();
  function update(birds){
    const n=Math.min(birds.length,count);
    bounds.makeEmpty();
    for(let i=0;i<n;i++){
      const {x,y,z,heading=0,stride=0,flight=0,flap=0,tilt=0,bank=0}=birds[i];
      bounds.expandByPoint(point.set(x,y,z));
      const size=.93+(i*17%13)*.009,walking=1-flight,gait=Math.sin(stride),lift=.012*gait*gait*walking;
      root.position.set(x,y+lift*size,z);root.rotation.set(-tilt,heading,-bank+gait*.027*walking,'YXZ');
      root.scale.setScalar(size);root.updateMatrix();body.setMatrixAt(i,root.matrix);
      const stretch=flight*1.08+.055*Math.sin(stride+.35)*walking;
      place(neck,i,0,.422,.186,stretch);
      headAt.set(0,.439,.044).applyQuaternion(part.quaternion);
      place(head,i,headAt.x,.422+headAt.y,.186+headAt.z,flight*.085+.033*gait*walking,.055*Math.sin(stride*.5+i)*walking);
      for(const side of [-1,1]){
        const phase=stride+(side<0?Math.PI:0);
        place(feet,2*i+(side+1)/2,side*.071,Math.max(0,Math.sin(phase))*.057*walking+flight*.103-lift,
          -.047+Math.cos(phase)*.081*walking-flight*.17,flight*.72);
        place(side<0?left:right,i,side*.141,.410,.080,walking*1.16,side*(walking*1.41+flight*.105),
          side*(walking*.035+flight*(.13+Math.sin(flap)*.86)),.72+.28*flight);
      }
    }
    for(const mesh of flock.children){mesh.count=mesh===feet?n*2:n;mesh.instanceMatrix.needsUpdate=true;}
    if(n){bounds.getBoundingSphere(sphere);sphere.radius+=1.5;}
    flock.visible=n>0;
  }
  return {group:flock,update};
}
