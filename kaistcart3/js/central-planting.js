import * as T from '../lib/three.module.min.js';
import {FixtureInstances} from './survey-fixture-instances.js';
import {foliage,plantBatch} from './gate-avenue-garden.js';

// Crown and verge locations from NVy4w-x, s7pyDY9 and ZQ2ev4.
// The pines in the entrance court fork low and expose long bare limbs.
const pines=[
  [201,336,7.7,.6],[209.8,338.2,7.2,1.7],[223.7,345.3,7.5,4.5],
  [207.5,346.7,8.2,3.1],[246.1,323.4,4.8,1.2],[249.8,352.9,6.6,2.7],
  [-38.7,85.6,7.6,2.8],[-42.1,91.5,6.1,.05],[-51.5,98.8,7.7,1.4]
];
export function nearCentralPine(x,z){
  if((x<193||x>260||z<318||z>362)&&(x< -58||x> -31||z<78||z>106))return false;
  return pines.some(([px,pz])=>(px-x)**2+(pz-z)**2<9);
}
// Individual crown centres traced on the W8 west verge. The grass directly
// in front of KAIHELP is open, and the dense stand starts behind the pavilion.
export const centralWoodland=[
  [91,267,11.0],[154,286,10.8],[204,281,11.9],[252,237,10.4],[310,253,11.3],
  [333,300,11.7],[364,350,10.0],[290,345,12.6],[227,353,9.9],[145,367,12.3],
  [81,389,10.1],[163,441,11.1],[243,434,13.3],[318,425,11.6],[397,400,10.2],
  [432,453,11.5],[387,515,12.7],[307,502,10.3],[211,533,11.5],[119,525,12.0],
  [93,624,11.3],[170,631,13.1],[244,601,12.5],[323,605,10.8],[410,612,12.6],
  [486,576,11.5],[548,617,10.0],[498,655,11.8],[620,671,11.2]
].map(([px,py,h],i)=>[-66+(px-556.5)*.12021,73+(py-350)*.12021,h,
  [0x4d613f,0x3c573d,0x617043,0x495a3c,0x596747][i%5]]).concat([
    [-105.8,51.0,5.1,0x87544a],[-111.1,58.7,6.8,0x697447],
    [-119.1,60.6,6.0,0x8d5746],[-100.2,54.5,5.9,0x536641],
    [-126.1,49.8,6.6,0x667347],[-128.9,58.5,6.5,0x785a43]
  ]);
