import {BufferGeometry,BufferAttribute,Float32BufferAttribute} from '../lib/three.module.min.js';
import {hashNumbers} from './hump-pavement.js';

const batches=new Set(['Crosswalks, lane paint and step nosings','campus-parking-markings','Street furniture · approach paint']);
const batchNames=[...batches];
function paintSignature(meshes,hash){
  for(const mesh of meshes){
    const g=mesh.geometry;
    hash=hashNumbers(hash,g.attributes.position.array,1000);
    if(g.attributes.color)hash=hashNumbers(hash,g.attributes.color.array,65535);
    if(g.index)hash=hashNumbers(hash,g.index.array);
  }
  return hash;
}
export async function loadBakedPaint(){
  try{
    const response=await fetch(new URL('../data/road-paint.bin.gz?v=campus-survey-20261121-ground',import.meta.url));
    if(!response.ok)return null;
    const raw=await response.arrayBuffer(),bytes=new Uint8Array(raw);
    if(bytes[0]!==31 || bytes[1]!==139)return raw;
    return await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  }catch{return null;}
}
function restorePaint(data,meshes,signature){
  // Each batch stores a colour palette, shared XYZ vertices (plus an
  // optional palette index) and triangle indices, in 32-bit words.
  if(!data || data.byteLength%4 || data.byteLength<16)return false;
  const words=new Uint32Array(data),floats=new Float32Array(data);
  if(words[0]!==0x31544e50 || words[1]!==2 || words[2]!==signature || words[3]!==meshes.length)return false;
  let offset=4;
  const replacements=[];
  for(let n=0;n<meshes.length;n++){
    const id=words[offset++],count=words[offset++],indices=words[offset++],palette=words[offset++];
    const mesh=meshes.find(m=>m.name===batchNames[id]),end=offset+palette*3+count*(palette?4:3)+indices;
    if(!mesh || !count || !indices || indices%3 || end>words.length)return false;
    const colours=floats.subarray(offset,offset+palette*3);
    offset+=colours.length;
    const pos=new Float32Array(count*3),normal=new Float32Array(count*3),rgb=palette?new Float32Array(count*3):null;
    for(let i=0;i<count;i++){
      const at=i*3;
      pos[at]=floats[offset++];pos[at+1]=floats[offset++];pos[at+2]=floats[offset++];normal[at+1]=1;
      if(rgb){const c=words[offset++]*3;rgb[at]=colours[c];rgb[at+1]=colours[c+1];rgb[at+2]=colours[c+2];}
    }
    const geometry=new BufferGeometry();
    geometry.setAttribute('position',new BufferAttribute(pos,3));
    geometry.setAttribute('normal',new BufferAttribute(normal,3));
    if(rgb)geometry.setAttribute('color',new BufferAttribute(rgb,3));
    geometry.setIndex(new BufferAttribute(words.subarray(offset,end),1));offset=end;
    replacements.push([mesh,geometry]);
  }
  if(offset!==words.length)return false;
  for(const [mesh,g] of replacements){mesh.geometry.dispose();mesh.geometry=g;}
  return true;
}
const overlap=(a,b)=>a.x1>b.x0 && b.x1>a.x0 && a.z1>b.z0 && b.z1>a.z0;
function area(polygon){
  const a=polygon[0];
  let sum=0;
  for(let i=2;i<polygon.length;i++){
    const b=polygon[i-1],c=polygon[i];
    sum+=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  }
  return Math.abs(sum); // twice the projected area
}
function bounds(points){
  const x=points.map(p=>p[0]),z=points.map(p=>p[1]);
  return {x0:Math.min(...x),x1:Math.max(...x),z0:Math.min(...z),z1:Math.max(...z)};
}

// The inequalities of the original pavement triangle in barycentric coordinates.
function borders(face){
  const du=p=>(p[0]-face.ax)*face.ux+(p[1]-face.az)*face.uz;
  const dv=p=>(p[0]-face.ax)*face.vx+(p[1]-face.az)*face.vz;
  return [du,dv,p=>1-du(p)-dv(p)];
}
function clip(polygon,distance,sign=1){
  const kept=[];
  for(let i=0;i<polygon.length;i++){
    const a=polygon[i],b=polygon[(i+1)%polygon.length],da=sign*distance(a),db=sign*distance(b);
    if(da>=0)kept.push(a);
    if(da*db<0){const t=da/(da-db);kept.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}
  }
  return kept;
}
function intersection(polygon,planes){
  for(const plane of planes){
    polygon=clip(polygon,plane);
    if(polygon.length<3)return [];
  }
  return polygon;
}
// Subtract only the actual overlap. Splitting along the extended edge of an
// unrelated facet otherwise creates thousands of needless sliver triangles.
function subtract(polygon,planes){
  const covered=intersection(polygon,planes);
  if(covered.length<3 || area(covered)<1e-9)return [polygon];
  if(area(polygon)-area(covered)<1e-9)return [];
  const outside=[];
  for(const plane of planes){
    const part=clip(polygon,plane,-1);
    if(part.length>=3 && area(part)>1e-9)outside.push(part);
    polygon=clip(polygon,plane);
  }
  return outside;
}
export {intersection as intersectPavementPolygon,subtract as subtractPavementPolygon};

