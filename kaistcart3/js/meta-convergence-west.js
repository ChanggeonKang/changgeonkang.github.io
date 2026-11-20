import * as T from '../lib/three.module.min.js';
import {facadeFinish} from './facade-materials.js';
import {FixtureInstances} from './survey-fixture-instances.js';

// KAIST's opening report (10 July 2024) gives seven storeys above grade.
// The official oblique photograph identifies the winding cladding and roof
// arrays. November views NZp7SL4 and g6FoUO6 locate the projecting glass
// bay on the parking side. Floor heights and window spacing are estimates.
export const westMetaId=1257679880;
export function identifyWestMeta(b){
  return b.id===westMetaId?{...b,ref:'W13',en:'KAIST Meta-Convergence Building I',levels:7,h:30.4}:b;
}

export function buildWestMeta(scene,b,hAt,MB){
  const nw=b.p[4],ne=b.p[2],sw=b.p[0],width=Math.hypot(ne[0]-nw[0],ne[1]-nw[1]),depth=Math.hypot(sw[0]-nw[0],sw[1]-nw[1]);
  const ux=(ne[0]-nw[0])/width,uz=(ne[1]-nw[1])/width,vx=-uz,vz=ux,yaw=Math.atan2(vx,vz);
  const base=hAt(...b.entrances[0])+.12,top=30.4;
  const at=(u,h,v)=>[nw[0]+ux*u+vx*v,base+h,nw[1]+uz*u+vz*v];
  const wall=new MB(),glass=new MB(),hardware=new FixtureInstances();
  const colours=[0xc9cbca,0xb3b5b4,0x9e9fa2,0x7c8085,0xd2d5d4,0xc2c5c5].map(c=>new T.Color(c));
  const glazing=[0x486776,0x557789,0x4e7085,0x607e90,0x708897].map(c=>new T.Color(c));
  const frame=new T.Color(0x445361);
  const p4=(batch,points,n,c)=>{
    const v=points.map(p=>at(...p)),uv=v.map(p=>[p[0]*n[2]-p[2]*n[0],p[1]]);
    batch.quad(...v,n,...uv,c);
  };
  const box=(u,h,v,w,t,d,col)=>hardware.box(new T.Vector3(...at(u,h,v)),w,t,d,yaw,col);
  // A rounded perimeter with shared corners on every storey avoids seams in
  // the silver bands. Straight sections are subdivided at actual window scale.
  const radius=2.55,points=[];
  const corners=[[radius,radius,Math.PI],[width-radius,radius,Math.PI*1.5],
    [width-radius,depth-radius,0],[radius,depth-radius,Math.PI*.5]];
  for(const [u,v,start] of corners)for(let j=0;j<=6;j++){
    const a=start+j*Math.PI/12;points.push([u+radius*Math.cos(a),v+radius*Math.sin(a)]);
  }
  const lower=Math.min(-.45,...b.p.map(p=>hAt(...p)-base-.3));
  for(let i=0;i<points.length;i++){
    const a=points[i],c=points[(i+1)%points.length],du=c[0]-a[0],dv=c[1]-a[1],len=Math.hypot(du,dv);
    const nu=dv/len,nv=-du/len,n=[nu*ux+nv*vx,0,nu*uz+nv*vz],bays=Math.max(1,Math.round(len/1.38));
    const section=(t,y,o)=>[a[0]+t*du+o*nu,y,a[1]+t*dv+o*nv];
    const band=(part,t0,t1,y0,y1,y2,y3,o,color)=>p4(part,[section(t0,y0,o),section(t1,y1,o),section(t1,y2,o),section(t0,y3,o)],n,color);
    const waves=(u,v,storey)=>{
      // The rising return is visible on the lawn sides of the building.
      const along=nu>.65?v:width-u;
      const t=Math.max(0,Math.min(1,(along-8)/25));
      return (nu>.65||nv>.65) && (storey===3 || storey===5)?1.30*t*t*(3-2*t):0;
    };
    for(let j=0;j<bays;j++){
      const l=j/bays,r=(j+1)/bays,u=a[0]+du*(l+r)/2,v=a[1]+dv*(l+r)/2;
      const tint=(i*5+j*3)%glazing.length;
      band(wall,l,r,lower,lower,.29,.29,-.08,colours[3]);
      for(let f=0;f<7;f++){
        const sill=.29+f*4.13,crown=sill+4.13;
        const solid=northAbutment(u,v,f) || (f===0 && j%8===0) || (f>=1 && f<=3 && nu<-.83 && j%6>2);
        band(solid?wall:glass,l,r,sill,sill,crown,crown,-.095,solid?colours[0]:glazing[tint]);
        const start=sill+waves(a[0]+l*du,a[1]+l*dv,f);
        const end=sill+waves(a[0]+r*du,a[1]+r*dv,f);
        band(wall,l,r,start,end,end+1.12,start+1.12,.02,colours[f%2?1:0]);
        if(!solid){
          const half=Math.min(.015/len,(r-l)*.08);
          band(glass,l,l+half,start+1.12,start+1.12,crown,crown,-.067,frame);
          band(glass,l,r,crown-.54,crown-.54,crown-.50,crown-.50,-.063,frame);
        }
      }
      band(wall,l,r,29.18,29.18,top,top,.03,colours[1]);
    }
  }
  function northAbutment(u,v,f){return v<1 && (u<4.2 || u>width-7) && (f===6 || f%2===0);}
  // Large glazed volume two storeys high, above the north lobby. Return
  // the side and soffit faces so its outline reads from both ends of the lot.
  const project=[8.1,width-8.2],bayCount=16;
  for(let i=0;i<bayCount;i++){
    const l=project[0]+i*(project[1]-project[0])/bayCount,r=l+(project[1]-project[0])/bayCount;
    p4(glass,[[l,20.5,-.72],[r,20.5,-.72],[r,29.12,-.72],[l,29.12,-.72]],[-vx,0,-vz],glazing[(i*3)%5]);
    box(l,24.82,-.76,.05,8.67,.055,0x515d68);
  }
  for(const h of [20.53,24.46,27.36,29.12])box(width/2,h,-.73,project[1]-project[0],.095,.10,0x606d77);
  for(const u of project)box(u,24.81,-.33,.15,8.67,.78,0x8e9699);
  box(width/2,20.44,-.34,project[1]-project[0],.16,.82,0x8e979b);
  // A closed lobby behind a recessed entrance, visible from the north bays.
  const door=width/2;
  for(let i=0;i<4;i++)box(door+(i-1.5)*1.19,1.59,-.12,1.11,3.15,.11,0x3a5961);
  box(door,3.29,-.51,6.1,.26,1.10,0x7d898a);
  const up=[0,1,0],localRoof=points.map(p=>new T.Vector2(...p));
  for(const ids of T.ShapeUtils.triangulateShape(localRoof,[])){
    const p=ids.map(i=>at(points[i][0],top,points[i][1]));
    wall.tri(...p,up,...p.map(q=>[q[0],q[2]]),colours[2]);
  }
  for(const [u,v,w,d] of [[20.5,4.3,21.4,5.6],[width/2,depth-9.1,width-3,3.5],[width/2,depth-3.7,width-3,3.4]]){
    box(u,top+.20,v,w,.24,d,0x727f84);
    const across=Math.round(w/1.9),deep=Math.round(d/1.6);
    for(let j=0;j<across;j++)for(let k=0;k<deep;k++)box(u+(j+.5-across/2)*w/across,top+.36,
      v+(k+.5-deep/2)*d/deep,w/across-.045,.095,d/deep-.051,0x334858);
  }
  box(width/2,top+.95,depth*.40,19.4,1.9,17.8,0xb2b7b6);
  box(width/2,top+2.03,depth*.50,17.4,.25,6.4,0x41627b);
  for(const [batch,name,part] of [[wall,'cladding','wall'],[glass,'windows','glass']]){
    const material=new T.MeshStandardMaterial({vertexColors:true,roughness:part==='glass'?.34:.72,metalness:part==='glass'?.30:.22});
    material.onBeforeCompile=shader=>{
      const varying='varying vec2 w13Uv; varying vec3 w13World; varying vec3 w13Normal;';
      shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\n'+varying)
        .replace('#include <begin_vertex>','#include <begin_vertex>\nw13Uv=uv;w13World=(modelMatrix*vec4(position,1.)).xyz;w13Normal=normalize(mat3(modelMatrix)*normal);');
      const shade=part==='glass'?'facadeGlass(diffuseColor.rgb,w13World,w13Normal)':'facadeWall(diffuseColor.rgb,w13Uv)';
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\n'+varying+facadeFinish)
        .replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb='+shade+';');
    };
    material.customProgramCacheKey=()=>'w13-'+part;
    const m=new T.Mesh(batch.geo(),material);m.name='W13 '+name;m.castShadow=true;m.receiveShadow=true;scene.add(m);
  }
  hardware.put(scene,'W13 frames and roof equipment');
  return {ref:b.ref,name:b.en,en:b.en,x:at(width*.5,0,depth*.5)[0],z:at(width*.5,0,depth*.5)[2],y:base+top+3};
}
