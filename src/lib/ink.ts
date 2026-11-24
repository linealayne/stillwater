/*
 * The ink. One fixed, full-viewport WebGL2 canvas that sits above the page.
 *
 *  - A low-res reaction-diffusion field (Fisher-KPP style front propagation with a
 *    noisy reaction rate) is the fluid: it floods, erodes, and relaxes toward targets.
 *  - A full-res composite pass turns that field into glossy black ooze (bevelled
 *    normals, specular, soft-box reflection), merges in analytic tendrils, and renders
 *    the dripping headline text underneath the ink.
 */

const VERT = `#version 300 es
in vec2 aPos;
out vec2 vUv;   // y-down screen uv
out vec2 vTc;   // raw framebuffer/texture coords
void main(){
  vTc = aPos * 0.5 + 0.5;
  vUv = vec2(vTc.x, 1.0 - vTc.y);
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const NOISE = `
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p){ return vnoise(p) * 0.58 + vnoise(p * 2.13 + 7.1) * 0.29 + vnoise(p * 4.31 + 3.7) * 0.13; }
`;

const SIM_FRAG = `#version 300 es
precision highp float;
uniform sampler2D uPrev;
uniform vec2 uTexel;
uniform float uAspect, uTime;
uniform float uReact, uRelax, uFloor, uFill, uEdge;
uniform vec3 uCursor;
uniform vec4 uRing;
uniform vec3 uSink;
uniform vec4 uSplat[24];
uniform int uSplatN;
in vec2 vUv; in vec2 vTc;
out vec4 o;
${NOISE}
float target(vec2 uv, vec2 p){
  float T = 0.0;
  if (uEdge > 0.0) {
    float d = min(min(uv.x, 1.0 - uv.x) * uAspect, min(uv.y, 1.0 - uv.y));
    float n = fbm(p * 3.1 + vec2(uTime * 0.035, -uTime * 0.022));
    float n2 = vnoise(p * 8.5 - uTime * 0.06);
    float dx = min(uv.x, 1.0 - uv.x) * uAspect, dy = min(uv.y, 1.0 - uv.y);
    float along = dx < dy ? p.y : p.x + 3.0;
    float fing = pow(vnoise(vec2(along * 11.0, uTime * 0.09 + (dx < dy ? 0.0 : 5.0))), 5.0);
    float th = uEdge * (0.25 + 2.9 * pow(n, 2.4) + 0.7 * n2 * n + 3.4 * fing * (0.4 + n));
    vec2 c = vec2(uCursor.x * uAspect, uCursor.y);
    vec2 dc = p - c;
    th += uCursor.z * exp(-dot(dc, dc) / 0.075) * (0.5 + n);
    T = max(T, smoothstep(th, th * 0.4, d));
  }
  if (uRing.w > 0.0) {
    vec2 c = vec2(uRing.x * uAspect, uRing.y);
    vec2 dv = p - c;
    float ang = atan(dv.y, dv.x);
    float wob = (vnoise(vec2(ang * 2.2, uTime * 0.4)) - 0.5) * uRing.w * 1.3 * smoothstep(0.0, 0.15, uRing.z);
    float d = abs(length(dv) - uRing.z + wob);
    T = max(T, smoothstep(uRing.w, uRing.w * 0.35, d));
  }
  return T;
}
void main(){
  vec2 p = vec2(vUv.x * uAspect, vUv.y);
  float h = texture(uPrev, vTc).r;
  float b = (texture(uPrev, vTc + vec2(uTexel.x, 0.0)).r + texture(uPrev, vTc - vec2(uTexel.x, 0.0)).r
           + texture(uPrev, vTc + vec2(0.0, uTexel.y)).r + texture(uPrev, vTc - vec2(0.0, uTexel.y)).r) * 0.2 + h * 0.2;
  float n = fbm(p * 5.2 + vec2(1.7, uTime * 0.07));
  float s = mix(0.1, 1.0, clamp(n * n * 2.1, 0.0, 1.0));
  float r = uReact * s;
  if (uReact < 0.0 && uSink.z > 0.0) {
    r *= mix(0.08, 1.0, smoothstep(0.02, 0.55, distance(p, vec2(uSink.x * uAspect, uSink.y))));
  }
  float v = b + r * 4.0 * b * (1.0 - b);
  for (int i = 0; i < 24; i++) {
    if (i >= uSplatN) break;
    vec4 sp = uSplat[i];
    float d = distance(p, vec2(sp.x * uAspect, sp.y));
    v += sp.w * smoothstep(sp.z, sp.z * 0.35, d);
  }
  float T = target(vUv, p);
  v = mix(v, T, uRelax);
  if (uFill > 0.0) v = max(v, uFill);
  else if (uFill < 0.0) v = min(v, 1.0 + uFill);
  v = max(v, T * uFloor);
  o = vec4(clamp(v, 0.0, 1.0), 0.0, 0.0, 1.0);
}`;

const COMP_FRAG = `#version 300 es
precision highp float;
uniform sampler2D uSim;
uniform vec2 uSimSize, uRes;
uniform float uDpr, uTime, uAccent, uInkOn;
uniform vec3 uT[63];
uniform int uTN;
uniform vec4 uTBox;
uniform sampler2D uText;
uniform vec4 uTextRect;
uniform float uTextOn, uClipY, uDrip, uLineH;
uniform vec3 uPull;
out vec4 o;
${NOISE}
bool gBox;
vec4 cubic(float v){
  vec4 n = vec4(1.0, 2.0, 3.0, 4.0) - v; vec4 s = n * n * n;
  float x = s.x; float y = s.y - 4.0 * s.x; float z = s.z - 4.0 * s.y + 6.0 * s.x; float w = 6.0 - x - y - z;
  return vec4(x, y, z, w) / 6.0;
}
float bicubic(vec2 tc){
  vec2 st = tc * uSimSize - 0.5; vec2 f = fract(st); st -= f;
  vec4 xc = cubic(f.x), yc = cubic(f.y);
  vec4 c = st.xxyy + vec2(-0.5, 1.5).xyxy;
  vec4 s = vec4(xc.xz + xc.yw, yc.xz + yc.yw);
  vec4 off = (c + vec4(xc.yw, yc.yw) / s) / uSimSize.xxyy;
  float s0 = texture(uSim, off.xz).r, s1 = texture(uSim, off.yz).r, s2 = texture(uSim, off.xw).r, s3 = texture(uSim, off.yw).r;
  float sx = s.x / (s.x + s.y), sy = s.z / (s.z + s.w);
  return mix(mix(s3, s2, sx), mix(s1, s0, sx), sy);
}
float smin(float a, float b, float k){ float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0); return mix(b, a, h) - k * h * (1.0 - h); }
float sdTendrils(vec2 p){
  float d = 1e5;
  for (int t = 0; t < 8; t++) {
    if (t >= uTN) break;
    for (int i = 0; i < 8; i++) {
      vec3 a = uT[t * 9 + i], b = uT[t * 9 + i + 1];
      vec2 pa = p - a.xy, ba = b.xy - a.xy;
      float hh = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-4), 0.0, 1.0);
      d = smin(d, length(pa - ba * hh) - mix(a.z, b.z, hh), 7.0);
    }
  }
  return d;
}
float field(vec2 p){
  float F = 0.0;
  if (uInkOn > 0.5) { vec2 uv = p * uDpr / uRes; F = bicubic(vec2(uv.x, 1.0 - uv.y)); }
  if (gBox) { float ft = clamp(0.5 - sdTendrils(p) / 13.0, 0.0, 1.0); F = max(F, ft) + 0.35 * min(F, ft); }
  return min(F, 1.0);
}
float height(float F){ return smoothstep(0.5, 1.0, F); }
float textSample(vec2 uvt){
  if (uvt.x < 0.0 || uvt.x > 1.0 || uvt.y < 0.0 || uvt.y > 1.0) return 0.0;
  return texture(uText, uvt).r;
}
vec4 textLayer(vec2 p){
  if (p.y > uClipY) return vec4(0.0);
  vec2 q = p;
  vec2 dc = uPull.xy - q;
  float R = uLineH * 1.1 + 90.0;
  float infl = uPull.z * exp(-dot(dc, dc) / (R * R));
  q -= dc * infl * 0.42;
  float lineH = uLineH;
  if (q.x < uTextRect.x - 4.0 || q.x > uTextRect.x + uTextRect.z + 4.0 || q.y < uTextRect.y - 4.0 || q.y > uTextRect.y + uTextRect.w + lineH * 1.6) return vec4(0.0);
  float col = q.x * 6.0 / uTextRect.z;
  float n = vnoise(vec2(col * 6.3, 3.7));
  float n2 = vnoise(vec2(col * 21.0, 9.1));
  float dx = (q.x - uPull.x) / (R * 0.8);
  float local = uDrip + uPull.z * 0.34 * exp(-dx * dx);
  float L = lineH * local * pow(n, 4.0) * (0.45 + 1.1 * n2);
  vec2 uvt = (q - uTextRect.xy) / uTextRect.zw;
  float cov = textSample(uvt);
  if (L > 0.5) {
    float m = 0.0;
    for (int k = 1; k <= 14; k++) {
      float f = float(k) / 14.0;
      m = max(m, textSample(uvt - vec2(0.0, f * L / uTextRect.w)));
    }
    cov = max(cov, m);
  }
  vec3 bone = vec3(0.914, 0.898, 0.855);
  return vec4(bone * cov, cov);
}
void main(){
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uDpr;
  vec4 base = vec4(0.0);
  if (uTextOn > 0.5) base = textLayer(p);
  float hs = 0.0;
  if (uInkOn > 0.5) { vec2 uv = p * uDpr / uRes; hs = texture(uSim, vec2(uv.x, 1.0 - uv.y)).r; }
  gBox = uTN > 0 && p.x > uTBox.x && p.y > uTBox.y && p.x < uTBox.z && p.y < uTBox.w;
  if (hs < 0.004 && !gBox) { o = base; return; }
  float F, H; vec2 g = vec2(0.0);
  if (hs > 0.9985 && !gBox) { F = 1.0; H = 1.0; }
  else {
    float e = 1.5;
    F = field(p); H = height(F);
    g = vec2(height(field(p + vec2(e, 0.0))) - H, height(field(p + vec2(0.0, e))) - H) / e;
  }
  vec2 q = p * vec2(0.0016, 0.0046);
  float f1 = fbm(q + vec2(uTime * 0.04, uTime * 0.013));
  float f2 = fbm(q * 1.7 + vec2(4.1 - uTime * 0.03, 9.3));
  float rib = smoothstep(0.55, 0.562, f1) * smoothstep(0.66, 0.58, f1) * smoothstep(0.35, 0.6, f2);
  rib += smoothstep(0.40, 0.41, f2) * smoothstep(0.46, 0.42, f2) * smoothstep(0.5, 0.3, f1) * 0.6;
  vec3 n = normalize(vec3(-g * 10.0, 1.0));
  vec3 L = normalize(vec3(-0.45, -0.72, 0.55));
  vec3 Hh = normalize(L + vec3(0.0, 0.0, 1.0));
  float nh = max(dot(n, Hh), 0.0);
  float edge = 1.0 - H * 0.55;
  float nh2 = max(dot(n, normalize(vec3(0.5, 0.78, 0.45) + vec3(0.0, 0.0, 1.0))), 0.0);
  float spec = pow(nh, 80.0) * 1.15 + pow(nh2, 46.0) * 0.5;
  float soft = rib * 0.34 * H;
  vec3 r = reflect(vec3(0.0, 0.0, -1.0), n);
  float strip = smoothstep(0.30, 0.46, -r.y) * smoothstep(0.80, 0.58, -r.y) * smoothstep(0.75, 0.2, abs(r.x + 0.15));
  float rim = pow(1.0 - n.z, 2.2);
  vec3 col = vec3(0.004, 0.005, 0.004);
  col += vec3(0.95, 0.96, 0.92) * (spec + soft + strip * 0.22 * (1.0 - H));
  col += mix(vec3(0.42, 0.47, 0.47), vec3(0.72, 0.95, 0.05), uAccent) * rim * (gBox ? mix(0.30, 1.0, uAccent) : 0.34);
  float w = clamp(fwidth(F), 0.012, 0.07);
  float a = smoothstep(0.5 - w, 0.5 + w, F);
  float sh = smoothstep(0.12, 0.5, F) * 0.20 * (1.0 - uAccent);
  vec4 ink = vec4(col * a, a + sh * (1.0 - a));
  o = ink + base * (1.0 - ink.a);
}`;

type Mode = "none" | "flood" | "cover" | "recede" | "edges" | "drain";

interface Tendril {
  theta: number;
  phase: number;
  len: number;
  k: number;
  tx: number;
  ty: number;
  init: boolean;
}
interface Anchor {
  el: HTMLElement;
  ext: number;
  hover: boolean;
  auto: boolean;
  burst: number;
  tendrils: Tendril[];
}
interface Gob {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  r: number;
}

export interface TextSource {
  el: HTMLElement;
  clipEl: HTMLElement | null;
}

const K_T = 7;
const N_NODE = 9;

export class Ink {
  ok = false;
  private canvas: HTMLCanvasElement;
  private gl!: WebGL2RenderingContext;
  private simProg!: WebGLProgram;
  private compProg!: WebGLProgram;
  private su: Record<string, WebGLUniformLocation | null> = {};
  private cu: Record<string, WebGLUniformLocation | null> = {};
  private tex: WebGLTexture[] = [];
  private fbo: WebGLFramebuffer[] = [];
  private cur = 0;
  private simW = 0;
  private simH = 0;
  private w = 0;
  private h = 0;
  private dpr = 1;
  private half = false;
  private time = 0;
  private mode: Mode = "none";
  private mt = 0;
  private simLive = false;
  private dirty = true;
  private origin = { x: 0.5, y: 0.5 };
  private gobs: Gob[] = [];
  private holes: { x: number; y: number }[] = [];
  private anchors: Anchor[] = [];
  private tData = new Float32Array(63 * 3);
  private splats = new Float32Array(24 * 4);
  private onCovered: (() => void) | null = null;
  private onDone: (() => void) | null = null;
  private textTex: WebGLTexture | null = null;
  private textSrc: TextSource | null = null;
  private textOn = false;
  private textLineH = 100;
  pointer = { x: -9999, y: -9999, active: false };
  private pull = 0;
  private lastPX = 0;
  private lastPY = 0;
  private cursorPull = 0;
  drip = 0; // external (scroll) drip amount 0..1
  accent = 0;
  edge = 0.036;
  ring = { x: 0.5, y: 0.5, r: 0, w: 0 }; // viewport uv / height units
  edgeScale = 1;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const gl = canvas.getContext("webgl2", {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: "high-performance",
    });
    if (!gl) return;
    this.gl = gl;
    this.half = !!gl.getExtension("EXT_color_buffer_half_float") || !!gl.getExtension("EXT_color_buffer_float");
    try {
      this.simProg = this.program(VERT, SIM_FRAG);
      this.compProg = this.program(VERT, COMP_FRAG);
    } catch (e) {
      console.warn("[ink] shader failure", e);
      return;
    }
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    for (const prog of [this.simProg, this.compProg]) {
      const loc = gl.getAttribLocation(prog, "aPos");
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    }
    for (const n of ["uPrev", "uTexel", "uAspect", "uTime", "uReact", "uRelax", "uFloor", "uFill", "uEdge", "uCursor", "uRing", "uSink", "uSplat", "uSplatN"])
      this.su[n] = gl.getUniformLocation(this.simProg, n);
    for (const n of ["uSim", "uSimSize", "uRes", "uDpr", "uTime", "uAccent", "uInkOn", "uT", "uTN", "uTBox", "uText", "uTextRect", "uTextOn", "uClipY", "uDrip", "uLineH", "uPull"])
      this.cu[n] = gl.getUniformLocation(this.compProg, n);
    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
    this.ok = true;
    this.resize();
    canvas.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      this.ok = false;
    });
  }

  private program(vs: string, fs: string) {
    const gl = this.gl;
    const mk = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || "compile");
      return s;
    };
    const p = gl.createProgram()!;
    gl.attachShader(p, mk(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, "aPos");
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || "link");
    return p;
  }

  resize() {
    if (!this.ok) return;
    const gl = this.gl;
    const cw = this.canvas.clientWidth || window.innerWidth;
    const ch = this.canvas.clientHeight || window.innerHeight;
    let dpr = Math.min(window.devicePixelRatio || 1, cw < 700 ? 2 : 1.5);
    const maxPx = 2.7e6;
    if (cw * ch * dpr * dpr > maxPx) dpr = Math.sqrt(maxPx / (cw * ch));
    const widthChanged = Math.abs(cw - this.w) > 1;
    const heightChanged = Math.abs(ch - this.h) > 1;
    if (!widthChanged && !heightChanged && dpr === this.dpr) return;
    this.w = cw;
    this.h = ch;
    this.dpr = dpr;
    this.canvas.width = Math.round(cw * dpr);
    this.canvas.height = Math.round(ch * dpr);
    const long = 320;
    const sw = cw >= ch ? long : Math.max(96, Math.round((long * cw) / ch));
    const sh = cw >= ch ? Math.max(96, Math.round((long * ch) / cw)) : long;
    if (sw !== this.simW || sh !== this.simH) {
      const keepFull = this.mode === "cover";
      this.simW = sw;
      this.simH = sh;
      for (const t of this.tex) gl.deleteTexture(t);
      for (const f of this.fbo) gl.deleteFramebuffer(f);
      this.tex = [];
      this.fbo = [];
      for (let i = 0; i < 2; i++) {
        const t = gl.createTexture()!;
        gl.bindTexture(gl.TEXTURE_2D, t);
        if (this.half) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, sw, sh, 0, gl.RGBA, gl.HALF_FLOAT, null);
        else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, sw, sh, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        const f = gl.createFramebuffer()!;
        gl.bindFramebuffer(gl.FRAMEBUFFER, f);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
        gl.clearColor(keepFull ? 1 : 0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        this.tex.push(t);
        this.fbo.push(f);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    if (this.textSrc) this.buildText();
    this.dirty = true;
  }

  /* ---------- tendrils ---------- */

  attach(el: HTMLElement, auto = false) {
    const tendrils: Tendril[] = [];
    for (let i = 0; i < K_T; i++) {
      tendrils.push({
        theta: (i / K_T) * Math.PI * 2 + (Math.random() - 0.5) * 0.5 - Math.PI / 2,
        phase: Math.random() * 6.28,
        len: 0.6 + Math.random() * 0.4,
        k: 4.5 + Math.random() * 5,
        tx: 0,
        ty: 0,
        init: false,
      });
    }
    const a: Anchor = { el, ext: 0, hover: false, auto, burst: 0, tendrils };
    this.anchors.push(a);
    return {
      setHover: (v: boolean) => {
        a.hover = v;
      },
      burst: () => {
        a.burst = 1;
      },
      destroy: () => {
        this.anchors = this.anchors.filter((x) => x !== a);
        this.dirty = true;
      },
    };
  }

  private stepTendrils(dt: number): number {
    let best: Anchor | null = null;
    let bestRect: DOMRect | null = null;
    let bestProx = 0;
    const vh = window.innerHeight;
    for (const a of this.anchors) {
      const rect = a.el.getBoundingClientRect();
      const vis = rect.bottom > 0 && rect.top < vh && rect.width > 0 && +getComputedStyle(a.el).opacity > 0.5;
      let prox = 0;
      if (vis) {
        if (a.burst > 0) prox = 1;
        else if (a.hover) prox = 1;
        else if (this.pointer.active) {
          const dx = Math.max(rect.left - this.pointer.x, 0, this.pointer.x - rect.right);
          const dy = Math.max(rect.top - this.pointer.y, 0, this.pointer.y - rect.bottom);
          prox = Math.max(0, 1 - Math.hypot(dx, dy) / 300);
          prox = prox > 0 ? 0.25 + prox * 0.75 : 0;
        } else if (a.auto) {
          prox = 0.78 + 0.22 * Math.sin(this.time * 0.8);
        }
      }
      const rate = prox > a.ext ? 3.2 : 4.5;
      a.ext += (prox - a.ext) * (1 - Math.exp(-dt * rate));
      if (a.ext > 0.02 && vis && a.ext >= bestProx) {
        best = a;
        bestRect = rect;
        bestProx = a.ext;
      }
    }
    if (!best || !bestRect) return 0;
    const a = best;
    const rect = bestRect;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const hw = Math.max(rect.width / 2 - 3, 4);
    const hh = Math.max(rect.height / 2 - 3, 4);
    const capA = Math.max(hw - hh, 0);
    const usePointer = this.pointer.active && !a.auto;
    const px = usePointer ? this.pointer.x : cx + Math.cos(this.time * 0.5) * 200;
    const py = usePointer ? this.pointer.y : cy - 140 + Math.sin(this.time * 0.37) * 60;
    const vx = px - cx;
    const vy = py - cy;
    const vl = Math.hypot(vx, vy) || 1;
    const dEdge = Math.hypot(Math.max(rect.left - px, 0, px - rect.right), Math.max(rect.top - py, 0, py - rect.bottom));
    const splay = a.hover || a.burst > 0 || dEdge < 2 || (a.auto && !usePointer);
    const t = this.time;
    let minX = 1e9,
      minY = 1e9,
      maxX = -1e9,
      maxY = -1e9;
    const small = (this.w < 700 ? 0.72 : 1) * (a.auto && !usePointer ? 0.74 : 1);
    if (a.burst > 0) a.burst = Math.min(a.burst + dt * 2.5, 3);
    a.tendrils.forEach((td, i) => {
      const hx = Math.cos(td.theta);
      const hy = Math.sin(td.theta);
      // root sits on the pill's outline (a stadium), not its bounding box
      let tr = hh / Math.max(Math.abs(hy), 1e-3);
      if (Math.abs(tr * hx) > capA) {
        const dc = Math.abs(hx) * capA;
        tr = dc + Math.sqrt(Math.max(dc * dc - (capA * capA - hh * hh), 0));
      }
      const rx = cx + hx * tr;
      const ry = cy + hy * tr;
      let ax: number, ay: number, len: number;
      let reach = 1;
      if (splay) {
        const rot = 0.55 * Math.sin(t * 1.15 + td.phase) + 0.2 * Math.sin(t * 2.7 + td.phase * 2);
        ax = hx * Math.cos(rot) - hy * Math.sin(rot);
        ay = hx * Math.sin(rot) + hy * Math.cos(rot);
        len = (58 + 72 * td.len) * (0.72 + 0.28 * Math.sin(t * 1.9 + td.phase * 3)) * small * (1 + a.burst * 0.45);
      } else {
        const facing = Math.max(0, (hx * vx + hy * vy) / vl);
        const wgt = facing * facing;
        reach = Math.min(1, Math.max(0, (wgt - 0.06) / 0.4));
        const tcx = px - rx;
        const tcy = py - ry;
        const tl = Math.hypot(tcx, tcy) || 1;
        const mixv = 0.2 + 0.8 * wgt;
        ax = hx * (1 - mixv) + (tcx / tl) * mixv;
        ay = hy * (1 - mixv) + (tcy / tl) * mixv;
        const al = Math.hypot(ax, ay) || 1;
        ax /= al;
        ay /= al;
        const wob = 0.3 * Math.sin(t * 1.4 + td.phase);
        const c = Math.cos(wob),
          s = Math.sin(wob);
        const bx = ax * c - ay * s;
        ay = ax * s + ay * c;
        ax = bx;
        len = (24 + (Math.min(dEdge * 0.82, 240) - 24) * wgt) * td.len * (0.86 + 0.14 * Math.sin(t * 2.3 + td.phase)) * small;
        len = Math.max(len, 16);
      }
      const ext = Math.min(a.ext, 1);
      const gx = rx + ax * len * ext * reach;
      const gy = ry + ay * len * ext * reach;
      if (!td.init) {
        td.tx = rx;
        td.ty = ry;
        td.init = true;
      }
      const kk = 1 - Math.exp(-dt * td.k);
      td.tx += (gx - td.tx) * kk;
      td.ty += (gy - td.ty) * kk;
      const ddx = td.tx - rx;
      const ddy = td.ty - ry;
      const dl = Math.hypot(ddx, ddy);
      const bend = Math.sin(t * 2.1 + td.phase) * dl * 0.26;
      const mx = rx + hx * dl * 0.5 + (-ddy / (dl || 1)) * bend;
      const my = ry + hy * dl * 0.5 + (ddx / (dl || 1)) * bend;
      const grow = Math.min(1, ext * 2.2) * reach;
      for (let j = 0; j < N_NODE; j++) {
        const s = j / (N_NODE - 1);
        const u = 1 - s;
        const sw = Math.sin(s * 4.6 + t * 2.6 + td.phase * 1.7) * dl * 0.075 * s * (1 - s * 0.35);
        const x = u * u * rx + 2 * u * s * mx + s * s * td.tx + (-ddy / (dl || 1)) * sw;
        const y = u * u * ry + 2 * u * s * my + s * s * td.ty + (ddx / (dl || 1)) * sw;
        const fat = 1 + a.burst * 0.5;
        let r = (12.5 - 9.2 * Math.pow(s, 0.62)) * grow * small * fat;
        if (j === N_NODE - 1) r = 4.6 * grow * small * fat * (1 + 0.15 * Math.sin(t * 5 + td.phase));
        const o = (i * N_NODE + j) * 3;
        this.tData[o] = x;
        this.tData[o + 1] = y;
        this.tData[o + 2] = r;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    });
    const gl = this.gl;
    gl.uniform3fv(this.cu.uT, this.tData);
    gl.uniform4f(this.cu.uTBox, minX - 30, minY - 30, maxX + 30, maxY + 30);
    return a.tendrils.length;
  }

  /* ---------- dripping headline ---------- */

  setText(src: TextSource | null) {
    this.textSrc = src;
    if (!this.ok) return;
    if (!src) {
      this.textOn = false;
      this.dirty = true;
      return;
    }
    this.buildText();
  }

  private buildText() {
    const src = this.textSrc;
    if (!src || !this.ok) return;
    const gl = this.gl;
    const el = src.el;
    const rect = el.getBoundingClientRect();
    if (rect.width < 2) return;
    const scale = Math.min(this.dpr, Math.sqrt(2.4e6 / (rect.width * rect.height * 1.0)));
    const cv = document.createElement("canvas");
    cv.width = Math.ceil(rect.width * scale);
    cv.height = Math.ceil(rect.height * scale);
    const ctx = cv.getContext("2d")!;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = "#fff";
    ctx.scale(scale, scale);
    const lines = el.querySelectorAll<HTMLElement>("[data-line]");
    lines.forEach((ln) => {
      const cs = getComputedStyle(ln);
      const r = ln.getBoundingClientRect();
      ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const m = ctx.measureText(ln.textContent || "");
      const asc = m.fontBoundingBoxAscent ?? parseFloat(cs.fontSize) * 0.88;
      const desc = m.fontBoundingBoxDescent ?? parseFloat(cs.fontSize) * 0.12;
      const baseline = r.top - rect.top + (r.height - (asc + desc)) / 2 + asc;
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(ln.textContent || "", r.left - rect.left + r.width / 2, baseline);
      this.textLineH = r.height;
    });
    if (!this.textTex) this.textTex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.textTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.activeTexture(gl.TEXTURE0);
    this.textOn = true;
    this.dirty = true;
  }

  /* ---------- choreography ---------- */

  /** Ink erupts from a viewport point (css px) and covers everything. */
  flood(x: number, y: number): Promise<void> {
    if (!this.ok) return Promise.resolve();
    this.origin = { x: x / this.w, y: y / this.h };
    this.mode = "flood";
    this.mt = 0;
    this.simLive = true;
    this.gobs = [];
    const sc = Math.min(this.w, this.h) / 800;
    for (let i = 0; i < 10; i++) {
      const ang = -Math.PI * (0.1 + 0.8 * ((i + Math.random()) / 10));
      const sp = (460 + Math.random() * 820) * (0.75 + sc * 0.5);
      this.gobs.push({ x, y, vx: Math.cos(ang) * sp * (this.w > this.h ? 1.3 : 0.7), vy: Math.sin(ang) * sp * 1.15, life: 0.7 + Math.random() * 0.6, r: 20 + Math.random() * 22 });
    }
    return new Promise((res) => {
      this.onCovered = res;
    });
  }

  /** From full cover, pull back to living edges. */
  recede() {
    if (!this.ok) return;
    this.mode = "recede";
    this.mt = 0;
    this.simLive = true;
    this.holes = [];
    for (let i = 0; i < 7; i++) this.holes.push({ x: 0.2 + Math.random() * 0.6, y: 0.22 + Math.random() * 0.56 });
    this.holes.push({ x: 0.5, y: 0.5 });
  }

  /** From full cover, drain away into a single viewport point. */
  drain(x: number, y: number): Promise<void> {
    if (!this.ok) return Promise.resolve();
    this.origin = { x: x / this.w, y: y / this.h };
    this.mode = "drain";
    this.mt = 0;
    this.simLive = true;
    return new Promise((res) => {
      this.onDone = res;
    });
  }

  /** Jump straight to the steady edge state (no transition). */
  settle(edges: boolean) {
    if (!this.ok) return;
    this.mode = edges ? "edges" : "none";
    this.mt = 0;
    this.simLive = edges;
    if (!edges) this.clearSim(0);
    this.dirty = true;
  }

  get covered() {
    return this.mode === "cover";
  }
  get busy() {
    return this.mode === "flood" || this.mode === "cover" || this.mode === "recede" || this.mode === "drain";
  }

  private clearSim(v: number) {
    const gl = this.gl;
    for (const f of this.fbo) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, f);
      gl.viewport(0, 0, this.simW, this.simH);
      gl.clearColor(v, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  private simStep(dt: number, u: { react: number; relax: number; floor: number; fill: number; edge: number; sinkOn: number; splatN: number }) {
    const gl = this.gl;
    const s = this.su;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo[1 - this.cur]);
    gl.viewport(0, 0, this.simW, this.simH);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex[this.cur]);
    gl.uniform1i(s.uPrev, 0);
    gl.uniform2f(s.uTexel, 1 / this.simW, 1 / this.simH);
    gl.uniform1f(s.uAspect, this.w / this.h);
    gl.uniform1f(s.uTime, this.time);
    gl.uniform1f(s.uReact, u.react);
    gl.uniform1f(s.uRelax, u.relax);
    gl.uniform1f(s.uFloor, u.floor);
    gl.uniform1f(s.uFill, u.fill);
    gl.uniform1f(s.uEdge, u.edge);
    gl.uniform3f(s.uCursor, this.pointer.x / this.w, this.pointer.y / this.h, this.cursorPull);
    gl.uniform4f(s.uRing, this.ring.x, this.ring.y, this.ring.r, this.ring.w);
    gl.uniform3f(s.uSink, this.origin.x, this.origin.y, u.sinkOn);
    gl.uniform4fv(s.uSplat, this.splats);
    gl.uniform1i(s.uSplatN, u.splatN);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    this.cur = 1 - this.cur;
    void dt;
  }

  private setSplat(i: number, x: number, y: number, r: number, w: number) {
    const o = i * 4;
    this.splats[o] = x;
    this.splats[o + 1] = y;
    this.splats[o + 2] = r;
    this.splats[o + 3] = w;
  }

  frame(dtRaw: number) {
    if (!this.ok) return;
    const dt = Math.min(dtRaw, 0.05);
    this.time += dt;
    this.mt += dt;
    const gl = this.gl;

    // pointer energy drives the text pull + edge creep
    const sp = Math.hypot(this.pointer.x - this.lastPX, this.pointer.y - this.lastPY);
    this.lastPX = this.pointer.x;
    this.lastPY = this.pointer.y;
    const want = this.pointer.active ? Math.min(1, 0.32 + sp / 26) : 0;
    this.pull += (want - this.pull) * (1 - Math.exp(-dt * (want > this.pull ? 7 : 1.6)));
    this.cursorPull += ((this.pointer.active ? 0.085 : 0) - this.cursorPull) * (1 - Math.exp(-dt * 1.2));

    const smSteps = Math.max(1, Math.min(5, Math.round(dt * 180)));
    const edge = this.edge * this.edgeScale;

    if (this.simLive) {
      gl.useProgram(this.simProg);
      if (this.mode === "flood") {
        for (let k = 0; k < smSteps; k++) {
          const sdt = dt / smSteps;
          let n = 0;
          const grow = Math.min(this.mt / 0.4, 1);
          this.setSplat(n++, this.origin.x, this.origin.y, 0.03 + 0.1 * grow + 0.012 * Math.sin(this.mt * 22), this.mt < 0.9 ? 1 : 0);
          for (const g of this.gobs) {
            if (g.life <= 0) continue;
            g.vy += 2300 * sdt;
            g.x += g.vx * sdt;
            g.y += g.vy * sdt;
            g.life -= sdt;
            g.r = Math.max(9, g.r - 12 * sdt);
            if (n < 24) this.setSplat(n++, g.x / this.w, g.y / this.h, g.r / this.h, 0.7);
          }
          const fill = Math.max(0, Math.min(1, (this.mt - 1.75) / 0.6));
          this.simStep(sdt, { react: 0.36, relax: 0, floor: 0, fill: fill * fill, edge: 0, sinkOn: 0, splatN: n });
        }
        if (this.mt > 2.42) {
          this.mode = "cover";
          this.clearSim(1);
          const cb = this.onCovered;
          this.onCovered = null;
          cb?.();
        }
      } else if (this.mode === "cover") {
        // texture already full
      } else if (this.mode === "recede") {
        for (let k = 0; k < smSteps; k++) {
          let n = 0;
          if (this.mt < 0.16) for (const hpt of this.holes) this.setSplat(n++, hpt.x, hpt.y, 0.016, -0.6);
          const clr = Math.max(0, Math.min(1, (this.mt - 1.5) / 0.7));
          this.simStep(dt / smSteps, { react: -0.5, relax: 0, floor: 1, fill: -clr, edge, sinkOn: 0, splatN: n });
        }
        if (this.mt > 2.3) {
          this.mode = "edges";
          this.mt = 0;
        }
      } else if (this.mode === "edges") {
        this.simStep(dt, { react: 0, relax: 0.09, floor: 0, fill: 0, edge, sinkOn: 0, splatN: 0 });
      } else if (this.mode === "drain") {
        for (let k = 0; k < smSteps; k++) {
          let n = 0;
          if (this.mt < 0.14) {
            const pts = [
              [0.02, 0.02],
              [0.98, 0.02],
              [0.02, 0.98],
              [0.98, 0.98],
              [0.5, 0.01],
              [0.5, 0.99],
              [0.01, 0.5],
              [0.99, 0.5],
            ];
            for (const [x, y] of pts) {
              if (Math.hypot(x - this.origin.x, y - this.origin.y) > 0.3) this.setSplat(n++, x, y, 0.018, -0.6);
            }
          }
          const clr = Math.max(0, Math.min(1, (this.mt - 1.7) / 0.8));
          this.simStep(dt / smSteps, { react: -0.5, relax: 0, floor: 0, fill: -clr * clr, edge: 0, sinkOn: 1, splatN: n });
        }
        if (this.mt > 2.55) {
          this.mode = "none";
          this.simLive = false;
          this.clearSim(0);
          const cb = this.onDone;
          this.onDone = null;
          cb?.();
        }
      }
    }

    // composite
    gl.useProgram(this.compProg);
    const tn = this.stepTendrils(dt);
    let textOn = false;
    if (this.textOn && this.textSrc) {
      const r = this.textSrc.el.getBoundingClientRect();
      if (r.bottom > -this.h * 0.5 && r.top < this.h) {
        textOn = true;
        const clip = this.textSrc.clipEl ? this.textSrc.clipEl.getBoundingClientRect().top : 1e6;
        gl.uniform4f(this.cu.uTextRect, r.left, r.top, r.width, r.height);
        gl.uniform1f(this.cu.uClipY, clip);
        gl.uniform1f(this.cu.uDrip, this.drip + 0.1 + 0.05 * Math.sin(this.time * 0.6));
        gl.uniform3f(this.cu.uPull, this.pointer.x, this.pointer.y, this.pull);
        gl.uniform1f(this.cu.uLineH, this.textLineH);
      }
    }
    if (!this.simLive && tn === 0 && !textOn) {
      if (this.dirty) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        this.dirty = false;
      }
      return;
    }
    this.dirty = true;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex[this.cur]);
    gl.uniform1i(this.cu.uSim, 0);
    if (this.textTex) {
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.textTex);
      gl.activeTexture(gl.TEXTURE0);
    }
    gl.uniform1i(this.cu.uText, 1);
    gl.uniform2f(this.cu.uSimSize, this.simW, this.simH);
    gl.uniform2f(this.cu.uRes, this.canvas.width, this.canvas.height);
    gl.uniform1f(this.cu.uDpr, this.dpr);
    gl.uniform1f(this.cu.uTime, this.time);
    gl.uniform1f(this.cu.uAccent, this.accent);
    gl.uniform1f(this.cu.uInkOn, this.simLive ? 1 : 0);
    gl.uniform1i(this.cu.uTN, tn);
    gl.uniform1f(this.cu.uTextOn, textOn ? 1 : 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}
