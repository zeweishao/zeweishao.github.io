// 打包雪宝游记的 2.5D 场景到 ../xuebao-3d.js（复用 figures-src 里的 three 和 esbuild）
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
const here = path.dirname(fileURLToPath(import.meta.url));
const mods = path.join(here, "../figures-src/node_modules");
const { build } = createRequire(path.join(mods, "x.js"))("esbuild");
await build({
  entryPoints: [path.join(here, "scene3d.js")],
  outfile: path.join(here, "../xuebao-3d.js"),
  bundle: true, format: "esm", minify: true, target: "es2020", nodePaths: [mods], legalComments: "eof"
});
await build({
  entryPoints: [path.join(here, "lab.js")],
  outfile: path.join(here, "../xuebao-lab.js"),
  bundle: true, format: "esm", minify: true, target: "es2020", nodePaths: [mods], legalComments: "eof"
});
await build({
  entryPoints: [path.join(here, "hall.js")],
  outfile: path.join(here, "../xuebao-hall.js"),
  bundle: true, format: "esm", minify: true, target: "es2020", nodePaths: [mods], legalComments: "eof"
});
console.log("built xuebao-3d.js, xuebao-lab.js, xuebao-hall.js");
