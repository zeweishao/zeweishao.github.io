/* 雪宝游记 · 2.5D 小屋（Three.js）
 * 小屋：一张按深度图沿视线方向推近的网格，相机做「窗口式」离轴视差——后墙不动，越近的东西错得越多，
 *       所以静止时画面和原图逐像素对齐，墙上的 DOM 角标、日历字也一直对得上。
 * 雪宝和道具：仍由 xuebao.js 的 DOM 负责交互和动画（看不见但能点），这里每帧读它们的位置、姿势、变形，
 *       按脚下的深度放进场景，加接触阴影、窗光明暗、边缘光和天气色调。
 * 天气：XUEBAO_DATA.weatherAt()，晴 / 花开 / 下雨 / 星夜，各有自己的小屋和粒子。
 */
import {
  WebGLRenderer, Scene, PerspectiveCamera, PlaneGeometry, Mesh, ShaderMaterial, TextureLoader,
  SRGBColorSpace, LinearFilter, ClampToEdgeWrapping, Vector3, Color, BufferGeometry, Float32BufferAttribute,
  Points, AdditiveBlending, NormalBlending, LinearMipmapLinearFilter, DynamicDrawUsage
} from "three";

const A = "xuebao-assets/";
const W = 1.5, H = 1, D = 2.2; // 小屋平面 1.5×1，相机距离 D
const KMAX = 0.36, KBASE = 0.1; // 深度 → 向相机推近的比例
const stage = document.getElementById("stage");
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

function ok() {
  try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; }
}
if (stage && ok()) start().catch((e) => { console.warn("[xuebao-3d] 退回平面版", e); stage.classList.remove("is3d"); });

