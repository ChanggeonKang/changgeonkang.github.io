import * as THREE from '../lib/three.module.min.js';
import {finishLandmarkMaterials} from './facade-materials.js';
import {leafyCrown,leafSprayMaterial} from './campus-canopy.js';
import {designCentreId,buildDesignCentre} from './lotte-design-centre.js';
import {n29Parking,n29ParkingPoint} from './n29-parking-plan.js';

// This mapped shelter has a building outline but no surveyed building height.
// Its timber lattice and open eaves are visible from both ends of the street.
const pavilionId=1527429164, metaHallId=1501660296, tennisClubId=1529386250;
export const northwestReplacedBuildings = new Set([pavilionId,metaHallId,tennisClubId,designCentreId]);

// November 2026 street views at Silloe Hall and N10 show the completed mass.
// The orthophoto shows the surrounding buildings and this slab during
// construction. Lengths are estimates constrained by the 2,470 m² building
// area and nine storeys in KAIST's public procurement notice R25BK01229839.
const metaHall={x:-204.5,z:-629.5,angle:.052,height:35.1};
const hallPlan=[
  [-42,-12.6],[-22,-12.6],[-22,-16.2],[42,-16.2],
  [42,14.8],[-22,14.8],[-22,12.0],[-42,12.0]
];
function hallPoint(u,v) {
  const {x,z,angle}=metaHall,tx=Math.cos(angle),tz=Math.sin(angle);
  return [x+tx*u-tz*v,z+tz*u+tx*v];
}
export function applyNorthwestSurveyBuilding(b) {
  if(b.id===designCentreId)return {...b,h:18.2,levels:3,ref:'N25-1',en:'LOTTE–KAIST Design Center',name:'LOTTE–KAIST Design Center (N25-1)',nameKo:'롯데–카이스트 디자인센터'};
  // The two lower glazed floors and five window ribbons above are individually
  // visible from the south lane, including the roof at a 44-degree camera tilt.
  if(b.ref==='N27')return {...b,h:26.85,levels:7};
  if(b.id===78058780){
    // The mapped southern projection includes the blue single-storey
    // entrance canopy. The residential floors stop behind its roof.
    const p=b.p.filter(([x,z])=>!(x> -312&&x< -302&&z> -640.35));
    const edge=p.findIndex(([x,z])=>x===-302.7&&z===-640.4);
    if(edge===-1)return b;
    p.splice(edge+1,0,[-311.6,-640.4]);
    return {...b,p};
  }
  if(b.id===pavilionId)return {...b,t:'roof',h:2.70,minHeight:2.35};
  if(b.id===tennisClubId)return {...b,t:'sports_centre',h:4.85,levels:1};
  // KAIST's completion notice gives both halls fifteen residential storeys.
  // The connected low glazed podium and upper wings are drawn separately.
  if(b.ref==='W4-3'||b.ref==='W4-4')return {...b,h:51.1,levels:15};
  if(/^W5-[1-5]$/.test(b.ref||''))return {...b,h:15.07,levels:4};
  if(b.id!==metaHallId)return b;
  return {...b,ref:'N29',name:'KAIST Meta-Convergence Building II (N29)',
    en:'KAIST Meta-Convergence Building II',nameKo:'KAIST 메타융합관 II (N29)',
    p:hallPlan.map(([u,v])=>hallPoint(u,v)),t:'university',h:metaHall.height,levels:9};
}

const up = new THREE.Vector3(0, 1, 0);
const hardware = new THREE.MeshStandardMaterial({roughness: .82});
const unitBox = new THREE.BoxGeometry(1, 1, 1);
const unitPost = new THREE.CylinderGeometry(.5, .5, 1, 8);
const unitCone = new THREE.ConeGeometry(.5,1,12);
const leaf = new THREE.IcosahedronGeometry(1, 1);
const rubber = new THREE.TorusGeometry(.30, .031, 4, 14);

