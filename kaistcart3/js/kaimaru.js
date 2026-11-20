import * as THREE from '../lib/three.module.min.js';

// N11's south elevation from the public 402–405 panoramas. The mapped entrance
// and footprint fix its plan. Sill, tread, roof and railing heights are estimates.
export function buildKaimaru(scene, building, hAt, MB) {
  const ring=building.p, floor=hAt(-249,-398.8)+1.10, doorX=-249;
  const masonry=new MB(), hardware=new MB(), glazing=new MB(), granite=new MB();
  const brick=0x9a573e, darkBrick=0x814b3c, frame=0x333d3d, roofEdge=0x565955;
  const frontZ=x=>-398.8+(x-doorX)*.0091;
  const uv=[0,0], up=[0,1,0], shade=new THREE.Color();
  const quad=(batch,a,b,c,d,normal,color)=>batch.quad(a,b,c,d,normal,uv,uv,uv,uv,shade.set(color));
  function box(batch,x,y,z,w,h,d,color){
    if(w<=0||h<=0||d<=0)return;
    const l=x-w/2,r=x+w/2,b=y-h/2,t=y+h/2,n=z-d/2,s=z+d/2;
    quad(batch,[l,b,s],[r,b,s],[r,t,s],[l,t,s],[0,0,1],color);
    quad(batch,[r,b,n],[l,b,n],[l,t,n],[r,t,n],[0,0,-1],color);
    quad(batch,[l,b,n],[l,b,s],[l,t,s],[l,t,n],[-1,0,0],color);
    quad(batch,[r,b,s],[r,b,n],[r,t,n],[r,t,s],[1,0,0],color);
    quad(batch,[l,t,n],[r,t,n],[r,t,s],[l,t,s],up,color);
    quad(batch,[l,b,s],[r,b,s],[r,b,n],[l,b,n],[0,-1,0],color);
  }
  const rect=(batch,x,y,z,w,h,d,color)=>box(batch,x,floor+y,z,w,h,d,color);
  function tube(a,b,r,color){
    const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b);
    const axis=end.clone().sub(start).normalize();
    const radial=new THREE.Vector3(1,0,0).cross(axis).normalize(),other=axis.clone().cross(radial);
    const side=angle=>radial.clone().multiplyScalar(Math.cos(angle)).addScaledVector(other,Math.sin(angle));
    for(let j=0;j<8;j++){
      const u=side(j*Math.PI/4),v=side((j+1)*Math.PI/4);
      const vertex=(p,n)=>p.clone().addScaledVector(n,r).toArray();
      quad(hardware,vertex(start,u),vertex(end,u),vertex(end,v),vertex(start,v),u.clone().add(v).normalize().toArray(),color);
    }
  }
  const roofY=([,z])=>floor+4.97+Math.min(1.38,Math.max(0,(-z-398.5)*.031));
  const sign=Math.sign(ring.reduce((sum,a,i)=>{const b=ring[(i+1)%ring.length];return sum+a[0]*b[1]-a[1]*b[0];},0));
  const roofTri=THREE.ShapeUtils.triangulateShape(ring.map(p=>new THREE.Vector2(...p)),[]);
  for(const tri of roofTri){
    const vertices=tri.map(k=>[ring[k][0],roofY(ring[k])+.09,ring[k][1]]);
    hardware.tri(...vertices,up,uv,uv,uv,shade.set(0x888b83));
  }
  for(let i=0;i<ring.length;i++){
    const a=ring[i],b=ring[(i+1)%ring.length],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);
    if(!len)continue;
    const normal=[sign*dz/len,0,-sign*dx/len];
    const skin=(batch,l,r,y0,y1,out,color)=>{
      const at=(u,y)=>[a[0]+dx*u+normal[0]*out,y,a[1]+dz*u+normal[2]*out];
      quad(batch,at(l,y0),at(r,y0),at(r,y1),at(l,y1),normal,color);
    };
    const low=Math.min(roofY(a),roofY(b));
    if(a[1]<-400||b[1]<-400){
      const footing=Math.min(floor-2.4,hAt(...a)-.45,hAt(...b)-.45);
      quad(masonry,[a[0],footing,a[1]],[b[0],footing,b[1]],[b[0],roofY(b),b[1]],[a[0],roofY(a),a[1]],normal,brick);
      if(len>6){
        const bays=Math.max(1,Math.floor(len/5.1));
        for(let j=0;j<bays;j++){
          const l=(j+.15)/bays,r=(j+.86)/bays;
          skin(glazing,l,r,floor+1.1,low-.98,.018,0x416268);
          skin(hardware,(l+r)/2-.035/len,(l+r)/2+.035/len,floor+1.1,low-.98,.042,frame);
          skin(hardware,l,r,low-1.59,low-1.51,.045,frame);
        }
      }
    }
    quad(hardware,[a[0],roofY(a)-.12,a[1]],[b[0],roofY(b)-.12,b[1]],[b[0],roofY(b)+.11,b[1]],[a[0],roofY(a)+.11,a[1]],normal,roofEdge);
  }

  // The dining room sits behind tall divided windows. A rear wall, tables
  // and ceiling strips give the glass visible depth at oblique angles.
  rect(hardware,-249,2.30,-405.8,44.1,4.65,.24,0x554d40);
  rect(hardware,-249,.02,-402.2,43.9,.10,7.1,0x9a968b);
  rect(hardware,-249,4.43,-402.2,43.9,.14,7.2,0x9d9b8a);
  for(const x of [-270.76,-227.29])rect(hardware,x,2.25,-402.24,.22,4.50,7.29,0x958d7f);
  for(const x of [-265.8,-258.9,-237.6,-231.3]){
    rect(hardware,x,1.26,-404.4,3.9,.85,.65,0x8c775f);
    rect(hardware,x,1.72,-404.4,3.97,.08,.75,0xc6beb0);
    rect(hardware,x,2.82,-405.53,3.55,1.12,.18,0x5b5142);
    for(let j=-1;j<=1;j++)rect(hardware,x+j*1.12,2.84,-405.40,.91,.77,.035,0xb1a78a);
    rect(hardware,x,3.92,-404.9,2.81,.10,.24,0xf3e8c9);
  }
  for(const x of [-267,-261,-255.5,-242,-236,-230.5]){
    rect(hardware,x,.81,-401.45,2.4,.09,.86,0x9b8065);
    for(const side of [-1,1])rect(hardware,x+side*.86,.43,-401.45,.10,.78,.41,0x484c45);
    for(const z of [-402.32,-400.52]){
      rect(hardware,x,.48,z,2.0,.09,.41,0x8c927d);
      rect(hardware,x,.77,z+(z<-401?-.17:.17),1.98,.42,.068,0x86836d);
    }
    rect(hardware,x,4.32,-402.1,1.62,.05,.15,0xe9dfbd);
  }
  const nearGlass=new MB();
  function diningWing(left,right,awning){
    const x=(left+right)/2,w=right-left,front=frontZ(x);
    rect(masonry,x,-.48,front,w,1.68,.42,brick);
    rect(hardware,x,.40,front+.06,w,.10,.53,0x766b60);
    rect(nearGlass,x,2.08,front-.06,w,3.25,.07,0x738d8c);
    rect(hardware,x,4.26,front,w,1.09,.35,0xb4b3a8);
    rect(hardware,x,4.85,front+.18,w,.18,.72,roofEdge);
    const count=Math.ceil(w/2.0);
    for(let i=0;i<=count;i++)rect(hardware,left+i*w/count,2.08,front+.04,.085,3.37,.15,frame);
    for(const y of [.67,1.34,3.02,3.65])rect(hardware,x,y,front+.04,w,.065,.16,frame);
    if(awning){
      rect(hardware,x,2.73,front+.53,w*.94,.14,1.18,0x337f93);
      rect(hardware,x,2.70,front+1.11,w*.94,.17,.065,0x488f9f);
    }
  }
  diningWing(-270.65,-253.30,true);
  diningWing(-244.70,-227.55,false);
  for(const x of [-270.65,-253.3,-244.7,-227.55]){
    const w=(x===-253.3||x===-244.7)?1.12:.80;
    rect(masonry,x,1.87,frontZ(x)-.04,w,6.27,1.03,brick);
    rect(hardware,x,5.02,frontZ(x)-.04,w+.08,.11,1.10,roofEdge);
  }
  // Recessed double-door vestibule and the low projecting fascia.
  rect(masonry,doorX,4.46,-398.95,8.2,.92,.78,darkBrick);
  rect(hardware,doorX,3.32,-398.90,7.55,.21,2.09,0x514a40);
  rect(hardware,doorX,2.99,-399.98,6.99,.38,.21,0x363a38);
  rect(hardware,doorX,3.74,-397.93,5.61,.94,.29,0x785c49);
  for(const side of [-1,1]){
    rect(hardware,doorX+side*3.26,1.61,-399.85,.38,3.22,.73,0x8a6a4d);
    rect(hardware,doorX+side*3.53,1.61,-399.38,.20,3.22,.95,0x674d3e);
    rect(hardware,doorX+side*3.04,1.48,-399.52,.075,2.95,.09,0xb4a98b);
  }
  rect(hardware,doorX,2.98,-399.67,6.32,.31,.40,0x907457);
  rect(hardware,doorX,2.83,-399.46,6.09,.06,.078,0xb7b09f);
  for(const side of [-1,1])rect(hardware,doorX+side*3.04,1.41,-399.94,.30,2.80,.28,0x343a38);
  for(let i=-1.5;i<=1.5;i++){
    const x=doorX+i*1.45;
    rect(nearGlass,x,1.37,-399.90,1.38,2.68,.09,0x4f6463);
    rect(hardware,x-.70,1.38,-399.86,.064,2.75,.13,0x4e5553);
    rect(hardware,x,2.16,-399.83,1.38,.07,.09,0x72807d);
    rect(hardware,x+(i<0?.45:-.45),1.15,-399.81,.055,.47,.09,0xb4b7ad);
  }
  // Portal cheeks return to the recessed doors.
  for(const side of [-1,1])rect(masonry,doorX+side*3.68,1.59,-399.5,.32,3.18,1.58,brick);

  // The mapped stair starts at the middle of the southern lane. Only the last
  // part rises in steps; the lower approach follows the planted bank's grade.
  const baseZ=-391.3, run=.36, steps=8, baseY=hAt(doorX,baseZ)+.20;
  const skirt=baseY-.83, width=5.45;
  const approachEnd=-385.83;
  for(let z=baseZ;z<approachEnd;z+=.45){
    const end=Math.min(z+.45,approachEnd);
    const corner=(side,s)=>{
      const x=doorX+side*(width-1.28*(s-baseZ)/(approachEnd-baseZ))*.5;
      const y=THREE.MathUtils.lerp(baseY,hAt(x,s)+.27,Math.min(1,(s-baseZ)/1.3));
      return [x,y,s];
    };
    quad(hardware,corner(-1,z),corner(1,z),corner(1,end),corner(-1,end),up,0x969386);
  }
  for(let i=0;i<steps;i++){
    const top=baseY+(i+1)*(floor-baseY)/steps,z=baseZ-(i+.5)*run;
    box(granite,doorX,(skirt+top)/2,z,width,top-skirt,run,i%2?0x5f4c47:0x64514b);
    box(granite,doorX,top-.016,z+run*.50,width,.032,.04,0x817069);
    for(const side of [-1,1]){
      const x=doorX+side*(width*.5+.13),cap=top+.16;
      box(masonry,x,(skirt+cap)/2,z,.26,cap-skirt,run,brick);
      box(granite,x,cap+.02,z,.28,.04,run,0x716055);
    }
  }
  const landingFront=baseZ-steps*run, landingBack=-400.2;
  box(granite,doorX,(skirt+floor)/2,(landingFront+landingBack)/2,width+.18,floor-skirt,landingFront-landingBack,0x685751);
  const railX=doorX+width/2-.13,railColor=0x929994;
  const railPost=(z,y)=>tube([railX,y,z],[railX,y+.90,z],.037,railColor);
  railPost(baseZ,baseY+.17);railPost(landingFront,floor);railPost(landingFront-1.44,floor);
  for(const lift of [.46,.90]){
    tube([railX,baseY+.17+lift,baseZ+.12],[railX,floor+lift,landingFront],.035,railColor);
    tube([railX,floor+lift,landingFront],[railX,floor+lift,landingFront-1.53],.035,railColor);
  }
  for(const [left,right] of [[-270.8,-252.4],[-245.7,-227.35]]){
    const x=(left+right)*.5,w=right-left,z=frontZ(x)+.96;
    rect(masonry,x,-.23,z,w,.55,2.28,brick);rect(hardware,x,.07,z,w,.095,2.36,0xa9a395);
    if(x<doorX){
      for(const y of [.42,.77,.99])rect(hardware,x,y,z+1.08,w,.047,.047,0x969e98);
      for(let offset=0,n=Math.ceil(w/1.9);offset<=n;offset++)rect(hardware,left+w*offset/n,.55,z+1.08,.052,.96,.052,0x798580);
    }
  }
  const group=new THREE.Group();group.name='Kaimaru · N11 student dining hall';
  const add=(batch,name,properties)=>{
    const material=new THREE.MeshStandardMaterial({vertexColors:true,...properties});
    const mesh=new THREE.Mesh(batch.geo(),material);mesh.name=name;
    mesh.receiveShadow=true;mesh.castShadow=!properties.transparent;group.add(mesh);return material;
  };
  add(masonry,'N11-stone',{roughness:.93});add(hardware,'N11-frames',{roughness:.74});
  add(glazing,'N11-glass',{roughness:.25,metalness:.13});
  const windowMaterial=add(nearGlass,'N11 dining room glazing',{roughness:.18,metalness:.10,transparent:true,opacity:.48,depthWrite:false});
  // Tinted glazing reflects the trees across the lane. Keep it translucent
  // so the real depth of the vestibule and dining room reads as the kart moves.
  windowMaterial.customProgramCacheKey=()=> 'kaimaru-foyer-glass';
  windowMaterial.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vShopWorld;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nvShopWorld=(modelMatrix * vec4(transformed,1.)).xyz;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vShopWorld;')
      .replace('#include <color_fragment>',`#include <color_fragment>
        vec3 ray=normalize(vShopWorld-cameraPosition);
        float treeLine=.19+.091*sin(ray.x*16.+ray.z*7.)+.037*cos(ray.x*50.-ray.z*16.);
        float upper=smoothstep(treeLine-.055,treeLine+.07,ray.y);
        diffuseColor.rgb=mix(vec3(.016,.032,.029),vec3(.11,.20,.24),upper);
        diffuseColor.a+=.06*(1.-abs(ray.z));`);
  };
  const stone=add(granite,'Kaimaru granite treads and landing',{roughness:.54});
  // Mipmapped feldspar / quartz flecks remain stable when viewed from a kart.
  const textureData=new Uint8Array(128*128*4);
  let seed=98031;
  for(let k=0;k<textureData.length;k+=4){
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    const n=seed/4294967296,shade=n<.075?103:n>.92?253:164+Math.floor(n*65);
    textureData.set([shade,shade,shade,255],k);
  }
  const grain=new THREE.DataTexture(textureData,128,128);
  grain.wrapS=grain.wrapT=THREE.RepeatWrapping;grain.generateMipmaps=true;grain.minFilter=THREE.LinearMipmapLinearFilter;grain.magFilter=THREE.LinearFilter;grain.needsUpdate=true;
  stone.customProgramCacheKey=()=> 'kaimaru-granite';
  stone.onBeforeCompile=shader=>{
    shader.uniforms.stoneGrain={value:grain};
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 vStoneUv;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nvStoneUv = abs(normal.y) > .5 ? position.xz : vec2(position.x + position.z,position.y);');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 vStoneUv;uniform sampler2D stoneGrain;')
      .replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb *= .55 + texture2D(stoneGrain, vStoneUv * 2.2).r*.68;');
  };

  const signPlane=(width,height,x,y,z,draw)=>{
    const cv=document.createElement('canvas');cv.width=768;cv.height=256;draw(cv.getContext('2d'),cv.width,cv.height);
    const map=new THREE.CanvasTexture(cv);map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=4;
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,height),new THREE.MeshStandardMaterial({map,roughness:.84}));
    mesh.position.set(x,y,z);group.add(mesh);return mesh;
  };
  signPlane(5.61,.94,doorX,floor+3.74,-397.78,(ctx,w,h)=>{
    ctx.fillStyle='#645044';ctx.fillRect(0,0,w,h);
    for(let x=0;x<w;x+=22){ctx.fillStyle='#493b32';ctx.fillRect(x,0,2,h);}
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 112px "Malgun Gothic",sans-serif';
    ['카','이','마','루'].forEach((letter,i)=>{ctx.fillStyle=['#d7ba7c','#c38783','#9bbd9a','#9aaec0'][i];ctx.fillText(letter,w/2+(i-1.5)*110,h*.40);});
    ctx.fillStyle='#e3ded0';ctx.font='bold 36px Arial';ctx.fillText('K A I M A R U',w/2,h*.80);
  });
  signPlane(.55,1.08,doorX-3.69,floor+1.62,-398.27,(ctx,w,h)=>{
    ctx.fillStyle='#67635c';ctx.fillRect(0,0,w,h);
    ctx.fillStyle='#ebe5d5';ctx.fillRect(32,10,w-64,h-20);
    ctx.fillStyle='#465e61';ctx.fillRect(32,10,w-64,34);
    for(let i=0;i<5;i++){ctx.fillStyle=i%2?'#b5a479':'#8c9880';ctx.fillRect(60,62+i*32,143,22);ctx.fillStyle='#9a958a';ctx.fillRect(226,68+i*32,455,5);}
  });
  const totemX=-244.7,totemZ=-389.53, ground=hAt(totemX,totemZ);
  const totem=new THREE.Mesh(new THREE.BoxGeometry(.53,1.83,.25),new THREE.MeshStandardMaterial({color:0x9e3336,roughness:.83}));
  totem.position.set(totemX,ground+.915,totemZ);totem.castShadow=true;group.add(totem);
  const marker=signPlane(1.83,.53,totemX,ground+.915,totemZ+.127,(ctx,w,h)=>{
    ctx.fillStyle='#a7353e';ctx.fillRect(0,0,w,h);ctx.fillStyle='#ebe6dc';ctx.fillRect(0,0,w,h*.19);
    ctx.fillStyle='#693c38';ctx.font='600 28px Arial';ctx.fillText('Student Cafeteria',w*.45,h*.14);
    ctx.fillStyle='#f0ece1';ctx.textAlign='right';ctx.font='bold 194px Arial';ctx.fillText('N11',w-24,h*.93);
  });
  marker.rotation.z=Math.PI*.5;
  scene.add(group);
  return {ref:'N11',name:'Kaimaru',x:doorX,y:floor+8.1,z:-421};
}
