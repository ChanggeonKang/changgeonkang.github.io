import * as THREE from '../lib/three.module.min.js';
import {buildingProfile} from './campus-identity.js';

// Facade families seen from the public campus viewpoints indexed in road-views.json.
// The source footprint, building height and entrances still come from the campus model.
export const streetviewPalette={
  E14:[0xd4cec3,1], 'N13-1':[0xaf523a,1], 'N7-2':[0xcac9bf,1], N25:[0x9b5948,0],
  W2:[0xd5d1c6,1], W7:[0xd2cdc1,0], N21:[0x9e6657,0], N4:[0x915843,0], W8:[0xcccdc7,0],
  E8:[0xd3d0c6,0], N12:[0x8c5849,0], E21:[0x88a7ae,2], E5:[0xc4c7c7,1],
  N26:[0x93aab0,2], N18:[0x966553,0], N7:[0x9baca7,1], W1:[0xa1b4b9,1],
  E15:[0x975844,0], W10:[0xe0e0d6,0], 'W5-4':[0xdad5c9,0], N22:[0xc8c9c4,1]
};
const frontages={
  E14:{view:[-54.3,-42.9],type:'administration'}, 'N7-2':{view:[-343.2,-209.4],type:'ribbons'},
  W2:{view:[-39.1,280.7],type:'eaves'}, N12:{view:[-208.3,-482.6],type:'hall'},
  E21:{view:[669.9,58.7],type:'clinic'}, N22:{view:[196.5,-544.7],type:'ribbons'},
  W10:{view:[-476.7,-169.2],type:'workshop'}, N21:{view:[-305.7,-629.4],type:'garden'},
  N26:{view:[-36.4,-573.8],type:'portico'}, 'W5-4':{view:[-579.1,17.8],type:'village'},
  N4:{view:[19.5,-374],type:'stairwell'}
};
function facade(b,view){
  const ring=b.p,sign=Math.sign(ring.reduce((a,p,i)=>{const q=ring[(i+1)%ring.length];return a+p[0]*q[1]-q[0]*p[1];},0));
  let chosen=null,best=Infinity;
  for(let i=0;i<ring.length;i++){
    const a=ring[i],c=ring[(i+1)%ring.length],len=Math.hypot(c[0]-a[0],c[1]-a[1]);if(len<4)continue;
    const tx=(c[0]-a[0])/len,tz=(c[1]-a[1])/len,nx=tz*sign,nz=-tx*sign;
    const u=Math.max(.04,Math.min(.96,((view[0]-a[0])*tx+(view[1]-a[1])*tz)/len));
    const x=a[0]+tx*u*len,z=a[1]+tz*u*len,ex=view[0]-x,ez=view[1]-z;
    if(ex*nx+ez*nz<0)continue;
    const score=Math.hypot(ex,ez)+Math.max(0,13-len)*.8;
    if(score<best){best=score;chosen={a,c,len,tx,tz,nx,nz};}
  }
  return chosen;
}

