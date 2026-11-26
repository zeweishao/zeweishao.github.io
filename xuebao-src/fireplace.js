/* 客厅壁炉：白色大理石洛可可壁炉（左墙），着色器火焰 + 炭火 + 火星 + 黄铜柴架和扇形防火屏，
 * 壁炉台上摆座钟、烛台、相框和玫瑰花瓶。局部坐标：背面贴墙在 z=0，正面朝 +z。
 */
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

export function buildFireplace(THREE, scene, { at, ry = 0, mobile = false, photo = null, texLoader }) {
  const root = new THREE.Group(); root.name = "fireplace";
  root.position.set(at[0], 0, at[2]); root.rotation.y = ry; scene.add(root);

  // ---------- 材质 ----------
  const veinTex = (() => {
    const c = document.createElement("canvas"); c.width = c.height = 512; const g = c.getContext("2d");
    g.fillStyle = "#f7f1e9"; g.fillRect(0, 0, 512, 512);
    let s = 11; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let k = 0; k < 9; k++) {
      g.strokeStyle = `rgba(${150 + r() * 40},${140 + r() * 30},${140 + r() * 30},${0.12 + r() * 0.16})`; g.lineWidth = 0.6 + r() * 1.6;
      g.beginPath(); let x = r() * 512, y = 0; g.moveTo(x, y);
      while (y < 512) { x += (r() - 0.5) * 46; y += 12 + r() * 26; g.lineTo(x, y); } g.stroke();
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  })();
  const marble = new THREE.MeshPhysicalMaterial({ map: veinTex, roughness: 0.26, clearcoat: 0.35, clearcoatRoughness: 0.25 });
  const marbleDk = new THREE.MeshStandardMaterial({ color: "#e9ddd0", roughness: 0.4 });
  const gold = new THREE.MeshStandardMaterial({ color: "#d9b46a", metalness: 1, roughness: 0.3 });
  const brass = new THREE.MeshStandardMaterial({ color: "#c89b50", metalness: 0.9, roughness: 0.36 });
  const soot = new THREE.MeshStandardMaterial({ color: "#1d1517", roughness: 0.95 });
  const brickTex = (() => {
    const c = document.createElement("canvas"); c.width = 256; c.height = 256; const g = c.getContext("2d");
    g.fillStyle = "#3b2622"; g.fillRect(0, 0, 256, 256);
    for (let row = 0; row < 8; row++) for (let i = -1; i < 5; i++) {
      const x = i * 64 + (row % 2) * 32 + 2, y = row * 32 + 2, v = 60 + ((row * 7 + i * 13) % 5) * 9;
      g.fillStyle = `rgb(${v + 70},${v + 20},${v})`; g.fillRect(x, y, 60, 28);
    }
    // 越往上越黑（熏过的样子）
    const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, "rgba(10,6,6,.85)"); gr.addColorStop(0.55, "rgba(10,6,6,.25)"); gr.addColorStop(1, "rgba(10,6,6,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const brick = new THREE.MeshStandardMaterial({ map: brickTex, roughness: 0.92, color: "#8a7068" });

  const add = (geo, mat, x = 0, y = 0, z = 0, parent = root, cast = true) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true; parent.add(m); return m;
  };
  const rbox = (w, h, d, mat, x, y, z, r = 0.012) => add(new RoundedBoxGeometry(w, h, d, 2, r), mat, x, y, z);

  // ---------- 尺寸 ----------
  const WID = 1.36, HGT = 1.12, DEP = 0.34, OW = 0.64, OH = 0.62; // 外宽、高、深；炉口宽、高（拱顶最高处）
  // 炉前石台
  rbox(WID + 0.22, 0.05, DEP + 0.34, marbleDk, 0, 0.025, (DEP + 0.34) / 2, 0.015);
  rbox(WID + 0.12, 0.03, DEP + 0.26, marble, 0, 0.065, (DEP + 0.26) / 2 + 0.01, 0.01);

  // ---------- 炉身：带拱形炉口的整块挤出 ----------
  const arch = new THREE.Shape(), ry0 = 0.08, archR = OW / 2, springY = ry0 + OH - archR;
  arch.moveTo(-OW / 2, ry0); arch.lineTo(OW / 2, ry0); arch.lineTo(OW / 2, springY); arch.absarc(0, springY, archR, 0, Math.PI, false); arch.closePath();
  const face = new THREE.Shape(); face.moveTo(-WID / 2 + 0.16, 0.08); face.lineTo(WID / 2 - 0.16, 0.08); face.lineTo(WID / 2 - 0.16, HGT - 0.12); face.lineTo(-WID / 2 + 0.16, HGT - 0.12); face.closePath(); face.holes.push(arch);
  const faceGeo = new THREE.ExtrudeGeometry(face, { depth: DEP - 0.04, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 2, curveSegments: 32 });
  add(faceGeo, marble, 0, 0, 0);
  // 炉口里：熏黑的砖墙、炉膛底、两侧斜墙
  add(new THREE.PlaneGeometry(OW, OH), brick, 0, ry0 + OH / 2, 0.03, root, false);
  const floorIn = add(new THREE.PlaneGeometry(OW, DEP - 0.05).rotateX(-Math.PI / 2), soot, 0, ry0 + 0.002, (DEP - 0.05) / 2 + 0.03, root, false); floorIn.receiveShadow = true;
  [-1, 1].forEach((k) => { const w = add(new THREE.PlaneGeometry(DEP - 0.06, OH), brick, k * (OW / 2 - 0.005), ry0 + OH / 2, (DEP - 0.06) / 2 + 0.03, root, false); w.rotation.y = -k * Math.PI / 2; });
  // 拱圈：金边 + 拱心石（贝壳纹）
  const archRing = add(new THREE.TorusGeometry(archR + 0.022, 0.014, 10, 40, Math.PI), gold, 0, springY, DEP + 0.008); archRing.castShadow = false;
  [-1, 1].forEach((k) => add(new THREE.CylinderGeometry(0.014, 0.014, springY - ry0, 10), gold, k * (OW / 2 + 0.022), (springY + ry0) / 2, DEP + 0.008, root, false));
  const shell = new THREE.Group(); shell.position.set(0, springY + archR + 0.04, DEP + 0.012); root.add(shell);
  for (let i = 0; i < 9; i++) { const a = -1.1 + (i / 8) * 2.2, rib = add(new THREE.CylinderGeometry(0.008, 0.014, 0.1, 8), gold, Math.sin(a) * 0.045, Math.cos(a) * 0.045, 0, shell, false); rib.rotation.z = -a; }
  add(new THREE.SphereGeometry(0.02, 12, 8), gold, 0, 0, 0.004, shell, false);

  // ---------- 两侧壁柱：凹槽、柱头卷涡、柱础 ----------
  [-1, 1].forEach((k) => {
    const x = k * (WID / 2 - 0.09);
    rbox(0.17, 0.1, DEP + 0.06, marble, x, 0.13, (DEP + 0.06) / 2);          // 柱础
    rbox(0.14, HGT - 0.34, DEP + 0.02, marble, x, (HGT - 0.34) / 2 + 0.18, (DEP + 0.02) / 2); // 柱身
    for (let f = -1; f <= 1; f++) add(new THREE.CylinderGeometry(0.009, 0.009, HGT - 0.44, 8), marbleDk, x + f * 0.035, (HGT - 0.34) / 2 + 0.18, DEP + 0.03, root, false); // 凹槽（用细圆柱做阴影线）
    rbox(0.18, 0.09, DEP + 0.08, marble, x, HGT - 0.12, (DEP + 0.08) / 2);   // 柱头
    const scroll = add(new THREE.TorusGeometry(0.03, 0.009, 8, 20, Math.PI * 1.6), gold, x + k * 0.05, HGT - 0.12, DEP + 0.085, root, false); scroll.rotation.z = k > 0 ? -0.4 : Math.PI + 0.4;
    add(new THREE.SphereGeometry(0.012, 8, 6), gold, x + k * 0.05, HGT - 0.12, DEP + 0.09, root, false);
  });
  // 楣板中间一条金色花饰
  const garlandPts = []; for (let i = 0; i <= 20; i++) { const f = i / 20, x = -0.38 + f * 0.76; garlandPts.push(new THREE.Vector3(x, HGT - 0.2 - Math.sin(f * Math.PI) * 0.035, DEP + 0.004)); }
  add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(garlandPts), 40, 0.006, 6), gold, 0, 0, 0, root, false);
  [-0.38, 0.38].forEach((x) => add(new THREE.SphereGeometry(0.016, 10, 8), gold, x, HGT - 0.2, DEP + 0.006, root, false));

  // ---------- 壁炉台面：三层线脚 ----------
  rbox(WID + 0.04, 0.04, DEP + 0.1, marble, 0, HGT - 0.05, (DEP + 0.1) / 2, 0.01);
  add(new THREE.BoxGeometry(WID + 0.08, 0.012, DEP + 0.12), gold, 0, HGT - 0.024, (DEP + 0.12) / 2);
  rbox(WID + 0.16, 0.05, DEP + 0.18, marble, 0, HGT + 0.008, (DEP + 0.18) / 2, 0.018);
  const TOP = HGT + 0.033;

  // ---------- 柴架、木柴、炭火 ----------
  const fireZ = DEP * 0.5 + 0.02;
  [-1, 1].forEach((k) => {
    const x = k * 0.19;
    add(new THREE.BoxGeometry(0.02, 0.018, 0.2), brass, x, ry0 + 0.03, fireZ, root, false);
    add(new THREE.CylinderGeometry(0.01, 0.012, 0.12, 10), brass, x, ry0 + 0.07, fireZ + 0.1, root, false);
    add(new THREE.SphereGeometry(0.022, 14, 10), gold, x, ry0 + 0.14, fireZ + 0.1, root, false);
  });
  const bark = new THREE.MeshStandardMaterial({ color: "#4a2f24", roughness: 0.95 }), endWood = new THREE.MeshStandardMaterial({ color: "#c08a5c", roughness: 0.8 });
  const logGlow = new THREE.MeshStandardMaterial({ color: "#2b1a14", emissive: "#ff5a1c", emissiveIntensity: 0.6, roughness: 0.9 });
  [[0, 0.055, -0.04, 0.0, 0.05, bark], [-0.03, 0.09, 0.03, 0.25, 0.043, logGlow], [0.05, 0.1, -0.02, -0.3, 0.04, bark]].forEach(([x, y, dz, a, r, m]) => {
    const log = add(new THREE.CylinderGeometry(r, r * 1.05, 0.46, 12), m, x, ry0 + y, fireZ + dz, root, true);
    log.rotation.z = Math.PI / 2; log.rotation.y = a;
    [-1, 1].forEach((s) => { const e = add(new THREE.CircleGeometry(r * 0.92, 14), endWood, 0, s * 0.231, 0, log, false); e.rotation.x = -s * Math.PI / 2; });
  });
  // 炭床：一块发光的小地毯，着色器里慢慢明灭
  const emberMat = new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: "varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }",
    fragmentShader: `uniform float uT; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
      void main(){ vec2 c=vUv-.5; float m=smoothstep(.5,.1,length(c*vec2(1.,1.6)));
        float k=n(vUv*14.+vec2(0.,uT*.6))*.6+n(vUv*30.-uT*.9)*.4; float g=m*smoothstep(.35,.9,k);
        gl_FragColor=vec4(vec3(1.,.42,.1)*g*1.6+vec3(1.,.8,.4)*pow(g,3.)*1.2, g); }`
  });
  add(new THREE.PlaneGeometry(0.5, 0.26).rotateX(-Math.PI / 2), emberMat, 0, ry0 + 0.012, fireZ, root, false).userData.noHit = true;

  // ---------- 火焰：三片交叉的着色器面片（噪声往上卷，白黄芯、橙边、红尖） ----------
  const flameMat = new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uI: { value: 1 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: "varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }",
    fragmentShader: `uniform float uT, uI; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
      float fbm(vec2 p){ float v=0., a=.5; for(int i=0;i<4;i++){ v+=a*n(p); p*=2.03; a*=.5; } return v; }
      void main(){
        vec2 uv=vUv; float y=uv.y;
        float q=fbm(vec2(uv.x*3.2, y*2.4-uT*2.2));
        float x=(uv.x-.5)*2.; x+= (q-.5)*.9*y;                       // 越往上摆得越厉害
        float w=mix(.95,.16,pow(y,.8));                                // 下宽上尖
        float body=smoothstep(w,w*.3,abs(x)) * smoothstep(.88,.42,y+q*.3) * smoothstep(0.,.08,y);
        float core=smoothstep(w*.55,0.,abs(x))*smoothstep(.62,.05,y+q*.2);
        vec3 col=mix(vec3(.95,.22,.05), vec3(1.,.62,.16), body); col=mix(col, vec3(1.,.93,.7), core);
        gl_FragColor=vec4(col*uI*1.35, body*uI);
      }`
  });
  // 火焰面片始终转向镜头（只绕竖轴转），避免侧着看成一条线；大小不一的四朵错开摆
  const flames = new THREE.Group(); flames.position.set(0, ry0 + 0.06, fireZ); root.add(flames);
  const flameBoards = [[0, 0, 0.4, 0.44], [-0.1, 0.02, 0.26, 0.3], [0.11, 0.015, 0.28, 0.33], [0.02, 0.05, 0.2, 0.22]].map(([x, z, w, h], i) => {
    const f = add(new THREE.PlaneGeometry(w, h).translate(0, h / 2, 0), i ? flameMat.clone() : flameMat, x, 0, z, flames, false);
    f.userData.noHit = true; f.renderOrder = 4 + i; f.userData.ph = i * 1.7; return f;
  });

  // ---------- 火星：从火里慢慢往上飘，碰到炉口顶就熄 ----------
  const SN = mobile ? 18 : 30, sp = new Float32Array(SN * 3), sd = Array.from({ length: SN }, (_, i) => [Math.random(), Math.random(), 0.25 + Math.random() * 0.35, i]);
  const sGeo = new THREE.BufferGeometry(); sGeo.setAttribute("position", new THREE.BufferAttribute(sp, 3));
  const sparkTex = (() => { const c = document.createElement("canvas"); c.width = c.height = 32; const g = c.getContext("2d"); const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, "rgba(255,240,200,1)"); gr.addColorStop(0.35, "rgba(255,150,60,.8)"); gr.addColorStop(1, "rgba(255,80,20,0)"); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c); })();
  const sparks = new THREE.Points(sGeo, new THREE.PointsMaterial({ map: sparkTex, size: 0.03, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  sparks.frustumCulled = false; sparks.userData.noHit = true; root.add(sparks);

  // ---------- 扇形黄铜防火屏（三折，镂空网格） ----------
  const meshTex = (() => { const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d"); g.clearRect(0, 0, 64, 64); g.strokeStyle = "rgba(255,255,255,1)"; g.lineWidth = 2; for (let i = 0; i <= 64; i += 8) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 64); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(64, i); g.stroke(); } const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(5, 4); return t; })();
  meshTex.repeat.set(9, 6);
  const screenMat = new THREE.MeshStandardMaterial({ color: "#6b5440", alphaMap: meshTex, transparent: true, opacity: 0.55, metalness: 0.7, roughness: 0.45, side: THREE.DoubleSide, depthWrite: false });
  const screen = new THREE.Group(); screen.position.set(0, 0.07, DEP + 0.2); screen.scale.set(1, 0.68, 1); root.add(screen);
  [[-0.27, 0.42], [0, 0], [0.27, -0.42]].forEach(([x, a]) => {
    const p = new THREE.Group(); p.position.x = x; p.rotation.y = a; screen.add(p);
    const shp = new THREE.Shape(); shp.moveTo(-0.13, 0); shp.lineTo(0.13, 0); shp.lineTo(0.13, x ? 0.38 : 0.44); shp.quadraticCurveTo(0, x ? 0.46 : 0.54, -0.13, x ? 0.38 : 0.44); shp.closePath();
    add(new THREE.ShapeGeometry(shp, 12), screenMat, 0, 0, 0, p, false).renderOrder = 5;
    const edge = shp.getPoints(24).map((v) => new THREE.Vector3(v.x, v.y, 0));
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(edge, true), 60, 0.007, 6, true), brass, 0, 0, 0, p, false);
    [-0.13, 0.13].forEach((fx) => add(new THREE.SphereGeometry(0.014, 10, 8), gold, fx, 0.008, 0, p, false));
  });
  add(new THREE.SphereGeometry(0.022, 14, 10), gold, 0, 0.56, 0, screen, false);

  // ---------- 壁炉台上的摆件 ----------
  const deco = new THREE.Group(); deco.position.y = TOP; root.add(deco);
  // 中间：金色马车钟
  {
    const clock = new THREE.Group(); clock.position.set(0, 0, DEP * 0.45); deco.add(clock);
    add(new RoundedBoxGeometry(0.2, 0.025, 0.1, 2, 0.008), gold, 0, 0.012, 0, clock);
    add(new RoundedBoxGeometry(0.16, 0.16, 0.08, 2, 0.02), gold, 0, 0.105, 0, clock);
    const dialTex = (() => { const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d"); g.fillStyle = "#fffaf0"; g.beginPath(); g.arc(64, 64, 62, 0, 7); g.fill(); g.strokeStyle = "#b89048"; g.lineWidth = 4; g.stroke(); g.fillStyle = "#5a4630"; g.font = "bold 18px serif"; g.textAlign = "center"; g.textBaseline = "middle"; ["XII", "III", "VI", "IX"].forEach((t, i) => { const a = i * Math.PI / 2; g.fillText(t, 64 + Math.sin(a) * 44, 64 - Math.cos(a) * 44); }); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
    add(new THREE.CircleGeometry(0.055, 32), new THREE.MeshStandardMaterial({ map: dialTex, roughness: 0.4 }), 0, 0.105, 0.0405, clock, false);
    const hand = (len, w) => { const h = add(new THREE.BoxGeometry(w, len, 0.003).translate(0, len / 2, 0), new THREE.MeshStandardMaterial({ color: "#3a2a1c" }), 0, 0.105, 0.043, clock, false); return h; };
    clock.userData.hh = hand(0.03, 0.006); clock.userData.mh = hand(0.045, 0.004);
    const dome = add(new THREE.SphereGeometry(0.06, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), gold, 0, 0.185, 0, clock); dome.scale.set(1, 0.6, 0.65);
    add(new THREE.SphereGeometry(0.014, 10, 8), gold, 0, 0.23, 0, clock, false);
    deco.userData.clock = clock;
  }
  // 两侧：黄铜烛台 + 会晃的小烛火
  const candleFlames = [];
  [-1, 1].forEach((k) => {
    const g = new THREE.Group(); g.position.set(k * 0.5, 0, DEP * 0.45); deco.add(g);
    add(new THREE.CylinderGeometry(0.04, 0.05, 0.015, 16), brass, 0, 0.008, 0, g);
    add(new THREE.CylinderGeometry(0.008, 0.012, 0.14, 10), brass, 0, 0.085, 0, g);
    add(new THREE.SphereGeometry(0.018, 12, 8), gold, 0, 0.06, 0, g, false);
    add(new THREE.CylinderGeometry(0.026, 0.02, 0.012, 14), brass, 0, 0.158, 0, g, false);
    add(new THREE.CylinderGeometry(0.014, 0.014, 0.1, 12), new THREE.MeshStandardMaterial({ color: "#fff4e2", roughness: 0.6 }), 0, 0.214, 0, g);
    const f = add(new THREE.SphereGeometry(0.012, 10, 8), new THREE.MeshBasicMaterial({ color: "#ffd27a" }), 0, 0.282, 0, g, false); f.scale.set(0.7, 1.6, 0.7); f.userData.noHit = true; candleFlames.push(f);
  });
  // 左边：小相框；右边：粉玫瑰花瓶
  {
    const g = new THREE.Group(); g.position.set(-0.27, 0, DEP * 0.4); g.rotation.y = 0.25; deco.add(g);
    add(new RoundedBoxGeometry(0.13, 0.16, 0.014, 2, 0.004), gold, 0, 0.085, 0, g);
    const pic = add(new THREE.PlaneGeometry(0.1, 0.13), new THREE.MeshStandardMaterial({ color: "#f3e5d8", roughness: 0.7 }), 0, 0.085, 0.0075, g, false);
    if (photo && texLoader) texLoader.load(photo, (t) => { t.colorSpace = THREE.SRGBColorSpace; pic.material.map = t; pic.material.color.set("#ffffff"); pic.material.needsUpdate = true; });
    const leg = add(new THREE.BoxGeometry(0.01, 0.12, 0.008), gold, 0, 0.06, -0.04, g, false); leg.rotation.x = 0.5;
  }
  {
    const g = new THREE.Group(); g.position.set(0.27, 0, DEP * 0.42); deco.add(g);
    const vase = add(new THREE.LatheGeometry([[0, 0], [0.03, 0], [0.042, 0.03], [0.036, 0.08], [0.022, 0.11], [0.03, 0.13]].map(([x, y]) => new THREE.Vector2(x, y)), 20), new THREE.MeshPhysicalMaterial({ color: "#f6dfe6", roughness: 0.2, clearcoat: 0.6 }), 0, 0, 0, g);
    vase.castShadow = true;
    const rose = new THREE.MeshStandardMaterial({ color: "#f19bb3", roughness: 0.55 }), leaf = new THREE.MeshStandardMaterial({ color: "#6f9a5b", roughness: 0.6 });
    [[0, 0.2, 0], [0.04, 0.18, 0.02], [-0.035, 0.185, -0.015], [0.01, 0.17, -0.04], [-0.02, 0.16, 0.04]].forEach(([x, y, z], i) => {
      add(new THREE.CylinderGeometry(0.003, 0.003, y - 0.1, 5), leaf, x * 0.5, 0.1 + (y - 0.1) / 2, z * 0.5, g, false);
      for (let p = 0; p < 5; p++) { const a = p * 1.256 + i, pe = add(new THREE.SphereGeometry(0.018, 8, 6), rose, x + Math.cos(a) * 0.01, y, z + Math.sin(a) * 0.01, g, false); pe.scale.set(0.9, 0.7, 0.5); pe.rotation.y = a; }
      add(new THREE.SphereGeometry(0.012, 8, 6), new THREE.MeshStandardMaterial({ color: "#e5728f" }), x, y + 0.008, z, g, false);
    });
    [[0.05, 0.14, 0.03], [-0.05, 0.13, -0.02]].forEach(([x, y, z]) => { const l = add(new THREE.SphereGeometry(0.02, 8, 6), leaf, x, y, z, g, false); l.scale.set(1.3, 0.3, 0.6); l.rotation.z = x > 0 ? -0.5 : 0.5; });
  }

  // ---------- 旁边：柴火篮 ----------
  {
    const g = new THREE.Group(); g.position.set(WID / 2 + 0.2, 0, 0.28); root.add(g);
    const wicker = new THREE.MeshStandardMaterial({ color: "#b98a58", roughness: 0.85 });
    const basket = add(new THREE.CylinderGeometry(0.15, 0.12, 0.16, 18, 1, true), wicker, 0, 0.08, 0, g); basket.material.side = THREE.DoubleSide;
    add(new THREE.CircleGeometry(0.12, 18).rotateX(-Math.PI / 2), wicker, 0, 0.005, 0, g, false);
    add(new THREE.TorusGeometry(0.15, 0.012, 6, 24).rotateX(Math.PI / 2), wicker, 0, 0.16, 0, g, false);
    [[-0.05, 0.03, 0.2], [0.05, -0.02, -0.15], [0, 0.05, 0.05], [-0.03, -0.05, -0.3]].forEach(([x, z, a], i) => { const l = add(new THREE.CylinderGeometry(0.03, 0.032, 0.32, 10), bark, x, 0.18 + (i > 1 ? 0.05 : 0), z, g); l.rotation.z = Math.PI / 2 + a; l.rotation.y = i * 0.7; });
  }

  // ---------- 灯光：炉火的暖光（夜里更亮），微微闪 ----------
  const glow = new THREE.PointLight("#ff8a45", 0, 3.2, 2); glow.position.set(0, ry0 + 0.4, DEP + 0.5); root.add(glow);
  // 火光照在地上的一圈暖色（加法混合的小圆片）
  const floorGlowTex = (() => { const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d"); const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, "rgba(255,150,70,.55)"); gr.addColorStop(1, "rgba(255,120,50,0)"); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
  const floorGlow = add(new THREE.PlaneGeometry(1.8, 1.3).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: floorGlowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), 0, 0.006, DEP + 0.55, root, false);
  floorGlow.userData.noHit = true;

  const _w = new THREE.Vector3();
  const _cam = new THREE.Vector3(), _me = new THREE.Vector3();
  function update(dt, t, night, camera) {
    emberMat.uniforms.uT.value = t;
    if (camera) { camera.getWorldPosition(_cam); flames.getWorldPosition(_me); const a = Math.atan2(_cam.x - _me.x, _cam.z - _me.z) - root.rotation.y; flames.rotation.y = a; }
    flameBoards.forEach((f) => { f.material.uniforms.uT.value = t + f.userData.ph; f.material.uniforms.uI.value = flameMat.uniforms.uI.value; });
    const flick = 0.85 + Math.sin(t * 9.1) * 0.06 + Math.sin(t * 15.7 + 1.3) * 0.05 + Math.sin(t * 3.3) * 0.05;
    flameMat.uniforms.uI.value = flick;
    flames.scale.set(1, 0.92 + (flick - 0.85) * 1.6, 1);
    glow.intensity = (night ? 1.5 : 0.6) * flick;
    floorGlow.material.opacity = (night ? 0.7 : 0.3) * flick;
    candleFlames.forEach((f, i) => { const k = 1 + Math.sin(t * 11 + i * 2) * 0.12; f.scale.set(0.7 / k, 1.6 * k, 0.7 / k); f.position.x = Math.sin(t * 7 + i) * 0.002; });
    for (let i = 0; i < SN; i++) {
      const [a, b, sp0] = sd[i], life = ((t * sp0 + a * 3) % 1);
      sp[i * 3] = (b - 0.5) * 0.36 + Math.sin(t * 2 + i) * 0.03 * life;
      sp[i * 3 + 1] = ry0 + 0.08 + life * (OH - 0.12);
      sp[i * 3 + 2] = fireZ + (a - 0.5) * 0.14;
    }
    sGeo.attributes.position.needsUpdate = true;
    // 座钟走的是纽约时间（和小屋时钟一致）
    const c = deco.userData.clock;
    if (c && t - (c.userData.at ?? -9) > 5) {
      c.userData.at = t;
      const [hh, mm] = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "numeric", hourCycle: "h23" }).format(new Date()).split(":").map(Number);
      c.userData.hh.rotation.z = -((hh % 12) + mm / 60) / 12 * Math.PI * 2; c.userData.mh.rotation.z = -mm / 60 * Math.PI * 2;
    }
  }
  return { root, update, width: WID + 0.22, depth: DEP + 0.34, top: TOP };
}
