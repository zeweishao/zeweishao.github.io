/* 小世界里的 9 个入口：网站原来的每个分页面，在大厅或花园里都是一件能点的东西。
 * 大厅：写字台上的情书（一页情书）、右墙的拍立得照片墙（照片）、复古小电视（回忆角）、画架上的漫画（漫画）。
 * 花园：树桩上的大故事书（团子的故事书）、蘑菇小屋（团子之家）、奶茶推车（能量补给站）、橡树树洞（悄悄话）、星星邮筒（星星邮差）。
 * 每个入口返回 { id, name, icon, href, at, pick, lines }，交给 hall-scene 的牌子和点击系统；点了就镜头凑近、淡出、跳转。
 */
import { buildMilkTeaCart, buildStarPostbox } from "./garden-props.js";
let cafeAt = null;
export function buildEntrances(THREE, scene, { D, W, FRONT, heightAt, texLoader, maxAniso, A }) {
  const root = new THREE.Group(); root.name = "entrances"; scene.add(root);
  const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.6, ...o });
  const add = (geo, mat, x, y, z, o = {}) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (o.rx) m.rotation.x = o.rx; if (o.ry) m.rotation.y = o.ry; if (o.rz) m.rotation.z = o.rz; m.castShadow = o.cast !== false; m.receiveShadow = true; (o.parent || root).add(m); return m; };
  const box = (w, h, d, mat, x, y, z, o) => add(new THREE.BoxGeometry(w, h, d), mat, x, y, z, o);
  const group = (x, y, z, ry = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; root.add(g); return g; };
  const L = (pts, seg = 32) => new THREE.LatheGeometry(pts.map(([a, b]) => new THREE.Vector2(a, b)), seg);
  const tex = (url) => { const t = texLoader.load(url); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = maxAniso; return t; };
  const canvasTex = (w, h, draw) => { const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = maxAniso; return t; };
  const face = (x, z, tx, tz) => Math.atan2(tx - x, tz - z);
  const cream = std({ color: "#fbf3ea", roughness: 0.45 }), gold = std({ color: "#e0bb72", metalness: 1, roughness: 0.28 }), wood = std({ color: "#b98b64", roughness: 0.7 });
  const glowMats = []; // 夜里更亮的自发光
  const spots = [], anim = [];
  const glowTex = canvasTex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, "rgba(255,240,200,1)"); gr.addColorStop(0.45, "rgba(255,210,150,.35)"); gr.addColorStop(1, "rgba(255,200,150,0)"); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
  // 一小团会飘的光点（爱心、星星、字母……）
  function floaters(parent, n, color, size, area, speed = 0.25) {
    const pos = new Float32Array(n * 3), seed = Array.from({ length: n }, () => [Math.random(), Math.random(), Math.random()]);
    const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ map: glowTex, color, size, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.85 }));
    pts.frustumCulled = false; pts.userData.noHit = true; parent.add(pts);
    anim.push((t) => { for (let i = 0; i < n; i++) { const [a, b, c] = seed[i], f = (t * speed * (0.6 + c * 0.6) + b) % 1; pos[i * 3] = (a - 0.5) * area[0] + Math.sin(t + i) * 0.03; pos[i * 3 + 1] = area[2] + f * area[1]; pos[i * 3 + 2] = (c - 0.5) * area[0] * 0.6; } geo.attributes.position.needsUpdate = true; pts.material.opacity = 0.85 * Math.min(1, Math.sin(Math.PI * ((t * 0.5) % 1)) + 0.6); });
    return pts;
  }

  // ========== 大厅 ==========
  // 1) 一页情书：左墙前的小写字台，信封立在金色小架上，蜡封是心
  {
    const x = -W / 2 + 0.42, z = 0.55, g = group(x, 0, z, Math.PI / 2);
    box(0.86, 0.035, 0.46, cream, 0, 0.72, 0, { parent: g }); box(0.88, 0.012, 0.48, gold, 0, 0.705, 0, { parent: g, cast: false });
    box(0.8, 0.1, 0.4, cream, 0, 0.65, 0, { parent: g });
    [[-0.38, -0.18], [0.38, -0.18], [-0.38, 0.18], [0.38, 0.18]].forEach(([a, b]) => add(L([[0.02, 0], [0.012, 0.1], [0.028, 0.5], [0.022, 0.6], [0, 0.6]], 10), cream, a, 0, b, { parent: g }));
    const env = canvasTex(256, 176, (c, w, h) => {
      c.fillStyle = "#fde3e6"; c.fillRect(0, 0, w, h); c.strokeStyle = "#f3b0bd"; c.lineWidth = 6; c.strokeRect(3, 3, w - 6, h - 6);
      c.beginPath(); c.moveTo(6, 6); c.lineTo(w / 2, h * 0.58); c.lineTo(w - 6, 6); c.strokeStyle = "#f0a5b5"; c.lineWidth = 4; c.stroke();
      c.fillStyle = "#c8344c"; c.beginPath(); const cx = w / 2, cy = h * 0.58; c.arc(cx, cy, 24, 0, 7); c.fill();
      c.fillStyle = "#ffe8ec"; c.beginPath(); c.moveTo(cx, cy + 9); c.bezierCurveTo(cx - 16, cy - 2, cx - 9, cy - 14, cx, cy - 5); c.bezierCurveTo(cx + 9, cy - 14, cx + 16, cy - 2, cx, cy + 9); c.fill();
      c.fillStyle = "#a8556a"; c.font = "italic 600 22px Georgia, serif"; c.textAlign = "center"; c.fillText("To 雪雪", w / 2, h - 20);
    });
    const em = std({ map: env, emissive: "#ffffff", emissiveMap: env, emissiveIntensity: 0.15, roughness: 0.7, side: THREE.DoubleSide }); glowMats.push([em, 0.15, 0.5]);
    const letter = add(new THREE.PlaneGeometry(0.26, 0.18), em, 0, 0.86, 0.02, { parent: g, rx: -0.25 });
    box(0.2, 0.012, 0.05, gold, 0, 0.745, 0.06, { parent: g, cast: false });
    // 墨水瓶 + 羽毛笔、小蜡烛
    add(new THREE.CylinderGeometry(0.03, 0.035, 0.05, 14), std({ color: "#2f3550", roughness: 0.2 }), 0.27, 0.765, -0.05, { parent: g });
    const quill = add(new THREE.ConeGeometry(0.022, 0.26, 8), std({ color: "#ffffff", roughness: 0.8 }), 0.27, 0.9, -0.05, { parent: g, rz: 0.35 }); quill.scale.z = 0.3;
    add(new THREE.CylinderGeometry(0.018, 0.018, 0.12, 12), cream, -0.3, 0.8, -0.08, { parent: g });
    const flame = std({ color: "#ffd38a", emissive: "#ffb45c", emissiveIntensity: 1.4 }); add(new THREE.SphereGeometry(0.012, 8, 8), flame, -0.3, 0.875, -0.08, { parent: g, cast: false }).scale.y = 1.8;
    const notes = new THREE.Group(); notes.position.set(-0.15, 0.741, 0.092); notes.rotation.y = 0.23; g.add(notes);
    box(0.14, 0.006, 0.097, std({ color: "#e6b2aa" }), 0, 0.003, 0, { parent: notes });
    box(0.126, 0.004, 0.084, cream, 0.006, 0.008, -0.003, { parent: notes });
    const seal = add(new THREE.CylinderGeometry(0.012, 0.012, 0.005, 12), std({ color: "#a7455a", roughness: 0.48 }), 0.022, 0.012, 0.006, { parent: notes });
    seal.rotation.y = 0.34;
    const hearts = floaters(g, 14, "#ff9fb5", 0.05, [0.35, 0.55, 0.8], 0.22);
    hearts.position.set(0, 0, 0.02);
    // 小凳
    add(L([[0, 0], [0.16, 0], [0.17, 0.03], [0.16, 0.06], [0, 0.06]], 24), std({ color: "#f0b2bd", roughness: 0.8 }), 0, 0.42, 0.42, { parent: g });
    [[-0.1, 0.32], [0.1, 0.32], [-0.1, 0.52], [0.1, 0.52]].forEach(([a, b]) => add(new THREE.CylinderGeometry(0.012, 0.01, 0.42, 6).translate(0, 0.21, 0), cream, a, 0, b, { parent: g }));
    spots.push({ id: "letter", name: "一页情书", icon: "💌", href: "index.html", at: [x + 0.05, 1.3, z], pick: [g], lines: ["这封信是写给你的。", "要一个字一个字读哦。"] });
  }
  // 2) 照片：右墙的拍立得照片墙，一串小灯挂着六张照片
  {
    const x = W / 2 - 0.03, z0 = -0.75, g = group(x, 0, z0 + 0.65, -Math.PI / 2);
    const bulbM = std({ color: "#fff3d6", emissive: "#ffcf7a", emissiveIntensity: 0.6 }); glowMats.push([bulbM, 0.6, 2.2]);
    const string = (y0, sag) => { const pts = []; for (let i = 0; i <= 24; i++) { const f = i / 24, xx = -0.7 + f * 1.4; pts.push(new THREE.Vector3(xx, y0 - Math.sin(f * Math.PI) * sag, 0.03)); } add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.004, 5), std({ color: "#7a6a5a" }), 0, 0, 0, { parent: g, cast: false }); for (let i = 1; i < 24; i += 2) add(new THREE.SphereGeometry(0.013, 8, 6), bulbM, pts[i].x, pts[i].y - 0.015, 0.035, { parent: g, cast: false }); return pts; };
    const s1 = string(2.05, 0.12), s2 = string(1.55, 0.1);
    for (let i = 0; i < 6; i++) {
      const row = i < 3 ? s1 : s2, k = 4 + (i % 3) * 8, p = row[k];
      const card = new THREE.Group(); card.position.set(p.x, p.y - 0.02, 0.04); card.rotation.z = (Math.random() - 0.5) * 0.25; g.add(card);
      box(0.2, 0.24, 0.006, std({ color: "#fffdf8", roughness: 0.8 }), 0, -0.12, 0, { parent: card });
      add(new THREE.PlaneGeometry(0.17, 0.17), std({ map: tex(`${A}ent-photo-${i + 1}.jpg`), roughness: 0.7 }), 0, -0.1, 0.0045, { parent: card, cast: false });
      box(0.025, 0.04, 0.012, wood, 0, 0, 0.006, { parent: card, cast: false });
    }
    spots.push({ id: "albums", name: "照片", icon: "📷", href: "albums.html", at: [x - 0.12, 2.35, z0 + 0.65], pick: [g], lines: ["这些都是我们的照片～", "每一张我都记得。"] });
  }
  // 3) 回忆角：右前角的复古小电视，屏幕里一张张轮播照片
  {
    const x = W / 2 - 0.5, z = FRONT - 0.5, g = group(x, 0, z, face(x, z, 0, -0.6));
    box(0.66, 0.42, 0.42, wood, 0, 0.29, 0, { parent: g }); box(0.68, 0.02, 0.44, std({ color: "#a37653" }), 0, 0.51, 0, { parent: g });
    [[-0.28, -0.16], [0.28, -0.16], [-0.28, 0.16], [0.28, 0.16]].forEach(([a, b]) => add(new THREE.CylinderGeometry(0.018, 0.012, 0.08, 6).translate(0, 0.04, 0), wood, a, 0, b, { parent: g }));
    box(0.56, 0.42, 0.38, std({ color: "#f3c6c2", roughness: 0.4 }), 0, 0.73, 0, { parent: g });
    box(0.44, 0.33, 0.02, std({ color: "#3b3036", roughness: 0.3 }), -0.04, 0.74, 0.19, { parent: g, cast: false });
    const sc = document.createElement("canvas"); sc.width = 256; sc.height = 192; const sg = sc.getContext("2d");
    const screen = new THREE.CanvasTexture(sc); screen.colorSpace = THREE.SRGBColorSpace;
    const sm = new THREE.MeshStandardMaterial({ map: screen, emissive: "#ffffff", emissiveMap: screen, emissiveIntensity: 0.9, roughness: 0.25 });
    add(new THREE.PlaneGeometry(0.38, 0.28), sm, -0.04, 0.74, 0.201, { parent: g, cast: false });
    [0.2, 0.24].forEach((yy, i) => add(new THREE.CylinderGeometry(0.018, 0.018, 0.012, 12).rotateX(Math.PI / 2), gold, 0.21, 0.66 + i * 0.12, 0.195, { parent: g, cast: false }));
    [-1, 1].forEach((k) => add(new THREE.CylinderGeometry(0.004, 0.004, 0.32, 5).translate(0, 0.16, 0), gold, k * 0.06, 0.94, -0.05, { parent: g, rz: k * -0.5, cast: false }));
    const imgs = [1, 2, 3, 4, 5, 6].map((i) => { const im = new Image(); im.src = `${A}ent-photo-${i}.jpg`; return im; });
    let cur = 0, last = -9;
    anim.push((t) => {
      if (t - last < 0.1) return; last = t;
      const k = Math.floor(t / 2.6) % 6, f = (t / 2.6) % 1, a = imgs[k], b = imgs[(k + 1) % 6];
      sg.fillStyle = "#f6e6d8"; sg.fillRect(0, 0, 256, 192);
      if (a.complete && a.naturalWidth) { sg.globalAlpha = 1; sg.drawImage(a, 32, 0, 192, 192); }
      if (f > 0.85 && b.complete && b.naturalWidth) { sg.globalAlpha = (f - 0.85) / 0.15; sg.drawImage(b, 32, 0, 192, 192); }
      sg.globalAlpha = 0.12; sg.fillStyle = "#000"; for (let y = (t * 40) % 4; y < 192; y += 4) sg.fillRect(0, y, 256, 1);
      const gr = sg.createRadialGradient(128, 96, 60, 128, 96, 160); gr.addColorStop(0, "rgba(255,230,200,0)"); gr.addColorStop(1, "rgba(80,40,40,.55)"); sg.globalAlpha = 1; sg.fillStyle = gr; sg.fillRect(0, 0, 256, 192);
      screen.needsUpdate = true; cur = k;
    });
    spots.push({ id: "videos", name: "回忆角", icon: "📺", href: "videos.html", at: [x, 1.35, z], pick: [g], lines: ["一起看看以前的视频吧。", "这段我看了好多遍。"] });
  }
  // 4) 漫画：左前角的画架，上面是漫画第一章的封面
  {
    const x = -W / 2 + 0.55, z = FRONT - 0.5, g = group(x, 0, z, face(x, z, 0.3, -0.6));
    const leg = (a, rz, rx) => { const m = box(0.03, 1.45, 0.03, wood, a, 0.7, 0, { parent: g }); m.rotation.z = rz; m.rotation.x = rx; return m; };
    leg(-0.22, -0.12, 0); leg(0.22, 0.12, 0); const back = box(0.03, 1.4, 0.03, wood, 0, 0.66, -0.25, { parent: g }); back.rotation.x = 0.3;
    box(0.56, 0.03, 0.08, wood, 0, 0.62, 0.05, { parent: g });
    box(0.5, 0.68, 0.025, std({ color: "#fffaf2" }), 0, 0.98, 0.04, { parent: g, rx: -0.08 });
    add(new THREE.PlaneGeometry(0.46, 0.64), std({ map: tex(`${A}ent-comic.jpg`), roughness: 0.75 }), 0, 0.98, 0.054, { parent: g, rx: -0.08, cast: false });
    // 调色盘 + 笔筒
    const pal = add(new THREE.CylinderGeometry(0.09, 0.09, 0.008, 20), std({ color: "#e8cfa8" }), 0.12, 0.64, 0.07, { parent: g, cast: false }); pal.scale.z = 0.7;
    ["#f17d8e", "#7fc3ea", "#f9d76b", "#9ad08f"].forEach((c, i) => add(new THREE.SphereGeometry(0.012, 8, 6), std({ color: c, roughness: 0.3 }), 0.08 + i * 0.03, 0.648, 0.06 + (i % 2) * 0.03, { parent: g, cast: false }));
    add(new THREE.CylinderGeometry(0.04, 0.035, 0.12, 14), std({ color: "#9fc6e6" }), -0.32, 0.06, 0.18, { parent: g });
    ["#f17d8e", "#f9d76b", "#ffffff"].forEach((c, i) => add(new THREE.CylinderGeometry(0.005, 0.005, 0.22, 5), std({ color: c }), -0.32 + (i - 1) * 0.015, 0.19, 0.18, { parent: g, rz: (i - 1) * 0.15, cast: false }));
    spots.push({ id: "comic", name: "漫画", icon: "🎨", href: "comic.html", at: [x, 1.6, z], pick: [g], lines: ["画好新的一话啦！", "主角是我们哦。"] });
  }

  // ========== 花园 ==========
  // 5) 团子的故事书：长青苔的树桩上摊开一本大书
  {
    const x = -3.0, z = -8.4, y = heightAt(x, z), g = group(x, y, z, face(x, z, -1.6, -9.4));
    add(L([[0, 0], [0.38, 0], [0.33, 0.05], [0.3, 0.42], [0, 0.42]], 20), std({ color: "#8a6648", roughness: 0.95 }), 0, 0, 0, { parent: g });
    add(new THREE.CylinderGeometry(0.3, 0.3, 0.02, 20), std({ color: "#e6cfa6" }), 0, 0.42, 0, { parent: g });
    add(new THREE.SphereGeometry(0.16, 12, 8, 0, 7, 0, 1.4), std({ color: "#7aa35f", roughness: 1 }), -0.22, 0.38, 0.1, { parent: g }).scale.y = 0.4;
    const page = (side, map) => { const geo = new THREE.PlaneGeometry(0.3, 0.38, 8, 1); const p = geo.attributes.position; for (let i = 0; i < p.count; i++) { const u = (p.getX(i) + 0.15) / 0.3; p.setZ(i, Math.sin(u * Math.PI) * 0.03 + (side < 0 ? 1 - u : u) * 0.02); } geo.computeVertexNormals(); const m = add(geo, std({ map, roughness: 0.8, side: THREE.DoubleSide }), side * 0.155, 0.47, 0.0, { parent: g, rx: -Math.PI / 2 + 0.35 }); return m; };
    box(0.66, 0.02, 0.42, std({ color: "#b8435c" }), 0, 0.445, -0.01, { parent: g, rx: 0.35 });
    page(-1, tex(`${A}ent-story.jpg`));
    page(1, canvasTex(192, 256, (c, w, h) => { c.fillStyle = "#fffaf0"; c.fillRect(0, 0, w, h); c.fillStyle = "#8a6a5a"; c.font = "600 22px 'PingFang SC', sans-serif"; c.fillText("从前，", 18, 40); c.fillStyle = "rgba(140,110,90,.35)"; for (let i = 0; i < 8; i++) c.fillRect(18, 60 + i * 22, w - 36 - (i % 3) * 18, 6); c.fillStyle = "#f3a9b8"; c.font = "28px serif"; c.fillText("✿", w - 44, h - 24); }));
    floaters(g, 16, "#ffe8a0", 0.045, [0.5, 0.8, 0.5], 0.18);
    spots.push({ id: "stories", name: "团子的故事书", icon: "📖", href: "stories.html", at: [x, y + 1.25, z], pick: [g], lines: ["从前，有一只团子……", "今天讲哪个故事呢？"], walk: [x, z, 0.5] });
  }
  // 7) 能量补给站：薄荷绿的奶茶推车，粉白条纹遮阳篷，上面一杯大奶茶
  {
    const x = -4.6, z = -12.75, y = heightAt(x, z), g = group(x, y, z, face(x, z, 0, -11.0));
    buildMilkTeaCart(THREE, g, { glowMats, anim, maxAniso });
    spots.push({ id: "milk-tea", name: "能量补给站", icon: "🧋", href: "milk-tea.html", at: [x, y + 2.5, z], pick: [g], lines: ["来一杯奶茶补补能量！", "三分糖，加珍珠～"], walk: [x, z, 0.94] });
    { const c = new THREE.Vector3(1.05, 0, 0.55).applyAxisAngle(new THREE.Vector3(0, 1, 0), g.rotation.y); cafeAt = [x + c.x, z + c.z]; }
  }
  // 8) 悄悄话：秋千橡树上的树洞，里面暖暖地亮着，飘出小爱心
  {
    const tx = -3.7, tz = -16.0, dir = Math.atan2(1.1, 0.8), x = tx + Math.sin(dir) * 0.3, z = tz + Math.cos(dir) * 0.3, y = heightAt(tx, tz);
    const g = group(x, y, z, dir);
    const hole = add(new THREE.CircleGeometry(0.13, 24), std({ color: "#3a2418", roughness: 1 }), 0, 0.85, 0.02, { parent: g, cast: false }); hole.scale.y = 1.45;
    const inner = std({ color: "#ffcf8a", emissive: "#ffa860", emissiveIntensity: 0.5, roughness: 1 }); glowMats.push([inner, 0.5, 1.8]);
    const gl = add(new THREE.CircleGeometry(0.07, 20), inner, 0, 0.82, 0.025, { parent: g, cast: false }); gl.scale.y = 1.3;
    add(new THREE.TorusGeometry(0.13, 0.03, 8, 24), std({ color: "#6b4a35", roughness: 1 }), 0, 0.85, 0.02, { parent: g }).scale.y = 1.45;
    floaters(g, 12, "#ffb3c6", 0.05, [0.3, 0.7, 0.85], 0.2).position.z = 0.1;
    spots.push({ id: "messages", name: "悄悄话", icon: "💬", href: "messages.html", at: [x + Math.sin(dir) * 0.15, y + 1.35, z + Math.cos(dir) * 0.15], pick: [g], lines: ["对着树洞说悄悄话吧。", "嘘——只有我们知道。"] });
  }
  // 9) 星星邮差：小路尽头的星星邮筒，顶上一颗会转的星星
  {
    const x = 0, z = -17.35, y = heightAt(x, z), g = group(x, y, z, 0);
    const { st, starM } = buildStarPostbox(THREE, g, { glowMats, maxAniso });
    const big = add(new THREE.ExtrudeGeometry(st, { depth: 0.04, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 2 }).center(), starM, 0, 1.78, 0, { parent: g });
    big.scale.setScalar(1.5);
    anim.push((t) => { big.rotation.y = t * 0.9; big.position.y = 1.78 + Math.sin(t * 1.5) * 0.04; });
    floaters(g, 18, "#fff2a8", 0.05, [0.9, 1.2, 1.0], 0.12);
    spots.push({ id: "star-post", name: "星星邮差", icon: "⭐", href: "star-post.html", at: [x, y + 2.25, z], pick: [g], lines: ["给星星寄一封信吧。", "星星邮差会送到的！"], walk: [x, z, 0.4] });
  }

  // ========== 唱片机：右墙照片墙下面的胡桃木小柜上，放《我的小怪兽》 ==========
  let gramo = null;
  {
    const x = W / 2 - 0.27, z = -0.2, g = group(x, 0, z, -Math.PI / 2);
    const walnut = std({ color: "#8f5a3f", roughness: 0.55 }), brass = std({ color: "#d9b06a", metalness: 0.85, roughness: 0.28 });
    // 小柜：抽屉 + 金色拉手 + 细腿
    box(0.66, 0.5, 0.38, walnut, 0, 0.37, 0, { parent: g }); box(0.7, 0.025, 0.42, std({ color: "#7a4a33", roughness: 0.5 }), 0, 0.632, 0, { parent: g });
    [0.26, 0.42].forEach((y) => { box(0.6, 0.006, 0.01, std({ color: "#6e432f" }), 0, y, 0.191, { parent: g, cast: false }); box(0.08, 0.016, 0.02, brass, 0, y + 0.07, 0.195, { parent: g, cast: false }); });
    [[-0.29, -0.15], [0.29, -0.15], [-0.29, 0.15], [0.29, 0.15]].forEach(([a, b]) => add(new THREE.CylinderGeometry(0.018, 0.012, 0.12, 8).translate(0, 0.06, 0), walnut, a, 0, b, { parent: g }));
    // 唱机底座 + 唱盘 + 黑胶（纹路 + MV 封面做标签）
    box(0.36, 0.075, 0.3, walnut, -0.06, 0.682, 0, { parent: g });
    box(0.37, 0.008, 0.31, brass, -0.06, 0.645, 0, { parent: g, cast: false });
    const vinylTex = canvasTex(512, 512, (c) => {
      c.fillStyle = "#141414"; c.beginPath(); c.arc(256, 256, 256, 0, 7); c.fill();
      for (let r = 250; r > 110; r -= 3) { c.strokeStyle = r % 2 ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.4)"; c.lineWidth = 1.2; c.beginPath(); c.arc(256, 256, r, 0, 7); c.stroke(); }
      const gr = c.createLinearGradient(0, 0, 512, 512); gr.addColorStop(0.35, "rgba(255,255,255,0)"); gr.addColorStop(0.5, "rgba(255,255,255,.12)"); gr.addColorStop(0.65, "rgba(255,255,255,0)"); c.fillStyle = gr; c.beginPath(); c.arc(256, 256, 250, 0, 7); c.fill();
    });
    const disc = new THREE.Group(); disc.position.set(-0.08, 0.725, 0); g.add(disc);
    add(new THREE.CylinderGeometry(0.135, 0.135, 0.008, 48), std({ map: vinylTex, roughness: 0.35 }), 0, 0, 0, { parent: disc, cast: false });
    const label = tex(`${A}mv-xiaoguaishou-cover.jpg`);
    add(new THREE.CircleGeometry(0.048, 32).rotateX(-Math.PI / 2), std({ map: label, roughness: 0.7 }), 0, 0.0045, 0, { parent: disc, cast: false });
    add(new THREE.CylinderGeometry(0.004, 0.004, 0.012, 8), brass, 0, 0.006, 0, { parent: disc, cast: false });
    // 唱臂：放歌时落到唱片上
    const arm = new THREE.Group(); arm.position.set(0.08, 0.74, -0.1); g.add(arm);
    add(new THREE.CylinderGeometry(0.014, 0.018, 0.03, 12), brass, 0, -0.01, 0, { parent: arm });
    const rod = add(new THREE.CylinderGeometry(0.004, 0.004, 0.17, 6).rotateZ(Math.PI / 2), brass, -0.085, 0.01, 0, { parent: arm, cast: false });
    add(new THREE.BoxGeometry(0.02, 0.008, 0.014), brass, -0.17, 0.006, 0, { parent: arm, cast: false });
    // 黄铜大喇叭：从底座后角弯上来，喇叭口朝房间
    const neck = new THREE.CatmullRomCurve3([new THREE.Vector3(0.07, 0.72, 0.1), new THREE.Vector3(0.09, 0.82, 0.06), new THREE.Vector3(0.06, 0.95, -0.02), new THREE.Vector3(0.0, 1.03, 0.02)]);
    add(new THREE.TubeGeometry(neck, 24, 0.016, 10), brass, 0, 0, 0, { parent: g });
    const bell = add(new THREE.LatheGeometry([[0.016, 0], [0.03, 0.08], [0.06, 0.16], [0.11, 0.23], [0.19, 0.28], [0.205, 0.29]].map(([r, h]) => new THREE.Vector2(r, h)), 40), new THREE.MeshStandardMaterial({ color: "#e2b86f", metalness: 0.85, roughness: 0.25, side: THREE.DoubleSide }), 0.0, 1.03, 0.02, { parent: g });
    bell.rotation.x = 0.95; bell.rotation.z = 0.08;
    // 音符：放歌时从喇叭里飘出来
    const noteTex = canvasTex(64, 64, (c) => { c.fillStyle = "#e46f8f"; c.font = "bold 48px serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("♪", 32, 34); });
    const notes = Array.from({ length: 6 }, (_, i) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: noteTex, transparent: true, depthWrite: false, opacity: 0 })); sp.scale.setScalar(0.07); sp.userData.noHit = true; g.add(sp); return { sp, ph: i / 6 }; });
    let armA = 0;
    gramo = (dt, t, playing) => {
      if (playing) disc.rotation.y -= dt * 3.5;
      armA += ((playing ? 0.42 : 0) - armA) * Math.min(1, dt * 4); arm.rotation.y = armA;
      notes.forEach((n) => { const f = (t * 0.35 + n.ph) % 1; n.sp.visible = playing; n.sp.position.set(Math.sin(t * 1.3 + n.ph * 9) * 0.08, 1.15 + f * 0.55, 0.22 + f * 0.25); n.sp.material.opacity = playing ? Math.sin(f * Math.PI) * 0.95 : 0; });
    };
    spots.push({ id: "gramophone", name: "唱片机", icon: "🎵", action: "player", cta: "点我播放", at: [x - 0.1, 1.55, z], pick: [g], lines: ["放我们的歌吧～", "这首是给你的。"] });
  }

  function walk(map) {
    spots.forEach((s) => { if (s.walk) map.circle(s.walk[0], s.walk[1], s.walk[2] + 0.18); });
    if (cafeAt) map.circle(cafeAt[0], cafeAt[1], 0.75);
    map.circle(W / 2 - 0.5, FRONT - 0.5, 0.5); map.circle(-W / 2 + 0.55, FRONT - 0.5, 0.45);
  }
  function update(dt, t, env) {
    anim.forEach((f) => f(t));
    gramo?.(dt, t, !!window.XBGame?.music?.playing);
    const dark = env.night ? 1 : env.dusk ? 0.5 : 0;
    glowMats.forEach(([m, lo, hi]) => { m.emissiveIntensity = lo + (hi - lo) * dark; });
  }
  return { root, spots, walk, update };
}
