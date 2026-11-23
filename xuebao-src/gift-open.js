/*
 * 雪宝游记 · 拆礼物演出（移植自高能手办团「盲盒回忆」实验：xuebao-3d/giftbox/ 里是原版粉色盲盒、内盒、光效贴图和音效）
 * 流程：盒子落下 → 手指按住封条往右撕（撕到 78% 前可以往回拉）→ 自动开盖、冒光 → 交给页面展示明信片和奖励。
 * 光的颜色提前透露这次礼物的稀有度：普通蓝光、少见紫光、稀有金光。
 */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const BASE = "xuebao-3d/giftbox/";
const DEG = Math.PI / 180;
const OPEN_AT = 0.78;
const INTRO = 2, FALL = 1, OPEN_DUR = 3.333333, HOLD = 0.16;
const LIGHTS = {
  1: { color: "#68caff", step: "蓝光 · 小惊喜", line: "是雪宝从路上带回来的礼物～" },
  2: { color: "#b17dff", step: "紫光 · 少见的地方", line: "哇，这次去了一个少见的地方！" },
  3: { color: "#ffcb62", step: "金光 · 稀有的地方", line: "金光！雪宝这次去了很稀有的地方！！" }
};
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const smooth = (v) => { v = clamp(v); return v * v * (3 - 2 * v); };
const CAM_FWD = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);

// Unity → three 坐标（x 镜像）
function nativeTransform(o, t) {
  const p = t.m_LocalPosition, q = t.m_LocalRotation, s = t.m_LocalScale;
  o.position.set(-p.x, p.y, p.z); o.quaternion.set(q.x, -q.y, -q.z, q.w).normalize(); o.scale.set(s.x, s.y, s.z);
}
function camQuat(d) {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(d[0] * DEG, d[1] * DEG, d[2] * DEG, "YXZ"));
  q.set(q.x, -q.y, -q.z, q.w); return q.multiply(CAM_FWD);
}
// 原版盒子材质：R=粗糙度 G=金属度 B=自发光
function sceneMask(m) {
  if (!m.roughnessMap || !m.metalnessMap || m.userData.mask) return;
  m.userData.mask = true; m.aoMap = null; m.aoMapIntensity = 0;
  const mask = m.roughnessMap;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uMask = { value: mask };
    sh.fragmentShader = "uniform sampler2D uMask;\n" + sh.fragmentShader.replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n totalEmissiveRadiance += diffuseColor.rgb * sqrt(max(texture2D(uMask, vRoughnessMapUv).r, 0.0));");
  };
  m.customProgramCacheKey = () => "xb-giftbox-mask"; m.needsUpdate = true;
}
// 内盒挂点 Anchorbox01 挂在没动画的骨骼副本上，改挂到真正动的那根骨骼
function bindAnchors(gltf) {
  const doc = gltf.parser.json, animated = new Set((doc.animations || []).flatMap((c) => c.channels.map((ch) => ch.target.node)));
  const named = new Map(), anchors = [];
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse((o) => { const i = gltf.parser.associations.get(o)?.nodes; if (i === undefined) return; const n = doc.nodes[i].name; if (!named.has(n)) named.set(n, []); named.get(n).push({ o, i }); if (/^Anchorbox\d+$/i.test(n)) anchors.push(o); });
  for (const a of anchors) {
    const ex = a.parent, ei = gltf.parser.associations.get(ex)?.nodes; if (ei === undefined || animated.has(ei)) continue;
    const c = (named.get(doc.nodes[ei].name) || []).filter((x) => animated.has(x.i)); if (c.length !== 1) continue;
    const bone = c[0].o, fix = new THREE.Matrix4().copy(bone.matrixWorld).invert().multiply(ex.matrixWorld), bridge = new THREE.Group();
    fix.decompose(bridge.position, bridge.quaternion, bridge.scale); bone.add(bridge); bridge.add(a);
  }
}

