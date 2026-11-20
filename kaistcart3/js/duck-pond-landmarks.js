import * as THREE from '../lib/three.module.min.js';
import {box,color,column,frame,groundPatch,strip,up} from './east-campus-shapes.js';
import {clippedConifer,maple,redPine} from './east-campus-plants.js';

// The mapped marker is at (57.7,217.1). The centre of the round stone
// plinth, registered against the actual bank outline, is 2.6 m west of it.
const POND=-20786142,CARILLON=[55.2,216.1];
// Circlets from the aerators north of the sculpture are visible on the
// aerial photograph. Only the eastern bridge jet has the tall centre column;
// the two jets by the west parking court make much lower fans.
const heads=[[62.7,163.1,.33,.17],[85.8,198.9,.39,.20],[13,279.9,.79,.69],[-1.4,294.4,.68,.58],[85.9,236.5,1.61,1.40]];

export function finishDuckPondWater(mesh){
  const material=mesh.material.clone(),clock={value:0};
  material.color.set(0x294e49);material.roughness=.28;material.metalness=.18;
  material.onBeforeCompile=shader=>{
    shader.uniforms.pondTime=clock;
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 vPond;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nvPond=(modelMatrix*vec4(position,1.)).xz;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
      uniform float pondTime;varying vec2 vPond;
      float pondWaves(vec2 p){
        float t=pondTime;return sin(p.x*3.2+p.y*.72+t*1.2)*.012+
          sin(p.y*4.6-p.x*.38-t*.97)*.006+sin(p.x*1.01+p.y*1.4+t*.61)*.019;
      }
      float headWake(vec2 p,vec2 emitter,float r){
        float d=length(p-emitter);return (1.-smoothstep(r*.24,r,d))*smoothstep(.2,1.,d)*sin(d*7.1-pondTime*4.4);
      }`)
      .replace('#include <color_fragment>',`#include <color_fragment>
        float wake=headWake(vPond,vec2(85.9,236.5),11.)+headWake(vPond,vec2(13.,279.9),6.5)
          +headWake(vPond,vec2(-1.4,294.4),5.)+headWake(vPond,vec2(62.7,163.1),5.8)+headWake(vPond,vec2(85.8,198.9),5.8);
        float sampleFade=1.-smoothstep(.09,.55,max(length(dFdx(vPond)),length(dFdy(vPond))));
        diffuseColor.rgb*=1.+(.15*sin(vPond.x*2.8+1.3*sin(vPond.y*.67)+pondTime*.9)+wake*.20)*sampleFade;`)
      .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
        float h=pondWaves(vPond);vec3 sloped=vec3((h-pondWaves(vPond+vec2(.05,0.)))*20.,0.,(h-pondWaves(vPond+vec2(0.,.05)))*20.);
        normal=normalize(normal+mat3(viewMatrix)*sloped*sampleFade);`);
  };
  material.customProgramCacheKey=()=>'duck-pond-ripples-1';
  mesh.material=material;mesh.name='Duck Pond water';
  mesh.onBeforeRender=()=>{clock.value=(performance.now()*.001)%240;};
}

function bell(batch,x,y,z,r,h){
  const bronze=color(0x595649),rings=[[0,.59],[.14,.92],[.21,1],[.28,.76],[.61,.63],[.83,.41],[1,.19]];
  const vertex=(a,v)=>[x+r*v[1]*Math.cos(a),y+h*v[0],z+r*v[1]*Math.sin(a)];
  for(let k=1;k<rings.length;k++)for(let j=0;j<10;j++){
    const a=j*Math.PI/5,b=(j+1)*Math.PI/5,mid=(a+b)/2;
    strip(batch,vertex(a,rings[k-1]),vertex(b,rings[k-1]),vertex(b,rings[k]),vertex(a,rings[k]),[Math.cos(mid),0,Math.sin(mid)],bronze);
  }
}

