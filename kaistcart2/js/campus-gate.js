// KAIST main-gate sculpture, separate from the E1 security-booth footprint.
// Official height/material: https://kaist.ac.kr/kr/html/kaist/01.html (10.7 m, granite).
// Positions, widths, openings and panel layout are photo/map estimates, not surveys.
// See audit/main-gate-placement.json for entrance-node evidence and ±10 m position uncertainty.
import * as THREE from '../lib/three.module.min.js';

export const GATE_LAYOUT = Object.freeze({
  pylons: Object.freeze([Object.freeze({ x: 146.6, z: 471.5 }), Object.freeze({ x: 173.8, z: 454.9 })]),
  heightM: 10.7, widthM: 3.4, depthM: 1.3, positionUncertaintyM: 10,
});

class BoxBatch {
  constructor(axis, outward) { this.axis = axis; this.outward = outward; this.positions = []; this.normals = []; this.colors = []; }
  box(origin, x, y, z, width, height, depth, color, a = this.axis, o = this.outward) {
    const geometry = new THREE.BoxGeometry(width, height, depth).toNonIndexed();
    const p = geometry.attributes.position, n = geometry.attributes.normal, c = new THREE.Color(color);
    for (let i = 0; i < p.count; i++) {
      const lx = p.getX(i) + x, lz = p.getZ(i) + z;
      this.positions.push(origin.x + a.x * lx + o.x * lz, origin.y + p.getY(i) + y, origin.z + a.z * lx + o.z * lz);
      this.normals.push(a.x * n.getX(i) + o.x * n.getZ(i), n.getY(i), a.z * n.getX(i) + o.z * n.getZ(i));
      this.colors.push(c.r, c.g, c.b);
    }
    geometry.dispose();
  }
  mesh(name, material) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, material); mesh.name = name; mesh.castShadow = true; mesh.receiveShadow = true;
    return mesh;
  }
}

function namePlate(group, center, axis, outward) {
  // Node geometry checks deliberately skip Canvas; no third-party logo/image is embedded.
  if (typeof document === 'undefined') return;
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 256;
  const context = canvas.getContext('2d'); if (!context) return;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#154b84'; context.textAlign = 'center'; context.textBaseline = 'middle';
  context.font = 'bold 104px Arial, sans-serif'; context.fillText('KAIST', 512, 83);
  context.font = '28px Arial, sans-serif'; context.fillText('Korea Advanced Institute of Science and Technology', 512, 151, 920);
  context.fillStyle = '#39729b'; context.fillRect(67, 181, 870, 6);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(4.65, 1.16), new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
  plate.position.set(center.x + outward.x * .406, center.y + 1.06, center.z + outward.z * .406);
  plate.rotation.y = Math.atan2(outward.x, outward.z); plate.name = 'main-gate-nameplate'; group.add(plate);
}

