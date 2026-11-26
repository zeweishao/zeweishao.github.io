// 生成雪宝游记的旅伴名单 xuebao-chars.js（浏览器和 api/xuebao.js 共用）
// 鸣潮：二次元素材库/鸣潮素材库（漂泊者·男 是泽泽本人、弗洛洛就是雪宝本人，都不当旅伴），立绘缩到 400 宽存成 xuebao-assets/ch-<id>.webp
// 高能手办团：figures-data/index.json 的 137 位，头像用手办屋同一份 CDN 缩略图，台词当作偶遇时说的话
// 用法：node scripts/xuebao-mkchars.mjs [--thumbs]
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LIB = "/Users/szw/szw工作台/二次元素材库/鸣潮素材库";
const FIG_BASE = "https://assets.isnow.life/figures/v20261003/";

// 原有 12 位保留原来的 id 和台词（存档里的 meets 用的是这些 id）；新加的 25 位写在后面
const WW = [
  ["jinhsi", "今汐", "在{place}遇到了今汐，她帮我挑了一盏最亮的灯，说要照着回家的路。"],
  ["changli", "长离", "在{place}遇到了长离，她和我下了一盘棋，我输了，可是她夸我下得很认真。"],
  ["youhu", "釉瑚", "在{place}遇到了釉瑚，她教我怎么给杯子上釉，说颜色要等烧出来才知道。"],
  ["feixue", "绯雪", "在{place}遇到了绯雪，我们一起堆了一个小雪人，它长得有点像你。"],
  ["shorekeeper", "守岸人", "在{place}遇到了守岸人，我们坐在岸边看了很久的星星，她说想念的人会在同一片天空下。"],
  ["cantarella", "坎特蕾拉", "在{place}遇到了坎特蕾拉，她给我讲了海底的故事，还送了我一颗亮晶晶的小珠子。"],
  ["lupa", "露帕", "在{place}遇到了露帕，她骑马比我快好多，还回头等我。"],
  ["lockelock", "洛可可", "在{place}遇到了洛可可，她给我讲了一个童话故事，结局是两个人终于见面了。"],
  ["suisui", "穗穗", "在{place}遇到了穗穗，她分给我一大把刚晒好的稻谷，说这是秋天的味道。"],
  ["camellya", "椿", "在{place}遇到了椿，她送我一朵花，说要带给最重要的人。"],
  ["phoebe", "菲比", "在{place}遇到了菲比，她为我们俩祈了福，说你醒来的时候会是好天气。"],
  ["cartethyia", "卡提希娅", "在{place}遇到了卡提希娅，她陪我走了一段路，还帮我拎了背包。"],
  ["qiuyuan", "仇远", "在{place}遇到了仇远，他泡了一壶很苦的茶，说苦完了回甘才是最甜的。"],
  ["chixia", "千咲", "在{place}遇到了千咲，她拉着我拍了好多照片，说要寄一张给你。"],
  ["buling", "卜灵", "在{place}遇到了卜灵，她给我算了一卦，说下一次见面会比想象中来得早。"],
  ["calcharo", "卡卡罗", "在{place}遇到了卡卡罗，他看起来凶凶的，其实偷偷把伞让给了我。"],
  ["yinlin", "吟霖", "在{place}遇到了吟霖，她用丝线给我编了一个小挂件，说线头要留给想念的人。"],
  ["galbrena", "嘉贝莉娜", "在{place}遇到了嘉贝莉娜，她请我喝了一杯热可可，杯子上画着一颗心。"],
  ["xiakong", "夏空", "在{place}遇到了夏空，我们一起躺在草地上数云，有一朵像你。"],
  ["augusta", "奥古斯塔", "在{place}遇到了奥古斯塔，她说勇敢不是不害怕，是害怕的时候还往前走。"],
  ["iuno", "尤诺", "在{place}遇到了尤诺，她指给我看月亮，说今晚的月亮是给我们俩的。"],
  ["xin", "心", "在{place}遇到了心，她什么都没说，只是陪我安安静静地看了一会儿日落。"],
  ["luosela", "洛瑟菈", "在{place}遇到了洛瑟菈，她送我一片压干的花瓣，说这是今年第一朵花。"],
  ["qingxiao", "清宵", "在{place}遇到了清宵，她在月下吹了一支笛子，风都停下来听了。"],
  ["roverf", "漂泊者", "在{place}遇到了漂泊者，她也在找一个人，我们约好了谁先找到就告诉对方。"],
  ["aemeath", "爱弥斯", "在{place}遇到了爱弥斯，她教我把星星的名字一个一个念出来。"],
  ["carlotta", "珂莱塔", "在{place}遇到了珂莱塔，她优雅地递给我一张手帕，上面绣着一朵小花。"],
  ["lynae", "琳奈", "在{place}遇到了琳奈，她给我画了一张小像，说要把今天的笑留下来。"],
  ["yangyang", "秧秧", "在{place}遇到了秧秧，她吹了一段口哨，好多小鸟都飞过来了。"],
  ["mornye", "莫宁", "在{place}遇到了莫宁，她说早安的时候声音软软的，像你刚睡醒。"],
  ["sigrika", "西格莉卡", "在{place}遇到了西格莉卡，她带我去看了一片会发光的湖。"],
  ["zani", "赞妮", "在{place}遇到了赞妮，她加完班还请我吃了一顿夜宵，说努力的人要吃饱。"],
  ["dania", "达妮娅", "在{place}遇到了达妮娅，我们比赛谁跑得快，她故意让了我一步。"],
  ["suoming", "锁暝", "在{place}遇到了锁暝，他把一盏灯笼借给我，说夜路要有光。"],
  ["luhesi", "陆·赫斯", "在{place}遇到了陆·赫斯，他讲了好多旅途上的事，说最好的地方是有人等你的地方。"],
  ["lucy", "露西", "在{place}遇到了露西，她送我一颗糖，说甜的东西要分给喜欢的人。"]
];
// 鸣潮素材库里的文件夹名（显示名可能和文件夹名不一样）
const DIR = { yangyang: "秧秧·玄翎", roverf: "漂泊者（女）" };

