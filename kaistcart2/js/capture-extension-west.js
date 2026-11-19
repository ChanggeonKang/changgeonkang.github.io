// User captures 79–102, including six lateral views; April 2025 / April 2026.
// Geometry is an interpretation, not surveyed dimensions. OSM footprint rings
// remain the building boundaries. No photograph pixels are distributed.
import * as THREE from '../lib/three.module.min.js';

export const westRoadStyles = Object.freeze([
  {from:650,to:783,center:'single',edges:'yellow',photos:[79,80,81,82,83,84,85]},
  {from:784,to:838,center:'single',edges:'yellow',photos:[86,87,88,89,90]},
  {from:839,to:887,center:'none',edges:'yellow',photos:[91,92,93]},
  {from:888,to:1044,center:'single',edges:'yellow',photos:[94,95,96,97,98,99]},
]);
export const westSpeedMarks = Object.freeze([]); // Visible text is SLOW, not an inferred numeric limit.
export const westBumps = Object.freeze([
  {progress:654,progressRange:[644,664],photoNumbers:[79],evidence:'Yellow/white hump in the W16 foreground.'},
  {progress:704,progressRange:[694,714],photoNumbers:[81],evidence:'Yellow/white hump approaching W1-1.'},
  {progress:774,progressRange:[762,786],photoNumbers:[84],evidence:'Foreground hump before the KISTI letter lawn junction.'},
  {progress:797,progressRange:[787,807],photoNumbers:[86],evidence:'Hump beyond the KISTI lawn junction, approaching the public gate.'},
].map(b=>Object.freeze({...b,confidence:'approximate visual position',heightM:.1,lengthM:3.6,dimensionStatus:'Conventional game assumptions, not measured from the screenshots.'})));

