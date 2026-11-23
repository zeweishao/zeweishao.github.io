/* 雪宝游记 · 小屋场景
 * 状态来自 /api/xuebao（服务器算时间，防止改手机时间多领）。
 * 雪宝：点一下会说话并跳一下；双击/鼠标来回摸是摸摸头；长按是抱抱；按住拖动可以把她挪到地毯别处。
 */
(() => {
  "use strict";
  const D = window.XUEBAO_DATA;
  const ART = window.XUEBAO_ART || { pc: {}, sv: {}, ch: {} };
  const A = "xuebao-assets/";
  const $ = (id) => document.getElementById(id);
  const store = {
    get(k, d) { try { const v = localStorage.getItem("xuebao:" + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem("xuebao:" + k, JSON.stringify(v)); } catch { /* 隐私模式 */ } }
  };
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const rand = (a, b) => a + Math.random() * (b - a);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const DEST = Object.fromEntries(D.DESTS.map((d) => [d.id, d]));
  const CHAR = Object.fromEntries(D.CHARS.map((c) => [c.id, c]));
  const money = (n) => "¥" + (Math.round(n * 100) / 100).toString();
  const hm = (t) => new Date(t).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
  const whenAt = (t) => { const d = new Date(t); return `${d.getMonth() + 1}月${d.getDate()}日 周${"日一二三四五六"[d.getDay()]} ${hm(t)}`; };
  // “一周”按满 7 天算：显示这一周到哪天几点结束
  const teaLine = () => !S.started ? "第一次领礼物后满一周，带回第一张" : S.teaDueAt ? (S.teaDueAt <= now() ? "这周的奶茶券已经满一周，下一份礼物里就有" : `每满一周一张，${whenAt(S.teaDueAt)} 之后的那份礼物里`) : "每满一周带回一张";
  const md = (t) => { const d = new Date(t); return `${d.getMonth() + 1}月${d.getDate()}日`; };
  const dur = (ms) => {
    ms = Math.max(0, ms); const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000);
    return h ? `${h}小时${String(m).padStart(2, "0")}分` : `${m}分${String(s).padStart(2, "0")}秒`;
  };

  const stage = $("stage"), viewport = $("viewport"), me = $("xuebao"), meImg = $("xbImg"), shadow = $("xbShadow"), fx = $("fx");
  let S = null; // 服务器状态
  let offset = 0; // 服务器时间 - 本机时间
  const now = () => Date.now() + offset;

  // ---------- 声音（WebAudio 现合成，不加载文件） ----------
  const Sound = (() => {
    let ctx = null, muted = store.get("muted", false), music = null;
    const ac = () => { if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } } if (ctx.state === "suspended") ctx.resume(); return ctx; };
    const tone = (f, d = 0.18, type = "sine", v = 0.12, when = 0) => {
      if (muted) return; const c = ac(); if (!c) return;
      const t = c.currentTime + when, o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0008, t + d);
      o.connect(g).connect(c.destination); o.start(t); o.stop(t + d + 0.05);
    };
    const PENTA = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66];
    return {
      get muted() { return muted; },
      toggle() { muted = !muted; store.set("muted", muted); if (muted) this.stopMusic(); return muted; },
      pop() { tone(rand(620, 760), 0.12, "triangle", 0.09); },
      boop() { tone(440, 0.1, "sine", 0.08); tone(660, 0.14, "sine", 0.07, 0.06); },
      coin() { tone(1318, 0.12, "square", 0.04); tone(1760, 0.3, "square", 0.04, 0.08); },
      chime() { for (let i = 0; i < 5; i++) tone(pick(PENTA) * 2, 1.4, "sine", 0.05, i * 0.11); },
      sparkle() { [0, 1, 2, 3].forEach((i) => tone(PENTA[i + 2] * 2, 0.5, "triangle", 0.05, i * 0.07)); },
      open() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.6, "triangle", 0.08, i * 0.09)); },
      fanfare() { [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => tone(f, 0.45, "triangle", 0.08, i * 0.12)); },
      paper() { tone(rand(180, 260), 0.08, "sawtooth", 0.02); },
      get playing() { return !!music; },
      startMusic() {
        if (muted || music) return; const c = ac(); if (!c) return;
        const seq = [0, 2, 4, 2, 5, 4, 2, 1, 0, 2, 3, 4, 6, 4, 2, 0]; let i = 0;
        music = setInterval(() => { tone(PENTA[seq[i % seq.length]], 0.9, "sine", 0.05); if (i % 4 === 0) tone(PENTA[seq[i % seq.length]] / 2, 1.2, "triangle", 0.03); i++; }, 380);
      },
      stopMusic() { clearInterval(music); music = null; }
    };
  })();
  const muteBtn = $("muteBtn");
  const syncMute = () => muteBtn.classList.toggle("is-off", Sound.muted);
  muteBtn.addEventListener("click", () => { Sound.toggle(); syncMute(); if (!Sound.muted) Sound.pop(); });
  syncMute();

  // ---------- 布局：舞台按 3:2，窄屏左右滑动 ----------
  const RATIO = 1.5;
  function layout() {
    const vw = innerWidth, vh = innerHeight - viewport.getBoundingClientRect().top;
    let h, w;
    if (document.body.classList.contains("hall")) { h = vh; w = vw; } // 3D 花园大厅：铺满整个画面
    else if (vw / vh >= RATIO * 0.98 || vw > 980) { h = Math.min(vh - 28, (vw - 28) / RATIO); w = h * RATIO; }
    else { h = vh; w = h * RATIO; }
    stage.style.width = w + "px"; stage.style.height = h + "px";
    viewport.style.justifyContent = w > vw ? "flex-start" : "center";
    requestAnimationFrame(placeHud);
    placeMe(true);
  }
  function centerOn(xPct, smooth) {
    const w = stage.offsetWidth; if (w <= viewport.clientWidth) return;
    viewport.scrollTo({ left: Math.max(0, w * xPct / 100 - viewport.clientWidth / 2), behavior: smooth ? "smooth" : "auto" });
  }
  addEventListener("resize", layout);
  // HUD 贴着画面右上角（窄屏贴着屏幕右上角）
  function placeHud() {
    const r = stage.getBoundingClientRect(), hud = $("hud");
    hud.style.right = Math.max(8, innerWidth - Math.min(innerWidth, r.right) + 12) + "px";
    hud.style.top = Math.max(viewport.getBoundingClientRect().top + 8, r.top + 10) + "px";
  }
  const ICON = {
    sunny: '<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="6.5" fill="#ffd56b"/><g stroke="#ffe7a3" stroke-width="2.2" stroke-linecap="round">' + [0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<line x1="16" y1="3.5" x2="16" y2="7" transform="rotate(${a} 16 16)"/>`).join("") + "</g></svg>",
    blossom: '<svg viewBox="0 0 32 32"><g fill="#ffc2d4">' + [0, 72, 144, 216, 288].map((a) => `<ellipse cx="16" cy="9.5" rx="4.3" ry="6.2" transform="rotate(${a} 16 16)"/>`).join("") + '</g><circle cx="16" cy="16" r="2.6" fill="#ffe28a"/></svg>',
    rainy: '<svg viewBox="0 0 32 32"><path d="M9 19a5 5 0 0 1 .6-10A7 7 0 0 1 23 10.5 4.5 4.5 0 0 1 23 19Z" fill="#dfe7f0"/><g stroke="#9cc4ff" stroke-width="2" stroke-linecap="round"><line x1="11" y1="22" x2="9.5" y2="27"/><line x1="16.5" y1="22" x2="15" y2="27"/><line x1="22" y1="22" x2="20.5" y2="27"/></g></svg>',
    snowy: '<svg viewBox="0 0 32 32"><path d="M9 17a5 5 0 0 1 .6-10A7 7 0 0 1 23 8.5 4.5 4.5 0 0 1 23 17Z" fill="#eef3fa"/><g fill="#fff" stroke="#b9d3f0" stroke-width=".8"><circle cx="10" cy="23" r="2.2"/><circle cx="16.5" cy="26" r="2.2"/><circle cx="22.5" cy="22.5" r="2.2"/></g></svg>',
    night: '<svg viewBox="0 0 32 32"><path d="M20.5 5.5A11 11 0 1 0 26.5 22 9 9 0 0 1 20.5 5.5Z" fill="#ffe3a0"/><circle cx="25" cy="7" r="1.3" fill="#fff"/><circle cx="28" cy="13" r=".9" fill="#fff"/></svg>'
  };
  // 天气：自动 / 手动切换（只记在这台设备上）
  const wxPanel = $("wxPanel");
  wxPanel.querySelectorAll("[data-ico]").forEach((e) => { e.innerHTML = e.dataset.ico === "auto" ? '<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="10" fill="none" stroke="#ffcf8a" stroke-width="2"/><path d="M16 9v7l5 3" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/></svg>' : ICON[e.dataset.ico]; });
  function openWx() {
    const r = $("hud").getBoundingClientRect(), mode = store.get("weatherMode", null) || "auto";
    wxPanel.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.wx === mode)));
    wxPanel.style.top = r.bottom + 6 + "px"; wxPanel.style.right = Math.max(8, innerWidth - r.right) + "px";
    wxPanel.hidden = false; Sound.pop();
  }
  $("hud").addEventListener("click", (e) => { e.stopPropagation(); wxPanel.hidden ? openWx() : (wxPanel.hidden = true); });
  $("hud").addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openWx(); } });
  document.addEventListener("click", (e) => { if (!wxPanel.hidden && !wxPanel.contains(e.target)) wxPanel.hidden = true; });
  wxPanel.addEventListener("click", (e) => {
    const b = e.target.closest("[data-wx]"); if (!b) return;
    store.set("weatherMode", b.dataset.wx === "auto" ? null : b.dataset.wx);
    wxPanel.hidden = true; Sound.chime(); sky(); hud();
    if (b.dataset.wx === "auto") say("天气交给纽约的天空决定啦。", me, 2600);
  });

  function hud() {
    const t = new Date(now());
    const ny = (o) => t.toLocaleString("zh-CN", { timeZone: "America/New_York", ...o });
    $("hudTime").textContent = ny({ hour: "2-digit", minute: "2-digit", hour12: false });
    $("hudDate").textContent = `${ny({ month: "long", day: "numeric" })} ${ny({ weekday: "short" })}`;
    const manual = !!store.get("weatherMode", null);
    $("hudWeather").innerHTML = `纽约 · ${weather.name}${manual ? ' <span class="hud-tag">手动</span>' : ""}`;
    if ($("hudIco").dataset.w !== weather.id) { $("hudIco").innerHTML = ICON[weather.id] || ICON.sunny; $("hudIco").dataset.w = weather.id; }
    $("hudHz").textContent = "杭州 " + t.toLocaleTimeString("zh-CN", { timeZone: "Asia/Shanghai", hour: "2-digit", minute: "2-digit", hour12: false });
    const h = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", hourCycle: "h23" }).format(t)) % 24;
    const nextH = h < 6 ? 6 : h < 10 ? 10 : h < 14 ? 14 : h < 19 ? 19 : 6;
    $("hudNext").textContent = `天气 ${String(nextH).padStart(2, "0")}:00 变化`;
    if (S && !S.offline) {
      const tt = now();
      $("hudTrip").textContent = S.phase === "away" ? `雪宝旅行中 · ${dur(S.nextAt - tt)}后回来` : S.phase === "home" ? `雪宝在家 · ${dur(S.leaveAt - tt)}后出门` : `雪宝回来啦 · ${S.ready} 份礼物`;
    }
  }

  // ---------- 气泡和特效 ----------
  const bubble = $("bubble"); let bubbleT = 0;
  function say(text, el = me, ms = 2600) {
    if (!text) return;
    const r = el.getBoundingClientRect();
    bubble.textContent = text;
    const x = Math.min(innerWidth - 20, Math.max(20, r.left + r.width / 2));
    bubble.style.left = x + "px"; bubble.style.top = Math.max(70, r.top + (el === me ? r.height * 0.06 : 0) - 8) + "px";
    bubble.classList.add("show"); clearTimeout(bubbleT);
    bubbleT = setTimeout(() => bubble.classList.remove("show"), ms);
  }
  function stagePoint(el, fy = 0.2) {
    const s = stage.getBoundingClientRect(), r = el.getBoundingClientRect();
    return { x: ((r.left + r.width / 2 - s.left) / s.width) * 100, y: ((r.top + r.height * fy - s.top) / s.height) * 100 };
  }
  function burst(kind, x, y, n = 6) {
    for (let i = 0; i < n; i++) {
      const e = document.createElement("i"); e.className = "fx-" + kind;
      e.style.left = `calc(${x}% + ${rand(-2.5, 2.5)}cqi)`; e.style.top = `calc(${y}% + ${rand(-1.5, 1.5)}cqi)`;
      e.style.setProperty("--dx", rand(-40, 40) + "px"); e.style.setProperty("--dy", rand(-50, -10) + "px");
      e.style.animationDelay = i * 0.07 + "s";
      if (kind === "note") e.textContent = pick(["♪", "♫", "♩"]);
      if (kind === "z") e.textContent = "z";
      fx.append(e); setTimeout(() => e.remove(), 3000);
    }
  }

  // ---------- 雪宝本人 ----------
  const POSE = { idle: "xb-idle", tea: "xb-tea", book: "xb-book", nap: "xb-nap", wave: "xb-wave", jump: "xb-jump", wow: "xb-wow", back: "xb-back", wait: "xb-wait", pack: "xb-pack" };
  const ratio = {}; // 宽/高
  Object.entries(POSE).forEach(([k, f]) => { const im = new Image(); im.onload = () => { ratio[k] = im.naturalWidth / im.naturalHeight; if (k === pose) placeMe(true); }; im.src = A + f + ".webp?v=2"; });
  let pose = "idle", pos = { x: 52, y: 93 }, sitting = false;
  const SPOT = { rug: { x: 52, y: 93 }, door: { x: 89.5, y: 77.5 } };
  // 给 3D 花园大厅（xuebao-hall.js）读：雪宝站在哪、什么姿势
  window.XBGame = { get pos() { return pos; }, get pose() { return pose; }, get phase() { return S?.phase; }, SPOT,
    sound(k) { Sound[k]?.(); },
    // 花园里的互动（喷泉、秋千……）：雪宝说一句，暂停日常动作一会儿
    react(line) {
      if (["away", "back", "waiting"].includes(S?.phase) && stage.classList.contains("hall") && stage.dataset.phase === S.phase) {
        if (line) say(line);
        return;
      }
      if (S?.phase !== "home") return;
      clearTimeout(routineT); clearInterval(zzzT); if (line) say(line); routineT = setTimeout(routine, rand(14000, 22000));
    },
    // 大厅里用键盘走路：开始时停下日常动作，停下时记住新位置（w 为地板坐标）
    moved(w) {
      if (!S || S.phase !== "home") return;
      clearTimeout(routineT); clearInterval(zzzT); clearTimeout(walkT);
      if (!w) { if (pose !== "idle") setPose("idle"); return; }
      const k = pos.x.toFixed(2) + "," + pos.y.toFixed(2); pos = { ...pos, wx: w.wx, wz: w.wz, wk: k }; store.set("spot", pos);
      routineT = setTimeout(routine, rand(12000, 20000));
    } };
  function placeMe(instant) {
    const r = ratio[pose] || 0.66;
    const hPct = Math.max(29, Math.min(36, 31 + (pos.y - 77.5) * 0.26)); // 越靠里越小
    const wPct = (hPct * r) / RATIO;
    if (instant) { me.style.transition = "none"; shadow.style.transition = "none"; }
    me.style.width = wPct + "%"; me.style.left = pos.x - wPct / 2 + "%"; me.style.top = pos.y - hPct + "%";
    shadow.style.width = wPct * 0.7 + "%"; shadow.style.left = pos.x - wPct * 0.35 + "%"; shadow.style.top = pos.y - 1.6 + "%";
    if (instant) { me.offsetWidth; me.style.transition = ""; shadow.style.transition = ""; }
  }
  function setPose(p) {
    if (p === pose && meImg.src.includes(POSE[p])) return;
    pose = p; sitting = ["tea", "book", "nap", "wait", "pack"].includes(p);
    meImg.src = A + POSE[p] + ".webp?v=2";
    me.classList.remove("swap"); void me.offsetWidth; me.classList.add("swap");
    placeMe(false);
  }
  function anim(cls, ms = 600) { me.classList.remove(cls); void me.offsetWidth; me.classList.add(cls); setTimeout(() => me.classList.remove(cls), ms); }

  // 在家时的小日常
  let routineT = 0, zzzT = 0;
  function routine() {
    clearTimeout(routineT); clearInterval(zzzT);
    if (!S || S.phase !== "home" || dragging) return;
    const next = pick(["idle", "idle", "tea", "book", "nap", "wave"]);
    setPose(next);
    if (next === "nap") zzzT = setInterval(() => { const p = stagePoint(me, 0.12); burst("z", p.x + 3, p.y, 1); }, 1700);
    if (next === "wave") setTimeout(() => say(pick(D.LINES.tap)), 300);
    routineT = setTimeout(routine, rand(15000, 26000));
  }

  // 互动：点、双击/摸摸、长按抱抱、拖动
  let downAt = 0, downX = 0, downY = 0, pressT = 0, longDone = false, dragging = false, lastTap = 0, tapT = 0, rub = 0, rubLast = null;
  me.addEventListener("pointerdown", (e) => {
    if (!S || S.phase === "away") return;
    me.setPointerCapture(e.pointerId);
    downAt = Date.now(); downX = e.clientX; downY = e.clientY; longDone = false; dragging = false;
    pressT = setTimeout(() => { longDone = true; hugMe(); }, 650);
  });
  me.addEventListener("pointermove", (e) => {
    if (downAt) {
      if (!dragging && Math.hypot(e.clientX - downX, e.clientY - downY) > 10 && !longDone && S.phase === "home") {
        dragging = true; clearTimeout(pressT); clearTimeout(routineT); clearInterval(zzzT);
        me.classList.add("dragging"); setPose("jump"); Sound.boop(); say(document.body.classList.contains("hall") ? "等等我～我跟着你跑！" : "哇——飞起来啦！");
      }
      if (dragging) {
        const s = stage.getBoundingClientRect();
        const hall = document.body.classList.contains("hall");
        pos.x = Math.min(hall ? 100 : 80, Math.max(hall ? 0 : 24, ((e.clientX - s.left) / s.width) * 100));
        pos.y = Math.min(hall ? 100 : 97, Math.max(hall ? 0 : 80, ((e.clientY - s.top) / s.height) * 100 + (hall ? 6 : 18)));
        placeMe(true);
      }
      return;
    }
    if (e.pointerType === "mouse") { // 鼠标来回摸头
      const r = me.getBoundingClientRect();
      if (e.clientY > r.top + r.height * 0.45) return;
      if (rubLast) rub += Math.abs(e.clientX - rubLast);
      rubLast = e.clientX;
      if (rub > 420) { rub = 0; petMe(); }
    }
  });
  me.addEventListener("pointerleave", () => { rub = 0; rubLast = null; });
  const endPress = () => {
    clearTimeout(pressT);
    if (!downAt) return; downAt = 0;
    if (dragging) {
      dragging = false; me.classList.remove("dragging"); setPose("wow"); anim("squash", 450); Sound.pop();
      store.set("spot", pos);
      setTimeout(() => { if (S?.phase === "home") routine(); }, 1300);
      return;
    }
    if (longDone) return;
    const t = Date.now();
    if (t - lastTap < 320) { clearTimeout(tapT); lastTap = 0; petMe(); return; }
    lastTap = t; tapT = setTimeout(tapMe, 260);
  };
  me.addEventListener("pointerup", endPress);
  me.addEventListener("pointercancel", endPress);
  me.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); tapMe(); } });

  // 点地板：雪宝走过去（2.5D 场景发出 xb:floor）
  let walkT = 0;
  addEventListener("xb:floor", (e) => {
    if (!S || dragging) return;
    if (S.phase !== "home") { if (S.phase === "back" || S.phase === "waiting") say("我带了礼物回来，点左上角的礼物盒拆开吧～"); return; }
    if (pose === "nap") { clearTimeout(routineT); clearInterval(zzzT); setPose("wow"); say("唔……醒啦，这就过来！"); Sound.boop(); setTimeout(() => walkTo(e.detail), 900); return; }
    walkTo(e.detail);
  });
  function walkTo(d) {
    const hall = document.body.classList.contains("hall");
    const to = hall ? { x: d.x, y: d.y, ...(d.wx != null ? { wx: d.wx, wz: d.wz, wk: d.wk } : {}) } : { x: Math.min(80, Math.max(24, d.x)), y: Math.min(97, Math.max(80, d.y)) };
    const dist = Math.hypot(to.x - pos.x, (to.y - pos.y) * 1.5); if (dist < 2) { tapMe(); return; }
    clearTimeout(routineT); clearInterval(zzzT); clearTimeout(walkT);
    if (pose !== "idle" && pose !== "wave") setPose("idle");
    me.style.transitionDuration = Math.min(2.2, 0.35 + dist * 0.045) + "s";
    meImg.style.scale = to.x < pos.x ? "-1 1" : "";
    pos = to; store.set("spot", pos); me.classList.add("walk"); placeMe(false); Sound.paper();
    walkT = setTimeout(() => { me.classList.remove("walk"); me.style.transitionDuration = ""; meImg.style.scale = ""; store.set("spot", pos); anim("hop", 560);
      if (Math.random() < 0.5) say(pick(["到啦！", "这里也很好。", "走过来啦～", weather.id === "night" ? "这儿离灯近，暖暖的。" : "这儿能晒到太阳。"])); routineT = setTimeout(routine, rand(9000, 16000)); }, Math.min(2200, 350 + dist * 45));
  }

  function tapMe() {
    if (!S) return;
    Sound.pop(); anim("hop", 560);
    const p = stagePoint(me, 0.15); burst("heart", p.x, p.y, 3);
    if (S.phase === "back" || S.phase === "waiting") { say(S.phase === "waiting" ? pick(D.LINES.wait) : pick(D.LINES.back)); return; }
    const lines = pose === "nap" ? D.LINES.sleepy : pose === "tea" ? D.LINES.tea : pose === "book" ? D.LINES.book : D.LINES.tap;
    say(pick(lines));
    if (pose === "nap" && Math.random() < 0.5) { setTimeout(() => { setPose("wow"); say("啊，被你叫醒了！"); setTimeout(routine, 2400); }, 900); }
  }
  function petMe() {
    Sound.sparkle(); anim("hug", 900);
    const p = stagePoint(me, 0.1); burst("heart", p.x, p.y, 7);
    say(pick(D.LINES.pet));
    if (S?.phase === "home" && pose !== "jump") { setPose("jump"); clearTimeout(routineT); routineT = setTimeout(routine, 3000); }
  }
  function hugMe() {
    Sound.fanfare(); anim("hug", 900);
    const p = stagePoint(me, 0.3); burst("heart", p.x, p.y, 14);
    say("抱抱！最喜欢你了。", me, 3000);
  }

  // ---------- 场景道具 ----------
  const props = {
    chime(el) { el.classList.remove("ring"); void el.offsetWidth; el.classList.add("ring"); Sound.chime(); say("叮铃——风从纽约吹过来了。", el); },
    // 收音机 = 音乐播放器：放《我的小怪兽》；再点一下停
    radio(el) {
      wiggle(el); Sound.stopMusic();
      if (Music.playing) { Music.pause(); say("音乐停啦。", el); }
      else { Music.play(); say("放我们的歌——《我的小怪兽》。", el); }
    },
    lamp() { stage.classList.toggle("lamp-on"); store.set("lamp:" + weather.id, stage.classList.contains("lamp-on")); Sound.boop(); },
    plant(el) {
      wiggle(el); Sound.pop(); const p = stagePoint(el, 0.2); burst("leaf", p.x, p.y, 3);
      const n = store.get("water", 0) + 1; store.set("water", n);
      say(n % 5 === 0 ? `浇了 ${n} 次水，它好像长高了一点点。` : pick(["给它浇点水。", "叶子晃了晃，像在说谢谢。", "它在努力长大。"]), el);
    },
    mug(el) { wiggle(el); Sound.pop(); say(pick(["热可可，还是热的。", "等你醒来就有热的喝。"]), el); },
    hat(el) { el.classList.remove("hop"); void el.offsetWidth; el.classList.add("hop"); Sound.boop(); say("雪宝出门旅行时会戴上它。", el); },
    globe(el) { wiggle(el); Sound.sparkle(); if (S && window.XUEBAO_PLACES) openAtlas(); else { const visited = Object.keys(S?.collection || {}).length; say(`雪宝已经去过 ${visited} 个地方啦，还有 ${D.DESTS.length - visited} 个。`, el); } },
    door(el) {
      if (!S) return;
      if (S.phase === "away") say(`雪宝还在路上，${S.nextAt ? hm(S.nextAt) + " 左右回来" : "快回来了"}。`, el);
      else if (S.phase === "home") say("雪宝休息一会儿，就从这扇门出去旅行。", el);
      else openPack();
    },
    piggy: () => openWallet(),
    jar: () => openShards(),
    map: () => openAlbum("pc"),
    cardbox: () => openAlbum("pc"),
    frame() { const g = S?.history?.find((h) => ART.pc[h.dest]) || S?.history?.[0]; if (g) openPostcard(g); else say("还没有明信片，等雪宝第一次回来吧。", document.querySelector('[data-prop="frame"]')); },
    calendar: () => openCalendar(),
    mailbox: () => openMailbox(),
    note: () => openNote()
  };
  function wiggle(el) { el.classList.remove("wiggle"); void el.offsetWidth; el.classList.add("wiggle"); }
  document.querySelectorAll("[data-prop]").forEach((el) => el.addEventListener("click", () => props[el.dataset.prop]?.(el)));
  $("windowHot").addEventListener("click", (e) => {
    const ny = new Date().toLocaleTimeString("zh-CN", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", hour12: false });
    const hz = new Date().toLocaleTimeString("zh-CN", { timeZone: "Asia/Shanghai", hour: "2-digit", minute: "2-digit", hour12: false });
    Sound.pop(); say(`纽约现在 ${ny}，${weather.name}。杭州 ${hz}。${weather.line}`, e.currentTarget, 3600);
  });
  $("cta").addEventListener("click", () => openPack());
  $("giftBtn").addEventListener("click", () => {
    if (!S || S.offline) { say("小屋暂时连不上，过一会儿再来看看。"); return; }
    if ((S.phase === "back" || S.phase === "waiting") && S.ready > 0) { openPack(); return; }
    Sound.boop(); say(S.phase === "away" ? `我还在路上，${dur(S.nextAt - now())}后带礼物回来～` : `下一份礼物大约 ${hm(S.nextAt)} 准备好，等我出门带回来！`);
  });
  $("moneyChip").addEventListener("click", () => openWallet());
  $("shardChip").addEventListener("click", () => openShards());
  $("tripPill").addEventListener("click", () => openCalendar());

  // ---------- 天色 ----------
  // 天气（纽约时间分时段刷新，见 xuebao-data.js 的 weatherAt）；?weather=night 可以预览
  let weather = D.weatherAt ? D.weatherAt() : { id: "sunny", name: "晴", line: "" };
  function sky() {
    const forced = new URLSearchParams(location.search).get("weather") || store.get("weatherMode", null);
    weather = D.weatherAt ? D.weatherAt(now()) : weather;
    if (forced && D.WEATHERS?.[forced]) weather = { id: forced, ...D.WEATHERS[forced] };
    const id = weather.id, changed = stage.dataset.weather && stage.dataset.weather !== id;
    stage.dataset.weather = id; document.body.dataset.weather = id === "snowy" ? "rainy" : id; document.body.dataset.wx = id;
    stage.dataset.sky = id === "night" ? "night" : "day";
    const src = A + "room-" + (id === "snowy" ? "rainy" : id) + ".webp"; if (!$("roomImg").src.endsWith(src)) $("roomImg").src = src;
    const lamp = store.get("lamp:" + id, null);
    stage.classList.toggle("lamp-on", lamp == null ? (id === "night" || id === "rainy" || id === "snowy") : lamp);
    if (changed && S?.phase !== "away") setTimeout(() => say(weather.line), 800);
  }
  (function motes() {
    const box = stage.querySelector(".xb-motes");
    for (let i = 0; i < 16; i++) {
      const m = document.createElement("i");
      m.style.left = rand(8, 60) + "%"; m.style.top = rand(45, 95) + "%";
      m.style.animationDuration = rand(7, 14) + "s"; m.style.animationDelay = -rand(0, 14) + "s";
      box.append(m);
    }
  })();

  // ---------- 读状态 ----------
  async function api(body) {
    const r = await fetch("/api/xuebao", body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    if (j.now) offset = j.now - Date.now();
    if (!r.ok) { const e = new Error(j.error || "小屋暂时连不上"); e.data = j; throw e; }
    return j;
  }
  let lastPhase = null;
  async function refresh(animate) {
    try { S = await api(); }
    catch (e) { $("statusLine").textContent = "小屋暂时连不上，过一会儿再来看看。"; if (!S) { S = { phase: "home", offline: true, history: [], collection: {}, meets: {}, coupons: [], wallet: { balance: 0, weekPaid: 0, weekCap: 520, ledger: [] }, frag: { given: 0, target: 99, pendingSkins: 0 } }; render(); } return; }
    const prev = lastPhase; render();
    if (animate && prev && prev !== S.phase) {
      if (prev === "home" && S.phase === "away") departAnim();
      if (prev === "away" && (S.phase === "back" || S.phase === "waiting")) arriveAnim();
    }
  }

  function render() {
    const ph = S.phase, prevPh = lastPhase; lastPhase = ph;
    stage.dataset.phase = ph;
    // 雪宝的位置和姿势
    if (!dragging) {
      if (ph === "back" || ph === "waiting") { pos = { ...SPOT.door }; setPose(ph === "waiting" ? "wait" : "back"); clearTimeout(routineT); clearInterval(zzzT); }
      else if (ph === "home") { if (prevPh !== "home") pos = store.get("spot", SPOT.rug); if (["back", "wait"].includes(pose)) setPose("idle"); placeMe(false); if (!routineT) routineT = setTimeout(routine, 6000); }
      placeMe(false);
    }
    // 状态文字
    const st = $("statusLine");
    if (S.offline) st.textContent = "小屋暂时连不上，过一会儿再来看看。";
    else if (ph === "home") st.textContent = `雪宝在家休息，大约 ${hm(S.leaveAt)} 出门旅行`;
    else if (ph === "away") st.textContent = `雪宝出门旅行了，${hm(S.nextAt)} 左右带礼物回来`;
    else if (ph === "back" && !S.started) st.textContent = "雪宝在门口给你准备了一份见面礼，领了就开始旅行";
    else if (ph === "back") st.textContent = `雪宝回来啦！带回 ${S.ready} 份礼物${S.nextAt ? `，下一份 ${hm(S.nextAt)}` : ""}`;
    else st.textContent = "雪宝带回了 3 份礼物，在门口等你";
    // CTA
    const cta = $("cta"), pill = $("tripPill");
    const isZe = who() === "泽";
    cta.hidden = !(ph === "back" || ph === "waiting");
    $("ctaText").textContent = isZe ? `雪雪有 ${S.ready} 份礼物待拆` : `拆礼物 · ${S.ready} 份`;
    pill.hidden = !cta.hidden || S.offline;
    // 左上角礼物入口（不显示数字角标，发光跳动就表示有礼物）
    { const g = $("giftBtn"), has = (ph === "back" || ph === "waiting") && S.ready > 0;
      g.classList.toggle("has", has);
      $("giftTxt").textContent = has ? "领礼物" : S.offline ? "礼物" : S.nextAt ? `${hm(S.nextAt)} 到` : "礼物";
      g.setAttribute("aria-label", has ? `领取 ${S.ready} 份礼物` : "礼物还在路上"); }
    // 顶部数字
    $("moneyText").textContent = money(S.wallet.balance);
    $("shardText").textContent = `${S.frag.given}/${S.frag.target}`;
    $("jarFill").style.height = Math.min(80, (S.frag.given / S.frag.target) * 80) + "%";
    // 相框：最近的一张明信片
    const g = S.history?.find((h) => ART.pc[h.dest]) || S.history?.[0];
    $("framePic").style.backgroundImage = g && ART.pc[g.dest] ? `url(${A}pc-${g.dest}.webp)` : g ? fallbackBg(g.dest) : "";
    tick();
  }

  function tick() {
    hud();
    if (!S || S.offline) return;
    const t = now();
    const cal = $("calText"), pill = $("tripText");
    const day = new Date().toLocaleDateString("zh-CN", { timeZone: "America/New_York", day: "numeric" }).replace("日", "");
    if (S.phase === "away" || S.phase === "home") {
      const total = S.tripHours * 3600000, left = S.nextAt - t;
      $("tripRing").style.setProperty("--p", Math.min(1, Math.max(0, 1 - left / total)).toFixed(3));
      pill.textContent = S.phase === "away" ? `雪宝在路上 · 还有 ${dur(left)}` : `雪宝在家 · ${dur(S.leaveAt - t)}后出门`;
      cal.innerHTML = `<b>${day}</b>${S.phase === "away" ? hm(S.nextAt) + "回" : "在家"}`;
      if (left <= 0 || (S.phase === "home" && S.leaveAt && t >= S.leaveAt)) { S.nextAt = t + 60000; S.leaveAt = null; refresh(true); }
    } else cal.innerHTML = `<b>${day}</b>回来啦`;
  }
  setInterval(tick, 1000);

  async function departAnim() {
    pos = store.get("spot", SPOT.rug); stage.dataset.phase = "home"; placeMe(true);
    setPose("pack"); say("收拾一下背包……");
    await sleep(2400); setPose("wave"); say(pick(D.LINES.away) + "回来讲给你听！"); Sound.boop();
    await sleep(1600); pos = { ...SPOT.door }; placeMe(false);
    await sleep(1000); stage.dataset.phase = "away"; Sound.paper();
  }
  async function arriveAnim() {
    centerOn(84, true); Sound.open();
    me.classList.add("gone"); await sleep(500); me.classList.remove("gone");
    anim("hop", 600); const p = stagePoint(me, 0.2); burst("spark", p.x, p.y, 10);
    say(pick(D.LINES.back), me, 3200);
  }

  // ---------- 身份 ----------
  function who() {
    let w = store.get("who", null);
    if (!w) { try { const sp = JSON.parse(localStorage.getItem("starpost:me")); if (sp === "雪" || sp === "泽") { w = sp; store.set("who", w); } } catch { /* 无 */ } }
    return w;
  }
  function askWho(then) {
    sheet(`<h2>你是谁呀？</h2><p class="sub">雪宝带回的礼物只给雪雪拆，选一次就会记住。</p>
      <div class="xb-row"><button class="xb-btn" data-w="雪">我是雪雪</button><button class="xb-btn ghost" data-w="泽">我是泽（只看看）</button></div>`, (el) => {
      el.querySelectorAll("[data-w]").forEach((b) => b.addEventListener("click", () => { store.set("who", b.dataset.w); closeSheet(); render(); then?.(); }));
    });
  }

  // ---------- 面板 ----------
  const wrap = $("sheetWrap"), sheetEl = $("sheet");
  function sheet(html, bind) {
    sheetEl.style.width = ""; sheetEl.innerHTML = `<button class="xb-close" aria-label="关闭">×</button>${html}`;
    wrap.hidden = false; sheetEl.scrollTop = 0;
    sheetEl.querySelector(".xb-close").addEventListener("click", closeSheet);
    bind?.(sheetEl); Sound.paper();
  }
  function closeSheet() { sheetEl.querySelectorAll("video").forEach((v) => v.pause()); wrap.hidden = true; sheetEl.innerHTML = ""; }

  // ---------- 唱片机 / 音乐播放器：《我的小怪兽 · 给雪子》 ----------
  // 只听歌用单独的音频（小），看 MV 用视频；两个不同时出声。正在放歌时页面顶上有个小唱片条，点它能暂停或打开唱片机。
  const SONG = { title: "我的小怪兽", sub: "给雪子", audio: "xuebao-media/wode-xiaoguaishou.m4a?v=20261123", video: "xuebao-media/wode-xiaoguaishou.mp4?v=20261123", cover: A + "mv-xiaoguaishou-cover.jpg" };
  const Music = (() => {
    let au = null; const subs = new Set();
    const pill = document.createElement("button"); pill.type = "button"; pill.className = "xb-np"; pill.hidden = true;
    pill.innerHTML = `<i class="disc" style="background-image:url('${SONG.cover}')"></i><span><b>${SONG.title}</b><small>正在播放 · 点我打开唱片机</small></span><em aria-hidden="true">❚❚</em>`;
    document.body.append(pill);
    pill.addEventListener("click", (e) => { if (e.target.closest("em")) { M.toggle(); return; } M.open("song"); });
    const emit = () => { pill.hidden = !M.playing || !wrap.hidden; pill.querySelector("em").textContent = M.playing ? "❚❚" : "▶"; subs.forEach((f) => f(M.playing)); };
    const audio = () => { if (!au) { au = new Audio(SONG.audio); au.preload = "auto"; au.addEventListener("play", emit); au.addEventListener("pause", emit); au.addEventListener("ended", emit); au.addEventListener("timeupdate", () => subs.forEach((f) => f(M.playing, au))); } return au; };
    const M = {
      SONG,
      get playing() { return !!au && !au.paused; },
      get audioEl() { return au; },
      play() { Sound.stopMusic(); const a = audio(); a.play().catch(() => say("先点一下页面，再让我放歌～")); },
      pause() { au?.pause(); },
      toggle() { M.playing ? M.pause() : M.play(); },
      on(f) { subs.add(f); return () => subs.delete(f); },
      // 打开唱片机：mode = "video" 直接看 MV；"song" 只听歌
      open(mode = "video") {
        const fmt = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
        sheet(`<div class="xb-player" data-mode="${mode}">
          <p class="xb-player-kicker">唱片机 · 我们的歌</p>
          <h3>${SONG.title}<small>${SONG.sub}</small></h3>
          <div class="xb-player-tabs" role="tablist"><button type="button" data-tab="video" role="tab">🎬 看 MV</button><button type="button" data-tab="song" role="tab">🎵 只听歌</button></div>
          <div class="xb-player-video"><video playsinline controls preload="metadata" poster="${SONG.cover}"></video></div>
          <div class="xb-player-song">
            <div class="xb-vinyl"><i style="background-image:url('${SONG.cover}')"></i></div>
            <div class="xb-player-bar"><span></span></div>
            <div class="xb-player-time"><span class="cur">0:00</span><span class="dur">4:03</span></div>
            <button type="button" class="xb-player-play">▶ 播放</button>
            <p class="xb-player-tip">关掉唱片机歌也会继续放，可以一边听一边逛小世界。</p>
          </div>
        </div>`, (el) => {
          const box = el.querySelector(".xb-player"), vid = el.querySelector("video"), btn = el.querySelector(".xb-player-play"), bar = el.querySelector(".xb-player-bar span");
          const cur = el.querySelector(".cur"), dur = el.querySelector(".dur");
          const setMode = (m) => {
            box.dataset.mode = m; el.querySelectorAll("[data-tab]").forEach((b) => b.setAttribute("aria-selected", b.dataset.tab === m));
            if (m === "video") { const at = au?.currentTime || 0; M.pause(); if (!vid.src) vid.src = SONG.video; vid.currentTime = at; vid.play().catch(() => {}); }
            else { const at = vid.currentTime || 0; vid.pause(); if (at > 1) audio().currentTime = at; M.play(); }
          };
          el.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => setMode(b.dataset.tab)));
          btn.addEventListener("click", () => M.toggle());
          const paint = () => { const a = au; btn.textContent = M.playing ? "❚❚ 暂停" : "▶ 播放"; box.classList.toggle("spinning", M.playing); if (a && a.duration) { bar.style.width = (a.currentTime / a.duration * 100).toFixed(2) + "%"; cur.textContent = fmt(a.currentTime); dur.textContent = fmt(a.duration); } };
          el.querySelector(".xb-player-bar").addEventListener("click", (e) => { const a = audio(), r = e.currentTarget.getBoundingClientRect(); if (a.duration) a.currentTime = (e.clientX - r.left) / r.width * a.duration; paint(); });
          const off = M.on(paint); paint();
          new MutationObserver((_, ob) => { if (!el.contains(box)) { off(); ob.disconnect(); emit(); } }).observe(el, { childList: true });
          setMode(mode);
        });
        emit();
      }
    };
    new MutationObserver(emit).observe(wrap, { attributes: true, attributeFilter: ["hidden"] });
    return M;
  })();
  window.XBGame.music = Music;
  wrap.addEventListener("click", (e) => { if (e.target === wrap) closeSheet(); });
  addEventListener("keydown", (e) => { if (e.key === "Escape") { if (!wrap.hidden) closeSheet(); } });

  function bar(v, max, cls = "") { return `<div class="xb-bar ${cls}"><i data-w="${Math.min(100, (v / max) * 100)}"></i></div>`; }
  const growBars = (el) => requestAnimationFrame(() => requestAnimationFrame(() => el.querySelectorAll(".xb-bar i").forEach((i) => (i.style.width = i.dataset.w + "%"))));

  function openWallet() {
    const w = S.wallet, unused = S.coupons.filter((c) => !c.used), used = S.coupons.filter((c) => c.used);
    sheet(`<h2>雪宝的存钱罐</h2><p class="sub">雪宝每次旅行都会带一点钱回来，攒着找泽兑换。</p>
      <div class="xb-big"><img src="${A}prop-piggy.webp?v=2" alt=""><div><small>现在存着</small><b>${money(w.balance)}</b><small>一共带回 ${money(w.earned || 0)}</small></div></div>
      <div class="xb-sec"><h3>奶茶券 · ${unused.length} 张能用</h3><p class="sub" style="margin:0 0 8px">${teaLine()}</p>
        ${S.coupons.length ? `<div class="xb-coupons">${[...unused, ...used].slice(0, 12).map((c) => `<div class="xb-coupon ${c.used ? "used" : ""}"><img src="${A}ic-tea.webp" alt="">${esc(c.title)}<br><small>${md(c.at)}</small></div>`).join("")}</div>` : `<p class="sub">还没有。</p>`}
      </div>
      <div class="xb-sec"><h3>账本</h3><ul class="xb-list">${w.ledger.length ? w.ledger.slice(0, 15).map((l) => `<li><span>${md(l.at)} ${esc(l.note)}</span><span class="${l.delta >= 0 ? "plus" : "minus"}">${l.delta ? (l.delta > 0 ? "+" : "−") + money(Math.abs(l.delta)).slice(1) : "✓"}</span></li>`).join("") : "<li><span>还没有记录</span></li>"}</ul></div>
      <p class="xb-row" style="justify-content:space-between;margin-top:16px"><button class="xb-link" id="adminLink">记账（泽用）</button><button class="xb-link" id="whoLink">我是${who() === "雪" ? "雪雪" : esc(who() || "？")} · 切换</button></p>`, (el) => {
      growBars(el);
      el.querySelector("#adminLink").addEventListener("click", () => openAdmin());
      el.querySelector("#whoLink").addEventListener("click", () => askWho());
    });
  }

  function openShards() {
    const f = S.frag;
    sheet(`<h2>皮肤碎片罐</h2><p class="sub">雪宝在路上捡到的亮晶晶的碎片，集齐 ${f.target} 个就能找泽兑换一个 168 的王者荣耀皮肤。</p>
      <div class="xb-jarbig"><img src="${A}prop-jar.webp?v=2" alt=""><span class="level" id="lvl"></span><span class="num">${f.given}</span></div>
      <div class="xb-meta"><span>${f.given} / ${f.target}</span><span>还差 ${f.target - f.given} 个</span></div>${bar(f.given, f.target, "shard")}
      ${f.pendingSkins ? `<p class="xb-reward special" style="margin-top:12px">已经集齐 ${f.pendingSkins} 个皮肤，等泽兑现！</p>` : ""}
      <p class="sub" style="margin-top:12px">碎片是随机掉的，有时候一个都没有，有时候一下掉一大把。一般一到两个月能集齐一个。${f.redeemed ? `已经兑现过 ${f.redeemed} 个皮肤。` : ""}</p>`, (el) => {
      growBars(el); requestAnimationFrame(() => (el.querySelector("#lvl").style.height = Math.min(78, (f.given / f.target) * 78) + "%"));
    });
  }

  function openCalendar() {
    const t = now();
    const ny = (x) => new Date(x).toLocaleString("zh-CN", { timeZone: "America/New_York", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
    const hz = (x) => new Date(x).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour: "2-digit", minute: "2-digit", hour12: false });
    const line = S.phase === "away" ? `雪宝在路上，<b>${dur(S.nextAt - t)}</b>后回来` : S.phase === "home" ? `雪宝在家，<b>${dur(S.leaveAt - t)}</b>后出门` : S.phase === "back" ? `雪宝回来啦，门口有 <b>${S.ready}</b> 份礼物` : `门口已经攒了 <b>3</b> 份礼物，雪宝在等你`;
    sheet(`<h2>旅行日历</h2><p class="sub">${line}</p>
      <ul class="xb-list">
        ${S.nextAt ? `<li><span>下一份礼物</span><span>纽约 ${ny(S.nextAt)} · 杭州 ${hz(S.nextAt)}</span></li>` : `<li><span>下一份礼物</span><span>先把门口的领了，雪宝才会再出门</span></li>`}
        <li><span>每趟旅行</span><span>${S.tripHours} 小时</span></li>
        <li><span>门口最多攒</span><span>${S.max} 份（睡多久都不会丢）</span></li>
        <li><span>奶茶券</span><span>${teaLine()}</span></li>
        <li><span>去过的地方</span><span>${Object.keys(S.collection).length} / ${D.DESTS.length}</span></li>
        <li><span>遇见的旅伴</span><span>${Object.keys(S.meets).length} / ${D.CHARS.length}</span></li>
      </ul>`);
  }

  function openNote() {
    sheet(`<h2>雪宝留的纸条</h2><div class="xb-face back" style="position:relative;transform:none;display:block;border-radius:10px;padding:18px 20px">
      <p class="story" style="margin:0">雪雪：<br>我出门啦！这次去哪里先保密，${S.nextAt ? hm(S.nextAt) : "过一会儿"}左右回来。<br>热可可在桌上，记得喝。<span class="sign">—— 雪宝</span></p></div>`);
  }

  // 信箱：和星星邮差共用信件
  let letters = null;
  async function loadLetters() {
    try {
      const r = await fetch("/api/star-letters", { cache: "no-store" }); const j = await r.json();
      letters = (j.letters || []).filter((l) => l.to === "雪");
    } catch { letters = []; }
    const seen = store.get("lettersSeen", "");
    const fresh = letters.filter((l) => !l.locked && l.date > seen).length;
  }
  function openMailbox() {
    const open = (letters || []).filter((l) => !l.locked), locked = (letters || []).filter((l) => l.locked);
    const seen = store.get("lettersSeen", ""), fresh = open.filter((l) => l.date > seen).length;
    sheet(`<h2>小信箱</h2><p class="sub">${fresh ? `有 <b>${fresh}</b> 封新信！` : open.length ? `一共收到 ${open.length} 封信。` : "信箱里还空着。"}${locked.length ? `还有 ${locked.length} 封在路上。` : ""}</p>
      <div class="xb-big"><img src="${A}prop-mailbox.webp?v=2" alt=""><div class="xb-row" style="flex-direction:column;align-items:flex-start">
        <a class="xb-btn" href="star-post.html#mailbox" id="readLetters">打开信箱看信</a>
        <a class="xb-btn ghost" href="star-post.html#write">写一封信</a></div></div>
      ${open.length ? `<ul class="xb-list">${open.slice(-5).reverse().map((l) => `<li><span>${esc(l.title)}</span><span>${esc(l.date)}</span></li>`).join("")}</ul>` : ""}`, (el) => {
      el.querySelector("#readLetters").addEventListener("click", () => { const last = open.map((l) => l.date).sort().pop(); if (last) store.set("lettersSeen", last); });
    });
  }

  // ---------- 图鉴 ----------
  const PAL = [["#f6d9c9", "#cfe1f2", "#f9efe0"], ["#d9ead3", "#f5dfb8", "#eef4e4"], ["#dde3f6", "#f2cfd6", "#f5f0fa"], ["#f9e2b8", "#cfe6e0", "#fff3dc"], ["#e6d6f0", "#cde4f6", "#f6eefb"]];
  const palFor = (id) => PAL[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % PAL.length];
  function fallbackBg(id) { const p = palFor(id); return `radial-gradient(circle at 30% 30%, ${p[0]}, transparent 60%), linear-gradient(160deg, ${p[2]}, ${p[1]})`; }
  const pcSrc = (id) => (ART.pc[id] ? `${A}pc-${id}.webp` : "");
  const svSrc = (id) => (ART.sv[id] ? `${A}sv-${id}.webp` : `${A}ic-gift.webp`);
  const chSrc = (id) => (ART.ch[id] ? `${A}ch-${id}.webp` : "");

  function openAlbum(tab = "pc") {
    const got = S.collection || {}, met = S.meets || {};
    const nPc = Object.keys(got).length, nCh = Object.keys(met).length;
    const tiers = { 1: "普通", 2: "少见", 3: "稀有" };
    const pcs = D.DESTS.map((d) => got[d.id]
      ? `<button class="xb-cell" data-pc="${d.id}"><span class="xb-tier t${d.tier}">${tiers[d.tier]}</span><div class="thumb" style="background-image:${pcSrc(d.id) ? `url(${pcSrc(d.id)})` : fallbackBg(d.id)}"></div><p>${esc(d.place)}</p></button>`
      : `<div class="xb-cell locked"><span class="xb-tier t${d.tier}">${tiers[d.tier]}</span><div class="thumb"><span class="q">?</span></div><p>还没去过</p></div>`).join("");
    const svs = D.DESTS.map((d) => got[d.id]
      ? `<button class="xb-cell" data-pc="${d.id}"><div class="thumb sq" style="background-image:url(${svSrc(d.id)})"></div><p>${esc(d.gift)}</p></button>`
      : `<div class="xb-cell locked"><div class="thumb sq"><span class="q">?</span></div><p>？？？</p></div>`).join("");
    const chs = D.CHARS.map((c) => met[c.id]
      ? `<div class="xb-cell"><div class="thumb sq" style="background-image:${chSrc(c.id) ? `url(${chSrc(c.id)})` : "none"}">${chSrc(c.id) ? "" : `<span class="q" style="color:var(--navy)">${esc(c.name[0])}</span>`}</div><p>${esc(c.name)}<br><span class="xb-count">遇见 ${met[c.id]} 次</span></p></div>`
      : `<div class="xb-cell locked"><div class="thumb sq"><span class="q">?</span></div><p>还没遇见</p></div>`).join("");
    sheet(`<h2>旅行图鉴</h2><p class="sub">去过 ${nPc} / ${D.DESTS.length} 个地方 · 遇见 ${nCh} / ${D.CHARS.length} 位旅伴</p>
      <div class="xb-tabs"><button data-t="pc">明信片</button><button data-t="sv">纪念品</button><button data-t="ch">旅伴</button></div>
      <div class="xb-grid" data-g="pc">${pcs}</div><div class="xb-grid" data-g="sv">${svs}</div><div class="xb-grid" data-g="ch">${chs}</div>`, (el) => {
      const show = (t) => { el.querySelectorAll("[data-t]").forEach((b) => b.classList.toggle("on", b.dataset.t === t)); el.querySelectorAll("[data-g]").forEach((g) => (g.hidden = g.dataset.g !== t)); };
      el.querySelectorAll("[data-t]").forEach((b) => b.addEventListener("click", () => show(b.dataset.t)));
      el.querySelectorAll("[data-pc]").forEach((b) => b.addEventListener("click", () => {
        const g = S.history.find((h) => h.dest === b.dataset.pc) || { dest: b.dataset.pc, at: got[b.dataset.pc] };
        openPostcard(g, () => openAlbum(tab));
      }));
      show(tab);
    });
  }

  // ---------- 地点图鉴（地球仪） ----------
  // 足迹地图 + 按大区分的地点卡；每个地点一页：明信片、地点小记、雪宝的旅记、纪念品、旅伴、去过几次
  const PL = () => window.XUEBAO_PLACES || { REGIONS: [], PLACES: {} };
  const visitsOf = (id) => (S.history || []).filter((h) => h.dest === id);
  // 真实中国地图（xuebao-china.js，Albers 投影）：经纬度 → 地图上的百分比位置
  function mapXY(p) {
    const M = window.XUEBAO_CHINA, q = M.proj, r = Math.PI / 180, n = (Math.sin(q.p1 * r) + Math.sin(q.p2 * r)) / 2, C = Math.cos(q.p1 * r) ** 2 + 2 * n * Math.sin(q.p1 * r);
    const rho0 = Math.sqrt(C - 2 * n * Math.sin(q.lat0 * r)) / n, th = n * (p.lon - q.lon0) * r, rho = Math.sqrt(C - 2 * n * Math.sin(p.lat * r)) / n;
    const x = (rho * Math.sin(th) - q.minx) * q.s + q.pad, y = (q.maxy - (rho0 - rho * Math.cos(th))) * q.s + q.pad;
    return [(x / M.W) * 100, (y / M.H) * 100];
  }
  let chinaLoading = null;
  const loadChina = () => window.XUEBAO_CHINA ? Promise.resolve() : (chinaLoading ||= new Promise((ok, no) => { const sc = document.createElement("script"); sc.src = "xuebao-china.js?v=20261123a"; sc.onload = ok; sc.onerror = no; document.head.append(sc); }));
  function openAtlas(region = "") {
    if (!window.XUEBAO_CHINA) { loadChina().then(() => openAtlas(region), () => say("地图没加载出来，过一会儿再试试。")); return; }
    const { REGIONS, PLACES } = PL(), got = S.collection || {}, tiers = { 1: "普通", 2: "少见", 3: "稀有" }, M = window.XUEBAO_CHINA;
    const nGot = D.DESTS.filter((d) => got[d.id]).length;
    const shown = D.DESTS.filter((d) => PLACES[d.id] && (!region || PLACES[d.id].region === region));
    // 去过的省份点亮
    const litProv = new Set(D.DESTS.filter((d) => got[d.id]).map((d) => M.where[d.id]));
    const svg = `<svg viewBox="0 0 ${M.W} ${M.H}" aria-hidden="true">${M.prov.map((p) => `<path class="${litProv.has(p.n) ? "lit" : ""}" d="${p.d}"/>`).join("")}
      <g class="inset"><rect x="${M.inset.x}" y="${M.inset.y}" width="${M.inset.w}" height="${M.inset.h}" rx="4"/><path d="${M.inset.land}"/><path class="jd" d="${M.inset.jd}"/><text x="${M.inset.x + M.inset.w - 6}" y="${M.inset.y + M.inset.h - 6}" text-anchor="end">南海诸岛</text></g></svg>`;
    const pins = shown.map((d) => { const [x, y] = mapXY(PLACES[d.id]); return `<button class="pin ${got[d.id] ? "on" : ""} t${d.tier}" style="left:${x}%;top:${y}%" data-place="${d.id}" aria-label="${esc(d.place)}"><i></i>${got[d.id] ? `<span>${esc(d.place.split("·")[0])}</span>` : ""}</button>`; }).join("");
    // 选了大区就把地图放大到那一片
    let zoom = "";
    if (region && shown.length) {
      const xy = shown.map((d) => mapXY(PLACES[d.id])), xs = xy.map((p) => p[0]), ys = xy.map((p) => p[1]);
      const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      const k = Math.max(1, Math.min(3.2, 80 / Math.max(x1 - x0, 1), 80 / Math.max(y1 - y0, 1))), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      zoom = `--k:${k.toFixed(2)};transform:translate(${(50 - cx * k).toFixed(2)}%,${(50 - cy * k).toFixed(2)}%) scale(${k.toFixed(2)})`;
    }
    const groups = REGIONS.filter((r) => !region || r === region).map((r) => {
      const ds = D.DESTS.filter((d) => PLACES[d.id]?.region === r); if (!ds.length) return "";
      const n = ds.filter((d) => got[d.id]).length;
      return `<h3 class="xb-region">${r}<small>${n} / ${ds.length}</small></h3><div class="xb-grid">${ds.map((d) => got[d.id]
        ? `<button class="xb-cell" data-place="${d.id}"><span class="xb-tier t${d.tier}">${tiers[d.tier]}</span><div class="thumb" style="background-image:${pcSrc(d.id) ? `url(${pcSrc(d.id)})` : fallbackBg(d.id)}"></div><p>${esc(d.place)}<br><span class="xb-count">去过 ${Math.max(1, visitsOf(d.id).length)} 次</span></p></button>`
        : `<button class="xb-cell locked" data-place="${d.id}"><span class="xb-tier t${d.tier}">${tiers[d.tier]}</span><div class="thumb"><span class="q">?</span></div><p>${esc(d.place.split("·")[0])}·？？<br><span class="xb-count">还没去过</span></p></button>`).join("")}</div>`;
    }).join("");
    sheet(`<h2>雪宝的足迹地图</h2><p class="sub">去过 ${nGot} / ${D.DESTS.length} 个地方 · 点亮的点都可以点开看</p>
      <div class="xb-atlas" style="aspect-ratio:${M.W} / ${M.H}"><div class="map${region ? " zoomed" : ""}" style="${zoom}">${svg}${pins}</div><span class="compass">N</span></div>
      <div class="xb-tabs xb-regions"><button data-r="" class="${region ? "" : "on"}">全部</button>${REGIONS.map((r) => `<button data-r="${r}" class="${r === region ? "on" : ""}">${r}</button>`).join("")}</div>
      ${groups}`, (el) => {
      el.querySelectorAll("[data-place]").forEach((b) => b.addEventListener("click", () => openPlace(b.dataset.place, () => openAtlas(region))));
      el.querySelectorAll("[data-r]").forEach((b) => b.addEventListener("click", () => openAtlas(b.dataset.r)));
    });
    sheetEl.style.width = "min(680px, 100%)";
  }
  function openPlace(id, back) {
    const d = DEST[id], p = PL().PLACES[id] || {}, got = (S.collection || {})[id], tiers = { 1: "普通", 2: "少见", 3: "稀有" };
    const vs = visitsOf(id), metIds = [...new Set(vs.map((v) => v.meet).filter(Boolean))];
    const about = esc(p.about || "");
    if (!got) {
      const half = about.split(/[，。]/)[0];
      sheet(`<h2>${esc(d.place.split("·")[0])} · ？？</h2><p class="sub">${esc(p.region || "")} · ${tiers[d.tier]}</p>
        <div class="xb-place locked"><div class="hero"><span class="q">?</span></div>
        <p class="about"><b>听说</b>${half}……</p><p class="sub">雪宝还没去过这里。等她哪天出门，说不定就寄回这里的明信片了。</p></div>
        ${back ? `<p class="xb-row"><button class="xb-btn ghost" id="backAtlas">回到地图</button></p>` : ""}`, (el) => el.querySelector("#backAtlas")?.addEventListener("click", back));
      return;
    }
    const first = vs.length ? Math.min(...vs.map((v) => v.at || got)) : got, lastV = vs.length ? Math.max(...vs.map((v) => v.at || got)) : got;
    const chars = metIds.map((c) => CHAR[c]).filter(Boolean);
    sheet(`<h2>${esc(d.place)}</h2><p class="sub">${esc(p.region || "")} · ${tiers[d.tier]} · 去过 ${Math.max(1, vs.length)} 次</p>
      <div class="xb-place"><button class="hero" id="pcOpen" style="background-image:${pcSrc(id) ? `url(${pcSrc(id)})` : fallbackBg(id)}" aria-label="看明信片"><span>点开明信片</span></button>
      <h3>地点小记</h3><p class="about">${about}</p>
      <h3>雪宝的旅记</h3><p class="story">${esc(d.story)}</p>
      <div class="facts"><div><img src="${svSrc(id)}" alt=""><span><small>带回来的纪念品</small>${esc(d.gift)}<br><small>${esc(d.giftNote)}</small></span></div>
      ${chars.length ? chars.map((c) => `<div>${chSrc(c.id) ? `<img src="${chSrc(c.id)}" alt="">` : ""}<span><small>在这里遇见</small>${esc(c.name)}</span></div>`).join("") : d.meet && CHAR[d.meet] ? `<div><span class="q">?</span><span><small>听说在这里能遇见</small>一位旅伴</span></div>` : ""}
      <div><span class="q">🗓</span><span><small>第一次来</small>${md(first)}${vs.length > 1 ? `<br><small>最近一次</small>${md(lastV)}` : ""}</span></div></div></div>
      ${back ? `<p class="xb-row"><button class="xb-btn ghost" id="backAtlas">回到地图</button></p>` : ""}`, (el) => {
      el.querySelector("#backAtlas")?.addEventListener("click", back);
      el.querySelector("#pcOpen").addEventListener("click", () => { const g = vs[vs.length - 1] || { dest: id, at: got }; openPostcard(g, () => openPlace(id, back)); });
    });
    sheetEl.style.width = "min(640px, 100%)";
  }

  function cardHTML(g) {
    const d = DEST[g.dest], c = g.meet && CHAR[g.meet];
    const front = pcSrc(d.id) ? `<img src="${pcSrc(d.id)}" alt="${esc(d.place)}的明信片">`
      : `<div class="xb-pc-fallback"><div class="art" style="--c1:${palFor(d.id)[0]};--c2:${palFor(d.id)[1]};--c3:${palFor(d.id)[2]}"><span class="name">${esc(d.place)}</span><span class="hint">手绘明信片还在路上，先寄一张速写</span><span class="stampbox"></span><img class="me" src="${A}xb-wave.webp" alt=""></div></div>`;
    return `<div class="xb-card-wrap"><div class="xb-card" tabindex="0"><div class="xb-card-in">
      <div class="xb-face front">${front}</div>
      <div class="xb-face back"><div class="story">${esc(d.story)}${c ? `<span class="meet">${esc(c.line.replace("{place}", d.place.split("·").pop()))}</span>` : ""}${g.special ? `<span class="meet">附：${esc(g.special.title)}——${esc(g.special.text)}</span>` : ""}<span class="sign">—— 雪宝 · ${md(g.at || Date.now())}</span></div>
        <div class="side"><span class="stamp" style="background-image:url(${svSrc(d.id)})"></span><span class="place">${esc(d.place)}</span><span>带回：${esc(d.gift)}</span><span class="xb-count">${esc(d.giftNote)}</span>${c && chSrc(c.id) ? `<img class="meetimg" src="${chSrc(c.id)}" alt="${esc(c.name)}">` : ""}</div></div>
    </div></div></div>`;
  }
  function bindCard(el) {
    const card = el.querySelector(".xb-card");
    const flip = () => { card.classList.toggle("flipped"); Sound.paper(); };
    card.addEventListener("click", flip);
    card.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); flip(); } });
    return card;
  }
  function openPostcard(g, back) {
    sheet(`<h2>${esc(DEST[g.dest].place)}</h2><p class="sub">点明信片可以翻面</p>${cardHTML(g)}${back ? `<p class="xb-row"><button class="xb-btn ghost" id="backAlbum">回到图鉴</button></p>` : ""}`, (el) => {
      bindCard(el); el.querySelector("#backAlbum")?.addEventListener("click", back);
    });
    sheetEl.style.width = "min(640px, 100%)";
  }

  // ---------- 记账（泽用） ----------
  function openAdmin() {
    const pw = sessionStorage.getItem("xuebao:pw");
    if (!pw) {
      sheet(`<h2>记账</h2><p class="sub">只有泽知道口令。用来扣减兑换掉的钱、核销奶茶券、兑现皮肤，或者给雪宝塞一份特别的礼物。</p>
        <div class="xb-row"><input class="xb-input" id="pw" type="password" placeholder="口令" autocomplete="off"><button class="xb-btn" id="pwGo">进入</button></div><p class="xb-err" id="err"></p>`, (el) => {
        const go = async () => {
          const v = el.querySelector("#pw").value;
          try { await api({ action: "admin", op: "check", password: v }); sessionStorage.setItem("xuebao:pw", v); openAdmin(); }
          catch (e) { el.querySelector("#err").textContent = e.message; }
        };
        el.querySelector("#pwGo").addEventListener("click", go);
        el.querySelector("#pw").addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
        el.querySelector("#pw").focus();
      });
      return;
    }
    const unused = S.coupons.filter((c) => !c.used);
    sheet(`<h2>记账</h2><p class="sub">余额 ${money(S.wallet.balance)} · 碎片 ${S.frag.given}/${S.frag.target} · 待兑现皮肤 ${S.frag.pendingSkins} · 待投递 ${S.queued || 0} 份</p>
      <div class="xb-sec"><h3>扣减余额（兑换掉的钱）</h3><div class="xb-row"><input class="xb-input" id="amt" type="number" min="0" step="0.01" placeholder="金额" style="max-width:110px"><input class="xb-input" id="amtNote" placeholder="备注，例如：兑换了一顿火锅"><button class="xb-btn" id="doDeduct">扣减</button></div></div>
      <div class="xb-sec"><h3>奶茶券</h3>${unused.length ? `<ul class="xb-list">${unused.map((c) => `<li><span>${esc(c.title)} · ${md(c.at)}</span><button class="xb-link" data-use="${c.id}">已兑现</button></li>`).join("")}</ul>` : `<p class="sub">没有待兑现的券。</p>`}</div>
      <div class="xb-sec"><h3>皮肤</h3>${S.frag.pendingSkins ? `<button class="xb-btn" id="doSkin">兑现一个皮肤</button>` : `<p class="sub">还没有集齐的皮肤。</p>`}</div>
      <div class="xb-sec"><h3>定向投递：下一次回家一定带回</h3><input class="xb-input" id="qTitle" placeholder="标题，例如：生日快乐" style="width:100%"><textarea class="xb-input" id="qText" placeholder="想让雪宝带给她的话" style="margin-top:6px"></textarea><div class="xb-row"><button class="xb-btn" id="doQueue">放进背包</button></div></div>
      <p class="xb-err" id="err"></p><p class="xb-row"><button class="xb-link" id="logout">退出记账</button></p>`, (el) => {
      const run = async (body) => {
        try { S = await api({ action: "admin", password: pw, ...body }); render(); openAdmin(); }
        catch (e) { if (e.data && /口令/.test(e.message)) sessionStorage.removeItem("xuebao:pw"); el.querySelector("#err").textContent = e.message; }
      };
      el.querySelector("#doDeduct").addEventListener("click", () => run({ op: "deduct", amount: el.querySelector("#amt").value, note: el.querySelector("#amtNote").value }));
      el.querySelectorAll("[data-use]").forEach((b) => b.addEventListener("click", () => run({ op: "useCoupon", id: b.dataset.use })));
      el.querySelector("#doSkin")?.addEventListener("click", () => run({ op: "redeemSkin" }));
      el.querySelector("#doQueue").addEventListener("click", () => run({ op: "queue", title: el.querySelector("#qTitle").value, text: el.querySelector("#qText").value }));
      el.querySelector("#logout").addEventListener("click", () => { sessionStorage.removeItem("xuebao:pw"); closeSheet(); });
    });
  }

  // ---------- 打开背包 ----------
  const layer = $("openLayer");
  let opening = false;
  async function openPack() {
    if (!S || opening || !(S.phase === "back" || S.phase === "waiting")) return;
    const w = who();
    if (!w) { askWho(openPack); return; }
    if (w === "泽") { say("这是给雪雪的礼物，要等她来拆哦。", me, 2800); return; }
    opening = true;
    layer.hidden = false;
    layer.innerHTML = `<div class="xb-rays"></div><div class="xb-openpack" id="op"><img src="${A}ic-gift.webp" alt="礼物"></div>
      <h2>雪宝带回了 ${S.ready} 份礼物</h2><p class="tip">点一下礼物，拆开看看</p>`;
    Sound.boop();
    layer.querySelector("#op").addEventListener("click", async () => {
      const opImg = layer.querySelector("#op img");
      layer.querySelector("#op").classList.add("pop"); Sound.open();
      layer.querySelector(".tip").textContent = "正在拿出来……";
      let res;
      try { res = await api({ action: "claim" }); }
      catch (e) { layer.querySelector(".tip").textContent = e.message; S = e.data?.phase ? e.data : S; setTimeout(closeLayer, 1800); return; }
      await sleep(500);
      S = res; showGift(res.gifts, 0);
    }, { once: true });
  }
  function closeLayer() { layer.hidden = true; layer.innerHTML = ""; opening = false; render(); }

  function showGift(gifts, i) {
    const g = gifts[i], d = DEST[g.dest], c = g.meet && CHAR[g.meet];
    layer.innerHTML = `<div class="xb-rays"></div>
      <h2>${g.first ? "雪宝的第一次旅行：" : ""}${esc(d.place)}</h2><p class="tip">点明信片可以翻面 · ${i + 1} / ${gifts.length}</p>
      ${cardHTML(g)}<div class="xb-rewards" id="rw"></div>
      <div class="xb-open-actions"><button class="xb-btn" id="nextG">${i + 1 < gifts.length ? "下一份" : "收下啦"}</button></div>`;
    const card = bindCard(layer);
    setTimeout(() => { if (!card.classList.contains("flipped")) { card.classList.add("flipped"); Sound.paper(); } }, 2600);
    const rw = layer.querySelector("#rw");
    const chips = [];
    if (g.money > 0) chips.push(["coin", `<img src="${A}ic-coins.webp" alt=""><span data-count="${g.money}">¥0</span>`]);
    if (g.frag > 0) chips.push(["sparkle", `<img src="${A}ic-shard.webp" alt="">皮肤碎片 +${g.frag}`]);
    if (g.coupon) chips.push(["sparkle", `<img src="${A}ic-tea.webp" alt="">奶茶券 ×1`, true]);
    if (g.newStamp) chips.push(["pop", `<img src="${A}prop-map.webp?v=2" alt="">新地点 · 收进图鉴`]);
    chips.push(["pop", `<img src="${svSrc(d.id)}" alt="">${esc(d.gift)}`]);
    if (c) chips.push(["sparkle", `${chSrc(c.id) ? `<img src="${chSrc(c.id)}" alt="">` : ""}偶遇旅伴 · ${esc(c.name)}`, true]);
    if (g.special) chips.push(["fanfare", `<img src="${A}ic-gift.webp" alt="">特别的礼物：${esc(g.special.title)}`, true]);
    chips.forEach(([snd, html, sp], k) => setTimeout(() => {
      const e = document.createElement("span"); e.className = "xb-reward" + (sp ? " special" : ""); e.innerHTML = html; rw.append(e); Sound[snd]?.();
      const n = e.querySelector("[data-count]"); if (n) countUp(n, Number(n.dataset.count));
    }, 700 + k * 420));
    layer.querySelector("#nextG").addEventListener("click", () => { if (i + 1 < gifts.length) showGift(gifts, i + 1); else summary(gifts); });
  }
  function countUp(el, to) {
    const t0 = performance.now(), d = 900;
    const f = (t) => { const p = Math.min(1, (t - t0) / d); el.textContent = "+" + money(to * (1 - Math.pow(1 - p, 3))).replace("¥", "¥"); if (p < 1) requestAnimationFrame(f); else el.textContent = "+" + money(to); };
    requestAnimationFrame(f);
  }
  function summary(gifts) {
    const total = gifts.reduce((a, g) => a + g.money, 0), frag = gifts.reduce((a, g) => a + g.frag, 0);
    skin = gifts.some((g) => g.skinDone), tea = gifts.filter((g) => g.coupon).length;
    layer.innerHTML = `<div class="xb-rays"></div>
      <h2>都收好啦</h2>
      <div class="xb-summary">
        <h3>这次带回</h3>
        <ul class="xb-list">
          <li><span>钱</span><span class="plus">+${money(total)}</span></li>
          <li><span>皮肤碎片</span>${frag ? `<span class="plus">+${frag}</span>` : `<span>这次没捡到</span>`}</li>
          ${tea ? `<li><span>奶茶券</span><span class="plus">+${tea}</span></li>` : ""}
          <li><span>明信片</span><span>${gifts.length} 张</span></li>
        </ul>
        <div class="xb-meta" style="margin-top:10px"><span>存钱罐里现在有</span><span>${money(S.wallet.balance)}</span></div>
        <div class="xb-meta" style="margin-top:8px"><span>碎片 ${S.frag.given} / ${S.frag.target}</span><span>${skin ? "集齐一个皮肤！" : `还差 ${S.frag.target - S.frag.given} 个`}</span></div>${bar(S.frag.given, S.frag.target, "shard")}
        ${skin ? `<p class="xb-reward special" style="margin-top:10px">集齐 99 个碎片！可以找泽兑换皮肤啦</p>` : ""}
      </div>
      <div class="xb-open-actions"><button class="xb-btn" id="done">回到小屋</button></div>`;
    growBars(layer);
    if (skin) { Sound.fanfare(); confetti(60); } else Sound.sparkle();
    layer.querySelector("#done").addEventListener("click", () => {
      closeLayer(); Sound.boop();
      stage.dataset.phase = "home"; pos = store.get("spot", SPOT.rug); setPose("jump"); placeMe(false); centerOn(pos.x, true);
      setTimeout(() => { say("喜欢吗？我歇一会儿再出发！", me, 3200); const p = stagePoint(me, 0.2); burst("heart", p.x, p.y, 8); }, 900);
      clearTimeout(routineT); routineT = setTimeout(routine, 5000);
      $("moneyChip").classList.remove("bump"); void $("moneyChip").offsetWidth; $("moneyChip").classList.add("bump");
    });
  }
  function confetti(n) {
    for (let i = 0; i < n; i++) {
      const e = document.createElement("span"); e.className = "confetti";
      e.textContent = pick(["♥", "✦", "❀", "♥", "★"]); e.style.color = pick(["#e0635a", "#f2b84b", "#9a7cf0", "#f49ab0", "#7fb2e5"]);
      e.style.left = rand(0, 100) + "vw"; e.style.fontSize = rand(12, 26) + "px";
      e.style.setProperty("--dx", rand(-80, 80) + "px"); e.style.setProperty("--r", rand(-720, 720) + "deg");
      e.style.animationDuration = rand(2.4, 4.6) + "s"; e.style.animationDelay = rand(0, 1.2) + "s";
      document.body.append(e); setTimeout(() => e.remove(), 6500);
    }
  }

  // ---------- 启动 ----------
  sky(); setInterval(sky, 60000);
  pos = store.get("spot", SPOT.rug);
  layout();
  refresh(false).then(() => {
    layout();
    centerOn(S.phase === "back" || S.phase === "waiting" ? 82 : pos.x, false);
    // 只有 2D 平面小屋（没有 3D）才需要“左右滑一滑”的提示
    if (stage.offsetWidth > viewport.clientWidth + 40 && !store.get("swipeHint", false)) {
      setTimeout(() => { if (stage.classList.contains("hall") || document.querySelector(".hall-canvas")) return; store.set("swipeHint", true); say("← 左右滑一滑，小屋里还有好多东西可以点 →", me, 4200); }, 600);
    }
    if (!S.offline && !who()) setTimeout(() => askWho(), 900);
    else if (S.phase === "back" || S.phase === "waiting") setTimeout(() => say(pick(D.LINES.back), me, 3200), 900);
  });
  loadLetters();
  setInterval(() => { if (!document.hidden) refresh(true); }, 5 * 60000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(true); });
})();
