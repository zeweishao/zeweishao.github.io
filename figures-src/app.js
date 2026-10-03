// Light list index first; per-hero details and the 3D engine load only when a figure is opened.
const INDEX_URL = 'figures-data/index.json';
const detailUrl = id => 'figures-data/heroes/' + encodeURIComponent(id) + '.json';
const ASSET_BASE = new URL(window.FIGURE_ASSET_BASE || 'figures-assets/', document.baseURI);
const DEFAULTS_KEY = 'figure-catalog.default-skins.v1';
const $ = selector => document.querySelector(selector);
const ui = {
  game: $('#game'), loading: $('#model-loading'), status: $('#model-status'), retry: $('#retry-media'),
  portrait: $('#portrait'), portraitLayer: $('#portrait-layer'), animation: $('#animation'), play: $('#pause'),
  dialog: $('#modal'), modal: $('#modal-content'), cards: $('#cards'), search: $('#hero-search'),
  profession: $('#profession-filter'), brand: $('#brand-filter'), count: $('#results-count'),
};
const state = {
  heroId: null, skinId: null, mode: '3d', collection: true,
  modelKind: null, modelHeroId: null, modelSkinId: null, modelSource: null,
  modelReady: false, pending: false, portraitReady: false, animationStatus: 'unknown',
  portraitError: null, modelError: null, selectedAction: 'default', lastRequestedKind: 'showcase',
  search: '', professionId: '', brandId: '',
};
let catalog, viewer, viewerError, toastTimer;
let modelRequest = 0, portraitRequest = 0, actionIntent = 0;
const heroById = new Map();
const voiceCache = new Map();
const voiceRequests = new Map();
const compactLayout = window.matchMedia('(max-width: 760px)');
let defaultSkins = readDefaultSkins();

function plain(value) {
  return String(value ?? '').replace(/<[^>]*>/g, '').replace(/\\n/g, '\n');
}
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = plain(text);
  return node;
}
const hero = () => heroById.get(state.heroId);
const skin = () => hero()?.skins.find(entry => entry.id === state.skinId);
const sameModel = () => state.modelReady && state.modelHeroId === state.heroId && state.modelSkinId === state.skinId;

