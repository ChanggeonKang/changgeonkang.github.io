// April 2025 user-supplied street-view evidence, reconstructed as geometry.
// Positions/dimensions are estimates, not a road survey. No screenshot pixels
// or provider marks are included. See audit/capture-review-{01-19,20-37,38-55}.json.
import * as THREE from '../lib/three.module.min.js';

// Inclusive current course sample ranges (approximately 2 metres/sample).
// Unknown stretches deliberately retain the world's default road treatment.
export const capturedRoadStyles = Object.freeze([
  { from: 1045, to: 1398, center: 'single', edges: 'yellow', photos: [1,2,3,4,5,7,8,9,10,11,12,13,14] },
  { from: 1399, to: 1445, center: 'double', edges: 'white', photos: [15,16] },
  { from: 1446, to: 1510, center: 'none', edges: 'yellow', photos: [17,18,19] },
  { from: 1511, to: 1557, center: 'single', edges: 'none', photos: [20,21,22] },
  { from: 1558, to: 1594, center: 'dashed', edges: 'none', photos: [23] },
  { from: 1595, to: 1620, center: 'single', edges: 'none', photos: [24] },
  { from: 1621, to: 1679, center: 'none', edges: 'yellow', photos: [25,26,27,28,29] },
  { from: 1680, to: 1708, center: 'none', edges: 'white', photos: [30,31] },
  { from: 1709, to: 1744, center: 'dashed', edges: 'white', photos: [32,33] },
  { from: 1745, to: 1757, center: 'none', edges: 'white', photos: [34] },
  { from: 1758, to: 1810, center: 'single', edges: 'white', photos: [35,36] },
  { from: 1811, to: 1846, center: 'dashed', edges: 'white', photos: [37] },
  { from: 1847, to: 1895, center: 'single', edges: 'yellow', photos: [38,39] },
  { from: 1896, to: 1963, center: 'single', edges: 'white', photos: [40,41,42,43] },
  { from: 1964, to: 1978, center: 'none', edges: 'white', photos: [44] },
  { from: 1979, to: 2181, center: 'double', edges: 'white', photos: [45,46,47,48,49,50,51,52,53,54] },
]);

export const capturedSpeedMarks = Object.freeze([
  { progress: 1407, photos: [14,15] }, { progress: 1523, photos: [20] },
  { progress: 1610, photos: [24] }, { progress: 1711, photos: [32] },
  { progress: 1857, photos: [38] }, { progress: 1923, photos: [41] },
  { progress: 1987, photos: [45] },
]);

export const capturedBumps = Object.freeze([
  { progress: 1563, progressRange: [1553,1573], photoNumbers: [22], confidence: 'approximate',
    evidence: 'Photo22 camera near1551; hump roughly24m ahead. Camera and forward-distance estimates, not panorama GPS.' },
  { progress: 1760, progressRange: [1752,1768], photoNumbers: [34], confidence: 'approximate',
    evidence: 'Photo34 camera near1752; hump roughly16m ahead on eastbound street.' },
  { progress: 1817, progressRange: [1809,1825], photoNumbers: [36,37], confidence: 'approximate',
    evidence: 'Same hump seen ahead in36 and at foreground edge in37. Merged rather than two humps.' },
].map(b => Object.freeze({ ...b, heightM: .10, lengthM: 3.6,
  dimensionStatus: 'Existing conventional game assumptions; not measured from photographs.' })));

const UP = new THREE.Vector3(0, 1, 0), FORWARD = new THREE.Vector3(0, 0, 1);
const unitBox = new THREE.BoxGeometry(1, 1, 1).toNonIndexed();
const unitCylinder = new THREE.CylinderGeometry(.5, .5, 1, 5).toNonIndexed();
const mirrorCylinder = new THREE.CylinderGeometry(.5, .5, 1, 20).toNonIndexed();
const wheelGeometry = new THREE.TorusGeometry(.31, .036, 4, 14).toNonIndexed();
const rimGeometry = new THREE.TorusGeometry(.29, .014, 3, 14).toNonIndexed();
const bowlGeometry = new THREE.CylinderGeometry(.72, .43, .54, 12).toNonIndexed();

