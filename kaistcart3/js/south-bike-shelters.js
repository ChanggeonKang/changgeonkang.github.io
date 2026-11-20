import * as T from '../lib/three.module.min.js';
import { FixtureInstances } from './survey-fixture-instances.js';

// Independent drawings from November 2026 views DNCv3UI and WNAIQBQ.
// The shared-bike station uses OSM bicycle_parking 1524570049. Shelter
// lengths, bicycle spacing and the number parked at the time are estimates.
const vertical=new T.Vector3(0,1,0);
// The paving under the bicycle racks is pink-grey blockwork, flush with the
// sidewalk. Build it in a single draw with a little relief along the joints.
function rackPaving(scene,name,point,start,end,shared){
  const pos=[],colors=[],c=new T.Color();
  function slab(u0,u1,v0,v1,dy,hex){
    const corners=[[u0,v0],[u0,v1],[u1,v1],[u1,v0]].map(([u,v])=>point(u,v,dy));
    const upward=corners[1].clone().sub(corners[0]).cross(corners[2].clone().sub(corners[0])).y>0;
    c.setHex(hex);
    for(const index of upward?[0,1,2,0,2,3]:[0,2,1,0,3,2]){
      const q=corners[index];pos.push(q.x,q.y,q.z);colors.push(c.r,c.g,c.b);
    }
  }
  const near=-1.46,far=1.35,left=start-.36,right=end+.36,tileLength=.38,tileWidth=.193;
  for(let u=left;u<right;u+=1)slab(u,Math.min(u+1,right),near,far,-.011,0x96948f);
  const stone=shared?[0xbab3aa,0xb5b0a6,0xc1b8ad,0xb9b6ae]:[0xc7bab0,0xc9bcb2,0xbdb2ac,0xc5b8ad,0xc2b8b2];
  for(let row=0,v=near;v<far;row++,v+=tileWidth){
    for(let col=0,u=left-(row%2)*tileLength/2;u<right;col++,u+=tileLength){
      const lo=Math.max(left,u)+.005,hi=Math.min(right,u+tileLength)-.005;
      if(hi<=lo)continue;
      slab(lo,hi,v+.004,Math.min(v+tileWidth,far)-.004,0,stone[(col*7+row*3)%stone.length]);
    }
  }
  const g=new T.BufferGeometry();
  g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  g.computeVertexNormals();g.computeBoundingSphere();
  const mesh=new T.Mesh(g,new T.MeshStandardMaterial({vertexColors:true,roughness:.96}));
  mesh.name=name+' paving';mesh.receiveShadow=true;scene.add(mesh);
}
// The rack wheels stand in the plane of the bicycle. Three light spokes per
// wheel and a coloured step-through frame remain legible at driving height.
function addBike(batch,x,z,ground,yaw,frameColour,shared){
  const dx=Math.sin(yaw),dz=Math.cos(yaw);
  const p=(forward,h,side=0)=>new T.Vector3(x+forward*dx+side*dz,ground+h,z+forward*dz-side*dx);
  const tyre=0x252d30,steel=0x90999a,sideFacing=yaw+Math.PI/2;
  for(const wheel of [-.48,.52]){
    batch.circle('tyre',p(wheel,.354),sideFacing,tyre);
    batch.circle('hoop',p(wheel,.354),sideFacing,shared?frameColour:steel);
    for(let i=0;i<3;i++){
      const a=i*Math.PI/3,c=Math.cos(a)*.29,s=Math.sin(a)*.29;
      batch.rod(p(wheel-c,.354-s),p(wheel+c,.354+s),.009,steel);
    }
  }
  const rear=p(-.48,.354),crank=p(-.02,.34),saddle=p(-.15,.77),neck=p(.36,.80),front=p(.52,.354);
  for(const [a,b] of [[rear,crank],[rear,saddle],[saddle,crank],[crank,neck],[neck,front]]){
    batch.rod(a,b,shared?.027:.021,frameColour);
  }
  if(!shared)batch.rod(saddle,neck,.021,frameColour);
  batch.rod(p(.36,.77),p(.32,.98),.022,steel);
  batch.rod(p(.32,.98,-.21),p(.32,.98,.21),.018,tyre);
  batch.box(p(-.18,.805),.155,.055,.235,yaw,tyre);
  if(shared){
    batch.box(p(.52,.80),.32,.14,.22,yaw,0x455455);
    batch.box(p(.52,.86),.34,.029,.24,yaw,0x869189);
  }
}

