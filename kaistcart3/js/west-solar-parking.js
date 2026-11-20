import * as T from '../lib/three.module.min.js';
import {FixtureInstances} from './survey-fixture-instances.js';

// Roof corners registered against the November W13/W2 street views and the
// overhead parking rows. Separate arrays leave sunlight through the gaps.
const rows=[
  {a:[-217.55,312.90],b:[-202.64,303.28],end:[-214.42,317.95],units:1},
  {a:[-199.75,339.83],b:[-184.13,344.63],end:[-202.40,346.80],units:2},
  {a:[-220.43,355.69],b:[-172.83,370.36],end:[-222.59,362.91],units:3},
  {a:[-215.38,383.58],b:[-199.27,408.10],end:[-209.85,380.22],units:1}
];

export function buildWestSolarParking(scene,ground,parking){
  const steel=new FixtureInstances(),supports=[],up=new T.Vector3(0,1,0),positions=[],normals=[],uv=[];
  for(const [row,r] of rows.entries()){
    const len=Math.hypot(r.b[0]-r.a[0],r.b[1]-r.a[1]),dx=(r.b[0]-r.a[0])/len,dz=(r.b[1]-r.a[1])/len;
    const side=Math.sign((r.end[0]-r.a[0])*(-dz)+(r.end[1]-r.a[1])*dx);
    const nx=-dz*side,nz=dx*side,depth=(r.end[0]-r.a[0])*nx+(r.end[1]-r.a[1])*nz;
    const at=(s,q,h=0)=>new T.Vector3(r.a[0]+dx*s+nx*q,h,r.a[1]+dz*s+nz*q);
    const platform=at(len*.5,depth*.5);
    const slope=-.135*Math.sign(nz),top=q=>ground(platform.x,platform.z)+3.15+slope*(q-depth*.5);
    const roof=(s,q,h=0)=>at(s,q,top(q)+h);
    const gap=.72,span=(len-gap*(r.units-1))/r.units;
    for(let k=0;k<r.units;k++){
      const lo=k*(span+gap),hi=lo+span;
      const sides=[roof(lo,0),roof(hi,0),roof(hi,depth),roof(lo,depth)];
      const poly=[0,1,2,0,2,3],coords=[[0,0],[span,0],[span,depth],[0,depth]];
      const normal=new T.Vector3(0,1,0).addScaledVector(new T.Vector3(nx,0,nz),-slope).normalize();
      if(new T.Vector3().subVectors(sides[1],sides[0]).cross(new T.Vector3().subVectors(sides[2],sides[0])).dot(up)<0)poly.reverse();
      for(const i of poly){positions.push(...sides[i].toArray());normals.push(...normal.toArray());uv.push(...coords[i]);}
      for(const edge of [0,depth])steel.rod(roof(lo,edge,-.09),roof(hi,edge,-.09),.075,0x8f979b);
      for(const s of [lo,hi])steel.rod(roof(s,0,-.08),roof(s,depth,-.08),.065,0x9da7a9);
      // The November front views show an open carriage aisle, a shared spine
      // of columns behind/between bays, and triangular cantilever braces.
      const frames=Math.max(2,Math.ceil(span/5.5));
      for(let j=0;j<frames;j++){
        const station=lo+.45+(span-.90)*j/(frames-1);
        const q=depth*(row===0?.82:.52);
        // A post belongs between cars. A small longitudinal adjustment in an
        // illustrative bay keeps its concrete foot clear of the bodywork.
        let s=station;
        for(const nudge of [0,.40,-.40,.82,-.82,1.25,-1.25]){
          const candidate=Math.max(lo+.18,Math.min(hi-.18,station+nudge));
          const p=at(candidate,q);
          if(parking.cars.some(c=>{
            const x=p.x-c.x,z=p.z-c.z;
            return Math.abs(x*c.u[0]+z*c.u[1])<1.22 && Math.abs(x*c.v[0]+z*c.v[1])<2.49;
          }))continue;
          s=candidate;break;
        }
        const p=at(s,q),base=ground(p.x,p.z);
        supports.push({x:p.x,z:p.z,r:.18,base,top:top(q)});
        steel.rod(at(s,q,base-.045),at(s,q,base+.23),.18,0x9d9e98);
        steel.rod(at(s,q,base+.21),roof(s,q,-.11),.095,0x606a6b);
        steel.rod(roof(s,.13,-.14),roof(s,depth-.13,-.14),.079,0x818d8e);
        for(const v of [.28,depth-.28])steel.rod(roof(s,q,-1.16),roof(s,v,-.17),.055,0x70797a);
      }
    }
  }
  const mesh=new T.BufferGeometry();
  mesh.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  mesh.setAttribute('normal',new T.Float32BufferAttribute(normals,3));mesh.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
  const mat=new T.MeshStandardMaterial({roughness:.43,metalness:.30,side:T.DoubleSide});
  mat.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 panelUv;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\npanelUv=uv;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 panelUv;')
      .replace('#include <color_fragment>',`#include <color_fragment>
        vec2 p=panelUv/vec2(1.08,1.78);
        vec2 edge=.5-abs(fract(p)-.5), pixel=max(fwidth(p),vec2(.001));
        float seam=1.-min(smoothstep(.004,.012+pixel.x,edge.x),smoothstep(.003,.009+pixel.y,edge.y));
        seam*=1.-smoothstep(.16,.65,max(pixel.x,pixel.y));
        float variation=fract(sin(dot(floor(p),vec2(52.37,74.319)))*24137.321);
        diffuseColor.rgb=gl_FrontFacing?mix(vec3(.022,.052,.090)*(.86+.26*variation),vec3(.25,.29,.32),seam):vec3(.23,.26,.27);`);
  };
  mat.customProgramCacheKey=()=>'west-parking-solar';
  const panels=new T.Mesh(mesh,mat);panels.name='W13 parking solar modules';panels.castShadow=true;panels.receiveShadow=true;scene.add(panels);
  steel.put(scene,'W13 solar parking steelwork');
  return supports;
}
