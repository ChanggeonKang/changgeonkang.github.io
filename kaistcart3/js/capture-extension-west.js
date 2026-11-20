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
function panel(B,a,b,t0,t1,y0,y1,c,n,out=0){
  if(t1<=t0||y1<=y0)return;
  const px=out?n[0]*out:0,pz=out?n[2]*out:0;
  const point=(t,y)=>[lerp(a[0],b[0],t)+px,y,lerp(a[1],b[1],t)+pz];
  B.quad(point(t0,y0),point(t1,y0),point(t1,y1),point(t0,y1),c,n);
}
function roof(B,p,y,c){for(const t of THREE.ShapeUtils.triangulateShape(p.map(a=>new THREE.Vector2(...a)),[]))B.tri(...t.map(i=>[p[i][0],y,p[i][1]]),c,[0,1,0]);}
function volume(B,p,base,top,c){faces(p,(a,b,L,n)=>panel(B,a,b,0,1,base,top,c,n));roof(B,p,top,c);}
function rectangle(p,x,z,w,d,angle=0){const ca=Math.cos(angle),sa=Math.sin(angle),q=[[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2]].map(([u,v])=>[x+u*ca-v*sa,z+u*sa+v*ca]);return ringValid(q,p)?q:null;}
function windows(B,p,base,H,floors=4,width=3.4,ratio=.58,band=false){faces(p,(a,b,L,n)=>{const count=Math.max(1,Math.round(L/width));for(let f=0;f<floors;f++){const y=base+.85+f*(H-.7)/floors,hh=Math.min(1.8,(H-.7)/floors*.57);if(band)panel(B.glass,a,b,.025,.975,y,y+hh,P.glass,n);for(let j=0;j<count;j++){const t=(j+.5)/count,w=ratio/count;if(!band)panel(B.glass,a,b,t-w/2,t+w/2,y,y+hh,P.glass,n);panel(B.detail,a,b,t-.035/L,t+.035/L,y,y+hh,P.silver,n);} }});}
function grid(B,p,base,top,step=3.4){faces(p,(a,b,L,n)=>{for(let k=1;k<L/step;k++)panel(B.detail,a,b,k*step/L,k*step/L+.025/L,base,top,P.silver,n);for(let y=base+step;y<top;y+=step)panel(B.detail,a,b,0,1,y,y+.025,P.silver,n);});}
function boundedBox(B,p,x,z,w,d,base,height,c,angle=0){const q=rectangle(p,x,z,w,d,angle);if(q)volume(B,q,base,base+height,c);return q;}
function roundedTower(B,p,x,z,r,base,height,c){const q=Array.from({length:16},(_,i)=>[x+r*Math.cos(i/16*Math.PI*2),z+r*Math.sin(i/16*Math.PI*2)]);if(ringValid(q,p))volume(B,q,base,base+height,c);}
const CONFIG={
  1526849364:{name:'KISTI Main Gate Guard Post',style:'guardPost',height:3.75,photos:[89,90,'90_left'],features:['one-storey pale mint metal exterior','dark observation windows','white window canopy and roof lip']},
  219734142:{name:'Geotechnical Centrifuge Testing Center',style:'centrifuge',height:21.5,photos:[79,80],features:['pale panel walls','blue glazed corner','horizontal white sunshade blades','red entrance canopy']},
  49931912:{name:'Materials Science & Engineering',style:'engineering',height:11.6,photos:[81,82,83],features:['orange-brown masonry','gray vertical cores','long horizontal window rows'],heightBasis:'OSM three levels retained; estimated storey height. Upper background mass is not measured from the perspective.'},
  470171499:{name:'KISTI National Supercomputing Center',style:'compute',height:18.8,photos:[85,91,92,93,94,95],features:['large pale cladding fields','narrow glazed vertical slots','four roof cooling boxes','external silver pipes']},
  1529346023:{name:'KISTI Headquarters',style:'headquarters',height:27.5,photos:[85,95,96,97],features:['tall blue-gray glazed facade','white vertical piers','dark upper band','low white podium']},
  470181823:{name:'Daeduk Hanbit Church',style:'church',height:17.2,photos:[90,91,92,93],features:['brown brick walls','teal glass entrance tower','tall narrow brick steeple']},
  1259373434:{name:'Kiwoom Hall',style:'kiwoom',height:18.2,photos:[97,98],features:['pale silver folded panels','small horizontal windows','column-supported frontage','large upper recess']},
  78058725:{name:'Galilei Hall',style:'mansard',height:11.2,photos:[102],features:['beige walls','dark steep roof','roof dormers','blue-glazed entrance in pale frame'],confidence:'medium; sideview and mapped W3 footprint relative to W4-2/W4-3 match; entrance details approximate'},
};
// These OSM ways are explicitly tagged building=greenhouse in the agricultural
// research plots on the outside of the W5 bend. Only the rooflines are clear
// behind the clipped hedge in views 5 and 7.
const westGlasshouses = new Set([1529968629,1529968630,1529968641,1529968642,1529968643,
  1529968645,1529968646,1529968647,1529968648,1529968651,1529968652,1529968653,1529968654,
  1529968655,1529968656,1529968657,1529968658,1529968659,1529968660,1529968661]);
