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
 * 规则：从第一次进门领礼物那一刻才开始计时（之前门口只放一份见面礼）。
 *       之后每 5 小时完成一趟旅行，最多攒 3 份；攒满后雪宝在家等，不会丢。
 * “一周”都按满 7 天算，不按自然周：
 *   钱：每满一周上限 520，尽量凑满；上一周到期后，下一次领礼物那一刻开始新的一周。
 *   奶茶券：每满一周一张；周三领到，下一张就在下周三之后的第一份礼物里。
 * 碎片：按天积累额度，约 35–60 天集齐 99 个。
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
const PATHNAME = "xuebao/state.json";

const sendJson = (res, status, payload) => {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.status(status).json(payload);
};
// 旧版许愿记录只有 gift（每次必出礼物）：补成“中吉 + 一张愿望签”
const wishOut = (w) => ({ card: w.card || "peace", luck: w.luck || "chukichi", gift: w.gift || null, at: w.at });
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

// ---------- “一周”= 满 7 天 ----------
const WEEK = 7 * DAY;
const started = (s) => Boolean(s.startedAt && (s.lastClaimAt || s.history.length));
// 当前这一周：没开始或已过期时返回 null（下一次领礼物时才开新的一周）
const curWeek = (s, now) => (s.week && s.week.start && now < s.week.start + WEEK ? s.week : null);

// ---------- 存储 ----------
const fileStore = (file) => {
  const fsp = require("fs/promises");
  return {
    async load() {
      try { return JSON.parse(await fsp.readFile(file, "utf8")); }
      catch (e) { if (e.code === "ENOENT") return null; throw e; }
    },
    async save(s) {
      const tmp = `${file}.${require("node:crypto").randomUUID()}.tmp`;
      try {
        await fsp.writeFile(tmp, JSON.stringify(s, null, 2));
        await fsp.rename(tmp, file);
      } finally { await fsp.rm(tmp, { force: true }); }
    }
  };
};
const blobStore = () => {
  let etag;
  return {
    async load() {
      const { get } = await import("@vercel/blob");
      const found = await get(PATHNAME, { access: "public", useCache: false });
      if (!found) return null;
      if (!found.stream || !found.blob.etag) throw new Error("Missing Blob state or ETag");
      etag = found.blob.etag;
      return new Response(found.stream).json();
    },
    async save(s) {
      const { put, BlobPreconditionFailedError } = await import("@vercel/blob");
      try {
        await put(PATHNAME, JSON.stringify(s), {
          access: "public", addRandomSuffix: false, allowOverwrite: Boolean(etag),
          ...(etag ? { ifMatch: etag } : {}),
          contentType: "application/json; charset=utf-8", cacheControlMaxAge: 60
        });
      } catch (e) {
        if (e instanceof BlobPreconditionFailedError || (!etag && /already exists/i.test(e.message))) {
          throw new StateConflict();
        }
        throw e;
      }
    }
  };
};
class StateConflict extends Error {}
const getStore = () => (process.env.XUEBAO_FILE ? fileStore(process.env.XUEBAO_FILE) : blobStore());
let fileQueue = Promise.resolve();

const freshState = (now) => ({
  v: 2,
  startedAt: 0, // 第一次领礼物时才写入，之前不计时
  anchor: now - TRIP,
  lastClaimAt: 0,
  week: null,
  wallet: { balance: 0, earned: 0, ledger: [] },
  frag: { cycleStart: now, rate: round2(rand(1.7, 2.8)), given: 0, total: 0, pendingSkins: 0, redeemed: 0 },
  coupons: [],
  lastTeaAt: 0,
  seen: [],
  collection: {},
  meets: {},
  history: [],
  queue: [],
  wishes: []
});

// ---------- 计算 ----------
// 没开始时门口固定一份见面礼，不攒、不计时
const readyCount = (s, now) => (started(s) ? Math.max(0, Math.min(MAX, Math.floor((now - s.anchor) / TRIP))) : 1);

// 领礼物那一刻：上一周到期（或还没有）就从现在开始新的一周
const rollWeek = (s, now) => {
  if (!curWeek(s, now)) s.week = { start: now, paid: 0 };
};