class Batch {
  constructor() { this.p = []; this.n = []; this.c = []; }
  add(geometry, position, quaternion, scale, color) {
    const matrix = new THREE.Matrix4().compose(position, quaternion, scale), normal = new THREE.Matrix3().getNormalMatrix(matrix);
    const p = geometry.attributes.position, n = geometry.attributes.normal, v = new THREE.Vector3(), q = new THREE.Vector3(), c = new THREE.Color(color);
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(matrix); q.fromBufferAttribute(n, i).applyMatrix3(normal).normalize();
      this.p.push(v.x, v.y, v.z); this.n.push(q.x, q.y, q.z); this.c.push(c.r, c.g, c.b);
    }
  }
  quad(a, b, c, d, color) {
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize(), rgb = new THREE.Color(color);
    for (const v of [a,b,c,a,c,d]) { this.p.push(v.x,v.y,v.z); this.n.push(n.x,n.y,n.z); this.c.push(rgb.r,rgb.g,rgb.b); }
  }
  finish(name, material) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(this.p,3)); g.setAttribute('normal',new THREE.Float32BufferAttribute(this.n,3));
    g.setAttribute('color',new THREE.Float32BufferAttribute(this.c,3)); g.computeBoundingBox(); g.computeBoundingSphere();
    const m = new THREE.Mesh(g,material); m.name=name; m.castShadow=true; m.receiveShadow=true; return m;
  }
}

// Course sample ranges are half-open. A missing side keeps the ordinary race rail.
// Left/right follow the driver. Walls and fences behind a sidewalk stay in scenery.
export const campusBoundaryRanges = [
  { from: 0, to: 74, left: 'curb', right: 'curb', photos: [55,56,57] },
  { from: 96, to: 149, left: 'curb', right: 'curb', photos: [58,59] },
  { from: 457, to: 481, left: 'curb', right: 'curb', photos: [71,72] },
  { from: 972, to: 1108, left: 'curb', right: 'curb', photos: [97,98,99,100,101,1,2] },
  { from: 1327, to: 1393, left: 'curb', photos: [10,11,12,13,14] },
  { from: 1450, to: 1506, left: 'picket', right: 'curb', photos: [17,18,19] },
  { from: 1622, to: 1642, left: 'curb', right: 'curb', photos: [25,26] },
  { from: 2140, to: 2180, left: 'medallion', right: 'medallion', photos: [53,54] },
  { from: 2180, to: 2193, left: 'curb', right: 'curb', photos: [54,55] },
];

