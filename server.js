const http = require("http");
const path = require("path");
const fs = require("fs");
const fsp = require("fs/promises");
const { URL } = require("url");

const ROOT = __dirname;
const DATA_ROOT = path.resolve(process.env.DATA_DIR || ROOT);
const PORT = Number(process.env.PORT || 8080);
const VIDEOS_DIR = path.join(DATA_ROOT, "videos");
const PHOTOS_DIR = path.join(DATA_ROOT, "photos");
const MESSAGES_FILE = path.join(DATA_ROOT, "messages.txt");
const COMMENTS_FILE = path.join(DATA_ROOT, "comments.txt");
const LOG_G_FILE = path.join(DATA_ROOT, "logG.txt");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".ogg": "video/ogg",
  ".mov": "video/quicktime",
  ".m4v": "video/x-m4v"
};

const VIDEO_EXT = new Set([".mp4", ".webm", ".ogg", ".mov", ".m4v"]);
const PHOTO_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

const send = (res, status, data, contentType = "application/json; charset=utf-8") => {
  res.writeHead(status, { "Content-Type": contentType });
  res.end(data);
};

const sendJson = (res, status, payload) => {
  send(res, status, JSON.stringify(payload));
};

const ensureStorage = async () => {
  await fsp.mkdir(VIDEOS_DIR, { recursive: true });
  await fsp.mkdir(PHOTOS_DIR, { recursive: true });
  if (!fs.existsSync(MESSAGES_FILE)) {
    await fsp.writeFile(MESSAGES_FILE, "", "utf8");
  }
  if (!fs.existsSync(COMMENTS_FILE)) {
    await fsp.writeFile(COMMENTS_FILE, "", "utf8");
  }
  if (!fs.existsSync(LOG_G_FILE)) {
    await fsp.writeFile(LOG_G_FILE, "", "utf8");
  }
};

const readBody = async (req) => {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > 100 * 1024 * 1024) {
      throw new Error("Request body too large");
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
};

const parseJsonBody = async (req) => {
  const raw = await readBody(req);
  return raw ? JSON.parse(raw) : {};
};

const getClientIp = (req) => {
  const forwardedFor = req.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0].trim().replace(/\r?\n/g, "");
  }

  const realIp = req.headers["x-real-ip"];
  if (typeof realIp === "string" && realIp.trim()) {
    return realIp.trim().replace(/\r?\n/g, "");
  }

  const remoteAddress = String(req.socket?.remoteAddress || "").trim();
  if (!remoteAddress) return "unknown";
  return remoteAddress.startsWith("::ffff:") ? remoteAddress.slice(7) : remoteAddress;
};

const safeFileName = (name, fallback) => {
  const base = path.basename(String(name || "").trim());
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, "_");
  return cleaned || fallback;
};

const parseJsonlEntries = async (filePath) => {
  const raw = await fsp.readFile(filePath, "utf8");
  const lines = raw.split(/\r?\n/);
  return lines
    .filter((line) => line.length > 0)
    .map((line) => {
      try {
        return { raw: line, data: JSON.parse(line) };
      } catch {
        // 保留无法解析的原始行，避免后续重写时丢失历史内容
        return { raw: line, data: null };
      }
    });
};

const extractObjects = (entries) => {
  return entries
    .map((entry) => entry.data)
    .filter((item) => item && typeof item === "object");
};

const writeJsonlEntries = async (filePath, entries) => {
  const content = entries
    .map((entry) => (entry.data ? JSON.stringify(entry.data) : entry.raw))
    .join("\n");
  await fsp.writeFile(filePath, content ? `${content}\n` : "", "utf8");
};

const readMessagesWithComments = async () => {
  const messageEntries = await parseJsonlEntries(MESSAGES_FILE);
  const commentEntries = await parseJsonlEntries(COMMENTS_FILE);
  const messages = extractObjects(messageEntries);
  const comments = extractObjects(commentEntries);
  const commentsByMessage = {};

  comments.forEach((item) => {
    const key = String(item.messageId || "");
    if (!key) return;
    if (!commentsByMessage[key]) commentsByMessage[key] = [];
    commentsByMessage[key].push(item);
  });

  return messages
    .map((item) => ({
      ...item,
      comments: (commentsByMessage[String(item.id || "")] || []).sort((a, b) => {
        return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
      })
    }))
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
};