let shared = null; // 模型、贴图、配置只加载一次
function loadShared() {
  if (shared) return shared;
  const loader = new GLTFLoader(), tl = new THREE.TextureLoader();
  const tex = (f) => tl.loadAsync(BASE + f).then((t) => { t.colorSpace = THREE.SRGBColorSpace; return t; });
  shared = Promise.all([
    fetch(BASE + "stage.json").then((r) => r.json()),
    loader.loadAsync(BASE + "single_up.glb"),
    Promise.all(["box_01.glb", "box_02.glb", "box_03.glb"].map((f) => loader.loadAsync(BASE + f))),
    Promise.all(["P_Glow_010.png", "T_Glow_004.png", "T_lighting_008.png", "T_Glow_006.png", "T_Stars_05.png"].map(tex))
  ]).then(([stage, box, cells, maps]) => {
    bindAnchors(box);
    const prep = (root) => root.traverse((o) => {
      if (!o.isMesh) return; o.castShadow = o.receiveShadow = true; if (o.isSkinnedMesh) o.frustumCulled = false;
      (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { if (/^kuaidihezi/.test(m.name) || /^avatar_drawcard_box_0[123]$/.test(m.name)) sceneMask(m); if (m.name === "chouka_lightblur") { o.visible = false; } });
    });
    prep(box.scene); cells.forEach((c) => prep(c.scene));
    return { stage, box, cells: cells.map((c) => c.scene), maps };
  }).catch((e) => { shared = null; throw e; });
  return shared;
}

// 原版音效
let actx = null; const sounds = {};
function unlockAudio() {
  try {
    actx ||= new (window.AudioContext || window.webkitAudioContext)(); actx.resume();
    for (const [k, f] of Object.entries({ drop: "ui_boxdrop2.mp3", tear: "ui_bigbox_jiaodai_open.mp3", reveal: "ui_openbox2.mp3" })) {
      sounds[k] ||= fetch(BASE + f).then((r) => r.arrayBuffer()).then((b) => actx.decodeAudioData(b)).catch(() => null);
    }
  } catch { /* 没声音也能看 */ }
}
function play(k, vol = 0.6, loop = false) {
  if (!actx || window.XBMuted?.()) return Promise.resolve(null);
  return sounds[k]?.then((buf) => { if (!buf) return null; const s = actx.createBufferSource(), g = actx.createGain(); s.buffer = buf; s.loop = loop; g.gain.value = vol; s.connect(g); g.connect(actx.destination); s.start(); return s; }) || Promise.resolve(null);
}

/**
 * 打开拆礼物演出。layer：全屏层；claim()：真正领取（返回服务器结果）；tierOf(res)：1–3；
 * 结束时 onDone(res)；领取失败 onError(e)。
 */
