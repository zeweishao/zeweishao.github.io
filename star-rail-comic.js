(() => {
  "use strict";

  const chapters = {
    1: {
      number: "01",
      title: "十二小时之外的新轨",
      eyebrow: "第一季《雪落纽约》／第一篇",
      summary: "一段没有名字、没有内容、也没有地址的信号，在十二小时之外敲了一百二十七次。",
      pageCount: 25,
      directory: "assets/star-rail-comic/chapter-01",
      extension: "webp",
      cover: "assets/star-rail-comic/covers/chapter-01.jpg",
      storyUrl: "assets/star-rail-comic/stories/chapter-01.md",
      builtIn: true
    },
    2: {
      number: "02",
      title: "空白找到了地址",
      eyebrow: "第一季《雪落纽约》／第二篇",
      summary: "维泽给一条不存在的路找到了地址，也让追逐真实痕迹的空白潮找到了入口。",
      pageCount: 24,
      directory: "assets/star-rail-comic/chapter-02",
      extension: "webp",
      cover: "assets/star-rail-comic/covers/chapter-02.jpg",
      storyUrl: "assets/star-rail-comic/stories/chapter-02.md",
      builtIn: true
    },
    3: {
      number: "03",
      title: "名字抵达之前",
      eyebrow: "第一季《雪落纽约》／第三篇",
      summary: "名字无法穿过新轨，他们便用真实留下的痕迹，让彼此终于抵达。",
      pageCount: 24,
      directory: "assets/star-rail-comic/chapter-03",
      extension: "jpg",
      cover: "assets/star-rail-comic/covers/chapter-03.jpg",
      storyUrl: "assets/star-rail-comic/stories/chapter-03.md",
      builtIn: true
    }
  };

  const builtInChapterNumbers = new Set(Object.keys(chapters).map(Number));
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const usesCoarsePointer = window.matchMedia("(pointer: coarse)").matches;
  const readerProgressKey = "startrace_reader_progress";
  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
  const pad = (value) => String(value).padStart(2, "0");
  const escapeHtml = (value) =>
    String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  const getChapterPages = (chapter) => {
    if (!chapter) return [];
    const bodyPages = Array.isArray(chapter.pages)
      ? chapter.pages.filter(Boolean)
      : Array.from(
          { length: Number(chapter.pageCount) || 0 },
          (_, index) =>
            `${chapter.directory}/page-${pad(index + 1)}.${chapter.extension || "webp"}`
        );
    return chapter.cover ? [chapter.cover, ...bodyPages] : bodyPages;
  };

  const readStoredReaderProgress = () => {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(readerProgressKey) || "{}");
      const requestedChapter = Number(parsed.chapter);
      const chapter = chapters[requestedChapter] ? requestedChapter : 1;
      const maxPage = Math.max(getChapterPages(chapters[chapter]).length, 1);
      const page = clamp(Number(parsed.page) || 1, 1, maxPage);
      return { chapter, page };
    } catch {
      return { chapter: 1, page: 1 };
    }
  };

  const writeStoredReaderProgress = (chapter, page) => {
    try {
      window.localStorage.setItem(
        readerProgressKey,
        JSON.stringify({
          chapter: Number(chapter) || 1,
          page: Number(page) || 1
        })
      );
    } catch {
      // 阅读记录只是本机便利功能；存储不可用时不影响漫画阅读。
    }
  };

  const pageProgressBar = document.getElementById("pageProgressBar");
  const comicTopbar = document.getElementById("comicTopbar");
  const cursorAura = document.getElementById("cursorAura");

  const updatePageProgress = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const progress = max > 0 ? window.scrollY / max : 0;
    if (pageProgressBar) {
      pageProgressBar.style.transform = `scaleX(${clamp(progress, 0, 1)})`;
    }
    comicTopbar?.classList.toggle("is-scrolled", window.scrollY > 80);
  };

  let progressTicking = false;
  window.addEventListener(
    "scroll",
    () => {
      if (progressTicking) return;
      progressTicking = true;
      requestAnimationFrame(() => {
        updatePageProgress();
        progressTicking = false;
      });
    },
    { passive: true }
  );
  updatePageProgress();

  const mobileReadLabel = document.getElementById("mobileReadLabel");
  const storedReaderProgress = readStoredReaderProgress();
  if (mobileReadLabel && storedReaderProgress.page > 1) {
    mobileReadLabel.textContent = `续读 ${pad(storedReaderProgress.page)}`;
  }

  const mobileNavLinks = Array.from(document.querySelectorAll("[data-mobile-nav]"));
  if (mobileNavLinks.length && "IntersectionObserver" in window) {
    const mobileSectionObserver = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        mobileNavLinks.forEach((link) => {
          if (link.dataset.mobileNav === visible.target.id) {
            link.setAttribute("aria-current", "true");
          } else {
            link.removeAttribute("aria-current");
          }
        });
      },
      { threshold: [0.16, 0.35], rootMargin: "-18% 0px -54% 0px" }
    );

    ["world", "chapters", "stories"].forEach((id) => {
      const section = document.getElementById(id);
      if (section) mobileSectionObserver.observe(section);
    });
  }

  if (cursorAura && !prefersReducedMotion) {
    let cursorX = window.innerWidth / 2;
    let cursorY = window.innerHeight / 2;
    let auraX = cursorX;
    let auraY = cursorY;

    window.addEventListener(
      "pointermove",
      (event) => {
        cursorX = event.clientX;
        cursorY = event.clientY;
      },
      { passive: true }
    );

    const moveAura = () => {
      auraX += (cursorX - auraX) * 0.09;
      auraY += (cursorY - auraY) * 0.09;
      cursorAura.style.left = `${auraX}px`;
      cursorAura.style.top = `${auraY}px`;
      requestAnimationFrame(moveAura);
    };
    requestAnimationFrame(moveAura);
  }

  const revealNodes = Array.from(document.querySelectorAll("[data-reveal]"));
  revealNodes.forEach((node) => {
    const delay = Number(node.dataset.revealDelay || 0);
    node.style.setProperty("--reveal-delay", `${delay}ms`);
  });

  if ("IntersectionObserver" in window && !prefersReducedMotion) {
    const revealObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.14, rootMargin: "0px 0px -6% 0px" }
    );
    revealNodes.forEach((node) => revealObserver.observe(node));
  } else {
    revealNodes.forEach((node) => node.classList.add("is-visible"));
  }

  const parallaxLayers = Array.from(document.querySelectorAll("[data-parallax-layer]"));
  const hero = document.querySelector(".comic-hero");
  if (hero && parallaxLayers.length && !prefersReducedMotion) {
    let pointerX = 0;
    let pointerY = 0;

    hero.addEventListener(
      "pointermove",
      (event) => {
        const rect = hero.getBoundingClientRect();
        pointerX = (event.clientX - rect.left) / rect.width - 0.5;
        pointerY = (event.clientY - rect.top) / rect.height - 0.5;
        parallaxLayers.forEach((layer) => {
          const depth = Number(layer.dataset.parallaxLayer || 0.08);
          const x = pointerX * depth * 160;
          const y = pointerY * depth * 110;
          const scale = layer.classList.contains("hero-ambient-image") ? 1.12 : 1;
          layer.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
        });
      },
      { passive: true }
    );

    hero.addEventListener("pointerleave", () => {
      parallaxLayers.forEach((layer) => {
        const scale = layer.classList.contains("hero-ambient-image") ? 1.12 : 1;
        layer.style.transform = `translate3d(0, 0, 0) scale(${scale})`;
      });
    });
  }

  const bindTiltCards = (root = document) => {
    root.querySelectorAll("[data-tilt-card]").forEach((card) => {
      if (prefersReducedMotion || card.dataset.tiltReady === "true") return;
      card.dataset.tiltReady = "true";
      card.addEventListener("pointermove", (event) => {
        if (event.pointerType === "touch") return;
        const rect = card.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width - 0.5;
        const y = (event.clientY - rect.top) / rect.height - 0.5;
        card.style.transform = `perspective(1200px) rotateX(${y * -2.8}deg) rotateY(${x * 3.5}deg) translateY(-4px)`;
      });

      card.addEventListener("pointerleave", () => {
        card.style.transform = "";
      });
    });
  };
  bindTiltCards();

  const hangzhouClock = document.getElementById("hangzhouClock");
  const newYorkClock = document.getElementById("newYorkClock");
  const hangzhouDate = document.getElementById("hangzhouDate");
  const newYorkDate = document.getElementById("newYorkDate");
  const cityTimeOffset = document.getElementById("cityTimeOffset");
  const cityDateRelation = document.getElementById("cityDateRelation");
  const heroTimeOffset = document.getElementById("heroTimeOffset");
  const timeFormatter = (timeZone) =>
    new Intl.DateTimeFormat("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
      timeZone
    });
  const dateFormatter = (timeZone) =>
    new Intl.DateTimeFormat("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
      timeZone
    });
  const zoneFormatter = (timeZone) =>
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "longOffset"
    });
  const offsetMinutes = (formatter, date) => {
    const label = formatter
      .formatToParts(date)
      .find((part) => part.type === "timeZoneName")?.value;
    if (!label || label === "GMT") return 0;
    const match = label.match(/GMT([+-])(\d{2}):?(\d{2})?/);
    if (!match) return 0;
    const minutes = Number(match[2]) * 60 + Number(match[3] || 0);
    return match[1] === "-" ? -minutes : minutes;
  };
  const formatCityDate = (formatter, date) => {
    const parts = Object.fromEntries(
      formatter
        .formatToParts(date)
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, part.value])
    );
    return `${String(parts.month || "").padStart(2, "0")}月${String(parts.day || "").padStart(2, "0")}日 ${parts.weekday || ""}`;
  };

  const hangzhouFormatter = timeFormatter("Asia/Shanghai");
  const newYorkFormatter = timeFormatter("America/New_York");
  const hangzhouDateFormatter = dateFormatter("Asia/Shanghai");
  const newYorkDateFormatter = dateFormatter("America/New_York");
  const hangzhouZoneFormatter = zoneFormatter("Asia/Shanghai");
  const newYorkZoneFormatter = zoneFormatter("America/New_York");

  const updateClocks = () => {
    const now = new Date();
    const hangzhouOffset = offsetMinutes(hangzhouZoneFormatter, now);
    const newYorkOffset = offsetMinutes(newYorkZoneFormatter, now);
    const difference = Math.abs(hangzhouOffset - newYorkOffset) / 60;
    const differenceLabel = Number.isInteger(difference) ? String(difference) : difference.toFixed(1);
    if (hangzhouClock) {
      hangzhouClock.textContent = hangzhouFormatter.format(now);
      hangzhouClock.dateTime = now.toISOString();
    }
    if (hangzhouDate) {
      hangzhouDate.textContent = `${formatCityDate(hangzhouDateFormatter, now)} · UTC+8`;
    }
    if (newYorkClock) {
      newYorkClock.textContent = newYorkFormatter.format(now);
      newYorkClock.dateTime = now.toISOString();
    }
    if (newYorkDate) {
      const newYorkUtcLabel = newYorkOffset === -240 ? "UTC−4" : newYorkOffset === -300 ? "UTC−5" : `UTC${newYorkOffset / 60}`;
      newYorkDate.textContent = `${formatCityDate(newYorkDateFormatter, now)} · ${newYorkUtcLabel}`;
    }
    if (cityTimeOffset) cityTimeOffset.textContent = `${differenceLabel}H`;
    if (cityDateRelation) cityDateRelation.textContent = "实时世界时差";
    if (heroTimeOffset) heroTimeOffset.textContent = `${differenceLabel}h`;
  };
  updateClocks();
  window.setInterval(updateClocks, 1000);

  document.querySelectorAll(".comic-menu-panel a, .comic-menu-panel button").forEach((item) => {
    item.addEventListener("click", () => {
      item.closest("details")?.removeAttribute("open");
    });
  });

  document.addEventListener("click", (event) => {
    document.querySelectorAll(".comic-menu[open]").forEach((menu) => {
      if (!menu.contains(event.target)) menu.removeAttribute("open");
    });
  });

  class CosmicField {
    constructor(canvas) {
      this.canvas = canvas;
      this.context = canvas.getContext("2d", { alpha: true });
      this.width = 0;
      this.height = 0;
      this.dpr = 1;
      this.stars = [];
      this.petals = [];
      this.meteors = [];
      this.pointerX = 0;
      this.pointerY = 0;
      this.lastMeteorAt = 0;
      this.nextMeteorDelay = 2800;
      this.lastTime = 0;
      this.frameId = 0;
      this.suspended = false;
      this.resize = this.resize.bind(this);
      this.render = this.render.bind(this);
      this.handleVisibilityChange = this.handleVisibilityChange.bind(this);

      window.addEventListener("resize", this.resize, { passive: true });
      document.addEventListener("visibilitychange", this.handleVisibilityChange);
      window.addEventListener(
        "pointermove",
        (event) => {
          this.pointerX = event.clientX / Math.max(window.innerWidth, 1) - 0.5;
          this.pointerY = event.clientY / Math.max(window.innerHeight, 1) - 0.5;
        },
        { passive: true }
      );

      this.resize();
      if (prefersReducedMotion) {
        this.draw(0, 0);
      } else {
        this.start();
      }
    }

    start() {
      if (prefersReducedMotion || this.suspended || document.hidden || this.frameId) return;
      this.lastTime = performance.now();
      this.frameId = requestAnimationFrame(this.render);
    }

    stop() {
      if (this.frameId) cancelAnimationFrame(this.frameId);
      this.frameId = 0;
    }

    setSuspended(suspended) {
      this.suspended = Boolean(suspended);
      if (this.suspended) {
        this.stop();
      } else {
        this.start();
      }
    }

    handleVisibilityChange() {
      if (document.hidden) {
        this.stop();
      } else {
        this.start();
      }
    }

    resize() {
      this.width = window.innerWidth;
      this.height = window.innerHeight;
      const mobileDprLimit = usesCoarsePointer || this.width <= 820 ? 1.25 : 1.7;
      this.dpr = Math.min(window.devicePixelRatio || 1, mobileDprLimit);
      this.canvas.width = Math.floor(this.width * this.dpr);
      this.canvas.height = Math.floor(this.height * this.dpr);
      this.canvas.style.width = `${this.width}px`;
      this.canvas.style.height = `${this.height}px`;
      this.context.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      this.seed();
      if (prefersReducedMotion) this.draw(0, 0);
    }

    seed() {
      const area = this.width * this.height;
      const mobileField = usesCoarsePointer || this.width <= 820;
      const starCount = mobileField
        ? clamp(Math.round(area / 11000), 52, 125)
        : clamp(Math.round(area / 7600), 70, 230);
      const petalCount = mobileField ? 9 : 24;

      this.stars = Array.from({ length: starCount }, () => {
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.sqrt(Math.random()) * Math.max(this.width, this.height) * 0.72;
        return {
          angle,
          radius,
          depth: 0.25 + Math.random() * 0.75,
          size: 0.35 + Math.random() * 1.45,
          alpha: 0.16 + Math.random() * 0.68,
          speed: (Math.random() * 0.000018 + 0.000006) * (Math.random() > 0.5 ? 1 : -1),
          flicker: Math.random() * Math.PI * 2
        };
      });

      this.petals = Array.from({ length: petalCount }, () => this.createPetal(true));
    }

    createPetal(randomY = false) {
      return {
        x: Math.random() * this.width,
        y: randomY ? Math.random() * this.height : -30,
        size: 3.8 + Math.random() * 6.4,
        vx: -0.16 + Math.random() * 0.45,
        vy: 0.17 + Math.random() * 0.42,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.018,
        sway: Math.random() * Math.PI * 2,
        swaySpeed: 0.006 + Math.random() * 0.008,
        alpha: 0.12 + Math.random() * 0.28,
        warm: Math.random() > 0.35
      };
    }

    spawnMeteor(now) {
      const fromLeft = Math.random() > 0.34;
      const x = fromLeft ? Math.random() * this.width * 0.68 : this.width * (0.65 + Math.random() * 0.35);
      const y = Math.random() * this.height * 0.34;
      const speed = 9 + Math.random() * 8;
      this.meteors.push({
        x,
        y,
        vx: fromLeft ? speed : -speed,
        vy: speed * (0.38 + Math.random() * 0.22),
        life: 0,
        maxLife: 48 + Math.random() * 28,
        length: 110 + Math.random() * 130,
        width: 0.6 + Math.random() * 1.1,
        coral: Math.random() > 0.72
      });
      this.lastMeteorAt = now;
      this.nextMeteorDelay = 4200 + Math.random() * 6200;
    }

    drawStarField(now) {
      const centerX = this.width * 0.53 + this.pointerX * 18;
      const centerY = this.height * 0.43 + this.pointerY * 12;
      const maxRadius = Math.max(this.width, this.height) * 0.78;

      this.stars.forEach((star) => {
        const angle = star.angle + now * star.speed;
        const ellipticalRadius = star.radius;
        const x = centerX + Math.cos(angle) * ellipticalRadius + this.pointerX * star.depth * 15;
        const y = centerY + Math.sin(angle) * ellipticalRadius * 0.72 + this.pointerY * star.depth * 12;

        if (x < -10 || x > this.width + 10 || y < -10 || y > this.height + 10) return;

        const edgeFade = 1 - clamp(star.radius / maxRadius, 0, 0.75);
        const flicker = 0.78 + Math.sin(now * 0.0012 + star.flicker) * 0.22;
        const alpha = star.alpha * edgeFade * flicker;
        const size = star.size * star.depth;

        this.context.beginPath();
        this.context.fillStyle =
          star.depth > 0.72
            ? `rgba(210, 229, 245, ${alpha})`
            : `rgba(118, 170, 214, ${alpha * 0.85})`;
        this.context.arc(x, y, size, 0, Math.PI * 2);
        this.context.fill();

        if (size > 1.15) {
          this.context.strokeStyle = `rgba(210, 229, 245, ${alpha * 0.28})`;
          this.context.lineWidth = 0.45;
          this.context.beginPath();
          this.context.moveTo(x - size * 3.2, y);
          this.context.lineTo(x + size * 3.2, y);
          this.context.moveTo(x, y - size * 3.2);
          this.context.lineTo(x, y + size * 3.2);
          this.context.stroke();
        }
      });
    }

    drawMeteors(now, delta) {
      if (now - this.lastMeteorAt > this.nextMeteorDelay) this.spawnMeteor(now);

      this.meteors = this.meteors.filter((meteor) => {
        meteor.life += delta * 0.06;
        meteor.x += meteor.vx * delta * 0.06;
        meteor.y += meteor.vy * delta * 0.06;
        const remaining = 1 - meteor.life / meteor.maxLife;
        if (remaining <= 0) return false;

        const magnitude = Math.hypot(meteor.vx, meteor.vy);
        const ux = meteor.vx / magnitude;
        const uy = meteor.vy / magnitude;
        const tailX = meteor.x - ux * meteor.length;
        const tailY = meteor.y - uy * meteor.length;
        const gradient = this.context.createLinearGradient(tailX, tailY, meteor.x, meteor.y);
        gradient.addColorStop(0, "rgba(255,255,255,0)");
        gradient.addColorStop(
          0.74,
          meteor.coral
            ? `rgba(238, 139, 129, ${0.28 * remaining})`
            : `rgba(111, 178, 230, ${0.28 * remaining})`
        );
        gradient.addColorStop(1, `rgba(255, 250, 235, ${0.92 * remaining})`);

        this.context.strokeStyle = gradient;
        this.context.lineWidth = meteor.width;
        this.context.beginPath();
        this.context.moveTo(tailX, tailY);
        this.context.lineTo(meteor.x, meteor.y);
        this.context.stroke();

        this.context.beginPath();
        this.context.fillStyle = `rgba(255, 251, 238, ${remaining})`;
        this.context.arc(meteor.x, meteor.y, 1.6, 0, Math.PI * 2);
        this.context.fill();
        return true;
      });
    }

    drawPetals(delta) {
      const scrollFactor = clamp(window.scrollY / Math.max(window.innerHeight * 0.8, 1), 0, 1);

      this.petals.forEach((petal, index) => {
        if (!prefersReducedMotion) {
          petal.sway += petal.swaySpeed * delta;
          petal.x += (petal.vx + Math.sin(petal.sway) * 0.22) * delta * 0.06;
          petal.y += petal.vy * delta * 0.06;
          petal.rotation += petal.rotationSpeed * delta * 0.06;
        }

        if (petal.y > this.height + 35 || petal.x < -50 || petal.x > this.width + 50) {
          this.petals[index] = this.createPetal(false);
          return;
        }

        const alpha = petal.alpha * (0.35 + scrollFactor * 0.65);
        this.context.save();
        this.context.translate(petal.x, petal.y);
        this.context.rotate(petal.rotation);
        this.context.scale(1, 0.58 + Math.sin(petal.sway) * 0.16);
        this.context.beginPath();
        this.context.moveTo(0, -petal.size);
        this.context.bezierCurveTo(
          petal.size * 0.85,
          -petal.size * 0.35,
          petal.size * 0.78,
          petal.size * 0.58,
          0,
          petal.size
        );
        this.context.bezierCurveTo(
          -petal.size * 0.72,
          petal.size * 0.48,
          -petal.size * 0.68,
          -petal.size * 0.45,
          0,
          -petal.size
        );
        this.context.fillStyle = petal.warm
          ? `rgba(235, 148, 146, ${alpha})`
          : `rgba(230, 224, 220, ${alpha * 0.8})`;
        this.context.fill();
        this.context.restore();
      });
    }

    draw(now, delta) {
      this.context.clearRect(0, 0, this.width, this.height);
      this.drawStarField(now);
      if (!prefersReducedMotion) this.drawMeteors(now, delta);
      this.drawPetals(delta);
    }

    render(now) {
      this.frameId = 0;
      if (this.suspended || document.hidden) return;
      const delta = clamp(now - this.lastTime, 0, 32);
      this.lastTime = now;
      this.draw(now, delta);
      this.frameId = requestAnimationFrame(this.render);
    }
  }

  const cosmosCanvas = document.getElementById("cosmosCanvas");
  const cosmicField = cosmosCanvas ? new CosmicField(cosmosCanvas) : null;

  const comicReader = document.getElementById("comicReader");
  const readerStage = document.getElementById("readerStage");
  const readerPages = document.getElementById("readerPages");
  const readerClose = document.getElementById("readerClose");
  const readerChapterNumber = document.getElementById("readerChapterNumber");
  const readerTitle = document.getElementById("readerTitle");
  const readerCurrentPage = document.getElementById("readerCurrentPage");
  const readerTotalPages = document.getElementById("readerTotalPages");
  const readerProgressBar = document.getElementById("readerProgressBar");
  const readerEyebrow = document.getElementById("readerEyebrow");
  const readerIntroTitle = document.getElementById("readerIntroTitle");
  const readerFinishTitle = document.getElementById("readerFinishTitle");
  const readerNextChapter = document.getElementById("readerNextChapter");
  let activeChapter = 1;
  let readerPageObserver = null;

  const chapterNumbers = () =>
    Object.keys(chapters)
      .map(Number)
      .filter(Number.isFinite)
      .sort((a, b) => a - b);

  const nextChapterNumber = (chapterNumber) => {
    const numbers = chapterNumbers();
    const currentIndex = numbers.indexOf(Number(chapterNumber));
    return currentIndex >= 0 ? numbers[currentIndex + 1] || null : null;
  };

  const setReaderProgress = () => {
    if (!readerStage || !readerProgressBar) return;
    const max = readerStage.scrollHeight - readerStage.clientHeight;
    const progress = max > 0 ? readerStage.scrollTop / max : 0;
    readerProgressBar.style.transform = `scaleX(${clamp(progress, 0, 1)})`;
  };

  const observeReaderPages = () => {
    readerPageObserver?.disconnect();
    if (!readerStage || !readerPages || !("IntersectionObserver" in window)) return;

    readerPageObserver = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        const page = Number(visible.target.dataset.readerPage || 1);
        if (readerCurrentPage) readerCurrentPage.textContent = pad(page);
        writeStoredReaderProgress(activeChapter, page);
        if (mobileReadLabel) mobileReadLabel.textContent = `续读 ${pad(page)}`;
      },
      { root: readerStage, threshold: [0.22, 0.45, 0.7] }
    );

    readerPages.querySelectorAll(".reader-page").forEach((page) => readerPageObserver.observe(page));
  };

  const renderReaderChapter = (chapterNumber, shouldResetScroll = true, targetPage = 1) => {
    const requestedChapter = Number(chapterNumber);
    const chapter = chapters[requestedChapter] || chapters[1];
    activeChapter = chapters[requestedChapter] ? requestedChapter : 1;
    if (!readerPages) return;
    const readingPages = getChapterPages(chapter);

    readerPages.replaceChildren();
    const fragment = document.createDocumentFragment();

    readingPages.forEach((source, pageIndex) => {
      const page = pageIndex + 1;
      const figure = document.createElement("figure");
      figure.className = "reader-page";
      figure.dataset.readerPage = String(page);

      const image = document.createElement("img");
      image.src = source;
      image.alt = page === 1 && chapter.cover
        ? `${chapter.title} 章节首页`
        : `${chapter.title} 第${pad(chapter.cover ? page - 1 : page)}张`;
      image.width = 1086;
      image.height = 1448;
      image.loading = page <= 2 ? "eager" : "lazy";
      image.decoding = "async";

      const caption = document.createElement("figcaption");
      caption.textContent = page === 1 && chapter.cover ? "首页" : pad(chapter.cover ? page - 1 : page);

      figure.append(image, caption);
      fragment.append(figure);
    });

    readerPages.append(fragment);
    if (readerChapterNumber) readerChapterNumber.textContent = `CHAPTER ${chapter.number}`;
    if (readerTitle) readerTitle.textContent = chapter.title;
    if (readerCurrentPage) readerCurrentPage.textContent = "01";
    if (readerTotalPages) readerTotalPages.textContent = pad(readingPages.length);
    if (readerEyebrow) readerEyebrow.textContent = chapter.eyebrow;
    if (readerIntroTitle) readerIntroTitle.textContent = chapter.title;
    if (readerFinishTitle) readerFinishTitle.textContent = `第${chapter.number}篇 · 完`;

    document.querySelectorAll("[data-reader-chapter]").forEach((button) => {
      const pressed = Number(button.dataset.readerChapter) === activeChapter;
      button.setAttribute("aria-pressed", String(pressed));
    });

    if (readerNextChapter) {
      const nextChapter = nextChapterNumber(activeChapter);
      if (nextChapter) {
        readerNextChapter.hidden = false;
        readerNextChapter.dataset.nextChapter = String(nextChapter);
        readerNextChapter.textContent = `继续第${pad(nextChapter)}篇`;
      } else {
        readerNextChapter.hidden = true;
        delete readerNextChapter.dataset.nextChapter;
      }
    }

    if (shouldResetScroll && readerStage) readerStage.scrollTop = 0;
    if (readerProgressBar) readerProgressBar.style.transform = "scaleX(0)";
    observeReaderPages();

    if (readerStage && Number(targetPage) > 1) {
      const destination = readerPages.querySelector(`[data-reader-page="${Number(targetPage)}"]`);
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          if (!destination) return;
          const stageRect = readerStage.getBoundingClientRect();
          const destinationRect = destination.getBoundingClientRect();
          readerStage.scrollTop = Math.max(
            0,
            readerStage.scrollTop + destinationRect.top - stageRect.top - 8
          );
          setReaderProgress();
        });
      });
    }
  };

  const openReader = (chapterNumber = 1) => {
    if (!comicReader) return;
    const shouldResume = chapterNumber === "resume";
    const storedProgress = shouldResume ? readStoredReaderProgress() : null;
    const resolvedChapter = storedProgress?.chapter || Number(chapterNumber) || 1;
    const resolvedPage = storedProgress?.page || 1;
    renderReaderChapter(resolvedChapter, true, resolvedPage);
    document.body.classList.add("reader-is-open");
    cosmicField?.setSuspended(true);
    if (typeof comicReader.showModal === "function") {
      if (!comicReader.open) comicReader.showModal();
    } else {
      comicReader.setAttribute("open", "");
    }
    window.requestAnimationFrame(() => readerStage?.focus({ preventScroll: true }));
  };

  const closeReader = () => {
    if (!comicReader) return;
    if (typeof comicReader.close === "function" && comicReader.open) {
      comicReader.close();
    } else {
      comicReader.removeAttribute("open");
      document.body.classList.remove("reader-is-open");
      cosmicField?.setSuspended(false);
    }
  };

  document.addEventListener("click", (event) => {
    const openButton = event.target.closest("[data-open-reader]");
    if (openButton) {
      openReader(openButton.dataset.openReader || "1");
      return;
    }

    const chapterButton = event.target.closest("[data-reader-chapter]");
    if (chapterButton) {
      renderReaderChapter(Number(chapterButton.dataset.readerChapter || 1));
    }
  });

  readerNextChapter?.addEventListener("click", () => {
    const nextChapter = Number(readerNextChapter.dataset.nextChapter);
    if (chapters[nextChapter]) renderReaderChapter(nextChapter);
  });

  readerClose?.addEventListener("click", closeReader);
  comicReader?.addEventListener("close", () => {
    document.body.classList.remove("reader-is-open");
    readerPageObserver?.disconnect();
    cosmicField?.setSuspended(false);
  });

  comicReader?.addEventListener("click", (event) => {
    if (event.target === comicReader) closeReader();
  });

  readerStage?.addEventListener("scroll", setReaderProgress, { passive: true });

  window.addEventListener("keydown", (event) => {
    if (!comicReader?.open) return;
    if (event.key === "Escape") closeReader();
    if (event.key === "PageDown") {
      event.preventDefault();
      readerStage?.scrollBy({ top: window.innerHeight * 0.82, behavior: prefersReducedMotion ? "auto" : "smooth" });
    }
    if (event.key === "PageUp") {
      event.preventDefault();
      readerStage?.scrollBy({ top: -window.innerHeight * 0.82, behavior: prefersReducedMotion ? "auto" : "smooth" });
    }
  });

  const chapterTrack = document.getElementById("chapterTrack");
  const readerChapterTabs = document.getElementById("readerChapterTabs");
  const storyChapterTabs = document.getElementById("storyChapterTabs");
  const storyChapterNumber = document.getElementById("storyChapterNumber");
  const storyTitle = document.getElementById("storyTitle");
  const storyContent = document.getElementById("storyContent");
  const storyOpenReader = document.getElementById("storyOpenReader");
  const comicHeroCover = document.getElementById("comicHeroCover");
  const heroAmbientImage = document.querySelector(".hero-ambient-image");
  const uploadDialog = document.getElementById("comicUploadDialog");
  const openUploadButton = document.getElementById("openComicUpload");
  const closeUploadButton = document.getElementById("closeComicUpload");
  const uploadForm = document.getElementById("comicUploadForm");
  const uploadPassword = document.getElementById("comicUploadPassword");
  const uploadFiles = document.getElementById("comicUploadFiles");
  const uploadFileHint = document.getElementById("comicUploadFileHint");
  const packagePreview = document.getElementById("comicPackagePreview");
  const uploadStatusText = document.getElementById("comicUploadStatusText");
  const uploadProgress = document.getElementById("comicUploadProgress");
  const uploadSubmit = document.getElementById("comicUploadSubmit");
  const builtInChapters = Object.fromEntries(
    Object.entries(chapters).map(([number, chapter]) => [number, { ...chapter }])
  );
  const zipLimits = {
    compressedBytes: 180 * 1024 * 1024,
    expandedBytes: 450 * 1024 * 1024,
    storyBytes: 200 * 1024,
    entries: 100,
    pages: 80
  };
  let activeStoryChapter = 3;
  let storyRequestToken = 0;
  let inspectedPackage = null;
  let uploadInProgress = false;

  const setUploadStatus = (message, progress = 0, state = "") => {
    if (uploadStatusText) uploadStatusText.textContent = message;
    if (uploadProgress) uploadProgress.style.transform = `scaleX(${clamp(progress, 0, 1)})`;
    uploadDialog?.setAttribute("data-upload-state", state);
  };

  const postComicUpload = async (payload) => {
    const response = await fetch("/api/comic-upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(result.error || "上传失败，请稍后重试。");
      error.status = response.status;
      throw error;
    }
    return result;
  };

  const bytesToBase64 = (bytes) => {
    let result = "";
    const chunkSize = 0x8000;
    for (let index = 0; index < bytes.length; index += chunkSize) {
      result += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
    }
    return window.btoa(result);
  };

  const imageToWebPage = async (file) => {
    const bitmap =
      typeof createImageBitmap === "function"
        ? await createImageBitmap(file)
        : await new Promise((resolve, reject) => {
            const image = new Image();
            const source = URL.createObjectURL(file);
            image.onload = () => {
              URL.revokeObjectURL(source);
              resolve(image);
            };
            image.onerror = () => {
              URL.revokeObjectURL(source);
              reject(new Error("无法读取这张图片。"));
            };
            image.src = source;
          });
    const maxWidth = 1800;
    const scale = Math.min(1, maxWidth / Math.max(bitmap.width, 1));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: false });
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    if (typeof bitmap.close === "function") bitmap.close();

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (result) => (result ? resolve(result) : reject(new Error("图片压缩失败"))),
        "image/webp",
        0.88
      );
    });

    if (blob.size > 2.8 * 1024 * 1024) {
      throw new Error(`${file.name} 压缩后仍超过上传限制，请先缩小图片。`);
    }

    const data = bytesToBase64(new Uint8Array(await blob.arrayBuffer()));
    return { data, contentType: "image/webp", width, height };
  };

  const storyMarkup = (markdown) => {
    const blocks = String(markdown || "")
      .replace(/^\uFEFF/, "")
      .replace(/\r\n?/g, "\n")
      .split(/\n{2,}/)
      .map((block) => block.trim())
      .filter(Boolean);

    let skippedPrimaryHeading = false;
    return blocks
      .map((block) => {
        if (/^#\s+/.test(block) && !skippedPrimaryHeading) {
          skippedPrimaryHeading = true;
          return "";
        }
        if (/^(系列|季|篇章|正文)\s*[:：]/.test(block)) return "";
        const heading = block.match(/^#{2,4}\s+(.+)$/);
        if (heading) return `<h4>${escapeHtml(heading[1])}</h4>`;
        const lines = block
          .split("\n")
          .filter((line) => !/^(系列|季|篇章|正文)\s*[:：]/.test(line.trim()));
        if (!lines.length) return "";
        return `<p>${lines.map((line) => escapeHtml(line.trim())).join("<br>")}</p>`;
      })
      .filter(Boolean)
      .join("");
  };

  const loadChapterStory = async (chapter) => {
    if (typeof chapter.story === "string" && chapter.story.trim()) return chapter.story;
    if (!chapter.storyUrl) return "";
    const response = await fetch(chapter.storyUrl, { cache: "no-store" });
    if (!response.ok) throw new Error("暂时无法载入这一篇故事。");
    chapter.story = await response.text();
    return chapter.story;
  };

  const renderStoryChapter = async (chapterNumber, shouldScroll = false) => {
    const requested = Number(chapterNumber);
    const resolved = chapters[requested] ? requested : chapterNumbers()[0];
    const chapter = chapters[resolved];
    if (!chapter) return;
    activeStoryChapter = resolved;
    const token = ++storyRequestToken;

    if (storyChapterNumber) storyChapterNumber.textContent = `第${chapter.number}篇`;
    if (storyTitle) storyTitle.textContent = chapter.title;
    if (storyContent) storyContent.innerHTML = "<p>正在载入故事。</p>";
    if (storyOpenReader) storyOpenReader.dataset.openReader = String(resolved);
    storyChapterTabs?.querySelectorAll("[data-story-chapter]").forEach((button) => {
      button.setAttribute(
        "aria-pressed",
        String(Number(button.dataset.storyChapter) === resolved)
      );
    });

    try {
      const markdown = await loadChapterStory(chapter);
      if (token !== storyRequestToken || !storyContent) return;
      storyContent.innerHTML = markdown
        ? storyMarkup(markdown)
        : "<p>这一篇暂时只有漫画图，文字故事还没有进入成品包。</p>";
    } catch (error) {
      if (token === storyRequestToken && storyContent) {
        storyContent.innerHTML = `<p>${escapeHtml(error.message || "故事载入失败。")}</p>`;
      }
    }

    if (shouldScroll) {
      document.getElementById("stories")?.scrollIntoView({
        behavior: prefersReducedMotion ? "auto" : "smooth",
        block: "start"
      });
    }
  };

  const chapterCardMarkup = (chapterNumber, chapter) => {
    const cover = chapter.cover || chapter.pages?.[0] || "";
    const shapeClass = chapterNumber % 2 === 0 ? "chapter-card-two" : "chapter-card-one";
    return `
      <article class="chapter-card ${shapeClass} is-visible" data-chapter-card="${chapterNumber}" data-tilt-card>
        <button class="chapter-card-hit" type="button" data-open-reader="${chapterNumber}" aria-label="阅读第${chapterNumber}篇《${escapeHtml(chapter.title)}》"></button>
        <img src="${escapeHtml(cover)}" alt="第${chapterNumber}篇《${escapeHtml(chapter.title)}》章节首页" loading="lazy" width="1086" height="1448">
        <div class="chapter-card-wash"></div>
        <div class="chapter-number" aria-hidden="true">${pad(chapterNumber)}</div>
        <div class="chapter-card-copy">
          <h3>${escapeHtml(chapter.title)}</h3>
          <p>${escapeHtml(chapter.summary || "一条新的星轨，已经抵达这里。")}</p>
          <div class="chapter-card-actions">
            <button type="button" data-open-reader="${chapterNumber}">阅读漫画</button>
            <button type="button" data-open-story="${chapterNumber}">文字故事</button>
          </div>
        </div>
      </article>
    `;
  };

  const renderChapterNavigation = () => {
    const numbers = chapterNumbers();
    if (chapterTrack) {
      chapterTrack.innerHTML = numbers
        .map((number) => chapterCardMarkup(number, chapters[number]))
        .join("");
      bindTiltCards(chapterTrack);
    }
    if (readerChapterTabs) {
      readerChapterTabs.innerHTML = numbers
        .map(
          (number) =>
            `<button type="button" data-reader-chapter="${number}" aria-pressed="${number === activeChapter}">第${pad(number)}篇</button>`
        )
        .join("");
    }
    if (storyChapterTabs) {
      storyChapterTabs.innerHTML = numbers
        .map(
          (number) =>
            `<button type="button" data-story-chapter="${number}" aria-pressed="${number === activeStoryChapter}">${pad(number)} · ${escapeHtml(chapters[number].title)}</button>`
        )
        .join("");
    }

    const latestNumber = numbers.at(-1);
    const latestChapter = chapters[latestNumber];
    if (latestChapter?.cover && comicHeroCover) {
      comicHeroCover.src = latestChapter.cover;
      comicHeroCover.alt = `第${latestChapter.number}篇《${latestChapter.title}》章节首页`;
    }
    if (latestChapter?.cover && heroAmbientImage) {
      heroAmbientImage.style.backgroundImage = `url("${latestChapter.cover}")`;
    }
    if (!chapters[activeStoryChapter]) activeStoryChapter = latestNumber || 1;
  };

  const registerRemoteChapters = (items) => {
    Object.keys(chapters).forEach((number) => delete chapters[number]);
    Object.entries(builtInChapters).forEach(([number, chapter]) => {
      chapters[number] = { ...chapter };
    });

    const fallbackStart = Math.max(...builtInChapterNumbers) + 1;
    items.forEach((item, index) => {
      const declaredNumber = Number(item.chapterNumber);
      const chapterNumber =
        Number.isInteger(declaredNumber) && declaredNumber >= 1 && declaredNumber <= 99
          ? declaredNumber
          : fallbackStart + index;
      const pages = Array.isArray(item.pages) ? item.pages.filter(Boolean) : [];
      if (!pages.length) return;
      chapters[chapterNumber] = {
        number: pad(chapterNumber),
        title: item.title || `未命名篇章 ${pad(chapterNumber)}`,
        summary: item.summary || "",
        eyebrow: item.eyebrow || `第一季《雪落纽约》／第${pad(chapterNumber)}篇`,
        pageCount: pages.length,
        pages,
        cover: item.cover || pages[0],
        story: typeof item.story === "string" ? item.story : "",
        id: item.id || `remote-${chapterNumber}`
      };
    });
    renderChapterNavigation();
    renderStoryChapter(activeStoryChapter);
  };

  const loadRemoteChapters = async () => {
    try {
      const response = await fetch("/api/comic-chapters", { cache: "no-store" });
      if (!response.ok) return;
      const payload = await response.json();
      registerRemoteChapters(Array.isArray(payload.chapters) ? payload.chapters : []);
    } catch {
      // 云端尚未配置时，内置篇章仍可完整阅读。
    }
  };

  document.addEventListener("click", (event) => {
    const storyButton = event.target.closest("[data-open-story]");
    if (storyButton) {
      renderStoryChapter(Number(storyButton.dataset.openStory || 1), true);
      return;
    }
    const storyTab = event.target.closest("[data-story-chapter]");
    if (storyTab) {
      renderStoryChapter(Number(storyTab.dataset.storyChapter || 1));
    }
  });

  const unzipPackage = async (file) => {
    if (!window.fflate?.unzip || !window.fflate?.strFromU8) {
      throw new Error("压缩包解析组件没有载入，请刷新页面后重试。");
    }
    if (file.size > zipLimits.compressedBytes) {
      throw new Error("压缩包超过 180MB，请检查是否误放了工作文件或重复压缩包。");
    }
    const source = new Uint8Array(await file.arrayBuffer());
    return new Promise((resolve, reject) => {
      window.fflate.unzip(source, (error, files) => {
        if (error) reject(new Error("压缩包无法解开，请重新导出完整成品包。"));
        else resolve(files);
      });
    });
  };

  const packageSummary = (story) => {
    const paragraphs = String(story || "")
      .replace(/^\uFEFF/, "")
      .replace(/\r\n?/g, "\n")
      .split(/\n{2,}/)
      .map((block) => block.trim())
      .filter(
        (block) =>
          block &&
          !/^#{1,4}\s/.test(block) &&
          !/^(系列|季|篇章|正文)\s*[:：]/.test(block) &&
          !/^[^：:\n]{1,10}[：:][“"]/u.test(block)
      );
    const candidate = paragraphs[0] || "一条新的星轨，已经抵达这里。";
    return candidate.replace(/\s+/g, " ").slice(0, 110);
  };

  const imageMimeType = (fileName) => {
    const extension = fileName.split(".").pop()?.toLowerCase();
    if (extension === "png") return "image/png";
    if (extension === "webp") return "image/webp";
    return "image/jpeg";
  };

  const decodeArchivePath = (value) => {
    const source = String(value || "");
    if ([...source].some((character) => character.charCodeAt(0) > 255)) return source;
    try {
      const bytes = Uint8Array.from(source, (character) => character.charCodeAt(0));
      const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      return decoded || source;
    } catch {
      return source;
    }
  };

  const inspectComicPackage = async (file) => {
    if (!file || !/\.zip$/i.test(file.name)) {
      throw new Error("请选择完整成品包的 ZIP 文件。");
    }
    const nameMatch = file.name.match(/^第(\d{2})篇[_\s-]+(.+)\.zip$/i);
    if (!nameMatch) {
      throw new Error("压缩包请命名为“第XX篇_标题.zip”。");
    }
    const chapterNumber = Number(nameMatch[1]);
    const title = nameMatch[2].trim();
    if (!chapterNumber || chapterNumber > 99 || !title) {
      throw new Error("无法从压缩包文件名识别篇号和标题。");
    }

    const extracted = await unzipPackage(file);
    const rawEntries = Object.entries(extracted).filter(([entryPath]) => !entryPath.endsWith("/"));
    if (rawEntries.length > zipLimits.entries) {
      throw new Error("压缩包文件数量异常，请只保留本篇正式成品。");
    }

    const visibleEntries = rawEntries
      .map(([entryPath, data]) => ({
        path: decodeArchivePath(entryPath).replaceAll("\\", "/"),
        data
      }))
      .filter(
        ({ path }) =>
          !path.split("/").some((part) => part === "__MACOSX" || part.startsWith("."))
      );
    if (!visibleEntries.length) throw new Error("压缩包里没有找到成品文件。");

    const firstSegments = new Set(
      visibleEntries.filter(({ path }) => path.includes("/")).map(({ path }) => path.split("/")[0])
    );
    const hasRootFiles = visibleEntries.some(({ path }) => !path.includes("/"));
    let rootPrefix = "";
    if (!hasRootFiles && firstSegments.size === 1) rootPrefix = `${[...firstSegments][0]}/`;

    const entries = visibleEntries.map(({ path, data }) => ({
      name: rootPrefix && path.startsWith(rootPrefix) ? path.slice(rootPrefix.length) : path,
      data
    }));
    if (entries.some(({ name }) => name.includes("/"))) {
      throw new Error("成品文件需位于压缩包根目录，不能分散在多层文件夹中。");
    }
    if (entries.some(({ name }) => /\.zip$/i.test(name))) {
      throw new Error("成品包内不能再包含其他 ZIP 压缩包。");
    }

    const expandedBytes = entries.reduce((sum, entry) => sum + entry.data.byteLength, 0);
    if (expandedBytes > zipLimits.expandedBytes) {
      throw new Error("压缩包解压后超过 450MB，请检查是否混入了工作文件。");
    }

    const storyEntries = entries.filter(({ name }) => name === "剧情故事文字版.md");
    const coverEntries = entries.filter(({ name }) => name === "第00张_章节首页.png");
    const bodyEntries = entries
      .map((entry) => {
        const match = entry.name.match(/^第(\d{2})张_.+\.png$/i);
        return match && match[1] !== "00"
          ? { ...entry, pageNumber: Number(match[1]) }
          : null;
      })
      .filter(Boolean)
      .sort((a, b) => a.pageNumber - b.pageNumber);
    const recognizedNames = new Set([
      ...storyEntries.map(({ name }) => name),
      ...coverEntries.map(({ name }) => name),
      ...bodyEntries.map(({ name }) => name)
    ]);
    const unexpected = entries.filter(({ name }) => !recognizedNames.has(name));

    if (storyEntries.length !== 1) {
      throw new Error("成品包必须且只能包含一个“剧情故事文字版.md”。");
    }
    if (coverEntries.length !== 1) {
      throw new Error("成品包必须且只能包含一张“第00张_章节首页.png”。");
    }
    if (!bodyEntries.length || bodyEntries.length > zipLimits.pages) {
      throw new Error("正文漫画图需为连续的第01张至第80张 PNG。");
    }
    const missingPage = bodyEntries.find(
      (entry, index) => entry.pageNumber !== index + 1
    );
    if (missingPage) {
      throw new Error(`正文编号不连续，请从第01张开始依次编号；当前检测到第${pad(missingPage.pageNumber)}张。`);
    }
    if (unexpected.length) {
      throw new Error(`成品包内含非交付文件：${unexpected.slice(0, 2).map(({ name }) => name).join("、")}`);
    }

    const storyBytes = storyEntries[0].data;
    if (!storyBytes.byteLength || storyBytes.byteLength > zipLimits.storyBytes) {
      throw new Error("文字故事为空或超过 200KB。");
    }
    const story = window.fflate.strFromU8(storyBytes).replace(/^\uFEFF/, "").trim();
    if (!story) throw new Error("剧情故事文字版.md 里没有正文。");

    return {
      sourceKey: `${file.name}:${file.size}:${file.lastModified}`,
      chapterNumber,
      chapterId: `package-chapter-${pad(chapterNumber)}`,
      title,
      summary: packageSummary(story),
      story,
      cover: coverEntries[0],
      pages: bodyEntries
    };
  };

  const renderPackagePreview = (chapterPackage) => {
    if (!packagePreview) return;
    if (!chapterPackage) {
      packagePreview.hidden = true;
      packagePreview.replaceChildren();
      return;
    }
    packagePreview.hidden = false;
    packagePreview.innerHTML = `
      <strong>第${pad(chapterPackage.chapterNumber)}篇 · ${escapeHtml(chapterPackage.title)}</strong>
      <span>章节首页 1 张 · 正文 ${chapterPackage.pages.length} 张 · 文字故事已识别</span>
    `;
  };

  const openUploadDialog = () => {
    if (!uploadDialog) return;
    setUploadStatus("等待验证与文件选择。", 0, "");
    if (typeof uploadDialog.showModal === "function") uploadDialog.showModal();
    else uploadDialog.setAttribute("open", "");
    document.body.classList.add("comic-upload-is-open");
    window.setTimeout(() => uploadPassword?.focus(), 80);
  };

  const closeUploadDialog = () => {
    if (!uploadDialog || uploadInProgress) return;
    if (typeof uploadDialog.close === "function") uploadDialog.close();
    else uploadDialog.removeAttribute("open");
    document.body.classList.remove("comic-upload-is-open");
  };

  openUploadButton?.addEventListener("click", openUploadDialog);
  closeUploadButton?.addEventListener("click", closeUploadDialog);
  uploadDialog?.addEventListener("close", () => document.body.classList.remove("comic-upload-is-open"));
  uploadDialog?.addEventListener("click", (event) => {
    if (event.target === uploadDialog) closeUploadDialog();
  });

  uploadFiles?.addEventListener("change", async () => {
    inspectedPackage = null;
    renderPackagePreview(null);
    const file = uploadFiles.files?.[0];
    if (!file) {
      if (uploadFileHint) {
        uploadFileHint.textContent = "包内需包含第00张章节首页、连续编号正文图与剧情故事文字版.md。";
      }
      return;
    }
    try {
      setUploadStatus("正在检查成品包结构。", 0.08, "uploading");
      const chapterPackage = await inspectComicPackage(file);
      inspectedPackage = chapterPackage;
      renderPackagePreview(chapterPackage);
      if (uploadFileHint) uploadFileHint.textContent = file.name;
      setUploadStatus("成品包完整，可以输入密码后同步。", 0.16, "ready");
    } catch (error) {
      setUploadStatus(error.message || "成品包检查失败。", 0, "error");
    }
  });

  uploadForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (uploadInProgress) return;

    const file = uploadFiles?.files?.[0];
    if (!file) {
      setUploadStatus("请先选择完整成品包。", 0, "error");
      return;
    }

    uploadInProgress = true;
    uploadSubmit.disabled = true;
    closeUploadButton.disabled = true;
    const password = uploadPassword.value;
    const pageUrls = [];

    try {
      const sourceKey = `${file.name}:${file.size}:${file.lastModified}`;
      const chapterPackage =
        inspectedPackage?.sourceKey === sourceKey
          ? inspectedPackage
          : await inspectComicPackage(file);
      inspectedPackage = chapterPackage;
      const { chapterId } = chapterPackage;
      const totalSteps = chapterPackage.pages.length + 2;
      const version = Date.now();

      setUploadStatus("正在优化章节首页。", 0.18, "uploading");
      const coverFile = new File(
        [chapterPackage.cover.data],
        chapterPackage.cover.name,
        { type: imageMimeType(chapterPackage.cover.name) }
      );
      const coverNormalized = await imageToWebPage(coverFile);
      const coverResult = await postComicUpload({
        action: "cover",
        password,
        chapterId,
        data: coverNormalized.data,
        contentType: coverNormalized.contentType,
        width: coverNormalized.width,
        height: coverNormalized.height
      });
      const coverUrl = `${coverResult.url}${coverResult.url.includes("?") ? "&" : "?"}v=${version}`;

      for (let index = 0; index < chapterPackage.pages.length; index += 1) {
        const pageEntry = chapterPackage.pages[index];
        setUploadStatus(
          `正在同步漫画图 ${index + 1} / ${chapterPackage.pages.length}`,
          0.18 + ((index + 1) / totalSteps) * 0.72,
          "uploading"
        );
        const pageFile = new File([pageEntry.data], pageEntry.name, {
          type: imageMimeType(pageEntry.name)
        });
        const normalized = await imageToWebPage(pageFile);
        const result = await postComicUpload({
          action: "page",
          password,
          chapterId,
          pageIndex: index + 1,
          data: normalized.data,
          contentType: normalized.contentType,
          width: normalized.width,
          height: normalized.height
        });
        pageUrls.push(`${result.url}${result.url.includes("?") ? "&" : "?"}v=${version}`);
      }

      setUploadStatus("正在更新篇章、封面与文字故事。", 0.94, "uploading");
      await postComicUpload({
        action: "manifest",
        password,
        chapterId: chapterPackage.chapterId,
        chapterNumber: chapterPackage.chapterNumber,
        title: chapterPackage.title,
        summary: chapterPackage.summary,
        cover: coverUrl,
        story: chapterPackage.story,
        pages: pageUrls,
        eyebrow: `第一季《雪落纽约》／第${pad(chapterPackage.chapterNumber)}篇`
      });

      setUploadStatus("同步完成。封面、漫画和故事都已更新。", 1, "success");
      await loadRemoteChapters();
      uploadForm.reset();
      inspectedPackage = null;
      renderPackagePreview(null);
      if (uploadFileHint) {
        uploadFileHint.textContent = "包内需包含第00张章节首页、连续编号正文图与剧情故事文字版.md。";
      }
      window.setTimeout(() => {
        uploadInProgress = false;
        closeUploadButton.disabled = false;
        closeUploadDialog();
      }, 1300);
    } catch (error) {
      const message = error.status === 401 ? "密码不正确，未获得上传权限。" : error.message || "上传没有完成，请重试。";
      setUploadStatus(message, 0, "error");
      uploadInProgress = false;
      closeUploadButton.disabled = false;
    } finally {
      uploadSubmit.disabled = false;
    }
  });

  renderChapterNavigation();
  renderStoryChapter(activeStoryChapter);
  loadRemoteChapters();
})();
