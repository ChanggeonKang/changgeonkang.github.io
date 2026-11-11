// Nubzuki Kart — KAIST Fun Run GP: game loop, driving physics, camera, HUD.
import * as THREE from '../lib/three.module.min.js';
import { W, loadWorld, updateWorld, hAt, gAt, surfAt, coursePos, clamp, mod, lerp, rng, DS } from './world.js';
import { makeNubzuki, poseKart } from './kart.js';
import { Vehicle, RIDE } from './vehicle-physics.js';
import { FixedStepper, syncRacer, updateProgress, aiControls, resolveWalls, resolveRacerContacts } from './race-sim.js';
import { Particles, Skids, Post } from './fx.js';
import { Sfx } from './audio.js';

const $ = id => document.getElementById(id);
const Q = new URLSearchParams(location.search);
const rnd = rng(99);
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
const ORD = ['st', 'nd', 'rd', 'th', 'th', 'th'];
const fmt = t => { const m = Math.floor(t / 60), s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(2); };

// ───────────────────────── renderer ─────────────────────────
const renderer = new THREE.WebGLRenderer({ canvas: $('gl'), antialias: true, powerPreference: 'high-performance' });
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
const scene = new THREE.Scene();
scene.background = W.horizon.clone();
scene.fog = new THREE.Fog(W.horizon.clone(), 420, 2700);
const camera = new THREE.PerspectiveCamera(60, 1, 0.3, 9000);
scene.add(new THREE.HemisphereLight(0xd8eaff, 0x77885f, .45));
const sun = new THREE.DirectionalLight(0xfff0d6, 2.9);
sun.castShadow = true; sun.shadow.bias = -0.0003; sun.shadow.normalBias = .5;
Object.assign(sun.shadow.camera, { left: -80, right: 80, top: 80, bottom: -80, near: 20, far: 620 });
scene.add(sun, sun.target);
const post = new Post(renderer);

const QUAL = [{ pr: 1.5, shadow: 2048, msaa: 4 }, { pr: 1, shadow: 1024, msaa: 2 }, { pr: .8, shadow: 0, msaa: 0 }];
let qual = clamp(parseInt(Q.get('q') || '0', 10) || 0, 0, 2), slowT = 0, ema = 16;
function applyQuality() {
  const q = QUAL[qual];
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, q.pr));
  sun.castShadow = q.shadow > 0;
  if (q.shadow && sun.shadow.mapSize.x !== q.shadow) { sun.shadow.mapSize.set(q.shadow, q.shadow); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
  resize();
}
function resize() {
  const w = innerWidth || 800, h = innerHeight || 600;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  const v = renderer.getDrawingBufferSize(new THREE.Vector2());
  post.setSize(v.x, v.y, QUAL[qual].msaa);
}
addEventListener('resize', resize);

// ───────────────────────── state ─────────────────────────
const keys = { up: false, down: false, left: false, right: false, drift: false };
const KEYMAP = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', Space: 'drift' };
let touchMode = false;
let state = 'load'; // load → title → count → race → finish (+ pause)
let T = 0, raceT = 0, countT = 0, finT = 0, finishOrder = 0, helpT = 0;
const sfx = new Sfx();
const P = { name: 'You', color: 0x2f95e8, x: 0, z: 0, th: 0, vx: 0, vz: 0, vf: 0, vl: 0, wy: 0, steer: 0, drift: false, grip: 1,
  prog: 0, lost: false, off: false, wrong: 0, shake: 0, flipT: 0, done: 0, time: 0, body: new Vehicle({ groundAt: gAt, surfaceAt: surfAt }), mesh: null };
const AI = [
  { name: 'Quark', color: 0x35c2d6, accent: 0xf2c230 }, { name: 'Photon', color: 0x7a82ee, accent: 0xe8483c }, { name: 'Tensor', color: 0x3fbf8f, accent: 0x8a4fd0 },
  { name: 'Kernel', color: 0xea6fa6, accent: 0x1f2a44 }, { name: 'Byte', color: 0xf2a13a, accent: 0x2f9e58 },
];
const ais = [];
const tmp = { x: 0, z: 0, th: 0 }, v3 = new THREE.Vector3(), v2 = new THREE.Vector2();
let dust, glow, skids;
const stepper = new FixedStepper();
let reverseHold = 0, telemetry = false, autoDrive = false, frameMs = 16.7;

