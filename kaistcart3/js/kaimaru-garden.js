import * as T from '../lib/three.module.min.js';

// Low planting behind the bicycle row, as seen when looking north towards
// N11. Keep the stairs, the terrace and the hardstanding free of planting.
export function buildKaimaruGarden(scene,height,surfaceAt,random){
  const positions=[],colours=[];
  const blades=[0x53673d,0x465c33,0x728254,0x576c39,0x415635,0x838352].map(x=>new T.Color(x));
  const point=(x,y,z,c,light)=>{
    positions.push(x,y,z);colours.push(c.r*light,c.g*light,c.b*light);
  };
  for(let i=0;i<6500;i++){
    const x=-273+random()*52,z=-396+random()*7.2;
    if(Math.abs(x+249.1)<3.25 || surfaceAt(x,z)!==0 || z> -388.75-Math.max(0,x+232.7)*.081)continue;
    const y=height(x,z)+.015;
    const rise=.10+random()*.16+.04*Math.sin(x*1.9+z*.6), shade=blades[Math.floor(random()*blades.length)];
    for(let j=0;j<5;j++){
      const angle=random()*Math.PI*2,spread=.035+random()*.07;
      const dx=Math.sin(angle),dz=Math.cos(angle),w=.012+random()*.015;
      point(x-w*dz,y,z+w*dx,shade,.60);point(x+w*dz,y,z-w*dx,shade,.73);
      point(x+dx*spread,y+rise*(.65+random()*.6),z+dz*spread,shade,1.16);
    }
  }
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new T.Float32BufferAttribute(colours,3));
  const grass=new T.Mesh(geometry,new T.MeshBasicMaterial({vertexColors:true,side:T.DoubleSide}));
  grass.name='N11 garden understory';scene.add(grass);

  const tuft=new T.IcosahedronGeometry(1,2),verts=tuft.attributes.position;
  const rgb=[],vector=new T.Vector3();
  for(let i=0;i<verts.count;i++){
    vector.fromBufferAttribute(verts,i);
    const {x,y,z}=vector;
    const rough=1+.055*Math.sin(11*x+7*z)*Math.cos(9*y-4*z);
    verts.setXYZ(i,x*rough,y*rough,z*rough);
    const light=.56+.24*(y+1)+.10*Math.sin(22*x+10*z+5*y);
    rgb.push(light,light,.94*light);
  }
  tuft.setAttribute('color',new T.Float32BufferAttribute(rgb,3));tuft.computeVertexNormals();
  const beds=[[-259.5,-395.2,1.05],[-265.6,-395.4,1.18],[-233.4,-395.3,.95]];
  const topiary=new T.InstancedMesh(tuft,new T.MeshStandardMaterial({color:0x5c7349,vertexColors:true,roughness:1}),beds.length*5);
  const trunks=new T.InstancedMesh(new T.CylinderGeometry(.085,.14,1.63,7),new T.MeshStandardMaterial({color:0x675b4a}),beds.length);
  const model=new T.Object3D();let n=0;
  for(const [x,z,size] of beds){
    const ground=height(x,z);
    model.position.set(x,ground+.80,z);model.scale.set(1,1,1);model.updateMatrix();trunks.setMatrixAt(n/5,model.matrix);
    for(const [dx,dy,dz,sx,sy] of [[-.55,.88,.14,.72,.37],[.47,1.04,-.12,.76,.42],[-.28,1.47,-.13,.74,.47],[.20,1.79,.12,.71,.50],[0,2.10,0,.53,.42]]){
      model.position.set(x+dx*size,ground+dy*size,z+dz*size);
      model.scale.set(sx*size,sy*size,sx*.94*size);model.updateMatrix();topiary.setMatrixAt(n++,model.matrix);
    }
  }
  for(const m of [topiary,trunks]){m.name='N11 garden shrubs';m.castShadow=m.receiveShadow=true;scene.add(m);}
}