const colour=n=>new THREE.Color(n), lerp=(a,b,t)=>a+(b-a)*t;
const P={white:colour(0xd7dbd6),silver:colour(0xb1bbb9),glass:colour(0x416b7a),dark:colour(0x455459),brick:colour(0x8b665d),stone:colour(0xa3aaa8),roof:colour(0x424b4c),cream:colour(0xcbbfa7)};
function inside(x,z,p){let r=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const a=p[i],b=p[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])r=!r;}return r;}
function edgeDistance(x,z,p){let d=Infinity;for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length],dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1)));d=Math.min(d,Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz));}return d;}
function ringValid(q,p){return q.every((a,i)=>{const b=q[(i+1)%q.length],steps=Math.ceil(Math.hypot(a[0]-b[0],a[1]-b[1]))+1;for(let k=0;k<=steps;k++){const x=lerp(a[0],b[0],k/steps),z=lerp(a[1],b[1],k/steps);if(!inside(x,z,p)&&edgeDistance(x,z,p)>.002)return false;}return true;});}
const winding=p=>Math.sign(p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[1]-b[0]*a[1];},0))||1;
class Batch{
  constructor(){this.p=[];this.n=[];this.c=[];}
  tri(a,b,c,color,normal){const n=new THREE.Vector3(...b).sub(new THREE.Vector3(...a)).cross(new THREE.Vector3(...c).sub(new THREE.Vector3(...a)));if(n.lengthSq()<1e-12)return;if(normal&&n.dot(new THREE.Vector3(...normal))<0)[b,c]=[c,b];const nn=normal||n.normalize().toArray();for(const v of[a,b,c]){this.p.push(...v);this.n.push(...nn);this.c.push(color.r,color.g,color.b);}}
  quad(a,b,c,d,color,n){this.tri(a,b,c,color,n);this.tri(a,c,d,color,n);}
  geometry(g,color,p){const q=g.index?g.toNonIndexed():g,A=q.attributes.position,N=q.attributes.normal;let ok=true;if(p)for(let i=0;i<A.count;i++)if(!inside(A.getX(i),A.getZ(i),p)&&edgeDistance(A.getX(i),A.getZ(i),p)>.002){ok=false;break;}if(ok)for(let i=0;i<A.count;i++){this.p.push(A.getX(i),A.getY(i),A.getZ(i));this.n.push(N.getX(i),N.getY(i),N.getZ(i));this.c.push(color.r,color.g,color.b);}if(q!==g)q.dispose();g.dispose();return ok;}
  mesh(kind){const g=new THREE.BufferGeometry();for(const[k,a]of[['position',this.p],['normal',this.n],['color',this.c]])g.setAttribute(k,new THREE.Float32BufferAttribute(a,3));g.computeBoundingSphere();g.computeBoundingBox();const m=new THREE.Mesh(g,new THREE.MeshStandardMaterial({vertexColors:true,roughness:kind==='glass'?.26:kind==='foliage'?.97:.82,metalness:kind==='glass'?.32:.03,polygonOffset:true,polygonOffsetFactor:kind==='glass'?-2:kind==='detail'?-3:0,polygonOffsetUnits:kind==='glass'?-2:kind==='detail'?-3:0}));m.name=`capture-west-${kind}`;m.userData.kind=kind;m.castShadow=true;m.receiveShadow=true;return m;}
}
function faces(p,fn){const s=winding(p);p.forEach((a,i)=>{const b=p[(i+1)%p.length],L=Math.hypot(b[0]-a[0],b[1]-a[1]);if(L>.01)fn(a,b,L,[s*(b[1]-a[1])/L,0,-s*(b[0]-a[0])/L],i);});}
function panel(B,a,b,t0,t1,y0,y1,c,n){if(t1<=t0||y1<=y0)return;const point=(t,y)=>[lerp(a[0],b[0],t),y,lerp(a[1],b[1],t)];B.quad(point(t0,y0),point(t1,y0),point(t1,y1),point(t0,y1),c,n);}
function roof(B,p,y,c){for(const t of THREE.ShapeUtils.triangulateShape(p.map(a=>new THREE.Vector2(...a)),[]))B.tri(...t.map(i=>[p[i][0],y,p[i][1]]),c,[0,1,0]);}
function volume(B,p,base,top,c){faces(p,(a,b,L,n)=>panel(B,a,b,0,1,base,top,c,n));roof(B,p,top,c);}
function rectangle(p,x,z,w,d,angle=0){const ca=Math.cos(angle),sa=Math.sin(angle),q=[[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2]].map(([u,v])=>[x+u*ca-v*sa,z+u*sa+v*ca]);return ringValid(q,p)?q:null;}
function windows(B,p,base,H,floors=4,width=3.4,ratio=.58,band=false){faces(p,(a,b,L,n)=>{const count=Math.max(1,Math.round(L/width));for(let f=0;f<floors;f++){const y=base+.85+f*(H-.7)/floors,hh=Math.min(1.8,(H-.7)/floors*.57);if(band)panel(B.glass,a,b,.025,.975,y,y+hh,P.glass,n);for(let j=0;j<count;j++){const t=(j+.5)/count,w=ratio/count;if(!band)panel(B.glass,a,b,t-w/2,t+w/2,y,y+hh,P.glass,n);panel(B.detail,a,b,t-.035/L,t+.035/L,y,y+hh,P.silver,n);} }});}
function grid(B,p,base,top,step=3.4){faces(p,(a,b,L,n)=>{for(let k=1;k<L/step;k++)panel(B.detail,a,b,k*step/L,k*step/L+.025/L,base,top,P.silver,n);for(let y=base+step;y<top;y+=step)panel(B.detail,a,b,0,1,y,y+.025,P.silver,n);});}
function boundedBox(B,p,x,z,w,d,base,height,c,angle=0){const q=rectangle(p,x,z,w,d,angle);if(q)volume(B,q,base,base+height,c);return q;}
function roundedTower(B,p,x,z,r,base,height,c){const q=Array.from({length:16},(_,i)=>[x+r*Math.cos(i/16*Math.PI*2),z+r*Math.sin(i/16*Math.PI*2)]);if(ringValid(q,p))volume(B,q,base,base+height,c);}
const CONFIG={
  219734142:{name:'Geotechnical Centrifuge Testing Center',style:'centrifuge',height:21.5,photos:[79,80],features:['pale panel walls','blue glazed corner','horizontal white sunshade blades','red entrance canopy']},
  49931912:{name:'Materials Science & Engineering',style:'engineering',height:11.6,photos:[81,82,83],features:['orange-brown masonry','gray vertical cores','long horizontal window rows'],heightBasis:'OSM three levels retained; estimated storey height. Upper background mass is not measured from the perspective.'},
  470171499:{name:'KISTI National Supercomputing Center',style:'compute',height:18.8,photos:[85,91,92,93,94,95],features:['large pale cladding fields','narrow glazed vertical slots','four roof cooling boxes','external silver pipes']},
  1529346023:{name:'KISTI Headquarters',style:'headquarters',height:27.5,photos:[85,95,96,97],features:['tall blue-gray glazed facade','white vertical piers','dark upper band','low white podium']},
  470181823:{name:'Daeduk Hanbit Church',style:'church',height:17.2,photos:[90,91,92,93],features:['brown brick walls','teal glass entrance tower','tall narrow brick steeple']},
  1259373434:{name:'Kiwoom Hall',style:'kiwoom',height:18.2,photos:[97,98],features:['pale silver folded panels','small horizontal windows','column-supported frontage','large upper recess']},
  78058725:{name:'Galilei Hall',style:'mansard',height:13.2,photos:[102],features:['beige walls','dark steep roof','roof dormers','blue-glazed entrance in pale frame'],confidence:'medium; sideview and mapped W3 footprint relative to W4-2/W4-3 match; entrance details approximate'},
};
function architecture(B,b,p,base,cfg){
  const top=base+cfg.height,style=cfg.style,lo=style==='kiwoom'?base+3.3:base;
  const wall=style==='engineering'||style==='church'?P.brick:style==='mansard'?P.cream:P.white;
  volume(B.wall,p,base,base+.22,P.stone);volume(B.wall,p,lo,top,wall);
  if(style==='centrifuge'){
    windows(B,p,base,cfg.height,6,4,.45);
    faces(p,(a,b,L,n)=>{if(L<8)return;const end=n[2]>.4||n[0]>.5; if(end){panel(B.glass,a,b,.04,.42,base+.3,top-.6,P.glass,n);for(let y=base+2.7;y<top;y+=1.65)panel(B.detail,a,b,.035,.44,y,y+.22,P.white,n);for(let j=1;j<4;j++)panel(B.detail,a,b,.04+j*.095,.04+j*.095+.025/L,base+.3,top-.6,P.silver,n);panel(B.detail,a,b,.04,.46,base+3.15,base+3.45,colour(0x934838),n);} });
  }else if(style==='engineering'){
    windows(B,p,base,cfg.height,3,3.6,.72,true);faces(p,(a,b,L,n)=>{if(L>12){panel(B.detail,a,b,0,.14,base,top,P.stone,n);panel(B.detail,a,b,.87,1,base,top,P.stone,n);}for(let y=base+3.8;y<top;y+=3.6)panel(B.detail,a,b,0,1,y,y+.18,P.stone,n);});
  }else if(style==='compute'){
    grid(B,p,base,top,3.2);faces(p,(a,b,L,n)=>{panel(B.detail,a,b,0,1,base,base+3.8,P.stone,n);if(L>20){panel(B.glass,a,b,.1,.15,base+3.8,top-1,P.glass,n);panel(B.glass,a,b,.76,.94,base+4.6,top-2.3,P.glass,n);}});
    // Four repeated cooling-cell enclosures along the mapped long wing.
    const angle=-.59;
    for(let k=0;k<4;k++){const x=-279+k*15.7,z=582-k*10.55,q=boundedBox(B.detail,p,x,z,11.2,12,top+.7,6.1,P.silver,angle);if(!q)continue;grid(B,q,top+.7,top+6.8,1.9);faces(q,(a,b,L,n)=>{panel(B.detail,a,b,0,1,top+.7,top+1.9,P.dark,n);for(let j=1;j<9;j++)panel(B.detail,a,b,j/9,j/9+.04,top+.7,top+1.9,P.silver,n);});roundedTower(B.detail,p,x+4,z+5,1.1,top,5.3,P.silver);}
  }else if(style==='headquarters'){
    faces(p,(a,b,L,n)=>{if(L<4)return;panel(B.glass,a,b,0,1,base+4.3,top-1.1,P.glass,n);const count=Math.max(1,Math.round(L/5.2));for(let k=0;k<=count;k++)panel(B.detail,a,b,Math.max(0,k/count-.055),Math.min(1,k/count+.055),base+4.3,top,P.white,n);for(let y=base+6;y<top-1.5;y+=2.8)panel(B.detail,a,b,0,1,y,y+.08,P.dark,n);panel(B.detail,a,b,0,1,top-2.2,top-.3,P.dark,n);});
  }else if(style==='church'){
    windows(B,p,base,cfg.height,4,4.3,.45);faces(p,(a,b,L,n)=>{if(n[0]>.3&&L>9){panel(B.glass,a,b,.08,.88,base+.5,top-1,P.glass,n);for(let k=1;k<7;k++)panel(B.detail,a,b,.08+k*.8/7,.08+k*.8/7+.035/L,base+.5,top-1,P.stone,n);for(let y=base+2.6;y<top;y+=2.5)panel(B.detail,a,b,.08,.88,y,y+.08,P.stone,n);}});
    boundedBox(B.wall,p,-317,630,4.3,5.3,top,16.3,P.brick,-.61);
  }else if(style==='kiwoom'){
    windows(B,p,base+3.3,cfg.height-3.3,4,3.3,.40);grid(B,p,base+3.3,top,3.4);
    faces(p,(a,b,L,n)=>{if(L>13&&n[0]<-.3){panel(B.glass,a,b,.11,.49,top-5,top-1.5,P.dark,n);panel(B.detail,a,b,.10,.13,top-5,top-1.4,P.white,n);panel(B.detail,a,b,.47,.5,top-5,top-1.4,P.white,n);}});
    faces(p,(a,b,L,n)=>{if(L>7){const count=Math.ceil(L/6);for(let k=0;k<=count;k++){const t=(k+.35)/(count+1),x=lerp(a[0],b[0],t)-n[0]*.7,z=lerp(a[1],b[1],t)-n[2]*.7;const g=new THREE.CylinderGeometry(.4,.43,3.3,8).translate(x,base+1.65,z);B.detail.geometry(g,P.white,p);}}});
  }else if(style==='mansard'){
    windows(B,p,base,cfg.height,4,3.7,.46); // The top roof is triangulated inside the existing footprint.
    const height=q=>top+Math.min(3.4,edgeDistance(q[0],q[1],p)*.75);
    function tr(a,b,c,depth=0){const ds=[Math.hypot(a[0]-b[0],a[1]-b[1]),Math.hypot(b[0]-c[0],b[1]-c[1]),Math.hypot(c[0]-a[0],c[1]-a[1])];if(Math.max(...ds)<3||depth>8){const up=(b[1]-a[1])*(c[0]-a[0])-(b[0]-a[0])*(c[1]-a[1]);if(up<0)[b,c]=[c,b];B.detail.tri([a[0],height(a),a[1]],[b[0],height(b),b[1]],[c[0],height(c),c[1]],P.roof);return;}const mid=(a,b)=>[(a[0]+b[0])/2,(a[1]+b[1])/2];const k=ds.indexOf(Math.max(...ds));if(k===0){const m=mid(a,b);tr(a,m,c,depth+1);tr(m,b,c,depth+1);}else if(k===1){const m=mid(b,c);tr(a,b,m,depth+1);tr(a,m,c,depth+1);}else{const m=mid(c,a);tr(a,b,m,depth+1);tr(m,b,c,depth+1);}}
    for(const t of THREE.ShapeUtils.triangulateShape(p.map(a=>new THREE.Vector2(...a)),[]))tr(...t.map(i=>p[i]));
    faces(p,(a,b,L,n)=>{if(L<16)return;for(let t=.18;t<.9;t+=8/L){const x=lerp(a[0],b[0],t)-n[0]*3,z=lerp(a[1],b[1],t)-n[2]*3,q=rectangle(p,x,z,2.7,2.8,Math.atan2(b[1]-a[1],b[0]-a[0]));if(!q)continue;volume(B.detail,q,top+1,top+2.8,P.cream);faces(q,(c,d,ll,nn)=>panel(B.glass,c,d,.15,.85,top+1.3,top+2.4,P.glass,nn));}});
    faces(p,(a,b,L,n)=>{if(n[0]<-.5&&L>13){panel(B.glass,a,b,.28,.72,base+.3,top-1,P.glass,n);panel(B.detail,a,b,.26,.3,base+.3,top,P.white,n);panel(B.detail,a,b,.7,.74,base+.3,top,P.white,n);panel(B.detail,a,b,.26,.74,top-.6,top,P.white,n);}});
  }
  return{heightM:cfg.height+(style==='compute'?6.8:style==='church'?16.3:style==='mansard'?3.4:0),heightBasis:cfg.heightBasis||'Photo-informed estimated volumes; no measured building heights',top:top+(style==='compute'?6.8:style==='church'?16.3:style==='mansard'?3.4:0)};
}

