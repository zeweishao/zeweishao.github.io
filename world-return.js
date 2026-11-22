/* 分页面左下角的“回到小世界”：回到 3D 雪宝游记（大厅＋花园）。从小世界进来时会轻轻跳一下提醒。 */
(function () {
  if (document.getElementById("worldReturn")) return;
  var a = document.createElement("a");
  a.id = "worldReturn"; a.href = "xuebao.html"; a.setAttribute("aria-label", "回到小世界");
  a.innerHTML = '<span aria-hidden="true">✿</span><b>回到小世界</b>';
  var css = document.createElement("style");
  css.textContent = "#worldReturn{position:fixed;left:max(14px,env(safe-area-inset-left));bottom:calc(16px + env(safe-area-inset-bottom));z-index:2147483000;display:inline-flex;align-items:center;gap:7px;padding:9px 15px 9px 12px;border-radius:999px;background:rgba(255,250,246,.9);border:1.5px solid #f3b7c4;box-shadow:0 6px 18px rgba(138,75,90,.18);color:#8a4b5a;font:600 14px/1 'PingFang SC','Noto Sans SC',sans-serif;text-decoration:none;letter-spacing:.04em;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);transition:transform .2s,box-shadow .2s}"
    + "#worldReturn span{color:#e8789a;font-size:16px}#worldReturn:hover{transform:translateY(-2px);box-shadow:0 10px 22px rgba(138,75,90,.24)}"
    + "#worldReturn.hello{animation:wrHello 1.4s ease 2}@keyframes wrHello{30%{transform:translateY(-6px) scale(1.04)}60%{transform:none}}"
    + "@media print{#worldReturn{display:none}}";
  document.head.appendChild(css);
  var put = function () { document.body.appendChild(a); if (/xuebao\.html/.test(document.referrer)) a.classList.add("hello"); };
  if (document.body) put(); else document.addEventListener("DOMContentLoaded", put);
})();