function ivySpray(){
  const points=[],colors=[],c=new THREE.Color();
  for(let i=0;i<58;i++){
    const wave=k=>.5+.5*Math.sin((i+1)*k);
    const angle=i*2.40,t=(i+.5)/58;
    const x=.52*Math.cos(angle)*Math.sin(Math.PI*t),y=.89-1.55*t+.11*Math.sin(i);
    const z=.15+.24*Math.sin(angle)*Math.sin(Math.PI*t)+.10*wave(17.4);
    const w=.095+.050*wave(3.7),h=w*(1.3+.28*wave(11.3)),tilt=.5*Math.cos(3.4*i);
    const p=(u,v,n)=>[x+u*w+v*h*tilt,y+v*h,z+n];
    const centre=p(0,-.04,.045),ring=[p(0,1,0),p(.37,.32,.012),p(1,.34,0),p(.72,-.50,.013),p(0,-1,0),p(-.72,-.5,0),p(-.98,.35,0),p(-.36,.32,.013)];
    c.setRGB(.58+.4*wave(4.11),.64+.34*wave(1.73),.61+.35*wave(2.17));
    for(let j=0;j<ring.length;j++){
      points.push(...centre,...ring[(j+1)%ring.length],...ring[j]);
      for(let k=0;k<3;k++)colors.push(c.r,c.g,c.b);
    }
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(points,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  g.computeVertexNormals();g.computeBoundingSphere();return g;
}

// One instanced mesh per shape in each neighbourhood keeps the distant
// fixtures outside the frustum without duplicating geometry or materials.
function neighbourhood(scene, name, material=hardware) {
  const items = new Map();
  const temp = new THREE.Object3D(), tint = new THREE.Color();
  function instance(geometry, position, scale, color, rotation) {
    temp.position.set(...position);
    temp.scale.set(...scale);
    if (rotation?.isQuaternion) temp.quaternion.copy(rotation);
    else temp.rotation.set(0, rotation || 0, 0);
    temp.updateMatrix();
    if (!items.has(geometry)) items.set(geometry, []);
    items.get(geometry).push([temp.matrix.clone(), color]);
  }
  function strut(a, b, diameter, color, square = false) {
    const diff = new THREE.Vector3().fromArray(b).sub(new THREE.Vector3().fromArray(a));
    const len = diff.length();
    if (len < .001) return;
    const center = a.map((v, i) => (v + b[i]) / 2);
    const q = new THREE.Quaternion().setFromUnitVectors(up, diff.multiplyScalar(1 / len));
    instance(square ? unitBox : unitPost, center, [diameter, len, diameter], color, q);
  }
  function finish() {
    for (const [geometry, parts] of items) {
      const mesh = new THREE.InstancedMesh(geometry, material, parts.length);
      parts.forEach(([matrix, color], i) => {
        mesh.setMatrixAt(i, matrix);
        mesh.setColorAt(i, tint.set(color));
      });
      mesh.computeBoundingSphere();
      mesh.name = name;
      mesh.receiveShadow = true;
      mesh.castShadow = true;
      scene.add(mesh);
      if(material!==hardware)finishLandmarkMaterials([mesh]);
    }
  }
  return {instance, strut, finish};
}

function frame(x, z, angle, y, batch) {
  const tx = Math.cos(angle), tz = Math.sin(angle), nx = -tz, nz = tx;
  const point = (u, h, v) => [x + tx*u + nx*v, y + h, z + tz*u + nz*v];
  const box = (u,h,v,w,thickness,d,color) => batch.instance(unitBox, point(u,h,v), [w,thickness,d], color, -angle);
  const stick = (a,b,width,color,square) => batch.strut(point(...a),point(...b),width,color,square);
  return {point,box,stick,yaw:-angle};
}

// Two directions of fine diagonal slats, trimmed to the rectangular panel.
function trellis(f, u0, u1, near, h0, h1) {
  const height = h1 - h0, gap = .23;
  for (const slope of [-1, 1]) {
    for (let start = u0 - height; start <= u1; start += gap) {
      const a = Math.max(start, u0), b = Math.min(start + height, u1);
      if (b - a < .03) continue;
      const y = u => slope === 1 ? h0 + u-start : h1 - (u-start);
      f.stick([a,y(a),near],[b,y(b),near],.027,0x976646,true);
    }
  }
}

function areumShelter(scene, world, ground) {
  const b = world.D.buildings.find(b => b.id === 1527429164);
  if (!b) return;
  const [a,c,e] = b.p;
  const width = Math.hypot(c[0]-a[0],c[1]-a[1]), depth = Math.hypot(e[0]-c[0],e[1]-c[1]);
  const angle = Math.atan2(c[1]-a[1],c[0]-a[0]);
  const cx=(a[0]+e[0])/2,cz=(a[1]+e[1])/2;
  const batch = neighbourhood(scene,'N19 timber lattice shelter');
  // The roof is open between the crossbeams in the November 2026 photograph.
  const f=frame(cx,cz,angle,ground(cx,cz),batch);
  f.box(0,.024,0,width+.18,.075,depth+.18,0xb4a894);
  for (const u of [-width/2+.09,width/2-.09]) {
    for (const v of [-depth/2+.09,depth/2-.09]) {
      f.box(u,1.32,v,.135,2.64,.135,0x765239);
      f.box(u,.11,v,.17,.22,.17,0x66675c);
    }
    f.box(u,2.56,0,.14,.18,depth,0x856345);
  }
  for (const v of [-depth/2+.09,depth/2-.09]) f.box(0,2.58,v,width,.16,.13,0x7b5c40);
  for (const u of [-width/2+.42,0,width/2-.42]) f.box(u,2.66,0,.075,.095,depth+.15,0x987553);
  const rear=depth/2-.14;
  f.box(0,.31,rear,width-.22,.085,.08,0x79553a);
  f.box(0,2.00,rear,width-.22,.095,.08,0x79553a);
  f.box(0,1.15,rear,.09,1.78,.09,0x79553a);
  trellis(f,-width/2+.15,width/2-.15,rear,.34,1.96);
  // Rotating the local frame allows the same cut lattice to fit the end.
  const end=frame(cx,cz,angle+Math.PI/2,ground(cx,cz),batch);
  const side=width/2-.14;
  for (const y of [.31,2]) end.box(0,y,side,depth-.22,.085,.08,0x79553a);
  trellis(end,-depth/2+.15,depth/2-.15,side,.34,1.96);
  f.box(0,.46,rear-.32,width-.46,.09,.36,0x865d43);
  for (const u of [-width*.32,width*.32]) f.box(u,.23,rear-.32,.07,.44,.26,0x51524a);
  batch.finish();
}

// NAVER's Jan 2022 west-flank view is the newest offered for this service
// alley. November 2026 views of the public south road confirm the brick hall.
function areumWestWall(scene,world,terrain) {
  const b=world.D.buildings.find(b=>b.ref==='N19');
  if(!b)return;
  // Find the long western edge in the mapped outline. The front entrance is
  // on the south side and its vestibule belongs to the campus building mesh.
  const sorted=b.p.map((a,i)=>[a,b.p[(i+1)%b.p.length]])
    .filter(([a,c])=>Math.abs(c[1]-a[1])>18)
    .sort((s,t)=>s[0][0]+s[1][0]-t[0][0]-t[1][0]);
  if(!sorted.length)return;
  const [s,n]=sorted[0].sort((a,b)=>b[1]-a[1]);
  const dx=n[0]-s[0],dz=n[1]-s[1],width=Math.hypot(dx,dz),angle=Math.atan2(dz,dx);
  const ground=terrain(...s),finish=(terrain(...s)+terrain(...n))/2;
  const batch=neighbourhood(scene,'N19-wall',hardware.clone());
  const f=frame((s[0]+n[0])/2,(s[1]+n[1])/2,angle,ground,batch);
  const datum=finish-ground;
  const box=(u,h,v,w,t,d,color)=>f.box(u,h+datum,v,w,t,d,color);
  const stick=(a,b,w,color)=>f.stick([a[0],a[1]+datum,a[2]],[b[0],b[1]+datum,b[2]],w,color,true);
  // The outward west normal is minus the local depth for a north-going wall.
  const w=width-.3,bays=Math.round(w/3.85),pitch=w/bays,base=-.34,spring=1.91;
  box(0,1.40,-.075,w,3.60,.15,0x975c49);
  box(0,3.36,-.14,w,.48,.18,0xd9d5c7);
  for(let i=0;i<bays;i++){
    const u=-w/2+(i+.5)*pitch, half=pitch*.404;
    const door=i===2||i===bays-2;
    box(u,(spring+base)/2,-.164,2*half,spring-base,.04,door?0x454c4a:0x925746);
    const y=t=>spring+.25*(1-Math.pow((t-u)/half,2));
    for(let k=0;k<8;k++){
      const l=u-half+2*half*k/8,r=u-half+2*half*(k+1)/8;
      stick([l,y(l),-.198],[r,y(r),-.198],.115,0x784435);
    }
    for(const p of [u-half,u+half]) box(p,(spring+base)/2,-.20,.13,spring-base,.18,0x82503d);
    if(door){
      box(u,.87,-.205,.045,2.18,.035,0x777e77);
      box(u,.38,-.205,2*half-.15,.065,.035,0x727c74);
    }
  }
  batch.finish();
}

function metaConvergenceHall(scene,world,terrain){
  const b=world.D.buildings.find(b=>b.id===metaHallId);
  if(!b)return;
  const corners=hallPlan.map(([u,v])=>terrain(...hallPoint(u,v)));
  const base=Math.min(...corners)-.4;
  const batch=neighbourhood(scene,'N29-wall',hardware.clone());
  const glazing=neighbourhood(scene,'N29-glass',new THREE.MeshStandardMaterial({roughness:.32,metalness:.14}));
  const {x,z,angle}=metaHall,f=frame(x,z,angle,base,batch),g=frame(x,z,angle,base,glazing);
  const ivory=0xd5d8d5,stone=0xbac0c0,teal=0x39717b,window=0x568492,lite=0x9daead,dark=0x304e58;
  const block=(geometry,u0,u1,h0,h1,v0,v1,color)=>
    geometry.box((u0+u1)/2,(h0+h1)/2,(v0+v1)/2,u1-u0,h1-h0,v1-v0,color);
  // Closed stepped volumes. The lower west wing aligns with its independently
  // visible slab; its back edge remains lower than the nine-storey main hall.
  block(f,-42,-22,-1.2,7.25,-12.6,12.0,ivory);
  block(f,-22,42,-1.2,7.5,-16.2,14.8,ivory);
  block(f,-21.7,41.6,7.5,23.9,-15.8,13.1,ivory);
  block(f,-18.9,40.2,23.9,metaHall.height,-14.9,10.8,ivory);
  block(f,-22.0,41.8,23.87,24.18,-16.0,13.29,stone);
  block(f,-19.1,40.35,metaHall.height-.23,metaHall.height,-15.04,10.96,stone);
  // The lower south glazing climbs toward the dormitory-side corner. Divide
  // it into window modules whose top fascia follows the observed diagonal.
  const modules=32,bay=64/modules;
  for(let i=0;i<modules;i++){
    const u=-22+(i+.5)*bay,t=i/(modules-1),top=7.0+3.3*(1-t);
    const v=14.94;
    g.box(u,(.55+top)/2,v,bay-.045,top-.55,.12,teal);
    f.box(u,top+.05,v,bay,.16,.19,0xb7c8c7);
    for(const y of [2.65,5.05,7.55]){
      if(y+.15<top)f.box(u,y,v+.09,bay,.062,.082,dark);
    }
  }
  for(let i=0;i<9;i++)g.box(-40.6+i*2.15,3.67,12.08,1.12,2.15,.12,dark);
  // Light horizontal metal bands and continuous strips of windows above the
  // green base, mirrored in the view looking north from the Library car park.
  for(let floor=0;floor<4;floor++){
    const h=9.2+floor*3.87;
    for(const edge of [-15.88,13.17]){
      const sign=Math.sign(edge);
      g.box(9.95,h,edge,62.98,1.66,.12,window);
      f.box(9.95,h-.91,edge+sign*.055,63.34,.22,.24,lite);
      f.box(9.95,h+.94,edge+sign*.075,63.45,.23,.28,ivory);
      for(let j=0;j<28;j++)f.box(-21.2+j*2.31,h,edge+sign*.088,.065,1.68,.055,0x798b8d);
    }
  }
  // Vertical glazed slots in the recessed upper block read as a different
  // volume above the four broad stripes of the main facade.
  for (const edge of [-14.97,10.88]){
    const sign=Math.sign(edge);
    g.box(10.65,29.6,edge,58.8,10.51,.12,0x688e91);
    for(let i=0;i<29;i++){
      const u=-18.25+i*2.06;
      f.box(u,29.61,edge+sign*.082,1.08,10.6,.13,ivory);
    }
    for(const h of [27.4,31.15])f.box(10.64,h,edge+sign*.018,58.7,.13,.05,lite);
  }
  for(const end of [-21.77,41.67]){
    const sign=Math.sign(end);
    for(let i=0;i<4;i++){
      const h=9.2+i*3.87;
      g.box(end,h,9.7,.11,1.66,5.9,window);
      f.box(end+sign*.05,h+.94,9.7,.23,.19,6.3,ivory);
    }
  }
  // From the public N27 approach the east end reads as green curtain wall
  // above an ivory base with three deep vertical glazed slots. The upper
  // canopy projects over the full-height window fins on the sunny side.
  for(const [from,to,y0,y1,u] of [[-15.65,12.95,7.50,23.88,41.72],[-14.8,10.7,24.0,34.83,40.30]]){
    g.box(u,(y0+y1)/2,(from+to)/2,.12,y1-y0,to-from,0x537a78);
    const panes=Math.round((to-from)/1.43);
    for(let j=0;j<=panes;j++){
      const v=from+(to-from)*j/panes;
      f.box(u+.09,(y0+y1)/2,v,.19,y1-y0,.077,0x748985);
    }
    for(let h=y0+2.5;h<y1;h+=2.7)f.box(u+.064,h,(from+to)/2,.05,.067,to-from,0x607776);
  }
  g.box(42.05,3.7,8.85,.14,7.2,10.96,teal);
  for(const v of [-12.6,-7.6,-3.02])g.box(42.05,3.64,v,.14,7.16,1.24,teal);
  f.box(42.13,7.43,-.69,.92,.86,31.3,ivory);
  f.box(41.92,23.96,-1.14,1.34,.42,28.9,ivory);
  for(const u of [-14.5,16.0,36.8])g.box(u,15.85,13.32,.62,15.6,.13,0x4d797b);
  batch.finish();
  glazing.finish();
}

// Fit paint to the *rendered* parking surface. Short strips follow the ground
// even alongside the shallow grade at the library's eastern end.
function pavedMarkings(scene,ground,name) {
  const positions=[],colours=[],rgb=new THREE.Color();
  function quad(a,b,c,d,color,lift){
    rgb.set(color);
    for(const p of [a,b,c,a,c,d]){
      positions.push(p[0],ground(...p)+lift,p[1]);
      colours.push(rgb.r,rgb.g,rgb.b);
    }
  }
  function stripe(a,b,width,color,lift=.029) {
    const dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);
    if(len<.001)return;
    const nx=-dz/len*width/2,nz=dx/len*width/2,n=Math.ceil(len/.8);
    for(let i=0;i<n;i++){
      const start=[a[0]+dx*i/n,a[1]+dz*i/n],end=[a[0]+dx*(i+1)/n,a[1]+dz*(i+1)/n];
      quad([start[0]-nx,start[1]-nz],[start[0]+nx,start[1]+nz],
        [end[0]+nx,end[1]+nz],[end[0]-nx,end[1]-nz],color,lift);
    }
  }
  function bay (x,z,width,depth,color,lift=.017,cell=.75){
    // Tile both dimensions before applying graphics. Sampling only the four
    // outside corners can cut through a triangle along a parking apron seam.
    const nx=Math.ceil(width/cell),nz=Math.ceil(depth/cell);
    for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){
      const a=x-width/2+i*width/nx,b=a+width/nx,c=z-depth/2+j*depth/nz,d=c+depth/nz;
      quad([a,c],[a,d],[b,d],[b,c],color,lift);
    }
  }
  function finish(){
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geo.setAttribute('color',new THREE.Float32BufferAttribute(colours,3));
    geo.computeVertexNormals();geo.computeBoundingSphere();
    const mat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.94,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
    const mesh=new THREE.Mesh(geo,mat);mesh.name=name;mesh.receiveShadow=true;
    scene.add(mesh);
  }
  return {quad,stripe,bay,finish};
}
function libraryBays(scene,world,ground) {
  const lot=id=>world.D.areas.find(a=>a.id===id);
  const access=lot(1529457523),electric=lot(1528037586);
  if(!access||!electric)return;
  const {stripe,bay,finish}=pavedMarkings(scene,ground,'N10 accessible and electric parking markings');
  const white=0xf0eee4;
  function wheelchair(x,z) {
    const p=(a,b)=>[x+a,z+b];
    const line=(a,b,w=.105)=>stripe(p(...a),p(...b),w,white,.034);
    const ring=(cx,cz,r,start,end,w)=>{
      const n=Math.ceil(Math.abs(end-start)*r/.14);
      for(let i=0;i<n;i++){
        const a=start+(end-start)*i/n,b=start+(end-start)*(i+1)/n;
        line([cx+r*Math.cos(a),cz+r*Math.sin(a)],[cx+r*Math.cos(b),cz+r*Math.sin(b)],w);
      }
    };
    ring(-.11,.22,.41,-.6,Math.PI*1.30,.11);
    ring(.02,-.49,.095,0,Math.PI*2,.095);
    line([-.005,-.31],[-.035,.1]);line([-.035,.08],[.30,.11]);
    line([.30,.11],[.47,.43]);line([.47,.43],[.60,.38]);
  }
  const blue=0x2f76b9,green=0x467c70;
  const fixtures=neighbourhood(scene,'N10 accessible bay signs and wheel stops');
  const rear=-487.43,front=-492.58,hatch=front+.91;
  function signAndStops(x,atZ){
    for(const side of [-1,1]){
      const xx=x+side*.64,zz=atZ-.20,y=ground(xx,zz);
      fixtures.instance(unitBox,[xx,y+.073,zz],[.78,.146,.23],0x424443,0);
      for(const dx of [-.21,.21])fixtures.instance(unitBox,[xx+dx,y+.14,zz-.034],[.12,.041,.15],0xd0a049,0);
    }
    const z=atZ+.67;
    if(world.access.isDrivable(x,z))return;
    const f=frame(x,z,0,ground(x,z),fixtures);
    f.box(0,.91,0,.046,1.82,.052,0xabaaa0);
    f.box(0,1.58,0,.49,.57,.065,0xe5e4df);
    f.box(0,1.70,-.038,.46,.25,.016,0x336db0);
    for(let k=0;k<3;k++)f.box(0,1.49-.046*k,-.038,.31-.047*(k%2),.015,.016,0x6d8690);
  }
  // Camera 784 looks straight at two blue bays with side access aisles.
  // A continuous strip of hatching also runs along the street edge.
  const left=-179.59,right=-170.46;
  bay((left+right)/2,(rear+front)/2,right-left,rear-front,blue);
  stripe([left,rear],[right,rear],.105,white);
  stripe([left,hatch],[right,hatch],.105,white);
  stripe([left,front],[right,front],.105,white);
  for(const x of [left,right])stripe([x,front],[x,rear],.105,white);
  for(let x=left+.12;x<right-.78;x+=1.03)
    stripe([x,front],[x+.70,hatch],.11,white);
  for(const centre of [-176.91,-172.56]){
    wheelchair(centre,(rear+hatch)/2);
    const inner=centre+1.25,outer=centre+2.07;
    for(const x of [inner,outer])stripe([x,hatch],[x,rear],.105,white);
    for(let z=hatch+.17;z<rear-.60;z+=.80)stripe([inner,z+.53],[outer,z],.11,white);
    signAndStops(centre,rear);
  }
  // At camera 711 the adjacent accessible stall is ordinary dark asphalt
  // with a white wheelchair and striped aisle, in front of the columns.
  const darkCentre=-161.85,za=-489.5;
  wheelchair(darkCentre,za);
  for(const x of [darkCentre-1.27,darkCentre+1.27,darkCentre+2.10])
    stripe([x,za-1.95],[x,za+1.95],.10,white);
  stripe([darkCentre-1.27,za-1.95],[darkCentre+2.1,za-1.95],.09,white);
  for(let z=za-1.80;z<za+1.41;z+=.68)stripe([darkCentre+1.27,z+.53],[darkCentre+2.1,z],.10,white);
  signAndStops(darkCentre,za+1.94);
  fixtures.finish();
  // The three end bays lie wholly inside the long street-side parking
  // polygon opposite the library. Keep the through lane and the gap to the
  // eastern parking entrance clear.
  const ze=-503.71,first=-158.50,pitch=2.55;
  const batch=neighbourhood(scene,'N10 electric charging pedestals');
  for(let i=0;i<3;i++){
    const x=first+i*pitch,bottom=ze-2.66,top=ze+2.67;
    bay(x,ze,pitch-.03,top-bottom,green);
    for(const side of [-1,1])stripe([x+side*(pitch/2-.05),bottom],[x+side*(pitch/2-.05),top],.085,white);
    stripe([x-pitch/2,top],[x+pitch/2,top],.093,white);
    const line=(a,b)=>stripe([x+a[0],ze+a[1]],[x+b[0],ze+b[1]],.10,white,.031);
    line([.12,-.48],[-.22,.04]);line([-.22,.04],[.14,.04]);line([.14,.04],[-.12,.48]);
    const postZ=-507.04;
    if(world.access.isDrivable(x,postZ))continue;
    const f=frame(x,postZ,0,ground(x,postZ),batch);
    f.box(0,.1,0,.39,.2,.34,0x9a9d96);
    f.box(0,.82,0,.14,1.46,.12,0x4d5555);
    f.box(0,1.39,.015,.34,.46,.21,0x556c7c);
    f.box(0,1.44,.131,.24,.18,.023,0x1d343c);
    f.box(0,1.57,.135,.18,.045,.025,0x8ca7a3);
    f.stick([.12,1.24,.10],[.19,.42,.16],.038,0x414749);
    f.stick([.19,.42,.16],[.31,.38,.16],.038,0x414749);
    f.stick([.31,.38,.16],[.29,1.13,.095],.038,0x414749);
  }
  batch.finish();
  finish();
}