function localAsset(path, types, relativeTo) {
  if (typeof path !== 'string' || !path.trim()) throw new Error('资源地址未提供。');
  const clean = path.startsWith('assets/') ? path.slice(7) : path;
  const url = new URL(clean, relativeTo && !path.startsWith('assets/') ? relativeTo : ASSET_BASE);
  const extension = url.pathname.split('.').at(-1).toLowerCase();
  if (!url.href.startsWith(ASSET_BASE.href) || (types && !types.includes(extension))) throw new Error('资源地址无效。');
  return url.href;
}
function makeImage(path, className, alt = '', lazy = false) {
  const image = el('img', className);
  image.alt = plain(alt);
  image.decoding = 'async';
  if (lazy) image.loading = 'lazy';
  image.onerror = () => { image.hidden = true; image.parentElement?.classList.add('image-unavailable'); };
  try { image.src = localAsset(path, ['png', 'jpg', 'jpeg', 'webp']); }
  catch { image.hidden = true; }
  return image;
}
function toast(message) {
  $('#toast').textContent = plain(message);
  $('#toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 4200);
}

function readDefaultSkins() {
  try {
    const raw = JSON.parse(localStorage.getItem(DEFAULTS_KEY) || '{}');
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return new Map();
    return new Map(Object.entries(raw).filter(([id, value]) => id && ['string', 'number'].includes(typeof value)).map(([id, value]) => [id, String(value)]));
  } catch { return new Map(); }
}
function defaultSkinForHero(selectedHero) {
  if (!selectedHero) return null;
  const saved = defaultSkins.get(selectedHero.id);
  return selectedHero.skins.find(entry => entry.id === saved)
    || selectedHero.skins.find(entry => entry.id === selectedHero.defaultSkinId)
    || selectedHero.skins[0] || null;
}
function setDefaultSkin(heroId = state.heroId, skinId = state.skinId) {
  const selectedHero = heroById.get(String(heroId));
  const selectedSkin = selectedHero?.skins.find(entry => entry.id === String(skinId));
  if (!selectedHero || !selectedSkin) return false;
  defaultSkins.set(selectedHero.id, selectedSkin.id);
  let persisted = true;
  try { localStorage.setItem(DEFAULTS_KEY, JSON.stringify(Object.fromEntries(defaultSkins))); }
  catch { persisted = false; }
  const currentCard = [...ui.cards.children].find(node => node.dataset.heroId === selectedHero.id);
  if (currentCard) {
    const focused = document.activeElement === currentCard;
    const newCard = makeHeroCard(selectedHero);
    currentCard.replaceWith(newCard);
    if (focused) { newCard.tabIndex = 0; newCard.focus(); }
  }
  if (selectedHero.id === state.heroId && selectedSkin.id !== state.skinId) {
    void selectSkin(selectedSkin.id);
  }
  updateDefaultControls();
  updateSkinOptionStates();
  toast(persisted
    ? selectedHero.name + ' · ' + selectedSkin.name + ' 已设为默认展示。'
    : '本次会话已设为默认展示；浏览器未允许保存到本地。');
  return persisted;
}
function updateDefaultControls() {
  const selectedHero = hero(), selectedSkin = skin();
  const isDefault = Boolean(selectedHero && selectedSkin && defaultSkinForHero(selectedHero)?.id === selectedSkin.id);
  $('#set-default-skin').disabled = !selectedSkin || isDefault;
  $('#set-default-skin').textContent = isDefault ? '默认展示 ✓' : '设为默认展示';
  $('#default-display-badge').textContent = isDefault ? '默认展示' : '款式预览';
}
window.addEventListener('storage', event => {
  if (event.key !== DEFAULTS_KEY && event.key !== null) return;
  defaultSkins = readDefaultSkins();
  if (catalog) { renderCollection(); updateDefaultControls(); updateSkinOptionStates(); }
});

function normalizeCatalog(data) {
  if (!data || !Array.isArray(data.heroes) || !data.heroes.length) throw new Error('图鉴目录暂未包含英雄资料。');
  const seenHeroes = new Set();
  const heroes = [];
  for (const source of data.heroes) {
    if (source.id === undefined || !source.name) continue;
    const id = String(source.id);
    if (seenHeroes.has(id)) continue;
    seenHeroes.add(id);
    const seenSkins = new Set();
    const skins = (source.skins || []).filter(entry => {
      if (entry.id === undefined || seenSkins.has(String(entry.id))) return false;
      seenSkins.add(String(entry.id)); return true;
    }).map(entry => ({ ...entry, id: String(entry.id), name: plain(entry.name), models: { ...(entry.models || {}) } }));
    heroes.push({
      ...source, id, name: plain(source.name), skins,
      defaultSkinId: String(source.defaultSkinId ?? skins[0]?.id ?? ''),
      profession: { id: String(source.profession?.id ?? ''), name: plain(source.profession?.name) },
      brand: { id: String(source.brand?.id ?? ''), name: plain(source.brand?.name) },
      skills: Array.isArray(source.skills) ? source.skills : [],
      cv: source.cv || {},
    });
  }
  if (!heroes.length) throw new Error('图鉴目录没有可识别的英雄条目。');
  return { ...data, defaultHeroId: String(data.defaultHeroId ?? heroes[0].id), heroes };
}
function buildFilters() {
  for (const [key, select, title] of [['profession', ui.profession, '全部职业'], ['brand', ui.brand, '全部品牌']]) {
    const choices = new Map();
    for (const entry of catalog.heroes) {
      if (entry[key].id && entry[key].name && !choices.has(entry[key].id)) choices.set(entry[key].id, entry[key].name);
    }
    select.replaceChildren(new Option(title, ''), ...[...choices].map(([id, name]) => new Option(name, id)));
  }
}
function filteredHeroes() {
  if (!catalog) return [];
  const search = state.search.normalize('NFKC').trim().toLocaleLowerCase();
  return catalog.heroes.filter(entry =>
    (!state.professionId || entry.profession.id === state.professionId)
    && (!state.brandId || entry.brand.id === state.brandId)
    && (!search || entry.name.normalize('NFKC').toLocaleLowerCase().includes(search))
  );
}
function makeHeroCard(selectedHero) {
  const savedSkin = defaultSkinForHero(selectedHero);
  const button = el('button', 'figure-card hero-card' + (selectedHero.id === state.heroId ? ' selected' : ''));
  button.dataset.heroId = selectedHero.id;
  button.dataset.skinId = savedSkin?.id || '';
  button.tabIndex = selectedHero.id === state.heroId ? 0 : -1;
  button.setAttribute('aria-pressed', String(selectedHero.id === state.heroId));
  button.setAttribute('aria-label', [selectedHero.name, selectedHero.profession.name, selectedHero.brand.name, savedSkin?.name].filter(Boolean).join(' · '));
  const art = el('span', 'card-art');
  const image = makeImage(savedSkin?.thumb || savedSkin?.portrait, 'card-image', '', true);
  image.width = 256; image.height = 340;
  // Thumbnails are trimmed to the figure, so wide ones (mechs, sofas) would look tiny when fitted
  // into a portrait frame. Scale by aspect so every figure fills a similar visual area.
  const fit = () => {
    const ratio = image.naturalWidth / image.naturalHeight || 0.75;
    image.style.height = Math.min(88, Math.max(78 / ratio, 56)) + '%';
  };
  if (image.complete && image.naturalWidth) fit(); else image.addEventListener('load', fit, { once: true });
  art.append(image, el('span', 'card-brand', selectedHero.brand.name));
  const caption = el('span', 'card-name');
  caption.append(el('strong', '', selectedHero.name), el('span', 'card-profession', selectedHero.profession.name), el('small', 'card-skin-name', savedSkin?.name || ''));
  button.append(art, caption);
  button.onclick = () => { void selectHero(selectedHero.id, { openDetails: true, focus: true }); };
  return button;
}
function renderCollection() {
  const matches = filteredHeroes();
  ui.cards.replaceChildren(...matches.map(makeHeroCard));
  if (![...ui.cards.children].some(card => card.tabIndex === 0) && ui.cards.firstElementChild) ui.cards.firstElementChild.tabIndex = 0;
  const skinTotal = catalog.heroes.reduce((sum, entry) => sum + (entry.skins?.length || 0), 0);
  ui.count.textContent = matches.length === catalog.heroes.length ? catalog.heroes.length + ' 位 · ' + skinTotal + ' 款' : matches.length + ' / ' + catalog.heroes.length + ' 位';
  $('#catalog-total').textContent = '';
  $('#catalog-empty').hidden = matches.length > 0;
}
function setFilters(filters = {}) {
  if (filters.search !== undefined) state.search = String(filters.search);
  if (filters.professionId !== undefined) state.professionId = String(filters.professionId);
  if (filters.brandId !== undefined) state.brandId = String(filters.brandId);
  ui.search.value = state.search;
  ui.profession.value = state.professionId;
  ui.brand.value = state.brandId;
  if (catalog) renderCollection();
  return filteredHeroes().map(entry => entry.id);
}
ui.search.oninput = () => setFilters({ search: ui.search.value });
ui.search.onkeydown = event => {
  if (event.key === 'Escape' && ui.search.value) { event.preventDefault(); setFilters({ search: '' }); }
};
ui.profession.onchange = () => setFilters({ professionId: ui.profession.value });
ui.brand.onchange = () => setFilters({ brandId: ui.brand.value });
$('#reset-filters').onclick = () => { setFilters({ search: '', professionId: '', brandId: '' }); ui.search.focus(); };
ui.cards.addEventListener('keydown', event => {
  const card = event.target.closest('.hero-card');
  if (!card || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
  const cards = [...ui.cards.children];
  const columns = Math.max(1, getComputedStyle(ui.cards).gridTemplateColumns.split(' ').length);
  const index = cards.indexOf(card);
  const offsets = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -columns, ArrowDown: columns };
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? cards.length - 1 : Math.max(0, Math.min(cards.length - 1, index + offsets[event.key]));
  event.preventDefault(); card.tabIndex = -1;
  if (cards[next]) { cards[next].tabIndex = 0; cards[next].focus(); }
});

function stopAudio() {
  const audio = $('#voice-audio');
  if (!audio) return;
  audio.pause(); audio.removeAttribute('src'); audio.load();
}
function openModal(title) {
  stopAudio(); ui.modal.replaceChildren(el('h2', '', title)); ui.modal.firstChild.id = 'modal-title';
  if (!ui.dialog.open) ui.dialog.showModal();
  return ui.modal;
}
$('.close-modal').onclick = () => ui.dialog.close();
ui.dialog.addEventListener('close', stopAudio);
ui.dialog.addEventListener('cancel', stopAudio);
ui.dialog.addEventListener('click', event => {
  const rect = ui.dialog.getBoundingClientRect();
  if (event.target === ui.dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) ui.dialog.close();
});
function showLoading(message, failed = false) {
  ui.loading.hidden = false; ui.loading.classList.toggle('has-error', failed);
  ui.status.textContent = plain(message); ui.retry.hidden = !failed;
}
function stopRotation() {
  viewer?.setAutoRotate(false); $('#auto-rotate').setAttribute('aria-pressed', 'false');
}
function hasAnimationSource() {
  if (state.animationStatus === 'none') return false;
  return Boolean(skin()?.models.animated || (sameModel() && viewer?.animations.length));
}
function stageVisible() {
  return !state.collection;
}
function updateViewerVisibility() {
  viewer?.setVisible(state.mode === '3d' && sameModel() && !state.pending && stageVisible());
}
compactLayout.addEventListener('change', () => {
  if (!stageVisible()) viewer?.pause();
  updateViewerVisibility(); updateControls();
});
function updateControls() {
  const selectedHero = hero(), selectedSkin = skin(), current = viewer?.getPlaybackState();
  const usable = sameModel() && state.mode === '3d' && !state.pending;
  const canAnimate = Boolean(viewer && selectedSkin && hasAnimationSource());
  $('#auto-rotate').disabled = !usable;
  $('#reset-view').disabled = !usable;
  $('#restore-pose').disabled = !viewer || state.mode !== '3d' || state.pending
    || (state.modelKind !== 'animated' && !(state.modelError && state.lastRequestedKind === 'animated'));
  ui.animation.disabled = !canAnimate || state.pending;
  ui.play.disabled = !canAnimate || state.pending;
  $('#voice-button').disabled = !selectedHero?.audioManifest;
  $('#voice-button').title = selectedHero?.audioManifest ? '播放此手办的角色语音' : '此手办未收录语音资源';
  $('#voice-button').lastElementChild.textContent = selectedHero?.audioManifest ? '语音播放' : '暂无语音';
  $('#skins-button').disabled = !selectedHero?.skins.length;
  $('#image-mode').disabled = state.mode === '3d' ? !selectedSkin?.portrait : !viewer || !selectedSkin?.models.showcase;
  let label = '播放动作';
  if (sameModel() && state.modelKind === 'animated' && current) {
    if (current.state === 'playing') label = '暂停动作';
    if (current.state === 'paused') label = '继续动作';
    if (current.state === 'ended') label = '重播动作';
  }
  ui.play.textContent = state.pending ? '载入中…' : label;
  ui.play.setAttribute('aria-pressed', String(sameModel() && current?.state === 'paused'));
  $('#action-note').textContent = state.pending ? '正在载入所选款式…'
    : !canAnimate ? '此款式为固定展示造型。'
    : sameModel() && current?.state === 'ended' && state.modelKind === 'animated' ? '动作已结束。可重播，或返回展示造型。'
    : '';
  if (selectedHero && selectedSkin) {
    const text = selectedHero.name + ' · ' + selectedSkin.name + ' · ' + (state.mode === '2d' ? '原画立绘' : state.modelKind === 'animated' ? '动作模型' : '3D 手办');
    $('#resource-state').textContent = text; $('#resource-state').title = text;
  }
  updateDefaultControls();
}
function updateStage() {
  const imageMode = state.mode === '2d';
  ui.game.classList.toggle('image-mode', imageMode);
  ui.portraitLayer.hidden = !imageMode; $('#viewer').hidden = imageMode;
  $('#image-mode-label').textContent = imageMode ? '模型' : '图像';
  $('#image-mode').setAttribute('aria-pressed', String(imageMode));
  $('#image-mode').title = imageMode ? '切换到 3D 模型' : '切换到 2D 立绘';
  $('#gesture-hint').textContent = imageMode ? '原作立绘 · 可在特别款式中切换涂装' : '拖动旋转 · 滚轮缩放 · 双指缩放';
  if (imageMode) {
    if (state.portraitReady) ui.loading.hidden = true;
    else showLoading(state.portraitError || '正在载入原画…', Boolean(state.portraitError));
  } else if (state.pending) showLoading('正在载入 3D 手办…');
  else if (sameModel()) ui.loading.hidden = true;
  else if (state.modelError) showLoading(state.modelError, true);
  updateControls();
}
function invalidateModel() {
  ++actionIntent; ++modelRequest;
  viewer?.cancelLoad(); viewer?.pause(); viewer?.setVisible(false); stopRotation();
  Object.assign(state, { modelKind: null, modelHeroId: null, modelSkinId: null, modelSource: null, modelReady: false, pending: false, modelError: null, selectedAction: 'default', animationStatus: 'unknown' });
  window.figureLoaded = null;
  ui.animation.replaceChildren(new Option('展示动作', 'default'));
}
async function loadPortrait(selectedHero = hero(), selectedSkin = skin()) {
  if (!selectedHero || !selectedSkin) return;
  const request = ++portraitRequest;
  state.portraitReady = false; state.portraitError = null;
  ui.portrait.removeAttribute('src'); updateStage();
  const image = new Image();
  try {
    image.src = localAsset(selectedSkin.portrait, ['png', 'jpg', 'jpeg', 'webp']);
    await image.decode();
    if (request !== portraitRequest || state.heroId !== selectedHero.id || state.skinId !== selectedSkin.id) return;
    ui.portrait.src = image.src;
    ui.portrait.alt = plain(selectedSkin.fullName || selectedHero.name + ' · ' + selectedSkin.name) + ' 立绘';
    state.portraitReady = true;
  } catch {
    if (request !== portraitRequest || state.heroId !== selectedHero.id || state.skinId !== selectedSkin.id) return;
    state.portraitError = '此款式的立绘暂未载入，请重新载入。';
  }
  updateStage();
}
function modelPath(kind) {
  const selected = skin();
  if (!selected) return null;
  if (kind === 'showcase') return selected.models.showcase;
  return selected.models.animated || (sameModel() && viewer?.animations.length ? selected.models.showcase : null);
}
async function loadModel(kind = 'showcase') {
  if (!viewer || !hero() || !skin()) return false;
  const request = ++modelRequest, expectedHero = state.heroId, expectedSkin = state.skinId;
  const path = modelPath(kind);
  state.pending = true; state.modelReady = false; state.modelError = null; state.lastRequestedKind = kind;
  viewer.pause(); viewer.setVisible(false); stopRotation(); window.figureLoaded = null; updateStage();
  try {
    const url = localAsset(path, ['glb', 'gltf']);
    const result = await viewer.load(url);
    if (request !== modelRequest || state.heroId !== expectedHero || state.skinId !== expectedSkin) return false;
    Object.assign(state, { modelReady: true, modelHeroId: expectedHero, modelSkinId: expectedSkin, modelKind: kind, modelSource: url, pending: false, modelError: null });
    if (kind === 'animated' || !skin().models.animated || localAsset(skin().models.animated, ['glb', 'gltf']) === url) {
      state.animationStatus = result.animations.length ? 'available' : 'none';
    }
    window.figureLoaded = { ...result, heroId: expectedHero, skinId: expectedSkin, modelKind: kind, url };
    if (result.animations.length) {
      configureAnimations(result.animations);
      const clip = findClip(state.selectedAction);
      if (kind === 'animated' && clip && result.initialPose?.name !== clip.name) viewer.preparePose(clip.name, 'end');
    } else {
      ui.animation.replaceChildren(new Option(skin()?.models.animated ? '展示动作' : '固定展示造型', 'default'));
    }
    updateViewerVisibility(); updateStage(); return true;
  } catch (error) {
    if (request !== modelRequest || error.name === 'AbortError') return false;
    state.pending = false; state.modelReady = false;
    state.modelError = '此款式的' + (kind === 'animated' ? '动作' : '展示') + '模型暂未载入，请重试或查看图像。';
    viewer.setVisible(false); updateStage(); return false;
  }
}

function renderHero() {
  const selectedHero = hero();
  if (!selectedHero) return;
  $('#hero-name').textContent = selectedHero.name;
  $('#stage-hero-name').textContent = selectedHero.name;
  $('#hero-subtitle').textContent = plain(selectedHero.englishName);
  $('#hero-subtitle').hidden = !selectedHero.englishName;
  $('#brand-name').textContent = selectedHero.brand.name;
  $('#stage-brand').textContent = selectedHero.brand.name;
  $('#profession-name').textContent = selectedHero.profession.name;
  $('#hero-brand-name').textContent = selectedHero.brand.name;
  $('#hero-story').textContent = plain(selectedHero.story);
  $('#hero-story').hidden = !selectedHero.story;
  const cvs = [selectedHero.cv.zh ? plain(selectedHero.cv.zh) + '（中）' : '', selectedHero.cv.ja ? plain(selectedHero.cv.ja) + '（日）' : ''].filter(Boolean);
  $('#voice-credit').replaceChildren(el('span', '', 'CV'), document.createTextNode(' ' + cvs.join(' / ')));
  $('#voice-credit').hidden = !cvs.length;
  renderSkills();
}
function renderSkin() {
  const selectedHero = hero(), selectedSkin = skin();
  if (!selectedHero || !selectedSkin) return;
  document.title = plain(selectedSkin.fullName || selectedHero.name + ' · ' + selectedSkin.name) + ' · 手办图鉴';
  $('#skin-name').textContent = selectedSkin.name;
  $('#stage-skin-name').textContent = selectedSkin.name;
  $('#figure-quote').textContent = plain(selectedSkin.voiceLine || selectedHero.tagline);
  $('#skin-story-section').hidden = !selectedSkin.story;
  $('#skin-story').textContent = plain(selectedSkin.story);
  $('#skin-story').classList.add('collapsed');
  $('#expand-story').textContent = '展开故事 ＋';
  $('#expand-story').setAttribute('aria-expanded', 'false');
  $('#skin-tags').replaceChildren(...(selectedSkin.tags || []).map(tag => el('span', '', tag)));
  updateDefaultControls();
}
async function selectSkin(id) {
  const selected = hero()?.skins.find(entry => entry.id === String(id));
  if (!selected) return false;
  invalidateModel();
  state.skinId = selected.id;
  state.portraitReady = false; state.portraitError = null;
  renderSkin(); void loadPortrait(); updateStage(); updateSkinOptionStates();
  if (state.mode === '3d') return loadModel('showcase');
  return true;
}
async function ensureDetail(id) {
  const listed = heroById.get(String(id));
  if (!listed) throw new Error('未找到这位手办。');
  if (listed.loaded) return listed;
  const response = await fetch(detailUrl(listed.id));
  if (!response.ok) throw new Error('手办资料暂未载入。');
  const full = normalizeCatalog({ heroes: [await response.json()] }).heroes[0];
  full.loaded = true;
  full.skins = full.skins.map(entry => ({ ...entry, thumb: entry.thumb || listed.skins.find(item => item.id === entry.id)?.thumb }));
  heroById.set(full.id, full);
  const index = catalog.heroes.findIndex(entry => entry.id === full.id);
  if (index >= 0) catalog.heroes[index] = full;
  return full;
}
let viewerPromise = null;
function ensureViewer() {
  if (viewer || viewerError) return Promise.resolve(viewer);
  viewerPromise ||= import('./viewer.js').then(({ FigureViewer }) => {
    viewer = new FigureViewer($('#viewer'), {
      onStatus(value) { if (state.pending && state.mode === '3d') ui.status.textContent = value.message; },
      onAnimationEnd() { updateControls(); },
    });
    viewer.setAutoRotate(false);
    if (!stageVisible()) viewer.setVisible(false);
    window.figureViewer = viewer;
    return viewer;
  }).catch(error => {
    viewerError = plain(error.message) || '当前浏览器未启用 3D 展示。';
    state.modelError = viewerError;
    return null;
  });
  return viewerPromise;
}
async function selectHero(id, options = {}) {
  if (!heroById.get(String(id))) return false;
  state.requestedHeroId = String(id);
  if (options.openDetails !== false) setCollection(false, { push: options.push !== false, heroId: String(id) });
  showLoading('正在载入手办…');
  let selectedHero;
  try {
    [selectedHero] = await Promise.all([ensureDetail(id), ensureViewer()]);
  } catch (error) {
    showLoading(plain(error.message) + ' 点击重新载入。', true);
    return false;
  }
  if (state.requestedHeroId !== selectedHero.id) return false;
  const selectedSkin = defaultSkinForHero(selectedHero);
  ++portraitRequest;
  invalidateModel();
  stopAudio(); if (ui.dialog.open) ui.dialog.close();
  state.heroId = selectedHero.id;
  state.skinId = selectedSkin?.id || null;
  state.mode = viewer ? '3d' : '2d';
  state.portraitReady = false; state.portraitError = null;
  renderHero(); renderCollection();
  if (options.focus) {
    $('#hero-name').focus({ preventScroll: true });
    if (window.matchMedia('(max-width: 760px)').matches) $('#figure-stage').scrollIntoView({ block: 'start', behavior: 'auto' });
  }
  if (!selectedSkin) {
    state.modelError = '此手办尚未提供款式资料。';
    showLoading(state.modelError, true); updateControls(); return false;
  }
  return selectSkin(selectedSkin.id);
}
async function setMode(mode, loadMissing = true) {
  if (!['2d', '3d'].includes(mode)) return false;
  if (mode === '2d') {
    ++actionIntent;
    if (state.pending) { ++modelRequest; viewer?.cancelLoad(); state.pending = false; }
    viewer?.pause(); viewer?.setVisible(false); stopRotation();
  }
  state.mode = mode; updateStage();
  if (mode === '3d') {
    if (!viewer) { state.modelError = viewerError || '当前浏览器未启用 3D 展示。'; updateStage(); return false; }
    if (sameModel()) updateViewerVisibility();
    else if (loadMissing) return loadModel('showcase');
  }
  return true;
}
function findClip(action) {
  const clips = viewer?.animations || [];
  return clips.find(clip => clip.name === action)
    || (action === 'default' ? clips.find(clip => /show_?fall|appear|entrance|登场/i.test(clip.name)) || clips.find(clip => /idle|待机/i.test(clip.name)) || clips[0] : undefined);
}
function animationLabel(name, index) {
  if (/show_?fall|appear|entrance|登场/i.test(name)) return '登场动作';
  if (/lose|defeat/i.test(name)) return '战败动作';
  if (/idle|待机/i.test(name)) return '待机动作';
  if (/win|victory/i.test(name)) return '胜利动作';
  return '动作 ' + (index + 1);
}
function configureAnimations(clips) {
  const selected = findClip(state.selectedAction) || clips[0];
  ui.animation.replaceChildren(...clips.map((clip, index) => new Option(animationLabel(clip.name, index), clip.name)));
  if (selected) { state.selectedAction = selected.name; ui.animation.value = selected.name; }
  else ui.animation.add(new Option('固定展示造型', ''));
}
async function playSelectedAction() {
  if (!viewer || !hero() || !skin() || state.pending || !hasAnimationSource()) return false;
  const intent = ++actionIntent, expectedHero = state.heroId, expectedSkin = state.skinId;
  await setMode('3d', false);
  if (intent !== actionIntent || state.heroId !== expectedHero || state.skinId !== expectedSkin || state.mode !== '3d') return false;
  if (!sameModel() || state.modelKind !== 'animated') {
    const sameAnimationAsset = sameModel() && viewer.animations.length && (!skin().models.animated || localAsset(skin().models.animated, ['glb', 'gltf']) === state.modelSource);
    if (sameAnimationAsset) {
      state.modelKind = 'animated';
      if (window.figureLoaded) window.figureLoaded.modelKind = 'animated';
    } else if (!await loadModel('animated')) return false;
  }
  if (intent !== actionIntent || state.heroId !== expectedHero || state.skinId !== expectedSkin || state.mode !== '3d') return false;
  const clip = findClip(state.selectedAction);
  if (!clip) { toast('此款式暂未包含可播放的动作。'); return false; }
  const playback = viewer.getPlaybackState();
  if (playback.name === clip.name && playback.state === 'playing') viewer.pause();
  else if (playback.name === clip.name && playback.state === 'paused') viewer.resume();
  else viewer.play(clip.name);
  updateControls(); return true;
}
function setCollection(collection, options = {}) {
  const wasCollection = state.collection;
  state.collection = Boolean(collection);
  ui.game.classList.toggle('collection-mode', state.collection);
  $('.collection').hidden = !state.collection;
  $('#figure-detail').hidden = state.collection;
  $('#collection-tab').classList.toggle('active', state.collection);
  $('#detail-tab').classList.toggle('active', !state.collection);
  $('#collection-tab').setAttribute('aria-pressed', String(state.collection));
  $('#detail-tab').setAttribute('aria-pressed', String(!state.collection));
  if (state.collection) { stopAudio(); viewer?.pause(); }
  if (!state.collection && options.push && wasCollection) history.pushState({ figure: options.heroId }, '', '#figure-' + options.heroId);
  if (wasCollection !== state.collection) window.scrollTo({ top: state.collection ? (state.listScroll || 0) : 0 });
  if (!state.collection) state.listScroll = state.listScroll ?? 0;
  if (!stageVisible()) viewer?.pause();
  updateViewerVisibility(); updateControls();
  requestAnimationFrame(() => viewer?.resize());
}
window.addEventListener('popstate', () => {
  const match = location.hash.match(/^#figure-(.+)$/);
  if (match && heroById.has(decodeURIComponent(match[1]))) void selectHero(decodeURIComponent(match[1]), { push: false });
  else setCollection(true);
});
function updateSkinOptionStates() {
  const grid = $('#skin-options');
  if (!grid || grid.dataset.heroId !== state.heroId) return;
  const saved = defaultSkinForHero(hero())?.id;
  for (const item of grid.children) {
    const selected = item.dataset.skinId === state.skinId;
    const isDefault = item.dataset.skinId === saved;
    item.classList.toggle('selected', selected);
    item.classList.toggle('is-default', isDefault);
    item.querySelector('.skin-preview').setAttribute('aria-pressed', String(selected));
    item.querySelector('.skin-preview-status').textContent = selected ? '当前款式' : '查看款式';
    const saveButton = item.querySelector('.save-skin-default');
    saveButton.disabled = isDefault;
    saveButton.textContent = isDefault ? '默认展示 ✓' : '设为默认展示';
  }
}
function openSkins() {
  const selectedHero = hero();
  if (!selectedHero) return;
  const modal = openModal(selectedHero.name + ' · 特别款式');
  const grid = el('div', 'skin-options'); grid.id = 'skin-options'; grid.dataset.heroId = selectedHero.id;
  for (const selectedSkin of selectedHero.skins) {
    const item = el('article', 'skin-option'); item.dataset.skinId = selectedSkin.id;
    const preview = el('button', 'skin-preview'); preview.dataset.skin = selectedSkin.id;
    preview.append(makeImage(selectedSkin.thumb || selectedSkin.portrait, '', '', true), el('strong', '', selectedSkin.name), el('span', 'skin-preview-status', '查看款式'));
    preview.onclick = () => { ui.dialog.close(); void selectSkin(selectedSkin.id); };
    const saveButton = el('button', 'save-skin-default', '设为默认展示'); saveButton.dataset.defaultSkin = selectedSkin.id;
    saveButton.onclick = () => { ui.dialog.close(); setDefaultSkin(selectedHero.id, selectedSkin.id); };
    item.append(preview, saveButton); grid.append(item);
  }
  modal.append(grid); updateSkinOptionStates();
}

function skillLevels(skill) {
  return (Array.isArray(skill.levels) ? skill.levels : []).filter(entry => Number.isFinite(Number(entry.level))).map(entry => ({ ...entry, level: Number(entry.level) })).sort((a, b) => a.level - b.level);
}
function renderSkills() {
  const skills = hero()?.skills || [];
  const colors = ['#65b957', '#d54b58', '#29abc4', '#656dce'];
  $('.skill-section').hidden = !skills.length;
  $('#skills-level-label').textContent = skills.every(skill => skillLevels(skill).some(entry => entry.level === 3)) ? 'Lv.3' : '';
  $('#skills').replaceChildren(...skills.map((skill, index) => {
    const levels = skillLevels(skill);
    const defaultLevel = levels.some(entry => entry.level === 3) ? 3 : levels.at(-1)?.level;
    const button = el('button', 'skill'); button.dataset.skill = String(skill.id);
    button.setAttribute('aria-label', plain(skill.name) + ' · ' + plain(skill.category) + (defaultLevel ? ' · 等级 ' + defaultLevel : ''));
    const art = el('span', 'skill-art');
    const badge = el('span', 'skill-type', skill.badge || ''); badge.style.setProperty('--type', colors[index % colors.length]);
    art.append(makeImage(skill.icon, '', ''), badge);
    if (defaultLevel) art.append(el('small', '', 'Lv.' + defaultLevel));
    button.append(art, el('span', 'skill-name', skill.name));
    button.onclick = () => openSkill(skill); return button;
  }));
}
function openSkill(skill) {
  const modal = openModal(skill.name), header = el('div', 'skill-dialog-header');
  header.append(makeImage(skill.icon, '', ''), el('p', '', skill.category));
  const tabs = el('div', 'level-tabs'); tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', '技能等级');
  const description = el('p', 'skill-description'); description.id = 'skill-description'; description.setAttribute('role', 'tabpanel');
  const upgrade = el('div', 'skill-upgrade'), available = skillLevels(skill);
  function chooseLevel(level) {
    const entry = available.find(item => item.level === level) || available.at(-1);
    if (!entry) { description.textContent = plain(skill.description || '技能说明暂未收录。'); upgrade.hidden = true; return; }
    for (const button of tabs.children) {
      const active = Number(button.dataset.level) === entry.level;
      button.classList.toggle('active', active); button.setAttribute('aria-selected', String(active)); button.tabIndex = active ? 0 : -1;
      if (active) description.setAttribute('aria-labelledby', button.id);
    }
    description.textContent = plain(entry.description); upgrade.replaceChildren();
    const text = plain(entry.upgrade);
    upgrade.hidden = entry.level < 2 || !text || text === '空白';
    if (!upgrade.hidden) upgrade.append(el('strong', '', 'Lv.' + entry.level + ' 提升'), el('p', '', text));
  }
  for (const entry of available) {
    const button = el('button', '', 'Lv.' + entry.level); button.dataset.level = String(entry.level); button.id = 'skill-level-' + entry.level;
    button.setAttribute('role', 'tab'); button.setAttribute('aria-controls', 'skill-description');
    button.onclick = () => chooseLevel(entry.level); tabs.append(button);
  }
  tabs.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const buttons = [...tabs.children], current = buttons.indexOf(document.activeElement);
    if (current < 0) return;
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
    event.preventDefault(); chooseLevel(Number(buttons[next].dataset.level)); buttons[next].focus();
  });
  modal.append(header, tabs, description, upgrade);
  for (const term of skill.terms || []) {
    const block = el('div', 'skill-term');
    block.append(el('strong', '', '【' + plain(term.name) + '】'), el('p', '', term.description)); modal.append(block);
  }
  chooseLevel(3);
}

