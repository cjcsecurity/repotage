// The film. Edit freely; re-run with: demoforge build <project>
import path from "node:path";
import { fileURLToPath } from "node:url";
const { kit, r2 } = await import(process.env.DEMOFORGE_HOME + "/compose/kit.mjs");
const PROJECT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const K = kit({ project: PROJECT, theme: { accent: "#f5a524" } });

// Scene slots (film seconds) and where each narration line starts. The voice is the clock.
K.plan({ scenes: { intro: [0, 6] }, voAt: { s01: 0.4 }, total: 6 });

K.scene("intro", `#root{background:var(--bg)} #t{position:absolute;left:0;right:0;top:420px;text-align:center;font:700 120px var(--sans)}`,
  `<div id="t">Your film</div>`,
  `tl.fromTo("#t",{opacity:0,filter:"blur(8px)"},{opacity:1,filter:"blur(0px)",duration:0.2,ease:"power4.out"},0.3);`);

K.captions();
K.write({ title: "film" });