// Only a narrow continuation SOUTH of the existing W4 screen (which ends at
// z=465). This avoids doubling the old sculpted trees or hiding its parking.
const managedSegments=[[[-301,607],[-374,470],7,24],[[-353,510],[-375,470],-25,-7]];
export function isCaptureWestManaged(x,z){return managedSegments.some(([a,b,inner,outer])=>{const dx=b[0]-a[0],dz=b[1]-a[1],L=Math.hypot(dx,dz),t=((x-a[0])*dx+(z-a[1])*dz)/L,side=((x-a[0])*dz-(z-a[1])*dx)/L;return t>=0&&t<=L&&side>=inner&&side<=outer;});}
// Photo94–97's planted strip is included in a broad OSM parking polygon. This
// narrow correction is independent of the wider random-tree management mask.
// The centreline is the unchanged course900–974; road half-width is5m here.
export function isCaptureWestParkingOverride(x,z){const ax=-301.1,az=606.3,dx=-69.1,dz=-130.8,L=Math.hypot(dx,dz),along=((x-ax)*dx+(z-az)*dz)/L,side=((x-ax)*dz-(z-az)*dx)/L;return along>=0&&along<=L&&side>=6&&side<=12;}
function clearance(x,z,C){let m=Infinity;for(let i=0;i<C.n;i++){const j=(i+1)%C.n,dx=C.x[j]-C.x[i],dz=C.z[j]-C.z[i],t=Math.max(0,Math.min(1,((x-C.x[i])*dx+(z-C.z[i])*dz)/(dx*dx+dz*dz||1)));m=Math.min(m,Math.hypot(x-C.x[i]-t*dx,z-C.z[i]-t*dz)-(C.halfWidth?.[i]??5));}return m;}
function pose(C,i,side,extra){const off=(C.halfWidth?.[i]??5)+extra;return{x:C.x[i]+C.tz[i]*side*off,z:C.z[i]-C.tx[i]*side*off};}
function roadClear(x,z,r,D,allowFootwayCrown=false){for(const road of D.roads||[]){const p=road.p||[],half=(road.width||3)/2,extent=allowFootwayCrown&&['footway','path','steps'].includes(road.t)?.2:r;for(let i=0;i<p.length-1;i++){const a=p[i],b=p[i+1],dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1)));if(Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t)<half+extent+.15)return false;}}return true;}
function safe(x,z,r,D,C,surfAt,parkingOverride=false){if(clearance(x,z,C)<r+.7)return false;if((D.buildings||[]).some(b=>inside(x,z,b.p)||edgeDistance(x,z,b.p)<r+.15))return false;const allowParking=parkingOverride&&isCaptureWestParkingOverride(x,z)&&(D.parking||[]).some(p=>inside(x,z,p.p))&&roadClear(x,z,r,D,true);for(let k=0;k<12;k++){const a=k/12*Math.PI*2,xx=x+Math.cos(a)*r,zz=z+Math.sin(a)*r,s=surfAt(xx,zz);if([3,8,9].includes(s)||(s===2&&(!allowParking||!isCaptureWestParkingOverride(xx,zz))))return false;}return ![3,8,9].includes(surfAt(x,z))&&(surfAt(x,z)!==2||allowParking);}
function ellipsoid(B,x,y,z,sx,sy,sz,c){B.geometry(new THREE.IcosahedronGeometry(1,1).scale(sx,sy,sz).translate(x,y,z),c);}
function plant(B,x,z,h,kind,hAt){const y=hAt(x,z);B.detail.geometry(new THREE.CylinderGeometry(.12,.2,h*.8,7).translate(x,y+h*.4,z),colour(0x695d4b));if(kind==='sculpted'){for(let k=0;k<4;k++)ellipsoid(B.foliage,x+Math.sin(k*2)*.16,y+1.05+k*.9,z,2.3-k*.27,.88,1.7-k*.18,colour(k%2?0x536348:0x4c5e43));}else if(kind==='pine'){for(let k=0;k<4;k++)ellipsoid(B.foliage,x+Math.sin(k*2)*.55,y+h*(.6+k*.105),z+Math.cos(k)*.45,3-k*.35,1.25,2.7-k*.22,colour(k%2?0x3f5c4a:0x496550));}else{for(let k=0;k<4;k++)ellipsoid(B.foliage,x+Math.sin(k*2.1)*1.2,y+h*.7+k*.45,z+Math.cos(k*2.1),2.1,1.9,2.1,colour(k%2?0x68774e:0x718058));}}
function roadside(B,D,C,hAt,surfAt,result){
  const objects=result.metadata.props;
  // Large freestanding lawn lettering is made from small solid glyph strokes,
  // not a photograph or logo texture. Location/size are an approximate visual
  // match to84/85; the entire sign stays outside the racing road.
  const letters={K:['10001','10010','10100','11000','10100','10010','10001'],I:['11111','00100','00100','00100','00100','00100','11111'],S:['01111','10000','10000','01110','00001','00001','11110'],T:['11111','00100','00100','00100','00100','00100','00100']};
  const sign={x:-160,z:631,radius:7.1},ca=.55,sa=-Math.sqrt(1-.55*.55),step=.43;
  if(clearance(sign.x,sign.z,C)>sign.radius+.7&&roadClear(sign.x,sign.z,sign.radius,D)&&!(D.buildings||[]).some(b=>inside(sign.x,sign.z,b.p)||edgeDistance(sign.x,sign.z,b.p)<sign.radius+.15)){
    for(const[k,ch]of [...'KISTI'].entries())for(let row=0;row<7;row++){const line=letters[ch][row];for(let col=0;col<5;col++){if(line[col]!=='1')continue;let end=col;while(end+1<5&&line[end+1]==='1')end++;const along=(k*6+(col+end)/2-14)*step,x=sign.x+ca*along,z=sign.z+sa*along,y=hAt(x,z)+.25+(6-row+.5)*step,g=new THREE.BoxGeometry((end-col+1)*step,step,.26).rotateY(-Math.atan2(sa,ca)).translate(x,y,z);B.detail.geometry(g,P.white);col=end;}}
    objects.push({...sign,kind:'KISTI lawn letters',progress:780,photos:[84,85],clearanceM:clearance(sign.x,sign.z,C)-sign.radius,estimated:true});
  }
  // KISTI screen and pine grove continue into, but do not overlap, the W4 strip.
  for(let i=900;i<=972;i+=2){const a=pose(C,i,1,3.4);if(a.z<470||!safe(a.x,a.z,2.35,D,C,surfAt,true))continue;plant(B,a.x,a.z,4.8,'sculpted',hAt);objects.push({...a,radius:2.35,kind:'sculpted evergreen',progress:i,photos:[94,95,96,97],parkingOverride:surfAt(a.x,a.z)===2,clearanceM:clearance(a.x,a.z,C)-2.35});}
  // Small ground cells replace only confirmed parking area in the same strip.
  for(let z=475;z<613;z++)for(let x=-384;x<-300;x++){if(!isCaptureWestParkingOverride(x+.5,z+.5)||surfAt(x+.5,z+.5)!==2||!(D.parking||[]).some(p=>inside(x+.5,z+.5,p.p))||!roadClear(x+.5,z+.5,.71,D))continue;const q=[[x,z],[x+1,z],[x+1,z+1],[x,z+1]];if(q.some(p=>!isCaptureWestParkingOverride(...p)||[3,8,9].includes(surfAt(...p))))continue;B.foliage.quad(...q.map(p=>[p[0],hAt(...p)+.225,p[1]]),colour(0x687954),[0,1,0]);}
  for(let i=898;i<=974;i+=7){const a=pose(C,i,1,10);if(a.z<470||!safe(a.x,a.z,3.8,D,C,surfAt))continue;plant(B,a.x,a.z,12.5,'pine',hAt);objects.push({...a,radius:3.8,kind:'pine',progress:i,photos:[94,95,96,97],clearanceM:clearance(a.x,a.z,C)-3.8});}
  for(let i=935;i<=971;i+=7){const a=pose(C,i,-1,5.3);if(!safe(a.x,a.z,3.4,D,C,surfAt))continue;plant(B,a.x,a.z,8.4,'deciduous',hAt);objects.push({...a,radius:3.4,kind:'parking-edge tree',progress:i,photos:[95,96,97],clearanceM:clearance(a.x,a.z,C)-3.4});}
  // The photographed low rail beside the southern exit. Follow hAt per post.
  for(let i=788;i<828;i+=2){const a=pose(C,i,1,1.3),b=pose(C,i+2,1,1.3);if(clearance(a.x,a.z,C)<.65||clearance(b.x,b.z,C)<.65)continue;const ya=hAt(a.x,a.z),yb=hAt(b.x,b.z),r=.045;B.detail.geometry(new THREE.CylinderGeometry(r,r,1.12,6).translate(a.x,ya+.56,a.z),P.silver);for(let j=0;j<3;j++){const y0=ya+.3+j*.31,y1=yb+.3+j*.31,pa=new THREE.Vector3(a.x,y0,a.z),pb=new THREE.Vector3(b.x,y1,b.z),d=pb.clone().sub(pa),g=new THREE.CylinderGeometry(.03,.03,d.length(),5);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize()));g.translate((a.x+b.x)/2,(y0+y1)/2,(a.z+b.z)/2);B.detail.geometry(g,P.silver);}objects.push({...a,radius:.08,kind:'low silver pedestrian rail',progress:i,photos:[86,87,88],clearanceM:clearance(a.x,a.z,C)-.08});}
  // Round planters read clearly in the W16 walking strip; centre lane posts in
  // the photos are omitted because the race uses the full road width.
  for(let i=653;i<=687;i+=7){const a=pose(C,i,-1,1.7);if(clearance(a.x,a.z,C)<1.1||surfAt(a.x,a.z)===8)continue;const y=hAt(a.x,a.z);B.detail.geometry(new THREE.CylinderGeometry(.61,.4,.55,10).translate(a.x,y+.275,a.z),colour(0x746453));ellipsoid(B.foliage,a.x,y+.65,a.z,.53,.24,.53,colour(0x65734a));objects.push({...a,radius:.62,kind:'round planter',progress:i,photos:[79,80],clearanceM:clearance(a.x,a.z,C)-.62});}
}

