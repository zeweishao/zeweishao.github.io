// 团子之家（手办页）的小锁：答对「天下第一大美女是谁」才把页面变清楚。答对后在这台设备上记住。
(() => {
  const KEY = "figure_lock_open_v1";
  const ANSWER = "白雪";
  const lock = document.getElementById("figureLock");
  if (!lock) return;
  const root = document.documentElement;
  let opened = false;
  try { opened = localStorage.getItem(KEY) === "1"; } catch {}
  if (opened) {
    root.classList.remove("figure-locked");
    lock.remove();
    return;
  }

  const card = lock.querySelector(".lock-card");
  const form = lock.querySelector(".lock-form");
  const input = lock.querySelector(".lock-input");
  const error = lock.querySelector(".lock-error");
  const main = document.querySelector(".figures-page > .j-wrap");
  const misses = ["不对哦，再想想～", "还不对，她就在你身边呀", "提示：名字里有一场雪"];
  let tries = 0;

  main?.setAttribute("aria-hidden", "true");
  main?.setAttribute("inert", "");
  lock.hidden = false;
  window.setTimeout(() => input.focus({ preventScroll: true }), 350);

  const normalize = (value) => String(value || "").normalize("NFKC").replace(/[\s，。！!？?~～、.]/g, "");

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (normalize(input.value) !== ANSWER) {
      error.textContent = misses[Math.min(tries, misses.length - 1)];
      tries += 1;
      card.classList.remove("is-wrong");
      void card.offsetWidth;
      card.classList.add("is-wrong");
      input.select();
      return;
    }
    try { localStorage.setItem(KEY, "1"); } catch {}
    error.textContent = "";
    input.blur();
    card.classList.add("is-right");
    main?.removeAttribute("aria-hidden");
    main?.removeAttribute("inert");
    window.setTimeout(() => {
      root.classList.remove("figure-locked");
      lock.classList.add("is-leaving");
    }, 650);
    window.setTimeout(() => lock.remove(), 1200);
  });

  input.addEventListener("input", () => { error.textContent = ""; });
})();
