(() => {
  const $ = (selector, root = document) => root.querySelector(selector);

  const fmt = (timeZone, options) =>
    new Intl.DateTimeFormat("zh-CN", { timeZone, ...options }).format(new Date());

  const hourIn = (timeZone) =>
    Number(new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", hourCycle: "h23" }).format(new Date()));

  const dayPart = (hour) => {
    if (hour < 5) return "深夜";
    if (hour < 9) return "清晨";
    if (hour < 11) return "上午";
    if (hour < 14) return "正午";
    if (hour < 18) return "下午";
    if (hour < 22) return "夜晚";
    return "深夜";
  };

  const setText = (selector, value) => {
    document.querySelectorAll(selector).forEach((node) => {
      node.textContent = value;
    });
  };

  const tickClocks = () => {
    const hz = "Asia/Shanghai";
    const ny = "America/New_York";
    const time = { hour: "2-digit", minute: "2-digit", hourCycle: "h23" };
    setText("[data-clock='hz']", fmt(hz, time));
    setText("[data-clock='ny']", fmt(ny, time));
    setText("[data-daypart='hz']", dayPart(hourIn(hz)));
    setText("[data-daypart='ny']", dayPart(hourIn(ny)));
    setText("[data-date='year']", fmt(hz, { year: "numeric" }).replace(/\D/g, ""));
    setText(
      "[data-date='md']",
      `${fmt(hz, { month: "2-digit" }).replace(/\D/g, "")}.${fmt(hz, { day: "2-digit" }).replace(/\D/g, "")}`
    );
    setText("[data-date='weekday']", fmt(hz, { weekday: "short" }));
  };

  const initClocks = () => {
    if (!document.querySelector("[data-clock], [data-date]")) return;
    tickClocks();
    window.setInterval(tickClocks, 20000);
  };

  const initMenus = () => {
    document.querySelectorAll(".j-menu").forEach((menu) => {
      menu.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => menu.removeAttribute("open")));
      document.addEventListener("click", (event) => {
        if (!menu.contains(event.target)) menu.removeAttribute("open");
      });
    });
  };

  // Home card: the last cup Xue confirmed in the milk tea machine (stored by milk-tea.js).
  const initTeaCard = () => {
    const card = $("[data-tea-card]");
    if (!card) return;
    let history = [];
    try {
      history = JSON.parse(localStorage.getItem("xue_milk_tea_history") || "[]");
    } catch {}
    const last = [...history].reverse().find((item) => item && item.action === "love") || history[history.length - 1];
    if (!last) return;
    document.querySelectorAll("[data-tea-row]").forEach((row) => { row.hidden = false; });
    setText("[data-tea='name']", last.name || "—");
    setText("[data-tea='brand']", last.brand || "—");
    setText("[data-tea='date']", String(last.date || "").slice(5).replace("-", ".") || "—");
  };

  // Home card: newest uploaded comic chapter, falling back to the static cover in markup.
  const initComicCard = async () => {
    const card = $("[data-comic-card]");
    if (!card || !/^https?:/.test(location.protocol)) return;
    try {
      const response = await fetch("/api/comic-chapters", { cache: "no-store" });
      if (!response.ok) return;
      const { chapters = [] } = await response.json();
      const latest = chapters[chapters.length - 1];
      if (!latest) return;
      const no = String(latest.chapterNumber || "").padStart(2, "0");
      setText("[data-comic='no']", `TICKET · NO. ${no}`);
      setText("[data-comic='title']", latest.title || "");
      setText("[data-comic='summary']", latest.summary || "");
      const img = $("[data-comic='cover']", card);
      if (img && latest.cover) img.src = latest.cover;
    } catch {}
  };

  // 弗洛洛: a sticker that says hello and plays her voice line when tapped.
  const initCompanion = () => {
    if (document.body.dataset.noCompanion !== undefined) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "j-companion";
    button.setAttribute("aria-label", "点我一下，弗洛洛会说话");
    button.innerHTML = `
      <span class="j-companion-tip"></span>
      <img src="assets/journal/fluoluo.webp" alt="" width="96" height="96" decoding="async">
      <audio preload="none"><source src="videos/woele.mp3?v=20260726" type="audio/mpeg"></audio>
    `;
    document.body.append(button);
    const tip = $(".j-companion-tip", button);
    const audio = $("audio", button);
    const idle = () => {
      button.classList.remove("is-speaking");
      tip.textContent = "";
    };
    idle();
    button.addEventListener("click", async () => {
      try {
        void fetch("/api/figure-click", { method: "POST", keepalive: true }).catch(() => {});
      } catch {}
      if (!audio.paused) {
        audio.pause();
        audio.currentTime = 0;
        idle();
        return;
      }
      audio.currentTime = 0;
      try {
        await audio.play();
        button.classList.add("is-speaking");
        tip.textContent = "我饿了…";
      } catch {
        tip.textContent = "";
      }
    });
    audio.addEventListener("ended", idle);
  };


  // 小手办: tapping a stamp in the album brings that figure out to the feature card.
  const initFigurePicker = () => {
    const rail = $("#figureCharacterRail");
    const feature = $("#figureFeature");
    if (!rail || !feature) return;
    rail.addEventListener("click", (event) => {
      const card = event.target.closest(".figure-curation-card");
      if (!card) return;
      const img = $("img", card);
      const name = $("h3", card)?.textContent || "";
      const quote = $("p", card)?.textContent || "";
      feature.querySelectorAll("[data-fig='name']").forEach((node) => { node.textContent = name; });
      const fq = $("[data-fig='quote']", feature);
      if (fq) fq.textContent = quote;
      const fi = $("[data-fig='img']", feature);
      if (fi && img) { fi.src = img.src; fi.alt = img.alt; }
      rail.querySelectorAll(".is-picked").forEach((node) => node.classList.remove("is-picked"));
      card.classList.add("is-picked");
      feature.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  };

  initClocks();
  initFigurePicker();
  initMenus();
  initTeaCard();
  initComicCard();
  initCompanion();
})();
