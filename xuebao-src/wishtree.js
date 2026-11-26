/* 樱花许愿树：神社里那种老樱花树。
 * 弯曲的老树干分出几根大枝，枝头是一团团花簇（画布画的五瓣樱花贴在交叉面片上，比实心球蓬松）；
 * 树干上系一圈注连绳和白色纸垂；低一点的枝条上挂着木头绘马，红绳吊着、随风轻晃，点开能读；
 * 花瓣一片片转着落下来，落在地上铺成一圈粉色。
 */
export function buildWishTree(THREE, scene, { heightAt, mobile, x = 1.42, z = -16.83 }) {
  const root = new THREE.Group(); root.name = "樱花许愿树";
  const y0 = heightAt(x, z); root.position.set(x, y0, z); scene.add(root);
  let seed = 31; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647), R = (a, b) => a + rnd() * (b - a);
  const V = (a, b, c) => new THREE.Vector3(a, b, c);

  // ---------- 树干和枝条：一条条弯管，越往外越细 ----------
  const bark = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.92 });
  const barkTex = (() => {
    const c = document.createElement("canvas"); c.width = 64; c.height = 256; const g = c.getContext("2d");
    g.fillStyle = "#7d5a4c"; g.fillRect(0, 0, 64, 256);
    for (let i = 0; i < 26; i++) { g.fillStyle = `rgba(${40 + rnd() * 30},${26 + rnd() * 20},${22 + rnd() * 14},${0.35 + rnd() * 0.4})`; g.fillRect(rnd() * 64, rnd() * 256, 2 + rnd() * 5, 18 + rnd() * 60); }
    for (let i = 0; i < 12; i++) { g.fillStyle = "rgba(150,120,105,.25)"; g.fillRect(0, rnd() * 256, 64, 1.5); } // 樱花树皮上的横纹
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  bark.map = barkTex;
  const tips = [];
  function limb(pts, r0, r1, depth) {
    const curve = new THREE.CatmullRomCurve3(pts);
    const geo = new THREE.TubeGeometry(curve, 14, 1, 8, false), p = geo.attributes.position, n = geo.attributes.normal;
    // 按位置把管子半径从 r0 收到 r1
    const seg = 15, ring = 9;
    for (let i = 0; i < seg; i++) { const k = i / (seg - 1), r = r0 + (r1 - r0) * Math.pow(k, 0.8), c = curve.getPointAt(k); for (let j = 0; j < ring; j++) { const id = i * ring + j; p.setXYZ(id, c.x + n.getX(id) * r, c.y + n.getY(id) * r, c.z + n.getZ(id) * r); } }
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, bark); m.castShadow = m.receiveShadow = true; root.add(m);
    if (depth > 0) tips.push({ p: pts[pts.length - 1].clone(), d: curve.getTangentAt(1), depth });
    return curve;
  }
  // 主干：根部外扩，往上微微扭一下
  const trunk = limb([V(0, -0.05, 0), V(0.05, 0.5, 0.02), V(-0.06, 1.0, -0.03), V(0.02, 1.45, 0)], 0.24, 0.15, 0);
  // 根部几道板根
  for (let i = 0; i < 5; i++) { const a = i * 1.26 + 0.3; limb([V(Math.cos(a) * 0.12, 0.25, Math.sin(a) * 0.12), V(Math.cos(a) * 0.3, 0.06, Math.sin(a) * 0.3), V(Math.cos(a) * 0.46, -0.03, Math.sin(a) * 0.46)], 0.09, 0.03, 0); }
  // 大枝：往四周斜着伸出去，再分小枝
  const MAIN = [[-1.25, 2.15, 0.25], [-0.55, 2.55, -0.55], [0.55, 2.6, -0.35], [1.25, 2.1, 0.3], [0.2, 2.75, 0.55], [-0.3, 2.3, 0.8]];
  MAIN.forEach(([mx, my, mz], i) => {
    const s0 = V(0.02, 1.35 + (i % 3) * 0.06, 0), mid = V(mx * 0.45, (s0.y + my) / 2 + 0.12, mz * 0.45), end = V(mx, my, mz);
    limb([s0, mid, end], 0.11, 0.045, 1);
    for (let k = 0; k < 2; k++) {
      const a = R(0, Math.PI * 2), e2 = end.clone().add(V(Math.cos(a) * 0.5, R(0.05, 0.35), Math.sin(a) * 0.5));
      limb([mid.clone().lerp(end, 0.6), end.clone().lerp(e2, 0.5).add(V(0, 0.08, 0)), e2], 0.04, 0.015, 2);
    }
  });

  // ---------- 花簇：画布画一小撮五瓣樱花，贴在交叉面片上，数百片组成蓬松的树冠 ----------
  const blossomTex = (() => {
    const c = document.createElement("canvas"); c.width = c.height = 256; const g = c.getContext("2d");
    const flower = (cx, cy, r, rot, light) => {
      for (let i = 0; i < 5; i++) {
        const a = rot + (i / 5) * Math.PI * 2; g.save(); g.translate(cx, cy); g.rotate(a);
        const gr = g.createLinearGradient(0, 0, 0, -r); gr.addColorStop(0, light ? "#fbd3de" : "#f2a9bd"); gr.addColorStop(1, light ? "#fff4f7" : "#fbd9e3");
        g.fillStyle = gr; g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(-r * 0.55, -r * 0.3, -r * 0.5, -r * 0.95, -r * 0.12, -r); g.lineTo(0, -r * 0.86); g.lineTo(r * 0.12, -r); g.bezierCurveTo(r * 0.5, -r * 0.95, r * 0.55, -r * 0.3, 0, 0); g.fill(); g.restore();
      }
      g.fillStyle = "#e0587a"; g.beginPath(); g.arc(cx, cy, r * 0.16, 0, 7); g.fill();
      g.fillStyle = "#ffe08a"; for (let i = 0; i < 6; i++) { const a = i * 1.05; g.beginPath(); g.arc(cx + Math.cos(a) * r * 0.24, cy + Math.sin(a) * r * 0.24, r * 0.045, 0, 7); g.fill(); }
    };
    for (let i = 0; i < 26; i++) { const a = rnd() * 6.28, d = Math.sqrt(rnd()) * 92; flower(128 + Math.cos(a) * d, 128 + Math.sin(a) * d, 22 + rnd() * 14, rnd() * 6, rnd() < 0.5); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const bloomMat = new THREE.MeshStandardMaterial({ map: blossomTex, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.85, emissive: "#f4b6c8", emissiveIntensity: 0.12 });
  const cross = (() => { // 两片交叉的面片 = 一个花簇
    const a = new THREE.PlaneGeometry(1, 1), b = new THREE.PlaneGeometry(1, 1).rotateY(Math.PI / 2), g = new THREE.BufferGeometry();
    const pa = a.attributes.position.array, pb = b.attributes.position.array, ua = a.attributes.uv.array, ub = b.attributes.uv.array, na = a.attributes.normal.array, nb = b.attributes.normal.array;
    g.setAttribute("position", new THREE.Float32BufferAttribute([...pa, ...pb], 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute([...ua, ...ub], 2));
    g.setAttribute("normal", new THREE.Float32BufferAttribute([...na, ...nb].map((v, i) => (i % 3 === 1 ? 1 : v * 0.3)), 3)); // 法线朝上偏，树冠受光更均匀
    const ia = a.index.array, ib = [...b.index.array].map((v) => v + 4); g.setIndex([...ia, ...ib]); return g;
  })();
  const NB = mobile ? 380 : 620, blooms = new THREE.InstancedMesh(cross, bloomMat, NB);
  const dummy = new THREE.Object3D(), col = new THREE.Color();
  const clusters = tips.map((t) => ({ c: t.p.clone().add(V(0, 0.18, 0)), r: t.depth === 1 ? 0.62 : 0.48 }));
  clusters.push({ c: V(0, 2.65, 0), r: 0.7 }, { c: V(0.1, 2.95, 0.1), r: 0.5 });
  for (let i = 0; i < NB; i++) {
    const cl = clusters[i % clusters.length], u = rnd() * 2 - 1, a = rnd() * Math.PI * 2, rr = Math.cbrt(rnd()) * cl.r, s0 = Math.sqrt(1 - u * u);
    dummy.position.set(cl.c.x + Math.cos(a) * s0 * rr * 1.15, cl.c.y + u * rr * 0.62, cl.c.z + Math.sin(a) * s0 * rr * 1.15);
    dummy.rotation.set(R(-0.5, 0.5), R(0, 6.28), R(-0.5, 0.5)); dummy.scale.setScalar(R(0.32, 0.5)); dummy.updateMatrix();
    blooms.setMatrixAt(i, dummy.matrix); blooms.setColorAt(i, col.setHSL(0.95 + R(-0.015, 0.015), R(0.55, 0.75), R(0.88, 1)));
  }
  blooms.receiveShadow = true; blooms.userData.noHit = false; root.add(blooms);
  // 树冠在地上的柔和投影（花簇面片不投影，省性能）
  const shadowTex = (() => { const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d"); const gr = g.createRadialGradient(64, 64, 10, 64, 64, 64); gr.addColorStop(0, "rgba(60,30,40,.32)"); gr.addColorStop(1, "rgba(60,30,40,0)"); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
  const shade = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3.2).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
  shade.position.y = 0.012; shade.userData.noHit = true; root.add(shade);

  // ---------- 注连绳 + 纸垂 ----------
  {
    const rope = new THREE.MeshStandardMaterial({ color: "#d9c08a", roughness: 0.9 }), paper = new THREE.MeshStandardMaterial({ color: "#fffdf6", roughness: 0.7, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.026, 8, 40), rope); ring.rotation.x = Math.PI / 2; ring.position.y = 1.02; root.add(ring);
    const twist = new THREE.Mesh(new THREE.TorusGeometry(0.205, 0.012, 6, 40), new THREE.MeshStandardMaterial({ color: "#c9a96a" })); twist.rotation.x = Math.PI / 2; twist.position.y = 1.045; root.add(twist);
    const shide = new THREE.Shape(); // 闪电形的白纸条
    shide.moveTo(0, 0); shide.lineTo(0.03, 0); shide.lineTo(0.03, -0.05); shide.lineTo(0.05, -0.05); shide.lineTo(0.05, -0.1); shide.lineTo(0.03, -0.1); shide.lineTo(0.03, -0.15); shide.lineTo(0.05, -0.15); shide.lineTo(0.05, -0.2); shide.lineTo(0.02, -0.2); shide.lineTo(0.02, -0.15); shide.lineTo(0, -0.15); shide.lineTo(0, -0.1); shide.lineTo(0.02, -0.1); shide.lineTo(0.02, -0.05); shide.lineTo(0, -0.05); shide.closePath();
    const sg = new THREE.ShapeGeometry(shide);
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.4, m = new THREE.Mesh(sg, paper); m.position.set(Math.sin(a) * 0.23, 1.0, Math.cos(a) * 0.23); m.rotation.y = a; root.add(m); }
  }

  // ---------- 绘马：木头五边形小牌，正面写愿望标题和签运，红绳吊在枝条上 ----------
  const SLOTS = [];
  { // 在低一些的枝条附近找挂绘马的位置：围着树一圈、高度 1.5～2.1
    const N = 30;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2 + R(-0.08, 0.08), r = R(0.75, 1.25), hy = R(1.95, 2.25), drop = R(0.32, 0.55);
      SLOTS.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, hang: hy, y: hy - drop, a });
    }
    // 正面朝外、靠近小路的一侧先挂（玩家多半从前面看）
    SLOTS.sort((p, q) => q.z - p.z);
  }
  const emaShape = (() => { const s0 = new THREE.Shape(); s0.moveTo(-0.08, -0.06); s0.lineTo(0.08, -0.06); s0.lineTo(0.08, 0.04); s0.lineTo(0, 0.075); s0.lineTo(-0.08, 0.04); s0.closePath(); return s0; })();
  const emaGeo = new THREE.ExtrudeGeometry(emaShape, { depth: 0.012, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.003, bevelSegments: 1 });
  emaGeo.translate(0, 0, -0.006);
  { const p = emaGeo.attributes.position, uv = emaGeo.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + 0.084) / 0.168, (p.getY(i) + 0.064) / 0.143); } // 正面贴图铺满整块牌子
  const wood = new THREE.MeshStandardMaterial({ color: "#d8b58a", roughness: 0.75 });
  const redRope = new THREE.MeshStandardMaterial({ color: "#c8333f", roughness: 0.6 });
  const LUCKC = { daikichi: "#d2394f", chukichi: "#e0704d", shokichi: "#c98a2e", kichi: "#8b7a5a" };
  const LUCKN = { daikichi: "大吉", chukichi: "中吉", shokichi: "小吉", kichi: "吉" };
  function emaTex(title, luck, by) {
    const c = document.createElement("canvas"); c.width = 160; c.height = 132; const g = c.getContext("2d");
    g.fillStyle = "#e6c79c"; g.fillRect(0, 0, 160, 132);
    for (let i = 0; i < 9; i++) { g.strokeStyle = "rgba(150,105,60,.18)"; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, 14 * i + 6); g.bezierCurveTo(50, 14 * i, 110, 14 * i + 12, 160, 14 * i + 5); g.stroke(); }
    g.fillStyle = LUCKC[luck] || "#c8333f"; g.fillRect(10, 14, 34, 34); g.fillStyle = "#fff"; g.font = "bold 17px 'PingFang SC',serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(LUCKN[luck] || "吉", 27, 32);
    g.fillStyle = "#3b2418"; g.font = `bold ${title.length > 2 ? 30 : 38}px 'Ma Shan Zheng','STKaiti','KaiTi',serif`; g.fillText(title, 96, 70);
    g.font = "13px 'PingFang SC',sans-serif"; g.fillStyle = "rgba(70,40,25,.75)"; g.fillText(by === "泽" ? "—— 泽泽" : "—— 雪雪", 112, 112);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  const emas = []; // { pivot, mesh, w, slot, born }
  const emaPick = [];
  function setWishes(list, CARDS) {
    const byId = Object.fromEntries((CARDS || []).map((c) => [c.id, c]));
    const show = list.slice(0, SLOTS.length);
    // 已经挂着的不重画，只增减
    const key = (w) => `${w.at || 0}-${w.card}`;
    const keep = new Set(show.map(key));
    for (let i = emas.length - 1; i >= 0; i--) if (!keep.has(emas[i].key)) { root.remove(emas[i].pivot); emaPick.splice(emaPick.indexOf(emas[i].mesh), 1); emas.splice(i, 1); }
    const have = new Set(emas.map((e) => e.key)), used = new Set(emas.map((e) => e.slot));
    show.forEach((w) => {
      if (have.has(key(w))) return;
      const slot = SLOTS.findIndex((_, i) => !used.has(i)); if (slot < 0) return; used.add(slot);
      const S = SLOTS[slot], c = byId[w.card] || { title: "如愿" };
      const pivot = new THREE.Group(); pivot.position.set(S.x, S.hang, S.z); root.add(pivot);
      const len = S.hang - S.y;
      const str = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, len, 4).translate(0, -len / 2, 0), redRope); pivot.add(str);
      const mat = new THREE.MeshStandardMaterial({ map: emaTex(c.title, w.luck, w.by), roughness: 0.7 });
      const mesh = new THREE.Mesh(emaGeo, [mat, wood]); mesh.position.y = -len - 0.06; mesh.rotation.y = -S.a + Math.PI / 2 + R(-0.4, 0.4); mesh.castShadow = true;
      // 正面贴字、侧面是木头：ExtrudeGeometry 的 group 0 是正反面，1 是侧边
      pivot.add(mesh);
      const knot = new THREE.Mesh(new THREE.SphereGeometry(0.008, 6, 4), redRope); knot.position.y = -len + 0.01; pivot.add(knot);
      mesh.userData.wish = w; emaPick.push(mesh);
      emas.push({ pivot, mesh, w, slot, key: key(w), born: performance.now() / 1000, ph: R(0, 6) });
    });
  }

  // ---------- 落花：一片片小花瓣，转着飘下来，落地停一会儿再淡掉 ----------
  const petalTex = (() => { const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d"); const gr = g.createLinearGradient(0, 64, 0, 0); gr.addColorStop(0, "#f3a9be"); gr.addColorStop(1, "#fff0f4"); g.fillStyle = gr; g.beginPath(); g.moveTo(32, 62); g.bezierCurveTo(4, 40, 10, 6, 26, 4); g.lineTo(32, 12); g.lineTo(38, 4); g.bezierCurveTo(54, 6, 60, 40, 32, 62); g.fill(); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const petalMat = new THREE.MeshStandardMaterial({ map: petalTex, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.8, emissive: "#f6c1cf", emissiveIntensity: 0.15 });
  const NP = mobile ? 90 : 150, petals = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.05, 0.05), petalMat, NP);
  petals.userData.noHit = true; petals.frustumCulled = false; root.add(petals);
  const P = Array.from({ length: NP }, () => ({ x: 0, y: -1, z: 0, vx: 0, vz: 0, rx: 0, ry: 0, rz: 0, sp: 0, ground: 0 }));
  const spawn = (p) => { const cl = clusters[Math.floor(rnd() * clusters.length)]; p.x = cl.c.x + R(-0.5, 0.5); p.y = cl.c.y + R(-0.2, 0.2); p.z = cl.c.z + R(-0.5, 0.5); p.vx = R(0.05, 0.25); p.vz = R(-0.08, 0.08); p.sp = R(1.5, 4); p.rx = R(0, 6); p.ry = R(0, 6); p.ground = 0; };
  P.forEach((p) => { spawn(p); p.y = R(0, 3); });
  // 地上的落花：一圈铺好的花瓣
  const NG = mobile ? 140 : 240, groundPetals = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.05, 0.05).rotateX(-Math.PI / 2), petalMat, NG);
  for (let i = 0; i < NG; i++) { const a = rnd() * 6.28, r = Math.pow(rnd(), 0.7) * 1.9; dummy.position.set(Math.cos(a) * r, heightAt(x + Math.cos(a) * r, z + Math.sin(a) * r) - y0 + 0.01, Math.sin(a) * r); dummy.rotation.set(0, R(0, 6.28), 0); dummy.scale.setScalar(R(0.8, 1.3)); dummy.updateMatrix(); groundPetals.setMatrixAt(i, dummy.matrix); }
  groundPetals.userData.noHit = true; groundPetals.receiveShadow = true; root.add(groundPetals);

  // ---------- 能点的：整棵树（读愿望），每块绘马（读这一块） ----------
  const spots = [{ id: "wish-tree", name: "樱花许愿树", icon: "🌸", verb: "读愿望", action: "wish-tree", at: [x, y0 + 3.1, z], spot: { x: x - 0.1, z: z + 1.55 }, near: 1.9, pick: [blooms, ...emaPick] }];
  // emaPick 是同一个数组引用：后挂上的绘马也能点到

  function update(dt, t) {
    // 绘马：轻轻晃，新挂上的先荡一大下
    emas.forEach((e) => { const age = t - (e.bornT ??= t), kick = Math.exp(-age * 1.6) * 0.5; e.pivot.rotation.x = Math.sin(t * 1.4 + e.ph) * 0.06 + Math.sin(age * 6) * kick; e.pivot.rotation.z = Math.sin(t * 1.1 + e.ph * 1.3) * 0.08 + Math.cos(age * 5) * kick * 0.6; });
    const wind = 0.6 + Math.sin(t * 0.3) * 0.4;
    for (let i = 0; i < NP; i++) {
      const p = P[i];
      if (p.ground > 0) { p.ground -= dt; if (p.ground <= 0) spawn(p); }
      else {
        p.y -= dt * 0.32; p.x += (p.vx * wind + Math.sin(t * 1.3 + i) * 0.12) * dt; p.z += (p.vz + Math.cos(t * 0.9 + i * 0.7) * 0.08) * dt;
        p.rx += dt * p.sp; p.ry += dt * p.sp * 0.7;
        const gy = heightAt(x + p.x, z + p.z) - y0 + 0.012; if (p.y <= gy) { p.y = gy; p.rx = -Math.PI / 2; p.ry = 0; p.ground = R(2, 5); }
      }
      dummy.position.set(p.x, p.y, p.z); dummy.rotation.set(p.rx, p.ry, p.rz); dummy.scale.setScalar(1); dummy.updateMatrix(); petals.setMatrixAt(i, dummy.matrix);
    }
    petals.instanceMatrix.needsUpdate = true;
  }
  // 挡路：树干一圈
  const walk = (WM) => WM.circle(x, z, 0.5);
  return { root, spots, update, walk, setWishes, emaPick, pos: { x, y: y0, z } };
}
