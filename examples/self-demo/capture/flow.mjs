// Films the review page (repotage report) of this very project. Run: repotage capture run examples/self-demo capture/flow.mjs
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
const { open } = await import(process.env.REPOTAGE_HOME + "/capture/recorder.mjs");

// tiny static server for report.html and the audio it plays
const root = fs.realpathSync(process.cwd());
const types = { ".html": "text/html", ".wav": "audio/wav", ".json": "application/json" };
const srv = http.createServer((q, r) => {
  // Resolve symlinks too, then serve only files inside root; anything else (bad encoding, missing, outside) is a 404.
  let f;
  try { f = fs.realpathSync(path.resolve(root, "." + decodeURIComponent(q.url.split("?")[0]))); } catch { r.writeHead(404); return r.end(); }
  if (!f.startsWith(root + path.sep) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { "Content-Type": types[path.extname(f)] || "application/octet-stream" });
  fs.createReadStream(f).pipe(r);
}).listen(8931, "127.0.0.1");

const s = await open({ base: "http://127.0.0.1:8931", out: "capture/clips" });
const p = s.page;
await p.goto(s.base + "/report.html", { waitUntil: "networkidle" });
await p.evaluate(() => document.fonts.ready);
const clip = await s.clip("report");
clip.mark("scene", { name: "top" });
await s.measure(clip, "top", { narrator: ".card", prompt: ".prompt", auds: ".auds", header: "header" });
await s.sleep(1200);
// play the audition that became the voice
await s.click(clip, p.locator(".aud.ref .play"), { label: "Play voice" });
await s.sleep(2200);
await s.click(clip, p.locator(".aud.ref .play"), { label: "Stop voice", ms: 300 });
await s.sleep(400);
// scroll to the line about the voice and play it with word timing
clip.mark("scene", { name: "scroll-lines" });
const target = await p.locator("#line-s05").boundingBox();
const steps = 14;
for (let i = 0; i < steps; i++) { await p.mouse.wheel(0, (target.y - 150) / steps); await s.sleep(45); }
await s.sleep(700);
await s.click(clip, p.locator('#line-s05 .lh .play'), { label: "Play s05" });
await s.measure(clip, "line", { line: "#line-s05", strip: '#line-s05 .strip', takes: "#line-s05 .takes", text: "#line-s05 .ltext" });
clip.mark("scene", { name: "karaoke" });
await s.sleep(6900);
await s.hover(clip, p.locator("#line-s05 .take.on"));
clip.mark("scene", { name: "takes" });
await s.sleep(1600);
// down to the music and the film's timeline
clip.mark("scene", { name: "scroll-timeline" });
const tl = await p.locator(".tl").boundingBox();
for (let i = 0; i < steps; i++) { await p.mouse.wheel(0, (tl.y - 330) / steps); await s.sleep(45); }
await s.sleep(800);
await s.hover(clip, p.locator(".lane.mus > div"), 900);
await s.sleep(300);
await s.measure(clip, "timeline", { tl: ".tl", mus: ".mus", music: ".lane.mus" });
await s.sleep(2400);
await clip.stop();
await s.close();
srv.close();
