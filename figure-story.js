(() => {
  "use strict";

  const escapeHtml = (value) =>
    String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");

  const companionLines = [
    "你不用每次都那么懂事，在我这里，累了就说累了；我会先抱抱你，再陪你慢慢好起来。",
    "我不太会说漂亮话，但只要你回头，我就会在原来的地方等你。",
    "你不需要一直发光。哪怕今天只想安静待着，在我眼里也一样好看。",
    "那些不想解释的疲惫都可以交给我，今天的你可以慢一点，也可以脆弱一点。",
    "你一笑，我就觉得这一天没有白过；要是你愿意多笑一下，我可以开心很久。",
    "世界太吵的时候就靠近我一点，我想替你留一小块谁也打扰不了的安静。",
    "花会谢，季节会走远，但我对你的喜欢不会过季，每一天都算新的春天。",
    "我有很多话想告诉你，最后都变成同一句：我舍不得你难过。",
    "早上醒来不用急着成为谁期待的样子，你只做你自己，我就很喜欢。",
    "你要是缺一点勇敢，就从我这里拿；不够的话，我把明天的也先借给你。",
    "我不一定能替你挡住所有风雨，但你累的时候，我会一直把灯为你开着。",
    "走慢一点没关系，你想去的地方不会消失，我也不会催你。",
    "如果幸运真的有模样，我想大概就是你抬起眼睛，刚好看见我还在喜欢你。",
    "你可以犹豫，也可以重新开始；不管选哪条路，我都想陪你走一段。",
    "等你终于学会好好爱自己的那一天，我想送你一整个不会凋谢的春天。",
    "下雨的时候别怕，我会陪你等到天晴，再把第一片干净的蓝留给你。",
    "我不会替你决定去哪里，但只要是你认真选的方向，我都会站在你这边。",
    "你不必一直往前冲，想停下来就停下来，我会等你的心重新跟上脚步。",
    "如果我是一阵风，我不想把你带走，只想把你心里的沉重吹轻一点。",
    "时间可以走得很远，但我想把每一次认真陪你的时刻，都留得久一点。",
    "你独自走过黑暗的时候，别忘了我知道你的名字，也一直朝你的方向亮着。",
    "你不用讨好全世界，光是做你自己，就已经可爱得让我没办法移开眼睛。",
    "阳光偶尔会迟到，我不会；只要你需要，我就想第一时间来到你身边。",
    "风再大也没关系，你往我这里站，我会把最安稳的位置留给你。",
    "别再怀疑自己了，你已经做得很好；就算你不相信，我也会替你相信很久。",
    "不管今天过得怎么样，明天醒来，你依然值得被我认真喜欢。",
    "我不催你忘掉过去，你舍不得的那些回忆，我陪你一件一件放好。",
    "认识你没有什么盛大的开场，却成了我想起来就会庆幸很久的事情。",
    "你下次推开门的时候记得慢一点，我想把偷偷准备的好运全塞到你怀里。",
    "梅雨季可以很长，但你别担心，我会陪你等到空气重新变得明亮。",
    "如果你偶尔忘了自己有多值得被珍惜，就看着我；我会一遍一遍说给你听。",
    "我可以把所有锋芒留在外面，只想让你每次靠近我时，都觉得放心。",
    "就算以前受过伤，我还是愿意向你再走一步，因为你值得我认真勇敢一次。",
    "你像旧电影里最舍不得剪掉的那一帧，我看了很多遍，还是觉得心动。",
    "你沉默的时候不用急着解释，我会安静陪着你，等你愿意开口。",
    "我们的故事不用赶着写完，你有空就来，我陪你把后面的路慢慢走完。",
    "就算生活偶尔荒芜也别怕，你在我心里一直有重新生长的春天。",
    "你不用假装无所畏惧，累了就站到我身后；这一次，换我让你安心。",
    "你知道你和星星有什么区别吗？星星在天上，而你一直在我心上。",
    "我可以把热烈留给全世界，但最难得的温柔，我只想认真留给你。",
    "无论你离我多远，只要你愿意回来，我就想把这里变成你可以停靠的家。",
    "你像我舍不得结束的夏天，只要想到你，连最普通的日子都有了温度。",
    "我认真看你的每一眼都不是偶然，因为和你有关的事，我从来不想敷衍。",
    "我见过很多聪明的答案，可最后还是觉得，你愿意真心看着我，就是最好的答案。",
    "长大可以带走很多东西，但你放心，我会陪你守住那一点不肯变硬的柔软。"
  ];

  const renderCharacters = (items) => {
    const rail = document.getElementById("figureCharacterRail");
    if (!rail) return;

    rail.innerHTML = items
      .map((item, index) => {
        return `
          <article class="figure-curation-card" data-figure-reveal>
            <div class="figure-curation-art">
              <span class="figure-curation-orbit" aria-hidden="true"></span>
              <img src="${escapeHtml(item.asset)}" alt="${escapeHtml(item.name)}手办" loading="lazy" decoding="async">
              <span class="figure-curation-plinth" aria-hidden="true"></span>
            </div>
            <div class="figure-curation-card-copy">
              <h3>${escapeHtml(item.name)}</h3>
              <p>${escapeHtml(companionLines[index] || companionLines[index % companionLines.length])}</p>
            </div>
          </article>
        `;
      })
      .join("");

    const stat = document.getElementById("statFigureCharacters");
    if (stat) stat.textContent = String(items.length);

    const cards = Array.from(rail.querySelectorAll("[data-figure-reveal]"));
    if (!("IntersectionObserver" in window) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      cards.forEach((card) => card.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.16, rootMargin: "0px 0px -7% 0px" }
    );
    cards.forEach((card) => observer.observe(card));
  };

  const init = async () => {
    try {
      const response = await fetch("data/figure-story-character-roster.json", { cache: "no-store" });
      if (!response.ok) throw new Error("Character roster unavailable");
      const roster = await response.json();
      renderCharacters(Array.isArray(roster.items) ? roster.items : []);
    } catch (error) {
      console.warn("Companion gallery unavailable", error);
    }
  };

  init();
})();
