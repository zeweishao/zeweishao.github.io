/* 星星邮差：团子挂着气球，从杭州正午飞到纽约深夜，沿路接住信里的每一句话。 */
(() => {
  "use strict";

  // ---------- 数据 ----------
  const MESSENGERS = [
    { key: "chuyin", name: "初音未来" },
    { key: "meiqin", name: "御坂美琴" },
    { key: "heizi", name: "白井黑子" },
    { key: "zou", name: "立华奏" },
    { key: "zhu", name: "古河渚" },
    { key: "xing", name: "藤林杏" },
    { key: "suixiang", name: "穗香" },
    { key: "beige", name: "贝歌" },
    { key: "wenji", name: "蔡文姬" },
    { key: "mali", name: "玛莉萝丝" }
  ];
  const domeSrc = (key) => `assets/journal/domes/${key}.webp`;

  const store = {
    get(k, d) { try { const v = localStorage.getItem("starpost:" + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem("starpost:" + k, JSON.stringify(v)); } catch { /* 隐私模式下不记也没关系 */ } }
  };

  const pad = (n) => String(n).padStart(2, "0");
  const todayStr = (() => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; })();
  const prettyDate = (s) => { const [, m, d] = s.split("-"); return `${+m} 月 ${+d} 日`; };
  const daysUntil = (s) => Math.ceil((new Date(s + "T00:00:00") - new Date(todayStr + "T00:00:00")) / 864e5);

  const LETTERS = (window.STAR_LETTERS || []).slice().sort((a, b) => a.date.localeCompare(b.date));
  const opened = () => LETTERS.filter((l) => l.date <= todayStr);
  let letter = opened().slice(-1)[0] || LETTERS[0] || { date: todayStr, title: "一封信", text: "想你。" };

  function splitLetter(text) {
    const parts = text.replace(/\n/g, "").split(/(?<=[，。！？；：、…,.!?])/).map((s) => s.trim()).filter(Boolean);
    const out = [];
    for (const p of parts) {
      if (p.length <= 11) { out.push(p); continue; }
      let rest = p;
      while (rest.length > 11) { const cut = Math.ceil(rest.length / Math.ceil(rest.length / 9)); out.push(rest.slice(0, cut)); rest = rest.slice(cut); }
      if (rest) out.push(rest);
    }
    return out;
  }

  // ---------- 画布 ----------
  const canvas = document.getElementById("sky");
  const ctx = canvas.getContext("2d");
  let W = 0, H = 0, DPR = 1, u = 1;
  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    u = Math.max(0.72, Math.min(1.25, Math.min(H / 760, W / 420)));
  }
  window.addEventListener("resize", resize);
  resize();

  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const mix = (a, b, t) => { const A = hex(a), B = hex(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(",")})`; };
  function ramp(stops, p) {
    for (let i = 1; i < stops.length; i++) {
      if (p <= stops[i][0]) { const t = (p - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]); return [mix(stops[i - 1][1], stops[i][1], t), mix(stops[i - 1][2], stops[i][2], t)]; }
    }
    const l = stops[stops.length - 1]; return [mix(l[1], l[1], 0), mix(l[2], l[2], 0)];
  }
  const SKY = [
    [0, "#a9cbd8", "#f7ead2"],
    [0.28, "#d9b9a6", "#f5d8b2"],
    [0.48, "#8e6f8f", "#eaa58a"],
    [0.68, "#3a4570", "#836c8d"],
    [1, "#1a2241", "#2c3a5e"]
  ];

  // 预先生成的背景星星、纽约天际线、雪花
  const bgStars = Array.from({ length: 140 }, () => ({ x: Math.random(), y: Math.random() * 0.7, r: rand(0.5, 1.6), ph: rand(0, 6.28) }));
  const skyline = (() => {
    const b = []; let x = 0;
    while (x < 1600) { const w = rand(26, 62); const h = rand(60, 210) * (Math.random() < 0.12 ? 1.5 : 1); b.push({ x, w, h, spire: Math.random() < 0.15, seed: Math.random() * 999 }); x += w + rand(2, 10); }
    return { b, len: x };
  })();
  const snow = Array.from({ length: 90 }, () => ({ x: Math.random(), y: Math.random(), r: rand(0.8, 2.4), v: rand(18, 44), s: rand(0, 6) }));

  // ---------- 游戏状态 ----------
  let mode = "idle"; // idle | fly | land | done
  let t = 0, cam = 0, speed = 0, totalDist = 1;
  let frags = [], nextFrag = 0, caught = 0, misses = 0, lastSpawnCam = 0;
  let stars = [], clouds = [], sparks = [];
  let player = { x: 0, y: 0, vy: 0, wet: 0 };
  let holding = false;
  let messenger = store.get("messenger", "chuyin");
  if (!MESSENGERS.some((m) => m.key === messenger)) messenger = "chuyin";
  const img = new Image();
  function loadMessenger() { img.src = domeSrc(messenger); }
  loadMessenger();
  const shownWhispers = new Set();

  const progress = () => clamp(cam / totalDist, 0, 1);

  function startFlight() {
    frags = splitLetter(letter.text);
    nextFrag = 0; caught = 0; misses = 0;
    stars = []; clouds = []; sparks = []; shownWhispers.clear();
    t = 0; cam = 0; lastSpawnCam = -200;
    speed = 165 * u;
    totalDist = Math.max(60, frags.length * 3.6 + 12) * speed; // 约每颗星 3.6 秒
    player = { x: W * (W < 640 ? 0.3 : 0.26), y: H * 0.45, vy: 0, wet: 0 };
    renderStrip();
    mode = "fly";
    show("hud");
  }

  // ---------- 输入 ----------
  const isUI = (e) => e.target.closest && e.target.closest("button, a, .screen");
  window.addEventListener("pointerdown", (e) => { if (mode === "fly" && !isUI(e)) { holding = true; audio.wake(); } });
  window.addEventListener("pointerup", () => { holding = false; });
  window.addEventListener("pointercancel", () => { holding = false; });
  window.addEventListener("blur", () => { holding = false; });
  window.addEventListener("keydown", (e) => { if (e.code === "Space" || e.code === "ArrowUp") { holding = true; audio.wake(); e.preventDefault(); } });
  window.addEventListener("keyup", (e) => { if (e.code === "Space" || e.code === "ArrowUp") holding = false; });

  // ---------- 声音（纯合成，五声音阶，接住一颗星就往上走一个音）----------
  const audio = (() => {
    let ac = null, out = null, muted = store.get("muted", false);
    const scale = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98, 1760];
    function wake() {
      if (ac) { if (ac.state === "suspended") ac.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      ac = new AC(); out = ac.createGain(); out.gain.value = muted ? 0 : 0.5;
      const delay = ac.createDelay(); delay.delayTime.value = 0.28;
      const fb = ac.createGain(); fb.gain.value = 0.28;
      const wet = ac.createGain(); wet.gain.value = 0.35;
      out.connect(ac.destination); out.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(ac.destination);
    }
    function tone(f, dur = 0.9, type = "sine", g = 0.22, when = 0) {
      if (!ac || muted) return;
      const t0 = ac.currentTime + when, o = ac.createOscillator(), e = ac.createGain();
      o.type = type; o.frequency.value = f;
      e.gain.setValueAtTime(0, t0); e.gain.linearRampToValueAtTime(g, t0 + 0.015); e.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(e); e.connect(out); o.start(t0); o.stop(t0 + dur + 0.05);
    }
    return {
      wake,
      star(i) { const f = scale[i % scale.length]; tone(f, 1.1, "sine", 0.2); tone(f * 2, 0.5, "triangle", 0.05); },
      bump() { tone(196, 0.35, "triangle", 0.12); },
      arrive() { [523.25, 659.25, 783.99, 1046.5, 1318.51].forEach((f, i) => tone(f, 1.6, "sine", 0.16, i * 0.16)); },
      toggle() { muted = !muted; store.set("muted", muted); if (out) out.gain.value = muted ? 0 : 0.5; return muted; },
      get muted() { return muted; }
    };
  })();

  // ---------- 文案提示 ----------
  const WHISPERS = [
    [0.02, "杭州现在是中午，太阳正好"],
    [0.2, "飞过西湖啦，往东边去"],
    [0.42, "海上的天，慢慢变成橘子色"],
    [0.66, "天黑了，离你越来越近"],
    [0.8, "听说纽约下雪了"],
    [0.93, "看见大桥上的灯了！"]
  ];
  const whisperEl = document.getElementById("whisper");
  let whisperTimer = 0;
  function whisper(text, ms = 2600) {
    whisperEl.textContent = text; whisperEl.classList.add("show");
    clearTimeout(whisperTimer); whisperTimer = setTimeout(() => whisperEl.classList.remove("show"), ms);
  }

  // ---------- HUD ----------
  const stripText = document.getElementById("stripText");
  const trackDot = document.getElementById("trackDot");
  const ticketNote = document.getElementById("ticketNote");
  function renderStrip(fresh = -1) {
    stripText.innerHTML = "";
    frags.forEach((f, i) => {
      if (i > caught) return;
      const s = document.createElement("span");
      if (i < caught) { s.textContent = f; if (i === fresh) s.className = "fresh"; }
      else { s.textContent = "……"; s.className = "wait"; }
      stripText.appendChild(s);
    });
    if (caught === 0) stripText.firstChild.textContent = "接住第一颗星星，信就开始写了";
  }
  let lastNote = "";
  function updateHUD() {
    const p = progress();
    trackDot.style.left = (p * 100).toFixed(1) + "%";
    let note;
    if (mode === "land") note = "到啦";
    else if (p >= 1 && nextFrag < frags.length) note = `还差 ${frags.length - caught} 颗星`;
    else { const left = Math.ceil(13 * (1 - p)); note = p < 0.02 ? "杭州 · 正午 12:00 出发" : `离你还有 ${left} 个小时`; }
    if (note !== lastNote) { ticketNote.textContent = note; lastNote = note; }
  }

  // ---------- 更新 ----------
  function update(dt) {
    t += dt;
    if (mode === "idle" || mode === "done") { cam += 18 * dt; return; }

    const p = progress();
    const top = 92 * u, bottom = H - 120 * u;

    if (mode === "fly") {
      cam += speed * dt;
      // 提示语
      for (const [at, text] of WHISPERS) if (p >= at && !shownWhispers.has(at)) { shownWhispers.add(at); whisper(text); }

      if (AUTO) { const s = stars[0]; holding = s ? s.y < player.y - 6 * u : player.y > H / 2; }
      // 物理：按住上升，松开缓降
      player.vy += (holding ? -640 : 300) * u * dt;
      player.vy = clamp(player.vy, -260 * u, 220 * u);
      player.y += player.vy * dt;
      if (player.y < top) { player.y = top; player.vy = Math.max(0, player.vy); }
      if (player.y > bottom) { player.y = bottom; player.vy = Math.min(0, player.vy) * 0.3; }
      player.wet = Math.max(0, player.wet - dt);

      // 生成星星：同屏只挂一句，没接住会绕回来
      const gap = p >= 1 ? 240 * u : Math.max(320 * u, totalDist / (frags.length + 1));
      if (nextFrag < frags.length && !stars.some((s) => s.alive) && cam - lastSpawnCam > gap) {
        stars.push({ x: W + 40 * u, y: rand(top + 30 * u, bottom - 20 * u), i: nextFrag, alive: true, ph: rand(0, 6) });
        lastSpawnCam = cam;
      }
      // 云
      if (Math.random() < dt / 2.8 && p > 0.06 && p < 0.97) {
        let y = rand(top + 20 * u, bottom - 10 * u);
        const s = stars.find((s) => s.alive && s.x > W - 200);
        if (s && Math.abs(s.y - y) < 90 * u) y = s.y > H / 2 ? y - 140 * u : y + 140 * u;
        clouds.push({ x: W + 90 * u, y: clamp(y, top, bottom), r: rand(30, 46) * u, hit: false, v: rand(1.05, 1.3) });
      }

      // 到达判定
      if (p >= 1 && caught >= frags.length) { mode = "land"; landT = 0; whisper("到你那里了"); holding = false; audio.arrive(); }
    }

    if (mode === "land") {
      landT += dt;
      speed = Math.max(0, speed - speed * dt * 1.6);
      cam += speed * dt;
      player.x += (W * 0.5 - player.x) * dt * 1.4;
      player.y += (H * 0.48 - player.y) * dt * 1.4;
      player.vy = 0;
      if (landT > 2.6) { mode = "done"; showEnvelope(); }
    }

    // 星星移动与拾取
    for (const s of stars) {
      if (!s.alive) continue;
      s.x -= speed * dt;
      const dx = s.x - player.x, dy = s.y - (player.y - 6 * u);
      if (dx * dx + dy * dy < (64 * u) ** 2) {
        s.alive = false; caught++; nextFrag++;
        audio.star(caught - 1);
        for (let k = 0; k < 14; k++) { const a = rand(0, 6.28), v = rand(40, 160) * u; sparks.push({ x: s.x, y: s.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1 }); }
        renderStrip(caught - 1);
      } else if (s.x < -60 * u) {
        s.alive = false; misses++;
        if (misses === 1) whisper("没关系，星星会再绕回来");
      }
    }
    stars = stars.filter((s) => s.alive);

    for (const c of clouds) {
      c.x -= speed * c.v * dt;
      if (!c.hit && mode === "fly") {
        const dx = c.x - player.x, dy = c.y - player.y;
        if (dx * dx + dy * dy < (c.r + 26 * u) ** 2) {
          c.hit = true; player.vy = 200 * u; player.wet = 1.1; audio.bump();
          if (!shownWhispers.has("cloud")) { shownWhispers.add("cloud"); whisper("被云淋了一下，没事"); }
        }
      }
    }
    clouds = clouds.filter((c) => c.x > -120 * u);

    for (const k of sparks) { k.x += k.vx * dt; k.y += k.vy * dt; k.vy += 60 * u * dt; k.life -= dt * 1.3; }
    sparks = sparks.filter((k) => k.life > 0);
  }
  let landT = 0;
  const AUTO = /[?&]auto\b/.test(location.search); // 调试：自动驾驶

  // ---------- 绘制 ----------
  function star4(x, y, r, inner = 0.32) {
    ctx.beginPath();
    for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4 - Math.PI / 2, rr = i % 2 ? r * inner : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    ctx.closePath();
  }

  function drawSky(p) {
    const [top, bot] = ramp(SKY, p);
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, top); g.addColorStop(0.78, bot);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    // 太阳 → 落下
    const sunA = 1 - smooth(0.45, 0.62, p);
    if (sunA > 0) {
      const sy = H * (0.16 + p * 1.05), sx = W * 0.74;
      const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, 90 * u);
      sg.addColorStop(0, `rgba(255,246,220,${0.95 * sunA})`); sg.addColorStop(0.35, `rgba(255,214,170,${0.55 * sunA})`); sg.addColorStop(1, "rgba(255,200,160,0)");
      ctx.fillStyle = sg; ctx.fillRect(sx - 100 * u, sy - 100 * u, 200 * u, 200 * u);
      ctx.fillStyle = mix("#fff4dc", "#f08a6a", smooth(0.2, 0.55, p)); ctx.globalAlpha = sunA;
      ctx.beginPath(); ctx.arc(sx, sy, 26 * u, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
    }
    // 背景星星与月亮
    const nightA = smooth(0.55, 0.85, p);
    if (nightA > 0) {
      for (const s of bgStars) {
        const x = ((s.x * W - cam * 0.02) % W + W) % W;
        ctx.globalAlpha = nightA * (0.45 + 0.55 * Math.sin(t * 1.6 + s.ph) ** 2);
        ctx.fillStyle = "#fff8e6"; ctx.beginPath(); ctx.arc(x, s.y * H, s.r, 0, 7); ctx.fill();
      }
      ctx.globalAlpha = nightA;
      const mx = W * 0.8, my = H * 0.14;
      ctx.fillStyle = "#f6ecd2"; ctx.beginPath(); ctx.arc(mx, my, 22 * u, 0, 7); ctx.fill();
      ctx.fillStyle = mix("#1a2241", "#2c3a5e", 0.2); ctx.beginPath(); ctx.arc(mx + 9 * u, my - 6 * u, 19 * u, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function drawHangzhou(p, horizon) {
    const a = 1 - smooth(0.07, 0.2, p);
    if (a <= 0) return;
    ctx.globalAlpha = a;
    // 远山
    ctx.fillStyle = "rgba(98,124,120,.55)";
    ctx.beginPath(); ctx.moveTo(0, horizon);
    for (let x = 0; x <= W + 20; x += 20) { const wx = x + cam * 0.15; ctx.lineTo(x, horizon - 40 * u - Math.sin(wx / 140) * 22 * u - Math.sin(wx / 53) * 8 * u); }
    ctx.lineTo(W, horizon); ctx.fill();
    // 塔
    const px = W * 0.62 - cam * 0.3, py = horizon - 54 * u;
    ctx.fillStyle = "rgba(70,84,92,.75)";
    for (let i = 0; i < 5; i++) {
      const w = (24 - i * 3.2) * u, y = py - i * 13 * u;
      ctx.fillRect(px - w / 2, y - 9 * u, w, 9 * u);
      ctx.beginPath(); ctx.moveTo(px - w / 2 - 5 * u, y - 9 * u); ctx.lineTo(px + w / 2 + 5 * u, y - 9 * u); ctx.lineTo(px, y - 13 * u); ctx.fill();
    }
    ctx.fillRect(px - 1 * u, py - 82 * u, 2 * u, 14 * u);
    // 柳枝
    const lx = -cam * 0.7;
    ctx.strokeStyle = "rgba(108,138,88,.75)"; ctx.lineWidth = 1.4 * u;
    for (let i = 0; i < 16; i++) {
      const x0 = lx + i * 14 * u, len = (120 + (i * 37) % 90) * u;
      ctx.beginPath(); ctx.moveTo(x0, -5);
      ctx.quadraticCurveTo(x0 + 10 * u + Math.sin(t + i) * 6 * u, len * 0.5, x0 + 4 * u + Math.sin(t * 0.8 + i) * 10 * u, len); ctx.stroke();
      ctx.fillStyle = "rgba(124,156,98,.7)";
      for (let k = 1; k < 6; k++) { const yy = (len * k) / 6; ctx.beginPath(); ctx.ellipse(x0 + 6 * u + Math.sin(t * 0.8 + i) * 8 * u * (k / 6), yy, 2.2 * u, 5 * u, 0.4, 0, 7); ctx.fill(); }
    }
    // 小船
    const bx = W * 0.35 - cam * 0.45, by = horizon + 16 * u;
    ctx.fillStyle = "rgba(60,58,70,.6)";
    ctx.beginPath(); ctx.moveTo(bx - 22 * u, by); ctx.quadraticCurveTo(bx, by + 9 * u, bx + 22 * u, by); ctx.fill();
    ctx.fillRect(bx - 9 * u, by - 9 * u, 18 * u, 7 * u);
    ctx.globalAlpha = 1;
  }

  function drawOcean(p, horizon) {
    const c1 = mix("#bcd2cf", "#1f2a4a", smooth(0.3, 0.85, p));
    const c2 = mix("#93b2b4", "#151d36", smooth(0.3, 0.85, p));
    const g = ctx.createLinearGradient(0, horizon, 0, H); g.addColorStop(0, c1); g.addColorStop(1, c2);
    ctx.fillStyle = g; ctx.fillRect(0, horizon, W, H - horizon);
    ctx.strokeStyle = `rgba(255,248,230,${0.35 - smooth(0.6, 1, p) * 0.15})`; ctx.lineWidth = 1;
    for (let row = 0; row < 7; row++) {
      const y = horizon + 10 * u + row * row * 6 * u, sp = 0.3 + row * 0.18;
      for (let i = -1; i < 9; i++) {
        const x = ((i * 120 * u - cam * sp) % (W + 240 * u) + W + 240 * u) % (W + 240 * u) - 120 * u;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 10 * u, y - 3 * u, x + 20 * u + row * 3 * u, y); ctx.stroke();
      }
    }
    // 海上远船，傍晚出现一次
    const sa = smooth(0.28, 0.34, p) * (1 - smooth(0.5, 0.56, p));
    if (sa > 0) {
      ctx.globalAlpha = sa; ctx.fillStyle = "rgba(50,44,62,.7)";
      const sx = W * 0.9 - (p - 0.28) * 4 * W, sy = horizon - 2 * u;
      ctx.fillRect(sx - 30 * u, sy - 6 * u, 60 * u, 6 * u); ctx.fillRect(sx - 10 * u, sy - 16 * u, 22 * u, 10 * u); ctx.fillRect(sx + 4 * u, sy - 26 * u, 4 * u, 10 * u);
      ctx.globalAlpha = 1;
    }
  }

  function drawNewYork(p, horizon) {
    const a = smooth(0.72, 0.9, p);
    if (a <= 0) return;
    ctx.globalAlpha = a;
    const off = cam * 0.12;
    for (let rep = -1; rep < Math.ceil(W / skyline.len) + 1; rep++) {
      for (const b of skyline.b) {
        const x = ((b.x - off) % skyline.len + skyline.len) % skyline.len + rep * skyline.len - 40;
        if (x > W || x + b.w < 0) continue;
        const h = b.h * u, y = horizon - h;
        ctx.fillStyle = "#222a45"; ctx.fillRect(x, y, b.w * u * 0.9, h);
        if (b.spire) { ctx.fillRect(x + b.w * u * 0.4, y - 26 * u, 2.2 * u, 26 * u); }
        ctx.fillStyle = "rgba(244,206,128,.85)";
        let s = b.seed;
        for (let wy = y + 8 * u; wy < horizon - 6 * u; wy += 9 * u) for (let wx = x + 5 * u; wx < x + b.w * u * 0.9 - 5 * u; wx += 8 * u) {
          s = (s * 9301 + 49297) % 233280; if (s / 233280 < 0.3) ctx.fillRect(wx, wy, 2.2 * u, 3 * u);
        }
      }
    }
    // 大桥
    const bx = W * 0.95 - (p - 0.86) * 5.5 * W;
    if (bx > -W && bx < W * 2) {
      const deck = horizon + 6 * u, tw = 26 * u, th = 120 * u;
      ctx.fillStyle = "#1a2038"; ctx.strokeStyle = "#1a2038";
      const towers = [bx, bx + W * 0.55];
      for (const x of towers) { ctx.fillRect(x - tw / 2, deck - th, tw, th + 40 * u); ctx.fillStyle = "rgba(244,206,128,.35)"; ctx.fillRect(x - 5 * u, deck - th + 20 * u, 4 * u, 28 * u); ctx.fillRect(x + 2 * u, deck - th + 20 * u, 4 * u, 28 * u); ctx.fillStyle = "#1a2038"; }
      ctx.fillRect(bx - W, deck, W * 3, 5 * u);
      ctx.lineWidth = 1.2 * u;
      const cable = (x0, x1, sag) => { ctx.beginPath(); ctx.moveTo(x0, deck - th); ctx.quadraticCurveTo((x0 + x1) / 2, deck - th + sag, x1, deck - th); ctx.stroke(); };
      cable(towers[0], towers[1], th * 1.6); cable(towers[0] - W * 0.45, towers[0], th * 1.6); cable(towers[1], towers[1] + W * 0.45, th * 1.6);
      ctx.fillStyle = "#f6cf86";
      for (let i = 0; i < 40; i++) {
        const tt = i / 39, x = towers[0] + (towers[1] - towers[0]) * tt;
        const y = deck - th + th * 1.6 * 2 * tt * (1 - tt) * 2 * 0.5 + 0;
        ctx.globalAlpha = a * (0.6 + 0.4 * Math.sin(t * 3 + i));
        ctx.beginPath(); ctx.arc(x, y, 1.6 * u, 0, 7); ctx.fill();
      }
      ctx.globalAlpha = a;
    }
    ctx.globalAlpha = 1;
  }

  function drawSnow(p) {
    const a = smooth(0.72, 0.85, p);
    if (a <= 0) return;
    ctx.fillStyle = "#fffaf0";
    for (const s of snow) {
      const y = ((s.y * H + t * s.v) % H + H) % H;
      const x = ((s.x * W - cam * 0.6 + Math.sin(t + s.s) * 12) % W + W) % W;
      ctx.globalAlpha = a * 0.8; ctx.beginPath(); ctx.arc(x, y, s.r * u, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawCloud(c) {
    ctx.save();
    ctx.translate(c.x, c.y);
    const r = c.r;
    ctx.fillStyle = c.hit ? "rgba(120,126,150,.75)" : "rgba(132,138,162,.88)";
    ctx.beginPath();
    ctx.arc(-r * 0.7, r * 0.1, r * 0.6, 0, 7); ctx.arc(0, -r * 0.2, r * 0.8, 0, 7); ctx.arc(r * 0.75, r * 0.1, r * 0.6, 0, 7);
    ctx.rect(-r * 0.7, r * 0.1, r * 1.45, r * 0.6);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.25)"; ctx.beginPath(); ctx.arc(-r * 0.15, -r * 0.4, r * 0.4, 0, 7); ctx.fill();
    ctx.strokeStyle = "rgba(180,200,230,.6)"; ctx.lineWidth = 1.2 * u;
    for (let i = -2; i <= 2; i++) { const x = i * r * 0.35, ph = (t * 2.2 + i * 0.37) % 1; ctx.beginPath(); ctx.moveTo(x, r * 0.8 + ph * r * 0.8); ctx.lineTo(x - 3 * u, r * 0.8 + ph * r * 0.8 + 8 * u); ctx.stroke(); }
    ctx.restore();
  }

  function drawStar(s) {
    const pulse = 1 + Math.sin(t * 4 + s.ph) * 0.08, r = 17 * u * pulse;
    const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, r * 2.6);
    g.addColorStop(0, "rgba(255,236,170,.75)"); g.addColorStop(1, "rgba(255,236,170,0)");
    ctx.fillStyle = g; ctx.fillRect(s.x - r * 3, s.y - r * 3, r * 6, r * 6);
    star4(s.x, s.y, r); ctx.fillStyle = "#f1c35c"; ctx.fill();
    ctx.lineWidth = 1.4 * u; ctx.strokeStyle = "#a9813f"; ctx.stroke();
    // 纸签
    const text = frags[s.i];
    ctx.font = `${15 * u}px ${getComputedStyle(document.documentElement).getPropertyValue("--hand")}`;
    const w = ctx.measureText(text).width + 14 * u, h = 22 * u, y = s.y + r + 10 * u;
    ctx.save(); ctx.translate(s.x, y); ctx.rotate(Math.sin(t * 2 + s.ph) * 0.05);
    ctx.strokeStyle = "rgba(169,129,63,.8)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, -10 * u); ctx.lineTo(0, 0); ctx.stroke();
    ctx.fillStyle = "rgba(245,238,227,.95)"; ctx.beginPath(); ctx.roundRect(-w / 2, 0, w, h, 3 * u); ctx.fill();
    ctx.fillStyle = "#2a2733"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(text, 0, h / 2 + 1);
    ctx.restore();
  }

  const BALLOONS = [["#d9675c", -20, -8], ["#e8b84f", 0, -22], ["#4f6597", 20, -10]];
  function drawPlayer() {
    const ih = 88 * u, iw = img.naturalWidth ? (ih * img.naturalWidth) / img.naturalHeight : ih * 0.75;
    const bob = mode === "fly" ? 0 : Math.sin(t * 2) * 6 * u;
    const x = player.x, y = player.y + bob;
    const tilt = clamp(player.vy / (260 * u), -1, 1) * 0.08;
    ctx.save(); ctx.translate(x, y); ctx.rotate(tilt);
    const knotY = -ih / 2 - 2 * u;
    for (const [col, dx, dy] of BALLOONS) {
      const sway = Math.sin(t * 1.7 + dx) * 4 * u;
      const bx = dx * u + sway, by = knotY - 58 * u + dy * u - (holding ? 4 * u : 0);
      ctx.strokeStyle = "rgba(60,56,70,.6)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, knotY); ctx.quadraticCurveTo(bx * 0.4, (knotY + by) / 2, bx, by + 22 * u); ctx.stroke();
      ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(bx, by, 17 * u, 21 * u, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.moveTo(bx - 3 * u, by + 22 * u); ctx.lineTo(bx + 3 * u, by + 22 * u); ctx.lineTo(bx, by + 19 * u); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.45)"; ctx.beginPath(); ctx.ellipse(bx - 6 * u, by - 8 * u, 4 * u, 7 * u, -0.4, 0, 7); ctx.fill();
    }
    if (player.wet > 0 && Math.floor(t * 12) % 2) ctx.globalAlpha = 0.65;
    if (img.complete && img.naturalWidth) ctx.drawImage(img, -iw / 2, -ih / 2, iw, ih);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function draw() {
    const p = mode === "idle" ? 0 : progress();
    ctx.clearRect(0, 0, W, H);
    drawSky(p);
    const horizon = H * 0.8;
    drawOcean(p, horizon);
    drawNewYork(p, horizon);
    drawHangzhou(p, horizon);
    if (mode === "fly" || mode === "land") {
      for (const c of clouds) drawCloud(c);
      for (const s of stars) drawStar(s);
      drawPlayer();
      for (const k of sparks) { ctx.globalAlpha = Math.max(0, k.life); star4(k.x, k.y, 5 * u); ctx.fillStyle = "#ffe39a"; ctx.fill(); }
      ctx.globalAlpha = 1;
    }
    drawSnow(p);
  }

  // ---------- 主循环 ----------
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!document.hidden) { update(dt); draw(); if (mode === "fly" || mode === "land") updateHUD(); }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // ---------- 页面切换 ----------
  const screens = ["cover", "envelope", "letterScreen", "mailbox"].map((id) => document.getElementById(id));
  const hud = document.getElementById("hud");
  function show(id) {
    screens.forEach((s) => (s.hidden = s.id !== id));
    hud.hidden = id !== "hud";
    if (id !== "hud") whisperEl.classList.remove("show");
  }

  function renderCover() {
    const next = LETTERS.find((l) => l.date > todayStr);
    document.getElementById("thisWeek").innerHTML =
      `这周的信 · ${prettyDate(letter.date)}<br><b>《${escapeHTML(letter.title)}》</b>` +
      (next ? `<br><small style="color:var(--ink-soft)">下一封 ${prettyDate(next.date)} 寄到</small>` : "");
    const picker = document.getElementById("picker");
    picker.innerHTML = "";
    for (const m of MESSENGERS) {
      const b = document.createElement("button");
      b.type = "button"; b.setAttribute("aria-pressed", String(m.key === messenger));
      b.innerHTML = `<img src="${domeSrc(m.key)}" alt="" loading="lazy"><span>${m.name}</span>`;
      b.addEventListener("click", () => {
        messenger = m.key; store.set("messenger", messenger); loadMessenger();
        picker.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      });
      picker.appendChild(b);
    }
    show("cover");
  }

  function showEnvelope() {
    document.getElementById("envFrom").textContent = `来自 杭州 · ${prettyDate(letter.date)}`;
    show("envelope");
  }

  function showLetter() {
    document.getElementById("letterTitle").textContent = letter.title;
    document.getElementById("letterDate").textContent = `${letter.date.replace(/-/g, ".")} · 杭州 → 纽约`;
    const body = document.getElementById("letterBody");
    body.innerHTML = "";
    letter.text.split("\n").forEach((line, i) => {
      const p = document.createElement("p"); p.textContent = line; body.appendChild(p);
      setTimeout(() => p.classList.add("on"), 300 + i * 900);
    });
    document.getElementById("letterSign").textContent = `—— ${letter.from || "泽"}`;
    document.getElementById("letterStats").textContent = `${MESSENGERS.find((m) => m.key === messenger).name}替我飞了 13 个小时，你接住了 ${frags.length} 颗星星`;
    const read = store.get("read", []); if (!read.includes(letter.date)) { read.push(letter.date); store.set("read", read); }
    show("letterScreen");
  }

  function renderMailbox() {
    const list = document.getElementById("mailList");
    const read = store.get("read", []);
    list.innerHTML = "";
    LETTERS.slice().reverse().forEach((l) => {
      const li = document.createElement("li");
      const open = l.date <= todayStr;
      const b = document.createElement("button");
      b.type = "button"; b.className = "mail-item" + (open ? "" : " locked");
      b.innerHTML = open
        ? `<img src="assets/journal/sticker-letter.webp" alt=""><span><b>《${escapeHTML(l.title)}》</b><small>${prettyDate(l.date)} 寄到</small></span>${read.includes(l.date) ? "" : '<span class="badge">新</span>'}`
        : `<img src="assets/journal/stamp-postmark.webp" alt=""><span><b>还在路上</b><small>${prettyDate(l.date)} 寄到</small></span><span class="badge">还有 ${daysUntil(l.date)} 天</span>`;
      if (open) b.addEventListener("click", () => { letter = l; renderCover(); });
      else b.disabled = true;
      li.appendChild(b); list.appendChild(li);
    });
    show("mailbox");
  }

  function escapeHTML(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]); }

  document.getElementById("goBtn").addEventListener("click", () => { audio.wake(); startFlight(); });
  document.getElementById("mailboxBtn").addEventListener("click", renderMailbox);
  document.getElementById("mailBackBtn").addEventListener("click", renderCover);
  document.getElementById("envelopeBtn").addEventListener("click", showLetter);
  document.getElementById("againBtn").addEventListener("click", () => { mode = "idle"; renderCover(); });
  document.getElementById("toMailBtn").addEventListener("click", () => { mode = "idle"; renderMailbox(); });
  document.getElementById("backBtn").addEventListener("click", () => { mode = "idle"; holding = false; renderCover(); });
  const muteBtn = document.getElementById("muteBtn");
  const syncMute = () => { muteBtn.style.opacity = audio.muted ? 0.45 : 1; muteBtn.setAttribute("aria-pressed", String(!audio.muted)); };
  muteBtn.addEventListener("click", () => { audio.toggle(); syncMute(); });
  syncMute();

  // 调试：?fast 把航程压缩，方便自测
  if (/[?&]fast\b/.test(location.search)) {
    const orig = startFlight;
    startFlight = function () { orig(); totalDist = speed * 8; }; // eslint-disable-line no-func-assign
  }

  renderCover();
})();