function solarParking(scene,world,ground) {
  if(!world.D.buildings.some(b=>b.id===metaHallId))return;
  const {length,depth,angle}=n29Parking,plan=n29ParkingPoint;
  const at=(u,v,h=0)=>{const [x,zz]=plan(u,v);return [x,ground(x,zz)+h,zz];};
  const marks=pavedMarkings(scene,ground,'N29 solar parking terrace');
  const north=-depth/2,south=depth/2,white=0xdeddd5;
  const mark=(u,v,a,b,w,l=.13)=>marks.stripe(plan(u,v),plan(a,b),w,white,l);
  function surface(u0,u1,v0,v1,color,lift,cell=1.5){
    const nu=Math.ceil((u1-u0)/cell),nv=Math.ceil((v1-v0)/cell);
    for(let i=0;i<nu;i++)for(let j=0;j<nv;j++){
      const l=u0+(u1-u0)*i/nu,r=u0+(u1-u0)*(i+1)/nu,a=v0+(v1-v0)*j/nv,b=v0+(v1-v0)*(j+1)/nv;
      marks.quad(plan(l,a),plan(l,b),plan(r,b),plan(r,a),color,lift);
    }
  }
  // The separate public viewpoints at the upper cycle rail and the east
  // mouth show opposite ends of the same canopy. East bays have black
  // asphalt. Green chargers occupy the west and the internal island.
  const green=0x426d62,buildingRow=-34.1;
  for(let i=0;i<21;i++){
    const u=1.45+i*2.65;
    if(i<3)surface(u-1.31,u+1.31,buildingRow-2.55,buildingRow+2.55,0x466984,.112);
    mark(u-1.27,buildingRow-2.50,u-1.27,buildingRow+2.45,.086);
    mark(u-1.27,buildingRow-2.50,u+1.27,buildingRow-2.50,.084);
  }
  const count=27,pitch=length/count;
  for(let i=0;i<count;i++){
    const u=(i+.5)*pitch;
    if(i<4)surface(u-pitch*.49,u+pitch*.49,north+.11,south-.11,green,.112);
    for(const side of [-1,1])mark(u+side*pitch*.482,north+.14,u+side*pitch*.482,south-.16,.09);
    mark(u-pitch*.48,south-.16,u+pitch*.48,south-.16,.09);
    if(i<4){
      mark(u-.12,.24,u+.14,-.12,.094,.134);mark(u+.14,-.12,u-.16,-.12,.094,.134);mark(u-.16,-.12,u+.10,-.47,.094,.134);
    }
  }
  const structure=neighbourhood(scene,'N29 photovoltaic carport');
  const glass=neighbourhood(scene,'N29 solar modules',new THREE.MeshStandardMaterial({roughness:.39,metalness:.18}));
  // Surface grading changes on the high residential lane next to the lot.
  // Interpolate along the PV support line rather than following that bank.
  const westGrade=ground(...plan(0,-3.1)),eastGrade=ground(...plan(length,-3.1));
  const roofY=(u,v)=>westGrade+(eastGrade-westGrade)*u/length+3.24-v*.19;
  const roof=(u,v,offset=0)=>{const [x,zz]=plan(u,v);return [x,roofY(u,v)+offset,zz];};
  const lengthSlope=Math.atan2(eastGrade-westGrade,length);
  const rot=new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.atan(.19),-angle,lengthSlope,'YXZ'));
  const panelDepth=depth/3,columns=38,panelWidth=length/columns;
  for(let j=0;j<3;j++)for(let k=0;k<columns;k++){
    const u=(k+.5)*panelWidth,v=north+(j+.5)*panelDepth;
    glass.instance(unitBox,roof(u,v),[panelWidth-.032,.088,panelDepth*Math.hypot(1,.19)-.036],
      [0x384250,0x404a59,0x3b4757][(j+k*2)%3],rot);
    for(let line=1;line<3;line++){
      const cell=v+panelDepth*(line/3-.5);
      glass.instance(unitBox,roof(u,cell,.049),[panelWidth-.05,.009,.011],0x8a989e,rot);
    }
  }
  for(let i=0;i<=columns;i++){
    const u=i*panelWidth;
    structure.strut(roof(u,north),roof(u,south),.054,0xadb6b6,true);
  }
  for(let j=0;j<=3;j++){
    const v=north+panelDepth*j;
    structure.strut(roof(0,v),roof(length,v),.052,0xa1acab,true);
  }
  for(let i=0;i<=10;i++){
    const u=.40+(length-.80)*i/10,v=.77;
    structure.strut(at(u,v,.09),roof(u,v,-.14),.17,0x65584e,true);
    for(const end of [north+.17,south-.11]){
      structure.strut(roof(u,v,-1.07),roof(u,end,-.17),.082,0x786957,true);
    }
    structure.strut(roof(u,north,-.14),roof(u,south,-.14),.136,0x87796c,true);
  }
  for(let j=0;j<9;j++){
    const u=11.8+j*2.70,v=-17.14;
    surface(u-1.32,u+1.32,v-2.50,v+2.54,green,.112);
    mark(u-1.30,v-2.49,u-1.30,v+2.50,.096);mark(u-1.30,v+2.50,u+1.30,v+2.50,.096);
    mark(u-.15,v+.23,u+.14,v-.10,.095);mark(u+.14,v-.10,u-.13,v-.10,.095);mark(u-.13,v-.10,u+.11,v-.48,.095);
    if(j%3===1){
      const p=at(u,v-3.02,.10),f=frame(p[0],p[2],angle,p[1],structure);
      f.box(0,.91,0,.74,1.84,.44,0x445c9b);f.box(0,1.23,.231,.31,.24,.040,0xb9c4c5);
      f.box(0,.14,.02,.91,.28,.57,0x6d7080);
    }
  }
  // The panorama directly in front shows a line of low cones and a striped
  // tape across the entrance. The physical travel limit already follows the
  // edge of the public turnaround.
  const coneShape=new THREE.ConeGeometry(.18,.56,12),cones=[];
  for(let i=0;i<5;i++){
    const u=length+2.61,v=-2.65-i*1.82,p=at(u,v,.1);
    structure.instance(unitBox,[p[0],p[1]+.03,p[2]],[.43,.064,.43],0x6e6158,-angle);
    structure.instance(coneShape,[p[0],p[1]+.32,p[2]],[1,1,1],0xd96c43,-angle);
    structure.instance(unitPost,[p[0],p[1]+.37,p[2]],[.14,.075,.14],0xdddcd0,-angle);
    cones.push([p[0],p[1]+.55,p[2]]);
  }
  for(let j=1;j<cones.length;j++)for(let k=0;k<10;k++){
    const a=cones[j-1],b=cones[j],p=t=>a.map((value,i)=>value+(b[i]-value)*t-(i===1?.065*Math.sin(t*Math.PI):0));
    structure.strut(p(k/10),p((k+1)/10),.045,k%2?0x455344:0xc5be63,true);
  }
  marks.finish();
  structure.finish();glass.finish();
}

function parkBicycle(batch,x,y,z,angle,i){
  const f=frame(x,z,angle,y,batch);
  const tube=[0x37444d,0x547580,0x594645,0x5e6260,0x596247,0x987357][i%6];
  for(const c of [-.51,.53]){
    batch.instance(rubber,f.point(c,.325,0),[1,1,1],0x3b4140,f.yaw);
    for(let k=0;k<3;k++){
      const t=k*Math.PI/3,rx=Math.cos(t)*.285,ry=Math.sin(t)*.285;
      f.stick([c-rx,.325-ry,0],[c+rx,.325+ry,0],.014,0x939992);
    }
  }
  f.stick([-.51,.325,0],[-.17,.75,0],.042,tube);
  f.stick([-.17,.75,0],[.00,.36,0],.045,tube);
  f.stick([.00,.36,0],[-.51,.325,0],.031,tube);
  f.stick([.00,.36,0],[.32,.78,0],.052,tube);
  f.stick([-.17,.75,0],[.32,.78,0],.039,tube);
  f.stick([.32,.78,0],[.53,.325,0],.042,0x656d6d);
  f.stick([.32,.78,0],[.30,.96,0],.034,0xa7aca5);
  f.stick([.30,.96,-.24],[.30,.96,.24],.041,0x545a58);
  f.box(-.17,.806,0,.22,.060,.15,0x343937);
}

function silloeBicycleVerge(scene,world,ground) {
  // Mapped bicycle-parking way 1527898786. Two November headings show
  // the same unroofed stands and the taller square-post railing behind them.
  const a=[-261.28,-621.53],b=[-228.72,-559.10];
  const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
  const ux=dx/length,uz=dz/length,angle=Math.atan2(uz,ux);
  const point=(along,side)=>[a[0]+ux*along+uz*side,a[1]+uz*along-ux*side];
  const at=(u,side,h)=>{const [x,z]=point(u,side);return [x,ground(x,z)+h,z];};
  const batch=neighbourhood(scene,'N20 bicycle verge and downhill rail');
  const bar=0xa7aca5;
  const n=Math.ceil(length/4.25);
  for(let i=0;i<=n;i++){
    const u=length*i/n, p=at(u,.91,0);
    if(world.access.isDrivable(p[0],p[2]))continue;
    batch.strut(at(u,.91,-.03),at(u,.91,1.34),.15,bar,true);
    if(i<n){
      batch.strut(at(u,.91,1.34),at(length*(i+1)/n,.91,1.34),.135,0x999e97,true);
      batch.strut(at(u,.91,.50),at(length*(i+1)/n,.91,.50),.048,0x838c84);
    }
  }
  const count=54,rackPitch=length/count;
  for(let i=0;i<count;i++){
    const u=(i+.48)*rackPitch;
    // Each U-stand is on the mapped parking strip rather than its approach.
    for(const edge of [-.18,.18])batch.strut(at(u+edge,.47,.055),at(u+edge,.47,.70),.035,0x8e968e);
    batch.strut(at(u-.18,.47,.70),at(u+.18,.47,.70),.035,0x8e968e);
    if(i%11===4||i%13===5)continue;
    const side=-.06+.14*Math.cos(i*4.3),u0=u+.073*Math.sin(i*2.19);
    const [x,z]=point(u0,side);
    if(world.access.isDrivable(x,z))continue;
    parkBicycle(batch,x,ground(x,z),z,angle+Math.PI*.5+.145*Math.sin(i*3.77),i);
  }
  batch.finish();
}

function housingBikeShelters(scene,world,ground) {
  const bike=neighbourhood(scene,'W4 residential bicycle shelters · frames and cycles');
  const roofVertices=[],roofColours=[],paint=new THREE.Color();
  const strip=(a,b,c,d,color)=>{
    paint.set(color);
    for(const p of [a,b,c,a,c,d]){roofVertices.push(...p);roofColours.push(paint.r,paint.g,paint.b);}
  };
  // Roof directions are visible in the public aerial view. The thinner,
  // curved, dull green sheets are confirmed at ground level in November
  // 2026 on the eastern side and November 2020 inside the western bays.
  const rows=[
    {a:[-450.15,138.65],b:[-440.84,173.3],w:2.56},
    {a:[-469.26,136.92],b:[-450.52,132.90],w:2.42},
    {a:[-431.18,183.84],b:[-408.42,184.04],w:2.70},
    {a:[-487.38,152.48],b:[-480.53,150.80],w:2.35,scooter:true},
    {a:[-474.26,138.38],b:[-472.27,147.72],w:2.25}
  ];
  const valid=(x,z)=>!world.access.isDrivable(x,z);
  for(const row of rows){
    const dx=row.b[0]-row.a[0],dz=row.b[1]-row.a[1],len=Math.hypot(dx,dz);
    const ux=dx/len,uz=dz/len,uphill=Math.atan2(dz,dx);
    const coords=(u,v)=>[row.a[0]+ux*u-uz*v,row.a[1]+uz*u+ux*v];
    const n=Math.max(2,Math.round(len/2.4)),width=row.w;
    const profile=t=>2.04+.42*Math.sin(Math.PI*t);
    const canopy=(s,t)=>{
      const [x,z]=coords(s,width*(t-.5)),c=coords(s,0);
      return [x,ground(...c)+profile(t),z];
    };
    for(let i=0;i<n;i++){
      const l=len*i/n,r=len*(i+1)/n;
      // A clerical footprint may graze a vehicle verge. Keep each rigid
      // column and every parked cycle wholly out of the drivable strip.
      const se=coords(l+.09,0),ne=coords(r-.09,0);
      if(!valid(...se)||!valid(...ne))continue;
      for(let j=0;j<8;j++){
        const t=j/8,t1=(j+1)/8;
        strip(canopy(l,t),canopy(r,t),canopy(r,t1),canopy(l,t1),
          j===0||j===7?0x498279:(i%3===1?0x61988d:0x5b9189));
        bike.strut(canopy(l,t),canopy(l,t1),.047,0xc1c7ba);
        if(i===n-1)bike.strut(canopy(r,t),canopy(r,t1),.047,0xc1c7ba);
      }
      for(const t of [0,1])bike.strut(canopy(l,t),canopy(r,t),.043,0x6d7972);
      for(const side of [-1,1]){
        const [x,z]=coords(l+.08,side*width*.34);
        if(valid(x,z))bike.strut([x,ground(x,z)-.035,z],canopy(l+.08,.5+side*.34),.066,0x6e786c);
      }
      for(let j=0;j<2;j++){
        if((i*2+j)%9===0)continue;
        const [x,z]=coords(l+(r-l)*(.28+j*.42),.10*Math.cos(i+j));
        if(!valid(x,z))continue;
        if(!row.scooter){parkBicycle(bike,x,ground(x,z),z,uphill+Math.PI/2+.1*Math.sin(i+j),i*2+j);continue;}
        const f=frame(x,z,uphill+Math.PI/2,ground(x,z),bike);
        for(const c of [-.53,.53])bike.instance(rubber,f.point(c,.23,0),[.72,.72,1.7],0x363b3a,f.yaw);
        f.box(-.13,.39,0,1.03,.34,.42,i%2?0x6a7777:0x4e575c);
        f.box(-.28,.62,0,.66,.17,.38,0x3d4341);
        f.stick([.33,.37,0],[.53,.85,0],.18,0x505b5c);
        f.stick([.52,.86,-.23],[.52,.86,.23],.053,0x434b48);
      }
    }
  }
  if(roofVertices.length){
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(roofVertices,3));
    g.setAttribute('color',new THREE.Float32BufferAttribute(roofColours,3));g.computeVertexNormals();g.computeBoundingSphere();
    const m=new THREE.Mesh(g,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.55,metalness:.12,side:THREE.DoubleSide}));
    m.name='W4 residential bicycle shelters · curved green roofs';m.castShadow=m.receiveShadow=true;scene.add(m);
  }
  bike.finish();
}