const ww = WW.map(([id, name, line, rare]) => ({ id, name, from: "ww", line, ...(rare ? { rare: true } : {}) }));
// 缩略图：原有 12 位已经有 ch-<id>.webp；新加的从素材库立绘生成（这台机器的 ffmpeg 没有 webp 编码器时，用 Blender 转，见项目记录）
if (process.argv.includes("--thumbs")) {
  for (const c of ww) {
    const out = path.join(ROOT, "xuebao-assets", `ch-${c.id}.webp`);
    if (fs.existsSync(out)) continue;
    const src = path.join(LIB, DIR[c.id] || c.name, "01_正面全身_透明_V2.png");
    if (!fs.existsSync(src)) { console.warn("缺立绘", c.name); continue; }
    execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", src, "-vf", "scale=400:-2", "-c:v", "libwebp", "-quality", "82", out]);
    console.log("thumb", c.id);
  }
}
const idx = JSON.parse(fs.readFileSync(path.join(ROOT, "figures-data/index.json"), "utf8"));
const fig = idx.heroes.map((h) => {
  const thumb = (h.skins.find((s) => s.id === h.defaultSkinId) || h.skins[0])?.thumb;
  const say = String(h.tagline || "").replace(/\s+/g, " ").trim();
  return { id: "fig-" + h.id, name: h.name, from: "fig", img: thumb ? FIG_BASE + thumb : "", line: say ? `在{place}遇到了${h.name}，${h.name}对我说：「${say}」` : `在{place}遇到了${h.name}，我们一起走了好长一段路。` };
});
const all = [...ww, ...fig];
const js = `/* 雪宝游记 · 旅伴名单（scripts/xuebao-mkchars.mjs 生成，别手改）
 * from: ww 鸣潮 / fig 高能手办团。img 为空时用 xuebao-assets/ch-<id>.webp。rare：更难遇到。
 */
(function (root) {
  const CHARS = ${JSON.stringify(all, null, 0).replace(/\},\{/g, "},\n    {")};
  if (typeof module === "object" && module.exports) module.exports = CHARS;
  else root.XUEBAO_CHARS = CHARS;
})(typeof window !== "undefined" ? window : globalThis);
`;
fs.writeFileSync(path.join(ROOT, "xuebao-chars.js"), js);
console.log("chars", ww.length, "+", fig.length);
