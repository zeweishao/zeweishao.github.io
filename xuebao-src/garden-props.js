/* 花园里几件精修的道具：奶茶推车 + 露天小茶座、星星邮筒、路灯、花藤秋千。
 * 全部程序生成：圆角盒子、车床（Lathe）轮廓、画布贴图，夜里会亮的部分交回 glowMats。
 */
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export function propKit(THREE, maxAniso = 8) {
  const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.6, ...o });
  const add = (geo, mat, x, y, z, o = {}) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (o.rx) m.rotation.x = o.rx; if (o.ry) m.rotation.y = o.ry; if (o.rz) m.rotation.z = o.rz; m.castShadow = o.cast !== false; m.receiveShadow = true; if (o.noHit) m.userData.noHit = true; o.parent.add(m); return m; };
  const rbox = (w, h, d, r, mat, x, y, z, o) => add(new RoundedBoxGeometry(w, h, d, 3, r), mat, x, y, z, o);
  const L = (pts, seg = 32) => new THREE.LatheGeometry(pts.map(([a, b]) => new THREE.Vector2(a, b)), seg);
  const canvasTex = (w, h, draw) => { const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = maxAniso; return t; };
  return { std, add, rbox, L, canvasTex };
}

// 五瓣小花（花瓣 + 花心合在一起，花心用顶点色）
export function blossomGeo(THREE) {
  const parts = [];
  for (let k = 0; k < 5; k++) { const g = new THREE.SphereGeometry(1, 8, 5); g.scale(0.5, 0.12, 0.34); g.translate(0.48, 0, 0); g.rotateZ(0.25); g.rotateY((k / 5) * Math.PI * 2); g.deleteAttribute("uv"); const c = new Float32Array(g.attributes.position.count * 3).fill(1); g.setAttribute("color", new THREE.BufferAttribute(c, 3)); parts.push(g); }
  const h = new THREE.SphereGeometry(0.26, 8, 6); h.translate(0, 0.08, 0); h.deleteAttribute("uv"); const hc = new Float32Array(h.attributes.position.count * 3); for (let i = 0; i < hc.length; i += 3) hc.set([1, 0.82, 0.35], i); h.setAttribute("color", new THREE.BufferAttribute(hc, 3)); parts.push(h);
  return mergeGeometries(parts);
}
export function leafGeo(THREE) { const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.quadraticCurveTo(0.5, 0.4, 0, 1); sh.quadraticCurveTo(-0.5, 0.4, 0, 0); return new THREE.ShapeGeometry(sh, 4); }