function placeGrid() {
  const slots = [];
  for (let k = 0; k < ais.length + 1; k++) slots.push({ prog: -(3 + 3.2 * Math.floor(k / 2)), off: k % 2 ? -2.3 : 2.3 });
  ais.forEach((a, i) => {
    Object.assign(a, { prog: slots[i].prog, off: slots[i].off, speed: 0, done: 0, time: 0, wob: rnd() * 6, steer: 0, vf: 0 });
    coursePos(a.prog, a.off, tmp); a.body.reset(tmp.x, tmp.z, tmp.th); syncRacer(a);
  });
  const s = slots[ais.length];
  coursePos(s.prog, s.off, tmp);
  Object.assign(P, { x: tmp.x, z: tmp.z, th: tmp.th, vx: 0, vz: 0, vf: 0, vl: 0, wy: 0, steer: 0, drift: false, grip: 1,
    prog: s.prog, lost: false, off: false, wrong: 0, shake: 0, flipT: 0, done: 0, time: 0 });
  P.body.reset(P.x, P.z, P.th); syncRacer(P); reverseHold = 0; stepper.reset();
  finishOrder = 0; raceT = 0; cam.snap = true;
  if (skids) skids.clear();
}
function resetToCourse() {
  coursePos(Math.floor(P.prog), 0, tmp);
  Object.assign(P, { x: tmp.x, z: tmp.z, th: tmp.th, vx: 0, vz: 0, vf: 0, vl: 0, wy: 0, steer: 0, drift: false, lost: false, flipT: 0 });
  P.body.reset(P.x, P.z, P.th); syncRacer(P);
  cam.snap = true;
}

// ───────────────────────── driving physics ─────────────────────────
const ev = { J: 0, hit: 0 };
function stepPlayer(dt, input) {
  const st = input ? (keys.right ? 1 : 0) - (keys.left ? 1 : 0) : 0;
  P.steer += (st - P.steer) * (1 - Math.exp(-dt * 7));
  reverseHold = input && keys.down && Math.abs(P.body.vf) < .7 ? reverseHold + dt : 0;
  const reversing = reverseHold > .35 || (input && keys.down && P.body.vf < -.3);
  let controls = {
    throttle: input && keys.up ? 1 : reversing ? -.45 : 0,
    brake: input ? (keys.down && !reversing ? 1 : 0) : 1,
    steer: P.steer,
    handbrake: input && keys.drift,
  };
  if (input && autoDrive) {
    if (keys.up || keys.down || keys.left || keys.right || keys.drift) autoDrive = false;
    else { controls = aiControls(P, W, coursePos); P.steer = controls.steer; }
  }
  const previous = { x: P.body.x, z: P.body.z };
  const impulse = P.body.step(dt, controls);
  ev.J += impulse / P.body.parameters.mass;
  ev.hit = Math.max(ev.hit, resolveWalls(P.body, previous, surfAt));
  syncRacer(P);
  P.flipT = P.body.up < .25 && P.body.contacts ? P.flipT + dt : 0;
}
function stepAI(dt, racing) {
  for (const a of ais) {
    const controls = racing && !a.done ? aiControls(a, W, coursePos) : { brake: 1 };
    const previous = { x: a.body.x, z: a.body.z };
    a.body.step(dt, controls);
    resolveWalls(a.body, previous, surfAt);
    syncRacer(a); a.steer = controls.steer || 0;
    updateProgress(a, W.C);
    a.body.landed = 0;
    if (racing && !a.done && a.prog >= W.C.n) { a.done = ++finishOrder; a.time = raceT; }
  }
}
function trackProgress(dt) {
  const C = W.C;
  updateProgress(P, C);
  const k = mod(Math.floor(P.prog), C.n);
  const along = Math.sin(P.th) * C.tx[k] + Math.cos(P.th) * C.tz[k];
  P.wrong = along < -.4 && P.vf > 3 ? P.wrong + dt : 0;
}