async function start() {
  const loader = new TextureLoader();
  let maxAniso = 4;
  const tex = (src, mip = true) => new Promise((res, rej) => loader.load(src, (t) => { t.colorSpace = SRGBColorSpace; t.minFilter = mip ? LinearMipmapLinearFilter : LinearFilter; t.generateMipmaps = mip; t.anisotropy = maxAniso; t.wrapS = t.wrapT = ClampToEdgeWrapping; res(t); }, undefined, rej));
  const ROOMS = {};
  const roomTex = async (id) => (ROOMS[id] ||= tex(`${A}room-${id}.webp`));

  // 深度图：一份给着色器，一份读到 CPU 给道具/雪宝取脚下深度
  const depthImg = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = A + "room-depth.webp"; });
  const dc = document.createElement("canvas"); dc.width = depthImg.naturalWidth; dc.height = depthImg.naturalHeight;
  const dctx = dc.getContext("2d", { willReadFrequently: true }); dctx.drawImage(depthImg, 0, 0);
  const dpx = dctx.getImageData(0, 0, dc.width, dc.height).data;
  const depthAt = (u, v) => {
    const x = Math.min(dc.width - 1, Math.max(0, Math.round(u * (dc.width - 1)))), y = Math.min(dc.height - 1, Math.max(0, Math.round(v * (dc.height - 1))));
    return dpx[(y * dc.width + x) * 4] / 255;
  };
  const kOf = (d) => Math.max(0, d - KBASE) / (1 - KBASE) * KMAX;
  const depthTex = await tex(A + "room-depth.webp", false); depthTex.colorSpace = "";

  // ---------- 渲染器与相机 ----------
  const renderer = new WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  renderer.outputColorSpace = SRGBColorSpace;
  maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const canvas = renderer.domElement; canvas.className = "xb-canvas"; canvas.setAttribute("aria-hidden", "true");
  stage.insertBefore(canvas, stage.querySelector(".xb-room").nextSibling);
  const scene = new Scene(); scene.background = new Color("#20263a");
  const camera = new PerspectiveCamera(30, W / H, 0.05, 20);
  const C0 = new Vector3(0, 0, D);
  function offAxis(cx, cy, z = 1, fx = 0, fy = 0) {
    camera.position.set(cx, cy, D); camera.lookAt(cx, cy, 0);
    const n = camera.near, f = camera.far, s = n / D;
    const L = fx + (-W / 2 - fx) / z, R = fx + (W / 2 - fx) / z, T = fy + (H / 2 - fy) / z, B = fy + (-H / 2 - fy) / z;
    camera.projectionMatrix.makePerspective((L - cx) * s, (R - cx) * s, (T - cy) * s, (B - cy) * s, n, f);
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  }

  // ---------- 小屋网格 ----------
  const OVER = 1.1;
  const g = new PlaneGeometry(W * OVER, H * OVER, 220, 150);
  { const p = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, Math.min(1, Math.max(0, p.getX(i) / W + 0.5)), Math.min(1, Math.max(0, p.getY(i) / H + 0.5))); }
  const roomMat = new ShaderMaterial({
    uniforms: {
      uA: { value: null }, uB: { value: null }, uMix: { value: 0 }, uDepth: { value: depthTex },
      uCam: { value: C0 }, uK: { value: new Vector3(KMAX, KBASE, 0) }, uGrade: { value: new Vector3(1, 1, 1) },
      uSat: { value: 1 }, uWin: { value: 0 }, uWinCol: { value: new Color("#6e7d92") }, uTime: { value: 0 }, uLamp: { value: 0 }
    },
    vertexShader: /* glsl */`
      uniform sampler2D uDepth; uniform vec3 uCam; uniform vec3 uK;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        float d = texture2D(uDepth, uv).r;
        float k = max(0.0, d - uK.y) / (1.0 - uK.y) * uK.x;
        vec3 p = position + (uCam - position) * k;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D uA; uniform sampler2D uB; uniform float uMix; uniform vec3 uGrade; uniform float uSat;
      uniform float uWin; uniform vec3 uWinCol; uniform float uTime; uniform float uLamp;
      varying vec2 vUv;
      float box(vec2 p, vec2 a, vec2 b, float s) { vec2 q = smoothstep(a - s, a + s, p) * (1.0 - smoothstep(b - s, b + s, p)); return q.x * q.y; }
      void main() {
        vec3 c = mix(texture2D(uA, vUv).rgb, texture2D(uB, vUv).rgb, uMix);
        float l = dot(c, vec3(0.299, 0.587, 0.114));
        c = mix(vec3(l), c, uSat) * uGrade;
        // 下雨：窗玻璃蒙一层灰
        vec2 wp = vec2(vUv.x, 1.0 - vUv.y);
        float w = box(wp, vec2(0.045, 0.2), vec2(0.236, 0.465), 0.008);
        vec2 e = (wp - vec2(0.1405, 0.2)) / vec2(0.096, 0.125);
        w = max(w, (1.0 - smoothstep(0.92, 1.0, length(e))) * step(wp.y, 0.2));
        float lum = dot(c, vec3(0.299, 0.587, 0.114));
        c = mix(c, mix(uWinCol, vec3(lum) * uWinCol * 1.4, 0.45) * (0.9 + 0.1 * sin(uTime * 0.7 + vUv.y * 8.0)), w * uWin * smoothstep(0.35, 0.75, lum));
        // 台灯暖光
        vec2 lp = vec2(0.055, 0.6); float ld = distance(vec2(vUv.x * 1.5, vUv.y), vec2(lp.x * 1.5, lp.y));
        c += vec3(1.0, 0.72, 0.38) * uLamp * 0.38 * exp(-ld * ld * 22.0);
        // 暗角
        vec2 q = vUv - 0.5; c *= 1.0 - dot(q, q) * 0.38;
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`
  });
  const room = new Mesh(g, roomMat); scene.add(room);

  // ---------- 精灵（道具、雪宝）的通用材质 ----------
  const spriteVS = /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
  const spriteFS = /* glsl */`
    uniform sampler2D map; uniform float uOpacity; uniform vec3 uAmb; uniform float uSide; uniform float uRim; uniform vec3 uRimCol;
    uniform float uAO; uniform vec2 uTexel; uniform float uHi;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(map, vUv);
      if (c.a < 0.02) discard;
      vec3 col = c.rgb * uAmb;
      col *= mix(1.0 + uSide, 1.0 - uSide * 0.6, vUv.x);           // 窗在左边：左亮右暗
      col *= mix(1.0 - uAO, 1.0, smoothstep(0.0, 0.22, vUv.y));     // 脚下一点环境遮蔽
      float t = 3.0;
      float m = min(min(texture2D(map, vUv + vec2(uTexel.x * t, 0.0)).a, texture2D(map, vUv - vec2(uTexel.x * t, 0.0)).a),
                    min(texture2D(map, vUv + vec2(0.0, uTexel.y * t)).a, texture2D(map, vUv - vec2(0.0, uTexel.y * t)).a));
      col += uRimCol * uRim * (1.0 - m) * smoothstep(0.35, 1.0, 1.0 - vUv.x * 0.6);
      col += uHi * 0.07;
      gl_FragColor = vec4(col, c.a * uOpacity);
      #include <colorspace_fragment>
    }`;
  const shadowFS = /* glsl */`
    uniform float uOpacity; uniform vec3 uCol; varying vec2 vUv;
    void main(){ vec2 q = (vUv - 0.5) * 2.0; float a = smoothstep(1.0, 0.0, length(q)); gl_FragColor = vec4(uCol, a * a * uOpacity); }`;
  const quad = new PlaneGeometry(1, 1);
  const charGeo = new PlaneGeometry(1, 1, 18, 36);
  const charVS = /* glsl */`
    uniform float uTime; uniform float uLean; uniform float uSquash; uniform float uSway; uniform float uBreath; uniform float uFlut;
    varying vec2 vUv;
    void main() {
      vUv = uv;
      vec3 p = position;
      float y = uv.y;
      // 挤压拉伸：以脚底为支点，体积大致守恒
      p.y = (p.y + 0.5) * (1.0 + uSquash) - 0.5;
      p.x *= 1.0 - uSquash * 0.55;
      // 呼吸：胸口一带轻微起伏
      float chest = smoothstep(0.25, 0.55, y) * (1.0 - smoothstep(0.6, 0.85, y));
      p.x *= 1.0 + sin(uTime * 2.1) * 0.01 * uBreath * chest;
      p.y += sin(uTime * 2.1) * 0.004 * uBreath * smoothstep(0.3, 1.0, y);
      // 身体前倾/惯性：越往上偏得越多（头和辫子落后于身体）
      float bend = pow(y, 1.7);
      p.x += (uLean + sin(uTime * 1.25) * uSway) * bend;
      // 裙摆和辫梢的二次摆动：两侧、下半身更明显
      float side = abs(uv.x - 0.5) * 2.0;
      p.x += sin(uTime * 2.6 + y * 7.0) * 0.007 * uFlut * side * (1.0 - smoothstep(0.2, 0.7, y));
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }`;
  const amb = new Color(1, 1, 1), rimCol = new Color("#fff4dc");

  const texCache = new Map();
  const getTex = (src) => { if (!texCache.has(src)) { const e = { t: null }; texCache.set(src, e); tex(src).then((t) => { e.t = t; }); } return texCache.get(src).t; };

  const items = [];
  function track(el, img, opt = {}) {
    const mat = new ShaderMaterial({
      uniforms: { map: { value: null }, uOpacity: { value: 1 }, uAmb: { value: amb }, uSide: { value: opt.char ? 0.1 : 0.06 }, uRim: { value: opt.char ? 0.28 : 0.12 },
        uRimCol: { value: rimCol }, uAO: { value: opt.char ? 0.14 : 0.08 }, uTexel: { value: [1 / 512, 1 / 512] }, uHi: { value: 0 } },
      vertexShader: opt.char ? charVS : spriteVS, fragmentShader: spriteFS, transparent: true, depthTest: false, depthWrite: false
    });
    if (opt.char) Object.assign(mat.uniforms, { uTime: { value: 0 }, uLean: { value: 0 }, uSquash: { value: 0 }, uSway: { value: 0.006 }, uBreath: { value: 1 }, uFlut: { value: 1 } });
    const mesh = new Mesh(opt.char ? charGeo : quad, mat); mesh.visible = false; scene.add(mesh);
    let sh = null;
    if (opt.shadow) {
      sh = new Mesh(quad, new ShaderMaterial({ uniforms: { uOpacity: { value: 0.34 }, uCol: { value: new Color("#3a2a24") } }, vertexShader: spriteVS, fragmentShader: shadowFS, transparent: true, depthTest: false, depthWrite: false, blending: NormalBlending }));
      sh.visible = false; scene.add(sh);
    }
    const it = { el, img, mesh, sh, opt, hi: 0, lift: 0, liftV: 0 };
    el.addEventListener("pointerenter", () => { it.hover = true; });
    el.addEventListener("pointerleave", () => { it.hover = false; });
    if (!opt.char) el.addEventListener("click", () => { it.liftV += 0.9; it.burst = true; });
    items.push(it);
    return it;
  }
  const GROUNDED = new Set(["piggy", "jar", "globe", "radio", "mug", "cardbox", "plant", "note"]);
  stage.querySelectorAll(".xb-prop").forEach((el) => { const img = el.querySelector("img"); if (img) track(el, img, { shadow: el.id === "packProp" || GROUNDED.has(el.dataset.prop) }); });
  const meEl = document.getElementById("xuebao");
  const me = track(meEl, document.getElementById("xbImg"), { char: true, shadow: true });

  const mtx = (s) => { if (!s || s === "none") return [1, 0, 0, 1, 0, 0]; const m = s.match(/matrix\(([^)]+)\)/); if (m) return m[1].split(",").map(Number); const m3 = s.match(/matrix3d\(([^)]+)\)/); if (m3) { const v = m3[1].split(",").map(Number); return [v[0], v[1], v[4], v[5], v[12], v[13]]; } return [1, 0, 0, 1, 0, 0]; };
  const mul = (a, b) => [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];

  let SR = stage.getBoundingClientRect();
  const toPlane = (u, v) => [(u - 0.5) * W, (0.5 - v) * H];
  function place(it, dt) {
    if (it.opt.char) return placeChar(it, dt);
    const { el, img, mesh, sh, opt } = it;
    const cs = getComputedStyle(el);
    let op = parseFloat(cs.opacity); if (el.hidden || cs.display === "none" || cs.visibility === "hidden") op = 0;
    const src = img.currentSrc || img.src; const t = src ? getTex(src) : null;
    if (!t || op <= 0.01 || !img.offsetWidth) { mesh.visible = false; if (sh) sh.visible = false; return; }
    const r = img.getBoundingClientRect(), b = el.getBoundingClientRect();
    const m = mul(mtx(cs.transform), mtx(getComputedStyle(img).transform));
    const sx = Math.hypot(m[0], m[1]), sy = Math.hypot(m[2], m[3]), ang = Math.atan2(m[1], m[0]);
    const w = img.offsetWidth * sx / SR.width, h = img.offsetHeight * sy / SR.height;
    const cu = (r.left + r.width / 2 - SR.left) / SR.width, cv = (r.top + r.height / 2 - SR.top) / SR.height;
    // 脚下：按钮的底边中点（雪宝跳起来时影子留在地上）
    const bu = (b.left + b.width / 2 - SR.left) / SR.width, bv = (b.top + b.height - SR.top) / SR.height;
    const k = opt.k ?? kOf(depthAt(bu, Math.min(0.999, bv + 0.006)));
    // 悬停/点击：弹簧抬起
    const target = it.hover ? 0.006 : 0;
    it.liftV += ((target - it.lift) * 220 - it.liftV * 14) * dt; it.lift += it.liftV * dt * 0.06;
    const [px, py0] = toPlane(cu, cv); const py = py0 + it.lift;
    mesh.position.set(px + (C0.x - px) * k, py + (C0.y - py) * k, D * k + 0.001);
    if (it.burst) { it.burst = false; const [bx, by] = toPlane(cu, cv - h * 0.2); emit(bx, by, k + 0.01, 14, [1, 0.88, 0.55], 0.16, 0.05); }
    const flip = (getComputedStyle(img).scale || "").trim().startsWith("-1") ? -1 : 1;
    mesh.scale.set(flip * w * W * (1 - k), h * H * (1 - k), 1);
    mesh.rotation.z = -ang;
    mesh.material.uniforms.map.value = t;
    if (t.image) mesh.material.uniforms.uTexel.value = [1 / t.image.width, 1 / t.image.height];
    mesh.material.uniforms.uOpacity.value = op;
    it.hi += ((it.hover ? 1 : 0) - it.hi) * 0.2; mesh.material.uniforms.uHi.value = it.hi;
    mesh.renderOrder = 10 + Math.round(k * 1000);
    mesh.visible = true;
    if (sh) {
      const lift = Math.max(0, b.top + b.height - (r.top + r.height)) / SR.height; // 离地高度
      const [sx0, sy0] = toPlane(bu, bv - 0.004);
      const ks = k;
      sh.position.set(sx0 + (C0.x - sx0) * ks, sy0 + (C0.y - sy0) * ks, D * ks);
      const sw = w * W * (1 - ks) * 0.78 * (1 - Math.min(0.5, lift * 4));
      sh.scale.set(sw, sw * 0.2, 1);
      sh.material.uniforms.uOpacity.value = 0.42 * op * (1 - Math.min(0.7, lift * 6));
      sh.renderOrder = mesh.renderOrder - 1; sh.visible = true;
    }
  }

  // ---------- 雪宝：位置跟 DOM，动作由弹簧物理驱动 ----------
  const P = { x: null, y: null, vx: 0, vy: 0, lean: 0, leanV: 0, sq: 0, sqV: 0, jump: -1, pop: 1, popV: 0, lift: 0, liftV: 0, step: 0, dust: 0, cls: "" };
  let zoomT = 1, focus = [0, 0];
  function charEvent(added) {
    if (added.has("hop")) { P.jump = 0; P.sqV -= 2.2; }
    if (added.has("squash")) { P.sqV -= 3.2; emitRing(); }
    if (added.has("hug")) { P.sqV -= 2.6; zoomT = 1.045; setTimeout(() => { zoomT = 1; }, 1100); }
    if (added.has("swap")) { P.pop = 0.9; P.popV = 0; }
  }
  function emitRing() { if (P.x == null) return; emit(P.x, P.y + 0.005, P.k, 12, [0.95, 0.9, 0.85], 0.09, 0.02, true); }
  function placeChar(it, dt) {
    const { el, img, mesh, sh } = it;
    const cs = getComputedStyle(el);
    let op = parseFloat(cs.opacity); if (el.hidden || cs.display === "none") op = 0;
    const src = img.currentSrc || img.src; const t = src ? getTex(src) : null;
    if (!t || op <= 0.01 || !img.offsetWidth) { mesh.visible = false; if (sh) sh.visible = false; P.x = null; return; }
    // 动作事件：看 DOM 上加了哪些 class
    if (el.className !== P.cls) { const prev = new Set(P.cls.split(" ")); const now = new Set(el.className.split(" ")); P.cls = el.className; charEvent(new Set([...now].filter((c) => !prev.has(c)))); }
    const walking = el.classList.contains("walk"), dragging = el.classList.contains("dragging");
    const b = el.getBoundingClientRect();
    const bu = (b.left + b.width / 2 - SR.left) / SR.width, bv = (b.top + b.height - SR.top) / SR.height;
    const k = kOf(depthAt(bu, Math.min(0.999, bv + 0.006)));
    const [x, y] = toPlane(bu, bv);
    if (P.x == null) { P.x = x; P.y = y; }
    const vx = (x - P.x) / Math.max(dt, 1e-3); P.vx += (vx - P.vx) * 0.25; P.x = x; P.y = y; P.k = k;
    // 前倾/惯性弹簧：移动越快，上半身越落后；停下时回弹过头一点
    const leanTarget = Math.max(-0.12, Math.min(0.12, -P.vx * (dragging ? 0.16 : 0.09))) + (walking ? Math.sign(P.vx) * 0.025 : 0);
    P.leanV += ((leanTarget - P.lean) * 90 - P.leanV * 9) * dt; P.lean += P.leanV * dt;
    // 挤压弹簧
    P.sqV += (-P.sq * 260 - P.sqV * 13) * dt; P.sq += P.sqV * dt;
    // 换姿势时的小弹出
    P.popV += ((1 - P.pop) * 300 - P.popV * 16) * dt; P.pop += P.popV * dt;
    // 跳：蓄力 → 腾空 → 落地
    let hop = 0;
    if (P.jump >= 0) {
      P.jump += dt; const T = 0.5;
      if (P.jump < T) { const u = P.jump / T; hop = Math.sin(Math.PI * u) * 0.055; if (u < 0.15) P.sq = Math.max(P.sq, 0.06); }
      else { P.jump = -1; P.sqV -= 2.8; emitRing(); }
    }
    // 拖着：离地 + 摆荡
    const liftT = dragging ? 0.05 : 0;
    P.liftV += ((liftT - P.lift) * 120 - P.liftV * 12) * dt; P.lift += P.liftV * dt;
    // 走路：一步一颠，脚下扬尘
    let bob = 0;
    if (walking) { P.step += dt * 9.5; bob = Math.abs(Math.sin(P.step)) * 0.01; P.dust += dt; if (P.dust > 0.22) { P.dust = 0; emit(x, y + 0.004, k, 3, [0.92, 0.88, 0.82], 0.05, 0.012, true); } }
    else P.step = 0;
    const ratio = img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : 0.66;
    const h = (b.height / SR.height) * H, w = h * ratio;
    const flip = (getComputedStyle(img).scale || "").trim().startsWith("-1") ? -1 : 1;
    const up = hop + bob + P.lift;
    const cy = y + up + (h * P.pop) / 2;
    mesh.position.set(x + (C0.x - x) * k, cy + (C0.y - cy) * k, D * k + 0.002);
    mesh.scale.set(flip * w * P.pop * (1 - k), h * P.pop * (1 - k), 1);
    mesh.rotation.z = dragging ? Math.sin(performance.now() / 260) * 0.05 : 0;
    const u = mesh.material.uniforms;
    u.map.value = t; if (t.image) u.uTexel.value = [1 / t.image.width, 1 / t.image.height];
    u.uOpacity.value = op; u.uLean.value = P.lean * flip; u.uSquash.value = Math.max(-0.22, Math.min(0.18, P.sq));
    u.uBreath.value = walking || dragging ? 0 : 1; u.uSway.value = walking ? 0 : 0.006; u.uFlut.value = walking || dragging ? 2.2 : 1;
    it.hi += ((it.hover ? 1 : 0) - it.hi) * 0.15; u.uHi.value = it.hi * 0.6;
    mesh.renderOrder = 10 + Math.round(k * 1000); mesh.visible = true;
    focus = [mesh.position.x, mesh.position.y];
    if (sh) {
      const sw = w * (1 - k) * 0.8 * (1 - Math.min(0.45, up * 6));
      sh.position.set(x + (C0.x - x) * k, y + 0.004 + (C0.y - y - 0.004) * k, D * k);
      sh.scale.set(sw, sw * 0.2, 1);
      sh.material.uniforms.uOpacity.value = 0.45 * op * (1 - Math.min(0.7, up * 9));
      sh.renderOrder = mesh.renderOrder - 1; sh.visible = true;
    }
  }

  // ---------- 一次性粒子（点道具的光点、走路扬尘、落地尘圈） ----------
  const PN = 240; let pi = 0;
  const pGeo = new BufferGeometry();
  const pOrig = new Float32Array(PN * 3), pVel = new Float32Array(PN * 3), pBirth = new Float32Array(PN).fill(-99), pCol = new Float32Array(PN * 3), pKind = new Float32Array(PN);
  [["position", pOrig, 3], ["vel", pVel, 3], ["birth", pBirth, 1], ["col", pCol, 3], ["kind", pKind, 1]].forEach(([n, a, s]) => { const at = new Float32BufferAttribute(a, s); at.setUsage(DynamicDrawUsage); pGeo.setAttribute(n, at); });
  const pMat = new ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uH: { value: 600 }, uPR: { value: 1 } },
    vertexShader: /* glsl */`uniform float uTime; uniform float uH; uniform float uPR; attribute vec3 vel; attribute float birth; attribute vec3 col; attribute float kind;
      varying vec3 vCol; varying float vA; varying float vKind;
      void main(){ float age = uTime - birth; float life = kind > 0.5 ? 0.7 : 1.1; vA = age < 0.0 || age > life ? 0.0 : 1.0 - age / life; vCol = col; vKind = kind;
        vec3 p = position + vel * age + vec3(0.0, kind > 0.5 ? 0.01 : -0.09, 0.0) * age * age;
        vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
        gl_PointSize = (kind > 0.5 ? 0.03 + age * 0.05 : 0.016) * uH * uPR / -mv.z; }`,
    fragmentShader: /* glsl */`varying vec3 vCol; varying float vA; varying float vKind;
      void main(){ float d = length(gl_PointCoord - 0.5); if (vA <= 0.0) discard;
        float a = vKind > 0.5 ? smoothstep(0.5, 0.1, d) * 0.35 : exp(-d * d * 22.0) + smoothstep(0.08, 0.0, abs(gl_PointCoord.x - 0.5)) * smoothstep(0.5, 0.0, abs(gl_PointCoord.y - 0.5)) * 0.6;
        gl_FragColor = vec4(vCol, a * vA); }`,
    transparent: true, depthTest: false, depthWrite: false, blending: AdditiveBlending
  });
  const pPts = new Points(pGeo, pMat); pPts.renderOrder = 6000; pPts.frustumCulled = false; scene.add(pPts);
  let clock = 0;
  function emit(x, y, k, n, col, spd, up, dust = false) {
    for (let i = 0; i < n; i++) {
      const j = pi++ % PN, a = Math.random() * Math.PI * 2, r = spd * (0.4 + Math.random() * 0.6);
      pOrig.set([x + (C0.x - x) * k, y + (C0.y - y) * k, D * k + 0.003], j * 3);
      pVel.set(dust ? [Math.cos(a) * r, Math.abs(Math.sin(a)) * r * 0.25 + up, 0] : [Math.cos(a) * r, Math.sin(a) * r + up, 0], j * 3);
      pBirth[j] = clock + Math.random() * 0.05; pCol.set(col, j * 3); pKind[j] = dust ? 1 : 0;
    }
    ["position", "vel", "birth", "col", "kind"].forEach((n2) => { pGeo.attributes[n2].needsUpdate = true; });
  }

  // ---------- 天气效果 ----------
  const fxMat = (frag, extra = {}) => new ShaderMaterial({ uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 }, ...extra }, vertexShader: spriteVS, fragmentShader: frag, transparent: true, depthTest: false, depthWrite: false, blending: AdditiveBlending });
  // 窗光：从左上窗户斜照到地板的几道光
  const beams = [];
  for (let i = 0; i < 3; i++) {
    const m = new Mesh(quad, fxMat(/* glsl */`uniform float uTime; uniform float uOpacity; varying vec2 vUv;
      void main(){ float a = smoothstep(0.0, 0.35, vUv.x) * smoothstep(1.0, 0.55, vUv.x) * smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.6, vUv.y);
      a *= 0.75 + 0.25 * sin(uTime * 0.6 + vUv.y * 6.0 + ${i}.0);
      gl_FragColor = vec4(vec3(1.0, 0.93, 0.76) * a * uOpacity, 1.0); }`));
    const [x, y] = toPlane(0.2 + i * 0.07, 0.6); const k = 0.08 + i * 0.03;
    m.position.set(x * (1 - k), y * (1 - k), D * k); m.scale.set(0.16, 0.95, 1); m.rotation.z = 0.62 + i * 0.05; m.renderOrder = 5;
    scene.add(m); beams.push(m);
  }
  // 吊灯和台灯的光晕
  const glow = (u, v, size, col) => {
    const m = new Mesh(quad, fxMat(/* glsl */`uniform float uTime; uniform float uOpacity; uniform vec3 uCol; varying vec2 vUv;
      void main(){ float d = length(vUv - 0.5) * 2.0; float a = exp(-d * d * 3.2) * (0.92 + 0.08 * sin(uTime * 3.1) * sin(uTime * 1.7));
      gl_FragColor = vec4(uCol * a * uOpacity, 1.0); }`, { uCol: { value: new Color(col) } }));
    const [x, y] = toPlane(u, v); const k = kOf(depthAt(u, v));
    m.position.set(x * (1 - k), y * (1 - k), D * k); m.scale.set(size, size, 1); m.renderOrder = 4000; scene.add(m); return m;
  };
  const lampGlow = glow(0.06, 0.45, 0.2, "#ffc27a"), lanternGlow = glow(0.757, 0.13, 0.26, "#ffcf86");

  // 粒子：灰尘 / 萤火 / 花瓣 / 雨
  function particles(n, frag, size, init) {
    const geo = new BufferGeometry(), pos = new Float32Array(n * 3), seed = new Float32Array(n);
    for (let i = 0; i < n; i++) { seed[i] = Math.random(); init(pos, i); }
    geo.setAttribute("position", new Float32BufferAttribute(pos, 3)); geo.setAttribute("seed", new Float32BufferAttribute(seed, 1));
    const mat = new ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 }, uSize: { value: size }, uPR: { value: renderer.getPixelRatio() }, uH: { value: 600 } },
      vertexShader: /* glsl */`uniform float uTime; uniform float uSize; uniform float uPR; uniform float uH; attribute float seed; varying float vSeed; varying float vRot;
        ${frag.vs}
        void main(){ vSeed = seed; vec3 p = move(position, seed, uTime); vRot = uTime * (0.6 + seed) + seed * 6.28;
          vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = uSize * uH * uPR * (0.6 + seed * 0.8) / -mv.z; }`,
      fragmentShader: /* glsl */`uniform float uOpacity; uniform float uTime; varying float vSeed; varying float vRot; ${frag.fs}`,
      transparent: true, depthTest: false, depthWrite: false, blending: frag.blend ?? AdditiveBlending
    });
    const pts = new Points(geo, mat); pts.renderOrder = 5000; pts.frustumCulled = false; scene.add(pts); return pts;
  }
  const rnd = (a, b) => a + Math.random() * (b - a);
  const motes = particles(70, {
    vs: `vec3 move(vec3 p, float s, float t){ p.x += sin(t * 0.13 + s * 40.0) * 0.06; p.y += mod(t * 0.012 * (0.5 + s) + s, 1.0) * 0.25 - 0.12; return p; }`,
    fs: `void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d) * (0.5 + 0.5 * sin(uTime * 1.3 + vSeed * 30.0)); gl_FragColor = vec4(vec3(1.0, 0.95, 0.8) * a * uOpacity, 1.0); }`
  }, 0.012, (p, i) => { p[i * 3] = rnd(-0.55, 0.05); p[i * 3 + 1] = rnd(-0.4, 0.15); p[i * 3 + 2] = rnd(0.1, 0.6); });
  const flies = particles(18, {
    vs: `vec3 move(vec3 p, float s, float t){ p.x += sin(t * 0.21 + s * 17.0) * 0.12; p.y += cos(t * 0.17 + s * 23.0) * 0.06; return p; }`,
    fs: `void main(){ float d = length(gl_PointCoord - 0.5); float a = exp(-d * d * 18.0) * (0.35 + 0.65 * pow(0.5 + 0.5 * sin(uTime * (0.8 + vSeed) + vSeed * 40.0), 3.0)); gl_FragColor = vec4(vec3(1.0, 0.86, 0.45) * a * uOpacity, 1.0); }`
  }, 0.05, (p, i) => { p[i * 3] = rnd(-0.65, 0.65); p[i * 3 + 1] = rnd(-0.35, 0.3); p[i * 3 + 2] = rnd(0.2, 0.9); });
  const petals = particles(34, {
    vs: `vec3 move(vec3 p, float s, float t){ float f = mod(t * (0.035 + s * 0.03) + s, 1.0); p.x = mix(-0.62, 0.75, f) + sin(t * 0.7 + s * 9.0) * 0.05 + (s - 0.5) * 0.3; p.y = mix(0.4, -0.55, f) + sin(t * 1.1 + s * 5.0) * 0.03; return p; }`,
    fs: `void main(){ vec2 q = gl_PointCoord - 0.5; float c = cos(vRot), s = sin(vRot); q = vec2(c * q.x - s * q.y, s * q.x + c * q.y); q.x *= 1.9;
      float a = smoothstep(0.32, 0.22, length(q)); gl_FragColor = vec4(mix(vec3(1.0, 0.78, 0.84), vec3(1.0, 0.92, 0.94), vSeed) , a * uOpacity * 0.9); }`,
    blend: NormalBlending
  }, 0.03, (p, i) => { p[i * 3 + 2] = rnd(0.15, 1.0); });
  const rain = particles(160, {
    vs: `vec3 move(vec3 p, float s, float t){ p.y = mix(0.3, 0.035, mod(t * (1.1 + s * 0.6) + s * 7.0, 1.0)); return p; }`,
    fs: `void main(){ vec2 q = gl_PointCoord - 0.5; float a = smoothstep(0.06, 0.0, abs(q.x + q.y * 0.12)) * smoothstep(0.5, 0.1, abs(q.y)); gl_FragColor = vec4(vec3(0.85, 0.9, 1.0) * a * uOpacity * 0.55, 1.0); }`
  }, 0.035, (p, i) => { p[i * 3] = rnd(-0.68, -0.4); p[i * 3 + 2] = 0.005; });

  // ---------- 天气切换 ----------
  const LOOK = {
    sunny: { grade: [1.0, 1.0, 1.0], sat: 1.02, amb: [1.0, 0.99, 0.97], rim: "#fff2d6", beams: 1, motes: 1, flies: 0, petals: 0, rain: 0, win: 0, lampMul: 0.5, bg: "#e7eef6" },
    blossom: { grade: [1.0, 0.99, 1.0], sat: 1.0, amb: [1.02, 0.97, 0.98], rim: "#ffe3ec", beams: 0.7, motes: 0.4, flies: 0, petals: 1, rain: 0, win: 0, lampMul: 0.5, bg: "#f6e6ea" },
    rainy: { grade: [0.86, 0.88, 0.91], sat: 0.85, amb: [0.88, 0.9, 0.94], rim: "#ffd9a8", beams: 0, motes: 0, flies: 0, petals: 0, rain: 1, win: 0.7, lampMul: 1, bg: "#d9dee2" },
    night: { grade: [1.0, 1.0, 1.0], sat: 1.0, amb: [0.78, 0.8, 0.98], rim: "#ffcf8a", beams: 0, motes: 0, flies: 1, petals: 0, rain: 0, win: 0, lampMul: 1, bg: "#1f2944" }
  };
  let cur = null, look = { ...LOOK.sunny }, target = LOOK.sunny;
  async function setWeather(id) {
    if (!LOOK[id] || id === cur) return;
    const t = await roomTex(id);
    if (!cur) { roomMat.uniforms.uA.value = t; roomMat.uniforms.uB.value = t; roomMat.uniforms.uMix.value = 1; }
    else { roomMat.uniforms.uA.value = roomMat.uniforms.uB.value; roomMat.uniforms.uB.value = t; roomMat.uniforms.uMix.value = 0; }
    cur = id; target = LOOK[id];
    if (!look.init) { look = { ...target, init: true }; }
  }
  const D_ = window.XUEBAO_DATA;
  const pickWeather = () => (new URLSearchParams(location.search).get("weather")) || stage.dataset.weather || D_?.weatherAt?.().id || "sunny";
  await setWeather(pickWeather());
  new MutationObserver(() => setWeather(pickWeather())).observe(stage, { attributes: true, attributeFilter: ["data-weather"] });

  // ---------- 视差输入 ----------
  let tx = 0, ty = 0, vx = 0, vy = 0, lastInput = 0;
  addEventListener("pointermove", (e) => { if (e.pointerType !== "mouse") return; tx = (e.clientX / innerWidth - 0.5) * 2; ty = (e.clientY / innerHeight - 0.5) * 2; lastInput = performance.now(); }, { passive: true });
  const onTilt = (e) => { if (e.gamma == null) return; tx = Math.max(-1, Math.min(1, e.gamma / 22)); ty = Math.max(-1, Math.min(1, (e.beta - 45) / 22)); lastInput = performance.now(); };
  let tiltAsked = false;
  const askTilt = () => {
    if (tiltAsked) return; tiltAsked = true;
    const DOE = window.DeviceOrientationEvent;
    if (DOE && typeof DOE.requestPermission === "function") DOE.requestPermission().then((s) => { if (s === "granted") addEventListener("deviceorientation", onTilt); }).catch(() => {});
    else if (DOE) addEventListener("deviceorientation", onTilt);
  };
  addEventListener("click", askTilt, { passive: true }); addEventListener("touchend", askTilt, { passive: true });

  // 点地板：雪宝走过去
  canvas.addEventListener("click", (e) => {
    const u = (e.clientX - SR.left) / SR.width, v = (e.clientY - SR.top) / SR.height;
    if (v > 0.7) window.dispatchEvent(new CustomEvent("xb:floor", { detail: { x: u * 100, y: v * 100 } }));
  });

  // ---------- 尺寸 ----------
  function resize() {
    SR = stage.getBoundingClientRect();
    renderer.setSize(stage.clientWidth, stage.clientHeight, false);
    const ph = stage.clientHeight * renderer.getPixelRatio();
    [motes, flies, petals, rain].forEach((p) => { p.material.uniforms.uH.value = stage.clientHeight; });
    pMat.uniforms.uH.value = stage.clientHeight; pMat.uniforms.uPR.value = renderer.getPixelRatio();
    void ph;
  }
  new ResizeObserver(resize).observe(stage); resize();
  stage.classList.add("is3d");
  addEventListener("scroll", () => { SR = stage.getBoundingClientRect(); }, true);

  // ---------- 主循环 ----------
  const lerp = (a, b, t) => a + (b - a) * t;
  const t0 = performance.now();
  let raf = 0;
  let lastMs = performance.now(), zoom = 1, fcx = 0, fcy = 0;
  function frame(nowMs) {
    raf = requestAnimationFrame(frame);
    if (document.hidden) { lastMs = nowMs; return; }
    const t = (nowMs - t0) / 1000;
    const dt = Math.min(0.05, Math.max(0.001, (nowMs - lastMs) / 1000)); lastMs = nowMs;
    clock = t; pMat.uniforms.uTime.value = t;
    if (me.mesh.material.uniforms.uTime) me.mesh.material.uniforms.uTime.value = t;
    SR = stage.getBoundingClientRect();
    // 天气参数缓动
    const e = 0.04;
    roomMat.uniforms.uMix.value = Math.min(1, roomMat.uniforms.uMix.value + 0.012);
    for (const k of ["sat", "beams", "motes", "flies", "petals", "rain", "win", "lampMul"]) look[k] = lerp(look[k], target[k], e);
    look.grade = look.grade.map((v, i) => lerp(v, target.grade[i], e)); look.amb = look.amb.map((v, i) => lerp(v, target.amb[i], e));
    roomMat.uniforms.uGrade.value.set(...look.grade); roomMat.uniforms.uSat.value = look.sat; roomMat.uniforms.uWin.value = look.win; roomMat.uniforms.uTime.value = t;
    const lampOn = stage.classList.contains("lamp-on") ? 1 : 0;
    look.lamp = lerp(look.lamp ?? lampOn, lampOn, 0.08);
    roomMat.uniforms.uLamp.value = look.lamp * look.lampMul;
    amb.setRGB(...look.amb); amb.offsetHSL(0, 0, 0); rimCol.lerp(new Color(target.rim), 0.05);
    if (look.lamp > 0.01) amb.lerp(new Color(1.04, 0.95, 0.86), 0.12 * look.lamp * look.lampMul);
    lampGlow.material.uniforms.uOpacity.value = 0.4 * look.lamp * look.lampMul;
    lanternGlow.material.uniforms.uOpacity.value = 0.45 * Math.max(look.lamp * look.lampMul, cur === "night" || cur === "rainy" ? 1 : 0);
    beams.forEach((b) => { b.material.uniforms.uTime.value = t; b.material.uniforms.uOpacity.value = 0.16 * look.beams; b.visible = look.beams > 0.01; });
    [[motes, look.motes], [flies, look.flies], [petals, look.petals], [rain, look.rain]].forEach(([p, o]) => { p.material.uniforms.uTime.value = t; p.material.uniforms.uOpacity.value = o; p.visible = o > 0.01; });
    [lampGlow, lanternGlow].forEach((m) => { m.material.uniforms.uTime.value = t; });
    // 相机：鼠标 / 陀螺仪；没人动时轻轻漂
    const idle = performance.now() - lastInput > 2500;
    const ix = idle && !reduce ? Math.sin(t * 0.21) * 0.45 : tx, iy = idle && !reduce ? Math.sin(t * 0.17 + 1) * 0.3 : ty;
    vx = lerp(vx, reduce ? 0 : ix, 0.05); vy = lerp(vy, reduce ? 0 : iy, 0.05);
    zoom = lerp(zoom, reduce ? 1 : zoomT, 0.06); fcx = lerp(fcx, focus[0], 0.1); fcy = lerp(fcy, focus[1], 0.1);
    offAxis(vx * 0.075, -vy * 0.045, zoom, fcx, fcy);
    for (const it of items) place(it, dt);
    renderer.render(scene, camera);
  }
  raf = requestAnimationFrame(frame);
  window.XB3D = { setWeather, get weather() { return cur; } };
}