// A kerb or overlapping road fan can produce a real step in the pavement.
// End a decal at each visible facet instead of stretching across that step.
function visibleFacets(polygon,faces,ceiling,approximate){
  const layers=[];
  for(const face of faces){
    const planes=borders(face),gx=face.ux*face.uy+face.vx*face.vy,gz=face.uz*face.uy+face.vz*face.vy;
    const height=p=>face.ay+gx*(p[0]-face.ax)+gz*(p[1]-face.az);
    if(Number.isFinite(ceiling))planes.push(p=>ceiling-height(p));
    const points=intersection(polygon,planes);
    if(points.length>=3 && area(points)>1e-9)layers.push({planes,height,points,box:bounds(points),paintable:face.paintable});
  }
  // Most three-metre paint strips are on a single grade. Preserve their
  // original triangle when every higher facet is within two millimetres of
  // its plane and those facets cover the whole marking.
  const close=[];
  let smooth=true;
  for(const layer of layers){
    const differences=layer.points.map(p=>layer.height(p)-approximate(p));
    if(Math.max(...differences)>.002){smooth=false;break;}
    if(layer.paintable && Math.min(...differences)>=-.002)close.push(layer);
  }
  if(smooth){
    let remainder=[polygon];
    for(const layer of close){
      remainder=remainder.flatMap(p=>subtract(p,layer.planes));
      if(!remainder.length)return [{points:polygon,height:approximate}];
    }
  }
  const visible=[];
  for(let i=0;i<layers.length;i++){
    const a=layers[i];let pieces=[a.points];
    if(!a.paintable)continue;
    for(let j=0;j<layers.length && pieces.length;j++){
      const b=layers[j];
      if(i===j || !overlap(a.box,b.box))continue;
      const above=p=>b.height(p)-a.height(p);
      const diffs=a.points.map(above);
      if(Math.max(...diffs)<1e-7 && (Math.min(...diffs)<-1e-7 || j<i))continue;
      const mask=Math.min(...diffs)>=-1e-7?b.planes:[...b.planes,above];
      pieces=pieces.flatMap(piece=>subtract(piece,mask));
    }
    for(const points of pieces)visible.push({points,height:a.height});
  }
  return visible;
}

export function fitRoadPaint(scene,pavement,layerCeiling,cache){
  const meshes=scene.children.filter(m=>batches.has(m.name));
  if(restorePaint(cache,meshes,paintSignature(meshes,pavement.fingerprint)))return;
  for(const mesh of meshes){
    const previous=mesh.geometry,pos=previous.attributes.position,tint=previous.attributes.color,index=previous.index?.array;
    const positions=[],normals=[],colours=[];
    const write=(p,y,i)=>{
      positions.push(p[0],y+.007,p[1]);normals.push(0,1,0);
      if(tint)colours.push(tint.getX(i),tint.getY(i),tint.getZ(i));
    };
    for(let k=0,n=index?.length??pos.count;k<n;k+=3){
      const ids=index?[index[k],index[k+1],index[k+2]]:[k,k+1,k+2];
      const points=ids.map(i=>[pos.getX(i),pos.getZ(i)]),bounds2=bounds(points);
      if(area(points)<1e-8)continue;
      const centre=ids.reduce((p,i)=>[p[0]+pos.getX(i)/3,p[1]+pos.getZ(i)/3,p[2]+pos.getY(i)/3],[0,0,0]);
      const ceiling=layerCeiling(...centre);
      const faces=pavement.trianglesIn(bounds2.x0,bounds2.z0,bounds2.x1,bounds2.z1);
      const heights=points.map(p=>pavement.heightAt(...p,ceiling));
      const [a,b,c]=points, abx=b[0]-a[0],abz=b[1]-a[1],acx=c[0]-a[0],acz=c[1]-a[1],det=abx*acz-abz*acx;
      const gx=((heights[1]-heights[0])*acz-(heights[2]-heights[0])*abz)/det;
      const gz=((heights[2]-heights[0])*abx-(heights[1]-heights[0])*acx)/det;
      const approximate=p=>heights[0]+gx*(p[0]-a[0])+gz*(p[1]-a[1]);
      for(const part of visibleFacets(points,faces,ceiling,approximate)){
        for(let i=2;i<part.points.length;i++){
          const vertices=[part.points[0],part.points[i-1],part.points[i]];
          const extent=bounds(vertices);
          if(area(vertices)<.0002*Math.max(extent.x1-extent.x0,extent.z1-extent.z0))continue;
          for(const p of vertices)write(p,part.height(p),ids[0]);
        }
      }
    }
    const geometry=new BufferGeometry();
    geometry.setAttribute('position',new Float32BufferAttribute(positions,3));
    geometry.setAttribute('normal',new Float32BufferAttribute(normals,3));
    if(colours.length)geometry.setAttribute('color',new Float32BufferAttribute(colours,3));
    mesh.geometry=geometry;previous.dispose();
  }
}