// ───────────────────────── effects ─────────────────────────
function effects(dt) {
  const b = P.body, s = Math.sin(P.th), c = Math.cos(P.th), spd = Math.hypot(P.vx, P.vz), gy = gAt(P.x, P.z), grounded = b.contacts > 0;
  const rx = P.x - s * 1.1, rz = P.z - c * 1.1, surf = surfAt(P.x, P.z);
  if (b.landed > .22) { // touchdown after a real flight
    const pw = clamp(b.landed * 1.4, .3, 1.5);
    for (let i = 0; i < 16 * pw; i++) { const a = rnd() * 6.28, v = 2 + rnd() * 4; dust.emit(P.x + Math.cos(a) * .8, gy + .15, P.z + Math.sin(a) * .8, Math.cos(a) * v + P.vx * .3, .6 + rnd(), Math.sin(a) * v + P.vz * .3, .7 + rnd() * .5, .9, 2.6, .62, .57, .5, .45); }
    sfx.thump(pw); P.shake = Math.max(P.shake, clamp(pw * .7, 0, 1));
  }
  b.landed = 0;
  if (ev.J > 2.2 && grounded) { P.shake = Math.max(P.shake, clamp(ev.J * .1, 0, .8)); }
  if (ev.hit > 6) { sfx.thump(clamp(ev.hit / 25, .2, 1)); P.shake = Math.max(P.shake, clamp(ev.hit / 30, 0, .8)); }
  ev.J = 0; ev.hit = 0;
  if (grounded && surf === 0 && spd > 5 && rnd() < dt * 40) dust.emit(rx + (rnd() - .5), gy + .15, rz + (rnd() - .5), (rnd() - .5) * 2, .8 + rnd(), (rnd() - .5) * 2, .8, .7, 2.2, .50, .42, .30, .4);
  if (P.drift && grounded) {
    for (const sg of [1, -1]) {
      const wx = rx + c * .55 * sg, wz = rz - s * .55 * sg;
      if (rnd() < dt * 50) dust.emit(wx, gy + .12, wz, -P.vx * .1 + (rnd() - .5), .5 + rnd() * .6, -P.vz * .1 + (rnd() - .5), .5, .5, 2.4, .8, .8, .82, .3);
      if (surf >= 2) skids.add(sg > 0 ? 0 : 1, wx, gy + .02, wz, c, -s, .16);
    }
  } else skids.stop();
  const sc = renderer.getDrawingBufferSize(v2).y / (2 * Math.tan(camera.fov * Math.PI / 360));
  dust.update(dt, sc); glow.update(dt, sc);
  P.shake = Math.max(0, P.shake - dt * 2.4);
  sfx.update(clamp(spd / 30, 0, 1.2), keys.up && state === 'race' ? 1 : 0, clamp(Math.abs(P.vl) / 7, 0, 1) * (grounded ? 1 : 0), grounded, surf === 0, false);
}

// ───────────────────────── camera ─────────────────────────
const cam = { pos: new THREE.Vector3(), look: new THREE.Vector3(), yaw: 0, y: 0, snap: true };
function updateCamera(dt) {
  const gy = gAt(P.x, P.z);
  if (state === 'load' || state === 'title' || state === 'finish') { // showcase orbit
    const a = (state === 'finish' ? P.th + Math.PI * .75 + finT * .25 : T * .16 + 2.4), r = state === 'finish' ? 8 : 6.4;
    v3.set(P.x + Math.sin(a) * r, gy + (state === 'finish' ? 3 : 2.1), P.z + Math.cos(a) * r);
    if (state === 'finish' && !cam.snap) cam.pos.lerp(v3, 1 - Math.exp(-dt * 2.5)); else cam.pos.copy(v3);
    cam.snap = false; cam.y = gy; cam.yaw = P.th;
    camera.position.copy(cam.pos); camera.lookAt(P.x, P.body.y - RIDE + .7, P.z);
    if (camera.fov !== 50) { camera.fov = 50; camera.updateProjectionMatrix(); }
    return;
  }
  const spd = Math.hypot(P.vx, P.vz);
  const ty = spd > 4 && P.vf > 0 ? P.th + angDiff(Math.atan2(P.vx, P.vz), P.th) * .55 : P.th; // lean toward the travel direction: drifts show their slip angle
  if (cam.snap) { cam.yaw = P.th; cam.y = gy; }
  cam.yaw += angDiff(ty, cam.yaw) * (1 - Math.exp(-dt * 5.5));
  cam.y += (gy * .7 + (P.body.y - RIDE) * .3 - cam.y) * (1 - Math.exp(-dt * 5)); // follows the ground more than the kart, so a jump reads as a jump
  const s = Math.sin(cam.yaw), c = Math.cos(cam.yaw), back = 6.9 + clamp(spd / 30, 0, 1) * 1.7;
  v3.set(P.x - s * back, cam.y + 3.1, P.z - c * back);
  v3.y = Math.max(v3.y, gAt(v3.x, v3.z) + 1.1);
  if (cam.snap) { cam.pos.copy(v3); cam.snap = false; } else cam.pos.lerp(v3, 1 - Math.exp(-dt * 10));
  camera.position.copy(cam.pos);
  if (P.shake > 0) { camera.position.x += (Math.random() - .5) * P.shake * .45; camera.position.y += (Math.random() - .5) * P.shake * .45; }
  cam.look.set(P.x + s * 4.5, cam.y + 1.1 + (P.body.y - RIDE - gy) * .45, P.z + c * 4.5);
  camera.lookAt(cam.look);
  camera.rotateZ(clamp(-P.wy * .035, -.08, .08));
  const fov = 60 + clamp(spd / 34, 0, 1) * 9;
  if (Math.abs(camera.fov - fov) > .05) { camera.fov += (fov - camera.fov) * Math.min(1, dt * 4); camera.updateProjectionMatrix(); }
}

