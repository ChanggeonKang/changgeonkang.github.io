import * as T from '../lib/three.module.min.js';
import {FixtureInstances} from './survey-fixture-instances.js';
import {foliage,plantBatch} from './gate-avenue-garden.js';

// At street level uiy5hVN and q5cr8cF both show the plaza flowing
// from the sidewalk to the broad stair at mapped entrance 1525226904.
const court=[[-76.7,-183.6],[-52.5,-200.9],[-54.6,-209.1],[-75.1,-202.2]];
const flight=[court[3],court[2],[-57.5,-218.0],[-76.6,-211.5]];
const mix=(a,b,t)=>a+(b-a)*t;
const lerp=(a,b,t)=>[mix(a[0],b[0],t),mix(a[1],b[1],t)];
const section=(p,u,v)=>lerp(lerp(p[0],p[1],u),lerp(p[3],p[2],u),v);
function inside(p,x,z){
  let hit=false;
  for(let i=0,j=p.length-1;i<p.length;j=i++){
    const [ax,az]=p[i],[bx,bz]=p[j];
    if((az>z)!==(bz>z) && x<ax+(z-az)*(bx-ax)/(bz-az))hit=!hit;
  }
  return hit;
}
export function inSportsCourt(x,z){
  return x>=-77 && x<=-52 && z>=-219 && z<=-183 && (inside(court,x,z)||inside(flight,x,z));
}
function stoneTexture(){
  const cv=document.createElement('canvas');cv.width=256;cv.height=256;
  const c=cv.getContext('2d');c.fillStyle='#a58d91';c.fillRect(0,0,256,256);
  for(let row=0;row<16;row++)for(let col=-1;col<16;col++){
    const shade=.5+.5*Math.sin(row*23.73+((col+16)%16)*42.3);
    c.fillStyle=`rgb(${95+Math.round(42*shade)} ${64+Math.round(35*shade)} ${69+Math.round(36*shade)})`;
    c.fillRect(col*16+(row%2)*8,row*16,15.3,15.3);
  }
  const tex=new T.CanvasTexture(cv);tex.wrapS=tex.wrapT=T.RepeatWrapping;
  tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=4;return tex;
}

