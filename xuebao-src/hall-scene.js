/* 雪宝的花园大厅 · 场景核心（实验页 lab.js 和正式页 hall.js 共用）
 * 家具、材质、天空来自 Poly Haven（CC0），见 xuebao-3d/CREDITS.json；深色雕花家具在着色器里改成白漆。
 * 宫殿式对称布局：后墙正中落地拱门通往花园，两侧落地长窗；两张洛可可沙发相对，中间大理石茶几。
 * 太阳／月光、吊灯、烛台都是真实光源；窗外 HDRI 同时提供环境光和反射。光线刻意压得克制。
 */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { buildXuebao } from "./xuebao-model.js";
import { createWalkMap } from "./walkmap.js";
import { buildZe } from "./ze-model.js";
import { buildWishTree } from "./wishtree.js";
import { buildFireplace } from "./fireplace.js";
import { buildGarden } from "./garden.js";
import { buildEntrances } from "./entrances.js";
import { buildFigureHouse } from "./figurehouse.js";
import { buildWeather } from "./weather.js";
import { buildGardenExtras } from "./garden-extras.js";
import { addHallDetails } from "./hall-details.js";
import { buildRoomProps } from "./room-props.js";
import { buildTopiaryCrown } from "./garden-models.js";

export { THREE };
export const ROOM = { W: 5.4, D: 4.6, H: 3.5, FRONT: 2.0 };