// ───────────────────────── HUD ─────────────────────────
const hud = { last: {}, dots: [] };
function setText(id, v) { if (hud.last[id] !== v) { hud.last[id] = v; $(id).textContent = v; } }
function buildHud() {
  const C = W.C, cv = $('mini'), S = cv.width;
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (let i = 0; i < C.n; i++) { x0 = Math.min(x0, C.x[i]); x1 = Math.max(x1, C.x[i]); z0 = Math.min(z0, C.z[i]); z1 = Math.max(z1, C.z[i]); }
  const sc = (S - 44) / Math.max(x1 - x0, z1 - z0);
  hud.m = { sc, ox: S / 2 - (x0 + x1) / 2 * sc, oz: S / 2 - (z0 + z1) / 2 * sc };
  hud.base = document.createElement('canvas'); hud.base.width = hud.base.height = S;
  const c = hud.base.getContext('2d');
  c.lineJoin = 'round';
  for (const [lw, st] of [[11, 'rgba(0,0,0,.5)'], [6, '#ffffff']]) {
    c.lineWidth = lw; c.strokeStyle = st; c.beginPath();
    for (let i = 0; i <= C.n; i += 2) { const k = i % C.n; c.lineTo(C.x[k] * sc + hud.m.ox, C.z[k] * sc + hud.m.oz); }
    c.closePath(); c.stroke();
  }
  c.fillStyle = '#ffd23f';
  for (const ci of W.courseBumps) c.fillRect(C.x[ci] * sc + hud.m.ox - 2.5, C.z[ci] * sc + hud.m.oz - 2.5, 5, 5);
  c.fillStyle = '#111'; c.fillRect(C.x[0] * sc + hud.m.ox - 7, C.z[0] * sc + hud.m.oz - 7, 14, 14);
  c.fillStyle = '#fff'; c.fillRect(C.x[0] * sc + hud.m.ox - 7, C.z[0] * sc + hud.m.oz - 7, 7, 7); c.fillRect(C.x[0] * sc + hud.m.ox, C.z[0] * sc + hud.m.oz, 7, 7);
  const hex = n => '#' + n.toString(16).padStart(6, '0');
  for (const r of [...ais, P]) { const d = document.createElement('i'); d.style.background = hex(r.color); if (r === P) d.className = 'me'; $('prog').appendChild(d); hud.dots.push(d); }
  $('chipLen').textContent = (C.len / 1000).toFixed(2) + ' km lap';
  $('chipBump').textContent = W.courseBumps.length + ' speed bumps';
}
function updateHud(dt) {
  const C = W.C, spd = Math.hypot(P.vx, P.vz) * 3.6;
  setText('spd', Math.round(spd));
  $('arc').setAttribute('stroke-dasharray', (311 * clamp(spd / 130, 0, 1)).toFixed(1) + ' 415');
  $('arc').setAttribute('stroke', P.body.contacts ? '#7fd0ff' : '#ffd23f');
  setText('time', fmt(P.done ? P.time : raceT));
  const rank = P.done || 1 + ais.filter(a => a.prog > P.prog).length;
  if (hud.last.rank !== rank) { hud.last.rank = rank; $('rank').innerHTML = rank + '<sup>' + ORD[rank - 1] + '</sup><small>/ ' + (ais.length + 1) + '</small>'; }
  const leftM = Math.max(0, (C.n - P.prog) * (W.C.ds || DS));
  setText('left', leftM >= 1000 ? (leftM / 1000).toFixed(2) + ' km to go' : Math.round(leftM / 10) * 10 + ' m to go');
  [...ais, P].forEach((r, i) => { hud.dots[i].style.left = clamp(r.prog / C.n * 100, 0, 100) + '%'; });
  const k = P.prog < 0 ? 0 : mod(Math.floor(P.prog), C.n);
  const nx = W.landmarks.find(m => m.idx > k + 4 && m.idx > 0) || { name: 'Finish line', idx: C.n };
  setText('nextName', nx.name); setText('nextDist', Math.round((nx.idx - k) * (W.C.ds || DS) / 10) * 10 + ' m');
  $('loadIbar').style.width = clamp(P.body.load / 2, 0, 1) * 100 + '%';
  setText('contactLabel', P.body.contacts ? '접지 ' + P.body.load.toFixed(1) + ' × 정하중' : '공중 · 접촉 없음');
  if (telemetry) setText('telemetryText', '피치 ' + (P.body.p * 180 / Math.PI).toFixed(1) + '° · 롤 ' + (P.body.r * 180 / Math.PI).toFixed(1) + '° · 수직 ' + P.body.vy.toFixed(2) + ' m/s · ' + Math.round(1000 / frameMs) + ' FPS');
  $('telemetry').dataset.state = JSON.stringify({ x:P.x, z:P.z, speed:spd, progress:P.prog, up:P.body.up, fps:1000/frameMs, calls:renderer.info.render.calls, triangles:renderer.info.render.triangles });
  setText('msg', state !== 'race' ? '' : P.flipT > 1 ? '전복 · 복귀 버튼 또는 R' : P.lost ? '코스 이탈 · 복귀 버튼 또는 R' : P.wrong > .8 ? 'WRONG WAY' : autoDrive ? '자동 시승 · 조작하면 직접 운전' : '');
  $('msg').classList.toggle('tour', autoDrive && !P.lost && P.flipT <= 1 && P.wrong <= .8);
  if (helpT > 0) { helpT -= dt; if (helpT <= 0) $('help').style.opacity = 0; }
  // minimap
  const c = $('mini').getContext('2d'), S = $('mini').width, m = hud.m;
  c.clearRect(0, 0, S, S); c.drawImage(hud.base, 0, 0);
  for (const a of ais) { c.fillStyle = '#' + a.color.toString(16).padStart(6, '0'); c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.arc(a.x * m.sc + m.ox, a.z * m.sc + m.oz, 7, 0, 7); c.fill(); c.stroke(); }
  c.save(); c.translate(P.x * m.sc + m.ox, P.z * m.sc + m.oz); c.rotate(-P.th + Math.PI);
  c.fillStyle = '#2f95e8'; c.strokeStyle = '#fff'; c.lineWidth = 3.5;
  c.beginPath(); c.moveTo(0, -15); c.lineTo(10, 10); c.lineTo(0, 5); c.lineTo(-10, 10); c.closePath(); c.fill(); c.stroke(); c.restore();
}
function showCount(n, go) {
  const L = $('lights'), N = $('countN');
  L.classList.toggle('go', !!go); L.classList.toggle('hidden', n === '');
  [...L.children].forEach((b, i) => b.classList.toggle('on', !go && typeof n === 'number' && i <= 3 - n));
  if (N.textContent !== String(n)) { N.textContent = n; N.classList.remove('pop'); void N.offsetWidth; N.classList.add('pop'); }
}
const BEST_KEY = 'nubzuki-physical-best-v1';
const getBest = () => { try { return parseFloat(localStorage.getItem(BEST_KEY)) || 0; } catch { return 0; } };
const setBest = t => { try { localStorage.setItem(BEST_KEY, String(t)); } catch { /* storage unavailable */ } };
function showResults() {
  const C = W.C, rows = [P, ...ais].map(r => ({ r, t: r.done ? r.time : raceT + Math.max(0, C.n - r.prog) * (W.C.ds || DS) / (r.base || 20), est: !r.done }));
  rows.sort((a, b) => a.t - b.t);
  const rank = rows.findIndex(o => o.r === P) + 1, best = getBest(), isBest = !best || P.time < best;
  if (isBest) setBest(P.time);
  $('resTitle').textContent = rank === 1 ? 'YOU WIN!' : 'FINISH!';
  $('resSub').textContent = rank + ORD[rank - 1].toUpperCase() + ' PLACE · ' + (C.len / 1000).toFixed(2) + ' KM';
  $('resTime').textContent = fmt(P.time);
  $('resBest').textContent = isBest ? 'New personal best!' : 'Personal best ' + fmt(best);
  $('resTable').innerHTML = rows.map((o, i) => `<tr class="${o.r === P ? 'me' : ''}"><td>${i + 1}</td><td><i style="background:#${o.r.color.toString(16).padStart(6, '0')}"></i>${o.r.name}</td><td>${fmt(o.t)}</td></tr>`).join('');
  $('results').classList.remove('hidden');
}

