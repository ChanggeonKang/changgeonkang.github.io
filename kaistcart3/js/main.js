// Campus Drive uses Kart 1's vehicle, camera, sound and scenery in a free-roaming world.
import * as THREE from '../lib/three.module.min.js';
import {W, loadWorld, updateWorld, gAt, surfAt, clamp, rng} from './world.js';
import {makeNubzuki, poseKart} from './kart.js';
import {Vehicle,RIDE} from './vehicle-physics.js';
import {FixedStepper} from './race-sim.js';
import {resetFreeDrive,stepFreeDrive} from './free-drive.js';
import {Particles,Skids,Post} from './fx.js';
import {Sfx} from './audio.js';
import {createCampusMap} from './campus-map.js';
const $=id=>document.getElementById(id);
const Q=new URLSearchParams(location.search),rnd=rng(99);
const angDiff=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
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
let qual = clamp(parseInt(Q.get('q') || (matchMedia('(pointer:coarse)').matches?'2':'1'), 10) || 0, 0, 2), slowT = 0, ema = 16;
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


const sfx=new Sfx(),stepper=new FixedStepper(),v2=new THREE.Vector2(),v3=new THREE.Vector3();
const P={body:new Vehicle({groundAt:gAt,surfaceAt:surfAt}),shake:0,steer:0};
const ev={J:0,hit:0};
let dust,skids,atlas,mode='load',T=0,last=0,lastHud=-1,lookYaw=0,lookPitch=0,streetCamera=false,drag=null;
const keymap={KeyW:'up',ArrowUp:'up',KeyS:'down',ArrowDown:'down',KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right',ShiftLeft:'drift',ShiftRight:'drift'};
const keys={},pressed=new Map();
function updateKeys(){for(const k of Object.values(keymap))keys[k]=false;for(const k of pressed.values())keys[k]=true;}
function clearInputs(){pressed.clear();updateKeys();drag=null;document.querySelectorAll('.held').forEach(b=>b.classList.remove('held'));}
function stopMotion(){clearInputs();stepper.reset();sfx.quiet();last=0;}
function cameraMode(){streetCamera=!streetCamera;P.mesh.visible=!streetCamera;P.mesh.userData.ao.visible=!streetCamera;lookYaw=0;lookPitch=0;cam.snap=true;$('cameraToggle').textContent=streetCamera?'Camera · Street level':'Camera · Chase';}
function openMap(){
  if(!atlas||mode==='atlas')return;
  if($('pause').open)$('pause').close();
  stopMotion();mode='atlas';$('atlas').showModal();atlas.show(P,pose=>{
    if(!resetFreeDrive(P,pose,W.access))return false;
    skids.clear();cam.snap=true;lookYaw=0;lookPitch=0;closeOverlays();lastHud=-1;return true;
  });$('atlasClose').focus({preventScroll:true});
}
function closeOverlays(){if(mode==='load')return;atlas.hide();for(const d of ['pause','atlas'])if($(d).open)$(d).close();mode='drive';last=0;clearInputs();}
function pauseDrive(){if(mode!=='drive')return;stopMotion();mode='pause';$('pause').showModal();$('resume').focus({preventScroll:true});}
$('mapBtn').onclick=openMap;$('openAtlas').onclick=openMap;$('atlasClose').onclick=closeOverlays;$('pauseBtn').onclick=pauseDrive;$('resume').onclick=()=>{sfx.init();closeOverlays();};
$('mute').onclick=()=>{sfx.init();sfx.setMuted(!sfx.muted);$('mute').textContent=sfx.muted?'Sound off':'Sound on';};
$('cameraToggle').onclick=cameraMode;
for(const id of ['atlas','pause'])$(id).addEventListener('cancel',e=>{e.preventDefault();closeOverlays();});
addEventListener('keydown',e=>{
  if(mode==='load'||e.isComposing||e.ctrlKey||e.metaKey||e.altKey||e.target.matches('input,textarea,select'))return;
  if(e.code==='KeyM'&&!e.repeat){e.preventDefault();if(mode==='atlas')closeOverlays();else openMap();return;}
  if(e.code==='Escape'&&mode==='drive'){e.preventDefault();pauseDrive();return;}
  if(mode!=='drive')return;
  if(e.code==='KeyC'&&!e.repeat){cameraMode();return;}
  if(keymap[e.code]){e.preventDefault();if(!pressed.has(e.code)){sfx.init();pressed.set(e.code,keymap[e.code]);updateKeys();}}
});
addEventListener('keyup',e=>{if(pressed.delete(e.code)){e.preventDefault();updateKeys();}});
addEventListener('blur',pauseDrive);document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseDrive();});
for(const b of document.querySelectorAll('[data-drive]')){
  b.onpointerdown=e=>{if(mode!=='drive')return;e.preventDefault();sfx.init();pressed.set(e.pointerId,b.dataset.drive);updateKeys();b.classList.add('held');b.setPointerCapture(e.pointerId);};
  const release=e=>{pressed.delete(e.pointerId);updateKeys();if(!keys[b.dataset.drive])b.classList.remove('held');};
  b.onpointerup=b.onpointercancel=b.onlostpointercapture=release;
}
const gl=$('gl');gl.style.touchAction='none';
gl.onpointerdown=e=>{if(mode!=='drive'||!e.isPrimary||e.button!==0)return;drag={id:e.pointerId,x:e.clientX,y:e.clientY,yaw:lookYaw,pitch:lookPitch};gl.setPointerCapture(e.pointerId);};
gl.onpointermove=e=>{if(drag?.id===e.pointerId){lookYaw=drag.yaw+(e.clientX-drag.x)*.006;lookPitch=clamp(drag.pitch+(e.clientY-drag.y)*.006,-.75,.85);}};
gl.onpointerup=gl.onpointercancel=()=>{drag=null;};gl.ondblclick=()=>{lookYaw=0;lookPitch=0;cam.snap=true;};
function effects(dt) {
  const b = P.body, s = Math.sin(P.th), c = Math.cos(P.th), spd = Math.hypot(P.vx, P.vz), gy = gAt(P.x, P.z, P.body.y - RIDE), grounded = b.contacts > 0;
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
  dust.update(dt, sc);
  P.shake = Math.max(0, P.shake - dt * 2.4);
  sfx.update(clamp(spd / b.parameters.maxSpeed, 0, 1.2), keys.up && mode === 'drive' ? 1 : 0, b.driftActive ? clamp(Math.abs(P.vl) / 7, 0, 1) * (grounded ? 1 : 0) : 0, grounded, surf === 0, false);
}


