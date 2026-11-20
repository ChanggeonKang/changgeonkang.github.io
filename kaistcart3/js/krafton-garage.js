import * as T from '../lib/three.module.min.js';
import { FixtureInstances } from './survey-fixture-instances.js';

// FoSSrk, WNAIQBQ and dL4nZS (November 2026), plus the overhead footprint.
// The mapped lift gate divides the public approach from the covered garage.
const x0=315,z0=308.7,dx=-.54304,dz=-.83971;
const map=(s,q)=>[x0+dx*s+dz*q,z0+dz*s-dx*q];
const smooth=t=>t*t*(3-2*t);
export function garageCut(x,z){
  if(x<286||x>321||z<273||z>310)return 0;
  const s=(x-x0)*dx+(z-z0)*dz,q=(x-x0)*dz-(z-z0)*dx;
  if(s<=2.4||s>39||Math.abs(q)>5.9)return 0;
  const depth=Math.min(3.12,Math.max(0,s-2.4)*.118);
  return depth*smooth(Math.min(1,(s-2.4)/3))*smooth(Math.min(1,(39-s)/3))*
    smooth(Math.min(1,(5.9-Math.abs(q))/2.65));
}

export function buildKraftonGarage(scene,hAt,pavement){
  const fixtures=new FixtureInstances(),yaw=Math.atan2(dx,dz);
  const pos=[],colors=[],colour=new T.Color();
  const ground=(s,q)=>hAt(...map(s,q));
  const outside=(s,q)=>ground(s,q)+garageCut(...map(s,q));
  const pt=(s,q,y)=>{const [x,z]=map(s,q);return new T.Vector3(x,y,z);};
  function quad(a,b,c,d,color){
    colour.setHex(color);
    for(const v of [a,b,c,a,c,d]){pos.push(v.x,v.y,v.z);colors.push(colour.r,colour.g,colour.b);}
  }
  const roofLow=15.25,roofEnd=33.6,roofWidth=3.66;
  const roof=(s,q)=>outside(s,0)+1.77-.074*(s-roofLow)+.13*(1-(q/roofWidth)**2);
  for(const side of [-1,1]){
    for(let s=4;s<roofEnd;s+=1){
      const t=Math.min(roofEnd,s+1),q=side*2.94,v=side*3.15;
      const lip=(u,q)=>outside(u,q)+.28;
      quad(pt(s,q,ground(s,q)+.10),pt(t,q,ground(t,q)+.10),pt(t,q,lip(t,q)),pt(s,q,lip(s,q)),0xbfc0b7);
      quad(pt(s,q,lip(s,q)),pt(t,q,lip(t,q)),pt(t,v,lip(t,v)),pt(s,v,lip(s,v)),0xd6d7ca);
    }
    for(let s=roofLow;s<roofEnd+.1;s+=3.60){
      const q=side*(roofWidth-.13);
      fixtures.rod(pt(s,q,ground(s,q)-.06),pt(s,q,roof(s,q)),.077,0xb5bcbc);
    }
  }
  // Beyond the public gate only the visible, descending interior is drawn.
  // The threshold keeps its mapped vehicle restriction.
  for(let s=15.2;s<roofEnd;s+=1){
    const t=Math.min(roofEnd,s+1);
    quad(pt(s,-2.92,ground(s,-2.92)+.15),pt(t,-2.92,ground(t,-2.92)+.15),
      pt(t,2.92,ground(t,2.92)+.15),pt(s,2.92,ground(s,2.92)+.15),0x4e5351);
  }
  // The yellow divider continues down the ramp from the crossing. Sample both
  // deck sections at the join so neither the paint nor the divider floats.
  const laneMark=(s,q)=>{
    const [x,z]=map(s,q);
    const top=s<15.2?pavement(x,z):Math.max(ground(s,q)+.15,pavement(x,z));
    return pt(s,q,top+.019);
  };
  for(let s=3.4;s<28.1;s+=.4){
    const t=Math.min(28.1,s+.4);
    quad(laneMark(s,-.079),laneMark(t,-.079),laneMark(t,.079),laneMark(s,.079),0xdcb252);
  }
  for(let q=.12;q<2.88;q+=.34){
    const v=Math.min(2.88,q+.34);
    quad(laneMark(4.95,q),laneMark(5.23,q),laneMark(5.23,v),laneMark(4.95,v),0xe2dfd1);
  }
  for(let r=0;r<6;r++){
    const a=-roofWidth+r*(roofWidth/3),b=a+roofWidth/3;
    for(let s=roofLow;s<roofEnd;s+=1.18){
      const t=Math.min(roofEnd,s+1.18);
      quad(pt(s,a,roof(s,a)),pt(t,a,roof(t,a)),pt(t,b,roof(t,b)),pt(s,b,roof(s,b)),r%3?0xc8cecb:0xbec5c1);
    }
  }
  for(let s=roofLow;s<roofEnd+.1;s+=1.18){
    fixtures.rod(pt(s,-roofWidth,roof(s,-roofWidth)-.045),pt(s,0,roof(s,0)-.045),.044,0x879192);
    fixtures.rod(pt(s,0,roof(s,0)-.045),pt(s,roofWidth,roof(s,roofWidth)-.045),.044,0x879192);
  }
  for(const side of [-1,1])fixtures.rod(pt(roofLow,side*roofWidth,roof(roofLow,side*roofWidth)-.07),
    pt(roofEnd,side*roofWidth,roof(roofEnd,side*roofWidth)-.07),.095,0xa1aaa6);
  // Two lanes enter a short, shaded throat beneath a concrete lintel.
  // The garage closes behind that recess instead of opening onto the sky.
  quad(pt(roofEnd,-2.95,ground(roofEnd,-2.95)),pt(roofEnd,2.95,ground(roofEnd,2.95)),
    pt(roofEnd,2.95,roof(roofEnd,2.95)),pt(roofEnd,-2.95,roof(roofEnd,-2.95)),0x202526);
  const portal=28.1,portalTop=ground(portal,0)+2.41;
  quad(pt(portal,-2.94,portalTop),pt(portal,2.94,portalTop),pt(portal,2.94,roof(portal,2.94)),
    pt(portal,-2.94,roof(portal,-2.94)),0xb0b2a8);
  for(const q of [-2.92,.0,2.92]){
    const t=roofEnd-.45,y=ground(portal,q)+.11,r=q===0?.10:.13;
    quad(pt(portal,q-r,y),pt(portal,q+r,y),pt(portal,q+r,portalTop),pt(portal,q-r,portalTop),0xa8a9a0);
    for(const k of [-1,1])quad(pt(portal,q+k*r,y),pt(t,q+k*r,ground(t,q)+.10),
      pt(t,q+k*r,ground(t,q)+2.42),pt(portal,q+k*r,portalTop),q===0?0x6c7170:0x555a59);
  }
  quad(pt(portal,-2.9,portalTop),pt(portal,2.9,portalTop),pt(roofEnd,2.9,ground(roofEnd,0)+2.42),
    pt(roofEnd,-2.9,ground(roofEnd,0)+2.42),0x4e504c);
  for(let s=22;s<33;s+=5)fixtures.box(pt(s,0,roof(s,0)-.12),1.25,.048,.095,yaw,0xe1dcbb);
  const g=new T.BufferGeometry();
  g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  g.computeVertexNormals();g.computeBoundingSphere();
  const m=new T.Mesh(g,new T.MeshStandardMaterial({vertexColors:true,roughness:.88,side:T.DoubleSide}));
  m.name='KRAFTON covered parking ramp';m.castShadow=true;m.receiveShadow=true;scene.add(m);
  fixtures.put(scene,'KRAFTON garage canopy supports');
  const paint=[],texCoords=[];
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=512;
  const pen=canvas.getContext('2d');
  pen.fillStyle='#dfdfd4';pen.textAlign='center';pen.font='bold 37px Arial';
  for(const [q,label] of [[65,'OUT'],[191,'IN']]){
    pen.fillText(label,q,167);
    pen.save();pen.translate(q,256);if(label==='OUT')pen.rotate(Math.PI);
    pen.beginPath();pen.moveTo(-8,52);pen.lineTo(8,52);pen.lineTo(8,-13);
    pen.lineTo(25,-13);pen.lineTo(0,-61);pen.lineTo(-25,-13);pen.lineTo(-8,-13);
    pen.closePath();pen.fill();pen.restore();
  }
  const ink=new T.CanvasTexture(canvas);ink.colorSpace=T.SRGBColorSpace;ink.anisotropy=4;
  function vertex(s,q,v,u){
    const [x,z]=map(s,q);paint.push(x,pavement(x,z)+.016,z);texCoords.push(u,v);
  }
  for(let j=0;j<16;j++)for(let i=0;i<6;i++){
    for(const [a,b] of [[i,j],[i+1,j],[i,j+1],[i+1,j],[i+1,j+1],[i,j+1]]){
      const u=a/6,v=b/16;vertex(3.2+8.4*v,2.65-5.3*u,v,u);
    }
  }
  const paintGeometry=new T.BufferGeometry();paintGeometry.setAttribute('position',new T.Float32BufferAttribute(paint,3));
  paintGeometry.setAttribute('uv',new T.Float32BufferAttribute(texCoords,2));paintGeometry.computeBoundingSphere();
  const arrows=new T.Mesh(paintGeometry,new T.MeshBasicMaterial({map:ink,transparent:true,depthWrite:false,side:T.DoubleSide}));
  arrows.name='KRAFTON garage entrance arrows';arrows.renderOrder=7;scene.add(arrows);
}
