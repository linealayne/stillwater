/*
 * The 3D stage. One WebGL renderer, two scenes:
 *   spread — a dark globe whose nodes light up, vein by vein, as the empire spreads
 *   device — the reactor: glossy black, chrome, and an acid heart; explodes into a schematic
 */
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

const ACID = new THREE.Color(0xccff00);
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

interface Part {
  obj: THREE.Object3D;
  home: THREE.Vector3;
  dir: THREE.Vector3;
  scaleTo?: number;
  flat?: THREE.Quaternion;
  spin?: THREE.Vector3;
  q?: THREE.Quaternion;
}

export const DEVICE_LABELS = [
  "Monologue amplifier",
  "Plausible deniability shroud",
  "Gimbal of consequences",
  "The heart. Forty millilitres of concentrated Monday.",
  "Regret-proof plating",
  "Henchman interlock",
  "Self-destruct (decorative)",
];

export class Stage {
  private renderer: THREE.WebGLRenderer;
  private canvas: HTMLCanvasElement;
  private mobile: boolean;
  private time = 0;
  private w = 1;
  private h = 1;
  // spread
  private sceneA = new THREE.Scene();
  private camA = new THREE.PerspectiveCamera(38, 1, 0.01, 50);
  private globe = new THREE.Group();
  private veinMat!: THREE.ShaderMaterial;
  private nodeMat!: THREE.ShaderMaterial;
  private globeMat!: THREE.ShaderMaterial;
  private front = 0;
  // device
  private sceneB = new THREE.Scene();
  private camB = new THREE.PerspectiveCamera(34, 1, 0.05, 80);
  private rig = new THREE.Group();
  private parts: Part[] = [];
  private heartMat!: THREE.ShaderMaterial;
  private heartLight!: THREE.PointLight;
  private halo!: THREE.Sprite;
  private anchors: THREE.Object3D[] = [];
  private spinY = 0;
  private rx = 0;
  private ry = 0;
  private tmp = new THREE.Vector3();
  private tq = new THREE.Quaternion();

  spread = 0;
  device = 0;
  surge = 0;
  active: "spread" | "device" | null = null;
  pointer = { x: 0, y: 0 };
  /** x, y (css px), alpha per label */
  labels = new Float32Array(DEVICE_LABELS.length * 3);
  explode = 0;

