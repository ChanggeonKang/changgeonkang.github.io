import * as T from '../lib/three.module.min.js';
import {FixtureInstances} from './survey-fixture-instances.js';
import {foliage,plantBatch} from './gate-avenue-garden.js';

// zMr6xym and MATLFU8 face along/across the grass-block parking aisles.
// The central pedestrian crossings and vehicle spine are plain asphalt.
export function administrationPaving(source){
  const c=document.createElement('canvas');c.width=c.height=256;
  const pen=c.getContext('2d');let seed=86328;
  const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  pen.fillStyle='#888a72';pen.fillRect(0,0,256,256);
  for(let row=0;row<12;row++)for(let col=-1;col<=16;col++){
    const x=col*16+(row%2)*8,y=row*256/12,s=Math.round(random()*18);
    pen.fillStyle='rgb('+(146+s)+' '+(145+s)+' '+(126+s)+')';pen.fillRect(x+.8,y+.6,14.5,20.3);
    pen.fillStyle='rgb('+(100+s)+' '+(109+s)+' '+(75+s)+')';pen.fillRect(x+4.1,y+4.5,8,11.8);
    for(let i=0;i<7;i++){
      const v=Math.round(random()*37);pen.fillStyle='rgb('+(101+v)+' '+(113+v)+' '+(78+v)+')';
      pen.fillRect(x+4.3+random()*6.9,y+4.6+random()*10.1,1.1,1.48);
    }
  }
  const tex=new T.CanvasTexture(c);tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.anisotropy=4;tex.colorSpace=T.SRGBColorSpace;
  const m=source.clone();m.map=tex;m.color.setHex(0xc6c2aa);
  m.onBeforeCompile=s=>{
    s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 vCourtPosition;')
      .replace('#include <project_vertex>','#include <project_vertex>\nvCourtPosition=(modelMatrix*vec4(position,1.)).xz;');
    s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 vCourtPosition;')
      .replace('#include <map_fragment>',`vec2 axis=vec2(dot(vCourtPosition,vec2(.837,-.547)),dot(vCourtPosition,vec2(.547,.837)));
        vec4 turf=texture2D(map,axis*.43);
        float band=abs(axis.x+21.65);
        vec3 deck=mix(vec3(.133,.141,.144),vec3(.302,.305,.286)*(.92+.22*turf.r),smoothstep(3.25,3.35,band));
        diffuseColor.rgb*=mix(deck,turf.rgb,smoothstep(6.6,6.7,band));`);
  };
  m.customProgramCacheKey=()=>'e14-grass-blocks-1';return m;
}

const world=(px,py)=>[-106+(px-556.5)*.12021,-151+(py-350)*.12021];
export const sportsWoodland=[
  [105,59],[171,40],[262,32],[332,72],[420,44],[513,52],[618,54],[746,27],
  [121,155],[197,120],[270,149],[349,163],[441,137],[533,131],[595,99],
  [151,259],[222,226],[298,255],[384,216],[474,202],[568,205],[625,168],[698,153],
  [106,365],[180,387],[250,366],[325,377],[381,352],[515,253],[568,243],
  [121,469],[194,442],[268,426]
].map(([px,py],i)=>[...world(px,py),6.6+(i*7%8)*.59,[0x455939,0x5e6942,0x506044,0x6e7445][i%4]]);
for(const [a,b,v] of [[-54,-31,-149.20],[-65,-31,-130.75],[-11,20,-149.75],[-12,26,-130.57]]){
  for(let u=a,i=0;u<=b;u+=6.1,i++){
    sportsWoodland.push([.837*u+.547*v,-.547*u+.837*v,4.8+(i%3)*.69,
      [0x8f5343,0x865648,0x74683c,0x6b703e][i%4]]);
  }
}

