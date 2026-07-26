"use strict";

const sendJson = (res, status, payload) => {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.status(status).json(payload);
};

module.exports = async function comicChapters(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  try {
    const { list } = await import("@vercel/blob");
    const result = await list({
      prefix: "comic-chapters/manifests/",
      limit: 1000
    });

    const manifests = await Promise.all(
      result.blobs
        .filter((blob) => blob.pathname.endsWith(".json"))
        .map(async (blob) => {
          try {
            const separator = blob.url.includes("?") ? "&" : "?";
            const response = await fetch(`${blob.url}${separator}v=${Date.now()}`, {
              cache: "no-store"
            });
            if (!response.ok) return null;
            const manifest = await response.json();
            if (!manifest || !Array.isArray(manifest.pages) || !manifest.pages.length) return null;
            return manifest;
          } catch {
            return null;
          }
        })
    );

    const chapters = manifests
      .filter(Boolean)
      .sort((a, b) => {
        const numberDifference = Number(a.chapterNumber || 999) - Number(b.chapterNumber || 999);
        if (numberDifference) return numberDifference;
        return new Date(a.updatedAt || a.createdAt || 0).getTime() -
          new Date(b.updatedAt || b.createdAt || 0).getTime();
      });
    sendJson(res, 200, { chapters });
  } catch (error) {
    if (error?.message?.includes("BLOB_READ_WRITE_TOKEN")) {
      sendJson(res, 200, { chapters: [], storage: "not-configured" });
      return;
    }
    console.error("comic-chapters", error);
    sendJson(res, 500, { error: "暂时无法读取云端篇章。" });
  }
};