  constructor(canvas: HTMLCanvasElement, mobile: boolean) {
    this.canvas = canvas;
    this.mobile = mobile;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, alpha: false, powerPreference: "high-performance" });
    this.renderer.setClearColor(0x000000, 1);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.buildSpread();
    this.buildDevice();
    this.resize();
    // compile both scenes up front so neither stalls on arrival
    this.renderer.compile(this.sceneA, this.camA);
    this.renderer.compile(this.sceneB, this.camB);
  }

  /* ───────────── spread ───────────── */

  private buildSpread() {
    const N = this.mobile ? 1000 : 2400;
    const pos: THREE.Vector3[] = [];
    const golden = Math.PI * (3 - Math.sqrt(5));
    let seedRnd = 7;
    const rnd = () => {
      seedRnd = (seedRnd * 16807) % 2147483647;
      return seedRnd / 2147483647;
    };
    for (let i = 0; i < N; i++) {
      const y = 1 - (2 * (i + 0.5)) / N;
      const r = Math.sqrt(1 - y * y);
      const phi = i * golden;
      const v = new THREE.Vector3(Math.cos(phi) * r, y, Math.sin(phi) * r);
      v.x += (rnd() - 0.5) * 0.035;
      v.y += (rnd() - 0.5) * 0.035;
      v.z += (rnd() - 0.5) * 0.035;
      pos.push(v.normalize());
    }
    // k nearest neighbours
    const K = 5;
    const nbr: number[][] = [];
    for (let i = 0; i < N; i++) {
      const best: { j: number; d: number }[] = [];
      for (let j = 0; j < N; j++) {
        if (j === i) continue;
        const d = 1 - pos[i].dot(pos[j]);
        if (best.length < K) {
          best.push({ j, d });
          best.sort((a, b) => a.d - b.d);
        } else if (d < best[K - 1].d) {
          best[K - 1] = { j, d };
          best.sort((a, b) => a.d - b.d);
        }
      }
      nbr.push(best.map((b) => b.j));
    }
    const sym: number[][] = nbr.map((n) => [...n]);
    nbr.forEach((ns, i) => ns.forEach((j) => !sym[j].includes(i) && sym[j].push(i)));
    // seed: where the camera is looking at the start
    const want = new THREE.Vector3(-0.2, 0.08, 0.97).normalize().applyQuaternion(new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.2, 0.29, 0)).invert());
    let seed = 0;
    let bd = -2;
    pos.forEach((p, i) => {
      const d = p.dot(want);
      if (d > bd) {
        bd = d;
        seed = i;
      }
    });
    // randomised shortest-path tree → vein-like branching
    const dist = new Float32Array(N).fill(1e9);
    const parent = new Int32Array(N).fill(-1);
    const done = new Uint8Array(N);
    dist[seed] = 0;
    for (let it = 0; it < N; it++) {
      let u = -1;
      let m = 1e9;
      for (let i = 0; i < N; i++) {
        if (!done[i] && dist[i] < m) {
          m = dist[i];
          u = i;
        }
      }
      if (u < 0) break;
      done[u] = 1;
      for (const v of sym[u]) {
        if (done[v]) continue;
        const wgt = pos[u].distanceTo(pos[v]) * (0.35 + rnd() * 1.5);
        if (dist[u] + wgt < dist[v]) {
          dist[v] = dist[u] + wgt;
          parent[v] = u;
        }
      }
    }
    let maxD = 0;
    for (let i = 0; i < N; i++) if (dist[i] < 1e8 && dist[i] > maxD) maxD = dist[i];
    const order = new Float32Array(N);
    for (let i = 0; i < N; i++) order[i] = dist[i] < 1e8 ? Math.pow(dist[i] / maxD, 1.25) : 1;
    const size = new Float32Array(N).fill(1);
    const idx = Array.from({ length: N }, (_, i) => i).sort((a, b) => dist[b] - dist[a]);
    for (const i of idx) if (parent[i] >= 0) size[parent[i]] += size[i];

    // veins: thin ribbons lying on the surface
    const vp: number[] = [];
    const vo: number[] = [];
    const vs: number[] = [];
    const ind: number[] = [];
    const side = new THREE.Vector3();
    const dir = new THREE.Vector3();
    const nrm = new THREE.Vector3();
    let vi = 0;
    for (let i = 0; i < N; i++) {
      const p = parent[i];
      if (p < 0) continue;
      const A = pos[p];
      const B = pos[i];
      dir.subVectors(B, A);
      nrm.addVectors(A, B).normalize();
      side.crossVectors(dir, nrm).normalize();
      const wB = 0.0016 + 0.0078 * Math.pow(Math.log(size[i] + 1) / Math.log(N), 1.7);
      const wA = wB * 1.12;
      const R = 1.004;
      const push = (c: THREE.Vector3, w: number, s: number) => {
        vp.push((c.x + side.x * w * s) * R, (c.y + side.y * w * s) * R, (c.z + side.z * w * s) * R);
        vo.push(order[i]);
        vs.push(s);
      };
      push(A, wA, -1);
      push(A, wA, 1);
      push(B, wB, -1);
      push(B, wB, 1);
      ind.push(vi, vi + 1, vi + 2, vi + 1, vi + 3, vi + 2);
      vi += 4;
    }
    const vg = new THREE.BufferGeometry();
    vg.setAttribute("position", new THREE.Float32BufferAttribute(vp, 3));
    vg.setAttribute("aOrder", new THREE.Float32BufferAttribute(vo, 1));
    vg.setAttribute("aSide", new THREE.Float32BufferAttribute(vs, 1));
    vg.setIndex(ind);
    this.veinMat = new THREE.ShaderMaterial({
      uniforms: { uFront: { value: 0 }, uTime: { value: 0 }, uSurge: { value: 0 } },
      vertexShader: `attribute float aOrder; attribute float aSide; varying float vOrder; varying float vSide;
        void main(){ vOrder = aOrder; vSide = aSide; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `precision highp float; varying float vOrder; varying float vSide; uniform float uFront, uTime, uSurge;
        void main(){
          float on = step(vOrder, uFront);
          if (on < 0.5) discard;
          float flash = exp(-(uFront - vOrder) * 26.0);
          float pulse = 0.5 + 0.5 * sin(vOrder * 80.0 - uTime * 2.2);
          float core = pow(1.0 - abs(vSide), 0.55);
          vec3 acid = vec3(0.74, 1.0, 0.0);
          float amt = min(0.5 + 0.3 * pulse + flash * (1.2 + uSurge), 1.0);
          vec3 col = mix(acid * amt, vec3(1.0), min(flash * (0.55 + uSurge * 0.3), 1.0) * 0.8);
          gl_FragColor = vec4(col * core, 1.0);
        }`,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.globe.add(new THREE.Mesh(vg, this.veinMat));

    // nodes
    const np = new Float32Array(N * 3);
    const no = new Float32Array(N);
    const ns = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      np[i * 3] = pos[i].x * 1.006;
      np[i * 3 + 1] = pos[i].y * 1.006;
      np[i * 3 + 2] = pos[i].z * 1.006;
      no[i] = order[i];
      ns[i] = 0.7 + Math.min(2.6, Math.log(size[i] + 1) * 0.42);
    }
    const ng = new THREE.BufferGeometry();
    ng.setAttribute("position", new THREE.BufferAttribute(np, 3));
    ng.setAttribute("aOrder", new THREE.BufferAttribute(no, 1));
    ng.setAttribute("aSize", new THREE.BufferAttribute(ns, 1));
    this.nodeMat = new THREE.ShaderMaterial({
      uniforms: { uFront: { value: 0 }, uPx: { value: 1 }, uSurge: { value: 0 } },
      vertexShader: `attribute float aOrder; attribute float aSize; varying float vLit; varying float vFlash; uniform float uFront, uPx;
        void main(){
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vLit = step(aOrder, uFront);
          vFlash = vLit * exp(-(uFront - aOrder) * 22.0);
          gl_PointSize = min(aSize * uPx * (0.7 + vLit * 0.8 + vFlash * 2.4) / -mv.z, uPx * 2.4 * (1.0 + vFlash));
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `precision highp float; varying float vLit; varying float vFlash;
        void main(){
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.12, d);
          vec3 col = mix(vec3(0.20, 0.20, 0.185), vec3(0.74, 1.0, 0.0), vLit);
          col = mix(col, vec3(1.0), vFlash * 0.7);
          gl_FragColor = vec4(col * a * (0.75 + vLit * 0.25), 1.0);
        }`,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.globe.add(new THREE.Points(ng, this.nodeMat));

    this.globeMat = new THREE.ShaderMaterial({
      uniforms: { uFront: { value: 0 } },
      vertexShader: `varying vec3 vN; varying vec3 vV; varying vec3 vP;
        void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vP = position; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `precision highp float; varying vec3 vN; varying vec3 vV; varying vec3 vP; uniform float uFront;
        void main(){
          float f = pow(1.0 - max(dot(normalize(vN), normalize(vV)), 0.0), 3.2);
          vec3 col = vec3(0.006, 0.007, 0.006);
          col += vec3(0.86, 0.85, 0.80) * f * 0.16;
          col += vec3(0.80, 1.0, 0.0) * f * 0.22 * uFront;
          float sheen = pow(max(dot(normalize(vN), normalize(vec3(-0.5, 0.7, 0.6))), 0.0), 26.0);
          col += vec3(0.9) * sheen * 0.10;
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    this.globe.add(new THREE.Mesh(new THREE.SphereGeometry(1, this.mobile ? 48 : 96, this.mobile ? 32 : 64), this.globeMat));
    this.sceneA.add(this.globe);
  }

  /* ───────────── device ───────────── */

  private buildDevice() {
    const pm = new THREE.PMREMGenerator(this.renderer);
    const env = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    pm.dispose();
    this.sceneB.environment = env;
    this.sceneB.environmentIntensity = 0.9;

    const black = this.mobile
      ? new THREE.MeshStandardMaterial({ color: 0x030303, roughness: 0.16, metalness: 0.55, side: THREE.DoubleSide })
      : new THREE.MeshPhysicalMaterial({ color: 0x020202, roughness: 0.22, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.04, side: THREE.DoubleSide });
    const chrome = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.07, metalness: 1 });
    const seg = this.mobile ? 20 : 40;
    const rad = this.mobile ? 0.78 : 1;

    const add = (obj: THREE.Object3D, dir: [number, number, number], extra: Partial<Part> = {}) => {
      this.rig.add(obj);
      const part: Part = { obj, home: obj.position.clone(), dir: new THREE.Vector3(...dir), ...extra };
      this.parts.push(part);
      return part;
    };
    const anchor = (parent: THREE.Object3D, x: number, y: number, z: number) => {
      const a = new THREE.Object3D();
      a.position.set(x, y, z);
      parent.add(a);
      this.anchors.push(a);
    };

    // heart
    this.heartMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uGlow: { value: 1 } },
      vertexShader: `varying vec3 vP; varying vec3 vN; varying vec3 vV; uniform float uTime;
        void main(){
          vec3 p = position;
          float g = sin(p.x * 9.0 + uTime * 1.6) * sin(p.y * 9.0 - uTime * 1.2) * sin(p.z * 9.0 + uTime);
          p += normal * g * 0.022;
          vP = position; vec4 mv = modelViewMatrix * vec4(p, 1.0);
          vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `precision highp float; varying vec3 vP; varying vec3 vN; varying vec3 vV; uniform float uTime, uGlow;
        void main(){
          vec3 p = vP * 8.0;
          float g = dot(sin(p + uTime * 0.7), cos(p.zxy * 1.3 - uTime * 0.5));
          float veins = smoothstep(0.05, 0.5, abs(g));
          float f = pow(1.0 - max(dot(normalize(vN), normalize(vV)), 0.0), 2.0);
          vec3 acid = vec3(0.74, 1.0, 0.0);
          float core = pow(max(dot(normalize(vN), normalize(vV)), 0.0), 1.6);
          vec3 col = acid * min((0.16 + 0.84 * veins) * (0.6 + 0.4 * core) * min(uGlow, 1.25), 1.0);
          col = mix(col, vec3(0.93, 1.0, 0.62), clamp(core * veins * (uGlow - 0.55) * 0.55, 0.0, 0.85));
          col += acid * f * 0.25;
          gl_FragColor = vec4(min(col, vec3(1.0)), 1.0);
        }`,
    });
    const heart = new THREE.Mesh(new THREE.IcosahedronGeometry(0.36, this.mobile ? 5 : 8), this.heartMat);
    add(heart, [0, 0, 0]);
    this.heartLight = new THREE.PointLight(ACID, 9, 9, 1.6);
    this.rig.add(this.heartLight);
    // soft halo around the heart
    const hc = document.createElement("canvas");
    hc.width = hc.height = 128;
    const hx = hc.getContext("2d")!;
    const grad = hx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, "rgba(204,255,0,0.55)");
    grad.addColorStop(0.3, "rgba(204,255,0,0.16)");
    grad.addColorStop(1, "rgba(204,255,0,0)");
    hx.fillStyle = grad;
    hx.fillRect(0, 0, 128, 128);
    const haloTex = new THREE.CanvasTexture(hc);
    haloTex.colorSpace = THREE.SRGBColorSpace;
    this.halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    this.halo.scale.setScalar(2.4);
    this.rig.add(this.halo);

    // gimbal rings
    const flat = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
    [0.56, 0.67, 0.78].forEach((R, i) => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(R, 0.017, 12, this.mobile ? 64 : 120), chrome);
      ring.rotation.set(Math.PI / 2 + i * 1.05, i * 0.9, i * 0.5);
      const part = add(ring, [0, (i - 1) * 0.62, 0], { scaleTo: 1.5, flat, spin: new THREE.Vector3(0.5 + i * 0.3, 0.7 - i * 0.25, 0.35 + i * 0.2), q: ring.quaternion.clone() });
      if (i === 2) anchor(part.obj, R, 0, 0);
    });

    // shell plates: two rows of six
    const prof = (t0: number, t1: number) => {
      const pts: THREE.Vector2[] = [];
      const n = 18;
      for (let i = 0; i <= n; i++) {
        const t = mix(t0, t1, i / n);
        const y = mix(-0.95, 0.95, t);
        const r = 0.99 * Math.pow(Math.sin(Math.PI * (0.13 + 0.74 * t)), 0.5);
        pts.push(new THREE.Vector2(r, y));
      }
      return pts;
    };
    const gap = 0.2;
    for (let row = 0; row < 2; row++) {
      const pts = row === 0 ? prof(0.56, 1) : prof(0, 0.44);
      for (let i = 0; i < 6; i++) {
        const a0 = (i / 6) * Math.PI * 2 + gap / 2;
        const len = (Math.PI * 2) / 6 - gap;
        const g = new THREE.LatheGeometry(pts, Math.max(6, seg / 4), a0, len);
        const m = new THREE.Mesh(g, black);
        const mid = a0 + len / 2;
        // lathe phi: x = sin(phi) * r, z = cos(phi) * r
        const dx = Math.sin(mid);
        const dz = Math.cos(mid);
        add(m, [dx * 1.3 * rad, (row === 0 ? 0.42 : -0.42) * rad, dz * 1.3 * rad]);
        if (row === 0 && i === 1) anchor(m, dx * 0.8, 0.72, dz * 0.8);
      }
    }

    // equator band
    const band = new THREE.Group();
    band.add(new THREE.Mesh(new THREE.TorusGeometry(1.03, 0.028, 12, this.mobile ? 64 : 120).rotateX(Math.PI / 2), chrome));
    const stud = new THREE.SphereGeometry(0.045, 12, 8);
    for (let i = 0; i < 12; i++) {
      const s = new THREE.Mesh(stud, black);
      const a = (i / 12) * Math.PI * 2;
      s.position.set(Math.cos(a) * 1.03, 0, Math.sin(a) * 1.03);
      band.add(s);
    }
    add(band, [0, 0, 0], { scaleTo: this.mobile ? 1.9 : 2.45 });

    // caps
    const capPts = [new THREE.Vector2(0.6, 0), new THREE.Vector2(0.56, 0.08), new THREE.Vector2(0.42, 0.2), new THREE.Vector2(0.24, 0.27), new THREE.Vector2(0.0, 0.29)];
    const capG = new THREE.LatheGeometry(capPts, seg);
    const top = new THREE.Mesh(capG, black);
    top.position.y = 0.95;
    const topPart = add(top, [0, 1.25, 0]);
    anchor(topPart.obj, 0.45, 0.15, 0.2);
    const bot = new THREE.Mesh(capG, black);
    bot.position.y = -0.95;
    bot.rotation.x = Math.PI;
    add(bot, [0, -1.25, 0]);
    const collarG = new THREE.TorusGeometry(0.6, 0.026, 12, this.mobile ? 48 : 96).rotateX(Math.PI / 2);
    const c1 = new THREE.Mesh(collarG, chrome);
    c1.position.y = 0.94;
    add(c1, [0, 0.82, 0]);
    const c2 = new THREE.Mesh(collarG, chrome);
    c2.position.y = -0.94;
    add(c2, [0, -0.82, 0]);

    // emitter
    for (let i = 0; i < 3; i++) {
      const d = new THREE.Mesh(new THREE.CylinderGeometry(0.25 - i * 0.055, 0.27 - i * 0.055, 0.035, seg), chrome);
      d.position.y = 1.28 + i * 0.085;
      add(d, [0, 1.6 + i * 0.22, 0]);
    }
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.95, seg), chrome);
    spike.position.y = 1.95;
    const spikePart = add(spike, [0, 2.3, 0]);
    this.anchors.unshift(new THREE.Object3D());
    this.anchors[0].position.set(0.03, 0.2, 0);
    spikePart.obj.add(this.anchors[0]);

    // interlock coils + base
    let coilMid: THREE.Object3D | null = null;
    for (let i = 0; i < 4; i++) {
      const d = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.05, seg), i % 2 ? black : chrome);
      d.position.y = -1.3 - i * 0.085;
      const part = add(d, [0, -1.45 - i * 0.24, 0]);
      if (i === 1) coilMid = part.obj;
    }
    const base = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.07, 14, this.mobile ? 48 : 96).rotateX(Math.PI / 2), black);
    base.position.y = -1.7;
    const basePart = add(base, [0, -2.45, 0]);

    // label anchors, in DEVICE_LABELS order
    const ordered: THREE.Object3D[] = [];
    const heartAnchor = new THREE.Object3D();
    heartAnchor.position.set(0.3, 0.1, 0.2);
    heart.add(heartAnchor);
    const coilAnchor = new THREE.Object3D();
    coilAnchor.position.set(0.33, 0, 0);
    coilMid!.add(coilAnchor);
    const baseAnchor = new THREE.Object3D();
    baseAnchor.position.set(0.46, 0, 0.1);
    basePart.obj.add(baseAnchor);
    // anchors[] currently: [spike, ring, plate, topCap]
    const [aSpike, aRing, aPlate, aCap] = this.anchors;
    ordered.push(aSpike, aCap, aRing, heartAnchor, aPlate, coilAnchor, baseAnchor);
    this.anchors = ordered;

    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(-3, 5, 4);
    this.sceneB.add(key);
    this.sceneB.add(this.rig);
  }

  resize() {
    const cw = this.canvas.clientWidth || window.innerWidth;
    const ch = this.canvas.clientHeight || window.innerHeight;
    let dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    if (cw * ch * dpr * dpr > 2.3e6) dpr = Math.sqrt(2.3e6 / (cw * ch));
    this.w = cw;
    this.h = ch;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(cw, ch, false);
    for (const c of [this.camA, this.camB]) {
      c.aspect = cw / ch;
      c.updateProjectionMatrix();
    }
    this.nodeMat.uniforms.uPx.value = ch * dpr * 0.012;
  }

  frame(dtRaw: number) {
    if (!this.active) return;
    const dt = Math.min(dtRaw, 0.05);
    this.time += dt;
    if (this.active === "spread") this.frameSpread(dt);
    else this.frameDevice(dt);
  }

  private frameSpread(dt: number) {
    const p = this.spread;
    const portrait = this.w < this.h;
    const tgt = smooth(0.03, 0.74, p);
    const rate = 2.2 + Math.min(this.surge, 3) * 6;
    this.front += (tgt - this.front) * (1 - Math.exp(-dt * rate));
    if (tgt > this.front) this.front = Math.min(tgt, this.front + dt * 0.004);
    const f = this.front * 1.02;
    this.veinMat.uniforms.uFront.value = f;
    this.veinMat.uniforms.uTime.value = this.time;
    this.veinMat.uniforms.uSurge.value = Math.min(this.surge, 2);
    this.nodeMat.uniforms.uFront.value = f;
    this.globeMat.uniforms.uFront.value = this.front;

    const tanH = Math.tan((this.camA.fov * Math.PI) / 360);
    const d0 = Math.max(3.5, 1.22 / (tanH * Math.min(this.camA.aspect, 1.6)));
    const dMid = Math.max(2.25, d0 * 0.66);
    let d = mix(d0, dMid, smooth(0, 0.62, p));
    d = mix(d, 1.11, smooth(0.6, 0.95, p));
    const look = smooth(0.62, 0.96, p);
    this.camA.position.set(0, mix(0, -0.12, look), d);
    this.camA.up.set(0, 1, 0);
    this.camA.lookAt(0, look * 1.32, 0);
    const off = 1 - smooth(0.08, 0.5, p);
    this.globe.position.set(portrait ? 0 : off * 0.95, portrait ? -off * 0.75 : 0, 0);
    this.globe.rotation.set(-p * 2.3 - this.time * 0.012, 0.25 + p * 0.5 + this.pointer.x * 0.06, 0);
    this.renderer.render(this.sceneA, this.camA);
  }

  private frameDevice(dt: number) {
    const p = this.device;
    const e = smooth(0.2, 0.46, p) * (1 - smooth(0.7, 0.92, p));
    this.explode = e;
    const k = 1 - Math.exp(-dt * 5);
    this.rx += (this.pointer.y * 0.28 * (1 - e * 0.6) - this.rx) * k;
    this.ry += (this.pointer.x * 0.7 * (1 - e * 0.55) - this.ry) * k;
    this.spinY += dt * 0.22 * (1 - e * 0.92);
    this.rig.rotation.set(this.rx + 0.12, this.spinY + this.ry, 0);
    const near = 1 - Math.min(1, Math.hypot(this.pointer.x, this.pointer.y));
    const glow = 0.85 + 0.18 * Math.sin(this.time * 2.6) + near * 0.5 + smooth(0.9, 1, p) * 0.8;
    this.heartMat.uniforms.uTime.value = this.time;
    this.heartMat.uniforms.uGlow.value = glow;
    this.heartLight.intensity = 7 * glow;
    this.halo.material.opacity = Math.min(1, 0.45 * glow);
    this.halo.scale.setScalar(2.1 + glow * 0.5);

    for (const part of this.parts) {
      part.obj.position.copy(part.home).addScaledVector(part.dir, e);
      if (part.scaleTo) part.obj.scale.setScalar(mix(1, part.scaleTo, e));
      if (part.spin && part.q && part.flat) {
        const sp = (1 + near * 1.5) * dt;
        this.tq.setFromEuler(new THREE.Euler(part.spin.x * sp, part.spin.y * sp, part.spin.z * sp));
        part.q.multiply(this.tq);
        part.obj.quaternion.copy(part.q).slerp(part.flat, e);
      }
    }
    const intro = smooth(0, 0.16, p);
    const zA = this.mobile || this.w < this.h ? 11.5 : 7.4;
    const zE = this.mobile || this.w < this.h ? 24 : 13.6;
    const z = mix(0.62, mix(zA, zE, e), 1 - Math.pow(1 - intro, 2.2));
    this.camB.position.set(0, mix(0, 0.25, intro), z);
    this.camB.lookAt(0, mix(0, 0.1 - e * 0.25, intro), 0);
    this.renderer.render(this.sceneB, this.camB);

    const la = smooth(0.78, 1, e);
    this.anchors.forEach((a, i) => {
      a.getWorldPosition(this.tmp).project(this.camB);
      this.labels[i * 3] = (this.tmp.x * 0.5 + 0.5) * this.w;
      this.labels[i * 3 + 1] = (-this.tmp.y * 0.5 + 0.5) * this.h;
      this.labels[i * 3 + 2] = la;
    });
  }

  dispose() {
    this.renderer.dispose();
    this.sceneA.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose?.();
    });
    this.sceneB.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose?.();
    });
    this.sceneB.environment?.dispose();
  }
}
