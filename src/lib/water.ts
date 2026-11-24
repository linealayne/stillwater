/*
 * The still water. A pale horizon scene: sky, a low sun, a misted skyline, and a
 * mirror-calm plane of water rendered in perspective. The cursor leaves rings.
 * On the takeover, ink wells up from beneath the surface.
 */

const VERT = `attribute vec2 aPos; varying vec2 vUv;
void main(){ vUv = vec2(aPos.x * 0.5 + 0.5, 0.5 - aPos.y * 0.5); gl_Position = vec4(aPos, 0.0, 1.0); }`;

const FRAG = `precision highp float;
varying vec2 vUv;
uniform vec2 uRes;
uniform float uTime, uHorizon, uInk, uInkT, uShadow, uCalm;
uniform vec2 uInkPos;
uniform vec3 uDrops[10];
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p){ return vnoise(p) * 0.6 + vnoise(p * 2.1 + 5.0) * 0.28 + vnoise(p * 4.2 + 9.0) * 0.12; }
vec2 toPlane(vec2 uv){
  float z = 1.0 / max(uv.y - uHorizon + 0.035, 0.004);
  return vec2((uv.x - 0.5) * (uRes.x / uRes.y) * z, z) ;
}
float tower(float x, float c, float w, float h, float y){
  return smoothstep(w, w - 0.0015, abs(x - c)) * smoothstep(h, h - 0.002, y);
}
// the world above the waterline; y = height above horizon (uv units), x = uv.x
vec3 scene(float x, float y){
  float asp = uRes.x / uRes.y;
  vec3 sky = mix(vec3(0.925, 0.918, 0.892), vec3(0.957, 0.953, 0.937), smoothstep(0.0, 0.6, y));
  vec2 sp = vec2((x - 0.5) * asp, y - 0.085);
  float sd = length(sp);
  float sun = smoothstep(0.062, 0.058, sd);
  sky = mix(sky, vec3(0.992, 0.988, 0.972), 0.55 * exp(-sd * sd * 9.0));
  sky = mix(sky, vec3(1.0, 0.998, 0.985), sun * 0.9);
  float xs = (x - 0.5) * asp;
  float t = 0.0;
  t = max(t, tower(xs, -0.52, 0.016, 0.105, y));
  t = max(t, tower(xs, -0.47, 0.011, 0.150, y));
  t = max(t, tower(xs, -0.405, 0.020, 0.074, y));
  t = max(t, tower(xs, -0.33, 0.009, 0.118, y));
  t = max(t, tower(xs, -0.27, 0.014, 0.052, y));
  t = max(t, tower(xs, 0.25, 0.012, 0.064, y));
  t = max(t, tower(xs, 0.31, 0.018, 0.128, y));
  t = max(t, tower(xs, 0.365, 0.008, 0.178, y));
  t = max(t, tower(xs, 0.43, 0.019, 0.090, y));
  t = max(t, tower(xs, 0.50, 0.012, 0.132, y));
  t = max(t, tower(xs, 0.70, 0.022, 0.060, y));
  t = max(t, tower(xs, -0.72, 0.020, 0.082, y));
  float mist = smoothstep(0.0, 0.2, y);
  sky = mix(sky, vec3(0.845, 0.842, 0.818), t * (0.34 + 0.3 * mist));
  return sky;
}
float waves(vec2 P){
  float h = 0.0;
  h += (fbm(P * vec2(0.55, 1.6) + vec2(uTime * 0.035, uTime * 0.02)) - 0.5) * 0.9 * uCalm;
  for (int i = 0; i < 10; i++) {
    vec3 d = uDrops[i];
    if (d.z < 0.0) continue;
    float age = uTime - d.z;
    if (age > 7.0) continue;
    float dist = distance(P, d.xy);
    float rr = age * 1.25;
    float env = exp(-age * 0.75) * smoothstep(rr + 0.25, rr - 0.1, dist) * smoothstep(rr - 1.9, rr - 0.2, dist);
    h += sin((dist - rr) * 9.0) * env * 0.5;
  }
  if (uInk > 0.0) {
    vec2 ip = toPlane(uInkPos);
    float dist = distance(P, ip);
    float rr = uInkT * 5.5;
    h += sin((dist - rr) * 5.0) * smoothstep(rr + 0.6, rr - 0.3, dist) * exp(-dist * 0.12) * 2.6 * uInk;
    h += (fbm(P * 1.7 + uInkT * 2.5) - 0.5) * 3.0 * uInk * exp(-dist * 0.25);
  }
  return h;
}
void main(){
  vec2 uv = vUv;
  float asp = uRes.x / uRes.y;
  vec3 col;
  float y = uHorizon - uv.y;
  if (y > 0.0) {
    col = scene(uv.x, y);
  } else {
    vec2 P = toPlane(uv);
    float e = 0.02 * P.y * 0.12 + 0.012;
    float h0 = waves(P);
    vec2 n = vec2(waves(P + vec2(e, 0.0)) - h0, waves(P + vec2(0.0, e)) - h0) / e;
    float depth = -y;
    float fade = smoothstep(0.0, 0.05, depth);
    vec2 dis = n * 0.012 * (0.3 + depth * 2.2);
    vec3 refl = scene(uv.x + dis.x, depth * 1.02 + dis.y * 1.6 + abs(n.x) * 0.004);
    vec3 deep = vec3(0.765, 0.795, 0.782);
    float fres = smoothstep(0.0, 0.62, depth);
    col = mix(refl, deep, 0.16 + 0.42 * fres);
    col = mix(col, refl, 0.12);
    float gl = smoothstep(0.55, 1.4, n.y + abs(n.x) * 0.3) * 0.06 * fade;
    col += gl;
    // something passing underneath
    if (uShadow > 0.0) {
      vec2 sc = vec2(mix(-6.0, 6.0, uShadow), 3.4 + sin(uShadow * 5.0) * 0.5);
      vec2 dd = (P - sc) * vec2(0.28, 1.25);
      col *= 1.0 - 0.13 * exp(-dot(dd, dd)) * sin(uShadow * 3.14159);
    }
    // ink welling up beneath the surface
    if (uInk > 0.0) {
      vec2 ip = toPlane(uInkPos);
      vec2 dd = (P - ip) * vec2(1.0, 0.5);
      float nn = fbm(P * 1.3 + vec2(uInkT * 0.7, -uInkT));
      float R = uInk * 8.0 * (0.5 + nn);
      float stain = smoothstep(R, R * 0.35, length(dd));
      vec3 inked = vec3(0.01, 0.012, 0.012) + refl * 0.10 + vec3(1.0) * smoothstep(1.2, 2.6, n.y) * 0.25;
      col = mix(col, inked, stain * 0.96);
    }
    // hairline at the horizon, softened
    col = mix(scene(uv.x, 0.0) * 0.985, col, smoothstep(0.0, 0.006, depth));
  }
  float g = hash(uv * uRes + fract(uTime) * 61.0) - 0.5;
  col += g * 0.012;
  gl_FragColor = vec4(col, 1.0);
  if (asp < 0.0) gl_FragColor = vec4(0.0);
}`;