// Photos 76 and 77_left show opposite faces of the blue directory beside E1.
// November panorama TkwKKdtgBD8_wFTwOTASBg confirms the paved apron and
// curved low flower border on the corner between the board and guard booth.
// Its campus plan is drawn from the game's map rather than from photo pixels.
function campusDirectory(group, batch, D, hAt) {
  const center = { x:157.1, z:419.7, y:hAt(157.1,419.7) };
  const normal = { x:-.981, z:-.194 }, axis = { x:normal.z, z:-normal.x };
  const width = 3.86, height = 2.27, depth = .27, base = .25;
  const box = (x,y,z,w,h,d,color) => batch.box(center,x,y,z,w,h,d,color,axis,normal);
  const apronDepth=2.25;
  box(0,.04,.93,width+.62,.14,apronDepth,0xa5aba9);
  for(let x=-1.8;x<2.1;x+=.6)box(x,.114,.93,.017,.01,apronDepth,0x929a98);
  box(0,base*.5,0,width+.3,base,.65,0xb4b8ae);
  box(0,base+height*.5,0,width,height,depth,0x214978);
  box(0,base+height-.065,0,width+.07,.13,depth+.04,0x294f79);
  // Recessed panel joints also read from the blue back on the driving approach.
  for (const x of [-.64,.64]) box(x,base+height*.5,-depth*.5-.01,.024,height-.14,.014,0x1d4069);
  const border=[[152.8,424],[152.7,423.2],[153.2,422.5],[154,421.8],[155.3,420.9]];
  const placements=[];
  for(let i=1;i<border.length;i++){
    const [x0,z0]=border[i-1],[x1,z1]=border[i],length=Math.hypot(x1-x0,z1-z0);
    const a={x:(x1-x0)/length,z:(z1-z0)/length},n={x:-a.z,z:a.x};
    const x=(x0+x1)/2,z=(z0+z1)/2,origin={x,z,y:hAt(x,z)};
    batch.box(origin,0,.11,0,length+.06,.22,.68,0x999e99,a,n);
    batch.box(origin,0,.223,0,length+.01,.04,.53,0x655648,a,n);
    const count=Math.ceil(length/.29);
    for(let j=0;j<count;j++)for(const side of [-1,1]){
      const t=(j+.5)/count,px=x0+t*(x1-x0)+n.x*.125*side,pz=z0+t*(z1-z0)+n.z*.125*side;
      const py=hAt(px,pz)+.28,shade=[0xe6bd4f,0xe9c764,0xb97b9a,0xe4a45a][(i+j+side+1)%4];
      placements.push([px,py,pz,.2,.10,.16,0x5a7045],[px,py+.072,pz,.145,.095,.128,shade]);
    }
  }
  const flowers=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),new THREE.MeshStandardMaterial({roughness:1}),placements.length);
  const matrix=new THREE.Matrix4(),color=new THREE.Color();
  placements.forEach(([x,y,z,w,h,d,tint],i)=>{matrix.makeScale(w,h,d).setPosition(x,y,z);flowers.setMatrixAt(i,matrix);flowers.setColorAt(i,color.setHex(tint));});
  flowers.name='main-gate-directory-flowerbed';flowers.instanceMatrix.needsUpdate=true;flowers.instanceColor.needsUpdate=true;flowers.computeBoundingSphere();flowers.receiveShadow=true;group.add(flowers);
  if (!D?.bounds || typeof document==='undefined') return center;
  const canvas = document.createElement('canvas'); canvas.width=512; canvas.height=288;
  const g=canvas.getContext('2d'); if(!g)return center;
  g.fillStyle='#1d487a'; g.fillRect(0,0,512,288);
  g.fillStyle='#f0f2ef'; g.fillRect(6,30,370,248); g.fillRect(386,30,100,226);
  g.font='bold 16px Arial'; g.fillStyle='#fff'; g.fillText('KAIST Campus Information',15,20);
  const {x0,x1,z0,z1}=D.bounds, scale=Math.min(342/(x1-x0),210/(z1-z0));
  const px=x=>192+(x-(x0+x1)/2)*scale, pz=z=>140+(z-(z0+z1)/2)*scale;
  const path=p=>{g.beginPath();p.forEach(([x,z],i)=>{if(i===0)g.moveTo(px(x),pz(z));else g.lineTo(px(x),pz(z));});};
  g.save(); g.beginPath(); g.rect(9,33,363,222); g.clip();
  for(const area of D.areas || []){path(area.p);g.fillStyle=area.k==='water'?'#99c1c8':'#c9d8b7';g.fill();}
  g.strokeStyle='#a5acaa'; g.lineWidth=.75;
  for(const road of D.roads || [])if(road.width>=4){path(road.p);g.stroke();}
  g.fillStyle='#b79e8c';
  for(const b of D.buildings || []){path(b.p);g.fill();}
  g.restore();
  g.fillStyle='#235586'; g.font='bold 12px Arial'; g.fillText('KAIST',169,272);g.font='bold 9px Arial';g.fillText('BUILDING INDEX',392,45);
  const labels=(D.buildings || []).filter(b=>b.ref && b.en).sort((a,b)=>a.ref.localeCompare(b.ref,'en',{numeric:true})).slice(0,21);
  g.fillStyle='#495e62';g.font='7px Arial';
  labels.forEach((b,i)=>g.fillText(b.ref+'  '+b.en,392,58+i*9,85));
  const texture=new THREE.CanvasTexture(canvas); texture.colorSpace=THREE.SRGBColorSpace;
  const face=new THREE.Mesh(new THREE.PlaneGeometry(width-.09,height-.08),new THREE.MeshStandardMaterial({map:texture,roughness:.85}));
  face.name='main-gate-campus-directory';face.position.set(center.x+normal.x*(depth/2+.012),center.y+base+height/2,center.z+normal.z*(depth/2+.012));
  face.rotation.y=Math.atan2(normal.x,normal.z); group.add(face);
  return center;
}

