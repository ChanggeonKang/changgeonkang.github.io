import * as THREE from '../lib/three.module.min.js';
import {finishLandmarkMaterials} from './facade-materials.js';

export const designCentreId=1533773174;

// One repeated, staggered ceramic screen tile. The openings are small enough
// to reveal the dark recess, but never the landscape behind the closed hall.
function screenMaterial(){
  const size=64,rgba=new Uint8Array(size*size*4);
  for(let j=0;j<size;j++)for(let i=0;i<size;i++){
    const row=Math.floor(j/16),u=(i+16*(row%2))%32,v=j%16;
    const face=u>=2&&u<=30&&v>=1&&v<=11;
    const rod=u>=14&&u<=17;
    const shade=(i+j)%4+3*((Math.floor((i+16*(row%2))/32)+row)%3);
    const base=face?(v>8?73:91):42;
    rgba.set([base+shade,base*.64+shade,base*.55+shade,face||rod?255:0],4*(j*size+i));
  }
  const texture=new THREE.DataTexture(rgba,size,size);
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps=true;texture.needsUpdate=true;
  return new THREE.MeshStandardMaterial({map:texture,roughness:.87,side:THREE.DoubleSide,alphaTest:.36});
}

export function buildDesignCentre(scene,world,terrain,ground,makeMarkings){
  const building=world.D.buildings.find(b=>b.id===designCentreId);
  if(!building)return;
  // The mapped southwest corner and the adjoining N25 building locate the two
  // public street faces. The height is from the three-storey building permit.
  const [sw,se]=building.p;
  const width=Math.hypot(se[0]-sw[0],se[1]-sw[1]),depth=Math.hypot(building.p.at(-1)[0]-sw[0],building.p.at(-1)[1]-sw[1]);
  const tx=(se[0]-sw[0])/width,tz=(se[1]-sw[1])/width;
  const base=Math.min(terrain(...sw),terrain(...se))-.11,height=building.h;
  const point=(u,h,v)=>[sw[0]+tx*u+tz*v,base+h,sw[1]+tz*u-tx*v];
  const yaw=-Math.atan2(tz,tx),transform=new THREE.Object3D(),boxGeo=new THREE.BoxGeometry(1,1,1);
  const groups=new Map();
  function box(kind,u,h,v,w,t,d,color){
    if(!groups.has(kind))groups.set(kind,[]);
    transform.position.set(...point(u,h,v));transform.rotation.set(0,yaw,0);
    transform.scale.set(w,t,d);transform.updateMatrix();
    groups.get(kind).push([transform.matrix.clone(),color]);
  }
  // The rear step is the connection to the existing department. The front
  // lobby glazing is opaque with view-dependent highlights on all four sides.
  // Its solid backing also caps the atrium at every angle beneath the screen.
  const glass=0x36495a,frame=0x373b40,spandrel=0x273138,cap=0x474447;
  const u0=1.74,u1=width-.10,v0=1.83,v1=depth-.17;
  box('glass',(u0+u1)/2,(height-1.6)/2,(v0+v1)/2,u1-u0,height+1.4,v1-v0,glass);
  box('core',width-5.23,(height-2.3)/2,depth+1.89,10.47,height+1.15,4.12,0x77564c);
  box('core',(u0+u1)/2,height-.10,(v0+v1)/2,u1-u0+.15,.23,v1-v0+.15,cap);
  for(const h of [3.52,7.44,11.40,15.31]){
    box('core',(u0+u1)/2,h,v0-.05,u1-u0,.100,.13,frame);
    box('core',u0-.05,h,(v0+v1)/2,.13,.100,v1-v0,frame);
  }
  // Dark slab edges behind the curtain wall separate the three levels.
  for(const h of [5.53,10.97]){
    box('core',(u0+u1)/2,h,v0-.039,u1-u0,.60,.093,spandrel);
    box('core',u0-.039,h,(v0+v1)/2,.093,.60,v1-v0,spandrel);
  }
  const mullions=(a,b,fn)=>{
    const count=Math.round((b-a)/1.65);
    for(let i=0;i<=count;i++)fn(a+i*(b-a)/count);
  };
  mullions(u0,u1,u=>box('core',u,(height-.22)/2,v0-.104,.050,height-.2,.10,frame));
  mullions(v0,v1,v=>box('core',u0-.104,(height-.22)/2,v,.10,height-.2,.050,frame));
  // The street and the site rise at different rates. Put the white tiled
  // public terrace onto the *rendered* ground in small cells so the grass
  // cannot swallow it in the uphill half of the frontage.
  const plaza=makeMarkings(scene,ground,'Design Center · white paved terrace and west parallel bays');
  const plan=(u,v)=>{const p=point(u,0,v);return [p[0],p[2]];};
  const line=(u,v,s,t,w,color,lift)=>plaza.stripe(plan(u,v),plan(s,t),w,color,lift);
  function tiles(u0,u1,v0,v1){
    const cols=Math.ceil((u1-u0)/.66),rows=Math.ceil((v1-v0)/.66);
    for(let i=0;i<cols;i++)for(let j=0;j<rows;j++){
      const a=u0+i*(u1-u0)/cols,b=u0+(i+1)*(u1-u0)/cols,c=v0+j*(v1-v0)/rows,d=v0+(j+1)*(v1-v0)/rows;
      plaza.quad(plan(a,c),plan(b,c),plan(b,d),plan(a,d),0xa9aaa6,.082);
      plaza.quad(plan(a+.010,c+.010),plan(b-.010,c+.010),plan(b-.010,d-.010),plan(a+.010,d-.010),
        [0xdeddd7,0xd8d7d1,0xe4e2db][(i*31+j*7)%3],.086);
    }
  }
  tiles(-1.10,2.05,-2.68,depth+.80);
  tiles(2.05,width,-2.68,2.06);
  const white=0xe8e7e2,front=-3.49,end=depth+.73,outer=-4.94,inner=-1.35;
  // One blue accessible stall at the south corner followed by ordinary,
  // end-to-end parallel spaces. The shared side aisle is hatched.
  for(let j=0;j<10;j++){
    const a=front+j*.56,b=a+.56;
    plaza.quad(plan(outer,a),plan(inner,a),plan(inner,b),plan(outer,b),0x286db1,.031);
  }
  for(const u of [outer,inner])line(u,front,u,end,.105,white,.058);
  for(const v of [front,front+5.60,front+11.28,front+16.98,end])line(outer,v,inner,v,.105,white,.058);
  line(inner-.97,front,inner-.97,front+5.60,.085,white,.058);
  for(let v=front+.13;v+.80<front+5.6;v+=1.08)line(inner-.96,v,inner,v+.80,.08,white,.058);
  const wc=(a,b,c,d,w=.105)=>line(outer+1.37+a,front+2.26+b,outer+1.37+c,front+2.26+d,w,white,.065);
  const ring=(x,y,r,a,b,w)=>{
    const n=Math.ceil(Math.abs(b-a)*r/.13);
    for(let i=0;i<n;i++){const l=a+(b-a)*i/n,h=a+(b-a)*(i+1)/n;wc(x+r*Math.cos(l),y+r*Math.sin(l),x+r*Math.cos(h),y+r*Math.sin(h),w);}
  };
  ring(-.07,-.11,.48,.68,Math.PI*1.92,.135);ring(-.05,.57,.085,0,2*Math.PI,.105);
  wc(-.09,.40,-.07,-.02);wc(-.07,-.02,.28,-.02);wc(.28,-.02,.48,-.40);wc(.48,-.40,.64,-.34);
  plaza.finish();
  for(let v=-2.14;v<depth;v+=1.72){
    const [x,z]=plan(-.95,v);
    if(world.access.isDrivable(x,z))continue;
    const foot=ground(x,z)-base+.088;
    box('core',-.95,foot+.40,v,.11,.80,.11,0x303740);
    for(const h of [.57,.69])box('core',-.95,foot+h,v,.115,.043,.115,0xb8c0c2);
  }

  const surface=[],uv=[],liner=[];
  const quad=(target,a,b,c,d)=>{for(const p of [a,b,c,a,c,d])target.push(...p);};
  function face(length,at,openings){
    const inner=.21,outer=0,bottom=-.22;
    function panel(a,b,ha,hb){
      if(b-a<.0001)return;
      quad(surface,at(a,ha,outer),at(b,hb,outer),at(b,height,outer),at(a,height,outer));
      for(const p of [[a,ha],[b,hb],[b,height],[a,ha],[b,height],[a,height]])uv.push(p[0]/.63,p[1]/.49);
      quad(liner,at(a,ha,inner),at(b,hb,inner),at(b,hb,outer),at(a,ha,outer));
    }
    let last=0;
    for(const [centre,radius,spring,crown] of openings){
      const left=Math.max(0,centre-radius),right=Math.min(length,centre+radius);
      const arc=u=>spring+(crown-spring)*Math.sqrt(Math.max(0,1-((u-centre)/radius)**2));
      if(left>last)panel(last,left,bottom,bottom);
      if(left>0)quad(liner,at(left,bottom,outer),at(left,spring,outer),at(left,spring,inner),at(left,bottom,inner));
      const steps=Math.max(16,Math.ceil((right-left)/.21));
      for(let k=0;k<steps;k++){
        const a=left+(right-left)*k/steps,b=left+(right-left)*(k+1)/steps;
        panel(a,b,arc(a),arc(b));
      }
      if(right<length)quad(liner,at(right,bottom,outer),at(right,spring,outer),at(right,spring,inner),at(right,bottom,inner));
      last=right;
    }
    if(last<length)panel(last,length,bottom,bottom);
    quad(liner,at(0,height,outer),at(length,height,outer),at(length,height,inner),at(0,height,inner));
  }
  // Both half-arches meet at the high southwest corner. Their geometry is
  // independent of the staggered tile perforations drawn on the spandrels.
  face(width,(u,h,inset)=>point(u,h,inset),[[0,4.24,7.67,15.84],[9.71,4.40,5.39,10.25],
    [19.22,4.34,5.56,10.40],[28.50,4.11,7.53,12.82]]);
  face(depth,(v,h,inset)=>point(inset,h,v),[[0,5.41,7.67,15.84],[13.15,5.45,5.70,12.17]]);
  function mesh(name,positions,material,textureCoordinates){
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    if(textureCoordinates)geometry.setAttribute('uv',new THREE.Float32BufferAttribute(textureCoordinates,2));
    geometry.computeVertexNormals();geometry.computeBoundingSphere();
    const m=new THREE.Mesh(geometry,material);m.name=name;m.castShadow=true;m.receiveShadow=true;scene.add(m);
  }
  mesh('N25-1 perforated arch screen',surface,screenMaterial(),uv);
  mesh('N25-1 curved arch reveals',liner,new THREE.MeshStandardMaterial({color:0x5a3830,roughness:.91,side:THREE.DoubleSide}));
  const color=new THREE.Color();
  for(const [kind,items] of groups){
    const material=new THREE.MeshStandardMaterial(kind==='glass'?{roughness:.32,metalness:.17}:{roughness:.85});
    const m=new THREE.InstancedMesh(boxGeo,material,items.length);
    m.name=kind==='glass'?'N25-1-glass':'N25-1 structure';
    items.forEach(([matrix,tint],i)=>{m.setMatrixAt(i,matrix);m.setColorAt(i,color.set(tint));});
    m.computeBoundingSphere();m.castShadow=true;m.receiveShadow=true;
    scene.add(m);if(kind==='glass')finishLandmarkMaterials([m]);
  }
}