const cam = { pos: new THREE.Vector3(), look: new THREE.Vector3(), yaw: 0, y: 0, snap: true };
function updateCamera(dt) {
  const gy = gAt(P.x, P.z, P.body.y - RIDE);
  const spd = Math.hypot(P.vx, P.vz);
  const ty = spd > 4 && P.vf > 0 ? P.th + angDiff(Math.atan2(P.vx, P.vz), P.th) * .55 : P.th; // lean toward the travel direction: drifts show their slip angle
  if (cam.snap) { cam.yaw = P.th; cam.y = gy; }
  cam.yaw += angDiff(ty, cam.yaw) * (1 - Math.exp(-dt * 5.5));
  cam.y += (gy * .7 + (P.body.y - RIDE) * .3 - cam.y) * (1 - Math.exp(-dt * 5)); // follows the ground more than the kart, so a jump reads as a jump
  const s = Math.sin(cam.yaw + lookYaw), c = Math.cos(cam.yaw + lookYaw), back = 6.9 + clamp(spd / 30, 0, 1) * 1.7;
  v3.set(P.x - s * back, cam.y + 3.1 + lookPitch*2.8, P.z - c * back);
  v3.y = Math.max(v3.y, gAt(v3.x, v3.z, P.body.y - RIDE) + 1.1);
  if (cam.snap) { cam.pos.copy(v3); cam.snap = false; } else cam.pos.lerp(v3, 1 - Math.exp(-dt * 10));
  camera.position.copy(cam.pos);
  if (P.shake > 0) { camera.position.x += (Math.random() - .5) * P.shake * .45; camera.position.y += (Math.random() - .5) * P.shake * .45; }
  cam.look.set(P.x + s * 4.5, cam.y + 1.1 - lookPitch + (P.body.y - RIDE - gy) * .45, P.z + c * 4.5);
  if (streetCamera) {
    const yaw=P.th+lookYaw, faceX=Math.sin(yaw),faceZ=Math.cos(yaw),eyeY=gy+2.05;
    camera.position.set(P.x+Math.sin(P.th)*.95,eyeY,P.z+Math.cos(P.th)*.95);
    cam.look.set(camera.position.x+faceX*8,eyeY-lookPitch*5,camera.position.z+faceZ*8);
  }
  camera.lookAt(cam.look);
  camera.rotateZ(clamp(-P.wy * .035, -.08, .08));
  const fov = 60 + clamp(spd / 34, 0, 1) * 9;
  if (Math.abs(camera.fov - fov) > .05) { camera.fov += (fov - camera.fov) * Math.min(1, dt * 4); camera.updateProjectionMatrix(); }
}