/** Add a reference-informed visual landmark. It does not replace/mutate E1 or the course. */
export function buildGate(scene, D, hAt) {
  const [west, east] = GATE_LAYOUT.pylons, length = Math.hypot(east.x - west.x, east.z - west.z);
  const axis = { x: (east.x - west.x) / length, z: (east.z - west.z) / length };
  const outward = { x: -axis.z, z: axis.x }; // SE-facing front, toward the public road.
  const stone = new BoxBatch(axis, outward), joints = new BoxBatch(axis, outward);
  // The narrow closed ends face the public road; broad open faces flank the
  // carriageways. Rotate only the towers 90 degrees relative to the name stone.
  const towerStone = (origin, x, y, z, w, h, d, color) => stone.box(origin, z, y, x, d, h, w, color);
  const towerJoint = (origin, x, y, z, w, h, d, color) => joints.box(origin, z, y, x, d, h, w, color);
  const group = new THREE.Group(); group.name = 'landmark-main-gate';
  const width = GATE_LAYOUT.widthM, depth = GATE_LAYOUT.depthM, openingWidth = 1.28, openingBottom = 6.8, openingTop = 9.35;
  const top = GATE_LAYOUT.heightM, pier = (width - openingWidth) / 2;
  const bases = [];
  for (const center of GATE_LAYOUT.pylons) {
    const origin = { ...center, y: hAt(center.x, center.z) }; bases.push(origin.y);
    if (!Number.isFinite(origin.y)) throw new Error('Non-finite main-gate ground elevation');
    towerStone(origin, 0, .08, 0, 4.1, .32, 2.05, 0x91958f);
    towerStone(origin, 0, .73, 0, 3.8, 1.14, 1.75, 0x9da19a);
    for (const side of [-1, 1]) towerStone(origin, side * (openingWidth + pier) / 2, (1.3 + openingTop) / 2, 0, pier, openingTop - 1.3, depth, 0xb9bdb5);
    towerStone(origin, 0, (openingTop + top - .1) / 2, 0, width, top - .1 - openingTop, depth, 0xb9bdb5);
    // A projecting stone tongue interrupts part of the tall slot, matching the
    // photo's stepped silhouette; the lower and upper openings remain through-holes.
    towerStone(origin, openingWidth * .2, openingBottom - .4, 0, openingWidth * .6, .8, depth, 0xb9bdb5);
    towerJoint(origin, 0, top - .05, 0, width + .04, .1, depth + .04, 0x586365);
    // Thin physical panel joints on both broad faces, excluding the real aperture.
    for (const face of [-1, 1]) {
      const z = face * (depth / 2 + .004);
      for (let y = 1.3; y < top - .1; y += .9) {
        if (y < openingTop) {
          for (const side of [-1, 1]) towerJoint(origin, side * (openingWidth + pier) / 2, y, z, pier, .012, .008, 0x8e9690);
        } else towerJoint(origin, 0, y, z, width, .012, .008, 0x8e9690);
      }
      for (const side of [-1, 1]) towerJoint(origin, side * (openingWidth + pier) / 2, (1.3 + top - .1) / 2, z, .012, top - .1 - 1.3, .008, 0x8e9690);
      for (const x of [-.57, .57]) {
        towerJoint(origin, x, (openingTop + top - .1) / 2, z, .012, top - .1 - openingTop, .008, 0x8e9690);
      }
      for (const x of [-.95, 0, .95]) towerJoint(origin, x, .73, face * .879, .012, 1.1, .008, 0x747e78);
    }
  }
  const center = { x: (west.x + east.x) / 2 + outward.x * 2.3, z: (west.z + east.z) / 2 + outward.z * 2.3 };
  center.y = hAt(center.x, center.z);
  stone.box(center, 0, .14, 0, 5.35, .42, 1.15, 0x8c948c);
  stone.box(center, 0, 1.02, 0, 5.05, 1.55, .8, 0xb2b4a9);
  const directoryCenter=campusDirectory(group,stone,D,hAt);
  group.add(stone.mesh('main-gate-granite', new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .86, metalness: .015 })));
  group.add(joints.mesh('main-gate-panel-joints', new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .75, metalness: .04 })));
  namePlate(group, center, axis, outward);
  group.userData = {
    heightM: top, pylons: GATE_LAYOUT.pylons.map((p, i) => ({ ...p, baseElevationM: bases[i] })), axis, outward,
    positionUncertaintyM: GATE_LAYOUT.positionUncertaintyM, nameplateCenter: center, directoryCenter,
    source: 'KAIST official main-gate photo/10.7 m description; OSM entrance nodes and campus boundary',
    sourceUrl: 'https://kaist.ac.kr/kr/html/kaist/01.html',
    fidelity: 'Visual approximation. Pylon positions ±10 m; widths, openings, panels and plaque dimensions estimated. Not the E1 security booth.',
    securityBoothId: D?.buildings?.find(b => b.ref === 'E1')?.id ?? null,
  };
  scene.add(group); return group;
}
