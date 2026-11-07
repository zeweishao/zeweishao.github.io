"use strict";

/*
 * 星星邮差 · 信件接口
 *   GET  /api/star-letters                → { letters, needsPassword }
 *   POST /api/star-letters {action:"create", author, title, text, date, password?}
 *   POST /api/star-letters {action:"delete", id, author, password?}
 *
 * 线上存 Vercel Blob（star-letters/<id>-<随机>.json）；本地 server.js 设置 STAR_LETTERS_FILE 时存 JSON 文件。
 * 信在寄到日期（按收信人所在时区）之前，正文和标题不下发。
 * 设置环境变量 STAR_POST_PASSWORD 后，写信和撤回需要口令。
 */

const AUTHORS = {
  "泽": { to: "雪", tz: "America/New_York" }, // 泽在杭州，信寄到纽约
  "雪": { to: "泽", tz: "Asia/Shanghai" }      // 雪在纽约，信寄到杭州
};
const PREFIX = "star-letters/";

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

const todayIn = (tz) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const addDays = (ymd, n) => { const d = new Date(ymd + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

// ---------- 存储 ----------
const fileStore = (file) => {
  const fsp = require("fs/promises");
  const readAll = async () => { try { return JSON.parse(await fsp.readFile(file, "utf8")); } catch { return []; } };
  return {
    list: readAll,
    async add(letter) { const all = await readAll(); all.push(letter); await fsp.writeFile(file, JSON.stringify(all, null, 2)); },
    async remove(id) { const all = await readAll(); await fsp.writeFile(file, JSON.stringify(all.filter((l) => l.id !== id), null, 2)); }
  };
};

const blobStore = () => ({
  async list() {
    const { list } = await import("@vercel/blob");
    const blobs = [];
    let cursor;
    do {
      const page = await list({ prefix: PREFIX, limit: 1000, cursor });
      blobs.push(...page.blobs);
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    const letters = await Promise.all(blobs.filter((b) => b.pathname.endsWith(".json")).map(async (b) => {
      try {
        const r = await fetch(`${b.url}${b.url.includes("?") ? "&" : "?"}v=${Date.now()}`, { cache: "no-store" });
        return r.ok ? { ...(await r.json()), _url: b.url } : null;
      } catch { return null; }
    }));
    return letters.filter(Boolean);
  },
  async add(letter) {
    const { put } = await import("@vercel/blob");
    await put(`${PREFIX}${letter.id}.json`, JSON.stringify(letter), {
      access: "public", addRandomSuffix: true, contentType: "application/json; charset=utf-8"
    });
  },
  async remove(id) {
    const { list, del } = await import("@vercel/blob");
    const { blobs } = await list({ prefix: `${PREFIX}${id}`, limit: 10 });
    if (blobs.length) await del(blobs.map((b) => b.url));
  }
});

const getStore = () => (process.env.STAR_LETTERS_FILE ? fileStore(process.env.STAR_LETTERS_FILE) : blobStore());

// ---------- 处理 ----------
const publicView = (l) => {
  const due = l.date <= todayIn(AUTHORS[l.author].tz);
  const base = { id: l.id, author: l.author, to: AUTHORS[l.author].to, date: l.date, createdAt: l.createdAt };
  return due ? { ...base, title: l.title, text: l.text } : { ...base, locked: true };
};

module.exports = async function starLetters(req, res) {
  const password = String(process.env.STAR_POST_PASSWORD || "");
  try {
    const store = getStore();

    if (req.method === "GET") {
      const letters = (await store.list())
        .filter((l) => l && AUTHORS[l.author] && /^\d{4}-\d{2}-\d{2}$/.test(l.date))
        .map(publicView)
        .sort((a, b) => a.date.localeCompare(b.date) || String(a.createdAt).localeCompare(String(b.createdAt)));
      sendJson(res, 200, { letters, needsPassword: Boolean(password) });
      return;
    }

    if (req.method !== "POST") {
      res.setHeader("Allow", "GET, POST");
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }

    const body = readJsonBody(req);
    if (password && String(body.password || "") !== password) {
      sendJson(res, 401, { error: "口令不对，再试一次。" });
      return;
    }
    const author = String(body.author || "");
    if (!AUTHORS[author]) { sendJson(res, 400, { error: "请先选择是谁写的。" }); return; }

    if (body.action === "delete") {
      const id = String(body.id || "");
      if (!/^[a-z0-9-]{8,40}$/i.test(id)) { sendJson(res, 400, { error: "无效的信件。" }); return; }
      const target = (await store.list()).find((l) => l.id === id);
      if (!target) { sendJson(res, 404, { error: "这封信已经不在了。" }); return; }
      if (target.author !== author) { sendJson(res, 403, { error: "只能撤回自己写的信。" }); return; }
      await store.remove(id);
      sendJson(res, 200, { ok: true });
      return;
    }

    if (body.action !== "create") { sendJson(res, 400, { error: "未知操作。" }); return; }

    const title = String(body.title || "").trim().slice(0, 30);
    const text = String(body.text || "").replace(/\r\n?/g, "\n").trim();
    const date = String(body.date || "");
    if (!title) { sendJson(res, 400, { error: "给这封信起个标题吧。" }); return; }
    if (!text) { sendJson(res, 400, { error: "信还是空的。" }); return; }
    if (text.length > 2000) { sendJson(res, 400, { error: "信太长啦，2000 字以内。" }); return; }
    const today = todayIn(AUTHORS[author].tz);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < addDays(today, -1) || date > addDays(today, 366)) {
      sendJson(res, 400, { error: "寄到日期不对。" });
      return;
    }

    const now = new Date();
    const letter = {
      id: `${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      author, title, text, date, createdAt: now.toISOString()
    };
    await store.add(letter);
    sendJson(res, 201, { letter: publicView(letter) });
  } catch (error) {
    if (error?.message?.includes("BLOB_READ_WRITE_TOKEN")) {
      sendJson(res, 503, { error: "信箱存储还没有配置。" });
      return;
    }
    console.error("star-letters", error);
    sendJson(res, 500, { error: "信箱暂时打不开，过一会儿再试。" });
  }
};