// ================= 奶茶推车 + 小茶座 =================
export function buildMilkTeaCart(THREE, g, { glowMats, anim, maxAniso }) {
  const { std, add, rbox, L, canvasTex } = propKit(THREE, maxAniso);
  const P = { parent: g };
  const mint = std({ color: "#bfe6d3", roughness: 0.45 }), mintD = std({ color: "#9fd4bd", roughness: 0.45 }), cream = std({ color: "#fff7ee", roughness: 0.4 });
  const gold = std({ color: "#e3bf76", metalness: 0.9, roughness: 0.28 }), wood = std({ color: "#c49368", roughness: 0.62 }), pink = std({ color: "#f6aec0", roughness: 0.5 });
  // 车身：圆角薄荷绿柜子，下沿一圈金边，前面两块嵌板
  rbox(0.96, 0.5, 0.52, 0.045, mint, 0, 0.47, 0, P);
  rbox(0.98, 0.04, 0.54, 0.015, gold, 0, 0.225, 0, P);
  [-0.24, 0.24].forEach((x) => { rbox(0.36, 0.3, 0.02, 0.01, mintD, x, 0.44, 0.262, P); rbox(0.37, 0.31, 0.012, 0.004, gold, x, 0.44, 0.256, { parent: g, cast: false }); });
  // 招牌：圆角木框里的奶油牌子，画一杯小奶茶
  const sign = canvasTex(512, 160, (c, w, h) => {
    c.fillStyle = "#fff8ef"; c.fillRect(0, 0, w, h);
    c.fillStyle = "#f6aec0"; for (let i = 0; i < 26; i++) { c.beginPath(); c.arc(i * 20 + 10, 0, 7, 0, Math.PI); c.fill(); c.beginPath(); c.arc(i * 20 + 10, h, 7, Math.PI, 0); c.fill(); }
    // 杯子小图标
    c.save(); c.translate(70, 82); c.fillStyle = "#e9c49a"; c.beginPath(); c.moveTo(-26, -26); c.lineTo(26, -26); c.lineTo(20, 40); c.lineTo(-20, 40); c.closePath(); c.fill();
    c.fillStyle = "#f6aec0"; c.beginPath(); c.ellipse(0, -28, 30, 9, 0, 0, 7); c.fill(); c.fillStyle = "#3b2a24"; for (let i = 0; i < 5; i++) { c.beginPath(); c.arc(-12 + i * 6, 30 - (i % 2) * 6, 4, 0, 7); c.fill(); }
    c.strokeStyle = "#f17d8e"; c.lineWidth = 7; c.lineCap = "round"; c.beginPath(); c.moveTo(6, -30); c.lineTo(18, -62); c.stroke(); c.restore();
    c.fillStyle = "#8a5a3c"; c.textAlign = "left"; c.textBaseline = "middle"; c.font = "800 56px 'PingFang SC', sans-serif"; c.fillText("能量补给站", 128, 70);
    c.fillStyle = "#e0889c"; c.font = "italic 600 28px Georgia, serif"; c.fillText("Milk Tea · for 雪雪 ♡", 132, 120);
  });
  rbox(0.7, 0.2, 0.03, 0.02, wood, 0, 0.62, 0.27, P);
  add(new THREE.PlaneGeometry(0.66, 0.18), std({ map: sign, roughness: 0.7 }), 0, 0.62, 0.287, { parent: g, cast: false });
  // 木台面 + 后面一根推把
  rbox(1.06, 0.045, 0.62, 0.018, wood, 0, 0.745, 0.01, P);
  add(new THREE.TorusGeometry(0.2, 0.014, 8, 24, Math.PI), gold, 0, 0.6, -0.3, { parent: g, rx: -Math.PI / 2 + 0.3 });
  // 大轮子：粉色轮圈 + 奶油辐条 + 金轮毂；前面一个小万向轮
  [-0.5, 0.5].forEach((x) => {
    const wh = new THREE.Group(); wh.position.set(x, 0.21, -0.02); wh.rotation.y = Math.PI / 2; g.add(wh);
    add(new THREE.TorusGeometry(0.19, 0.022, 10, 36), pink, 0, 0, 0, { parent: wh });
    add(new THREE.TorusGeometry(0.17, 0.008, 6, 36), cream, 0, 0, 0, { parent: wh, cast: false });
    for (let k = 0; k < 8; k++) add(new THREE.CylinderGeometry(0.006, 0.006, 0.34, 6), cream, 0, 0, 0, { parent: wh, rz: (k / 8) * Math.PI, cast: false });
    add(new THREE.CylinderGeometry(0.035, 0.035, 0.05, 16).rotateX(Math.PI / 2), gold, 0, 0, 0, { parent: wh });
  });
  add(new THREE.CylinderGeometry(0.012, 0.012, 0.16, 8), gold, 0, 0.14, 0.18, P);
  add(new THREE.SphereGeometry(0.05, 14, 10), cream, 0, 0.05, 0.18, P);
  // 遮阳篷：四根奶油细柱 + 拱形粉白条纹篷顶 + 花边垂片 + 一串小灯泡
  [[-0.47, -0.25], [0.47, -0.25], [-0.47, 0.25], [0.47, 0.25]].forEach(([x, z]) => { add(new THREE.CylinderGeometry(0.016, 0.016, 0.82, 10).translate(0, 0.41, 0), cream, x, 0.765, z, P); add(new THREE.SphereGeometry(0.024, 10, 8), gold, x, 1.59, z, P); });
  const stripes = canvasTex(512, 128, (c) => { for (let i = 0; i < 16; i++) { c.fillStyle = i % 2 ? "#fffaf3" : "#f6a9bd"; c.fillRect(i * 32, 0, 32, 128); } });
  stripes.wrapS = THREE.RepeatWrapping;
  const roof = new THREE.CylinderGeometry(0.62, 0.62, 1.16, 32, 1, true, Math.PI / 2 - 0.62, 1.24).rotateZ(Math.PI / 2);
  const awn = add(roof, std({ map: stripes, side: THREE.DoubleSide, roughness: 0.75 }), 0, 1.0, 0, P);
  const valGeo = new THREE.CircleGeometry(0.045, 14, Math.PI, Math.PI);
  const edgeY = 1.0 + 0.62 * Math.cos(0.62), edgeZ = 0.62 * Math.sin(0.62);
  const vPink = std({ color: "#f6a9bd", side: THREE.DoubleSide, roughness: 0.75 }), vWhite = std({ color: "#fffaf3", side: THREE.DoubleSide, roughness: 0.75 });
  const bulbM = std({ color: "#fff4d6", emissive: "#ffcf7a", emissiveIntensity: 0.3, roughness: 0.3 }); glowMats.push([bulbM, 0.3, 2.4]);
  for (const sz of [1, -1]) for (let i = 0; i < 13; i++) {
    const x = -0.54 + i * 0.09; add(valGeo, i % 2 ? vWhite : vPink, x, edgeY + 0.001, sz * edgeZ, { parent: g, cast: false });
    if (sz > 0 && i % 2 === 0) { add(new THREE.SphereGeometry(0.017, 10, 8), bulbM, x, edgeY - 0.07 - Math.sin((i / 12) * Math.PI) * 0.03, edgeZ + 0.005, { parent: g, cast: false }); }
  }
  // 篷顶上的大奶茶：透明杯、奶茶、珍珠、粉色拱盖、吸管、爱心杯标
  const cupG = new THREE.Group(); cupG.position.set(0, 1.66, 0); g.add(cupG);
  add(L([[0, 0], [0.12, 0], [0.16, 0.42], [0.168, 0.43], [0, 0.43]], 32), new THREE.MeshPhysicalMaterial({ color: "#ffffff", transparent: true, opacity: 0.4, roughness: 0.05, clearcoat: 1 }), 0, 0, 0, { parent: cupG });
  add(L([[0, 0.012], [0.113, 0.012], [0.146, 0.33], [0, 0.33]], 32), std({ color: "#dcae86", roughness: 0.35 }), 0, 0, 0, { parent: cupG, cast: false });
  add(L([[0, 0.3], [0.143, 0.3], [0.152, 0.39], [0, 0.39]], 32), std({ color: "#fff3e6", roughness: 0.4 }), 0, 0, 0, { parent: cupG, cast: false }); // 奶盖
  for (let i = 0; i < 16; i++) add(new THREE.SphereGeometry(0.021, 10, 8), std({ color: "#3b2a24", roughness: 0.25 }), Math.cos(i * 2.4) * (0.03 + (i % 3) * 0.025), 0.035 + Math.floor(i / 6) * 0.03, Math.sin(i * 2.4) * (0.03 + (i % 3) * 0.025), { parent: cupG, cast: false });
  add(new THREE.SphereGeometry(0.17, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), std({ color: "#ffd1dc", transparent: true, opacity: 0.75, roughness: 0.15 }), 0, 0.43, 0, { parent: cupG }).scale.y = 0.45;
  add(new THREE.CylinderGeometry(0.016, 0.016, 0.42, 10), std({ color: "#f17d8e", roughness: 0.4 }), 0.04, 0.62, 0, { parent: cupG, rz: -0.18 });
  const heartTex = canvasTex(128, 128, (c) => { c.fillStyle = "#fff"; c.beginPath(); c.arc(64, 64, 58, 0, 7); c.fill(); c.fillStyle = "#f17d8e"; c.beginPath(); c.moveTo(64, 98); c.bezierCurveTo(10, 62, 34, 22, 64, 48); c.bezierCurveTo(94, 22, 118, 62, 64, 98); c.fill(); });
  add(new THREE.CircleGeometry(0.06, 24), std({ map: heartTex, transparent: true, roughness: 0.5 }), 0, 0.2, 0.142, { parent: cupG, rx: -0.09, cast: false });
  anim.push((t) => { cupG.rotation.y = Math.sin(t * 0.8) * 0.45; cupG.position.y = 1.66 + Math.sin(t * 1.6) * 0.025; });
  // 台面上：两桶茶（玻璃 + 琥珀色茶 + 金龙头）、一摞杯子、三杯做好的奶茶、珍珠罐、蛋糕罩、小花盆
  const glass = new THREE.MeshPhysicalMaterial({ color: "#ffffff", transparent: true, opacity: 0.35, roughness: 0.05 });
  [[-0.38, -0.12, "#c98a55"], [-0.24, -0.15, "#9fbf6a"]].forEach(([x, z, tea]) => {
    add(new THREE.CylinderGeometry(0.055, 0.055, 0.2, 20), glass, x, 0.87, z, P);
    add(new THREE.CylinderGeometry(0.05, 0.05, 0.14, 20), std({ color: tea, roughness: 0.25 }), x, 0.84, z, { parent: g, cast: false });
    add(new THREE.CylinderGeometry(0.058, 0.058, 0.02, 20), gold, x, 0.98, z, P);
    add(new THREE.BoxGeometry(0.012, 0.012, 0.04), gold, x, 0.8, z + 0.06, { parent: g, cast: false });
  });
  for (let i = 0; i < 4; i++) add(L([[0, 0], [0.028, 0], [0.036, 0.06], [0, 0.06]], 16), std({ color: "#fffaf3", roughness: 0.4 }), -0.08, 0.77 + i * 0.014, -0.16, P);
  [[0.08, 0.12, "#dcae86", "#f17d8e"], [0.2, 0.15, "#f2b6c4", "#ffffff"], [0.32, 0.1, "#b9d58a", "#f6c66a"]].forEach(([x, z, tea, straw]) => {
    const c = new THREE.Group(); c.position.set(x, 0.768, z); g.add(c);
    add(L([[0, 0], [0.026, 0], [0.034, 0.09], [0, 0.09]], 16), glass, 0, 0, 0, { parent: c });
    add(L([[0, 0.004], [0.024, 0.004], [0.03, 0.075], [0, 0.075]], 16), std({ color: tea, roughness: 0.3 }), 0, 0, 0, { parent: c, cast: false });
    add(new THREE.SphereGeometry(0.035, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), glass, 0, 0.09, 0, { parent: c, cast: false }).scale.y = 0.5;
    add(new THREE.CylinderGeometry(0.0045, 0.0045, 0.11, 6), std({ color: straw }), 0.008, 0.13, 0, { parent: c, rz: -0.15, cast: false });
  });
  add(new THREE.CylinderGeometry(0.035, 0.035, 0.08, 16), glass, 0.42, 0.81, -0.14, P);
  for (let i = 0; i < 7; i++) add(new THREE.SphereGeometry(0.011, 8, 6), std({ color: "#3b2a24", roughness: 0.25 }), 0.42 + Math.cos(i * 2.4) * 0.018, 0.78 + (i % 3) * 0.012, -0.14 + Math.sin(i * 2.4) * 0.018, { parent: g, cast: false });
  add(new THREE.CylinderGeometry(0.038, 0.038, 0.012, 16), gold, 0.42, 0.856, -0.14, P);
  // 蛋糕罩
  add(new THREE.CylinderGeometry(0.075, 0.06, 0.012, 24), cream, 0.08, 0.775, -0.12, P);
  add(new THREE.CylinderGeometry(0.045, 0.045, 0.04, 24), std({ color: "#ffd7e0", roughness: 0.6 }), 0.08, 0.8, -0.12, P);
  add(new THREE.SphereGeometry(0.012, 10, 8), std({ color: "#e3405e", roughness: 0.3 }), 0.08, 0.83, -0.12, { parent: g, cast: false });
  add(new THREE.SphereGeometry(0.07, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), glass, 0.08, 0.78, -0.12, { parent: g, cast: false });
  // 小花盆
  add(L([[0, 0], [0.03, 0], [0.04, 0.05], [0, 0.05]], 16), std({ color: "#e9a07e", roughness: 0.8 }), 0.46, 0.768, 0.18, P);
  const bg = blossomGeo(THREE), fm = std({ vertexColors: true, roughness: 0.6 });
  for (let i = 0; i < 4; i++) { const m = add(bg, fm, 0.46 + Math.cos(i * 1.6) * 0.02, 0.83 + (i % 2) * 0.012, 0.18 + Math.sin(i * 1.6) * 0.02, { parent: g, cast: false }); m.scale.setScalar(0.02); m.material = fm; }

  // 露天小茶座：大理石小圆桌 + 两把粉色铁艺小椅 + 条纹阳伞
  const cafe = new THREE.Group(); cafe.position.set(1.05, 0, 0.55); g.add(cafe); const C = { parent: cafe };
  const marble = std({ color: "#f7f2ec", roughness: 0.25 }), iron = std({ color: "#f3c3cf", roughness: 0.45, metalness: 0.2 });
  add(L([[0, 0], [0.14, 0], [0.12, 0.02], [0.025, 0.05], [0.018, 0.62], [0, 0.62]], 24), gold, 0, 0, 0, C);
  add(new THREE.CylinderGeometry(0.28, 0.28, 0.03, 36), marble, 0, 0.63, 0, C);
  add(new THREE.TorusGeometry(0.28, 0.008, 6, 48), gold, 0, 0.63, 0, { parent: cafe, rx: Math.PI / 2, cast: false });
  [[0.08, 0.04, "#dcae86"], [-0.09, -0.05, "#f2b6c4"]].forEach(([x, z, tea]) => { add(L([[0, 0], [0.026, 0], [0.034, 0.09], [0, 0.09]], 16), glass, x, 0.645, z, C); add(L([[0, 0.004], [0.024, 0.004], [0.03, 0.07], [0, 0.07]], 16), std({ color: tea }), x, 0.645, z, { parent: cafe, cast: false }); add(new THREE.CylinderGeometry(0.0045, 0.0045, 0.12, 6), std({ color: "#f17d8e" }), x + 0.008, 0.76, z, { parent: cafe, rz: -0.15, cast: false }); });
  add(new THREE.CylinderGeometry(0.06, 0.06, 0.008, 20), cream, 0, 0.65, -0.12, C);
  [["#f6a9bd", 0], ["#bfe3d0", 1], ["#f9d86b", 2]].forEach(([c0, i]) => add(new THREE.CylinderGeometry(0.018, 0.018, 0.018, 14), std({ color: c0 }), Math.cos(i * 2.1) * 0.03, 0.664, -0.12 + Math.sin(i * 2.1) * 0.03, { parent: cafe, cast: false }));
  [0.9, 0.9 + Math.PI].forEach((a) => {
    const ch = new THREE.Group(); ch.position.set(Math.cos(a) * 0.45, 0, Math.sin(a) * 0.45); ch.rotation.y = -a - Math.PI / 2; cafe.add(ch); const H = { parent: ch };
    add(new THREE.CylinderGeometry(0.15, 0.15, 0.03, 28), iron, 0, 0.42, 0, H);
    add(new THREE.CylinderGeometry(0.13, 0.13, 0.04, 28), std({ color: "#fff4f6", roughness: 0.9 }), 0, 0.455, 0, H);
    for (let k = 0; k < 4; k++) { const b = (k / 4) * Math.PI * 2 + Math.PI / 4; add(new THREE.CylinderGeometry(0.01, 0.008, 0.42, 6).translate(0, 0.21, 0), iron, Math.cos(b) * 0.11, 0, Math.sin(b) * 0.11, { parent: ch, rz: Math.cos(b) * 0.08, rx: -Math.sin(b) * 0.08 }); }
    const back = new THREE.Group(); back.position.set(0, 0.44, -0.13); back.rotation.x = -0.12; ch.add(back);
    add(new THREE.TorusGeometry(0.13, 0.011, 8, 28, Math.PI), iron, 0, 0.16, 0, { parent: back });
    [-0.13, 0.13].forEach((x) => add(new THREE.CylinderGeometry(0.011, 0.011, 0.16, 6).translate(0, 0.08, 0), iron, x, 0, 0, { parent: back }));
    const hs = new THREE.Shape(); hs.moveTo(0, -0.05); hs.bezierCurveTo(-0.09, 0.01, -0.04, 0.07, 0, 0.03); hs.bezierCurveTo(0.04, 0.07, 0.09, 0.01, 0, -0.05);
    add(new THREE.ShapeGeometry(hs), std({ color: "#f3c3cf", side: THREE.DoubleSide, metalness: 0.2, roughness: 0.45 }), 0, 0.17, 0, { parent: back, cast: false });
  });
  add(new THREE.CylinderGeometry(0.012, 0.012, 1.5, 8).translate(0, 0.75, 0), cream, 0, 0.64, 0, C);
  const umb = canvasTex(512, 64, (c) => { for (let i = 0; i < 16; i++) { c.fillStyle = i % 2 ? "#fffaf3" : "#bfe3d0"; c.fillRect(i * 32, 0, 32, 64); } });
  add(new THREE.ConeGeometry(0.72, 0.26, 16, 1, true), std({ map: umb, side: THREE.DoubleSide, roughness: 0.8 }), 0, 2.02, 0, C);
  for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; add(valGeo, i % 2 ? vWhite : std({ color: "#bfe3d0", side: THREE.DoubleSide }), Math.cos(a) * 0.72, 1.89, Math.sin(a) * 0.72, { parent: cafe, ry: -a + Math.PI / 2, cast: false }); }
  add(new THREE.SphereGeometry(0.03, 12, 10), gold, 0, 2.17, 0, C);
  return { cafe };
}