// ───────────────────────── flow ─────────────────────────
function show(id, on) { $(id).classList.toggle('hidden', !on); }
function startRace(tour = false) {
  sfx.init();
  placeGrid();
  autoDrive = tour;
  show('title', false); show('results', false); show('pause', false); show('hud', true);
  $('help').style.opacity = 1; helpT = 9;
  state = 'count'; countT = 4.2; hud.beep = 4;
  showCount('');
}
function toTitle() { placeGrid(); state = 'title'; show('title', true); show('results', false); show('pause', false); show('hud', false); sfx.quiet(); const b = getBest(); $('bestLine').textContent = b ? 'Personal best ' + fmt(b) : ''; }
let pausedState = 'race';
function setPause(on) { if (on && (state === 'race' || state === 'count')) { pausedState = state; state = 'pause'; show('pause', true); sfx.quiet(); } else if (!on && state === 'pause') { state = pausedState; last = 0; show('pause', false); } }
$('startBtn').onclick = () => startRace(); $('againBtn').onclick = () => startRace(); $('restartBtn').onclick = () => startRace();
$('tourBtn').onclick = () => startRace(true);
$('resetBtn').onclick = () => { if (state === 'race') resetToCourse(); };
$('pauseBtn').onclick = () => setPause(true);
$('titleBtn').onclick = toTitle; $('quitBtn').onclick = toTitle; $('resumeBtn').onclick = () => setPause(false);
addEventListener('keydown', e => {
  if (KEYMAP[e.code]) { keys[KEYMAP[e.code]] = true; e.preventDefault(); }
  if (e.repeat) return;
  if (e.code === 'KeyR' && state === 'race') resetToCourse();
  if (e.code === 'KeyM') sfx.setMuted(!sfx.muted);
  if (e.code === 'KeyT') { telemetry = !telemetry; $('telemetry').classList.toggle('hidden', !telemetry); }
  if (e.code === 'Escape' || e.code === 'KeyP') setPause(state !== 'pause');
  if (e.code === 'Enter') { if (state === 'title' && !$('startBtn').disabled) startRace(); else if (state === 'finish' && !$('results').classList.contains('hidden')) startRace(); }
});
addEventListener('keyup', e => { if (KEYMAP[e.code]) { keys[KEYMAP[e.code]] = false; e.preventDefault(); } });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; setPause(true); });
document.addEventListener('visibilitychange', () => { if (document.hidden) setPause(true); });
for (const [id, k] of [['tL', 'left'], ['tR', 'right'], ['tD', 'drift'], ['tB', 'down'], ['tA', 'up']]) {
  const el = $(id);
  el.addEventListener('pointerdown', e => { keys[k] = true; el.setPointerCapture(e.pointerId); e.preventDefault(); });
  for (const evn of ['pointerup', 'pointercancel']) el.addEventListener(evn, () => { keys[k] = false; });
}
$('qualitySelect').onchange = e => { qual = e.target.value === 'auto' ? 0 : Number(e.target.value); applyQuality(); };
addEventListener('touchstart', () => { if (!touchMode) { touchMode = true; $('touch').style.display = 'block'; } }, { passive: true });

