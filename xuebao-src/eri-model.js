/* 小绘梨衣：雪雪喜欢的绘梨衣，做成 Q 版小巫女。程序化小人，拆成“底身 + 槽位 + 锚点”三层，给以后的衣柜换装留好位置。
 * 设定图：交付/雪宝游记/小绘梨衣设定_v1/A2_鸭子顶头_扶鸭.png（默认造型：巫女服、鸭子坐头顶、抬手摸樱花发簪）。
 *
 * 结构（换装就靠这三层）：
 *  - 底身（不换）：头、脸（红紫色眼睛、腮红）、皮肤、手脚；关节 torso / neck / head / hip / knee / sh / el / hand。
 *  - 槽位 SLOTS：hair 发型、top 上衣、bottom 下装、shoes 鞋袜、outer 外套。每个槽位同时只穿一件。
 *      wear(slot, id) 换一件（id 为 "" 就是脱掉）；dress({...}) 一次换一整套；outfit() 读出当前搭配（存档用）。
 *  - 锚点 SOCKETS：headTop 头顶、hairPin 发饰、handL / handR 手上、back 背后、waist 腰间、shoulder 肩头。
 *      attach(socket, id) 挂东西，id 为 "" 取下。
 *  - 衣服和饰品都登记在 ITEMS：{ slot 或 socket, name, build(ctx) }。build 只往指定关节上加零件（ctx.add("torso", …)），
 *    所以衣服天然跟着姿势一起动；脱掉时这些零件整批拿走。新衣服 = 往 ITEMS 里加一条，不用动底身。
 *  - 冲突：衣服可以写 covers: ["headTop"]（比如帽子），穿上时原来头顶的东西挪到它自己的 fallback 锚点（小鸭去肩头），脱掉再回来。
 *  - 层级约定：长发帘挂在躯干背后、比外套大一圈（外套 build 时尺寸控制在半径 0.13 以内）；宽袖套在手臂外面。
 *  - 以后换精模：保持关节和锚点名字不变，衣柜、存档格式都不用改。
 * 尺寸：总高约 0.93（加上头顶小鸭约 1.05），脚底在原点，面朝 +z。她自己的左手在 +x。
 */
export const ERI_DEFAULT = { hair: "long", top: "miko", bottom: "hakama", shoes: "geta", outer: "", headTop: "duck", hairPin: "sakura", handL: "", handR: "", back: "", waist: "", shoulder: "" };
export const ERI_SLOTS = ["hair", "top", "bottom", "shoes", "outer"];
export const ERI_SOCKETS = ["headTop", "hairPin", "handL", "handR", "back", "waist", "shoulder"];