export function buildStreetviewDetails(scene,D,hAt,surfaceAt){
  const instances=[],foliage=[],trunks=[], dummy=new THREE.Object3D(), shade=new THREE.Color();
  for(const b of D.buildings){
    const profile=frontages[b.ref];if(!profile)continue;
    const f=facade(b,profile.view);if(!f)continue;
    const {a,c,tx,tz,nx,nz,len}=f, mx=(a[0]+c[0])/2,mz=(a[1]+c[1])/2;
    const heights=b.p.map(p=>hAt(...p)),grade=(Math.min(...heights)+Math.max(...heights))/2,base=hAt(mx,mz),height=buildingProfile(b).height,top=grade+height-base;
    const yaw=-Math.atan2(tz,tx);
    const panel=(along,y,out,width,h,depth,color)=>{
      dummy.position.set(mx+tx*along+nx*out,base+y,mz+tz*along+nz*out);
      dummy.rotation.set(0,yaw,0);dummy.scale.set(width,h,depth);dummy.updateMatrix();
      instances.push({matrix:dummy.matrix.clone(),color});
    };
    const wide=Math.min(len*.78,12);
    const glazing=(y,h,w=wide,color=0x3b6470)=>{
      panel(0,y,.13,w,h,.2,color);
      for(let i=0,n=Math.ceil(w/2.15);i<=n;i++)panel(-w*.5+i*w/n,y,.29,.12,h,.18,0x9aa7a4);
    };
    // Topiary along these photographed frontages grows in planting strips.
    // Leave breaks for entrances and reject candidates on mapped paving.
    if(['administration','garden','village','portico','workshop'].includes(profile.type)){
      for(let along=-len*.45;along<len*.48;along+=profile.type==='garden'?4.4:5.5){
        if(Math.abs(along)<Math.min(4.5,len*.19))continue;
        for(const setback of [2.6,3.8,5.2]){
          const x=mx+tx*along+nx*setback,z=mz+tz*along+nz*setback;
          if(surfaceAt(x,z)!==0||surfaceAt(x+1,z)!==0||surfaceAt(x-1,z)!==0||surfaceAt(x,z+1)!==0||surfaceAt(x,z-1)!==0)continue;
          const bottom=hAt(x,z),tier=profile.type==='garden'||profile.type==='village';
          trunks.push([x,bottom+.65,z,.12,1.3,.12]);
          foliage.push([x,bottom+1.65,z,1.12,.67,1.03]);
          if(tier){foliage.push([x-.40,bottom+1,z+.20,.88,.38,.84],[x+.32,bottom+2.26,z-.08,.64,.39,.67]);}break;
        }
      }
    }
    if(profile.type==='portico'){
      const width=Math.min(len*.72,8);panel(0,3.65,1.3,width,.32,2.8,0xc8cdca);
      for(const t of [-1,1])panel(t*(width/2-.28),1.8,2.37,.37,3.6,.37,0x647478);
    }else if(profile.type==='administration'){
      glazing(2.5,4.9);panel(0,5.0,1.65,wide+1,.32,3.6,0xc8c4ad);
      for(const t of [-1,1])panel(t*wide*.48,2.42,1.55,.43,4.84,.48,0x496071);
    }else if(profile.type==='ribbons'||profile.type==='clinic'){
      for(let y=3.15;y<top-.8;y+=3.65)panel(0,y,.20,len*.97,.44,.56,0xd6d5cd);
      if(profile.type==='clinic')glazing(1.43,2.8,len*.85,0x3a788a);
    }else if(profile.type==='eaves'){
      panel(0,top+.06,.45,len*.99,.43,1.28,0x333a3b);glazing(top*.63,1.15,len*.88);
    }else if(profile.type==='workshop'){
      for(const t of [-.24,.24]){const h=3.0,w=Math.min(len*.28,4);panel(t*len,h*.5,.13,w,h,.20,0x6e7e83);for(let y=.3;y<h;y+=.36)panel(t*len,y,.24,w,.035,.035,0x48575c);}
    }else if(profile.type==='village'){
      panel(-len*.26,top*.52,.13,Math.min(2.5,len*.16),top*.90,.2,0xd2a14d);
    }else if(profile.type==='stairwell'){
      glazing(top*.49,top*.91,Math.min(3.2,wide),0x55808a);panel(0,3.1,.63,Math.min(5.5,wide),.28,1.45,0x909b97);
    }else if(profile.type==='hall'){
      glazing(1.2,2.4,Math.min(5,wide));panel(0,3.05,.48,Math.min(7.5,wide),.24,1.20,0x6b6058);
      const cv=document.createElement('canvas');cv.width=256;cv.height=96;const ctx=cv.getContext('2d');ctx.fillStyle='#bc3d46';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 80px Arial';ctx.fillText('N12',128,51);
      const tex=new THREE.CanvasTexture(cv);tex.colorSpace=THREE.SRGBColorSpace;
      const sign=new THREE.Mesh(new THREE.PlaneGeometry(3.15,1.18),new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false}));
      sign.position.set(mx+nx*.20,base+Math.min(top-.9,6.8),mz+nz*.20);sign.rotation.y=Math.atan2(nx,nz);scene.add(sign);
    }
  }
  const plants=(items,geometry,color,name)=>{
    if(!items.length)return;
    const batch=new THREE.InstancedMesh(geometry,new THREE.MeshStandardMaterial({color,roughness:1}),items.length);
    items.forEach(([x,y,z,sx,sy,sz],i)=>{dummy.position.set(x,y,z);dummy.rotation.set(0,i*2.1,0);dummy.scale.set(sx,sy,sz);dummy.updateMatrix();batch.setMatrixAt(i,dummy.matrix);});
    batch.castShadow=batch.receiveShadow=true;batch.name=name;scene.add(batch);
  };
  plants(foliage,new THREE.IcosahedronGeometry(1,1),0x526e40,'Clipped campus planting');
  plants(trunks,new THREE.CylinderGeometry(.8,1,1,6),0x665340,'Garden stems');
  if(!instances.length)return;
  const mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial({roughness:.74}),instances.length);
  instances.forEach(({matrix,color},i)=>{mesh.setMatrixAt(i,matrix);mesh.setColorAt(i,shade.set(color));});
  mesh.name='Observed entrances, eaves and facade bands';mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);
}
