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

  decorate(document);
  body.classList.add("motion-ready");
  initScrollProgress();
  initPointerLight();
  initClickSparks();
  initPageTransitions();

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