function facadeLetters(scene,text,pos,yaw,width,height,color) {
  if(typeof document==='undefined')return;
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;
  const ctx=canvas.getContext('2d');
  ctx.font='700 '+(text.length>6?72:108)+'px Arial, sans-serif';
  ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.shadowColor='#332f32';ctx.shadowBlur=1.75;ctx.shadowOffsetX=2;ctx.shadowOffsetY=3;
  ctx.fillText(text,256,67,500);
  const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;
  const m=new THREE.Mesh(new THREE.PlaneGeometry(width,height),new THREE.MeshStandardMaterial({
    map:tex,transparent:true,alphaTest:.32,depthWrite:false,roughness:.86
  }));
  m.position.set(...pos);m.rotation.y=yaw;m.name=text+' facade lettering';scene.add(m);
  return m;
}

function industrialDesignSouthEntrance(scene,world,ground,terrain){
  const hall=world.D.buildings.find(b=>b.ref==='N25');
  if(!hall)return;
  // The number is on the south wing, between the upper two rows of windows.
  // Both the May 2023 view at the end of the service lane and the older view
  // across the forecourt put the boardwalk west of the accessible parking.
  const signX=17.8,wallZ=-403.0;
  const elevations=hall.p.map(([x,z])=>terrain(x,z));
  const roof=(Math.min(...elevations)+Math.max(...elevations))*.5+hall.h;
  facadeLetters(scene,'N25',[signX,roof-2.73,wallZ+.14],0,11.20,2.50,'#ac3549');

  const west=-11.85,east=2.59,front=-390.20,back=-402.99,run=.43;
  const trees=(world.treeLods||[]).flatMap(lod=>lod.instances)
    .filter(t=>t.x>west-1&&t.x<east+1&&t.z>back-1&&t.z<front+1);
  const vertices=[],colors=[],tint=new THREE.Color();
  function quad(a,b,c,d,color){
    vertices.push(...a,...b,...c,...a,...c,...d);
    tint.setHex(color);
    for(let i=0;i<6;i++)colors.push(tint.r,tint.g,tint.b);
  }
  // Fit the upper platform to one plane. The shallow approach treads follow
  // the forecourt's crossfall so neither end begins with a tall first step.
  const cx=(west+east)/2,cz=(front+back)/2;
  const gradeX=(ground(east,cz)-ground(west,cz))/(east-west);
  const gradeZ=(ground(cx,back)-ground(cx,front))/(back-front);
  const plane=(x,z)=>gradeX*(x-cx)+gradeZ*(z-cz);
  let support=-Infinity;
  for(let i=0;i<=14;i++)for(let j=0;j<=13;j++){
    const x=west+(east-west)*i/14,z=front+(back-front)*j/13;
    support=Math.max(support,ground(x,z)-plane(x,z));
  }
  const level=(x,z,offset)=>{
    const soil=ground(x,z),platform=support+plane(x,z);
    const blend=Math.max(0,Math.min(1,(front-z-1.4)/4.5));
    const toe=Math.min(platform,soil+.028);
    return [x,offset<0?soil+offset:toe+(platform-toe)*blend+offset,z];
  };
  const shades=[0x665346,0x6d594a,0x645044,0x715d50,0x6b5647];
  for(let stair=0;stair<3;stair++){
    const near=front-stair*run,far=stair===2?back:near-run;
    const top=.13+stair*.125,rows=Math.ceil((near-far)/.19);
    for(let row=0;row<rows;row++){
      const a=near+(far-near)*row/rows,b=near+(far-near)*(row+1)/rows;
      const openings=trees.filter(t=>t.z-.76<a&&t.z+.76>b).sort((p,q)=>p.x-q.x);
      const edges=[west];
      for(const tree of openings){
        const left=Math.max(west,tree.x-.76),right=Math.min(east,tree.x+.76);
        if(right<=left)continue;
        if(left>edges.at(-1))edges.push(left,right);
        else edges[edges.length-1]=Math.max(edges.at(-1),right);
      }
      edges.push(east);
      for(let s=0;s<edges.length;s+=2){
        const left=edges[s],right=edges[s+1];
        if(right-left<.04)continue;
        const pieces=Math.ceil((right-left)/(stair<2?1.1:2.8));
        for(let k=0;k<pieces;k++){
          const l=left+(right-left)*k/pieces,r=left+(right-left)*(k+1)/pieces;
          const seam=b+Math.min(.009,(a-b)*.10);
          quad(level(l,a,top),level(r,a,top),level(r,seam,top),level(l,seam,top),shades[(row*3+k)%shades.length]);
          quad(level(l,seam,top),level(r,seam,top),level(r,b,top),level(l,b,top),0x584b40);
          if(!row)quad(level(l,a,-.03),level(r,a,-.03),level(r,a,top),level(l,a,top),0x483a31);
        }
        for(const x of [left,right])quad(level(x,a,-.03),level(x,b,-.03),level(x,b,top),level(x,a,top),0x534338);
      }
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.computeVertexNormals();geometry.computeBoundingSphere();
  const deck=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,roughness:.95}));
  deck.name='N25 south entrance timber deck and three treads';deck.receiveShadow=true;scene.add(deck);
}

function dormitoryEnds(scene,world,terrain){
  for(const [ref,x,z,w,top,step] of [['N18',-223.90,-524.8,6.85,14.10,3.05],['N21',-278.80,-647.12,7.10,15.30,3.32]]){
    const b=world.D.buildings.find(v=>v.ref===ref);
    if(!b)continue;
    const base=terrain(x,z),batch=neighbourhood(scene,ref+' eastern end · concrete stairs');
    const f=frame(x,z,-Math.PI/2,base,batch);
    const front=1.58,white=0xd5d4ca,edge=0xabab9f;
    // The white flights are open on the camera side in the two November
    // street views. Their backing is masonry; the sky cannot show through
    // the dwelling. End landings and the stair are cantilevered together.
    for(let floor=0;floor<4;floor++){
      const h=1.18+step*floor,left=-w*.49,right=w*.49;
      f.box(0,h+.64,.057,w,1.58,.12,0x54483f);
      for(const [u0,u1,rise] of [[left,-w*.22,0],[-w*.22,w*.22,step*.49],[w*.22,right,0]]){
        const level0=h+(u0>=w*.22?step*.49:0),level1=level0+rise;
        const pieces=rise?7:1;
        for(let j=0;j<pieces;j++){
          const u=u0+(u1-u0)*(j+.5)/pieces,l=level0+(level1-level0)*(j+.5)/pieces;
          f.box(u,l+.01,.86,(u1-u0)/pieces+.013,.18,1.52,edge);
        }
        // A single continuous sloped parapet, including the oblique runs.
        const q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),Math.atan2(rise,u1-u0));
        q.premultiply(new THREE.Quaternion().setFromAxisAngle(up,Math.PI/2));
        batch.instance(unitBox,f.point((u0+u1)/2,(level0+level1)/2+.42,front),
          [Math.hypot(u1-u0,rise)+.026,.92,.15],white,q);
      }
      for(const sign of [-1,1]){
        const hEnd=h+(sign>0?step*.49:0);
        f.box(sign*w*.49,hEnd+.42,.85,.15,.92,1.54,white);
      }
    }
    f.box(w*.12,1.02,.083,1.08,1.99,.12,0x364846);
    f.box(w*.12,1.94,.16,.82,.105,.026,0x617271);
    // The raised code on N21 faces its courtyard. On N18 it faces east
    // above the unbroken brick section beside the stair.
    if(ref==='N21')facadeLetters(scene,'N21',[-282.7,base+top,-640.36],0,3.05,1.37,'#ae3449');
    else facadeLetters(scene,'N18',[x+.092,base+top,z-4.26],Math.PI/2,2.31,1.27,'#ae3449');
    batch.finish();
  }
}

function dormitoryEntrances(scene,world,terrain){
  for(const [ref,x,z,angle,w,name] of [
    ['N17',-280.72,-464.88,0,7.45,'Seongsil Hall'],['N20',-261.80,-581.9,-Math.PI/2,7.45,'Silloe Hall']
  ]){
    const b=world.D.buildings.find(v=>v.ref===ref);
    if(!b)continue;
    const batch=neighbourhood(scene,ref+' entrance · glazed porch');
    const base=terrain(x,z),f=frame(x,z,angle,base,batch);
    const extent=ref==='N17'?2.19:1.73,silver=0xc6c9c2;
    f.box(0,3.02,extent*.50,w,.40,extent,silver);
    f.box(0,3.04,extent+.038,w,.37,.11,0xd5d6ce);
    for(const side of [-1,1])f.box(side*(w*.5-.19),1.46,extent-.19,.25,2.92,.28,silver);
    // Glazed entry, with sidelights. Keep the darker pane behind the
    // doorframe so the through-view cannot expose the rear of the building.
    f.box(0,1.39,.075,w-.72,2.80,.12,0x3a5054);
    for(let j=0;j<=6;j++)f.box((j-3)*(w-.8)/6,1.38,.166,.054,2.76,.051,0x829596);
    f.box(0,2.01,.17,w-.74,.074,.054,0x95a4a1);
    if(ref==='N20'){
      f.box(0,4.66,.05,w,2.47,.115,0xafb8b6);
      f.box(0,4.46,.118,w-.40,1.68,.063,0x5c7377);
      for(let j=-2;j<=2;j++)f.box(j*w/5,4.46,.163,.08,1.69,.042,0xb0b9b5);
    }
    facadeLetters(scene,name,f.point(0,3.05,extent+.104),-angle,w*.78,.38,'#354e69');
    batch.finish();
  }
}

function jihyeEntrance(scene,world,terrain,ground){
  const hall=world.D.buildings.find(b=>b.ref==='N21'),entry=hall?.entrances?.find(p=>p[2]==='main');
  if(!entry)return;
  const [x,frontZ]=entry,z=frontZ-3.90;
  const base=ground(x,frontZ+1.65),heights=hall.p.map(p=>terrain(...p));
  const top=hall.h+(Math.min(...heights)+Math.max(...heights))*.5-base;
  const build=neighbourhood(scene,'N21 Jihye Hall · entrance and cycle court');
  const glass=neighbourhood(scene,'N21 entrance glazing',new THREE.MeshStandardMaterial({roughness:.33,metalness:.16}));
  const f=frame(x,z,0,base,build),g=frame(x,z,0,base,glass);
  const blue=0x82afc1,silver=0xa6aeaf,ivory=0xbaceda,half=4.41;
  f.box(0,top*.50,.065,8.82,top+.48,.152,ivory);
  for(let n=0;n<4;n++){
    const h=4.83+(top-5.36)*n/4;
    g.box(0,h,.194,8.65,1.45,.10,0x5b6a6f);
    f.box(0,h-.28,.267,8.66,.071,.05,silver);
    for(let j=-3;j<=3;j++)f.box(j*1.22,h,.267,.053,1.45,.05,0x839397);
  }
  const canopyDepth=4.72,head=3.42,landing=.43;
  f.box(0,head-.27,canopyDepth/2,8.88,.55,canopyDepth,blue);
  for(const side of [-1,1]){
    f.box(side*(half-.24),1.53,canopyDepth*.50,.47,3.20,canopyDepth,blue);
    for(const h of [1.16,2.31])f.box(side*(half+.006),h,canopyDepth*.50,.023,.018,canopyDepth,0x739aab);
    for(const v of [1.24,2.61,3.95])f.box(side*(half+.006),1.66,v,.026,3.19,.016,0x739aab);
  }
  g.box(0,1.72,1.11,7.77,2.64,.16,0x314449);
  for(let j=-3;j<=3;j++)f.box(j*1.10,1.72,1.23,.063,2.65,.062,0x848c8f);
  f.box(0,1.43,1.24,7.76,.091,.043,0x597583);
  f.box(0,2.73,1.24,7.76,.061,.058,silver);
  f.box(0,landing-.19,3.12,7.89,.38,3.88,0xb8b6a9);
  // Three low granite treads beside the ramp. The steel rail follows the
  // descending slope and stops at the pavement clear of the service lane.
  for(let i=0;i<3;i++){
    const h=landing*(3-i)/3,v=5.14+.33*i;
    f.box(-.84,h/2,v,4.60,h,.35,0xc1bfb0);
    if(i===0||i===2)f.box(-.84,h+.009,v+.09,3.38,.016,.13,0xc5ad61);
  }
  const rampStart=2.30,rampEnd=7.07,run=rampEnd-rampStart,centre=2.62,rampWidth=1.50;
  for(let j=0;j<14;j++){
    const v=rampStart+run*(j+.5)/14,h=landing*(1-(j+.5)/14);
    f.box(centre,h/2,v,rampWidth,h+.025,run/14+.01,0xb0b1a8);
  }
  for(const side of [-1,1]){
    const u=centre+side*(rampWidth*.50+.04);
    f.stick([u,landing+.89,rampStart],[u,.89,rampEnd],.051,silver);
    for(const t of [0,.5,1])f.stick([u,landing*(1-t),rampStart+t*run],[u,landing*(1-t)+.89,rampStart+t*run],.042,silver);
    if(side>0)f.box(u+.09,.27,(rampStart+rampEnd)/2,.18,.64,run,0xadc6ca);
  }
  f.box(3.99,1.08,canopyDepth+.91,.53,2.16,.47,0xb55f46);
  facadeLetters(scene,'N21',f.point(3.99,1.61,canopyDepth+1.16),0,.47,.67,'#f6e7cc');
  facadeLetters(scene,'Jihye Hall',f.point(0,head-.25,canopyDepth+.026),0,3.70,.38,'#334353');
  const mark=pavedMarkings(scene,ground,'N21 kick-scooter parking paint');
  // The blue P is paired with a kick scooter. The narrow, parallel bay
  // lies between the entrance and cycle stands, alongside the motor lane.
  const cx=-300.12,cz=-633.83,plaster=0xdad8c9,chalk=0x5492ab;
  const corners=[[cx-2.58,cz-.75],[cx+2.58,cz-.75],[cx+2.58,cz+.75],[cx-2.58,cz+.75]];
  corners.forEach((p,i)=>mark.stripe(p,corners[(i+1)%4],.082,plaster,.045));
  mark.bay(cx,cz,1.19,.78,plaster,.051);
  function scooterLine(x1,z1,x2,z2,w){mark.stripe([cx+x1,cz+z1],[cx+x2,cz+z2],w,chalk,.069);}
  scooterLine(-.27,.17,.28,.17,.072);scooterLine(.26,.17,.15,-.27,.068);
  scooterLine(.04,-.26,.24,-.26,.076);
  for(const xWheel of [-.30,.31])for(let i=0;i<8;i++){
    const a=i*Math.PI/4,b=(i+1)*Math.PI/4;
    scooterLine(xWheel+.067*Math.cos(a),.18+.067*Math.sin(a),xWheel+.067*Math.cos(b),.18+.067*Math.sin(b),.04);
  }
  mark.finish();
  const signX=-302.58,signZ=-635.12;
  const sign=frame(signX,signZ,-Math.PI/2,ground(signX,signZ),build);
  sign.box(0,.88,0,.046,1.76,.046,silver);
  sign.box(0,1.71,0,.54,.54,.051,0x294776);
  facadeLetters(scene,'P',sign.point(.12,1.80,.035),Math.PI/2,.20,.22,'#e0e6e7');
  for(let i=0;i<22;i++){
    const xx=-296.32+.79*i,zz=-634.49+.04*Math.sin(i*.91);
    if(world.access.isDrivable(xx,zz))continue;
    const y=ground(xx,zz);
    build.strut([xx-.19,y+.06,zz],[xx-.10,y+.63,zz-.26],.031,silver);
    build.strut([xx-.10,y+.63,zz-.26],[xx+.14,y+.63,zz-.26],.031,silver);
    build.strut([xx+.14,y+.63,zz-.26],[xx+.22,y+.06,zz],.031,silver);
    if(i%7!==2&&i%11!==4)parkBicycle(build,xx+.05,y,zz+.27,Math.PI*.50+.06*Math.sin(i*1.72),i);
  }
  build.finish();glass.finish();
}

