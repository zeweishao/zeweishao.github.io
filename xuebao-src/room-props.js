import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { LAND } from "./globe-land.js";

export function buildRoomProps(THREE) {
  const material = (color, roughness = 0.65, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const gold = material("#c9a26b", 0.35, 0.64);
  const walnut = material("#9d6145"), rose = material("#c38683");
  const paper = material("#fff1d8"), porcelain = material("#f4c1bb", 0.26);
  const dark = material("#4a3e32", 0.86), pale = material("#eee0bc");
  const ink = material("#998277");
  function piece(g, geo, mat, x, y, z) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; g.add(m);
    return m;
  }
  function box(g, w, h, d, r, mat, x, y, z) {
    return piece(g, new RoundedBoxGeometry(w, h, d, 2, r), mat, x, y, z);
  }
  function dial(g, r, d, mat, x, y, z) {
    return piece(g, new THREE.CylinderGeometry(r, r, d, 18).rotateX(Math.PI / 2), mat, x, y, z);
  }
  function radio() {
    const g = new THREE.Group(); g.name = "radioModel";
    box(g, 0.255, 0.146, 0.132, 0.018, walnut, 0, 0.081, 0);
    box(g, 0.225, 0.112, 0.014, 0.008, pale, 0, 0.083, 0.068);
    box(g, 0.104, 0.078, 0.006, 0.004, dark, -0.048, 0.082, 0.077);
    for (let i = 0; i < 7; i++) {
      box(g, 0.092, 0.0038, 0.003, 0.001, gold, -0.048, 0.055 + i * 0.009, 0.081);
    }
    box(g, 0.071, 0.026, 0.008, 0.004, dark, 0.061, 0.108, 0.078);
    box(g, 0.059, 0.003, 0.002, 0.001, gold, 0.061, 0.107, 0.084);
    box(g, 0.003, 0.014, 0.002, 0.001, rose, 0.073, 0.11, 0.086);
    dial(g, 0.015, 0.012, gold, 0.045, 0.062, 0.084);
    dial(g, 0.009, 0.012, walnut, 0.081, 0.062, 0.084);
    for (const x of [-0.088, 0.088]) box(g, 0.031, 0.012, 0.092, 0.003, dark, x, 0.006, 0);
    return g;
  }
  function cardbox() {
    const g = new THREE.Group(); g.name = "postcardBoxModel";
    box(g, 0.208, 0.024, 0.115, 0.005, walnut, 0, 0.013, 0);
    box(g, 0.209, 0.087, 0.015, 0.005, rose, 0, 0.053, 0.05);
    box(g, 0.209, 0.109, 0.014, 0.004, walnut, 0, 0.061, -0.05);
    for (const side of [-1, 1]) {
      box(g, 0.014, 0.089, 0.109, 0.005, walnut, 0.099 * side, 0.053, 0);
      dial(g, 0.007, 0.004, gold, 0.084 * side, 0.04, 0.061);
    }
    for (let i = 0; i < 4; i++) {
      const card = box(g, 0.146, 0.092, 0.004, 0.0018, i % 2 ? paper : pale, 0.012 * Math.sin(i), 0.093 + i * 0.011, 0.021 - i * 0.018);
      card.rotation.set(-0.15, 0, (i - 1) * 0.066);
    }
    box(g, 0.066, 0.026, 0.005, 0.002, gold, 0, 0.055, 0.061);
    box(g, 0.048, 0.015, 0.003, 0.001, paper, 0, 0.055, 0.065);
    return g;
  }
  function table(g, z) {
    const set = new THREE.Group(); set.name = "teaTableDetails"; set.position.set(0, 0.305, z); g.add(set);
    const cup = new THREE.Group(); cup.position.set(0.164, 0, -0.17); set.add(cup);
    const lathe = (points) => new THREE.LatheGeometry(points.map(([x,y]) => new THREE.Vector2(x,y)), 28);
    piece(cup, lathe([[0,0],[0.053,0],[0.069,0.01],[0.067,0.017],[0.024,0.013],[0,0.013]]), porcelain, 0, 0, 0);
    piece(cup, lathe([[0,0],[0.027,0],[0.034,0.03],[0.041,0.079],[0.035,0.079],[0.033,0.052],[0.023,0.018],[0,0.018]]), porcelain, 0, 0.013, 0);
    piece(cup, new THREE.TorusGeometry(0.021, 0.0048, 7, 18), porcelain, 0.035, 0.06, 0);
    piece(cup, new THREE.CircleGeometry(0.034, 24).rotateX(-Math.PI / 2), material("#be875e", 0.34), 0, 0.081, 0);

    const book = new THREE.Group(); book.position.set(-0.105, 0.003, 0.147); book.rotation.y = -0.25; set.add(book);
    box(book, 0.175, 0.009, 0.113, 0.003, rose, 0, 0.005, 0);
    for (const side of [-1, 1]) {
      const page = new THREE.Group(); page.position.set(side * 0.04, 0.012 + (side > 0 ? 0.004 : 0), 0);
      page.rotation.z = side === 1 ? 0.16 : -0.04; book.add(page);
      box(page, 0.08, 0.01, 0.104, 0.002, paper, 0, 0, 0);
      for (let i = 0; i < 5; i++) box(page, 0.05 - (i % 2) * 0.008, 0.0013, 0.0023, 0.0004, ink, 0, 0.0055, -0.036 + i * 0.014);
    }
    const postcard = new THREE.Group(); postcard.position.set(0.13, 0.004, 0.079); postcard.rotation.y = -0.45; set.add(postcard);
    box(postcard, 0.081, 0.004, 0.054, 0.001, paper, 0, 0, 0);
    box(postcard, 0.022, 0.0015, 0.019, 0.0005, rose, 0.023, 0.0023, -0.013);
    for (let i = 0; i < 3; i++) box(postcard, 0.034, 0.0015, 0.0017, 0.0004, ink, -0.014, 0.0023, -0.01 + i * 0.008);
  }
  // 门口的小信箱：真的立体模型（以前是一张会转向镜头的图，拉视角会变扁）
  function mailbox() {
    const g = new THREE.Group(); g.name = "mailboxModel";
    const red = material("#c95a52", 0.5), redDeep = material("#a9443f", 0.55), leaf = material("#6f9a4e", 0.7), leafDark = material("#557f3d", 0.75);
    const post = material("#8a5a3c", 0.85), petal = material("#fff2ee", 0.6), heartM = material("#f2c14e", 0.4, 0.3);
    // 木柱 + 底座
    piece(g, new THREE.CylinderGeometry(0.03, 0.034, 0.27, 12), post, 0, 0.135, 0);
    piece(g, new THREE.CylinderGeometry(0.07, 0.078, 0.022, 20), post, 0, 0.011, 0);
    box(g, 0.1, 0.02, 0.1, 0.006, post, 0, 0.262, 0);
    // 箱体：下面方、上面拱顶
    const W = 0.27, Dp = 0.2, y0 = 0.27, bodyH = 0.13, R = W / 2;
    box(g, W, bodyH, Dp, 0.014, red, 0, y0 + bodyH / 2, 0);
    const arch = piece(g, new THREE.CylinderGeometry(R, R, Dp, 32, 1, false, Math.PI / 2, Math.PI).rotateX(Math.PI / 2), red, 0, y0 + bodyH, 0);
    arch.scale.set(1, 0.82, 1);
    // 拱顶前后的金边
    for (const z of [Dp / 2 + 0.002, -Dp / 2 - 0.002]) {
      const rim = piece(g, new THREE.TorusGeometry(R - 0.004, 0.0065, 6, 32, Math.PI), gold, 0, y0 + bodyH, z); rim.scale.set(1, 0.82, 1);
    }
    box(g, W + 0.012, 0.016, Dp + 0.012, 0.006, redDeep, 0, y0 + 0.008, 0);
    // 前面的小门、投信口、信封、门环、合页
    box(g, 0.2, 0.105, 0.012, 0.01, redDeep, 0, y0 + 0.062, Dp / 2 + 0.004);
    box(g, 0.15, 0.024, 0.014, 0.008, dark, 0, y0 + bodyH + 0.038, Dp / 2 + 0.002);
    const env = box(g, 0.11, 0.07, 0.004, 0.002, paper, 0.008, y0 + bodyH + 0.055, Dp / 2 - 0.004); env.rotation.set(-0.35, 0, 0.12);
    piece(g, new THREE.TorusGeometry(0.022, 0.005, 8, 24), gold, 0, y0 + 0.045, Dp / 2 + 0.014);
    piece(g, new THREE.SphereGeometry(0.01, 12, 8), gold, 0, y0 + 0.07, Dp / 2 + 0.013);
    for (const y of [y0 + 0.03, y0 + 0.095]) box(g, 0.028, 0.016, 0.008, 0.003, gold, -0.105, y, Dp / 2 + 0.008);
    // 侧面小爱心
    const hs = new THREE.Shape(); hs.moveTo(0, -0.02); hs.bezierCurveTo(0.03, 0.002, 0.016, 0.026, 0, 0.012); hs.bezierCurveTo(-0.016, 0.026, -0.03, 0.002, 0, -0.02);
    const heart = piece(g, new THREE.ExtrudeGeometry(hs, { depth: 0.004, bevelEnabled: false }), heartM, -W / 2 - 0.002, y0 + 0.075, 0); heart.rotation.y = -Math.PI / 2;
    // 顶上的金星星
    const ss = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 0.017 : 0.04; i ? ss.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ss.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
    const star = piece(g, new THREE.ExtrudeGeometry(ss, { depth: 0.014, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.004, bevelSegments: 2 }), gold, 0, y0 + bodyH + R * 0.82 + 0.034, -0.007);
    star.userData.spin = true;
    // 右边的小旗子（旗杆 + 金球 + 旗面）
    piece(g, new THREE.CylinderGeometry(0.005, 0.005, 0.22, 8), gold, W / 2 + 0.012, y0 + 0.17, 0.03);
    piece(g, new THREE.SphereGeometry(0.011, 12, 8), gold, W / 2 + 0.012, y0 + 0.285, 0.03);
    piece(g, new THREE.CylinderGeometry(0.008, 0.008, 0.02, 10).rotateZ(Math.PI / 2), gold, W / 2 + 0.003, y0 + 0.07, 0.03);
    const fs = new THREE.Shape(); fs.moveTo(0, 0); fs.lineTo(0.085, 0.004); fs.lineTo(0.066, -0.024); fs.lineTo(0.085, -0.05); fs.lineTo(0, -0.046);
    const flag = piece(g, new THREE.ExtrudeGeometry(fs, { depth: 0.004, bevelEnabled: false }), heartM, W / 2 + 0.016, y0 + 0.275, 0.028); flag.rotation.y = -0.5;
    // 柱子上的常春藤和一朵小花
    const lg = new THREE.SphereGeometry(1, 10, 6); lg.scale(0.022, 0.006, 0.014);
    for (let i = 0; i < 11; i++) {
      const t = i / 10, a = i * 2.2, y = 0.03 + t * 0.22, r = 0.04;
      const l = piece(g, lg, i % 3 ? leaf : leafDark, Math.cos(a) * r, y, Math.sin(a) * r);
      l.rotation.set(0.6 * Math.sin(i), -a, 0.5 + 0.3 * Math.cos(i * 1.7));
    }
    const fl = new THREE.Group(); fl.position.set(0.042, 0.09, 0.03); fl.rotation.set(0.3, 0.4, -0.2); g.add(fl);
    const pg = new THREE.SphereGeometry(1, 10, 6); pg.scale(0.013, 0.004, 0.008); pg.translate(0.012, 0, 0);
    for (let k = 0; k < 5; k++) { const m = piece(fl, pg, petal, 0, 0, 0); m.rotation.y = (k / 5) * Math.PI * 2; }
    piece(fl, new THREE.SphereGeometry(0.006, 10, 8), heartM, 0, 0.003, 0);
    return g;
  }
  const ell = (g, mat, sx, sy, sz, x, y, z, seg = 24) => { const m = piece(g, new THREE.SphereGeometry(1, seg, Math.round(seg * 0.7)), mat, x, y, z); m.scale.set(sx, sy, sz); return m; };
  const flower = (g, x, y, z, ry, size, petalColor, centerColor = "#f2c14e") => {
    const f = new THREE.Group(); f.position.set(x, y, z); f.rotation.y = ry; g.add(f);
    const pm = material(petalColor, 0.5), cm = material(centerColor, 0.45);
    const pg = new THREE.SphereGeometry(1, 10, 6); pg.scale(size, size * 0.62, size * 0.25); pg.translate(size * 0.9, 0, 0);
    for (let k = 0; k < 5; k++) { const m = piece(f, pg, pm, 0, 0, 0); m.rotation.z = (k / 5) * Math.PI * 2; }
    piece(f, new THREE.SphereGeometry(size * 0.45, 10, 8), cm, 0, 0, size * 0.15);
    return f;
  };
  // 粉色陶瓷小猪存钱罐
  function piggy() {
    const g = new THREE.Group(); g.name = "piggyModel";
    const pink = new THREE.MeshPhysicalMaterial({ color: "#f5c6bc", roughness: 0.28, clearcoat: 0.6, clearcoatRoughness: 0.25 });
    const pinkDeep = material("#eaa79b", 0.35), blush = material("#f08f8f", 0.5), ink = material("#3a2b2b", 0.3), white = material("#ffffff", 0.2);
    const red = material("#d9423f", 0.45), leaf = material("#7ea25b", 0.6);
    ell(g, pink, 0.12, 0.1, 0.14, 0, 0.115, 0, 32);
    for (const [x, z] of [[-0.06, 0.07], [0.06, 0.07], [-0.06, -0.07], [0.06, -0.07]]) piece(g, new THREE.CylinderGeometry(0.026, 0.03, 0.05, 16), pink, x, 0.025, z);
    // 鼻子
    const sn = piece(g, new THREE.CylinderGeometry(0.042, 0.046, 0.04, 24).rotateX(Math.PI / 2), pinkDeep, 0, 0.11, 0.14); sn.scale.set(1, 0.8, 1);
    for (const x of [-0.015, 0.015]) ell(g, material("#b8665c", 0.5), 0.008, 0.012, 0.004, x, 0.11, 0.161, 10);
    // 眼睛、高光、腮红
    for (const x of [-0.05, 0.05]) { ell(g, ink, 0.011, 0.014, 0.008, x, 0.15, 0.125, 12); ell(g, white, 0.0035, 0.0035, 0.003, x + 0.004, 0.155, 0.132, 8); ell(g, blush, 0.022, 0.013, 0.006, x * 1.5, 0.11, 0.115, 12).rotation.y = x * 8; }
    // 耳朵
    for (const sx of [-1, 1]) {
      const e = piece(g, new THREE.ConeGeometry(0.034, 0.06, 20, 1, true), pink, 0.06 * sx, 0.2, 0.06); e.rotation.set(0.35, 0, -0.45 * sx); e.scale.set(1, 1, 0.45);
      const ie = piece(g, new THREE.ConeGeometry(0.022, 0.04, 16), pinkDeep, 0.06 * sx, 0.198, 0.067); ie.rotation.set(0.35, 0, -0.45 * sx); ie.scale.set(1, 1, 0.3);
    }
    // 投币口 + 一枚露出的金币
    box(g, 0.06, 0.012, 0.014, 0.005, ink, 0, 0.212, -0.01);
    piece(g, new THREE.CylinderGeometry(0.02, 0.02, 0.005, 24).rotateX(Math.PI / 2), gold, 0, 0.222, -0.01);
    // 小卷尾巴
    const tail = piece(g, new THREE.TorusGeometry(0.014, 0.004, 8, 20, Math.PI * 1.6), pinkDeep, 0, 0.13, -0.142); tail.rotation.y = Math.PI / 2;
    // 脖子上的红蝴蝶结 + 金铃铛
    for (const sx of [-1, 1]) { const b = ell(g, red, 0.026, 0.016, 0.01, 0.026 * sx, 0.07, 0.125, 14); b.rotation.z = 0.35 * sx; }
    ell(g, red, 0.011, 0.011, 0.01, 0, 0.07, 0.128, 12);
    piece(g, new THREE.SphereGeometry(0.013, 16, 12), gold, 0, 0.052, 0.13);
    // 身侧的小花和叶子
    for (const sx of [-1, 1]) {
      flower(g, 0.11 * sx, 0.14, -0.02, sx > 0 ? Math.PI / 2 : -Math.PI / 2, 0.011, "#fff4f0").rotation.x = 0.1;
      flower(g, 0.1 * sx, 0.11, -0.065, sx > 0 ? Math.PI / 2 - 0.4 : -Math.PI / 2 + 0.4, 0.009, "#f6907d");
      for (let i = 0; i < 4; i++) { const l = ell(g, leaf, 0.014, 0.006, 0.003, (0.118 - i * 0.002) * sx, 0.09 + i * 0.018, 0.02 - i * 0.025, 8); l.rotation.set(0, sx * Math.PI / 2, 0.8 * (i % 2 ? 1 : -1)); }
    }
    return g;
  }
  // 装着紫色水晶碎片的玻璃罐
  function jar() {
    const g = new THREE.Group(); g.name = "shardJarModel";
    const prof = [[0, 0], [0.058, 0], [0.068, 0.012], [0.07, 0.11], [0.062, 0.135], [0.042, 0.148], [0.04, 0.165], [0.044, 0.172]].map(([x, y]) => new THREE.Vector2(x, y));
    const glass = new THREE.MeshPhysicalMaterial({ color: "#eef6ff", roughness: 0.05, metalness: 0, transparent: true, opacity: 0.28, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false });
    const jarM = piece(g, new THREE.LatheGeometry(prof, 36), glass, 0, 0, 0); jarM.castShadow = false; jarM.renderOrder = 3;
    // 软木塞
    piece(g, new THREE.CylinderGeometry(0.041, 0.037, 0.035, 24), material("#c9995e", 0.9), 0, 0.182, 0);
    piece(g, new THREE.CylinderGeometry(0.043, 0.043, 0.006, 24), material("#b8854d", 0.9), 0, 0.2, 0);
    // 水晶：六棱柱 + 尖顶
    const cry = [material("#b79cf0", 0.15), material("#9c84e6", 0.15), material("#d3b8ff", 0.15)];
    cry.forEach((m) => { m.emissive = new THREE.Color("#6d4fc4"); m.emissiveIntensity = 0.25; m.metalness = 0.1; });
    const cg = new THREE.CylinderGeometry(1, 1, 1, 6).translate(0, 0.5, 0), tg = new THREE.ConeGeometry(1, 0.6, 6).translate(0, 1.3, 0);
    [[0, 0.012, 0, 0.018, 0.07, 0], [-0.03, 0.01, 0.015, 0.014, 0.05, 0.35], [0.03, 0.01, -0.01, 0.015, 0.055, -0.3], [0.012, 0.01, 0.035, 0.012, 0.04, 0.5], [-0.02, 0.01, -0.032, 0.013, 0.045, -0.45], [0.04, 0.01, 0.025, 0.01, 0.032, 0.7]].forEach(([x, y, z, r, h, tilt], i) => {
      const c = new THREE.Group(); c.position.set(x, y, z); c.rotation.set(tilt * 0.6, i, tilt); c.scale.set(r, h, r); g.add(c);
      piece(c, cg, cry[i % 3], 0, 0, 0); piece(c, tg, cry[(i + 1) % 3], 0, 0, 0);
    });
    // 瓶颈的红缎带、蝴蝶结、金星星吊坠
    const red = material("#d9423f", 0.45);
    piece(g, new THREE.TorusGeometry(0.042, 0.006, 8, 32).rotateX(Math.PI / 2), red, 0, 0.158, 0);
    for (const sx of [-1, 1]) { const b = ell(g, red, 0.022, 0.014, 0.007, 0.022 * sx, 0.162, 0.046, 14); b.rotation.z = 0.4 * sx; const t = box(g, 0.01, 0.04, 0.003, 0.002, red, 0.012 * sx, 0.135, 0.046); t.rotation.z = 0.3 * sx; }
    ell(g, red, 0.009, 0.009, 0.008, 0, 0.162, 0.048, 12);
    const ss = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 0.006 : 0.014; i ? ss.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ss.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
    piece(g, new THREE.ExtrudeGeometry(ss, { depth: 0.004, bevelEnabled: true, bevelSize: 0.0015, bevelThickness: 0.0015, bevelSegments: 1 }), gold, 0.004, 0.118, 0.07);
    return g;
  }
  // 地球仪：真实陆地轮廓画在球面上，会慢慢转
  function globeTex() {
    const c = document.createElement("canvas"); c.width = 1024; c.height = 512; const x = c.getContext("2d"), k = 1024 / 720;
    const sea = x.createLinearGradient(0, 0, 0, 512); sea.addColorStop(0, "#8fb3cf"); sea.addColorStop(0.5, "#7aa3c4"); sea.addColorStop(1, "#8fb3cf");
    x.fillStyle = sea; x.fillRect(0, 0, 1024, 512);
    x.strokeStyle = "rgba(255,255,255,.28)"; x.lineWidth = 1;
    for (let i = 1; i < 12; i++) { x.beginPath(); x.moveTo(i * 1024 / 12, 0); x.lineTo(i * 1024 / 12, 512); x.stroke(); }
    for (let i = 1; i < 6; i++) { x.beginPath(); x.moveTo(0, i * 512 / 6); x.lineTo(1024, i * 512 / 6); x.stroke(); }
    x.fillStyle = "#ead9ab"; x.strokeStyle = "#b99a64"; x.lineWidth = 1.6; x.lineJoin = "round";
    LAND.split(";").forEach((r) => { const v = r.split(",").map(Number); x.beginPath(); for (let i = 0; i < v.length; i += 2) (i ? x.lineTo : x.moveTo).call(x, v[i] * k, v[i + 1] * k); x.closePath(); x.fill(); x.stroke(); });
    x.fillStyle = "rgba(120,150,90,.22)"; // 陆地上淡淡的绿意
    LAND.split(";").forEach((r) => { const v = r.split(",").map(Number); if (v.length < 40) return; x.save(); x.beginPath(); for (let i = 0; i < v.length; i += 2) (i ? x.lineTo : x.moveTo).call(x, v[i] * k, v[i + 1] * k); x.clip(); x.fillRect(0, 140, 1024, 220); x.restore(); });
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
  }
  function globe() {
    const g = new THREE.Group(); g.name = "globeModel";
    const wood = material("#8e5a3b", 0.5), woodDark = material("#6e4229", 0.55);
    piece(g, new THREE.CylinderGeometry(0.095, 0.11, 0.025, 40), woodDark, 0, 0.0125, 0);
    piece(g, new THREE.CylinderGeometry(0.075, 0.09, 0.022, 40), wood, 0, 0.036, 0);
    piece(g, new THREE.TorusGeometry(0.1, 0.004, 8, 40).rotateX(Math.PI / 2), gold, 0, 0.025, 0);
    piece(g, new THREE.LatheGeometry([[0, 0], [0.026, 0], [0.018, 0.02], [0.012, 0.06], [0.016, 0.09], [0.01, 0.1], [0, 0.1]].map(([a, b]) => new THREE.Vector2(a, b)), 24), gold, 0, 0.046, 0);
    const R = 0.13, cy = 0.146 + 0.13 + 0.012;
    const tilt = new THREE.Group(); tilt.position.set(0, cy, 0); tilt.rotation.z = 0.41; g.add(tilt);
    const ball = piece(tilt, new THREE.SphereGeometry(R, 64, 40), new THREE.MeshPhysicalMaterial({ map: globeTex(), roughness: 0.45, clearcoat: 0.5, clearcoatRoughness: 0.3 }), 0, 0, 0);
    // 半圈子午线金环 + 两头的小轴
    const mer = piece(tilt, new THREE.TorusGeometry(R + 0.02, 0.0075, 12, 64, Math.PI * 1.15), gold, 0, 0, 0); mer.rotation.set(0, Math.PI / 2, -Math.PI * 0.075 - Math.PI / 2);
    for (const sy of [-1, 1]) { piece(tilt, new THREE.CylinderGeometry(0.004, 0.004, 0.024, 8), gold, 0, (R + 0.008) * sy, 0); piece(tilt, new THREE.SphereGeometry(0.011, 12, 8), gold, 0, (R + 0.021) * sy, 0); }
    g.userData.spin = ball;
    return g;
  }
  // 雪宝留的纸条：对折的小卡片，粉色虚线边、角上两朵小花
  function noteTex() {
    const c = document.createElement("canvas"); c.width = 256; c.height = 192; const x = c.getContext("2d");
    x.fillStyle = "#fbefd9"; x.fillRect(0, 0, 256, 192);
    x.strokeStyle = "#e59aa8"; x.lineWidth = 4; x.setLineDash([12, 8]); x.strokeRect(16, 16, 224, 160); x.setLineDash([]);
    const fl = (cx, cy) => { x.fillStyle = "#fff"; for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; x.beginPath(); x.ellipse(cx + Math.cos(a) * 9, cy + Math.sin(a) * 9, 8, 6, a, 0, 7); x.fill(); } x.fillStyle = "#f2c14e"; x.beginPath(); x.arc(cx, cy, 5, 0, 7); x.fill();
      x.fillStyle = "#7ea25b"; x.beginPath(); x.ellipse(cx + 18, cy + 8, 10, 4, 0.6, 0, 7); x.fill(); x.beginPath(); x.ellipse(cx - 14, cy + 14, 9, 4, -0.8, 0, 7); x.fill(); };
    fl(212, 40); fl(44, 150);
    x.fillStyle = "#b46b78"; x.font = "600 30px 'PingFang SC', sans-serif"; x.textAlign = "center"; x.fillText("给雪雪 ♡", 128, 108);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
  }
  function note() {
    const g = new THREE.Group(); g.name = "noteModel";
    const face = material("#fbefd9", 0.85); face.map = noteTex(); const back = material("#f3e3c4", 0.9);
    const W = 0.15, H = 0.11, lean = 0.32;
    // 两片对折：朝前那片（往 +z 倒）印着字和花
    for (const side of [1, -1]) {
      const p = new THREE.Group(); p.position.set(0, H * Math.cos(lean), 0); p.rotation.x = -side * lean; g.add(p);
      piece(p, new THREE.BoxGeometry(W, H, 0.0025).translate(0, -H / 2, 0), side > 0 ? [back, back, back, back, face, back] : back, 0, 0, 0);
    }
    piece(g, new THREE.CylinderGeometry(0.0022, 0.0022, W, 8).rotateZ(Math.PI / 2), back, 0, H * Math.cos(lean), 0); // 折痕
    return g;
  }
  return { radio, cardbox, table, mailbox, piggy, jar, globe, note };
}
