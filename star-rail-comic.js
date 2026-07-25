(() => {
  "use strict";

  const chapters = {
    1: {
      number: "01",
      title: "十二小时之外的新轨",
      eyebrow: "第一季《雪落纽约》／第一篇",
      count: 25,
      directory: "assets/star-rail-comic/chapter-01"
    },
    2: {
      number: "02",
      title: "空白找到了地址",
      eyebrow: "第一季《雪落纽约》／第二篇",
      count: 24,
      directory: "assets/star-rail-comic/chapter-02"
    }
  };

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const usesCoarsePointer = window.matchMedia("(pointer: coarse)").matches;
  const readerProgressKey = "startrace_reader_progress";
  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
  const pad = (value) => String(value).padStart(2, "0");

  const readStoredReaderProgress = () => {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(readerProgressKey) || "{}");
      const chapter = Number(parsed.chapter) === 2 ? 2 : 1;
      const maxPage = chapters[chapter].count;
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
          chapter: Number(chapter) === 2 ? 2 : 1,
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

    ["world", "chapters", "characters"].forEach((id) => {
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

  document.querySelectorAll("[data-tilt-card]").forEach((card) => {
    if (prefersReducedMotion) return;

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

  const hangzhouClock = document.getElementById("hangzhouClock");
  const newYorkClock = document.getElementById("newYorkClock");
  const timeFormatter = (timeZone) =>
    new Intl.DateTimeFormat("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZone
    });

  const hangzhouFormatter = timeFormatter("Asia/Shanghai");
  const newYorkFormatter = timeFormatter("America/New_York");

  const updateClocks = () => {
    const now = new Date();
    if (hangzhouClock) {
      hangzhouClock.textContent = hangzhouFormatter.format(now);
      hangzhouClock.dateTime = now.toISOString();
    }
    if (newYorkClock) {
      newYorkClock.textContent = newYorkFormatter.format(now);
      newYorkClock.dateTime = now.toISOString();
    }
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

  const pageUrl = (chapter, page) =>
    `${chapter.directory}/page-${pad(page)}.webp`;

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
    const chapter = chapters[chapterNumber] || chapters[1];
    activeChapter = Number(chapterNumber) === 2 ? 2 : 1;
    if (!readerPages) return;

    readerPages.replaceChildren();
    const fragment = document.createDocumentFragment();

    for (let page = 1; page <= chapter.count; page += 1) {
      const figure = document.createElement("figure");
      figure.className = "reader-page";
      figure.dataset.readerPage = String(page);

      const image = document.createElement("img");
      image.src = pageUrl(chapter, page);
      image.alt = `${chapter.title} 第${page}张`;
      image.width = 1086;
      image.height = 1448;
      image.loading = page <= 2 ? "eager" : "lazy";
      image.decoding = "async";

      const caption = document.createElement("figcaption");
      caption.textContent = pad(page);

      figure.append(image, caption);
      fragment.append(figure);
    }

    readerPages.append(fragment);
    if (readerChapterNumber) readerChapterNumber.textContent = `CHAPTER ${chapter.number}`;
    if (readerTitle) readerTitle.textContent = chapter.title;
    if (readerCurrentPage) readerCurrentPage.textContent = "01";
    if (readerTotalPages) readerTotalPages.textContent = pad(chapter.count);
    if (readerEyebrow) readerEyebrow.textContent = chapter.eyebrow;
    if (readerIntroTitle) readerIntroTitle.textContent = chapter.title;
    if (readerFinishTitle) readerFinishTitle.textContent = `第${chapter.number}篇 · 完`;

    document.querySelectorAll("[data-reader-chapter]").forEach((button) => {
      const pressed = Number(button.dataset.readerChapter) === activeChapter;
      button.setAttribute("aria-pressed", String(pressed));
    });

    if (readerNextChapter) {
      if (activeChapter === 1) {
        readerNextChapter.hidden = false;
        readerNextChapter.textContent = "继续第二篇";
      } else {
        readerNextChapter.hidden = true;
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

  document.querySelectorAll("[data-open-reader]").forEach((button) => {
    button.addEventListener("click", () => {
      openReader(button.dataset.openReader || "1");
    });
  });

  document.querySelectorAll("[data-reader-chapter]").forEach((button) => {
    button.addEventListener("click", () => {
      renderReaderChapter(Number(button.dataset.readerChapter || 1));
    });
  });

  readerNextChapter?.addEventListener("click", () => {
    if (activeChapter === 1) renderReaderChapter(2);
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
})();
