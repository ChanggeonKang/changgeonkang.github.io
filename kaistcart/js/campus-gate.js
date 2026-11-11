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
  box(origin, x, y, z, width, height, depth, color) {
    const geometry = new THREE.BoxGeometry(width, height, depth).toNonIndexed();
    const p = geometry.attributes.position, n = geometry.attributes.normal, c = new THREE.Color(color), a = this.axis, o = this.outward;
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
  context.font = 'bold 104px Arial, sans-serif'; context.fillText('KAIST', 226, 110);
  context.font = 'bold 61px "Malgun Gothic", "Noto Sans KR", sans-serif'; context.fillText('한국과학기술원', 683, 112);
  context.fillStyle = '#39729b'; context.fillRect(67, 181, 870, 6);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(4.65, 1.16), new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
  plate.position.set(center.x + outward.x * .406, center.y + 1.06, center.z + outward.z * .406);
  plate.rotation.y = Math.atan2(outward.x, outward.z); plate.name = 'main-gate-nameplate'; group.add(plate);
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
  group.add(stone.mesh('main-gate-granite', new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .86, metalness: .015 })));
  group.add(joints.mesh('main-gate-panel-joints', new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .75, metalness: .04 })));
  namePlate(group, center, axis, outward);
  group.userData = {
    heightM: top, pylons: GATE_LAYOUT.pylons.map((p, i) => ({ ...p, baseElevationM: bases[i] })), axis, outward,
    positionUncertaintyM: GATE_LAYOUT.positionUncertaintyM, nameplateCenter: center,
    source: 'KAIST official main-gate photo/10.7 m description; OSM entrance nodes and campus boundary',
    sourceUrl: 'https://kaist.ac.kr/kr/html/kaist/01.html',
    fidelity: 'Visual approximation. Pylon positions ±10 m; widths, openings, panels and plaque dimensions estimated. Not the E1 security booth.',
    securityBoothId: D?.buildings?.find(b => b.ref === 'E1')?.id ?? null,
  };
  scene.add(group); return group;
}
