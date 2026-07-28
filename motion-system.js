(() => {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const root = document.documentElement;
  const body = document.body;

  if (!body) return;

  const surfaceSelector = [
    ".orbit-station-card",
    ".figure-curation-feature",
    ".figure-curation-card",
    ".message-card",
    ".memory-film-card",
    ".memory-photo",
    ".tea-machine",
    ".recommend-card",
    ".tea-atlas-card",
    ".history-item",
    ".chapter-card",
    ".moment-card",
    ".character-panel",
    ".story-reading-panel"
  ].join(",");

  const tiltSelector = [
    ".orbit-station-card",
    ".figure-curation-feature",
    ".figure-curation-card",
    ".memory-photo"
  ].join(",");

  const magnetSelector = [
    ".orbit-scroll-mark",
    ".hero-actions a",
    ".hero-actions button",
    ".chapter-card-actions button",
    ".atlas-entry-btn",
    ".primary-tea-btn",
    ".ghost-tea-btn",
    ".feedback-buttons button",
    ".reader-nav-button",
    ".story-chapter-tab"
  ].join(",");

  const sparkSelector = [
    ".primary-tea-btn",
    ".chapter-card-actions button",
    ".hero-actions a",
    ".hero-actions button",
    ".feedback-buttons button",
    ".comic-upload-submit"
  ].join(",");

  const revealGroups = [
    { selector: ".orbit-home-copy", step: 0 },
    { selector: ".orbit-station-card", step: 72 },
    { selector: ".figure-curation-copy, .figure-curation-feature", step: 90 },
    { selector: ".figure-curation-card", step: 48 },
    { selector: ".message-page .hero-block, .message-page .archive-panel-heading", step: 80 },
    { selector: ".message-card", step: 42 },
    { selector: ".memory-hero, .memory-film-card", step: 90 },
    { selector: ".memory-photo", step: 54 },
    { selector: ".milk-hero-copy, .milk-hero-stage, .profile-card", step: 90 },
    { selector: ".history-item, .tea-atlas-card", step: 42 },
    { selector: ".comic-section .section-heading", step: 0 }
  ];

  const revealed = new WeakSet();
  const surfaced = new WeakSet();
  const tilted = new WeakSet();
  const magnetized = new WeakSet();

  const revealObserver =
    !reducedMotion && "IntersectionObserver" in window
      ? new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (!entry.isIntersecting) return;
              entry.target.classList.add("motion-in-view");
              revealObserver.unobserve(entry.target);
            });
          },
          { threshold: 0.1, rootMargin: "0px 0px -6% 0px" }
        )
      : null;

  const within = (scope, selector) => {
    const nodes = [];
    if (scope instanceof Element && scope.matches(selector)) nodes.push(scope);
    if (scope.querySelectorAll) nodes.push(...scope.querySelectorAll(selector));
    return nodes;
  };

  const addReveal = (node, delay) => {
    if (revealed.has(node) || node.matches("[data-reveal], [data-figure-reveal]")) return;
    revealed.add(node);
    node.classList.add("motion-reveal");
    node.style.setProperty("--motion-reveal-delay", `${Math.min(delay, 360)}ms`);
    if (!revealObserver) {
      node.classList.add("motion-in-view");
      return;
    }
    revealObserver.observe(node);
  };

  const addSurface = (node) => {
    if (surfaced.has(node)) return;
    surfaced.add(node);
    node.classList.add("motion-surface");

    const spotlight = document.createElement("span");
    spotlight.className = "motion-spotlight-layer";
    spotlight.setAttribute("aria-hidden", "true");
    node.append(spotlight);

    if (!finePointer || reducedMotion) return;

    let pointerFrame = 0;
    let pointerX = 0;
    let pointerY = 0;

    node.addEventListener(
      "pointermove",
      (event) => {
        const rect = node.getBoundingClientRect();
        pointerX = event.clientX - rect.left;
        pointerY = event.clientY - rect.top;
        node.classList.add("is-motion-pointing");
        if (pointerFrame) return;
        pointerFrame = window.requestAnimationFrame(() => {
          pointerFrame = 0;
          node.style.setProperty("--motion-x", `${pointerX}px`);
          node.style.setProperty("--motion-y", `${pointerY}px`);
        });
      },
      { passive: true }
    );

    node.addEventListener(
      "pointerleave",
      () => {
        node.classList.remove("is-motion-pointing");
        node.style.setProperty("--motion-x", "50%");
        node.style.setProperty("--motion-y", "50%");
      },
      { passive: true }
    );
  };

  const addTilt = (node) => {
    if (tilted.has(node) || !finePointer || reducedMotion || node.matches("[data-tilt-card]")) return;
    tilted.add(node);
    node.classList.add("motion-tilt");

    let frame = 0;
    let currentX = 0;
    let currentY = 0;
    let targetX = 0;
    let targetY = 0;
    let active = false;

    const renderTilt = () => {
      currentX += (targetX - currentX) * 0.16;
      currentY += (targetY - currentY) * 0.16;
      const settled = Math.abs(targetX - currentX) < 0.025 && Math.abs(targetY - currentY) < 0.025;

      if (!active && settled) {
        node.style.removeProperty("transform");
        node.classList.remove("is-motion-tilting");
        frame = 0;
        return;
      }

      node.style.transform = `perspective(1100px) translate3d(0, -7px, 0) rotateX(${currentX.toFixed(
        2
      )}deg) rotateY(${currentY.toFixed(2)}deg)`;
      frame = window.requestAnimationFrame(renderTilt);
    };

    const startTilt = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(renderTilt);
    };

    node.addEventListener(
      "pointermove",
      (event) => {
        const rect = node.getBoundingClientRect();
        const normalizedX = (event.clientX - rect.left) / Math.max(rect.width, 1) - 0.5;
        const normalizedY = (event.clientY - rect.top) / Math.max(rect.height, 1) - 0.5;
        targetX = normalizedY * -7;
        targetY = normalizedX * 9;
        active = true;
        node.classList.add("is-motion-tilting");
        startTilt();
      },
      { passive: true }
    );

    node.addEventListener(
      "pointerleave",
      () => {
        active = false;
        targetX = 0;
        targetY = 0;
        startTilt();
      },
      { passive: true }
    );
  };

  const addMagnet = (node) => {
    if (magnetized.has(node) || !finePointer || reducedMotion) return;
    magnetized.add(node);
    node.classList.add("motion-magnet");

    let frame = 0;
    let x = 0;
    let y = 0;

    node.addEventListener(
      "pointermove",
      (event) => {
        const rect = node.getBoundingClientRect();
        x = (event.clientX - rect.left - rect.width / 2) * 0.12;
        y = (event.clientY - rect.top - rect.height / 2) * 0.16;
        if (frame) return;
        frame = window.requestAnimationFrame(() => {
          frame = 0;
          node.style.translate = `${x.toFixed(2)}px ${y.toFixed(2)}px`;
        });
      },
      { passive: true }
    );

    node.addEventListener(
      "pointerleave",
      () => {
        node.style.removeProperty("translate");
      },
      { passive: true }
    );
  };

  const decorate = (scope) => {
    within(scope, surfaceSelector).forEach(addSurface);
    within(scope, tiltSelector).forEach(addTilt);
    within(scope, magnetSelector).forEach(addMagnet);

    revealGroups.forEach(({ selector, step }) => {
      within(scope, selector).forEach((node, index) => addReveal(node, index * step));
    });
  };

  const initScrollProgress = () => {
    const line = document.createElement("span");
    line.className = "motion-scroll-line";
    line.setAttribute("aria-hidden", "true");
    body.append(line);

    let frame = 0;
    const update = () => {
      frame = 0;
      const distance = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
      const progress = Math.min(1, Math.max(0, window.scrollY / distance));
      root.style.setProperty("--motion-scroll-progress", progress.toFixed(4));
    };
    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
  };

  const initPointerLight = () => {
    if (!finePointer || reducedMotion || body.classList.contains("comic-page")) return;

    const light = document.createElement("span");
    light.className = "motion-pointer-light";
    light.setAttribute("aria-hidden", "true");
    body.append(light);

    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight / 2;
    let currentX = targetX;
    let currentY = targetY;
    let frame = 0;

    const render = () => {
      currentX += (targetX - currentX) * 0.11;
      currentY += (targetY - currentY) * 0.11;
      light.style.transform = `translate3d(${currentX.toFixed(1)}px, ${currentY.toFixed(1)}px, 0)`;

      if (Math.abs(targetX - currentX) > 0.15 || Math.abs(targetY - currentY) > 0.15) {
        frame = window.requestAnimationFrame(render);
      } else {
        frame = 0;
      }
    };

    window.addEventListener(
      "pointermove",
      (event) => {
        targetX = event.clientX;
        targetY = event.clientY;
        body.classList.add("motion-pointer-active");
        if (!frame) frame = window.requestAnimationFrame(render);
      },
      { passive: true }
    );

    document.documentElement.addEventListener(
      "mouseleave",
      () => body.classList.remove("motion-pointer-active"),
      { passive: true }
    );
  };

  const initClickSparks = () => {
    if (reducedMotion) return;

    const canvas = document.createElement("canvas");
    canvas.className = "motion-spark-canvas";
    canvas.setAttribute("aria-hidden", "true");
    body.append(canvas);

    const context = canvas.getContext("2d");
    if (!context) return;

    let width = 0;
    let height = 0;
    let ratio = 1;
    let frame = 0;
    let sparks = [];

    const resize = () => {
      ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const accent = () => {
      const values = getComputedStyle(body)
        .getPropertyValue("--motion-accent")
        .trim()
        .split(/\s+/)
        .map(Number);
      return values.length === 3 && values.every(Number.isFinite) ? values : [228, 179, 137];
    };

    const draw = (now) => {
      context.clearRect(0, 0, width, height);
      const color = accent();
      sparks = sparks.filter((spark) => {
        const progress = Math.min(1, (now - spark.startedAt) / 560);
        if (progress >= 1) return false;
        const eased = 1 - (1 - progress) * (1 - progress);
        const distance = eased * 34;
        const length = 11 * (1 - eased);
        const alpha = 1 - progress;
        const x1 = spark.x + Math.cos(spark.angle) * distance;
        const y1 = spark.y + Math.sin(spark.angle) * distance;
        const x2 = spark.x + Math.cos(spark.angle) * (distance + length);
        const y2 = spark.y + Math.sin(spark.angle) * (distance + length);

        context.beginPath();
        context.moveTo(x1, y1);
        context.lineTo(x2, y2);
        context.lineWidth = 1.35;
        context.strokeStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha.toFixed(3)})`;
        context.shadowBlur = 10;
        context.shadowColor = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${(alpha * 0.8).toFixed(3)})`;
        context.stroke();
        return true;
      });

      context.shadowBlur = 0;
      if (sparks.length) {
        frame = window.requestAnimationFrame(draw);
      } else {
        frame = 0;
      }
    };

    resize();
    window.addEventListener("resize", resize, { passive: true });
    document.addEventListener("click", (event) => {
      if (!(event.target instanceof Element) || !event.target.closest(sparkSelector)) return;
      const startedAt = performance.now();
      sparks.push(
        ...Array.from({ length: 8 }, (_, index) => ({
          x: event.clientX,
          y: event.clientY,
          angle: (Math.PI * 2 * index) / 8,
          startedAt
        }))
      );
      if (!frame) frame = window.requestAnimationFrame(draw);
    });
  };

  const initPageTransitions = () => {
    const veil = document.createElement("span");
    veil.className = "motion-page-veil";
    veil.setAttribute("aria-hidden", "true");
    body.append(veil);

    window.addEventListener("pageshow", () => body.classList.remove("motion-page-exit"));

    document.addEventListener(
      "click",
      (event) => {
        if (reducedMotion || event.defaultPrevented || event.button !== 0) return;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        if (!(event.target instanceof Element)) return;

        const link = event.target.closest("a[href]");
        if (!link || link.target === "_blank" || link.hasAttribute("download")) return;

        const destination = new URL(link.href, window.location.href);
        if (destination.origin !== window.location.origin) return;
        if (destination.pathname === window.location.pathname && destination.search === window.location.search) return;
        if (!/\.html$/i.test(destination.pathname)) return;

        event.preventDefault();
        body.classList.add("motion-page-exit");
        window.setTimeout(() => {
          window.location.href = destination.href;
        }, 250);
      },
      true
    );
  };

  const initOrbitCompanion = () => {
    if (document.querySelector("[data-orbit-companion]")) return;

    const shell = document.createElement("div");
    shell.className = "orbit-companion-shell";
    shell.dataset.orbitCompanion = "";
    shell.innerHTML = `
      <button class="orbit-companion" type="button" aria-label="点我一下，福洛落会播放语音" aria-pressed="false">
        <span class="orbit-companion-glow" aria-hidden="true"></span>
        <span class="orbit-companion-rings" aria-hidden="true"><i></i><i></i></span>
        <span class="orbit-companion-figure" aria-hidden="true">
          <img src="photos/fuluoluo-mobile.webp?v=20260728" alt="" width="432" height="470" decoding="async">
        </span>
        <span class="orbit-companion-tip">
          <i aria-hidden="true"></i>
          <span data-companion-copy>点我一下</span>
        </span>
        <span class="orbit-companion-particles" aria-hidden="true"></span>
      </button>
      <audio class="orbit-companion-audio" preload="metadata">
        <source src="videos/woele.mp3?v=20260726" type="audio/mpeg">
      </audio>
    `;
    body.append(shell);

    const button = shell.querySelector(".orbit-companion");
    const image = shell.querySelector("img");
    const audio = shell.querySelector("audio");
    const copy = shell.querySelector("[data-companion-copy]");
    const particleLayer = shell.querySelector(".orbit-companion-particles");
    if (!button || !image || !audio || !copy || !particleLayer) {
      shell.remove();
      return;
    }

    let moveTimer = 0;
    let resetTimer = 0;
    let lastX = 0;
    let lastY = 0;
    let placed = false;
    let pausedUntil = 0;
    let destroyed = false;
    const canRoam = finePointer && !reducedMotion && window.innerWidth >= 860;
    const idleCopy = "点我一下";

    const randomBetween = (min, max) => min + Math.random() * Math.max(0, max - min);
    const clearMoveTimer = () => {
      window.clearTimeout(moveTimer);
      moveTimer = 0;
    };

    const safeBounds = () => {
      const rect = shell.getBoundingClientRect();
      const viewportWidth = window.visualViewport?.width || window.innerWidth || 360;
      const viewportHeight = window.visualViewport?.height || window.innerHeight || 640;
      const topbar = document.querySelector(".topbar, .comic-topbar");
      const topbarBottom = topbar ? Math.max(16, topbar.getBoundingClientRect().bottom + 14) : 18;
      const edge = window.innerWidth < 760 ? 10 : 18;
      const bottomReserve =
        window.innerWidth < 760 && document.querySelector(".mobile-dock") ? 104 : 0;
      return {
        minX: edge,
        maxX: Math.max(edge, viewportWidth - rect.width - edge),
        minY: Math.min(viewportHeight - rect.height - edge, topbarBottom),
        maxY: Math.max(topbarBottom, viewportHeight - rect.height - edge - bottomReserve),
        viewportHeight
      };
    };

    const setPosition = (x, y, duration = 0) => {
      const bounds = safeBounds();
      lastX = Math.min(bounds.maxX, Math.max(bounds.minX, Math.round(x)));
      lastY = Math.min(bounds.maxY, Math.max(bounds.minY, Math.round(y)));
      shell.style.setProperty("--companion-travel", `${Math.max(0, Math.round(duration))}ms`);
      shell.style.left = `${lastX}px`;
      shell.style.top = `${lastY}px`;
      shell.style.right = "auto";
      shell.style.bottom = "auto";
      placed = true;
    };

    const placeAtRest = () => {
      const bounds = safeBounds();
      setPosition(bounds.maxX, bounds.maxY, placed ? 420 : 0);
    };

    const scheduleRoam = (delay = randomBetween(5200, 8200)) => {
      if (!canRoam || destroyed || document.hidden) return;
      clearMoveTimer();
      moveTimer = window.setTimeout(roam, Math.max(800, delay));
    };

    const roam = () => {
      if (!canRoam || destroyed) return;
      if (Date.now() < pausedUntil || button.matches(":hover, :focus-visible")) {
        scheduleRoam(1400);
        return;
      }

      const bounds = safeBounds();
      const lowerEdge = Math.min(
        bounds.maxY,
        Math.max(bounds.minY, bounds.viewportHeight * 0.5)
      );
      const horizontalDrift = Math.min(76, Math.max(18, (bounds.maxX - bounds.minX) * 0.08));
      const anchors = [
        { x: bounds.maxX, y: randomBetween(lowerEdge, bounds.maxY) },
        { x: bounds.maxX - horizontalDrift, y: bounds.maxY },
        { x: bounds.maxX, y: bounds.maxY }
      ];
      const distant = anchors
        .map((point) => ({ ...point, distance: Math.hypot(point.x - lastX, point.y - lastY) }))
        .sort((a, b) => b.distance - a.distance);
      const target = distant[Math.random() > 0.72 ? 1 : 0] || distant[0];
      const duration = Math.min(9200, Math.max(4200, target.distance * 12));
      setPosition(target.x, target.y, duration);
      scheduleRoam(duration + randomBetween(3600, 6200));
    };

    const pauseRoam = (duration = 2400) => {
      pausedUntil = Date.now() + duration;
      clearMoveTimer();
      scheduleRoam(duration + 700);
    };

    const burst = () => {
      if (reducedMotion) return;
      particleLayer.replaceChildren();
      const count = window.innerWidth < 760 ? 9 : 13;
      Array.from({ length: count }, (_, index) => {
        const particle = document.createElement("i");
        const angle = (Math.PI * 2 * index) / count + randomBetween(-0.16, 0.16);
        const distance = randomBetween(42, 76);
        particle.style.setProperty("--particle-x", `${Math.cos(angle) * distance}px`);
        particle.style.setProperty("--particle-y", `${Math.sin(angle) * distance}px`);
        particle.style.setProperty("--particle-delay", `${Math.round(randomBetween(0, 80))}ms`);
        particle.style.setProperty("--particle-rotate", `${Math.round(randomBetween(-150, 150))}deg`);
        particleLayer.append(particle);
        return particle;
      });
      window.setTimeout(() => particleLayer.replaceChildren(), 980);
    };

    const setIdle = () => {
      button.classList.remove("is-speaking");
      button.setAttribute("aria-pressed", "false");
      button.setAttribute("aria-label", "点我一下，福洛落会播放语音");
      copy.textContent = idleCopy;
    };

    const activate = async () => {
      pauseRoam(3600);
      button.classList.remove("is-tapped");
      void button.offsetWidth;
      button.classList.add("is-tapped");
      burst();
      window.clearTimeout(resetTimer);

      if (!audio.paused && !audio.ended) {
        audio.pause();
        audio.currentTime = 0;
        setIdle();
        return;
      }

      audio.currentTime = 0;
      audio.volume = 0.82;
      try {
        await audio.play();
        button.classList.add("is-speaking");
        button.setAttribute("aria-pressed", "true");
        button.setAttribute("aria-label", "我饿了，点击停止语音");
        copy.textContent = "我饿了…";
      } catch {
        button.setAttribute("aria-label", "再点一次，播放福洛落语音");
        copy.textContent = "再点一次";
        resetTimer = window.setTimeout(setIdle, 1600);
      }
    };

    button.addEventListener("click", activate);
    button.addEventListener("pointerdown", () => pauseRoam(2200), { passive: true });
    button.addEventListener("pointerenter", () => pauseRoam(1800), { passive: true });
    audio.addEventListener("ended", setIdle);
    audio.addEventListener("pause", () => {
      if (audio.currentTime === 0 || audio.ended) setIdle();
    });
    image.addEventListener("error", () => shell.remove(), { once: true });

    const settleAfterResize = () => {
      clearMoveTimer();
      placeAtRest();
      scheduleRoam(2200);
    };
    window.addEventListener("resize", settleAfterResize, { passive: true });
    window.visualViewport?.addEventListener("resize", settleAfterResize, { passive: true });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        clearMoveTimer();
        return;
      }
      placeAtRest();
      scheduleRoam(1800);
    });
    window.addEventListener(
      "pagehide",
      () => {
        destroyed = true;
        clearMoveTimer();
        window.clearTimeout(resetTimer);
        audio.pause();
        audio.currentTime = 0;
      },
      { once: true }
    );

    window.requestAnimationFrame(() => {
      placeAtRest();
      shell.classList.add("is-ready");
      scheduleRoam();
    });
  };

  decorate(document);
  body.classList.add("motion-ready");
  initScrollProgress();
  initPointerLight();
  initClickSparks();
  initPageTransitions();
  initOrbitCompanion();

  if ("MutationObserver" in window) {
    const mutationObserver = new MutationObserver((records) => {
      records.forEach((record) => {
        record.addedNodes.forEach((node) => {
          if (node instanceof Element) decorate(node);
        });
      });
    });
    mutationObserver.observe(body, { childList: true, subtree: true });
  }
})();