function needles(){
  const canvas=document.createElement('canvas');canvas.width=192;canvas.height=160;
  const g=canvas.getContext('2d');let state=82297;
  const random=()=>((state=(Math.imul(1664525,state)+1013904223)>>>0)/4294967296);
  for(let branch=0;branch<17;branch++){
    const x=30+branch*8+(random()-.5)*12,y=75+Math.abs(branch-8)*1.7+random()*16;
    const tipX=x+(x-96)*.25,tipY=y-18-random()*14;
    g.beginPath();g.moveTo(96,125);g.quadraticCurveTo(x,y+random()*12,tipX,tipY);
    g.strokeStyle='#625e46';g.lineWidth=2;g.stroke();
    for(let k=0;k<14;k++){
      const f=k/14,bx=mix(x,tipX,f),by=mix(y,tipY,f),bx2=bx+(random()-.5)*21,by2=by-random()*15;
      for(let i=0;i<12;i++){
        const angle=-Math.PI*.97+random()*Math.PI*.94,r=5+random()*10;
        g.beginPath();g.moveTo(bx2,by2);g.lineTo(bx2+r*Math.cos(angle),by2+r*Math.sin(angle));
        const v=96+Math.floor(random()*95);g.strokeStyle='rgb('+Math.round(v*.78)+','+v+','+Math.round(v*.78)+')';
        g.lineWidth=1.25;g.stroke();
      }
    }
  }
  const t=new T.CanvasTexture(canvas);t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;return t;
}
const mix=(a,b,t)=>a+(b-a)*t;
export function buildCentralPlanting(scene,W,hAt){
  const fixtures=new FixtureInstances(),leaves=[],sprays=[];
  const o=new T.Object3D();
  const crown=(x,y,z,w,h,d,az,color)=>{
    o.position.set(x,y,z);o.rotation.set(0,az,0);o.scale.set(w,h,d);o.updateMatrix();
    leaves.push([o.matrix.clone(),color]);
  };
  const free=(x,z)=>!W.access.isDrivable(x,z);
  function shrub(x,z,w,h,d,az,color){
    const street=W.roadIndex.nearest(x,z,18,r=>r.drivable);
    const length=Math.max(.01,street?.distance||0);
    const nx=street?(x-street.x)/length:0,nz=street?(z-street.z)/length:0;
    for(let step=0;step<=2.8;step+=.4){
      const px=x+step*nx,pz=z+step*nz;
      const path=W.roadIndex.nearest(px,pz,4,r=>!r.drivable&&!r.bridge&&!r.tunnel);
      if(!free(px,pz)||path&&path.distance<path.s.road.width/2+Math.max(w,d)*.92)continue;
      crown(px,hAt(px,pz)+h*.61,pz,w,h,d,az,color);
      return;
    }
  }
  for(const [x,z,height,a] of pines){
    if(!free(x,z))continue;
    const soil=hAt(x,z),stem=new T.Vector3(x,soil-.08,z),fork=new T.Vector3(x+.20,soil+height*.23,z-.14);
    fixtures.rod(stem,fork,.29,0x5b4439);
    for(let i=0;i<6;i++){
      const phi=a+i*2.28,reach=height*(i===5?.18:.34+.075*(i%3));
      const vx=Math.sin(phi),vz=Math.cos(phi);
      const elbow=new T.Vector3(x+vx*reach*.60,soil+height*(.36+i*.028),z+vz*reach*.60);
      const tip=new T.Vector3(x+vx*reach,soil+height*(.68+i*.055),z+vz*reach);
      fixtures.rod(fork,elbow,i===5?.21:.13,0x634a3a);fixtures.rod(elbow,tip,.086,0x684e3d);
      for(let lobe=0;lobe<3;lobe++){
        const theta=phi+1.5*lobe,px=tip.x+Math.cos(theta)*1.0,pz=tip.z+Math.sin(theta)*1.02,py=tip.y+.35*(lobe%2);
        crown(px,py,pz,1.45+.18*lobe,.54+.11*lobe,1.22+.13*lobe,theta,0x334b38+lobe*0x030402);
        for(let k=0;k<4;k++){
          const ang=theta+k*1.56;
          o.position.set(px+Math.cos(ang)*1.02,py+.16,pz+Math.sin(ang)*.91);
          o.rotation.set(-.18,ang-Math.PI/2,.16*Math.sin(ang));o.scale.set(1.86,1.30,1);o.updateMatrix();
          sprays.push(o.matrix.clone());
        }
      }
    }
  }
  // Freestanding clipped shrubs trace the grass side of the sidewalk.
  // Break the row at the drive and crosswalk just south of the speed table.
  const oldPixels=[[456,39],[480,76],[505,111],[529,146],[551,181],[576,216],[597,251],[621,285],
    [645,321],[667,355],[691,391],[714,426],[736,460]];
  for(const [i,[px,py]] of oldPixels.entries()){
    const x=-66+(px-556.5)*.12021,z=73+(py-350)*.12021;
    shrub(x,z,1.24+.12*(i%3),.64,1.47,2.55,0x4c6532+i%3*0x030400);
  }
  for(const [a,b] of [[[-53.1,117.4],[-42.7,133.8]],[[225.8,333.5],[257.3,313.1]]]){
    const l=Math.hypot(b[0]-a[0],b[1]-a[1]);
    for(let k=0;k<l;k+=4.9){
      const x=mix(a[0],b[0],k/l),z=mix(a[1],b[1],k/l);
      shrub(x,z,1.25,.56,1.4,k,0x4e6239);
    }
  }
  // Mounded shrubs either side of the pale entrance walk on the west side.
  for(const [x,z,w] of [[-103.4,31.7,1.00],[-100.1,40.4,1.02],[-96.4,45.5,1.19],
    [-92.6,50.8,1.16],[-86.6,59.3,1.07],[-108.5,28.6,.94]]){
    shrub(x,z,w,.62,w*.88,1.25,0x52693d);
  }
  plantBatch(scene,'Central clipped shrubs and pine crowns',foliage(),leaves,true);
  fixtures.put(scene,'Central pine limbs');
  if(sprays.length){
    const geo=new T.PlaneGeometry(1,1);
    const mat=new T.MeshStandardMaterial({map:needles(),color:0x879b76,roughness:1,alphaTest:.40,side:T.DoubleSide});
    const m=new T.InstancedMesh(geo,mat,sprays.length);
    sprays.forEach((v,i)=>m.setMatrixAt(i,v));m.computeBoundingSphere();m.name='Central pine twig clusters';scene.add(m);
  }
}
