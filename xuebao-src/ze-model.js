/* 泽泽：照着《鸣潮》漂泊者（男）的大头娃娃四视图做的程序化小人（等 3D 生成额度恢复后换成精模）。
 * 黑色乱发 + 呆毛、金色眼睛；黑色短夹克（灰色臂章、卷起的灰袖口）、灰色内搭、金色吊牌项链；
 * 黑手套、腰带上的银环和白色小包（金十字）、黑色工装裤（金色侧条、绑带）、厚底短靴。
 * 关节：头、肩、肘、髋、膝，可以摆抱抱、举高高、亲亲、击掌、牵手这些姿势。
 * 尺寸：总高约 1.12（放进场景时和雪宝一起乘 0.9），脚底在原点，面朝 +z。
 */
export function buildZe(THREE) {
  const root = new THREE.Group(); root.name = "泽泽";
  const body = new THREE.Group(); root.add(body);
  const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.62, ...o });
  const skin = M("#ffe2cf", { roughness: 0.55 }), hairM = M("#1d1c22", { roughness: 0.42, metalness: 0.05 }), hairHi = M("#3a3946", { roughness: 0.38 });
  const jacket = M("#1f1f24", { roughness: 0.7 }), jacketHi = M("#2b2b33"), grey = M("#9a9ca3", { roughness: 0.7 }), shirt = M("#b9bbc2", { roughness: 0.75 });
  const pants = M("#1c1c21", { roughness: 0.75 }), glove = M("#17171b", { roughness: 0.55 }), boot = M("#121216", { roughness: 0.35, metalness: 0.1 });
  const gold = M("#d8b265", { metalness: 0.9, roughness: 0.3 }), silver = M("#c9ccd4", { metalness: 0.9, roughness: 0.25 }), white = M("#f4f1ea", { roughness: 0.5 });
  const all = [];
  const add = (parent, geo, mat, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; m.receiveShadow = true; parent.add(m); all.push(m); return m; };
  const S = (d = 18) => new THREE.SphereGeometry(1, d, Math.round(d * 0.7));
  const cap = (r, l) => new THREE.CapsuleGeometry(r, l, 6, 12);
  const J = (parent, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };

  // ---------- 腿：大腿（髋关节）→ 小腿（膝）→ 靴子 ----------
  const legs = [-1, 1].map((k) => {
    const hip = J(body, k * 0.072, 0.4, 0);
    add(hip, cap(0.06, 0.1), pants, 0, -0.09, 0);
    add(hip, new THREE.TorusGeometry(0.063, 0.008, 6, 20), M("#2c2c33"), 0, -0.08, 0, 1, 1, 1).rotation.x = Math.PI / 2; // 大腿绑带
    if (k < 0) add(hip, new THREE.BoxGeometry(0.05, 0.07, 0.03), M("#26262c"), k * 0.055, -0.1, 0.02); // 腿包
    const knee = J(hip, 0, -0.19, 0);
    add(knee, cap(0.055, 0.08), pants, 0, -0.07, 0);
    add(knee, new THREE.BoxGeometry(0.006, 0.14, 0.006), gold, k * 0.056, -0.05, 0, 1, 1, 1); // 金色侧条
    // 厚底短靴：靴筒 + 鞋头 + 厚底 + 两道扣带
    add(knee, cap(0.06, 0.05), boot, 0, -0.165, 0.005);
    add(knee, S(), boot, 0, -0.2, 0.04, 0.062, 0.042, 0.085);
    add(knee, new THREE.BoxGeometry(0.13, 0.025, 0.17), M("#0b0b0d", { roughness: 0.8 }), 0, -0.235, 0.03);
    [-0.15, -0.12].forEach((y) => add(knee, new THREE.TorusGeometry(0.062, 0.006, 5, 18), M("#33333a"), 0, y, 0.005).rotation.x = Math.PI / 2);
    return { hip, knee };
  });

  // ---------- 躯干：腰带、灰色内搭、短夹克、项链 ----------
  const torso = J(body, 0, 0.42, 0);
  add(torso, cap(0.105, 0.08), shirt, 0, 0.1, 0, 1, 1, 0.82);
  add(torso, new THREE.CylinderGeometry(0.112, 0.112, 0.035, 20), M("#141417"), 0, 0.01, 0, 1, 1, 0.84); // 腰带
  [-0.05, -0.012].forEach((x) => add(torso, new THREE.TorusGeometry(0.014, 0.004, 6, 14), silver, x, 0.012, 0.094));
  { // 白色小包 + 金十字
    const p = add(torso, new THREE.BoxGeometry(0.05, 0.05, 0.025), white, 0.07, 0.0, 0.085); p.rotation.y = 0.35;
    add(p, new THREE.BoxGeometry(0.03, 0.006, 0.4), gold, 0, 0, 0.55); add(p, new THREE.BoxGeometry(0.006, 0.03, 0.4), gold, 0, 0, 0.55);
    add(torso, new THREE.CylinderGeometry(0.003, 0.003, 0.06), gold, 0.035, -0.04, 0.09); add(torso, S(8), M("#4a8a7a"), 0.035, -0.072, 0.09, 0.008, 0.008, 0.008);
  }
  // 短夹克：前襟敞开（两片），领子立起来
  [-1, 1].forEach((k) => {
    const front = add(torso, new THREE.BoxGeometry(0.075, 0.16, 0.03), jacket, k * 0.06, 0.13, 0.08); front.rotation.z = -k * 0.05; front.rotation.y = k * 0.25;
    add(torso, new THREE.BoxGeometry(0.03, 0.025, 0.005), jacketHi, k * 0.065, 0.16, 0.098); // 胸袋
    const collar = add(torso, new THREE.BoxGeometry(0.06, 0.04, 0.02), jacket, k * 0.045, 0.215, 0.06); collar.rotation.set(-0.3, k * 0.4, -k * 0.3);
  });
  add(torso, new THREE.BoxGeometry(0.2, 0.16, 0.09), jacket, 0, 0.13, -0.03); // 背后
  add(torso, new THREE.TorusGeometry(0.06, 0.003, 4, 20, Math.PI), gold, 0, 0.2, 0.07).rotation.z = Math.PI; // 项链
  add(torso, new THREE.BoxGeometry(0.018, 0.028, 0.004), gold, 0, 0.135, 0.092); // 吊牌
  add(torso, cap(0.035, 0.02), skin, 0, 0.23, 0); // 脖子

  // ---------- 手臂：肩 → 肘 → 手套 ----------
  const arms = [-1, 1].map((k) => {
    const sh = J(torso, k * 0.125, 0.19, 0);
    add(sh, S(), jacket, 0, 0, 0, 0.055, 0.05, 0.055);
    add(sh, cap(0.042, 0.06), jacket, 0, -0.055, 0);
    add(sh, new THREE.CylinderGeometry(0.045, 0.045, 0.02, 14), grey, 0, -0.06, 0); // 灰色臂章
    const el = J(sh, 0, -0.11, 0);
    add(el, new THREE.CylinderGeometry(0.044, 0.042, 0.035, 14), grey, 0, -0.01, 0); // 卷起来的袖口
    add(el, cap(0.032, 0.04), skin, 0, -0.045, 0);
    add(el, new THREE.CylinderGeometry(0.035, 0.033, 0.03, 12), white, 0, -0.05, 0); // 手腕绷带
    const hand = J(el, 0, -0.1, 0);
    add(hand, S(), glove, 0, 0, 0, 0.04, 0.045, 0.035);
    add(hand, S(8), glove, k * -0.03, 0.01, 0.015, 0.013, 0.025, 0.013); // 大拇指
    return { sh, el, hand };
  });

  // ---------- 头：脸、金色眼睛、黑色乱发、呆毛 ----------
  const neck = J(torso, 0, 0.25, 0), head = J(neck, 0, 0.17, 0.005);
  add(head, S(28), skin, 0, 0, 0, 0.19, 0.175, 0.17);
  [-1, 1].forEach((k) => add(head, S(10), skin, k * 0.185, -0.015, 0, 0.025, 0.035, 0.02)); // 耳朵
  // 脸：画在一块贴着脸的球面片上（眼睛、眉毛、嘴）
  const faceTex = (() => {
    const c = document.createElement("canvas"); c.width = 512; c.height = 384; const g = c.getContext("2d");
    const eye = (cx) => {
      g.save(); g.translate(cx, 205);
      const iris = g.createLinearGradient(0, -48, 0, 46); iris.addColorStop(0, "#5a3410"); iris.addColorStop(0.45, "#c88a22"); iris.addColorStop(1, "#ffd36a");
      g.fillStyle = "#fffaf2"; g.beginPath(); g.ellipse(0, 4, 36, 46, 0, 0, 7); g.fill();
      g.fillStyle = iris; g.beginPath(); g.ellipse(0, 6, 30, 42, 0, 0, 7); g.fill();
      g.fillStyle = "#2a1606"; g.beginPath(); g.ellipse(0, 10, 12, 18, 0, 0, 7); g.fill();
      g.fillStyle = "rgba(255,255,255,.95)"; g.beginPath(); g.ellipse(-11, -14, 9, 12, -0.3, 0, 7); g.fill(); g.beginPath(); g.arc(12, 22, 4, 0, 7); g.fill();
      g.strokeStyle = "#1a1416"; g.lineWidth = 9; g.lineCap = "round"; g.beginPath(); g.moveTo(-42, -30); g.quadraticCurveTo(0, -56, 44, -36); g.stroke(); // 上睫毛线
      g.lineWidth = 3; g.beginPath(); g.moveTo(-26, 50); g.quadraticCurveTo(0, 56, 24, 50); g.stroke();
      g.restore();
    };
    eye(170); eye(342);
    g.strokeStyle = "#2a2226"; g.lineWidth = 6; g.lineCap = "round"; // 眉毛（大半被刘海挡住）
    g.beginPath(); g.moveTo(125, 120); g.lineTo(205, 128); g.stroke(); g.beginPath(); g.moveTo(307, 128); g.lineTo(387, 120); g.stroke();
    g.strokeStyle = "#7a4a40"; g.lineWidth = 4; g.beginPath(); g.moveTo(244, 300); g.quadraticCurveTo(256, 306, 268, 300); g.stroke(); // 嘴
    g.fillStyle = "rgba(255,150,150,.22)"; [150, 362].forEach((x) => { g.beginPath(); g.ellipse(x, 278, 30, 12, 0, 0, 7); g.fill(); });
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  })();
  const faceMat = new THREE.MeshStandardMaterial({ map: faceTex, transparent: true, roughness: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const face = add(head, new THREE.SphereGeometry(1, 32, 20, Math.PI / 2 - 0.75, 1.5, Math.PI / 2 - 0.62, 1.18), faceMat, 0, 0, 0, 0.192, 0.178, 0.173);
  face.castShadow = false; face.renderOrder = 2;
  // 头发：后脑勺一大团 + 一圈尖尖的发束（刘海盖到眼睛上沿）+ 呆毛
  // 后脑勺和头顶：一个往后挪的大球（不挡脸）+ 头顶一块半球
  add(head, S(24), hairM, 0, 0.02, -0.05, 0.205, 0.19, 0.175);
  add(head, new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, 1.05), hairM, 0, 0.03, -0.005, 0.2, 0.2, 0.19);
  const lock = (x, y, z, rx, rz, len, w, mat = hairM) => { const g = new THREE.ConeGeometry(w, len, 7, 1); g.translate(0, -len / 2, 0); const m = add(head, g, mat, x, y, z); m.rotation.set(rx, 0, rz); return m; };
  // 刘海：从额头顶上往下垂，左右错开
  [[-0.13, 0.4], [-0.08, 0.15], [-0.03, -0.05], [0.02, 0.1], [0.07, -0.12], [0.12, -0.35]].forEach(([x, rz], i) => lock(x, 0.12, 0.12, 0.35, rz, 0.13 + (i % 2) * 0.03, 0.05, i % 3 ? hairM : hairHi));
  // 两侧和后面：往外翘的发束
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2 + 0.25; if (Math.cos(a) > 0.55) continue; const r = 0.17; lock(Math.sin(a) * r, 0.02 + Math.cos(i * 1.7) * 0.03, Math.cos(a) * r * 0.95, -Math.cos(a) * 0.5, Math.sin(a) * 1.1, 0.13, 0.055, i % 2 ? hairM : hairHi); }
  // 头顶的乱翘 + 呆毛
  [[-0.08, 0.6], [0.06, -0.5], [0, 0.1]].forEach(([x, rz]) => { const m = lock(x, 0.17, -0.02, Math.PI, rz, 0.09, 0.045); m.position.y = 0.16; });
  const ahoge = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.17, 0), new THREE.Vector3(0.01, 0.23, -0.01), new THREE.Vector3(0.05, 0.27, 0.01), new THREE.Vector3(0.07, 0.25, 0.04)]), 16, 0.008, 6), hairM);
  ahoge.castShadow = true; head.add(ahoge);

  // ---------- 动画：走路、待机、挥手，以及和雪宝一起的姿势 ----------
  const L = (a, b, k) => a + (b - a) * k;
  /* animate(t, walking, cue, seated, k)：cue 为 wave/talk/hug/kiss/lift/five/hand/warm；k 是动作进度 0..1（用来做起手和收手） */
  function animate(t, walking = false, cue = "", seated = false, k = 1, speed = 1) {
    const st = walking ? Math.sin(t * (speed > 1.8 ? 13 : 9.5)) : 0, run = walking && speed > 1.8;
    body.position.y = seated ? -0.17 : Math.abs(st) * (run ? 0.03 : 0.015) + 0.004 * Math.sin(t * 2.1);
    body.rotation.x = run ? 0.15 : 0;
    torso.rotation.y = st * 0.08; head.rotation.set(0.02 * Math.sin(t * 1.3), st * -0.06, 0.02 * Math.sin(t * 0.9));
    legs.forEach(({ hip, knee }, i) => {
      const s = i ? -st : st;
      hip.rotation.x = seated ? -1.45 : s * (run ? 0.8 : 0.55); knee.rotation.x = seated ? 1.4 : Math.max(0, -s) * (run ? 1.1 : 0.6);
      hip.rotation.z = (i ? -1 : 1) * 0.03;
    });
    // 手臂：x 是往前抬（负数往前上方），out 是往外张（负数往里收），e 是手肘弯曲
    const base = arms.map((_, i) => ({ x: (i ? -st : st) * (run ? 0.9 : 0.5), out: 0.12, e: run ? -1.1 : -0.15 }));
    const e = Math.min(1, k * 3, (1 - k) * 4); // 起手和收手都缓一下
    const pose = {
      wave: [null, { x: -0.2, out: 2.5 + Math.sin(t * 10) * 0.25, e: -0.4 }],
      talk: [{ x: -0.5, out: -0.25, e: -1.2 + Math.sin(t * 4) * 0.2 }, null],
      hug: [{ x: -1.25, out: -0.45, e: -1.3 }, { x: -1.25, out: -0.45, e: -1.3 }],
      kiss: [{ x: -0.9, out: -0.3, e: -1.0 }, { x: -0.9, out: -0.3, e: -1.0 }],
      lift: [{ x: -1.95 - Math.sin(t * 5) * 0.06, out: -0.05, e: -0.35 }, { x: -1.95 - Math.sin(t * 5) * 0.06, out: -0.05, e: -0.35 }], // 双手往前上方托住雪宝的腰，跟着她一颠一颠
      five: [null, { x: -2.2, out: 0.5, e: -0.3 }],
      hand: [{ x: -0.25, out: 0.45, e: -0.15 }, null],
      warm: [{ x: -1.1, out: -0.25, e: -0.9 }, { x: -1.1, out: -0.25, e: -0.9 }],
      // 没人管的时候的小动作：伸懒腰、托腮想事情、打哈欠、东张西望、挠挠头、看看手表
      stretch: [{ x: -2.95, out: 0.2, e: -0.1 }, { x: -2.95, out: 0.2, e: -0.1 }],
      think: [{ x: -1.25, out: -0.35, e: -2.1 }, { x: -0.55, out: -0.55, e: -1.5 }],
      yawn: [{ x: -1.5, out: -0.3, e: -2.0 }, null],
      look: [null, null],
      scratch: [null, { x: -2.6, out: 0.15, e: -1.6 + Math.sin(t * 14) * 0.15 }],
      watch: [{ x: -0.9, out: -0.5, e: -1.6 }, { x: -0.6, out: -0.35, e: -1.2 }]
    }[cue];
    arms.forEach(({ sh, el }, i) => {
      const b = base[i], p = pose?.[i], q = p ? e : 0;
      const x = L(b.x, p?.x ?? b.x, q), out = L(b.out, p?.out ?? b.out, q), ee = L(b.e, p?.e ?? b.e, q);
      sh.rotation.set(x, 0, i ? out : -out); el.rotation.x = ee;
    });
    // 亲亲：身体往前倾、头偏一点；举高高：往后仰一点
    const ce = pose ? e : 0;
    if (cue === "kiss") { body.rotation.x = 0.28 * ce; head.rotation.z = 0.25 * ce; head.rotation.x = 0.15 * ce; }
    if (cue === "lift") { body.rotation.x = -0.12 * ce; head.rotation.x = -0.4 * ce; }
    if (cue === "hug") { head.rotation.z = 0.15 * ce; }
    if (cue === "stretch") { body.rotation.x = -0.12 * ce; head.rotation.x = -0.3 * ce; body.position.y += 0.02 * ce; }
    if (cue === "think") { head.rotation.z = 0.18 * ce; head.rotation.x = 0.08 * ce; head.rotation.y = 0.25 * ce; }
    if (cue === "yawn") { head.rotation.x = -0.35 * ce * (0.7 + 0.3 * Math.sin(t * 2)); }
    if (cue === "look") { head.rotation.y = Math.sin(t * 1.1) * 0.75 * ce; head.rotation.x = -0.08 * ce; torso.rotation.y = Math.sin(t * 1.1) * 0.15 * ce; }
    if (cue === "scratch") { head.rotation.z = -0.12 * ce; }
    if (cue === "watch") { head.rotation.x = 0.35 * ce; }
  }
  root.userData.parts = all;
  // ---------- 混元精模（xuebao-3d/ze.glb，带骨骼）：加载好就把上面的程序化小人藏起来，
  // 每帧照着程序化关节的角度去转精模的骨骼（同一套动作，精模只是“穿上”它） ----------
  let rig = null;
  const _q = new THREE.Quaternion(), _e = new THREE.Euler();
  function loadGlb(GLTFLoader, url = "xuebao-3d/ze.glb?v=2") {
    new GLTFLoader().loadAsync(url).then(({ scene: m }) => {
      const box = new THREE.Box3().setFromObject(m), k = 1.12 / box.getSize(new THREE.Vector3()).y;
      const wrap = new THREE.Group(); m.scale.setScalar(k); m.position.y = -box.min.y * k; wrap.add(m);
      m.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; if (o.material) { o.material.metalness = 0; o.material.roughness = 0.72; if (o.material.map) { o.material.emissive = new THREE.Color("#ffffff"); o.material.emissiveMap = o.material.map; o.material.emissiveIntensity = 0.16; } /* 黑衣黑发在屋里太暗：贴图自己发一点点光 */ } } });
      const bone = (n) => m.getObjectByName(n) || m.getObjectByName(n.replace(".", "")) || m.getObjectByName(n.replace(".", "_"));
      root.add(wrap); root.updateMatrixWorld(true);
      const rootQ = root.getWorldQuaternion(new THREE.Quaternion()).invert();
      const prep = (b) => b && { b, rest: b.quaternion.clone(), w: rootQ.clone().multiply(b.getWorldQuaternion(new THREE.Quaternion())) };
      const map = [[torso, "spine"], [head, "head"], [legs[0].hip, "thigh.R"], [legs[0].knee, "shin.R"], [legs[1].hip, "thigh.L"], [legs[1].knee, "shin.L"],
        [arms[0].sh, "upperarm.R"], [arms[0].el, "forearm.R"], [arms[1].sh, "upperarm.L"], [arms[1].el, "forearm.L"]].map(([j, n]) => ({ j, r: prep(bone(n)) })).filter((x) => x.r);
      if (map.length < 8) { wrap.removeFromParent(); return; } // 骨骼对不上就继续用程序化小人
      body.visible = false; rig = { wrap, map };
    }).catch(() => {});
  }
  // 程序化关节的局部旋转 = 模型空间里绕关节转多少；换到骨骼自己的静止朝向里：rest · (W⁻¹ · R · W)
  function retarget() {
    if (!rig) return;
    rig.wrap.position.copy(body.position); rig.wrap.rotation.copy(body.rotation);
    for (const { j, r } of rig.map) {
      _q.setFromEuler(_e.copy(j.rotation));
      r.b.quaternion.copy(r.w).invert().multiply(_q).multiply(r.w).premultiply(r.rest);
    }
  }
  function animateAll(...a) { animate(...a); retarget(); }
  return { root, animate: animateAll, head, arms, hands: arms.map((a) => a.hand), loadGlb };
}
