"use strict";

/*
 * 雪宝游记 · 状态接口
 *   GET  /api/xuebao                         → 当前状态（雪宝在哪、可领几份、钱包、碎片、奶茶券、图鉴）
 *   POST /api/xuebao {action:"claim"}        → 领取攒好的礼物（最多 3 份）
 *   POST /api/xuebao {action:"admin", password, op, ...}  记账口令操作：
 *        op=deduct {amount, note}     扣减余额（兑换）
 *        op=useCoupon {id, note}      核销一张奶茶券
 *        op=redeemSkin {note}         兑现一个已集齐的皮肤
 *        op=queue {title, text}       定向投递：下一次回家一定带回这个
 *        op=unqueue {id}              撤回定向投递
 *        op=check                     只验证口令
 *
 * 规则：每 5 小时完成一趟旅行，最多攒 3 份；攒满后雪宝在家等，不会丢。
 * 钱：按纽约时间每周一 0 点起算，上限 520，尽量凑满。碎片：按天积累额度，约 35–60 天集齐 99 个。
 * 存储：线上 Vercel Blob（xuebao/state.json），本地 server.js 设置 XUEBAO_FILE 时存 JSON 文件。
 * 口令：环境变量 XUEBAO_PASSWORD；未设置时记账功能关闭。
 */

const DATA = require("../xuebao-data.js");

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;
const TRIP = DATA.TRIP_HOURS * HOUR;
const MAX = DATA.MAX_READY;
const CAP = DATA.WEEK_CAP;
const TARGET = DATA.FRAG_TARGET;
const REST = 90 * 60 * 1000; // 领完后在家待一会儿再出门
const TZ = "America/New_York";
const PATHNAME = "xuebao/state.json";

const sendJson = (res, status, payload) => {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.status(status).json(payload);
};
const readJsonBody = (req) => {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  return {};
};
const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const round2 = (n) => Math.round(n * 100) / 100;

// ---------- 纽约时间的“周” ----------
const nyParts = (t) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  }).formatToParts(new Date(t)).map((x) => [x.type, x.value]));
  return p;
};
const weekInfo = (t) => {
  const p = nyParts(t);
  const dow = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(p.weekday);
  const sinceMonday = (dow * 24 + Number(p.hour)) * HOUR + Number(p.minute) * 60000;
  const d = new Date(Date.UTC(+p.year, +p.month - 1, +p.day - dow));
  return { key: d.toISOString().slice(0, 10), hoursLeft: (7 * DAY - sinceMonday) / HOUR };
};

// ---------- 存储 ----------
const fileStore = (file) => {
  const fsp = require("fs/promises");
  return {
    async load() { try { return JSON.parse(await fsp.readFile(file, "utf8")); } catch { return null; } },
    async save(s) { await fsp.writeFile(file, JSON.stringify(s, null, 2)); }
  };
};
const blobStore = () => ({
  async load() {
    const { list } = await import("@vercel/blob");
    const { blobs } = await list({ prefix: PATHNAME, limit: 5 });
    const b = blobs.find((x) => x.pathname === PATHNAME);
    if (!b) return null;
    const r = await fetch(`${b.url}?v=${Date.now()}`, { cache: "no-store" });
    return r.ok ? r.json() : null;
  },
  async save(s) {
    const { put } = await import("@vercel/blob");
    await put(PATHNAME, JSON.stringify(s), {
      access: "public", addRandomSuffix: false, allowOverwrite: true,
      contentType: "application/json; charset=utf-8", cacheControlMaxAge: 60
    });
  }
});
const getStore = () => (process.env.XUEBAO_FILE ? fileStore(process.env.XUEBAO_FILE) : blobStore());

const freshState = (now) => ({
  v: 1,
  startedAt: now,
  anchor: now - TRIP, // 第一次打开就有一份礼物
  lastClaimAt: 0,
  week: { key: weekInfo(now).key, paid: 0 },
  wallet: { balance: 0, earned: 0, ledger: [] },
  frag: { cycleStart: now, rate: round2(rand(1.7, 2.8)), given: 0, total: 0, pendingSkins: 0, redeemed: 0 },
  coupons: [],
  lastTeaAt: now - 5 * DAY,
  seen: [],
  collection: {},
  meets: {},
  history: [],
  queue: []
});

// ---------- 计算 ----------
const readyCount = (s, now) => Math.max(0, Math.min(MAX, Math.floor((now - s.anchor) / TRIP)));

const rollWeek = (s, now) => {
  const wk = weekInfo(now).key;
  if (s.week.key !== wk) s.week = { key: wk, paid: 0 };
};

