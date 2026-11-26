/* 花园的“更宏大、更温馨”：瀑布和小溪、两只宠物（小白猫、小兔子）、喷泉广场的暖光灯串、露台彩旗、
 * 野餐毯，以及远山、山丘上的小城堡、热气球、云和小鸟。全部程序生成。
 * 宠物在能走的地面上自己逛；雪宝在花园里时小猫会跟着她，没人管时去野餐毯上打盹。点它们会有反应。
 */
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
export function buildGardenExtras(THREE, scene, { heightAt, mobile, FC = { x: 0, z: -11 }, Z0 }) {
  const root = new THREE.Group(); root.name = "gardenExtras"; scene.add(root);
  let seed = 23; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const R = (a, b) => a + rnd() * (b - a);
  const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.8, ...o });
  const add = (geo, mat, x, y, z, o = {}) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (o.rx) m.rotation.x = o.rx; if (o.ry) m.rotation.y = o.ry; if (o.rz) m.rotation.z = o.rz; m.castShadow = o.cast !== false; m.receiveShadow = true; if (o.noHit) m.userData.noHit = true; (o.parent || root).add(m); return m; };
  const canvasTex = (w, h, draw) => { const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
  const anim = [], solid = [], spots = [];
  const glowTex = canvasTex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, "rgba(255,240,200,1)"); gr.addColorStop(0.4, "rgba(255,210,150,.35)"); gr.addColorStop(1, "rgba(255,200,150,0)"); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });

  // ========== 瀑布 + 小溪（流进睡莲池） ==========
  const waterU = { uTime: { value: 0 } };
  const flowMat = (speed, foam, alpha) => new THREE.ShaderMaterial({
    uniforms: { ...waterU, uSpeed: { value: speed }, uFoam: { value: foam }, uAlpha: { value: alpha } }, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader: `uniform float uTime, uSpeed, uFoam, uAlpha; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
      void main(){
        vec2 p = vec2(vUv.x * 6.0, vUv.y * 2.0 - uTime * uSpeed);
        float s = n(p * vec2(1.0, 3.0)) * 0.6 + n(p * vec2(2.3, 7.0) + 3.1) * 0.4;
        float edge = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x);
        float foam = smoothstep(1.0 - uFoam, 1.0, s) + (1.0 - edge) * 0.5;
        vec3 deep = vec3(0.42, 0.68, 0.74), light = vec3(0.78, 0.92, 0.94);
        vec3 col = mix(deep, light, s * 0.7) + foam * 0.45;
        gl_FragColor = vec4(col, uAlpha * (0.55 + 0.45 * edge) + foam * 0.25);
      }`
  });
  {
    const pts = [[6.3, -21.0], [5.9, -20.0], [5.3, -19.1], [4.9, -18.2], [4.45, -17.4], [4.15, -16.75]].map(([x, z]) => new THREE.Vector3(x, 0, z));
    const crv = new THREE.CatmullRomCurve3(pts), N = 60, W0 = 0.42, W1 = 0.62;
    const pos = [], uv = [], idx = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N, p = crv.getPointAt(t), tg = crv.getTangentAt(t), side = new THREE.Vector3(-tg.z, 0, tg.x).normalize(), w = W0 + (W1 - W0) * t;
      for (const k of [-1, 1]) { const x = p.x + side.x * w * k, z = p.z + side.z * w * k; pos.push(x, heightAt(x, z) + 0.035, z); uv.push(k < 0 ? 0 : 1, t * 6); }
      if (i < N) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx);
    const stream = new THREE.Mesh(geo, flowMat(0.9, 0.16, 0.82)); stream.renderOrder = 2; stream.userData.noHit = true; root.add(stream);
    // 两岸鹅卵石
    const NS = mobile ? 70 : 120, rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), std({ color: "#cfc6b8", roughness: 0.85 }), NS), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
    for (let i = 0; i < NS; i++) {
      const t = rnd(), p = crv.getPointAt(t), tg = crv.getTangentAt(t), side = new THREE.Vector3(-tg.z, 0, tg.x).normalize(), k = rnd() < 0.5 ? -1 : 1, w = W0 + (W1 - W0) * t + R(0.02, 0.18);
      const x = p.x + side.x * w * k, z = p.z + side.z * w * k, r = R(0.06, 0.16);
      q.setFromEuler(new THREE.Euler(R(0, 3), R(0, 3), R(0, 3))); m4.compose(new THREE.Vector3(x, heightAt(x, z) + r * 0.25, z), q, new THREE.Vector3(r, r * 0.6, r)); rocks.setMatrixAt(i, m4); rocks.setColorAt(i, c.set("#ffffff").offsetHSL(0, 0, -rnd() * 0.16));
    }
    rocks.castShadow = rocks.receiveShadow = true; root.add(rocks);
    // 瀑布：岩壁 + 落水 + 水雾
    const top = pts[0], hy = heightAt(top.x, top.z);
    const cliff = new THREE.Group(); cliff.position.set(top.x + 0.2, hy, top.z - 0.45); root.add(cliff);
    const rockM = std({ color: "#b9b0a6", roughness: 0.9 }), mossM = std({ color: "#7f9e66", roughness: 1 });
    [[0, 0.9, 0, 1.0, 1.1], [-0.85, 0.55, 0.15, 0.75, 0.8], [0.85, 0.6, 0.1, 0.8, 0.85], [-0.4, 1.6, -0.2, 0.7, 0.6], [0.45, 1.65, -0.25, 0.65, 0.55], [0, 2.1, -0.35, 0.6, 0.5]].forEach(([x, y, z, r, sy]) => {
      const m = add(new THREE.DodecahedronGeometry(r, 1), rockM, x, y, z, { parent: cliff }); m.scale.y = sy; solid.push(m);
      add(new THREE.SphereGeometry(r * 0.55, 10, 8, 0, Math.PI * 2, 0, 1.2), mossM, x, y + r * sy * 0.75, z, { parent: cliff, cast: false });
    });
    const fallGeo = new THREE.PlaneGeometry(0.6, 1.95, 1, 12); const fp = fallGeo.attributes.position;
    for (let i = 0; i < fp.count; i++) { const y = fp.getY(i); fp.setZ(i, Math.pow((0.98 - y) / 1.95, 2) * 0.35); }
    const fall = add(fallGeo, flowMat(2.6, 0.3, 0.88), 0, 1.0, 0.62, { parent: cliff, cast: false, noHit: true }); fall.renderOrder = 2;
    const NM = 40, mp = new Float32Array(NM * 3), mSeed = Array.from({ length: NM }, () => [rnd(), rnd(), rnd()]);
    const mGeo = new THREE.BufferGeometry(); mGeo.setAttribute("position", new THREE.BufferAttribute(mp, 3));
    const mist = new THREE.Points(mGeo, new THREE.PointsMaterial({ map: glowTex, size: 0.25, color: "#ffffff", transparent: true, opacity: 0.35, depthWrite: false })); mist.frustumCulled = false; mist.userData.noHit = true; cliff.add(mist);
    anim.push((t) => { waterU.uTime.value = t; for (let i = 0; i < NM; i++) { const [a, b, c2] = mSeed[i], f = (t * 0.4 + b) % 1; mp[i * 3] = (a - 0.5) * 0.9 + Math.sin(t + i) * 0.05; mp[i * 3 + 1] = 0.05 + f * 0.6; mp[i * 3 + 2] = 0.75 + c2 * 0.45 + f * 0.2; } mGeo.attributes.position.needsUpdate = true; });
    root.userData.stream = crv;
  }

  // ========== 喷泉广场一圈暖光灯串 ==========
  const bulbMat = new THREE.MeshStandardMaterial({ color: "#fff3d6", emissive: "#ffcf7a", emissiveIntensity: 0.4 });
  {
    const POLES = 8, RAD = 3.3, poles = [];
    const wood = std({ color: "#fbf4ea", roughness: 0.45 }); // 奶油白细灯柱 + 金箍
    for (let i = 0; i < POLES; i++) {
      const a = (i / POLES) * Math.PI * 2 + Math.PI / POLES, x = FC.x + Math.cos(a) * RAD, z = FC.z + Math.sin(a) * RAD * 0.92, y = heightAt(x, z);
      if (z > -7.8) continue; // 别挡住露台出口和拱门
      add(new THREE.LatheGeometry([[0, 0], [0.055, 0], [0.055, 0.05], [0.035, 0.09], [0.022, 0.16], [0.016, 2.2], [0.024, 2.24], [0, 2.26]].map(([r, h]) => new THREE.Vector2(r, h)), 14), wood, x, y, z);
      add(new THREE.TorusGeometry(0.02, 0.006, 6, 14), std({ color: "#e0bb72", metalness: 0.8, roughness: 0.3 }), x, y + 1.0, z, { rx: Math.PI / 2, cast: false }); add(new THREE.SphereGeometry(0.05, 10, 8), std({ color: "#e0bb72", metalness: 0.8, roughness: 0.3 }), x, y + 2.32, z);
      poles.push(new THREE.Vector3(x, y + 2.25, z));
    }
    const bulbs = [];
    for (let i = 0; i < poles.length; i++) {
      const a = poles[i], b = poles[(i + 1) % poles.length]; if (a.distanceTo(b) > 4) continue;
      const pts = []; for (let k = 0; k <= 16; k++) { const t = k / 16, p = a.clone().lerp(b, t); p.y -= Math.sin(t * Math.PI) * 0.35; pts.push(p); }
      add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.006, 4), std({ color: "#5d5048" }), 0, 0, 0, { cast: false, noHit: true });
      for (let k = 1; k < 16; k += 1.5) bulbs.push(pts[Math.floor(k)].clone().add(new THREE.Vector3(0, -0.035, 0)));
    }
    const im = new THREE.InstancedMesh(new THREE.SphereGeometry(0.03, 8, 6), bulbMat, bulbs.length), m4 = new THREE.Matrix4();
    bulbs.forEach((p, i) => { m4.makeTranslation(p.x, p.y, p.z); im.setMatrixAt(i, m4); }); im.userData.noHit = true; root.add(im);
    // 夜里每颗灯泡一圈柔光
    const gGeo = new THREE.BufferGeometry(); gGeo.setAttribute("position", new THREE.Float32BufferAttribute(bulbs.flatMap((p) => [p.x, p.y, p.z]), 3));
    const glow = new THREE.Points(gGeo, new THREE.PointsMaterial({ map: glowTex, size: 0.32, color: "#ffd28a", transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); glow.userData.noHit = true; root.add(glow);
    root.userData.lightsGlow = glow;
  }
  // ========== 露台栏杆上的三角彩旗 ==========
  {
    const cols = ["#f6a9bd", "#fff1d6", "#bfe3d0", "#f9d86b", "#c9b3ea"];
    const flagGeo = new THREE.BufferGeometry(); flagGeo.setAttribute("position", new THREE.Float32BufferAttribute([-0.07, 0, 0, 0.07, 0, 0, 0, -0.13, 0], 3)); flagGeo.computeVertexNormals();
    const mats = cols.map((c) => std({ color: c, side: THREE.DoubleSide, roughness: 0.7 }));
    const run = (ax, az, bx, bz, y) => { const L = Math.hypot(bx - ax, bz - az), n = Math.floor(L / 0.18); for (let i = 0; i <= n; i++) { const t = i / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t, sag = Math.sin(t * Math.PI) * 0.12; const f = add(flagGeo, mats[i % mats.length], x, y - sag, z, { cast: false, noHit: true }); f.rotation.y = Math.atan2(bz - az, bx - ax) * -1; } };
    run(-2.45, -6.45, -1.0, -6.45, 0.72); run(1.0, -6.45, 2.45, -6.45, 0.72);
  }
  // ========== 野餐毯 + 篮子 + 茶点（小猫的窝） ==========
  const PIC = { x: 5.85, z: -8.95 };
  {
    const y = heightAt(PIC.x, PIC.z), g = new THREE.Group(); g.position.set(PIC.x, y + 0.012, PIC.z); g.rotation.y = 0.4; root.add(g);
    const check = canvasTex(256, 256, (c) => { c.fillStyle = "#fff6f0"; c.fillRect(0, 0, 256, 256); c.fillStyle = "rgba(240,150,170,.55)"; for (let i = 0; i < 8; i++) { c.fillRect(i * 32, 0, 16, 256); c.fillRect(0, i * 32, 256, 16); } });
    add(new THREE.PlaneGeometry(1.4, 1.0).rotateX(-Math.PI / 2), std({ map: check, roughness: 0.95 }), 0, 0, 0, { parent: g, cast: false });
    const wick = std({ color: "#c89a62", roughness: 0.9 });
    add(new THREE.CylinderGeometry(0.16, 0.13, 0.16, 16).translate(0, 0.08, 0), wick, -0.42, 0, -0.25, { parent: g });
    add(new THREE.TorusGeometry(0.13, 0.012, 6, 20, Math.PI), wick, -0.42, 0.16, -0.25, { parent: g });
    const pot = std({ color: "#fbf6ef", roughness: 0.3 });
    add(new THREE.SphereGeometry(0.07, 16, 12), pot, 0.15, 0.06, -0.12, { parent: g }); add(new THREE.CylinderGeometry(0.012, 0.018, 0.08, 8), pot, 0.23, 0.08, -0.12, { parent: g, rz: -0.8 });
    [[0.38, 0.1], [0.3, 0.26]].forEach(([x, z]) => add(new THREE.CylinderGeometry(0.035, 0.028, 0.04, 14).translate(0, 0.02, 0), std({ color: "#f6c9d2", roughness: 0.35 }), x, 0, z, { parent: g }));
    const mac = ["#f6a9bd", "#bfe3d0", "#f9d86b", "#c9b3ea"];
    add(new THREE.CylinderGeometry(0.13, 0.13, 0.012, 24), pot, -0.05, 0.006, 0.2, { parent: g });
    mac.forEach((c, i) => add(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 14), std({ color: c, roughness: 0.6 }), -0.05 + Math.cos(i * 1.6) * 0.07, 0.03, 0.2 + Math.sin(i * 1.6) * 0.07, { parent: g }));
  }

  // ========== 宠物：小白猫、小兔子 ==========
  const furM = std({ color: "#fbf8f4", roughness: 0.95 }), pinkM = std({ color: "#f4b8c4", roughness: 0.7 }), eyeM = std({ color: "#2b2430", roughness: 0.3 });
  function makeCat() {
    const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
    const b = add(new THREE.SphereGeometry(0.11, 18, 14), furM, 0, 0.12, 0, { parent: body }); b.scale.set(0.85, 0.8, 1.35);
    const head = new THREE.Group(); head.position.set(0, 0.22, 0.14); body.add(head);
    add(new THREE.SphereGeometry(0.085, 18, 14), furM, 0, 0, 0, { parent: head }).scale.set(1.1, 0.95, 1);
    [-1, 1].forEach((k) => { add(new THREE.ConeGeometry(0.035, 0.06, 4), furM, k * 0.05, 0.075, -0.005, { parent: head, rz: -k * 0.25 }); add(new THREE.ConeGeometry(0.02, 0.035, 4), pinkM, k * 0.05, 0.072, 0.006, { parent: head, rz: -k * 0.25 }); add(new THREE.SphereGeometry(0.012, 8, 6), eyeM, k * 0.034, 0.012, 0.078, { parent: head, cast: false }); });
    add(new THREE.SphereGeometry(0.008, 8, 6), pinkM, 0, -0.008, 0.088, { parent: head, cast: false });
    [-1, 1].forEach((k) => add(new THREE.SphereGeometry(0.0038, 6, 4), std({ color: "#fff", emissive: "#fff", emissiveIntensity: 0.6 }), k * 0.032 + 0.003, 0.017, 0.089, { parent: head, cast: false }));
    add(new THREE.TorusGeometry(0.062, 0.008, 6, 20), std({ color: "#f07f98", roughness: 0.5 }), 0, -0.05, 0.0, { parent: head, rx: Math.PI / 2 + 0.3 });
    add(new THREE.SphereGeometry(0.012, 10, 8), std({ color: "#f2c45e", metalness: 0.8, roughness: 0.3 }), 0, -0.07, 0.055, { parent: head, cast: false });
    const legs = [[-0.05, 0.08], [0.05, 0.08], [-0.05, -0.08], [0.05, -0.08]].map(([x, z]) => add(new THREE.CylinderGeometry(0.022, 0.02, 0.08, 8).translate(0, -0.04, 0), furM, x, 0.07, z, { parent: body }));
    const tail = new THREE.Group(); tail.position.set(0, 0.15, -0.14); body.add(tail);
    add(new THREE.CapsuleGeometry(0.018, 0.16, 4, 8).translate(0, 0.08, 0), furM, 0, 0, 0, { parent: tail, rx: -0.6 });
    return { g, body, head, legs, tail, kind: "cat" };
  }
  // 小兔子：圆滚滚的身子 + 后腿鼓包、前爪、大脚丫，脸上有腮帮、鼻头和腮红，眼睛带高光；长耳朵里面是粉的，一只耳朵有点耷拉
  const shineM = std({ color: "#ffffff", emissive: "#ffffff", emissiveIntensity: 0.6, roughness: 0.2 }), blushM = new THREE.MeshBasicMaterial({ color: "#ffb3c4", transparent: true, opacity: 0.55, depthWrite: false });
  const bunFur = std({ color: "#fffaf5", roughness: 1 }), bunShade = std({ color: "#f3ebe4", roughness: 1 });
  function ellip(rx, ry, rz, mat, x, y, z, parent, o = {}) { const m = add(new THREE.SphereGeometry(1, 20, 14), mat, x, y, z, { parent, ...o }); m.scale.set(rx, ry, rz); return m; }
  function makeBunny() {
    const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
    ellip(0.092, 0.088, 0.11, bunFur, 0, 0.095, -0.01, body);               // 身子（梨形：下面宽）
    ellip(0.07, 0.07, 0.07, bunFur, 0, 0.14, 0.04, body);                   // 胸口
    ellip(0.035, 0.03, 0.035, bunFur, 0, 0.115, 0.095, body);               // 胸前一撮毛
    [-1, 1].forEach((k) => {
      ellip(0.05, 0.058, 0.068, bunShade, k * 0.058, 0.07, -0.04, body);    // 后腿鼓包
      ellip(0.026, 0.016, 0.06, bunFur, k * 0.055, 0.014, 0.0, body);       // 大脚丫
      ellip(0.012, 0.006, 0.024, pinkM, k * 0.055, 0.004, 0.012, body, { cast: false }); // 脚底肉垫
      ellip(0.018, 0.032, 0.02, bunFur, k * 0.03, 0.035, 0.085, body);      // 前爪
    });
    const tail = new THREE.Group(); tail.position.set(0, 0.1, -0.115); body.add(tail);
    for (let i = 0; i < 5; i++) ellip(0.026, 0.026, 0.024, bunFur, Math.cos(i * 1.26) * 0.011, Math.sin(i * 1.26) * 0.011, -0.004, tail);
    const head = new THREE.Group(); head.position.set(0, 0.2, 0.075); body.add(head);
    ellip(0.078, 0.07, 0.072, bunFur, 0, 0, 0, head);
    [-1, 1].forEach((k) => {
      ellip(0.036, 0.03, 0.03, bunFur, k * 0.042, -0.026, 0.035, head);     // 腮帮
      ellip(0.016, 0.009, 0.004, blushM, k * 0.05, -0.022, 0.06, head, { cast: false, ry: k * 0.6 });
      const eye = ellip(0.0135, 0.016, 0.01, eyeM, k * 0.037, 0.008, 0.062, head, { cast: false, ry: k * 0.45 });
      ellip(0.0045, 0.0045, 0.003, shineM, k * 0.034 + 0.003, 0.014, 0.071, head, { cast: false });
    });
    const nose = ellip(0.01, 0.007, 0.007, pinkM, 0, -0.012, 0.075, head, { cast: false }); // 鼻头
    const ears = [-1, 1].map((k) => {
      const ear = new THREE.Group(); ear.position.set(k * 0.03, 0.05, -0.012); head.add(ear);
      ellip(0.022, 0.07, 0.012, bunFur, 0, 0.065, 0, ear);
      ellip(0.012, 0.052, 0.004, pinkM, 0, 0.062, 0.01, ear, { cast: false });
      ear.rotation.set(-0.15, 0, -k * (k > 0 ? 0.55 : 0.16)); ear.userData.base = ear.rotation.z;
      return ear;
    });
    return { g, body, head, legs: [], tail, ears, nose, kind: "bunny" };
  }
  // 哈士奇：先放一个看不见的占位（模型加载好才出现）
  function makeHusky() { const g = new THREE.Group(), body = new THREE.Group(); g.add(body); const tail = new THREE.Group(), head = new THREE.Group(); body.add(tail, head); return { g, body, head, legs: [], tail, kind: "husky", wait: true }; }
  const pets = [makeCat(), makeBunny(), makeHusky()];
  pets[0].home = { x: PIC.x - 0.2, z: PIC.z + 0.1 }; pets[1].home = { x: -2.4, z: -10.2 }; pets[2].home = { x: 2.6, z: -8.2 };
  const PET_INFO = {
    cat: { name: "布偶猫", lines: ["喵～它在蹭我！", "布偶猫好软呀。", "它要跟我回家吗？"] },
    bunny: { name: "小兔子", lines: ["小兔子蹦蹦跳跳！", "耳朵好长～", "给它带根胡萝卜吧。"] },
    husky: { name: "哈士奇", lines: ["汪！它冲过来了！", "哈士奇在对我傻笑～", "它的眼睛好蓝呀。"] }
  };
  pets.forEach((p, i) => { p.pos = new THREE.Vector3(p.home.x + i * 0.3, 0, p.home.z); p.target = null; p.next = 2 + i * 1.5; p.yaw = 0; p.hop = 0; p.joy = 0; p.g.position.copy(p.pos); p.g.scale.setScalar(1.15); root.add(p.g);
    p.spot = { id: "pet-" + p.kind, name: PET_INFO[p.kind].name, icon: "🐾", action: "pet", noMarker: true, pick: [p.g], at: [p.pos.x, 0, p.pos.z], lines: PET_INFO[p.kind].lines, pet: p }; spots.push(p.spot); });
  // 混元生成的精模（布偶猫、小兔子、哈士奇）：加载好就替换掉代码拼的小动物；加载失败就留着原来的
  const PET_GLB = { cat: { url: "xuebao-3d/pet-cat.glb?v=1", h: 0.36 }, bunny: { url: "xuebao-3d/pet-bunny.glb?v=1", h: 0.36 }, husky: { url: "xuebao-3d/pet-husky.glb?v=1", h: 0.46 } };
  const petLoader = new GLTFLoader();
  pets.forEach((p) => {
    const d = PET_GLB[p.kind]; if (!d) return;
    if (p.wait) p.g.visible = false;
    petLoader.loadAsync(d.url).then(({ scene: m }) => {
      const box = new THREE.Box3().setFromObject(m), size = box.getSize(new THREE.Vector3()), k = d.h / size.y;
      m.scale.setScalar(k); m.position.set(-(box.min.x + box.max.x) / 2 * k, -box.min.y * k, -(box.min.z + box.max.z) / 2 * k);
      m.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; if (o.material) { o.material.roughness = 0.85; o.material.metalness = 0; } } });
      const wrap = new THREE.Group(); wrap.add(m); p.g.add(wrap); p.body.visible = false; p.glb = wrap; p.g.scale.setScalar(1); p.g.visible = true;
    }).catch(() => { if (p.wait) p.g.visible = false; });
  });
  let walkable = () => true;

  // ========== 远景：远山、小城堡、热气球、云、小鸟 ==========
  {
    const mtnCols = ["#9fb7b0", "#a9bfc4", "#b6c6cc", "#a3b8a6"];
    const mtn = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 7).translate(0, 0.5, 0), std({ roughness: 1, flatShading: true }), 18), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
    for (let i = 0; i < 18; i++) { const a = -Math.PI * 0.95 + (i / 17) * Math.PI * 0.9, r = R(40, 55), x = Math.cos(a) * r, z = -12 + Math.sin(a) * r * 0.9, s = R(9, 16), h = R(7, 15); q.setFromEuler(new THREE.Euler(0, rnd() * 6, 0)); m4.compose(new THREE.Vector3(x, -1, z), q, new THREE.Vector3(s, h, s * 0.9)); mtn.setMatrixAt(i, m4); mtn.setColorAt(i, c.set(mtnCols[i % 4])); }
    mtn.userData.noHit = true; root.add(mtn);
    // 山丘上的小城堡（粉色尖顶）
    const castle = new THREE.Group(); castle.position.set(-15, heightAt(-15, -34) + 0.5, -34); castle.scale.setScalar(1.6); root.add(castle);
    const stone = std({ color: "#f3ece3", roughness: 0.7 }), roof = std({ color: "#e98fa6", roughness: 0.5 }), gold = std({ color: "#e0bb72", metalness: 0.8, roughness: 0.3 });
    add(new THREE.BoxGeometry(2.2, 1.4, 1.2).translate(0, 0.7, 0), stone, 0, 0, 0, { parent: castle });
    [[-1.2, 0, 2.2, 0.38], [1.2, 0, 2.2, 0.38], [0, -0.3, 3.0, 0.5], [-0.5, 0.5, 1.8, 0.28], [0.6, 0.5, 1.9, 0.28]].forEach(([x, z, h, r]) => {
      add(new THREE.CylinderGeometry(r, r * 1.05, h, 14).translate(0, h / 2, 0), stone, x, 0, z, { parent: castle });
      add(new THREE.ConeGeometry(r * 1.3, h * 0.55, 14).translate(0, h * 0.275, 0), roof, x, h, z, { parent: castle });
      add(new THREE.SphereGeometry(0.06, 8, 6), gold, x, h + h * 0.55 + 0.04, z, { parent: castle, cast: false });
    });
    castle.traverse((o) => { o.userData.noHit = true; });
    // 云
    const cloudM = std({ color: "#ffffff", roughness: 1, transparent: true, opacity: 0.92 }), clouds = [];
    for (let i = 0; i < 9; i++) {
      const g = new THREE.Group(); g.position.set(R(-30, 30), R(14, 22), R(-50, -20)); root.add(g);
      for (let k = 0; k < 5; k++) add(new THREE.SphereGeometry(R(1.2, 2.2), 14, 10), cloudM, (k - 2) * 1.4 + R(-0.3, 0.3), R(-0.3, 0.5), R(-0.5, 0.5), { parent: g, cast: false, noHit: true });
      clouds.push(g);
    }
    // 热气球
    const balloon = new THREE.Group(); balloon.position.set(12, 13, -30); root.add(balloon);
    const stripe = canvasTex(256, 128, (c2) => { const cs = ["#f6a9bd", "#fff6ea", "#f9d86b", "#fff6ea"]; for (let i = 0; i < 16; i++) { c2.fillStyle = cs[i % 4]; c2.fillRect(i * 16, 0, 16, 128); } });
    add(new THREE.SphereGeometry(1.6, 24, 18), std({ map: stripe, roughness: 0.6 }), 0, 0, 0, { parent: balloon, noHit: true }).scale.y = 1.15;
    add(new THREE.CylinderGeometry(0.35, 0.3, 0.4, 12), std({ color: "#b07a4f" }), 0, -2.6, 0, { parent: balloon, noHit: true });
    [-1, 1].forEach((k) => [-1, 1].forEach((j) => add(new THREE.CylinderGeometry(0.01, 0.01, 1.0, 4), std({ color: "#6b5444" }), k * 0.28, -2.05, j * 0.28, { parent: balloon, noHit: true, cast: false })));
    // 小鸟
    const birdGeo = new THREE.BufferGeometry(); birdGeo.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0.08, -0.16, 0, -0.04, 0, 0, -0.04, 0, 0, 0.08, 0.16, 0, -0.04, 0, 0, -0.04], 3)); birdGeo.computeVertexNormals();
    const birds = Array.from({ length: 6 }, (_, i) => { const m = add(birdGeo, std({ color: "#5e5560", side: THREE.DoubleSide }), 0, 0, 0, { cast: false, noHit: true }); return { m, ph: i * 1.1, r: R(5, 9), h: R(5, 7.5) }; });
    anim.push((t, dt) => {
      clouds.forEach((g, i) => { g.position.x += dt * (0.25 + i * 0.03); if (g.position.x > 34) g.position.x = -34; });
      balloon.position.set(12 + Math.sin(t * 0.03) * 8, 13 + Math.sin(t * 0.4) * 0.6, -30 + Math.cos(t * 0.03) * 4); balloon.rotation.y = t * 0.05;
      birds.forEach((b) => { const a = t * 0.35 + b.ph; b.m.position.set(Math.cos(a) * b.r, b.h + Math.sin(t * 1.3 + b.ph) * 0.3, -13 + Math.sin(a) * b.r * 0.7); b.m.rotation.y = -a; const f = Math.sin(t * 9 + b.ph) * 0.6; b.m.scale.set(1, 1 + f, 1); });
    });
  }

  // ---------- 能走的地方：小溪、瀑布岩壁、野餐毯边上挡住 ----------
  function walk(map) {
    const crv = root.userData.stream; const pts = []; for (let i = 0; i <= 30; i++) { const p = crv.getPointAt(i / 30); pts.push([p.x, p.z]); }
    map.stroke(pts, 0.62, 0);
    map.circle(6.5, -21.4, 1.6, 0);
    walkable = (x, z) => map.walkable(x, z);
  }
  // ---------- 每帧 ----------
  const _d = new THREE.Vector3();
  function petStep(p, dt, t, xb) {
    const near = xb && xb.z < Z0 - 0.3 && (p.kind === "cat" || p.kind === "husky");
    p.joy = Math.max(0, p.joy - dt);
    if (near && xb.distanceTo(p.pos) < 9) { // 小猫跟着雪宝，停在她身边一点
      const side = p.kind === "husky" ? -1 : 1, want = new THREE.Vector3(xb.x + side * 0.55 * Math.sin(t * 0.2 + (side < 0 ? 2 : 0)), 0, xb.z + side * 0.45);
      if (p.pos.distanceTo(want) > 0.7) p.target = want;
    } else if (t > p.next) {
      p.next = t + R(4, 9);
      const home = rnd() < 0.4 ? p.home : null;
      let tg = null; for (let i = 0; i < 12 && !tg; i++) { const x = (home ? home.x : p.pos.x) + R(-2.2, 2.2), z = (home ? home.z : p.pos.z) + R(-2.2, 2.2); if (walkable(x, z) && z < Z0 - 1.2) tg = new THREE.Vector3(x, 0, z); }
      if (home) tg = new THREE.Vector3(home.x, 0, home.z); p.target = tg;
    }
    let moving = false;
    if (p.target) {
      _d.copy(p.target).sub(p.pos); _d.y = 0; const dist = _d.length();
      if (dist < 0.05) p.target = null;
      else { const sp = p.kind === "bunny" ? 0.9 : (near ? (p.kind === "husky" ? 1.6 : 1.2) : 0.55); _d.normalize(); const nx = p.pos.x + _d.x * Math.min(dist, sp * dt), nz = p.pos.z + _d.z * Math.min(dist, sp * dt); if (walkable(nx, nz)) { p.pos.x = nx; p.pos.z = nz; moving = true; } else p.target = null; p.yaw += (((Math.atan2(_d.x, _d.z) - p.yaw + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI) * Math.min(1, dt * 8); }
    }
    const y = heightAt(p.pos.x, p.pos.z);
    let hop = 0;
    if (p.kind === "bunny" && moving) hop = Math.abs(Math.sin(t * 9)) * 0.12;
    if (p.joy > 0) hop = Math.abs(Math.sin(p.joy * 10)) * 0.15;
    if (p.glb) { // 精模：整只一起动——走路一颠一颠、左右轻轻晃，停下来呼吸、偶尔歪头
      const g = p.glb, walkPh = t * (p.kind === "bunny" ? 9 : 11);
      if (p.kind === "bunny" && moving) hop = Math.abs(Math.sin(walkPh)) * 0.12;
      else if (moving) hop = Math.abs(Math.sin(walkPh)) * 0.025;
      if (p.joy > 0) hop = Math.abs(Math.sin(p.joy * 10)) * (p.kind === "husky" ? 0.2 : 0.15);
      p.g.position.set(p.pos.x, y + hop, p.pos.z); p.g.rotation.y = p.yaw;
      const breath = 1 + Math.sin(t * 2.4 + p.home.x) * 0.012;
      g.rotation.z = moving && p.kind !== "bunny" ? Math.sin(walkPh) * 0.06 : 0;
      g.rotation.x = moving ? (p.kind === "bunny" ? -Math.cos(walkPh) * 0.12 : 0.04) : Math.sin(t * 0.5 + p.home.z) * 0.03;
      g.rotation.y = moving ? 0 : Math.sin(t * 0.45 + p.home.x) * 0.3;
      const sq = p.kind === "bunny" && moving ? (Math.abs(Math.sin(walkPh)) - 0.5) * 0.12 : 0;
      g.scale.set(1 - sq * 0.4, breath + sq, 1 - sq * 0.4);
      if (p.kind === "husky" && p.joy > 0) g.rotation.y = Math.sin(p.joy * 18) * 0.25; // 开心得原地扭
      return;
    }
    p.g.position.set(p.pos.x, y + hop, p.pos.z); p.g.rotation.y = p.yaw;
    if (p.kind === "cat") {
      p.legs.forEach((l, i) => { l.rotation.x = moving ? Math.sin(t * 12 + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI : 0)) * 0.5 : 0; });
      p.tail.rotation.z = Math.sin(t * 2.2) * 0.4; p.head.rotation.y = moving ? 0 : Math.sin(t * 0.6) * 0.4;
      const resting = !moving && Math.hypot(p.pos.x - p.home.x, p.pos.z - p.home.z) < 0.4 && !near; p.body.scale.y += ((resting ? 0.7 : 1) - p.body.scale.y) * Math.min(1, dt * 4);
    } else {
      const ph = Math.sin(t * 9), air = moving ? Math.abs(ph) : 0;
      p.head.rotation.x = moving ? -0.1 : Math.sin(t * 0.7) * 0.08; p.head.rotation.y = moving ? 0 : Math.sin(t * 0.45) * 0.35;
      p.body.scale.set(1, 1 + (moving ? (air - 0.5) * 0.14 : 0), 1 - (moving ? (air - 0.5) * 0.08 : 0)); p.body.rotation.x = moving ? -Math.cos(t * 9) * 0.12 : 0;
      const twitch = Math.max(0, Math.sin(t * 1.7 + 1) - 0.94) * 6;
      p.ears.forEach((e, i) => { e.rotation.x = -0.15 - air * 0.5 + (i ? twitch * 0.2 : 0); e.rotation.z = e.userData.base + Math.sin(t * 2 + i) * 0.04; });
      p.nose.scale.y = 0.007 * (1 + Math.max(0, Math.sin(t * 11)) * 0.3);
    }
  }
  function update(dt, t, env, xbPos) {
    anim.forEach((f) => f(t, dt));
    const dark = env.night ? 1 : env.dusk ? 0.6 : 0;
    bulbMat.emissiveIntensity = 0.4 + dark * 2.6; root.userData.lightsGlow.material.opacity = dark * 0.85;
    // 互动点跟着小动物走（以前一直停在原点，屋子中间也会亮“摸摸猫”）
    pets.forEach((p) => { petStep(p, dt, t, xbPos); p.spot.at[0] = p.g.position.x; p.spot.at[2] = p.g.position.z; });
  }
  function poke(p) { p.joy = 0.8; p.target = null; }
  return { root, walk, update, spots, solid, poke };
}