// 每次带回的钱都是有意义的数字（520 是内置的每周上限，界面上不显示）
const LUCKY = [5.2, 6.6, 8.8, 9.9, 13.14, 16.8, 18.8, 20, 25.2, 33.3, 52, 52.1, 66, 66.6, 77.7, 88, 88.8, 99, 99.9, 100, 128, 131.4, 166, 168, 188, 199, 233, 250, 288];
const luckyNear = (amt, remaining) => {
  const ok = LUCKY.filter((v) => v <= remaining + 1e-9);
  if (!ok.length) return 0;
  // 在目标附近挑几个，随机取一个，避免每次都一样
  const near = ok.filter((v) => v >= amt * 0.6 && v <= amt * 1.6);
  if (near.length) return pick(near);
  return ok.reduce((b, v) => (Math.abs(v - amt) < Math.abs(b - amt) ? v : b), ok[0]);
};
const moneyFor = (s, now, giftsLeftInClaim) => {
  rollWeek(s, now);
  const remaining = round2(CAP - s.week.paid);
  if (remaining < LUCKY[0]) return 0;
  const hoursLeft = (s.week.start + WEEK - now) / HOUR;
  // 本周最后一次：挑不超过剩余额度的最大吉利数，尽量凑满
  if (hoursLeft < 10 && giftsLeftInClaim <= 1) return Math.max(...LUCKY.filter((v) => v <= remaining));
  const expected = giftsLeftInClaim + Math.floor(hoursLeft / DATA.TRIP_HOURS) * 0.6;
  let amt = (remaining / Math.max(1, expected)) * rand(0.7, 1.35);
  if (hoursLeft < 30) amt = Math.max(amt, remaining * 0.45);
  return luckyNear(amt, remaining);
};

const fragFor = (s, now) => {
  const f = s.frag;
  const budget = Math.min(TARGET, Math.floor(((now - f.cycleStart) / DAY) * f.rate)) - f.given;
  if (budget <= 0) return 0;
  const r = Math.random();
  const n = r < 0.08 ? randInt(5, 9) : r < 0.7 ? randInt(1, 4) : 0;
  return Math.min(n, budget, TARGET - f.given);
};

// 奶茶券：上一张（或开始计时）满 7 天后的第一份礼物里一定有，一份礼物只带一张
const teaFor = (s, now) => Boolean(s.lastTeaAt) && now - s.lastTeaAt >= WEEK;

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

let meetsSeen = new Set();
const meetFor = (dest) => {
  const pref = dest.meet && DATA.CHARS.find((c) => c.id === dest.meet);
  if (pref && Math.random() < 0.45) return pref;
  // 旅伴一共 170 多位：每份礼物 25% 的机会遇到一位；鸣潮和手办团六四开，还没遇见过的优先
  if (Math.random() >= 0.25) return null;
  const from = Math.random() < 0.6 ? "ww" : "fig";
  const pool = DATA.CHARS.filter((c) => (c.from || "ww") === from);
  const fresh = pool.filter((c) => !meetsSeen.has(c.id));
  return pick(fresh.length && Math.random() < 0.7 ? fresh : pool);
};

const makeGift = (s, now, first, giftsLeft) => {
  const dest = destFor(s, first);
  const meet = first ? null : meetFor(dest);
  if (first) rollWeek(s, now);
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
  const ready = readyCount(s, now), on = started(s), wk = curWeek(s, now);
  const sinceClaim = now - (s.lastClaimAt || 0);
  const phase = ready > 0 ? (ready >= MAX ? "waiting" : "back") : sinceClaim < REST ? "home" : "away";
  const nextAt = !on || ready >= MAX ? null : s.anchor + (ready + 1) * TRIP;
  const leaveAt = phase === "home" ? s.lastClaimAt + REST : null;
  return {
    now, phase, ready, max: MAX, nextAt, leaveAt, tripHours: DATA.TRIP_HOURS, started: on, startedAt: on ? s.startedAt : null,
    wallet: { balance: s.wallet.balance, earned: s.wallet.earned,  ledger: s.wallet.ledger.slice(0, 40) },
    teaDueAt: on && s.lastTeaAt ? s.lastTeaAt + WEEK : null,
    frag: { given: s.frag.given, target: TARGET, pendingSkins: s.frag.pendingSkins, redeemed: s.frag.redeemed, total: s.frag.total },
    coupons: s.coupons.slice(0, 40),
    collection: s.collection, meets: s.meets,
    history: s.history.slice(0, 60),
    wishes: (s.wishes || []).map(wishOut),
    queued: s.queue.length,
    adminEnabled: Boolean(process.env.XUEBAO_PASSWORD),
    ...extra
  };
};