export class Water {
  ok = false;
  private gl!: WebGLRenderingContext;
  private canvas: HTMLCanvasElement;
  private u: Record<string, WebGLUniformLocation | null> = {};
  private drops = new Float32Array(30);
  private dropIdx = 0;
  private time = 0;
  private lastDrop = 0;
  private lastX = -1;
  private lastY = -1;
  horizon = 0.56;
  ink = 0;
  inkT = 0;
  inkPos = { x: 0.5, y: 0.7 };
  shadow = 0;
  private w = 0;
  private h = 0;
  staticMode = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const gl = canvas.getContext("webgl", { alpha: false, antialias: false, depth: false, powerPreference: "low-power" });
    if (!gl) return;
    this.gl = gl;
    const mk = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || "compile");
      return s;
    };
    try {
      const p = gl.createProgram()!;
      gl.attachShader(p, mk(gl.VERTEX_SHADER, VERT));
      gl.attachShader(p, mk(gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error("link");
      gl.useProgram(p);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(p, "aPos");
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      for (const n of ["uRes", "uTime", "uHorizon", "uInk", "uInkT", "uInkPos", "uShadow", "uDrops", "uCalm"]) this.u[n] = gl.getUniformLocation(p, n);
    } catch (e) {
      console.warn("[water] shader failure", e);
      return;
    }
    for (let i = 0; i < 10; i++) this.drops[i * 3 + 2] = -1;
    this.ok = true;
    this.resize();
  }

  resize() {
    if (!this.ok) return;
    const cw = this.canvas.clientWidth;
    const ch = this.canvas.clientHeight;
    if (!cw || !ch) return;
    let dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    if (cw * ch * dpr * dpr > 2.2e6) dpr = Math.sqrt(2.2e6 / (cw * ch));
    this.w = cw;
    this.h = ch;
    this.canvas.width = Math.round(cw * dpr);
    this.canvas.height = Math.round(ch * dpr);
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  private plane(x: number, y: number): [number, number] | null {
    const uy = y / this.h;
    if (uy <= this.horizon + 0.01) return null;
    const z = 1 / Math.max(uy - this.horizon + 0.035, 0.004);
    return [(x / this.w - 0.5) * (this.w / this.h) * z, z];
  }

  /** local px inside the canvas */
  touch(x: number, y: number, force = false) {
    if (!this.ok) return;
    const moved = Math.hypot(x - this.lastX, y - this.lastY);
    if (!force && (moved < 46 || this.time - this.lastDrop < 0.22)) return;
    const p = this.plane(x, y);
    if (!p) return;
    this.lastX = x;
    this.lastY = y;
    this.lastDrop = this.time;
    const o = this.dropIdx * 3;
    this.drops[o] = p[0];
    this.drops[o + 1] = p[1];
    this.drops[o + 2] = this.time;
    this.dropIdx = (this.dropIdx + 1) % 10;
  }

  frame(dt: number) {
    if (!this.ok) return;
    this.time += Math.min(dt, 0.05);
    this.draw();
  }

  draw() {
    if (!this.ok) return;
    const gl = this.gl;
    const u = this.u;
    gl.uniform2f(u.uRes, this.canvas.width, this.canvas.height);
    gl.uniform1f(u.uTime, this.staticMode ? 12 : this.time);
    gl.uniform1f(u.uHorizon, this.horizon);
    gl.uniform1f(u.uInk, this.ink);
    gl.uniform1f(u.uInkT, this.inkT);
    gl.uniform2f(u.uInkPos, this.inkPos.x, this.inkPos.y);
    gl.uniform1f(u.uShadow, this.shadow);
    gl.uniform1f(u.uCalm, 1);
    gl.uniform3fv(u.uDrops, this.drops);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}
