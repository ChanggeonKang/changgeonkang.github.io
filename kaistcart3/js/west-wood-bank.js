// The exposed bank behind the W2 charging bays follows the inside of the
// perimeter footpath in 2IrQXc7 and g6FoUO6. The toe is an overhead trace.
// Height and bedrock colour are estimates from the two November street views.
const toe=[[-263,328.8],[-255.2,331.8],[-246.5,332.7],[-237.7,330.6],
  [-230.8,326.1],[-218.8,314.9],[-212.2,308.2],[-206.2,298.2],[-202,289.8]];
let total=0;
const spans=toe.slice(1).map((b,i)=>{
  const a=toe[i],len=Math.hypot(b[0]-a[0],b[1]-a[1]),start=total;total+=len;
  return {x:a[0],z:a[1],dx:(b[0]-a[0])/len,dz:(b[1]-a[1])/len,len,start};
});
const smooth=t=>{const u=Math.max(0,Math.min(1,t));return u*u*(3-2*u);};
export function westWoodBank(x,z){
  if(x<-280||x>-196||z<266||z>335)return null;
  let min=Infinity,offset=0,station=0;
  for(const s of spans){
    const u=Math.min(s.len,Math.max(0,(x-s.x)*s.dx+(z-s.z)*s.dz));
    const vx=x-s.x-u*s.dx,vz=z-s.z-u*s.dz,d=vx*vx+vz*vz;
    if(d<min){min=d;offset=vx*s.dz-vz*s.dx;station=s.start+u;}
  }
  if(offset<=.95||offset>23||min>529)return null;
  const ends=smooth(station/10)*smooth((total-station)/14);
  const face=smooth((offset-.95)/6.8)*smooth((23-offset)/13);
  const lobe=.85+.15*Math.cos((station-22)*.088);
  return {rise:3.06*ends*face*lobe,
    rock:ends*smooth((offset-.95)/1.7)*smooth((12.5-offset)/4.2)*lobe};
}
export function bankTreeSites(){
  const trees=[];
  for(let row=0;row<2;row++){
    for(let k=0,s=4+row*2.8;s<total-1;s+=4.6+row*.8,k++){
      const ring=spans.find(o=>s<=o.start+o.len),u=s-ring.start;
      const q=11.1+row*5.9+1.8*Math.sin(k*2.6+row);
      trees.push([ring.x+u*ring.dx+q*ring.dz,ring.z+u*ring.dz-q*ring.dx,
        7.1+2.5*(.5+.5*Math.cos(k*2.1)),[0x475935,0x344d38,0x50683e,0x596b3e][(row+k)%4]]);
    }
  }
  return trees;
}
import * as T from '../lib/three.module.min.js';
import {FixtureInstances} from './survey-fixture-instances.js';
import {foliage,plantBatch} from './gate-avenue-garden.js';


export function buildWestBankDetails(scene,W,terrain){
  const stones=[],plants=[],fixture=new FixtureInstances(),obj=new T.Object3D();
  let state=48021;
  const random=()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)/4294967296);
  function place(station,depth){
    const s=spans.find(v=>station<=v.start+v.len),u=station-s.start;
    return [s.x+u*s.dx+depth*s.dz,s.z+u*s.dz-depth*s.dx,Math.atan2(s.dx,s.dz)];
  }
  for(let row=0;row<5;row++){
    for(let k=0,s=4.8+random()*1.6;s<total-5.5;s+=1.65+random()*1.13,k++){
      const [x,z,yaw]=place(s,2.4+row*1.23+random()*.77);
      const exposure=westWoodBank(x,z)?.rock||0;
      if(exposure<.19||W.access.isDrivable(x,z))continue;
      const near=W.roadIndex.nearest(x,z,4,r=>!r.drivable);
      if(near&&near.distance<near.s.road.width/2+.56)continue;
      const h=terrain(x,z),size=.27+random()*.38;
      obj.position.set(x,h-.09,z);obj.rotation.set(.18+random()*.29,yaw+.45*random(),-.22+.43*random());
      obj.scale.set(size*(.77+.48*random()),size*(.22+.28*random()),size*(1.24+.76*random()));obj.updateMatrix();
      stones.push([obj.matrix.clone(),[0x837463,0x83715f,0x92816f,0x776e60,0x91806c][(row+k)%5]]);
      if(random()<.29){
        obj.position.set(x+.16,h+.26,z+.13);obj.rotation.set(0,yaw+random(),0);
        obj.scale.set(.45+random()*.47,.24+random()*.59,.56+random()*.62);obj.updateMatrix();
        plants.push([obj.matrix.clone(),[0x52643a,0x617042,0x49593c,0x6c6740][k%4]]);
      }
    }
  }
  plantBatch(scene,'W2 weathered stone outcrop',new T.DodecahedronGeometry(1,0),stones);
  plantBatch(scene,'W2 bank scrub',foliage(),plants,true);
  // A single curved service light stands on the tip of the mapped green
  // island in the EV court, beside the solar canopy in 2IrQXc7.
  const x=-202.42,z=326.65,y=terrain(x,z)+.07;
  if(!W.access.isDrivable(x,z)){
    const at=(h,reach=0)=>new T.Vector3(x-.27*reach,y+h,z+.96*reach);
    fixture.rod(at(0),at(1.94),.116,0x4a4945);fixture.rod(at(1.92),at(5.98),.091,0xb9bcb7);
    fixture.rod(at(5.99),at(6.10,.48),.063,0xc9cbc6);
    fixture.rod(at(6.10,.48),at(5.98,1.34),.056,0xc9cbc6);
    fixture.box(at(5.91,1.42),.23,.078,.48,-.27,0xc2c5c0);
    fixture.put(scene,'W2 charging court lamp');
  }
}