export function buildEri(THREE) {
  const root = new THREE.Group(); root.name = "小绘梨衣";
  const body = new THREE.Group(); root.add(body);
  const mats = {};
  const M = (color, o = {}) => { const k = color + JSON.stringify(o); return mats[k] || (mats[k] = new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...o })); };
  const S = (d = 18) => new THREE.SphereGeometry(1, d, Math.round(d * 0.7));
  const cap = (r, l) => new THREE.CapsuleGeometry(r, l, 6, 12);
  const J = (parent, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
  const mk = (parent, geo, mat, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  };
  const canvasTex = (w, h, draw) => { const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
  const skin = M("#ffe7da", { roughness: 0.55 });

  // ================= 底身（不换） =================
  const legs = [-1, 1].map((k) => {
    const hip = J(body, k * 0.055, 0.32, 0);
    mk(hip, cap(0.042, 0.08), skin, 0, -0.07, 0);
    const knee = J(hip, 0, -0.15, 0);
    mk(knee, cap(0.037, 0.08), skin, 0, -0.065, 0);
    mk(knee, S(10), skin, 0, -0.145, 0.012, 0.035, 0.022, 0.05); // 光脚（鞋袜槽位会盖住）
    return { hip, knee };
  });
  const torso = J(body, 0, 0.33, 0);
  mk(torso, cap(0.085, 0.08), skin, 0, 0.09, 0, 1, 1, 0.8);
  mk(torso, cap(0.028, 0.02), skin, 0, 0.2, 0);
  const arms = [-1, 1].map((k) => {
    const sh = J(torso, k * 0.1, 0.165, 0);
    mk(sh, cap(0.028, 0.06), skin, 0, -0.05, 0);
    const el = J(sh, 0, -0.1, 0);
    mk(el, cap(0.025, 0.05), skin, 0, -0.04, 0);
    const hand = J(el, 0, -0.085, 0);
    mk(hand, S(12), skin, 0, -0.005, 0, 0.03, 0.034, 0.026);
    mk(hand, S(8), skin, k * -0.022, 0.006, 0.012, 0.01, 0.018, 0.01); // 大拇指
    return { sh, el, hand };
  });
  const neck = J(torso, 0, 0.21, 0), head = J(neck, 0, 0.165, 0.005);
  mk(head, S(28), skin, 0, 0, 0, 0.2, 0.185, 0.18);
  [-1, 1].forEach((k) => mk(head, S(10), skin, k * 0.193, -0.02, 0, 0.022, 0.032, 0.018));
  // 脸：画在贴着脸的球面片上。红紫色大眼睛（上深下亮）、长睫毛、小小的笑、腮红
  const faceTex = canvasTex(512, 384, (g) => {
    const eye = (cx, flip) => {
      g.save(); g.translate(cx, 218); g.scale(1.22, 1.18);
      g.fillStyle = "#fffaf6"; g.beginPath(); g.ellipse(0, 4, 46, 58, 0, 0, 7); g.fill();
      const iris = g.createLinearGradient(0, -50, 0, 50); iris.addColorStop(0, "#5a1838"); iris.addColorStop(0.4, "#b02a55"); iris.addColorStop(0.8, "#e8566a"); iris.addColorStop(1, "#ff9a7e");
      g.fillStyle = iris; g.beginPath(); g.ellipse(0, 8, 41, 54, 0, 0, 7); g.fill();
      g.fillStyle = "#3a0c26"; g.beginPath(); g.ellipse(0, 6, 15, 22, 0, 0, 7); g.fill();
      g.fillStyle = "rgba(255,255,255,.96)"; g.beginPath(); g.ellipse(-15, -20, 13, 17, -0.3, 0, 7); g.fill();
      g.beginPath(); g.arc(14, 24, 5, 0, 7); g.fill();
      g.fillStyle = "rgba(255,200,220,.55)"; g.beginPath(); g.ellipse(6, 32, 16, 7, 0, 0, 7); g.fill();
      g.strokeStyle = "#2a0d16"; g.lineCap = "round"; g.lineWidth = 10; g.beginPath(); g.moveTo(-50, -14); g.quadraticCurveTo(0, -84, 50, -14); g.stroke(); // 上睫毛线：贴着眼白上沿的圆拱
      g.lineWidth = 5; g.beginPath(); g.moveTo(flip * 48, -16); g.quadraticCurveTo(flip * 58, -20, flip * 64, -32); g.stroke(); // 眼尾一根小睫毛
      g.lineWidth = 3; g.strokeStyle = "#5a2030"; g.beginPath(); g.moveTo(-28, 62); g.quadraticCurveTo(0, 68, 26, 62); g.stroke();
      g.restore();
    };
    eye(162, -1); eye(350, 1);
    g.strokeStyle = "#8a3a3c"; g.lineWidth = 4; g.lineCap = "round"; g.beginPath(); g.moveTo(240, 316); g.quadraticCurveTo(256, 326, 272, 316); g.stroke(); // 嘴：小小的笑
    [146, 366].forEach((x) => {
      const r = g.createRadialGradient(x, 300, 0, x, 300, 38); r.addColorStop(0, "rgba(255,120,140,.42)"); r.addColorStop(1, "rgba(255,120,140,0)");
      g.fillStyle = r; g.beginPath(); g.ellipse(x, 300, 40, 18, 0, 0, 7); g.fill();
      g.strokeStyle = "rgba(230,90,110,.45)"; g.lineWidth = 2.5; for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(x + i * 12 - 4, 306); g.lineTo(x + i * 12 + 4, 294); g.stroke(); }
    });
  });
  const faceMat = new THREE.MeshStandardMaterial({ map: faceTex, transparent: true, roughness: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const face = mk(head, new THREE.SphereGeometry(1, 32, 20, Math.PI / 2 - 0.75, 1.5, Math.PI / 2 - 0.62, 1.18), faceMat, 0, 0, 0, 0.202, 0.187, 0.182);
  face.castShadow = false; face.renderOrder = 2;
  const joints = { body, torso, neck, head, hipL: legs[1].hip, hipR: legs[0].hip, kneeL: legs[1].knee, kneeR: legs[0].knee, shL: arms[1].sh, shR: arms[0].sh, elL: arms[1].el, elR: arms[0].el, handL: arms[1].hand, handR: arms[0].hand };

  // ================= 锚点 =================
  const sockets = {
    headTop: J(head, 0, 0.212, -0.01),
    hairPin: J(head, 0.17, 0.05, 0.075),
    handL: J(arms[1].hand, 0, -0.03, 0.012),
    handR: J(arms[0].hand, 0, -0.03, 0.012),
    back: J(torso, 0, 0.12, -0.14),
    waist: J(torso, 0.1, 0.0, 0.07),
    shoulder: J(torso, -0.13, 0.215, 0.0)
  };
  sockets.hairPin.rotation.set(0.1, 0.3, -0.55);

  // ================= 衣柜里的东西 =================
  const white = M("#fbf8f4", { roughness: 0.7 }), red = M("#d42a3c", { roughness: 0.6 }), redDeep = M("#b81d30", { roughness: 0.62 });
  const hairM = M("#951d30", { roughness: 0.42 }), hairHi = M("#b83242", { roughness: 0.38 }), hairD = M("#7a1426", { roughness: 0.48 });
  const DS = (mat) => { const k = mat.uuid + "ds"; return mats[k] || (mats[k] = Object.assign(mat.clone(), { side: THREE.DoubleSide })); };
  // 一个红白相间的小发带 / 绳结
  const ribbon = (ctx, j, x, y, z, s = 1, ry = 0) => {
    const g = ctx.group(j, x, y, z); g.rotation.y = ry; g.scale.setScalar(s);
    ctx.mk(g, new THREE.CylinderGeometry(0.03, 0.03, 0.012, 14), red, 0, 0.008, 0); ctx.mk(g, new THREE.CylinderGeometry(0.0305, 0.0305, 0.008, 14), white, 0, -0.003, 0);
    [-1, 1].forEach((k) => { const l = ctx.mk(g, new THREE.TorusGeometry(0.018, 0.007, 6, 14), white, k * 0.03, 0.0, 0.02); l.rotation.y = k * 0.6; l.scale.set(1.2, 0.8, 1); });
    return g;
  };
  // 樱花纹红袴的贴图（下摆一圈白线 + 白色小樱花 + 褶子明暗）
  const hakamaTex = canvasTex(1024, 256, (g, w, h) => {
    const bg = g.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, "#c81f33"); bg.addColorStop(1, "#dc3044"); g.fillStyle = bg; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 16; i++) { g.fillStyle = "rgba(90,0,20,.12)"; g.fillRect(i * 64 + 48, 0, 16, h); } // 褶子暗面
    g.fillStyle = "#fff"; g.fillRect(0, h - 26, w, 5);
    const flower = (x, y, r) => { g.save(); g.translate(x, y); g.fillStyle = "#ffe9ee"; for (let i = 0; i < 5; i++) { g.rotate((Math.PI * 2) / 5); g.beginPath(); g.ellipse(0, -r * 0.62, r * 0.42, r * 0.6, 0, 0, 7); g.fill(); } g.fillStyle = "#f29ab0"; g.beginPath(); g.arc(0, 0, r * 0.22, 0, 7); g.fill(); g.restore(); };
    for (let i = 0; i < 12; i++) { flower(i * 85 + 30, h - 70 - (i % 3) * 22, 16 + (i % 2) * 6); flower(i * 85 + 70, h - 46, 8); }
  });
  hakamaTex.wrapS = THREE.RepeatWrapping;
  const hakamaMat = new THREE.MeshStandardMaterial({ map: hakamaTex, roughness: 0.62, side: THREE.DoubleSide });

  const ITEMS = {
    // ---------- 发型 ----------
    long: { slot: "hair", name: "及腰长发", build(ctx) {
      // 头顶和后脑：一层比头大一圈的球壳；前面是齐刘海（球壳切在眼睛上沿）
      ctx.mk("head", S(26), hairM, 0, 0.012, -0.04, 0.212, 0.2, 0.18);
      ctx.mk("head", new THREE.SphereGeometry(1, 28, 12, 0, Math.PI * 2, 0, 1.12), hairM, 0, 0.02, 0, 0.214, 0.208, 0.2);
      { // 齐刘海：前额一块球壳，下沿最后一圈顶点按锯齿往下拉一点，像一缕一缕剪齐的发尖
        const W = 30, Hs = 8, phi0 = Math.PI / 2 - 1.0, phiL = 2.0, th0 = 0.35, thL = 1.03;
        const g = new THREE.SphereGeometry(1, W, Hs, phi0, phiL, th0, thL), p = g.attributes.position;
        for (let ix = 0; ix <= W; ix++) {
          const vi = Hs * (W + 1) + ix, ph = phi0 + (ix / W) * phiL, th = th0 + thL + (ix % 2 ? 0.1 : 0.0) + 0.03 * Math.sin(ix * 1.7);
          p.setXYZ(vi, -Math.cos(ph) * Math.sin(th), Math.cos(th), Math.sin(ph) * Math.sin(th));
        }
        g.computeVertexNormals();
        ctx.mk("head", g, DS(hairM), 0, 0.006, 0.006, 0.214, 0.2, 0.204);
      }
      // 头顶的“天使环”高光
      ctx.mk("head", new THREE.SphereGeometry(1, 30, 2, Math.PI / 2 - 1.3, 2.6, 0.5, 0.12), DS(hairHi), 0, 0.02, 0, 0.218, 0.212, 0.205);
      // 脸两侧垂下来的鬓发
      [-1, 1].forEach((k) => { const m = ctx.mk("head", new THREE.ConeGeometry(0.045, 0.3, 8).translate(0, -0.15, 0), hairM, k * 0.175, 0.04, 0.06); m.rotation.set(0.08, 0, k * 0.1); m.scale.z = 0.45; });
      // 长发帘：挂在躯干背后，从后脑垂到小腿，下面散开；顶点加一点起伏当发丝
      const curtain = new THREE.CylinderGeometry(0.17, 0.27, 0.6, 30, 6, true, Math.PI - 1.95, 3.9);
      const p = curtain.attributes.position;
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(x, z), d = 1 + 0.035 * Math.sin(a * 11) * (0.5 - y / 0.6); p.setX(i, x * d); p.setZ(i, z * d); }
      curtain.computeVertexNormals();
      ctx.mk("torso", curtain, DS(hairM), 0, 0.12, -0.03);
      ctx.mk("torso", new THREE.CylinderGeometry(0.168, 0.265, 0.58, 30, 1, true, Math.PI - 0.6, 1.2), DS(hairHi), 0, 0.12, -0.034); // 背后一道高光
      // 两侧发尾用红白发带松松扎住，往外散开
      [-1, 1].forEach((k) => {
        ribbon(ctx, "torso", k * 0.235, -0.11, -0.02, 0.85, k * 0.4);
        const tuft = ctx.mk("torso", new THREE.ConeGeometry(0.05, 0.13, 8).translate(0, -0.065, 0), hairD, k * 0.24, -0.12, -0.02); tuft.rotation.z = k * 0.25; tuft.scale.z = 0.6;
        const up = ctx.mk("torso", new THREE.CylinderGeometry(0.03, 0.045, 0.24, 8), hairM, k * 0.21, 0.02, -0.03); up.rotation.z = -k * 0.25; up.scale.z = 0.6;
      });
    } },
    // ---------- 上衣：巫女白衣（宽袖、红色衬领、胸前红绳结） ----------
    miko: { slot: "top", name: "巫女白衣", build(ctx) {
      ctx.mk("torso", cap(0.093, 0.085), white, 0, 0.095, 0, 1, 1, 0.84);
      [-1, 1].forEach((k) => { // 交领：里面一道红衬领，外面白领子
        const r = ctx.mk("torso", new THREE.BoxGeometry(0.022, 0.13, 0.012), red, k * 0.024, 0.15, 0.077); r.rotation.z = k * 0.55;
        const w = ctx.mk("torso", new THREE.BoxGeometry(0.03, 0.15, 0.014), white, k * 0.036, 0.14, 0.081); w.rotation.z = k * 0.55;
      });
      ctx.mk("torso", new THREE.TorusGeometry(0.013, 0.004, 6, 14), red, 0.035, 0.1, 0.086); // 胸前小绳结
      ctx.mk("torso", new THREE.CylinderGeometry(0.003, 0.003, 0.04), red, 0.035, 0.075, 0.087);
      ["shL", "shR"].forEach((j) => { ctx.mk(j, S(), white, 0, 0, 0, 0.045, 0.042, 0.045); ctx.mk(j, cap(0.036, 0.06), white, 0, -0.05, 0); });
      ["elL", "elR"].forEach((j, i) => { // 宽袖：套在小臂外面的大袖筒，袖口一圈红边，挂一个红绳结
        const k = i ? -1 : 1;
        ctx.mk(j, new THREE.CylinderGeometry(0.046, 0.072, 0.11, 16, 1, true), DS(white), 0, -0.035, -0.006, 1, 1, 1.3);
        ctx.mk(j, new THREE.CylinderGeometry(0.0735, 0.0735, 0.012, 16, 1, true), DS(red), 0, -0.088, -0.006, 1, 1, 1.3);
        ctx.mk(j, new THREE.TorusGeometry(0.012, 0.004, 6, 12), red, k * 0.07, -0.03, 0);
        ctx.mk(j, new THREE.CylinderGeometry(0.006, 0.01, 0.035, 6), red, k * 0.072, -0.06, 0);
      });
    } },
    // ---------- 下装：樱花绯袴（腰上白绳蝴蝶结 + 流苏） ----------
    hakama: { slot: "bottom", name: "樱花绯袴", build(ctx) {
      const prof = [[0.205, -0.235], [0.19, -0.17], [0.15, -0.08], [0.112, -0.01], [0.097, 0.03]].map(([r, y]) => new THREE.Vector2(r, y));
      const g = new THREE.LatheGeometry(prof, 48); const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), y = p.getY(i), a = Math.atan2(x, z), d = 1 + 0.04 * Math.cos(a * 16) * Math.min(1, (0.03 - y) / 0.2); p.setX(i, x * d); p.setZ(i, z * d); }
      g.computeVertexNormals();
      ctx.mk("torso", g, hakamaMat, 0, 0, 0, 1, 1, 0.9);
      ctx.mk("torso", new THREE.CylinderGeometry(0.1, 0.1, 0.04, 22), redDeep, 0, 0.02, 0, 1, 1, 0.88); // 腰带
      ctx.mk("torso", new THREE.CylinderGeometry(0.102, 0.102, 0.008, 22), white, 0, 0.026, 0, 1, 1, 0.88);
      const bow = ctx.group("torso", 0, 0.0, 0.092);
      [-1, 1].forEach((k) => { const l = ctx.mk(bow, new THREE.TorusGeometry(0.014, 0.008, 6, 14), white, k * 0.019, 0.004, 0); l.scale.set(1.3, 0.8, 1); l.rotation.z = k * 0.25;
        const t = ctx.mk(bow, new THREE.BoxGeometry(0.012, 0.07, 0.004), white, k * 0.012, -0.04, 0.002); t.rotation.z = k * 0.15; });
      ctx.mk(bow, S(8), red, 0, 0.004, 0.004, 0.012, 0.012, 0.01);
      ctx.mk(bow, new THREE.CylinderGeometry(0.004, 0.004, 0.03, 6), red, 0.008, -0.03, 0.006);
      ctx.mk(bow, new THREE.ConeGeometry(0.011, 0.035, 8), white, 0.008, -0.058, 0.006).rotation.x = Math.PI; // 白流苏
    } },
    // ---------- 鞋袜：白袜 + 红带木屐 ----------
    geta: { slot: "shoes", name: "白袜木屐", build(ctx) {
      ["kneeL", "kneeR"].forEach((j) => {
        ctx.mk(j, cap(0.04, 0.07), white, 0, -0.08, 0);
        ctx.mk(j, S(10), white, 0, -0.142, 0.014, 0.037, 0.024, 0.052);
        ctx.mk(j, new THREE.BoxGeometry(0.075, 0.03, 0.12), M("#3a2420", { roughness: 0.7 }), 0, -0.168, 0.016);
        ctx.mk(j, new THREE.BoxGeometry(0.077, 0.01, 0.122), red, 0, -0.152, 0.016);
        const s = ctx.mk(j, new THREE.TorusGeometry(0.03, 0.006, 6, 14, Math.PI), red, 0, -0.15, 0.03); s.rotation.x = -0.3;
      });
    } },
    // ---------- 头顶：小黄鸭（笑眯眯的眼睛） ----------
    duck: { socket: "headTop", name: "小黄鸭", fallback: "shoulder", build(ctx, g) {
      const yel = M("#ffd64a", { roughness: 0.35 }), org = M("#ff9a2e", { roughness: 0.4 }), blk = M("#3a2416");
      ctx.mk(g, S(16), yel, 0, 0.035, 0, 0.07, 0.048, 0.062);
      ctx.mk(g, S(16), yel, 0, 0.09, 0.022, 0.042, 0.04, 0.04);
      const tail = ctx.mk(g, new THREE.ConeGeometry(0.022, 0.04, 8), yel, 0, 0.06, -0.06); tail.rotation.x = -1.1;
      [-1, 1].forEach((k) => { const w = ctx.mk(g, S(10), M("#f6c83a", { roughness: 0.35 }), k * 0.06, 0.04, -0.005, 0.016, 0.028, 0.036); w.rotation.z = k * 0.3; });
      ctx.mk(g, S(10), org, 0, 0.082, 0.064, 0.022, 0.01, 0.018);
      [-1, 1].forEach((k) => { const e = ctx.mk(g, new THREE.TorusGeometry(0.008, 0.0022, 4, 10, Math.PI), blk, k * 0.019, 0.1, 0.055); e.rotation.y = k * 0.35; }); // ^ ^
      [-1, 1].forEach((k) => ctx.mk(g, S(8), M("#ff9aa8", { roughness: 0.5 }), k * 0.03, 0.084, 0.05, 0.008, 0.005, 0.003)); // 小腮红
    } },
    // ---------- 发饰：樱花发簪 ----------
    sakura: { socket: "hairPin", name: "樱花发簪", build(ctx, g) {
      const pink = M("#ffc6d4", { roughness: 0.5 }), pinkD = M("#f28aa6", { roughness: 0.5 }), twig = M("#6b3a2a");
      ctx.mk(g, new THREE.CylinderGeometry(0.004, 0.005, 0.09, 6), twig, 0.01, 0.03, 0).rotation.z = -0.4;
      for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2, pt = ctx.mk(g, S(8), pink, Math.cos(a) * 0.014, Math.sin(a) * 0.014, 0.004, 0.012, 0.012, 0.004); pt.rotation.z = a; }
      ctx.mk(g, S(8), pinkD, 0, 0, 0.008, 0.005, 0.005, 0.004);
      [[0.025, 0.05], [0.035, 0.068], [0.012, 0.072]].forEach(([x, y]) => ctx.mk(g, S(8), pinkD, x, y, 0, 0.008, 0.011, 0.008)); // 花苞
    } }
  };

  // ================= 换装 =================
  const worn = {}, attached = {}, built = {}; // built[key] = 这件东西加出来的零件
  function makeCtx(list) {
    const resolve = (j) => (typeof j === "string" ? joints[j] : j);
    return {
      mk: (j, geo, mat, ...a) => { const m = mk(resolve(j), geo, mat, ...a); list.push(m); return m; },
      group: (j, x = 0, y = 0, z = 0) => { const g = J(resolve(j), x, y, z); list.push(g); return g; }
    };
  }
  function strip(key) {
    (built[key] || []).forEach((o) => { o.removeFromParent(); o.traverse?.((c) => { if (c.isMesh) c.geometry.dispose(); }); });
    delete built[key];
  }
  function coveredSockets() { const s = new Set(); ERI_SLOTS.forEach((sl) => (ITEMS[worn[sl]]?.covers || []).forEach((c) => s.add(c))); return s; }
  function placeSockets() {
    const cov = coveredSockets();
    ERI_SOCKETS.forEach((so) => {
      strip("@" + so);
      const id = attached[so], it = ITEMS[id]; if (!it) return;
      const target = cov.has(so) ? it.fallback : so; if (!target || !sockets[target]) return;
      const list = (built["@" + so] = []);
      const g = J(sockets[target], 0, 0, 0); list.push(g);
      it.build(makeCtx(list), g);
    });
  }
  function wear(slot, id = "") {
    if (!ERI_SLOTS.includes(slot)) return false;
    if (id && ITEMS[id]?.slot !== slot) return false;
    strip(slot); worn[slot] = id;
    if (id) { const list = (built[slot] = []); ITEMS[id].build(makeCtx(list)); }
    placeSockets(); return true;
  }
  function attach(socket, id = "") {
    if (!ERI_SOCKETS.includes(socket)) return false;
    if (id && ITEMS[id]?.socket !== socket && !ITEMS[id]?.anySocket) return false;
    attached[socket] = id; placeSockets(); return true;
  }
  function dress(o = {}) {
    const look = { ...ERI_DEFAULT, ...o };
    ERI_SLOTS.forEach((s) => { if (worn[s] !== look[s]) { strip(s); worn[s] = look[s] && ITEMS[look[s]]?.slot === s ? look[s] : ""; if (worn[s]) { const list = (built[s] = []); ITEMS[worn[s]].build(makeCtx(list)); } } });
    ERI_SOCKETS.forEach((s) => { attached[s] = look[s] && ITEMS[look[s]] ? look[s] : ""; });
    placeSockets();
  }
  const outfit = () => ({ ...Object.fromEntries(ERI_SLOTS.map((s) => [s, worn[s] || ""])), ...Object.fromEntries(ERI_SOCKETS.map((s) => [s, attached[s] || ""])) });
  const catalog = () => Object.entries(ITEMS).map(([id, it]) => ({ id, name: it.name, slot: it.slot || null, socket: it.socket || null }));
  dress(ERI_DEFAULT);

  // ================= 动作 =================
  const L = (a, b, k) => a + (b - a) * k;
  /* animate(t, cue, k, lookYaw)：cue 为 shy（设定图的样子：一手抬起扶发簪、一手放胸前）/ heart（双手胸前比心）/ wave / ""；
   * k 是动作进度 0..1（起手和收手缓一下）；lookYaw 是想看向的方向（相对身体的偏转角，null 就不看） */
  function animate(t, cue = "", k = 1, lookYaw = null, walking = false) {
    const st = walking ? Math.sin(t * 10) : 0;
    body.position.y = Math.abs(st) * 0.012 + 0.003 * Math.sin(t * 2.2);
    torso.rotation.set(0, st * 0.06, 0.015 * Math.sin(t * 1.1));
    legs.forEach(({ hip, knee }, i) => { const s = i ? -st : st; hip.rotation.x = s * 0.45; knee.rotation.x = Math.max(0, -s) * 0.5; hip.rotation.z = (i ? -1 : 1) * 0.02; });
    const base = arms.map((_, i) => ({ x: (i ? -st : st) * 0.45 - 0.05, out: 0.2, e: -0.2 }));
    const e = Math.min(1, k * 3, (1 - k) * 4);
    const pose = {
      shy: [{ x: -0.95, out: -0.3, e: -1.45 }, { x: -2.2, out: 0.75, e: -1.6 + Math.sin(t * 1.6) * 0.06 }], // 左手抬到耳边扶着樱花发簪
      heart: [{ x: -1.0, out: -0.42, e: -1.4 }, { x: -1.0, out: -0.42, e: -1.4 }],
      wave: [null, { x: -0.25, out: 2.4 + Math.sin(t * 9) * 0.25, e: -0.4 }]
    }[cue];
    if (pose && cue === "shy" && globalThis.XBEriArm) pose[1] = globalThis.XBEriArm; // 调试：试抬手的角度
    if (pose && cue === "wave" && rig) pose[1] = { x: -1.5, out: 1.0, e: -1.3 + Math.sin(t * 9) * 0.35 }; // 精模：抬小臂挥，不把宽袖子往外扯
    arms.forEach(({ sh, el }, i) => {
      const b = base[i], p = pose?.[i], q = p ? e : 0;
      sh.rotation.set(L(b.x, p?.x ?? b.x, q), 0, (i ? 1 : -1) * L(b.out, p?.out ?? b.out, q)); el.rotation.x = L(b.e, p?.e ?? b.e, q);
    });
    const ce = pose ? e : 0;
    let hy = 0.03 * Math.sin(t * 0.7), hz = 0.03 * Math.sin(t * 0.9), hx = 0.02 * Math.sin(t * 1.3);
    if (cue === "shy") { hz += 0.16 * ce; hx += 0.05 * ce; }
    if (cue === "heart") { hz += -0.12 * ce * (1 + 0.3 * Math.sin(t * 2)); }
    if (lookYaw != null) hy = L(hy, Math.max(-0.9, Math.min(0.9, lookYaw)), 0.85);
    head.rotation.set(hx, hy, hz);
  }
  root.userData.parts = [];

  // ================= 混元精模（xuebao-3d/eri.glb，带骨骼） =================
  // 精模是默认那一整套（长发＋巫女服＋袴＋木屐＋樱花发簪）。加载好以后程序化小人藏起来，
  // 每帧把程序化关节的角度转到精模骨骼上；锚点挪到精模骨骼上，小鸭、手里拿的东西照样挂。
  // 精模的手臂静止时是 A 字（向外约 57°），所以手臂按“相对 A 字”算转多少。
  let rig = null;
  const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _e = new THREE.Euler();
  const GLB_COVERS = new Set(["sakura"]); // 精模自带的饰品，不再重复挂程序化的
  function loadGlb(GLTFLoader, url) {
    return new GLTFLoader().loadAsync(url).then(({ scene: m }) => {
      const box = new THREE.Box3().setFromObject(m), k = 0.95 / box.getSize(new THREE.Vector3()).y;
      const wrap = new THREE.Group(); m.scale.setScalar(k); m.position.y = -box.min.y * k; wrap.add(m);
      m.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; if (o.material) { o.material.metalness = 0; o.material.roughness = 0.72; if (o.material.map) { o.material.emissive = new THREE.Color("#ffffff"); o.material.emissiveMap = o.material.map; o.material.emissiveIntensity = 0.12; } } } });
      const bone = (n) => m.getObjectByName(n) || m.getObjectByName(n.replace(".", "")) || m.getObjectByName(n.replace(".", "_"));
      root.add(wrap); root.updateMatrixWorld(true);
      const rootQ = root.getWorldQuaternion(new THREE.Quaternion()).invert();
      const prep = (b) => b && { b, rest: b.quaternion.clone(), w: rootQ.clone().multiply(b.getWorldQuaternion(new THREE.Quaternion())) };
      const A = 1.0, ref = (z) => new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, z)).invert();
      const map = [[torso, "spine"], [head, "head"], [legs[0].hip, "thigh.R"], [legs[0].knee, "shin.R"], [legs[1].hip, "thigh.L"], [legs[1].knee, "shin.L"],
        [arms[0].sh, "upperarm.R", ref(-A), 0.45], [arms[0].el, "forearm.R", null, 0.5], [arms[1].sh, "upperarm.L", ref(A), 0.45], [arms[1].el, "forearm.L", null, 0.5]].map(([j, n, inv, gain]) => ({ j, inv, gain, r: prep(bone(n)) })).filter((x) => x.r);
      if (map.length < 8) { wrap.removeFromParent(); return false; }
      // 锚点搬到精模骨骼上（保持现在算好的世界位置）
      const top = new THREE.Box3().setFromObject(m).max.y, inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
      const put = (s, b, x, y, z) => { if (!b) return; s.removeFromParent(); s.position.set(x, y, z); root.add(s); root.updateMatrixWorld(true); b.attach(s); };
      const hb = (n) => { const b = bone(n); if (!b) return [0, 0, 0]; const v = b.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv); return [v.x, v.y, v.z]; };
      put(sockets.headTop, bone("head"), 0, top - 0.03, 0.11); // 头顶最高点在脸这一侧（z≈+0.11），不是后脑勺 sockets.headTop.scale.setScalar(1.45); // 精模头发更蓬，小鸭放大一点坐在头顶
      const hL = hb("hand.L"), hR = hb("hand.R");
      put(sockets.handL, bone("hand.L"), hL[0] + 0.03, hL[1] - 0.04, hL[2] + 0.02);
      put(sockets.handR, bone("hand.R"), hR[0] - 0.03, hR[1] - 0.04, hR[2] + 0.02);
      put(sockets.hairPin, bone("head"), 0.16, top - 0.2, 0.06);
      const sp = hb("spine");
      put(sockets.back, bone("spine"), 0, sp[1] + 0.02, -0.16);
      put(sockets.waist, bone("hips") || bone("spine"), 0.12, sp[1] - 0.05, 0.08);
      put(sockets.shoulder, bone("spine"), -0.14, sp[1] + 0.1, 0);
      body.visible = false; rig = { wrap, map, m, bone, k };
      sockets.hairPin.visible = !GLB_COVERS.has(attached.hairPin);
      return true;
    }).catch(() => false);
  }
  function retarget() {
    if (!rig) return;
    rig.wrap.position.copy(body.position); rig.wrap.rotation.copy(body.rotation);
    for (const { j, r, inv, gain } of rig.map) {
      _q.setFromEuler(_e.copy(j.rotation)); if (inv) _q.multiply(inv);
      if (gain) _q.slerp(_q2.identity(), 1 - gain); // 精模的宽袖子大幅抬手会扯坏，手臂只跟一半
      r.b.quaternion.copy(r.w).invert().multiply(_q).multiply(r.w).premultiply(r.rest);
    }
  }
  const attach0 = attach;
  function attachG(socket, id) { const ok = attach0(socket, id); if (rig) sockets.hairPin.visible = !GLB_COVERS.has(attached.hairPin); return ok; }
  function animateAll(...a) { animate(...a); retarget(); }
  return { root, animate: animateAll, head, joints, sockets, ITEMS, wear, attach: attachG, dress, outfit, catalog, loadGlb, get hasGlb() { return !!rig; }, get rig() { return rig; } };
}