const SPECIAL = [5.2, 13.14, 20, 52, 66, 88, 99];
const moneyFor = (s, now, giftsLeftInClaim) => {
  rollWeek(s, now);
  const remaining = round2(CAP - s.week.paid);
  if (remaining <= 0) return 0;
  const { hoursLeft } = weekInfo(now);
  if (hoursLeft < 10 && giftsLeftInClaim <= 1) return remaining; // 本周最后一次：凑满 520
  const expected = giftsLeftInClaim + Math.floor(hoursLeft / DATA.TRIP_HOURS) * 0.6;
  let amt = (remaining / Math.max(1, expected)) * rand(0.7, 1.35);
  if (hoursLeft < 30) amt = Math.max(amt, remaining * 0.45);
  const near = SPECIAL.filter((v) => v <= remaining && v >= amt * 0.6 && v <= amt * 1.6);
  amt = near.length && Math.random() < 0.35 ? pick(near) : Math.max(1, Math.round(amt));
  if (remaining - amt < 3) amt = remaining; // 不留零头
  return round2(Math.min(amt, remaining));
};

const fragFor = (s, now) => {
  const f = s.frag;
  const budget = Math.min(TARGET, Math.floor(((now - f.cycleStart) / DAY) * f.rate)) - f.given;
  if (budget <= 0) return 0;
  const r = Math.random();
  const n = r < 0.08 ? randInt(5, 9) : r < 0.7 ? randInt(1, 4) : 0;
  return Math.min(n, budget, TARGET - f.given);
};

const teaFor = (s, now) => {
  const since = now - (s.lastTeaAt || 0);
  if (since < 3 * DAY) return false;
  if (since > 9 * DAY) return true;
  return Math.random() < 0.08;
};

const destFor = (s, first) => {
  if (first) return DATA.DESTS.find((d) => d.id === "hz-snow");
  const r = Math.random();
  const tier = r < 0.06 ? 3 : r < 0.28 ? 2 : 1;
  let pool = DATA.DESTS.filter((d) => d.tier === tier);
  const fresh = pool.filter((d) => !s.seen.includes(d.id));
  if (!fresh.length) { s.seen = s.seen.filter((id) => !pool.some((d) => d.id === id)); }
  pool = fresh.length ? fresh : pool;
  const recent = s.history.slice(0, 3).map((g) => g.dest);
  const ok = pool.filter((d) => !recent.includes(d.id));
  return pick(ok.length ? ok : pool);
};

const meetFor = (dest) => {
  const pref = dest.meet && DATA.CHARS.find((c) => c.id === dest.meet);
  if (pref && Math.random() < 0.45) return pref;
  if (Math.random() < 0.14) return pick(DATA.CHARS);
  return null;
};

const makeGift = (s, now, first, giftsLeft) => {
  const dest = destFor(s, first);
  const meet = first ? null : meetFor(dest);
  const money = first ? Math.min(52, CAP - s.week.paid) : moneyFor(s, now, giftsLeft);
  let frag = first ? 3 : fragFor(s, now);
  const tea = first ? false : teaFor(s, now);
  const gift = { id: uid(), at: now, dest: dest.id, money, frag, first: Boolean(first) };
  if (meet) { gift.meet = meet.id; s.meets[meet.id] = (s.meets[meet.id] || 0) + 1; }
  if (!s.seen.includes(dest.id)) s.seen.push(dest.id);
  if (!s.collection[dest.id]) { s.collection[dest.id] = now; gift.newStamp = true; }
  if (money > 0) {
    s.week.paid = round2(s.week.paid + money);
    s.wallet.balance = round2(s.wallet.balance + money);
    s.wallet.earned = round2(s.wallet.earned + money);
    s.wallet.ledger.unshift({ at: now, delta: money, note: `雪宝从${dest.place}带回`, kind: "trip" });
    if (s.week.paid >= CAP) gift.full520 = true;
  }
  if (frag > 0) {
    s.frag.given += frag; s.frag.total += frag;
    if (s.frag.given >= TARGET) {
      gift.skinDone = true;
      s.frag.pendingSkins += 1;
      s.frag = { ...s.frag, cycleStart: now, rate: round2(rand(1.7, 2.8)), given: 0 };
    }
  }
  if (tea) {
    const c = { id: uid(), type: "tea", title: "任意奶茶一杯", at: now, used: false };
    s.coupons.unshift(c); s.lastTeaAt = now; gift.coupon = c.id;
  }
  if (s.queue.length) {
    const q = s.queue.shift();
    gift.special = { title: q.title, text: q.text };
  }
  return gift;
};

