import * as THREE from '../lib/three.module.min.js';

// Campus-wide batches save draw calls but submit every cherry blossom, even
// when a driver is facing another neighbourhood. Give static clusters local
// bounds so Three's main camera and shadow camera can cull them separately.
export function partitionCampusBatches(scene, animatedTreeLods) {
  const packed=new Set(animatedTreeLods.flatMap(lod=>[lod.near,lod.far]));
  const cell=(x,z)=>Math.floor(x/300)*4096+Math.floor(z/300);
  const matrix=new THREE.Matrix4(),colour=new THREE.Color(),point=new THREE.Vector3(), meshes=[];
  scene.traverse(m=>{if(m.isMesh && !packed.has(m))meshes.push(m);});
  const attach=(source,copy)=>{
    copy.name=source.name;
    copy.position.copy(source.position);copy.quaternion.copy(source.quaternion);copy.scale.copy(source.scale);
    copy.layers.mask=source.layers.mask;copy.castShadow=source.castShadow;copy.receiveShadow=source.receiveShadow;
    copy.customDepthMaterial=source.customDepthMaterial;copy.renderOrder=source.renderOrder;
    source.parent.add(copy);
  };
  for(const m of meshes) {
    const geo=m.geometry, pos=geo.attributes.position, count=geo.index?.count||pos.count;
    if (m.isInstancedMesh) {
      if(m.count<18 || count*m.count<100000)continue;
      const blocks=new Map();
      for(let i=0;i<m.count;i++){
        m.getMatrixAt(i,matrix);
        const id=cell(matrix.elements[12],matrix.elements[14]);
        if(!blocks.has(id))blocks.set(id,[]);
        blocks.get(id).push(i);
      }
      if(blocks.size<2)continue;
      for(const items of blocks.values()){
        const chunk=new THREE.InstancedMesh(geo,m.material,items.length);
        for(let i=0;i<items.length;i++){
          m.getMatrixAt(items[i],matrix);chunk.setMatrixAt(i,matrix);
          if(m.instanceColor){m.getColorAt(items[i],colour);chunk.setColorAt(i,colour);}
        }
        chunk.computeBoundingSphere();attach(m,chunk);
      }
      m.removeFromParent();m.dispose();
    } else {
      if(count<150000 || geo.groups.length || Array.isArray(m.material) || m.material.transparent)continue;
      geo.computeBoundingBox();
      const bbox=geo.boundingBox;
      if(Math.max(bbox.max.x-bbox.min.x,bbox.max.z-bbox.min.z)<320)continue;
      const blocks=new Map(), index=geo.index?.array;
      for(let i=0;i<count;i+=3){
        const a=index?index[i]:i,b=index?index[i+1]:i+1,c=index?index[i+2]:i+2;
        const id=cell((pos.getX(a)+pos.getX(b)+pos.getX(c))/3,(pos.getZ(a)+pos.getZ(b)+pos.getZ(c))/3);
        if(!blocks.has(id))blocks.set(id,{indices:[],bounds:new THREE.Box3()});
        const block=blocks.get(id);block.indices.push(a,b,c);
        for(const v of [a,b,c])block.bounds.expandByPoint(point.fromBufferAttribute(pos,v));
      }
      if(blocks.size<2)continue;
      for(const {indices,bounds} of blocks.values()){
        const piece=new THREE.BufferGeometry();
        for(const [name,attribute] of Object.entries(geo.attributes))piece.setAttribute(name,attribute);
        piece.setIndex(indices);piece.boundingBox=bounds;piece.boundingSphere=bounds.getBoundingSphere(new THREE.Sphere());
        attach(m,new THREE.Mesh(piece,m.material));
      }
      m.removeFromParent();
    }
  }
}