// Model one two-metre panel of each design; the renderer instances it along
// the actual collision faces, including the longitudinal slope at each end.
export function buildCampusBoundaryRail(parent, style, segments, groundY) {
  if (!segments.length) return;
  const batch = new Batch(), metal = style === 'picket' ? 0x282c2a : 0x473f3b;
  const rod = (x0,y0,x1,y1,r) => {
    const start = new THREE.Vector3(x0,y0,0), end = new THREE.Vector3(x1,y1,0);
    const direction = end.clone().sub(start), length = direction.length();
    batch.add(unitCylinder, start.lerp(end,.5), new THREE.Quaternion().setFromUnitVectors(UP,direction.divideScalar(length)),
      new THREE.Vector3(2*r,length,2*r), metal);
  };
  if (style === 'picket') {
    for (const y of [.24,1.12]) rod(0,y,2,y,.029);
    for (let k=0;k<10;k++) {
      const x=.045+k*.2, post=k===0, top=post?1.47:1.32, radius=post?.044:.018;
      rod(x,.11,x,top,radius);
      batch.add(unitBox,new THREE.Vector3(x,1.06,0),new THREE.Quaternion(),
        new THREE.Vector3(radius*2.4,.055,radius*2.4),post?0xa29264:metal);
    }
  } else {
    // The November N3 side view shows paired end posts, two scalloped rails,
    // and three pale medallions with small curved links in each panel.
    for (const x of [.044,1.956]) rod(x,.11,x,1.035,.038);
    for (const y of [.24,.91]) {
      let last=y;
      for (let k=1;k<=10;k++) {
        const next=y+.14*Math.sin(Math.PI*k/10)**2;
        rod((k-1)*.2,last,k*.2,next,.028);
        last=next;
      }
    }
    for (const y of [.395,.82]) rod(.04,y,1.96,y,.018);
    const axisToFront = new THREE.Quaternion().setFromUnitVectors(UP,FORWARD);
    for (const x of [.29,1,1.71]) {
      const center=new THREE.Vector3(x,.605,0);
      batch.add(mirrorCylinder,center,axisToFront,new THREE.Vector3(.335,.025,.335),0xc4c5bb);
      batch.add(rimGeometry,center,new THREE.Quaternion(),new THREE.Vector3(.61,.61,.9),metal);
    }
    for (const x of [.645,1.355]) for (const sign of [-1,1]) {
      rod(x,.805,x+sign*.046,.688,.012);
      rod(x+sign*.046,.688,x+sign*.122,.605,.012);
      rod(x+sign*.122,.605,x+sign*.046,.522,.012);
      rod(x+sign*.046,.522,x,.405,.012);
    }
  }
  const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.75,metalness:.24});
  const template=batch.finish(style,material);
  const mesh=new THREE.InstancedMesh(template.geometry,material,segments.length);
  mesh.name='Campus boundary: '+style;
  mesh.castShadow=mesh.receiveShadow=true;
  const matrix=new THREE.Matrix4();
  segments.forEach(({a,b,nx,nz,length},i)=>{
    const ax=b[0]-a[0], az=b[1]-a[1], ay=groundY(a[0],a[1]), by=groundY(b[0],b[1]);
    // The forward side of the thickest post sits on the closed inner face.
    // Local X spans [0,2], Y stays vertical, and Z is normal to the panel.
    matrix.set(ax/2,0,-az/length,a[0]-nx*.045,
      (by-ay)/2,1,0,ay,
      az/2,0,ax/length,a[1]-nz*.045,
      0,0,0,1);
    mesh.setMatrixAt(i,matrix);
  });
  mesh.instanceMatrix.needsUpdate=true;
  mesh.computeBoundingSphere();
  parent.add(mesh);
}