async function getVoices(heroId, force = false) {
  const selectedHero = heroById.get(String(heroId));
  const url = localAsset(selectedHero?.audioManifest, ['json']);
  if (!force && voiceCache.has(url)) return voiceCache.get(url);
  if (!force && voiceRequests.has(url)) return voiceRequests.get(url);
  const promise = fetch(url).then(async response => {
    if (!response.ok) throw new Error('语音目录暂未载入。');
    const data = await response.json();
    if (!Array.isArray(data.languages) || !Array.isArray(data.tracks)) throw new Error('语音目录格式无效。');
    const result = { ...data, manifestUrl: url };
    voiceCache.set(url, result); return result;
  }).finally(() => { if (voiceRequests.get(url) === promise) voiceRequests.delete(url); });
  voiceRequests.set(url, promise); return promise;
}
async function openVoices(force = false) {
  const selectedHero = hero();
  if (!selectedHero) return;
  const modal = openModal(selectedHero.name + ' · 语音播放');
  const pending = el('p', 'modal-intro', '正在载入语音目录…'); modal.append(pending);
  let data;
  try { data = await getVoices(selectedHero.id, force); }
  catch {
    if (!pending.isConnected || state.heroId !== selectedHero.id) return;
    pending.textContent = '语音目录暂未载入，请重试。';
    const retry = el('button', 'primary-button', '重新载入'); retry.onclick = () => openVoices(true); modal.append(retry); return;
  }
  if (!pending.isConnected || !ui.dialog.open || state.heroId !== selectedHero.id) return;
  pending.remove();
  const language = el('select', ''), tracks = el('select', ''); language.id = 'voice-language'; tracks.id = 'voice-track';
  const languageLabel = el('label', 'modal-field', '语言'), trackLabel = el('label', 'modal-field', '语音');
  languageLabel.htmlFor = language.id; trackLabel.htmlFor = tracks.id;
  const audio = el('audio', ''); audio.id = 'voice-audio'; audio.controls = true; audio.preload = 'metadata';
  const credit = el('p', 'voice-dialog-credit'), error = el('p', 'media-error'); error.id = 'voice-error'; error.hidden = true;
  const retry = el('button', 'text-button', '重新载入这段语音'); retry.hidden = true;
  const availableLanguages = data.languages.filter(entry => data.tracks.some(track => String(track.language) === String(entry.id)));
  if (!availableLanguages.length) { modal.append(el('p', 'modal-intro', '此手办暂无可用的语音资源。')); return; }
  for (const entry of availableLanguages) language.add(new Option(plain(entry.label), String(entry.id)));
  function chooseTrack() {
    audio.pause(); error.hidden = true; retry.hidden = true;
    const track = data.tracks.find(entry => String(entry.id) === tracks.value && String(entry.language) === language.value);
    try {
      audio.src = localAsset(track?.url, ['mp3', 'ogg', 'wav'], data.manifestUrl); audio.load();
    } catch {
      audio.removeAttribute('src'); audio.load(); error.textContent = '该语音资源暂不可用。'; error.hidden = false;
    }
  }
  function chooseLanguage() {
    const available = data.tracks.filter(entry => String(entry.language) === language.value);
    tracks.replaceChildren(...available.map(track => new Option(plain(track.title) + (Number.isFinite(Number(track.duration)) ? ' · ' + Number(track.duration).toFixed(1) + ' 秒' : ''), String(track.id))));
    const preferred = available.find(track => track.category === 'home'); if (preferred) tracks.value = String(preferred.id);
    const entry = data.languages.find(item => String(item.id) === language.value);
    credit.textContent = entry?.cv ? 'CV · ' + plain(entry.cv) : '';
    chooseTrack();
  }
  audio.onerror = () => { error.textContent = '这段语音暂未载入，可以重试或选择其他语音。'; error.hidden = false; retry.hidden = false; };
  retry.onclick = chooseTrack; language.onchange = chooseLanguage; tracks.onchange = chooseTrack;
  modal.append(languageLabel, language, trackLabel, tracks, credit, audio, error, retry);
  chooseLanguage();
}