const listMedia = async (dir, baseUrl, extSet) => {
  const files = await fsp.readdir(dir, { withFileTypes: true });
  const rows = await Promise.all(
    files
      .filter((entry) => entry.isFile())
      .map(async (entry) => {
        const ext = path.extname(entry.name).toLowerCase();
        if (!extSet.has(ext)) return null;
        const abs = path.join(dir, entry.name);
        const stat = await fsp.stat(abs);
        return {
          name: entry.name,
          url: `${baseUrl}/${encodeURIComponent(entry.name)}`,
          updatedAt: stat.mtime.toISOString(),
          size: stat.size
        };
      })
  );
  return rows
    .filter(Boolean)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
};

const saveBase64File = async (dir, fileName, base64Data, fallbackName) => {
  const name = safeFileName(fileName, fallbackName);
  const abs = path.join(dir, name);
  const buffer = Buffer.from(String(base64Data || ""), "base64");
  await fsp.writeFile(abs, buffer);
  return name;
};

const serveFile = async (res, absPath, allowedRoot = ROOT) => {
  const safeRoot = path.resolve(allowedRoot);
  const safePath = path.resolve(absPath);
  if (!(safePath === safeRoot || safePath.startsWith(`${safeRoot}${path.sep}`))) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }

  try {
    const stat = await fsp.stat(safePath);
    if (!stat.isFile()) {
      sendJson(res, 404, { error: "Not found" });
      return;
    }

    const ext = path.extname(safePath).toLowerCase();
    const mime = MIME[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": mime });
    fs.createReadStream(safePath).pipe(res);
  } catch {
    sendJson(res, 404, { error: "Not found" });
  }
};