const glasshouseProfile={name:'Research Greenhouse',style:'glasshouse',photos:[5,7],features:['pale glazed roof bays','repeated growing houses behind the W5 evergreen hedge'],confidence:'OSM greenhouse use and footprints; roof profiles are visual estimates.'};
function glasshouse(B,p,ground,base){
  const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
  const [a,b,c,d]=distance(p[0],p[1])>distance(p[1],p[2])?p:[p[1],p[2],p[3],p[0]];
  const width=(distance(a,d)+distance(b,c))*.5, length=(distance(a,b)+distance(c,d))*.5;
  const bays=Math.max(1,Math.round(width/6)),eaves=ground+2.0,rise=Math.min(1.8,width/bays*.24);
  const wallColour=colour(0xaabcb6),sheet=colour(0xc9d7d0),shade=colour(0xb7cbc5),frame=colour(0x929f9b);
  faces(p,(f,t,L,n)=>panel(B.wall,f,t,0,1,base,eaves,wallColour,n));
  function point(t,u){
    const phase=(u*bays)%1;
    const r=1-Math.abs(2*phase-1);
    return [lerp(lerp(a[0],d[0],u),lerp(b[0],c[0],u),t),eaves+rise*r,
      lerp(lerp(a[1],d[1],u),lerp(b[1],c[1],u),t)];
  }
  function slope(batch,t0,t1,u0,u1,color){
    const q=[point(t0,u0),point(t1,u0),point(t1,u1),point(t0,u1)];
    const normal=new THREE.Vector3(...q[1]).sub(new THREE.Vector3(...q[0])).cross(new THREE.Vector3(...q[3]).sub(new THREE.Vector3(...q[0]))).normalize();
    if(normal.y<0)normal.negate();
    batch.quad(...q,color,normal.toArray());
  }
  for(let i=0;i<bays;i++){
    const left=i/bays,peak=(i+.5)/bays,right=(i+1)/bays;
    slope(B.glass,0,1,left,peak,sheet);slope(B.glass,0,1,peak,right,shade);
    for(const t of [0,1]){
      const A=point(t,left),M=point(t,peak),Z=point(t,right);
      const n=new THREE.Vector3(Z[2]-A[2],0,A[0]-Z[0]).normalize();
      const towards=point(t?0:1,left);
      if(n.x*(towards[0]-A[0])+n.z*(towards[2]-A[2])>0)n.negate();
      B.glass.tri(A,M,Z,sheet,n.toArray());
    }
    const intervals=Math.max(1,Math.round(length/3.1));
    for(let j=1;j<intervals;j++){
      const t=j/intervals,w=.035/length;
      slope(B.detail,t-w,t+w,left,peak,frame);slope(B.detail,t-w,t+w,peak,right,frame);
    }
  }
  return {heightM:eaves+rise-base,top:eaves+rise,heightBasis:'Mapped greenhouses; estimated eaves and roof span.'};
}
// Photo 98 shows a recessed service core to the right of the columns. The
// southwestern side of the cantilever looks through to the parking court.
function kiwoomGroundFloor(B,p,base,hAt,door){
  const [x,z]=door,tx=.837,tz=-.547,nx=-tz,nz=tx;
  const along=q=>(q[0]-x)*tx+(q[1]-z)*tz,depth=q=>-(q[0]-x)*nx-(q[1]-z)*nz;
  function cut(ring,distance){
    const out=[];
    ring.forEach((a,i)=>{
      const b=ring[(i+1)%ring.length],da=distance(a),db=distance(b);
      if(da>=0)out.push(a);
      if((da>=0)!==(db>=0)){
        const t=da/(da-db);out.push([lerp(a[0],b[0],t),lerp(a[1],b[1],t)]);
      }
    });
    return out;
  }
  const top=base+3.3;
  // The beam soffit faces the viewer below, even from the open parking side.
  for(const t of THREE.ShapeUtils.triangulateShape(p.map(a=>new THREE.Vector2(...a)),[]))
    B.detail.tri(...t.map(i=>[p[i][0],top,p[i][1]]),P.stone,[0,-1,0]);
  const core=cut(cut(p,q=>along(q)+4.1),q=>depth(q)-2.15);
  if(core.length<3)return;
  faces(core,(a,b,L,n)=>{
    const lower=Math.min(base,hAt(...a),hAt(...b))-.28;
    panel(B.wall,a,b,0,1,lower,top,P.stone,n);
    // Glazing and metal panel seams on the sheltered walls.
    const bays=Math.max(1,Math.round(L/2.7));
    for(let j=0;j<bays;j++){
      const t=(j+.5)/bays;
      panel(B.detail,a,b,t-.018/L,t+.018/L,lower,top,P.silver,n);
      if(L>3)panel(B.glass,a,b,t-.17/bays,t+.17/bays,top-.91,top-.36,P.dark,n);
    }
    if(Math.abs(depth(a)-2.15)<.01 && Math.abs(depth(b)-2.15)<.01){
      const t=-along(a)/(along(b)-along(a)),w=.92/L;
      if(t>w && t<1-w){
        panel(B.detail,a,b,t-w,t-w+.065/L,base+.08,base+2.51,P.silver,n);
        panel(B.detail,a,b,t+w-.065/L,t+w,base+.08,base+2.51,P.silver,n);
        panel(B.detail,a,b,t-w,t+w,base+2.42,base+2.51,P.silver,n);
        panel(B.glass,a,b,t-w+.065/L,t+w-.065/L,base+.08,base+2.42,colour(0x293636),n);
        panel(B.detail,a,b,t-.035/L,t+.035/L,base+.13,base+2.42,P.silver,n);
      }
    }
  });
}
function architecture(B,b,p,base,cfg,hAt){
  const top=base+cfg.height,style=cfg.style,lo=style==='kiwoom'?base+3.3:base;
  const wall=style==='engineering'||style==='church'?P.brick:style==='mansard'?P.cream:style==='guardPost'?colour(0xc5ded9):P.white;
  if(style!=='kiwoom')volume(B.wall,p,base,base+.22,P.stone);
  volume(B.wall,p,lo,top,wall);
  if(style==='guardPost'){
    faces(p,(a,b,L,n)=>{
      panel(B.detail,a,b,0,1,top-.22,top,colour(0xf0efdf),n);
      if(L<3)return;
      const slots=L>7?3:2;
      for(let j=0;j<slots;j++){
        const left=(j+.16)/slots,right=(j+.87)/slots;
        panel(B.glass,a,b,left,right,base+1.45,top-.73,colour(0x394c4d),n);
        panel(B.detail,a,b,left,right,top-.79,top-.68,P.white,n);
        panel(B.detail,a,b,(left+right)*.5-.035/L,(left+right)*.5+.035/L,base+1.45,top-.73,P.silver,n);
      }
    });
  }else if(style==='centrifuge'){
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
    kiwoomGroundFloor(B,p,base,hAt,[-342.1,405.6]);
    windows(B,p,base+3.3,cfg.height-3.3,4,3.3,.40);grid(B,p,base+3.3,top,3.4);
    faces(p,(a,b,L,n)=>{if(L>13&&n[0]<-.3){panel(B.glass,a,b,.11,.49,top-5,top-1.5,P.dark,n);panel(B.detail,a,b,.10,.13,top-5,top-1.4,P.white,n);panel(B.detail,a,b,.47,.5,top-5,top-1.4,P.white,n);}});
    faces(p,(a,b,L,n)=>{if(L>7){const count=Math.ceil(L/6);for(let k=0;k<=count;k++){
      const t=(k+.35)/(count+1),x=lerp(a[0],b[0],t)-n[0]*.7,z=lerp(a[1],b[1],t)-n[2]*.7;
      const foot=hAt(x,z)-.12,head=base+3.3;
      if(foot<head)B.detail.geometry(new THREE.CylinderGeometry(.4,.43,head-foot,8).translate(x,(head+foot)/2,z),P.white,p);
    }}});
  }else if(style==='mansard'){
    windows(B,p,base,cfg.height,3,3.7,.53); // The top roof is triangulated inside the existing footprint.
    const height=q=>top+Math.min(3.4,edgeDistance(q[0],q[1],p)*1.35);
    function tr(a,b,c,depth=0){const ds=[Math.hypot(a[0]-b[0],a[1]-b[1]),Math.hypot(b[0]-c[0],b[1]-c[1]),Math.hypot(c[0]-a[0],c[1]-a[1])];if(Math.max(...ds)<3||depth>8){const up=(b[1]-a[1])*(c[0]-a[0])-(b[0]-a[0])*(c[1]-a[1]);if(up<0)[b,c]=[c,b];B.detail.tri([a[0],height(a),a[1]],[b[0],height(b),b[1]],[c[0],height(c),c[1]],P.roof);return;}const mid=(a,b)=>[(a[0]+b[0])/2,(a[1]+b[1])/2];const k=ds.indexOf(Math.max(...ds));if(k===0){const m=mid(a,b);tr(a,m,c,depth+1);tr(m,b,c,depth+1);}else if(k===1){const m=mid(b,c);tr(a,b,m,depth+1);tr(a,m,c,depth+1);}else{const m=mid(c,a);tr(a,b,m,depth+1);tr(m,b,c,depth+1);}}
    for(const t of THREE.ShapeUtils.triangulateShape(p.map(a=>new THREE.Vector2(...a)),[]))tr(...t.map(i=>p[i]));
    // The fourth floor is in the steep roof. Each photographed dormer has its own pointed gable.
    faces(p,(a,b,L,n)=>{
      if(L<8)return;
      const count=Math.max(1,Math.round(L/4.8)),tx=(b[0]-a[0])/L,tz=(b[1]-a[1])/L;
      for(let j=0;j<count;j++){
        const t=(j+.5)/count,x=lerp(a[0],b[0],t),z=lerp(a[1],b[1],t);
        const plane=(u,v)=>[x+u*tx-v*n[0],z+u*tz-v*n[2]];
        const q=[plane(-1.03,.53),plane(1.03,.53),plane(1.03,2.45),plane(-1.03,2.45)];
        if(!ringValid(q,p))continue;
        volume(B.detail,q,top+.48,top+2.12,P.cream);
        panel(B.glass,q[0],q[1],.13,.87,top+.72,top+1.98,P.dark,n,.027);
        panel(B.glass,q[0],q[1],.18,.82,top+.78,top+1.91,P.glass,n,.045);
        const at=(u,h,v)=>{const [x,z]=plane(u,v);return [x,top+h,z];};
        B.detail.tri(at(-1.03,2.12,.53),at(1.03,2.12,.53),at(0,2.76,.53),P.cream,n);
        for(const side of [-1,1]){
          const corners=[at(0,2.86,.39),at(side*1.13,2.13,.39),at(side*1.13,2.13,2.5),at(0,2.86,2.5)];
          B.detail.quad(...corners,P.roof,[tx*side*.54,.84,tz*side*.54]);
        }
      }
    });
    faces(p,(a,b,L,n)=>{if(n[0]<-.5&&L>13){panel(B.glass,a,b,.28,.72,base+.3,top-1,P.glass,n);panel(B.detail,a,b,.26,.3,base+.3,top,P.white,n);panel(B.detail,a,b,.7,.74,base+.3,top,P.white,n);panel(B.detail,a,b,.26,.74,top-.6,top,P.white,n);}});
  }
  return{heightM:cfg.height+(style==='compute'?6.8:style==='church'?16.3:style==='mansard'?3.4:0),heightBasis:cfg.heightBasis||'Photo-informed estimated volumes; no measured building heights',top:top+(style==='compute'?6.8:style==='church'?16.3:style==='mansard'?3.4:0)};
}

