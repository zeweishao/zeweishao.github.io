/* 手办屋（团子之家）：花园右边一座白框玻璃小亭，玻璃穹顶。
 * 里面一圈 10 个大理石底座，每个底座一个玻璃罩，罩着她在手办页“你最喜欢的她们”里放进玻璃罩的那 10 个手办。
 * 手办模型和手办页共用（本地 figures-assets/，线上 R2）；等大厅准备好后才一个个慢慢加载，不拖首屏。
 * 点小亭进入手办页；点某个玻璃罩直接跳到那个手办。雪宝可以从西边的门走进去。
 */
export const FAVORITES = [
  [212206, "贝歌"], [213103, "初音未来"], [211104, "立华奏"], [212106, "白井黑子"], [213110, "藤林杏"],
  [211103, "穗香"], [213105, "御坂美琴"], [213017, "蔡文姬"], [213108, "玛莉萝丝"], [215103, "古河渚"]
];

import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";

export function buildFigureHouse(THREE, scene, { heightAt, GLTFLoader, maxAniso, center = { x: 5.3, z: -12.4 } }) {
  const C = center, RAD = 1.9, DOOR = Math.PI; // 门朝西（朝喷泉）
  const isLocal = ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
  const BASE = isLocal ? "figures-assets/" : "https://assets.isnow.life/figures/v20261003/";
  const y0 = heightAt(C.x, C.z);
  const root = new THREE.Group(); root.name = "figureHouse"; root.position.set(C.x, y0, C.z); scene.add(root);
  const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.5, ...o });
  const white = std({ color: "#f3ece3", roughness: 0.5 }), gold = std({ color: "#e0bb72", metalness: 1, roughness: 0.28 }), marble = std({ color: "#e9ddd0", roughness: 0.35 });
  const glass = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.13, depthWrite: false, side: THREE.DoubleSide });
  const add = (geo, mat, x, y, z, o = {}) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (o.ry != null) m.rotation.y = o.ry; if (o.rx) m.rotation.x = o.rx; if (o.rz) m.rotation.z = o.rz; m.castShadow = o.cast !== false && mat !== glass; m.receiveShadow = true; if (mat === glass || o.noHit) m.userData.noHit = true; (o.parent || root).add(m); return m; };
  const canvasTex = (w, h, draw) => { const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = maxAniso; return t; };
  const N = 8, angOf = (i) => DOOR + Math.PI / N + (i / N) * Math.PI * 2; // 门正好在两根柱子中间
  const P = (a, r) => [Math.cos(a) * r, Math.sin(a) * r];

  // 地台：八角大理石 + 粉色圆毯
  add(new THREE.CylinderGeometry(RAD + 0.12, RAD + 0.18, 0.08, N, 1, false, Math.PI / N).translate(0, 0.04, 0), marble, 0, 0, 0);
  add(new THREE.CircleGeometry(0.95, 40).rotateX(-Math.PI / 2), std({ color: "#e8a9b7", roughness: 0.95 }), 0, 0.085, 0, { cast: false });
  add(new THREE.RingGeometry(0.95, 1.0, 40).rotateX(-Math.PI / 2), gold, 0, 0.086, 0, { cast: false });
  // 柱子、矮墙、玻璃、檐口
  const posts = [];
  const mouldings = [];
  const mould = (x, y, z, w, h, d, yaw) => mouldings.push([x, y, z, w, h, d, yaw]);
  for (let i = 0; i < N; i++) {
    const a = angOf(i), [x, z] = P(a, RAD);
    posts.push(add(new THREE.CylinderGeometry(0.055, 0.065, 2.35, 12).translate(0, 1.255, 0), white, x, 0, z));
    add(new THREE.CylinderGeometry(0.09, 0.08, 0.08, 12), gold, x, 2.44, z, { cast: false });
    mould(x, 0.155, z, 0.17, 0.15, 0.17, -a);
    mould(x, 0.247, z, 0.135, 0.035, 0.135, -a);
    mould(x, 2.348, z, 0.13, 0.075, 0.13, -a);
    const a2 = angOf(i + 1), [x2, z2] = P(a2, RAD), mx = (x + x2) / 2, mz = (z + z2) / 2, L = Math.hypot(x2 - x, z2 - z), ry = -Math.atan2(z2 - z, x2 - x);
    add(new THREE.BoxGeometry(L, 0.1, 0.12), white, mx, 2.45, mz, { ry });
    mould(mx, 2.515, mz, L + 0.035, 0.034, 0.16, ry);
    mould(mx, 2.389, mz, L + 0.022, 0.022, 0.142, ry);
    const am = (a + a2) / 2, isDoor = Math.abs(Math.atan2(Math.sin(am - DOOR), Math.cos(am - DOOR))) < 0.3;
    if (isDoor) { // 门：拱形门楣 + 门牌
      const radius = 0.62, spring = 1.81;
      add(new THREE.TorusGeometry(radius, 0.047, 10, 28, Math.PI), white, mx, spring, mz, { ry, noHit: true });
      add(new THREE.TorusGeometry(radius + 0.046, 0.012, 8, 28, Math.PI), gold, mx - 0.027, spring, mz, { ry, cast: false, noHit: true });
      for (const side of [-1, 1]) {
        const x = mx + side * radius * Math.cos(ry);
        const z = mz - side * radius * Math.sin(ry);
        mould(x, (spring + 0.08) / 2, z, 0.092, spring - 0.08, 0.09, ry);
        mould(x, 0.135, z, 0.127, 0.11, 0.13, ry);
        mould(x, spring - 0.035, z, 0.12, 0.08, 0.125, ry);
      }
      const sign = canvasTex(256, 80, (g, w, h) => { g.fillStyle = "#fff8f0"; g.fillRect(0, 0, w, h); g.strokeStyle = "#e0bb72"; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6); g.fillStyle = "#8a4b5a"; g.font = "700 40px 'PingFang SC','Noto Sans SC',sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("手办屋", w / 2, h / 2 + 2); });
      const sp = add(new THREE.PlaneGeometry(0.62, 0.19), std({ map: sign, roughness: 0.7 }), mx * 1.03, 2.68, mz * 1.03, { ry: ry + Math.PI / 2, cast: false });
      sp.rotation.y = Math.atan2(mx, mz);
      continue;
    }
    add(new THREE.BoxGeometry(L - 0.08, 0.5, 0.06), white, mx, 0.33, mz, { ry });
    const [ox, oz] = P(am, 0.041);
    mould(mx + ox, 0.14, mz + oz, L - 0.1, 0.058, 0.034, ry);
    mould(mx + ox, 0.53, mz + oz, L - 0.1, 0.038, 0.034, ry);
    for (const u of [-0.27, 0.27]) {
      const px = mx + (x2 - x) * u, pz = mz + (z2 - z) * u;
      mould(px + ox, 0.335, pz + oz, L * 0.38, 0.284, 0.026, ry);
    }
    add(new THREE.BoxGeometry(L - 0.08, 0.025, 0.08), gold, mx, 0.585, mz, { ry, cast: false });
    add(new THREE.PlaneGeometry(L - 0.1, 1.8), glass, mx, 1.5, mz, { ry: ry, cast: false });
    add(new THREE.BoxGeometry(0.025, 1.8, 0.03), white, mx, 1.5, mz, { ry, cast: false, noHit: true });
    add(new THREE.BoxGeometry(L - 0.1, 0.025, 0.03), white, mx, 1.55, mz, { ry, cast: false, noHit: true });
  }
  const trim = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), white, mouldings.length);
  const transform = new THREE.Object3D();
  mouldings.forEach(([x, y, z, w, h, d, yaw], i) => {
    transform.position.set(x, y, z);
    transform.rotation.y = yaw;
    transform.scale.set(w, h, d);
    transform.updateMatrix();
    trim.setMatrixAt(i, transform.matrix);
  });
  trim.receiveShadow = true; trim.userData.noHit = true; root.add(trim);

  // 玻璃穹顶 + 白色肋 + 金色顶饰
  const dome = add(new THREE.SphereGeometry(RAD + 0.05, N, 10, Math.PI / N, Math.PI * 2, 0, Math.PI / 2), glass, 0, 2.5, 0, { cast: false }); dome.scale.y = 0.55;
  for (let i = 0; i < N; i++) {
    const a = angOf(i), pts = []; for (let k = 0; k <= 12; k++) { const t = (k / 12) * Math.PI / 2; pts.push(new THREE.Vector3(Math.cos(a) * Math.cos(t) * (RAD + 0.05), 2.5 + Math.sin(t) * (RAD + 0.05) * 0.55, Math.sin(a) * Math.cos(t) * (RAD + 0.05))); }
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.025, 6), white, 0, 0, 0, { noHit: true });
  }
  // 两道横肋沿八角玻璃的同一组顶点收向屋脊。
  for (const elevation of [Math.PI / 6, Math.PI / 3]) {
    const r = Math.cos(elevation) * (RAD + 0.05);
    const y = 2.5 + Math.sin(elevation) * (RAD + 0.05) * 0.55;
    const points = Array.from({ length: N }, (_, i) => {
      const [x, z] = P(angOf(i), r);
      return new THREE.Vector3(x, y, z);
    });
    const rib = new THREE.CurvePath();
    points.forEach((point, i) => rib.add(new THREE.LineCurve3(point, points[(i + 1) % N])));
    add(new THREE.TubeGeometry(rib, N * 4, 0.016, 6, true), white, 0, 0, 0, { cast: false, noHit: true });
  }
  add(new THREE.SphereGeometry(0.09, 16, 12), gold, 0, 3.58, 0);
  const st = new THREE.Shape(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.045 : 0.11, a = (i / 10) * Math.PI * 2 + Math.PI / 2; i ? st.lineTo(Math.cos(a) * r, Math.sin(a) * r) : st.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  const starM = std({ color: "#ffd86b", emissive: "#ffc23a", emissiveIntensity: 0.6, metalness: 0.4, roughness: 0.3 });
  const star = add(new THREE.ExtrudeGeometry(st, { depth: 0.03, bevelEnabled: false }).center(), starM, 0, 3.8, 0);
  const lamp = new THREE.PointLight("#ffd6ac", 0.35, 4.25, 2); lamp.position.set(0, 1.98, 0); root.add(lamp);

  // 一圈底座 + 玻璃罩 + 名牌；门那一侧空出来
  const slots = [], N2 = FAVORITES.length, gap = 1.1, span = Math.PI * 2 - gap;
  FAVORITES.forEach(([id, name], i) => {
    const a = DOOR + gap / 2 + (i + 0.5) * (span / N2), [x, z] = P(a, 1.38), face = Math.atan2(-x, -z);
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = face; root.add(g);
    add(new THREE.CylinderGeometry(0.17, 0.2, 0.62, 20).translate(0, 0.39, 0), marble, 0, 0, 0, { parent: g });
    add(new THREE.CylinderGeometry(0.205, 0.205, 0.025, 20), gold, 0, 0.7, 0, { parent: g, cast: false });
    add(new THREE.CylinderGeometry(0.195, 0.215, 0.055, 20), white, 0, 0.115, 0, { parent: g, cast: false });
    add(new THREE.CylinderGeometry(0.18, 0.168, 0.047, 20), white, 0, 0.66, 0, { parent: g, cast: false });
    add(new THREE.CylinderGeometry(0.16, 0.16, 0.48, 24, 1, true).translate(0, 0.95, 0), glass, 0, 0, 0, { parent: g });
    add(new THREE.SphereGeometry(0.16, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2), glass, 0, 1.19, 0, { parent: g });
    add(new THREE.TorusGeometry(0.16, 0.012, 6, 28).rotateX(Math.PI / 2), gold, 0, 0.72, 0, { parent: g, cast: false });
    const plate = canvasTex(192, 56, (c, w, h) => { c.fillStyle = "#fffaf2"; c.fillRect(0, 0, w, h); c.fillStyle = "#8a4b5a"; c.font = "600 26px 'PingFang SC','Noto Sans SC',sans-serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(name, w / 2, h / 2 + 1); });
    add(new THREE.PlaneGeometry(0.2, 0.058), std({ map: plate, roughness: 0.6 }), 0, 0.5, 0.176, { parent: g, cast: false, rx: -0.12 });
    slots.push({ id, name, g, loaded: false });
  });

  // 手办模型：卡通材质按手办页的做法修一下（皮肤别发灰），缩到 0.38 高站在底座上
  const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder); // 手办模型是 meshopt 压缩的
  function animeLook(o) {
    o.traverse((m) => {
      if (!m.isMesh) return; m.castShadow = true; m.receiveShadow = false; m.userData.noHit = true;
      (Array.isArray(m.material) ? m.material : [m.material]).forEach((mat) => {
        if (!mat?.isMeshStandardMaterial) return; mat.side = THREE.DoubleSide;
        const nm = (mat.name || "") + " " + (m.name || "");
        if (!/face|skin|hair|hiar|body|head|eye|brow|cloth/i.test(nm)) { mat.envMapIntensity = 0.7; return; }
        mat.metalness = 0; mat.metalnessMap = null; mat.roughness = 0.9; mat.roughnessMap = null;
        if (mat.map) { mat.map.anisotropy = maxAniso; mat.emissiveMap = mat.map; mat.emissive.setRGB(1, 1, 1); mat.emissiveIntensity = 0.32; mat.color.multiplyScalar(0.78); }
        mat.needsUpdate = true;
      });
    });
  }
  let queue = null;
  function loadAll() {
    if (queue) return; queue = slots.slice();
    const next = () => {
      const s = queue.shift(); if (!s) return;
      loader.load(`${BASE}models/${s.id}/original.glb`, (gl) => {
        const o = gl.scene; animeLook(o);
        const b = new THREE.Box3().setFromObject(o), h = b.max.y - b.min.y || 1, k = 0.38 / h;
        o.scale.setScalar(k); o.position.set(-(b.min.x + b.max.x) / 2 * k, 0.715 - b.min.y * k, -(b.min.z + b.max.z) / 2 * k);
        s.g.add(o); s.loaded = true; next();
      }, undefined, () => next());
    };
    next(); next(); // 两个两个并行
  }

  function walk(map) {
    map.circle(C.x, C.z, RAD + 0.4, 0);
    map.circle(C.x, C.z, 0.98, 1);
    const [dx, dz] = P(DOOR, 1);
    map.stroke([[C.x + dx * 0.6, C.z + dz * 0.6], [C.x + dx * (RAD + 0.7), C.z + dz * (RAD + 0.7)]], 0.36, 1);
  }
  const _w = new THREE.Vector3();
  function update(dt, t, env, xbPos) {
    star.rotation.y = t * 0.7;
    if (!queue && xbPos && Math.hypot(xbPos.x - C.x, xbPos.z - C.z) < 14) loadAll();
    slots.forEach((s, i) => { const f = s.g.children[s.g.children.length - 1]; if (s.loaded) f.rotation.y = Math.sin(t * 0.4 + i) * 0.35; });
    lamp.intensity = env.night ? 3.0 : env.dusk ? 1.45 : 0.35;
  }
  const doorPt = P(DOOR, RAD + 0.55);
  const spots = [
    ...slots.map((s) => ({ id: "fig-" + s.id, name: s.name, icon: "🎀", href: `figures.html#figure-${s.id}`, at: [0, 0, 0], noMarker: true, pick: [s.g], lines: [`${s.name}在这里！`, "这是你最喜欢的她。"] })),
    { id: "figures", name: "手办屋", icon: "🍡", href: "figures.html", at: [C.x, y0 + 3.15, C.z], pick: [...posts, star], lines: ["这里住着你最喜欢的她们。", "要轻轻地看哦～"], door: { x: C.x + doorPt[0], z: C.z + doorPt[1] } }
  ];
  return { root, spots, walk, update, loadAll, blockers: posts };
}
