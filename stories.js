/* The index is small enough for the shelf. Original prose is fetched one chapter at a time. */
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const DATA_BASE = new URL("story-data/", document.baseURI);
  const FIGURE_ASSET_BASE = new URL(window.FIGURE_ASSET_BASE || "figures-assets/", document.baseURI);
  const STORAGE_KEY = "tuanzi_story_bookmarks_v1";
  const PAGE_SIZE = 24;
  const CATEGORY_NAMES = { main: "主线故事", event: "活动故事", character: "人物小传", skin: "皮肤故事", other: "其他故事" };
  const CATEGORY_TABS = { main: "主线", event: "活动", character: "人物", skin: "皮肤", other: "其他" };
  const views = ["story-loading", "story-error", "story-library", "story-book", "story-reader"];
  const cache = new Map();
  let index, books = new Map(), heroes = new Map(), categories = [];
  let artwork = { books: {}, chapters: {} };
  let route = readRoute(), routeVersion = 0, controller, currentReading = null;
  let visibleCount = PAGE_SIZE, filterKey = "", saveTimer, searchTimer;
  let bookmarks = readBookmarks();

  function text(value) { return typeof value === "string" || typeof value === "number" ? String(value) : ""; }
  function element(tag, className, content) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (content !== undefined) node.textContent = text(content);
    return node;
  }
  function show(id) {
    views.forEach((view) => { $(view).hidden = view !== id; });
    document.body.classList.toggle("is-reading", id === "story-reader");
    $("story-main").setAttribute("aria-busy", id === "story-loading" ? "true" : "false");
  }
  function readRoute() {
    const url = new URL(location.href);
    return { book: url.searchParams.get("book") || "", chapter: url.searchParams.get("chapter") || "", hero: url.searchParams.get("hero") || "", category: url.searchParams.get("category") || "", q: url.searchParams.get("q") || "", resume: url.searchParams.get("resume") === "1", hash: url.hash };
  }
  function routeURL(patch = {}, base = route) {
    const values = { ...base, ...patch };
    const url = new URL("stories.html", document.baseURI);
    for (const key of ["hero", "category", "q", "book", "chapter"]) if (values[key]) url.searchParams.set(key, values[key]);
    if (values.resume) url.searchParams.set("resume", "1");
    if (values.hash) url.hash = values.hash;
    return `${url.pathname}${url.search}${url.hash}`;
  }
  function libraryURL(patch = {}) { return routeURL({ book: "", chapter: "", resume: false, hash: "", ...patch }); }
  function bookURL(book) { return routeURL({ book: book.id, chapter: "", resume: false, hash: "" }); }
  function chapterURL(book, chapter, resume = false) { return routeURL({ book: book.id, chapter: chapter.id, resume, hash: "" }); }
  function routeLink(label, href, className) {
    const link = element("a", className, label);
    link.href = href;
    link.dataset.route = "";
    return link;
  }
  function hasFigure(hero) { return hero && hero.hasFigure !== false; }
  function figureURL(id) { return `figures.html#figure-${encodeURIComponent(id)}`; }
  function categoryTitle(id) { return categories.find((category) => category.id === id)?.title || CATEGORY_NAMES[id] || "其他故事"; }
  function number(value) { return Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0; }
  function countLabel(value) { return number(value).toLocaleString("zh-CN"); }
  function normalized(value) { return text(value).replace(/\s/g, "").toLocaleLowerCase("zh-CN"); }
  function heroNames(book) { return book.heroIds.map((id) => heroes.get(id)?.name).filter(Boolean); }
  function artFor(book, chapter, detail = false) {
    const entry = (chapter && artwork.chapters[`${book.id}/${chapter.id}`]) || artwork.books[book.id];
    if (!entry) return null;
    return detail && entry.detailSrc ? { ...entry, src: entry.detailSrc, alt: entry.detailAlt || entry.alt } : entry;
  }
  function artworkFrame(book, chapter, className = "", detail = false) {
    const frame = element("span", `story-artwork ${className}`);
    const art = artFor(book, chapter, detail);
    frame.dataset.category = book.category;
    const fallback = element("span", "story-artwork-fallback");
    fallback.append(element("span", "story-artwork-imprint", "团子故事书"), element("span", "story-artwork-title", chapter ? chapter.title : book.title));
    frame.append(fallback);
    if (art?.src) {
      frame.classList.add("has-artwork");
      if (art.kind === "portrait") frame.classList.add("is-portrait");
      const image = element("img");
      image.alt = ""; // The adjacent book/chapter title names each decorative image.
      image.loading = "lazy";
      image.decoding = "async";
      image.addEventListener("error", () => { image.remove(); frame.classList.remove("has-artwork", "is-portrait"); }, { once: true });
      image.src = art.src.startsWith("figures-assets/") ? new URL(art.src.slice("figures-assets/".length), FIGURE_ASSET_BASE).href : art.src;
      frame.append(image);
    }
    return frame;
  }
  function renderFeature(matches) {
    const preferred = ["rewind-4", "rewind-29"].map((id) => matches.find((book) => book.id === id)).filter(Boolean);
    const featured = [...preferred, ...matches.filter((book) => artFor(book) && !preferred.includes(book))].slice(0, 2);
    const fragment = document.createDocumentFragment();
    featured.forEach((book) => {
      const link = routeLink("", bookURL(book), "story-feature-photo");
      link.append(artworkFrame(book), element("span", "story-feature-caption", book.title));
      fragment.append(link);
    });
    $("story-feature").replaceChildren(fragment);
    $("story-feature").hidden = !featured.length;
  }

  function readBookmarks() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (saved && typeof saved === "object" && !Array.isArray(saved) && saved.positions && typeof saved.positions === "object" && !Array.isArray(saved.positions)) return saved;
    } catch { /* Private browsing and a full local store must not prevent reading. */ }
    return { last: null, positions: {} };
  }
  function positionKey(book, chapter) { return `${book}/${chapter}`; }
  function validPosition(value) {
    return value && typeof value === "object" && typeof value.book === "string" && typeof value.chapter === "string" && books.get(value.book)?.chapters.some((chapter) => chapter.id === value.chapter);
  }
  function savePosition() {
    clearTimeout(saveTimer);
    if (!currentReading || $("story-reader").hidden) return;
    const { book, chapter } = currentReading;
    const lines = Array.from($("story-prose").querySelectorAll(".story-block"));
    const line = lines.find((node) => node.getBoundingClientRect().bottom > 28) || lines[lines.length - 1];
    const paper = $("story-paper");
    const start = window.scrollY + paper.getBoundingClientRect().top;
    const range = Math.max(1, paper.offsetHeight - window.innerHeight);
    const saved = { book: book.id, chapter: chapter.id, anchor: line?.id || "story-chapter-title", offset: line ? Math.round(line.getBoundingClientRect().top) : 0, progress: Math.min(1, Math.max(0, (window.scrollY - start) / range)), updatedAt: Date.now() };
    bookmarks.last = saved;
    bookmarks.positions[positionKey(book.id, chapter.id)] = saved;
    // Keep this local convenience bounded, even when the entire library is read.
    const entries = Object.entries(bookmarks.positions).sort((a, b) => number(b[1]?.updatedAt) - number(a[1]?.updatedAt)).slice(0, 80);
    bookmarks.positions = Object.fromEntries(entries);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks)); }
    catch { $("story-reading-saved").textContent = "这台设备暂时无法保存阅读位置"; }
  }
  function resumeLink() {
    const saved = bookmarks.last;
    const link = $("story-resume");
    link.hidden = !validPosition(saved);
    if (link.hidden) return;
    const book = books.get(saved.book);
    const chapter = book.chapters.find((item) => item.id === saved.chapter);
    $("story-resume-title").textContent = `${book.title} · ${chapter.title}`;
    link.href = chapterURL(book, chapter, true);
  }
  function focusHeading(id, scroll = true) {
    const heading = $(id);
    if (!heading) return;
    heading.focus({ preventScroll: true });
    if (scroll) window.scrollTo({ top: 0, behavior: "instant" });
  }
  function restorePosition(book, chapter, version) {
    const saved = bookmarks.positions[positionKey(book.id, chapter.id)];
    let anchor;
    try { anchor = route.hash ? $(decodeURIComponent(route.hash.slice(1))) : null; } catch { anchor = null; }
    if (anchor && $("story-paper").contains(anchor)) {
      anchor.scrollIntoView({ block: "start", behavior: "instant" });
      savePosition();
      return;
    }
    if (!validPosition(saved)) { savePosition(); return; }
    const apply = () => {
      if (version !== routeVersion || currentReading?.chapter.id !== chapter.id || currentReading?.book.id !== book.id) return;
      const target = typeof saved.anchor === "string" ? $(saved.anchor) : null;
      if (target && $("story-prose").contains(target)) {
        const offset = Number.isFinite(saved.offset) ? Math.min(window.innerHeight - 40, Math.max(-window.innerHeight, saved.offset)) : 24;
        window.scrollTo({ top: window.scrollY + target.getBoundingClientRect().top - offset, behavior: "instant" });
      } else {
        const paper = $("story-paper");
        const start = window.scrollY + paper.getBoundingClientRect().top;
        window.scrollTo({ top: start + Math.max(0, paper.offsetHeight - window.innerHeight) * Math.min(1, Math.max(0, number(saved.progress))), behavior: "instant" });
      }
      $("story-reading-saved").textContent = "已回到上次读到的地方";
    };
    requestAnimationFrame(() => {
      apply();
      // Fonts may finish after the chapter. Reapply only before the reader starts moving.
      const y = window.scrollY;
      document.fonts?.ready.then(() => { if (Math.abs(window.scrollY - y) < 3) apply(); });
    });
  }

  function renderCategories() {
    const nav = $("story-categories");
    nav.replaceChildren();
    [{ id: "", title: "全部", bookCount: books.size }, ...categories].forEach((category) => {
      const button = element("button", "", CATEGORY_TABS[category.id] || category.title);
      button.type = "button";
      button.dataset.category = category.id;
      button.setAttribute("aria-pressed", "false");
      button.setAttribute("aria-label", `${category.title}，${countLabel(category.bookCount)} 本`);
      button.append(element("span", "", countLabel(category.bookCount)));
      nav.append(button);
    });
    const select = $("story-hero-filter");
    select.replaceChildren(new Option("所有人物", ""));
    [...heroes.values()].sort((a, b) => a.name.localeCompare(b.name, "zh-CN")).forEach((hero) => select.append(new Option(hero.name, hero.id)));
    const chapterCount = [...books.values()].reduce((sum, book) => sum + book.chapters.length, 0);
    $("story-library-tally").replaceChildren(element("strong", "", countLabel(books.size)), document.createTextNode(" 本故事 · "), element("strong", "", countLabel(chapterCount)), document.createTextNode(" 篇章节"));
  }
  function renderLibrary() {
    const key = `${route.category}|${route.hero}|${route.q}`;
    if (filterKey !== key) { visibleCount = PAGE_SIZE; filterKey = key; }
    document.title = "团子的故事书｜团子之家";
    $("story-search").value = route.q;
    $("story-hero-filter").value = route.hero;
    $("story-categories").querySelectorAll("button").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.category === route.category)));
    const hero = heroes.get(route.hero);
    $("story-hero-context").hidden = !route.hero;
    $("story-hero-context-text").textContent = hero ? `和${hero.name}有关的故事，都收在这里。` : "故事书里暂时没有找到这位人物。";
    $("story-hero-return").hidden = !hasFigure(hero);
    if (hasFigure(hero)) { $("story-hero-return").href = figureURL(hero.id); $("story-hero-return").textContent = `回到${hero.name}`; }
    const query = normalized(route.q);
    const matches = [...books.values()].filter((book) => (!route.category || book.category === route.category) && (!route.hero || book.heroIds.includes(route.hero)) && (!query || book.searchText.includes(query)));
    renderFeature(matches);
    $("story-results-title").textContent = route.category ? categoryTitle(route.category) : "全部故事";
    $("story-result-count").textContent = `${countLabel(matches.length)} 本${matches.length > visibleCount ? ` · 已展开 ${visibleCount} 本` : ""}`;
    const fragment = document.createDocumentFragment();
    matches.slice(0, visibleCount).forEach((book, order) => {
      const link = routeLink("", bookURL(book), "story-book-entry");
      const frame = artworkFrame(book, null, "story-card-artwork");
      frame.append(element("span", "story-book-no", String(order + 1).padStart(2, "0")));
      link.append(frame);
      const copy = element("div", "story-book-copy");
      copy.append(element("h3", "", book.title));
      const excerpt = book.summary || (book.subtitle !== book.title ? book.subtitle : "");
      if (excerpt) copy.append(element("p", "story-book-excerpt", excerpt));
      const meta = element("p", "story-book-meta");
      meta.append(element("span", "story-book-category-mark", categoryTitle(book.category)), element("span", "", `${book.chapters.length} 篇章节`));
      const arrow = element("span", "story-book-arrow", "→"); arrow.setAttribute("aria-hidden", "true");
      meta.append(arrow); copy.append(meta);
      link.append(copy); fragment.append(link);
    });
    $("story-books").replaceChildren(fragment);
    $("story-empty").hidden = matches.length > 0;
    $("story-more").hidden = matches.length <= visibleCount;
    resumeLink();
    show("story-library");
  }
  function relatedHeroes(container, book) {
    container.replaceChildren();
    book.heroIds.forEach((id) => {
      const hero = heroes.get(id);
      if (!hasFigure(hero)) return;
      const link = element("a", "", hero.name); link.href = figureURL(id);
      link.setAttribute("aria-label", `回到团子之家，查看${hero.name}`); container.append(link);
    });
  }
  function chapterStatus(chapter) {
    if (["video", "video_only", "video-only"].includes(chapter.status)) return "影像章节";
    if (["missing", "unresolved", "missing_text", "pending", "unavailable"].includes(chapter.status)) return "正文待补";
    if (chapter.status === "partial") return "含待补内容";
    return number(chapter.wordCount) ? `${countLabel(chapter.wordCount)} 字` : "查看章节";
  }
  function renderBook(book) {
    document.title = `${book.title}｜团子的故事书`;
    $("story-back-library").href = libraryURL();
    $("story-book-artwork").replaceChildren(artworkFrame(book, null, "story-header-artwork", true));
    $("story-book-category").textContent = categoryTitle(book.category);
    $("story-book-title").textContent = book.title;
    $("story-book-subtitle").textContent = book.subtitle !== book.title ? book.subtitle : "";
    $("story-book-subtitle").hidden = !$("story-book-subtitle").textContent;
    $("story-book-description").textContent = book.summary;
    $("story-book-description").hidden = !book.summary;
    relatedHeroes($("story-book-heroes"), book);
    const wordCount = book.chapters.reduce((sum, chapter) => sum + number(chapter.wordCount), 0);
    $("story-book-total").textContent = `${book.chapters.length} 篇章节${wordCount ? ` · 共 ${countLabel(wordCount)} 字` : ""}`;
    const fragment = document.createDocumentFragment();
    book.chapters.forEach((chapter, i) => {
      const item = element("li");
      const link = routeLink("", chapterURL(book, chapter));
      const label = element("span", "story-chapter-label", chapter.title);
      if (chapter.subtitle && chapter.subtitle !== chapter.title) label.append(element("small", "", chapter.subtitle));
      const frame = artworkFrame(book, chapter, "story-chapter-artwork", true);
      frame.append(element("span", "story-chapter-number", String(i + 1).padStart(2, "0")));
      link.append(frame, label, element("span", "story-chapter-state", chapterStatus(chapter)));
      item.append(link); fragment.append(item);
    });
    $("story-chapters").replaceChildren(fragment);
    show("story-book");
  }
  function choiceTarget(option, targets) {
    if (!option || typeof option !== "object" || !targets) return "";
    // AVG rows and chat-text branches both name a full sourceId; chat-node names a plot section.
    return targets.get(`${option.targetKind === "chat-node" ? "chat-node" : "source"}:${text(option.targetId)}`) || "";
  }
  function renderBlock(block, id, targets) {
    const type = text(block.type);
    const node = element(type === "heading" ? "h3" : "div", `story-block story-${["dialogue", "narration", "heading", "profile", "choice", "notice"].includes(type) ? type : "narration"}`);
    node.id = id;
    if (type === "heading") { node.textContent = text(block.text) || text(block.title); return node; }
    if (type === "dialogue" && block.speaker) node.append(element("strong", "story-speaker", typeof block.speaker === "object" ? block.speaker.name : block.speaker));
    if (type === "profile" && block.title) node.append(element("strong", "", block.title));
    if (type === "choice") node.append(element("span", "story-choice-label", "原文选项"));
    if (text(block.text)) node.append(element("p", "", block.text));
    if (type === "choice" && Array.isArray(block.options)) {
      const list = element("ol");
      block.options.forEach((option) => {
        const item = element("li");
        const label = typeof option === "object" ? option.text : option;
        const target = choiceTarget(option, targets);
        if (target) {
          const link = element("a", "story-choice-link", label);
          link.href = `#${target}`;
          link.dataset.storyTarget = target;
          link.append(element("small", "story-choice-hint", "阅读这段"));
          item.append(link);
        } else { item.textContent = text(label); }
        list.append(item);
      });
      node.append(list);
    }
    return node;
  }
  function renderReader(book, chapter, data) {
    document.title = `${chapter.title}｜${book.title}｜团子的故事书`;
    $("story-reader-back").href = bookURL(book);
    $("story-reading-book").textContent = book.title;
    $("story-reading-book").href = bookURL(book);
    $("story-end-directory").href = bookURL(book);
    $("story-chapter-title").textContent = data.title || chapter.title;
    const subtitle = data.subtitle || chapter.subtitle;
    $("story-chapter-subtitle").textContent = subtitle !== (data.title || chapter.title) ? subtitle : "";
    $("story-chapter-subtitle").hidden = !$("story-chapter-subtitle").textContent;
    const position = book.chapters.findIndex((item) => item.id === chapter.id);
    $("story-chapter-meta").textContent = `${categoryTitle(book.category)} · 第 ${position + 1} / ${book.chapters.length} 篇 · ${chapterStatus(chapter)}`;
    $("story-reading-saved").textContent = "阅读位置会留在这台设备上";
    $("story-toc-count").textContent = `${book.chapters.length} 篇`;
    const toc = document.createDocumentFragment();
    book.chapters.forEach((item) => {
      const link = routeLink(item.title, chapterURL(book, item));
      if (item.subtitle && item.subtitle !== item.title) link.append(element("small", "story-toc-subtitle", item.subtitle));
      if (item.id === chapter.id) link.setAttribute("aria-current", "page");
      toc.append(link);
    });
    $("story-toc-links").replaceChildren(toc);
    $("story-toc-details").open = window.matchMedia("(min-width: 761px)").matches;
    const fragment = document.createDocumentFragment();
    const sections = Array.isArray(data.sections) ? data.sections : [];
    const targets = new Map();
    const choices = [];
    sections.forEach((section, sectionIndex) => {
      if (/^node-/.test(text(section.id))) targets.set(`chat-node:${text(section.id).slice(5)}`, `story-section-${sectionIndex + 1}`);
      (Array.isArray(section.blocks) ? section.blocks : []).forEach((block, blockIndex) => {
        const key = `source:${text(block.sourceId)}`;
        if (text(block.sourceId) && !targets.has(key)) targets.set(key, `story-line-${sectionIndex + 1}-${blockIndex + 1}`);
        if (block.type === "choice") choices.push(block);
      });
    });
    if (choices.length) {
      const hasLinkedChoice = choices.some((block) => (block.options || []).some((option) => choiceTarget(option, targets)));
      fragment.append(renderBlock({ type: "notice", text: `本章包含分支，保留了全部选项与对应片段${hasLinkedChoice ? "；可点击带有“阅读这段”的选项跳到相应内容。" : "，可按原文顺序翻阅。"}` }, "story-branches-note"));
    }
    sections.forEach((section, sectionIndex) => {
      const node = element("section"); node.id = `story-section-${sectionIndex + 1}`;
      // A chat script may appear in several plot nodes. Keep its inline choices in this occurrence.
      const sectionTargets = new Map(targets);
      const sectionBlocks = Array.isArray(section.blocks) ? section.blocks : [];
      sectionBlocks.forEach((block, blockIndex) => {
        if (text(block.sourceId)) sectionTargets.set(`source:${text(block.sourceId)}`, `story-line-${sectionIndex + 1}-${blockIndex + 1}`);
      });
      if (section.title && section.title !== data.title && section.title !== chapter.title) node.append(element("h2", "", section.title));
      sectionBlocks.forEach((block, blockIndex) => node.append(renderBlock(block, `story-line-${sectionIndex + 1}-${blockIndex + 1}`, sectionTargets)));
      fragment.append(node);
    });
    if (!fragment.childNodes.length) fragment.append(renderBlock({ type: "notice", text: "这一章暂时没有可阅读的文字，先为它留好位置。" }, "story-line-1-1"));
    $("story-prose").replaceChildren(fragment);
    relatedHeroes($("story-reading-heroes"), { heroIds: Array.isArray(chapter.heroIds) ? chapter.heroIds.map(String) : book.heroIds });
    [["story-previous", book.chapters[position - 1]], ["story-next", book.chapters[position + 1]]].forEach(([id, item]) => {
      $(id).hidden = !item;
      if (item) { $(id).href = chapterURL(book, item); $(id).querySelector("strong").textContent = item.title; }
    });
    show("story-reader");
    currentReading = { book, chapter };
  }
  function errorView(message, retry = true) {
    $("story-error-message").textContent = message;
    $("story-retry").hidden = !retry;
    show("story-error");
  }
  async function fetchJSON(path, signal) {
    const url = new URL(path, DATA_BASE);
    if (!url.href.startsWith(DATA_BASE.href) || !url.pathname.endsWith(".json")) throw new Error("故事文件地址无效");
    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error(`故事暂未载入（${response.status}）`);
    return response.json();
  }
  async function loadIndex() {
    const request = new AbortController();
    const timeout = setTimeout(() => request.abort(), 20000);
    try {
      const [data, nativeArt, portraitArt] = await Promise.all([
        fetchJSON("index.json", request.signal),
        fetchJSON("artwork.json", request.signal).catch(() => null),
        fetchJSON("portrait-artwork.json", request.signal).catch(() => null)
      ]);
      // Missing optional artwork still leaves a fully usable text library.
      artwork = { books: { ...portraitArt?.books, ...nativeArt?.books }, chapters: { ...portraitArt?.chapters, ...nativeArt?.chapters } };
      if (!Array.isArray(data.books) || !Array.isArray(data.heroes)) throw new Error("故事目录格式暂时无法读取");
      index = data;
      heroes = new Map(data.heroes.filter((hero) => hero && hero.id != null && hero.name).map((hero) => [String(hero.id), { ...hero, id: String(hero.id) }]));
      books = new Map(data.books.filter((book) => book && book.id != null && book.title && Array.isArray(book.chapters)).map((book) => {
        const normalizedBook = { ...book, id: String(book.id), title: text(book.title), subtitle: text(book.subtitle), summary: text(book.summary), heroIds: (book.heroIds || []).map(String), chapters: book.chapters.map((chapter) => ({ ...chapter, id: String(chapter.id), title: text(chapter.title) || "未命名章节" })) };
        normalizedBook.searchText = normalized([normalizedBook.title, normalizedBook.subtitle, normalizedBook.summary, ...heroNames(normalizedBook), ...normalizedBook.chapters.map((chapter) => `${chapter.title} ${chapter.subtitle || ""}`)].join(" "));
        return [normalizedBook.id, normalizedBook];
      }));
      categories = (Array.isArray(data.categories) && data.categories.length ? data.categories : Object.entries(CATEGORY_NAMES).map(([id, title]) => ({ id, title }))).map((category) => ({ ...category, id: String(category.id), bookCount: [...books.values()].filter((book) => book.category === category.id).length }));
      renderCategories();
    } finally { clearTimeout(timeout); }
  }
  async function renderRoute({ focus = false } = {}) {
    const version = ++routeVersion;
    controller?.abort(); currentReading = null;
    route = readRoute();
    $("story-home-link").href = hasFigure(heroes.get(route.hero)) ? figureURL(route.hero) : "figures.html";
    if (!index) {
      show("story-loading");
      try { await loadIndex(); } catch { if (version === routeVersion) errorView("故事目录还没能载入。请检查网络，然后再试一次。"); return; }
      if (version !== routeVersion) return;
      $("story-home-link").href = hasFigure(heroes.get(route.hero)) ? figureURL(route.hero) : "figures.html";
    }
    if (route.category && !categories.some((category) => category.id === route.category)) route.category = "";
    if (!route.book) {
      if (route.chapter) { errorView("这条阅读链接缺少书名信息。你可以回到书目重新选择。", false); return; }
      renderLibrary(); if (focus) focusHeading("story-title"); return;
    }
    const book = books.get(route.book);
    if (!book) { errorView("没有找到这本故事。你可以回到书目，按标题或人物重新找找。", false); return; }
    if (!route.chapter) { renderBook(book); if (focus) focusHeading("story-book-title"); return; }
    const chapter = book.chapters.find((item) => item.id === route.chapter);
    if (!chapter) { errorView("这本故事里没有找到这一章。请回到书目重新选择。", false); return; }
    show("story-loading");
    controller = new AbortController();
    const activeController = controller;
    const timeout = setTimeout(() => activeController.abort(), 20000);
    const key = positionKey(book.id, chapter.id);
    try {
      let data = cache.get(key);
      if (!data) {
        data = await fetchJSON(chapter.path, activeController.signal);
        if (version !== routeVersion) return;
        cache.set(key, data);
        if (cache.size > 8) cache.delete(cache.keys().next().value);
      }
      if (version !== routeVersion) return;
      renderReader(book, chapter, data);
      focusHeading("story-chapter-title");
      restorePosition(book, chapter, version);
    } catch {
      if (version === routeVersion) errorView("这一章暂时没有载入成功。已为你保留目录，可以重新载入。你的阅读书签仍在这台设备上。");
    } finally { clearTimeout(timeout); }
  }
  function navigate(href, { replace = false, focus = true } = {}) {
    savePosition();
    clearTimeout(searchTimer);
    history[replace ? "replaceState" : "pushState"]({}, "", href);
    void renderRoute({ focus });
  }
  document.addEventListener("click", (event) => {
    const branchLink = event.target.closest("a[data-story-target]");
    if (branchLink && !event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
      const target = $(branchLink.dataset.storyTarget);
      if (target && $("story-prose").contains(target)) { target.tabIndex = -1; target.focus({ preventScroll: true }); }
    }
    const link = event.target.closest("a[data-route]");
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); navigate(link.href);
  });
  $("story-categories").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-category]");
    if (button) navigate(libraryURL({ category: button.dataset.category }), { focus: false });
  });
  $("story-search").addEventListener("input", () => {
    clearTimeout(searchTimer);
    const query = $("story-search").value;
    searchTimer = setTimeout(() => navigate(libraryURL({ q: query }), { replace: true, focus: false }), 180);
  });
  $("story-hero-filter").addEventListener("change", () => navigate(libraryURL({ hero: $("story-hero-filter").value }), { focus: false }));
  $("story-reset").addEventListener("click", () => navigate(libraryURL({ hero: "", category: "", q: "" })));
  $("story-more").addEventListener("click", () => {
    const oldCount = visibleCount;
    visibleCount += PAGE_SIZE; renderLibrary();
    $("story-books").children[oldCount]?.focus({ preventScroll: true });
  });
  $("story-retry").addEventListener("click", () => void renderRoute({ focus: true }));
  window.addEventListener("popstate", () => { savePosition(); void renderRoute({ focus: true }); });
  window.addEventListener("hashchange", () => {
    if (!currentReading) return;
    route = readRoute(); restorePosition(currentReading.book, currentReading.chapter, routeVersion);
  });
  window.addEventListener("scroll", () => { if (currentReading) { clearTimeout(saveTimer); saveTimer = setTimeout(savePosition, 260); } }, { passive: true });
  window.addEventListener("pagehide", savePosition);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") savePosition(); });
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  void renderRoute();
})();
