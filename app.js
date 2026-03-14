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

  const messages = readList(STORAGE_KEYS.messages);
  const videos = readList(STORAGE_KEYS.videos);
  const albums = readList(STORAGE_KEYS.albums);

  const allTimestamps = () => {
    const stamp = [];
    for (const item of messages) {
      if (item && item.updatedAt) stamp.push(item.updatedAt);
      else if (item && item.createdAt) stamp.push(item.createdAt);
      else if (item && item.date) stamp.push(item.date);
    }
    return stamp;
  };

  const updateHomeStats = () => {
    const statMessages = document.getElementById("statMessages");
    const statUpdated = document.getElementById("statUpdated");

    if (!statMessages && !statUpdated) return;
    if (statMessages) statMessages.textContent = String(messages.length);

    const stamps = allTimestamps();
    if (!statUpdated) return;
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
    const SWIPE_MIN_DISTANCE = 48;
    const SWIPE_DIRECTION_RATIO = 1.12;

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

    let touchActive = false;
    let touchStartX = 0;
    let touchStartY = 0;
    let touchEndX = 0;
    let touchEndY = 0;

    viewport.addEventListener(
      "touchstart",
      (event) => {
        if (event.touches.length !== 1) return;
        const point = event.touches[0];
        touchActive = true;
        touchStartX = point.clientX;
        touchStartY = point.clientY;
        touchEndX = point.clientX;
        touchEndY = point.clientY;
        stopAuto();
      },
      { passive: true }
    );

    viewport.addEventListener(
      "touchmove",
      (event) => {
        if (!touchActive || event.touches.length !== 1) return;
        const point = event.touches[0];
        touchEndX = point.clientX;
        touchEndY = point.clientY;
      },
      { passive: true }
    );

    const handleSwipeEnd = () => {
      if (!touchActive) return;
      touchActive = false;

      const dx = touchEndX - touchStartX;
      const dy = touchEndY - touchStartY;
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);

      if (absX >= SWIPE_MIN_DISTANCE && absX > absY * SWIPE_DIRECTION_RATIO) {
        setActive(dx < 0 ? current + 1 : current - 1);
      }
      startAuto();
    };

    viewport.addEventListener("touchend", handleSwipeEnd, { passive: true });
    viewport.addEventListener(
      "touchcancel",
      () => {
        touchActive = false;
        startAuto();
      },
      { passive: true }
    );

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

  const initHomeBirthdayVideo = () => {
    const video = document.getElementById("homeBirthdayVideo");
    const source = video?.querySelector("source[data-src]");
    if (!video || !source) return;

    let loaded = false;
    const resolvePreloadMode = () => {
      const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      if (!connection) return "metadata";
      if (connection.saveData) return "metadata";
      const type = String(connection.effectiveType || "").toLowerCase();
      if (type.includes("2g") || type.includes("3g")) return "metadata";
      return "auto";
    };

    const loadVideo = () => {
      if (loaded) return;
      const src = source.getAttribute("data-src");
      if (!src) return;
      video.preload = resolvePreloadMode();
      source.src = src;
      video.load();
      loaded = true;
    };

    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              loadVideo();
              observer.disconnect();
              break;
            }
          }
        },
        { rootMargin: "260px 0px" }
      );
      observer.observe(video);
    } else {
      loadVideo();
    }

    video.addEventListener("pointerdown", loadVideo, { once: true });
    video.addEventListener("touchstart", loadVideo, { once: true, passive: true });
    video.addEventListener("focus", loadVideo, { once: true });
  };

  const initFloatingFigureButton = () => {
    const button = document.getElementById("figureFloatBtn");
    const image = document.getElementById("figureFloatImage");
    const tip = document.getElementById("figureFloatTip");
    const audio = document.getElementById("figureFloatAudio");
    if (!button || !image || !audio) return;

    const setVoiceIdle = () => {
      if (tip) tip.textContent = "今天有奶茶吗？";
    };

    const setVoicePlaying = () => {
      if (tip) tip.textContent = "今天有奶茶吗？";
    };

    const playTapFeedback = () => {
      button.classList.remove("is-tap");
      void button.offsetWidth;
      button.classList.add("is-tap");
    };

    button.addEventListener("animationend", (event) => {
      if (event.animationName === "figureTapShake" || event.animationName === "figureTapTip") {
        button.classList.remove("is-tap");
      }
    });

    const toggleVoice = async () => {
      if (!audio.paused && !audio.ended) {
        audio.pause();
        audio.currentTime = 0;
        setVoiceIdle();
        return;
      }

      audio.currentTime = 0;
      try {
        await audio.play();
        setVoicePlaying();
      } catch {
        setVoiceIdle();
      }
    };

    const reportFigureClick = () => {
      try {
        void fetch("/api/figure-click", {
          method: "POST",
          keepalive: true
        }).catch(() => {});
      } catch {}
    };

    button.addEventListener("click", (event) => {
      event.preventDefault();
      reportFigureClick();
      playTapFeedback();
      toggleVoice();
      button.blur();
    });

    audio.addEventListener("ended", setVoiceIdle);
    audio.addEventListener("pause", () => {
      if (audio.currentTime === 0 || audio.ended) setVoiceIdle();
    });

    let moveTimer = null;
    let destroyed = false;
    let pauseUntil = 0;
    const reduceMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const randomBetween = (min, max) => min + Math.random() * Math.max(0, max - min);

    const getSafeBounds = () => {
      const rect = button.getBoundingClientRect();
      const viewportW = window.innerWidth || document.documentElement.clientWidth || 360;
      const viewportH = window.innerHeight || document.documentElement.clientHeight || 640;
      const topbar = document.querySelector(".topbar");
      const topbarBottom = topbar ? Math.ceil(topbar.getBoundingClientRect().bottom) : 64;
      const minX = 6;
      const maxX = Math.max(minX, Math.floor(viewportW - rect.width - 6));
      const minY = Math.max(8, topbarBottom + 8);
      const maxY = Math.max(minY, Math.floor(viewportH - rect.height - 8));
      return { minX, maxX, minY, maxY, rect };
    };

    const clearMoveTimer = () => {
      if (moveTimer) {
        clearTimeout(moveTimer);
        moveTimer = null;
      }
    };

    const scheduleMove = (delay) => {
      if (destroyed || reduceMotion) return;
      clearMoveTimer();
      moveTimer = setTimeout(() => {
        moveFloatingButton();
      }, Math.max(120, delay));
    };

    const freezeMotion = (ms = 1100) => {
      if (destroyed || reduceMotion) return;
      const rect = button.getBoundingClientRect();
      button.style.transition = "none";
      button.style.left = `${Math.round(rect.left)}px`;
      button.style.top = `${Math.round(rect.top)}px`;
      pauseUntil = Date.now() + ms;
      scheduleMove(ms + 120);
    };

    const placeInitial = () => {
      const { minX, maxX, minY, maxY, rect } = getSafeBounds();
      button.style.right = "auto";
      button.style.bottom = "auto";
      const startX = Math.min(maxX, Math.max(minX, Math.round(rect.left)));
      const startY = Math.min(maxY, Math.max(minY, Math.round(rect.top)));
      button.style.left = `${startX}px`;
      button.style.top = `${startY}px`;
    };

    const moveFloatingButton = () => {
      if (destroyed || reduceMotion) return;

      const now = Date.now();
      if (now < pauseUntil) {
        scheduleMove(pauseUntil - now + 80);
        return;
      }

      const { minX, maxX, minY, maxY, rect } = getSafeBounds();
      const currentX = Math.min(maxX, Math.max(minX, Math.round(rect.left)));
      const currentY = Math.min(maxY, Math.max(minY, Math.round(rect.top)));
      const axisSpan = Math.min(maxX - minX, maxY - minY);
      const minDistance = Math.max(64, Math.round(axisSpan * 0.28));

      let targetX = currentX;
      let targetY = currentY;
      for (let i = 0; i < 10; i += 1) {
        const nextX = Math.round(randomBetween(minX, maxX));
        const nextY = Math.round(randomBetween(minY, maxY));
        const distance = Math.hypot(nextX - currentX, nextY - currentY);
        targetX = nextX;
        targetY = nextY;
        if (distance >= minDistance) break;
      }

      const duration = Math.round(randomBetween(2400, 4300));
      button.style.transition = `left ${duration}ms cubic-bezier(0.22, 0.61, 0.36, 1), top ${duration}ms cubic-bezier(0.22, 0.61, 0.36, 1)`;
      button.style.left = `${targetX}px`;
      button.style.top = `${targetY}px`;
      scheduleMove(duration + randomBetween(240, 680));
    };

    placeInitial();
    if (!reduceMotion) scheduleMove(360);
    button.addEventListener("pointerdown", () => freezeMotion(1300), { passive: true });
    window.addEventListener("resize", () => freezeMotion(260), { passive: true });
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", () => freezeMotion(260), { passive: true });
    }

    const imageSrc = String(image.getAttribute("src") || "").toLowerCase();
    const canCutout =
      typeof HTMLCanvasElement !== "undefined" && !/\.(png|webp)(?:[?#]|$)/.test(imageSrc);

    let objectUrl = "";
    let processed = false;
    window.addEventListener(
      "pagehide",
      () => {
        destroyed = true;
        clearMoveTimer();
        audio.pause();
        audio.currentTime = 0;
        setVoiceIdle();
        if (objectUrl) URL.revokeObjectURL(objectUrl);
      },
      { once: true }
    );

    if (!canCutout) return;

    const getBorderColorStats = (data, width, height) => {
      const step = Math.max(1, Math.floor(Math.min(width, height) / 70));
      const samples = [];

      for (let x = 0; x < width; x += step) {
        samples.push((x * 4), ((height - 1) * width + x) * 4);
      }
      for (let y = step; y < height; y += step) {
        samples.push((y * width) * 4, (y * width + (width - 1)) * 4);
      }

      if (!samples.length) return { r: 235, g: 235, b: 235, std: 28 };

      let sumR = 0;
      let sumG = 0;
      let sumB = 0;
      for (const idx of samples) {
        sumR += data[idx];
        sumG += data[idx + 1];
        sumB += data[idx + 2];
      }
      const count = samples.length;
      const meanR = sumR / count;
      const meanG = sumG / count;
      const meanB = sumB / count;

      let variance = 0;
      for (const idx of samples) {
        const dr = data[idx] - meanR;
        const dg = data[idx + 1] - meanG;
        const db = data[idx + 2] - meanB;
        variance += Math.sqrt(dr * dr + dg * dg + db * db);
      }

      return {
        r: meanR,
        g: meanG,
        b: meanB,
        std: variance / count
      };
    };

    const processCutout = async () => {
      if (processed) return;
      processed = true;

      const naturalW = image.naturalWidth || 0;
      const naturalH = image.naturalHeight || 0;
      if (!naturalW || !naturalH) return;

      const maxSide = 900;
      const scale = Math.min(1, maxSide / Math.max(naturalW, naturalH));
      const width = Math.max(1, Math.round(naturalW * scale));
      const height = Math.max(1, Math.round(naturalH * scale));

      const workCanvas = document.createElement("canvas");
      workCanvas.width = width;
      workCanvas.height = height;
      const ctx = workCanvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;

      ctx.drawImage(image, 0, 0, width, height);
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;
      const total = width * height;

      const bg = getBorderColorStats(data, width, height);
      const hard = Math.max(22, Math.min(72, 18 + bg.std * 0.9));
      const soft = hard + 34;
      const candidate = new Uint8Array(total);
      const bgMask = new Uint8Array(total);
      const queue = new Int32Array(total);
      let queueStart = 0;
      let queueEnd = 0;

      const distAt = (idx4) => {
        const dr = data[idx4] - bg.r;
        const dg = data[idx4 + 1] - bg.g;
        const db = data[idx4 + 2] - bg.b;
        return Math.sqrt(dr * dr + dg * dg + db * db);
      };

      const pushIfBg = (pixelIndex) => {
        if (!candidate[pixelIndex] || bgMask[pixelIndex]) return;
        bgMask[pixelIndex] = 1;
        queue[queueEnd++] = pixelIndex;
      };

      for (let i = 0; i < total; i += 1) {
        const idx4 = i * 4;
        if (distAt(idx4) <= soft) candidate[i] = 1;
      }

      for (let x = 0; x < width; x += 1) {
        pushIfBg(x);
        pushIfBg((height - 1) * width + x);
      }
      for (let y = 1; y < height - 1; y += 1) {
        pushIfBg(y * width);
        pushIfBg(y * width + (width - 1));
      }

      while (queueStart < queueEnd) {
        const current = queue[queueStart++];
        const x = current % width;
        const y = (current / width) | 0;

        if (x > 0) pushIfBg(current - 1);
        if (x < width - 1) pushIfBg(current + 1);
        if (y > 0) pushIfBg(current - width);
        if (y < height - 1) pushIfBg(current + width);
      }

      for (let i = 0; i < total; i += 1) {
        const idx4 = i * 4;
        const alpha = data[idx4 + 3];
        if (alpha === 0) continue;

        if (bgMask[i]) {
          data[idx4 + 3] = 0;
          continue;
        }

        if (!candidate[i]) continue;
        const dist = distAt(idx4);
        const ratio = Math.max(0.12, Math.min(1, (dist - hard) / (soft - hard)));
        data[idx4 + 3] = Math.round(alpha * ratio);
      }

      let minX = width;
      let minY = height;
      let maxX = -1;
      let maxY = -1;
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const idx4 = (y * width + x) * 4;
          if (data[idx4 + 3] > 12) {
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
          }
        }
      }
      if (maxX < minX || maxY < minY) return;

      const pad = Math.max(6, Math.round(Math.min(width, height) * 0.02));
      minX = Math.max(0, minX - pad);
      minY = Math.max(0, minY - pad);
      maxX = Math.min(width - 1, maxX + pad);
      maxY = Math.min(height - 1, maxY + pad);

      ctx.putImageData(imageData, 0, 0);
      const outWidth = maxX - minX + 1;
      const outHeight = maxY - minY + 1;
      const outCanvas = document.createElement("canvas");
      outCanvas.width = outWidth;
      outCanvas.height = outHeight;
      const outCtx = outCanvas.getContext("2d");
      if (!outCtx) return;

      outCtx.drawImage(workCanvas, minX, minY, outWidth, outHeight, 0, 0, outWidth, outHeight);
      const blob = await new Promise((resolve) => outCanvas.toBlob(resolve, "image/png"));
      if (!blob) return;

      objectUrl = URL.createObjectURL(blob);
      image.src = objectUrl;
    };

    const scheduleCutout = () => {
      const runner = () => {
        processCutout().catch(() => {
          // fallback to original image
        });
      };
      if ("requestIdleCallback" in window) {
        window.requestIdleCallback(runner, { timeout: 1200 });
      } else {
        setTimeout(runner, 280);
      }
    };

    if (image.complete) scheduleCutout();
    else image.addEventListener("load", scheduleCutout, { once: true });

  };

  const normalizeDateKey = (value) => {
    const source = String(value || "").trim();
    const match = source.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (!match) return "";
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const normalized = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const dt = new Date(`${normalized}T00:00:00`);
    if (Number.isNaN(dt.getTime())) return "";
    if (
      dt.getFullYear() !== year ||
      dt.getMonth() + 1 !== month ||
      dt.getDate() !== day
    ) {
      return "";
    }
    return normalized;
  };

  const parseDailyMessagesConfig = (raw) => {
    const items = [];
    const lines = String(raw || "").split(/\r?\n/);

    for (const sourceLine of lines) {
      const line = sourceLine.trim();
      if (!line || line.startsWith("#")) continue;

      if (!line.includes("|")) {
        if (!items.length) {
          items.push({
            id: "cfg_1",
            order: 0,
            date: "",
            role: "",
            content: line
          });
        } else {
          const tail = items[items.length - 1];
          tail.content = `${tail.content}\n${line}`;
        }
        continue;
      }

      const parts = line.split("|").map((part) => part.trim());
      let date = "";
      let role = "";
      let content = "";

      if (parts.length >= 3) {
        date = normalizeDateKey(parts[0]);
        role = parts[1] || "";
        content = parts.slice(2).join("|").trim();
      } else if (parts.length === 2) {
        const maybeDate = normalizeDateKey(parts[0]);
        if (maybeDate) {
          date = maybeDate;
          content = parts[1] || "";
        } else {
          role = parts[0] || "";
          content = parts[1] || "";
        }
      } else {
        content = parts[0] || "";
      }

      if (!content) continue;
      items.push({
        id: "",
        order: items.length,
        date,
        role,
        content
      });
    }

    return items.map((item, index) => ({
      ...item,
      id: `cfg_${index + 1}`,
      order: index
    }));
  };

  const messageStamp = (item) => {
    if (!item?.date) return -1;
    const value = new Date(`${item.date}T00:00:00`).getTime();
    return Number.isNaN(value) ? -1 : value;
  };

  const sortByLatestMessage = (a, b) => {
    const stampDelta = messageStamp(b) - messageStamp(a);
    if (stampDelta !== 0) return stampDelta;
    return (b?.order ?? 0) - (a?.order ?? 0);
  };

  const pickLatestMessage = (items) => {
    if (!Array.isArray(items) || !items.length) return null;
    return [...items].sort(sortByLatestMessage)[0] || null;
  };

  const loadDailyMessagesConfig = async () => {
    if (!isHttpRuntime()) return [];
    const response = await fetch("daily-messages.config", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const raw = await response.text();
    return parseDailyMessagesConfig(raw);
  };

  const initHomeLatestMessage = () => {
    const homeLatestMessage = document.getElementById("homeLatestMessageText");
    if (!homeLatestMessage) return;

    const setLatestMessageText = (items) => {
      const latest = pickLatestMessage(items);
      const text = String(latest?.content || "").trim();
      if (!text) return;
      homeLatestMessage.textContent = text;
    };

    const localItems = messages.map((item, index) => ({
      id: item?.id || `local_${index + 1}`,
      order: Number.isFinite(item?.order) ? item.order : index,
      date: normalizeDateKey(item?.date),
      role: String(item?.role || ""),
      content: String(item?.content || "")
    }));
    setLatestMessageText(localItems);

    loadDailyMessagesConfig()
      .then((items) => {
        setLatestMessageText(items);
      })
      .catch(() => {
        // keep fallback text
      });
  };

  const initMessagesPage = () => {
    const list = document.getElementById("messageList");
    if (!list) return;

    const messageText = {
      "msg.empty": "还没有写给雪的话。",
      "msg.today_badge": "最新留言",
      "msg.list_item_prefix": "第",
      "msg.meta_prefix": "记录日期 ·",
      "msg.meta_no_date": "未设置日期",
      "msg.error_config_load_failed": "读取留言内容失败。",
      "msg.error_http_open": "请通过 HTTP/HTTPS 打开页面。"
    };
    const text = (key, fallback = "") => messageText[key] ?? fallback;
    let configuredMessages = [];
    let loadError = "";

    const shouldCollapseMessage = (content) => {
      const textContent = String(content || "");
      const lineCount = textContent.split(/\r?\n/).length;
      return textContent.length > 120 || lineCount > 4;
    };

    list.addEventListener("click", (event) => {
      const button = event.target.closest("[data-message-toggle]");
      if (!button) return;
      const card = button.closest(".message-card");
      const textNode = card?.querySelector(".message-text");
      if (!textNode) return;

      const expanded = button.getAttribute("aria-expanded") === "true";
      const nextExpanded = !expanded;
      button.setAttribute("aria-expanded", String(nextExpanded));
      button.textContent = nextExpanded ? "收起" : "展开";
      textNode.classList.toggle("collapsed", !nextExpanded);
    });

    const loadConfiguredMessages = async () => {
      if (!isHttpRuntime()) {
        configuredMessages = [];
        loadError = text("msg.error_http_open");
        render();
        return;
      }

      try {
        configuredMessages = await loadDailyMessagesConfig();
        loadError = "";
      } catch {
        configuredMessages = [];
        loadError = text("msg.error_config_load_failed");
      }

      messages.splice(
        0,
        messages.length,
        ...configuredMessages.map((item) => ({
          id: item.id,
          role: item.role,
          content: item.content,
          date: item.date
        }))
      );
      writeList(STORAGE_KEYS.messages, messages);
      updateHomeStats();
      render();
    };

    const render = () => {
      if (!configuredMessages.length) {
        const fallback = loadError || text("msg.empty");
        list.innerHTML = `<div class="empty">${esc(fallback)}</div>`;
        return;
      }

      const latestItem = pickLatestMessage(configuredMessages);
      const ordered = [...configuredMessages].sort(sortByLatestMessage);

      list.innerHTML = ordered
        .map((item, index) => {
          const tone = index % 8;
          const isLatest = latestItem && item.id === latestItem.id;
          const title = isLatest
            ? text("msg.today_badge")
            : `${text("msg.list_item_prefix")}${index + 1}条`;
          const roleHtml = item.role ? `<p class="message-role">${esc(item.role)}：</p>` : "";
          const dateText = String(item.date || "").trim();
          const dateHtml = dateText ? `<span class="card-meta">${esc(dateText)}</span>` : "";
          const collapsible = shouldCollapseMessage(item.content);
          return `
            <article class="message-card message-tone-${tone}">
              <div class="card-head">
                <h3 class="card-title">${esc(title)}</h3>
                ${dateHtml}
              </div>
              ${roleHtml}
              <p class="message-text${collapsible ? " collapsed" : ""}">${esc(item.content)}</p>
              ${collapsible
                ? '<div class="row-actions"><button class="message-expand" type="button" data-message-toggle aria-expanded="false">展开</button></div>'
                : ""}
            </article>
          `;
        })
        .join("");
    };

    render();
    loadCommendTextMap().then((map) => {
      Object.assign(messageText, map);
      applyTextMapToDom(map);
      render();
    });
    loadConfiguredMessages();
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

  const STATIC_GALLERY_NAMES = ["1.jpg", "2.jpg", "3.jpg", "4.jpg", "5.jpg", "6.jpg"];

  const isGalleryFilename = (name) => {
    return /^\d+\.(jpe?g|png|webp|gif)$/i.test(String(name || ""));
  };

  const gallerySortByNumericName = (a, b) => {
    const aName = String(a?.name || "");
    const bName = String(b?.name || "");
    const aMatch = aName.match(/^(\d+)/);
    const bMatch = bName.match(/^(\d+)/);
    const aNum = aMatch ? Number(aMatch[1]) : Number.POSITIVE_INFINITY;
    const bNum = bMatch ? Number(bMatch[1]) : Number.POSITIVE_INFINITY;
    if (aNum !== bNum) return aNum - bNum;
    return aName.localeCompare(bName, "zh-CN");
  };

  const detectStaticGalleryPhotos = async () => {
    const checks = STATIC_GALLERY_NAMES.map((name) => {
      const url = `photos/${encodeURIComponent(name)}`;
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve({ name, url, updatedAt: "" });
        img.onerror = () => resolve(null);
        img.src = url;
      });
    });

    const found = await Promise.all(checks);
    return found.filter(Boolean).sort(gallerySortByNumericName);
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
      const galleryItems = (Array.isArray(items) ? items : [])
        .filter((item) => isGalleryFilename(item?.name))
        .sort(gallerySortByNumericName);

      const cards = galleryItems.length ? galleryItems : items;
      if (!cards.length) {
        list.innerHTML = '<div class="empty">`photos/` 文件夹暂时没有图片，先上传一张吧。</div>';
        return;
      }

      list.innerHTML = `
        <section class="album-group">
          <div class="album-group-head">
            <h3>主页相册展示</h3>
            <span class="card-meta">${cards.length} 张</span>
          </div>
          <div class="album-grid">
            ${cards
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
      const staticItems = await detectStaticGalleryPhotos();

      if (!isHttpRuntime()) {
        albums.splice(0, albums.length, ...staticItems);
        render(staticItems);
        updateHomeStats();
        return;
      }

      try {
        const payload = await apiRequest(API.photos, { method: "GET" });
        const apiItems = (Array.isArray(payload) ? payload : []).map((item) => ({
          ...item,
          url: toAssetUrl(item?.url || "")
        }));
        const mergedByName = new Map();
        [...apiItems, ...staticItems].forEach((item) => {
          const key = String(item?.name || "").toLowerCase();
          if (!key || mergedByName.has(key)) return;
          mergedByName.set(key, item);
        });
        const merged = Array.from(mergedByName.values()).sort(gallerySortByNumericName);
        albums.splice(0, albums.length, ...merged);
        render(merged);
        updateHomeStats();
      } catch {
        if (staticItems.length) {
          albums.splice(0, albums.length, ...staticItems);
          render(staticItems);
          updateHomeStats();
          return;
        }
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
  initHomeBirthdayVideo();
  initFloatingFigureButton();
  initHomeLatestMessage();
  initMessagesPage();
  initVideosPage();
  initAlbumsPage();
  updateHomeStats();
})();