async function handle(req, res) {
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

  if (body.action === "wish") {
    // 许愿要花雪雪存钱罐里的钱，所以只有雪雪能投硬币；泽泽可以看许愿树
    if (body.role !== "雪") { sendJson(res, 403, { error: "许愿要用雪雪存钱罐里的钱，让雪雪来投硬币吧。" }); return; }
    if (typeof body.requestId !== "string" || !/^[a-z\d-]{16,64}$/i.test(body.requestId)) {
      sendJson(res, 400, { error: "许愿请求无效。" }); return;
    }
    s.wishes ||= [];
    const previous = s.wishes.find((w) => w.requestId === body.requestId);
    if (previous) { sendJson(res, 200, view(s, now, { wish: wishOut(previous) })); return; }
    if (s.wallet.balance < DATA.WISH_COST - 0.001) {
      sendJson(res, 409, { ...view(s, now), error: `存钱罐里还差一点点，要 ¥${DATA.WISH_COST} 才能许愿。` }); return;
    }
    // 先抽签运，再抽愿望；按签运决定这一签带不带礼物（礼物不重复，抽完就只给签）
    let r = Math.random(), luck = DATA.WISH_LUCK[DATA.WISH_LUCK.length - 1];
    for (const L of DATA.WISH_LUCK) { if (r < L.p) { luck = L; break; } r -= L.p; }
    const recent = new Set(s.wishes.slice(0, 6).map((w) => w.card));
    const cards = DATA.WISH_CARDS.filter((c) => !recent.has(c.id));
    const card = pick(cards.length ? cards : DATA.WISH_CARDS).id;
    const owned = new Set(s.wishes.map((w) => w.gift).filter(Boolean));
    const pool = DATA.WISH_GIFTS.filter((g) => !owned.has(g.id));
    const gift = pool.length && Math.random() < luck.gift ? pick(pool).id : null;
    const entry = { card, luck: luck.id, gift, at: now, requestId: body.requestId };
    s.wishes.unshift(entry); s.wishes = s.wishes.slice(0, 200);
    s.wallet.balance = round2(s.wallet.balance - DATA.WISH_COST);
    s.wallet.ledger.unshift({ at: now, delta: -DATA.WISH_COST, note: `许愿池 · ${luck.name}`, kind: "wish" });
    s.wallet.ledger = s.wallet.ledger.slice(0, 300);
    await store.save(s);
    sendJson(res, 200, view(s, now, { wish: wishOut(entry) }));
    return;
  }

  if (body.action === "claim") {
    if (body.role !== "雪") { sendJson(res, 403, { error: "这份礼物留给雪雪拆。" }); return; }
    const n = readyCount(s, now);
    if (!n) { sendJson(res, 409, { error: "雪宝还在路上呢。", ...view(s, now) }); return; }
    const first = !s.history.length;
    // 第一次进门领礼物：从这一刻开始计时（旅行、每周的钱、奶茶券都从这里算起）
    if (!started(s)) { s.startedAt = now; s.anchor = now - TRIP; s.lastTeaAt = now; s.week = null; s.v = 2; }
    const gifts = [];
    meetsSeen = new Set(Object.keys(s.meets || {}));
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
}

async function serve(req, res) {
  try {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try { await handle(req, res); return; }
      catch (error) {
        if (!(error instanceof StateConflict)) throw error;
      }
    }
    sendJson(res, 409, { error: "小屋正在保存上一项操作，请再试一次。" });
  } catch (error) {
    if (error?.message?.includes("BLOB_READ_WRITE_TOKEN")) { sendJson(res, 503, { error: "存储还没有配置。" }); return; }
    console.error("xuebao", error);
    sendJson(res, 500, { error: "雪宝的小屋暂时打不开，过一会儿再试。" });
  }
}

module.exports = function xuebao(req, res) {
  if (!process.env.XUEBAO_FILE) return serve(req, res);
  const work = fileQueue.then(() => serve(req, res));
  fileQueue = work.catch(() => {});
  return work;
};