export function buildSportsPlaza(scene,W,terrain){
  const fixtures=new FixtureInstances(),leaves=[],vertical=new T.Vector3(0,1,0);
  function crown(x,y,z,w,h,d,angle,c){
    const rotation=new T.Quaternion().setFromAxisAngle(vertical,angle);
    leaves.push([new T.Matrix4().compose(new T.Vector3(x,y,z),rotation,new T.Vector3(w,h,d)),c]);
  }
  function tiledSurface(ring,n,m,texture,colour,height,label){
    const coords=[],faces=[],uv=[];
    for(let i=0;i<=m;i++)for(let j=0;j<=n;j++){
      const [x,z]=section(ring,j/n,i/m),y=height(x,z,i/m,j/n);
      coords.push(x,y,z);uv.push((x*.83-z*.56)/2.55,(x*.56+z*.83)/2.55);
      if(j<n&&i<m){const k=i*(n+1)+j;faces.push(k,k+n+1,k+1,k+1,k+n+1,k+n+2);}
    }
    const dx=ring[1][0]-ring[0][0],dz=ring[1][1]-ring[0][1];
    if((ring[3][1]-ring[0][1])*dx-(ring[3][0]-ring[0][0])*dz<0){
      for(let i=0;i<faces.length;i+=3)[faces[i+1],faces[i+2]]=[faces[i+2],faces[i+1]];
    }
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(coords,3));
    g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(faces);g.computeVertexNormals();
    const mesh=new T.Mesh(g,new T.MeshStandardMaterial({map:texture,color:colour,side:T.DoubleSide,roughness:.92}));
    mesh.name=label;mesh.receiveShadow=true;scene.add(mesh);
  }
  const approach=(x,z)=>terrain(x,z)+.255;
  const paving=stoneTexture();
  tiledSurface(court,12,11,paving,0xffffff,approach,'N3 burgundy stone forecourt');
  // This section of the north-side sidewalk joins the forecourt across
  // its full width. The field access and adjacent zebra remain open.
  const avenue=(s,q)=>[-63.8+.812*s-.583*q,-179.6-.583*s-.812*q];
  const sidewalk=[avenue(-11,6.4),avenue(27,6.4),avenue(27,11.7),avenue(-11,11.7)];
  tiledSurface(sidewalk,24,4,paving,0xf0ede4,(x,z)=>terrain(x,z)+.271,'N3 street-side paving');
  const plazaCrossings=W.explore.crossings.filter(([x,z])=>x>-99&&x<21&&z>-241&&z<-157);
  const railTint=0x4d5253;
  const qn=new T.Quaternion().setFromUnitVectors(vertical,new T.Vector3(.583,0,.812).normalize());
  function railSide(from,to,q){
    const steps=Math.floor((to-from)/2.22),span=(to-from)/steps;
    const edge=(s,h)=>{const [x,z]=avenue(s,q);return new T.Vector3(x,terrain(x,z)+.27+h,z);};
    const tested=[];
    for(let i=0;i<steps;i++){
      const a=from+span*i,b=a+span,mid=(a+b)*.5,[x,z]=avenue(mid,q);
      if(W.access.isDrivable(x,z)||plazaCrossings.some(([cx,cz])=>Math.hypot(cx-x,cz-z)<7.4))continue;
      const nearest=W.roadIndex.nearest(x,z,12,r=>r.drivable);
      if(!nearest||nearest.distance<nearest.s.road.width*.5)continue;
      tested.push([a,b]);
      fixtures.rod(edge(a,.02),edge(a,.89),.041,railTint);
      fixtures.rod(edge(a,.16),edge(b,.16),.027,railTint);
      fixtures.rod(edge(a,.62),edge(b,.62),.024,railTint);
      for(let j=0;j<4;j++){
        const h=k=>.84+.087*Math.sin(Math.PI*k/4);
        fixtures.rod(edge(a+span*j/4,h(j)),edge(a+span*(j+1)/4,h(j+1)),.032,railTint);
      }
      for(const f of [.24,.73]){
        const place=edge(a+span*f,.48);
        fixtures.item('disk',new T.Matrix4().compose(place,qn,new T.Vector3(.157,.036,.157)),0x5f6667);
        fixtures.item('disk',new T.Matrix4().compose(place,qn,new T.Vector3(.136,.042,.136)),0xcdd0c6);
      }
    }
    return tested;
  }
  W.sportsPlazaRail=[...railSide(-10,70,6.78),...railSide(13,68,-6.84)];
  // One signal mast and the parallel street-name signs are in the November
  // panorama facing west. The horizontal signal arm clears the vehicle lane.
  const mast=avenue(4.7,8.3),mastY=terrain(...mast)+.24;
  const post=new T.Vector3(mast[0],mastY,mast[1]),head=post.clone();head.y+=7.23;
  fixtures.rod(post,head,.13,0x656c6c);
  const end=head.clone().add(new T.Vector3(4.1,-.05,5.72));
  fixtures.rod(head,end,.102,0x626868);
  const signYaw=Math.atan2(.812,-.583);
  fixtures.box(end.clone().add(new T.Vector3(0,-.30,0)),1.21,.43,.25,signYaw,0x343735);
  function sign(text,at,yaw,width){
    const panel=document.createElement('canvas');panel.width=512;panel.height=84;
    const g=panel.getContext('2d');g.fillStyle='#314990';g.fillRect(0,0,512,84);
    g.strokeStyle='#d1d7d6';g.lineWidth=4;g.strokeRect(3,3,506,78);g.fillStyle='#f2f1e9';
    g.textAlign='center';g.font='bold 34px Arial';g.fillText(text,256,55);
    const map=new T.CanvasTexture(panel);map.colorSpace=T.SRGBColorSpace;map.anisotropy=4;
    const plate=new T.Mesh(new T.BoxGeometry(width,.4,.045),new T.MeshStandardMaterial({map,roughness:.64}));
    plate.name='N3 street name';plate.position.copy(at);plate.rotation.y=yaw;scene.add(plate);
  }
  sign('Daehak-ro 291beon-gil',post.clone().add(new T.Vector3(.62,5.65,.84)),signYaw,2.25);
  sign('Daehak-ro 291beon-gil',post.clone().add(new T.Vector3(-.74,5.25,.55)),signYaw+Math.PI/2,2.12);
  const count=16,positions=[],normals=[],colours=[],color=new T.Color();
  function quad(a,b,c,d,normal,tint){
    color.setHex(tint);for(const v of [a,b,c,a,c,d]){
      positions.push(v[0],v[1],v[2]);normals.push(...normal);colours.push(color.r,color.g,color.b);
    }
  }
  const point=(u,v,i)=>{
    const [x,z]=section(flight,u,v),bottom=lerp(flight[0],flight[1],u),top=lerp(flight[3],flight[2],u);
    const y0=approach(...bottom),rise=Math.max(2.3,terrain(...top)+.33-y0);
    return [x,y0+i*rise/count,z];
  };
  const ax=flight[1][0]-flight[0][0],az=flight[1][1]-flight[0][1],length=Math.hypot(ax,az);
  const face=[-az/length,0,ax/length];
  for(let i=1;i<=count;i++)for(let j=0;j<11;j++){
    const u=j/11,w=(j+1)/11,v=(i-1)/count,next=i/count;
    quad(point(u,v,i),point(w,v,i),point(w,next,i),point(u,next,i),[0,1,0],i%3?0xaaa7a1:0xb1ada5);
    quad(point(u,v,i-1),point(w,v,i-1),point(w,v,i),point(u,v,i),face,0x88857f);
  }
  const stone=new T.BufferGeometry();
  for(const [name,values] of [['position',positions],['normal',normals],['color',colours]])stone.setAttribute(name,new T.Float32BufferAttribute(values,3));
  const steps=new T.Mesh(stone,new T.MeshStandardMaterial({vertexColors:true,side:T.DoubleSide,roughness:.9}));
  steps.receiveShadow=true;steps.name='N3 wide granite steps';scene.add(steps);
  // Thin timber benches face the approach. Shrub beds and the mature pine
  // trunks sit behind them, keeping the full width of the stone plaza open.
  const leftA=[-77.7,-186.2],leftB=[-76.9,-201.2];
  function bench(p,yaw){
    const y=approach(...p),across=[Math.cos(yaw),-Math.sin(yaw)],back=[Math.sin(yaw),Math.cos(yaw)];
    const at=(u,v,h)=>new T.Vector3(p[0]+across[0]*u+back[0]*v,y+h,p[1]+across[1]*u+back[1]*v);
    for(const u of [-.75,.75])for(const v of [-.19,.19])fixtures.box(at(u,v,.2),.055,.4,.075,yaw,0x41413d);
    for(let i=0;i<4;i++)fixtures.box(at(0,-.20+i*.13,.45),2.13,.082,.11,yaw,0x775541);
    for(const u of [-.75,.75])fixtures.box(at(u,.22,.65),.055,.45,.055,yaw,0x41413d);
    for(const h of [.66,.83])fixtures.box(at(0,.245,h),2.13,.115,.065,yaw,0x795941);
  }
  for(const t of [.11,.36,.61,.87])bench(lerp(leftA,leftB,t),-Math.PI/2);
  function pine(x,z,height,angle){
    if(W.access.isDrivable(x,z))return;
    const path=W.roadIndex.nearest(x,z,3,r=>!r.drivable);
    if(path && path.distance<path.s.road.width*.5+.14)return;
    const y=terrain(x,z),bx=x+.45*Math.cos(angle),bz=z+.45*Math.sin(angle);
    fixtures.rod(new T.Vector3(x,y-.06,z),new T.Vector3(bx,y+height*.66,bz),height*.018,0x604e42);
    for(let j=0;j<6;j++){
      const phase=angle+j*2.32,spread=j===5?.16:height*(.17+.045*(j%3));
      const px=bx+Math.sin(phase)*spread,pz=bz+Math.cos(phase)*spread,py=y+height*(.67+.059*j);
      fixtures.rod(new T.Vector3(bx,y+height*(.50+.045*j),bz),new T.Vector3(px,py,pz),.09,0x634f3d);
      crown(px,py,pz,2.0+.34*(j%3),.92,2.17,phase,0x344837+j*0x020302);
    }
  }
  for(const [x,z,h,a] of [[-80.5,-195.7,11.4,1.8],[-82,-190.6,10.7,.48],[-81.8,-201.2,12.1,2.9],
    [-82.8,-206.7,9.4,4.2],[-86.7,-194.9,10.2,.2],[-88.4,-199.1,10.6,3.5]])pine(x,z,h,a);
  for(let i=0;i<20;i++){
    const p=lerp([-80,-184.6],[-79.4,-202.7],i/19),x=p[0]-.72*Math.sin(i*2.3)**2,z=p[1];
    crown(x,terrain(x,z)+.51,z,1.35,.78,1.42,i,0x545539+i%4*0x040200);
  }
  plantBatch(scene,'N3 plaza pines and shrub beds',foliage(),leaves,true);
  fixtures.put(scene,'N3 garden benches and trunks');
}