// Only a narrow continuation SOUTH of the existing W4 screen (which ends at
// z=465). This avoids doubling the old sculpted trees or hiding its parking.
const managedSegments=[[[-301,607],[-374,470],7,24],[[-353,510],[-375,470],-25,-7],
  [[-145.8,658.6],[-209,700.9],-18,18]];
let futsalFootprint=null;
export function isCaptureWestManaged(x,z){
  if(futsalFootprint&&x>-215&&x<-158&&z>624&&z<675&&inside(x,z,futsalFootprint))return true;
  return managedSegments.some(([a,b,inner,outer])=>{const dx=b[0]-a[0],dz=b[1]-a[1],L=Math.hypot(dx,dz),t=((x-a[0])*dx+(z-a[1])*dz)/L,side=((x-a[0])*dz-(z-a[1])*dx)/L;return t>=0&&t<=L&&side>=inner&&side<=outer;});
}
// Photo94–97's planted strip is included in a broad OSM parking polygon. This
// narrow correction is independent of the wider random-tree management mask.
// The centreline is the unchanged course900–974; road half-width is5m here.
export function isCaptureWestParkingOverride(x,z){const ax=-301.1,az=606.3,dx=-69.1,dz=-130.8,L=Math.hypot(dx,dz),along=((x-ax)*dx+(z-az)*dz)/L,side=((x-ax)*dz-(z-az)*dx)/L;return along>=0&&along<=L&&side>=6&&side<=12;}
function clearance(x,z,C){let m=Infinity;for(let i=0;i<C.n;i++){const j=(i+1)%C.n,dx=C.x[j]-C.x[i],dz=C.z[j]-C.z[i],t=Math.max(0,Math.min(1,((x-C.x[i])*dx+(z-C.z[i])*dz)/(dx*dx+dz*dz||1)));m=Math.min(m,Math.hypot(x-C.x[i]-t*dx,z-C.z[i]-t*dz)-(C.halfWidth?.[i]??5));}return m;}
function pose(C,i,side,extra){const off=(C.halfWidth?.[i]??5)+extra;return{x:C.x[i]+C.tz[i]*side*off,z:C.z[i]-C.tx[i]*side*off};}
function roadClear(x,z,r,D,allowFootwayCrown=false){for(const road of D.roads||[]){const p=road.p||[],half=(road.width||3)/2,extent=allowFootwayCrown&&['footway','path','steps'].includes(road.t)?.2:r;for(let i=0;i<p.length-1;i++){const a=p[i],b=p[i+1],dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1)));if(Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t)<half+extent+.15)return false;}}return true;}
function safe(x,z,r,D,C,surfAt){
  if(clearance(x,z,C)<r+.7||(D.buildings||[]).some(b=>inside(x,z,b.p)||edgeDistance(x,z,b.p)<r+.15))return false;
  const blocked=(px,pz)=>[2,3,8,9].includes(surfAt(px,pz));
  for(let k=0;k<12;k++){const a=k*Math.PI/6;if(blocked(x+Math.cos(a)*r,z+Math.sin(a)*r))return false;}
  return !blocked(x,z);
}
function ellipsoid(B,x,y,z,sx,sy,sz,c){B.geometry(new THREE.IcosahedronGeometry(1,1).scale(sx,sy,sz).translate(x,y,z),c);}
function parkingTree(B,x,z,h,hAt){
  const y=hAt(x,z);
  B.detail.geometry(new THREE.CylinderGeometry(.12,.2,h*.8,7).translate(x,y+h*.4,z),colour(0x695d4b));
  for(let k=0;k<4;k++)ellipsoid(B.foliage,x+Math.sin(k*2.1)*1.2,y+h*.7+k*.45,z+Math.cos(k*2.1),2.1,1.9,2.1,colour(k%2?0x68774e:0x718058));
}
// Photos 86–88 show rectangular concrete cells across a grassy sloping bank.
// The rail follows its crest. The embankment is scenery outside the race walk.
function kistiBank(B, C, hAt, surfAt, objects) {
  const grass = [0x869660,0x8c9763,0x919963].map(colour);
  const concrete = colour(0xb3af98), toe = 2.75, crest = 5.3, rise = 1.1;
  const start = 790, end = 828;
  function cross(i) {
    const point = (offset,lift) => {
      const p = pose(C,i,1,offset);
      return [p.x,hAt(p.x,p.z)+lift,p.z];
    };
    // Taper both ends into the surrounding terrain, avoiding abrupt end walls.
    const height = rise * Math.min(1,(i-start)/3,(end-i)/3);
    return [point(toe,.20),point(crest,.28+height),point(crest+.75,.26+height),point(crest+2.5,.04)];
  }
  const between = (a,b,t) => a.map((value,k) => lerp(value,b[k],t));
  function rail(a,b,r) {
    const first = new THREE.Vector3(...a), last = new THREE.Vector3(...b);
    const d = last.clone().sub(first);
    const g = new THREE.CylinderGeometry(r,r,d.length(),6);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize()));
    g.translate((a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2);
    B.detail.geometry(g,P.silver);
  }
  let needsPost = true;
  for(let i=start;i<end;i+=2){
    const a = cross(i), b = cross(i+2);
    if([...a,...b].some(([x,,z]) => [2,3,8,9].includes(surfAt(x,z)))) { needsPost=true; continue; }
    for(let j=0;j<3;j++) B.foliage.quad(a[j],b[j],b[j+1],a[j+1],grass[(i/2+j)%grass.length]);
    function rib(u0,u1,v0,v1) {
      const surface = (u,v) => {
        const p = between(between(a[0],b[0],u),between(a[1],b[1],u),v);
        p[1]+=.025;
        return p;
      };
      B.detail.quad(surface(u0,v0),surface(u1,v0),surface(u1,v1),surface(u0,v1),concrete);
    }
    for(const v of [.08,.42,.76]) rib(0,1,v,v+.034);
    for(const u of [0,.33,.66]) rib(u,u+.025,.05,.79);
    const post = p => rail(p,[p[0],p[1]+1.04,p[2]],.05);
    if(needsPost) post(a[2]);
    post(b[2]);
    needsPost=false;
    for(const h of [.33,.65,1.0]) rail([a[2][0],a[2][1]+h,a[2][2]],[b[2][0],b[2][1]+h,b[2][2]],.033);
    const [x,,z] = a[2];
    objects.push({x,z,radius:.08,kind:'low silver pedestrian rail',progress:i,photos:[86,87,88],clearanceM:clearance(x,z,C)-.08});
    objects.push({x:a[0][0],z:a[0][2],radius:0,kind:'grass-block retaining bank',progress:i,photos:[86,87,88],clearanceM:Math.min(clearance(a[0][0],a[0][2],C),clearance(b[0][0],b[0][2],C)),estimated:true});
  }
}
function rectangularBeam(batch,from,to,width,depth,color){
  const a=new THREE.Vector3(...from),b=new THREE.Vector3(...to),axis=b.clone().sub(a);
  const g=new THREE.BoxGeometry(width,axis.length(),depth);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),axis.normalize()));
  const centre=a.lerp(b,.5);g.translate(centre.x,centre.y,centre.z);batch.geometry(g,color);
}
function kistiTrees(B,D,C,hAt,surfAt,objects){
  const timber=colour(0x77614d),bark=colour(0x665d4b);
  function branch(a,b,r0,r1,color){
    const A=new THREE.Vector3(...a),axis=new THREE.Vector3(...b).sub(A);
    const g=new THREE.CylinderGeometry(r1,r0,axis.length(),6);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),axis.clone().normalize()));
    A.addScaledVector(axis,.5);g.translate(A.x,A.y,A.z);B.detail.geometry(g,color);
  }
  // On the left bank, tall pines have exposed trunks and wide layered crowns.
  // Across the road the young trees allow a clear view through to the net.
  for(let i=791;i<=825;i+=5){
    const {x,z}=pose(C,i,1,9.1+Math.sin(i)*.65),y=hAt(x,z),h=10.1+1.4*Math.sin(i*1.7);
    if(!safe(x,z,3.7,D,C,surfAt))continue;
    const bend=.53*Math.sin(i),stem=[x+bend,y+h*.74,z+.34];
    branch([x,y-.1,z],stem,.27,.14,timber);
    for(let k=0;k<5;k++){
      const a=i*.63+k*2.4,r=k===4?.44:1.5,px=x+Math.sin(a)*r,pz=z+Math.cos(a)*r;
      const py=y+h*(.66+k*.071);
      branch([x+bend*.8,py-1.3,z+.22],[px,py,pz],.13,.055,bark);
      ellipsoid(B.foliage,px,py+.24,pz,k===4?1.75:2.22,.87,1.9,colour(k%2?0x48654b:0x365741));
    }
    objects.push({x,z,radius:3.7,kind:'KISTI bank pine',progress:i,photos:[86,87,88],clearanceM:clearance(x,z,C)-3.7});
  }
  for(let i=793;i<=826;i+=7){
    const {x,z}=pose(C,i,-1,5.3),y=hAt(x,z);
    if(!safe(x,z,1.65,D,C,surfAt))continue;
    branch([x,y-.08,z],[x+.12,y+4.3,z],.1,.045,bark);
    for(let k=0;k<3;k++){
      const a=i+k*2.2,px=x+Math.cos(a)*.55,pz=z+Math.sin(a)*.55,py=y+3.3+k*.55;
      branch([x,y+2.4,z],[px,py,pz],.055,.022,bark);
      ellipsoid(B.foliage,px,py,pz,1.05,.94,.9,colour(k%2?0x738757:0x667e4f));
    }
    objects.push({x,z,radius:1.65,kind:'KISTI young lawn tree',progress:i,photos:[86,87,88],clearanceM:clearance(x,z,C)-1.65});
  }
}
function kistiCourt(B,D,C,hAt,objects){
  // OSM way 1257083998 is the futsal pitch immediately across the KISTI
  // entrance road from the grass-block bank. Keep its existing turf surface.
  const pitch=(D.areas||[]).find(a=>a.k==='pitch'&&a.p?.length===4&&inside(-186,650,a.p));
  if(!pitch)return;
  futsalFootprint=pitch.p;
  const p=pitch.p,ys=p.map(a=>hAt(...a)),surface=(Math.min(...ys)+Math.max(...ys))*.5+.3;
  const metal=colour(0x477a66),net=colour(0x6d947f),blue=colour(0x477f95);
  // Fence bases reach both the horizontal playing surface and the sloping
  // outside ground. The high section is open mesh, with a blue lower band.
  faces(p,(a,b,length,n)=>{
    const lower=Math.min(hAt(...a),hAt(...b),surface)-.08,top=surface+4.25;
    const posts=Math.ceil(length/3.2),wires=Math.ceil(length/.67);
    for(let j=0;j<posts;j++){
      const t=j/posts,x=lerp(a[0],b[0],t),z=lerp(a[1],b[1],t);
      rectangularBeam(B.detail,[x,Math.min(hAt(x,z),surface)-.12,z],[x,top+.06,z],.09,.09,metal);
    }
    const shade=(t0,t1,y0,y1,color)=>{
      panel(B.detail,a,b,t0,t1,y0,y1,color,n);
      panel(B.detail,a,b,t0,t1,y0,y1,color,[-n[0],0,-n[2]]);
    };
    shade(0,1,surface+.42,surface+.78,blue);
    for(const y of [surface+.18,surface+1.45,surface+2.04,top])shade(0,1,y-.035,y+.035,metal);
    for(let y=surface+.98;y<top-.1;y+=.62)shade(0,1,y,y+.021,net);
    for(let j=1;j<wires;j++)shade((j-.018)/wires,(j+.018)/wires,lower+.1,top,net);
  });
  // Roadside photograph 87 resolves two small downward-facing heads on the
  // same crossbar. The poles sit immediately inside the long, southwest edge.
  const edges=p.map((a,i)=>[a,p[(i+1)%p.length]]).filter(([a,b])=>Math.hypot(b[0]-a[0],b[1]-a[1])>30);
  const [a,b]=edges.sort((e,f)=>clearance((e[0][0]+e[1][0])/2,(e[0][1]+e[1][1])/2,C)-clearance((f[0][0]+f[1][0])/2,(f[0][1]+f[1][1])/2,C))[0];
  const centre=p.reduce((s,q)=>[s[0]+q[0]/4,s[1]+q[1]/4],[0,0]);
  const len=Math.hypot(a[0]-b[0],a[1]-b[1]),ux=(b[0]-a[0])/len,uz=(b[1]-a[1])/len;
  for(let j=1;j<12;j++){
    const x=lerp(centre[0],lerp(a[0],b[0],j/12),1.12),z=lerp(centre[1],lerp(a[1],b[1],j/12),1.12);
    if(!roadClear(x,z,.8,D))continue;
    const y=hAt(x,z);
    ellipsoid(B.foliage,x,y+.31,z,.78,.44,.72,colour(0x7e8b47));
    ellipsoid(B.foliage,x+Math.sin(j)*.13,y+.54,z+.10,.62,.30,.55,colour(j%3?0xaa9e4b:0xb1a24e));
  }
  for(const t of [.21,.78]){
    const x=lerp(lerp(a[0],b[0],t),centre[0],.04),z=lerp(lerp(a[1],b[1],t),centre[1],.04);
    const top=surface+7.55,post=colour(0x8c9690);
    rectangularBeam(B.detail,[x,Math.min(hAt(x,z),surface)-.12,z],[x,top,z],.14,.14,post);
    rectangularBeam(B.detail,[x-ux*.7,top,z-uz*.7],[x+ux*.7,top,z+uz*.7],.11,.11,post);
    for(const side of [-1,1]){
      const X=x+side*ux*.67,Z=z+side*uz*.67;
      B.detail.geometry(new THREE.CylinderGeometry(.16,.32,.22,8).translate(X,top-.13,Z),P.dark);
    }
  }
  objects.push({x:centre[0],z:centre[1],radius:0,kind:'KISTI futsal enclosure and twin-head lights',progress:807,photos:[86,87,88],
    perimeter:p.map(q=>[...q]),clearanceM:Math.min(...p.map(([x,z])=>clearance(x,z,C)))-.09,estimated:true});
}
function kistiGate(B,D,C,hAt,surfAt,objects){
  // The two stone markers flank the public entrance going southeast, away
  // from the race turn. Their positions are estimates from 90_left.
  const angle=Math.atan2(.822,.569);
  for(const [x,z]of [[-208.75,728],[-222.5,737.5]]){
    if(!safe(x,z,1.15,D,C,surfAt)||!roadClear(x,z,1.15,D))continue;
    const ground=hAt(x,z),granite=colour(0x838985);
    const slab=(w,h,d,y,color)=>B.detail.geometry(new THREE.BoxGeometry(w,h,d).rotateY(-angle).translate(x,y,z),color);
    slab(1.68,.28,1.17,ground+.07,P.stone);slab(1.55,3.98,1.06,ground+2.12,granite);
    slab(1.59,.12,1.08,ground+4.13,P.stone);
    objects.push({x,z,radius:1.05,kind:'KISTI granite gate marker',progress:836,photos:[89,'90_left'],clearanceM:clearance(x,z,C)-1.05,estimated:true});
  }
}
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
  // The continuous belt of clipped trees and pines is built in campus-streetscape.
  // Small ground cells replace only confirmed parking area in the same strip.
  for(let z=475;z<613;z++)for(let x=-384;x<-300;x++){if(!isCaptureWestParkingOverride(x+.5,z+.5)||surfAt(x+.5,z+.5)!==2||!(D.parking||[]).some(p=>inside(x+.5,z+.5,p.p))||!roadClear(x+.5,z+.5,.71,D))continue;const q=[[x,z],[x+1,z],[x+1,z+1],[x,z+1]];if(q.some(p=>!isCaptureWestParkingOverride(...p)||[3,8,9].includes(surfAt(...p))))continue;B.foliage.quad(...q.map(p=>[p[0],hAt(...p)+.225,p[1]]),colour(0x687954),[0,1,0]);}
  for(let i=935;i<=971;i+=7){const a=pose(C,i,-1,5.3);if(!safe(a.x,a.z,3.4,D,C,surfAt))continue;parkingTree(B,a.x,a.z,8.4,hAt);objects.push({...a,radius:3.4,kind:'parking-edge tree',progress:i,photos:[95,96,97],clearanceM:clearance(a.x,a.z,C)-3.4});}
  kistiBank(B,C,hAt,surfAt,objects);
  kistiCourt(B,D,C,hAt,objects);
  kistiTrees(B,D,C,hAt,surfAt,objects);
  kistiGate(B,D,C,hAt,surfAt,objects);
  // Round planters read clearly in the W16 walking strip; centre lane posts in
  // the photos are omitted because the race uses the full road width.
  for(let i=653;i<=687;i+=7){const a=pose(C,i,-1,1.7);if(clearance(a.x,a.z,C)<1.1||surfAt(a.x,a.z)===8)continue;const y=hAt(a.x,a.z);B.detail.geometry(new THREE.CylinderGeometry(.61,.4,.55,10).translate(a.x,y+.275,a.z),colour(0x746453));ellipsoid(B.foliage,a.x,y+.65,a.z,.53,.24,.53,colour(0x65734a));objects.push({...a,radius:.62,kind:'round planter',progress:i,photos:[79,80],clearanceM:clearance(a.x,a.z,C)-.62});}
}