// ───────────────────────── main loop ─────────────────────────
function simulate(dt) {
  T += dt;
  if (state === 'count') {
    countT -= dt;
    const n = Math.ceil(countT - 1);
    if (n !== hud.beep && n >= 0 && n <= 3) { hud.beep = n; sfx.beep(n ? 440 : 880, n ? .16 : .5); }
    if (countT > 4) showCount(''); else if (n >= 1) showCount(n); else showCount('GO', true);
    if (countT <= 1) state = 'race';
  }
  const racing = state === 'race';
  if (racing) {
    if (countT > 0) { countT -= dt; if (countT <= 0) showCount(''); }
    raceT += dt;
  }
  stepPlayer(dt, racing);
  stepAI(dt, racing || state === 'finish');
  resolveRacerContacts([P, ...ais], surfAt);
  if (racing) {
    trackProgress(dt);
    if (P.prog >= W.C.n) { P.done = ++finishOrder; P.time = raceT; state = 'finish'; finT = 0; sfx.fanfare(); }
  } else if (state === 'finish') {
    raceT += dt; finT += dt;
    if (finT > 2.4 && $('results').classList.contains('hidden')) showResults();
  }
}
function tick(dt) {
  if (state === 'load') return;
  if (state !== 'pause') {
    stepper.advance(dt, simulate);
    poseKart(P.mesh, P, dt, T);
    for (const a of ais) poseKart(a.mesh, a, dt, T);
    effects(dt);
  }
  updateCamera(dt);
  if (window.__headless) return;
  sun.target.position.set(P.x, gAt(P.x, P.z), P.z);
  sun.position.copy(sun.target.position).addScaledVector(W.sun, 300);
  updateWorld(T, camera);
  if (state !== 'title') updateHud(dt);
  const spd = Math.hypot(P.vx, P.vz), racing = state === 'race' || state === 'count';
  if (post.ok && qual < 2) post.render(scene, camera, racing ? clamp((spd - 20) / 25, 0, .4) : 0, 0, T);
  else renderer.render(scene, camera);
}
let last = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const raw = last ? (now - last) / 1000 : 0; last = now;
  if (raw > 0 && raw < .5) frameMs += (raw * 1000 - frameMs) * .05;
  if (raw > .5 && (state === 'race' || state === 'count')) setPause(true);
  if (state === 'race' && raw < .5 && $('qualitySelect').value === 'auto') {
    ema += (raw * 1000 - ema) * .05;
    slowT = ema > 25 ? slowT + raw : 0;
    if (slowT > 3 && qual < 2) { qual++; slowT = 0; ema = 16; applyQuality(); }
  }
  // Racing elapsed time is accumulated at 240 Hz, independent of rendering cadence.
  // Background tabs and long stalls pause visibly instead of silently losing race time.
  tick(state === 'pause' ? Math.min(raw, .05) : Math.min(raw, .5));
}

