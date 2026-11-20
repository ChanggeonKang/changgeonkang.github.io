// Static cars use their rendered positions and parking angles. Index the
// occupied bays once so ordinary roads incur just one spatial lookup.
const cellSize=12, hullReach=1.4;
const key=(x,z)=>Math.floor(x/cellSize)*16384+Math.floor(z/cellSize);

export function parkedCarIndex(cars,groundAt){
  const cells=new Map();
  for(const car of cars){
    const radius=2.5+hullReach;
    for(let x=Math.floor((car.x-radius)/cellSize);x<=Math.floor((car.x+radius)/cellSize);x++){
      for(let z=Math.floor((car.z-radius)/cellSize);z<=Math.floor((car.z+radius)/cellSize);z++){
        const k=x*16384+z;
        if(!cells.has(k))cells.set(k,[]);
        cells.get(k).push(car);
      }
    }
  }
  function occupied(x,z,level=Infinity){
    const nearby=cells.get(key(x,z));
    if(!nearby)return false;
    for(const car of nearby){
      const dx=x-car.x,dz=z-car.z;
      const width=Math.abs(car.u[0]*dx+car.u[1]*dz),length=Math.abs(car.v[0]*dx+car.v[1]*dz);
      if(width>.94 || length>2.19)continue;
      if(Math.hypot(Math.max(0,width-.78),Math.max(0,length-2.03))>.16)continue;
      const m=car.matrix,base=m[13]-(dx*m[4]+dz*m[6])/m[5];
      const kartBase=Number.isFinite(level)?level:groundAt(x,z,level);
      // The raised roof on estate cars reaches 1.754 m above the tyre plane.
      if(kartBase<=base+1.76 && kartBase>=base-1.30)return true;
    }
    return false;
  }
  return {occupied,near:(x,z)=>cells.has(key(x,z))};
}
