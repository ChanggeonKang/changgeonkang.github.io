import * as THREE from '../lib/three.module.min.js';
import {buildingProfile} from './campus-identity.js';
import {finishLandmarkMaterials} from './facade-materials.js';

// Facade families seen from the public campus viewpoints indexed in road-views.json.
// The source footprint, building height and entrances still come from the campus model.
export const streetviewPalette={
  E14:[0xd4cec3,1], 'N13-1':[0xaf523a,1], 'N7-2':[0xcac9bf,1], N25:[0x9b5948,0],
  W2:[0xd5d1c6,1], W7:[0xd2cdc1,0], N21:[0x9e6657,0], N4:[0x915843,0], W8:[0xcccdc7,0],
  E8:[0xd3d0c6,0], N12:[0x8c5849,0], E21:[0x88a7ae,2], E5:[0xc4c7c7,1],
  N26:[0x93aab0,2], N18:[0x966553,0], N7:[0x9baca7,1], W1:[0xa1b4b9,1],
  E15:[0x975844,0], W10:[0xe0e0d6,0], 'W5-4':[0xdad5c9,0], N22:[0xc8c9c4,1],
  E3:[0xa7acac,1], 'N7-5':[0xb5bbba,2], 'N7-1':[0x809ba4,1], N27:[0x8eafb2,2],
  W12:[0xd8d8d0,0], N24:[0xcac9c2,1]
};
const frontages={
  E14:{view:[-54.3,-42.9],type:'administration'}, 'N7-2':{view:[-343.2,-209.4],type:'ribbons'},
  W2:{view:[-39.1,280.7],type:'eaves'}, N12:{view:[-208.3,-482.6],type:'hall'},
  E21:{view:[669.9,58.7],type:'clinic'}, N22:{view:[196.5,-544.7],type:'ribbons'},
  W10:{view:[-476.7,-169.2],type:'workshop'}, N21:{view:[-305.7,-629.4],type:'garden'},
  N26:{view:[-36.4,-573.8],type:'portico'}, 'W5-4':{view:[-579.1,17.8],type:'village'},
  N4:{view:[19.5,-374],type:'stairwell'},
  E3:{view:[222,197],type:'screen'}, 'N7-5':{view:[-392,-341],type:'colouredGlass'},
  N27:{view:[-122,-589],type:'eureka'}, E5:{view:[160,74],type:'faculty'},
  N2:{view:[148,-316],type:'brickOffice'}, N10:{view:[-136,-498],type:'colonnade'},
  'N7-1':{view:[-266,-241],type:'tiledLab'}, W1:{view:[-38,446],type:'tiledLab'},
  W12:{view:[-443,145],type:'utility'}, N24:{view:[126,-624],type:'stairwell'}
};
function facade(b,view){
  // Door and walkway nodes split an otherwise continuous OSM wall. Keep
  // them in the map but fit the visible facade to its real corners.
  const ring=b.p.filter((p,i,points)=>{
    const a=points[(i+points.length-1)%points.length],c=points[(i+1)%points.length];
    const dx=c[0]-a[0],dz=c[1]-a[1],len=Math.hypot(dx,dz);
    return len<.1 || Math.abs((p[0]-a[0])*dz-(p[1]-a[1])*dx)>.095*len ||
      (p[0]-a[0])*(p[0]-c[0])+(p[1]-a[1])*(p[1]-c[1])>0;
  });
  const sign=Math.sign(ring.reduce((a,p,i)=>{const q=ring[(i+1)%ring.length];return a+p[0]*q[1]-q[0]*p[1];},0));
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
  const instances=[],glass=[],foliage=[],trunks=[], dummy=new THREE.Object3D(), shade=new THREE.Color();
  for(const b of D.buildings){
    const profile=frontages[b.ref];if(!profile)continue;
    const f=facade(b,profile.view);if(!f)continue;
    const {a,c,tx,tz,nx,nz,len}=f;
    const centre=profile.type==='administration' ? Math.min(len-7,Math.max(7,(profile.view[0]-a[0])*tx+(profile.view[1]-a[1])*tz)) : len/2;
    const mx=a[0]+tx*centre,mz=a[1]+tz*centre;
    const heights=b.p.map(p=>hAt(...p)),grade=(Math.min(...heights)+Math.max(...heights))/2;
    const captured=['village','colonnade','brickOffice','workshop'].includes(profile.type);
    const base=captured?Math.min(...heights)-.65:hAt(mx,mz),height=buildingProfile(b).height,top=grade+height-base;
    const yaw=-Math.atan2(tz,tx);
    const panel=(along,y,out,width,h,depth,color,batch=instances)=>{
      dummy.position.set(mx+tx*along+nx*out,base+y,mz+tz*along+nz*out);
      dummy.rotation.set(0,yaw,0);dummy.scale.set(width,h,depth);dummy.updateMatrix();
      batch.push({matrix:dummy.matrix.clone(),color});
    };
    const wide=Math.min(len*.78,12);
    const glazing=(y,h,w=wide,color=0x3b6470,along=0,out=.13)=>{
      panel(along,y,out,w,h,.2,color,glass);
      for(let i=0,n=Math.ceil(w/2.15);i<=n;i++)panel(along-w*.5+i*w/n,y,out+.13,.075,h,.09,0x9aa7a4);
      panel(along,y+h*.22,out+.14,w,.06,.09,0x939d9b);
      panel(along,y-h*.49,out+.19,w,.10,.25,0x9da39e);
    };
    const signage=(text,along,y,out,width,height,colour)=>{
      const cv=document.createElement('canvas');cv.width=256;cv.height=96;
      const ctx=cv.getContext('2d');ctx.fillStyle=colour;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 80px Arial';
      ctx.shadowColor='rgba(25,20,18,.56)';ctx.shadowOffsetX=3;ctx.shadowOffsetY=4;ctx.shadowBlur=3;
      ctx.fillText(text,128,49);
      const texture=new THREE.CanvasTexture(cv);texture.colorSpace=THREE.SRGBColorSpace;
      const sign=new THREE.Mesh(new THREE.PlaneGeometry(width,height),new THREE.MeshStandardMaterial({map:texture,transparent:true,alphaTest:.10,depthWrite:false,roughness:.8}));
      sign.name='Facade letters '+text;sign.position.set(mx+tx*along+nx*out,base+y,mz+tz*along+nz*out);
      sign.rotation.y=Math.atan2(nx,nz);scene.add(sign);
    };
    const openToFront=(along,out)=>[0,.35,-.35].every(delta=>{
      const x=mx+tx*(along+delta)+nx*out,z=mz+tz*(along+delta)+nz*out;
      return [0,1].includes(surfaceAt(x,z));
    });
    // Topiary along these photographed frontages grows in planting strips.
    // Leave breaks for entrances and reject candidates on mapped paving.
    if(['administration','garden','village','portico','workshop','brickOffice','faculty','eureka','tiledLab'].includes(profile.type)){
      for(let along=-centre+1.7;along<len-centre-1.7;along+=profile.type==='garden'?4.4:5.5){
        if(Math.abs(along)<Math.min(4.5,len*.19))continue;
        for(const setback of [2.6,3.8,5.2]){
          const x=mx+tx*along+nx*setback,z=mz+tz*along+nz*setback;
          if(surfaceAt(x,z)!==0||surfaceAt(x+1,z)!==0||surfaceAt(x-1,z)!==0||surfaceAt(x,z+1)!==0||surfaceAt(x,z-1)!==0)continue;
          const bottom=hAt(x,z),tier=['garden','village','administration','tiledLab','eureka'].includes(profile.type);
          trunks.push([x,bottom+.65,z,.12,1.3,.12]);
          foliage.push([x,bottom+1.65,z,1.12,.67,1.03]);
          if(tier){foliage.push([x-.40,bottom+1,z+.20,.88,.38,.84],[x+.32,bottom+2.26,z-.08,.64,.39,.67]);}break;
        }
      }
    }
    if(profile.type==='portico'){
      const width=Math.min(len*.72,8);panel(0,3.65,1.3,width,.32,2.8,0xc8cdca);
      for(const t of [-1,1])if(openToFront(t*(width/2-.28),2.37))panel(t*(width/2-.28),1.8,2.37,.37,3.6,.37,0x647478);
      signage('N26',len*.23,Math.max(4,top-2),.25,3.1,1.18,'#b32d48');
    }else if(profile.type==='administration'){
      glazing(3,5.9,wide,0x415e66);
      const rim=wide+.9, blue=0x254471;
      panel(0,6.14,.67,rim,.48,1.15,blue);
      for(const side of [-1,1])panel(side*(rim*.5-.23),3.07,.65,.46,6.14,1.10,blue);
      panel(0,4.60,2.12,wide*.77,.14,4.10,0x8ca7a8);panel(0,4.65,4.17,wide*.79,.29,.22,0xbbbcb2);
      for(let j=-2;j<=2;j++)panel(j*wide*.175,4.40,2.14,.12,.22,4.07,0x899797);
      glazing(1.28,2.54,Math.min(4.6,wide*.62),0x28454c,0,.34);
    }else if(profile.type==='ribbons'||profile.type==='clinic'){
      for(let y=3.15;y<top-.8;y+=3.65)panel(0,y,.20,len*.97,.44,.56,0xd6d5cd);
      if(profile.type==='clinic')glazing(1.43,2.8,len*.85,0x3a788a);
    }else if(profile.type==='eaves'){
      panel(0,top+.06,.45,len*.99,.43,1.28,0x333a3b);glazing(top*.63,1.15,len*.88);
    }else if(profile.type==='workshop'){
      for(const t of [-.24,.24]){const h=3.0,w=Math.min(len*.28,4);panel(t*len,h*.5,.13,w,h,.20,0x6e7e83);for(let y=.3;y<h;y+=.36)panel(t*len,y,.24,w,.035,.035,0x48575c);}
    }else if(profile.type==='village'){
      const core=-len*.24,coreWidth=Math.min(3.4,len*.20);
      panel(core,top*.50,.25,coreWidth,top*.97,.46,0xcfa24e);
      for(let y=2.2;y<top-1;y+=3.05){
        glazing(y,1.20,coreWidth*.67,0x56666d,core,.50);
        for(const offset of [.095,.355]){
          const w=len*.20;
          panel(offset*len,y-.73,.55,w,.80,.85,0xd8d4c4);
          panel(offset*len,y-.23,.94,w,.058,.08,0x89928e);
          for(const edge of [-1,1])panel(offset*len+edge*(w/2-.06),y-.60,.48,.12,1.02,.89,0xb6b5a9);
        }
      }
    }else if(profile.type==='stairwell'){
      glazing(top*.49,top*.91,Math.min(3.2,wide),0x55808a);panel(0,3.1,.63,Math.min(5.5,wide),.28,1.45,0x909b97);
    }else if(profile.type==='hall'){
      glazing(1.2,2.4,Math.min(5,wide));panel(0,3.05,.48,Math.min(7.5,wide),.24,1.20,0x6b6058);
      signage('N12',0,Math.min(top-.9,6.8),.26,3.15,1.18,'#bc3d46');
    }else if(profile.type==='screen'){
      // E3: two banks of projecting alloy fins with a dark break between them.
      const span=len*.96, fins=Math.max(4,Math.round(span/.46)), lift=3.15;
      const belt=Math.max(.8,(top-lift-1.1)/2);
      for(let j=0;j<2;j++){
        const y=lift+(j+.5)*belt+j*.70;
        panel(0,y,.15,span,belt,.24,0x404b52);
        for(let i=0;i<=fins;i++)panel(-span*.5+i*span/fins,y,.41,.075,belt+.14,.47,0xb2b9bc);
      }
    }else if(profile.type==='colouredGlass'){
      const span=len*.84;
      glazing(1.58,3.08,span,0x3f5859);
      const bays=Math.max(2,Math.round(span/2.4));
      for(let i=0;i<bays;i++){
        const w=span/bays,along=(i+.5)*w-span*.5;
        for(const [y,height,colour] of [[4.05,1.70,0x4b91a6],[5.52,1.20,0x8caa4b],[6.84,1.34,0x557b87]]){
          panel(along,y,.34,w-.07,height,.20,colour,glass);
          panel(along,y-height*.5,.49,w,.065,.20,0xb9c3bf);
        }
      }
      panel(0,3.21,.42,span+.17,.12,.42,0xc6c9bc);
    }else if(profile.type==='eureka'){
      for(let y=4.3;y<top-.8;y+=3.55){
        glazing(y,2.20,len*.93,0x51899a);
        panel(0,y-1.36,.39,len*.99,.40,.67,0xc7c6b5);
      }
      const count=Math.max(2,Math.round(len/5));
      for(let i=0;i<count;i++)panel(((i+.5)/count-.5)*len,2.33,.52,.22,4.65,.44,0xba944f);
    }else if(profile.type==='faculty'){
      for(let y=2.5;y<top-1;y+=3.6)glazing(y,1.12,len*.82,0x4e6267);
      panel(0,top-.28,.29,len*.99,.31,.53,0xaaa99e);
    }else if(profile.type==='brickOffice'){
      signage('N2',len*.27,8.32,.30,3.0,1.35,'#ad3742');
      const n=Math.max(2,Math.round(len/4.9));
      for(let i=0;i<=n;i++)panel((i/n-.5)*len*.97,5.7,.23,.34,11.35,.50,0x79584a);
      panel(0,11.5,.51,len,.30,1.14,0x5a3b36);
    }else if(profile.type==='colonnade'){
      const h=8.8,width=len*.96;
      panel(0,h,.82,width,.23,1.87,0x634c45);
      panel(0,3.95,.34,width,1.02,.76,0xd0c7b5);
      const spans=Math.max(2,Math.round(width/5.1));
      for(let i=0;i<=spans;i++){
        const along=(i/spans-.5)*width;
        if(openToFront(along,1.03))panel(along,h*.49,1.03,.44,h,.44,0xc8c4b7);
      }
      glazing(1.48,2.84,width*.62,0x31434b);
      signage('N10',width*.34,6.50,.33,3.0,1.13,'#ad3742');
    }else if(profile.type==='tiledLab'){
      const span=len*.95;
      for(let y=2.42;y<top-.7;y+=3.6){
        glazing(y,1.62,span,0x485f65);
        for(let j=0,n=Math.floor(span/8.4);j<n;j++){
          const along=((j+.5)/n-.5)*span;
          panel(along,y-.48,.41,.73,.52,.34,0xd4d1c0);
          for(let k=-1;k<=1;k++)panel(along+k*.115,y-.48,.60,.045,.33,.036,0x6e7976);
        }
      }
    }else if(profile.type==='utility'){
      const door=Math.min(4.0,len*.42);
      panel(0,1.49,.16,door,2.96,.32,0x76848b);panel(0,3.16,.64,door+.75,.18,1.38,0x8195b8);
      for(let along=-door*.46;along<door*.49;along+=.24)panel(along,1.49,.34,.035,2.89,.04,0x64747b);
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
  for(const [batch,name] of [[instances,'Observed entrances, eaves and facade bands'],[glass,'frontage-glass']]){
    if(!batch.length)continue;
    const windows=batch===glass;
    const mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial({roughness:windows?.25:.74,metalness:windows?.13:0}),batch.length);
    batch.forEach(({matrix,color},i)=>{mesh.setMatrixAt(i,matrix);mesh.setColorAt(i,shade.set(color));});
    mesh.name=name;mesh.castShadow=!windows;mesh.receiveShadow=true;scene.add(mesh);
    if(windows)finishLandmarkMaterials([mesh]);
  }
}
