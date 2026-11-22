import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

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
  return { radio, cardbox, table, mailbox };
}
