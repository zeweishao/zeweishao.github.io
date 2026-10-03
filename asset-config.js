(() => {
  "use strict";

  // 图鉴素材通过 R2 正式域名提供；本地预览仍使用本地素材。
  const REMOTE_FIGURE_ASSET_BASE = "https://assets.isnow.life/figures/v20261003/";
  const LOCAL_FIGURE_ASSET_BASE = "figures-assets/";
  const isLocal = ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
  const configured = String(window.FIGURE_ASSET_BASE || "").trim();
  const selected = isLocal ? LOCAL_FIGURE_ASSET_BASE : configured || REMOTE_FIGURE_ASSET_BASE || LOCAL_FIGURE_ASSET_BASE;
  const base = new URL(selected.endsWith("/") ? selected : `${selected}/`, document.baseURI);
  window.FIGURE_ASSET_BASE = base.href;

  // 首屏默认立绘也使用同一地址，避免浏览器提前请求部署中不存在的本地素材。
  const loadInitialPortraits = () => {
    document.querySelectorAll("img[data-figure-asset]").forEach((image) => {
      if (!image.getAttribute("src")) image.src = new URL(image.dataset.figureAsset, base).href;
    });
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", loadInitialPortraits, { once: true });
  else loadInitialPortraits();
})();