// ================= 星星邮筒 =================
export function buildStarPostbox(THREE, g, { glowMats, maxAniso }) {
  const { std, add, rbox, L, canvasTex } = propKit(THREE, maxAniso);
  const P = { parent: g };
  const navy = std({ color: "#34477a", roughness: 0.38, metalness: 0.15 }), gold = std({ color: "#e3bf76", metalness: 0.9, roughness: 0.28 }), navyD = std({ color: "#28375f", roughness: 0.4 });
  // 底座：石头圆台 + 一圈小花
  add(L([[0, 0], [0.2, 0], [0.2, 0.05], [0.16, 0.07], [0, 0.07]], 28), std({ color: "#e6ddd2", roughness: 0.8 }), 0, 0, 0, P);
  const bg = blossomGeo(THREE), fm = std({ vertexColors: true, roughness: 0.6 }), lg = leafGeo(THREE), lm = std({ color: "#7aa35a", side: THREE.DoubleSide });
  for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2, r = 0.23 + (i % 2) * 0.04; const f = add(bg, fm, Math.cos(a) * r, 0.06 + (i % 3) * 0.02, Math.sin(a) * r, { parent: g, cast: false }); f.scale.setScalar(0.028); f.material = std({ vertexColors: true, color: ["#f7b4c4", "#ffffff", "#c7a6e6", "#f9d86b"][i % 4] }); const l = add(lg, lm, Math.cos(a) * r, 0.02, Math.sin(a) * r, { parent: g, cast: false, rx: -0.8, ry: -a }); l.scale.setScalar(0.06); }
  // 柱子：车床轮廓，底下喇叭口、中间两道金箍
  add(L([[0.075, 0.07], [0.05, 0.12], [0.038, 0.2], [0.036, 1.02], [0.06, 1.05], [0, 1.05]], 20), navy, 0, 0, 0, P);
  [0.3, 0.95].forEach((y) => add(new THREE.TorusGeometry(0.039, 0.007, 6, 20), gold, 0, y, 0, { parent: g, rx: Math.PI / 2, cast: false }));
  // 箱体：圆角 + 半圆拱顶 + 金边
  rbox(0.38, 0.32, 0.28, 0.03, navy, 0, 1.2, 0, P);
  const dome = add(new THREE.CylinderGeometry(0.19, 0.19, 0.28, 28, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateY(Math.PI / 2), navy, 0, 1.36, 0, P);
  dome.rotation.y = Math.PI / 2; dome.rotation.y = 0;
  [-0.14, 0.14].forEach((z) => add(new THREE.TorusGeometry(0.19, 0.009, 6, 28, Math.PI), gold, 0, 1.36, z, { parent: g, cast: false }));
  rbox(0.4, 0.03, 0.3, 0.012, gold, 0, 1.04, 0, P);
  // 投信口：金框 + 一封露出半截的粉信封
  rbox(0.22, 0.045, 0.02, 0.01, gold, 0, 1.3, 0.142, P);
  add(new THREE.BoxGeometry(0.18, 0.014, 0.02), navyD, 0, 1.3, 0.148, { parent: g, cast: false });
  const env = canvasTex(128, 80, (c, w, h) => { c.fillStyle = "#fde3e6"; c.fillRect(0, 0, w, h); c.strokeStyle = "#f0a5b5"; c.lineWidth = 4; c.beginPath(); c.moveTo(0, 0); c.lineTo(w / 2, h * 0.6); c.lineTo(w, 0); c.stroke(); c.fillStyle = "#c8344c"; c.beginPath(); c.arc(w / 2, h * 0.6, 9, 0, 7); c.fill(); });
  add(new THREE.PlaneGeometry(0.12, 0.075), std({ map: env, side: THREE.DoubleSide }), 0.01, 1.335, 0.15, { parent: g, rz: 0.12, cast: false });
  // 小门：门缝、合页、金把手、门牌
  rbox(0.3, 0.17, 0.012, 0.01, navyD, 0, 1.14, 0.141, { parent: g, cast: false });
  rbox(0.29, 0.16, 0.01, 0.01, navy, 0, 1.14, 0.145, { parent: g, cast: false });
  add(new THREE.SphereGeometry(0.012, 10, 8), gold, 0.11, 1.14, 0.153, { parent: g, cast: false });
  [1.19, 1.09].forEach((y) => add(new THREE.CylinderGeometry(0.006, 0.006, 0.025, 8), gold, -0.148, y, 0.148, { parent: g, cast: false }));
  const plate = canvasTex(256, 96, (c, w, h) => { c.fillStyle = "#f4dfb0"; c.fillRect(0, 0, w, h); c.strokeStyle = "#b98a46"; c.lineWidth = 6; c.strokeRect(4, 4, w - 8, h - 8); c.fillStyle = "#34477a"; c.font = "700 34px Georgia, serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("STAR POST", w / 2, 40); c.font = "600 22px 'PingFang SC', sans-serif"; c.fillText("星星邮差 ✦", w / 2, 72); });
  add(new THREE.PlaneGeometry(0.2, 0.075), std({ map: plate, metalness: 0.3, roughness: 0.4 }), 0, 1.14, 0.152, { parent: g, cast: false });
  // 两侧小星星
  const st = new THREE.Shape(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.045 : 0.11, a = (i / 10) * Math.PI * 2 + Math.PI / 2; i ? st.lineTo(Math.cos(a) * r, Math.sin(a) * r) : st.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  const starM = std({ color: "#ffd86b", emissive: "#ffc23a", emissiveIntensity: 0.5, metalness: 0.4, roughness: 0.3 }); glowMats.push([starM, 0.5, 1.8]);
  [-1, 1].forEach((k) => { const s = add(new THREE.ShapeGeometry(st), starM, k * 0.191, 1.2, 0, { parent: g, ry: k * Math.PI / 2, cast: false }); s.scale.setScalar(0.45); });
  return { st, starM };
}

// ================= 路灯：欧式灯柱 + 六角玻璃灯笼 + 底下一小圈花 =================
export function buildLampPost(THREE, root, x, y, z, lm, { post, glass, gold, bloom, bloomMat, leaf, leafMat }) {
  const g = new THREE.Group(); g.position.set(x, y, z); root.add(g);
  const add = (geo, mat, px, py, pz, o = {}) => { const m = new THREE.Mesh(geo, mat); m.position.set(px, py, pz); if (o.rx) m.rotation.x = o.rx; if (o.ry) m.rotation.y = o.ry; m.castShadow = o.cast !== false; m.receiveShadow = true; g.add(m); return m; };
  const L = (pts, seg = 16) => new THREE.LatheGeometry(pts.map(([a, b]) => new THREE.Vector2(a, b)), seg);
  add(L([[0, 0], [0.07, 0], [0.07, 0.04], [0.05, 0.06], [0.04, 0.12], [0.026, 0.16], [0.02, 0.8], [0.03, 0.82], [0.03, 0.85], [0.045, 0.88], [0, 0.88]]), post, 0, 0, 0);
  add(new THREE.TorusGeometry(0.022, 0.006, 6, 14), gold, 0, 0.5, 0, { rx: Math.PI / 2, cast: false });
  // 灯笼：底座、六根金细框、玻璃、里面的发光芯、顶盖、顶上小球
  add(L([[0, 0], [0.065, 0], [0.075, 0.015], [0, 0.015]], 6), post, 0, 0.88, 0);
  add(new THREE.CylinderGeometry(0.068, 0.058, 0.15, 6, 1, true), glass, 0, 0.97, 0, { cast: false });
  add(new THREE.CylinderGeometry(0.03, 0.03, 0.08, 10), lm, 0, 0.96, 0, { cast: false });
  for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; add(new THREE.CylinderGeometry(0.004, 0.004, 0.155, 4), post, Math.cos(a) * 0.064, 0.97, Math.sin(a) * 0.064, { cast: false }); }
  add(new THREE.ConeGeometry(0.095, 0.08, 6), post, 0, 1.085, 0);
  add(new THREE.CylinderGeometry(0.075, 0.075, 0.012, 6), gold, 0, 1.048, 0, { cast: false });
  add(new THREE.SphereGeometry(0.016, 10, 8), gold, 0, 1.14, 0, { cast: false });
  // 灯柱上挂的小花篮
  add(new THREE.SphereGeometry(0.045, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), std(THREE, "#c89a62"), 0.07, 0.72, 0);
  for (let i = 0; i < 5; i++) { const f = add(bloom, bloomMat[i % bloomMat.length], 0.07 + Math.cos(i * 1.3) * 0.03, 0.73 + (i % 2) * 0.01, Math.sin(i * 1.3) * 0.03, { cast: false }); f.scale.setScalar(0.018); }
  // 底下一小圈花
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + 0.3, r = 0.11 + (i % 2) * 0.03; const f = add(bloom, bloomMat[i % bloomMat.length], Math.cos(a) * r, 0.06 + (i % 3) * 0.015, Math.sin(a) * r, { cast: false }); f.scale.setScalar(0.022); const l = add(leaf, leafMat, Math.cos(a) * r, 0.01, Math.sin(a) * r, { rx: -0.8, ry: -a, cast: false }); l.scale.setScalar(0.05); }
  return g;
}
function std(THREE, color) { return new THREE.MeshStandardMaterial({ color, roughness: 0.85 }); }

// ================= 花藤秋千 =================
export function buildFlowerSwing(THREE, swing, { mobile }) {
  const add = (geo, mat, x, y, z, o = {}) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (o.rx) m.rotation.x = o.rx; if (o.ry) m.rotation.y = o.ry; if (o.rz) m.rotation.z = o.rz; m.castShadow = o.cast !== false; m.receiveShadow = true; swing.add(m); return m; };
  const tex = (() => { const c = document.createElement("canvas"); c.width = 32; c.height = 128; const g = c.getContext("2d"); g.fillStyle = "#e3cfae"; g.fillRect(0, 0, 32, 128); g.strokeStyle = "#b89a72"; g.lineWidth = 5; for (let i = -4; i < 12; i++) { g.beginPath(); g.moveTo(0, i * 14); g.lineTo(32, i * 14 + 16); g.stroke(); } const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 14); return t; })();
  const rope = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 });
  [-0.24, 0.24].forEach((x) => { add(new THREE.CylinderGeometry(0.014, 0.014, 2.12, 8).translate(0, -1.06, 0), rope, x, 0, 0); add(new THREE.TorusGeometry(0.03, 0.01, 6, 14), rope, x, -2.1, 0, { ry: Math.PI / 2 }); });
  // 座板：两块圆角木板 + 粉色坐垫 + 一个小蝴蝶结
  const wood = new THREE.MeshStandardMaterial({ color: "#c08f68", roughness: 0.6 });
  [-0.055, 0.055].forEach((z) => add(new RoundedBoxGeometry(0.62, 0.035, 0.1, 2, 0.012), wood, 0, -2.16, z));
  add(new RoundedBoxGeometry(0.5, 0.035, 0.19, 3, 0.016), new THREE.MeshStandardMaterial({ color: "#f7c9d4", roughness: 0.95 }), 0, -2.125, 0);
  const bowM = new THREE.MeshStandardMaterial({ color: "#f08fa6", roughness: 0.6 });
  [-1, 1].forEach((k) => { const b = add(new THREE.SphereGeometry(0.03, 10, 8), bowM, k * 0.035 + 0.24, -1.9, 0.016, { cast: false }); b.scale.set(1, 0.6, 0.4); b.rotation.z = k * 0.5; });
  add(new THREE.SphereGeometry(0.012, 8, 6), bowM, 0.24, -1.9, 0.02, { cast: false });
  // 花藤：沿两根绳子螺旋缠一圈叶子和小花
  const bg = blossomGeo(THREE), lg = leafGeo(THREE);
  const n = mobile ? 26 : 40, flowers = new THREE.InstancedMesh(bg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }), n * 2), leaves = new THREE.InstancedMesh(lg, new THREE.MeshStandardMaterial({ color: "#78a35c", side: THREE.DoubleSide, roughness: 0.8 }), n * 2 * 2);
  const o = new THREE.Object3D(), c = new THREE.Color(); let nf = 0, nl = 0; const FL = ["#f6b9c8", "#fff4f6", "#f2a3b6", "#ffe2a8"];
  [-0.24, 0.24].forEach((x) => { for (let i = 0; i < n; i++) { const t = i / n, a = i * 1.9, y = -0.15 - t * 1.85; const r = 0.022;
    o.position.set(x + Math.cos(a) * r, y, Math.sin(a) * r); o.rotation.set(Math.PI / 2 - 0.4, 0, a); const s = 0.022 + (i % 3) * 0.006; o.scale.setScalar(s); o.updateMatrix(); flowers.setMatrixAt(nf, o.matrix); flowers.setColorAt(nf++, c.set(FL[i % FL.length]));
    for (let k = 0; k < 2; k++) { o.position.set(x + Math.cos(a + 1.5 + k * 2) * r, y - 0.02 - k * 0.02, Math.sin(a + 1.5 + k * 2) * r); o.rotation.set(0.3, a + k * 2.5, -1.2 + k * 0.5); o.scale.setScalar(0.045); o.updateMatrix(); leaves.setMatrixAt(nl++, o.matrix); } } });
  flowers.castShadow = leaves.castShadow = true; swing.add(flowers, leaves);
}