$('#collection-tab').onclick = () => $('#back').click();
$('#detail-tab').onclick = () => { if (state.heroId) setCollection(false); };
$('#back').onclick = () => { if (history.state?.figure) history.back(); else setCollection(true); };
$('#image-mode').onclick = () => { void setMode(state.mode === '3d' ? '2d' : '3d'); };
$('#skins-button').onclick = openSkins;
$('#set-default-skin').onclick = () => setDefaultSkin();
$('#voice-button').onclick = () => { void openVoices(); };
$('#expand-story').onclick = () => {
  const expanded = $('#expand-story').getAttribute('aria-expanded') !== 'true';
  $('#expand-story').setAttribute('aria-expanded', String(expanded));
  $('#expand-story').textContent = expanded ? '收起故事 −' : '展开故事 ＋';
  $('#skin-story').classList.toggle('collapsed', !expanded);
};
$('#auto-rotate').onclick = () => {
  const active = $('#auto-rotate').getAttribute('aria-pressed') !== 'true';
  viewer?.setAutoRotate(active); $('#auto-rotate').setAttribute('aria-pressed', String(active));
};
$('#reset-view').onclick = () => viewer?.reset();
$('#restore-pose').onclick = () => { ++actionIntent; void loadModel('showcase'); };
ui.play.onclick = () => { void playSelectedAction(); };
ui.animation.onchange = () => {
  ++actionIntent; state.selectedAction = ui.animation.value; viewer?.pause();
  if (sameModel()) { const clip = findClip(state.selectedAction); if (clip) viewer.preparePose(clip.name, 'end'); }
  updateControls();
};
ui.retry.onclick = () => {
  if (!catalog) void initialize();
  else if (state.requestedHeroId && state.requestedHeroId !== state.heroId) void selectHero(state.requestedHeroId, { push: false });
  else if (state.mode === '2d') void loadPortrait();
  else void loadModel(state.lastRequestedKind);
};
$('#fullscreen').onclick = async () => {
  try { if (document.fullscreenElement) await document.exitFullscreen(); else await ui.game.requestFullscreen(); }
  catch { toast('当前浏览器不支持全屏，请使用窗口缩放。'); }
};
$('#about').onclick = () => {
  const modal = openModal('手办图鉴');
  modal.append(el('p', '', '浏览英雄、切换原画与 3D 手办，查看技能和角色语音。职业与品牌按游戏资料分类，每位英雄只保留一张卡片。'));
  modal.append(el('p', '', '特别款式可以预览，也可以设为默认展示。设为默认后，当前展示立即切换；款式按英雄保存在此浏览器中，卡片与下次进入使用同一款式。'));
  modal.append(el('p', '', '动作和语音需点击播放。部分游戏专用材质和粒子效果仍与游戏内有差异。'));
};
window.figureViewer = null;
window.figureLoaded = null;
window.figureApp = {
  getState: () => ({
    ...state, defaultSkinId: defaultSkinForHero(hero())?.id || null,
    heroCount: catalog?.heroes.length || 0, filteredHeroIds: filteredHeroes().map(entry => entry.id),
    playback: viewer?.getPlaybackState() || null,
  }),
  selectHero, selectSkin, setDefaultSkin,
  getDefaultSkinId: heroId => defaultSkinForHero(heroById.get(String(heroId)))?.id || null,
  setMode, setCollection, setFilters, playSelectedAction,
  showSkins: openSkins, showVoices: openVoices, storageKey: DEFAULTS_KEY,
};
async function initialize() {
  ui.count.textContent = '正在载入…';
  try {
    const response = await fetch(INDEX_URL);
    if (!response.ok) throw new Error('图鉴资料暂未载入。');
    catalog = normalizeCatalog(await response.json());
    heroById.clear(); for (const entry of catalog.heroes) heroById.set(entry.id, entry);
    buildFilters(); renderCollection(); setCollection(true);
    const match = location.hash.match(/^#figure-(.+)$/);
    if (match && heroById.has(decodeURIComponent(match[1]))) {
      history.replaceState({ figure: decodeURIComponent(match[1]) }, '', location.hash);
      await selectHero(decodeURIComponent(match[1]), { push: false });
    }
  } catch (error) {
    ui.count.textContent = plain(error.message);
  }
}
await initialize();