function tick(dt){
  if(mode==='load')return;
  if(mode==='drive'){
    T+=dt;
    stepper.advance(dt,step=>{
      const hit=stepFreeDrive(P,step,keys);
      ev.J=Math.max(ev.J,hit.impact);ev.hit=Math.max(ev.hit,hit.wallHit);
      if(hit.recovered)cam.snap=true;
    });
    poseKart(P.mesh,P,dt,T);effects(dt);updateCamera(dt);
    if(lastHud<0||T-lastHud>.09){lastHud=T;atlas.update(P);$('speed').textContent=String(Math.round(Math.hypot(P.vx,P.vz)*3.6));$('notice').hidden=P.flipT<=.2;if(P.flipT>.2)$('notice').textContent='Righting the kart…';}
  }
  sun.target.position.set(P.x,gAt(P.x,P.z),P.z);sun.position.copy(sun.target.position).addScaledVector(W.sun,300);
  updateWorld(T,camera);
  if(post.ok&&qual<2)post.render(scene,camera,clamp((Math.hypot(P.vx,P.vz)-20)/25,0,.4),0,T);
  else renderer.render(scene,camera);
}
function frame(now){
  requestAnimationFrame(frame);
  const raw=last?(now-last)/1000:0;last=now;
  if(mode!=='drive')return;
  if(raw>0&&raw<1){ema+=(raw*1000-ema)*.06;slowT=ema>28?slowT+raw:0;if(slowT>2&&qual<2){qual++;slowT=0;ema=16;applyQuality();}}
  tick(Math.min(raw,.12));
}
async function init(){
  applyQuality();let count=0;
  const views=fetch(new URL('../data/road-views.json',import.meta.url)).then(r=>{if(!r.ok)throw Error('Street view index unavailable');return r.json();});
  const [,panoramas]=await Promise.all([loadWorld(scene,renderer,msg=>{$('loadMsg').textContent=msg+'…';$('loadProgress').value=Math.min(94,8+count++*12);}),views]);
  dust=new Particles(scene,420,false);skids=new Skids(scene);
  P.mesh=makeNubzuki(scene,{body:0x2f95e8,accent:0xf4f4f4,helmet:0xffffff});
  atlas=createCampusMap(W,panoramas);
  if(!resetFreeDrive(P,atlas.initialPose(),W.access))throw Error('Main gate road is obstructed.');
  $('drive').hidden=false;mode='drive';tick(0);$('loading').hidden=true;requestAnimationFrame(frame);
}
init().catch(e=>{console.error(e);$('loading').hidden=false;$('loadMsg').textContent='The campus could not load. '+e.message;$('loadProgress').hidden=true;});
