/* 雪宝的花园大厅 · 实验页（xuebao-lab.html）：直接拖时间、切天气看光照。场景本体在 hall-scene.js。 */
import { createHall } from "./hall-scene.js";

const host = document.getElementById("lab");
const loading = document.getElementById("loading");
const hall = createHall(host, {
  onProgress: (p) => { if (loading) loading.textContent = `大厅布置中…… ${Math.round(p * 100)}%`; },
  onLoad: () => { if (loading) { loading.classList.add("done"); setTimeout(() => loading.remove(), 900); } }
});
hall.char.setTexture("xuebao-assets/xb-a-idle.webp");

const qs = new URLSearchParams(location.search);
const state = { hour: 10, weather: "sunny", lamp: false, auto: true };
if (qs.has("h")) { state.auto = false; state.hour = Number(qs.get("h")); }
if (qs.has("w")) { state.auto = false; state.weather = qs.get("w"); if (state.weather === "night" && !qs.has("h")) state.hour = 22; }
function nyHour() { const p = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(new Date()); return Number(p.find((x) => x.type === "hour").value) + Number(p.find((x) => x.type === "minute").value) / 60; }

addEventListener("pointermove", (e) => { if (e.pointerType !== "mouse") return; hall.view.mx = (e.clientX / innerWidth - 0.5) * 2; hall.view.my = (e.clientY / innerHeight - 0.5) * 2; });
hall.renderer.domElement.addEventListener("click", (e) => {
  const r = hall.renderer.domElement.getBoundingClientRect(), nx = (e.clientX - r.left) / r.width, ny = (e.clientY - r.top) / r.height;
  if (hall.hitChar(nx, ny)) { hall.char.hop(); return; }
  const p = hall.floorAt(nx, ny); if (p) hall.char.goTo({ x: Math.max(-1.05, Math.min(1.05, p.x)), z: Math.max(-1.7, Math.min(-0.5, p.z)) });
});

const $ = (id) => document.getElementById(id);
$("hour").addEventListener("input", (e) => { state.auto = false; state.hour = Number(e.target.value); if (state.weather === "night") state.weather = "sunny"; syncUI(); });
document.querySelectorAll("[data-w]").forEach((b) => b.addEventListener("click", () => { state.auto = false; state.weather = b.dataset.w; if (b.dataset.w === "night") state.hour = 22; else if (state.hour < 6 || state.hour >= 19.6) state.hour = 10; syncUI(); }));
$("lampBtn").addEventListener("click", () => { state.lamp = !state.lamp; syncUI(); });
$("autoBtn").addEventListener("click", () => { state.auto = true; syncUI(); });
function syncUI() {
  $("hour").value = Math.min(19.4, Math.max(6, state.hour)); $("hourText").textContent = `${String(Math.floor(state.hour)).padStart(2, "0")}:${String(Math.floor((state.hour % 1) * 60)).padStart(2, "0")}`;
  document.querySelectorAll("[data-w]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.w === state.weather)));
  $("lampBtn").setAttribute("aria-pressed", String(state.lamp)); $("autoBtn").setAttribute("aria-pressed", String(state.auto));
}

function resize() { hall.resize(host.clientWidth, host.clientHeight); }
addEventListener("resize", resize); resize();
let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (state.auto) { state.hour = nyHour(); state.weather = state.hour < 6 || state.hour >= 19.6 ? "night" : "sunny"; syncUI(); }
  const night = state.weather === "night" || state.hour < 6 || state.hour >= 19.6;
  hall.update(dt, now / 1000, { hour: state.hour, weather: night ? "night" : state.weather, lamp: state.lamp || night || state.weather === "rainy" });
}
syncUI(); requestAnimationFrame(loop);
