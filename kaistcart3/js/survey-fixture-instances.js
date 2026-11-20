import * as T from '../lib/three.module.min.js';
const vertical=new T.Vector3(0,1,0);
const types={
  box:()=>new T.BoxGeometry(1,1,1),
  tube:()=>new T.CylinderGeometry(1,1,1,6),
  disk:()=>new T.CylinderGeometry(1,1,1,16),
  tyre:()=>new T.TorusGeometry(.325,.029,5,16),
  hoop:()=>new T.TorusGeometry(.267,.018,5,14),
};

export class FixtureInstances{
  constructor(){this.shapes=new Map();}
  item(type,matrix,colour){
    if(!this.shapes.has(type))this.shapes.set(type,[]);
    this.shapes.get(type).push([matrix,colour]);
  }
  box(at,w,h,d,yaw,color){
    const rot=new T.Quaternion().setFromAxisAngle(vertical,yaw);
    this.item('box',new T.Matrix4().compose(at,rot,new T.Vector3(w,h,d)),color);
  }
  rod(a,b,r,color){
    const dir=b.clone().sub(a),length=dir.length();
    const rot=new T.Quaternion().setFromUnitVectors(vertical,dir.normalize());
    this.item('tube',new T.Matrix4().compose(a.clone().lerp(b,.5),rot,new T.Vector3(r,length,r)),color);
  }
  circle(name,at,yaw,color){
    const q=new T.Quaternion().setFromAxisAngle(vertical,yaw);
    this.item(name,new T.Matrix4().compose(at,q,new T.Vector3(1,1,1)),color);
  }
  put(scene,label){
    for(const [type,items] of this.shapes){
      const mat=new T.MeshStandardMaterial({roughness:type==='tyre'?.94:.72,metalness:type==='tube'?.32:.11});
      const mesh=new T.InstancedMesh(types[type](),mat,items.length);
      mesh.name=label+' '+type;mesh.castShadow=true;mesh.receiveShadow=true;
      const colour=new T.Color();
      items.forEach(([m,c],i)=>{mesh.setMatrixAt(i,m);mesh.setColorAt(i,colour.setHex(c));});
      mesh.computeBoundingSphere();scene.add(mesh);
    }
  }
}
