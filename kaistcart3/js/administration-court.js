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
  buildNorthwestEntrance(scene,W,ground,leaves);
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

// The 147-degree view from the parking aisle (1FqELyp, October 2026)
// looks at E14's second mapped door. The blue rectangle on the opposite
// frontage is a different entrance. Both share the same building outline.
function buildNorthwestEntrance(scene,W,ground,leaves){
  const hall=W.D.buildings.find(b=>b.ref==='E14');
  if(!hall)return;
  const [x,z]=[-70.6,-68.6],dx=.8336,dz=-.5524,nx=dz,nz=-dx;
  const yaw=-Math.atan2(dz,dx),grade=ground(x,z),top=Math.min(...hall.p.map(p=>ground(...p)))-.65+13.7;
  const frames=new FixtureInstances(),dummy=new T.Object3D();
  const at=(s,h,v)=>new T.Vector3(x+s*dx+v*nx,h,z+s*dz+v*nz);
  const box=(s,h,v,w,t,d,col)=>frames.box(at(s,h,v),w,t,d,yaw,col);
  const stone=0xc8c4bd,grey=0x777978,iron=0x41474b,blue=0x1864a2;
  const glass=[0x3c464d,0x4e575c,0x434c51];
  const pitch=(top-grade-1.25)/3.45;
  function windows(s,y,w,h,v,count){
    box(s,y,v,w+.11,h+.12,.12,iron);
    const pitch=w/count;
    for(let k=0;k<count;k++){
      const u=s+(k+.5)*pitch-w/2;
      box(u,y,v+.085,pitch-.073,h-.055,.066,glass[k%glass.length]);
      if(k>0)box(u-pitch/2,y,v+.133,.052,h,.046,0x282f32);
    }
    box(s,y-h*.26,v+.13,w,.055,.04,iron);
  }
  // The side wings combine long, mullioned panes with narrow stair lights.
  // Keep the middle clear at grade for the glazed entrance.
  for(let level=0;level<4;level++){
    const y=grade+1.32+level*pitch;
    for(const side of [-1,1]){
      for(const [s,w] of [[4.92,4.92],[8.63,.56],[12.85,.69],[17.37,1.1],[22.32,4.18],[27.04,4.25],[33,3.9]]){
        windows(side*s,y,w,1.38,.105,w<1.2?1:3);
      }
    }
  }
  // A shallow rounded bay stacks three strips of glazing above the door.
  // Each face follows the same arc so that the stone spandrels wrap the bay.
  const bay=(u,h)=>at(u,h,.16+.58*(1-(u/2.45)**2));
  for(let i=0;i<5;i++){
    const a=-2.45+i*.98,b=a+.98,p=bay(a,0),q=bay(b,0);
    const theta=-Math.atan2(q.z-p.z,q.x-p.x),width=p.distanceTo(q)+.015;
    const panel=(h,height,depth,tint,extra=0)=>{
      const m=p.clone().lerp(q,.5);m.y=h;m.x+=nx*extra;m.z+=nz*extra;
      frames.box(m,width,height,depth,theta,tint);
    };
    panel((grade+3.35+top)/2,top-grade-3.35,.22,stone);
    for(let level=1;level<4;level++){
      const h=grade+1.32+level*pitch;
      panel(h,1.49,.10,iron,.16);panel(h,1.32,.075,glass[i%3],.24);
      panel(h-.35,.065,.08,iron,.29);
    }
  }
  box(0,top+.29,-.9,14.4,.59,2.1,stone);
  // The photographed porch has blue posts and two sloping blue rafters.
  // Glazed doors and their transom close the rear of the shallow vestibule.
  windows(0,grade+1.4,3.45,2.78,.26,4);
  for(const s of [-1.68,-.83,0,.83,1.68])box(s,grade+1.39,.42,.063,2.78,.072,0x839295);
  box(0,grade+1.89,.42,3.46,.075,.071,0x839295);
  box(0,grade+2.94,.56,3.89,.25,.91,grey);
  const eave=grade+2.98,ridge=grade+4.26,sp=1.76;
  for(const v of [.64,1.59]){
    box(0,eave-.06,v,3.70,.15,.14,blue);
    for(const side of [-1,1]){
      frames.rod(at(side*sp,eave,v),at(0,ridge,v),.12,blue);
      box(side*sp,grade+1.48,v,.18,2.96,.17,blue);
    }
  }
  for(const s of [-sp,0,sp]){
    const h=s===0?ridge:eave;frames.rod(at(s,h,.64),at(s,h,1.59),.077,blue);
  }
  const slab=at(0,grade+.055,.89);frames.box(slab,3.94,.11,1.79,yaw,0x989891);
  function plant(s,v,style){
    const root=at(s,0,v);
    if(W.access.isDrivable(root.x,root.z))return;
    const h=ground(root.x,root.z);
    const crown=(u,vv,y,rx,ry,rz,tint)=>{
      dummy.position.copy(at(s+u,h+y,v+vv));dummy.rotation.set(0,yaw+s*.03,0);
      dummy.scale.set(rx,ry,rz);dummy.updateMatrix();leaves.push([dummy.matrix.clone(),tint]);
    };
    if(style==='shade'){
      for(const [u,spread] of [[-.21,-1],[.15,1],[.02,.2]]){
        frames.rod(at(s+u,h+.02,v),at(s+spread*.87,h+5.6,v+.22*spread),.14,0x5a5144);
        crown(spread*.85,.22*spread,5.51,1.47,1.77,1.37,0x52613e);
        crown(spread*1.21,.2*spread,6.8,1.84,1.52,1.55,0x596644);
      }
    }else if(style==='pine'){
      frames.rod(at(s,h,v),at(s+.28,h+4.96,v),.18,0x69594b);
      for(const [u,y,w] of [[-1.48,3.5,1.83],[1.31,4.05,2.35],[-.91,4.86,2.13],[.32,5.47,1.57]]){
        frames.rod(at(s+.13,h+y-.96,v),at(s+u,h+y,v+.15),.085,0x60564a);
        crown(u,.12,y,w,.52,w*.61,0x425940);
      }
    }else if(style==='tiered'){
      frames.rod(at(s,h+.03,v),at(s,h+2.75,v),.12,0x605448);
      crown(0,0,.65,1.81,.50,1.19,0x3b5335);crown(-.16,0,1.48,1.55,.43,1.04,0x415837);
      crown(.12,0,2.21,1.29,.37,.83,0x435c39);crown(-.07,0,2.79,.98,.39,.68,0x445d39);
    }else crown(0,0,.47,1.33,.59,.88,0x62693b);
  }
  for(const side of [-1,1]){
    plant(side*8.8,3.3,'tiered');plant(side*5.35,5.32,'low');plant(side*5.75,6.75,'low');
  }
  plant(5.56,3.14,'shade');plant(-16.8,3.84,'pine');
  frames.put(scene,'E14 northwest bow windows and blue entrance');
}