export function createHall(host, { mobile = matchMedia("(pointer: coarse)").matches, onProgress, onLoad } = {}) {
  const R = "xuebao-3d/", A = "xuebao-assets/";
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.append(renderer.domElement);
  const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 90);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const manager = new THREE.LoadingManager();
  manager.onProgress = (_, a, b) => onProgress?.(a / b);
  manager.onLoad = () => onLoad?.();
  const texLoader = new THREE.TextureLoader(manager), gltf = new GLTFLoader(manager), hdrLoader = new HDRLoader(manager);

  // ---------- 材质 ----------
  function pbr(name, repeat = [1, 1], o = {}, maps = ["Diffuse", "nor_gl", "Rough", "AO"]) {
    const base = `${R}textures/${name}/${name}_`;
    const t = (k, srgb) => { const x = texLoader.load(`${base}${k}_1k.jpg`); x.wrapS = x.wrapT = THREE.RepeatWrapping; x.repeat.set(...repeat); x.anisotropy = maxAniso; if (srgb) x.colorSpace = THREE.SRGBColorSpace; return x; };
    const p = {}; if (maps.includes("Diffuse")) p.map = t("Diffuse", true); if (maps.includes("nor_gl")) p.normalMap = t("nor_gl"); if (maps.includes("Rough")) p.roughnessMap = t("Rough"); if (maps.includes("AO")) p.aoMap = t("AO");
    return new THREE.MeshStandardMaterial({ ...p, ...o });
  }
  // 墙纸：奶粉色摄政条纹 + 金色小菱花（画布生成，干净不做旧）
  let wallCanvas = null;
  function wallpaper(repeat) {
    if (!wallCanvas) {
      const c = document.createElement("canvas"); c.width = c.height = 512; const g = c.getContext("2d");
      g.fillStyle = "#f9e4df"; g.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 4; i++) { const x = i * 128; g.fillStyle = "#f3d3cd"; g.fillRect(x + 8, 0, 44, 512); g.fillStyle = "#e9c48f"; g.fillRect(x + 4, 0, 2, 512); g.fillRect(x + 54, 0, 2, 512); }
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
        const x = i * 128 + 92, y = j * 128 + (i % 2 ? 64 : 0) + 40;
        g.save(); g.translate(x, y); g.fillStyle = "#e2b978";
        for (let k = 0; k < 4; k++) { g.rotate(Math.PI / 2); g.beginPath(); g.ellipse(0, -9, 4.5, 9, 0, 0, Math.PI * 2); g.fill(); }
        g.fillStyle = "#f4dcae"; g.beginPath(); g.arc(0, 0, 3.5, 0, Math.PI * 2); g.fill(); g.restore();
      }
      wallCanvas = c;
    }
    const t = new THREE.CanvasTexture(wallCanvas); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); t.anisotropy = maxAniso;
    const n = texLoader.load(`${R}textures/plastered_wall_04/plastered_wall_04_nor_gl_1k.jpg`); n.wrapS = n.wrapT = THREE.RepeatWrapping; n.repeat.set(repeat[0] * 0.5, repeat[1] * 0.5);
    return new THREE.MeshStandardMaterial({ map: t, normalMap: n, normalScale: new THREE.Vector2(0.25, 0.25), roughness: 0.82 });
  }
  const { W, D, H } = ROOM, T = 0.16, FRONT = ROOM.FRONT, TILE = 0.62;
  const ZC = (-D + FRONT) / 2, ZL = D + FRONT;
  const M = {
    floor: pbr("herringbone_parquet", [3.2, 3.2], { color: "#fff1e4", normalScale: new THREE.Vector2(0.7, 0.7) }),
    wallBack: wallpaper([1 / TILE, 1 / TILE]),
    wallSide: wallpaper([ZL / TILE, H / TILE]),
    wallFront: wallpaper([W / TILE, H / TILE]),
    white: new THREE.MeshStandardMaterial({ color: "#fbf6ef", roughness: 0.55 }),
    ceiling: new THREE.MeshStandardMaterial({ color: "#fdf8f2", roughness: 0.8 }),
    gold: new THREE.MeshStandardMaterial({ color: "#e0bb72", metalness: 1, roughness: 0.26 }),
    velvet: pbr("velour_velvet", [1.4, 3], { color: "#f0b2bd", side: THREE.DoubleSide }, ["nor_gl", "Rough", "AO"]),
    rug: pbr("curly_teddy_natural", [4, 3], { color: "#ffdfe0" }),
    glass: new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.05, transparent: true, opacity: 0.05, depthWrite: false })
  };
  const add = (geo, mat, x, y, z, o = {}) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (o.ry) m.rotation.y = o.ry; if (o.rx) m.rotation.x = o.rx; if (o.rz) m.rotation.z = o.rz; m.castShadow = o.cast !== false; m.receiveShadow = true; (o.parent || scene).add(m); return m; };
  const box = (w, h, d, mat, x, y, z, o) => add(new THREE.BoxGeometry(w, h, d), mat, x, y, z, o);
  const anchors = {}; // 可点物件的包围盒（给页面上的点击区定位）
  const anchorBox = (id, min, max) => { anchors[id] = new THREE.Box3(new THREE.Vector3(...min), new THREE.Vector3(...max)); };

  // ---------- 房间壳 ----------
  add(new THREE.PlaneGeometry(W + 0.4, ZL + 1.6).rotateX(-Math.PI / 2), M.floor, 0, 0, ZC + 0.8, { cast: false });
  const WIN = [{ cx: -1.75, w: 0.86, y0: 0.06, ys: 2.3 }, { cx: 0, w: 1.3, y0: 0.06, ys: 2.25 }, { cx: 1.75, w: 0.86, y0: 0.06, ys: 2.3 }];
  WIN.forEach((w) => { w.r = w.w / 2; w.x0 = w.cx - w.r; w.x1 = w.cx + w.r; w.top = w.ys + w.r; w.h = w.top - w.y0; w.cy = (w.y0 + w.top) / 2; });
  const arch = (p, w, pad = 0) => { p.moveTo(w.x0 - pad, w.y0 - pad); p.lineTo(w.x1 + pad, w.y0 - pad); p.lineTo(w.x1 + pad, w.ys); p.absarc(w.cx, w.ys, w.r + pad, 0, Math.PI, false); p.lineTo(w.x0 - pad, w.y0 - pad); return p; };
  const gardenStone = new THREE.MeshStandardMaterial({ color: "#ecdbcc", roughness: 0.8 });
  {
    const s = new THREE.Shape(); s.moveTo(-W / 2, 0); s.lineTo(W / 2, 0); s.lineTo(W / 2, H); s.lineTo(-W / 2, H); s.lineTo(-W / 2, 0);
    WIN.forEach((w) => s.holes.push(arch(new THREE.Path(), w)));
    add(new THREE.ExtrudeGeometry(s, { depth: T, bevelEnabled: false, curveSegments: 24 }), M.wallBack, 0, 0, -D - T);
    const gardenWall = gardenStone.clone();
    gardenWall.side = THREE.BackSide;
    add(new THREE.ShapeGeometry(s, 24), gardenWall, 0, 0, -D - T - 0.002, { cast: false }).userData.noHit = true;
  }
  for (const side of [-1, 1]) {
    const surfaces = [side > 0 ? gardenStone : M.wallSide, side < 0 ? gardenStone : M.wallSide,
      gardenStone, gardenStone, gardenStone, gardenStone];
    box(T, H, ZL, surfaces, side * (W / 2 + T / 2), H / 2, ZC);
    box(0.11, 0.12, ZL, M.white, side * (W / 2 + T + 0.028), H - 0.062, ZC, { cast: false });
    box(0.065, 0.035, ZL, M.gold, side * (W / 2 + T + 0.015), H - 0.139, ZC, { cast: false });
  }
  box(W + 2 * T, T, ZL, M.ceiling, 0, H + T / 2, ZC);
  [-1, 1].forEach((s) => box(0.1, 0.1, ZL, M.gold, s * (W / 2 - 0.05), H - 0.05, ZC, { cast: false }));
  [-1, 1].forEach((s) => box(0.06, 0.16, ZL, M.white, s * (W / 2 - 0.03), H - 0.18, ZC, { cast: false }));
  [-2.9, -1.4, 0.3].forEach((z) => box(W, 0.1, 0.14, M.white, 0, H - 0.05, z, { cast: false }));
  // 前墙（镜头可以转过来看）：墙纸 + 护墙板 + 金腰线 + 顶角线
  box(W, H, T, M.wallFront, 0, H / 2, FRONT + T / 2);
  box(W, 0.1, 0.1, M.gold, 0, H - 0.05, FRONT - 0.05, { cast: false }); box(W, 0.16, 0.06, M.white, 0, H - 0.18, FRONT - 0.03, { cast: false });
  // 护墙板：白色 + 金色腰线 + 踢脚
  const WAIN = 0.92;
  const backSegs = [[-W / 2, WIN[0].x0 - 0.1], ...WIN.slice(1).map((w, i) => [WIN[i].x1 + 0.1, w.x0 - 0.1]), [WIN[WIN.length - 1].x1 + 0.1, W / 2]];
  backSegs.forEach(([a, b]) => { box(b - a, WAIN, 0.03, M.white, (a + b) / 2, WAIN / 2, -D + 0.015); box(b - a, 0.035, 0.05, M.gold, (a + b) / 2, WAIN, -D + 0.025, { cast: false }); box(b - a, 0.12, 0.04, M.white, (a + b) / 2, 0.06, -D + 0.035); });
  box(W, WAIN, 0.03, M.white, 0, WAIN / 2, FRONT - 0.015); box(W, 0.035, 0.05, M.gold, 0, WAIN, FRONT - 0.025, { cast: false }); box(W, 0.12, 0.04, M.white, 0, 0.06, FRONT - 0.035);
  for (let x = -W / 2 + 0.35; x < W / 2 - 0.5; x += 0.78) { const zi = FRONT - 0.04; box(0.56, 0.025, 0.02, M.gold, x + 0.3, 0.3, zi, { cast: false }); box(0.56, 0.025, 0.02, M.gold, x + 0.3, 0.78, zi, { cast: false }); box(0.025, 0.5, 0.02, M.gold, x + 0.02, 0.54, zi, { cast: false }); box(0.025, 0.5, 0.02, M.gold, x + 0.58, 0.54, zi, { cast: false }); }
  [-1, 1].forEach((s) => {
    box(0.03, WAIN, ZL, M.white, s * (W / 2 - 0.015), WAIN / 2, ZC); box(0.05, 0.035, ZL, M.gold, s * (W / 2 - 0.025), WAIN, ZC, { cast: false }); box(0.04, 0.12, ZL, M.white, s * (W / 2 - 0.035), 0.06, ZC);
    for (let z = -D + 0.5; z < FRONT - 0.2; z += 0.78) {
      const xi = s * (W / 2 - 0.04);
      box(0.02, 0.025, 0.56, M.gold, xi, 0.3, z + 0.3, { cast: false }); box(0.02, 0.025, 0.56, M.gold, xi, 0.78, z + 0.3, { cast: false });
      box(0.02, 0.5, 0.025, M.gold, xi, 0.54, z + 0.02, { cast: false }); box(0.02, 0.5, 0.025, M.gold, xi, 0.54, z + 0.58, { cast: false });
    }
  });
  // 拱门/长窗：白框 + 金边、窗棂、玻璃、门槛、丝绒窗帘和金束带、窗檐
  const doors = []; let doorA = 0;
  WIN.forEach((w) => {
    const ring = arch(new THREE.Shape(), w, 0.07); ring.holes.push(arch(new THREE.Path(), w));
    add(new THREE.ExtrudeGeometry(ring, { depth: 0.1, bevelEnabled: false, curveSegments: 24 }), M.white, 0, 0, -D - 0.06);
    const rim = arch(new THREE.Shape(), w, 0.095); rim.holes.push(arch(new THREE.Path(), w, 0.07));
    add(new THREE.ExtrudeGeometry(rim, { depth: 0.04, bevelEnabled: false, curveSegments: 24 }), M.gold, 0, 0, -D, { cast: false });
    box(w.w, 0.04, 0.06, M.white, w.cx, w.ys, -D - 0.04);
    if (w.cx === 0) { // 正中是通往花园的双开门：上面半圆是固定的玻璃，下面两扇门往外开
      const top = new THREE.Shape(); top.moveTo(w.x1, w.ys); top.absarc(w.cx, w.ys, w.r, 0, Math.PI, false); top.lineTo(w.x1, w.ys);
      add(new THREE.ShapeGeometry(top, 24), M.glass, 0, 0, -D - T / 2, { cast: false });
      for (let k = 1; k < 6; k++) { const a = (k / 6) * Math.PI; box(0.025, w.r, 0.04, M.white, w.cx + Math.cos(a) * w.r / 2, w.ys + Math.sin(a) * w.r / 2, -D - 0.06, { rz: a - Math.PI / 2, cast: false }); }
      [-1, 1].forEach((k) => {
        const leaf = new THREE.Group(); leaf.position.set(k * w.r, 0, -D - 0.1); scene.add(leaf);
        const lw = w.r - 0.01, lh = w.ys - w.y0 - 0.02, y0 = w.y0 + 0.01, sx = -k;
        const part = (bw, bh, x, y) => box(bw, bh, 0.045, M.white, sx * x, y, 0, { parent: leaf });
        part(0.07, lh, 0.035, y0 + lh / 2); part(0.07, lh, lw - 0.035, y0 + lh / 2); part(lw, 0.07, lw / 2, y0 + lh - 0.035); part(lw, 0.16, lw / 2, y0 + 0.08);
        part(0.03, lh - 0.2, lw / 2, y0 + lh / 2 + 0.04); [0.25, 0.5, 0.75].forEach((f) => part(lw - 0.1, 0.03, lw / 2, y0 + 0.16 + (lh - 0.23) * f));
        add(new THREE.PlaneGeometry(lw - 0.1, lh - 0.23), M.glass, sx * lw / 2, y0 + 0.16 + (lh - 0.23) / 2, 0, { parent: leaf, cast: false });
        box(0.025, 0.16, 0.05, M.gold, sx * (lw - 0.09), y0 + 1.0, 0.035, { parent: leaf, cast: false });
        const panelX = sx * lw / 2;
        box(lw - 0.14, 0.095, 0.016, M.white, panelX, y0 + 0.081, 0.026, { parent: leaf, cast: false });
        for (const py of [y0 + 0.04, y0 + 0.121]) {
          box(lw - 0.17, 0.008, 0.008, M.gold, panelX, py, 0.038, { parent: leaf, cast: false });
        }
        doors.push({ leaf, k });
      });
    } else {
      box(0.04, w.h, 0.06, M.white, w.cx, w.cy, -D - 0.04);
      box(w.w, 0.035, 0.06, M.white, w.cx, (w.y0 + w.ys) / 2, -D - 0.04);
      add(new THREE.ShapeGeometry(arch(new THREE.Shape(), w), 24), M.glass, 0, 0, -D - T / 2, { cast: false });
    }
    box(w.w + 0.16, 0.05, 0.2, M.white, w.cx, w.y0 - 0.03, -D + 0.04);
    box(w.w + 0.62, 0.16, 0.12, M.white, w.cx, w.top + 0.32, -D + 0.08); box(w.w + 0.64, 0.025, 0.13, M.gold, w.cx, w.top + 0.24, -D + 0.085, { cast: false }); box(w.w + 0.64, 0.025, 0.13, M.gold, w.cx, w.top + 0.4, -D + 0.085, { cast: false });
    (w.cx === 0 ? [] : [[w.x0 - 0.22, 1], [w.x1 + 0.22, -1]]).forEach(([x, s]) => {
      const hh = w.top + 0.3, g = new THREE.PlaneGeometry(0.42, hh, 30, 30); const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { const px = p.getX(i), py = p.getY(i) + hh / 2, tie = Math.exp(-((py - 1.15) ** 2) * 5); p.setX(i, px * (1 - tie * 0.5) + s * tie * 0.07); p.setY(i, py); p.setZ(i, Math.sin(px * 30 + py) * 0.035 * (1 + tie) + Math.max(0, 0.25 - py) * 0.3); }
      g.computeVertexNormals(); add(g, M.velvet, x, 0, -D + 0.14);
      add(new THREE.TorusGeometry(0.045, 0.012, 10, 24), M.gold, x + s * 0.05, 1.15, -D + 0.2, { cast: false });
    });
  });
  addHallDetails(THREE, scene, { W, D, H, T, FRONT, WIN, M, add });
  anchorBox("door", [-0.62, 0.1, -D - 0.1], [0.62, 2.7, -D + 0.1]);
  anchorBox("window", [WIN[0].x0, 0.4, -D - 0.1], [WIN[0].x1, 2.6, -D + 0.1]);
  // 地毯：圆角粉色长毛毯 + 丝绒边
  {
    const rr = (w, h, r) => { const s = new THREE.Shape(); s.moveTo(-w / 2 + r, -h / 2); s.lineTo(w / 2 - r, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r); s.lineTo(w / 2, h / 2 - r); s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2); s.lineTo(-w / 2 + r, h / 2); s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); s.lineTo(-w / 2, -h / 2 + r); s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2); return s; };
    const ug = (g, k) => { const p = g.attributes.position, uv = g.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) * k, p.getY(i) * k); return g; };
    add(ug(new THREE.ShapeGeometry(rr(3.3, 2.3, 0.5), 16), 0.4).rotateX(-Math.PI / 2), M.velvet, 0, 0.006, -1.45, { cast: false });
    add(ug(new THREE.ShapeGeometry(rr(3.2, 2.2, 0.46), 16), 0.4).rotateX(-Math.PI / 2), M.rug, 0, 0.01, -1.45, { cast: false });
  }

  // ---------- 模型 ----------
  function lacquer(o, tint = "#fbf3ea", rough = 0.55) {
    o.traverse((c) => { if (!c.isMesh) return; const ms = Array.isArray(c.material) ? c.material : [c.material]; ms.forEach((m) => {
      if (/glass/i.test(m.name)) return;
      m.roughness = rough; m.onBeforeCompile = (sh) => { sh.uniforms.uTint = { value: new THREE.Color(tint) }; sh.fragmentShader = "uniform vec3 uTint;\n" + sh.fragmentShader.replace("#include <map_fragment>", "#include <map_fragment>\n  float lumP = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));\n  diffuseColor.rgb = uTint * (0.62 + 0.75 * sqrt(lumP));"); }; m.needsUpdate = true;
    }); });
  }
  function model(name, opts = {}) {
    return new Promise((res) => gltf.load(`${R}models/${name}/${name}.gltf`, (g) => {
      const o = g.scene;
      o.traverse((c) => { if (c.isMesh) { c.castShadow = opts.cast !== false; c.receiveShadow = true; const ms = Array.isArray(c.material) ? c.material : [c.material]; ms.forEach((m) => { ["map", "normalMap", "roughnessMap", "metalnessMap", "aoMap"].forEach((k) => { if (m[k]) m[k].anisotropy = maxAniso; }); }); } });
      if (opts.lacquer) lacquer(o, opts.lacquer);
      if (opts.scale) o.scale.set(...(Array.isArray(opts.scale) ? opts.scale : [opts.scale, opts.scale, opts.scale]));
      if (opts.ry) o.rotation.y = opts.ry;
      o.updateMatrixWorld(true);
      const b = new THREE.Box3().setFromObject(o);
      const [x, y, z] = opts.at;
      o.position.set(x - (b.min.x + b.max.x) / 2, y - b.min.y, z - (b.min.z + b.max.z) / 2);
      o.updateMatrixWorld(true);
      if (opts.anchor) anchors[opts.anchor] = new THREE.Box3().setFromObject(o);
      scene.add(o); res(o);
    }, undefined, () => res(null)));
  }
  const cardTex = (url) => { const t = texLoader.load(url); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = maxAniso; t.flipY = false; return t; };
  const canvases = {};
  function framed(name, card, opts) {
    return model(name, opts).then((o) => { o?.traverse((c) => { if (c.isMesh && /canvas/i.test(c.material.name)) { c.material = c.material.clone(); c.material.map = cardTex(`${A}${card}.webp`); c.material.roughness = 0.6; c.material.needsUpdate = true; if (opts.anchor) canvases[opts.anchor] = c.material; } }); return o; });
  }
  // 中间：两张洛可可沙发相对 + 大理石茶几 + 茶具
  const SAL = { z: -2.15 };
  const props = buildRoomProps(THREE);
  props.table(scene, SAL.z);
  [-1, 1].forEach((k) => {
    model("Sofa_01", { ry: k * -Math.PI / 2, at: [k * 1.5, 0, SAL.z], anchor: k < 0 ? "sofaL" : "sofaR" });
    [-0.4, 0.4].forEach((dz) => { const g = new THREE.SphereGeometry(0.16, 20, 14); g.scale(0.42, 0.95, 1); add(g, M.velvet, k * 1.62, 0.58, SAL.z + dz, { rz: k * 0.25 }); });
  });
  model("coffee_table_round_01", { scale: 0.62, at: [0, 0, SAL.z], anchor: "table" });
  model("tea_set_01", { scale: 0.44, ry: 0.3, at: [-0.031, 0.305, SAL.z - 0.042], anchor: "tea" });
  // 门边的白瓷花盆球形绿篱 + 盆栽
  const urn = new THREE.MeshStandardMaterial({ color: "#fbf7f1", roughness: 0.35 });
  function topiary(x, z, s = 1) {
    const pts = [[0,0],[.095,0],[.133,.021],[.122,.056],[.075,.073],[.073,.107],[.13,.13],[.168,.218],[.185,.338],[.199,.352],[.199,.387],[.188,.4],[.169,.4],[.166,.365],[.15,.339],[0,.339]]
      .map(([r,y])=>new THREE.Vector2(r*s,y*s));
    add(new THREE.LatheGeometry(pts,32),urn,x,0,z);
    add(new THREE.CircleGeometry(.166*s,24).rotateX(-Math.PI/2),new THREE.MeshStandardMaterial({color:"#6f5141",roughness:.98}),x,.342*s,z,{cast:false});
    add(new THREE.TorusGeometry(.187*s,.006*s,8,36).rotateX(-Math.PI/2),M.gold,x,.36*s,z,{cast:false});
    const bark = new THREE.MeshStandardMaterial({ color:"#775a3d",roughness:.91 });
    const branch = add(new THREE.CylinderGeometry(.013*s,.02*s,.281*s,9),bark,x,.48*s,z,{rz:x<0?-.065:.065});
    const pos = branch.position;
    const crown = buildTopiaryCrown(THREE,scene,.285*s,x+z);
    crown.position.set(pos.x + (x<0?.017:-.017),.835*s,pos.z);
  }
  [-0.95, 0.95].forEach((x) => topiary(x, -D + 0.35, 1.05));
  anchorBox("plant", [-1.3, 0, -D + 0.05], [-0.6, 1.2, -D + 0.65]);
  model("potted_plant_02", { scale: 1.25, at: [-W / 2 + 0.45, 0, -D + 0.45] });
  model("potted_plant_02", { scale: 1.25, ry: 2, at: [W / 2 - 0.45, 0, -D + 0.45] });
  // 左墙：梳妆台 + 金框镜子 + 烛台 + 花瓶 + 明信片画框
  const VAN = { z: -2.2 };
  model("ClassicConsole_01", { lacquer: "#fdf5ee", ry: Math.PI / 2, at: [-W / 2 + 0.31, 0, VAN.z] });
  model("ornate_mirror_01", { scale: 1.6, ry: Math.PI / 2, at: [-W / 2 + 0.03, 1.08, VAN.z] });
  const candleSet = model("brass_candleholders", { scale: 0.5, ry: Math.PI / 2, at: [-W / 2 + 0.3, 0.95, VAN.z], anchor: "candles" });
  model("antique_ceramic_vase_01", { scale: 0.55, at: [-W / 2 + 0.3, 0.95, VAN.z + 0.55] });
  framed("fancy_picture_frame_01", "pc-wh-sakura", { ry: Math.PI / 2, at: [-W / 2 + 0.02, 1.62, -3.4], anchor: "frameL" });
  // 前墙：一幅大画 + 两盆绿植 + 白瓷绿篱
  framed("fancy_picture_frame_02", "pc-xj-kanas", { scale: 1.05, ry: Math.PI, at: [0, 1.35, FRONT - 0.05], anchor: "frameF" });
  [-1.3, 1.3].forEach((x) => topiary(x, FRONT - 0.32, 0.9));
  // 右墙：白漆落地钟 + 明信片画框
  model("vintage_grandfather_clock_01", { lacquer: "#fdf5ee", ry: -Math.PI / 2, at: [W / 2 - 0.25, 0, -3.15], anchor: "clock" });
  framed("fancy_picture_frame_01", "pc-hz-snow", { ry: -Math.PI / 2, at: [W / 2 - 0.02, 1.62, -1.6], anchor: "frameR1" });
  framed("fancy_picture_frame_02", "pc-mh-aurora", { scale: 0.7, ry: -Math.PI / 2, at: [W / 2 - 0.045, 1.65, -2.35], anchor: "frameR2" });
  // 吊灯（青铜改亮金）
  const CH = new THREE.Vector3(0, H - 0.12, -2.15), CHS = 0.9;
  add(new THREE.CylinderGeometry(0.008, 0.008, 0.3, 8), M.gold, CH.x, H - 0.15, CH.z, { cast: false });
  add(new THREE.CylinderGeometry(0.16, 0.12, 0.05, 32), M.gold, CH.x, H - 0.02, CH.z, { cast: false });
  // 花瓣浮雕与同心线脚组成吊灯的顶盘。
  for (const [r, tube, y, mat] of [[0.36, 0.017, H - 0.012, M.white],
    [0.303, 0.0075, H - 0.025, M.gold], [0.206, 0.012, H - 0.032, M.white]]) {
    add(new THREE.TorusGeometry(r, tube, 8, 48), mat, CH.x, y, CH.z, { rx: Math.PI / 2, cast: false });
  }
  const ceilingPetals = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 6), M.white, 12);
  const petal = new THREE.Object3D();
  for (let i = 0; i < ceilingPetals.count; i++) {
    const a = i * Math.PI / 6;
    petal.position.set(CH.x + 0.256 * Math.sin(a), H - 0.011, CH.z + 0.256 * Math.cos(a));
    petal.rotation.y = a;
    petal.scale.set(0.021, 0.025, 0.043);
    petal.updateMatrix();
    ceilingPetals.setMatrixAt(i, petal.matrix);
  }
  ceilingPetals.receiveShadow = true; ceilingPetals.userData.noHit = true; scene.add(ceilingPetals);
  const chMats = [];
  model("Chandelier_03", { scale: CHS, at: [CH.x, H - 0.3 - 1.04 * CHS, CH.z], cast: false, anchor: "chandelier" }).then((o) => o?.traverse((c) => {
    if (!c.isMesh) return;
    if (/glass/i.test(c.material.name)) { c.material = c.material.clone(); c.material.emissive = new THREE.Color("#ffcf8f"); chMats.push(c.material); return; }
    const m = c.material; m.metalness = 1; m.roughness = 0.28; m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace("#include <map_fragment>", "#include <map_fragment>\n  float lumG = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));\n  diffuseColor.rgb = vec3(0.93, 0.76, 0.46) * (0.55 + 0.8 * sqrt(lumG));"); }; m.needsUpdate = true;
  }));
  const CH_LIGHT = new THREE.Vector3(CH.x, H - 0.3 - 1.04 * CHS * 0.55, CH.z);

  // ---------- 门外：童话森林花园（garden.js） ----------
  const garden = buildGarden(THREE, scene, { D, W, FRONT, mobile });
  // 左墙：梳妆台和写信桌之间的壁炉，上面挂一幅明信片画
  const FP = { z: -0.95 };
  const fireplace = buildFireplace(THREE, scene, { at: [-W / 2 + 0.004, 0, FP.z], ry: Math.PI / 2, mobile, photo: A + "pc-hz-snow.webp", texLoader });
  framed("fancy_picture_frame_02", "pc-ly-lamp", { scale: 0.78, ry: Math.PI / 2, at: [-W / 2 + 0.03, 1.78, FP.z], anchor: "frameFP" });
  const wishTree = buildWishTree(THREE, scene, { heightAt: garden.heightAt, mobile });
  // 瀑布小溪、宠物、灯串、彩旗、野餐毯、远山城堡热气球（garden-extras.js）
  const extras = buildGardenExtras(THREE, scene, { heightAt: garden.heightAt, mobile, Z0: garden.Z0 });
  // ---------- 9 个分页面的入口（entrances.js）：大厅 4 个、花园 5 个 ----------
  // 雨、雪、积雪、雪人、小伞（weather.js）
  const wx = buildWeather(THREE, scene, { Z0: garden.Z0, mobile, heightAt: garden.heightAt });
  const ent = buildEntrances(THREE, scene, { D, W, FRONT, heightAt: garden.heightAt, texLoader, maxAniso, A });
  // 手办屋（figurehouse.js）：她最喜欢的 10 个手办，各在一个玻璃罩里
  const fh = buildFigureHouse(THREE, scene, { heightAt: garden.heightAt, GLTFLoader, maxAniso });
  const rnd = (a, b) => a + Math.random() * (b - a);
  // 窗外的雨
  const RN = mobile ? 360 : 600, rp = new Float32Array(RN * 6);
  for (let i = 0; i < RN; i++) { const x = rnd(-3.4, 3.4), y = rnd(-0.3, 3.8), z = rnd(-D - 3.4, -D - 0.4); rp.set([x, y, z, x - 0.02, y - 0.16, z], i * 6); }
  const rainGeo = new THREE.BufferGeometry(); rainGeo.setAttribute("position", new THREE.BufferAttribute(rp, 3));
  const rainMat = new THREE.LineBasicMaterial({ color: "#dfe7f2", transparent: true, opacity: 0, depthWrite: false });
  const rain = new THREE.LineSegments(rainGeo, rainMat); rain.frustumCulled = false; scene.add(rain);
  // 花开：花瓣从门外飘进来
  const PN = mobile ? 70 : 120, pp = new Float32Array(PN * 3), pSeed = [];
  for (let i = 0; i < PN; i++) { pSeed.push([Math.random(), Math.random(), Math.random()]); }
  const petalGeo = new THREE.BufferGeometry(); petalGeo.setAttribute("position", new THREE.BufferAttribute(pp, 3));
  const petalTex = (() => { const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d"); g.fillStyle = "#ffd1dc"; g.beginPath(); g.ellipse(32, 32, 13, 24, 0.6, 0, Math.PI * 2); g.fill(); g.fillStyle = "#fff0f4"; g.beginPath(); g.ellipse(28, 28, 5, 11, 0.6, 0, Math.PI * 2); g.fill(); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const petalMat = new THREE.PointsMaterial({ map: petalTex, size: 0.05, transparent: true, opacity: 0, depthWrite: false, alphaTest: 0.02 });
  const petals = new THREE.Points(petalGeo, petalMat); petals.frustumCulled = false; scene.add(petals);

  // ---------- 天空 HDRI ----------
  const SKY = { day: "kloofendal_48d_partly_cloudy_puresky", rain: "kloofendal_overcast_puresky", dusk: "qwantani_dusk_2_puresky", night: "qwantani_night_puresky" };
  const envs = {};
  function loadSky(k) { return envs[k] ||= new Promise((res) => hdrLoader.load(`${R}hdri/${SKY[k]}_1k.hdr`, (t) => { t.mapping = THREE.EquirectangularReflectionMapping; res({ bg: t, env: pmrem.fromEquirectangular(t).texture }); })); }
  let skyKey = null;
  async function setSky(k) { if (k === skyKey) return; skyKey = k; const s = await loadSky(k); if (skyKey !== k) return; scene.background = s.bg; scene.environment = s.env; }
  scene.backgroundRotation.set(0, Math.PI, 0); scene.environmentRotation.set(0, Math.PI, 0);

  // ---------- 光 ----------
  const bounce = new THREE.HemisphereLight("#fff3e8", "#d7a58e", 0.4); scene.add(bounce);
  const windowFill = new THREE.PointLight("#fff3ea", 0, 0, 1.6); windowFill.position.set(0, 1.9, -D + 0.9); scene.add(windowFill);
  const floorBounce = new THREE.PointLight("#ffd2a8", 0, 0, 1.3); floorBounce.position.set(0, 0.3, -2.0); scene.add(floorBounce);
  const sun = new THREE.DirectionalLight("#fff1d6", 4); sun.castShadow = true;
  sun.shadow.mapSize.set(mobile ? 1536 : 2048, mobile ? 1536 : 2048); sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.025; sun.shadow.radius = 2.5;
  Object.assign(sun.shadow.camera, { left: -4.5, right: 4.5, top: 4.5, bottom: -4.5, near: 0.5, far: 30 }); scene.add(sun, sun.target); sun.target.position.set(0, 0, -2.4);
  const chand = new THREE.PointLight("#ffc98c", 0, 0, 2); chand.position.copy(CH_LIGHT); chand.castShadow = true; chand.shadow.mapSize.set(1024, 1024); chand.shadow.bias = -0.003; chand.shadow.radius = 6; scene.add(chand);
  const candle = new THREE.PointLight("#ffb46a", 0, 2.6, 2); candle.position.set(-W / 2 + 0.45, 1.3, VAN.z); scene.add(candle);
  function radial(soft = 0.25) { const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d"); const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(soft, "rgba(255,255,255,.35)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); }
  const chGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: radial(0.1), color: "#ffcf96", blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 })); chGlow.position.copy(CH_LIGHT); chGlow.scale.set(1.1, 1.1, 1); scene.add(chGlow);
  const flameMats = []; candleSet.then((o) => o?.traverse((c) => { if (c.isMesh && /flame/i.test(c.material.name)) { c.material = c.material.clone(); c.material.emissive = new THREE.Color("#ffb45c"); c.material.emissiveMap = c.material.map; flameMats.push(c.material); } }));

  // 体积光柱 + 浮尘（每扇窗一束，很淡）
  const shaftSrc = {
    vertexShader: "varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader: `uniform float uTime; uniform float uI; uniform vec3 uCol; uniform float uMY; uniform float uMY2; varying vec3 vP;
      void main(){
        float along = clamp(vP.x + 0.5, 0.0, 1.0);
        float edge = smoothstep(0.5, 0.36, abs(vP.y)) * smoothstep(0.5, 0.34, abs(vP.z));
        float bars = smoothstep(0.012, 0.035, abs(vP.y - uMY)) * smoothstep(0.012, 0.035, abs(vP.y - uMY2)) * smoothstep(0.01, 0.03, abs(vP.z));
        float a = edge * bars * smoothstep(0.08, 0.45, along) * pow(1.0 - along, 1.4) * (0.85 + 0.15 * sin(uTime * 0.6 + vP.z * 9.0)) * uI;
        gl_FragColor = vec4(uCol * a, a);
      }`
  };
  const DN = mobile ? 90 : 140;
  const shafts = WIN.map((w) => {
    const mat = new THREE.ShaderMaterial({ ...shaftSrc, uniforms: { uTime: { value: 0 }, uI: { value: 0 }, uCol: { value: new THREE.Color("#fff0cc") }, uMY: { value: (w.ys - w.cy) / w.h }, uMY2: { value: ((w.y0 + w.ys) / 2 - w.cy) / w.h } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat); m.renderOrder = 5; scene.add(m);
    const dp = new Float32Array(DN * 3); for (let i = 0; i < DN; i++) dp.set([rnd(-0.5, 0.25), rnd(-0.42, 0.42), rnd(-0.42, 0.42)], i * 3);
    const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(dp, 3));
    const dm = new THREE.PointsMaterial({ color: "#fff3d0", size: 0.01, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    m.add(new THREE.Points(geo, dm));
    return { w, m, mat, geo, dm };
  });

  // ---------- 小道具（存钱罐、信箱这类没有 3D 模型的，用雪宝游记自己的道具图立在场景里，受真实光照和阴影） ----------
  const radialTex = radial(0.35);
  function alphaBox(img) {
    try {
      const S = 128, c = document.createElement("canvas"); c.width = c.height = S; const g = c.getContext("2d", { willReadFrequently: true }); g.drawImage(img, 0, 0, S, S);
      const a = g.getImageData(0, 0, S, S).data; let x0 = S, y0 = S, x1 = -1, y1 = -1;
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (a[(y * S + x) * 4 + 3] > 110) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      if (x1 < 0) return { x: 0, y: 0, w: 1, h: 1 };
      return { x: x0 / S, y: y0 / S, w: (x1 - x0 + 1) / S, h: (y1 - y0 + 1) / S };
    } catch { return { x: 0, y: 0, w: 1, h: 1 }; }
  }
  function makePropShadow(at) {
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: radialTex, color: "#000", transparent: true, opacity: 0.3, depthWrite: false }));
    sh.material.blending = THREE.CustomBlending; sh.material.blendSrc = THREE.ZeroFactor; sh.material.blendDst = THREE.OneMinusSrcAlphaFactor;
    sh.position.set(at[0], at[1] + 0.004, at[2]); sh.renderOrder = 2; scene.add(sh);
    return sh;
  }
  function sprite(url, h, at, o = {}) {
    // 道具图四周常留透明边：读出不透明区域，只用这块贴到面片上，脚底才能真正贴住台面
    const t = texLoader.load(url, (tx) => { const b = alphaBox(tx.image); mesh.userData.ratio = (b.w * tx.image.width) / (b.h * tx.image.height); const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, b.x + uv.getX(i) * b.w, 1 - b.y - b.h + uv.getY(i) * b.h); uv.needsUpdate = true; fit(); }); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = maxAniso;
    const mat = new THREE.MeshStandardMaterial({ map: t, alphaTest: 0.4, roughness: 0.75, side: THREE.DoubleSide, emissive: "#ffffff", emissiveMap: t, emissiveIntensity: 0.1 });
    const geo = new THREE.PlaneGeometry(1, 1); geo.translate(0, 0.5, 0);
    const mesh = new THREE.Mesh(geo, mat); mesh.castShadow = true; mesh.userData = { h, ratio: 1, base: new THREE.Vector3(...at), lift: 0, liftV: 0 };
    mesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: t, alphaTest: 0.4 });
    mesh.position.set(...at); scene.add(mesh);
    const sh = makePropShadow(at); mesh.userData.shadow = sh;
    function fit() { const { h: hh, ratio } = mesh.userData; mesh.scale.set(hh * ratio, hh, 1); sh.scale.set(hh * ratio * 0.9, 1, hh * ratio * 0.45); }
    fit();
    return mesh;
  }
  const sprites = {};
  function addSprite(id, url, h, at) {
    if (!props[id] || id === "table") {
      sprites[id] = sprite(url, h, at);
      return sprites[id];
    }
    const prop = props[id](), shadow = makePropShadow(at);
    // 立体道具：朝向、阴影大小、放大倍数（手机上好点、看得清）
    const ROT = { radio: -0.16, cardbox: 0.52, mailbox: -0.35, piggy: 0.5, jar: 0.3, globe: 0.6, note: -0.25 };
    const SH = { radio: [0.27, 0.14], cardbox: [0.22, 0.13], mailbox: [0.34, 0.24], piggy: [0.32, 0.26], jar: [0.17, 0.17], globe: [0.27, 0.27], note: [0.17, 0.11] };
    const K = { radio: 1.2, cardbox: 1.2, mailbox: 1.18, piggy: 1.15, jar: 1.15, globe: 1.25, note: 1.2 }, k = K[id] || 1;
    prop.scale.setScalar(k); SH[id] = SH[id].map((v) => v * k);
    prop.position.set(...at); prop.rotation.y = ROT[id] ?? 0;
    shadow.scale.set(SH[id][0], 1, SH[id][1]);
    shadow.rotation.y = prop.rotation.y;
    prop.userData = { base: new THREE.Vector3(...at), lift: 0, liftV: 0, shadow, spin: prop.userData.spin };
    scene.add(prop);
    sprites[id] = prop;
    return prop;
  }

  // ---------- 雪宝（3D 小人，模型在 xuebao-model.js） ----------
  const XB = buildXuebao(THREE), xb = XB.root;
  xb.position.set(0, 0, -1.05); scene.add(xb);
  // ---------- 泽泽（ze-model.js）：雪雪玩的时候他是屋里的 NPC，站在壁炉旁边；选“我是泽泽”时他就是玩家 ----------
  const ze = buildZe(THREE); ze.loadGlb(GLTFLoader, R + "ze.glb?v=20261126b");
  const zeHome = { x: -1.3, z: 0.25 }, zeApproach = { x: -0.85, z: 0.55 };
  const snowStand = new THREE.Group(); snowStand.scale.setScalar(.9); scene.add(snowStand);
  ze.root.position.set(zeHome.x, 0, zeHome.z);
  ze.root.rotation.y = 1.0;
  ze.root.scale.setScalar(0.9);
  scene.add(ze.root);
  let playerZe = false, playerPhase = "";
  let zeCue = "", zeCueUntil = 0, zeCueT0 = 0;
  // 两个人的动作：duo = { id, t, dur }；牵手时 zeFollow = true（泽泽跟在雪宝身边走）
  let duo = null, zeFollow = false, zeYaw = 1.0, zeWalk = false, zeSpeed = 1;
  const zeSpot = {
    id: "ze-npc", name: "泽泽", icon: "💞", verb: "找泽泽", at: [zeHome.x, 1.15, zeHome.z],
    spot: zeApproach, pick: [ze.root], face: -Math.PI / 2, clip: "idle", dur: 1, near: 1.7,
    action: "ze-npc", available: () => !playerZe
  };
  const contact = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: radialTex, color: "#000", transparent: true, opacity: 0.42, depthWrite: false }));
  contact.material.blending = THREE.CustomBlending; contact.material.blendSrc = THREE.ZeroFactor; contact.material.blendDst = THREE.OneMinusSrcAlphaFactor;
  contact.renderOrder = 2; scene.add(contact);
  // 能走的地方：一张地面网格（walkmap.js）。大厅前半 + 两张沙发中间的过道 + 门洞 + 花园，家具和树挖掉
  const WM = createWalkMap({ x0: -8, x1: 8, z0: -19, z1: FRONT });
  WM.rect(-1.8, 2.0, -1.05, FRONT - 0.75).rect(-0.85, 0.85, -D + 0.75, -1.05).circle(0, SAL.z, 0.62);
  garden.walk(WM); wishTree.walk(WM); WM.rect(-.68,1.08,FRONT-.72,FRONT,0); ent.walk(WM); fh.walk(WM); extras.walk(WM); WM.circle(wx.snowman.x, wx.snowman.z, 0.3);
  wx.snowifyTree(scene, (o) => o === xb || o === ze.root || o === snowStand || o === fireplace.root); // 先给屋外材质都装上积雪着色器（平时为 0，不影响画面），下雪时不再卡一下
  const walkClamp = (x, z) => WM.clamp(x, z);
  // 只展示已加载的精模。新版失败时尝试上一版，加载期间保持人物隐藏。
  const GLB = { ready: false, mixer: null, acts: {}, cur: null, hands: [], seatFolds: [] };
  XB.body.visible = false;
  xb.visible = false;
  contact.visible = false;
  XB.root.attach(XB.cup);
  host.dataset.xbModel = "loading";
  const characterLoad = "雪宝角色模型";
  manager.itemStart(characterLoad);
  // 只有一个雪宝模型：加载失败就原地重试（不换别的模型、也不显示代码搭的小人）
  const MODEL_URL = `${R}xuebao.glb?v=20261122v6`;
  let statusEl = null;
  function setStatus(text, retry) {
    if (!statusEl) { statusEl = document.createElement("p"); statusEl.className = "xb-model-error"; statusEl.setAttribute("role", "status"); host.append(statusEl); }
    statusEl.textContent = text; statusEl.hidden = !text;
    if (retry) { const b = document.createElement("button"); b.type = "button"; b.textContent = "再试一次"; b.addEventListener("click", () => { setStatus("雪宝正在赶来的路上…"); loadCharacter(); }); statusEl.append(" ", b); }
  }
  async function loadCharacter() {
    const loader = new GLTFLoader();
    host.dataset.xbModel = "loading";
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const url = attempt ? `${MODEL_URL}&r=${Date.now()}` : MODEL_URL;
        const {scene: model, animations} = await loader.loadAsync(url);
        const face = model.getObjectByName("FaceDecal");
        if (!face?.material?.map || !animations.some((a) => a.name === "xb_idle")) throw new Error("雪宝角色贴图或动作缺失");
        model.traverse((o) => {
          if (!o.isMesh) return;
          o.castShadow = o.name !== "FaceDecal"; o.receiveShadow = true; o.frustumCulled = false; o.userData.xb = true;
          const fold = o.morphTargetDictionary?.SeatedSkirt;
          if (fold != null) GLB.seatFolds.push([o.morphTargetInfluences, fold]);
          const mt = o.material; mt.envMapIntensity = 0.8; XB.mats.push(mt);
        });
        const bone = (n) => model.getObjectByName(n) || model.getObjectByName(n.replace(".", ""));
        GLB.hands = [bone("hand.L"), bone("hand.R")];
        GLB.mixer = new THREE.AnimationMixer(model);
        animations.forEach((clip) => { GLB.acts[clip.name.replace(/^xb_/, "")] = GLB.mixer.clipAction(clip); });
        GLB.model = model;
        (playerZe ? snowStand : xb).add(model);
        GLB.ready = true;
        host.dataset.xbModelVersion = "v6";
        host.dataset.xbModel = "ready";
        setStatus("");
        char.swap();
        return;
      } catch (e) {
        console.warn(`雪宝模型加载失败（第 ${attempt + 1} 次）`, e);
        if (attempt < 2) { setStatus("雪宝正在赶来的路上…"); await new Promise((r) => setTimeout(r, 1500 * (attempt + 1))); }
      }
    }
    host.dataset.xbModel = "failed";
    setStatus("网络有点慢，雪宝还没到。", true);
  }
  loadCharacter().finally(() => manager.itemEnd(characterLoad));
  const CLIP = { idle: "idle", wait: "wait", tea: "tea", book: "book", nap: "nap", wave: "wave", wow: "wow", jump: "wow", back: "wow", pack: "pack" };
  const _hw = new THREE.Vector3(), _hw2 = new THREE.Vector3();
  function stepGlb(dt, walking, speed) {
    const P = char;
    // 坐下（长椅、秋千、地上喝茶看书打盹）时裙子顺着大腿搭下来，不插进地板
    const seated = P.act && /^(bench|swing)$/.test(P.act.s.id) || (SIT[P.pose] && !walking) ? 1 : 0;
    for (const [weights, index] of GLB.seatFolds) {
      weights[index] += (seated - weights[index]) * (1 - Math.exp(-dt * 14));
    }
    const want = playerZe ? (duo ? duo.D.clip : "idle") : P.dragging ? "drag" : walking ? (speed > 1.8 ? "run" : "walk") : P.air != null ? "wow" : P.act ? actClip(P.act) : P.hugT > 0 ? "hug" : CLIP[P.pose] || "idle";
    const next = GLB.acts[want] || GLB.acts.idle;
    if (next !== GLB.cur) {
      next.reset().setEffectiveWeight(1).play();
      if (GLB.cur) next.crossFadeFrom(GLB.cur, 0.28, true);
      GLB.cur = next;
    }
    if (want === "walk") next.timeScale = Math.max(0.6, speed * 1.5);
    if (want === "run") next.timeScale = speed * 0.62;
    GLB.mixer.update(dt);
    // 奶茶杯跟着右手、书捧在两手中间，杯子始终竖着
    const [hl, hr] = GLB.hands;
    if (hr && XB.cup.visible) { hr.getWorldPosition(_hw); xb.worldToLocal(_hw); XB.cup.position.set(_hw.x, _hw.y + 0.03, _hw.z + 0.02); XB.cup.rotation.set(0, 0, 0); }
    if (hl && hr && XB.book.visible) { hl.getWorldPosition(_hw); hr.getWorldPosition(_hw2); _hw.add(_hw2).multiplyScalar(0.5); xb.worldToLocal(_hw); XB.book.position.set(_hw.x, _hw.y + 0.02, _hw.z + 0.03); }
  }
  const NOCHAR = /[?&]nochar\b/.test(location.search);
  const SIT = { tea: 1, book: 1, nap: 1 };
  // 动作轮盘里的动作：seq 是按时间换的动画片段（跳舞），spin 是原地转几圈，bounce 是一颠一颠
  const actClip = (a) => { const sq = a.s.seq; if (!sq) return a.s.clip; let c = sq[0][1]; for (const [t0, k] of sq) if (a.t >= t0) c = k; return c; };
  // 头顶飘出来的小图标：爱心、音符、星星、zzz
  const EMO = {};
  function emoTex(ch, color) {
    if (EMO[ch]) return EMO[ch];
    const c = document.createElement("canvas"); c.width = c.height = 96; const g = c.getContext("2d");
    g.font = "64px 'Apple Color Emoji','Segoe UI Emoji',sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
    if (color) { g.fillStyle = color; g.font = "bold 62px 'PingFang SC',sans-serif"; g.shadowColor = "rgba(255,255,255,.9)"; g.shadowBlur = 8; }
    g.fillText(ch, 48, 52); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return (EMO[ch] = t);
  }
  const emos = [];
  for (let i = 0; i < 14; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false })); sp.visible = false; sp.renderOrder = 6; sp.userData.noHit = true; scene.add(sp); emos.push(sp); }
  let emoK = 0;
  const EMOSET = { heart: [["💗"], ["💕"], ["❤️"]], note: [["♪", "#e0708e"], ["♫", "#8a6bd0"], ["♪", "#e89b4c"]], spark: [["✨"], ["⭐"]], zzz: [["z", "#7c8bd6"], ["Z", "#7c8bd6"]], kiss: [["💋"], ["💗"], ["💕"]], star: [["✨"], ["🌟"]], warm: [["🔥"], ["✨"], ["💗"]], fish: [["🐟"], ["✨"], ["💦"]] };
  function emote(kind, n = 5, from) {
    const set = EMOSET[kind]; if (!set) return; const p = from || xb.position;
    for (let i = 0; i < n; i++) {
      const sp = emos[emoK++ % emos.length], [ch, col] = set[i % set.length];
      sp.material.map = emoTex(ch, col); sp.material.needsUpdate = true; sp.visible = true;
      sp.userData = { noHit: true, t: -i * 0.16, x: p.x + (Math.random() - 0.5) * 0.3, y: p.y + char.height * 0.95, z: p.z + (Math.random() - 0.5) * 0.2, w: (Math.random() - 0.5) * 0.4, kind };
      sp.position.set(sp.userData.x, sp.userData.y, sp.userData.z); sp.scale.setScalar(0.001);
    }
  }
  function stepEmotes(dt) {
    emos.forEach((sp) => {
      if (!sp.visible) return; const u = sp.userData; u.t += dt; if (u.t < 0) return;
      const k = u.t / (u.kind === "zzz" ? 2.2 : 1.5); if (k >= 1) { sp.visible = false; return; }
      sp.position.set(u.x + Math.sin(u.t * 3) * 0.05 + u.w * k, u.y + k * 0.55, u.z);
      const s0 = 0.16 * Math.min(1, u.t * 6) * (u.kind === "zzz" ? 0.6 + k * 0.6 : 1); sp.scale.setScalar(s0); sp.material.opacity = k > 0.7 ? (1 - k) / 0.3 : 1;
    });
  }
  // ---------- 能站上去的地方：玫瑰许愿泉两层（外沿 0.4 米、上层小碗 1 米），池里能蹚水 ----------
  // 平面上用 walkmap 找路；喷泉附近改用“高度”判断：比脚高出一个台阶的地方就是墙，跳得够高才能上去。
  const FCX = 0, FCZ = -11.0, FZONE = 1.5, STEP = 0.14, GRAV = 13.5, JUMP_V = 5.0;
  const terrainY = (x, z) => (z < garden.Z0 ? garden.heightAt(x, z) : 0);
  // 其它能跳上去的东西（长椅、秋千、奶茶推车、小茶座、蘑菇、树桩、沙发、茶几……）：
  // 每件是一块“盒子”或“圆柱”，有顶面高度 top 和底面 bottom（秋千座板悬空，底下 bottom>0）
  const PLATS = [];
  // 头顶上的东西（阳伞伞面、秋千横梁……）：跳起来头会撞到，跳不穿过去；也不会横着走进去
  const CEILS = [], HEAD = 0.78;
  const ceilHit = (x, z, y0, y1) => { for (const c of CEILS) if (x > c.x0 && x < c.x1 && z > c.z0 && z < c.z1 && c.bottom > y0 && c.bottom < y1) return c; return null; };
  let onBonk = null;
  const inPlat = (p, x, z, pad = 0) => {
    const dx = x - p.x, dz = z - p.z;
    if (p.r != null) return Math.hypot(dx, dz) < p.r + pad;
    const c = Math.cos(p.yaw || 0), sn = Math.sin(p.yaw || 0), u = dx * c - dz * sn, v = dx * sn + dz * c;
    return Math.abs(u) < p.hx + pad && Math.abs(v) < p.hz + pad;
  };
  // 没单独登记的矮东西（花盆、邮筒、篱笆、石头……）：挡路的地方往下打一条射线量顶面，够矮就能跳上去站着
  // 按 8 厘米一格缓存；太高（树、灯柱、墙）照样是墙；射线什么都没打到或只打到贴地的水面，就交回 walkmap 挡住
  let propHit = null; const topCache = new Map(), _ro = new THREE.Vector3(), _rd = new THREE.Vector3(0, -1, 0), topRay = new THREE.Raycaster();
  function propTop(x, z) {
    const k = Math.round(x / 0.08) + "," + Math.round(z / 0.08);
    let v = topCache.get(k); if (v !== undefined) return v;
    v = null;
    if (propHit) {
      topRay.set(_ro.set(x, 3.2, z), _rd); topRay.far = 3.4; topRay.camera = camera;
      const h = topRay.intersectObjects(propHit, true).find((i) => i.object.visible !== false && !i.object.userData.noHit && !i.object.isPoints && !i.object.isSprite);
      if (h) { const g = terrainY(x, z); if (h.point.y - g > 0.12) v = h.point.y; }
    }
    topCache.set(k, v); return v;
  }
  // walkmap 给物件留的那一圈余量（射线只打到地面）：旁边就有能站的物件时，这一圈也让她走/落，好跳上去
  const ringCache = new Map();
  const nearWall = (x, z) => z > -D - 0.45 && z < FRONT + 0.45 && (Math.abs(Math.abs(x) - W / 2) < 0.4 || (Math.abs(x) < W / 2 + 0.4 && (Math.abs(z - FRONT) < 0.4 || Math.abs(z + D) < 0.4)));
  function nearProp(x, z) {
    const k = Math.round(x / 0.08) + "," + Math.round(z / 0.08);
    let v = ringCache.get(k); if (v !== undefined) return v;
    v = false;
    if (nearWall(x, z)) { ringCache.set(k, v); return v; } // 屋子的四面墙附近不算（墙不在射线检测里，免得借着墙边的物件穿墙出去）
    for (const r of [0.15, 0.3, 0.45]) { for (let i = 0; i < 8 && !v; i++) { const a = i * Math.PI / 4, t = propTop(x + Math.cos(a) * r, z + Math.sin(a) * r); if (t != null && t < 1.75) v = true; } if (v) break; }
    ringCache.set(k, v); return v;
  }
  function surfaceAt(x, z, y) {
    const f = fountainAt(x, z, y);
    for (const p of PLATS) {
      if (!inPlat(p, x, z)) { if (inPlat(p, x, z, 0.3) && !(nearWall(x, z) && !WM.walkable(x, z))) f.zone = true; continue; } // 家具旁边一圈：可以走到跟前起跳
      if (p.top <= y + STEP + 0.001) { if (!f.wall && p.top > f.top) { f.top = p.top; f.zone = true; f.water = 0; f.plat = p; } }
      else if ((p.bottom || 0) < y + 0.8) return { top: p.top, zone: true, wall: true };
    }
    if (!f.zone && !f.plat && !WM.walkable(x, z)) {
      const t = propTop(x, z);
      if (t != null && t < 1.75) { if (t <= y + STEP + 0.001) { f.top = t; f.zone = true; f.water = 0; f.prop = true; } else return { top: t, zone: true, wall: true }; }
      else if (t == null && nearProp(x, z)) f.zone = true;
    }
    return f;
  }
  function fountainAt(x, z, y) {
    const dx = x - FCX, dz = z - FCZ, r0 = Math.hypot(dx, dz), base = terrainY(x, z);
    if (r0 > FZONE) return { top: base, zone: false };
    const a = Math.atan2(dx, dz), r = r0 / (1 + 0.1 * Math.cos(8 * a)), r2 = r0 / (1 + 0.065 * Math.cos(12 * a));
    if (r > 1.05) return { top: base, zone: true };
    if (r > 0.875) return { top: 0.405, zone: true, rim: 1 };
    // 最顶上那朵石头花（中间的喷水口）也能站：二段跳够得着
    if (r0 < 0.17 && y > 1.2) return { top: 1.5, zone: true, rim: 3 };
    if (r0 < 0.2 && y > 0.6) return { top: 1.5, zone: true, wall: true };
    if (r2 < 0.535 && y > 0.6) return r2 > 0.45 ? { top: 1.03, zone: true, rim: 2 } : { top: 0.875, water: 0.987, zone: true, bowl: true };
    if (r0 < 0.6) return { top: 9, zone: true, wall: true }; // 上层碗底下和中间的柱子
    return { top: 0.15, water: 0.292, zone: true };
  }
  // 平移一步：喷泉区按高度挡，其它地方交给 walkmap 顺边滑
  function moveH(x, z, ddx, ddz, y) {
    const nx = x + ddx, nz = z + ddz;
    const inZ = Math.hypot(nx - FCX, nz - FCZ) < FZONE || Math.hypot(x - FCX, z - FCZ) < FZONE || PLATS.some((p) => inPlat(p, nx, nz, 0.3) || inPlat(p, x, z, 0.3)) || (y > 0.2 && !!ceilHit(nx, nz, y + 0.25, y + HEAD)) || (!WM.walkable(nx, nz) && ((propTop(nx, nz) ?? 9) < 1.75 || nearProp(nx, nz))) || (y > 0.05 && !WM.walkable(x, z));
    if (!inZ) { const n = WM.slide(x, z, ddx, ddz); return { x: n.x, z: n.z, blocked: Math.hypot(n.x - nx, n.z - nz) > 1e-4 }; }
    // 身体有半个身宽：往前探 0.13 米也看一眼，免得半个身子插进石沿里
    const L = Math.hypot(ddx, ddz) || 1, fx = ddx / L * 0.13, fz = ddz / L * 0.13;
    const ok = (px, pz) => { const s0 = surfaceAt(px, pz, y), s1 = surfaceAt(px + fx, pz + fz, y); return Math.max(s0.top, s1.top) <= y + STEP && (s0.zone || WM.walkable(px, pz)) && !ceilHit(px + fx, pz + fz, y + 0.25, y + HEAD); };
    if (ok(nx, nz)) return { x: nx, z: nz, blocked: false };
    if (ok(nx, z)) return { x: nx, z, blocked: true };
    if (ok(x, nz)) return { x, z: nz, blocked: true };
    return { x, z, blocked: true };
  }
  // 水花：一小团水珠 + 水面一圈涟漪
  const splashN = mobile ? 90 : 160, splashP = new Float32Array(splashN * 3), splashV = new Float32Array(splashN * 3), splashL = new Float32Array(splashN);
  const splashGeo = new THREE.BufferGeometry(); splashGeo.setAttribute("position", new THREE.BufferAttribute(splashP, 3));
  const splashPts = new THREE.Points(splashGeo, new THREE.PointsMaterial({ map: radialTex, color: "#eef8ff", size: 0.045, transparent: true, opacity: 0.85, depthWrite: false }));
  splashPts.frustumCulled = false; splashPts.userData.noHit = true; scene.add(splashPts);
  let splashK = 0;
  function splash(x, y, z, n = 24, power = 1) {
    for (let i = 0; i < n; i++) {
      const k = splashK++ % splashN, a = Math.random() * Math.PI * 2, sp = (0.4 + Math.random() * 0.9) * power;
      splashP.set([x + Math.cos(a) * 0.08, y, z + Math.sin(a) * 0.08], k * 3);
      splashV.set([Math.cos(a) * sp, (1.4 + Math.random() * 1.6) * power, Math.sin(a) * sp], k * 3); splashL[k] = 0.5 + Math.random() * 0.4;
    }
    ringPuff(x, z, 0.5 + power * 0.25, y);
  }
  function stepSplash(dt) {
    for (let k = 0; k < splashN; k++) {
      if (splashL[k] <= 0) { splashP[k * 3 + 1] = -99; continue; }
      splashL[k] -= dt; splashV[k * 3 + 1] -= 9.8 * dt;
      splashP[k * 3] += splashV[k * 3] * dt; splashP[k * 3 + 1] += splashV[k * 3 + 1] * dt; splashP[k * 3 + 2] += splashV[k * 3 + 2] * dt;
    }
    splashGeo.attributes.position.needsUpdate = true;
  }
  let onSplash = null;
  // 二段跳时的一圈小星光（复用水珠的粒子，颜色换成暖金）
  const twN = 40, twP = new Float32Array(twN * 3), twV = new Float32Array(twN * 3), twL = new Float32Array(twN);
  const twGeo = new THREE.BufferGeometry(); twGeo.setAttribute("position", new THREE.BufferAttribute(twP, 3));
  const twPts = new THREE.Points(twGeo, new THREE.PointsMaterial({ map: radialTex, color: "#ffe2a8", size: 0.06, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  twPts.frustumCulled = false; twPts.userData.noHit = true; scene.add(twPts);
  function twinkle(x, y, z) { for (let i = 0; i < twN; i++) { const a = (i / twN) * Math.PI * 2; twP.set([x, y, z], i * 3); twV.set([Math.cos(a) * 1.1, (Math.random() - 0.3) * 0.6, Math.sin(a) * 1.1], i * 3); twL[i] = 0.45 + Math.random() * 0.2; } }
  function stepTwinkle(dt) { for (let i = 0; i < twN; i++) { if (twL[i] <= 0) { twP[i * 3 + 1] = -99; continue; } twL[i] -= dt; for (let c = 0; c < 3; c++) { twP[i * 3 + c] += twV[i * 3 + c] * dt; twV[i * 3 + c] *= 1 - dt * 3; } } twGeo.attributes.position.needsUpdate = true; }
  // 钓鱼：一根小竹竿、一根线、一个红白浮漂；甩出去 → 等 → 浮漂往下一沉 → 起竿、水花、小鱼跳一下
  const rod = new THREE.Group(); rod.visible = false; scene.add(rod);
  const rodPole = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.012, 1, 6).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ color: "#c9a46a", roughness: 0.6 }));
  rod.add(rodPole);
  const bob = new THREE.Group(); scene.add(bob); bob.visible = false;
  [["#ffffff", 0.018], ["#ef5a6f", -0.004]].forEach(([c, y]) => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8, 0, Math.PI * 2, y > 0 ? 0 : Math.PI / 2, Math.PI / 2), new THREE.MeshStandardMaterial({ color: c, roughness: 0.4 })); bob.add(m); });
  const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const fishLine = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: "#f4f1ea", transparent: true, opacity: 0.8 })); fishLine.frustumCulled = false; fishLine.visible = false; scene.add(fishLine);
  [rod, bob, fishLine].forEach((o) => o.traverse((c) => { c.userData.noHit = true; }));
  const _hand = new THREE.Vector3(), _tip = new THREE.Vector3();
  function stepFishing(a) {
    const t = a.t, yaw = char.yaw, fx = Math.sin(yaw), fz = Math.cos(yaw);
    if (GLB.hands?.[1]) GLB.hands[1].getWorldPosition(_hand); else _hand.set(xb.position.x, xb.position.y + 0.5, xb.position.z);
    // 竿子：先举起来往前甩，等的时候微微晃，咬钩时猛地往上提
    const cast = Math.min(1, t / 0.5), lift = t > 2.6 ? Math.min(1, (t - 2.6) / 0.25) : 0;
    const pitch = THREE.MathUtils.lerp(-0.2, 0.75, cast) - lift * 0.55 + Math.sin(t * 2.2) * 0.03;
    rod.visible = true; rod.position.copy(_hand); rod.rotation.set(0, 0, 0); rod.rotateY(yaw); rod.rotateX(pitch); rod.scale.setScalar(0.85);
    rodPole.updateMatrixWorld(true); _tip.set(0, 1, 0); rodPole.localToWorld(_tip);
    const far = 0.55 + cast * 0.7, bx = xb.position.x + fx * far, bz = xb.position.z + fz * far;
    const dip = t > 2.25 && t < 2.6 ? Math.sin((t - 2.25) / 0.35 * Math.PI) * 0.05 : 0;
    const by = (t > 2.6 ? -0.02 + lift * 0.4 : -0.02) - dip + Math.sin(t * 3) * 0.004;
    bob.visible = cast >= 1; bob.position.set(bx, by, bz);
    fishLine.visible = true; lineGeo.attributes.position.setXYZ(0, _tip.x, _tip.y, _tip.z); lineGeo.attributes.position.setXYZ(1, bx, cast >= 1 ? by + 0.02 : _tip.y - 0.3, bz); lineGeo.attributes.position.needsUpdate = true;
    if (cast >= 1 && !a.plop) { a.plop = true; splash(bx, -0.02, bz, 8, 0.4); }
    if (t > 2.6 && !a.caught) { a.caught = true; splash(bx, -0.02, bz, 26, 0.9); emote("fish", 3, { x: bx, y: -0.5, z: bz }); char.happyT = 1.5; onSplash?.(0.6); }
  }
  // 许愿：雪宝朝喷泉一扔，硬币转着飞进池子，“叮”一下溅起水花，池边亮一圈光
  const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.006, 20), new THREE.MeshStandardMaterial({ color: "#f2c86a", metalness: 1, roughness: 0.25, emissive: "#6a4a10", emissiveIntensity: 0.4 }));
  coin.visible = false; coin.userData.noHit = true; scene.add(coin);
  let coinFly = null;
  function tossCoin(done) {
    const p = xb.position, d = Math.hypot(p.x - FCX, p.z - FCZ), near = d < 3.2 && P0().y < 0.5;
    const from = new THREE.Vector3();
    if (near) {
      char.endAct(); char.path = [];
      char.act = { s: { id: "_toss", clip: "wave", dur: 1.6, face: Math.atan2(FCX - p.x, FCZ - p.z) }, t: 0, from: p.clone() };
      if (GLB.hands?.[1]) GLB.hands[1].getWorldPosition(from); else from.set(p.x, p.y + 0.6, p.z);
    } else from.set(FCX + 0.4, 2.6, FCZ + 0.6);
    const a = Math.atan2(from.x - FCX, from.z - FCZ), to = new THREE.Vector3(FCX + Math.sin(a) * 0.62, 0.292, FCZ + Math.cos(a) * 0.62);
    coinFly = { from, to, t: near ? -0.45 : 0, T: near ? 0.85 : 0.7, done }; coin.visible = false;
  }
  const P0 = () => char;
  function stepCoin(dt) {
    if (!coinFly) return; const c = coinFly; c.t += dt; if (c.t < 0) return;
    const k = Math.min(1, c.t / c.T); coin.visible = true;
    coin.position.lerpVectors(c.from, c.to, k); coin.position.y += Math.sin(k * Math.PI) * 0.7;
    coin.rotation.set(c.t * 14, c.t * 5, 0);
    if (k >= 1) { coin.visible = false; splash(c.to.x, 0.292, c.to.z, 22, 0.55); SPOTS.fountain?.start?.(); onSplash?.(0.4); const f = c.done; coinFly = null; setTimeout(() => f?.(), 450); }
  }
  function endFishing() { rod.visible = bob.visible = fishLine.visible = false; }
  const char = {
    mesh: xb, model: XB, height: 0.9, path: [], to: xb.position.clone(), lean: 0, leanV: 0, sq: 0, sqV: 0, jump: -1, step: 0, yaw: 0, y: 0, vy: 0, sup: 0, inWater: 0, pop: 1, popV: 0, lift: 0, liftV: 0,
    dragging: false, opacity: 1, walking: false, pose: "idle", sit: 0, idleT: 0, blinkT: 2, happyT: 0, tail: [[0, 0, 0, 0], [0, 0, 0, 0]], vel: new THREE.Vector3(), drive: null,
    setPose(p) { if (p === this.pose) return; this.pose = p; if (p === "wave" || p === "wow" || p === "jump") this.happyT = 1.6; },
    setTexture(url) { const m = /xb-(?:a-)?([a-z]+)/.exec(url || ""); if (m) this.setPose(m[1]); }, // 兼容：从 2D 姿势图的文件名读姿势
    walkClamp,
    // 走到某点：中间隔着茶几就绕过去
    goTo(p, snap = false) {
      const c = walkClamp(p.x, p.z), to = new THREE.Vector3(c.x, 0, c.z);
      // 走去别处就不再做手上的互动
      if (this.pending && Math.hypot(c.x - this.pending.spot.x, c.z - this.pending.spot.z) > 0.3) this.pending = null;
      if (this.act && !(this.pending && this.pending === this.act.s)) this.endAct();
      if (snap) { this.seatExit = null; xb.position.copy(to); this.path = []; this.to.copy(to); return; }
      const same = this.run && this.to.distanceTo(to) < 0.35;
      const from = this.seatExit?.end || xb.position;
      this.path = WM.path(from.x, from.z, c.x, c.z).map((q) => new THREE.Vector3(q.x, 0, q.z));
      this.to.copy(to);
      // 双击地面、或者要走很远：跑过去
      let L = 0, q0 = xb.position; this.path.forEach((q) => { L += Math.hypot(q.x - q0.x, q.z - q0.z); q0 = q; });
      this.run = !!(p.run || this.runNext) || same || L > 5; this.runNext = false;
    },
    // 拖着雪宝：她沿着能走的路跑向手指（不再飞起来穿墙）
    follow(x, z) { this.pending = null; this.endAct(); this.followT = { x, z }; },
    // 你一操作她就停下自己的溜达，听你的；很久没人管她再自己去玩
    touch() { this.userT = clock; this.wander = null; },
    stopFollow() { this.followT = null; },
    endAct() {
      if (!this.act) return;
      const exit = this.act.s.exit;
      if (exit) this.seatExit = { from: xb.position.clone(), end: new THREE.Vector3(exit.x, 0, exit.z), t: 0 };
      if (this.act.s.fish) endFishing();
      this.act = null;
      xb.rotation.x = 0;
    },
    hop() { this.jump = 0; this.sqV -= 2.2; this.happyT = 1; },
    // 真的跳起来：先蹲一下蓄力，腾空约 0.6 秒，落地压扁一下再弹回；走着跑着也能跳
    jumpUp() {
      if (this.dragging) return false;
      if (this.act) { this.endAct(); return true; } // 坐着的时候先站起来
      // 空中再按一次：二段跳（再往上蹿一截，翻个跟头）
      if (this.air != null || this.y > this.sup + 0.03 || this.charge != null) {
        if (this.dbl) return false;
        // 连按两下太快（还在蹲下蓄力、刚离地）：先记下来，离地后马上接二段跳
        if (this.charge != null || this.vy > JUMP_V * 0.7) { this.dblQueued = true; return true; }
        this.dbl = true; this.vy = JUMP_V * 1.08; this.flip = 0; this.happyT = 1.4; this.sqV += 3; // 不管在上升还是在往下掉，都重新蹿起一大截
        ringPuff(xb.position.x, xb.position.z, 0.75, this.y); twinkle(xb.position.x, this.y + 0.3, xb.position.z);
        return true;
      }
      this.air = 0; this.dbl = false; this.airRun = this.walking; this.sqV -= 2.4; this.happyT = 1; this.charge = 0.07; return true;
    },
    squash() { this.sqV -= 3.2; },
    hug() { this.sqV -= 2.6; this.happyT = 1.8; this.hugT = 1.8; },
    swap() { this.pop = 0.94; this.popV = 0; },
    // 手机上只取身体中间一段当“抓她”的区域，免得点地板、点道具时误碰到她
    bounds(b) { const s = this.height * this.pop, w = (mobile ? 0.14 : 0.24) * s, y0 = mobile ? 0.18 * s : 0; b.min.set(xb.position.x - w, xb.position.y + y0, xb.position.z - w); b.max.set(xb.position.x + w, xb.position.y + s * (mobile ? 0.82 : 1) * (1 - this.sit * 0.17), xb.position.z + w); return b; }
  };
  const lerp3 = (a, b, k) => a + (b - a) * k;
  const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
  const angDamp = (a, b, k, dt) => { let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return a + d * (1 - Math.exp(-k * dt)); };
  let lastFadeOp = 1, clock = 0;
  // ---------- 没人管的时候：雪宝自己在小世界里溜达 ----------
  // 有时在附近随便走走，有时去花园里的喷泉、秋千、长椅、蘑菇圈……玩一会儿；偶尔穿过门换个地方逛。
  const WANDER_AFTER = 15;
  function wanderTick(t) {
    const P = char, xp = xb.position;
    if (P.followT || P.drive || view.held || P.dragging) P.userT = t;
    if (!P.allowWander || P.opacity < 0.5 || t - (P.userT ?? -1e9) < WANDER_AFTER) { if (P.wander) P.wander = null; return; }
    if (SIT[P.pose] && !P.act) return; // 游戏让她坐下喝茶、看书、打盹时就别打扰
    const W0 = P.wander || (P.wander = { next: t + 1 + Math.random() * 2, until: 0 });
    if (P.act) { if (P.act.s.dur === Infinity && W0.until && t > W0.until) { P.endAct(); W0.next = t + 1.5 + Math.random() * 2; W0.until = 0; } return; }
    if (P.walking || P.path.length || P.pending || P.seatExit || t < W0.next) return;
    const inside = xp.z > -D, cross = Math.random() < 0.18;
    const fun = ALL.filter((s) => s.spot && !s.href && !s.action && (cross || (s.spot.z > -D) === inside));
    if (fun.length && Math.random() < 0.45) {
      const s = fun[Math.floor(Math.random() * fun.length)];
      P.goTo(s.spot); P.pending = s; P.run = false; W0.until = t + 9 + Math.random() * 8 + Math.hypot(s.spot.x - xp.x, s.spot.z - xp.z) / 1.1;
    } else {
      let pt = null;
      if (cross) pt = inside ? { x: (Math.random() - 0.5) * 3, z: -8.5 - Math.random() * 2 } : { x: (Math.random() - 0.5) * 2.4, z: -0.4 + Math.random() * 1.2 };
      for (let i = 0; i < 16 && !pt; i++) { const a = Math.random() * Math.PI * 2, r = 1 + Math.random() * 2.8, x = xp.x + Math.cos(a) * r, z = xp.z + Math.sin(a) * r; if (WM.walkable(x, z) && (z > -D) === inside) pt = { x, z }; }
      if (pt) { P.goTo(pt); P.run = false; }
    }
    W0.next = t + 3 + Math.random() * 5;
  }
  function stepChar(dt, t) {
    const P = char, R = XB;
    clock = t; wanderTick(t);
    if (P.drive && P.act?.s.exit) P.endAct();
    const seatExit = P.seatExit;
    // 跟着手指跑：每 0.2 秒重新找一次路
    if (P.followT) {
      P.followClock = (P.followClock || 0) - dt;
      if (P.followClock <= 0) {
        P.followClock = 0.2; const dd = Math.hypot(P.followT.x - xb.position.x, P.followT.z - xb.position.z);
        if (dd > 0.12) {
          const from = seatExit?.end || xb.position;
          P.path = WM.path(from.x, from.z, P.followT.x, P.followT.z).map((q) => new THREE.Vector3(q.x, 0, q.z));
          P.run = dd > 0.9;
        } else P.path = [];
        P.to.set(P.followT.x, 0, P.followT.z);
      }
    }
    const next = P.path[0];
    let walking = false, dirX = 0, dirZ = 0, speed = 0;
    if (seatExit) {
      seatExit.t = Math.min(1, seatExit.t + dt / 0.36);
      const k = THREE.MathUtils.smoothstep(seatExit.t, 0, 1);
      xb.position.lerpVectors(seatExit.from, seatExit.end, k);
      dirX = seatExit.end.x - seatExit.from.x;
      dirZ = seatExit.end.z - seatExit.from.z;
      walking = true; speed = 1.1;
      if (seatExit.t === 1) P.seatExit = null;
    }
    else if (P.dragging) { P.endAct(); P.pending = null; const d = P.to.clone().sub(xb.position); d.y = 0; xb.position.addScaledVector(d, Math.min(1, dt * 14)); dirX = d.x; P.path = []; }
    else if (P.drive && (P.drive.x || P.drive.z)) { // 键盘控制
      P.path = []; P.pending = null; P.endAct(); const v = new THREE.Vector3(P.drive.x, 0, P.drive.z); const vl = Math.min(1, v.length()); v.normalize();
      const sp = (P.drive.run ? 2.6 : 1.3 * Math.max(0.35, vl)) * (P.inWater ? 0.62 : 1), n = moveH(xb.position.x, xb.position.z, v.x * dt * sp, v.z * dt * sp, P.y);
      walking = true; dirX = v.x; dirZ = v.z; speed = sp; xb.position.x = n.x; xb.position.z = n.z; P.to.copy(xb.position);
    }
    else if (next) {
      const d = next.clone().sub(xb.position); d.y = 0; const dist = d.length();
      if (dist < 0.02) { P.path.shift(); if (!P.path.length && !P.followT) P.run = false; }
      else {
        walking = true; dirX = d.x; dirZ = d.z; speed = (P.run ? 2.6 : 1.1) * (P.inWater ? 0.62 : 1);
        const st = Math.min(dist, dt * speed), n = moveH(xb.position.x, xb.position.z, d.x / dist * st, d.z / dist * st, P.y);
        xb.position.x = n.x; xb.position.z = n.z;
        // 被台阶挡住（比如从池子里往外走）：够得着就自己跳上去，够不着就停下
        if (n.blocked && P.air == null) { const ah = surfaceAt(xb.position.x + d.x / dist * 0.12, xb.position.z + d.z / dist * 0.12, P.y + 0.7); if (ah.top - P.y < 0.68) P.jumpUp(); else P.path = []; }
      }
    }
    if (walking) { P.step += dt * 10.5; P.idleT = 0; } else P.idleT += dt;
    P.walking = walking;
    // 走到互动点：开始做那件事（坐秋千、看喷泉……）
    if (P.pending && !walking && !P.path.length && Math.hypot(xb.position.x - P.pending.spot.x, xb.position.z - P.pending.spot.z) < 0.3) {
      const s0 = P.pending; P.pending = null; P.act = { s: s0, t: 0, from: xb.position.clone() }; s0.start?.(); P.onAct?.(s0);
      if (s0.fx === "warm") emote("warm", 4);
    }
    // 门：雪宝走近（或要穿过门）就自动打开
    {
      const dz = xb.position.z + D, near = Math.hypot(xb.position.x, dz) < 1.45 || (Math.abs(xb.position.x) < 1 && Math.abs(dz) < 2.2 && P.path.some((q) => (q.z + D) * dz < 0));
      doorA = damp(doorA, near ? 1.62 : 0, near ? 4.5 : 2.2, dt); doors.forEach(({ leaf, k }) => { leaf.rotation.y = -k * doorA * (1 - 0.06 * k); });
    }
    // 朝向：走路看前方；停下一会儿转过来看镜头
    if (walking && (dirX || dirZ)) P.yaw = angDamp(P.yaw, Math.atan2(dirX, dirZ), 10, dt);
    else if (P.act) P.yaw = angDamp(P.yaw, P.act.s.face, 6, dt);
    else if (P.idleT > 1.2 && !SIT[P.pose]) P.yaw = angDamp(P.yaw, Math.atan2(camera.position.x - xb.position.x, camera.position.z - xb.position.z), 2.5, dt);
    xb.rotation.y = P.yaw;
    if (P.act?.s.spin) { const s0 = P.act.s, k = Math.min(1, P.act.t / (s0.spinDur || s0.dur)); xb.rotation.y = P.yaw + (s0.spin * Math.PI * 2) * (k < 1 ? (1 - Math.cos(k * Math.PI)) / 2 : 1); }
    // 二段跳翻跟头：绕身体中间转一圈（模型脚底是原点，所以要边转边把它挪回来）
    if (GLB.model) {
      const f = P.flip == null ? 0 : P.flip, e = f < 1 ? 1 - Math.pow(1 - f, 2.2) : 1, ang = f ? e * Math.PI * 2 : 0, c = 0.5;
      GLB.model.rotation.x = ang; GLB.model.position.y = c - c * Math.cos(ang); GLB.model.position.z = -c * Math.sin(ang);
    }
    P.sit = damp(P.sit, SIT[P.pose] && !walking && !P.dragging ? 1 : 0, 6, dt);
    P.leanV += (((walking ? 0.12 : 0) - P.lean) * 90 - P.leanV * 9) * dt; P.lean += P.leanV * dt;
    P.sqV += (-P.sq * 260 - P.sqV * 13) * dt; P.sq += P.sqV * dt;
    P.popV += ((1 - P.pop) * 300 - P.popV * 16) * dt; P.pop += P.popV * dt;
    P.liftV += (((P.dragging ? 0.22 : 0) - P.lift) * 120 - P.liftV * 12) * dt; P.lift += P.liftV * dt;
    let hop = 0; if (P.jump >= 0) { P.jump += dt; if (P.jump < 0.5) hop = Math.sin(Math.PI * P.jump / 0.5) * 0.25; else { P.jump = -1; P.sqV -= 2.8; } }
    // 竖直方向：重力、起跳、落地、走出边缘掉下去
    {
      const sf = surfaceAt(xb.position.x, xb.position.z, P.y); P.sup = sf.top;
      if (P.charge != null) { P.charge -= dt; if (P.charge <= 0) { P.charge = null; P.vy = JUMP_V; P.y += 0.01; if (sf.water && P.y < sf.water) splash(xb.position.x, sf.water, xb.position.z, 14, 0.7); } }
      if (P.dblQueued && P.charge == null && P.vy <= JUMP_V * 0.7) { P.dblQueued = false; P.jumpUp(); } // 排队的二段跳：上升到一小段后接上
      const grounded = P.y <= sf.top + 0.002 && P.vy <= 0;
      if (grounded) {
        if (sf.top - P.y < STEP + 0.01) P.y = sf.top; // 上下小台阶直接贴地
        P.vy = 0;
      } else {
        const y0 = P.y; P.vy -= GRAV * dt; P.y += P.vy * dt;
        if (P.vy > 0) { const c = ceilHit(xb.position.x, xb.position.z, y0 + HEAD - 0.02, P.y + HEAD); if (c) { P.y = c.bottom - HEAD; P.vy = -0.6; P.sqV += 2.6; P.dblQueued = false; ringPuff(xb.position.x, xb.position.z, 0.35, c.bottom); onBonk?.(); } }
        if (P.air == null && P.y > sf.top + 0.08) P.air = 0; // 走出边缘：开始掉
        if (P.y <= sf.top && P.vy < 0) { // 落地
          const impact = Math.min(1.6, -P.vy / 4);
          P.y = sf.top; P.vy = 0; P.air = null; P.dbl = false; P.dblQueued = false; P.flip = null; P.sqV -= 2.2 + impact * 2;
          if (sf.water) { splash(xb.position.x, sf.water, xb.position.z, Math.round(18 + impact * 18), 0.6 + impact * 0.5); onSplash?.(impact); }
          else ringPuff(xb.position.x, xb.position.z, 0.45 + impact * 0.2, sf.top);
          if (impact > 0.9 && !sf.water) P.happyT = 1;
        }
      }
      if (P.air != null) P.air += dt;
      if (P.flip != null) { P.flip = Math.min(1, P.flip + dt / 0.42); if (P.flip >= 1) P.flip = null; }
      P.inWater = sf.water && P.y < sf.water ? 1 : 0;
      if (P.inWater && walking && Math.random() < dt * 5) splash(xb.position.x, sf.water, xb.position.z, 3, 0.35);
      stepSplash(dt); stepTwinkle(dt); stepEmotes(dt); stepCoin(dt);
    }
    const s = P.step, sw = walking ? 1 : 0, sit = P.sit, pose = P.pose;
    const up = hop + P.lift + Math.max(0, P.y - P.sup);
    if (P.act?.s.bounce) hop += Math.abs(Math.sin(P.act.t * Math.PI * P.act.s.bounce)) * 0.07;
    if (!seatExit) xb.position.y = P.y + hop + P.lift;
    if (P.act) {
      P.act.t += dt; const s0 = P.act.s;
      if (s0.fish) stepFishing(P.act);
      if (s0.dur !== Infinity && P.act.t > s0.dur) P.endAct();
      else if (s0.hold) { const o = s0.hold(), k = Math.min(1, P.act.t / 0.45); xb.position.set(lerp3(P.act.from.x, o.x, k), lerp3(0, o.y, k), lerp3(P.act.from.z, o.z, k)); P.yaw = o.yaw; xb.rotation.y = o.yaw; xb.rotation.x = (o.tilt || 0) * k; P.to.copy(xb.position).setY(0); }
    }
    const sq = THREE.MathUtils.clamp(P.sq, -0.2, 0.18), S = P.height * P.pop;
    xb.scale.set(S * (1 - sq * 0.5), S * (1 + sq), S * (1 - sq * 0.5));
    // 身体：走路一颠一颠，站着轻轻呼吸，坐下往下沉
    R.body.position.y = sw * Math.abs(Math.sin(s)) * 0.025;
    R.body.rotation.x = P.lean * 0.6; R.body.rotation.z = sw * Math.sin(s) * 0.04 + (P.dragging ? Math.sin(t * 3.8) * 0.08 : 0);
    R.hips.position.y = 0.27 - sit * 0.2;
    R.chest.scale.y = 1 + (1 - sw) * Math.sin(t * 2.1) * 0.012;
    R.chest.rotation.y = sw * Math.sin(s) * 0.12;
    // 腿
    R.legs.forEach(({ leg, foot }, i) => {
      const k = i ? 1 : -1, ph = Math.sin(s) * k;
      let rx = sw * ph * 0.65, rz = 0;
      if (P.dragging) rx = Math.sin(t * 6 + i * 2) * 0.35;
      rx = rx * (1 - sit) + sit * -1.45; rz = sit * k * 0.12;
      leg.rotation.set(rx, 0, rz); foot.rotation.x = sit * 0.6 + sw * Math.max(0, -ph) * 0.4;
    });
    // 手：按姿势
    const A = { idle: [[-0.6, 0.24], [-0.6, -0.24]], wait: [[0.45, 0.25], [0.45, -0.25]], tea: [[-0.2, 0.2], [-1.25, -0.35]], book: [[-1.05, 0.3], [-1.05, -0.3]], nap: [[-0.4, 0.5], [-0.4, -0.5]], wave: [[-0.2, 0.25], [0, 2.6 + Math.sin(t * 9) * 0.3]], wow: [[0, -2.4], [0, 2.4]], jump: [[0, -2.2], [0, 2.2]], back: [[0, -2.5], [0, 2.5]], pack: [[-0.5, 0.3], [-0.5, -0.3]] };
    const a = A[pose] || A.idle;
    R.arms.forEach(({ arm }, i) => {
      const k = i ? 1 : -1; let [rx, rz] = a[i];
      rx = rx * (1 - sw) + sw * (-Math.sin(s) * k * 0.6 - 0.1); rz = rz * (1 - sw) + sw * (k * 0.25);
      if (P.dragging) { rx = -0.3; rz = k * (2.2 + Math.sin(t * 7) * 0.2); }
      arm.rotation.x = damp(arm.rotation.x, rx, 14, dt); arm.rotation.z = damp(arm.rotation.z, rz, 14, dt);
    });
    R.cup.visible = !playerZe && pose === "tea" && !walking;
    R.book.visible = !playerZe && pose === "book" && !walking;
    if (playerZe) { stepDuo(dt); if (!duo) snowStand.position.y = 0; }
    if (playerZe) {
      // 泽泽当玩家时：停下来 7 秒没人操作，也会自己做点小动作
      const idleMe = !walking && !duo && !P.act && clock - (P.userT || 0) > 7;
      if (!idleMe) pzCue = null;
      else if (!pzCue || clock > pzCue.until + 2 + Math.random() * 3) { const g = ZE_GESTURES[Math.floor(Math.random() * ZE_GESTURES.length)]; pzCue = { id: g[0], t0: clock, until: clock + g[1] }; if (g[2]) emote(g[2], 3, xb.position.clone().setY(0.15)); }
      const pc = pzCue && clock < pzCue.until ? pzCue : null;
      ze.animate(t, walking, duo ? duo.id : P.act?.s.clip === "wave" ? "wave" : pc ? pc.id : "", Boolean(P.act?.s.hold), duo ? duo.t / duo.dur : pc ? (clock - pc.t0) / (pc.until - pc.t0) : 0.5, speed);
    }
    else if (window.XBZePose != null) ze.animate(t, false, window.XBZePose, false, 0.5, 1); // 调试：定住一个姿势看
    else { stepZeNpc(dt, t); ze.animate(t, zeWalk, duo ? duo.id : zeFollow ? "hand" : t < zeCueUntil ? zeCue : "", false, duo ? duo.t / duo.dur : zeFollow ? 0.5 : Math.min(1, (t - zeCueT0) / Math.max(0.5, zeCueUntil - zeCueT0)), zeSpeed); }
    P.hugT = (P.hugT || 0) - dt;
    if (GLB.ready) stepGlb(dt, walking, speed);
    else R.book.position.set(0, 0.42 - sit * 0.2, 0.14);
    // 头：歪头、打盹点头、看镜头
    const nap = pose === "nap" && !walking;
    R.headPivot.rotation.z = damp(R.headPivot.rotation.z, nap ? 0.32 : Math.sin(t * 0.7) * 0.06 + (pose === "idle" ? 0.08 : 0), 5, dt);
    R.headPivot.rotation.x = damp(R.headPivot.rotation.x, nap ? 0.3 + Math.sin(t * 1.4) * 0.05 : pose === "book" ? 0.35 : pose === "tea" ? 0.1 : 0, 5, dt);
    // 双马尾：弹簧摆动，走路时往后甩，左右晃
    R.tails.forEach((joints, i) => {
      const st = P.tail[i], k = i ? 1 : -1;
      const tx = (walking ? 0.35 : 0) + (P.dragging ? -0.6 : 0) + (hop ? -0.5 : 0) + sw * Math.sin(s * 2) * 0.06 - sit * 0.3;
      const tz = k * 0.12 + sw * Math.sin(s) * 0.18 + Math.sin(t * 1.3 + i) * 0.03;
      st[1] += ((tx - st[0]) * 60 - st[1] * 7) * dt; st[0] += st[1] * dt;
      st[3] += ((tz - st[2]) * 60 - st[3] * 7) * dt; st[2] += st[3] * dt;
      joints.forEach((j, n) => { const f = n ? 0.35 : 1; j.rotation.x = st[0] * f; j.rotation.z = (n ? (st[2] - k * 0.12) * 0.4 : st[2]); });
    });
    // 表情：眨眼、开心、睡觉
    P.blinkT -= dt; P.happyT -= dt;
    let face = "open"; if (P.blinkT < 0) { face = "closed"; if (P.blinkT < -0.13) P.blinkT = 2.2 + Math.random() * 3; }
    if (P.happyT > 0 || P.dragging) face = "happy"; if (nap) face = "closed";
    const fm = R.faces[face]; if (R.faceMat.map !== fm) { R.faceMat.map = fm; R.faceMat.needsUpdate = true; }
    // 出门时淡出
    xb.visible = (playerZe || GLB.ready) && P.opacity > 0.02 && !NOCHAR; // ?nochar：截图检查场景时把人藏起来
    if (P.opacity !== lastFadeOp) { lastFadeOp = P.opacity; const tr = P.opacity < 0.999; R.mats.forEach((m) => { if (m === R.faceMat) { m.opacity = P.opacity; return; } if (m.transparent !== tr) { m.transparent = tr; m.needsUpdate = true; } m.opacity = P.opacity; }); }
    contact.visible = xb.visible; contact.position.set(xb.position.x, P.sup + 0.014, xb.position.z);
    const cs = P.height * 0.42 * (1 + up * 1.2); contact.scale.set(cs, 1, cs * 0.8); contact.material.opacity = 0.42 * P.opacity * (1 - Math.min(0.7, up * 2.5));
  }

  // ---------- 后期：MSAA + 很轻的柔光 + 轻调色 ----------
  const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.12, 0.4, 0.93); composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const grade = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uVig: { value: 0.16 }, uSat: { value: 1.14 }, uAspect: { value: 1 }, uBlack: { value: 0.025 }, uCon: { value: 0.42 }, uWB: { value: new THREE.Vector3(0.985, 1, 1.015) } },
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader: `uniform sampler2D tDiffuse; uniform float uVig; uniform float uSat; uniform float uAspect; uniform float uBlack; uniform float uCon; uniform vec3 uWB; varying vec2 vUv;
      void main(){
        vec4 c = texture2D(tDiffuse, vUv);
        // 黑场：把整体发灰、像蒙了一层白纱的底子压下去
        c.rgb = max(c.rgb - uBlack, 0.0) / (1.0 - uBlack);
        // 白平衡：中间调稍微往中性/冷一点拉（原来暗部加了一层暖色，整体偏黄偏暖）
        c.rgb *= mix(vec3(1.0), uWB, smoothstep(0.05, 0.6, dot(c.rgb, vec3(0.333))));
        float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
        c.rgb = mix(vec3(l), c.rgb, uSat);
        c.rgb = mix(c.rgb, c.rgb * c.rgb * (3.0 - 2.0 * c.rgb), uCon);
        c.rgb *= 1.0 - 0.16 * smoothstep(0.7, 1.0, l); // 亮处压一点，白墙和门外不发白刺眼
        vec2 q = (vUv - 0.5) * vec2(min(uAspect, 1.0) * 1.15, 1.0);
        c.rgb *= 1.0 - uVig * smoothstep(0.25, 0.85, length(q) * 1.25);
        gl_FragColor = c;
      }`
  });
  composer.addPass(grade);

  // ---------- 时间与天气 ----------
  const lerp = (a, b, t) => a + (b - a) * t;
  const C = (c) => new THREE.Color(c);
  const cur = {}, _wb = new THREE.Vector3();
  // env: { hour, weather: sunny|blossom|rainy|night, lamp }
  function look(env) {
    const h = env.hour, night = env.weather === "night", rain = env.weather === "rainy", snowy = env.weather === "snowy";
    const day = Math.max(0, Math.sin(((h - 6) / 13.6) * Math.PI)), warm = 1 - Math.min(1, day * 1.7);
    const lampOn = env.lamp;
    // 下雪：阴天的天空但雪地反光，整体亮一些、偏冷白
    // 下雪：原来环境光、窗光、曝光一起拉高，画面发白发平。改成：太阳稍亮出影子、环境光和曝光收回来，靠黑场和对比把层次找回来
    if (snowy) return { sky: "rain", sunI: 1.05, sunC: C("#eef3ff"), env: 0.4, bgI: 0.6, hemi: 0.42, fill: 1.0, fb: 0.22, exp: 0.94, black: 0.06, con: 0.52, wb: [0.965, 1.0, 1.035], sat: 1.08, chI: lampOn ? 1.8 : 0, candI: lampOn ? 0.7 : 0, rain: 0, petals: 0, shaft: 0.02, elev: 0.5, xbE: 0.12 };
    return {
      sky: night ? "night" : rain ? "rain" : warm > 0.55 ? "dusk" : "day",
      sunI: night ? 0.5 : rain ? 0 : 0.8 + day * 1.1, /* 白天太阳收着点，正午不刺眼 */ sunC: night ? C("#9fb6ff") : C("#fff4e0").lerp(C("#ffa864"), warm * 0.85),
      env: night ? 0.08 : rain ? 0.5 : 0.28 + day * 0.1, bgI: night ? 0.22 : rain ? 0.5 : warm > 0.55 ? 0.42 : 0.4,
      hemi: night ? 0.12 : rain ? 0.5 : 0.4 + day * 0.12, fill: night ? 0.2 : rain ? 1.4 : 0.85 + day * 0.3, fb: night ? 0 : rain ? 0 : 0.22 + day * 0.2, // 门口的窗光、地上反光压低，进门不刺眼
      exp: night ? 1.35 : rain ? 1.15 : 0.9 - day * 0.1,
      chI: lampOn ? (night ? 3.4 : 1.8) : 0, candI: lampOn ? 0.7 : 0,
      rain: 0, petals: env.weather === "blossom" ? 1 : 0, shaft: night ? 0.0 : rain ? 0 : 0.015 + day * 0.02, elev: night ? 0.55 : 0.2 + day * 0.62, xbE: night ? 0.05 : 0.12,
      black: night ? 0.018 : rain ? 0.045 : 0.04, con: night ? 0.38 : rain ? 0.48 : 0.46, wb: night ? [1, 1, 1.01] : warm > 0.55 ? [1, 0.995, 0.99] : [0.98, 1, 1.02], sat: night ? 1.1 : 1.12
    };
  }
  const _up = new THREE.Vector3(0, 1, 0), _m = new THREE.Matrix4();
  function setSunDir(elev, h) {
    const sx = THREE.MathUtils.clamp(((h - 12.5) / 7) * 0.55, -0.6, 0.6);
    const dir = new THREE.Vector3(sx, -Math.tan(Math.max(0.15, elev)), 1).normalize();
    sun.position.copy(sun.target.position).addScaledVector(dir, -12);
    const Y = _up.clone().addScaledVector(dir, -_up.dot(dir)).normalize(), Z = new THREE.Vector3().crossVectors(dir, Y);
    _m.makeBasis(dir, Y, Z);
    const L = 4.6;
    shafts.forEach(({ w, m }) => { m.quaternion.setFromRotationMatrix(_m); m.position.set(w.cx, w.cy, -D).addScaledVector(dir, L / 2 - 0.02); m.scale.set(L, w.h * Math.max(0.4, Y.y), w.w); });
    floorBounce.position.set(dir.x * 2, 0.3, THREE.MathUtils.clamp(-D + 1.5 / Math.max(0.2, -dir.y / dir.z), -D + 0.8, -0.8));
  }

  // ---------- 镜头：第三人称环绕（拖动转、双指／滚轮缓缓推拉），跟着雪宝走，碰到墙就往里收 ----------
  const view = {
    yaw: 0, pitch: 0.26, dist: 2.7, yawT: 0, pitchT: 0.26, distT: 2.7, vYaw: 0, vPitch: 0, held: false,
    minDist: 0.9, maxDist: 3.6, minPitch: 0.04, maxPitch: 1.05, fovT: 50, eff: 2.7,
    focus: new THREE.Vector3(0, 0.5, -1.05),
    orbit(dx, dy) { this.yawT -= dx * 0.0075; this.pitchT = THREE.MathUtils.clamp(this.pitchT + dy * 0.005, this.minPitch, this.maxPitch); this.vYaw = -dx * 0.0075; this.vPitch = dy * 0.005; },
    zoom(f) { this.distT = THREE.MathUtils.clamp(this.distT * f, this.minDist, this.maxDist); },
    reset() { this.yawT = Math.round(this.yaw / (Math.PI * 2)) * Math.PI * 2; this.pitchT = this.pitchHome ?? 0.26; this.distT = this.home; },
    home: 2.7
  };
  const BOUND_IN = { x0: -W / 2 + 0.2, x1: W / 2 - 0.2, y0: 0.18, y1: H - 0.2, z0: -D + 0.25, z1: FRONT - 0.2 };
  const BOUND_OUT = { x0: -9, x1: 9, y0: 0.3, y1: 7, z0: -19, z1: garden.Z0 - 0.25 };
  let BOUND = BOUND_IN;
  function resize(w, h) {
    renderer.setSize(w, h); composer.setSize(w, h); bloom.resolution.set(w, h);
    const aspect = w / h, k = THREE.MathUtils.smoothstep(aspect, 0.55, 1.35);
    // 竖屏手机：视角不再那么广，镜头退远一点、抬高一点，人物小一些，操作空间大
    view.fovT = lerp(56, mobile ? 50 : 44, k); view.home = lerp(4.1, mobile ? 3.7 : 2.7, k); view.pitchHome = lerp(0.36, mobile ? 0.3 : 0.26, k); view.inMax = lerp(5.0, mobile ? 4.6 : 3.6, k); // 手机横屏也退远一点
    if (!view.touched) { view.pitch = view.pitchT = view.pitchHome; }
    if (!view.touched) { view.dist = view.distT = view.eff = view.home; }
    camera.aspect = aspect; camera.fov = view.fovT; camera.updateProjectionMatrix(); grade.uniforms.uAspect.value = aspect;
  }
  const _dir = new THREE.Vector3(), _tgt = new THREE.Vector3();
  const camRay = new THREE.Raycaster(); camRay.camera = camera; let camT = 0, camHit = Infinity; // 带上 camera，射线碰到 Sprite 不报错
  const camBlock = [fireplace.root, ent.root, ...fh.blockers, ...extras.solid, ...garden.root.children.filter((o) => o.name !== "ground" && !o.userData.noHit && !o.isPoints && !o.isSprite)];
  propHit = camBlock.filter((o) => o && o.matrixWorld); topCache.clear(); ringCache.clear();
  function stepCamera(dt) {
    // 松手后的惯性
    if (!view.held) { view.yawT += view.vYaw * 0.6; view.pitchT = THREE.MathUtils.clamp(view.pitchT + view.vPitch * 0.6, view.minPitch, view.maxPitch); view.vYaw *= Math.exp(-dt * 5); view.vPitch *= Math.exp(-dt * 5); }
    view.yaw = damp(view.yaw, view.yawT, 12, dt); view.pitch = damp(view.pitch, view.pitchT, 12, dt);
    view.dist = damp(view.dist, view.distT, 2.6, dt); // 推拉慢一点
    // 焦点跟着雪宝（看她胸口的高度）
    if (view.peek) _tgt.copy(view.peek); else _tgt.set(xb.position.x, 0.5 + xb.position.y * 0.5 - char.sit * 0.12, xb.position.z);
    const fk = view.peek ? 3 : 4; view.focus.x = damp(view.focus.x, _tgt.x, fk, dt); view.focus.y = damp(view.focus.y, _tgt.y, fk, dt); view.focus.z = damp(view.focus.z, _tgt.z, fk, dt);
    _dir.set(Math.sin(view.yaw) * Math.cos(view.pitch), Math.sin(view.pitch), Math.cos(view.yaw) * Math.cos(view.pitch));
    BOUND = view.focus.z < garden.Z0 - 0.2 ? BOUND_OUT : BOUND_IN; view.maxDist = BOUND === BOUND_OUT ? 6.2 : (view.inMax || 3.6); if (view.distT > view.maxDist) view.distT = view.maxDist; // 花园里可以拉得更远，看全景 // 雪宝出了门，镜头就在花园里转
    // 撞墙：沿视线往回收，收得快、放得慢
    let tmax = view.dist; const f = view.focus;
    [["x", BOUND.x0, BOUND.x1], ["y", BOUND.y0, BOUND.y1], ["z", BOUND.z0, BOUND.z1]].forEach(([ax, lo, hi]) => { const d = _dir[ax]; if (Math.abs(d) < 1e-4) return; const tt = ((d > 0 ? hi : lo) - f[ax]) / d; if (tt > 0) tmax = Math.min(tmax, tt); });
    // 花园里的东西（喷泉、树、入口小屋……）挡在中间：镜头收到它前面
    camT -= dt; if (camT <= 0) { camT = 0.12; camRay.set(f, _dir); camRay.far = view.dist; const h = camRay.intersectObjects(camBlock, true).find((x) => !x.object.userData.noHit && !x.object.isPoints && !x.object.isSprite); camHit = h ? Math.max(0.35, h.distance - 0.18) : Infinity; }
    tmax = Math.min(tmax, camHit);
    view.eff = tmax < view.eff ? damp(view.eff, tmax, 18, dt) : damp(view.eff, tmax, 3, dt);
    camera.position.copy(f).addScaledVector(_dir, Math.max(0.35, view.eff));
    camera.lookAt(f.x, f.y + 0.12 * Math.min(1, view.eff / 2.5), f.z);
  }

  let first = true;
  let snowReady = false;
  // ---------- 点地光圈：点哪儿，地上亮一个粉金色光圈，雪宝走到了就淡掉；落地、到达时漾开一圈 ----------
  const ringTex = (() => { const c = document.createElement("canvas"); c.width = c.height = 256; const g = c.getContext("2d"); const gr = g.createRadialGradient(128, 128, 40, 128, 128, 126); gr.addColorStop(0, "rgba(255,255,255,.12)"); gr.addColorStop(0.55, "rgba(255,255,255,.3)"); gr.addColorStop(0.7, "rgba(255,255,255,1)"); gr.addColorStop(0.9, "rgba(255,255,255,1)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    g.fillStyle = "rgba(255,250,240,.95)"; for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; g.save(); g.translate(128 + Math.cos(a) * 70, 128 + Math.sin(a) * 70); g.rotate(a); g.beginPath(); for (let k = 0; k < 8; k++) { const r = k % 2 ? 4 : 11, b = k * Math.PI / 4; g.lineTo(Math.cos(b) * r, Math.sin(b) * r); } g.fill(); g.restore(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const ringMat = () => new THREE.MeshBasicMaterial({ map: ringTex, color: "#ff6f9a", transparent: true, depthWrite: false, opacity: 0, polygonOffset: true, polygonOffsetFactor: -4 });
  const ringGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const target = new THREE.Mesh(ringGeo, ringMat()); target.renderOrder = 4; target.userData.noHit = true; scene.add(target);
  const dotM = new THREE.Mesh(new THREE.CircleGeometry(0.09, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: "#ff9fbd", transparent: true, opacity: 0, depthWrite: false })); dotM.renderOrder = 4; scene.add(dotM);
  const puffs = Array.from({ length: 4 }, () => { const m = new THREE.Mesh(ringGeo, ringMat()); m.renderOrder = 4; m.userData = { t: 9, s: 1, noHit: true }; scene.add(m); return m; });
  let puffK = 0, tgt = null;
  const groundY = (x, z) => (z < garden.Z0 ? garden.heightAt(x, z) : 0) + 0.012;
  function ringPuff(x, z, s = 0.7, y) { const m = puffs[puffK++ % puffs.length]; m.position.set(x, (y ?? groundY(x, z)) + 0.002, z); m.userData.t = 0; m.userData.s = s; }
  function mark(x, z) { const c = walkClamp(x, z); tgt = { x: c.x, z: c.z, t: 0, done: false }; ringPuff(c.x, c.z, 0.5); }
  function stepRing(dt, t) {
    if (tgt) {
      tgt.t += dt;
      const d = Math.hypot(xb.position.x - tgt.x, xb.position.z - tgt.z);
      if (!tgt.done && (d < 0.18 || (tgt.t > 0.6 && !char.walking && !char.path.length) || char.drive || char.dragging)) { tgt.done = true; tgt.fade = 1; if (d < 0.3) ringPuff(tgt.x, tgt.z, 0.6); }
      const a = tgt.done ? (tgt.fade = Math.max(0, tgt.fade - dt * 4)) : Math.min(1, tgt.t * 6);
      const pulse = 0.56 + Math.sin(t * 5) * 0.04;
      target.position.set(tgt.x, groundY(tgt.x, tgt.z), tgt.z); target.scale.setScalar(pulse * (tgt.done ? 1 + (1 - a) * 0.4 : 1)); target.rotation.y = t * 0.6;
      target.material.opacity = a * 0.95; dotM.position.copy(target.position); dotM.position.y += 0.001; dotM.material.opacity = a * (0.45 + Math.sin(t * 5) * 0.15);
      if (tgt.done && a <= 0) tgt = null;
    } else { target.material.opacity = 0; dotM.material.opacity = 0; }
    target.visible = dotM.visible = !!tgt;
    puffs.forEach((m) => { const u = m.userData; u.t += dt; const k = Math.min(1, u.t / 0.55); m.visible = k < 1; if (!m.visible) return; m.scale.setScalar(u.s * (0.25 + k * 0.9)); m.material.opacity = (1 - k) * 0.85; });
  }
  function update(dt, t, env) {
    const L = look(env); setSky(L.sky);
    const e = first ? 1 : 1 - Math.exp(-dt * 2.2); first = false;
    for (const k of ["sunI", "env", "bgI", "exp", "shaft", "elev", "hemi", "fill", "fb", "xbE", "rain", "petals"]) cur[k] = lerp(cur[k] ?? L[k], L[k], e);
    bounce.intensity = cur.hemi; windowFill.intensity = cur.fill; floorBounce.intensity = cur.fb;
    for (const k of ["chI", "candI"]) cur[k] = lerp(cur[k] ?? L[k], L[k], Math.min(1, e * 2));
    cur.sunC = (cur.sunC || L.sunC.clone()).lerp(L.sunC, e);
    cur.black = lerp(cur.black ?? L.black, L.black, e); cur.con = lerp(cur.con ?? L.con, L.con, e); cur.sat = lerp(cur.sat ?? L.sat, L.sat, e);
    cur.wb = (cur.wb || new THREE.Vector3(...L.wb)).lerp(_wb.set(...L.wb), e);
    grade.uniforms.uBlack.value = cur.black; grade.uniforms.uCon.value = cur.con; grade.uniforms.uSat.value = cur.sat; grade.uniforms.uWB.value.copy(cur.wb);
    sun.intensity = cur.sunI; sun.color.copy(cur.sunC); scene.environmentIntensity = cur.env; scene.backgroundIntensity = cur.bgI; renderer.toneMappingExposure = cur.exp;
    const flick = 1 + Math.sin(t * 7.3) * 0.015 + Math.sin(t * 3.1) * 0.02;
    chand.intensity = cur.chI * flick; chGlow.material.opacity = Math.min(1, cur.chI / 4) * 0.06;
    chMats.forEach((m) => { m.emissiveIntensity = cur.chI * 0.16 * flick; });
    candle.intensity = cur.candI * 1.6 * flick;
    flameMats.forEach((m) => { m.emissiveIntensity = 0.3 + cur.candI * 1.2 * flick; });
    Object.values(sprites).forEach((s) => { if (s.isMesh) s.material.emissiveIntensity = cur.xbE * 0.8; });
    shafts.forEach(({ mat, dm, geo }) => {
      mat.uniforms.uI.value = cur.shaft; mat.uniforms.uTime.value = t; dm.opacity = Math.min(0.5, cur.shaft * 2.5);
      const p = geo.attributes.position; for (let i = 0; i < DN; i++) { p.array[i * 3 + 1] += Math.sin(t * 0.3 + i) * 0.00025; p.array[i * 3 + 2] += Math.cos(t * 0.2 + i * 1.3) * 0.0002; } p.needsUpdate = true;
    });
    // 太阳阴影跟着雪宝（在花园里时），网格对齐避免阴影抖
    if (view.focus.z < garden.Z0) sun.target.position.set(Math.round(view.focus.x * 2) / 2, 0, Math.round(view.focus.z * 2) / 2); else sun.target.position.set(0, 0, -2.4);
    setSunDir(cur.elev, env.hour);
    const genv = { night: env.weather === "night", dusk: L.sky === "dusk", rain: env.weather === "rainy", snow: env.weather === "snowy" };
    fireplace.update(dt, t, genv.night, camera); wishTree.update(dt, t);
    garden.update(dt, t, genv); ent.update(dt, t, genv); fh.update(dt, t, genv, xb.position); extras.update(dt, t, genv, xb.position);
    rain.position.set(view.focus.z < garden.Z0 ? view.focus.x : 0, 0, view.focus.z < garden.Z0 ? view.focus.z + D + 1.9 : 0);
    stepMarkers(dt, t); stepFocus(dt, t);
    if (genv.snow && !snowReady) { snowReady = true; wx.snowifyTree(scene, (o) => o === xb || o === ze.root || o === snowStand || o === fireplace.root); } // 后加载的东西补一次
    wx.update(dt, t, { rain: genv.rain, snow: genv.snow, focus: view.focus, camera, height: renderer.domElement.clientHeight || 600, hand: playerZe ? null : GLB.hands?.[1], xb, xbOut: xb.position.z < garden.Z0 - 0.3, ripple: garden.rainRipple });
    stepRing(dt, t);
    rainMat.opacity = cur.rain; rain.visible = cur.rain > 0.01;
    if (rain.visible) { const a = rainGeo.attributes.position.array; for (let i = 0; i < RN; i++) { const o = i * 6; let y = a[o + 1] - dt * 7.5; if (y < -0.3) y += 4.1; a[o + 1] = y; a[o + 4] = y - 0.16; } rainGeo.attributes.position.needsUpdate = true; }
    petalMat.opacity = cur.petals; petals.visible = cur.petals > 0.01;
    if (petals.visible) { for (let i = 0; i < PN; i++) { const [a, b, c] = pSeed[i]; const f = (t * (0.03 + a * 0.03) + b) % 1; pp[i * 3] = (c - 0.5) * 3.2 + Math.sin(t * 0.7 + a * 9) * 0.3; pp[i * 3 + 1] = 2.6 - f * 2.7 + Math.sin(t * 1.1 + b * 5) * 0.05; pp[i * 3 + 2] = -D - 2.2 + f * (2.4 + a * 1.4); } petalGeo.attributes.position.needsUpdate = true; }
    // 小道具：点一下弹一下
    Object.values(sprites).forEach((s) => { const u = s.userData; u.liftV += ((0 - u.lift) * 220 - u.liftV * 14) * dt; u.lift += u.liftV * dt * 0.06; s.position.y = u.base.y + u.lift; if (u.spin) u.spin.rotation.y += dt * 0.25; if (s.isMesh) s.rotation.y = Math.atan2(camera.position.x - s.position.x, camera.position.z - s.position.z); s.userData.shadow.visible = s.visible; });
    stepChar(dt, t);
    stepCamera(dt);
    if (window.XBCam) { const c = window.XBCam; camera.position.set(c[0], c[1], c[2]); camera.lookAt(c[3], c[4], c[5]); } // 调试截图用：固定镜头
    composer.render();
  }

  // 屏幕坐标 → 地板
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  function floorAt(nx, ny) { ndc.set(nx * 2 - 1, -(ny * 2 - 1)); ray.setFromCamera(ndc, camera); const hit = new THREE.Vector3(); return ray.ray.intersectPlane(floor, hit) ? hit : null; }
  function hitChar(nx, ny) { ndc.set(nx * 2 - 1, -(ny * 2 - 1)); ray.setFromCamera(ndc, camera); return xb.visible && ray.intersectObject(xb, true).length > 0; }
  // ---------- 能点的东西：头顶一个会上下浮的小牌子（手机上更大），点牌子或点物件都算 ----------
  // 屋里能做的事：壁炉烤火、两张沙发坐下（坐垫高 0.43，比长椅低一点）
  const FPX = -W / 2 + 0.95;
  const houseSpots = [
    { id: "fireplace", name: "壁炉", icon: "🔥", verb: "烤火", at: [-W / 2 + 0.3, 1.45, FP.z], spot: { x: FPX, z: FP.z }, face: -Math.PI / 2, pick: [fireplace.root], clip: "wait", dur: 4.2, fx: "warm",
      lines: ["好暖和～", "手都暖起来了。", "火苗在跳舞。", "冬天就该这样待着。"] },
    ...[-1, 1].map((k) => ({ id: k < 0 ? "sofaL" : "sofaR", name: "沙发", icon: "🛋", verb: "坐下", noMarker: true, at: [k * 1.42, 0.9, -2.15], spot: { x: k * 0.92, z: -2.15 }, exit: { x: k * 0.92, z: -2.15 },
      face: k < 0 ? Math.PI / 2 : -Math.PI / 2, pick: [], clip: "sit", dur: Infinity, lines: ["沙发好软～", "坐一会儿。", "陷进去啦。"],
      hold: () => ({ x: k * 1.4, y: 0.135, z: -2.15, yaw: k < 0 ? Math.PI / 2 : -Math.PI / 2 }) }))
  ];
  const ALL = [zeSpot, ...houseSpots, ...wishTree.spots, ...extras.spots, ...fh.spots, ...garden.spots, ...ent.spots], SPOTS = {}; ALL.forEach((s) => { SPOTS[s.id] = s; });
  // 情景键上显示的动词（走到旁边时右下角那颗按钮变成这个）
  const VERB = { fountain: "许愿", pond: "钓鱼", swing: "荡秋千", mushroom: "蹦蘑菇", bench: "坐下", arch: "闻闻玫瑰", letter: "读情书", albums: "看照片", videos: "看回忆",
    comic: "看漫画", stories: "听故事", "milk-tea": "买奶茶", messages: "说悄悄话", "star-post": "寄星星信", gramophone: "放音乐", figures: "进手办屋", "ze-npc": "找泽泽", "wish-tree": "读愿望", "pet-cat": "摸摸猫", "pet-bunny": "摸摸兔", "pet-husky": "摸摸狗" };
  ALL.forEach((s0) => { s0.verb ||= VERB[s0.id] || s0.cta || s0.name; });
  if (SPOTS.pond) Object.assign(SPOTS.pond, { clip: "wait", dur: 4.6, fish: true, lines: ["钓到一条小锦鲤！看一眼就放回去～", "咬钩啦！是一片睡莲叶……", "钓到了！小鱼说它想回家，放它走啦。", "嘘——鱼要来了。"] });
  // 离雪宝最近、够得着的那件（互动点在 1.5 米内；进页面的入口按物件位置算）
  const _sp = new THREE.Vector3();
  function nearestSpot() {
    const p = xb.position, inside = p.z > -D - 0.1; let best = null, bd = 1e9;
    for (const s0 of ALL) {
      if (s0.available?.() === false || !s0.verb || s0.id.startsWith("wish-") && s0.id !== "wish-tree") continue;
      const tx = s0.spot ? s0.spot.x : s0.at[0], tz = s0.spot ? s0.spot.z : s0.at[2];
      if ((tz > -D - 0.1) !== inside) continue;
      const lim = s0.near || (s0.spot ? 1.3 : 1.7), d = Math.hypot(tx - p.x, tz - p.z);
      if (d < lim && d < bd) { bd = d; best = s0; }
    }
    return best;
  }
  // ---------- 登记能跳上去的东西（尺寸按模型实测） ----------
  {
    const _p = new THREE.Vector3();
    // 局部坐标 (lx,lz) 的一块：跟着物件的位置和朝向换到世界坐标
    const local = (obj, lx, lz, def) => {
      obj.updateMatrixWorld(true); _p.set(lx, 0, lz); obj.localToWorld(_p);
      const base = obj.getWorldPosition(new THREE.Vector3()).y;
      const yaw = new THREE.Euler().setFromQuaternion(obj.getWorldQuaternion(new THREE.Quaternion()), "YXZ").y;
      PLATS.push({ ...def, x: _p.x, z: _p.z, yaw: -yaw, top: base + def.top, bottom: base + (def.bottom || 0) });
    };
    const pick0 = (id) => SPOTS[id]?.pick?.[0];
    // 屋里：两张沙发（坐垫 0.43，靠背一侧 0.8）、茶几 0.3、梳妆台 0.95
    [-1, 1].forEach((k) => {
      PLATS.push({ x: k * 1.42, z: -2.15, hx: 0.25, hz: 0.79, top: 0.43 });
      PLATS.push({ x: k * 1.74, z: -2.15, hx: 0.09, hz: 0.79, top: 0.8 });
    });
    PLATS.push({ x: 0, z: -2.15, r: 0.4, top: 0.3 });
    PLATS.push({ x: -2.39, z: -2.2, hx: 0.29, hz: 0.77, top: 0.95 });
    // 花园：长椅、秋千座板（悬空）、奶茶推车台面、小茶座的桌椅和伞杆、蘑菇、树桩故事书
    if (pick0("bench")) local(pick0("bench"), 0, -0.04, { hx: 0.55, hz: 0.2, top: 0.47 });
    PLATS.push({ x: -2.7, z: -15.6, hx: 0.31, hz: 0.11, top: 0.5, bottom: 0.4 });
    const cart = pick0("milk-tea");
    if (cart) {
      local(cart, 0, 0.01, { hx: 0.53, hz: 0.31, top: 0.77 });
      local(cart, 1.05, 0.55, { r: 0.28, top: 0.645 });
      local(cart, 1.05, 0.55, { r: 0.05, top: 2.2, bottom: 0.66 }); // 阳伞杆：站在桌上也会挡一下
      [0.9, 0.9 + Math.PI].forEach((a) => local(cart, 1.05 + Math.cos(a) * 0.45, 0.55 + Math.sin(a) * 0.45, { r: 0.15, top: 0.475 }));
    }
    // 头顶：推车和阳伞上离地 1.2 米以上、够大的部件（伞面、车篷）各算一块“天花板”
    const ceilFrom = (obj, above = 1.2) => {
      if (!obj) return; obj.updateMatrixWorld(true); const base = obj.getWorldPosition(new THREE.Vector3()).y, b = new THREE.Box3();
      obj.traverse((m) => { if (!m.isMesh) return; b.setFromObject(m); const w = b.max.x - b.min.x, d = b.max.z - b.min.z;
        if (b.min.y > base + above && w > 0.3 && d > 0.3) CEILS.push({ x0: b.min.x, x1: b.max.x, z0: b.min.z, z1: b.max.z, bottom: b.min.y }); });
    };
    ceilFrom(cart);
    (SPOTS.swing?.pick || []).forEach((g) => ceilFrom(g, 1.3));
    (SPOTS.mushroom?.pick || []).forEach((g, i) => { const b = new THREE.Box3().setFromObject(g), c = b.getCenter(new THREE.Vector3()); PLATS.push({ x: c.x, z: c.z, r: (b.max.x - b.min.x) / 2 * 0.92, top: b.max.y - 0.03 }); });
    PLATS.push({ x: -3, z: -8.4, r: 0.5, top: 0.44 });
  }
  const markers = [];
  function badge(icon, name, enter) {
    const c = document.createElement("canvas"); c.width = 256; c.height = enter ? 240 : 200; const g = c.getContext("2d");
    g.font = "600 34px 'PingFang SC', 'Noto Sans SC', sans-serif"; const tw = g.measureText(name).width;
    const bw = Math.min(250, tw + 40), bx = 128 - bw / 2;
    g.fillStyle = "rgba(255,255,255,.92)"; g.beginPath(); g.arc(128, 62, 52, 0, 7); g.fill();
    g.strokeStyle = "#f3b7c4"; g.lineWidth = 5; g.stroke();
    g.font = "56px 'Apple Color Emoji','Segoe UI Emoji',sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(icon, 128, 66);
    g.fillStyle = "rgba(255,247,240,.95)"; g.beginPath(); g.roundRect(bx, 126, bw, 54, 27); g.fill(); g.strokeStyle = "#f3b7c4"; g.lineWidth = 3; g.stroke();
    g.fillStyle = "#8a4b5a"; g.font = "600 32px 'PingFang SC', 'Noto Sans SC', sans-serif"; g.fillText(name, 128, 154);
    if (enter) { g.fillStyle = "#e8789a"; g.beginPath(); g.roundRect(78, 192, 100, 38, 19); g.fill(); g.fillStyle = "#fff"; g.font = "600 22px 'PingFang SC', 'Noto Sans SC', sans-serif"; g.fillText(typeof enter === "string" ? enter : "点我进入", 128, 212); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = maxAniso; return t;
  }
  ALL.forEach((s) => {
    if (s.noMarker) return;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: badge(s.icon, s.name, s.href ? "点我进入" : s.cta || false), transparent: true, depthWrite: false }));
    sp.center.set(0.5, 0); sp.position.set(...s.at); sp.renderOrder = 8; sp.userData = { id: s.id, base: sp.position.y, k: 0, tall: s.href || s.cta ? 240 / 200 : 1, far: s.href || s.cta ? 15 : 11 }; scene.add(sp); markers.push(sp);
    if (!s.spot) return;
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.26, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: "#ffd6e0", transparent: true, opacity: 0, depthWrite: false }));
    ring.position.set(s.spot.x, garden.heightAt(s.spot.x, s.spot.z) + 0.02, s.spot.z); ring.renderOrder = 3; scene.add(ring); sp.userData.ring = ring;
  });
  // 只亮雪宝身边、和她在同一边（屋里／花园）的牌子，最多 5 个，免得一进来满屏都是
  const _near = [];
  function stepMarkers(dt, t) {
    const big = mobile ? 1.35 : 1, xp = xb.position, inside = xp.z > -D - 0.1;
    _near.length = 0;
    markers.forEach((m) => { const u = m.userData; if (SPOTS[u.id].available?.() === false) return; const dx = m.position.x - xp.x, dz = m.position.z - xp.z, dd = Math.hypot(dx, dz); u.dd = dd; if ((m.position.z > -D) === inside && dd < (u.far > 11 ? 8 : 6)) _near.push(m); });
    _near.sort((a, b) => a.userData.dd - b.userData.dd); const show = new Set(_near.slice(0, 5));
    markers.forEach((m, i) => {
      const u = m.userData, d = camera.position.distanceTo(m.position), busy = char.act?.s.id === u.id || char.pending?.id === u.id;
      // 情景键指着某一件时，别的牌子淡一点，主次分明
      const want = !busy && !view.peek && show.has(m) && char.opacity > 0.5 ? (focusS && focusS.id !== u.id ? 0.45 : 1) : 0; u.k = damp(u.k, want, 5, dt);
      m.visible = u.k > 0.02; m.material.opacity = u.k;
      const s = THREE.MathUtils.clamp(d * 0.09, 0.24, 0.85) * big * (0.9 + 0.1 * u.k); m.scale.set(s * 1.28, s * u.tall, 1); // 屏幕上大小差不多一致
      m.position.y = u.base + Math.sin(t * 2.2 + i) * 0.05;
      const r = u.ring; if (!r) return; r.visible = char.pending?.id === u.id; if (r.visible) { const f = (t * 1.4) % 1; r.scale.setScalar(0.7 + f * 0.9); r.material.opacity = (1 - f) * 0.9; }
    });
  }
  // ---------- 情景键指着谁：目标头上一个上下跳的小箭头（和右下角情景键同一个图标），走近了一眼就知道按下去会跟谁互动 ----------
  const focusTex = {};
  function arrowTex(icon) {
    if (focusTex[icon]) return focusTex[icon];
    const c = document.createElement("canvas"); c.width = 128; c.height = 160; const g = c.getContext("2d");
    g.fillStyle = "#f38aa5"; g.beginPath(); g.moveTo(44, 108); g.lineTo(84, 108); g.lineTo(64, 152); g.closePath(); g.fill();
    g.fillStyle = "#fff"; g.beginPath(); g.arc(64, 62, 54, 0, 7); g.fill(); g.lineWidth = 8; g.strokeStyle = "#f38aa5"; g.stroke();
    g.font = "60px 'Apple Color Emoji','Segoe UI Emoji',sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(icon, 64, 66);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return (focusTex[icon] = t);
  }
  const focusSp = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false, depthWrite: false })); focusSp.center.set(0.5, 0); focusSp.renderOrder = 20; focusSp.visible = false; scene.add(focusSp);
  let focusS = null, focusK = 0; const _fb = new THREE.Box3(), _fc = new THREE.Vector3();
  function setFocus(s) { if (s === focusS) return; focusS = s; if (s) { focusSp.material.map = arrowTex(s.icon || "✨"); focusSp.material.needsUpdate = true; focusK = 0; } }
  function stepFocus(dt, t) {
    const s = focusS, busy = s && (char.act?.s.id === s.id || char.pending?.id === s.id);
    if (!s || busy || view.peek) { focusSp.visible = false; return; }
    const m = markers.find((q) => q.userData.id === s.id && q.visible);
    if (m) _fc.set(m.position.x, m.position.y + m.scale.y + 0.03, m.position.z);
    else if (s.pet) { _fb.setFromObject(s.pet.g); _fb.getCenter(_fc); _fc.y = _fb.max.y + 0.1; } // 小动物会跑，按模型实际位置；泽泽是蒙皮模型，算包围盒太贵，用互动点
    else _fc.set(s.at[0], s.at[1] + 0.45, s.at[2]);
    focusK = Math.min(1, focusK + dt * 4);
    const d = camera.position.distanceTo(_fc), k = THREE.MathUtils.clamp(d * 0.055, 0.16, 0.5) * (mobile ? 1.25 : 1) * (0.6 + 0.4 * Math.min(1, focusK * 1.6));
    focusSp.scale.set(k * 0.8, k, 1); focusSp.position.copy(_fc); focusSp.position.y += Math.abs(Math.sin(t * 4)) * 0.07;
    focusSp.material.opacity = focusK; focusSp.visible = true;
  }
  // 屏幕点 → 能点的东西（先看牌子，再看物件本身）
  function pick(nx, ny) {
    ndc.set(nx * 2 - 1, -(ny * 2 - 1)); ray.setFromCamera(ndc, camera);
    const mh = ray.intersectObjects(markers.filter((m) => m.visible), false)[0]; if (mh) return mh.object.userData.id;
    const objs = ALL.filter((s) => s.available?.() !== false).flatMap((s) => s.pick.map((o) => ({ o, id: s.id })));
    const hits = []; objs.forEach(({ o, id }) => { const h = ray.intersectObject(o, true)[0]; if (h) hits.push({ d: h.distance, id }); });
    if (!hits.length) return null;
    hits.sort((a, b) => a.d - b.d);
    // 几件东西前后挨得很近（比如秋千和后面的树洞）：选标记点离手指最近的那件，而不是光看谁的模型先被射线碰到
    let best = hits[0];
    const close = hits.filter((h, i, arr) => h.d < hits[0].d + 0.6 && arr.findIndex((q) => q.id === h.id) === i);
    if (close.length > 1) {
      let bs = 1e9;
      close.forEach((h) => { const a = SPOTS[h.id].at; _sp.set(a[0], a[1] * 0.6, a[2]).project(camera); const ds = Math.hypot((_sp.x + 1) / 2 - nx, (1 - _sp.y) / 2 - ny); if (ds < bs) { bs = ds; best = h; } });
    }
    // 中间要是隔着墙／别的东西就不算
    const first = groundHit(true); return first && first.distance + 0.05 < best.d ? null : best.id;
  }
  function interact(id) { const s = SPOTS[id]; if (!s || s.available?.() === false) return null; if (!s.href && !s.action) char.pending = s; return s; }
  // 进入分页面前：镜头凑近那件东西
  function peek(s) { view.peek = new THREE.Vector3(...s.at).add(new THREE.Vector3(0, -0.35, 0)); view.distT = 1.5; view.held = false; }
  // 屏幕点 → 地面（打到墙、家具上就不算）
  function groundHit(any = false) {
    const hs = ray.intersectObjects(scene.children, true);
    for (const h of hs) {
      const o = h.object; if (!o.visible || o.isSprite || o.isPoints || o.isLine || o.userData.noHit || o.userData.xb || o.material?.depthWrite === false) continue;
      let p = o, skip = false; while (p) { if (p === xb || p.userData?.noHit) { skip = true; break; } p = p.parent; } if (skip) continue;
      if (any) return h;
      const n = h.face ? h.face.normal.clone().transformDirection(o.matrixWorld) : null;
      return n && n.y > 0.6 ? h : null;
    }
    return null;
  }
  function groundAt(nx, ny) { ndc.set(nx * 2 - 1, -(ny * 2 - 1)); ray.setFromCamera(ndc, camera); const h = groundHit(); return h ? h.point : null; }
  function setCanvasCard(id, url) { const m = canvases[id]; if (!m || m.userData.url === url) return; m.userData.url = url; m.map = cardTex(url); m.needsUpdate = true; }

  function setPlayer(role, phase) {
    const isZe = role === "泽";
    if (isZe !== playerZe) {
      playerZe = isZe;
      const parent = isZe ? xb : scene;
      parent.add(ze.root);
      ze.root.scale.setScalar(isZe ? 1 : .92);
      ze.root.position.set(isZe ? 0 : zeHome.x, 0, isZe ? 0 : zeHome.z);
      ze.root.rotation.y = isZe ? 0 : Math.PI / 2;
      if (GLB.model) (isZe ? snowStand : xb).add(GLB.model);
      char.pending = null; char.stopFollow(); char.endAct();
      if (isZe) char.goTo(zeApproach, true);
    }
    if (phase !== playerPhase || !snowStand.visible) {
      const atDoor = phase === "back" || phase === "waiting";
      snowStand.position.set(atDoor ? 0 : .73, 0, atDoor ? -D+.85 : -1.39);
      snowStand.rotation.y = 0;
      playerPhase = phase;
    }
    snowStand.visible = isZe && ["home", "back", "waiting"].includes(phase);
    const player = isZe ? "ze" : "snow";
    if (host.dataset.player !== player) host.dataset.player = player;
  }
  function zeAction(action) {
    if (playerZe) return;
    if (["hug", "kiss", "lift", "five", "hand"].includes(action)) { duoAct(action); return; }
    zeCue = action; zeCueUntil = clock + 2; zeCueT0 = clock;
    if (action === "talk") return;
    char.endAct();
    const p = xb.position;
    char.act = { s: { id: "ze-reply", clip: action === "wave" ? "wave" : "wow", dur: 1.8,
      face: Math.atan2(ze.root.position.x - p.x, ze.root.position.z - p.z) }, t: 0, from: p.clone() };
  }
  // 雪宝在不在泽泽身边（屋里、1.6 米内）
  function duoReady() {
    if (playerZe) return snowStand.visible && Math.hypot(xb.position.x - snowStand.position.x, xb.position.z - snowStand.position.z) < 1.8;
    const zp = ze.root.position; return ze.root.visible && xb.visible && Math.hypot(xb.position.x - zp.x, xb.position.z - zp.z) < 1.6 && char.opacity > 0.5;
  }
  // 两个人一起的动作：雪宝挪到泽泽面前合适的距离，两个人面对面；举高高时雪宝被抱起来
  const DUO = {
    hug: { dist: 0.3, dur: 2.8, clip: "hug", fx: ["heart", 0.6] },
    kiss: { dist: 0.33, dur: 2.6, clip: "wow", fx: ["kiss", 1.0] },
    lift: { dist: 0.27, dur: 3.2, clip: "wow", fx: ["star", 1.2] },
    five: { dist: 0.5, dur: 1.7, clip: "wave", fx: ["spark", 0.55] },
    hand: { dist: 0.42, dur: 1.2, clip: "wave" }
  };
  let duoPending = null;
  function duoAct(id) {
    if (duo) return false;
    // 离得有点远：先跑到泽泽面前再做
    if (!duoReady()) {
      if (playerZe || !ze.root.visible || char.opacity < 0.5 || Math.hypot(xb.position.x - ze.root.position.x, xb.position.z - ze.root.position.z) > 9) return false;
      duoPending = id; char.endAct(); char.goTo({ ...zeSpot.spot, run: true }); return true;
    }
    if (id === "hand") { zeFollow = !zeFollow; if (!zeFollow) return true; }
    const D0 = DUO[id], zp = playerZe ? snowStand.position : ze.root.position, p = xb.position;
    let dx = p.x - zp.x, dz = p.z - zp.z; const L0 = Math.hypot(dx, dz) || 1; dx /= L0; dz /= L0;
    const yawToSnow = Math.atan2(dx, dz);
    duo = { id, t: 0, dur: D0.dur, fxDone: false, D: D0, zp: zp.clone(), dir: { x: dx, z: dz } };
    if (!playerZe) zeYaw = yawToSnow;
    char.endAct(); char.path = [];
    // 雪宝这边：hold() 每帧给出位置和朝向（举高高会离地）
    const meX = zp.x + dx * D0.dist, meZ = zp.z + dz * D0.dist;
    char.act = { s: { id: "_duo-" + id, clip: D0.clip, dur: D0.dur, face: yawToSnow + Math.PI,
      hold: () => { const k = duo ? duo.t / duo.dur : 1, up = id === "lift" ? Math.sin(Math.min(1, k * 1.15) * Math.PI) * 0.32 + Math.max(0, Math.sin(k * Math.PI * 6)) * 0.04 * Math.sin(Math.min(1, k * 1.15) * Math.PI) : id === "kiss" ? Math.sin(Math.min(1, k * 1.4) * Math.PI) * 0.06 : 0;
        if (playerZe) { snowStand.position.y = up; snowStand.rotation.y = yawToSnow; } // 泽泽当玩家时，被举起来的是站着的雪宝
        return { x: meX, y: playerZe ? 0 : up, z: meZ, yaw: yawToSnow + Math.PI + (id === "lift" ? Math.sin(k * Math.PI * 2) * 0.35 : 0), tilt: id === "lift" ? -0.15 * Math.sin(k * Math.PI) : 0 }; } }, t: 0, from: p.clone() };
    return true;
  }
  function stepDuo(dt) {
    if (!duo) return; duo.t += dt;
    const f = duo.D.fx;
    if (f && !duo.fxDone && duo.t > f[1]) { duo.fxDone = true; const mid = new THREE.Vector3((xb.position.x + duo.zp.x) / 2, 0.75, (xb.position.z + duo.zp.z) / 2);
      if (f[0] === "spark") twinkle(mid.x, 0.95, mid.z); emote(f[0], f[0] === "spark" ? 3 : 5, mid); onDuo?.(duo.id); }
    if (duo.t >= duo.dur) duo = null;
  }
  let onDuo = null;
  // NPC 泽泽：平时站在壁炉边；雪宝在附近就转过去看她；牵着手时跟在她身边走
  const _zt = new THREE.Vector3();
  let zeIdleT = 0, zeIdleNext = 5, zeWander = null, pzCue = null, zePath = null;
  const ZE_GESTURES = [["stretch", 2.6, null], ["think", 3.2, null], ["yawn", 2.4, "zzz"], ["look", 3.4, null], ["scratch", 2.2, null], ["watch", 2.4, null], ["talk", 2.6, "note"]];
  // 他会去的地方：壁炉前（烤火）、窗边（看外面）、沙发边（想事情）、茶几旁（东张西望）
  const ZE_PLACES = [
    { x: -W / 2 + 0.8, z: FP.z, yaw: -Math.PI / 2, cue: "warm", dur: 5, fx: "warm" },
    { x: 0.55, z: -D + 0.95, yaw: Math.PI, cue: "look", dur: 4.5, fx: null },
    { x: -0.95, z: -1.35, yaw: -2.2, cue: "think", dur: 3.6, fx: null },
    { x: 0.9, z: -1.2, yaw: 2.4, cue: "stretch", dur: 2.6, fx: null }
  ];
  function zeIdleCue(cue, dur, fx) {
    zeCue = cue; zeCueT0 = clock; zeCueUntil = clock + dur;
    if (fx && ze.root.visible) emote(fx, fx === "zzz" ? 3 : 4, ze.root.position.clone().setY(0.15));
  }
  function stepZeNpc(dt, t) {
    stepDuo(dt);
    if (duoPending && !char.walking && !char.path.length) { const id = duoPending; duoPending = null; if (duoReady()) duoAct(id); }
    if (duoPending && char.drive) duoPending = null; // 半路自己操作了就算了
    const zp = ze.root.position, p = xb.position, inside = p.z > -D - 0.1;
    ze.root.visible = !NOCHAR;
    // 没人管他：隔一会儿自己找点事做——原地伸懒腰/托腮/打哈欠/东张西望/挠头/看表，雪宝在附近就挥挥手；
    // 或者溜达到壁炉前烤火、窗边看外面、沙发边发呆，过一阵再回原位
    const zeBusy = zeWalk || duo || zeFollow || clock < zeCueUntil;
    if (zeBusy) zeIdleT = clock; // 按时钟算“闲了多久”，不受掉帧影响
    if (clock - zeIdleT > zeIdleNext) {
      zeIdleT = clock; zeIdleNext = 4 + Math.random() * 6;
      const dSnow = Math.hypot(p.x - zp.x, p.z - zp.z), r = Math.random();
      if (dSnow < 3.5 && inside && r < 0.22) zeIdleCue("wave", 2.2, "heart");
      else if (r < 0.55 && !zeWander) {
        const opts = ZE_PLACES.filter((q) => Math.hypot(q.x - zp.x, q.z - zp.z) > 0.6 && WM.walkable(q.x, q.z));
        zeWander = opts.length ? opts[Math.floor(Math.random() * opts.length)] : null;
      } else {
        const g = ZE_GESTURES[Math.floor(Math.random() * ZE_GESTURES.length)]; zeIdleCue(g[0], g[1], g[2]);
      }
    }
    let tx = zeWander ? zeWander.x : zeHome.x, tz = zeWander ? zeWander.z : zeHome.z;
    if (zeWander && Math.hypot(tx - zp.x, tz - zp.z) < 0.07 && !zeWander.arrived) { zeWander.arrived = clock; zeYaw = zeWander.yaw; zeIdleCue(zeWander.cue, zeWander.dur, zeWander.fx); }
    if (zeWander?.arrived && clock - zeWander.arrived > zeWander.dur + 2.5) zeWander = null; // 待够了回原位
    if (zeFollow || duo) zeWander = null;
    if (zeFollow) { if (char.opacity < 0.5) zeFollow = false; else { tx = p.x - Math.cos(char.yaw) * 0.42; tz = p.z + Math.sin(char.yaw) * 0.42; } } // 牵着手：走在雪宝左边
    if (duo) { tx = zp.x; tz = zp.z; }
    // 去远一点的地方（溜达、回原位）走 walkmap 找的路，绕开茶几沙发；牵手跟随时目标一直在动，直接走
    if (!zeFollow && !duo && Math.hypot(tx - zp.x, tz - zp.z) > 0.12) {
      if (!zePath || Math.hypot(zePath.tx - tx, zePath.tz - tz) > 0.1) zePath = { tx, tz, pts: WM.path(zp.x, zp.z, tx, tz) || [] };
      while (zePath.pts.length > 1 && Math.hypot(zePath.pts[0].x - zp.x, zePath.pts[0].z - zp.z) < 0.1) zePath.pts.shift();
      if (zePath.pts.length) { tx = zePath.pts[0].x; tz = zePath.pts[0].z; }
    } else zePath = null;
    const dx = tx - zp.x, dz = tz - zp.z, d = Math.hypot(dx, dz);
    zeWalk = d > 0.06 && !duo; zeSpeed = d > 1.2 ? 2.4 : 1.2;
    if (zeWalk) { const st = Math.min(d, dt * zeSpeed), n = WM.slide(zp.x, zp.z, dx / d * st, dz / d * st); zp.x = n.x; zp.z = n.z; zeYaw = Math.atan2(dx, dz); }
    else if (!duo && !zeWander?.arrived) { const dd = Math.hypot(p.x - zp.x, p.z - zp.z); zeYaw = zeFollow ? char.yaw : dd < 3.2 && inside && clock >= zeCueUntil ? Math.atan2(p.x - zp.x, p.z - zp.z) : clock < zeCueUntil ? zeYaw : 1.0; }
    ze.root.rotation.y = angDamp(ze.root.rotation.y, zeYaw, 6, dt);
    zeSpot.at[0] = zp.x; zeSpot.at[2] = zp.z; zeSpot.spot = { x: zp.x + Math.sin(ze.root.rotation.y) * 0.55, z: zp.z + Math.cos(ze.root.rotation.y) * 0.55 };
  }

  return { setFocus, THREE, renderer, scene, camera, update, resize, view, anchors, sprites, addSprite, char, floorAt, groundAt, pick, interact, peek, hitChar, setCanvasCard, mobile, SAL, ROOM, garden, extras, mark, wx, wishTree, fireplace, setPlayer, zeAction, nearestSpot, tossCoin, duoReady, duoAct, onDuo(f) { onDuo = f; }, get zeFollow() { return zeFollow; }, pickEma(nx, ny) { ndc.set(nx * 2 - 1, -(ny * 2 - 1)); ray.setFromCamera(ndc, camera); return ray.intersectObjects(wishTree.emaPick, false)[0]?.object.userData.wish || null; }, onSplash(f) { onSplash = f; }, onBonk(f) { onBonk = f; }, CEILS, PLATS, propTop, moveH, get focusDebug() { const v = focusSp.position.clone().project(camera); return { id: focusS?.id, vis: focusSp.visible, op: focusSp.material.opacity, sx: (v.x + 1) / 2, sy: (1 - v.y) / 2, scale: focusSp.scale.y }; }, get zeDebug() { return { cue: clock < zeCueUntil ? zeCue : "", wander: zeWander && { x: zeWander.x, cue: zeWander.cue, arrived: !!zeWander.arrived }, pz: pzCue?.id || "", clock: +clock.toFixed(1), idle: +(clock - zeIdleT).toFixed(1), walk: zeWalk, follow: zeFollow, duo: !!duo }; }, emote, SPOTS, surfaceAt };
}
