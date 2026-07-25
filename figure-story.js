(() => {
  const $ = (selector) => document.querySelector(selector);

  const escapeHtml = (value) =>
    String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");

  const fallbackThumb = "assets/figure-story/ui/video-case-01.png";

  const companionLines = [
    "我把它放在这里，不是为了介绍它，而是希望你路过的时候会觉得被陪着。",
    "它像一个小小的守护摆件，安静站在小家里，替我多陪你一会儿。",
    "这张可爱的脸不用解释太多，只要能让你想起喜欢过的感觉就够了。",
    "我希望这里的每一个小手办，都像是给你的温柔提示：有人一直认真想着你。"
  ];

  const formatNumber = (value) => {
    const num = Number(value || 0);
    if (num >= 10000) return `${(num / 10000).toFixed(num >= 100000 ? 0 : 1)}万`;
    return String(num);
  };

  const loadJson = async (url) => {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`Failed to load ${url}`);
    return response.json();
  };

  const renderSources = (exhibit) => {
    const sourceGrid = $("#figureSourceGrid");
    if (!sourceGrid) return;
    sourceGrid.innerHTML = (exhibit.sources || [])
      .map(
        (item) => `
          <article class="figure-source-card">
            <span>${escapeHtml(item.status)}</span>
            <strong>${escapeHtml(item.name)}</strong>
            <p>${escapeHtml(item.note)}</p>
            <small>${escapeHtml(item.count)} 项</small>
          </article>
        `
      )
      .join("");
  };

  const renderCharacters = (exhibit, roster = {}) => {
    const rail = $("#figureCharacterRail");
    if (!rail) return;
    const exhibitByName = new Map((exhibit.characters || []).map((item) => [item.name, item]));
    const items = (roster.items?.length ? roster.items : exhibit.characters || []).map((item) => {
      const exhibitItem = exhibitByName.get(item.name) || {};
      return {
        ...item,
        role: exhibitItem.role || item.role,
        origin: exhibitItem.origin || item.origin,
        impression: exhibitItem.impression || item.impression,
        tags: exhibitItem.tags || item.tags
      };
    });
    rail.innerHTML = items
      .map(
        (item, index) => `
          <article class="figure-character-card">
            <div class="figure-character-art">
              <span class="figure-character-plate" aria-hidden="true"></span>
              <img src="${escapeHtml(item.asset)}" alt="${escapeHtml(item.name)}">
              <span class="figure-character-base" aria-hidden="true"></span>
            </div>
            <div class="figure-character-copy">
              <span>陪在小家里的手办</span>
              <h3>${escapeHtml(item.name)}</h3>
              <p>${escapeHtml(companionLines[index % companionLines.length])}</p>
              <div class="figure-tag-row">
                ${["陪伴", "小摆件", "给雪"].map((tag) => `<small>${escapeHtml(tag)}</small>`).join("")}
              </div>
            </div>
          </article>
        `
      )
      .join("");

    const stat = $("#statFigureCharacters");
    if (stat) stat.textContent = String(items.length);
  };

  const renderVideos = (videoData, mediaManifest) => {
    const grid = $("#figureVideoGrid");
    if (!grid) return;
    const mediaById = new Map((mediaManifest.items || []).map((item) => [item.id, item]));
    const items = (videoData.items || []).slice(0, 12);
    grid.innerHTML = items
      .map((item, index) => {
        const media = mediaById.get(item.id);
        const rank = String(index + 1).padStart(2, "0");
        const thumb = `assets/figure-story/ui/video-case-${rank}.png`;
        const duration = media?.duration ? `${Math.round(media.duration)} 秒素材` : "待抽帧";
        return `
          <a class="figure-video-card" href="${escapeHtml(item.url)}" target="_blank" rel="noopener">
            <img src="${escapeHtml(thumb)}" alt="${escapeHtml(item.title)}">
            <span>${rank}</span>
            <strong>${escapeHtml(item.title)}</strong>
            <small>${escapeHtml(item.publishedAt)} · ${formatNumber(item.plays)} 播放 · ${escapeHtml(duration)}</small>
          </a>
        `;
      })
      .join("");

    const stat = $("#statFigureVideos");
    const count = (mediaManifest.items || videoData.items || []).length;
    if (stat) stat.textContent = String(count);
    const sourceCount = $("#figureSourceCount");
    if (sourceCount) sourceCount.textContent = String(count || 40);
  };

  const initFigureStory = async () => {
    try {
      const [exhibit, videoData, mediaManifest, roster] = await Promise.all([
        loadJson("data/figure-story-exhibit.json"),
        loadJson("data/figure-story-videos.json"),
        loadJson("data/figure-story-media-manifest.json"),
        loadJson("data/figure-story-character-roster.json")
      ]);
      renderSources(exhibit);
      renderCharacters(exhibit, roster);
      renderVideos(videoData, mediaManifest);
    } catch (error) {
      console.warn("Little world companion data unavailable", error);
    }
  };

  initFigureStory();
})();