export function openGiftBox({ layer, claim, tierOf, onDone, onError }) {
  layer.hidden = false; layer.classList.add("gb-on");
  layer.innerHTML = `<div class="gb-stage"></div><div class="gb-flash"></div><div class="gb-peel" role="slider" tabindex="0" aria-label="封条，向右拖动撕开" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" hidden></div>
    <div class="gb-cap"><small class="gb-step">GIFT FROM XUEBAO</small><p class="gb-msg">雪宝在给你拿礼物……</p><i class="gb-hint" hidden></i></div><button class="gb-skip" type="button" hidden>跳过</button>`;
  const $ = (s) => layer.querySelector(s), host = $(".gb-stage"), peelEl = $(".gb-peel");
  const say = (step, msg) => { $(".gb-step").textContent = step; $(".gb-msg").textContent = msg; };
  unlockAudio();

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1; renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(26, 1, 0.1, 500);
  // 暖色舞台背景（代替原版 8MB 的房间）
  { const c = document.createElement("canvas"); c.width = 16; c.height = 256; const g = c.getContext("2d"), gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, "#3a2440"); gr.addColorStop(0.55, "#7a4a63"); gr.addColorStop(1, "#d79a8f"); g.fillStyle = gr; g.fillRect(0, 0, 16, 256);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; scene.background = t; }
  scene.add(new THREE.HemisphereLight(0xfff0e6, 0x6e5060, 1.3));
  const sun = new THREE.DirectionalLight(0xfaf0e4, 1.6), sq = new THREE.Quaternion(0.23005423, 0.39043206, -0.22113886, 0.86355984).normalize();
  sun.target.position.set(-19.5, -1, -9.2); sun.position.copy(sun.target.position).addScaledVector(new THREE.Vector3(0, 0, 1).applyQuaternion(sq), -40);
  sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 90 }); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight(0xffe3ec, 0.8); fill.position.set(20, 15, 30); scene.add(fill);
  { const pm = new THREE.PMREMGenerator(renderer), env = new RoomEnvironment(); scene.environment = pm.fromScene(env, 0.06).texture; scene.environmentIntensity = 0.4; env.dispose(); pm.dispose(); }
  const boxRoot = new THREE.Group(); scene.add(boxRoot);
  // 地面：接阴影的圆台 + 一圈柔光
  const floorGlow = (() => { const c = document.createElement("canvas"); c.width = c.height = 256; const g = c.getContext("2d"), r = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    r.addColorStop(0, "rgba(255,226,214,.95)"); r.addColorStop(0.45, "rgba(240,170,170,.55)"); r.addColorStop(1, "rgba(120,70,100,0)"); g.fillStyle = r; g.fillRect(0, 0, 256, 256);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const disc = new THREE.Mesh(new THREE.PlaneGeometry(26, 26).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: floorGlow, transparent: true, depthWrite: false })); boxRoot.add(disc);
  const shadowCatch = new THREE.Mesh(new THREE.PlaneGeometry(26, 26).rotateX(-Math.PI / 2), new THREE.ShadowMaterial({ opacity: 0.35 })); shadowCatch.position.y = 0.01; shadowCatch.receiveShadow = true; boxRoot.add(shadowCatch);

  let S = null, box = null, mixer = null, acts = {}, active = null, cell = null, fx = null, res = null, tier = 1, failed = false;
  let phase = "loading", t0 = 0, raf = 0, peel = 0, seal = 0, openT = 0, fired = new Set(), drag = null, tearSrc = null, tearTimer = 0, dead = false;

  const resize = () => {
    const w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight);
    renderer.setSize(w, h, false); camera.aspect = w / h;
    // 手机竖屏：盒子占屏幕宽度一半左右
    const ref = w < 700 ? 1.1 : 16 / 9, k = Math.max(1, ref / camera.aspect);
    camera.fov = (2 * Math.atan(Math.tan(((S?.fov || 26) * DEG) / 2) * k)) / DEG; camera.updateProjectionMatrix();
  };
  addEventListener("resize", resize);
  const sample = (track, dur, s) => {
    const time = clamp(s, 0, dur), sm = track.samples; let lo = 0, hi = sm.length - 1;
    while (lo + 1 < hi) { const mid = (lo + hi) >>> 1; if (sm[mid].time <= time) lo = mid; else hi = mid; }
    const a = sm[lo], b = sm[hi], m = b.time === a.time ? 0 : clamp((time - a.time) / (b.time - a.time));
    camera.position.set(-THREE.MathUtils.lerp(a.position[0], b.position[0], m), THREE.MathUtils.lerp(a.position[1], b.position[1], m), THREE.MathUtils.lerp(a.position[2], b.position[2], m));
    camera.quaternion.copy(camQuat(a.eulerDegrees)).slerp(camQuat(b.eulerDegrees), m); camera.updateMatrixWorld(true);
  };
  const pose = (state, n) => {
    const a = acts[state]; if (!a) return;
    if (active !== state) { mixer.stopAllAction(); a.reset().play(); a.paused = true; active = state; }
    a.time = a.getClip().duration * clamp(n); a.enabled = true; a.weight = 1; mixer.update(0); scene.updateMatrixWorld(true);
  };
  const render = () => { if (!dead) renderer.render(scene, camera); };

  // 光效（原版贴图，WebGL 里的运动方式）
  function makeFx(maps) {
    const root = new THREE.Group(), spr = (map, x, y, z, w, h) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, opacity: 0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); s.position.set(x, y, z); s.scale.set(w, h, 1); root.add(s); return s; };
    const seams = Array.from({ length: 4 }, () => spr(maps[1], 0, 4, 4.5, 5, 2)), soft = seams.map(() => spr(maps[0], 0, 4, 4.5, 4, 4));
    const flare = spr(maps[0], 0, 6.2, 1.5, 24, 24), rays = Array.from({ length: 14 }, (_, i) => { const s = spr(maps[2], 0, 6, 1.5, 10, 2); s.userData.a = (i * Math.PI * 2) / 14; return s; });
    const sparks = Array.from({ length: 40 }, (_, i) => { const s = spr(i % 3 ? maps[3] : maps[4], 0, 6, 1.5, 0.35, 0.35); s.userData.a = i * 2.399963; s.userData.v = 4 + (i % 7); return s; });
    const light = new THREE.PointLight(0xffffff, 0, 32, 1.5); light.position.set(0, 5.5, 0); root.add(light);
    boxRoot.add(root); boxRoot.updateMatrixWorld(true);
    const marks = []; box.traverse((n) => { if (/BoxStartlight0[1-4]/.test(n.name)) { const m = n.children.find((c) => c.name.startsWith("atk_01")); if (m) marks.push(m); } });
    seams.forEach((s, i) => { if (marks[i]) { marks[i].getWorldPosition(s.position); root.worldToLocal(s.position); } else s.position.set(-3 + i * 2, 4, 4); s.position.x *= 1.045; s.position.z *= 1.045; soft[i].position.copy(s.position); soft[i].material.depthTest = false; });
    root.visible = false;
    return { root, seams, soft, flare, rays, sparks, light };
  }
  function effects(glow, burst) {
    if (!fx) return;
    const color = new THREE.Color(LIGHTS[tier].color), early = new THREE.Color("#ffd9e4").lerp(color, smooth((seal - 0.45) / 0.4));
    fx.root.visible = glow > 0 || burst > 0 || phase === "opening";
    fx.light.color.copy(early); fx.light.intensity = glow * 18 + burst * 60;
    const th = [0.15, 0.4, 0.55, 0.7];
    fx.seams.forEach((s, i) => { const lit = seal >= th[i]; s.material.color.copy(early); s.material.opacity = lit ? glow * 0.95 : 0; s.scale.set(6 + i, 2 + glow, 1); fx.soft[i].material.color.copy(early); fx.soft[i].material.opacity = lit ? glow * 0.25 : 0; fx.soft[i].scale.set(3 + glow * 2, 4 + glow * 2, 1); });
    const opening = phase === "opening";
    fx.flare.material.color.copy(color); fx.flare.material.opacity = burst * 0.88; fx.flare.scale.setScalar(20 + burst * 20);
    fx.rays.forEach((s, i) => { const a = s.userData.a, r = 5 + burst * 6; s.position.set(Math.cos(a) * r, 6 + Math.sin(a) * r, 2); s.material.rotation = a; s.material.color.copy(i % 4 === 0 && tier === 3 ? new THREE.Color("#ff9ec4") : color); s.material.opacity = opening ? Math.max(0, 1 - openT / 2.1) * 0.45 : 0; s.scale.set(10 + burst * 12, 1 + burst, 1); });
    fx.sparks.forEach((s) => { const { a, v } = s.userData, d = openT * v; s.position.set(Math.cos(a) * d, 6 + Math.sin(a) * d + openT * 2, Math.sin(a * 1.7) * d); s.material.color.copy(color); s.material.opacity = opening ? clamp(1 - openT / 2.4) * 0.9 : 0; });
    $(".gb-flash").style.opacity = String(clamp(burst * 0.6)); $(".gb-flash").style.background = `radial-gradient(circle at 50% 50%, #fff, ${LIGHTS[tier].color} 40%, transparent 75%)`;
  }

  // 封条命中区：跟着封条网格在屏幕上的投影走（透明，不画箭头）
  let stripVerts = null;
  function peelRect() {
    const mesh = box.getObjectByName("kuaidihezi_1"); if (!mesh?.isSkinnedMesh) return null;
    if (!stripVerts) { const at = mesh.geometry.attributes, g = ["getX", "getY", "getZ", "getW"]; stripVerts = []; for (let i = 0; i < at.position.count; i++) if (g.some((m) => at.skinWeight[m](i) > 0 && /^Dummy\d{3}$/.test(mesh.skeleton.bones[at.skinIndex[m](i)].name))) stripVerts.push(i); }
    const p = new THREE.Vector3(), w = host.clientWidth, h = host.clientHeight; let l = 1e9, t = 1e9, r = -1e9, b = -1e9;
    for (const i of stripVerts) { mesh.getVertexPosition(i, p); mesh.localToWorld(p); p.project(camera); const x = ((p.x + 1) * w) / 2, y = ((1 - p.y) * h) / 2; l = Math.min(l, x); r = Math.max(r, x); t = Math.min(t, y); b = Math.max(b, y); }
    return { l, t, r, b };
  }
  function placePeel() {
    if (phase !== "peeling") return; const rc = peelRect(), W = host.clientWidth, H = host.clientHeight; if (!rc) return;
    // 手指好按：上下左右各放宽 30px
    const l = clamp(rc.l - 30, 4, W - 60), r = clamp(rc.r + 30, l + 60, W - 4), t = clamp(rc.t - 30, 60, H - 120), b = clamp(rc.b + 30, t + 60, H - 60);
    Object.assign(peelEl.style, { left: l + "px", top: t + "px", width: r - l + "px", height: b - t + "px" });
    const hint = $(".gb-hint"); hint.style.left = (l + r) / 2 + "px"; hint.style.top = (t + b) / 2 + "px";
  }
  function setPeel(v) {
    if (phase !== "peeling") return;
    peel = clamp(v); seal = clamp(peel / OPEN_AT);
    if (peel >= OPEN_AT) { finishPeel(); return; }
    sample(S.intro, INTRO, INTRO); pose("Process", seal);
    const glow = [0.15, 0.4, 0.55, 0.7, 0.85].filter((x) => seal >= x).length / 5;
    effects(glow, 0); render(); placePeel(); peelEl.setAttribute("aria-valuenow", String(Math.round(seal * 100)));
    if (seal > 0.02) $(".gb-hint").hidden = true;
    if (res) say(seal > 0.55 ? LIGHTS[tier].step : "PULL TO OPEN", seal > 0.55 ? "快了快了，再撕一点！" : "按住封条，往右撕开看看");
  }
  function tear() {
    clearTimeout(tearTimer); tearTimer = setTimeout(stopTear, 120);
    if (tearSrc) return; tearSrc = "pending"; play("tear", 0.5, true).then((s) => { if (tearSrc === "pending" && drag) tearSrc = s; else { try { s?.stop(); } catch {} if (tearSrc === "pending") tearSrc = null; } });
  }
  function stopTear() { clearTimeout(tearTimer); if (tearSrc && tearSrc !== "pending") { try { tearSrc.stop(); } catch {} } tearSrc = null; }
  const down = (e) => { if (phase !== "peeling" || drag || !e.isPrimary) return; unlockAudio(); drag = { id: e.pointerId, x: e.clientX, travel: Math.max(130, Math.min(560, host.clientWidth * 0.42)) }; try { peelEl.setPointerCapture(e.pointerId); } catch {} peelEl.classList.add("on"); };
  const move = (e) => { if (!drag || e.pointerId !== drag.id || phase !== "peeling") return; e.preventDefault(); const d = (e.clientX - drag.x) / drag.travel; drag.x = e.clientX; if (Math.abs(d) < 0.0001) return; setPeel(peel + d); if (phase === "peeling") tear(); };
  const up = (e) => { if (!drag || (e.pointerId !== drag.id && e.type !== "mouseup")) return; drag = null; peelEl.classList.remove("on"); stopTear(); };
  peelEl.addEventListener("pointerdown", down); addEventListener("pointermove", move, true); addEventListener("pointerup", up, true); addEventListener("pointercancel", up, true); addEventListener("mouseup", up, true);
  peelEl.addEventListener("keydown", (e) => { if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); setPeel(peel + (e.key === "ArrowRight" ? 0.06 : -0.06)); } });

  function finishPeel() {
    drag = null; stopTear(); peelEl.hidden = true; peel = seal = 1; phase = "opening"; t0 = performance.now(); loop();
  }
  function step(now) {
    const t = (now - t0) / 1000;
    if (phase === "intro") {
      sample(S.intro, INTRO, Math.min(t, INTRO));
      if (t < INTRO) { pose("Fall", clamp(t / FALL)); if (t >= 0.4258 && !fired.has("drop")) { fired.add("drop"); play("drop", 0.55); navigator.vibrate?.(18); } }
      else { pose("Process", 0); if (t >= INTRO + 0.2 && res) { phase = "peeling"; peelEl.hidden = false; $(".gb-hint").hidden = false; say("PULL TO OPEN", "按住封条，往右撕开看看"); setPeel(0); return false; } }
      effects(0, 0); render(); return true;
    }
    if (phase === "opening") {
      openT = Math.max(0, t - HOLD);
      const END = HOLD + OPEN_DUR * 0.9; // 内盒飞到镜头前就切到明信片，中间用一道白光接上
      if (t >= END) { done(); return false; }
      sample(S.intro, INTRO, INTRO); pose(t < HOLD ? "Process" : "Open", t < HOLD ? 1 : clamp(openT / OPEN_DUR));
      if (t >= HOLD) sample(S.result, 23 / 6, openT);
      const glow = 1 - smooth(openT / OPEN_DUR), burst = t < HOLD ? 0 : Math.max(0, 1 - Math.abs(openT - 0.62) / 0.42);
      if (openT > 0.26 && !fired.has("reveal")) { fired.add("reveal"); play("reveal", 0.6); navigator.vibrate?.([20, 40, 30]); }
      say(LIGHTS[tier].step, LIGHTS[tier].line); effects(glow, burst);
      const tail = clamp((t - (END - 0.35)) / 0.35); if (tail > 0) { const f = $(".gb-flash"); f.style.background = "#fff6f0"; f.style.opacity = String(Math.max(Number(f.style.opacity) || 0, tail)); }
      render(); return true;
    }
    return false;
  }
  function loop() { cancelAnimationFrame(raf); const tick = (now) => { if (dead) return; if (step(now)) raf = requestAnimationFrame(tick); }; raf = requestAnimationFrame(tick); }
  function done() {
    if (dead) return; phase = "done"; cancelAnimationFrame(raf); stopTear();
    const r = res; close(); onDone?.(r);
  }
  function close() {
    dead = true; cancelAnimationFrame(raf); stopTear();
    removeEventListener("resize", resize); removeEventListener("pointermove", move, true); removeEventListener("pointerup", up, true); removeEventListener("pointercancel", up, true); removeEventListener("mouseup", up, true);
    if (cell) cell.removeFromParent(); renderer.dispose(); renderer.domElement.remove(); scene.environment?.dispose?.(); layer.classList.remove("gb-on");
  }
  $(".gb-skip").addEventListener("click", () => { if (res) done(); });

  // 开始：同时加载素材和领取；落地前拿到结果就能决定光的颜色和内盒
  const claimP = claim().then((r) => { res = r; tier = Math.max(1, Math.min(3, tierOf(r) || 1)); if (cell === null && box) addCell(); $(".gb-skip").hidden = false; return r; })
    .catch((e) => { failed = true; if (!dead) { close(); onError?.(e); } throw e; });
  function addCell() {
    const anchor = box.getObjectByName("Anchorbox01"); if (!anchor || !shared) return;
    shared.then((sh) => { if (dead || cell) return; cell = sh.cells[tier - 1].clone(true); cell.scale.set(0.51, 0.57, 0.6); anchor.add(cell); });
  }
  loadShared().then((sh) => {
    if (dead) return;
    S = sh.stage; box = sh.box.scene; boxRoot.add(box); nativeTransform(boxRoot, S.anchor);
    mixer = new THREE.AnimationMixer(box); acts = {};
    for (const st of ["Fall", "Process", "Open"]) { const c = sh.box.animations.find((a) => a.name.toLowerCase().endsWith("_" + st.toLowerCase())); const a = mixer.clipAction(c); a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; acts[st] = a; }
    if (!fx || fx.root.parent !== boxRoot) fx = makeFx(sh.maps);
    if (res) addCell();
    resize(); say("GIFT FROM XUEBAO", "雪宝的礼物到了"); phase = "intro"; t0 = performance.now(); loop();
  }).catch(() => {
    // 演出素材没加载出来：礼物照样领，直接进结果
    if (dead || failed) return; close(); claimP.then((r) => onDone?.(r), () => {});
  });
  claimP.catch(() => {});
  return { close };
}

export const preloadGiftBox = () => { loadShared().catch(() => {}); };