function northSupportOffice(scene,world,terrain){
  const hall=world.D.buildings.find(b=>b.ref==='N12-1');
  if(!hall)return;
  // These two vertices are the ends of the clipped corner; the main door is
  // mapped on the intermediate vertex. Its public face looks northwest.
  const a=hall.p.at(-1),b=hall.p.at(-3),entry=hall.entrances?.[0];
  if(!entry)return;
  const dx=b[0]-a[0],dz=b[1]-a[1],width=Math.hypot(dx,dz),angle=Math.atan2(dz,dx);
  const x=(a[0]+b[0])/2,z=(a[1]+b[1])/2,base=terrain(...entry.slice(0,2));
  const masonry=neighbourhood(scene,'N12-1-wall',hardware.clone());
  const glass=neighbourhood(scene,'N12-1-glass',new THREE.MeshStandardMaterial({roughness:.34,metalness:.22}));
  const f=frame(x,z,angle,base,masonry),g=frame(x,z,angle,base,glass),w=width-3.29,u=-1.37;
  f.box(0,1.8,.055,width,5.10,.16,0x835346);
  g.box(u,2.15,.20,w,3.95,.18,0x384e56);
  const stops=Math.round(w/1.16);
  for(let k=0;k<=stops;k++)f.box(u-w*.5+w*k/stops,2.15,.325,.067,3.95,.085,0x81888c);
  for(const h of [.58,3.42])f.box(u,h,.33,w,.077,.078,0x7a8385);
  const door= -.65;
  f.box(door,1.64,.38,3.19,3.28,.17,0x41484a);
  g.box(door,1.39,.50,2.78,2.69,.12,0x3c4a4b);
  for(const side of [-1,1])f.box(door+side*.74,1.36,.583,1.34,.072,.022,0x396787);
  f.box(door,1.41,.59,.052,2.69,.034,0x8d9593);
  f.box(door,3.01,.52,3.20,.47,.26,0x39444a);
  f.box(u,4.22,.47,w+.58,.42,1.02,0x42474c);
  f.box(u,4.44,.45,w+.68,.072,1.10,0x575a5b);
  facadeLetters(scene,'Housing Support Office',f.point(door,3.04,.67),-angle,3.02,.30,'#dedfda');
  facadeLetters(scene,'N12-1',f.point(width*.5-1.36,2.91,.15),-angle,2.69,.88,'#a13242');
  masonry.finish();glass.finish();
}

function eurekaFrontage(scene,world,terrain,ground){
  const b=world.D.buildings.find(v=>v.ref==='N27'),entry=b?.entrances?.find(p=>p[2]==='main');
  if(!entry)return;
  const a=b.p[0],east=b.p[4],angle=Math.atan2(east[1]-a[1],east[0]-a[0]);
  const [x,z]=entry,base=terrain(x,z);
  const heights=b.p.map(p=>terrain(...p)),H=b.h+(Math.max(...heights)+Math.min(...heights))/2-base;
  const structure=neighbourhood(scene,'N27-wall',hardware.clone());
  const windows=neighbourhood(scene,'N27-glass',new THREE.MeshStandardMaterial({roughness:.29,metalness:.22}));
  const f=frame(x,z,angle,base,structure),g=frame(x,z,angle,base,windows);
  const left=a[0]-x,right=east[0]-x,centre=(left+right)/2,width=right-left;
  const silver=0xc9ced0,granite=0x67676d,dark=0x374451;
  f.box(centre,(H-1.2)/2,.085,width,H+1.2,.17,silver);
  // The lower two storeys sit behind the tall ochre columns. Above them,
  // each blue ribbon has a close band of smaller operable bottom lights.
  for(const h of [2.05,5.63])g.box(centre,h,.207,width-.65,2.27,.10,0x486875);
  f.box(centre,7.16,.33,width-.36,.19,.62,0xb8bdbe);
  const panelStart=7.57,step=(H-panelStart-.50)/5;
  for(let j=0;j<5;j++){
    const h=panelStart+(j+.50)*step;
    g.box(centre,h,.21,width-.57,1.64,.12,0x548caa);
    f.box(centre,h-.43,.295,width-.57,.042,.052,0x687d86);
    for(let i=0,n=Math.ceil(width/1.43);i<=n;i++){
      const u=left+.30+(width-.60)*i/n;
      f.box(u,h,.296,.047,1.61,.051,0x788b93);
      if((i+j)%9===0)f.box(u+.46,h-.65,.382,.74,.10,.23,dark);
    }
  }
  for(const u of [left+2.6,-2.0,7.86,17.79,27.04]){
    const p=f.point(u,0,.77);
    structure.strut([p[0],base-.09,p[2]],[p[0],base+7.14,p[2]],.285,0xaa814a);
  }
  // The grey inset stair/balcony shaft is separate from the curtain wall.
  const shaft=-5.46;
  f.box(shaft,H*.52,.49,4.34,H*.97,.67,granite);
  f.box(shaft-2.02,H*.53,.84,.48,H*.99,.63,0xa1a1a0);
  for(let i=0;i<5;i++){
    const h=panelStart+(i+.16)*step;
    f.box(shaft-.57,h,.99,2.74,.22,1.33,0xc4c7c4);
    for(const u of [shaft-1.83,shaft-.58,shaft+.66])f.box(u,h+.47,1.53,.043,.78,.044,0x8f9797);
    for(const lift of [.36,.81])f.box(shaft-.59,h+lift,1.53,2.59,.052,.052,0xa3aba8);
  }
  f.box(shaft,H+.21,.54,4.72,.94,1.42,0xacada7);
  facadeLetters(scene,'N27',f.point(right-3.05,H-1.00,.304),-angle,2.67,1.01,'#a83b62');
  // A tall strip of glass wraps around the southeast end; the narrow
  // projecting panes beside it are segmented independently at each floor.
  const end=right+.035;
  g.box(end+.055,H*.51,-3.21,.12,H*.95,5.82,0x3d6678);
  for(const v of [-5.84,-4.39,-2.94,-1.49])f.box(end+.134,H*.51,v,.074,H*.95,.060,0x7a8b90);
  for(let j=0;j<7;j++){
    const y=(j+.50)*H/7;
    g.box(end+.16,y,-7.58,.29,H/7-.32,2.23,0x47788b);
    f.box(end+.13,y-H/14+.08,-7.55,.38,.19,2.52,0xb9c1c2);
    f.box(end+.14,y,-3.21,.059,.082,5.75,0x8a999d);
  }
  // The mapped front walk terminates at the entrance. All roof posts and the
  // low switchback ramp stand on the building side of the existing sidewalk.
  // The overhead image resolves the canopy at roughly 5.3 by 9.4 m. The
  // portico overhangs the public walk; the posts sit back at the upper step.
  const roofDepth=9.10,roofWidth=5.35,roofH=4.16;
  f.box(0,roofH,.60+roofDepth*.5,roofWidth,.44,roofDepth,0xbfc2bd);
  f.box(0,roofH-.245,.60+roofDepth*.5,roofWidth-.13,.067,roofDepth-.12,0x6f716e);
  f.box(0,roofH+.23,.60+roofDepth*.5,roofWidth+.09,.075,roofDepth+.10,0x9faaa9);
  for(const u of [-roofWidth/2+.25,roofWidth/2-.25]){
    f.box(u,2.06,5.91,.40,4.16,.46,0xd4d4cc);
    f.box(u,1.94,6.15,.056,3.78,.026,0xabb5b3);
  }
  f.box(0,1.69,.48,4.42,3.40,.49,0x51565a);
  g.box(0,1.39,.76,3.49,2.72,.12,0x344751);
  for(const u of [-1.71,0,1.71])f.box(u,1.38,.85,.068,2.70,.075,0x919da1);
  facadeLetters(scene,'Eureka Hall',f.point(0,3.04,.737),-angle,2.47,.32,'#e0dfd3');
  const walk=neighbourhood(scene,'N27 entrance · ramp, planter and steps');
  const level=(u,v)=>{const p=f.point(u,0,v);return ground(p[0],p[2])-base;};
  const wf=frame(x,z,angle,base,walk);
  const doorstep=Math.max(level(0,6.1)+.40,level(0,2.0)+.08);
  for(let k=0;k<4;k++){
    // Nested solid treads meet the approach without hanging above a slope.
    const v=6.63-.34*k,top=doorstep-(3-k)*.115,low=Math.min(level(0,v)-.14,top-.10);
    wf.box(0,(top+low)/2,(v+.65)/2,6.39,top-low,v-.65,0xa9aaa2);
  }
  const rampStart=3.19,rampEnd=13.45,rampNear=3.63,rampFar=4.82;
  const rampTop=doorstep+.035,rampDrop=Math.max(.12,Math.min(.72,rampTop-level(rampEnd,rampFar)-.055));
  const rampAngle=-Math.atan2(rampDrop,rampEnd-rampStart);
  const rotated=new THREE.Quaternion().setFromEuler(new THREE.Euler(0,-angle,rampAngle,'YXZ'));
  walk.instance(unitBox,wf.point((rampStart+rampEnd)/2,rampTop-rampDrop*.5-.10,(rampNear+rampFar)/2),
    [Math.hypot(rampEnd-rampStart,rampDrop),.21,rampFar-rampNear+.17],0xbbbcb2,rotated);
  const lower=rampTop-rampDrop;
  wf.box(rampEnd+.52,lower-.08,5.12,1.17,.16,3.10,0xbec0b7);
  for(const v of [3.53,4.72])for(let i=0;i<9;i++){
    const u=3.19+i*1.14,next=u+1.14,va=v+.12,t=i/9;
    const y=rampTop-t*rampDrop,nextY=y-rampDrop/9;
    wf.stick([u,y+.82,va],[next,nextY+.82,va],.049,0xa6aca7);
    if(i%2===0)wf.stick([u,y,va],[u,y+.82,va],.041,0xa5aca8);
  }
  for(let i=0;i<19;i++){
    const u=3.37+i*.53,v=5.55,h=level(u,v);
    wf.box(u,h+.35,v,.62,.70,.90,0x62783f);
  }
  windows.finish();structure.finish();walk.finish();
}