async function init() {
  applyQuality();
  let n = 0;
  await loadWorld(scene, renderer, msg => { n++; $('loadMsg').textContent = msg + '…'; $('loadI').style.width = Math.min(95, n * 13) + '%'; });
  dust = new Particles(scene, 420, false); glow = new Particles(scene, 320, true); skids = new Skids(scene);
  P.mesh = makeNubzuki(scene, { body: P.color, accent: 0xf4f4f4, helmet: 0xffffff });
  AI.forEach((d, i) => ais.push({ ...d, mesh: makeNubzuki(scene, { body: d.color, accent: d.accent, helmet: d.accent }), body: new Vehicle({ groundAt: gAt, surfaceAt: surfAt }),
    base: 17 + i * .55, offTarget: (i % 2 ? -1 : 1) * .85, prog: 0, off: 0, speed: 0, x: 0, z: 0, th: 0, vf: 0, steer: 0, boost: 0, done: 0, time: 0, wob: 0 }));
  placeGrid();
  buildHud();
  $('loadI').style.width = '100%'; $('loadMsg').textContent = ''; show('loadBar', false);
  $('startBtn').disabled = false; $('tourBtn').disabled = false; $('startBtn').textContent = 'START RACE';
  toTitle();
  window.__game = { P, W, ais, keys, tick, camera, renderer, scene, start: startRace, reset: resetToCourse, gAt, hAt, surfAt, get state() { return state; }, get raceT() { return raceT; } };
}
requestAnimationFrame(frame);
init().catch(e => { console.error(e); $('loadMsg').textContent = 'Failed to load: ' + e.message; });
