/* 雪宝游记 · 花园大厅（正式页 xuebao.html 用）
 * 玩法仍由 xuebao.js 的 DOM 负责：道具按钮、雪宝按钮都还在，只是看不见；这里每帧把它们挪到 3D 物件在屏幕上的位置，
 * 所以点 3D 里的东西就是点原来的按钮，气泡、粒子、徽标也都跟着对上。
 * 雪宝的位置（pos，舞台百分比）在变化时换算成地板上的点；姿势图、跳、挤压、抱抱、拖动从 DOM 的 class 读。
 * 天气读 stage.dataset.weather，开灯读 .lamp-on，时间按纽约。WebGL 不可用时什么都不做，页面保持平面版。
 */
import { createHall } from "./hall-scene.js";
import { openGiftBox, preloadGiftBox } from "./gift-open.js";

const stage = document.getElementById("stage");
const me = document.getElementById("xuebao"), meImg = document.getElementById("xbImg");
const ok = (() => { try { const c = document.createElement("canvas"); return !!c.getContext("webgl2"); } catch { return false; } })();
if (stage && me && ok) start();
else document.getElementById("worldLoad")?.remove();

function start() {
  // 加载页：真实进度 + 轮换的小提示；3D 准备好再淡出（至少停留一小会儿，避免一闪而过）
  const wl = document.getElementById("worldLoad"), wlBar = document.getElementById("worldLoadBar"), wlTip = document.getElementById("worldLoadTip"), wlT0 = performance.now();
  const TIPS = ["雪宝在给你开门…", "喷泉在冒泡泡…", "灯笼一盏一盏亮起来…", "团子们在排队欢迎你…", "奶茶在加珍珠…", "星星邮差在整理信件…"];
  let tipK = 0; const tipTimer = setInterval(() => { if (!wlTip) return; wlTip.style.opacity = 0; setTimeout(() => { tipK = (tipK + 1) % TIPS.length; wlTip.textContent = TIPS[tipK]; wlTip.style.opacity = 1; }, 350); }, 2200);
  const setProg = (f) => { if (wlBar) wlBar.style.width = Math.max(6, Math.min(100, f * 100)).toFixed(0) + "%"; };
  const hall = createHall(stage, { onLoad: ready, onProgress: (f) => setProg(f * 0.96) });
  const { THREE, camera, char, view } = hall;
  const canvas = hall.renderer.domElement; canvas.className = "xb-canvas hall-canvas"; canvas.setAttribute("aria-hidden", "true");
  let live = false;
  window.XBHall = { view, char, hall }; // 调试用：控制台里能直接转镜头、看场景
  // 拆礼物演出（移植的盲盒）：拆的时候小屋暂停渲染，手机不发烫
  window.XBGiftBox = { open: openGiftBox, preload: preloadGiftBox, busy: false };
  function ready() {
    if (live) return; live = true;
    setProg(1); clearInterval(tipTimer);
    setTimeout(() => { wl?.classList.add("done"); setTimeout(() => wl?.remove(), 1000); }, Math.max(350, 1200 - (performance.now() - wlT0)));
    document.body.classList.add("hall"); stage.classList.add("hall");
    dispatchEvent(new Event("resize"));
    lastKey = ""; // 用新镜头重新换算一次雪宝的位置
  }
  setTimeout(ready, 15000); // 有素材加载失败也别一直卡在平面版

  // ---------- 小道具（立体模型或道具图） ----------
  const { W, D } = hall.ROOM, CONSOLE_X = -W / 2 + 0.31, A = "xuebao-assets/";
  const SPR = {
    piggy: ["prop-piggy.webp?v=2", 0.2, [CONSOLE_X + 0.02, 0.95, -2.66]],
    jar: ["prop-jar.webp?v=2", 0.17, [-0.206, 0.305, -2.30]],
    globe: ["prop-globe.webp?v=2", 0.42, [-W / 2 + 0.5, 0, -0.95]],
    radio: ["prop-radio.webp?v=2", 0.16, [0.16, 0.305, -2.013]],
    cardbox: ["prop-cardbox.webp?v=2", 0.2, [-1.4, 0.43, -2.4]],
    mailbox: ["prop-mailbox.webp?v=2", 0.58, [1.3, 0, -3.85]],
    note: ["ic-note.webp", 0.12, [-0.19, 0.305, -1.978]]
  };
  Object.entries(SPR).forEach(([id, [f, h, at]]) => hall.addSprite(id, A + f, h, at));
  // 页面按钮 → 3D 物件
  const LINK = [
    ["[data-prop=frame]", "anchor", "frameL"], ["[data-prop=calendar]", "anchor", "clock"],
    ["[data-prop=lamp]", "anchor", "chandelier"], ["[data-prop=mug]", "anchor", "tea"], ["[data-prop=plant]", "anchor", "plant"],
    ["[data-prop=door]", "anchor", "door"], ["#windowHot", "anchor", "window"],
    ["[data-prop=piggy]", "sprite", "piggy"], ["[data-prop=jar]", "sprite", "jar"], ["[data-prop=globe]", "sprite", "globe"],
    ["[data-prop=radio]", "sprite", "radio"], ["[data-prop=cardbox]", "sprite", "cardbox"], ["#mailboxProp", "sprite", "mailbox"],
    ["#noteProp", "sprite", "note"]
  ].map(([sel, kind, id]) => ({ el: stage.querySelector(sel), kind, id })).filter((l) => l.el);
  const linked = new Set(LINK.map((l) => l.el));
  stage.querySelectorAll(".xb-prop, .xb-hot").forEach((el) => { if (!linked.has(el)) el.dataset.hallOff = ""; });
  LINK.forEach((l) => { if (l.kind === "sprite") l.el.addEventListener("click", () => { hall.sprites[l.id].userData.liftV += 0.9; }); });

  // ---------- 屏幕投影 ----------
  let SR = stage.getBoundingClientRect();
  const v = new THREE.Vector3(), box = new THREE.Box3();
  function screenRect(b) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, behind = false;
    for (let i = 0; i < 8; i++) {
      v.set(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).project(camera);
      if (v.z > 1) behind = true;
      const x = (v.x * 0.5 + 0.5) * SR.width, y = (-v.y * 0.5 + 0.5) * SR.height;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
    return behind ? null : { x0, y0, x1, y1 };
  }
  function placeEl(el, r, z) {
    if (!r || r.x1 < 0 || r.y1 < 0 || r.x0 > SR.width || r.y0 > SR.height) { el.style.visibility = "hidden"; return; }
    // 手指点击区至少 44px，围着物件中心扩开
    const MIN = 44, cx = (r.x0 + r.x1) / 2, cy = (r.y0 + r.y1) / 2, w = Math.max(MIN, r.x1 - r.x0), h = Math.max(MIN, r.y1 - r.y0);
    el.style.visibility = ""; el.style.left = cx - w / 2 + "px"; el.style.top = cy - h / 2 + "px"; el.style.width = w + "px"; el.style.height = h + "px";
    if (z != null) el.style.zIndex = z;
  }
  const shown = (el) => { if (el.hidden) return false; const cs = getComputedStyle(el); return cs.display !== "none"; };

  // ---------- 雪宝：游戏里的位置 ↔ 地板 ----------
  // xuebao.js 的 pos 是舞台百分比；大厅里另外记一份地板坐标 wx/wz（跟着 pos 一起存），镜头转了也不会跑位
  const G = () => window.XBGame;
  // 出发动画结束后，3D 角色可以独立探索，旅行状态和在家时的位置仍由 XBGame 管理。
  // 旅行中、回来在门口等开背包时，也能自己走来走去看看（不经过游戏那边记位置）
  const exploringTrip = () => live && ["away", "back", "waiting"].includes(G()?.phase) && stage.dataset.phase === G()?.phase;
  const canMove = () => live && stage.dataset.xbModel === "ready" && (G()?.phase === "home" || exploringTrip());
  let lastKey = "", lastCls = "", wasDrag = false, exploredTrip = false;
  let tripDrag = null;

  function stopTripDrag(finish = false) {
    if (!tripDrag) return;
    const { id, active } = tripDrag;
    tripDrag = null;
    if (active) {
      const target = char.followT;
      char.stopFollow();
      if (finish && target) char.goTo(target);
    }
    if (me.hasPointerCapture(id)) me.releasePointerCapture(id);
  }

  me.addEventListener("pointerdown", () => char.touch(), true);
  me.addEventListener("pointerdown", (e) => {
    if (!exploringTrip() || e.button !== 0 || tripDrag) return;
    me.setPointerCapture(e.pointerId);
    tripDrag = { id: e.pointerId, x: e.clientX, y: e.clientY, active: false };
  });
  me.addEventListener("pointermove", (e) => {
    if (!exploringTrip() || tripDrag?.id !== e.pointerId) return;
    if (!tripDrag.active && Math.hypot(e.clientX - tripDrag.x, e.clientY - tripDrag.y) <= 10) return;
    tripDrag.active = true;
    const ground = hall.groundAt((e.clientX - SR.left) / SR.width, (e.clientY - SR.top) / SR.height);
    if (ground) {
      const target = char.walkClamp(ground.x, ground.z);
      char.follow(target.x, target.z);
    }
  });
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
    me.addEventListener(type, (e) => { if (tripDrag?.id === e.pointerId) stopTripDrag(type === "pointerup"); });
  }
  function syncChar() {
    const g = G(); if (!g) return;
    if (stage.dataset.xbModel !== "ready") { me.style.visibility = "hidden"; return; }
    const explore = exploringTrip();
    if (explore) {
      if (!exploredTrip && wasDrag) {
        wasDrag = false;
        char.stopFollow();
      }
      exploredTrip = true;
      char.setPose("idle");
      char.opacity = 1;
      placeEl(me, screenRect(char.bounds(box)));
      return;
    }
    if (exploredTrip) {
      exploredTrip = false;
      stopTripDrag();
      char.pending = null;
      char.endAct();
      lastKey = "";
    }
    char.setPose(g.pose);
    const cs = getComputedStyle(me);
    char.opacity = me.classList.contains("gone") ? 0 : parseFloat(cs.opacity) || 0;
    if (me.className !== lastCls) {
      const prev = new Set(lastCls.split(" ")), added = me.className.split(" ").filter((c) => c && !prev.has(c)); lastCls = me.className;
      if (added.includes("hop")) char.hop(); if (added.includes("squash")) char.squash(); if (added.includes("hug")) char.hug(); if (added.includes("swap")) char.swap();
    }
    // 拖雪宝：不再让她飞，而是在地上跑向手指；松手后把她停下的位置记下来
    const dragNow = me.classList.contains("dragging"); char.dragging = false;
    const p = g.pos, key = p.x.toFixed(2) + "," + p.y.toFixed(2);
    if (dragNow) {
      const f = hall.groundAt(p.x / 100, (p.y - 6) / 100); if (f) { const c = char.walkClamp(f.x, f.z); char.follow(c.x, c.z); }
      lastKey = key; wasDrag = true; placeEl(me, screenRect(char.bounds(box))); return;
    }
    if (wasDrag) { wasDrag = false; const t = char.followT || { x: char.mesh.position.x, z: char.mesh.position.z }; char.stopFollow(); g.moved?.({ wx: t.x, wz: t.z }); lastKey = g.pos.x.toFixed(2) + "," + g.pos.y.toFixed(2); }
    if (key !== lastKey) {
      const firstTime = !lastKey; lastKey = key;
      let w;
      // 门口：回家等开背包时站门里；出门旅行时穿过门走到露台上
      if (p.x === g.SPOT.door.x && p.y === g.SPOT.door.y) w = g.phase === "back" || g.phase === "waiting" ? { x: 0, z: -D + 0.85 } : { x: 0, z: -D - 1.1 };
      else if (p.wx != null && p.wk === key) w = { x: p.wx, z: p.wz };
      else { const f = hall.floorAt(p.x / 100, p.y / 100); w = f ? char.walkClamp(f.x, f.z) : { x: 0, z: -1.05 }; p.wx = w.x; p.wz = w.z; p.wk = key; }
      if (char.dragging) { const c = char.walkClamp(w.x, w.z); char.to.set(c.x, 0, c.z); } else char.goTo(w, firstTime);
    }
    // 看不见的雪宝按钮贴在 3D 雪宝身上
    placeEl(me, screenRect(char.bounds(box)));
  }

  // ---------- 镜头：拖动旋转，双指捏合／滚轮推拉；轻点地板让雪宝走过去 ----------
  // 从道具上开始拖也能转镜头；拖过就吞掉这次点击，只有轻点才算点
  const pts = new Map(); let down = null, swallow = false, pinch = null;
  const span = () => { const [a, b] = [...pts.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
  stage.addEventListener("pointerdown", (e) => {
    if (!live || me.contains(e.target) || e.button > 0 || e.target.closest?.(".xb-sheet, .xb-bubble, button.xb-btn, .xb-joy, .xb-ctl")) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2) { pinch = { d: span(), dist: view.distT }; if (down) down.moved = true; view.held = true; return; }
    down = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, moved: false, onCanvas: e.target === canvas, id: e.pointerId };
  }, true);
  addEventListener("pointermove", (e) => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pts.size === 2) { view.touched = true; view.distT = Math.min(view.maxDist, Math.max(view.minDist, pinch.dist * pinch.d / Math.max(20, span()))); return; }
    if (!down || e.pointerId !== down.id) return;
    if (!down.moved && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8) { down.moved = true; view.held = true; }
    if (down.moved) { view.orbit(e.clientX - down.lx, e.clientY - down.ly); view.touched = true; }
    down.lx = e.clientX; down.ly = e.clientY;
  }, { passive: true });
  const up = (e) => {
    if (!pts.has(e.pointerId)) return; pts.delete(e.pointerId);
    if (pts.size < 2) pinch = null;
    if (!down || e.pointerId !== down.id) { if (!pts.size) view.held = false; return; }
    const d = down; down = null; view.held = pts.size > 0;
    if (d.moved) { swallow = true; setTimeout(() => { swallow = false; }, 350); return; }
    view.vYaw = view.vPitch = 0;
    if (!d.onCanvas || e.type === "pointercancel") return;
    char.touch();
    const nx = (e.clientX - SR.left) / SR.width, ny = (e.clientY - SR.top) / SR.height;
    // 先看是不是点了能互动的东西（喷泉、秋千……）：让雪宝走过去做
    const id = hall.pick(nx, ny);
    if (id) {
      const s = hall.interact(id);
      if (s.action === "pet") { char.touch?.(); hall.extras.poke(s.pet); G()?.react?.(s.lines[Math.floor(Math.random() * s.lines.length)]); return; }
      if (s.action === "player") { char.touch?.(); G()?.music?.open("video"); G()?.react?.(s.lines[Math.floor(Math.random() * s.lines.length)]); return; }
      if (s.href) enterPage(s); else { hall.mark(s.spot.x, s.spot.z); walkTo(s.spot.x, s.spot.z); } return;
    }
    const f = hall.groundAt(nx, ny); if (!f) return;
    const w = char.walkClamp(f.x, f.z), now = performance.now();
    // 双击地面：跑过去
    if (now - lastTapT < 340 && Math.hypot(w.x - lastTapW.x, w.z - lastTapW.z) < 1.2) char.runNext = true;
    lastTapT = now; lastTapW = w;
    if (runLock) char.runNext = true;
    if (canMove()) hall.mark(w.x, w.z);
    walkTo(w.x, w.z, nx, ny);
  };
  let lastTapT = 0, lastTapW = { x: 0, z: 0 };
  // 让雪宝走到地面上某点（交给 xuebao.js 记位置；它会再通过 syncChar 叫 char.goTo）
  function walkTo(wx, wz, nx, ny) {
    if (stage.dataset.xbModel !== "ready") return;
    if (exploringTrip()) {
      char.goTo({ x: wx, z: wz });
      return;
    }
    if (nx == null) { v.set(wx, 0, wz).project(camera); nx = v.x * 0.5 + 0.5; ny = -v.y * 0.5 + 0.5; }
    const x = nx * 100, y = ny * 100, wk = x.toFixed(2) + "," + y.toFixed(2);
    // 已经站在这儿了（游戏那边会当成“点了雪宝”），直接在 3D 里开始
    if (Math.hypot(char.mesh.position.x - wx, char.mesh.position.z - wz) < 0.3) { char.goTo({ x: wx, z: wz }); return; }
    if (char.runNext) { char.goTo({ x: wx, z: wz }); } // 双击：先在 3D 里跑起来，游戏那边随后记位置
    dispatchEvent(new CustomEvent("xb:floor", { detail: { x, y, wx, wz, wk } }));
  }
  // ---------- 进入分页面：雪宝挥挥手，镜头凑近那件东西，淡出后跳转 ----------
  let entering = false;
  // 和加载页同一套画面：拱门里的雪宝挥手，下面写要去哪儿
  const veil = document.createElement("div"); veil.className = "wl veil"; veil.setAttribute("aria-hidden", "true");
  veil.innerHTML = '<div class="wl-stage"><div class="wl-arch"><span class="wl-glow"></span></div><img class="wl-xb" src="xuebao-assets/xb-loading.webp?v=1" alt=""></div><div class="wl-text"><h1 class="wl-title"></h1><p class="wl-tip"></p><div class="wl-bar"><span style="width:100%"></span></div></div>';
  document.body.append(veil);
  function enterPage(s) {
    if (entering) return; entering = true;
    const p = char.mesh.position, far = Math.hypot(p.x - s.at[0], p.z - s.at[2]) > 6;
    G()?.react?.(s.lines[Math.floor(Math.random() * s.lines.length)]);
    char.pending = null; char.endAct?.();
    char.act = { s: { id: "_enter", clip: "wave", dur: 3, face: Math.atan2(s.at[0] - p.x, s.at[2] - p.z) }, t: 0, from: p.clone() };
    if (!far) hall.peek(s);
    veil.querySelector(".wl-title").textContent = s.name; veil.querySelector(".wl-tip").textContent = `${s.icon} 雪宝带你去「${s.name}」…`;
    setTimeout(() => veil.classList.add("on"), far ? 250 : 750);
    setTimeout(() => { location.href = s.href; }, far ? 1000 : 1500);
  }
  // 从分页面按“返回”回来（页面被浏览器缓存）时恢复
  addEventListener("pageshow", () => { if (!entering) return; entering = false; veil.classList.remove("on"); view.peek = null; view.distT = view.home; });
  char.onAct = (s) => G()?.react?.(s.lines[Math.floor(Math.random() * s.lines.length)]);
  addEventListener("pointerup", up, true); addEventListener("pointercancel", up, true);
  stage.addEventListener("click", (e) => { if (swallow) { e.stopPropagation(); e.preventDefault(); swallow = false; } }, true);
  stage.addEventListener("wheel", (e) => { if (!live || e.target.closest?.(".xb-sheet")) return; e.preventDefault(); view.touched = true; view.zoom(Math.exp(e.deltaY * 0.0012)); }, { passive: false });
  canvas.addEventListener("dblclick", () => view.reset());

  // ---------- 电脑上：WASD／方向键让雪宝自己走（相对镜头方向） ----------
  const keys = new Set(), KEY = { KeyW: [0, -1], ArrowUp: [0, -1], KeyS: [0, 1], ArrowDown: [0, 1], KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0] };
  let driving = false;
  addEventListener("keydown", (e) => { if (!KEY[e.code] || e.target.closest?.("input, textarea, .xb-sheet") || !document.getElementById("sheetWrap")?.hidden) return; if (!canMove()) return; keys.add(e.code); e.preventDefault(); });
  let shift = false, runLock = false;
  // 空格：跳
  addEventListener("keydown", (e) => { if (e.code !== "Space" || e.repeat || e.target.closest?.("input, textarea, button, .xb-sheet") || !document.getElementById("sheetWrap")?.hidden || !canMove()) return; e.preventDefault(); doJump(); });
  function doJump() { if (!canMove()) return; char.touch(); if (char.jumpUp()) { G()?.sound?.("pop"); if (Math.random() < 0.18) G()?.react?.(["嘿咻！", "跳高高～", "看我跳！"][Math.floor(Math.random() * 3)]); } }
  // ---------- 右下角：跳、跑步开关、挥手；上面一列：拉近、拉远、回正 ----------
  const ctl = document.createElement("div"); ctl.className = "xb-ctl";
  ctl.innerHTML = `<div class="xb-ctl-cam"><button type="button" data-c="in" aria-label="拉近">＋</button><button type="button" data-c="out" aria-label="拉远">－</button><button type="button" data-c="reset" aria-label="镜头回正">⟲</button></div>
    <div class="xb-ctl-act"><button type="button" class="b-wave" data-c="wave" aria-label="挥手">👋<small>挥手</small></button><button type="button" class="b-run" data-c="run" aria-pressed="false" aria-label="跑步开关">🏃<small>跑步</small></button><button type="button" class="b-jump" data-c="jump" aria-label="跳">⤒<small>跳${hall.mobile ? "" : " · 空格"}</small></button></div>`;
  stage.append(ctl);
  const ctlAct = ctl.querySelector(".xb-ctl-act"), runBtn = ctl.querySelector(".b-run");
  ctl.addEventListener("pointerdown", (e) => { const b = e.target.closest("button"); if (!b) return; e.stopPropagation(); e.preventDefault(); b.classList.add("press");
    const c = b.dataset.c;
    if (c === "jump") doJump();
    else if (c === "run") { runLock = !runLock; runBtn.setAttribute("aria-pressed", String(runLock)); runBtn.classList.toggle("on", runLock); if (char.path.length) char.run = runLock || char.run; G()?.react?.(runLock ? "冲呀～现在开始都跑着去！" : "慢慢走，看看风景。"); }
    else if (c === "wave") { if (!canMove()) return; char.touch(); const p = char.mesh.position; char.path = []; char.endAct?.(); char.act = { s: { id: "_wave", clip: "wave", dur: 1.8, face: Math.atan2(hall.camera.position.x - p.x, hall.camera.position.z - p.z) }, t: 0, from: p.clone() }; G()?.react?.(["嗨～雪雪！", "我在这儿！", "想你啦～"][Math.floor(Math.random() * 3)]); }
    else if (c === "in" || c === "out") { view.touched = true; view.zoom(c === "in" ? 0.8 : 1.25); }
    else if (c === "reset") { view.reset(); view.touched = false; }
  });
  addEventListener("pointerup", () => ctl.querySelectorAll(".press").forEach((b) => b.classList.remove("press")));
  ctl.addEventListener("click", (e) => e.stopPropagation());
  addEventListener("keydown", (e) => { if (e.key === "Shift") shift = true; });
  addEventListener("keyup", (e) => { keys.delete(e.code); if (e.key === "Shift") shift = false; });
  addEventListener("blur", () => keys.clear());
  // ---------- 手机上：左下角摇杆 ----------
  const joy = { x: 0, y: 0, id: null }; let joyPad = null;
  if (hall.mobile) {
    const pad = document.createElement("div"); pad.className = "xb-joy"; pad.innerHTML = '<i></i><span>推到底就跑</span>'; stage.append(pad); joyPad = pad;
    const knob = pad.firstChild;
    const set = (e) => { const r = pad.getBoundingClientRect(), R0 = r.width / 2; let dx = e.clientX - r.left - R0, dy = e.clientY - r.top - R0; const L = Math.hypot(dx, dy), m = R0 * 0.62; if (L > m) { dx *= m / L; dy *= m / L; } joy.x = dx / m; joy.y = dy / m; knob.style.transform = `translate(${dx}px, ${dy}px)`; };
    pad.addEventListener("pointerdown", (e) => { if (!canMove()) return; e.stopPropagation(); e.preventDefault(); joy.id = e.pointerId; pad.setPointerCapture(e.pointerId); pad.classList.add("on"); set(e); });
    pad.addEventListener("pointermove", (e) => { if (e.pointerId === joy.id) set(e); });
    const end = (e) => { if (e.pointerId !== joy.id) return; joy.id = null; joy.x = joy.y = 0; knob.style.transform = ""; pad.classList.remove("on", "run"); };
    pad.addEventListener("pointerup", end); pad.addEventListener("pointercancel", end);
    pad.hidden = true;
  }
  function drive() {
    // 开着面板、天气菜单、选身份弹窗时，摇杆和右下按钮都收起来，画面干净也不会误点
    const overlay = document.getElementById("sheetWrap")?.hidden === false || document.getElementById("wxPanel")?.hidden === false;
    const enabled = canMove() && !overlay;
    if (joyPad && joyPad.hidden === enabled) joyPad.hidden = !enabled;
    if (ctlAct.hidden === enabled) ctlAct.hidden = !enabled;
    ctl.hidden = !live || entering || overlay;
    if (!enabled) {
      keys.clear();
      if (joy.id != null) {
        const id = joy.id;
        joy.id = null; joy.x = joy.y = 0;
        joyPad.firstChild.style.transform = "";
        joyPad.classList.remove("on", "run");
        if (joyPad.hasPointerCapture(id)) joyPad.releasePointerCapture(id);
      }
      driving = false;
      char.drive = null;
      return;
    }
    let fx = 0, fz = 0; keys.forEach((k) => { fx += KEY[k][0]; fz += KEY[k][1]; });
    if (Math.hypot(joy.x, joy.y) > 0.15) { fx += joy.x; fz += joy.y; }
    if (!fx && !fz) { if (driving) { driving = false; char.drive = null; G()?.moved?.({ wx: char.mesh.position.x, wz: char.mesh.position.z }); } return; }
    if (!driving) { driving = true; G()?.moved?.(null); }
    // 屏幕上的“前”是镜头朝向投到地板上
    const sy = Math.sin(view.yaw), cy = Math.cos(view.yaw);
    char.drive = { x: fx * cy + fz * sy, z: -fx * sy + fz * cy, run: shift || runLock || Math.hypot(joy.x, joy.y) > 0.92 };
    joyPad?.classList.toggle("run", char.drive.run && Math.hypot(joy.x, joy.y) > 0.92);
  }

  // ---------- 循环 ----------
  const QH = Number(new URLSearchParams(location.search).get("hour") ?? -1); // 调试：?hour=13 看正午光照
  const nyHour = () => { const p = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(new Date()); return Number(p.find((x) => x.type === "hour").value) + Number(p.find((x) => x.type === "minute").value) / 60; };
  function resize() { SR = stage.getBoundingClientRect(); hall.resize(stage.clientWidth, stage.clientHeight); lastKey = ""; }
  new ResizeObserver(resize).observe(stage); resize();
  let last = performance.now(), cardT = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    if (document.hidden || window.XBGiftBox?.busy) { last = now; return; }
    const dt = Math.min(0.05, (now - last) / 1000); last = now; const t = now / 1000;
    SR = stage.getBoundingClientRect();
    const weather = stage.dataset.weather || "sunny";
    let hour = QH >= 0 ? QH : nyHour(); if (weather !== "night" && (hour < 6.4 || hour > 19.2)) hour = 15.5;
    drive(); syncChar();
    // 只有在家（或旅行探索）、没开面板时，她才会自己溜达
    char.allowWander = canMove() && !["back", "waiting"].includes(G()?.phase) && document.getElementById("sheetWrap")?.hidden !== false && !entering;
    hall.update(dt, t, { hour, weather, lamp: stage.classList.contains("lamp-on") });
    if (!live) return;
    // 道具按钮跟着 3D 物件走
    for (const l of LINK) {
      const zOf = (b, small) => 3 + (small ? 12 : 0) + Math.max(0, Math.round(10 - b.getCenter(v).distanceTo(camera.position) * 1.5));
      if (l.kind === "sprite") { const s = hall.sprites[l.id]; s.visible = shown(l.el); s.userData.shadow.visible = s.visible; if (!s.visible) continue; box.setFromObject(s); placeEl(l.el, screenRect(box), zOf(box, true)); }
      else { const b = hall.anchors[l.id]; if (b) placeEl(l.el, screenRect(b), zOf(b, false)); }
    }
    // 相框放最近一张明信片
    if (now - cardT > 1000) { cardT = now; const bg = document.getElementById("framePic")?.style.backgroundImage || ""; const m = bg.match(/url\("?([^")]+)"?\)/); if (m) hall.setCanvasCard("frameL", m[1]); }
  }
  requestAnimationFrame(frame);
}