export function buildAdministrationCourt(scene,W,ground){
  const frames=new FixtureInstances(),leaves=[],o=new T.Object3D();
  function hedge(x,z,rx,rz,shade){
    if(W.access.isDrivable(x,z))return;
    o.position.set(x,ground(x,z)+.39,z);o.rotation.set(0,.58,0);o.scale.set(rx,.66,rz);o.updateMatrix();
    leaves.push([o.matrix.clone(),shade]);
  }
  // The first row of trees is set off the asphalt, across the crosswalk
  // from the larger grove. Break it at the pedestrian entrance.
  for(const [px,py,w] of [[848,268,.95],[748,321,1.05],[699,359,.9],[575,453,.8],[528,489,.84],
    [405,567,.90],[301,630,1.04],[203,668,.93],[716,145,1.03],[622,185,1.02],[533,260,1.08],[408,349,.96]]){
    hedge(...world(px,py),w,w*1.3,0x50673d);
  }
  for(const [i,[x,z,h]] of [[-92.2,-166.8,7.1],[-101.3,-160.5,6.2],[-113.1,-151.9,7.0],[-119.8,-146.8,5.8]].entries()){
    if(!W.access.isDrivable(x,z))hedge(x,z,1.2,h*.26,i%2?0x656f3d:0x795b44);
  }
  // Facing east, the near mast has a stop sign with a rectangular amber legend.
  const mast=(x,z,height)=>{
    const edge=W.roadIndex.nearest(x,z,13,r=>r.id===1255160783);
    if(edge?.distance>.01){
      const shift=Math.max(0,edge.s.road.width/2+.76-edge.distance)/edge.distance;
      x+=(x-edge.x)*shift;z+=(z-edge.z)*shift;
    }
    const at=(h)=>new T.Vector3(x,ground(x,z)+h,z);
    frames.rod(at(0),at(.25),.28,0x484c48);frames.rod(at(.23),at(height),.126,0x555d57);return at;
  };
  const at=mast(-81.4,-162.7,5.83),arm=new T.Vector3(-.55,0,-.836);
  for(const h of [5.20,5.64])frames.rod(at(h),at(h).addScaledVector(arm,2.24),.054,0x4c514b);
  const yaw=Math.atan2(-.837,.547),center=at(5.42).addScaledVector(arm,1.68);
  frames.box(center,1.63,.72,.095,yaw,0x434640);
  const cv=document.createElement('canvas');cv.width=512;cv.height=216;
  const ctx=cv.getContext('2d');ctx.fillStyle='#373b38';ctx.fillRect(0,0,512,216);
  ctx.strokeStyle='#878f83';ctx.lineWidth=6;ctx.strokeRect(3,3,506,210);
  ctx.fillStyle='#983b39';ctx.beginPath();
  for(let i=0;i<8;i++){const a=(i+.5)*Math.PI/4,x=103+83*Math.cos(a),y=108+83*Math.sin(a);if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);}
  ctx.closePath();ctx.fill();ctx.fillStyle='#f5f0e5';ctx.font='bold 47px Arial';ctx.textAlign='center';ctx.fillText('STOP',103,125);
  ctx.fillStyle='#d7ad64';ctx.font='bold 45px Arial';ctx.fillText('FULL STOP',333,126);
  const tex=new T.CanvasTexture(cv);tex.colorSpace=T.SRGBColorSpace;
  const sign=new T.Mesh(new T.PlaneGeometry(1.58,.65),new T.MeshBasicMaterial({map:tex}));
  sign.name='N3 stop approach';sign.position.copy(center).add(new T.Vector3(-.837,0,.547).multiplyScalar(.055));sign.rotation.y=yaw;scene.add(sign);
  const opp=mast(-88.68,-173.03,6.84);
  const tip=opp(6.84).add(new T.Vector3(.71,.05,1.08));
  frames.rod(opp(6.70),tip,.067,0x51564f);frames.box(tip,.23,.093,.5,.58,0x4c514b);
  frames.put(scene,'N3 west crossing masts');plantBatch(scene,'N3 to E14 clipped verge',foliage(),leaves,true);
}