/** Three architectural batches plus one foliage batch, regardless of count. */
export function buildCaptureWest(scene,D={},C,hAt=()=>0,surfAt=()=>0){
  const result={handledIds:new Set(),labels:[],models:[],metadata:{reference:'audit/capture-review-79-102.json',sourceDates:['2025-04','2026-04'],drawCalls:0,models:[],props:[],excluded:['source photograph textures','centreline bollards inside the racing corridor','existing W4-1/W4-2/W4-3/W4-4 buildings','existing W4 tree screen north of z=465'],estimated:true}};
  const B={wall:new Batch(),glass:new Batch(),detail:new Batch(),foliage:new Batch()};
  for(const b of D.buildings||[]){const cfg=CONFIG[b.id];if(!cfg||!b.p||b.p.length<3)continue;const p=b.p.filter((a,i)=>i===0||Math.hypot(a[0]-b.p[i-1][0],a[1]-b.p[i-1][1])>.01).map(a=>[...a]);if(Math.hypot(p[0][0]-p.at(-1)[0],p[0][1]-p.at(-1)[1])<.01)p.pop();if(p.length<3||p.some(a=>!a.every(Number.isFinite)))continue;const ys=p.map(a=>hAt(...a));if(!ys.every(Number.isFinite))continue;const base=Math.min(...ys)-.55,start=Object.fromEntries(Object.entries(B).map(([k,v])=>[k,v.p.length/3]));
    const shape=architecture(B,b,p,base,cfg),model={id:b.id,ref:b.ref||'',name:cfg.name,sourceFootprint:p,baseElevationM:base,...shape,capturePhotos:cfg.photos,features:cfg.features,matchConfidence:cfg.confidence||'High building/route match; facade dimensions approximate',geometryRanges:Object.fromEntries(Object.entries(B).map(([k,v])=>[k,[start[k],v.p.length/3]]))};result.models.push(model);result.metadata.models.push(model);result.handledIds.add(b.id);result.labels.push({ref:b.ref||'',name:cfg.name,en:cfg.name,x:p.reduce((s,a)=>s+a[0],0)/p.length,z:p.reduce((s,a)=>s+a[1],0)/p.length,y:shape.top+4});
  }
  if(C?.n>1100&&D.buildings?.length)roadside(B,D,C,hAt,surfAt,result);
  for(const[kind,b]of Object.entries(B)){if(!b.p.length)continue;const m=b.mesh(kind);scene.add(m);result.metadata.drawCalls++;}
  result.metadata.triangles=Object.values(B).reduce((s,b)=>s+b.p.length/9,0);result.metadata.minimumPropCourseClearanceM=result.metadata.props.length?Math.min(...result.metadata.props.map(p=>p.clearanceM)):null;return result;
}