function carillon(B,hAt){
  const [x,z]=CARILLON,floor=hAt(x,z),stone=color(0xb8aea5),steel=color(0x515957);
  const disk=Array.from({length:42},(_,i)=>[x+3.72*Math.cos(i*Math.PI/21),z+3.72*Math.sin(i*Math.PI/21)]);
  groundPatch(B.track,disk,hAt,stone);
  column(B.trim,x,z,1.95,floor-.1,floor+.19,color(0xb2a7a0));
  // KAIST's monument photograph resolves the three independent folded blades
  // and two levels of bells. Screen projection from the bridge sets the scale.
  const height=12.25,base=floor+.18;
  const angles=[-2.47,-.37,1.72],tones=[0xa01d36,0x225243,0x285882];
  for(let i=0;i<3;i++){
    const angle=angles[i],dx=Math.cos(angle),dz=Math.sin(angle),tx=-dz,tz=dx,shade=color(tones[i]);
    const centre=[x+dx*.93,z+dz*.93];
    const node=(u,y)=>[centre[0]+dx*u,base+y,centre[1]+dz*u];
    const folded=[[0,0],[0,1.63]];
    for(let k=0;k<12;k++)folded.push([k%2===0?.49:-.10,1.63+(k+1)*(height-1.63)/12]);
    const ring=([u,y])=>{const c=node(u,y);return [[-.25,-.145],[.25,-.145],[.25,.145],[-.25,.145]].map(([s,t])=>[c[0]+s*dx+t*tx,c[1],c[2]+s*dz+t*tz]);};
    const normals=[[-tx,0,-tz],[dx,0,dz],[tx,0,tz],[-dx,0,-dz]];
    for(let j=1;j<folded.length;j++){
      const a=ring(folded[j-1]),b=ring(folded[j]);
      for(let k=0;k<4;k++){const l=(k+1)%4;strip(B.trim,a[k],a[l],b[l],b[k],normals[k],shade);}
      if(j===folded.length-1)strip(B.trim,...b,up,shade);
    }
    if(i===2){
      const end=node(...folded.at(-1));column(B.trim,end[0],end[2],.018,end[1],end[1]+1.38,steel);
    }
  }
  for(const [ringY,radius,count] of [[7.78,1.10,15],[8.92,.73,10]]){
    for(let j=0;j<count;j++){
      const a=j*Math.PI*2/count,b=(j+1)*Math.PI*2/count;
      const v=[x+radius*Math.cos(a),z+radius*Math.sin(a)],w=[x+radius*Math.cos(b),z+radius*Math.sin(b)];
      const f=frame(v,w);
      box(B.trim,f,0,f.length,-.041,.041,base+ringY-.045,base+ringY+.045,steel);
      const r=.08+.035*(1+Math.cos(a)),h=.15+r;
      bell(B.trim,v[0],base+ringY-h-.075,v[1],r,h);
      column(B.trim,v[0],v[1],.018,base+ringY-.11,base+ringY,steel);
    }
  }
  return {node:11695576384,heightEstimateM:height,bells:25};
}