function dormitoryStairApproach(scene,world,terrain,ref){
  const sarang=ref==='N14',name=sarang?'Sarang Hall':'Somang Hall';
  const hall=world.D.buildings.find(b=>b.ref===ref);
  const stair=world.D.roads.find(r=>r.id===(sarang?1037932969:1037932970));
  if(!hall||!stair||!hall.entrances?.length)return;
  const [x,z]=hall.entrances.find(e=>e[2]==='main')||hall.entrances[0];
  const lowerZ=sarang?-388.12:-389.10,lowerY=terrain(x,lowerZ)+.21,landingY=terrain(x,z)+.14;
  const stairs=neighbourhood(scene,ref+' '+name+' · two stair flights and upper porch');
  const brick=[0x8d665b,0x90675e,0x80635b],edge=0xb19585;
  function tread(near,far,top,i){
    const zz=(near+far)/2;
    const tx=x-.4*(zz-z)/(lowerZ-z),depth=near-far;
    if(world.access.isDrivable(tx,zz))return;
    const bottom=Math.min(terrain(tx-3.47,zz),terrain(tx+3.47,zz),top-.19)-.11;
    stairs.instance(unitBox,[tx,(bottom+top)/2,zz],[6.86,top-bottom,depth+.006],brick[i%3],0);
    stairs.instance(unitBox,[tx,top+.012,near-.058],[6.8,.024,.10],edge,0);
    for(const side of [-1,1])stairs.instance(unitBox,[tx+side*3.56,(bottom+top)/2+.09,zz],
      [.26,top+.18-bottom,depth+.012],0x875b4f,0);
  }
  const steps=12,run=sarang?.443:.465,rise=(landingY-lowerY)/(steps*2);
  for(let i=0;i<steps;i++)tread(lowerZ-i*run,lowerZ-(i+1)*run,lowerY+(i+1)*rise,i);
  const middle=sarang?-397.00:-399.17;
  tread(lowerZ-steps*run,middle,lowerY+steps*rise,0);
  for(let i=0;i<steps;i++)tread(middle-i*run,middle-(i+1)*run,lowerY+(steps+1+i)*rise,i);
  tread(middle-steps*run,z+.21,landingY,1);
  // The November head-on view shows stacked open-front landings and a
  // fully glazed ground-floor vestibule. All landing recesses have backs.
  const f=frame(x,z,0,landingY,stairs),silver=0xc3c8be,dark=0x4f4d49,w=6.67;
  f.box(0,1.36,.14,w-.41,2.72,.25,0x47636a);
  f.box(0,2.68,1.10,w+.28,.36,2.13,silver);
  f.box(0,2.71,2.18,w+.32,.30,.13,0xd2d5cc);
  for(const u of [-3.12,-2.20,-1.10,0,1.10,2.20,3.12])f.box(u,1.33,.31,.072,2.66,.069,silver);
  for(const u of [-3.11,3.11])f.box(u,1.37,1.98,.22,2.75,.23,silver);
  for(let i=0;i<3;i++){
    const y=2.97+i*3.03;
    f.box(0,y+1.47,.079,w-.10,2.94,.12,dark);
    f.box(0,y+.15,.67,w,.31,1.38,0xb6b8b2);
    f.box(0,y+.53,1.37,w,.67,.125,i===2?0xdddeda:0xc7c8c2);
    for(const u of [-w*.48,w*.48])f.box(u,y+1.61,1.24,.21,2.87,.22,0x915f51);
    f.box(0,y+2.93,.68,w,.17,1.37,0xabaaa1);
  }
  f.box(0,12.23,.72,w+.48,.22,1.69,0x847f77);
  if(!sarang){
    f.box(w/2+.37,6.43,.20,1.16,12.72,.44,silver);
    f.box(w/2+.37,6.16,.448,.95,9.68,.065,0x5d7a81);
    for(const h of [2.6,4.3,6.0,7.7,9.4])f.box(w/2+.37,h,.503,.97,.069,.044,silver);
    facadeLetters(scene,'N16',f.point(0,9.71,1.454),0,2.05,.81,'#ab3950');
  }else{
    // The separating brick pier continues to the eave at Sarang Hall.
    f.box(0,7.63,1.47,.28,9.26,.29,0x915b4b);
  }
  facadeLetters(scene,name,f.point(.72,2.72,2.257),0,2.51,.34,'#405668');
  const markerX=-429.08,markerZ=-392.31;
  if(!sarang&&!world.access.isDrivable(markerX,markerZ)){
    const marker=frame(markerX,markerZ,0,terrain(markerX,markerZ),stairs);
    marker.box(0,1.02,0,.27,2.04,.62,0xab483b);
    const label=facadeLetters(scene,'N16',marker.point(-.144,1.13,0),-Math.PI/2,1.30,.44,'#faf1d4');
    if(label)label.rotateZ(Math.PI/2);
    marker.box(1.12,1.08,0,.26,2.16,.35,0x41779e);
    marker.box(.974,1.53,0,.041,.41,.15,0xacc8ce);
  }
  // The linked photos show a dark twin lantern on the garden side of each
  // wide stair. Both lamps and their shared stem stay above the flowerbed.
  const lampX=x-4.20,lampZ=lowerZ-.83,datum=terrain(lampX,lampZ);
  const lamp=frame(lampX,lampZ,0,datum,stairs);
  const metal=0x494e4e;
  lamp.stick([0,-.08,0],[0,4.03,0],.12,metal);
  for(const side of [-1,1]){
    lamp.stick([0,3.33,0],[side*.84,3.49,0],.060,metal);
    lamp.stick([side*.84,3.49,0],[side*.84,3.74,0],.051,metal);
    const p=lamp.point(side*.84,3.95,0);
    stairs.instance(unitPost,p,[.29,.50,.29],0xd2d4c6,0);
    for(const h of [3.72,4.13])stairs.instance(unitPost,lamp.point(side*.84,h,0),[.36,.065,.36],metal,0);
    stairs.instance(leaf,lamp.point(side*.84,4.22,0),[.25,.15,.25],metal,0);
  }
  stairs.finish();
}

function areumArchedBay(scene,world,terrain){
  const b=world.D.buildings.find(v=>v.ref==='N19');
  if(!b)return;
  // The November views north from two separate fixed positions put the
  // crest on N19's south face, west of the gap leading up to N16.
  const x=-470.5,z=-413.18,width=9.80,half=width/2;
  const heights=b.p.map(p=>terrain(...p));
  const top=(Math.min(...heights)+Math.max(...heights))/2+b.h;
  const base=terrain(x,z),H=top-base,batch=neighbourhood(scene,'N19 arched bay · brick and frieze');
  const f=frame(x,z,.012,base,batch);
  f.box(0,(H-.1)/2,.42,width,H+.1,1.07,0x8e4c42);
  const front=.96,back=-.40;
  const radius=2.79,spring=H-3.65,lower=Math.max(3.0,spring-4.69);
  const pos=[],colors=[],shade=new THREE.Color();
  const tri=(a,b,c,color)=>{shade.set(color);pos.push(...a,...b,...c);for(let i=0;i<3;i++)colors.push(shade.r,shade.g,shade.b);};
  const tint=0x78a7ad,roof=0x514541;
  tri(f.point(-half,H-.025,front),f.point(half,H-.025,front),f.point(0,H+2.30,front),0x915444);
  // Copper-coloured curved head, stained blue-green glazing and real
  // radial bars in the upper fan instead of a rectangular blue decal.
  f.box(0,(lower+spring)/2,front+.018,radius*2,spring-lower,.095,tint);
  for(let i=0;i<32;i++){
    const a=Math.PI*i/32,c=Math.PI*(i+1)/32;
    const arc=t=>[radius*Math.cos(t),spring+radius*Math.sin(t),front+.074];
    tri(f.point(0,spring,front+.074),f.point(...arc(a)),f.point(...arc(c)),tint);
    f.stick(arc(a),arc(c),.125,0x543f37,true);
  }
  const trim=0x4a5454;
  for(const s of [-radius,0,radius])f.box(s,(lower+spring)/2,front+.12,.095,spring-lower,.09,trim);
  for(let y=lower;y<spring+.11;y+=1.34)f.box(0,y,front+.12,radius*2,.087,.09,trim);
  for(let i=0;i<=6;i++){
    const a=Math.PI*i/6;
    f.stick([0,spring+.04,front+.125],[radius*Math.cos(a),spring+radius*Math.sin(a),front+.125],.071,trim,true);
  }
  for(const sign of [-1,1]){
    const e=f.point(sign*(half+.08),H+.04,front+.07),c=f.point(0,H+2.39,front+.07);
    batch.strut(e,c,.12,roof,true);
    const E=f.point(sign*(half+.08),H+.04,back),C=f.point(0,H+2.39,back);
    tri(e,c,C,roof);tri(e,C,E,roof);
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.computeVertexNormals();
  const m=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.71,side:THREE.DoubleSide}));
  m.name='N19 south gable and semicircular fanlight';m.castShadow=m.receiveShadow=true;scene.add(m);
  batch.finish();
}

function dormitoryPlanting(scene,world,ground){
  // Repeated southwest-northwest views identify the side of each street,
  // the sight line between N19 and N16, and the public planting verge at N20.
  const wood=neighbourhood(scene,'Dormitory courtyards · pine boughs and clipped shrubs');
  let seed=18291;
  const random=()=>((seed=(Math.imul(1664525,seed)+1013904223)>>>0)/4294967296);
  const mat=typeof document==='undefined'?new THREE.MeshStandardMaterial({vertexColors:true}):leafSprayMaterial(random);
  const crowns=neighbourhood(scene,'Dormitory courtyards · pine and evergreen foliage',mat);
  const spray=leafyCrown(912,true);spray.computeBoundingBox();
  const size=spray.boundingBox.getSize(new THREE.Vector3()),centre=spray.boundingBox.getCenter(new THREE.Vector3());
  spray.translate(-centre.x,-centre.y,-centre.z);spray.scale(2/size.x,2/size.y,2/size.z);
  const crown=(x,y,z,rx,ry,rz,tint)=>{
    crowns.instance(spray,[x,y,z],[rx,ry,rz],tint,random()*Math.PI*2);
    // The sparse lower shell adds depth in sun while preserving gaps at the
    // outer branches instead of replacing the whole crown with an oval.
    wood.instance(leaf,[x,y-.025,z],[rx*.61,ry*.54,rz*.64],0x3b5232,random()*3);
  };
  const outside=(x,z)=>!world.access.isDrivable(x,z)&&!world.D.buildings.some(b=>{
    let hit=false;
    for(let i=0,j=b.p.length-1;i<b.p.length;j=i++){
      const a=b.p[j],c=b.p[i];
      if((a[1]>z)!==(c[1]>z)&&x<(c[0]-a[0])*(z-a[1])/(c[1]-a[1])+a[0])hit=!hit;
    }
    return hit;
  });
  function cloudPine(x,z,h,r){
    if(!outside(x,z))return;
    const y=ground(x,z),tilt=(random()-.5)*r*.45,bark=0x50493c;
    const a=[x,y-.14,z],k=[x+tilt*.65,y+h*.46,z+.19],b=[x+tilt,y+h*.81,z-.08];
    wood.strut(a,k,r*.13,bark);wood.strut(k,b,r*.073,bark);
    for(let i=0;i<6;i++){
      const angle=i*2.4+random()*.32,off=r*(.52+.27*random())*(1-.075*i);
      const y0=y+h*(.37+.077*i),lx=x+tilt*.67+Math.cos(angle)*off,lz=z+Math.sin(angle)*off;
      const end=[lx,y0+h*.08,lz];
      wood.strut([x+tilt*.63,y0,z],end,r*.040,bark);
      crown(lx,y0+h*.117,lz,r*(.57-.025*i),h*.098,r*.51,0x739254);
    }
    crown(b[0],y+h*.87,b[2],r*.48,h*.14,r*.42,0x6e9054);
  }
  // Taller pines rise from the N19 garden terraces, with the arch visible
  // between them. The low clipped bushes trace the brick wall above parking.
  for(const [x,z,h,r] of [[-485,-398.0,6.1,3.2],[-475.2,-403.4,5.65,3.4],
    [-457.5,-398.8,6.75,3.96],[-447.8,-396.7,7.9,3.8],[-440.0,-405.4,7.05,3.14],
    [-255.6,-571.7,6.6,3.7],[-255.1,-558.5,5.9,3.24],[-250.8,-588.4,6.8,3.54],
    [-457.1,-371.2,7.0,3.2],[-448.1,-371.7,7.9,3.6],[-437.4,-370.5,8.2,3.2],[-426.0,-369.8,8.1,3.7]])cloudPine(x,z,h,r);
  for(let i=0;i<19;i++){
    const x=-486.3+i*2.37,z=-393.0+.28*Math.sin(i*.2);
    if(outside(x,z))crown(x,ground(x,z)+.59,z,1.55,.65,1.14,0x96a758);
  }
  for(let i=0;i<13;i++){
    const z=-450.1+i*3.24,x=-514.32-.021*(z+450);
    cloudPine(x,z,1.98+random()*.47,1.45+random()*.25);
  }
  for(const [x,z] of [[-264.6,-555.8],[-265.0,-563.0],[-265.4,-569.1],[-264.0,-595.2],[-264.9,-602.3]]){
    cloudPine(x,z,2.76,1.56);
  }
  for(const [i,x] of [-300.46,-297.29,-294.24,-289.47,-285.92,-282.57].entries()){
    cloudPine(x,-638.03-.12*Math.sin(i),2.93+.37*Math.sin(i*1.92),1.48+.13*Math.cos(i));
  }
  // Three individually mapped clipped planting beds frame the stepped east
  // court of N11. The raised green mounds are clear in both 765 and 870.
  for(const bed of world.D.areas.filter(a=>[1527826087,1527849284,1527849285].includes(a.id))){
    const p=bed.p,xs=p.map(q=>q[0]),zs=p.map(q=>q[1]);
    for(let x=Math.min(...xs)+.55;x<Math.max(...xs);x+=1.06)for(let z=Math.min(...zs)+.55;z<Math.max(...zs);z+=1.0){
      const inside=p.reduce((v,a,i)=>{const b=p[(i+1)%p.length];return (a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0]?!v:v;},false);
      if(!inside||!outside(x,z))continue;
      const h=.49+.37*Math.max(0,Math.cos(x*.72+z*.45));
      crown(x,ground(x,z)+h*.72,z,.71,h,.68,0x6f864a);
    }
  }
  // From the western carriageway a matted vine layer rises immediately
  // behind the teal fence, with a taller, irregular wooded margin uphill.
  // The south end of the screen adjoins an open service yard.
  for(let i=0;i<19;i++){
    const z=-527.1-3.2*i;
    for(let j=0;j<5;j++){
      const x=-511.4+j*3.3+random()*.95,zz=z+random()*2.5;
      if(!outside(x,zz))continue;
      const h=.42+j*.34+random()*(.35+j*.15);
      const tint=[0x74844c,0x657a47,0x526b3c,0x4c613b,0x746545][(i+j*2)%5];
      crown(x,ground(x,zz)+h*.63,zz,1.3+random()*1.4,h,1.48+random()*1.10,tint);
    }
  }
  wood.finish();crowns.finish();
}

// The portion of this mapped retaining wall visible from the east tennis
// entrance is made of boulders. The other leg beyond the bend keeps its
// mapped treatment. Collision continues to use the entire original line.
export function northwestBoulderSection(barrier,endVertex) {
  return barrier.id===1529389941 && endVertex>=5;
}

export const northwestBallNets=new Set([1264367316,1529541061,1529541066,1529541067]);