/** Visual-only props. The course, terrain, surface grid and collision solver are not mutated. */
export function buildCapturedRoadside(scene, D, C, hAt, surfAt) {
  const solid = new Batch(), translucent = new Batch(), reflective = new Batch();
  const metadata = { source:'User-supplied April2025 captures1–55; see capture review JSON files',
    measured:false, positionUncertaintyM:25, models:[], rejected:[],
    adaptation:'Estimated roadside positions use existing course offsets. Portico width/height conservatively preserve game clearance.',
    minimumGroundPropCorridorMarginM:Infinity, overheadClearanceM:null };
  const idq = new THREE.Quaternion(), scale = (x,y,z) => new THREE.Vector3(x,y,z);
  // Props may stand on generic paths or the higher race-side walk. Posts extend
  // into the ground; avoid floating them by conservatively using path lift here.
  const ground = (x,z) => { const s=surfAt(x,z);return hAt(x,z)+(s===1?.13:s===2?.21:s===3?.31:.03); };
  const box = (b,x,y,z,w,h,d,color,angle=0) => b.add(unitBox,new THREE.Vector3(x,y,z),new THREE.Quaternion().setFromAxisAngle(UP,angle),scale(w,h,d),color);
  const rod = (b,a,c,r,color) => { const d=new THREE.Vector3().subVectors(c,a), len=d.length(); if(len<1e-6)return;
    b.add(unitCylinder,new THREE.Vector3().addVectors(a,c).multiplyScalar(.5),new THREE.Quaternion().setFromUnitVectors(UP,d.divideScalar(len)),scale(2*r,len,2*r),color); };
  const frame = (progress,side=0,extra=0) => { const i=Math.max(0,Math.min(C.n-1,Math.round(progress))), off=side*(C.halfWidth[i]+extra);
    return {i,x:C.x[i]+C.tz[i]*off,z:C.z[i]-C.tx[i]*off,tx:C.tx[i],tz:C.tz[i],nx:C.tz[i],nz:-C.tx[i],angle:Math.atan2(C.tx[i],C.tz[i])}; };
  const point = (f,along,lateral,y) => new THREE.Vector3(f.x+f.tx*along+f.nx*lateral,y,f.z+f.tz*along+f.nz*lateral);
  // Full-course closest-segment distance, used at asset footprint samples only.
  // This prevents props on an inner corner from overlapping an adjacent segment.
  const margin = (x,z) => { let best=Infinity;
    for(let i=0;i<C.n;i++){const j=(i+1)%C.n,dx=C.x[j]-C.x[i],dz=C.z[j]-C.z[i],l=dx*dx+dz*dz;
      const t=l?Math.max(0,Math.min(1,((x-C.x[i])*dx+(z-C.z[i])*dz)/l)):0;
      const d=Math.hypot(x-C.x[i]-dx*t,z-C.z[i]-dz*t)-(C.halfWidth[i]+(C.halfWidth[j]-C.halfWidth[i])*t); if(d<best)best=d; }
    return best; };
  const register = (id,kind,photos,f,length,depth,extra={}) => {
    let min=Infinity; for(const a of [-length/2,0,length/2])for(const d of [-depth/2,0,depth/2]){const p=point(f,a,d,0); min=Math.min(min,margin(p.x,p.z));}
    if(min<.30){metadata.rejected.push({id,kind,reason:'course clearance',marginM:min});return false;}
    metadata.minimumGroundPropCorridorMarginM=Math.min(metadata.minimumGroundPropCorridorMarginM,min);
    metadata.models.push({id,kind,photos,progress:f.i,x:f.x,z:f.z,estimated:true,lengthM:length,depthM:depth,minimumCorridorMarginM:min,...extra}); return true;
  };

  // The left bank on the W11 bend carries two boards facing the two approaches.
  // Orient each face to its approaching driver so the arrows read correctly.
  function bendBoard(progress, approach, direction) {
    const f = frame(progress,1,2.9), facing = -direction;
    if (!register('w11-bend-board-'+progress,'curve-chevron-board',[9,10],f,2.8,2.8)) return;
    const nx = C.tx[approach]*facing, nz = C.tz[approach]*facing;
    const angle = Math.atan2(nx,nz), y = ground(f.x,f.z);
    const at = (across,height,depth) => new THREE.Vector3(f.x+nz*across+nx*depth,y+height,f.z-nx*across+nz*depth);
    for (const across of [-.79,.79]) rod(solid,at(across,0,0),at(across,2.15,0),.055,0x778078);
    box(solid,f.x,y+1.65,f.z,2.36,1.23,.085,0x727876,angle);
    function face(left,right,bottom,top,color,depth) {
      solid.quad(at(left,bottom,depth),at(right,bottom,depth),at(right,top,depth),at(left,top,depth),color);
    }
    face(-1.15,1.15,1.31,2.23,0xe8b31c,.047);
    face(-1.15,1.15,1.06,1.30,direction>0 ? 0x9e4039 : 0x3a607c,.047);
    for (const mid of [-.74,0,.74]) {
      for (const [top,bottom,dTop,dBottom] of [[2.23,1.77,-.31,0],[1.77,1.31,0,-.31]]) {
        const a = mid+dTop*direction, b = mid+dBottom*direction;
        solid.quad(at(b-.14,bottom,.052),at(b+.14,bottom,.052),at(a+.14,top,.052),at(a-.14,top,.052),0x232729);
      }
    }
  }
  bendBoard(1318,1331,-1);
  bendBoard(1323,1311,1);

  function wall(from,to,side,extra,height,depth,kind,photos,color) {
    for(let i=from;i<=to;i+=2){const f=frame(i,side,extra),length=3.85;
      if(!register(`${kind}-${i}`,kind,photos,f,length,depth))continue;
      const y=ground(f.x,f.z),angle=f.angle; box(solid,f.x,y+height/2-.12,f.z,depth,height+.24,length,color,angle);
      box(solid,f.x,y+height+.025,f.z,depth+.08,.10,length+.02,kind.includes('brick')?0xa5887b:0xa3a49a,angle);
      // Masonry courses and staggered joint accents remain geometry, not photo textures.
      for(let row=1;row<height/.23;row++){const yy=y+row*.23;
        box(solid,f.x,yy,f.z,depth+.012,.012,length,kind.includes('brick')?0x635854:0x737a73,angle);
        for(let a=-1.5+(row%2)*.43;a<1.7;a+=.86){const p=point(f,a,0,yy+.105);box(solid,p.x,p.y,p.z,depth+.016,.20,.012,0x77746a,angle);}
      }
    }
  }
  wall(1327,1371,1,3.05,1.25,.55,'w11-stone-terrace-lower',[10,11,12],0x969789);
  wall(1335,1367,1,7.0,1.0,.55,'w11-stone-terrace-upper',[10,11,12],0x8e9289);
  wall(1374,1392,1,3.0,.48,.55,'w10-low-stone-edge',[13,14],0xaca894);
  for(const [a,b]of[[1518,1532],[1538,1550],[1558,1578],[1586,1608]])wall(a,b,1,8.0,1.0,.42,'dorm-brick-retaining',[20,21,22,23,24],0x8b5546);

  // W11 terrace stairs are approximate landscape detail beyond the sidewalk.
  { const f=frame(1359,1,5.1); if(register('w11-terrace-stairs','terrace-stairs',[12],f,2.8,4.6)){
    const near=point(f,0,-2.3,0), y=ground(near.x,near.z); for(let j=0;j<9;j++){
      const p=point(f,0,-2.1+j*.48,0);box(solid,p.x,y+.09+j*.16,p.z,.50,.18,2.8,0x9b9b91,f.angle); }
    for(const a of[-1.5,1.5]){const lo=point(f,a,-2.2,y+.9),hi=point(f,a,2.0,y+2.3);rod(solid,lo,hi,.035,0x525d5b);}
  }}

  function bicycle(f,along,lateral,y,seed){
    const paint=[0x557579,0x795a4d,0x6c7273,0x9b845b][seed%4],q=new THREE.Quaternion().setFromUnitVectors(FORWARD,new THREE.Vector3(f.tx,0,f.tz));
    // The bicycle plane faces across the shelter, leaving the circulation side open.
    const p=(a,h)=>point(f,along,lateral+a,y+h), wheelCenters=[p(-.51,.34),p(.51,.34)];
    for(const c of wheelCenters){solid.add(wheelGeometry,c,q,scale(1,1,1),0x323b39);solid.add(rimGeometry,c,q,scale(1,1,1),0xa6b0a7);
      for(let j=0;j<3;j++){const t=j*Math.PI/3,dx=Math.cos(t)*.27,dy=Math.sin(t)*.27;rod(solid,new THREE.Vector3(c.x+f.nx*dx,c.y+dy,c.z+f.nz*dx),new THREE.Vector3(c.x-f.nx*dx,c.y-dy,c.z-f.nz*dx),.007,0x8a9891);}}
    for(const[a,b]of[[[-.51,.34],[-.13,.81]],[[-.13,.81],[.14,.36]],[[.14,.36],[-.51,.34]],[[.14,.36],[.44,.87]],[[.44,.87],[-.13,.81]],[[.51,.34],[.44,1.02]]])rod(solid,p(...a),p(...b),.022,paint);
    rod(solid,p(-.13,.65),p(-.13,.99),.018,0x73817a);const seat=p(-.13,1.0);box(solid,seat.x,seat.y,seat.z,.26,.06,.16,0x3a403e,f.angle);
    const handle=p(.44,1.03);rod(solid,new THREE.Vector3(handle.x-f.tx*.18,handle.y,handle.z-f.tz*.18),new THREE.Vector3(handle.x+f.tx*.18,handle.y,handle.z+f.tz*.18),.018,0x53645d);
  }
  function canopy(from,to,side,extra,photos){
    for(let i=from;i<=to;i+=3){const f=frame(i,side,extra),length=5.8,depth=2.8;
      if(!register(`bike-shelter-${i}`,'translucent-bicycle-canopy',photos,f,length,depth))continue;
      // Avoid putting shelter bays inside existing building footprints.
      if([-2.8,0,2.8].some(a=>[-1.4,1.4].some(d=>{const p=point(f,a,d,0);return surfAt(p.x,p.z)===9;}))){metadata.models.pop();metadata.rejected.push({id:`bike-shelter-${i}`,reason:'building footprint'});continue;}
      const y=ground(f.x,f.z), low=point(f,-length/2,0,0),high=point(f,length/2,0,0);
      const lowY=ground(low.x,low.z),highY=ground(high.x,high.z);
      const roof=(a,d)=>lowY+(highY-lowY)*(a/length+.5)+2.38+.26*Math.cos(d/1.4*Math.PI/2);
      for(const a of[-length/2,length/2])for(const d of[-1.25,1.25]){const p=point(f,a,d,0);
        rod(solid,point(f,a,d,ground(p.x,p.z)),point(f,a,d,roof(a,d)),.035,0x75847f);}
      for(let k=0;k<8;k++){const d0=-1.4+k*.35,d1=d0+.35;
        translucent.quad(point(f,-length/2,d0,roof(-length/2,d0)),point(f,length/2,d0,roof(length/2,d0)),point(f,length/2,d1,roof(length/2,d1)),point(f,-length/2,d1,roof(-length/2,d1)),0xd0cbb3);
        for(const a of[-length/2,length/2])rod(solid,point(f,a,d0,roof(a,d0)+.01),point(f,a,d1,roof(a,d1)+.01),.022,0x8d9992);
      }
      for(const d of[-1.38,1.38])rod(solid,point(f,-length/2,d,roof(-length/2,d)),point(f,length/2,d,roof(length/2,d)),.03,0x78867d);
      for(const a of[-1.75,-.1,1.6]){const p=point(f,a,.1,0);bicycle(f,a,.1,ground(p.x,p.z)+.03,i+Math.round(a*10)+20);}
      for(const a of[-2.1,-.9,.3,1.5,2.4]){const p=point(f,a,.65,y+.35);box(solid,p.x,p.y,p.z,.035,.7,.7,0x82908a,f.angle);}
    }
  }
  canopy(1530,1611,-1,3.1,[21,22,23,24]);
  canopy(1659,1674,1,2.9,[27,28,29]);
  canopy(1696,1702,-1,3.4,[30,31]);

  // Looking back from the north exit in November, the covered flight rises
  // on the viewer's right (driver's left), beyond the cross-road brick piers.
  {const f=frame(1633), pierOff=C.halfWidth[f.i]+1.2, depth=4.3;
    let deck=-Infinity; for(const a of[-depth/2,0,depth/2])for(const d of[-pierOff,0,pierOff]){const p=point(f,a,d,0);deck=Math.max(deck,hAt(p.x,p.z)+.45);}
    const soffit=deck+4.65; let accepted=true;
    for(const s of[-1,1]){const p=point(f,0,s*pierOff,0),ff={...f,x:p.x,z:p.z};if(!register(`n14-passage-pier-${s}`,'brick-portico-pier',[25,26],ff,depth,.82))accepted=false;}
    if(accepted){for(const s of[-1,1])for(const a of[-1.75,1.75]){const p=point(f,a,s*pierOff,0),y=ground(p.x,p.z),h=soffit-y;
      box(solid,p.x,y+h/2,p.z,.82,h,.82,0x8a5446,f.angle);box(solid,p.x,y+.16,p.z,1.02,.32,1.02,0xb4b3a6,f.angle);
      for(let yy=y+.35;yy<soffit;yy+=.23)box(solid,p.x,yy,p.z,.83,.012,.83,0x766d5f,f.angle);
    }
    function tiledSpan(near,far,underside,halfDepth,rise) {
      const mid=(near+far)/2, p=point(f,0,mid,underside+.19);
      box(solid,p.x,p.y,p.z,far-near,.38,2*halfDepth,0xd4cdbb,f.angle);
      const eave=underside+.39, edge=halfDepth+.13;
      for (const [a0,y0,a1,y1] of [[-edge,eave,0,eave+rise],[0,eave+rise,edge,eave]]) {
        solid.quad(point(f,a0,near,y0),point(f,a1,near,y1),point(f,a1,far,y1),point(f,a0,far,y0),0x7b4e41);
        for (let d=near+.09;d<far-.04;d+=.24) {
          rod(solid,point(f,a0,d,y0+.025),point(f,a1,d,y1+.025),.067,0x96574a);
        }
      }
      rod(solid,point(f,0,near,eave+rise+.04),point(f,0,far,eave+rise+.04),.09,0x754639);
    }
    const mainEdge=pierOff+.84;
    tiledSpan(-mainEdge,mainEdge,soffit,depth/2,.42);
    const stairStart=mainEdge+.08, stairEnd=stairStart+6.38;
    const mid=point(f,0,(stairStart+stairEnd)/2,0);
    const wing={...f,x:mid.x,z:mid.z};
    if (register('n14-west-covered-stair','covered-stair',[25,26],wing,depth+.3,stairEnd-stairStart,
        {side:'driver-left',sourceView:'2026-11 north exit facing south',roofStepM:.94})) {
      const lower=point(f,0,stairStart,0), floor=ground(lower.x,lower.z), step=.38, rise=.155, steps=11;
      for (let k=0;k<steps;k++) {
        const d=stairStart+(k+.5)*step, p=point(f,0,d,0), base=ground(p.x,p.z)-.1;
        const top=floor+(k+1)*rise;
        box(solid,p.x,(base+top)/2,p.z,step,top-base,2.25,0x92594b,f.angle);
      }
      const landingStart=stairStart+steps*step, landing=point(f,0,(landingStart+stairEnd)/2,0);
      const landingTop=floor+steps*rise;
      box(solid,landing.x,landingTop-.10,landing.z,stairEnd-landingStart,.2,2.25,0xa29682,f.angle);
      for (const d of [stairStart+.45,stairEnd-.48]) for (const a of [-1.48,1.48]) {
        const p=point(f,a,d,0), bottom=ground(p.x,p.z), top=soffit+.94;
        box(solid,p.x,(bottom+top)/2,p.z,.57,top-bottom,.57,0x875447,f.angle);
      }
      tiledSpan(mainEdge-.37,stairEnd,soffit+.94,depth/2-.22,.32);
    }
    metadata.overheadClearanceM=4.65;metadata.models.push({id:'n14-n11-covered-passage',kind:'overhead-portico',photos:[25,26],progress:1633,x:f.x,z:f.z,
      minimumOverheadClearanceM:4.65,clearOpeningWidthM:2*pierOff-.82,estimated:true,adaptation:'Opening widened to existing course plus pier margin; upper beam raised to conservative 4.65m clearance. Photo apparent 6–8m width/3.5–4.5m height not surveyed.'});
    }
  }

  function bollard(progress,side,extra,photos){const f=frame(progress,side,extra);if(!register(`flex-post-${progress}-${side}`,'orange-flexible-post',photos,f,.22,.22))return;
    const y=ground(f.x,f.z);box(solid,f.x,y+.035,f.z,.23,.07,.23,0x363f3a);rod(solid,new THREE.Vector3(f.x,y,f.z),new THREE.Vector3(f.x,y+.84,f.z),.055,0xc96830);
    for(const h of[.51,.68])rod(solid,new THREE.Vector3(f.x,y+h,f.z),new THREE.Vector3(f.x,y+h+.075,f.z),.058,0xdedac5);
  }
  for(let i=1626;i<1641;i+=3)bollard(i,1,.85,[25,26]);
  for(let i=1650;i<1664;i+=3)bollard(i,-1,1.05,[27,28]);
  for(let i=1848;i<1870;i+=6)bollard(i,-1,1.05,[38]);

  function mirror(progress,side,extra,photos){const f=frame(progress,side,extra);if(!register(`convex-mirror-${progress}`,'orange-rim-convex-mirror',photos,f,1.1,1.1))return;
    const y=ground(f.x,f.z),center=new THREE.Vector3(f.x,y+2.45,f.z),face=new THREE.Vector3(-f.tx*.7-f.nx*side,0,-f.tz*.7-f.nz*side).normalize();
    rod(solid,new THREE.Vector3(f.x,y,f.z),center,.038,0xb95831);
    const q=new THREE.Quaternion().setFromUnitVectors(UP,face);solid.add(mirrorCylinder,center,q,scale(.92,.095,.92),0xcf6b35);
    reflective.add(mirrorCylinder,center.clone().addScaledVector(face,.055),q,scale(.78,.035,.78),0xa5bac1);
  }
  for(const [p,s,e,photos]of[[1327,1,2.2,[10]],[1507,-1,2.0,[19]],[1652,-1,1.9,[27]],[1740,-1,2.4,[33]],[1750,1,2.2,[34]],[1858,-1,2.0,[38]]])mirror(p,s,e,photos);

  // N9/N5 small service shelter. The later distant tiled link in photo39 has
  // uncertain support positions and is deliberately not invented here.
  {const f=frame(1819,-1,4.9),length=5.2,depth=3.2;if(register('n9-east-service-shelter','brown-sloped-shelter',[37],f,length,depth)){
    const y=ground(f.x,f.z),height=d=>y+2.6+d*.12;
    for(const a of[-2.45,2.45])for(const d of[-1.4,1.4])rod(solid,point(f,a,d,y),point(f,a,d,height(d)),.048,0x7e8981);
    for(let i=0;i<13;i++){const a=-length/2+i*.4;
      solid.quad(point(f,a,-1.6,height(-1.6)),point(f,a+.38,-1.6,height(-1.6)),point(f,a+.38,1.6,height(1.6)),point(f,a,1.6,height(1.6)),i%2?0x665343:0x7c6552);}
    const p=point(f,-2.45,-1.4,0);for(let k=0;k<5;k++)box(solid,p.x,y+.3+k*.15,p.z,.11,.12,.11,k%2?0xd3ba4f:0x3c433b,f.angle);
  }}
  for(let i=2111;i<=2123;i+=3){const f=frame(i,-1,3.6);if(!register(`n3-planter-${i}`,'bowl-planter',[51,52],f,1.5,1.5))continue;
    const y=ground(f.x,f.z);solid.add(bowlGeometry,new THREE.Vector3(f.x,y+.27,f.z),idq,scale(1,1,1),0x929c94);
    solid.add(unitCylinder,new THREE.Vector3(f.x,y+.54,f.z),idq,scale(1.21,.035,1.21),0x514c3e);
  }
  {const f=frame(2099,-1,3.6);if(register('east-auditorium-bench','timber-bench',[50],f,1.8,.75)){
    const y=ground(f.x,f.z);for(const a of[-.65,.65])for(const d of[-.23,.23])rod(solid,point(f,a,d,y),point(f,a,d,y+.46),.026,0x4d5a50);
    for(const d of[-.23,-.08,.08,.23]){const p=point(f,0,d,y+.47);box(solid,p.x,p.y,p.z,.12,.055,1.8,0x8d6b49,f.angle);}
    for(const yy of[.70,.86]){const p=point(f,0,.31,y+yy);box(solid,p.x,p.y,p.z,.06,.12,1.8,0x8d6b49,f.angle);}
  }}

  const group=new THREE.Group();group.name='captured-campus-roadside';
  group.add(solid.finish('captured-roadside-solids',new THREE.MeshStandardMaterial({vertexColors:true,roughness:.78,metalness:.10})));
  const roof=translucent.finish('captured-translucent-bike-roofs',new THREE.MeshStandardMaterial({vertexColors:true,transparent:true,opacity:.62,roughness:.5,metalness:.06,side:THREE.DoubleSide,depthWrite:false}));roof.castShadow=false;group.add(roof);
  group.add(reflective.finish('captured-traffic-mirror-faces',new THREE.MeshStandardMaterial({vertexColors:true,roughness:.22,metalness:.75})));
  metadata.triangles=group.children.reduce((n,m)=>n+m.geometry.attributes.position.count/3,0);metadata.drawCalls=group.children.length;
  group.userData=metadata;scene.add(group);return {models:[group],metadata};
}
