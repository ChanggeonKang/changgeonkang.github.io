import { Sphere, Vector3 } from '../lib/three.module.min.js';

function detailRange(name) {
  if (/tactile|bollard|parking-car-wheels|parking-car-trim|tire.stop|twig/i.test(name)) return 170;
  if (/kerbs|parking-markings|parking-car-glass|crosswalks, lane paint|understory|branch|shrub/i.test(name)) return 310;
  if (/parking-car-bodies|captured-roadside-solids|trunks|street.furniture/i.test(name)) return 500;
  if (/buildings-detail|architecture-detail/i.test(name)) return 720;
  return Infinity;
}

// Use the distance to the nearest possible geometry, including the radius of
// the entire batch: features at its close edge must remain visible. Distant
// buildings and tree canopies continue to contribute their full silhouettes.
export function trackSceneryDistance(scene) {
  scene.updateMatrixWorld(true);
  const entries=[], previous=new Vector3(Infinity,Infinity,Infinity);
  scene.traverse(mesh=>{
    if (!mesh.isMesh || !mesh.frustumCulled || !mesh.visible) return;
    const range=detailRange(mesh.name), casts=mesh.castShadow;
    if (!Number.isFinite(range) && !casts) return;
    if(mesh.isInstancedMesh && !mesh.boundingSphere)mesh.computeBoundingSphere();
    if(!mesh.geometry.boundingSphere)mesh.geometry.computeBoundingSphere();
    const local=mesh.boundingSphere || mesh.geometry.boundingSphere;
    if(!local || local.isEmpty())return;
    const bounds=new Sphere().copy(local).applyMatrix4(mesh.matrixWorld);
    entries.push({mesh,bounds,range,casts});
  });
  return position=>{
    if(previous.distanceToSquared(position)<100)return;
    previous.copy(position);
    for(const {mesh,bounds,range,casts} of entries){
      const squared=position.distanceToSquared(bounds.center);
      if(Number.isFinite(range))mesh.visible=squared<(range+bounds.radius)**2;
      if(casts)mesh.castShadow=squared<(205+bounds.radius)**2;
    }
  };
}