// The November views from both ends of the western tennis lane distinguish
// its golden ginkgo trees from the russet broadleaf row nearer Areum Hall.
// Behind the green Gwahak-ro fence the nearest crowns rise from a wooded bank.
// Roadside trunks are positioned in their planting strip, outside the kerb.
export function northwestTreeSites(){
  const trees=[
    // The November Oreum-gil approach frames the east wing of N11 with a
    // golden ginkgo on the west and a taller evergreen garden to the east.
    [-220.8,-379.8,11.7,0xb49a42,true],[-224.6,-377.2,9.9,0x856c47],
    [-209.1,-378.2,10.7,0x526841],[-205.2,-373.1,12.0,0x496039],
    [-202.9,-415.4,8.6,0x4a6341],[-198.5,-414.6,8.9,0x49613e],
    [-195.2,-411.8,8.4,0x4f6641],[-191.5,-413.5,9.4,0x526940],
    [-502.5,-309.9,8.9,0xb59a40,true],[-505.5,-320.3,10.4,0xc09d37,true],
    [-507.3,-330.6,9.4,0xb79a3b,true],[-509.1,-341.1,9.1,0xaa973e,true],
    [-509.6,-351.8,9.8,0x865738,true],[-509.9,-362.6,9.7,0x945d3d,true],
    [-508.9,-373.7,8.6,0x976745,true],[-503.1,-379.5,8.3,0x92643e,true]
  ];
  for(let j=0;j<14;j++){
    // The public-road west pavement and the campus woodland line up in the
    // opposite panoramas. Leave the photographed entrance at z=-596 open.
    const z=-486.2-j*8.1;
    trees.push([-531.4+.16*Math.sin(j*1.8),z,8.0+(j%4)*.77,[0x6b7549,0x8c6a43,0x8a7346,0x77533b][j%4]]);
  }
  for(let j=0;j<14;j++){
    const z=-521.0-j*8.3;
    trees.push([-506.1+1.31*Math.sin(j*2.3),z,10.4+(j%4)*1.07,[0x496342,0x536945,0x4a5f3e][j%3]]);
    trees.push([-500.8+1.63*Math.cos(j*1.81),z-3.7,12.7+(j%3)*1.18,[0x435d3d,0x4d6845,0x567048][j%3]]);
  }
  return trees;
}

