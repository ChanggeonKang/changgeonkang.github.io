import * as T from '../lib/three.module.min.js';

// The separate sports_hall footprint at W2 is visible across the charging bays
// in November 2026 panorama 2IrQXc7UQ0JXumYbIqcW1w. Its arched olive roof
// and tiled blind bays are visible from the west, above the parked vehicles.
export const westGymnasiumId=78058776;

function trimWidth(ring,edge,sign){
  const result=[];
  for(let i=0;i<ring.length;i++){
    const a=ring[i],b=ring[(i+1)%ring.length],da=sign*(a[0]-edge),db=sign*(b[0]-edge);
    if(da>=0)result.push(a);
    if(da*db<0){const t=da/(da-db);result.push([edge,a[1]+(b[1]-a[1])*t]);}
  }
  return result;
}

export function buildWestGymnasium(scene,b,hAt,MB){
  const ring=b.p,[origin,far]=ring,l=Math.hypot(far[0]-origin[0],far[1]-origin[1]);
  const dx=(far[0]-origin[0])/l,dz=(far[1]-origin[1])/l;
  const local=ring.map(([x,z])=>[-dz*(x-origin[0])+dx*(z-origin[1]),dx*(x-origin[0])+dz*(z-origin[1])]);
  const at=(u,y,v)=>[origin[0]-dz*u+dx*v,y,origin[1]+dx*u+dz*v];
  const width=Math.max(...local.map(p=>p[0])),base=hAt(...ring.at(-1));
  const bottom=Math.min(...ring.map(p=>hAt(...p)))-.6;
  const roof=u=>base+6.65+2.90*(1-(2*u/width-1)**2);
  const tile=new MB(),trim=new MB(),up=[0,1,0];
  const tint=hex=>new T.Color(hex),wall=tint(0xddded7),roofSheet=tint(0xb2b7ab);
  const rooflight=tint(0xc3bda2),edge=tint(0xa9b580),white=tint(0xebeae1);
  const uv=p=>[p[0]+p[2]*.3,p[1]];
  const quad=(batch,a,b,c,d,n,color)=>batch.quad(a,b,c,d,n,uv(a),uv(b),uv(c),uv(d),color);
  const face=[-dx,0,-dz];
  // Clip the curved roof against the stepped, mapped outline at every rib.
  const ribs=26;
  for(let i=0;i<ribs;i++){
    const u0=width*i/ribs,u1=width*(i+1)/ribs;
    const strip=trimWidth(trimWidth(local,u0,1),u1,-1);
    if(strip.length<3)continue;
    const section=p=>at(p[0],roof(u0)+(roof(u1)-roof(u0))*(p[0]-u0)/(u1-u0),p[1]);
    for(const [a,b,c] of T.ShapeUtils.triangulateShape(strip.map(p=>new T.Vector2(...p)),[])){
      const points=[strip[a],strip[b],strip[c]].map(section);
      const normal=new T.Vector3(...points[1]).sub(new T.Vector3(...points[0])).cross(new T.Vector3(...points[2]).sub(new T.Vector3(...points[0]))).normalize();
      if(normal.y<0)normal.negate();
      trim.tri(...points,normal.toArray(),...points.map(uv),i%5===2?rooflight:roofSheet);
    }
  }
  for(let i=0;i<local.length;i++){
    const a=local[i],b=local[(i+1)%local.length],steps=Math.max(1,Math.ceil(Math.abs(b[0]-a[0])/1.3));
    const from=ring[i],to=ring[(i+1)%ring.length],length=Math.hypot(to[0]-from[0],to[1]-from[1]);
    const n=[(to[1]-from[1])/length,0,(from[0]-to[0])/length];
    for(let j=0;j<steps;j++){
      const p=a.map((v,k)=>v+(b[k]-v)*j/steps),q=a.map((v,k)=>v+(b[k]-v)*(j+1)/steps);
      const pt=(pair,h)=>at(pair[0],h,pair[1]);
      quad(tile,pt(p,bottom),pt(q,bottom),pt(q,roof(q[0])-.42),pt(p,roof(p[0])-.42),n,wall);
      quad(trim,pt(p,roof(p[0])-.42),pt(q,roof(q[0])-.42),pt(q,roof(q[0])),pt(p,roof(p[0])),n,edge);
    }
  }
  function panel(u0,u1,y0,y1,v,color){
    quad(trim,at(u0,y0,v),at(u1,y0,v),at(u1,y1,v),at(u0,y1,v),face,color);
  }
  // The panels are inset behind chunky, light tiled piers. Their lower lights
  // sit just above the foundation. The blind upper section faces the lot.
  const dark=tint(0x657874),glass=tint(0x819a90),jamb=tint(0xb9beb6);
  for(let i=0;i<7;i++){
    const u=.42+i*3.86;
    panel(u,u+3.27,base+.40,base+4.45,-.15,jamb);
    panel(u+.10,u+3.17,base+.53,base+4.31,-.16,white);
    panel(u+.18,u+3.09,base+.56,base+1.52,-.18,dark);
    for(let j=0;j<3;j++)panel(u+.23+j*.94,u+1.13+j*.94,base+.62,base+1.45,-.19,glass);
  }
  for(const u of [6.4,20.7]){
    const radius=.63,top=base+5.48;
    for(let i=0;i<8;i++){
      const a=Math.PI*i/8,b=Math.PI*(i+1)/8;
      const section=(t,y)=>at(u+Math.cos(t)*radius,y,-.07-Math.sin(t)*radius);
      const middle=(a+b)/2;
      const n=[-dz*Math.cos(middle)-dx*Math.sin(middle),0,dx*Math.cos(middle)-dz*Math.sin(middle)];
      quad(tile,section(a,bottom),section(b,bottom),section(b,top),section(a,top),n,wall);
      const points=[section(a,top),section(b,top),at(u,top,-.07)];
      tile.tri(...points,up,...points.map(uv),wall);
    }
  }
  const material=new T.MeshStandardMaterial({vertexColors:true,roughness:.9});
  material.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 vGymUv;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nvGymUv=uv;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 vGymUv;')
      .replace('#include <color_fragment>',`#include <color_fragment>
        vec2 grid=vGymUv/.115, e=.5-abs(fract(grid)-.5), aa=max(fwidth(grid),vec2(.008));
        float grout=min(smoothstep(0.,aa.x+.07,e.x),smoothstep(0.,aa.y+.07,e.y));
        diffuseColor.rgb*=mix(.80+.2*grout,.96,smoothstep(.22,.87,max(aa.x,aa.y)));`);
  };
  material.customProgramCacheKey=()=>'west-gym-tile-1';
  for(const [batch,mat,name] of [[tile,material,'W2 gym tiled facade'],[trim,new T.MeshStandardMaterial({vertexColors:true,roughness:.82}),'W2 gym curved roof and bays']]){
    const mesh=new T.Mesh(batch.geo(),mat);mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);
  }
}