export function buildEngineeringBikeShelters(scene,W,hAt){
  const sites=[
    {name:'E3 shared bicycle shelter',a:[217.4,176.5],b:[234.1,201.8],start:2,end:25.6,offset:1.18,bays:4,shared:true},
    // Two independent stretches leave the crosswalk and the doors open.
    {name:'E3-5 north bicycle shelter',a:[276.4,279.7],b:[307.8,326.8],start:-14.6,end:-3.4,offset:6.65,bays:2},
    {name:'E3-5 south bicycle shelter',a:[276.4,279.7],b:[307.8,326.8],start:4.5,end:16.0,offset:6.65,bays:2},
    {name:'E2-1 end-wall bicycle shelter',a:[276.4,279.7],b:[307.8,326.8],start:-3.3,end:2.9,offset:-7.3,bays:1}
  ];
  for(const site of sites){
    const batch=new FixtureInstances(),[x,z]=site.a,len=Math.hypot(site.b[0]-x,site.b[1]-z);
    const dx=(site.b[0]-x)/len,dz=(site.b[1]-z)/len,yaw=Math.atan2(dx,dz);
    const point=(u,off,h)=>{
      const across=site.offset+off,px=x+dx*u+dz*across,pz=z+dz*u-dx*across;
      return new T.Vector3(px,hAt(px,pz)+.18+h,pz);
    };
    const pitch=(site.end-site.start)/site.bays,steel=0x374043,roof=0x4f5656,wood=0x745b48;
    rackPaving(scene,site.name,point,site.start,site.end,site.shared);
    for(let i=0;i<site.bays;i++){
      const lo=site.start+i*pitch+.065,hi=lo+pitch-.13,mid=(lo+hi)/2;
      // Each shallow roof follows the verge along its length, preserving a
      // level top across the covered benches instead of following crossfall.
      const p=point(mid,0,0),low=point(lo,0,0),high=point(hi,0,0);
      const roofY=u=>low.y+(high.y-low.y)*(u-lo)/(hi-lo)+2.40;
      const top=(u,off,dy=0)=>{const v=point(u,off,0);v.y=roofY(u)+dy;return v;};
      const span=hi-lo, grade=(high.y-low.y)/span;
      const q=new T.Quaternion().setFromAxisAngle(vertical,yaw).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),-Math.atan(grade)));
      batch.item('box',new T.Matrix4().compose(new T.Vector3(p.x,roofY(mid),p.z),q,new T.Vector3(2.18,.105,span*Math.hypot(1,grade))),roof);
      for(const u of [lo+.12,hi-.12]){
        for(const v of [-.93,.93])batch.rod(point(u,v,-.08),top(u,v,-.035),.057,steel);
        batch.rod(top(u,-.99,-.12),top(u,.99,-.12),.037,steel);
      }
      for(const v of [-.95,.95]){
        batch.rod(top(lo,v,-.37),top(mid,v,-.09),.028,steel);
        batch.rod(top(mid,v,-.09),top(hi,v,-.37),.028,steel);
        batch.rod(top(lo,v,-.37),top(hi,v,-.37),.034,steel);
      }
      // Wood louvres on the end screen. Keep the front open towards the pavement.
      for(let slat=0;slat<9;slat++)batch.box(point(hi-.12,.48,.42+slat*.175),.88,.125,.035,yaw,wood);
      const count=site.shared?6:4;
      // Individual inverted-U steel hoops are visible in the empty bays.
      for(let u=lo+.48;u<hi-.28;u+=.71){
        batch.rod(point(u,.73,.07),point(u,.73,.52),.018,0x828e90);
        batch.rod(point(u,.73,.52),point(u+.10,.73,.59),.018,0x828e90);
        batch.rod(point(u+.10,.73,.59),point(u+.28,.73,.59),.018,0x828e90);
        batch.rod(point(u+.28,.73,.59),point(u+.36,.73,.49),.018,0x828e90);
        batch.rod(point(u+.36,.73,.49),point(u+.36,.73,.07),.018,0x828e90);
      }
      for(let j=0;j<count;j++){
        const u=lo+.65+j*(span-1.26)/(count-1),center=point(u,-.03,0);
        if(W.access.isDrivable(center.x,center.z))continue;
        const angle=yaw-Math.PI/2+.14*Math.sin(i*4+j*5.1);
        const palette=site.shared?[0xc99421,0x86a938,0xd0a32d,0x9ab152]:[0x434c4c,0x7c3735,0x59697e,0x80908a];
        addBike(batch,center.x,center.z,center.y,angle,palette[(i+j)%palette.length],site.shared);
      }
    }
    batch.put(scene,site.name);
  }
}
