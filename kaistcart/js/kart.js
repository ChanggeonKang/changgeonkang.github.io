// Nubzuki kart: sprung rigid body (heave / pitch / roll) + character model.
import * as THREE from '../lib/three.module.min.js';
import { gAt, clamp, lerp } from './world.js';

// Vehicle state now lives in the standalone SI-unit rigid-body solver.
import { Vehicle, RIDE, VEHICLE_DEFAULTS } from './vehicle-physics.js';
export { RIDE };
export { Vehicle as Body }; // compatibility name; reset(x, z, heading), step(dt, controls)
export const GRAV = VEHICLE_DEFAULTS.gravity;

// ───────────────────────── model ─────────────────────────
// Lens shaped head: a spindle with pointed left / right tips, Nubzuki's trademark silhouette.
function lensGeometry(a, ry, rz, pw = .7, nx = 48, nr = 28) {
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= nx; i++) {
    const t = -1 + 2 * i / nx, r = Math.pow(Math.max(0, 1 - t * t), pw);
    for (let j = 0; j <= nr; j++) {
      const ph = Math.PI + j / nr * Math.PI * 2;
      pos.push(a * t, ry * r * Math.cos(ph), rz * r * Math.sin(ph)); uv.push(i / nx, j / nr);
    }
  }
  for (let i = 0; i < nx; i++) for (let j = 0; j < nr; j++) { const p = i * (nr + 1) + j, q = p + nr + 1; idx.push(p, p + 1, q, p + 1, q + 1, q); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  const N = g.attributes.normal; // weld the seam normals
  for (let i = 0; i <= nx; i++) {
    const p = i * (nr + 1), q = p + nr, x = N.getX(p) + N.getX(q), y = N.getY(p) + N.getY(q), z = N.getZ(p) + N.getZ(q), L = Math.hypot(x, y, z) || 1;
    N.setXYZ(p, x / L, y / L, z / L); N.setXYZ(q, x / L, y / L, z / L);
  }
  return g;
}
function headTexture(hex) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 512;
  const x = c.getContext('2d');
  x.fillStyle = '#' + hex.toString(16).padStart(6, '0'); x.fillRect(0, 0, 1024, 512);
  x.translate(512, 256); x.scale(-1, 1); // mirrored so it reads correctly from behind
  x.fillStyle = 'rgba(255,255,255,.96)'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = 'italic 900 46px "Segoe UI",Arial,sans-serif';
  x.fillText('KAIST', 0, -4);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
function rod(a, b, r, mat) {
  const d = new THREE.Vector3().subVectors(b, a), m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), 6), mat);
  m.position.copy(a).addScaledVector(d, .5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  return m;
}

export function makeNubzuki(scene, { body = 0x2f95e8, accent = 0xffffff, helmet = 0xffffff } = {}) {
  const g = new THREE.Group(), tilt = new THREE.Group();
  g.add(tilt);
  const skinM = new THREE.MeshPhysicalMaterial({ color: body, roughness: .42, clearcoat: .55, clearcoatRoughness: .3 });
  const headM = new THREE.MeshPhysicalMaterial({ map: headTexture(body), roughness: .42, clearcoat: .55, clearcoatRoughness: .3 });
  const S = (c, r = .7, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
  const whiteM = S(0xffffff, .35), blackM = S(0x10131a, .25), accM = S(accent, .75), jeansM = S(0x27375e, .9), faceM = S(0xf1c7a2, .8),
    hairM = S(0x241c1a, .9), helM = new THREE.MeshPhysicalMaterial({ color: helmet, roughness: .3, clearcoat: .8 }), packM = S(0x14284f, .85);
  const add = (geo, mat, px, py, pz, sx = 1, sy = sx, sz = sx, parent = tilt) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(px, py, pz); m.scale.set(sx, sy, sz); parent.add(m); return m;
  };
  const sph = new THREE.SphereGeometry(1, 28, 20);

  // torso, lying on its belly
  const torsoG = new THREE.CapsuleGeometry(.4, .8, 10, 24); torsoG.rotateX(Math.PI / 2);
  add(torsoG, skinM, 0, .37, -.32, 1.05, .84, 1);
  add(sph, skinM, 0, .39, -.86, .47, .4, .44);

  // the wide lens head, chin on the ground
  const head = new THREE.Group(); head.position.set(0, .5, .95); tilt.add(head);
  add(lensGeometry(1.2, .45, .5), headM, 0, 0, 0, 1, 1, 1, head);
  const eyes = [];
  for (const s of [1, -1]) {
    const eye = new THREE.Group(); eye.position.set(s * .27, .11, .455); eye.rotation.set(-.2, s * .1, 0); head.add(eye);
    add(sph, whiteM, 0, 0, 0, .2, .2, .06, eye);
    const pupil = add(sph, blackM, 0, 0, .035, .125, .125, .045, eye);
    add(sph, whiteM, .045, .05, .075, .035, .035, .015, eye);
    eyes.push(pupil);
  }

  // thin tapered arms and legs with mitten hands and feet, sprawled flat
  const limbs = [];
  const limb = (px, py, pz, ang, len, r0, r1, end) => {
    const grp = new THREE.Group(); grp.position.set(px, py, pz); grp.rotation.y = ang; tilt.add(grp);
    const cg = new THREE.CylinderGeometry(r1, r0, len, 12); cg.rotateX(Math.PI / 2); cg.translate(0, 0, len / 2);
    add(cg, skinM, 0, 0, 0, 1, 1, 1, grp);
    add(sph, skinM, 0, 0, len, end[0], end[1], end[2], grp);
    grp.userData.a0 = ang; limbs.push(grp);
  };
  limb(.36, .17, .28, .78, 1.0, .115, .08, [.16, .13, .17]);
  limb(-.36, .17, .28, -.78, 1.0, .115, .08, [.16, .13, .17]);
  limb(.25, .17, -1.0, Math.PI - .5, .78, .13, .095, [.17, .12, .24]);
  limb(-.25, .17, -1.0, -Math.PI + .5, .78, .13, .095, [.17, .12, .24]);

  // rider
  const rider = new THREE.Group(); rider.position.set(0, .69, -.42); tilt.add(rider);
  add(new THREE.BoxGeometry(.66, .05, .74), accM, 0, -.01, 0, 1, 1, 1, rider);                    // saddle blanket
  const cap = new THREE.CapsuleGeometry(1, 1, 6, 14);
  add(sph, jeansM, 0, .13, -.02, .2, .15, .2, rider);
  const torso = add(cap, accM, 0, .43, .05, .19, .2, .16, rider); torso.rotation.x = .32;
  add(new THREE.BoxGeometry(.3, .34, .15), packM, 0, .47, -.2, 1, 1, 1, rider).rotation.x = .32;
  const hd = new THREE.Group(); hd.position.set(0, .88, .16); rider.add(hd);
  add(sph, faceM, 0, 0, 0, .19, .2, .19, hd);
  add(sph, hairM, 0, .01, -.03, .2, .2, .2, hd);
  add(new THREE.SphereGeometry(1, 24, 14, 0, Math.PI * 2, 0, Math.PI * .56), helM, 0, .02, 0, .23, .23, .23, hd).rotation.x = -.18;
  add(new THREE.BoxGeometry(.36, .07, .1), blackM, 0, .03, .17, 1, 1, 1, hd);                     // goggles
  add(new THREE.BoxGeometry(.06, .02, .42), accM, 0, .245, -.02, 1, 1, 1, hd);                    // helmet stripe
  const arms = [];
  for (const s of [1, -1]) {
    const leg = add(cap, jeansM, s * .3, .03, .1, .085, .17, .085, rider); leg.rotation.set(.5, 0, -s * 1.15);
    add(sph, blackM, s * .47, -.13, .26, .09, .07, .15, rider);
    const arm = new THREE.Group(); arm.position.set(s * .22, .62, .12); rider.add(arm);
    add(cap, accM, 0, -.17, 0, .058, .12, .058, arm);
    add(sph, faceM, 0, -.36, 0, .065, .065, .065, arm);
    arm.rotation.set(-1.25, 0, s * .12); arm.userData.s = s; arms.push(arm);
    tilt.add(rod(new THREE.Vector3(s * .26, 1.2, .0), new THREE.Vector3(s * .5, .86, .78), .012, blackM)); // reins
  }

  // soft contact shadow that stays on the ground
  const ao = new THREE.Mesh(new THREE.CircleGeometry(1, 24), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: .22, depthWrite: false }));
  ao.rotation.x = -Math.PI / 2; ao.renderOrder = 2; scene.add(ao);

  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  g.rotation.order = 'YXZ';
  g.userData = { tilt, head, eyes, limbs, rider, arms, hd, ao, sq: 1, air: 0 };
  scene.add(g);
  return g;
}

