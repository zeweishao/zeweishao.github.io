(() => {
  const STORAGE = {
    profile: "xue_milk_tea_profile",
    history: "xue_milk_tea_history",
    todaySkips: "xue_milk_tea_today_skips",
    letterSkipDate: "xue_milk_tea_520_skip_date"
  };

  const FEEDBACK_RULES = {
    love: { label: "超喜欢", product: 3, brand: 2, tag: 2, taste: 1, action: "love" },
    like: { label: "还不错", product: 1, brand: 1, tag: 1, taste: 0.45, action: "like" },
    meh: { label: "一般", product: -1, brand: 0, tag: -0.25, taste: -0.15, action: "meh" },
    nope: { label: "不想再喝", product: -4, brand: -1, tag: -2, taste: -0.8, action: "nope" }
  };

  const MODE_DEFS = {
    any: { label: "随便抽", tags: [], taste: {}, weight: 0 },
    fresh: { label: "清爽", tags: ["清爽", "轻盈", "轻负担", "低腻"], taste: { fresh: 1 }, weight: 9 },
    fruit: { label: "水果", tags: ["水果", "真果茶", "桃子", "草莓", "葡萄", "青提", "芒果", "椰子", "李子", "柚子", "红柚"], taste: { fruit: 1 }, weight: 9 },
    milk: { label: "奶香", tags: ["奶香", "鲜奶", "轻乳茶"], taste: { milk: 1 }, weight: 8 },
    tea: { label: "茶感", tags: ["茶感", "茉莉", "乌龙", "红茶", "焙茶", "东方茶"], taste: { tea: 1 }, weight: 8 },
    new: { label: "尝鲜", tags: ["春茶", "山茶花", "青提", "桃子", "李子"], taste: {}, weight: 8, seasonal: true },
    classic: { label: "经典稳妥", tags: ["经典", "稳妥"], taste: {}, weight: 7, classic: true },
    light: { label: "低负担", tags: ["轻负担", "轻盈", "低腻", "清爽"], taste: { fresh: 0.8, sweet: -0.4 }, weight: 8 },
    flower: { label: "花香", tags: ["花香", "茉莉", "桂花", "兰香", "山茶花", "栀子"], taste: { tea: 0.4, fresh: 0.4 }, weight: 7 },
    cheese: { label: "芝士", tags: ["芝士"], taste: { milk: 0.65 }, weight: 7 },
    peach: { label: "桃子", tags: ["桃子", "李子"], taste: { fruit: 0.8, fresh: 0.4 }, weight: 7 },
    citrus: { label: "柚子", tags: ["柚子", "红柚", "微苦"], taste: { fruit: 0.65, fresh: 0.75 }, weight: 7 },
    bold: { label: "浓一点", tags: ["醇厚", "浓郁", "波波", "红茶", "焙茶"], taste: { milk: 0.7, tea: 0.45, sweet: 0.35 }, weight: 7 }
  };

  const state = {
    products: [],
    brands: [],
    current: null,
    drawing: false,
    infinite: false,
    modes: new Set(["any"])
  };

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));

  const nodes = {
    drawBtn: $("#drawBtn"),
    redrawBtn: $("#redrawBtn"),
    infiniteMode: $("#infiniteMode"),
    modeChips: $("#modeChips"),
    teaMachine: $("#teaMachine"),
    brewCaption: $("#brewCaption"),
    resultSection: $("#resultSection"),
    resultModal: $("#resultModal"),
    recommendCard: $("#recommendCard"),
    brandLogo: $("#brandLogo"),
    brandName: $("#brandName"),
    productName: $("#productName"),
    productCategory: $("#productCategory"),
    productVisual: $("#productVisual"),
    realProductImg: $("#realProductImg"),
    productToppings: $("#productToppings"),
    cupBrandLabel: $("#cupBrandLabel"),
    tagRow: $("#tagRow"),
    sugarText: $("#sugarText"),
    iceText: $("#iceText"),
    reasonText: $("#reasonText"),
    matchPill: $("#matchPill"),
    profileGrid: $("#profileGrid"),
    toast: $("#toast"),
    letterModal: $("#letterModal"),
    openLetterBtn: $("#openLetterBtn"),
    openLetterBtnDesktop: $("#openLetterBtnDesktop"),
    enterMachineBtn: $("#enterMachineBtn"),
    skipLetterToday: $("#skipLetterToday"),
    openHistoryBtn: $("#openHistoryBtn"),
    openHistoryBtnCard: $("#openHistoryBtnCard"),
    openHistoryBtnHero: $("#openHistoryBtnHero"),
    historyModal: $("#historyModal"),
    historyList: $("#historyList"),
    openTeaAtlasBtn: $("#openTeaAtlasBtn"),
    openPreferenceAtlasBtn: $("#openPreferenceAtlasBtn"),
    teaAtlasModal: $("#teaAtlasModal"),
    teaAtlasList: $("#teaAtlasList"),
    teaAtlasCount: $("#teaAtlasCount"),
    preferenceAtlasModal: $("#preferenceAtlasModal"),
    preferenceRadar: $("#preferenceRadar"),
    preferenceStats: $("#preferenceStats"),
    preferenceHighlights: $("#preferenceHighlights")
  };

  const today = () => {
    const override = new URLSearchParams(window.location.search).get("date");
    if (/^\d{4}-\d{2}-\d{2}$/.test(override || "")) return override;
    const date = new Date();
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const readJson = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed ?? fallback;
    } catch {
      return fallback;
    }
  };

  const writeJson = (key, value) => {
    localStorage.setItem(key, JSON.stringify(value));
  };

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const getProfile = () => {
    const profile = readJson(STORAGE.profile, null);
    if (profile && typeof profile === "object") return profile;
    return {
      brands: {},
      tags: {},
      products: {},
      taste: { tea: 0, milk: 0, fruit: 0, sweet: 0, fresh: 0 },
      updatedAt: new Date().toISOString()
    };
  };

  const getHistory = () => {
    const history = readJson(STORAGE.history, []);
    return Array.isArray(history) ? history : [];
  };

  const getTodaySkips = () => {
    const map = readJson(STORAGE.todaySkips, {});
    if (!map || typeof map !== "object") return { date: today(), products: {}, tags: {} };
    if (map.date !== today()) return { date: today(), products: {}, tags: {} };
    map.products ||= {};
    map.tags ||= {};
    return map;
  };

  const saveTodaySkips = (skips) => {
    writeJson(STORAGE.todaySkips, skips);
  };

  const brandById = (brandId) => state.brands.find((brand) => brand.id === brandId);
  const productById = (productId) => state.products.find((product) => product.id === productId);

  const weightedRandom = (items) => {
    const positive = items.map((item) => ({ ...item, score: Math.max(1, item.score) }));
    const total = positive.reduce((sum, item) => sum + item.score, 0);
    let cursor = Math.random() * total;
    for (const item of positive) {
      cursor -= item.score;
      if (cursor <= 0) return item.product;
    }
    return positive[positive.length - 1]?.product || state.products[0];
  };

  const recentIds = () => {
    return getHistory()
      .filter((item) => item && item.productId)
      .slice(-10)
      .map((item) => item.productId);
  };

  const scoreProduct = (product) => {
    const profile = getProfile();
    const skips = getTodaySkips();
    const recent = recentIds();
    const randomSurprise = Math.random() * 18;
    let score = 50 + randomSurprise;
    const review = product.reviewSummary || {};
    const reviewConfidence = clamp(Number(review.confidence) || 0, 0, 1);

    score += clamp(profile.brands?.[product.brand] || 0, -10, 10) * 2;
    score += clamp(profile.products?.[product.id] || 0, -12, 12) * 2.2;

    for (const tag of product.tags || []) {
      score += clamp(profile.tags?.[tag] || 0, -8, 8) * 1.7;
      score -= (skips.tags?.[tag] || 0) * 2.6;
    }

    const taste = product.tasteProfile || {};
    for (const key of Object.keys(profile.taste || {})) {
      score += clamp(profile.taste[key] || 0, -7, 7) * ((taste[key] || 0) / 5) * 1.25;
    }

    if (!recent.includes(product.id)) score += 9;
    if (recent[recent.length - 1] === product.id) score -= 32;
    if (recent.slice(-3).includes(product.id)) score -= 18;

    score -= (skips.products?.[product.id] || 0) * 18;

    const history = getHistory();
    const tried = history.some((item) => item.productId === product.id && ["chosen", "saved"].includes(item.action));
    if (!tried) score += 7;
    if (product.isClassic) score += 3;
    if (product.sourceStatus === "needs_review") score -= 3;
    if (Number.isFinite(Number(review.impressionScore))) {
      score += (Number(review.impressionScore) - 72) * reviewConfidence * 0.7;
    }
    if ((review.cautionTags || []).includes("晚间慎选") && new Date().getHours() >= 17) {
      score -= 10 * reviewConfidence;
    }
    if ((review.cautionTags || []).includes("甜感偏高") && (state.modes.has("light") || state.modes.has("fresh"))) {
      score -= 8 * reviewConfidence;
    }
    if ((review.cautionTags || []).some((tag) => tag.includes("门店状态"))) {
      score -= 6 * (1 - reviewConfidence);
    }
    score += modeBonus(product);

    return score;
  };

  const modeBonus = (product) => {
    const tags = product.tags || [];
    const taste = product.tasteProfile || {};
    const selected = activeModes();
    if (!selected.length) return 0;
    let score = 0;

    for (const mode of selected) {
      const def = MODE_DEFS[mode];
      if (!def || mode === "any") continue;
      const matchedTags = def.tags.filter((tag) => tags.includes(tag));
      score += matchedTags.length * def.weight;
      for (const [tasteKey, multiplier] of Object.entries(def.taste || {})) {
        score += (taste[tasteKey] || 0) * multiplier * 4.2;
      }
      if (def.seasonal) score += (product.isSeasonal ? 18 : product.isClassic ? -5 : 5);
      if (def.classic) score += product.isClassic ? 15 : -2;
    }

    if (selected.length > 1) {
      const missingCount = selected.filter((mode) => !matchesMode(product, mode)).length;
      score += missingCount === 0 ? 16 : -missingCount * 34;
    }

    return score;
  };

  const activeModes = () => [...state.modes].filter((mode) => mode !== "any");

  const modeLabel = () => {
    const selected = activeModes();
    if (!selected.length) return MODE_DEFS.any.label;
    return selected.map((mode) => MODE_DEFS[mode]?.label || mode).join(" + ");
  };

  const matchesMode = (product, mode) => {
    const def = MODE_DEFS[mode];
    if (!def || mode === "any") return true;
    const tags = product.tags || [];
    const taste = product.tasteProfile || {};
    if (def.tags.some((tag) => tags.includes(tag))) return true;
    if (def.seasonal && product.isSeasonal) return true;
    if (def.classic && product.isClassic) return true;
    return Object.entries(def.taste || {}).some(([key, multiplier]) => multiplier > 0 && (taste[key] || 0) >= 4);
  };

  const updateModeChips = () => {
    nodes.modeChips.querySelectorAll("button").forEach((button) => {
      const active = state.modes.has(button.dataset.mode || "any");
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  };

  const toggleMode = (mode) => {
    if (!mode || mode === "any") {
      state.modes = new Set(["any"]);
      updateModeChips();
      showToast("今天偏向：随便抽");
      return;
    }

    state.modes.delete("any");
    if (state.modes.has(mode)) {
      state.modes.delete(mode);
    } else {
      state.modes.add(mode);
    }
    if (!state.modes.size) state.modes.add("any");
    updateModeChips();
    showToast(`今天偏向：${modeLabel()}`);
  };

  const chooseProduct = () => {
    if (!state.products.length) return null;
    const previewId = new URLSearchParams(window.location.search).get("product");
    const previewProduct = state.products.find((product) => product.id === previewId);
    if (previewProduct) return previewProduct;
    const scored = state.products.map((product) => ({
      product,
      score: scoreProduct(product)
    }));
    return weightedRandom(scored);
  };

  const productReason = (product) => {
    const review = product.reviewSummary || {};
    const openings = [
      "这杯我会认真给雪放进候选里。",
      "今天这杯很适合被抽出来。",
      "如果现在让我替雪选，我会偏向它。"
    ];
    const endings = [
      "不算冒险，但会有一点刚刚好的惊喜。",
      "等你第一口喝到的时候，应该会觉得今天被照顾到了。",
      "它不是那种很吵的选择，是比较温柔、比较稳的一杯。"
    ];
    const seed = product.id.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const reviewLine = review.impression
      ? `\n评价库印象：${review.impression}`
      : "";
    const signalLine = review.positiveSignals?.length
      ? `\n评价关键词：${review.positiveSignals.slice(0, 4).join(" / ")}`
      : "";
    const commentLine = review.sampleComments?.length
      ? `\n典型反馈：${review.sampleComments.slice(0, 2).join("；")}`
      : "";
    return `${product.reasonBase}\n${openings[seed % openings.length]}${endings[seed % endings.length]}${reviewLine}${signalLine}${commentLine}`;
  };

  const buildToppings = (type, accent) => {
    const positions = [
      [24, 128, 11],
      [58, 150, 8],
      [94, 122, 10],
      [112, 168, 7],
      [38, 188, 9],
      [82, 198, 7]
    ];
    const shape = type === "leaf" || type === "tea" || type === "flower" ? "leaf" : "round";
    return positions
      .map(([left, top, size], idx) => {
        const rotate = idx % 2 ? "rotate(28deg)" : "rotate(-22deg)";
        const radius = shape === "leaf" ? "90% 10% 90% 10%" : "50%";
        return `<span style="left:${left}px;top:${top}px;width:${size}px;height:${shape === "leaf" ? Math.max(6, size - 4) : size}px;border-radius:${radius};background:${accent};transform:${rotate};"></span>`;
      })
      .join("");
  };

  const renderProduct = (product) => {
    if (!product) return;
    const brand = brandById(product.brandId);
    const visual = product.visual || {};

    nodes.resultSection.hidden = false;
    nodes.resultModal.hidden = false;
    document.body.style.overflow = "hidden";
    if (brand?.logo) {
      nodes.brandLogo.innerHTML = `<img src="${escapeHtml(brand.logo)}" alt="${escapeHtml(product.brand)} Logo">`;
    } else {
      nodes.brandLogo.textContent = brand?.logoText || product.brand;
    }
    nodes.brandName.textContent = product.brand;
    nodes.productName.textContent = product.name;
    nodes.productCategory.textContent = product.category;
    nodes.cupBrandLabel.textContent = brand?.logoText || product.brand;
    nodes.sugarText.textContent = product.recommendedSugar || "少糖";
    nodes.iceText.textContent = product.recommendedIce || "少冰";
    nodes.reasonText.textContent = productReason(product);
    nodes.matchPill.textContent = product.isClassic ? "稳稳喜欢" : product.isSeasonal ? "今日尝鲜" : "今日适合";

    nodes.productVisual.style.setProperty("--visual-base", visual.base || "#eef7f0");
    nodes.productVisual.style.setProperty("--visual-accent", visual.accent || "#8abcae");
    nodes.productVisual.style.setProperty("--visual-liquid", visual.liquid || "#d4b983");
    if (product.image) {
      nodes.realProductImg.src = product.image;
      nodes.realProductImg.alt = `${product.brand} ${product.name}`;
      nodes.productVisual.classList.add("has-real-image");
    } else {
      nodes.realProductImg.removeAttribute("src");
      nodes.realProductImg.alt = "";
      nodes.productVisual.classList.remove("has-real-image");
    }
    nodes.productToppings.innerHTML = buildToppings(visual.topping, visual.accent || "#8abcae");
    nodes.tagRow.innerHTML = (product.tags || [])
      .slice(0, 6)
      .map((tag) => `<span>${escapeHtml(tag)}</span>`)
      .join("");

    $$(".feedback-buttons button").forEach((button) => button.classList.remove("is-selected"));
    nodes.recommendCard.classList.remove("card-enter");
    window.requestAnimationFrame(() => nodes.recommendCard.classList.add("card-enter"));
  };

  const escapeHtml = (value) =>
    String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");

  const recordHistory = (product, action, mode, extra = {}) => {
    const history = getHistory();
    history.push({
      date: today(),
      productId: product.id,
      brand: product.brand,
      name: product.name,
      action,
      mode,
      rating: extra.rating || null,
      createdAt: new Date().toISOString()
    });
    writeJson(STORAGE.history, history.slice(-160));
  };

  const markSkipped = (product) => {
    if (!product) return;
    const skips = getTodaySkips();
    skips.products[product.id] = (skips.products[product.id] || 0) + 1;
    for (const tag of product.tags || []) {
      skips.tags[tag] = (skips.tags[tag] || 0) + 0.28;
    }
    saveTodaySkips(skips);
  };

  const drawProduct = async ({ skipCurrent = false } = {}) => {
    if (state.drawing) return;
    if (skipCurrent && state.current) {
      markSkipped(state.current);
    }

    state.drawing = true;
    nodes.teaMachine.classList.remove("is-brewing");
    nodes.teaMachine.classList.remove("is-revealing");
    void nodes.teaMachine.offsetWidth;
    nodes.teaMachine.classList.add("is-brewing");
    nodes.drawBtn.disabled = true;
    if (nodes.redrawBtn) nodes.redrawBtn.disabled = true;

    const product = chooseProduct();
    if (!product) {
      state.drawing = false;
      nodes.drawBtn.disabled = false;
      showToast("菜单还没准备好，稍等一下");
      return;
    }
    const selectedLabel = modeLabel();
    const duration = state.current ? (state.infinite ? 2300 : 2900) : 4300;
    const captions = state.current
      ? ["重新摇匀茶香。", `按「${selectedLabel}」再筛一遍。`, "准备揭晓新的灵感。"]
      : ["醒一醒茶香。", `把「${selectedLabel}」放进配方里。`, "让奶云慢慢落下。", "把今天的心情翻成一张卡。"];
    runBrewCaptions(captions, duration);
    await new Promise((resolve) => window.setTimeout(resolve, duration));

    state.current = product;
    nodes.teaMachine.classList.remove("is-brewing");
    nodes.teaMachine.classList.add("is-revealing");
    renderProduct(product);
    window.setTimeout(() => nodes.teaMachine.classList.remove("is-revealing"), 900);

    nodes.drawBtn.textContent = state.infinite ? "继续换一杯" : "再抽一杯";
    nodes.drawBtn.disabled = false;
    if (nodes.redrawBtn) nodes.redrawBtn.disabled = false;
    state.drawing = false;
  };

  const runBrewCaptions = (captions, duration) => {
    const step = Math.max(520, Math.floor(duration / captions.length));
    captions.forEach((caption, index) => {
      window.setTimeout(() => {
        if (state.drawing) nodes.brewCaption.textContent = caption;
      }, index * step);
    });
    window.setTimeout(() => {
      nodes.brewCaption.textContent = "轻轻按下，开始冲泡今天的灵感。";
    }, duration + 260);
  };

  const applyFeedback = (type, button) => {
    const rule = FEEDBACK_RULES[type];
    const product = state.current;
    if (!rule || !product) return;

    const profile = getProfile();
    applyRuleToProfile(profile, product, rule);

    if (type === "love" || type === "like") {
      const runMode = `${state.infinite ? "infinite" : "normal"} · ${modeLabel()}`;
      recordHistory(product, type === "love" ? "chosen" : "saved", runMode, {
        rating: type === "love" ? "like" : null
      });
      closeResult();
      showToast(type === "love" ? "记住啦：今天就喝这杯" : "先帮雪收藏这杯");
    } else {
      markSkipped(product);
      showToast(type === "meh" ? "这杯先放一边" : "今天避开它");
      if (type === "nope") {
        window.setTimeout(() => drawProduct({ skipCurrent: true }), 260);
      }
    }

    $$(".feedback-buttons button").forEach((item) => item.classList.remove("is-selected"));
    button?.classList.add("is-selected");
    renderProfile();
  };

  const applyRuleToProfile = (profile, product, rule) => {
    applyRuleDelta(profile, product, rule, 1);
  };

  const applyRuleDelta = (profile, product, rule, direction) => {
    profile.brands[product.brand] = clamp((profile.brands[product.brand] || 0) + rule.brand * direction, -20, 20);
    profile.products[product.id] = clamp((profile.products[product.id] || 0) + rule.product * direction, -30, 30);

    for (const tag of product.tags || []) {
      profile.tags[tag] = clamp((profile.tags[tag] || 0) + rule.tag * direction, -30, 30);
    }

    for (const [key, value] of Object.entries(product.tasteProfile || {})) {
      profile.taste[key] = clamp((profile.taste[key] || 0) + (value / 5) * rule.taste * direction, -20, 20);
    }

    profile.updatedAt = new Date().toISOString();
    writeJson(STORAGE.profile, profile);
  };

  const renderProfile = () => {
    const profile = getProfile();
    const tagEntries = Object.entries(profile.tags || {})
      .filter(([, value]) => value > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);

    if (!tagEntries.length) {
      nodes.profileGrid.innerHTML = ["清爽", "茶感", "水果", "奶香"]
        .map((tag) => `<span>${tag}</span>`)
        .join("");
      return;
    }

    nodes.profileGrid.innerHTML = tagEntries
      .map(([tag, value]) => `<span>${escapeHtml(tag)} +${Math.round(value)}</span>`)
      .join("");
  };

  const historyEntries = () =>
    getHistory().filter((item) => item.action === "chosen" || item.action === "saved");

  const historyWeight = (item) => {
    if (item.rating === "love") return 1.25;
    if (item.rating === "like") return 0.82;
    if (item.rating === "meh") return -0.18;
    if (item.rating === "nope") return -0.72;
    return item.action === "chosen" ? 0.62 : 0.34;
  };

  const buildPreferenceAxes = () => {
    const profile = getProfile();
    const values = {
      tea: 42,
      milk: 42,
      fruit: 42,
      fresh: 42,
      sweet: 42,
      adventure: 36
    };
    const history = historyEntries();

    for (const [key, value] of Object.entries(profile.taste || {})) {
      if (key in values) values[key] += clamp(value, -20, 20) * 2.1;
    }

    for (const item of history) {
      const product = productById(item.productId);
      if (!product) continue;
      const weight = historyWeight(item);
      const taste = product.tasteProfile || {};
      values.tea += (taste.tea || 0) * weight * 2.6;
      values.milk += (taste.milk || 0) * weight * 2.6;
      values.fruit += (taste.fruit || 0) * weight * 2.8;
      values.fresh += (taste.fresh || 0) * weight * 2.6;
      values.sweet += (taste.sweet || 0) * weight * 2.2;
      values.adventure += (product.isSeasonal ? 11 : product.isClassic ? 3 : 7) * weight;
    }

    return [
      { key: "tea", label: "茶感", value: clamp(values.tea, 8, 100) },
      { key: "milk", label: "奶香", value: clamp(values.milk, 8, 100) },
      { key: "fruit", label: "果香", value: clamp(values.fruit, 8, 100) },
      { key: "fresh", label: "清爽", value: clamp(values.fresh, 8, 100) },
      { key: "sweet", label: "甜感", value: clamp(values.sweet, 8, 100) },
      { key: "adventure", label: "尝鲜", value: clamp(values.adventure, 8, 100) }
    ];
  };

  const drawRadar = (canvas, axes) => {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const size = Math.max(280, Math.floor(canvas.clientWidth || 320));
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);

    const cx = size / 2;
    const cy = size / 2;
    const radius = size * 0.31;
    const count = axes.length;
    const point = (index, value = 100) => {
      const angle = -Math.PI / 2 + (Math.PI * 2 * index) / count;
      const r = radius * (value / 100);
      return [cx + Math.cos(angle) * r, cy + Math.sin(angle) * r];
    };

    ctx.lineWidth = 1;
    for (let level = 1; level <= 4; level += 1) {
      ctx.beginPath();
      axes.forEach((_, index) => {
        const [x, y] = point(index, level * 25);
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.strokeStyle = `rgba(93, 159, 143, ${0.11 + level * 0.035})`;
      ctx.stroke();
    }

    axes.forEach((axis, index) => {
      const [x, y] = point(index, 100);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(x, y);
      ctx.strokeStyle = "rgba(93, 159, 143, 0.16)";
      ctx.stroke();

      const [lx, ly] = point(index, 121);
      ctx.fillStyle = "#48665f";
      ctx.font = "800 13px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.textAlign = lx < cx - 12 ? "right" : lx > cx + 12 ? "left" : "center";
      ctx.textBaseline = "middle";
      ctx.fillText(axis.label, lx, ly);
    });

    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    gradient.addColorStop(0, "rgba(255, 249, 231, 0.78)");
    gradient.addColorStop(1, "rgba(93, 159, 143, 0.34)");
    ctx.beginPath();
    axes.forEach((axis, index) => {
      const [x, y] = point(index, axis.value);
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.strokeStyle = "rgba(66, 135, 117, 0.84)";
    ctx.lineWidth = 2;
    ctx.fill();
    ctx.stroke();

    axes.forEach((axis, index) => {
      const [x, y] = point(index, axis.value);
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = "#fffdf7";
      ctx.fill();
      ctx.strokeStyle = "rgba(66, 135, 117, 0.9)";
      ctx.stroke();
    });
  };

  const renderPreferenceAtlas = () => {
    const axes = buildPreferenceAxes();
    const history = historyEntries();
    const confirmed = history.filter((item) => item.action === "chosen").length;
    const saved = history.filter((item) => item.action === "saved").length;
    const triedIds = new Set(history.map((item) => item.productId));
    const brandCount = new Set(history.map((item) => item.brand)).size;
    const strongest = axes.slice().sort((a, b) => b.value - a.value).slice(0, 3);

    nodes.preferenceStats.innerHTML = [
      ["喝过", `${confirmed} 杯`],
      ["收藏", `${saved} 杯`],
      ["点亮", `${triedIds.size}/${state.products.length}`],
      ["品牌", `${brandCount || 0} 个`]
    ]
      .map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong></div>`)
      .join("");

    const topTags = Object.entries(getProfile().tags || {})
      .filter(([, value]) => value > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag]) => tag);
    nodes.preferenceHighlights.innerHTML = `
      <p>${history.length ? "目前最突出的偏好是" : "现在还在养成期，先喝几杯让图鉴长出来。"}</p>
      <div class="atlas-pill-row">
        ${strongest.map((axis) => `<span>${escapeHtml(axis.label)} ${Math.round(axis.value)}</span>`).join("")}
      </div>
      <div class="atlas-pill-row subtle">
        ${(topTags.length ? topTags : ["清爽", "茶感", "水果"]).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}
      </div>
    `;

    window.requestAnimationFrame(() => drawRadar(nodes.preferenceRadar, axes));
  };

  const atlasProductVisual = (product, brand) => {
    const visual = product.visual || {};
    const style = `--visual-base:${escapeHtml(visual.base || "#eef7f0")};--visual-accent:${escapeHtml(visual.accent || "#8abcae")};--visual-liquid:${escapeHtml(visual.liquid || "#d4b983")};`;
    if (product.image) {
      return `<div class="atlas-product-visual has-image" style="${style}"><img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.brand)} ${escapeHtml(product.name)}"></div>`;
    }
    return `
      <div class="atlas-product-visual" style="${style}" aria-label="${escapeHtml(product.brand)} ${escapeHtml(product.name)}">
        <div class="atlas-mini-cup">
          <span></span>
          <strong>${escapeHtml(brand?.logoText || "TEA")}</strong>
        </div>
      </div>
    `;
  };

  const renderTeaAtlas = () => {
    const history = historyEntries();
    const triedIds = new Set(history.map((item) => item.productId));
    nodes.teaAtlasCount.textContent = `${state.products.length} 款`;

    const brandSections = state.brands.map((brand) => {
      const products = state.products.filter((product) => product.brandId === brand.id);
      if (!products.length) return "";
      const triedCount = products.filter((product) => triedIds.has(product.id)).length;
      return `
        <section class="tea-brand-section">
          <div class="tea-brand-head">
            <div class="brand-lockup">
              <div class="brand-logo">${brand.logo ? `<img src="${escapeHtml(brand.logo)}" alt="${escapeHtml(brand.name)} Logo">` : escapeHtml(brand.logoText || brand.name)}</div>
              <div>
                <p>${escapeHtml(brand.brandTone || "奶茶品牌")}</p>
                <strong>${escapeHtml(brand.name)}</strong>
              </div>
            </div>
            <span>${triedCount}/${products.length} 已点亮</span>
          </div>
          <div class="tea-atlas-grid">
            ${products
              .map((product) => {
                const tried = triedIds.has(product.id);
                const status = product.sourceStatus === "verified" ? "已核验" : product.sourceStatus === "reviewed" ? "已复核" : "待复核";
                const review = product.reviewSummary || {};
                const confidence = Math.round((Number(review.confidence) || 0) * 100);
                return `
                  <button class="tea-atlas-card ${tried ? "is-tried" : ""}" type="button" data-atlas-product="${escapeHtml(product.id)}">
                    ${atlasProductVisual(product, brand)}
                    <span class="atlas-card-status">${tried ? "已点亮" : status}</span>
                    <strong>${escapeHtml(product.name)}</strong>
                    <small>${escapeHtml(product.category)}</small>
                    <div class="atlas-review-meter">
                      <span>印象分 ${escapeHtml(review.impressionScore || "待补")}</span>
                      <span>置信 ${confidence}%</span>
                    </div>
                    <div class="atlas-card-tags">
                      ${(review.positiveSignals || product.tags || []).slice(0, 4).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}
                    </div>
                    <p>${escapeHtml(product.recommendedSugar || "少糖")} · ${escapeHtml(product.recommendedIce || "少冰")}</p>
                  </button>
                `;
              })
              .join("")}
          </div>
        </section>
      `;
    });

    nodes.teaAtlasList.innerHTML = brandSections.join("");
    nodes.teaAtlasList.querySelectorAll("[data-atlas-product]").forEach((button) => {
      button.addEventListener("click", () => {
        const product = productById(button.dataset.atlasProduct);
        if (!product) return;
        closeTeaAtlas();
        state.current = product;
        renderProduct(product);
      });
    });
  };

  let toastTimer = null;
  const showToast = (message) => {
    nodes.toast.textContent = message;
    nodes.toast.classList.add("is-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => nodes.toast.classList.remove("is-visible"), 1800);
  };

  const openLetter = () => {
    nodes.letterModal.hidden = false;
    document.body.style.overflow = "hidden";
  };

  const closeLetter = () => {
    if (nodes.skipLetterToday.checked) {
      localStorage.setItem(STORAGE.letterSkipDate, today());
    }
    nodes.letterModal.hidden = true;
    document.body.style.overflow = "";
  };

  const closeResult = () => {
    nodes.resultModal.hidden = true;
    document.body.style.overflow = "";
  };

  const openHistory = () => {
    renderHistory();
    nodes.historyModal.hidden = false;
    document.body.style.overflow = "hidden";
  };

  const closeHistory = () => {
    nodes.historyModal.hidden = true;
    document.body.style.overflow = "";
  };

  const openPreferenceAtlas = () => {
    renderPreferenceAtlas();
    nodes.preferenceAtlasModal.hidden = false;
    document.body.style.overflow = "hidden";
    window.setTimeout(() => drawRadar(nodes.preferenceRadar, buildPreferenceAxes()), 80);
  };

  const closePreferenceAtlas = () => {
    nodes.preferenceAtlasModal.hidden = true;
    document.body.style.overflow = "";
  };

  const openTeaAtlas = () => {
    renderTeaAtlas();
    nodes.teaAtlasModal.hidden = false;
    document.body.style.overflow = "hidden";
  };

  const closeTeaAtlas = () => {
    nodes.teaAtlasModal.hidden = true;
    document.body.style.overflow = "";
  };

  const historyRateButton = (value, label, rating) =>
    `<button type="button" class="${rating === value ? "is-selected" : ""}" data-history-rating="${value}">${label}</button>`;

  const renderHistory = () => {
    const history = getHistory()
      .filter((item) => item.action === "chosen" || item.action === "saved")
      .slice()
      .reverse();

    if (!history.length) {
      nodes.historyList.innerHTML = `<div class="history-empty">还没有确认过奶茶。等雪点了“今天就喝这个”，这里就会开始记录。</div>`;
      return;
    }

    nodes.historyList.innerHTML = history
      .map((item) => {
        const rating = item.rating || "";
        return `
          <article class="history-item" data-history-created="${escapeHtml(item.createdAt)}">
            <div class="history-item-head">
              <span>${escapeHtml(item.date)}</span>
              <span>${item.action === "chosen" ? "已确认" : "已收藏"}</span>
            </div>
            <h3>${escapeHtml(item.brand)} · ${escapeHtml(item.name)}</h3>
            <p class="history-mode">${escapeHtml(item.mode || "normal · 随便抽")}</p>
            <div class="history-rate" aria-label="历史评分">
              ${historyRateButton("love", "超喜欢", rating)}
              ${historyRateButton("like", "还不错", rating)}
              ${historyRateButton("meh", "一般", rating)}
              ${historyRateButton("nope", "不想再喝", rating)}
            </div>
          </article>
        `;
      })
      .join("");

    $$(".history-rate button").forEach((button) => {
      button.addEventListener("click", () => rateHistoryItem(button));
    });
  };

  const rateHistoryItem = (button) => {
    const itemNode = button.closest(".history-item");
    const createdAt = itemNode?.dataset.historyCreated;
    const rating = button.dataset.historyRating;
    const rule = FEEDBACK_RULES[rating];
    if (!createdAt || !rule) return;

    const history = getHistory();
    const target = history.find((item) => item.createdAt === createdAt);
    const product = state.products.find((item) => item.id === target?.productId);
    if (!target || !product) return;

    const profile = getProfile();
    const previousRule = FEEDBACK_RULES[target.rating];
    if (previousRule) applyRuleDelta(profile, product, previousRule, -1);
    target.rating = rating;
    writeJson(STORAGE.history, history);
    applyRuleDelta(profile, product, rule, 1);
    renderProfile();
    renderHistory();
    showToast(`历史评分已更新：${rule.label}`);
  };

  const maybeShowLetter = () => {
    const is520 = today() === "2026-05-20";
    const skipped = localStorage.getItem(STORAGE.letterSkipDate) === today();
    if (is520 && !skipped) openLetter();
  };

  const bindEvents = () => {
    nodes.drawBtn.addEventListener("click", () => drawProduct({ skipCurrent: Boolean(state.current) }));
    nodes.redrawBtn.addEventListener("click", () => drawProduct({ skipCurrent: true }));
    nodes.openHistoryBtn.addEventListener("click", openHistory);
    nodes.openHistoryBtnCard.addEventListener("click", openHistory);
    nodes.openHistoryBtnHero.addEventListener("click", openHistory);
    nodes.openTeaAtlasBtn.addEventListener("click", openTeaAtlas);
    nodes.openPreferenceAtlasBtn.addEventListener("click", openPreferenceAtlas);

    nodes.infiniteMode.addEventListener("change", (event) => {
      state.infinite = event.target.checked;
      showToast(state.infinite ? "无限换模式已开启" : "无限换模式已关闭");
    });

    nodes.modeChips.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", () => toggleMode(button.dataset.mode || "any"));
    });

    $$(".feedback-buttons button").forEach((button) => {
      button.addEventListener("click", () => applyFeedback(button.dataset.feedback, button));
    });

    nodes.openLetterBtn.addEventListener("click", openLetter);
    nodes.openLetterBtnDesktop?.addEventListener("click", openLetter);
    nodes.enterMachineBtn.addEventListener("click", () => {
      closeLetter();
      if (!state.current) {
        window.setTimeout(() => drawProduct(), 160);
      }
    });

    $$("[data-close-letter]").forEach((node) => node.addEventListener("click", closeLetter));
    $$("[data-close-result]").forEach((node) => node.addEventListener("click", closeResult));
    $$("[data-close-history]").forEach((node) => node.addEventListener("click", closeHistory));
    $$("[data-close-preference-atlas]").forEach((node) => node.addEventListener("click", closePreferenceAtlas));
    $$("[data-close-tea-atlas]").forEach((node) => node.addEventListener("click", closeTeaAtlas));
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !nodes.letterModal.hidden) closeLetter();
      if (event.key === "Escape" && !nodes.resultModal.hidden) closeResult();
      if (event.key === "Escape" && !nodes.historyModal.hidden) closeHistory();
      if (event.key === "Escape" && !nodes.preferenceAtlasModal.hidden) closePreferenceAtlas();
      if (event.key === "Escape" && !nodes.teaAtlasModal.hidden) closeTeaAtlas();
    });
    window.addEventListener("resize", () => {
      if (!nodes.preferenceAtlasModal.hidden) drawRadar(nodes.preferenceRadar, buildPreferenceAxes());
    });
  };

  const init = async () => {
    try {
      const response = await fetch("data/milk-tea-products.json", { cache: "no-store" });
      const data = await response.json();
      state.products = Array.isArray(data.products) ? data.products : [];
      state.brands = Array.isArray(data.brands) ? data.brands : [];
    } catch (error) {
      showToast("奶茶菜单加载失败，等我一下下");
      console.error(error);
    }

    bindEvents();
    updateModeChips();
    renderProfile();
    maybeShowLetter();
    if (new URLSearchParams(window.location.search).get("draw") === "1") {
      window.setTimeout(() => drawProduct(), 220);
    }
    if (new URLSearchParams(window.location.search).get("history") === "1") {
      window.setTimeout(() => openHistory(), 260);
    }
    if (new URLSearchParams(window.location.search).get("atlas") === "tea") {
      window.setTimeout(() => openTeaAtlas(), 260);
    }
    if (new URLSearchParams(window.location.search).get("atlas") === "preference") {
      window.setTimeout(() => openPreferenceAtlas(), 260);
    }
  };

  init();
})();
