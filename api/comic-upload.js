"use strict";

const readJsonBody = (req) => {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  return {};
};

const sendJson = (res, status, payload) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.status(status).json(payload);
};

const safeChapterId = (value) => {
  const id = String(value || "").trim();
  return /^[a-z0-9-]{12,90}$/i.test(id) ? id : "";
};

module.exports = async function comicUpload(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  try {
    const body = readJsonBody(req);
    const expectedPassword = String(process.env.COMIC_UPLOAD_PASSWORD || "");
    if (!expectedPassword) {
      sendJson(res, 503, { error: "漫画上传服务尚未配置。" });
      return;
    }
    if (String(body.password || "") !== expectedPassword) {
      sendJson(res, 401, { error: "密码不正确。" });
      return;
    }

    const chapterId = safeChapterId(body.chapterId);
    if (!chapterId) {
      sendJson(res, 400, { error: "无效的篇章编号。" });
      return;
    }

    const { put } = await import("@vercel/blob");

    if (body.action === "page" || body.action === "cover") {
      const isCover = body.action === "cover";
      const pageIndex = isCover ? 0 : Number(body.pageIndex);
      const contentType = String(body.contentType || "");
      const data = String(body.data || "");
      if (!isCover && (!Number.isInteger(pageIndex) || pageIndex < 1 || pageIndex > 80)) {
        sendJson(res, 400, { error: "页码必须在 1–80 之间。" });
        return;
      }
      if (contentType !== "image/webp") {
        sendJson(res, 400, { error: "漫画页面必须是 WebP 图片。" });
        return;
      }
      if (!data || data.length > 3.9 * 1024 * 1024) {
        sendJson(res, 413, { error: "单页图片过大。" });
        return;
      }

      const bytes = Buffer.from(data, "base64");
      if (!bytes.length || bytes.length > 3 * 1024 * 1024) {
        sendJson(res, 413, { error: "单页图片过大。" });
        return;
      }

      const fileName = isCover
        ? "cover.webp"
        : `page-${String(pageIndex).padStart(3, "0")}.webp`;
      const blob = await put(`comic-chapters/${chapterId}/${fileName}`, bytes, {
        access: "public",
        addRandomSuffix: false,
        allowOverwrite: true,
        cacheControlMaxAge: 60,
        contentType: "image/webp"
      });
      sendJson(res, 201, {
        ok: true,
        url: blob.url,
        pathname: blob.pathname,
        width: Number(body.width) || null,
        height: Number(body.height) || null
      });
      return;
    }

    if (body.action === "manifest") {
      const chapterNumber = Number(body.chapterNumber);
      const title = String(body.title || "").trim().slice(0, 48);
      const summary = String(body.summary || "").trim().slice(0, 110);
      const cover = String(body.cover || "").trim();
      const story = String(body.story || "").trim();
      const eyebrow = String(body.eyebrow || "").trim().slice(0, 72);
      const pages = Array.isArray(body.pages)
        ? body.pages
            .map((url) => String(url || "").trim())
            .filter((url) => /^https:\/\/.+\.public\.blob\.vercel-storage\.com\//i.test(url))
            .slice(0, 80)
        : [];

      if (
        !Number.isInteger(chapterNumber) ||
        chapterNumber < 1 ||
        chapterNumber > 99 ||
        !title ||
        !summary ||
        !/^https:\/\/.+\.public\.blob\.vercel-storage\.com\//i.test(cover) ||
        !story ||
        story.length > 200000 ||
        !pages.length
      ) {
        sendJson(res, 400, { error: "篇号、封面、漫画图或文字故事不完整。" });
        return;
      }

      const manifest = {
        id: chapterId,
        chapterNumber,
        title,
        summary,
        cover,
        story,
        pages,
        pageCount: pages.length,
        eyebrow: eyebrow || `第一季《雪落纽约》／第${String(chapterNumber).padStart(2, "0")}篇`,
        updatedAt: new Date().toISOString()
      };
      const blob = await put(
        `comic-chapters/manifests/${chapterId}.json`,
        JSON.stringify(manifest),
        {
          access: "public",
          addRandomSuffix: false,
          allowOverwrite: true,
          cacheControlMaxAge: 60,
          contentType: "application/json"
        }
      );
      sendJson(res, 201, { ok: true, manifest, url: blob.url });
      return;
    }

    sendJson(res, 400, { error: "未知的上传操作。" });
  } catch (error) {
    console.error("comic-upload", error);
    sendJson(res, 500, { error: "上传服务暂时不可用，请稍后重试。" });
  }
};
