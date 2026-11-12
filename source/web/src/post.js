// HDR post pipeline: MSAA half-float scene target -> thresholded mip-chain bloom -> filmic grade/composite.
// The internal scene target is ALWAYS created at the size reported in `post.size` (shown in the HUD and benchmark),
// so a reduced-resolution profile can never be mistaken for native rendering.
import * as THREE from 'three';

const VERT = /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

function pass(frag, uniforms) {
  return new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false, toneMapped: false });
}

export class Post {
  constructor(renderer) {
    this.r = renderer;
    this.size = new THREE.Vector2(1, 1);
    this.samples = 4;
    this.levels = 6;
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const tri = new THREE.BufferGeometry();
    tri.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    tri.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2));
    this.quad = new THREE.Mesh(tri, null); this.quad.frustumCulled = false;
    this.qscene = new THREE.Scene(); this.qscene.add(this.quad);

    this.mPre = pass(/* glsl */`
      varying vec2 vUv; uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uThreshold; uniform float uKnee;
      vec3 pre(vec3 c){ c = min(c, vec3(60.0)); float br = max(c.r, max(c.g, c.b)); float soft = clamp(br - uThreshold + uKnee, 0.0, 2.0 * uKnee);
        soft = soft * soft / (4.0 * uKnee + 1e-4); float contrib = max(soft, br - uThreshold) / max(br, 1e-4); return c * contrib; }
      void main(){ vec3 s = vec3(0.0);
        s += pre(texture2D(tSrc, vUv + uTexel * vec2(-1.0, -1.0)).rgb); s += pre(texture2D(tSrc, vUv + uTexel * vec2(1.0, -1.0)).rgb);
        s += pre(texture2D(tSrc, vUv + uTexel * vec2(-1.0, 1.0)).rgb); s += pre(texture2D(tSrc, vUv + uTexel * vec2(1.0, 1.0)).rgb);
        gl_FragColor = vec4(s * 0.25, 1.0); }`, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uThreshold: { value: 1.0 }, uKnee: { value: 0.6 } });

    this.mDown = pass(/* glsl */`
      varying vec2 vUv; uniform sampler2D tSrc; uniform vec2 uTexel;
      void main(){ vec2 t = uTexel; vec3 a = texture2D(tSrc, vUv + t * vec2(-2, 2)).rgb, b = texture2D(tSrc, vUv + t * vec2(0, 2)).rgb, c = texture2D(tSrc, vUv + t * vec2(2, 2)).rgb;
        vec3 d = texture2D(tSrc, vUv + t * vec2(-2, 0)).rgb, e = texture2D(tSrc, vUv).rgb, f = texture2D(tSrc, vUv + t * vec2(2, 0)).rgb;
        vec3 g = texture2D(tSrc, vUv + t * vec2(-2, -2)).rgb, h = texture2D(tSrc, vUv + t * vec2(0, -2)).rgb, i = texture2D(tSrc, vUv + t * vec2(2, -2)).rgb;
        vec3 j = texture2D(tSrc, vUv + t * vec2(-1, 1)).rgb, k = texture2D(tSrc, vUv + t * vec2(1, 1)).rgb, l = texture2D(tSrc, vUv + t * vec2(-1, -1)).rgb, m = texture2D(tSrc, vUv + t * vec2(1, -1)).rgb;
        vec3 o = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
        gl_FragColor = vec4(o, 1.0); }`, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } });

    this.mUp = pass(/* glsl */`
      varying vec2 vUv; uniform sampler2D tSrc; uniform sampler2D tBase; uniform vec2 uTexel; uniform float uRadius;
      void main(){ vec2 t = uTexel * uRadius; vec3 s = texture2D(tSrc, vUv).rgb * 4.0;
        s += (texture2D(tSrc, vUv + vec2(t.x, 0)).rgb + texture2D(tSrc, vUv - vec2(t.x, 0)).rgb + texture2D(tSrc, vUv + vec2(0, t.y)).rgb + texture2D(tSrc, vUv - vec2(0, t.y)).rgb) * 2.0;
        s += texture2D(tSrc, vUv + t).rgb + texture2D(tSrc, vUv - t).rgb + texture2D(tSrc, vUv + vec2(t.x, -t.y)).rgb + texture2D(tSrc, vUv + vec2(-t.x, t.y)).rgb;
        gl_FragColor = vec4(texture2D(tBase, vUv).rgb + s / 16.0, 1.0); }`, { tSrc: { value: null }, tBase: { value: null }, uTexel: { value: new THREE.Vector2() }, uRadius: { value: 1.0 } });

    this.mFinal = pass(/* glsl */`
      varying vec2 vUv; uniform sampler2D tScene; uniform sampler2D tBloom; uniform vec2 uRes; uniform float uBloom; uniform float uExposure;
      uniform float uFrame; uniform float uGrain; uniform float uCA; uniform float uVignette; uniform vec3 uLift; uniform vec3 uTint; uniform float uFlash; uniform float uLevels;
      float h(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
      // ACES fitted (Stephen Hill), keeps saturated neon from clipping to white too early
      vec3 aces(vec3 c){ const mat3 mi = mat3(0.59719, 0.07600, 0.02840, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777);
        const mat3 mo = mat3(1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602);
        c = mi * c; vec3 a = c * (c + 0.0245786) - 0.000090537; vec3 b = c * (0.983729 * c + 0.4329510) + 0.238081; return clamp(mo * (a / b), 0.0, 1.0); }
      void main(){
        vec2 d = vUv - 0.5; float r2 = dot(d, d);
        vec2 off = d * r2 * uCA;                                    // lateral chromatic aberration grows toward the corners only
        vec3 c; c.r = texture2D(tScene, vUv - off).r; c.g = texture2D(tScene, vUv).g; c.b = texture2D(tScene, vUv + off).b;
        vec3 bl = texture2D(tBloom, vUv).rgb / uLevels;
        c += bl * uBloom;
        c *= uExposure * (1.0 + uFlash);
        c = c * uTint + uLift * (1.0 - clamp(dot(c, vec3(0.3333)) * 2.0, 0.0, 1.0));
        c *= 1.0 - uVignette * smoothstep(0.18, 0.85, r2 * 1.9);
        c = aces(c);
        c = pow(c, vec3(1.0 / 2.2));
        float g = h(gl_FragCoord.xy + vec2(uFrame * 37.0, uFrame * 91.0)) - 0.5;   // frame-indexed: deterministic in capture
        c += g * uGrain * (1.0 - 0.6 * dot(c, vec3(0.3333)));
        gl_FragColor = vec4(c, 1.0); }`, {
      tScene: { value: null }, tBloom: { value: null }, uRes: { value: new THREE.Vector2() }, uBloom: { value: 0.9 }, uExposure: { value: 1.0 }, uFrame: { value: 0 },
      uGrain: { value: 0.013 }, uCA: { value: 0.0035 }, uVignette: { value: 0.55 }, uLift: { value: new THREE.Color(0.0, 0.0, 0.0) }, uTint: { value: new THREE.Color(1, 1, 1) }, uFlash: { value: 0 }, uLevels: { value: 6 },
    });
    this.rtScene = null; this.mips = []; this.ups = [];
  }

  setSize(w, h, samples) {
    w = Math.max(2, Math.floor(w)); h = Math.max(2, Math.floor(h));
    if (this.rtScene && this.size.x === w && this.size.y === h && this.samples === samples) return;
    this.size.set(w, h); this.samples = samples;
    this.dispose();
    const opt = { type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, stencilBuffer: false };
    this.rtScene = new THREE.WebGLRenderTarget(w, h, { ...opt, depthBuffer: true, samples });
    let mw = w, mh = h;
    for (let i = 0; i < this.levels; i++) {
      mw = Math.max(2, mw >> 1); mh = Math.max(2, mh >> 1);
      this.mips.push(new THREE.WebGLRenderTarget(mw, mh, opt));
      this.ups.push(new THREE.WebGLRenderTarget(mw, mh, opt));
    }
    this.mFinal.uniforms.uRes.value.set(w, h); this.mFinal.uniforms.uLevels.value = this.levels;
  }

  dispose() { if (this.rtScene) this.rtScene.dispose(); this.mips.forEach((m) => m.dispose()); this.ups.forEach((m) => m.dispose()); this.mips = []; this.ups = []; this.rtScene = null; }

  memoryMB() {          // rough render-target memory (RGBA16F = 8 B/px; MSAA colour+depth counted per sample)
    const px = this.size.x * this.size.y, s = Math.max(1, this.samples);
    let b = px * 8 + (s > 1 ? px * s * 8 : 0) + px * s * 4;
    for (const m of this.mips) b += m.width * m.height * 8 * 2;
    return b / 1048576;
  }

  _blit(mat, target) { this.quad.material = mat; this.r.setRenderTarget(target); this.r.render(this.qscene, this.cam); }

  render(scene, camera, frame) {
    const r = this.r;
    r.setRenderTarget(this.rtScene); r.clear(); r.render(scene, camera);
    // bloom
    let src = this.rtScene;
    this.mPre.uniforms.tSrc.value = src.texture; this.mPre.uniforms.uTexel.value.set(0.5 / src.width, 0.5 / src.height);
    this._blit(this.mPre, this.mips[0]);
    for (let i = 1; i < this.levels; i++) {
      this.mDown.uniforms.tSrc.value = this.mips[i - 1].texture; this.mDown.uniforms.uTexel.value.set(1 / this.mips[i - 1].width, 1 / this.mips[i - 1].height);
      this._blit(this.mDown, this.mips[i]);
    }
    let acc = this.mips[this.levels - 1];
    for (let i = this.levels - 2; i >= 0; i--) {
      this.mUp.uniforms.tSrc.value = acc.texture; this.mUp.uniforms.tBase.value = this.mips[i].texture; this.mUp.uniforms.uTexel.value.set(1 / acc.width, 1 / acc.height);
      this._blit(this.mUp, this.ups[i]); acc = this.ups[i];
    }
    const u = this.mFinal.uniforms; u.tScene.value = this.rtScene.texture; u.tBloom.value = acc.texture; u.uFrame.value = frame % 4096;
    this._blit(this.mFinal, null);
  }
}
