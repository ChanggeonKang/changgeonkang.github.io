// Visual effects: particles, skid marks, HDR post-processing.
import * as THREE from '../lib/three.module.min.js';

export class Particles {
  constructor(scene, n = 420, additive = false) {
    this.n = n; this.i = 0;
    this.pos = new Float32Array(n * 3); this.col = new Float32Array(n * 4); this.size = new Float32Array(n);
    this.vel = new Float32Array(n * 3); this.life = new Float32Array(n); this.max = new Float32Array(n);
    this.grow = new Float32Array(n); this.grav = new Float32Array(n); this.a0 = new Float32Array(n); this.drag = new Float32Array(n);
    const g = this.geo = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('aCol', new THREE.BufferAttribute(this.col, 4));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { uScale: { value: 600 } },
      vertexShader: `attribute vec4 aCol; attribute float aSize; varying vec4 vCol; uniform float uScale;
        void main(){ vCol = aCol; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = aSize * uScale / max(0.1, -mv.z); }`,
      fragmentShader: `varying vec4 vCol;
        void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.12, d) * vCol.a; if (a < 0.004) discard;
          gl_FragColor = vec4(vCol.rgb, a);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.mesh = new THREE.Points(g, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = 5;
    scene.add(this.mesh);
  }
  emit(x, y, z, vx, vy, vz, life, size, grow, r, g, b, a, grav = 0, drag = 1.5) {
    const i = this.i; this.i = (i + 1) % this.n;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.life[i] = this.max[i] = life; this.size[i] = size; this.grow[i] = grow; this.grav[i] = grav; this.a0[i] = a; this.drag[i] = drag;
    this.col[i * 4] = r; this.col[i * 4 + 1] = g; this.col[i * 4 + 2] = b; this.col[i * 4 + 3] = a;
  }
  update(dt, scale) {
    this.mat.uniforms.uScale.value = scale;
    const { pos, vel, life, size, col } = this;
    for (let i = 0; i < this.n; i++) {
      if (life[i] <= 0) continue;
      life[i] -= dt;
      if (life[i] <= 0) { size[i] = 0; col[i * 4 + 3] = 0; continue; }
      const d = Math.exp(-this.drag[i] * dt);
      vel[i * 3] *= d; vel[i * 3 + 2] *= d; vel[i * 3 + 1] = vel[i * 3 + 1] * d - this.grav[i] * dt;
      pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      size[i] += this.grow[i] * dt;
      col[i * 4 + 3] = this.a0[i] * Math.min(1, life[i] / this.max[i] * 1.6);
    }
    this.geo.attributes.position.needsUpdate = this.geo.attributes.aCol.needsUpdate = this.geo.attributes.aSize.needsUpdate = true;
  }
}

/** Tyre-less belly skid marks: a ring buffer of dark quads laid on the road. */
export class Skids {
  constructor(scene, max = 700) {
    this.max = max; this.i = 0; this.count = 0; this.last = [null, null];
    this.pos = new Float32Array(max * 18);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setDrawRange(0, 0);
    this.mesh = new THREE.Mesh(this.geo, new THREE.MeshBasicMaterial({ color: 0x0c0c0e, transparent: true, opacity: .38, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -8, polygonOffsetUnits: -8 }));
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 1;
    scene.add(this.mesh);
  }
  add(side, x, y, z, nx, nz, hw) {
    const cur = [x + nx * hw, y, z + nz * hw, x - nx * hw, y, z - nz * hw], l = this.last[side];
    if (l && (l[0] - cur[0]) ** 2 + (l[2] - cur[2]) ** 2 < 9) {
      const o = this.i * 18, p = this.pos;
      p.set([l[0], l[1], l[2], l[3], l[4], l[5], cur[0], cur[1], cur[2], l[3], l[4], l[5], cur[3], cur[4], cur[5], cur[0], cur[1], cur[2]], o);
      this.i = (this.i + 1) % this.max; this.count = Math.min(this.max, this.count + 1);
      this.geo.attributes.position.needsUpdate = true; this.geo.setDrawRange(0, this.count * 6);
    }
    this.last[side] = cur;
  }
  stop() { this.last[0] = this.last[1] = null; }
  clear() { this.count = 0; this.i = 0; this.geo.setDrawRange(0, 0); this.stop(); }
}

/** HDR render target → speed blur, filmic tone map, grade, vignette. */
export class Post {
  constructor(renderer) {
    this.r = renderer;
    this.ok = renderer.capabilities.isWebGL2 && (renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float'));
    if (!this.ok) return;
    this.rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.mat = new THREE.ShaderMaterial({
      depthTest: false, depthWrite: false, toneMapped: false,
      uniforms: { tD: { value: this.rt.texture }, uBlur: { value: 0 }, uBoost: { value: 0 }, uTime: { value: 0 }, uExposure: { value: 1.0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `
        uniform sampler2D tD; uniform float uBlur, uBoost, uTime, uExposure; varying vec2 vUv;
        float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
        vec3 aces(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
        void main(){
          vec2 c = vUv - 0.5; float r2 = dot(c, c);
          float amt = (uBlur * 0.16 + uBoost * 0.10) * smoothstep(0.02, 0.5, r2);
          vec3 col = vec3(0.0);
          for (int i = 0; i < 10; i++) col += texture2D(tD, vUv - c * amt * (float(i) / 9.0)).rgb;
          col /= 10.0;
          float ca = 0.006 * uBoost;
          col.r = mix(col.r, texture2D(tD, vUv - c * ca).r, 0.6 * uBoost);
          col.b = mix(col.b, texture2D(tD, vUv + c * ca).b, 0.6 * uBoost);
          col = aces(col * uExposure);
          col = pow(col, vec3(1.0 / 2.2));
          float l = dot(col, vec3(0.299, 0.587, 0.114));
          col = mix(vec3(l), col, 1.14);
          col = (col - 0.5) * 1.06 + 0.5;
          col *= 1.0 - r2 * (0.5 + 0.35 * uBoost);
          col += (h21(vUv * 913.0 + uTime) - 0.5) * (1.6 / 255.0);
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat); this.quad.frustumCulled = false;
    this.scene = new THREE.Scene(); this.scene.add(this.quad);
  }
  setSize(w, h, samples) { if (this.ok) { this.rt.samples = samples; this.rt.setSize(w, h); } }
  render(scene, camera, blur, boost, time) {
    const r = this.r, u = this.mat.uniforms;
    u.uBlur.value = blur; u.uBoost.value = boost; u.uTime.value = time % 10;
    r.setRenderTarget(this.rt); r.render(scene, camera);
    r.setRenderTarget(null); r.render(this.scene, this.cam);
  }
}
