/* 樱花小神社（照「樱花神社设定_v1」的布局）：花园左边草坪外的小坡上平出一块地。
 * 本地坐标：+z 朝前（朝喷泉），鸟居在最前，踏石小路一直通到拜殿。
 * 拜殿（铃铛、红白铃绳、赛钱箱、小鸭御守）、大樱花树（挂着写 Sakura 的小木牌）、
 * 两盏石灯笼、一对石狐狸、绘马架、竹筒洗手钵（水里漂着小黄鸭）。小绘梨衣站在樱花树下。
 */
export function buildShrine(THREE, scene, { heightAt, mobile, x: SX, z: SZ, yaw = Math.PI / 2 }) {
  const root = new THREE.Group(); root.name = "shrine";
  const y0 = heightAt(SX, SZ);
  root.position.set(SX, y0, SZ); root.rotation.y = yaw; scene.add(root);
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const W = (lx, lz) => [SX + lx * cy + lz * sy, SZ - lx * sy + lz * cy]; // 本地 → 世界
  let seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647); const R = (a, b) => a + rnd() * (b - a);
  const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.8, ...o });
  const M = {
    red: std({ color: "#c9483d", roughness: 0.62 }), redD: std({ color: "#9e3530", roughness: 0.7 }), white: std({ color: "#f7f1e6", roughness: 0.85 }),
    wood: std({ color: "#a8754c" }), woodD: std({ color: "#6a4630" }), black: std({ color: "#2d2626", roughness: 0.6 }),
    stone: std({ color: "#b4b1a6", roughness: 0.95 }), stoneD: std({ color: "#94918a", roughness: 0.95 }), moss: std({ color: "#7e9f63", roughness: 1 }),
    gold: std({ color: "#e8bd52", roughness: 0.35, metalness: 0.65 }), rope: std({ color: "#efe6cf", roughness: 0.9 }), paper: std({ color: "#ffffff", roughness: 0.7, side: THREE.DoubleSide }),
    glow: std({ color: "#ffe3a8", emissive: "#ffb24d", emissiveIntensity: 1.4, roughness: 0.5 }), water: std({ color: "#9fd3e6", roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.85 }),
    duck: std({ color: "#ffd23f", roughness: 0.45 }), beak: std({ color: "#ff9a3c", roughness: 0.5 }), bamboo: std({ color: "#b9b25d", roughness: 0.55 }),
  };
  const roofTex = (() => { const c = document.createElement("canvas"); c.width = 128; c.height = 128; const g = c.getContext("2d"); g.fillStyle = "#56627a"; g.fillRect(0, 0, 128, 128); for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? "#4b566c" : "#5f6c85"; g.fillRect(i * 16, 0, 9, 128); } for (let j = 0; j < 8; j++) { g.fillStyle = "rgba(30,36,50,.35)"; g.fillRect(0, j * 16 + 13, 128, 3); } const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; })();
  M.roof = std({ map: roofTex, roughness: 0.7 });
  const ropeTex = (() => { const c = document.createElement("canvas"); c.width = 32; c.height = 128; const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, 32, 128); g.fillStyle = "#d8423a"; for (let i = -2; i < 10; i++) { g.beginPath(); g.moveTo(0, i * 16); g.lineTo(32, i * 16 + 12); g.lineTo(32, i * 16 + 20); g.lineTo(0, i * 16 + 8); g.fill(); } const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 3); return t; })();
  M.bellRope = std({ map: ropeTex, roughness: 0.85 });

  const mk = (geo, mat, x, y, z, o = {}, parent = root) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (o.rx) m.rotation.x = o.rx; if (o.ry) m.rotation.y = o.ry; if (o.rz) m.rotation.z = o.rz; if (o.s) m.scale.set(...o.s); m.castShadow = o.cast !== false; m.receiveShadow = true; parent.add(m); return m; };
  const grp = (x, y, z, ry = 0, parent = root) => { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; parent.add(g); return g; };
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const cyl = (r0, r1, h, n = 12) => new THREE.CylinderGeometry(r0, r1, h, n);
  // 两端上翘的横梁/屋檐：沿 x 把顶点往上弯
  const bent = (w, h, d, lift, seg = 16) => { const g = new THREE.BoxGeometry(w, h, d, seg, 1, 1), p = g.attributes.position; for (let i = 0; i < p.count; i++) { const u = p.getX(i) / (w / 2); p.setY(i, p.getY(i) + lift * u ** 4); } g.computeVertexNormals(); return g; };
  const tube = (pts, r, mat, parent = root) => { const c = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))); return mk(new THREE.TubeGeometry(c, 24, r, 8), mat, 0, 0, 0, {}, parent); };
  const shide = (parent, x, y, z, s = 1) => { const sh = new THREE.Shape(); sh.moveTo(-0.02, 0); sh.lineTo(0.02, 0); sh.lineTo(0.02, -0.04); sh.lineTo(-0.01, -0.06); sh.lineTo(0.02, -0.1); sh.lineTo(-0.01, -0.12); sh.lineTo(0.015, -0.16); sh.lineTo(-0.02, -0.16); sh.lineTo(-0.045, -0.12); sh.lineTo(-0.015, -0.1); sh.lineTo(-0.045, -0.06); sh.lineTo(-0.02, -0.04); sh.closePath(); const m = mk(new THREE.ShapeGeometry(sh), M.paper, x, y, z, { cast: false }, parent); m.scale.setScalar(s); return m; };
  const shimenawa = (parent, x0, x1, y, z, sag, r) => { tube([[x0, y, z], [(x0 + x1) / 2, y - sag, z + 0.005], [x1, y, z]], r, M.rope, parent); for (let k = 1; k < 4; k++) { const u = k / 4, x = x0 + (x1 - x0) * u; shide(parent, x, y - sag * 4 * u * (1 - u) - r * 0.6, z + r + 0.005); } };

  // ---------- 地面：石砌边、苔藓、踏石小路 ----------
  {
    const rocks = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), M.stone, 36), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color(); let n = 0;
    for (let i = 0; i < 36; i++) { // 后半圈石头围边
      const a = Math.PI * (0.06 + 0.88 * i / 35) + Math.PI, rx = 2.85, rz = 2.6, lx = Math.cos(a) * rx, lz = Math.sin(a) * rz * 0.95 - 0.15;
      const s = R(0.11, 0.22); q.setFromEuler(new THREE.Euler(R(0, 3), R(0, 3), R(0, 3))); m4.compose(new THREE.Vector3(lx, s * 0.35, lz), q, new THREE.Vector3(s * 1.3, s * 0.85, s)); rocks.setMatrixAt(n, m4); rocks.setColorAt(n++, c.set("#ffffff").offsetHSL(0, 0, -rnd() * 0.15));
    }
    rocks.count = n; rocks.castShadow = rocks.receiveShadow = true; root.add(rocks);
    const stones = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1.05, 1, 10), M.stone, 16);
    for (let i = 0; i < 16; i++) { const lz = 3.15 - i * 0.24, lx = Math.sin(i * 1.9) * 0.09; q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), i); m4.compose(new THREE.Vector3(lx, 0.012 + heightAt(...W(lx, lz)) - y0, lz), q, new THREE.Vector3(R(0.15, 0.2), 0.05, R(0.11, 0.14))); stones.setMatrixAt(i, m4); stones.setColorAt(i, c.set("#ffffff").offsetHSL(0, 0, -rnd() * 0.1)); }
    stones.receiveShadow = true; root.add(stones);
    // 小花丛点缀
    const fl = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), std({ roughness: 0.7 }), 60);
    for (let i = 0; i < 60; i++) { let lx, lz; do { lx = R(-2.5, 2.5); lz = R(-2.3, 2.6); } while (Math.abs(lx) < 0.45 || (Math.abs(lx) < 1.3 && lz < -0.3)); const s = R(0.025, 0.04); m4.compose(new THREE.Vector3(lx, s + 0.03, lz), q.identity(), new THREE.Vector3(s, s, s)); fl.setMatrixAt(i, m4); fl.setColorAt(i, c.set(["#ffc4d3", "#fff1f4", "#f7a9bd", "#fff6c9"][i % 4])); }
    root.add(fl);
  }

  // ---------- 鸟居（本地 z=2.45） ----------
  const torii = grp(0, 0, 2.45);
  for (const k of [-1, 1]) { mk(cyl(0.062, 0.072, 1.55), M.red, k * 0.6, 0.86, 0, {}, torii); mk(cyl(0.085, 0.085, 0.16), M.black, k * 0.6, 0.08, 0, {}, torii); }
  mk(bent(1.78, 0.1, 0.17, 0.09), M.black, 0, 1.69, 0, {}, torii);
  mk(bent(1.62, 0.08, 0.14, 0.06), M.red, 0, 1.6, 0, {}, torii);
  mk(box(1.42, 0.07, 0.08), M.red, 0, 1.34, 0, {}, torii);
  mk(box(0.07, 0.2, 0.06), M.red, 0, 1.46, 0, {}, torii);
  mk(box(0.16, 0.2, 0.03), M.wood, 0, 1.47, 0.045, {}, torii); // 匾额
  shimenawa(torii, -0.56, 0.56, 1.22, 0.02, 0.07, 0.022);

  // ---------- 拜殿（本地 z=-1.45） ----------
  const hall = grp(0, 0, -1.45);
  mk(box(2.3, 0.14, 1.75), M.stone, 0, 0.07, 0, {}, hall);
  for (const [px, pz] of [[-0.9, -0.6], [0.9, -0.6], [-0.9, 0.6], [0.9, 0.6]]) mk(box(0.09, 0.2, 0.09), M.woodD, px, 0.22, pz, {}, hall);
  mk(box(2.05, 0.07, 1.5), M.wood, 0, 0.33, 0, {}, hall);
  // 外廊栏杆（前面中间留出台阶）
  const railM = M.white;
  for (const k of [-1, 1]) {
    mk(box(0.6, 0.035, 0.035), M.red, k * 0.72, 0.58, 0.74, {}, hall); mk(box(0.035, 0.035, 1.45), M.red, k * 1.0, 0.58, 0, {}, hall);
    for (let i = 0; i < 4; i++) mk(box(0.025, 0.22, 0.025), railM, k * (0.45 + i * 0.18), 0.47, 0.74, {}, hall);
    for (let i = 0; i < 6; i++) mk(box(0.025, 0.22, 0.025), railM, k * 1.0, 0.47, -0.62 + i * 0.25, {}, hall);
  }
  // 台阶
  for (let i = 0; i < 3; i++) mk(box(0.66, 0.06, 0.16), M.wood, 0, 0.1 + i * 0.09, 0.98 - i * 0.14, {}, hall);
  for (const k of [-1, 1]) mk(box(0.04, 0.3, 0.5), M.woodD, k * 0.35, 0.2, 0.86, { rx: 0.55 }, hall);
  // 柱子、墙
  for (const [px, pz] of [[-0.82, 0.55], [0.82, 0.55], [-0.82, -0.6], [0.82, -0.6], [-0.3, 0.55], [0.3, 0.55]]) mk(cyl(0.05, 0.055, 1.05), M.red, px, 0.88, pz, {}, hall);
  mk(box(1.6, 0.95, 0.06), M.white, 0, 0.85, -0.6, {}, hall);
  for (const k of [-1, 1]) { mk(box(0.06, 0.95, 1.1), M.white, k * 0.82, 0.85, -0.03, {}, hall); mk(box(0.07, 0.05, 1.12), M.red, k * 0.82, 0.62, -0.03, {}, hall); }
  mk(box(1.5, 0.85, 0.04), std({ color: "#3a2a24", roughness: 1 }), 0, 0.8, -0.54, {}, hall); // 里面暗
  // 格子拉门（两侧）
  for (const k of [-1, 1]) { const d = grp(k * 0.56, 0.82, 0.5, 0, hall); mk(box(0.46, 0.8, 0.03), std({ color: "#fbf4e3", roughness: 0.9 }), 0, 0, 0, {}, d); for (let i = -2; i <= 2; i++) mk(box(0.012, 0.8, 0.04), M.woodD, i * 0.09, 0, 0.003, {}, d); for (let j = -3; j <= 3; j++) mk(box(0.46, 0.012, 0.04), M.woodD, 0, j * 0.11, 0.003, {}, d); }
  mk(bent(1.9, 0.09, 0.1, 0.03), M.red, 0, 1.38, 0.58, {}, hall); // 正面梁
  mk(box(1.8, 0.05, 0.11), M.gold, 0, 1.31, 0.58, {}, hall);
  for (const k of [-1, 0, 1]) mk(new THREE.SphereGeometry(0.035, 10, 8), M.gold, k * 0.5, 1.38, 0.64, {}, hall);
  // 屋顶：两坡 + 屋脊 + 前面小破风
  const roof = grp(0, 0, 0, 0, hall);
  for (const k of [-1, 1]) mk(bent(2.7, 0.07, 1.25, 0.16, 20), M.roof, 0, 1.73, k * 0.5, { rx: k * 0.62 }, roof);
  mk(bent(2.5, 0.12, 0.14, 0.12), M.black, 0, 2.11, 0, {}, roof);
  for (const k of [-1, 1]) { mk(cyl(0.06, 0.06, 0.1, 12), M.black, k * 1.22, 2.2, 0, { rz: Math.PI / 2 }, roof); }
  for (const k of [-1, 1]) { // 两侧山墙
    const sh = new THREE.Shape(); sh.moveTo(-0.92, 0); sh.lineTo(0.92, 0); sh.lineTo(0, 0.62); sh.closePath();
    const g = mk(new THREE.ShapeGeometry(sh), M.white, k * 1.0, 1.42, 0, { ry: k * Math.PI / 2 }, roof); g.material = M.white;
    mk(new THREE.ShapeGeometry(sh), M.red, k * 1.005, 1.42, 0, { ry: k * Math.PI / 2, s: [1.02, 1.02, 1] }, roof).scale.set(1, 0.18, 1);
  }
  { // 前面的千鸟破风（三角小山墙）
    const g = grp(0, 1.86, 0.62, 0, roof), sh = new THREE.Shape(); sh.moveTo(-0.42, 0); sh.lineTo(0.42, 0); sh.lineTo(0, 0.32); sh.closePath();
    mk(new THREE.ExtrudeGeometry(sh, { depth: 0.05, bevelEnabled: false }), M.white, 0, 0, 0, {}, g);
    for (const k of [-1, 1]) mk(box(0.58, 0.06, 0.2), M.roof, k * 0.2, 0.17, 0.02, { rz: -k * 0.66 }, g);
    mk(new THREE.SphereGeometry(0.04, 10, 8), M.gold, 0, 0.14, 0.06, {}, g);
  }
  shimenawa(hall, -0.62, 0.62, 1.24, 0.66, 0.1, 0.035);
  // 铃铛 + 红白铃绳（能摇）
  const bell = grp(0, 1.3, 0.72, 0, hall);
  mk(cyl(0.01, 0.01, 0.08), M.rope, 0, -0.04, 0, {}, bell);
  mk(new THREE.SphereGeometry(0.09, 16, 12), M.gold, 0, -0.14, 0, {}, bell);
  mk(new THREE.TorusGeometry(0.06, 0.012, 6, 16), M.gold, 0, -0.17, 0, { rx: Math.PI / 2 }, bell);
  const brope = mk(cyl(0.022, 0.022, 0.7), M.bellRope, 0, -0.58, 0, {}, bell);
  mk(cyl(0.005, 0.05, 0.12, 10), M.white, 0, -0.98, 0, {}, bell);
  // 赛钱箱
  { const g = grp(0, 0.37, 0.4, 0, hall); mk(box(0.56, 0.3, 0.32), M.woodD, 0, 0.15, 0, {}, g); for (let i = -3; i <= 3; i++) mk(box(0.03, 0.03, 0.34), M.wood, i * 0.07, 0.31, 0, { rx: 0 }, g); const em = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2, r = i % 2 ? 0.035 : 0.07; em[i ? "lineTo" : "moveTo"](Math.sin(a) * r, Math.cos(a) * r); } mk(new THREE.ShapeGeometry(em), M.gold, 0, 0.15, 0.165, {}, g); }
  // 小鸭御守（挂在柱子边）
  { const g = grp(0.5, 1.12, 0.6, 0, hall); mk(cyl(0.004, 0.004, 0.12), M.red, 0, 0.06, 0, {}, g); mk(box(0.1, 0.13, 0.025), std({ color: "#f6a7bd", roughness: 0.7 }), 0, -0.05, 0, {}, g); mk(new THREE.SphereGeometry(0.028, 10, 8), M.duck, 0, -0.06, 0.018, {}, g); mk(new THREE.SphereGeometry(0.018, 10, 8), M.duck, 0.012, -0.03, 0.02, {}, g); mk(new THREE.ConeGeometry(0.008, 0.02, 6), M.beak, 0.03, -0.03, 0.022, { rz: -Math.PI / 2 }, g); }
  const omamori = hall.children[hall.children.length - 1];

  // ---------- 石灯笼 ----------
  const glows = [];
  const lantern = (lx, lz) => {
    const g = grp(lx, 0, lz); mk(box(0.24, 0.08, 0.24), M.stone, 0, 0.04, 0, {}, g); mk(cyl(0.06, 0.075, 0.42, 8), M.stone, 0, 0.29, 0, {}, g); mk(box(0.22, 0.05, 0.22), M.stone, 0, 0.52, 0, {}, g);
    mk(box(0.16, 0.16, 0.16), M.glow, 0, 0.63, 0, { cast: false }, g); for (const [a, b] of [[1, 0], [0, 1]]) mk(box(a ? 0.18 : 0.06, 0.17, b ? 0.18 : 0.06), M.stone, 0, 0.63, 0, {}, g).scale.set(a ? 1 : 1, 1, b ? 1 : 1);
    mk(new THREE.ConeGeometry(0.2, 0.15, 4), M.stoneD, 0, 0.785, 0, { ry: Math.PI / 4 }, g); mk(new THREE.SphereGeometry(0.035, 8, 6), M.stoneD, 0, 0.88, 0, {}, g);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: "#ffc77a", transparent: true, opacity: 0.0, depthWrite: false, blending: THREE.AdditiveBlending })); sp.position.set(0, 0.63, 0); sp.scale.setScalar(0.8); g.add(sp); glows.push(sp);
    return g;
  };
  const glowTex = (() => { const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d"), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.4, "rgba(255,255,255,.35)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); return t; })();
  lantern(-1.2, -0.25); lantern(1.2, -0.25);
  // 窗口用镂空：灯盒四面挡板只留中间（上面已用两块交叉板挡住四角）

  // ---------- 石狐狸一对（本地 x=1.7, z=0.75） ----------
  const FOX = { x: 1.75, z: 0.8 };
  {
    const g = grp(FOX.x, 0, FOX.z, -0.35); mk(box(0.78, 0.2, 0.34), M.stone, 0, 0.1, 0, {}, g); mk(box(0.82, 0.03, 0.38), M.stoneD, 0, 0.215, 0, {}, g);
    const fx = new THREE.MeshStandardMaterial({ color: "#c3c2b9", roughness: 0.9 }), bibM = std({ color: "#d9453d", roughness: 0.75 });
    for (const k of [-1, 1]) {
      const f = grp(k * 0.22, 0.23, 0, -k * 0.25, g);
      mk(new THREE.SphereGeometry(0.1, 14, 10), fx, 0, 0.1, 0, { s: [0.85, 1.15, 0.8] }, f);
      mk(new THREE.SphereGeometry(0.075, 14, 10), fx, 0, 0.26, 0.02, { s: [1, 0.95, 0.95] }, f);
      mk(new THREE.ConeGeometry(0.035, 0.09, 8), fx, 0, 0.25, 0.09, { rx: Math.PI / 2, s: [1, 1, 0.8] }, f); // 嘴
      for (const e of [-1, 1]) { mk(new THREE.ConeGeometry(0.03, 0.08, 6), fx, e * 0.04, 0.35, 0.01, { rz: -e * 0.25 }, f); mk(new THREE.TorusGeometry(0.012, 0.003, 4, 8, Math.PI), M.black, e * 0.03, 0.275, 0.068, {}, f).rotation.z = Math.PI; }
      mk(new THREE.SphereGeometry(0.07, 12, 8), fx, k * 0.08, 0.13, -0.08, { s: [0.7, 1.6, 0.7], rz: k * 0.5 }, f); // 尾巴
      mk(new THREE.ConeGeometry(0.07, 0.07, 14, 1, true), bibM, 0, 0.17, 0.035, { rx: Math.PI, s: [1, 1, 0.8] }, f); // 红围兜
      for (let i = 0; i < 3; i++) mk(new THREE.SphereGeometry(0.014, 6, 5), std({ color: "#ffc0cf" }), (i - 1) * 0.03, 0.15, 0.085, {}, f);
    }
    mk(cyl(0.03, 0.04, 0.07, 8), M.gold, 0, 0.27, 0.02, {}, g); mk(new THREE.ConeGeometry(0.035, 0.05, 8), M.gold, 0, 0.33, 0.02, {}, g);
  }

  // ---------- 竹筒洗手钵 + 小黄鸭（本地 x=1.3, z=1.85） ----------
  const CHO = { x: 1.3, z: 1.85 };
  const duck = new THREE.Group();
  let stream;
  {
    const g = grp(CHO.x, 0, CHO.z, -0.6);
    const pts = [[0.0, 0], [0.24, 0], [0.27, 0.05], [0.27, 0.2], [0.23, 0.24], [0.19, 0.24], [0.19, 0.2]].map(([a, b]) => new THREE.Vector2(a, b));
    mk(new THREE.LatheGeometry(pts, 20), M.stone, 0, 0, 0, {}, g);
    mk(new THREE.CircleGeometry(0.19, 20), M.water, 0, 0.2, 0, { rx: -Math.PI / 2, cast: false }, g);
    for (let i = 0; i < 5; i++) mk(new THREE.IcosahedronGeometry(R(0.06, 0.1), 0), M.stoneD, Math.cos(i * 1.3) * 0.32, 0.03, Math.sin(i * 1.3) * 0.32, { s: [1, 0.6, 1] }, g);
    mk(cyl(0.025, 0.025, 0.5, 8), M.bamboo, -0.32, 0.25, 0, {}, g);
    mk(cyl(0.028, 0.028, 0.42, 8), M.bamboo, -0.13, 0.48, 0, { rz: Math.PI / 2 - 0.12 }, g);
    mk(cyl(0.032, 0.032, 0.02, 8), std({ color: "#8f8a43" }), -0.32, 0.5, 0, {}, g);
    stream = mk(cyl(0.008, 0.008, 0.24, 6), std({ color: "#dff3ff", transparent: true, opacity: 0.6, roughness: 0.1 }), 0.08, 0.34, 0, { cast: false }, g);
    // 小黄鸭
    mk(new THREE.SphereGeometry(0.045, 14, 10), M.duck, 0, 0, 0, { s: [1.15, 0.8, 1] }, duck); mk(new THREE.SphereGeometry(0.03, 12, 9), M.duck, 0.03, 0.045, 0, {}, duck);
    mk(new THREE.ConeGeometry(0.012, 0.03, 8), M.beak, 0.065, 0.04, 0, { rz: -Math.PI / 2 }, duck); for (const e of [-1, 1]) mk(new THREE.SphereGeometry(0.005, 6, 5), M.black, 0.05, 0.055, e * 0.017, {}, duck);
    mk(new THREE.SphereGeometry(0.02, 8, 6), M.duck, -0.045, 0.02, 0, { s: [1, 0.7, 1.4] }, duck);
    duck.position.set(0.03, 0.21, 0.06); g.add(duck);
  }

  // ---------- 绘马架（本地 x=-1.7, z=1.0） ----------
  const emaTex = (() => { const c = document.createElement("canvas"); c.width = 256; c.height = 128; const g = c.getContext("2d"); const draw = (i) => { const x = (i % 4) * 64; g.fillStyle = "#e9c48f"; g.fillRect(x, 0, 64, 128); g.strokeStyle = "#b58a58"; g.lineWidth = 3; g.strokeRect(x + 2, 2, 60, 124);
      if (i % 2) { g.fillStyle = "#ffd23f"; g.beginPath(); g.ellipse(x + 32, 74, 14, 10, 0, 0, 7); g.fill(); g.beginPath(); g.arc(x + 40, 60, 8, 0, 7); g.fill(); g.fillStyle = "#ff9a3c"; g.fillRect(x + 46, 59, 7, 4); }
      else { g.fillStyle = "#f29ab0"; for (let k = 0; k < 5; k++) { const a = k / 5 * 6.28; g.beginPath(); g.ellipse(x + 32 + Math.sin(a) * 9, 62 - Math.cos(a) * 9, 6, 9, a, 0, 7); g.fill(); } g.fillStyle = "#fff4c8"; g.beginPath(); g.arc(x + 32, 62, 4, 0, 7); g.fill(); }
      g.strokeStyle = "#7a5a40"; g.lineWidth = 2; for (let k = 0; k < 2; k++) { g.beginPath(); g.moveTo(x + 14, 96 + k * 10); g.quadraticCurveTo(x + 32, 92 + k * 10, x + 50, 97 + k * 10); g.stroke(); } };
    for (let i = 0; i < 4; i++) draw(i); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  {
    const g = grp(-1.75, 0, 1.0, 0.45);
    for (const k of [-1, 1]) mk(box(0.06, 1.05, 0.06), M.woodD, k * 0.55, 0.52, 0, {}, g);
    for (const k of [-1, 1]) mk(box(1.35, 0.03, 0.3), std({ color: "#5b4636" }), 0, 1.1, k * 0.08, { rx: k * 0.5 }, g);
    for (const yy of [0.82, 0.58]) mk(box(1.1, 0.03, 0.03), M.wood, 0, yy, 0, {}, g);
    const sh = new THREE.Shape(); sh.moveTo(-0.06, 0); sh.lineTo(0.06, 0); sh.lineTo(0.06, 0.07); sh.lineTo(0, 0.1); sh.lineTo(-0.06, 0.07); sh.closePath();
    const eg = new THREE.ShapeGeometry(sh); { const uv = eg.attributes.uv, p = eg.attributes.position; for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + 0.06) / 0.12, p.getY(i) / 0.1); }
    let n = 0;
    for (const yy of [0.82, 0.58]) for (let i = 0; i < 6; i++) {
      const v = n++ % 4, geo = eg.clone(), uv = geo.attributes.uv; for (let j = 0; j < uv.count; j++) uv.setX(j, (v + uv.getX(j)) / 4);
      const m = mk(geo, std({ map: emaTex, side: THREE.DoubleSide, roughness: 0.85 }), -0.45 + i * 0.18, yy - 0.12, 0.02, { rz: R(-0.08, 0.08) }, g);
      mk(new THREE.TorusGeometry(0.012, 0.003, 4, 8), M.red, m.position.x, yy - 0.012, 0.02, {}, g);
    }
  }

  // ---------- 大樱花树（本地 x=1.85, z=-1.3） ----------
  const TREE = { x: 1.95, z: -1.35 };
  const petals = [];
  {
    const g = grp(TREE.x, 0, TREE.z), bark = std({ color: "#6e4a3a", roughness: 0.95 });
    const branch = (a, b, r0, r1) => { const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), L = A.distanceTo(B), m = mk(cyl(r1, r0, L, 9), bark, 0, 0, 0, {}, g); m.position.copy(A).lerp(B, 0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize()); return B; };
    const top = branch([0, 0, 0], [-0.12, 1.25, 0.05], 0.2, 0.13);
    mk(new THREE.SphereGeometry(0.22, 10, 8), bark, 0, 0.05, 0, { s: [1.2, 0.4, 1.2] }, g);
    const ends = [];
    for (const [dx, dy, dz] of [[-0.75, 0.65, 0.35], [0.7, 0.75, 0.1], [0.05, 0.9, -0.55], [-0.3, 0.95, 0.65], [0.45, 0.55, 0.6]]) { const e = branch(top.toArray(), [top.x + dx, top.y + dy, top.z + dz], 0.11, 0.05); ends.push(e); branch(e.toArray(), [e.x + dx * 0.5, e.y + 0.35, e.z + dz * 0.5], 0.05, 0.02); }
    // 树冠：每根枝头一团“花云”——里面一团深一点的芯，外面贴满一小簇一小簇的花团（像概念图里一朵朵攒在一起）
    const lumpy = (seg, amp) => { const g0 = new THREE.SphereGeometry(1, seg, Math.round(seg * 0.7)), p = g0.attributes.position, v = new THREE.Vector3(); for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); v.multiplyScalar(1 + amp * Math.sin(v.x * 9.1 + v.y * 4.3) * Math.cos(v.z * 8.4 - v.y * 3.1)); p.setXYZ(i, v.x, v.y, v.z); } g0.computeVertexNormals(); return g0; };
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
    const core = new THREE.InstancedMesh(lumpy(14, 0.08), std({ roughness: 0.95, color: "#e79ab2" }), ends.length);
    ends.forEach((e, i) => { m4.compose(new THREE.Vector3(e.x, e.y + 0.32, e.z), q.identity(), new THREE.Vector3(0.52, 0.38, 0.52)); core.setMatrixAt(i, m4); });
    core.castShadow = true; g.add(core);
    const NC = mobile ? 260 : 380, clump = new THREE.InstancedMesh(lumpy(10, 0.16), std({ roughness: 0.85, emissive: "#ff8fb4", emissiveIntensity: 0.14 }), NC);
    for (let i = 0; i < NC; i++) {
      const e = ends[i % ends.length], a = rnd() * 6.28, el = R(-0.45, 1.45), cx = Math.cos(el), up = Math.sin(el);
      const s = R(0.09, 0.16) * (1 + 0.25 * up), rr = R(0.92, 1.05);
      m4.compose(new THREE.Vector3(e.x + Math.cos(a) * cx * 0.62 * rr, e.y + 0.32 + up * 0.46 * rr, e.z + Math.sin(a) * cx * 0.62 * rr), q.setFromEuler(new THREE.Euler(R(0, 3), R(0, 3), 0)), new THREE.Vector3(s, s * 0.8, s));
      clump.setMatrixAt(i, m4); clump.setColorAt(i, c.set(["#ffc1d4", "#ffd6e3", "#f7a8c1", "#ffe4ec", "#fbb6cb"][i % 5]).offsetHSL(0, 0, up * 0.05));
    }
    clump.castShadow = true; g.add(clump);
    // 花团上点几朵亮白的小花
    const fm = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), std({ roughness: 0.6, emissive: "#ffffff", emissiveIntensity: 0.3 }), 160);
    for (let i = 0; i < 160; i++) { const e = ends[i % ends.length], a = rnd() * 6.28, el = R(0, 1.45), r = R(1.04, 1.12); m4.compose(new THREE.Vector3(e.x + Math.cos(a) * Math.cos(el) * 0.66 * r, e.y + 0.32 + Math.sin(el) * 0.5 * r, e.z + Math.sin(a) * Math.cos(el) * 0.66 * r), q.identity(), new THREE.Vector3(0.028, 0.022, 0.028)); fm.setMatrixAt(i, m4); fm.setColorAt(i, c.set(["#ffffff", "#fff0f4", "#ff9fbb"][i % 3])); }
    g.add(fm);
    // 写着 Sakura 的小木牌（挂在低枝上）
    const sign = (() => { const c2 = document.createElement("canvas"); c2.width = 256; c2.height = 128; const x2 = c2.getContext("2d"); x2.fillStyle = "#e3bd88"; x2.fillRect(0, 0, 256, 128); x2.strokeStyle = "#a87a4c"; x2.lineWidth = 8; x2.strokeRect(4, 4, 248, 120); x2.fillStyle = "#c23a4a"; x2.font = "italic 600 62px 'Snell Roundhand','Segoe Script','Comic Sans MS',cursive"; x2.textAlign = "center"; x2.textBaseline = "middle"; x2.fillText("Sakura", 128, 60); x2.fillStyle = "#f59ab3"; for (const [px, py] of [[28, 26], [228, 102]]) for (let k = 0; k < 5; k++) { const a = k / 5 * 6.28; x2.beginPath(); x2.ellipse(px + Math.sin(a) * 7, py - Math.cos(a) * 7, 5, 7, a, 0, 7); x2.fill(); } const t = new THREE.CanvasTexture(c2); t.colorSpace = THREE.SRGBColorSpace; return t; })();
    const sg = grp(-0.42, 1.55, 0.32, -0.5, g);
    for (const k of [-1, 1]) mk(cyl(0.004, 0.004, 0.3, 4), M.red, k * 0.1, 0.15, 0, {}, sg);
    mk(box(0.34, 0.17, 0.025), std({ map: sign, roughness: 0.8 }), 0, -0.06, 0, {}, sg);
    mk(new THREE.TorusGeometry(0.025, 0.008, 6, 12), std({ color: "#f48fb1" }), 0, 0.3, 0, {}, sg);
    // 飘落的花瓣
    const NP = mobile ? 40 : 70, pos = new Float32Array(NP * 3), pg = new THREE.BufferGeometry(); pg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const pt = (() => { const c3 = document.createElement("canvas"); c3.width = c3.height = 32; const x3 = c3.getContext("2d"); x3.fillStyle = "#ffffff"; x3.beginPath(); x3.ellipse(16, 16, 7, 12, 0.5, 0, 7); x3.fill(); return new THREE.CanvasTexture(c3); })();
    const pts = new THREE.Points(pg, new THREE.PointsMaterial({ map: pt, size: 0.07, color: "#ffc2d4", transparent: true, depthWrite: false, alphaTest: 0.2 })); pts.frustumCulled = false; g.add(pts);
    for (let i = 0; i < NP; i++) petals.push([R(-1.4, 1.4), R(0, 2.8), R(-1.4, 1.4), R(0.12, 0.25), rnd() * 6.28]);
    petals.geo = pg; petals.pos = pos;
  }

  // ---------- 动画 ----------
  let bellV = 0, bellA = 0, splash = 0, burst = 0;
  function update(dt, t, env) {
    bellV += (-bellA * 30 - bellV * 2.2) * dt; bellA += bellV * dt; bell.rotation.x = bellA; bell.rotation.z = bellA * 0.4;
    omamori.rotation.z = Math.sin(t * 1.6) * 0.08;
    duck.position.y = 0.21 + Math.sin(t * 2.2) * 0.006 + (splash > 0 ? Math.abs(Math.sin(splash * 9)) * 0.03 * splash : 0); duck.rotation.y = Math.sin(t * 0.4) * 0.6 + t * 0.15; splash = Math.max(0, splash - dt);
    stream.scale.x = stream.scale.z = 1 + Math.sin(t * 20) * 0.15;
    burst = Math.max(0, burst - dt * 0.4);
    const p = petals.pos, sp = 1 + burst * 3;
    for (let i = 0; i < petals.length; i++) { const q = petals[i]; q[1] -= q[3] * dt * sp; if (q[1] < 0.02) { q[1] = R(2.2, 3.0); q[0] = R(-1.4, 1.4); q[2] = R(-1.4, 1.4); } p[i * 3] = q[0] + Math.sin(t * 0.9 + q[4]) * 0.25; p[i * 3 + 1] = q[1] + 0.3; p[i * 3 + 2] = q[2] + Math.cos(t * 0.7 + q[4]) * 0.2; }
    petals.geo.attributes.position.needsUpdate = true;
    const night = env?.night ?? 0; for (const g of glows) g.material.opacity = 0.15 + night * 0.75;
    M.glow.emissiveIntensity = 0.6 + night * 1.6;
  }

  // ---------- 能走的地方 ----------
  function walk(map) {
    map.ellipse(SX, SZ, 3.0, 2.9, 1); map.ellipse(...W(0, 2.6), 1.2, 1.0, 1);
    const blockL = (lx, lz, r) => { const [x, z] = W(lx, lz); map.circle(x, z, r); };
    for (let lx = -1.15; lx <= 1.15; lx += 0.23) for (let lz = -2.3; lz <= -0.55; lz += 0.23) blockL(lx, lz, 0.3); // 拜殿
    for (const k of [-1, 1]) blockL(k * 0.6, 2.45, 0.2); // 鸟居柱
    blockL(-1.2, -0.25, 0.28); blockL(1.2, -0.25, 0.28); // 灯笼
    blockL(TREE.x, TREE.z, 0.42);
    for (const k of [-1, 0, 1]) blockL(FOX.x + k * 0.3 * Math.cos(-0.35), FOX.z - k * 0.3 * Math.sin(-0.35), 0.3);
    blockL(CHO.x, CHO.z, 0.42); blockL(CHO.x - 0.3, CHO.z - 0.15, 0.2);
    for (const k of [-1, 0, 1]) blockL(-1.75 + k * 0.5 * Math.cos(0.45), 1.0 - k * 0.5 * Math.sin(0.45), 0.24); // 绘马架
    // 后半圈石头外面挡住
    for (let i = 0; i <= 40; i++) { const a = Math.PI * (i / 40) + Math.PI; blockL(Math.cos(a) * 3.05, Math.sin(a) * 2.75 - 0.15, 0.35); }
  }

  // ---------- 互动点 ----------
  const at = (lx, ly, lz) => { const [x, z] = W(lx, lz); return [x, y0 + ly, z]; };
  const sp = (lx, lz) => { const [x, z] = W(lx, lz); return { x, z }; };
  const faceL = (fx, fz, tx, tz) => { const [ax, az] = W(fx, fz), [bx, bz] = W(tx, tz); return Math.atan2(bx - ax, bz - az); };
  const spots = [
    { id: "shrine-bell", name: "樱花神社", icon: "⛩️", verb: "摇铃铛", at: at(0, 2.5, -1.1), spot: sp(0, 0.05), face: faceL(0, 0.05, 0, -1), pick: [hall], clip: "wow", dur: 2.8,
      lines: ["（拍拍手）希望我们一直在一起。", "铃铛叮铃铃～神明听见了吗？", "愿樱花每年都开。", "许的愿，不说出来才灵。"], start() { bellV += 4.2; burst = 1; } },
    { id: "shrine-ema", action: "wish-tree", name: "绘马架", icon: "🪵", verb: "看绘马", at: at(-1.75, 1.6, 1.0), spot: sp(-1.25, 1.55), face: faceL(-1.25, 1.55, -1.75, 1.0), pick: [], clip: "wave", dur: 2,
      lines: ["好多愿望呀。"] },
    { id: "shrine-water", name: "洗手钵", icon: "🦆", verb: "洗洗手", at: at(CHO.x, 1.0, CHO.z), spot: sp(0.75, 2.15), face: faceL(0.75, 2.15, CHO.x, CHO.z), pick: [duck], clip: "wow", dur: 2.4,
      lines: ["水凉凉的！", "小黄鸭在游泳～", "洗干净手才能去拜拜。"], start() { splash = 1; } },
  ];
  const eriAt = { ...sp(1.72, -0.5), yaw: Math.atan2(...(() => { const [ax, az] = W(1.72, -0.5), [bx, bz] = W(0.4, 1.7); return [bx - ax, bz - az]; })()) };
  return { root, update, walk, spots, eriAt, pad: { x: SX, z: SZ }, ringBell() { bellV += 4.2; burst = 1; } };
}