const server = http.createServer(async (req, res) => {
  try {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    const pathname = decodeURIComponent(url.pathname);

    if (req.method === "GET" && pathname === "/api/messages") {
      const messages = await readMessagesWithComments();
      sendJson(res, 200, messages);
      return;
    }

    if (req.method === "POST" && pathname === "/api/messages") {
      const body = await parseJsonBody(req);
      const content = String(body.content || "").trim();
      const role = String(body.role || "").trim();
      if (!content) {
        sendJson(res, 400, { error: "content is required" });
        return;
      }
      if (!["梅梅", "柔柔"].includes(role)) {
        sendJson(res, 400, { error: "invalid role" });
        return;
      }

      const now = new Date().toISOString();
      const line = {
        id: `m_${Date.now()}`,
        role,
        content,
        createdAt: now,
        updatedAt: now
      };
      await fsp.appendFile(MESSAGES_FILE, `${JSON.stringify(line)}\n`, "utf8");
      sendJson(res, 201, line);
      return;
    }

    if (req.method === "POST" && pathname === "/api/messages/delete") {
      const body = await parseJsonBody(req);
      const messageId = String(body.messageId || "").trim();
      if (!messageId) {
        sendJson(res, 400, { error: "messageId is required" });
        return;
      }

      const messageEntries = await parseJsonlEntries(MESSAGES_FILE);
      const filteredMessages = messageEntries.filter((entry) => {
        if (!entry.data || typeof entry.data !== "object") return true;
        return String(entry.data.id || "") !== messageId;
      });
      await writeJsonlEntries(MESSAGES_FILE, filteredMessages);

      const commentEntries = await parseJsonlEntries(COMMENTS_FILE);
      const filteredComments = commentEntries.filter((entry) => {
        if (!entry.data || typeof entry.data !== "object") return true;
        return String(entry.data.messageId || "") !== messageId;
      });
      await writeJsonlEntries(COMMENTS_FILE, filteredComments);

      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === "GET" && pathname === "/api/comments") {
      const comments = extractObjects(await parseJsonlEntries(COMMENTS_FILE));
      sendJson(res, 200, comments);
      return;
    }

    if (req.method === "POST" && pathname === "/api/comments") {
      const body = await parseJsonBody(req);
      const messageId = String(body.messageId || "").trim();
      const content = String(body.content || "").trim();
      const role = String(body.role || "").trim();
      if (!messageId || !content) {
        sendJson(res, 400, { error: "messageId and content are required" });
        return;
      }

      const safeRole = role === "梅梅" || role === "柔柔" ? role : "";
      const line = {
        id: `c_${Date.now()}`,
        messageId,
        content,
        role: safeRole,
        createdAt: new Date().toISOString()
      };
      await fsp.appendFile(COMMENTS_FILE, `${JSON.stringify(line)}\n`, "utf8");
      sendJson(res, 201, line);
      return;
    }

    if (req.method === "POST" && pathname === "/api/comments/delete-message") {
      const body = await parseJsonBody(req);
      const messageId = String(body.messageId || "").trim();
      if (!messageId) {
        sendJson(res, 400, { error: "messageId is required" });
        return;
      }

      const entries = await parseJsonlEntries(COMMENTS_FILE);
      const filteredEntries = entries.filter((entry) => {
        if (!entry.data || typeof entry.data !== "object") return true;
        return String(entry.data.messageId || "") !== messageId;
      });
      await writeJsonlEntries(COMMENTS_FILE, filteredEntries);
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === "POST" && pathname === "/api/figure-click") {
      const ip = getClientIp(req);
      const line = `${new Date().toISOString()} | ${ip}\n`;
      await fsp.appendFile(LOG_G_FILE, line, "utf8");
      sendJson(res, 201, { ok: true });
      return;
    }

    if (req.method === "GET" && pathname === "/api/media/videos") {
      const items = await listMedia(VIDEOS_DIR, "/videos", VIDEO_EXT);
      sendJson(res, 200, items);
      return;
    }

    if (req.method === "GET" && pathname === "/api/media/photos") {
      const items = await listMedia(PHOTOS_DIR, "/photos", PHOTO_EXT);
      sendJson(res, 200, items);
      return;
    }

    if (req.method === "POST" && pathname === "/api/media/videos") {
      const body = await parseJsonBody(req);
      const saved = await saveBase64File(VIDEOS_DIR, body.filename, body.data, `video_${Date.now()}.mp4`);
      sendJson(res, 201, { ok: true, name: saved, url: `/videos/${encodeURIComponent(saved)}` });
      return;
    }

    if (req.method === "POST" && pathname === "/api/media/photos") {
      const body = await parseJsonBody(req);
      const saved = await saveBase64File(PHOTOS_DIR, body.filename, body.data, `photo_${Date.now()}.jpg`);
      sendJson(res, 201, { ok: true, name: saved, url: `/photos/${encodeURIComponent(saved)}` });
      return;
    }

    if (pathname.startsWith("/videos/")) {
      const rel = pathname.slice("/videos/".length);
      await serveFile(res, path.join(VIDEOS_DIR, rel), DATA_ROOT);
      return;
    }

    if (pathname.startsWith("/photos/")) {
      const rel = pathname.slice("/photos/".length);
      await serveFile(res, path.join(PHOTOS_DIR, rel), DATA_ROOT);
      return;
    }

    const reqPath = pathname === "/" ? "/index.html" : pathname;
    await serveFile(res, path.join(ROOT, reqPath), ROOT);
  } catch (error) {
    sendJson(res, 500, { error: error?.message || "Internal Server Error" });
  }
});

ensureStorage().then(() => {
  server.listen(PORT, () => {
    console.log(`Local server running at http://localhost:${PORT}`);
    console.log(`Data dir: ${DATA_ROOT}`);
    console.log(`Videos dir: ${VIDEOS_DIR}`);
    console.log(`Photos dir: ${PHOTOS_DIR}`);
    console.log(`Messages file: ${MESSAGES_FILE}`);
    console.log(`Comments file: ${COMMENTS_FILE}`);
    console.log(`Figure click log file: ${LOG_G_FILE}`);
  });
});
