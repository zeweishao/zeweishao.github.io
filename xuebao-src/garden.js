/* 雪宝的童话森林花园（大厅后门出去）
 * 全部程序生成，不另外下载模型：露台 → 玫瑰拱门 → 鹅卵石小路绕着喷泉，分岔到长椅、蘑菇圈、秋千树、睡莲池；
 * 草坪外一圈是童话森林（圆团团的树、开花的树、尖尖的松树），再往外是起伏的小山。
 * 能点的东西（喷泉、池塘、秋千、蘑菇、长椅、拱门）各带一个“去那儿站哪、朝哪、做什么”的说明，交给 hall-scene 的互动系统。
 * 树冠、树干、草、花、石子都用 InstancedMesh，手机上数量减半。
 */
import { mergeGeometries, mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import { buildFlowerSwing, buildLampPost, blossomGeo, leafGeo } from "./garden-props.js";
import { buildBranchingTree, buildTopiaryCrown, buildWishingFountain } from "./garden-models.js";

export function buildGarden(THREE, scene, { D, W, FRONT, mobile }) {
  const Z0 = -D - 0.16; // 后墙外皮
  const FC = { x: 0, z: -11.0 }; // 喷泉（草坪正中）
  const LAWN = { x: 0, z: -11.6, rx: 7.6, rz: 6.6 };
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const R = (a, b) => a + rnd() * (b - a);
  const col = (c) => new THREE.Color(c);
  const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.9, ...o });
  const root = new THREE.Group(); root.name = "garden"; scene.add(root);
  const add = (geo, mat, x, y, z, o = {}) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (o.ry) m.rotation.y = o.ry; if (o.rx) m.rotation.x = o.rx; if (o.rz) m.rotation.z = o.rz; if (o.s) m.scale.setScalar(o.s); m.castShadow = o.cast !== false; m.receiveShadow = true; (o.parent || root).add(m); return m; };
  const lawnE = (x, z) => Math.sqrt(((x - LAWN.x) / LAWN.rx) ** 2 + ((z - LAWN.z) / LAWN.rz) ** 2);

  // ---------- 池塘、地形高度 ----------
  const POND = { x: 3.3, z: -16.0, rx: 1.6, rz: 1.05 };
  const POND_VIEW = { x: 2.06, z: -14.98 };
  const BENCH = { x: 0.46, z: -15.54, yaw: 1.71, front: 0.105 };
  const BENCH_EXIT = { x: BENCH.x + 0.5 * Math.sin(BENCH.yaw), z: BENCH.z + 0.5 * Math.cos(BENCH.yaw) };
  const POND_PATH = 8, HOUSE_PATH = 5;
  const pondE = (x, z) => Math.sqrt(((x - POND.x) / POND.rx) ** 2 + ((z - POND.z) / POND.rz) ** 2);
  const noise = (x, z) => Math.sin(x * 0.7 + 1.3) * Math.cos(z * 0.55 - 0.4) * 0.5 + Math.sin(x * 1.9 + z * 1.3) * 0.18;
  function heightAt(x, z) {
    const e = lawnE(x, z);
    const slope = Math.max(0, Math.abs(x) - 3.0) * THREE.MathUtils.smoothstep(z, -7.5, -5.2) * 0.26;
    // 保持屋内和门口齐平，山坡从侧墙外缓缓升起。
    const roomEdge = 1 - THREE.MathUtils.smoothstep(z, Z0 - 0.95, Z0);
    const sideEdge = THREE.MathUtils.smoothstep(Math.abs(x), W / 2 + 0.2, W / 2 + 2.1);
    const blend = roomEdge + (1 - roomEdge) * sideEdge;
    let h = (Math.max(0, e - 1.08) * (1.5 + noise(x, z) * 0.9) + slope) * blend;
    const pe = pondE(x, z); if (pe < 1.12) h -= 0.14 * (1 - THREE.MathUtils.smoothstep(pe, 0.75, 1.12));
    return h;
  }

  // ---------- 地面：草（画布纹理 + 顶点色深浅） ----------
  const grassTex = (() => {
    const c = document.createElement("canvas"); c.width = c.height = 256; const g = c.getContext("2d");
    g.fillStyle = "#9fbf7a"; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2600; i++) { const x = rnd() * 256, y = rnd() * 256, l = 3 + rnd() * 7; g.strokeStyle = `hsla(${88 + rnd() * 30},${35 + rnd() * 25}%,${46 + rnd() * 22}%,0.55)`; g.lineWidth = 1 + rnd(); g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 3, y - l); g.stroke(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(26, 20); t.anisotropy = 8; return t;
  })();
  {
    const zMin = Z0 - 50, zMax = FRONT + 8;
    const geo = new THREE.PlaneGeometry(70, zMax - zMin, mobile ? 110 : 160, mobile ? 100 : 150).rotateX(-Math.PI / 2);
    geo.translate(0, 0, (zMin + zMax) / 2);
    const p = geo.attributes.position, cols = new Float32Array(p.count * 3), c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      p.setY(i, heightAt(x, z) - 0.045 * THREE.MathUtils.smoothstep(z, Z0 - 0.5, Z0));
      const e = lawnE(x, z), pe = pondE(x, z);
      c.set("#ffffff").lerp(col("#c9dca8"), 0.25 + 0.25 * Math.sin(x * 2.1 + z * 1.7) * Math.sin(z * 0.9));
      if (e > 1.05) c.lerp(col("#7e9a68"), Math.min(0.55, (e - 1.05) * 0.8));
      if (pe < 1.15) c.lerp(col("#8a7a5c"), 1 - THREE.MathUtils.smoothstep(pe, 0.9, 1.15));
      cols.set([c.r, c.g, c.b], i * 3);
    }
    geo.setAttribute("color", new THREE.BufferAttribute(cols, 3)); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, std({ map: grassTex, vertexColors: true, roughness: 1 })); m.receiveShadow = true; m.name = "ground"; root.add(m);
  }

  // ---------- 露台：奶油色石板 + 白色栏杆 ----------
  const marble = std({ color: "#f8f3ea", roughness: 0.4 });
  const flag = (() => {
    const c = document.createElement("canvas"); c.width = c.height = 256; const g = c.getContext("2d");
    g.fillStyle = "#d9cdb8"; g.fillRect(0, 0, 256, 256);
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { const o = j % 2 ? 32 : 0; g.fillStyle = `hsl(${36 + rnd() * 8},${22 + rnd() * 10}%,${84 + rnd() * 6}%)`; g.fillRect(i * 64 + o + 2, j * 64 + 2, 60, 60); g.fillRect(i * 64 + o - 256 + 2, j * 64 + 2, 60, 60); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(4.8, 1.8); t.anisotropy = 8; return t;
  })();
  const TER = { x0: -2.5, x1: 2.5, z0: Z0, z1: -6.5 };
  add(new THREE.PlaneGeometry(TER.x1 - TER.x0, TER.z0 - TER.z1).rotateX(-Math.PI / 2), std({ map: flag, roughness: 0.55 }), 0, 0.012, (TER.z0 + TER.z1) / 2, { cast: false });
  {
    const bal = new THREE.InstancedMesh(new THREE.LatheGeometry([[0, 0], [0.045, 0], [0.03, 0.06], [0.05, 0.2], [0.028, 0.34], [0.04, 0.4], [0, 0.4]].map(([a, b]) => new THREE.Vector2(a, b)), 10), marble, 80);
    const m4 = new THREE.Matrix4(); let n = 0;
    const rail = (ax, az, bx, bz) => {
      const L = Math.hypot(bx - ax, bz - az), k = Math.max(2, Math.round(L / 0.2));
      for (let i = 0; i <= k; i++) { const t = i / k; m4.makeTranslation(ax + (bx - ax) * t, 0.06, az + (bz - az) * t); bal.setMatrixAt(n++, m4); }
      add(new THREE.BoxGeometry(Math.abs(bx - ax) + 0.12, 0.06, Math.abs(bz - az) + 0.12), marble, (ax + bx) / 2, 0.48, (az + bz) / 2);
      add(new THREE.BoxGeometry(Math.abs(bx - ax) + 0.1, 0.06, Math.abs(bz - az) + 0.1), marble, (ax + bx) / 2, 0.03, (az + bz) / 2);
    };
    rail(-2.45, Z0 - 0.15, -2.45, -6.4); rail(2.45, Z0 - 0.15, 2.45, -6.4);
    rail(-2.45, -6.45, -1.0, -6.45); rail(1.0, -6.45, 2.45, -6.45);
    bal.count = n; bal.castShadow = true; bal.receiveShadow = true; root.add(bal);
  }
  // 露台两角的白瓷花盆 + 球形绿篱
  function urnTopiary(x, z, s) {
    const profile = [[0,0],[.128,0],[.137,.02],[.118,.058],[.087,.078],[.086,.11],[.148,.15],[.185,.27],[.2,.325],[.218,.348],[.217,.38],[.2,.397],[.181,.397],[.173,.36],[0,.346]];
    add(new THREE.LatheGeometry(profile.map(([r,y])=>new THREE.Vector2(r*s,y*s)),26),marble,x,0,z);
    add(new THREE.CircleGeometry(.168*s,24).rotateX(-Math.PI/2),std({color:"#705443"}),x,.349*s,z,{cast:false});
    add(new THREE.CylinderGeometry(.011*s,.018*s,.235*s,9),std({color:"#795940"}),x,.456*s,z,{rz:x<0?-.105:.105});
    const crown=buildTopiaryCrown(THREE,root,.268*s,x+z);
    crown.position.set(x+(x<0?.025:-.025)*s,.733*s,z);
  }
  [[-2.15, -6.15], [2.15, -6.15], [-1.25, -6.15], [1.25, -6.15]].forEach(([x, z]) => urnTopiary(x, z, 0.95));

  // ---------- 小路：鹅卵石（主路 → 喷泉环 → 四条小岔路） ----------
  const C = (pts) => new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, 0, z)));
  const PATHS = [
    C([[0, -6.4], [0, -7.6], [0, -9.0]]),
    new THREE.EllipseCurve(FC.x, FC.z, 2.0, 2.0, 0, Math.PI * 2),
    C([[-1.45, -9.6], [-2.1, -9.1], [-2.68, -8.75]]),
    C([[1.45, -9.6], [2.1, -9.1], [2.55, -8.95]]),
    C([[-2.0, -11.0], [-3.13, -10.98], [-4.17, -12.02]]),
    C([[2.0, -11.0], [2.78, -11.55], [3.01, -12.34], [3.57, -12.4]]),
    C([[-1.75, -12.0], [-2.8, -12.35], [-3.75, -12.55]]),
    C([[-1.3, -12.5], [-1.9, -13.9], [-2.45, -14.9]]),
    C([[1.3, -12.5], [1.42, -13.62], [1.75, -14.39], [POND_VIEW.x, POND_VIEW.z]]),
    C([[0, -13.0], [0.15, -15.0], [0, -17.04]])
  ];
  const pathPts = (crv, step = 0.16) => {
    const L = crv.getLength(), n = Math.max(2, Math.round(L / step)), out = [];
    for (let i = 0; i <= n; i++) { const p = crv.getPointAt(i / n); out.push(p.isVector2 ? [p.x, p.y] : [p.x, p.z]); }
    return out;
  };
  const PATH_POLY = PATHS.map((c) => pathPts(c, 0.25));
  {
    // 鹅卵石铺在连续的浅色砂砾路基上，岔口之间自然并合。
    const width = 0.31, verts = [], indices = [], colors = [];
    const edge = col("#b7a486"), center = col("#d5c5aa");
    for (const [pathIndex, curve] of PATHS.entries()) {
      if (pathIndex === HOUSE_PATH) continue;
      const path = pathPts(curve, 0.16), closed = pathIndex === 1;
      const isPond = pathIndex === POND_PATH;
      const offset = verts.length / 3;
      path.forEach(([x, z], i) => {
        const before = path[i - 1] ?? path[closed ? path.length - 2 : 0];
        const after = path[i + 1] ?? path[closed ? 1 : path.length - 1];
        const dx = after[0] - before[0], dz = after[1] - before[1], len = Math.hypot(dx, dz);
        const taper = pathIndex === 0 ? 1.55 : closed ? 1 : Math.min(1, 0.49 + Math.min(i, path.length - 1 - i) * 0.23);
        const finish = isPond ? Math.max(0, 1 - i / (path.length * 0.52)) : 1;
        for (const band of [-1, -0.72, 0, 0.72, 1]) {
          const w = width * taper * finish * band;
          const px = x - dz * w / len, pz = z + dx * w / len;
          verts.push(px, heightAt(px, pz) + 0.004 + (1 - Math.abs(band)) * 0.006, pz);
          const tone = Math.abs(band) === 1 ? edge : center;
          colors.push(tone.r, tone.g, tone.b);
        }
        if (!i) return;
        for (let j = 0; j < 4; j++) {
          const a = offset + (i - 1) * 5 + j, b = a + 5;
          indices.push(a, a + 1, b, a + 1, b + 1, b);
        }
      });
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    const bed = add(geo, std({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -1 }), 0, 0, 0, { cast: false });
    bed.userData.noHit = true;
  }
  {
    const N = mobile ? 1200 : 2000;
    const stones = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1.06, 1, 7), std({ roughness: 0.75 }), N);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), c = new THREE.Color(); let n = 0;
    const gravelPaths = PATHS.filter((_, i) => i !== POND_PATH && i !== HOUSE_PATH && i !== 0);
    for (const crv of gravelPaths) for (const [x, z] of pathPts(crv, 0.12)) for (let k = 0; k < 4 && n < N; k++) {
      const px = x + R(-0.24, 0.24), pz = z + R(-0.24, 0.24), r = R(0.04, 0.075);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), R(0, 6)); s.set(r * R(0.9, 1.3), R(0.02, 0.035), r);
      m4.compose(new THREE.Vector3(px, heightAt(px, pz) + 0.008, pz), q, s); stones.setMatrixAt(n, m4);
      stones.setColorAt(n++, c.set(["#cfc3ae", "#bfb29c", "#d9cfbd", "#b5a893"][k % 4]).offsetHSL(0, 0, R(-0.05, 0.03)));
    }
    stones.count = n; stones.receiveShadow = true; root.add(stones);
  }

  // 露台规整铺石，池边换作错落的踏石，展亭小径接到台基。
  {
    const pavement = std({ roughness: 0.83 });
    const stone = new THREE.CylinderGeometry(1, 1.03, 1, 8).rotateY(Math.PI / 8);
    const pieces = [];
    pathPts(PATHS[0], 0.26).forEach(([x, z], i) => {
      for (const side of [-1, 1]) pieces.push([x + side * 0.226, z, 0.251, 0.143, 0, i + side]);
    });
    pathPts(PATHS[HOUSE_PATH], 0.23).forEach(([x, z], i, all) => {
      const [nx, nz] = all[Math.min(i + 1, all.length - 1)];
      const [px, pz] = all[Math.max(i - 1, 0)];
      pieces.push([x, z, 0.3, 0.13, Math.atan2(nx - px, nz - pz), i]);
    });
    pathPts(PATHS[POND_PATH], 0.32).forEach(([x, z], i, all) => {
      const r = i === all.length - 1 ? 0.34 : 0.22;
      pieces.push([x + Math.sin(i * 2.4) * 0.064, z, r, 0.125 + (i % 2) * 0.03, Math.sin(i) * 0.34, i]);
    });
    pieces.push([-4.01,-12.40,0.49,0.41,0.26,2],[-4.31,-12.78,0.42,0.42,0.27,1],[-4.57,-12.39,0.36,0.39,0.35,3]);
    const paving = new THREE.InstancedMesh(stone, pavement, pieces.length);
    const transform = new THREE.Object3D(), shade = new THREE.Color();
    pieces.forEach(([x, z, w, d, yaw, i], n) => {
      transform.position.set(x, heightAt(x, z) + 0.009, z);
      transform.rotation.y = yaw; transform.scale.set(w, 0.042, d); transform.updateMatrix();
      paving.setMatrixAt(n, transform.matrix);
      paving.setColorAt(n, shade.set(["#e1ccaf","#eadbc4","#d6c2a9","#dfcfbb"][Math.abs(i) % 4]));
    });
    paving.receiveShadow = true; paving.userData.noHit = true; root.add(paving);
  }

  // ---------- 玫瑰许愿泉 ----------
  const water = new THREE.MeshStandardMaterial({ color: "#9fd0e0", roughness: 0.06, metalness: 0.15, transparent: true, opacity: 0.82 });
  const fountain = new THREE.Group(); fountain.position.set(FC.x, 0, FC.z); root.add(fountain);
  const wishRing = buildWishingFountain(THREE, fountain, marble, water);
  let wishAge = Infinity;
  const dropTex = (() => { const c = document.createElement("canvas"); c.width = c.height = 32; const g = c.getContext("2d"); const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.5, "rgba(220,240,255,.5)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c); })();
  const ND = mobile ? 160 : 260, dp = new Float32Array(ND * 3), dSeed = Array.from({ length: ND }, () => [rnd(), rnd(), rnd()]);
  const dGeo = new THREE.BufferGeometry(); dGeo.setAttribute("position", new THREE.BufferAttribute(dp, 3));
  const drops = new THREE.Points(dGeo, new THREE.PointsMaterial({ map: dropTex, size: 0.032, transparent: true, opacity: 0.76, depthWrite: false, color: "#eaf6ff" })); drops.frustumCulled = false; fountain.add(drops);
  let burst = 0;

  // ---------- 池塘：睡莲、荷花、芦苇、锦鲤、水波 ----------
  const pond = new THREE.Group(); pond.position.set(POND.x, 0, POND.z); root.add(pond);
  const pondWater = add(new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: "#7fb9c9", roughness: 0.04, metalness: 0.2, transparent: true, opacity: 0.78 }), 0, -0.03, 0, { parent: pond, cast: false });
  pondWater.scale.set(POND.rx, 1, POND.rz); pondWater.renderOrder = 1;
  {
    const N = mobile ? 24 : 31, rim = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), std({ color: "#ddd4c6", roughness: 0.8 }), N);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
    for (let i = 0; i < N; i++) {
      const a = (i / N) * 5.48 + 2.88, r = R(0.105, 0.23);
      const x = Math.cos(a) * (POND.rx + 0.065), z = Math.sin(a) * (POND.rz + 0.05);
      q.setFromEuler(new THREE.Euler(R(0, 3), R(0, 3), R(0, 3)));
      m4.compose(new THREE.Vector3(x, heightAt(POND.x + x, POND.z + z) - 0.017, z),
        q, new THREE.Vector3(r * 1.2, r * R(0.28, 0.6), r));
      rim.setMatrixAt(i, m4); rim.setColorAt(i, c.set(i % 4 ? "#f6e9d6" : "#aeaf8c").offsetHSL(0, 0, -rnd() * 0.13));
    }
    rim.castShadow = rim.receiveShadow = true; pond.add(rim);
    const pad = new THREE.CircleGeometry(0.16, 18, 0.3, Math.PI * 2 - 0.6).rotateX(-Math.PI / 2);
    const pads = new THREE.InstancedMesh(pad, std({ color: "#7aa35f", side: THREE.DoubleSide, roughness: 0.6 }), 9);
    for (let i = 0; i < 9; i++) { const a = i < 5 ? R(0.16, 1.45) : R(3.05, 4.24), r = R(0.53, 0.83); q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), R(0, 6)); const s = R(0.7, 1.3); m4.compose(new THREE.Vector3(Math.cos(a) * r * POND.rx, -0.015, Math.sin(a) * r * POND.rz), q, new THREE.Vector3(s, 1, s)); pads.setMatrixAt(i, m4); }
    pad.translate(0, 0, 0); pads.receiveShadow = true; pond.add(pads);
    const lotus = std({ color: "#f6b9c8", roughness: 0.6 });
    [[0.57, 0.36], [0.42, 0.05], [-0.56, -0.35]].forEach(([x, z]) => { for (let k = 0; k < 6; k++) { const pt = add(new THREE.SphereGeometry(0.05, 10, 8), lotus, x * POND.rx + Math.cos(k) * 0.03, 0.02, z * POND.rz + Math.sin(k) * 0.03, { parent: pond, cast: false }); pt.scale.set(0.6, 1.4, 0.6); pt.rotation.set(Math.cos(k) * 0.6, 0, Math.sin(k) * 0.6); } add(new THREE.SphereGeometry(0.03, 8, 6), std({ color: "#ffe08a" }), x * POND.rx, 0.04, z * POND.rz, { parent: pond, cast: false }); });
    const reed = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.008, 0.012, 1, 5).translate(0, 0.5, 0), std({ color: "#7d9a55" }), 40);
    for (let i = 0; i < 40; i++) { const a = i % 2 ? R(-0.44, 0.15) : R(3.49, 4.16), x = Math.cos(a) * (POND.rx + R(-0.05, 0.15)), z = Math.sin(a) * (POND.rz + R(-0.05, 0.15)); q.setFromEuler(new THREE.Euler(R(-0.15, 0.15), 0, R(-0.15, 0.15))); m4.compose(new THREE.Vector3(x, -0.05, z), q, new THREE.Vector3(1, R(0.4, 0.8), 1)); reed.setMatrixAt(i, m4); }
    reed.castShadow = true; pond.add(reed);
  }
  const koi = [0, 1, 2].map((i) => {
    const g = new THREE.Group(); const body = add(new THREE.SphereGeometry(0.05, 12, 8), std({ color: i === 1 ? "#fff6ee" : "#ff8a4c", roughness: 0.4 }), 0, 0, 0, { parent: g, cast: false }); body.scale.set(0.6, 0.45, 1.6);
    add(new THREE.ConeGeometry(0.035, 0.06, 6).rotateX(Math.PI / 2), std({ color: "#ffb08a" }), 0, 0, -0.1, { parent: g, cast: false });
    pond.add(g); return { g, ph: i * 2.1, sp: 0.35 + i * 0.07, r: 0.45 + i * 0.12, jump: -1 };
  });
  const ripples = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(() => { const m = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0, depthWrite: false })); m.position.y = -0.02; pond.add(m); return { m, t: 9 }; });
  let rippleK = 0; const ripple = (x, z) => { const r = ripples[rippleK++ % ripples.length]; r.t = 0; r.m.position.x = x; r.m.position.z = z; };

  // ---------- 树：圆团团的、开花的、尖尖的松树（树冠、树干都实例化） ----------
  // 树冠团：表面一簇簇鼓起来像叶团，顶点色做出“上亮下暗、里面深”的层次，比纯色圆球立体
  const blobGeo = (() => {
    const g = mergeVertices(new THREE.IcosahedronGeometry(1, mobile ? 4 : 5).deleteAttribute("normal").deleteAttribute("uv")), p = g.attributes.position, cols = new Float32Array(p.count * 3);
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const lump = 0.075 * Math.sin(v.x * 7) * Math.sin(v.y * 6.3) * Math.sin(v.z * 7.7) + 0.045 * Math.abs(Math.sin(v.x * 15.3 + v.z * 3.1) * Math.sin(v.y * 14.1 - v.x * 2.3) * Math.sin(v.z * 16.7 + v.y));
      v.multiplyScalar(1 + lump); p.setXYZ(i, v.x, v.y, v.z);
      const shade = 0.62 + 0.3 * THREE.MathUtils.smoothstep(v.y, -0.9, 0.85) + lump * 2.2;
      cols.set([shade * 0.97, shade, shade * 0.93], i * 3);
    }
    g.setAttribute("color", new THREE.BufferAttribute(cols, 3)); g.computeVertexNormals(); return g;
  })();
  const TREES = [], blobs = [], trunks = [], cones = [], dots = [];
  const GREENS = ["#6f9a5c", "#83a865", "#5d8a4f", "#9bb873", "#7aa06a"], BLOSSOM = ["#f2bfc8", "#f7d6dc", "#e9a9b9", "#fbe6ea"], LAV = ["#c9a8de", "#d9c0ea"];
  function tree(x, z, s, kind) {
    const y = heightAt(x, z); TREES.push({ x, z, r: 0.22 * s });
    if (kind === "pine") {
      trunks.push([x, y - 0.3, z, 0.1 * s, 0.7 * s + 0.3]);
      for (let k = 0; k < 3; k++) cones.push([x, y + (0.55 + k * 0.5) * s, z, (0.85 - k * 0.22) * s, (1.0 - k * 0.12) * s]);
      return;
    }
    const pal = kind === "blossom" ? BLOSSOM : kind === "lav" ? LAV : GREENS, h = R(1.1, 1.6) * s;
    trunks.push([x, y - 0.3, z, 0.11 * s, h + 0.6 * s]);
    // 云朵树冠：中间一大团，外圈一圈低一点的小团，顶上再冒一团，比单个圆球自然
    const pick = () => pal[Math.floor(rnd() * pal.length)];
    blobs.push([x, y + h + 0.3 * s, z, R(0.72, 0.88) * s, pick()]);
    const ring = 5 + Math.floor(rnd() * 3), a0 = rnd() * 6.28;
    for (let k = 0; k < ring; k++) { const a = a0 + (k / ring) * 6.28 + R(-0.25, 0.25), d = R(0.48, 0.7) * s; blobs.push([x + Math.cos(a) * d, y + h + R(-0.05, 0.22) * s, z + Math.sin(a) * d, R(0.4, 0.58) * s, pick()]); }
    blobs.push([x + R(-0.15, 0.15) * s, y + h + R(0.75, 0.9) * s, z + R(-0.15, 0.15) * s, R(0.42, 0.55) * s, pick()]);
    // 树冠表面点缀：开花树撒小花，绿树偶尔挂几颗小果子
    const nd = kind === "blossom" ? 14 : kind === "lav" ? 10 : rnd() < 0.35 ? 6 : 0, dc = kind === "blossom" ? ["#fff4f6", "#f7c6d2", "#ffffff"] : kind === "lav" ? ["#f3e8ff", "#e6d3f5"] : ["#f7d26b", "#f29a8a"];
    for (let k = 0; k < nd; k++) { const a = rnd() * 6.28, el = R(-0.15, 0.95), cr = Math.cos(el) * R(0.82, 0.95) * s; dots.push([x + Math.cos(a) * cr, y + h + 0.3 * s + Math.sin(el) * 0.72 * s, z + Math.sin(a) * cr, R(0.05, 0.075) * s, dc[k % dc.length]]); }
  }
  const SW = { x: -3.7, z: -16.0 };
  const smallCrown = new THREE.IcosahedronGeometry(1, 1);
  for (const [x, z, scale, oak] of [
    [SW.x, SW.z, 1, true], [-3.65, -6.35, 0.94, false], [4.0, -6.68, 0.86, false],
    [7.43, -14.09, 0.96, false], [-4.8, -8.76, 1.02, false],
    [-1.65,-17.18,.92,false], [2.47,-17.64,.82,false], [5.3,-16.72,.89,false]
  ]) {
    buildBranchingTree(THREE, root, { x, z, scale, oak, heightAt, canopy: blobGeo, leaves: smallCrown, mobile });
    TREES.push({ x, z, r: (oak ? 0.39 : 0.22) * scale });
  }
  // 草坪外一圈 + 露台两边 + 远处小山
  for (let i = 0, tries = 0; i < (mobile ? 70 : 105) && tries < 2000; tries++) {
    const a = rnd() * Math.PI * 2, e = R(1.18, 2.7), x = LAWN.x + Math.cos(a) * LAWN.rx * e, z = LAWN.z + Math.sin(a) * LAWN.rz * e;
    if (z > -5.4 || (Math.abs(x) < 3.2 && z > -7) || (x > 3 && x < 8.2 && z < -9.8 && z > -15)) continue;
    if (TREES.some((t) => (t.x - x) ** 2 + (t.z - z) ** 2 < 1.1)) continue;
    const r = rnd(); tree(x, z, R(0.72, 1.49) * (e > 2 ? 1.15 : 1), r < 0.2 ? "pine" : r < 0.42 ? "blossom" : r < 0.5 ? "lav" : "round"); i++;
  }
  const swing = new THREE.Group(); swing.position.set(-2.7, 2.6, -15.6); root.add(swing);
  {
    buildFlowerSwing(THREE, swing, { mobile });
  }
  let swingA = 0, swingV = 0;

  // 实例化：树冠、树干、松树
  {
    const bm = new THREE.InstancedMesh(blobGeo, std({ roughness: 0.92, vertexColors: true }), blobs.length), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
    blobs.forEach(([x, y, z, r, cc], i) => { q.setFromEuler(new THREE.Euler(0, rnd() * 6, 0)); m4.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(r * (.92 + .15 * Math.sin(i * 2.4)), r * (.78 + .14 * Math.cos(i * 1.4)), r)); bm.setMatrixAt(i, m4); bm.setColorAt(i, c.set(cc)); });
    bm.castShadow = bm.receiveShadow = true; root.add(bm);
    const tm = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.6, 1, 1, 8).translate(0, 0.5, 0), std({ color: "#7b5a43" }), trunks.length);
    trunks.forEach(([x, y, z, r, h], i) => { m4.compose(new THREE.Vector3(x, y - 0.05, z), q.identity(), new THREE.Vector3(r, h, r)); tm.setMatrixAt(i, m4); });
    tm.castShadow = tm.receiveShadow = true; root.add(tm);
    // 松树每一层是“裙摆”：边缘一圈尖尖往下垂，底下暗顶上亮
    const pineGeo = (() => { const g = new THREE.ConeGeometry(1, 1, 18, 4, true).translate(0, 0.5, 0), p = g.attributes.position, cl = new Float32Array(p.count * 3); for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x), rim = 1 - y; const tooth = rim > 0.98 ? -0.12 * (0.5 + 0.5 * Math.cos(a * 9)) : 0; const bulge = 1 + 0.12 * Math.sin(y * Math.PI); p.setXYZ(i, x * bulge, y + tooth, z * bulge); const sh = 0.68 + 0.38 * y + (rim > 0.98 ? -0.06 : 0); cl.set([sh, sh, sh], i * 3); } g.setAttribute("color", new THREE.BufferAttribute(cl, 3)); g.computeVertexNormals(); return g; })();
    const cm = new THREE.InstancedMesh(pineGeo, std({ color: "#ffffff", vertexColors: true, side: THREE.DoubleSide }), Math.max(1, cones.length));
    cones.forEach(([x, y, z, r, h], i) => { q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), i * 1.7); m4.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(r, h, r)); cm.setMatrixAt(i, m4); cm.setColorAt(i, c.set(["#55805a", "#5f8f63", "#4e7a58"][i % 3])); });
    cm.count = cones.length; cm.castShadow = cm.receiveShadow = true; root.add(cm);
    if (dots.length) { const dm = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), std({ roughness: 0.6 }), dots.length); dots.forEach(([x, y, z, r, cc], i) => { m4.compose(new THREE.Vector3(x, y, z), q.identity(), new THREE.Vector3(r, r * 0.8, r)); dm.setMatrixAt(i, m4); dm.setColorAt(i, c.set(cc)); }); dm.userData.noHit = true; root.add(dm); }
  }
  // 草坪边上的花丛灌木
  {
    const N = mobile ? 40 : 64, bm = new THREE.InstancedMesh(blobGeo, std({ roughness: 0.95, vertexColors: true }), N), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color(); let n = 0;
    for (let i = 0; i < N * 3 && n < N; i++) {
      const a = rnd() * 6.28, e = R(1.0, 1.14), x = LAWN.x + Math.cos(a) * LAWN.rx * e, z = LAWN.z + Math.sin(a) * LAWN.rz * e;
      if (z > -6.7) continue;
      const r = R(0.22, 0.42); m4.compose(new THREE.Vector3(x, heightAt(x, z) + r * 0.5, z), q, new THREE.Vector3(r * 1.2, r * 0.85, r)); bm.setMatrixAt(n, m4); bm.setColorAt(n++, c.set(GREENS[n % GREENS.length]).offsetHSL(0, 0, -0.04));
    }
    bm.count = n; bm.castShadow = bm.receiveShadow = true; root.add(bm);
  }

  // ---------- 小花：路两边、草坪上一簇一簇 ----------
  const onPath = (x, z, w = 0.42) => PATH_POLY.some((pl) => pl.some(([px, pz]) => (px - x) ** 2 + (pz - z) ** 2 < w * w));
  const blocked = (x, z) => Math.hypot(x - FC.x, z - FC.z) < 1.25 || pondE(x, z) < 1.2 || Math.hypot(x - SW.x, z - SW.z) < 0.5 || Math.hypot(x - 5.3, z + 12.4) < 2.25 || Math.hypot(x + 4.6, z + 12.6) < 0.8 || Math.hypot(x + 3.0, z + 8.4) < 0.5;
  {
    const N = mobile ? 420 : 760, FL = ["#f7b4c4", "#ffffff", "#f9d86b", "#c7a6e6", "#ff9db0", "#bfe0ff"];
    // 花头：五六片圆头花瓣微微上翘围成小碗，中间单独一颗花心；茎上两片小叶子
    const petalHead = (() => {
      const parts = [], np = 6;
      for (let k = 0; k < np; k++) {
        const pg = new THREE.SphereGeometry(1, 10, 6); pg.scale(0.42, 0.09, 0.26); pg.translate(0.5, 0, 0); pg.rotateZ(0.32); pg.rotateY((k / np) * Math.PI * 2);
        const cl = new Float32Array(pg.attributes.position.count * 3); for (let i = 0; i < pg.attributes.position.count; i++) { const r = Math.hypot(pg.attributes.position.getX(i), pg.attributes.position.getZ(i)); const sh = 0.78 + 0.26 * Math.min(1, r / 0.85); cl.set([sh, sh, sh], i * 3); }
        pg.setAttribute("color", new THREE.BufferAttribute(cl, 3)); pg.deleteAttribute("uv"); parts.push(pg);
      }
      return mergeGeometries(parts);
    })();
    const tulipHead = (() => { const g = new THREE.LatheGeometry([[0, -0.2], [0.55, -0.1], [0.75, 0.35], [0.62, 0.9], [0.5, 1.0]].map(([a, b]) => new THREE.Vector2(a, b)), 12); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y > 0.95) { const a = Math.atan2(p.getZ(i), p.getX(i)); p.setY(i, y + 0.18 * Math.cos(a * 3)); } } g.computeVertexNormals(); const cl = new Float32Array(p.count * 3); for (let i = 0; i < p.count; i++) { const sh = 0.75 + 0.3 * Math.min(1, Math.max(0, p.getY(i))); cl.set([sh, sh, sh], i * 3); } g.setAttribute("color", new THREE.BufferAttribute(cl, 3)); g.deleteAttribute("uv"); return g; })();
    const leafGeo = (() => { const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.quadraticCurveTo(0.45, 0.35, 0, 1); sh.quadraticCurveTo(-0.45, 0.35, 0, 0); const g = new THREE.ShapeGeometry(sh, 4); g.rotateX(-0.9); return g; })();
    const flowerMat = std({ roughness: 0.55, vertexColors: true, side: THREE.DoubleSide });
    const head = new THREE.InstancedMesh(petalHead, flowerMat, N), tulip = new THREE.InstancedMesh(tulipHead, flowerMat, Math.ceil(N * 0.3));
    const heart = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), std({ roughness: 0.5 }), N);
    const stem = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.004, 0.006, 1, 5).translate(0, 0.5, 0), std({ color: "#6f9452" }), N + tulip.count);
    const leaf = new THREE.InstancedMesh(leafGeo, std({ color: "#7aa35a", side: THREE.DoubleSide, roughness: 0.8 }), (N + tulip.count) * 2);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color(), up = new THREE.Vector3(0, 1, 0), eu = new THREE.Euler(); let n = 0, nt = 0, ns = 0, nl = 0;
    const HEARTS = { "#ffffff": "#f9d34f", "#fff1e2": "#f6c64a" };
    const put = (x, z) => {
      if (n >= N || blocked(x, z) || onPath(x, z, 0.39)) return; const y = heightAt(x, z), h = R(0.06, 0.13), r = R(0.04, 0.062), yaw = rnd() * 6.28, isTulip = nt < tulip.count && rnd() < 0.22;
      m4.compose(new THREE.Vector3(x, y, z), q.setFromAxisAngle(up, yaw), new THREE.Vector3(1, h, 1)); stem.setMatrixAt(ns++, m4);
      for (let k = 0; k < 2; k++) { const ls = R(0.035, 0.055); m4.compose(new THREE.Vector3(x, y + h * R(0.15, 0.45), z), q.setFromEuler(eu.set(0, yaw + k * Math.PI + R(-0.4, 0.4), 0)), new THREE.Vector3(ls, ls, ls)); leaf.setMatrixAt(nl++, m4); }
      const fc = FL[Math.floor(rnd() * FL.length)];
      q.setFromEuler(eu.set(R(-0.25, 0.25), yaw, R(-0.25, 0.25)));
      if (isTulip) { m4.compose(new THREE.Vector3(x, y + h, z), q, new THREE.Vector3(r * 0.75, r * 1.1, r * 0.75)); tulip.setMatrixAt(nt, m4); tulip.setColorAt(nt++, c.set(fc)); return; }
      m4.compose(new THREE.Vector3(x, y + h, z), q, new THREE.Vector3(r, r, r)); head.setMatrixAt(n, m4); head.setColorAt(n, c.set(fc));
      m4.compose(new THREE.Vector3(x, y + h + r * 0.06, z), q, new THREE.Vector3(r * 0.24, r * 0.16, r * 0.24)); heart.setMatrixAt(n, m4); heart.setColorAt(n++, c.set(HEARTS[fc] || "#fff3c4"));
    };
    for (const [cx, cz, flower] of [
      [-0.77,-16.01,"#f8d6df"], [1.09,-16.56,"#d6bbec"], [4.63,-16.87,"#fff1e2"],
      [-1.17,-8.6,"#f7b4c4"], [1.19,-8.58,"#f7b4c4"], [-4.23,-13.13,"#f5de9e"]
    ]) {
      const first = n, count = mobile ? 8 : 15;
      for (let i = 0; i < count; i++) {
        const a = i * 2.39996, r = 0.065 + Math.sqrt(i / count) * 0.31;
        put(cx + Math.cos(a) * r, cz + Math.sin(a) * r);
      }
      for (let i = first; i < n; i++) head.setColorAt(i, c.set(flower).offsetHSL(0, 0, i % 2 ? -0.035 : 0.017));
    }
    for (const pl of PATH_POLY) for (const [x, z] of pl) for (let k = 0; k < 2; k++) { const a = rnd() * 6.28; put(x + Math.cos(a) * R(0.38, 0.6), z + Math.sin(a) * R(0.38, 0.6)); }
    for (let cl = 0; cl < 16; cl++) { const a = rnd() * 6.28, e = R(0.3, 1.05), cx = LAWN.x + Math.cos(a) * LAWN.rx * e, cz = LAWN.z + Math.sin(a) * LAWN.rz * e; if (cz > -6.8) continue; const cc = FL[cl % FL.length]; const n0 = n; for (let k = 0; k < 14; k++) put(cx + R(-0.35, 0.35), cz + R(-0.35, 0.35)); for (let k = n0; k < n; k++) head.setColorAt(k, c.set(cc)); }
    head.count = heart.count = n; tulip.count = nt; stem.count = ns; leaf.count = nl;
    [head, heart, tulip, stem, leaf].forEach((m) => { m.userData.noHit = true; m.castShadow = false; m.receiveShadow = true; });
    if (head.instanceColor) head.instanceColor.needsUpdate = true; root.add(head, heart, tulip, stem, leaf);
  }
  // ---------- 草丛（随风轻摆） ----------
  const windU = { value: 0 };
  {
    const N = mobile ? 3200 : 6400;
    const blade = new THREE.BufferGeometry(), V = [];
    // 一丛 7 根弯弯的细长草叶：根部宽、尖上细，往外弯；根部暗绿、尖上嫩黄绿
    const CL = [], IDX = [], SEG = 3; let vi = 0;
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2 + Math.sin(k * 3.1) * 0.4, ox = Math.cos(a) * 0.02, oz = Math.sin(a) * 0.02, lean = 0.05 + (k % 3) * 0.025, hk = 0.7 + ((k * 37) % 10) / 22, w = 0.011;
      const px = -Math.sin(a), pz = Math.cos(a);
      for (let sg = 0; sg <= SEG; sg++) {
        const t = sg / SEG, bend = lean * t * t, ww = w * (1 - t * 0.92), cx = ox + Math.cos(a) * bend, cz = oz + Math.sin(a) * bend, yy = t * hk;
        V.push(cx - px * ww, yy, cz - pz * ww, cx + px * ww, yy, cz + pz * ww);
        const r = 0.6 + 0.36 * t, g = 0.78 + 0.22 * t, b = 0.5 + 0.12 * t; CL.push(r, g, b, r, g, b);
        if (sg) { const o = vi - 2; IDX.push(o, o + 1, o + 2, o + 1, o + 3, o + 2); }
        vi += 2;
      }
    }
    blade.setAttribute("position", new THREE.Float32BufferAttribute(V, 3)); blade.setAttribute("color", new THREE.Float32BufferAttribute(CL, 3)); blade.setIndex(IDX); blade.computeVertexNormals();
    const nrm = blade.attributes.normal; for (let i = 0; i < nrm.count; i++) { const x = nrm.getX(i) * 0.3, z = nrm.getZ(i) * 0.3, l = Math.hypot(x, 1, z); nrm.setXYZ(i, x / l, 1 / l, z / l); } // 法线朝上，草地受光均匀不发黑
    const mat = std({ color: "#b9d98a", side: THREE.DoubleSide, roughness: 1, vertexColors: true });
    mat.onBeforeCompile = (sh) => { sh.uniforms.uWind = windU; sh.vertexShader = "uniform float uWind;\n" + sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n  vec4 wp = instanceMatrix * vec4(0.,0.,0.,1.);\n  transformed.x += sin(uWind * 1.7 + wp.x * 1.3 + wp.z * 0.7) * 0.035 * position.y;\n  transformed.z += cos(uWind * 1.3 + wp.z * 1.1) * 0.02 * position.y;"); };
    const grass = new THREE.InstancedMesh(blade, mat, N), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color(); let n = 0;
    for (let i = 0; i < N * 3 && n < N; i++) {
      const a = rnd() * 6.28, e = Math.sqrt(rnd()) * 1.3, x = LAWN.x + Math.cos(a) * LAWN.rx * e, z = LAWN.z + Math.sin(a) * LAWN.rz * e;
      if (z > -6.6 || blocked(x, z) || onPath(x, z, 0.43)) continue;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * 6); const h = R(0.045, 0.09); m4.compose(new THREE.Vector3(x, heightAt(x, z) - 0.005, z), q, new THREE.Vector3(R(1.1, 1.6), h, R(1.1, 1.6)));
      grass.setMatrixAt(n, m4); grass.setColorAt(n++, c.set("#ffffff").offsetHSL(R(-0.03, 0.03), 0, R(-0.12, 0.05)));
    }
    grass.count = n; grass.receiveShadow = true; grass.userData.noHit = true; root.add(grass);
  }

  // ---------- 玫瑰拱门 ----------
  const ARCH = { z: -7.3 };
  const archG = new THREE.Group(); archG.position.set(0, 0, ARCH.z); root.add(archG);
  {
    const iron = std({ color: "#fbf8f2", roughness: 0.4, metalness: 0.2 });
    [-0.78, 0.78].forEach((x) => add(new THREE.CylinderGeometry(0.03, 0.03, 1.7, 8).translate(0, 0.85, 0), iron, x, 0, 0, { parent: archG }));
    add(new THREE.TorusGeometry(0.78, 0.03, 8, 40, Math.PI), iron, 0, 1.7, 0, { parent: archG });
    const leaves = new THREE.InstancedMesh(blobGeo, std({ color: "#6f9a5c" }), 60);
    const petal = new THREE.SphereGeometry(1, 8, 6);
    const bloomParts = [petal.clone().scale(0.45, 0.45, 0.48).translate(0, 0, 0.48)];
    for (let i = 0; i < 10; i++) {
      const a = i * 2.39996, r = 0.42 + 0.034 * i;
      bloomParts.push(petal.clone().scale(0.36, 0.57, 0.24).rotateX(-0.55).translate(0, r, 0.34 - i * 0.025).rotateZ(a));
    }
    const bloom = mergeGeometries(bloomParts);
    bloomParts.forEach((g) => g.dispose()); petal.dispose();
    const roses = new THREE.InstancedMesh(bloom, std({ roughness: 0.67 }), 70);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color(); let nl = 0, nr = 0;
    const along = (t) => t < 0.33 ? [-0.78, (t / 0.33) * 1.7] : t > 0.67 ? [0.78, ((1 - t) / 0.33) * 1.7] : (() => { const a = Math.PI - ((t - 0.33) / 0.34) * Math.PI; return [Math.cos(a) * 0.78, 1.7 + Math.sin(a) * 0.78]; })();
    for (let i = 0; i < 60; i++) { const [x, y] = along(i / 59); const r = R(0.09, 0.14); m4.compose(new THREE.Vector3(x + R(-0.05, 0.05), y, R(-0.07, 0.07)), q, new THREE.Vector3(r, r, r)); leaves.setMatrixAt(nl++, m4); }
    for (let i = 0; i < 70; i++) { const [x, y] = along(rnd()); const r = R(0.047, 0.072); q.setFromEuler(new THREE.Euler(Math.sin(i) * 0.45, i % 2 ? 0 : Math.PI, i * 2.4)); m4.compose(new THREE.Vector3(x + R(-0.09, 0.09), y + R(-0.05, 0.05), R(-0.1, 0.1) + (i % 2 ? 0.045 : -0.045)), q, new THREE.Vector3(r, r, r)); roses.setMatrixAt(nr, m4); roses.setColorAt(nr++, c.set(["#f2a9b8", "#fbe0e4", "#e4889c", "#ffffff"][i % 4])); }
    leaves.castShadow = roses.castShadow = true; archG.add(leaves, roses);
  }

  // ---------- 长椅 ----------
  {
    const g = new THREE.Group(); g.position.set(BENCH.x, heightAt(BENCH.x, BENCH.z), BENCH.z); g.rotation.y = BENCH.yaw; g.scale.y = .247 / .4325; root.add(g);
    const wood = std({ color: "#c9a27c", roughness: 0.75 }), iron = std({ color: "#f6f1e8", roughness: 0.4 });
    for (let k = 0; k < 4; k++) add(new THREE.BoxGeometry(1.1, 0.025, 0.07), wood, 0, 0.42, -0.12 + k * 0.08, { parent: g });
    for (let k = 0; k < 3; k++) add(new THREE.BoxGeometry(1.1, 0.07, 0.025), wood, 0, 0.55 + k * 0.1, -0.2 - k * 0.012, { parent: g, rx: -0.15 });
    [-0.5, 0.5].forEach((x) => { add(new THREE.BoxGeometry(0.04, 0.42, 0.04), iron, x, 0.21, 0.12, { parent: g }); add(new THREE.BoxGeometry(0.04, 0.82, 0.04), iron, x, 0.41, -0.2, { parent: g }); add(new THREE.BoxGeometry(0.04, 0.04, 0.36), iron, x, 0.6, -0.03, { parent: g }); });
    root.userData.bench = g;
  }

  // ---------- 蘑菇圈（红帽白点） ----------
  const MUSH = { x: 3.4, z: -8.3 };
  const capTex = (() => { const c = document.createElement("canvas"); c.width = 256; c.height = 128; const g = c.getContext("2d"); g.fillStyle = "#e2483f"; g.fillRect(0, 0, 256, 128); g.fillStyle = "#fff7ef"; for (let i = 0; i < 40; i++) { g.beginPath(); g.arc(rnd() * 256, rnd() * 80, 3 + rnd() * 7, 0, 7); g.fill(); } const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const mushrooms = [];
  {
    const capM = std({ map: capTex, roughness: 0.45 }), stemM = std({ color: "#fbf3e6", roughness: 0.6 });
    const capG = new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    const make = (x, z, s) => {
      const g = new THREE.Group(); g.position.set(x, heightAt(x, z), z); root.add(g);
      add(new THREE.CylinderGeometry(0.05 * s, 0.07 * s, 0.22 * s, 12).translate(0, 0.11 * s, 0), stemM, 0, 0, 0, { parent: g });
      const cap = add(capG, capM, 0, 0.2 * s, 0, { parent: g }); cap.scale.set(0.16 * s, 0.11 * s, 0.16 * s);
      mushrooms.push({ g, s, v: 0, y: 0 }); return g;
    };
    make(MUSH.x, MUSH.z, 2.2);
    for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2 + 0.3; make(MUSH.x + Math.cos(a) * 0.62, MUSH.z + Math.sin(a) * 0.5, R(0.7, 1.25)); }
  }
  const sporeTex = dropTex;
  const NS = 60, sp = new Float32Array(NS * 3), spGeo = new THREE.BufferGeometry(); spGeo.setAttribute("position", new THREE.BufferAttribute(sp, 3));
  const spores = new THREE.Points(spGeo, new THREE.PointsMaterial({ map: sporeTex, size: 0.06, color: "#ffe9a8", transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); spores.frustumCulled = false; root.add(spores);
  const spSeed = Array.from({ length: NS }, () => [rnd(), rnd(), rnd()]); let sporeT = 9;

  // ---------- 路灯笼（夜里亮） ----------
  const LANTERNS = [[-0.62, -7.75], [0.62, -7.75], [-2.35, -9.35], [2.35, -9.35], [-0.60, -16.5], [0.6, -16.5]];
  const lampMats = [], glowSprites = [];
  {
    const post = std({ color: "#3d4a45", roughness: 0.42, metalness: 0.45 });
    const glowTex = (() => { const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d"); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, "rgba(255,230,170,1)"); gr.addColorStop(0.4, "rgba(255,200,120,.35)"); gr.addColorStop(1, "rgba(255,200,120,0)"); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
    const kit = { post, glass: new THREE.MeshPhysicalMaterial({ color: "#fff6e0", transparent: true, opacity: 0.35, roughness: 0.05, side: THREE.DoubleSide }), gold: std({ color: "#e3bf76", metalness: 0.9, roughness: 0.3 }), bloom: blossomGeo(THREE), bloomMat: ["#f7b4c4", "#ffffff", "#c7a6e6", "#ffd27a"].map((c) => std({ color: c, vertexColors: true, roughness: 0.6 })), leaf: leafGeo(THREE), leafMat: std({ color: "#7aa35a", side: THREE.DoubleSide }) };
    LANTERNS.forEach(([x, z]) => {
      const y = heightAt(x, z);
      const lm = new THREE.MeshStandardMaterial({ color: "#fff3d6", emissive: "#ffc46b", emissiveIntensity: 0, roughness: 0.3 }); lampMats.push(lm);
      buildLampPost(THREE, root, x, y, z, lm, kit);
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: "#ffd59a", transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); s.position.set(x, y + 0.97, z); s.scale.setScalar(0.42); root.add(s); glowSprites.push(s);
    });
  }
  const nightLights = [
    ["#ffc788", 0, 0.82, -5.45, 2.8, 3.25],
    ["#ffbc75", 0, 0.65, -16.77, 2.6, 2.4],
    ["#9dbdfd", POND.x + 0.29, 0.55, POND.z - 0.21, 2.7, 1.32]
  ].map(([color,x,y,z,range,power]) => {
    const light = new THREE.PointLight(color, 0, range, 2);
    light.position.set(x,y,z); root.add(light);
    return { light, power };
  });

  // ---------- 萤火虫（傍晚和夜里）、蝴蝶（白天） ----------
  const NF = mobile ? 70 : 130, fp = new Float32Array(NF * 3), fSeed = Array.from({ length: NF }, () => [R(-7.5, 7.5), R(-18.5, -6.8), R(0.2, 1.8), rnd() * 6, R(0.3, 0.8)]);
  const fGeo = new THREE.BufferGeometry(); fGeo.setAttribute("position", new THREE.BufferAttribute(fp, 3));
  const flies = new THREE.Points(fGeo, new THREE.PointsMaterial({ map: dropTex, size: 0.07, color: "#e8ff9a", transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); flies.frustumCulled = false; root.add(flies);
  const butterflies = [0, 1, 2, 3, 4].map((i) => {
    const g = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color: ["#ffd1e0", "#fff3a8", "#cfe6ff", "#ffffff", "#e8d2ff"][i], side: THREE.DoubleSide, roughness: 0.6 });
    const w = new THREE.CircleGeometry(0.045, 10).translate(0.045, 0, 0).rotateX(-Math.PI / 2);
    const L = new THREE.Mesh(w, m), Rr = new THREE.Mesh(w, m); Rr.scale.x = -1; g.add(L, Rr); root.add(g);
    return { g, L, Rr, ph: rnd() * 6, cx: R(-5, 5), cz: R(-16, -8), r: R(0.6, 1.6) };
  });

  // ---------- 能走的地方 ----------
  let extraWalk = null;
  function walk(map) {
    map.rect(-0.42, 0.42, Z0 - 0.3, -D + 0.9); // 门洞
    map.rect(TER.x0 + 0.25, TER.x1 - 0.25, TER.z1 + 0.25, Z0 - 0.15); // 露台
    map.rect(-0.75, 0.75, -7.6, TER.z1 + 0.3); // 露台出口
    map.ellipse(LAWN.x, LAWN.z, LAWN.rx, LAWN.rz, 1);
    // 露台栏杆、露台两侧的坡挡住
    map.rect(-9, -2.2, -6.62, Z0, 0); map.rect(2.2, 9, -6.62, Z0, 0); map.rect(-2.7, -0.95, -6.66, -6.25, 0); map.rect(0.95, 2.7, -6.66, -6.25, 0);
    // 挖掉障碍（已放大雪宝半个身宽）
    map.circle(FC.x, FC.z, 1.32);
    if (extraWalk) extraWalk(map);
    map.ellipse(POND.x, POND.z, POND.rx + 0.28, POND.rz + 0.28, 0);
    TREES.forEach((t) => { if (lawnE(t.x, t.z) < 1.15) map.circle(t.x, t.z, t.r + 0.22); });
    map.circle(SW.x, SW.z, 0.6);
    [-0.78, 0.78].forEach((x) => map.circle(x, ARCH.z, 0.2));
    LANTERNS.forEach(([x, z]) => map.circle(x, z, 0.17));
    map.ellipse(BENCH.x, BENCH.z, 0.32, 0.72, 0, Math.PI / 2 - BENCH.yaw);
    map.ellipse(MUSH.x, MUSH.z, 0.9, 0.78, 0);
    [[-2.15, -6.15], [2.15, -6.15], [-1.25, -6.15], [1.25, -6.15]].forEach(([x, z]) => map.circle(x, z, 0.38));
  }

  // ---------- 能点的东西 ----------
  const face = (fx, fz, tx, tz) => Math.atan2(tx - fx, tz - fz);
  const SEAT = (o) => ({ x: o.x, y: o.y, z: o.z });
  const _v = new THREE.Vector3();
  const spots = [
    { id: "fountain", action: "wish-fountain", name: "许愿池", cta: "许个愿", icon: "⛲", at: [FC.x, 1.85, FC.z], spot: { x: 0, z: -9.25 }, face: Math.PI, pick: [fountain], clip: "wow", dur: 3.2,
      lines: ["许个愿吧～", "哇，水花溅到我啦！", "希望明天也是晴天。"], start() { burst = 1; wishAge = 0; } },
    { id: "pond", name: "睡莲池", icon: "🪷", at: [POND.x, 0.9, POND.z], spot: POND_VIEW, face: face(POND_VIEW.x, POND_VIEW.z, POND.x, POND.z), pick: [pond], clip: "wave", dur: 3.4,
      lines: ["小鱼小鱼，出来玩～", "睡莲开得好好看。", "嘘，锦鲤在睡觉。"], start() { ripple(-0.9, 0.5); setTimeout(() => ripple(-0.2, 0.1), 250); koi[0].jump = 0; } },
    { id: "swing", name: "秋千", icon: "🌳", at: [-2.7, 1.75, -15.8], spot: { x: -2.6, z: -15.15 }, face: 0, pick: [swing], clip: "swing", dur: Infinity,
      lines: ["荡高一点！", "风好舒服～", "推推我嘛。"], start() { swingV += 1.1; },
      // 坐在秋千板上：跟着秋千一起荡
      hold() { swing.updateMatrixWorld(true); _v.set(0, -2.15, -0.02); swing.localToWorld(_v); return { x: _v.x, y: _v.y - 0.075, z: _v.z, yaw: 0, tilt: swingA }; } },
    { id: "mushroom", name: "蘑菇圈", icon: "🍄", at: [MUSH.x, 1.05, MUSH.z], spot: { x: 2.55, z: -9.05 }, face: face(2.55, -9.05, MUSH.x, MUSH.z), pick: mushrooms.map((m) => m.g), clip: "wow", dur: 2.8,
      lines: ["蘑菇会跳舞！", "这是精灵的圈圈吗？", "不能吃哦，只能看。"], start() { mushrooms.forEach((m, i) => setTimeout(() => { m.v += 2.2; }, i * 70)); sporeT = 0; } },
    { id: "bench", name: "长椅", icon: "🪑", at: [BENCH.x, 0.9, BENCH.z], spot: BENCH_EXIT, exit: BENCH_EXIT, face: BENCH.yaw, pick: [root.userData.bench], clip: "sit", dur: Infinity,
      lines: ["坐一会儿，看看小鱼。", "这里好安静。", "等你一起来坐。"],
      hold() {
        return {
          x: BENCH.x + Math.sin(BENCH.yaw) * BENCH.front,
          y: heightAt(BENCH.x, BENCH.z) + 0.175,
          z: BENCH.z + Math.cos(BENCH.yaw) * BENCH.front, yaw: BENCH.yaw
        };
      } },
    { id: "arch", name: "玫瑰拱门", icon: "🌹", at: [-1.15, 1.45, ARCH.z], spot: { x: 0, z: -7.85 }, face: 0, pick: [archG], clip: "wave", dur: 2.6,
      lines: ["欢迎来到小森林！", "玫瑰好香呀。", "从这里开始就是童话啦。"], start() { petalBurst = 1; } }
  ];
  let petalBurst = 0;
  const NP = 50, ppos = new Float32Array(NP * 3), pGeo = new THREE.BufferGeometry(); pGeo.setAttribute("position", new THREE.BufferAttribute(ppos, 3));
  const petalPts = new THREE.Points(pGeo, new THREE.PointsMaterial({ map: dropTex, size: 0.06, color: "#ffc2d1", transparent: true, opacity: 0, depthWrite: false })); petalPts.frustumCulled = false; root.add(petalPts);
  const pS = Array.from({ length: NP }, () => [R(-0.9, 0.9), R(1.2, 2.6), R(-0.3, 0.3), rnd() * 6]);

  // ---------- 每帧 ----------
  function update(dt, t, env) {
    windU.value = t;
    // 花心水柱落向浅碗，碗沿的六道水线落进花形底池。
    burst = Math.max(0, burst - dt * 0.75);
    for (let i = 0; i < ND; i++) {
      const [a, b, c] = dSeed[i], top = i % 3 === 0, period = top ? 0.54 : 0.45;
      const tt = ((t / period + b) % 1) * period;
      const ang = top ? a * Math.PI * 2 : (i % 6) * Math.PI / 3 + a * 0.026;
      const r = top ? 0.018 + (0.49 + c * 0.14) * tt : 0.5 + (0.53 + c * 0.11) * tt;
      const y = (top ? 1.51 : 1.0) + (top ? 0.43 + burst * 0.48 : 0.06) * tt - 4.9 * tt * tt;
      dp[i * 3] = Math.cos(ang) * r;
      dp[i * 3 + 1] = Math.max(top ? 0.997 : 0.294, y);
      dp[i * 3 + 2] = Math.sin(ang) * r;
    }
    dGeo.attributes.position.needsUpdate = true;
    wishAge += dt;
    wishRing.visible = wishAge < 1.7;
    if (wishRing.visible) {
      const k = wishAge / 1.7;
      wishRing.scale.setScalar(0.18 + k * 0.57);
      wishRing.material.opacity = Math.sin(Math.PI * k) * 0.85;
    }
    // 锦鲤绕圈，偶尔跳出水
    koi.forEach((k, i) => {
      k.ph += dt * k.sp; const x = Math.cos(k.ph) * k.r * POND.rx * 0.8, z = Math.sin(k.ph * (i % 2 ? -1 : 1)) * k.r * POND.rz * 0.8;
      let y = -0.06; if (k.jump >= 0) { k.jump += dt; y = -0.06 + Math.max(0, Math.sin(Math.PI * k.jump / 0.7)) * 0.32; if (k.jump > 0.7) { k.jump = -1; ripple(x, z); } }
      const dx = -Math.sin(k.ph) * k.r * POND.rx, dz = Math.cos(k.ph) * (i % 2 ? -1 : 1) * k.r * POND.rz;
      k.g.position.set(x, y, z); k.g.rotation.y = Math.atan2(dx, dz); k.g.rotation.x = k.jump >= 0 ? -Math.cos(Math.PI * k.jump / 0.7) * 0.8 : 0;
    });
    if (Math.random() < dt * 0.25) ripple(R(-0.6, 0.6) * POND.rx, R(-0.5, 0.5) * POND.rz);
    ripples.forEach((r) => { r.t += dt; const k = Math.min(1, r.t / 1.6); r.m.scale.setScalar(0.05 + k * 0.45); r.m.material.opacity = (1 - k) * 0.55; r.m.visible = k < 1; });
    // 秋千：弹簧摆，慢慢停
    swingV += (-swingA * 6 - swingV * 0.35) * dt; swingA += swingV * dt; swing.rotation.x = swingA;
    // 蘑菇：弹一弹
    mushrooms.forEach((m) => { m.v += (-m.y * 160 - m.v * 9) * dt; m.y += m.v * dt * 0.05; m.g.scale.set(m.s ? 1 - m.y * 0.6 : 1, 1 + m.y, 1 - m.y * 0.6); });
    sporeT += dt; spores.material.opacity = Math.max(0, 1 - sporeT / 2.4);
    if (spores.material.opacity > 0) { for (let i = 0; i < NS; i++) { const [a, b, c] = spSeed[i]; const r = 0.2 + b * 0.8 + sporeT * 0.2; sp[i * 3] = MUSH.x + Math.cos(a * 6.28 + sporeT * 0.6) * r * 0.7; sp[i * 3 + 1] = 0.2 + sporeT * (0.3 + c * 0.6); sp[i * 3 + 2] = MUSH.z + Math.sin(a * 6.28 + sporeT * 0.6) * r * 0.6; } spGeo.attributes.position.needsUpdate = true; }
    // 玫瑰花瓣
    petalBurst = Math.max(0, petalBurst - dt * 0.35); petalPts.material.opacity = Math.min(1, petalBurst * 2);
    if (petalBurst > 0) { const k = 1 - petalBurst; for (let i = 0; i < NP; i++) { const [x, y, z, ph] = pS[i]; ppos[i * 3] = x + Math.sin(t * 2 + ph) * 0.2; ppos[i * 3 + 1] = Math.max(0.02, y - k * 2.6); ppos[i * 3 + 2] = ARCH.z + z + Math.cos(t * 1.5 + ph) * 0.15; } pGeo.attributes.position.needsUpdate = true; }
    // 夜里：灯笼亮、萤火虫；白天：蝴蝶
    const dark = env.night ? 1 : env.dusk ? 0.55 : env.rain ? 0.25 : env.snow ? 0.2 : 0;
    lampMats.forEach((m) => { m.emissiveIntensity = dark * 2.2; }); glowSprites.forEach((s, i) => { s.material.opacity = dark * (0.5 + Math.sin(t * 3 + i) * 0.06); });
    nightLights.forEach(({light, power}) => { light.intensity = dark * power; });
    flies.material.opacity = Math.max(0, dark - 0.2) * 1.1; flies.visible = dark > 0.2;
    if (flies.visible) { for (let i = 0; i < NF; i++) { const [x, z, y, ph, s] = fSeed[i]; fp[i * 3] = x + Math.sin(t * s + ph) * 0.4; fp[i * 3 + 1] = heightAt(x, z) + y + Math.sin(t * s * 1.7 + ph) * 0.15; fp[i * 3 + 2] = z + Math.cos(t * s * 0.8 + ph) * 0.4; } fGeo.attributes.position.needsUpdate = true; }
    butterflies.forEach((b) => { b.g.visible = !env.night && !env.rain && !env.snow; if (!b.g.visible) return; b.ph += dt * 0.5; const x = b.cx + Math.cos(b.ph) * b.r, z = b.cz + Math.sin(b.ph * 1.3) * b.r * 0.7; b.g.position.set(x, 0.45 + Math.sin(b.ph * 3) * 0.15, z); b.g.rotation.y = b.ph; const f = Math.sin(t * 18 + b.ph) * 1.1; b.L.rotation.z = f; b.Rr.rotation.z = -f; });
  }

  return { root, walk, spots, update, heightAt, rainRipple: () => ripple(R(-0.7, 0.7) * POND.rx, R(-0.6, 0.6) * POND.rz), SEAT, ground: root.getObjectByName("ground"), Z0, LAWN, setExtraWalk(f) { extraWalk = f; } };
}