/** Three architectural batches plus one foliage batch, regardless of count. */
export function buildCaptureWest(scene,D={},C,hAt=()=>0,surfAt=()=>0){
  futsalFootprint=null;
  const result={handledIds:new Set(),labels:[],models:[],metadata:{reference:'audit/capture-review-79-102.json',greenhouseReference:'audit/capture-review-01-19.json',sourceDates:['2025-04','2026-04'],drawCalls:0,models:[],props:[],excluded:['source photograph textures','centreline bollards inside the racing corridor','existing W4-1/W4-2/W4-3/W4-4 buildings','existing W4 tree screen north of z=465'],estimated:true}};
  const B={wall:new Batch(),glass:new Batch(),detail:new Batch(),foliage:new Batch()};
  for(const b of D.buildings||[]){const cfg=CONFIG[b.id]||(westGlasshouses.has(b.id)&&b.p?.length===4?glasshouseProfile:null);if(!cfg||!b.p||b.p.length<3)continue;const p=b.p.filter((a,i)=>i===0||Math.hypot(a[0]-b.p[i-1][0],a[1]-b.p[i-1][1])>.01).map(a=>[...a]);if(Math.hypot(p[0][0]-p.at(-1)[0],p[0][1]-p.at(-1)[1])<.01)p.pop();if(p.length<3||p.some(a=>!a.every(Number.isFinite)))continue;const ys=p.map(a=>hAt(...a));if(!ys.every(Number.isFinite))continue;const base=cfg.style==='kiwoom'?hAt(-342.1,405.6)
      :b.id===78058725?hAt(-320.5,316.7)+.05:Math.min(...ys)-.55;
    const start=Object.fromEntries(Object.entries(B).map(([k,v])=>[k,v.p.length/3]));
    const shape=cfg===glasshouseProfile?glasshouse(B,p,Math.max(...ys),base):architecture(B,b,p,base,cfg,hAt),model={id:b.id,ref:b.ref||'',name:cfg.name,sourceFootprint:p,baseElevationM:base,...shape,capturePhotos:cfg.photos,features:cfg.features,matchConfidence:cfg.confidence||'High building/route match; facade dimensions approximate',geometryRanges:Object.fromEntries(Object.entries(B).map(([k,v])=>[k,[start[k],v.p.length/3]]))};result.models.push(model);result.metadata.models.push(model);result.handledIds.add(b.id);if(cfg!==glasshouseProfile)result.labels.push({ref:b.ref||'',name:cfg.name,en:cfg.name,x:p.reduce((s,a)=>s+a[0],0)/p.length,z:p.reduce((s,a)=>s+a[1],0)/p.length,y:shape.top+4});
  }
  if(C?.n>1100&&D.buildings?.length)roadside(B,D,C,hAt,surfAt,result);
  for(const[kind,b]of Object.entries(B)){if(!b.p.length)continue;const m=b.mesh(kind);scene.add(m);result.metadata.drawCalls++;}
  result.metadata.triangles=Object.values(B).reduce((s,b)=>s+b.p.length/9,0);result.metadata.minimumPropCourseClearanceM=result.metadata.props.length?Math.min(...result.metadata.props.map(p=>p.clearanceM)):null;return result;
}