const view = (s, now, extra = {}) => {
  rollWeek(s, now);
  const ready = readyCount(s, now);
  const sinceClaim = now - (s.lastClaimAt || 0);
  const phase = ready > 0 ? (ready >= MAX ? "waiting" : "back") : sinceClaim < REST ? "home" : "away";
  const nextAt = ready >= MAX ? null : s.anchor + (ready + 1) * TRIP;
  const leaveAt = phase === "home" ? s.lastClaimAt + REST : null;
  const { hoursLeft } = weekInfo(now);
  return {
    now, phase, ready, max: MAX, nextAt, leaveAt, tripHours: DATA.TRIP_HOURS,
    wallet: { balance: s.wallet.balance, earned: s.wallet.earned, weekPaid: s.week.paid, weekCap: CAP, weekResetIn: Math.round(hoursLeft * HOUR), ledger: s.wallet.ledger.slice(0, 40) },
    frag: { given: s.frag.given, target: TARGET, pendingSkins: s.frag.pendingSkins, redeemed: s.frag.redeemed, total: s.frag.total },
    coupons: s.coupons.slice(0, 40),
    collection: s.collection, meets: s.meets,
    history: s.history.slice(0, 60),
    queued: s.queue.length,
    adminEnabled: Boolean(process.env.XUEBAO_PASSWORD),
    ...extra
  };
};

module.exports = async function xuebao(req, res) {
  try {
    const store = getStore();
    const now = Date.now();
    let s = await store.load();
    let dirty = false;
    if (!s) { s = freshState(now); dirty = true; }

    if (req.method === "GET") {
      if (dirty) await store.save(s);
      sendJson(res, 200, view(s, now));
      return;
    }
    if (req.method !== "POST") { res.setHeader("Allow", "GET, POST"); sendJson(res, 405, { error: "Method not allowed" }); return; }

    const body = readJsonBody(req);

    if (body.action === "claim") {
      const n = readyCount(s, now);
      if (!n) { sendJson(res, 409, { error: "雪宝还在路上呢。", ...view(s, now) }); return; }
      const first = !s.history.length;
      const gifts = [];
      for (let i = 0; i < n; i++) gifts.push(makeGift(s, now, first && i === 0, n - i));
      s.history = [...gifts.slice().reverse(), ...s.history].slice(0, 300);
      s.anchor = n >= MAX ? now : s.anchor + n * TRIP;
      s.lastClaimAt = now;
      s.wallet.ledger = s.wallet.ledger.slice(0, 300);
      await store.save(s);
      sendJson(res, 200, view(s, now, { gifts }));
      return;
    }

    if (body.action === "admin") {
      const password = String(process.env.XUEBAO_PASSWORD || "");
      if (!password) { sendJson(res, 403, { error: "记账功能还没有开启。" }); return; }
      if (String(body.password || "") !== password) { sendJson(res, 401, { error: "口令不对。" }); return; }
      const note = String(body.note || "").trim().slice(0, 40);
      switch (body.op) {
        case "check": break;
        case "deduct": {
          const amount = round2(Number(body.amount));
          if (!(amount > 0) || amount > s.wallet.balance + 0.001) { sendJson(res, 400, { error: `金额不对，余额是 ${s.wallet.balance}。` }); return; }
          s.wallet.balance = round2(s.wallet.balance - amount);
          s.wallet.ledger.unshift({ at: now, delta: -amount, note: note || "兑换", kind: "deduct" });
          break;
        }
        case "useCoupon": {
          const c = s.coupons.find((x) => x.id === body.id && !x.used);
          if (!c) { sendJson(res, 404, { error: "这张券不存在或已经用过了。" }); return; }
          Object.assign(c, { used: true, usedAt: now, note: note || "已兑现" });
          break;
        }
        case "redeemSkin": {
          if (s.frag.pendingSkins < 1) { sendJson(res, 400, { error: "还没有集齐的皮肤。" }); return; }
          s.frag.pendingSkins -= 1; s.frag.redeemed += 1;
          s.wallet.ledger.unshift({ at: now, delta: 0, note: `皮肤已兑现${note ? "：" + note : ""}`, kind: "skin" });
          break;
        }
        case "queue": {
          const title = String(body.title || "").trim().slice(0, 30);
          const text = String(body.text || "").trim().slice(0, 600);
          if (!title || !text) { sendJson(res, 400, { error: "标题和内容都要写。" }); return; }
          s.queue.push({ id: uid(), title, text, at: now });
          break;
        }
        case "unqueue": s.queue = s.queue.filter((q) => q.id !== body.id); break;
        default: sendJson(res, 400, { error: "未知操作。" }); return;
      }
      await store.save(s);
      sendJson(res, 200, view(s, now, { queue: s.queue }));
      return;
    }

    sendJson(res, 400, { error: "未知操作。" });
  } catch (error) {
    if (error?.message?.includes("BLOB_READ_WRITE_TOKEN")) { sendJson(res, 503, { error: "存储还没有配置。" }); return; }
    console.error("xuebao", error);
    sendJson(res, 500, { error: "雪宝的小屋暂时打不开，过一会儿再试。" });
  }
};
