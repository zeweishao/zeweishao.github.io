(() => {
  const STORAGE_KEYS = {
    messages: "isnow_messages",
    videos: "isnow_videos",
    albums: "isnow_albums"
  };

  const readList = (key) => {
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const writeList = (key, value) => {
    localStorage.setItem(key, JSON.stringify(value));
  };

  const deriveApiOrigins = () => {
    const configured = String(window.ISNOW_API_ORIGIN || "").trim();
    const custom = window.localStorage.getItem("isnow_api_origin");
    const items = [];

    if (configured) items.push(configured.replace(/\/$/, ""));
    if (custom) items.push(custom.replace(/\/$/, ""));
    if (window.location.protocol === "http:" || window.location.protocol === "https:") {
      items.push(window.location.origin);
    }
    items.push("http://localhost:8080");
    items.push("http://127.0.0.1:8080");

    return Array.from(new Set(items));
  };

  const API_ORIGIN_CANDIDATES = deriveApiOrigins();
  let ACTIVE_API_ORIGIN = API_ORIGIN_CANDIDATES[0] || "http://localhost:8080";

  const toAssetUrl = (url) => {
    if (!url) return "";
    if (/^https?:\/\//i.test(url)) return url;
    if (url.startsWith("/")) return `${ACTIVE_API_ORIGIN}${url}`;
    return `${ACTIVE_API_ORIGIN}/${url}`;
  };

  const API = {
    messages: "/api/messages",
    messagesDelete: "/api/messages/delete",
    comments: "/api/comments",
    videos: "/api/media/videos",
    photos: "/api/media/photos"
  };

  const isHttpRuntime = () => {
    return window.location.protocol === "http:" || window.location.protocol === "https:";
  };

  const apiRequest = async (pathOrUrl, options = {}) => {
    const isAbsolute = /^https?:\/\//i.test(pathOrUrl);
    const urls = isAbsolute
      ? [pathOrUrl]
      : API_ORIGIN_CANDIDATES.map((origin) => `${origin}${pathOrUrl}`);

    const headers = { ...(options.headers || {}) };
    if (options.body && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }

    let lastError = null;
    for (const url of urls) {
      try {
        const response = await fetch(url, {
          headers,
          ...options
        });
        if (!response.ok) {
          const text = await response.text();
          lastError = new Error(text || `Request failed: ${response.status}`);
          continue;
        }

        const origin = new URL(url).origin;
        ACTIVE_API_ORIGIN = origin;
        if (response.status === 204) return null;
        return response.json();
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error("API unavailable");
  };

  const parseKeyValueText = (raw) => {
    return String(raw || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .reduce((acc, line) => {
        const idx = line.indexOf("=");
        if (idx <= 0) return acc;
        const key = line.slice(0, idx).trim();
        const value = line.slice(idx + 1).trim();
        if (key) acc[key] = value;
        return acc;
      }, {});
  };

  const loadCommendTextMap = async () => {
    try {
      const response = await fetch("config.config", { cache: "no-store" });
      if (!response.ok) return {};
      const raw = await response.text();
      return parseKeyValueText(raw);
    } catch {
      return {};
    }
  };

  const applyTextMapToDom = (textMap) => {
    if (!textMap || typeof textMap !== "object") return;
    document.querySelectorAll("[data-text-key]").forEach((node) => {
      const key = node.getAttribute("data-text-key");
      if (key && Object.prototype.hasOwnProperty.call(textMap, key)) {
        node.textContent = textMap[key];
      }
    });
    document.querySelectorAll("[data-placeholder-key]").forEach((node) => {
      const key = node.getAttribute("data-placeholder-key");
      if (key && Object.prototype.hasOwnProperty.call(textMap, key)) {
        node.setAttribute("placeholder", textMap[key]);
      }
    });
    document.querySelectorAll("[data-aria-label-key]").forEach((node) => {
      const key = node.getAttribute("data-aria-label-key");
      if (key && Object.prototype.hasOwnProperty.call(textMap, key)) {
        node.setAttribute("aria-label", textMap[key]);
      }
    });
  };

  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || "");
        const base64 = result.includes(",") ? result.split(",")[1] : result;
        resolve(base64);
      };
      reader.onerror = () => reject(new Error("读取文件失败"));
      reader.readAsDataURL(file);
    });
  };

  const esc = (value) =>
    String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");

  const today = () => {
    const now = new Date();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${now.getFullYear()}-${m}-${d}`;
  };

  const fmtDate = (dateValue) => {
    if (!dateValue) return "-";
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
  };

  const fmtDateTime = (dateValue) => {
    if (!dateValue) return "-";
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const messages = readList(STORAGE_KEYS.messages);
  const videos = readList(STORAGE_KEYS.videos);
  const albums = readList(STORAGE_KEYS.albums);

  const allTimestamps = () => {
    const stamp = [];
    for (const item of [...messages, ...videos, ...albums]) {
      if (item && item.updatedAt) stamp.push(item.updatedAt);
      else if (item && item.createdAt) stamp.push(item.createdAt);
      else if (item && item.date) stamp.push(item.date);
    }
    return stamp;
  };

  const updateHomeStats = () => {
    const statMessages = document.getElementById("statMessages");
    const statVideos = document.getElementById("statVideos");
    const statAlbums = document.getElementById("statAlbums");
    const statUpdated = document.getElementById("statUpdated");

    if (!statMessages || !statVideos || !statAlbums || !statUpdated) return;

    statMessages.textContent = String(messages.length);
    statVideos.textContent = String(videos.length);
    statAlbums.textContent = String(albums.length);

    const stamps = allTimestamps();
    if (!stamps.length) {
      statUpdated.textContent = "-";
      return;
    }

    const latest = stamps
      .map((value) => new Date(value))
      .filter((date) => !Number.isNaN(date.getTime()))
      .sort((a, b) => b.getTime() - a.getTime())[0];

    statUpdated.textContent = latest
      ? latest.toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" })
      : "-";
  };

  const syncHomeFolderStats = async () => {
    const statVideos = document.getElementById("statVideos");
    const statAlbums = document.getElementById("statAlbums");
    if (!statVideos || !statAlbums || !isHttpRuntime()) return;

    try {
      const [videoPayload, photoPayload] = await Promise.all([
        apiRequest(API.videos, { method: "GET" }),
        apiRequest(API.photos, { method: "GET" })
      ]);
      const videoItems = Array.isArray(videoPayload) ? videoPayload : [];
      const photoItems = Array.isArray(photoPayload) ? photoPayload : [];
      videos.splice(0, videos.length, ...videoItems);
      albums.splice(0, albums.length, ...photoItems);
      updateHomeStats();
    } catch {
      // ignore
    }
  };

  const initMenuDropdown = () => {
    const menus = document.querySelectorAll(".menu-dropdown");
    if (!menus.length) return;

    menus.forEach((menu) => {
      menu.querySelectorAll("a").forEach((link) => {
        link.addEventListener("click", () => {
          menu.removeAttribute("open");
        });
      });
    });

    document.addEventListener("click", (event) => {
      menus.forEach((menu) => {
        if (!menu.contains(event.target)) {
          menu.removeAttribute("open");
        }
      });
    });
  };

  const initHomeCarousel = () => {
    const track = document.getElementById("homeCarouselTrack");
    const dotsWrap = document.getElementById("carouselDots");
    const prevBtn = document.getElementById("carouselPrev");
    const nextBtn = document.getElementById("carouselNext");
    const viewport = track?.closest(".home-carousel");
    if (!track || !dotsWrap || !prevBtn || !nextBtn || !viewport) return;

    const slides = Array.from(track.querySelectorAll(".carousel-slide"));
    if (!slides.length) return;

    let current = slides.findIndex((slide) => slide.classList.contains("active"));
    if (current < 0) current = 0;

    dotsWrap.innerHTML = slides
      .map(
        (_, idx) =>
          `<button class="carousel-dot${idx === current ? " active" : ""}" type="button" data-carousel-dot="${idx}" aria-label="切换到第${idx + 1}张"></button>`
      )
      .join("");

    const dots = Array.from(dotsWrap.querySelectorAll(".carousel-dot"));
    const updateTrackPosition = () => {
      const slide = slides[current];
      if (!slide) return;

      const viewportWidth = viewport.clientWidth;
      const trackWidth = track.scrollWidth;
      const slideCenter = slide.offsetLeft + slide.offsetWidth / 2;
      let translateX = viewportWidth / 2 - slideCenter;

      const minTranslate = Math.min(0, viewportWidth - trackWidth);
      if (translateX > 0) translateX = 0;
      if (translateX < minTranslate) translateX = minTranslate;

      track.style.transform = `translate3d(${translateX}px, 0, 0)`;
    };

    const setActive = (index) => {
      current = (index + slides.length) % slides.length;
      slides.forEach((slide, idx) => {
        slide.classList.toggle("active", idx === current);
      });
      dots.forEach((dot, idx) => {
        dot.classList.toggle("active", idx === current);
      });
      updateTrackPosition();
    };

    let timer = null;
    const stopAuto = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };

    const startAuto = () => {
      stopAuto();
      timer = setInterval(() => {
        setActive(current + 1);
      }, 4200);
    };

    prevBtn.addEventListener("click", () => {
      setActive(current - 1);
      startAuto();
    });

    nextBtn.addEventListener("click", () => {
      setActive(current + 1);
      startAuto();
    });

    dotsWrap.addEventListener("click", (event) => {
      const button = event.target.closest("[data-carousel-dot]");
      if (!button) return;

      const idx = Number(button.getAttribute("data-carousel-dot"));
      if (Number.isNaN(idx)) return;

      setActive(idx);
      startAuto();
    });

    viewport.addEventListener("mouseenter", stopAuto);
    viewport.addEventListener("mouseleave", startAuto);
    viewport.addEventListener("focusin", stopAuto);
    viewport.addEventListener("focusout", startAuto);

    window.addEventListener("resize", updateTrackPosition);

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) stopAuto();
      else startAuto();
    });

    setActive(current);
    startAuto();
  };

  const initMessagesPage = () => {
    const form = document.getElementById("messageForm");
    const list = document.getElementById("messageList");
    if (!form || !list) return;

    const messageText = {
      "msg.empty": "还没有留言记录，先写下今天的第一句吧。",
      "msg.delete_btn": "删除",
      "msg.comment_btn": "评论",
      "msg.expand_btn": "展开",
      "msg.collapse_btn": "收起",
      "msg.error_content_required": "请输入留言内容。",
      "msg.error_verify_failed": "验证失败。",
      "msg.error_comment_not_found": "未找到对应留言，请重试。",
      "msg.error_backend_unavailable": "写入失败，请确认后端可用。",
      "msg.prompt_delete_verify": "请输入验证信息：",
      "msg.alert_delete_failed": "验证失败，无法删除该留言。",
      "msg.alert_delete_backend_failed": "删除失败，请确认后端可用。",
      "msg.error_backend_connect": "后端连接失败，请确认后端地址与服务状态。",
      "msg.error_http_open": "请通过 HTTP/HTTPS 打开页面。"
    };
    const text = (key, fallback = "") => messageText[key] ?? fallback;

    const MESSAGE_ROLE_BY_PASSCODE = {
      "520": "梅梅",
      "1314": "柔柔"
    };
    const COMMENT_ROLE_BY_PASSCODE = {
      "0123": "柔柔",
      "0501": "梅梅"
    };
    const DELETE_PASSCODE = "0";

    const contentEl = document.getElementById("messageContent");
    const messagePasscodeEl = document.getElementById("messagePasscode");
    const messageFormErrorEl = document.getElementById("messageFormError");
    const openModalEl = document.getElementById("openMessageModal");
    const modalEl = document.getElementById("messageModal");
    const closeModalEl = document.getElementById("closeMessageModal");
    const cancelModalEl = document.getElementById("cancelMessageModal");
    const commentModalEl = document.getElementById("commentModal");
    const commentFormEl = document.getElementById("commentForm");
    const commentContentEl = document.getElementById("commentContent");
    const commentPasscodeEl = document.getElementById("commentPasscode");
    const commentFormErrorEl = document.getElementById("commentFormError");
    const closeCommentModalEl = document.getElementById("closeCommentModal");
    const cancelCommentModalEl = document.getElementById("cancelCommentModal");
    let activeCommentMessageId = "";
    let backendError = "";

    const normalizeDigits = (value) => {
      return String(value || "")
        .trim()
        .replace(/[０-９]/g, (char) => String(char.charCodeAt(0) - 65248))
        .replace(/\D/g, "");
    };

    const setError = (el, message) => {
      if (el) el.textContent = message;
    };

    const normalizeMessage = (item) => {
      const content = String(item?.content || "").trim();
      const at = item?.createdAt || item?.updatedAt || item?.date || "";
      const role = String(item?.role || "").trim();
      const comments = Array.isArray(item?.comments)
        ? item.comments
            .map((comment) => {
              const commentContent = String(comment?.content || "").trim();
              const commentAt = comment?.createdAt || comment?.updatedAt || comment?.date || "";
              const commentRole = String(comment?.role || "").trim();
              if (!commentContent) return null;
              return {
                id: String(comment?.id || `c_${Date.now()}`),
                content: commentContent,
                at: commentAt,
                role: commentRole
              };
            })
            .filter(Boolean)
        : [];
      return { ...item, content, at, role, comments };
    };

    const messageStamp = (item) => {
      const value = new Date(item.at).getTime();
      return Number.isNaN(value) ? 0 : value;
    };

    const commentStamp = (item) => {
      const value = new Date(item.at).getTime();
      return Number.isNaN(value) ? 0 : value;
    };

    const openModal = () => {
      if (!modalEl) return;
      setError(messageFormErrorEl, "");
      modalEl.hidden = false;
      document.body.style.overflow = "hidden";
      setTimeout(() => {
        contentEl?.focus();
      }, 40);
    };

    const closeModal = () => {
      if (!modalEl) return;
      modalEl.hidden = true;
      document.body.style.overflow = "";
      form.reset();
      setError(messageFormErrorEl, "");
    };

    const openCommentModal = (messageId) => {
      if (!commentModalEl || !commentFormEl) return;
      activeCommentMessageId = messageId;
      setError(commentFormErrorEl, "");
      commentModalEl.hidden = false;
      document.body.style.overflow = "hidden";
      setTimeout(() => {
        commentContentEl?.focus();
      }, 40);
    };

    const closeCommentModal = () => {
      if (!commentModalEl || !commentFormEl) return;
      commentModalEl.hidden = true;
      document.body.style.overflow = "";
      commentFormEl.reset();
      activeCommentMessageId = "";
      setError(commentFormErrorEl, "");
    };

    const render = (tips = "") => {
      const ordered = messages
        .map(normalizeMessage)
        .filter((item) => item.content)
        .sort((a, b) => messageStamp(b) - messageStamp(a));

      if (!ordered.length) {
        const fallback = tips || backendError;
        list.innerHTML = `<div class="empty">${fallback || text("msg.empty")}</div>`;
        return;
      }

      list.innerHTML = ordered
        .map((item, index) => {
          const tone = index % 8;
          const needsExpand = item.content.length > 120 || item.content.split("\n").length > 4;
          const comments = [...item.comments].sort((a, b) => commentStamp(a) - commentStamp(b));
          const commentsHtml = comments.length
            ? `
              <div class="message-comment-list">
                ${comments
                  .map(
                    (comment) => `
                      <article class="message-comment-item ${comment.role === "柔柔" ? "comment-role-rou" : comment.role === "梅梅" ? "comment-role-mei" : ""}">
                        <p class="message-comment-role">${comment.role ? `${esc(comment.role)}：` : ""}</p>
                        <p>${esc(comment.content)}</p>
                        <p class="message-comment-time">${fmtDateTime(comment.at)}</p>
                      </article>
                    `
                  )
                  .join("")}
              </div>
            `
            : "";
          return `
            <article class="message-card message-tone-${tone}">
              <button class="message-delete-btn" type="button" data-remove-message="${esc(item.id)}" aria-label="${esc(text("msg.delete_btn"))}">${esc(text("msg.delete_btn"))}</button>
              <p class="message-role">${item.role ? `${esc(item.role)}：` : ""}</p>
              <p class="message-text${needsExpand ? " collapsed" : ""}">${esc(item.content)}</p>
              <p class="message-meta">留言时间 · ${fmtDateTime(item.at)}</p>
              <div class="message-actions">
                <div>${needsExpand ? `<button class="message-expand" type="button" data-toggle-expand>${esc(text("msg.expand_btn"))}</button>` : ""}</div>
                <button class="message-comment-btn" type="button" data-open-comment="${esc(item.id)}">${esc(text("msg.comment_btn"))}${comments.length ? ` (${comments.length})` : ""}</button>
              </div>
              ${commentsHtml}
            </article>
          `;
        })
        .join("");
    };

    const loadMessages = async () => {
      if (!isHttpRuntime()) {
        backendError = text("msg.error_http_open");
        render(backendError);
        return false;
      }

      try {
        const payload = await apiRequest(API.messages, { method: "GET" });
        const items = Array.isArray(payload) ? payload.map(normalizeMessage) : [];
        messages.splice(0, messages.length, ...items);
        writeList(STORAGE_KEYS.messages, messages);
        backendError = "";
        render();
        updateHomeStats();
        return true;
      } catch (error) {
        backendError = text("msg.error_backend_connect");
        const cached = readList(STORAGE_KEYS.messages).map(normalizeMessage);
        messages.splice(0, messages.length, ...cached);
        render(backendError);
        return false;
      }
    };

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const content = contentEl?.value.trim() || "";
      if (!content) {
        setError(messageFormErrorEl, text("msg.error_content_required"));
        return;
      }

      const passcode = messagePasscodeEl?.value.trim() || "";
      const role = MESSAGE_ROLE_BY_PASSCODE[passcode];
      if (!role) {
        setError(messageFormErrorEl, text("msg.error_verify_failed"));
        return;
      }

      try {
        await apiRequest(API.messages, {
          method: "POST",
          body: JSON.stringify({
            role,
            content
          })
        });
      } catch {
        setError(messageFormErrorEl, text("msg.error_backend_unavailable"));
        return;
      }

      closeModal();
      await loadMessages();
    });

    commentFormEl?.addEventListener("submit", async (event) => {
      event.preventDefault();

      const content = commentContentEl?.value.trim() || "";
      if (!content) {
        setError(commentFormErrorEl, text("msg.error_content_required"));
        return;
      }

      const passcode = normalizeDigits(commentPasscodeEl?.value || "").padStart(4, "0");
      const role = COMMENT_ROLE_BY_PASSCODE[passcode];
      if (!role) {
        setError(commentFormErrorEl, text("msg.error_verify_failed"));
        return;
      }

      const target = messages.find((item) => item.id === activeCommentMessageId);
      if (!target) {
        setError(commentFormErrorEl, text("msg.error_comment_not_found"));
        return;
      }

      try {
        await apiRequest(API.comments, {
          method: "POST",
          body: JSON.stringify({
            messageId: activeCommentMessageId,
            content,
            role
          })
        });
      } catch {
        setError(commentFormErrorEl, text("msg.error_backend_unavailable"));
        return;
      }

      closeCommentModal();
      await loadMessages();
    });

    openModalEl?.addEventListener("click", openModal);
    closeModalEl?.addEventListener("click", closeModal);
    cancelModalEl?.addEventListener("click", closeModal);
    closeCommentModalEl?.addEventListener("click", closeCommentModal);
    cancelCommentModalEl?.addEventListener("click", closeCommentModal);

    modalEl?.addEventListener("click", (event) => {
      if (event.target === modalEl) closeModal();
    });

    commentModalEl?.addEventListener("click", (event) => {
      if (event.target === commentModalEl) closeCommentModal();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && modalEl && !modalEl.hidden) {
        closeModal();
      }
      if (event.key === "Escape" && commentModalEl && !commentModalEl.hidden) {
        closeCommentModal();
      }
    });

    list.addEventListener("click", async (event) => {
      const deleteBtn = event.target.closest("[data-remove-message]");
      if (deleteBtn) {
        const messageId = deleteBtn.getAttribute("data-remove-message");
        if (!messageId) return;

        const passcode = window.prompt(text("msg.prompt_delete_verify"), "");
        if (passcode === null) return;
        if (passcode.trim() !== DELETE_PASSCODE) {
          window.alert(text("msg.alert_delete_failed"));
          return;
        }

        const idx = messages.findIndex((item) => item.id === messageId);
        if (idx < 0) return;

        try {
          await apiRequest(API.messagesDelete, {
            method: "POST",
            body: JSON.stringify({ messageId })
          });
        } catch {
          window.alert(text("msg.alert_delete_backend_failed"));
          return;
        }

        await loadMessages();
        return;
      }

      const toggleBtn = event.target.closest("[data-toggle-expand]");
      if (toggleBtn) {
        const card = toggleBtn.closest(".message-card");
        const textEl = card?.querySelector(".message-text");
        if (textEl) {
          textEl.classList.toggle("collapsed");
          toggleBtn.textContent = textEl.classList.contains("collapsed")
            ? text("msg.expand_btn")
            : text("msg.collapse_btn");
        }
        return;
      }

      const commentBtn = event.target.closest("[data-open-comment]");
      if (commentBtn) {
        const messageId = commentBtn.getAttribute("data-open-comment");
        if (messageId) openCommentModal(messageId);
      }
    });

    render();
    loadCommendTextMap().then((map) => {
      Object.assign(messageText, map);
      applyTextMapToDom(map);
      render();
    });
    loadMessages();
  };

  const getVideoEmbed = (url) => {
    const yt = url.match(
      /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/i
    );
    if (yt?.[1]) {
      return `<iframe src="https://www.youtube.com/embed/${esc(yt[1])}" title="YouTube 视频" allowfullscreen loading="lazy"></iframe>`;
    }

    if (/\.(mp4|webm|ogg)(\?|#|$)/i.test(url)) {
      return `<video src="${esc(url)}" controls preload="metadata"></video>`;
    }

    return `<a class="mini-btn" href="${esc(url)}" target="_blank" rel="noopener noreferrer">打开链接</a>`;
  };

  const initVideosPage = () => {
    const form = document.getElementById("videoForm");
    const list = document.getElementById("videoList");
    if (!form || !list) return;

    const fileEl = document.getElementById("videoFile");
    const resetEl = document.getElementById("videoReset");

    const render = (items) => {
      if (!isHttpRuntime()) {
        list.innerHTML = '<div class="empty">请使用 `node server.js` 启动本地服务后访问页面，视频才能写入与读取文件夹。</div>';
        return;
      }

      if (!items.length) {
        list.innerHTML = '<div class="empty">`videos/` 文件夹暂时没有视频文件，先上传一个吧。</div>';
        return;
      }

      list.innerHTML = items
        .map((item) => {
          return `
            <article class="video-card">
              <div class="card-head">
                <h3 class="card-title">${esc(item.name || "未命名")}</h3>
                <span class="card-meta">${fmtDate(item.updatedAt)}</span>
              </div>
              <div class="video-box">${getVideoEmbed(item.url || "")}</div>
              <div class="row-actions">
                <a class="mini-btn" href="${esc(item.url || "#")}" target="_blank" rel="noopener noreferrer">跳转链接</a>
              </div>
            </article>
          `;
        })
        .join("");
    };

    const loadVideos = async () => {
      if (!isHttpRuntime()) {
        videos.splice(0, videos.length);
        render([]);
        updateHomeStats();
        return;
      }

      try {
        const payload = await apiRequest(API.videos, { method: "GET" });
        const items = (Array.isArray(payload) ? payload : []).map((item) => ({
          ...item,
          url: toAssetUrl(item?.url || "")
        }));
        videos.splice(0, videos.length, ...items);
        render(items);
        updateHomeStats();
      } catch {
        list.innerHTML = '<div class="empty">读取 `videos/` 文件夹失败，请确认本地服务已启动。</div>';
      }
    };

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      if (!isHttpRuntime()) {
        list.innerHTML = '<div class="empty">请先启动本地服务，再上传视频。</div>';
        return;
      }

      const file = fileEl?.files?.[0];
      if (!file) return;

      try {
        const base64 = await fileToBase64(file);
        await apiRequest(API.videos, {
          method: "POST",
          body: JSON.stringify({
            filename: file.name,
            data: base64
          })
        });
      } catch {
        list.innerHTML = '<div class="empty">视频上传失败，请重试。</div>';
        return;
      }

      form.reset();
      await loadVideos();
    });

    resetEl?.addEventListener("click", () => {
      form.reset();
    });

    loadVideos();
  };

  const initAlbumsPage = () => {
    const form = document.getElementById("albumForm");
    const list = document.getElementById("albumList");
    if (!form || !list) return;

    const fileEl = document.getElementById("photoFile");
    const resetEl = document.getElementById("albumReset");

    const render = (items) => {
      if (!isHttpRuntime()) {
        list.innerHTML = '<div class="empty">请使用 `node server.js` 启动本地服务后访问页面，照片才能写入与读取文件夹。</div>';
        return;
      }

      if (!items.length) {
        list.innerHTML = '<div class="empty">`photos/` 文件夹暂时没有图片，先上传一张吧。</div>';
        return;
      }

      list.innerHTML = `
        <section class="album-group">
          <div class="album-group-head">
            <h3>图片文件夹</h3>
            <span class="card-meta">${items.length} 张</span>
          </div>
          <div class="album-grid">
            ${items
              .map(
                (item) => `
                  <article class="album-card">
                    <div class="album-cover">
                      <img src="${esc(item.url || "")}" alt="${esc(item.name || "相册图片")}" loading="lazy">
                    </div>
                    <div class="album-body">
                      <h4>${esc(item.name || "未命名")}</h4>
                      <p class="card-meta">${fmtDate(item.updatedAt)}</p>
                    </div>
                  </article>
                `
              )
              .join("")}
          </div>
        </section>
      `;
    };

    const loadPhotos = async () => {
      if (!isHttpRuntime()) {
        albums.splice(0, albums.length);
        render([]);
        updateHomeStats();
        return;
      }

      try {
        const payload = await apiRequest(API.photos, { method: "GET" });
        const items = (Array.isArray(payload) ? payload : []).map((item) => ({
          ...item,
          url: toAssetUrl(item?.url || "")
        }));
        albums.splice(0, albums.length, ...items);
        render(items);
        updateHomeStats();
      } catch {
        list.innerHTML = '<div class="empty">读取 `photos/` 文件夹失败，请确认本地服务已启动。</div>';
      }
    };

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      if (!isHttpRuntime()) {
        list.innerHTML = '<div class="empty">请先启动本地服务，再上传照片。</div>';
        return;
      }

      const file = fileEl?.files?.[0];
      if (!file) return;

      try {
        const base64 = await fileToBase64(file);
        await apiRequest(API.photos, {
          method: "POST",
          body: JSON.stringify({
            filename: file.name,
            data: base64
          })
        });
      } catch {
        list.innerHTML = '<div class="empty">照片上传失败，请重试。</div>';
        return;
      }

      form.reset();
      await loadPhotos();
    });

    resetEl?.addEventListener("click", () => {
      form.reset();
    });

    loadPhotos();
  };

  initMenuDropdown();
  initHomeCarousel();
  initMessagesPage();
  initVideosPage();
  initAlbumsPage();
  updateHomeStats();
  syncHomeFolderStats();
})();