function spray(){
  const geometry=new THREE.BufferGeometry(),flow=[],seed=[],pos=[];
  let state=2747831663;
  const random=()=>((state=(Math.imul(1664525,state)+1013904223)>>>0)/4294967296);
  for(let i=0;i<2200;i++){
    const central=i<820,angle=(central?random():((i%20)+.12*(random()-.5))/20)*Math.PI*2;
    const horizontal=central?.095+random()*.32:2.2+random()*.69;
    const vy=central?8.55+random()*1.25:4.70+random()*1.75;
    pos.push(0,0,0);flow.push(horizontal*Math.cos(angle),vy,horizontal*Math.sin(angle));
    seed.push(random(),.065+.085*random());
  }
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  geometry.setAttribute('velocity',new THREE.Float32BufferAttribute(flow,3));
  geometry.setAttribute('seed',new THREE.Float32BufferAttribute(seed,2));
  geometry.boundingSphere=new THREE.Sphere(new THREE.Vector3(0,2.2,0),6.8);
  const material=new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,uniforms:{clock:{value:0},pixels:{value:720}},
    vertexShader:`
      attribute vec3 velocity;attribute vec2 seed;uniform float clock,pixels;varying float opacity;
      void main(){
        float life=2.*velocity.y/9.81,t=fract(seed.x+clock/life)*life;
        vec3 p=velocity*t;p.y-=4.905*t*t;
        vec4 mv=modelViewMatrix*vec4(p,1.);
        float diameter=seed.y*(.36+t/life);
        gl_Position=projectionMatrix*mv;
        gl_PointSize=clamp(.5*pixels*projectionMatrix[1][1]*diameter/max(1.,-mv.z),.86,14.);
        opacity=.24+.20*sin(3.14159*t/life);
      }`,
    fragmentShader:`
      varying float opacity;
      void main(){
        float falloff=1.-smoothstep(.04,.5,length(gl_PointCoord-.5));
        if(falloff<.015)discard;
        gl_FragColor=vec4(.84,.91,.91,opacity*falloff);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  return {geometry,material};
}

function waterMist(){
  const material=new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,uniforms:{clock:{value:0},plume:{value:new THREE.Vector2()}},
    vertexShader:`varying vec2 atSpray;uniform vec2 plume;
      void main(){
        atSpray=uv;vec4 centre=modelViewMatrix*vec4(0.,0.,0.,1.);
        vec4 top=modelViewMatrix*vec4(0.,4.88,0.,1.);
        vec4 p=mix(centre,top,uv.y);p.x+=(uv.x-.5)*plume.x;
        gl_Position=projectionMatrix*p;
      }`,
    fragmentShader:`varying vec2 atSpray;uniform float clock;
      void main(){
        float x=2.*atSpray.x-1.,y=atSpray.y,ax=abs(x);
        float mist=exp(-ax*ax*2.8-y*y*20.)*(1.-smoothstep(.73,1.,ax));
        float spread=.023+.083*pow(1.-y,2.);
        float centre=exp(-x*x/(spread*spread))*(1.-smoothstep(.87,1.,y));
        float arc=1.67*ax*(1.-ax);
        float fan=exp(-pow((y-arc)/(.040+.066*ax),2.))*smoothstep(.00,.18,ax)*(1.-smoothstep(.70,1.,ax));
        float flicker=.82+.18*sin(x*39.+y*26.-clock*5.1)*sin(y*83.+clock*7.);
        float alpha=(mist*.37+centre*.73+fan*.45)*flicker;
        if(alpha<.025)discard;
        gl_FragColor=vec4(.79,.85,.84,alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  const geometry=new THREE.PlaneGeometry(1,1);
  geometry.boundingSphere=new THREE.Sphere(new THREE.Vector3(0,2.4,0),7.4);
  return {material,geometry};
}

// Individual trees follow distinguishable crowns and shore edges in the
// north-up aerial. Fine species, heights and crown shapes are inferred by
// comparing the October and November public views on the two roads.
function lakeGarden(W,hAt,B){
  // [x,z,crown radius,height] for exposed, mature pines around the water.
  const pines=[[27.1,195.6,5.5,8.1],[23.4,199.8,4.3,7.5],[28.7,202,4.2,7.0],
    [34.3,166.1,4.4,6.7],[43.5,184.8,4.2,6.8],[31.3,183,4.3,6.8],[35.6,221.1,5.5,6.5],
    [45.3,224.4,3.0,4.1],[66.2,205.1,2.5,4.1],[72.4,208.7,3.1,4.5],
    [73.7,276.9,6.6,8.8],
    [83.5,280.4,6.0,8.3],[99.4,261.6,5.0,7.1],[73.5,296.3,6.3,8.4],
    [91.4,292.5,6.7,8.4],[107.1,269.6,4.8,7.3],[120.3,256.3,5.6,7.8],
    [23.3,291.3,4.5,6.8],[3.2,276.9,4.0,6.6],[-1.6,278.4,4.8,6.9],
    [-7.5,281.7,3.5,5.6],[5.3,310.3,6.0,7.4]];
  const maples=[[31.0,217.4,1.98],[36.0,225.0,1.58],
    // The round crown on the southern tip of the peninsula lines up with the
    // carillon from the bridge and moves left of it on the next panorama.
    [39.5,228.1,1.56,0x5a3a31,true],[62.5,219.7,1.65],
    [56.9,222.6,1.14],[72.3,224.6,1.17],[57.4,204.2,1.29],[42.6,204.0,1.48],
    [105.7,252.0,2.1],[110.1,247.7,1.82],[92.5,271.5,1.85],[32.5,292.3,1.21],
    [121.3,249.2,1.4],[67.7,292.9,1.54],[67.2,309.4,1.80],
    // The low autumn canopy fills the right-hand shore behind the bridge
    // planters in the October panorama. The emergent pines sit behind it.
    [65.7,269.7,2.35],[69.9,264.5,2.64],[75.3,265.3,2.31],[80.8,264.3,2.48],
    [86.0,260.5,2.42],[88.6,256.1,2.11],[95.2,254.9,2.06]];
  const shore=[[63.5,228.2],[65.8,227.6],[73.9,221.9],[68.5,214.4],[69.5,208.8],
    [60.7,205.4],[46.7,205.5],[63.4,205.7],[60.8,213.3],[65.2,221.3],
    [75.2,216.8],[78.9,214.2],[74.3,209.5],[35.3,228.6],[47.9,226.9],
    [88.4,259.8],[94.2,259.8],[102.7,248.0],[103.2,245.3],[103.7,236.7]];
  const G=W.G;
  const blocked=(x,z)=>G.d[(Math.floor(z)-G.z0)*G.w+Math.floor(x)-G.x0]!==0 || W.access.isDrivable(x,z);
  let count=0;
  for(const [i,[x,z,r,height]] of pines.entries())if(!blocked(x,z)){redPine(B,x,hAt(x,z),z,r,height,i*1.74+.4);count++;}
  for(const [i,[x,z,s,tone,lowBranches]] of maples.entries())if(!blocked(x,z)){maple(B,x,hAt(x,z),z,s,i*2.42+1,tone,lowBranches);count++;}
  for(const [i,[x,z]] of shore.entries())if(!blocked(x,z)){clippedConifer(B,x,hAt(x,z),z,.53+.18*Math.sin(i*1.36),i*1.39);count++;}
  return count;
}

export function buildPondLandmarks(W,hAt,B,group){
  const pond=[...W.waterLevels].find(([a])=>a.id===POND);
  if(!pond)return;
  const tower=carillon(B,hAt),{geometry,material}=spray(),mist=waterMist(),size=new THREE.Vector2();
  for(const [i,[x,z,width,height]] of heads.entries()){
    const body=new THREE.Points(geometry,material);
    body.name='Duck Pond fountain '+(i+1);body.position.set(x,pond[1]+.09,z);body.scale.set(width,height,width);
    body.onBeforeRender=renderer=>{
      material.uniforms.clock.value=(performance.now()*.001)%240+i*1.73;
      material.uniforms.pixels.value=renderer.getDrawingBufferSize(size).y*width;
      material.uniformsNeedUpdate=true;
    };
    group.add(body);
    if(i>=2){
      const cloud=new THREE.Mesh(mist.geometry,mist.material);
      cloud.name=body.name+' mist';cloud.position.copy(body.position);cloud.scale.copy(body.scale);
      cloud.onBeforeRender=()=>{
        mist.material.uniforms.clock.value=(performance.now()*.001)%240+i*1.73;
        mist.material.uniforms.plume.value.set(7.6*width,height);
        mist.material.uniformsNeedUpdate=true;
      };
      group.add(cloud);
    }
  }
  return {facility:'Duck Pond and Carillon of Great Scholars',tower,fountains:3,aerators:2,plantings:lakeGarden(W,hAt,B),
    panoramas:['C-Sz0QoOAA50sVQVSBOyGw','GxhJdSsMiNHF7xMz0BOZJw','NqbvfBPmrW78Qx206HAgPQ','FBfbNCSYVQwg19i_srmz8w']};
}
