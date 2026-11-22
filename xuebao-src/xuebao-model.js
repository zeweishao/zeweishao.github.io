/* 雪宝 · 3D 小人（照着 xb-a-idle 的设定图用代码搭的 Q 版人偶）
 * 灰发 + 粉色挑染、四节泡泡双马尾配金发环、右眼（画面左）缠白绷带、粉色方发卡、玫红瞳；
 * 红色交叉绑带上衣 + 前开的红外裙、白荷叶边内衬、黑短裙；白色泡泡袖、黑丝袜、红色厚底鞋配蝴蝶结；米白斜挎包挂金星星。
 * 模型总高 1（脚底 y=0，面朝 +z），外面按需要缩放。关节都是 Group，方便做走路、挥手、坐下等动作。
 */
export function buildXuebao(THREE) {
  const mats = [];
  const M = (o) => { const m = new THREE.MeshStandardMaterial(o); mats.push(m); return m; };
  const skin = M({ color: "#fde3d6", roughness: 0.62 });
  const red = M({ color: "#c8283c", roughness: 0.55 });
  const redDeep = M({ color: "#a51c30", roughness: 0.5, side: THREE.DoubleSide });
  const white = M({ color: "#fbf6f2", roughness: 0.7, side: THREE.DoubleSide });
  const black = M({ color: "#2b2326", roughness: 0.6, side: THREE.DoubleSide });
  const tights = M({ color: "#3a2c2c", roughness: 0.45 });
  const shoe = M({ color: "#d42a3c", roughness: 0.22, metalness: 0.05 });
  const gold = M({ color: "#e8c071", roughness: 0.25, metalness: 1 });
  const pink = M({ color: "#f5a9be", roughness: 0.4 });
  const cream = M({ color: "#efe3cc", roughness: 0.75 });

  // 头发贴图：灰色发丝 + 两道粉色挑染
  function hairTex(pinkBands) {
    const c = document.createElement("canvas"); c.width = 256; c.height = 256; const g = c.getContext("2d");
    g.fillStyle = "#9b9497"; g.fillRect(0, 0, 256, 256);
    let s = 7; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 160; i++) { const x = r() * 256, w = 1 + r() * 3, l = r(); g.fillStyle = l > 0.5 ? `rgba(255,250,250,${0.12 + r() * 0.15})` : `rgba(70,60,66,${0.1 + r() * 0.16})`; g.fillRect(x, 0, w, 256); }
    pinkBands.forEach(([a, b]) => { const gr = g.createLinearGradient(a * 256, 0, b * 256, 0); gr.addColorStop(0, "rgba(242,140,176,0)"); gr.addColorStop(0.3, "rgba(242,140,176,.95)"); gr.addColorStop(0.7, "rgba(246,160,190,.95)"); gr.addColorStop(1, "rgba(242,140,176,0)"); g.fillStyle = gr; g.fillRect(a * 256, 0, (b - a) * 256, 256); });
    // 顶部高光带
    const hl = g.createLinearGradient(0, 0, 0, 256); hl.addColorStop(0, "rgba(255,255,255,0)"); hl.addColorStop(0.32, "rgba(255,255,255,.16)"); hl.addColorStop(0.4, "rgba(255,255,255,0)"); g.fillStyle = hl; g.fillRect(0, 0, 256, 256);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; return t;
  }
  const hair = M({ map: hairTex([]), roughness: 0.48 });
  const hairPink = M({ map: hairTex([[0.18, 0.3], [0.62, 0.72]]), roughness: 0.42 });

  // 脸：一只玫红大眼睛 + 绷带 + 腮红 + 嘴，三种表情（睁眼 / 闭眼 / 开心）
  function faceCanvas(kind) {
    const c = document.createElement("canvas"); c.width = c.height = 512; const g = c.getContext("2d");
    // 腮红
    [[160, 360], [380, 372]].forEach(([x, y]) => { const gr = g.createRadialGradient(x, y, 0, x, y, 52); gr.addColorStop(0, "rgba(255,140,150,.5)"); gr.addColorStop(1, "rgba(255,140,150,0)"); g.fillStyle = gr; g.fillRect(x - 60, y - 60, 120, 120); });
    const ex = 338, ey = 292;
    if (kind === "open") {
      g.save(); g.translate(ex, ey); g.scale(1.55, 1.55);
      g.fillStyle = "#fff"; g.beginPath(); g.ellipse(0, 4, 40, 50, 0, 0, Math.PI * 2); g.fill();
      const ir = g.createLinearGradient(0, -44, 0, 50); ir.addColorStop(0, "#5a0f22"); ir.addColorStop(0.45, "#b3264a"); ir.addColorStop(1, "#ff8fae");
      g.fillStyle = ir; g.beginPath(); g.ellipse(2, 8, 33, 44, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#3a0a18"; g.beginPath(); g.ellipse(2, 6, 14, 20, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "rgba(255,190,205,.8)"; g.lineWidth = 2; g.beginPath(); g.ellipse(2, 8, 25, 35, 0, 0.2, Math.PI - 0.2); g.stroke();
      g.fillStyle = "#fff"; g.beginPath(); g.ellipse(-10, -12, 11, 14, -0.3, 0, Math.PI * 2); g.fill(); g.beginPath(); g.arc(14, 26, 6, 0, Math.PI * 2); g.fill();
      // 上睫毛
      g.strokeStyle = "#3b1a26"; g.lineCap = "round"; g.lineWidth = 9; g.beginPath(); g.ellipse(0, 6, 44, 52, 0, Math.PI * 1.08, Math.PI * 1.95); g.stroke();
      g.lineWidth = 5; g.beginPath(); g.moveTo(40, -18); g.lineTo(56, -30); g.moveTo(43, -6); g.lineTo(58, -12); g.stroke();
      g.restore();
    } else if (kind === "closed") {
      g.strokeStyle = "#3b1a26"; g.lineWidth = 10; g.lineCap = "round"; g.beginPath(); g.arc(ex, ey - 20, 60, 0.25 * Math.PI, 0.75 * Math.PI); g.stroke();
      g.lineWidth = 4; g.beginPath(); g.moveTo(ex + 36, ey + 14); g.lineTo(ex + 50, ey + 20); g.stroke();
    } else {
      g.strokeStyle = "#3b1a26"; g.lineWidth = 9; g.lineCap = "round"; g.beginPath(); g.arc(ex, ey + 40, 56, 1.2 * Math.PI, 1.8 * Math.PI); g.stroke();
    }
    // 眉毛
    g.strokeStyle = "rgba(120,100,110,.7)"; g.lineWidth = 5; g.lineCap = "round"; g.beginPath(); g.moveTo(ex - 40, ey - 112); g.quadraticCurveTo(ex, ey - 124, ex + 42, ey - 114); g.stroke();
    // 嘴
    g.strokeStyle = "#a8465a"; g.lineWidth = 5;
    if (kind === "happy") { g.fillStyle = "#c2405a"; g.beginPath(); g.moveTo(236, 400); g.quadraticCurveTo(262, 440, 288, 400); g.closePath(); g.fill(); g.fillStyle = "#f58fa2"; g.beginPath(); g.ellipse(262, 420, 11, 6, 0, 0, Math.PI * 2); g.fill(); }
    else { g.beginPath(); g.moveTo(244, 404); g.quadraticCurveTo(262, 418, 280, 402); g.stroke(); }
    // 绷带：斜着缠过画面左边的眼睛
    g.save(); g.translate(150, 285); g.rotate(-0.25);
    g.shadowColor = "rgba(120,90,90,.35)"; g.shadowBlur = 8; g.shadowOffsetY = 3;
    g.fillStyle = "#fbf8f4"; g.beginPath(); g.roundRect(-150, -58, 245, 112, 36); g.fill(); g.shadowColor = "transparent";
    g.strokeStyle = "rgba(190,175,170,.75)"; g.lineWidth = 3;
    for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(-150, i * 20 - 4); g.bezierCurveTo(-60, i * 20 + 8, 10, i * 20 - 10, 95, i * 20 + 2); g.stroke(); }
    g.strokeStyle = "rgba(230,190,190,.5)"; g.lineWidth = 2; g.beginPath(); g.moveTo(30, -58); g.lineTo(60, 54); g.stroke();
    g.restore();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  }
  const faces = { open: faceCanvas("open"), closed: faceCanvas("closed"), happy: faceCanvas("happy") };
  const faceMat = new THREE.MeshStandardMaterial({ map: faces.open, transparent: true, roughness: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  mats.push(faceMat);

  const mesh = (geo, mat, parent, x = 0, y = 0, z = 0, o = {}) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z);
    if (o.r) m.rotation.set(...o.r); if (o.s) m.scale.set(...o.s);
    m.castShadow = o.cast !== false; m.receiveShadow = true; parent.add(m); return m;
  };
  const grp = (parent, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
  const sph = (r, w = 20, h = 14) => new THREE.SphereGeometry(r, w, h);
  const lathe = (pts, seg = 32, ps = 0, pl = Math.PI * 2) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg, ps, pl);
  // 荷叶边：沿圆周起伏，越往下摆越明显；front 为正时前面的下摆往上收（前开裙）
  function ruffle(geo, waves, amp, y0, y1, frontLift = 0) {
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), phi = Math.atan2(x, z), k = THREE.MathUtils.clamp((y0 - y) / (y0 - y1), 0, 1);
      const f = 1 + Math.sin(phi * waves) * amp * k; p.setX(i, x * f); p.setZ(i, z * f);
      if (frontLift) p.setY(i, y + frontLift * Math.pow(Math.max(0, Math.cos(phi)), 2) * k);
    }
    geo.computeVertexNormals(); return geo;
  }
  function bow(parent, x, y, z, s = 1, mat = red, r = [0, 0, 0]) {
    const b = grp(parent, x, y, z); b.rotation.set(...r); b.scale.setScalar(s);
    [-1, 1].forEach((k) => mesh(sph(0.02, 12, 8), mat, b, k * 0.022, 0, 0, { s: [1.1, 0.75, 0.45], r: [0, 0, k * 0.35] }));
    [-1, 1].forEach((k) => mesh(new THREE.ConeGeometry(0.008, 0.03, 6), mat, b, k * 0.01, -0.018, 0, { r: [0, 0, k * 0.35] }));
    mesh(sph(0.009, 10, 8), mat, b); return b;
  }

  const root = new THREE.Group();            // 站位 + 朝向
  const body = grp(root);                    // 整体上下、挤压
  const hips = grp(body, 0, 0.27, 0);        // 骨盆（坐下时往下）

  // ---------- 腿和鞋 ----------
  const legs = [-1, 1].map((k) => {
    const leg = grp(hips, k * 0.042, 0, 0);
    mesh(new THREE.CylinderGeometry(0.026, 0.021, 0.21, 14), tights, leg, 0, -0.105, 0);
    mesh(new THREE.TorusGeometry(0.027, 0.006, 6, 18), red, leg, 0, -0.04, 0, { r: [Math.PI / 2, 0, 0] });
    if (k > 0) mesh(new THREE.OctahedronGeometry(0.008), gold, leg, 0.01, -0.06, 0.025);
    const foot = grp(leg, 0, -0.215, 0);
    mesh(new THREE.BoxGeometry(0.058, 0.035, 0.1), shoe, foot, 0, -0.038, 0.012);
    mesh(sph(0.034, 18, 12), shoe, foot, 0, -0.02, 0.02, { s: [0.9, 0.7, 1.4] });
    bow(foot, 0, 0.0, 0.045, 0.9, shoe);
    return { leg, foot };
  });

  // ---------- 裙子 ----------
  mesh(ruffle(lathe([[0.06, 0.15], [0.11, 0.04], [0.135, 0.0], [0.134, -0.01]], 40), 12, 0.07, 0.15, -0.01), black, hips, 0, 0, 0);
  mesh(ruffle(lathe([[0.064, 0.16], [0.13, 0.03], [0.19, -0.1], [0.2, -0.135]], 56, 0.32, Math.PI * 2 - 0.64), 14, 0.09, 0.16, -0.135, 0.05), white, hips, 0, 0, -0.004);
  mesh(ruffle(lathe([[0.07, 0.165], [0.15, 0.04], [0.215, -0.08], [0.222, -0.11]], 56, 0.55, Math.PI * 2 - 1.1), 10, 0.11, 0.165, -0.11, 0.06), redDeep, hips, 0, 0, 0);
  [-1, 1].forEach((k) => mesh(new THREE.OctahedronGeometry(0.008), gold, hips, k * 0.03, 0.09, 0.075));

  // ---------- 上身 ----------
  const chest = grp(hips, 0, 0.13, 0);
  mesh(lathe([[0.058, 0], [0.062, 0.04], [0.068, 0.08], [0.06, 0.11], [0.03, 0.125]], 28), red, chest);
  for (let i = 0; i < 3; i++) mesh(new THREE.BoxGeometry(0.06, 0.006, 0.004), redDeep, chest, 0, 0.02 + i * 0.026, 0.064, { r: [0, 0, i % 2 ? 0.5 : -0.5] });
  mesh(new THREE.OctahedronGeometry(0.012), gold, chest, 0, 0.1, 0.06);
  // 肩膀（露肩）+ 脖子 + 领口蝴蝶结
  mesh(sph(0.04, 18, 12), skin, chest, 0, 0.11, 0, { s: [2.0, 0.7, 1.1] });
  mesh(new THREE.CylinderGeometry(0.02, 0.022, 0.05, 12), skin, chest, 0, 0.14, 0);
  bow(chest, 0, 0.135, 0.03, 1.1);
  // 斜挎包带 + 包
  mesh(new THREE.BoxGeometry(0.012, 0.25, 0.006), cream, chest, 0.005, 0.03, 0.068, { r: [0, 0, 0.72] });
  const bag = grp(hips, 0.168, 0.03, 0.04); bag.rotation.y = 0.5;
  mesh(new THREE.BoxGeometry(0.07, 0.06, 0.03), cream, bag);
  mesh(new THREE.BoxGeometry(0.072, 0.03, 0.033), cream, bag, 0, 0.018, 0.002);
  { const st = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 + Math.PI / 2, r = i % 2 ? 0.007 : 0.016; st[i ? "lineTo" : "moveTo"](Math.cos(a) * r, Math.sin(a) * r); } mesh(new THREE.ExtrudeGeometry(st, { depth: 0.004, bevelEnabled: false }), gold, bag, -0.012, -0.014, 0.018); }

  // ---------- 手臂 ----------
  const arms = [-1, 1].map((k) => {
    const arm = grp(chest, k * 0.078, 0.105, 0);
    mesh(new THREE.CylinderGeometry(0.018, 0.017, 0.06, 12), skin, arm, 0, -0.03, 0);
    mesh(sph(0.032, 16, 12), white, arm, 0, -0.085, 0, { s: [1, 1.35, 1] });
    mesh(new THREE.TorusGeometry(0.024, 0.008, 6, 16), red, arm, 0, -0.12, 0, { r: [Math.PI / 2, 0, 0] });
    for (let i = 0; i < 2; i++) mesh(new THREE.TorusGeometry(0.021, 0.004, 6, 16), red, arm, 0, -0.05 - i * 0.025, 0, { r: [Math.PI / 2 + 0.5 * (i ? 1 : -1), 0, 0] });
    const hand = grp(arm, 0, -0.14, 0);
    mesh(sph(0.02, 14, 10), skin, hand, 0, -0.008, 0);
    bow(arm, k * 0.005, -0.12, 0.022, 0.6);
    return { arm, hand };
  });

  // ---------- 头 ----------
  const headPivot = grp(chest, 0, 0.15, 0);
  const head = grp(headPivot, 0, 0.18, 0); // 头中心
  const HR = 0.2;
  mesh(sph(HR, 40, 28), skin, head).receiveShadow = false; // 脸不接头发的影子，保持干净
  const face = mesh(new THREE.SphereGeometry(HR * 1.006, 40, 24, Math.PI / 2 - 0.95, 1.9, 0.95, 1.3), faceMat, head, 0, 0, 0, { cast: false });
  // 头发：后脑大发团 + 顶部发包 + 刘海 + 鬓发
  mesh(sph(0.215, 40, 28), hair, head, 0, 0.022, -0.026, { s: [1.05, 0.98, 1] });
  mesh(sph(0.2, 32, 22), hair, head, 0, -0.1, -0.075, { s: [1.08, 1.05, 0.8] });
  function strand(len, w) { const g = lathe([[0.001, 0], [w * 0.8, -len * 0.15], [w, -len * 0.45], [w * 0.65, -len * 0.8], [0.001, -len]], 12); g.scale(1, 1, 0.45); return g; }
  // 刘海：宽而交叠的发片，画面左侧（绷带那边）更长
  const BANG = [[-0.16, 0.09, 0.2, 0.075, 0.5], [-0.11, 0.12, 0.22, 0.08, 0.32], [-0.05, 0.135, 0.19, 0.08, 0.15], [0.01, 0.135, 0.15, 0.075, 0.0], [0.065, 0.13, 0.11, 0.07, -0.18], [0.115, 0.115, 0.12, 0.065, -0.34], [0.16, 0.08, 0.14, 0.06, -0.5]];
  BANG.forEach(([x, y, len, w, rz]) => { const z = Math.sqrt(Math.max(0, 0.222 ** 2 - x * x - y * y)) - 0.03; const m = mesh(strand(len, w), hair, head, x, y, z, { r: [-0.3, 0, rz] }); m.castShadow = false; });
  [-1, 1].forEach((k) => {
    mesh(strand(0.2, 0.045), hairPink, head, k * 0.17, 0.02, 0.06, { r: [-0.08, 0, k * 0.12] });
    mesh(strand(0.18, 0.05), hair, head, k * 0.19, 0.0, -0.03, { r: [0.05, 0, k * 0.2] });
  });
  // 发卡
  mesh(new THREE.BoxGeometry(0.09, 0.035, 0.018), pink, head, 0.1, 0.17, 0.11, { r: [-0.6, 0.25, -0.5] });
  mesh(new THREE.BoxGeometry(0.03, 0.037, 0.02), M({ color: "#f8c7d4", roughness: 0.4 }), head, 0.1, 0.17, 0.112, { r: [-0.6, 0.25, -0.5] });
  // 耳坠
  [-1, 1].forEach((k) => mesh(sph(0.012, 10, 8), M({ color: "#d8203a", roughness: 0.15, metalness: 0.2 }), head, k * 0.195, -0.08, 0.03, { s: [1, 1.5, 1] }));
  // 泡泡双马尾：四节，节间金发环
  const tails = [-1, 1].map((k) => {
    const rootJ = grp(head, k * 0.17, -0.04, -0.07); rootJ.rotation.z = k * 0.12;
    let parent = rootJ; const joints = [rootJ];
    [0.068, 0.07, 0.066, 0.058].forEach((r, i) => {
      const j = i ? grp(parent, 0, -0.115, 0) : parent; if (i) joints.push(j);
      mesh(new THREE.TorusGeometry(0.03, 0.009, 8, 20), gold, j, 0, -0.012, 0, { r: [Math.PI / 2, 0, 0] });
      mesh(sph(r, 22, 16), hairPink, j, 0, -0.065, 0, { s: [1, 0.95, 1] });
      parent = j;
    });
    return joints;
  });

  // ---------- 小道具：奶茶杯、书 ----------
  const cup = grp(arms[1].hand, -0.01, -0.02, 0.02);
  mesh(new THREE.CylinderGeometry(0.024, 0.019, 0.07, 16), M({ color: "#f4d9c4", roughness: 0.3 }), cup);
  mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.006, 16), pink, cup, 0, 0.035, 0);
  mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.06, 6), M({ color: "#ff8fb0" }), cup, 0.008, 0.06, 0, { r: [0, 0, 0.2] });
  const book = grp(root, 0, 0.36, 0.13);
  mesh(new THREE.BoxGeometry(0.13, 0.1, 0.014), M({ color: "#b8435c", roughness: 0.6 }), book, -0.034, 0, 0, { r: [0, 0.35, 0] });
  mesh(new THREE.BoxGeometry(0.13, 0.1, 0.014), M({ color: "#b8435c", roughness: 0.6 }), book, 0.034, 0, 0, { r: [0, -0.35, 0] });
  mesh(new THREE.BoxGeometry(0.12, 0.092, 0.01), M({ color: "#fffaf0" }), book, -0.033, 0, 0.008, { r: [0, 0.35, 0] });
  mesh(new THREE.BoxGeometry(0.12, 0.092, 0.01), M({ color: "#fffaf0" }), book, 0.033, 0, 0.008, { r: [0, -0.35, 0] });
  book.rotation.x = -0.6;

  root.traverse((o) => { if (o.isMesh) o.userData.xb = true; });
  return { root, body, hips, chest, headPivot, head, legs, arms, tails, cup, book, faceMat, faces, mats };
}