function gwahakFenceScreen(scene,world,ground){
  const segment=world.D.barriers.find(b=>b.id===1527474567&&b.p.some(p=>p[1]<-550));
  if(!segment)return;
  const [a,b]=segment.p;
  const pt=z=>[a[0]+(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+.40,z];
  const frame=neighbourhood(scene,'Gwahak-ro woodland fence and teal privacy screen');
  const net=courtScreens(scene,'Gwahak-ro woodland fence',ground);
  const start=-509.0,end=-557.3,count=Math.ceil((start-end)/2.4);
  for(let j=0;j<count;j++){
    const p=pt(start+(end-start)*j/count),q=pt(start+(end-start)*(j+1)/count),yp=ground(...p),yq=ground(...q);
    const stick=(p,h,q,k,w,color,square=false)=>frame.strut([p[0],ground(...p)+h,p[1]],[q[0],ground(...q)+k,q[1]],w,color,square);
    const span=Math.hypot(q[0]-p[0],q[1]-p[1]),angle=Math.atan2(q[0]-p[0],q[1]-p[1]);
    frame.instance(unitBox,[(p[0]+q[0])/2,(yp+yq)/2+.55,(p[1]+q[1])/2],[.035,.98,span+.012],j%3===1?0x317d78:0x337e79,angle);
    stick(p,.06,p,1.36,.043,0x858f87);stick(p,1.32,q,1.32,.039,0x919c94);
    if(j%2===0)stick(p,1.33,[p[0]-.14,p[1]],1.55,.029,0x7e8680);
    if(j===count-1)stick(q,.06,q,1.35,.043,0x858f87);
    net.sheet('wire',p,q,1.04,1.04,1.32,1.32);
  }
  frame.finish();net.finish();
}

function kaimaruStreetEnds(scene,world,ground){
  const fixture=neighbourhood(scene,'Kaimaru · shuttle sign and folded service gate');
  const west=frame(-278.4,-378.7,Math.PI/2,ground(-278.4,-378.7),fixture);
  for(const u of [-.73,.73])west.box(u,.47,0,.11,.94,.16,0x6c5543);
  west.box(0,1.02,0,1.88,.83,.10,0x5f4838);
  west.box(0,.86,.056,1.76,.27,.024,0xdddcc6);
  facadeLetters(scene,'CAR-FREE ZONE',west.point(0,1.20,.064),west.yaw,1.57,.20,'#d6ba70');
  facadeLetters(scene,'SHUTTLE BUSES ONLY',west.point(0,.86,.076),west.yaw,1.59,.14,'#414b51');
  // The real November view shows a retractable barrier across the entrance.
  // In the explorable campus, park its folded sections and cones at the edge.
  const x=-211.5,z=-377.25,spacing=.23;
  for(let i=0;i<=6;i++){
    const zz=z+i*spacing,y=ground(x,zz);
    for(const side of [-1,1]){
      const xx=x+side*.22;
      fixture.strut([xx,y+.11,zz],[xx,y+1.02,zz],.045,0xa0a6a2);
      if(i===6)continue;
      const next=zz+spacing,g=ground(x,next);
      fixture.strut([xx,y+.19,zz],[xx,g+.88,next],.034,0x949b96);
      fixture.strut([xx,y+.88,zz],[xx,g+.19,next],.034,0xa8aba3);
    }
    fixture.strut([x-.22,y+1.02,zz],[x+.22,y+1.02,zz],.044,0x939b97);
  }
  for(const zz of [-373.3,-371.7]){
    const y=ground(x,zz);
    fixture.instance(unitBox,[x,y+.035,zz],[.38,.07,.38],0x365f4b,0);
    fixture.instance(unitCone,[x,y+.33,zz],[.29,.61,.29],0x5a9e69,0);
    fixture.instance(unitPost,[x,y+.40,zz],[.12,.11,.12],0xd0ddc7,0);
  }
  fixture.finish();
}

// Both sets of public courts use permeable mesh. Keeping only the frame
// opaque leaves trees, parked vehicles and people-sized openings visible.
function courtScreens(scene,name,ground){
  const panels=new Map();
  function sheet(kind,a,b,lowA,lowB,highA,highB){
    if(!panels.has(kind))panels.set(kind,{p:[],uv:[]});
    const data=panels.get(kind),ga=ground(...a),gb=ground(...b);
    const points=[[a[0],ga+lowA,a[1]],[b[0],gb+lowB,b[1]],
      [b[0],gb+highB,b[1]],[a[0],ga+highA,a[1]]];
    const density=kind==='backstop'||kind==='goal'?.18:.125;
    const tiles=kind==='cloth'?1:Math.hypot(a[0]-b[0],a[1]-b[1])/density;
    const height=kind==='cloth'?1:(highA-lowA)/density,uv=[[0,0],[tiles,0],[tiles,height],[0,height]];
    for(const k of [0,1,2,0,2,3]){data.p.push(...points[k]);data.uv.push(...uv[k]);}
  }
  function finish(){
    for(const [kind,data] of panels){
      const geo=new THREE.BufferGeometry();
      geo.setAttribute('position',new THREE.Float32BufferAttribute(data.p,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(data.uv,2));
      geo.computeVertexNormals();geo.computeBoundingSphere();
      const mesh=new THREE.Mesh(geo,courtFabric(kind));mesh.name=name+' · '+kind;mesh.receiveShadow=true;scene.add(mesh);
    }
  }
  return {sheet,finish};
}

function courtFabric(textureType){
  if(textureType==='windscreen'){
    // Closely knit teal wind fabric filters the background while its open
    // strip below still admits an unobstructed view across the courts.
    const pixels=new Uint8Array(8*8*4);
    for(let y=0;y<8;y++)for(let x=0;x<8;x++)
      pixels.set([51+(x%3)*3,108+(y%3)*3,96,(x%4===0||y%4===0)?205:115],4*(y*8+x));
    const tex=new THREE.DataTexture(pixels,8,8,THREE.RGBAFormat);
    tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.magFilter=THREE.LinearFilter;
    tex.generateMipmaps=true;tex.minFilter=THREE.LinearMipmapLinearFilter;tex.colorSpace=THREE.SRGBColorSpace;tex.needsUpdate=true;
    return new THREE.MeshStandardMaterial({map:tex,side:THREE.DoubleSide,transparent:true,depthWrite:false,roughness:.97});
  }
  const n=64,rgba=new Uint8Array(n*n*4),wire=textureType!=='cloth';
  const tint=textureType==='backstop'?[46,91,66]:textureType==='goal'?[199,206,192]:[130,152,137];
  for(let j=0;j<n;j++)for(let i=0;i<n;i++){
    const at=4*(j*n+i),x=(i+.5)/n,y=(j+.5)/n;
    const gap=wire ? (textureType==='wire' ? Math.abs(((x+y)%1)-.5)>.044 && Math.abs(((x-y+1)%1)-.5)>.044
      : Math.abs(x-.5)>.033 && Math.abs(y-.5)>.033)
      : ((x-.5)/.056)**2+((y-.55)/.14)**2<1;
    rgba.set(wire?[...tint,gap?0:255]:[50+(i%2)*5,106+(j%2)*4,88,gap?0:255],at);
  }
  const tex=new THREE.DataTexture(rgba,n,n,THREE.RGBAFormat);
  tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.magFilter=THREE.LinearFilter;
  tex.minFilter=THREE.LinearMipMapLinearFilter;tex.generateMipmaps=true;tex.needsUpdate=true;
  tex.colorSpace=THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({map:tex,roughness:.92,alphaTest:.42,side:THREE.DoubleSide});
}

function westTennisScreen(scene,world,ground){
  const lines=world.D.barriers.filter(b=>b.id===1264367316).map(b=>b.p);
  const run=lines.flatMap(p=>p.slice(1).map((b,i)=>[p[i],b])).find(([a,b])=>
    a[1]>-316&&b[1]>-316&&Math.abs(a[0]-b[0])>50);
  if(!run)return;
  const [a,b]=run,dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
  const screens=courtScreens(scene,'West tennis parking-side screen',ground);
  const poles=neighbourhood(scene,'West tennis screen extensions and braces');
  const bays=Math.ceil(length/3.15),p=t=>[a[0]+dx*t,a[1]+dz*t];
  for(let i=0;i<=bays;i++){
    const [x,z]=p(i/bays),y=ground(x,z);
    poles.strut([x,y+2.95,z],[x,y+5.03,z],.058,0x979f9d);
    if(i%5===2)poles.strut([x,ground(x,z+.89)+.06,z+.89],[x,y+3.63,z],.055,0x8b9291);
    if(i===bays)continue;
    const v=p((i+1)/bays),m=p((i+.5)/bays);
    screens.sheet('windscreen',[x,z],m,3.12,3.04,5.00,4.92);
    screens.sheet('windscreen',m,v,3.04,3.12,4.92,5.00);
    poles.strut([x,y+5.01,z],[v[0],ground(...v)+5.01,v[1]],.026,0x748881);
  }
  screens.finish();poles.finish();
  const paint=pavedMarkings(scene,ground,'West tennis parking aisle arrows');
  // The opposing arrows are visible from both ends of the same aisle.
  for(const [x,z] of [[-470.3,-301.65],[-447.7,-301.26]]){
    for(const v of [-1,1]){
      const h=z+v*1.54,dir=v;
      paint.stripe([x-dir*1.02,h],[x+dir*.93,h],.15,0xe5e4d9);
      for(const t of [-1,1])paint.stripe([x+dir*.34,h+t*.31],[x+dir*.95,h],.16,0xe5e4d9);
    }
  }
  paint.finish();
}

function tennisClubhouse(scene,world,terrain){
  const b=world.D.buildings.find(b=>b.id===tennisClubId);
  if(!b)return;
  const x=324.1,z=-536.55,width=8.82,depth=13.30;
  const base=Math.min(...b.p.map(p=>terrain(...p)))-.26;
  const batch=neighbourhood(scene,'Tennis clubhouse · masonry, eaves and joinery');
  const f=frame(x,z,0,base,batch);
  f.box(0,1.89,0,width,3.78,depth,0x97705c);
  const fascia=0x68423a;
  f.box(0,3.44,0,width+.6,.23,depth+.52,0x60433d);
  // The same short hipped cap is seen from both ends of the public lane.
  // Closely spaced horizontal cladding courses distinguish it from a row
  // of blue office windows on the former stock three-storey building.
  for(let i=0;i<10;i++){
    const t=(i+.5)/10;
    f.box(0,3.55+t*1.32,0,width+.65-1.04*t,.148,depth+.58-1.00*t,i%3===0?0x654139:fascia);
  }
  for(const end of [-1,1]){
    const v=end*(depth/2+.036),centre=end===1?-1.27:1.27;
    f.box(centre,1.68,v,3.23,1.15,.12,0xd3c9b6);
    f.box(centre,1.68,v+end*.068,3.05,1.01,.045,0x53706d);
    for(const dx of [-.76,.76])f.box(centre+dx,1.68,v+end*.092,.055,1.01,.04,0xa7b5a7);
    f.box(centre,1.09,v+end*.095,3.37,.09,.14,0x968e7f);
  }
  for(const v of [-4.47,1.02,4.50]){
    f.box(-width/2-.036,1.65,v,.12,1.13,2.22,0xd1cabb);
    f.box(-width/2-.106,1.65,v,.04,1.00,2.06,0x536f6e);
    f.box(-width/2-.13,1.65,v,.032,1.00,.058,0xa6aba0);
  }
  batch.finish();
}

function eastTennisCourts(scene,world,terrain) {
  const pitches=world.D.areas.filter(a=>a.id>=1529522596&&a.id<=1529522600&&a.sport==='tennis');
  if(pitches.length!==5)return;
  const gear=neighbourhood(scene,'East tennis courts · nets, lights and posts');
  const {sheet,finish}=courtScreens(scene,'East tennis courts',terrain);
  const post=(x,z,h,diameter,color)=>gear.strut([x,terrain(x,z)-.06,z],[x,terrain(x,z)+h,z],diameter,color);
  // The five individually mapped playing rectangles share one enclosure.
  // November 2026 shows a low ventilated green screen, open wire above and
  // the entrance in front of the low clubhouse at the southeast corner.
  const perimeter=[[239.3,-566.8],[319.6,-566.7],[319.6,-529.8],[239.3,-529.8]];
  for(let i=0;i<4;i++){
    const a=perimeter[i],b=perimeter[(i+1)%4],dx=b[0]-a[0],dz=b[1]-a[1];
    const bays=Math.ceil(Math.hypot(dx,dz)/3.15);
    for(let k=0;k<bays;k++){
      const l=[a[0]+dx*k/bays,a[1]+dz*k/bays],r=[a[0]+dx*(k+1)/bays,a[1]+dz*(k+1)/bays];
      if(i===2&&k===0)continue;
      post(...l,3.08,.093,0x609471);
      sheet('cloth',l,r,.12,.12,1.34,1.34);sheet('wire',l,r,1.34,1.34,3.01,3.01);
      gear.strut([l[0],terrain(...l)+3.01,l[1]],[r[0],terrain(...r)+3.01,r[1]],.05,0x72a284);
    }
  }
  for (const {p} of pitches){
    const mid=(a,b)=>[(a[0]+b[0])/2,(a[1]+b[1])/2];
    const a=mid(p[0],p[3]),b=mid(p[1],p[2]),length=Math.hypot(b[0]-a[0],b[1]-a[1]);
    const end0=[a[0]-.69*(b[0]-a[0])/length,a[1]-.69*(b[1]-a[1])/length];
    const end1=[b[0]+.69*(b[0]-a[0])/length,b[1]+.69*(b[1]-a[1])/length];
    const c=mid(end0,end1);
    for(const e of [end0,end1]) {
      post(...e,1.12,.088,0x435957);
      sheet('wire',e,c,.15,.13,1.06,.94);
      gear.strut([e[0],terrain(...e)+1.055,e[1]],[c[0],terrain(...c)+.94,c[1]],.046,0xdddcca);
    }
  }
  for(const z of [-565.8,-531.0])for(const x of [247.3,271.3,295.5,315.2]){
    const y=terrain(x,z);post(x,z,6.65,.114,0xabb3ab);
    const f=frame(x,z,0,y,gear),inward=z<-550?1:-1;
    f.box(0,6.57,.13*inward,1.14,.072,.08,0x88958d);
    for(const u of [-.44,.44]){
      f.box(u,6.54,.31*inward,.31,.12,.43,0x727b75);
      f.box(u,6.475,.31*inward,.28,.025,.36,0xe2dfc9);
    }
  }
  // The southeastern fence carries a short uninterrupted belt of climbing
  // greenery, with imperfect ends and the actual gate opening kept clear.
  const ivy=neighbourhood(scene,'East tennis · ivy on the street-facing screen',
    new THREE.MeshStandardMaterial({roughness:.94,side:THREE.DoubleSide,vertexColors:true}));
  const spray=ivySpray();
  for(let i=0;i<33;i++){
    const x=305.05+i*.36,z=-529.57+.08*Math.sin(i*7);
    const base=terrain(x,z),h=1.49+.12*Math.cos(i*5);
    ivy.instance(spray,[x,base+h,z],[1.23,1.0+.14*Math.sin(i*6.2),.96],i%3?0x54763d:0x5d783d,.45*Math.sin(i));
    if(i%4===1)gear.strut([x,base+.20,z+.11],[x+.23,base+h,z+.095],.031,0x6b6044);
  }
  // The pale posts are rooted in the bank. Individual rocks follow the
  // mapped wall rather than repeating a decorative wall across the road.
  const wall=world.D.barriers.find(b=>b.id===1529389941);
  const rocks=neighbourhood(scene,'East tennis lane · natural stone bank');
  const stone=new THREE.IcosahedronGeometry(1,1),stonePoints=stone.attributes.position;
  for(let i=0;i<stonePoints.count;i++){
    const x=stonePoints.getX(i),y=stonePoints.getY(i),z=stonePoints.getZ(i);
    const jag=.92+.105*Math.sin(5*x+3*z+2*y)*Math.cos(3*z-4*x);
    stonePoints.setXYZ(i,x*jag,Math.sign(y)*Math.abs(y)**.73*jag,z*jag);
  }
  stone.computeVertexNormals();stone.computeBoundingSphere();
  if(wall)for(let k=1;k<wall.p.length;k++){
    if(!northwestBoulderSection(wall,k))continue;
    const a=wall.p[k-1],b=wall.p[k],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);
    const n=Math.ceil(len/1.17);
    for(let j=0;j<n;j++){
      const t=(j+.5)/n,x=a[0]+dx*t,z=a[1]+dz*t;
      const course=Math.max(.25,Math.min(1,(312-x)/36)),base=terrain(x,z);
      const layers=course>.76?3:course>.36?2:1;
      for(let level=0;level<layers;level++){
        const odd=(j+level*3+k)%5,scale=.77+.12*Math.cos(j*4.1+level);
        const centreX=x+(level%2)*.38*dx/len,centreZ=z+.68-level*.34;
        if(world.access.isDrivable(centreX,centreZ))continue;
        const rotation=new THREE.Quaternion().setFromEuler(new THREE.Euler(.15*Math.cos(j+level),j*.6+level,.1*Math.sin(j*level)));
        rocks.instance(stone,[centreX,base+.12+.48*level,centreZ],[scale,.47+.045*odd,.59],[
          0x444942,0x5c5c53,0x444a45,0x696559,0x505046][odd],rotation);
      }
    }
  }
  finish();
  gear.finish();rocks.finish();ivy.finish();
}

function studentSportsGround(scene,world,terrain){
  const fullPitch=world.D.areas.find(a=>a.id===1529541057);
  const baseball=world.D.areas.find(a=>a.id===1529541058);
  if(!fullPitch||!baseball)return;
  const gear=neighbourhood(scene,'Student sports ground · posts, pads and goals');
  const nets=courtScreens(scene,'Student sports ground',terrain);
  const paint=pavedMarkings(scene,terrain,'Student sports ground · diamond and futsal lines');
  const lerp=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
  const at=(p,h)=>[p[0],terrain(...p)+h,p[1]];
  const post=(p,h,d,color)=>gear.strut(at(p,-.035),at(p,h),d,color);
  // The two futsal courts and cut-off corner behind home plate follow
  // separate mapped net outlines. Their actual entrance gaps stay open.
  for(const barrier of world.D.barriers.filter(b=>northwestBallNets.has(b.id))){
    const batting=barrier.id===1529541067,high=batting?5.1:4.65;
    for(let i=1;i<barrier.p.length;i++){
      const a=barrier.p[i-1],b=barrier.p[i],n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/4.3);
      for(let k=0;k<n;k++){
        const l=lerp(a,b,k/n),r=lerp(a,b,(k+1)/n);
        if(world.access.isDrivable(...l)||world.access.isDrivable(...r))continue;
        post(l,high,.09,batting?0x55786f:0x70a867);
        if(!batting)post(l,1.49,.16,0x31547b);
        nets.sheet('backstop',l,r,.12,.12,high-.08,high-.08);
        gear.strut(at(l,high),at(r,high),.043,0x547f67);
        if(k===n-1&&i===barrier.p.length-1)post(r,high,.09,0x629371);
      }
    }
  }
  // Aerial and oblique views both show a green infield, four separate
  // areas of worn tan turf, red basepaths, and the lighter pitcher's mound.
  // Match the field's orientation to its own fence rather than true north.
  const bases=[[-189.8,-291.5],[-162.5,-291.7],[-162.3,-264.5],[-189.6,-264.3]];
  for(let i=0;i<bases.length;i++)paint.stripe(bases[i],bases[(i+1)%4],1.39,0x9c6450,.126);
  function wornArea(x,z,rx,rz,seed){
    const centre=[x,z],point=(i,radial)=>{
      const a=i*Math.PI/18,edge=1+.065*Math.sin(a*3+seed)+.043*Math.sin(a*7+seed*2);
      return [x+Math.cos(a)*rx*radial*edge,z+Math.sin(a)*rz*radial*edge];
    };
    for(let i=0;i<36;i++)for(let j=0;j<3;j++){
      const a=point(i,j/3),b=point(i+1,j/3),c=point(i+1,(j+1)/3),d=point(i,(j+1)/3);
      const shade=[0xb19864,0xb4a16e,0xa9a174][j];
      paint.quad(j===0?centre:a,b,c,d,shade,.144);
    }
  }
  bases.forEach(([x,z],i)=>{
    wornArea(x,z,4.15,4.25,i*1.2);
    paint.bay(x,z,.41,.41,0xe8e0c7,.164);
  });
  wornArea(-178.4,-278.8,5.75,5.17,4.7);
  paint.bay(-178.4,-278.8,.64,.16,0xe8dfbe,.164);
  function goal(p,axis,intoPitch,width,height,depth){
    const q=(u,d)=>[p[0]+axis[0]*u+intoPitch[0]*d,p[1]+axis[1]*u+intoPitch[1]*d];
    const left=q(-width/2,0),right=q(width/2,0),backL=q(-width/2,-depth),backR=q(width/2,-depth);
    const white=0xe5e7dc;
    for(const [a,b] of [[left,backL],[right,backR]]){
      gear.strut(at(a,.11),at(a,height),.084,white);
      gear.strut(at(a,height),at(b,height*.83),.055,white);
      gear.strut(at(b,height*.83),at(b,.12),.053,white);
      gear.strut(at(b,.13),at(a,.13),.049,white);
      nets.sheet('goal',a,b,.13,.13,height-.04,height*.83);
    }
    gear.strut(at(left,height),at(right,height),.094,white);
    gear.strut(at(backL,height*.83),at(backR,height*.83),.053,white);
    nets.sheet('goal',backL,backR,.13,.13,height*.83,height*.83);
  }
  const white=0xe1dfc7;
  function fieldGoals(longStart,longEnd,width,futsal){
    const mid=lerp(longStart,longEnd,.5),dx=longEnd[0]-longStart[0],dz=longEnd[1]-longStart[1],length=Math.hypot(dx,dz);
    const axis=[dx/length,dz/length],across=[-axis[1],axis[0]];
    const p=(u,v)=>[mid[0]+axis[0]*u+across[0]*v,mid[1]+axis[1]*u+across[1]*v];
    const mark=(u,v,u1,v1)=>paint.stripe(p(u,v),p(u1,v1),.105,white,.13);
    const half=length/2;
    for(const s of [-1,1])goal(p(s*half,0),across,axis.map(a=>-a*s),futsal?3.00:7.32,futsal?2.0:2.44,futsal?.72:1.72);
    if(!futsal)return;
    const w=width/2;
    mark(-half,-w,half,-w);mark(-half,w,half,w);
    mark(-half,-w,-half,w);mark(half,-w,half,w);mark(0,-w,0,w);
    for(let i=0;i<36;i++){
      const a=i*Math.PI/18,b=(i+1)*Math.PI/18;
      mark(3*Math.cos(a),3*Math.sin(a),3*Math.cos(b),3*Math.sin(b));
    }
    for(const s of [-1,1])for(let i=0;i<30;i++){
      const a=(i/30-.5)*Math.PI,b=((i+1)/30-.5)*Math.PI;
      mark(s*(half-5.94*Math.cos(a)),6*Math.sin(a),s*(half-5.94*Math.cos(b)),6*Math.sin(b));
    }
  }
  // White goals sit on the observed touchlines inside the surrounding nets.
  // The northern fields have different numbers of survey outline vertices
  // because their entrances are individually mapped.
  for(const a of world.D.areas.filter(a=>a.id===1529541059||a.id===1529541060)){
    const p=a.p,ends=a.id===1529541059?[lerp(p[0],p[2],.5),lerp(p[4],p[3],.5)]:[lerp(p[0],p[1],.5),lerp(p[3],p[2],.5)];
    fieldGoals(lerp(...ends,.032),lerp(...ends,.968),17.94,true);
  }
  const p=fullPitch.p,a=lerp(p[0],p[3],.5),b=lerp(p[1],p[2],.5);
  fieldGoals(lerp(a,b,.045),lerp(a,b,.955),62,false);
  gear.finish();nets.finish();paint.finish();
}

export function buildNorthwestStreetviewDetails(scene,world,ground,terrain) {
  buildDesignCentre(scene,world,terrain,ground,pavedMarkings);
  industrialDesignSouthEntrance(scene,world,ground,terrain);
  areumShelter(scene,world,ground);
  areumWestWall(scene,world,terrain);
  metaConvergenceHall(scene,world,terrain);
  solarParking(scene,world,ground);
  silloeBicycleVerge(scene,world,ground);
  housingBikeShelters(scene,world,ground);
  dormitoryEnds(scene,world,terrain);
  westTennisScreen(scene,world,ground);
  gwahakFenceScreen(scene,world,ground);
  kaimaruStreetEnds(scene,world,ground);
  jihyeEntrance(scene,world,terrain,ground);
  dormitoryEntrances(scene,world,terrain);
  northSupportOffice(scene,world,terrain);
  eurekaFrontage(scene,world,terrain,ground);
  dormitoryStairApproach(scene,world,terrain,'N14');
  dormitoryStairApproach(scene,world,terrain,'N16');
  areumArchedBay(scene,world,terrain);
  dormitoryPlanting(scene,world,ground);
  libraryBays(scene,world,ground);
  eastTennisCourts(scene,world,terrain);
  tennisClubhouse(scene,world,terrain);
  studentSportsGround(scene,world,terrain);
}