/** Place and animate a kart from its simulation state. */
export function poseKart(g, s, dt, t) {
  const u = g.userData, b = s.body, gy = gAt(s.x, s.z), sp = clamp(Math.abs(s.vf) / 16, 0, 1), k = Math.min(1, dt * 14);
  const supportOffset = b.rideHeight ?? RIDE, bodyUp = b.upward;
  g.position.set(b.x - bodyUp[0] * supportOffset, b.y - bodyUp[1] * supportOffset, b.z - bodyUp[2] * supportOffset);
  g.quaternion.fromArray(b.q);
  // jelly squash from spring load, stretch in the air
  const tgt = b.contacts ? clamp(1 - (b.load - 1) * .075, .7, 1.1) : 1.07;
  u.sq += (tgt - u.sq) * Math.min(1, dt * 22);
  u.tilt.scale.set(1 + (1 - u.sq) * .45, u.sq, 1 + (1 - u.sq) * .45);
  u.air += ((b.contacts ? 0 : 1) - u.air) * Math.min(1, dt * 9);
  u.limbs.forEach((m, i) => {
    const spread = (i < 2 ? .55 : -.45) * Math.sign(m.userData.a0) * u.air;
    m.rotation.y = m.userData.a0 + spread + Math.sin(t * 12 + i * 1.9) * .05 * sp * (1 - u.air);
    m.rotation.x = -u.air * .25 + (i < 2 ? -s.steer * .0 : 0);
  });
  u.head.rotation.z += (clamp(-b.wr * .05 - s.steer * .07 * sp, -.2, .2) - u.head.rotation.z) * k;
  u.head.rotation.x += (clamp(b.wp * .03, -.15, .15) - u.head.rotation.x) * k;
  for (const p of u.eyes) { p.position.x += (s.steer * .055 - p.position.x) * k; p.position.y += ((u.air > .5 ? .04 : 0) - p.position.y) * k; }
  u.rider.rotation.z += (s.steer * .22 * sp - u.rider.rotation.z) * k;
  u.rider.rotation.x += ((s.boost ? .22 : 0) - u.air * .3 - u.rider.rotation.x) * k;
  for (const a of u.arms) a.rotation.x += (lerp(-1.25, -3.0, u.air) - a.rotation.x) * k;
  u.hd.rotation.y += (s.steer * .35 - u.hd.rotation.y) * k;
  const hgt = clamp(1 - (b.y - RIDE - gy) / 5, .25, 1);
  u.ao.position.set(s.x, gy + .04, s.z); u.ao.rotation.z = -s.th;
  u.ao.scale.set(1.25 * hgt, 1.7 * hgt, 1); u.ao.material.opacity = .22 * hgt;
}
