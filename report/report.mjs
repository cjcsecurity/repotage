// demoforge report <project>: one HTML page to review a film's raw material before rendering.
// Narrator prompt and auditions, every line with every take and its WhisperX scores,
// word-timed playback, music takes and the film's timeline. Writes <project>/report.html.
import fs from "node:fs";
import path from "node:path";

const proj = path.resolve(process.argv[2] || ".");
const rd = (p, d = null) => (fs.existsSync(path.join(proj, p)) ? JSON.parse(fs.readFileSync(path.join(proj, p), "utf8")) : d);
const S = rd("script.json", { lines: [] });
const D = rd("demo.json", {});
const scores = rd("audio/align/scores.json", {});
const vo = rd("audio/vo_words.json", {});
const plan = rd("video/build/plan.json");
const env = rd("audio/music/bed_envelope.json");
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// --- tiny WAV reader -> peak envelope (n buckets) ---
function peaks(file, n = 240) {
  const f = path.join(proj, file);
  if (!fs.existsSync(f)) return null;
  const b = fs.readFileSync(f);
  let o = 12, fmt, ch, bits, data, len;
  while (o < b.length - 8) {
    const id = b.toString("ascii", o, o + 4), sz = b.readUInt32LE(o + 4);
    if (id === "fmt ") { fmt = b.readUInt16LE(o + 8); ch = b.readUInt16LE(o + 10); bits = b.readUInt16LE(o + 22); if (fmt === 0xfffe) fmt = b.readUInt16LE(o + 32); }
    if (id === "data") { data = o + 8; len = Math.min(sz, b.length - data); break; }
    o += 8 + sz + (sz % 2);
  }
  if (!data) return null;
  const bps = bits / 8, frames = Math.floor(len / (bps * ch));
  const rd1 = (i) => { const p = data + i * bps * ch; if (fmt === 3) return b.readFloatLE(p); if (bits === 16) return b.readInt16LE(p) / 32768; if (bits === 24) return b.readIntLE(p, 3) / 8388608; return b.readInt32LE(p) / 2147483648; };
  const out = new Array(n).fill(0), step = Math.max(1, Math.floor(frames / n / 64));
  for (let i = 0; i < frames; i += step) { const k = Math.min(n - 1, Math.floor((i / frames) * n)); const v = Math.abs(rd1(i)); if (v > out[k]) out[k] = v; }
  const mx = Math.max(...out) || 1;
  return out.map((v) => Math.round((v / mx) * 100) / 100);
}
const wave = (pk, h = 44, cls = "wv") => {
  if (!pk) return "";
  const w = 1000, bw = w / pk.length;
  return `<svg class="${cls}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">${pk.map((v, i) => { const bh = Math.max(1.5, v * (h - 4)); return `<rect x="${(i * bw).toFixed(1)}" y="${((h - bh) / 2).toFixed(1)}" width="${(bw * 0.62).toFixed(2)}" height="${bh.toFixed(1)}" rx="1"/>`; }).join("")}</svg>`;
};
const fmt = (v, d = 2) => (v === undefined || v === null || Number.isNaN(v) ? "–" : Number(v).toFixed(d));

const auditions = Object.entries(scores).filter(([k]) => k.includes("audition_")).sort();
const takesOf = (id) => Object.entries(scores).filter(([k]) => new RegExp(`audio/vo/${id}(_t\\d+)?\\.wav$`).test(k)).sort();
const totalVo = Object.values(vo).reduce((a, v) => a + (v.duration || 0), 0);
const nTakes = Object.keys(scores).filter((k) => !k.includes("audition_")).length;
const musicTakes = fs.existsSync(path.join(proj, "audio/music")) ? fs.readdirSync(path.join(proj, "audio/music")).filter((f) => /^take\d+\.wav$/.test(f)).sort() : [];

const lineRows = S.lines.map((ln) => {
  const fin = vo[ln.id];
  const takes = takesOf(ln.id);
  const chosen = fin?.take;
  const dur = fin?.duration || 1;
  const words = (fin?.words || []).map((w, i) => `<span class="w${i % 2 ? " up" : ""}" data-s="${w.start}" data-e="${w.end}" style="left:${((w.start / dur) * 100).toFixed(2)}%;width:${(((w.end - w.start) / dur) * 100).toFixed(2)}%"><i>${esc(w.text)}</i></span>`).join("");
  const takeRows = takes.map(([k, v]) => `<li class="take${k === chosen ? " on" : ""}"><button class="play sm" data-src="${esc(k)}" aria-label="Play ${esc(k)}"></button><span class="mono">${esc(path.basename(k, ".wav"))}</span><span class="wer ${(v.cer ?? v.wer) > 0.08 ? "bad" : (v.cer ?? v.wer) > 0.03 ? "mid" : "good"}">CER ${fmt(v.cer ?? v.wer)}</span><span class="mono dim">${fmt(v.wps)} w/s · ${fmt(v.dur)} s</span>${k === chosen ? '<span class="pick">picked</span>' : ""}</li>`).join("");
  return `<section class="line" id="line-${ln.id}">
  <div class="lh"><span class="lid mono">${ln.id}</span><p class="ltext">${esc(ln.text)}</p>
    ${fin ? `<button class="play" data-src="video/${esc(fin.file)}" data-line="${ln.id}" data-dur="${fin.duration}" aria-label="Play ${ln.id}"></button>` : ""}</div>
  ${fin ? `<div class="strip" data-line="${ln.id}">${wave(peaks("video/" + fin.file, 200), 56)}<div class="words">${words}</div><div class="ph"></div></div>` : '<div class="strip empty">not finalized yet</div>'}
  <ul class="takes">${takeRows}</ul>
</section>`;
}).join("\n");

let timeline = "";
if (plan) {
  const T = plan.TOTAL, pct = (t) => ((t / T) * 100).toFixed(3);
  timeline = `<div class="tl">
  <div class="lane"><span>scenes</span><div>${Object.entries(plan.SC).map(([id, [s, d]]) => `<b style="left:${pct(s)}%;width:${pct(d)}%">${esc(id)}</b>`).join("")}</div></div>
  <div class="lane"><span>voice</span><div>${Object.entries(plan.VO_AT).map(([id, s]) => `<i style="left:${pct(s)}%;width:${pct(vo[id]?.duration || 0)}%"></i>`).join("")}</div></div>
  <div class="lane"><span>sound</span><div>${(plan.SFX || []).map((x) => `<u style="left:${pct(x.t)}%"></u>`).join("")}</div></div>
  <div class="lane mus"><span>music</span><div>${wave(peaks("video/assets/audio/music-bed.wav", 300), 40, "wv acc")}</div></div>
</div>`;
}

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(D.name || path.basename(proj))} · demoforge report</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
:root{--bg:#121110;--s1:#1a1917;--s2:#22201d;--line:#2d2a26;--text:#f3efe6;--muted:#a39d92;--faint:#6f6a62;--acc:#ff6a1a;--good:#5fc98f;--mid:#e3b341;--bad:#f0686a}
*{box-sizing:border-box}html,body{margin:0;background:var(--bg);color:var(--text);font:15px/1.5 Inter,system-ui,sans-serif}
.mono{font-family:"JetBrains Mono",ui-monospace,monospace}.dim{color:var(--muted)}
header{position:sticky;top:0;z-index:5;background:color-mix(in srgb,var(--bg) 92%,transparent);backdrop-filter:blur(8px);border-bottom:1px solid var(--line);padding:14px 32px;display:flex;align-items:center;gap:18px}
.brand{font:800 20px Inter;letter-spacing:-.03em}.brand em{font-style:normal;color:var(--acc)}
.proj{font:500 14px "JetBrains Mono";color:var(--muted)}
.stats{margin-left:auto;display:flex;gap:18px;font:500 13px "JetBrains Mono";color:var(--muted)}.stats b{color:var(--text);font-weight:500}
main{max-width:1180px;margin:0 auto;padding:26px 32px 80px}
h2{font:600 13px "JetBrains Mono";text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin:30px 0 12px}
.card{background:var(--s1);border:1px solid var(--line);border-radius:12px;padding:18px 20px}
.prompt{font:500 21px/1.45 Inter;letter-spacing:-.01em}.prompt:before{content:"“";color:var(--acc)}.prompt:after{content:"”";color:var(--acc)}
.style{margin-top:8px;color:var(--muted);font-size:14px}
.auds{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:14px}
.aud{background:var(--s2);border:1px solid var(--line);border-radius:10px;padding:10px 12px;display:flex;align-items:center;gap:10px;font:500 13px "JetBrains Mono"}
.aud.ref{border-color:color-mix(in srgb,var(--acc) 60%,transparent)}.aud .tag{margin-left:auto;color:var(--acc)}
.line{background:var(--s1);border:1px solid var(--line);border-radius:12px;padding:14px 18px 12px;margin-bottom:10px}
.lh{display:flex;align-items:flex-start;gap:14px}.lid{color:var(--acc);font-size:14px;padding-top:2px}.ltext{margin:0;flex:1;font:500 17px/1.45 Inter}
.play{flex:none;width:34px;height:34px;border-radius:50%;border:1px solid var(--line);background:var(--s2);cursor:pointer;position:relative}
.play:before{content:"";position:absolute;left:13px;top:10px;border-left:11px solid var(--text);border-top:7px solid transparent;border-bottom:7px solid transparent}
.play.on{background:var(--acc);border-color:var(--acc)}.play.on:before{left:11px;top:10px;width:4px;height:14px;border:0;background:#1a0d00;box-shadow:7px 0 0 #1a0d00}
.play.sm{width:24px;height:24px}.play.sm:before{left:9px;top:7px;border-left-width:8px;border-top-width:5px;border-bottom-width:5px}
.play.sm.on:before{left:7px;top:6px;width:3px;height:11px;box-shadow:5px 0 0 #1a0d00}
.strip{position:relative;height:64px;margin:12px 0 8px 46px;border-radius:8px;background:var(--s2);overflow:hidden}
.strip.empty{display:flex;align-items:center;padding-left:14px;color:var(--faint);font-size:13px}
.wv{position:absolute;inset:4px 0;width:100%;height:calc(100% - 8px);fill:#3a3631}.wv.acc{fill:color-mix(in srgb,var(--acc) 70%,#000)}
.words{position:absolute;inset:0}.w{position:absolute;top:0;bottom:0;border-left:1px solid rgba(243,239,230,.08)}
.w.up i{bottom:auto;top:5px}.w i{position:absolute;left:4px;bottom:5px;font:500 12px "JetBrains Mono";font-style:normal;color:var(--muted);white-space:nowrap}
.w.now{background:color-mix(in srgb,var(--acc) 22%,transparent)}.w.now i{color:var(--text)}
.ph{position:absolute;top:0;bottom:0;left:0;width:2px;background:var(--acc);opacity:0}
.takes{list-style:none;margin:0 0 0 46px;padding:0;display:flex;flex-wrap:wrap;gap:6px 18px}
.take{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--muted)}.take.on{color:var(--text)}
.wer{font:500 12px "JetBrains Mono";padding:2px 7px;border-radius:5px}.wer.good{background:color-mix(in srgb,var(--good) 16%,transparent);color:var(--good)}
.wer.mid{background:color-mix(in srgb,var(--mid) 16%,transparent);color:var(--mid)}.wer.bad{background:color-mix(in srgb,var(--bad) 16%,transparent);color:var(--bad)}
.pick{font:600 11px "JetBrains Mono";text-transform:uppercase;letter-spacing:.06em;color:var(--acc)}
.mus{display:grid;grid-template-columns:repeat(${Math.max(1, musicTakes.length)},1fr);gap:10px}
.mt{background:var(--s1);border:1px solid var(--line);border-radius:12px;padding:12px 14px}.mt .hd{display:flex;align-items:center;gap:10px;font:500 13px "JetBrains Mono";margin-bottom:8px}
.mt .wvb{position:relative;height:54px}
.tl{background:var(--s1);border:1px solid var(--line);border-radius:12px;padding:14px 16px}
.lane{display:grid;grid-template-columns:70px 1fr;align-items:center;gap:12px;height:34px}.lane>span{font:500 12px "JetBrains Mono";color:var(--muted)}
.lane>div{position:relative;height:24px;background:var(--s2);border-radius:5px;overflow:hidden}
.lane b{position:absolute;top:2px;bottom:2px;border-radius:4px;background:#2d2a26;border:1px solid #3a3631;font:500 11px/18px "JetBrains Mono";color:var(--muted);padding:0 6px;overflow:hidden;white-space:nowrap}
.lane i{position:absolute;top:5px;bottom:5px;border-radius:3px;background:var(--acc)}.lane u{position:absolute;top:6px;bottom:6px;width:2px;background:var(--muted)}
.lane.mus>div{height:34px}.lane.mus .wv{inset:2px 0}
</style></head><body>
<header><span class="brand">demo<em>forge</em></span><span class="proj">${esc(path.relative(process.cwd(), proj) || ".")} · review</span>
<div class="stats"><span><b>${S.lines.length}</b> lines</span><span><b>${totalVo.toFixed(1)} s</b> narration</span><span><b>${nTakes}</b> takes scored</span><span><b>${musicTakes.length}</b> music takes</span></div></header>
<main>
<h2>Narrator</h2>
<div class="card"><div class="prompt">${esc(S.voice)}</div><div class="style">Delivery: ${esc(S.style || "")}</div>
<div class="auds">${auditions.map(([k, v]) => `<div class="aud${fs.existsSync(path.join(proj, "audio/vo/ref_voice.wav")) && fs.statSync(path.join(proj, "audio/vo/ref_voice.wav")).size === fs.statSync(path.join(proj, k)).size ? " ref" : ""}"><button class="play sm" data-src="${esc(k)}" aria-label="Play ${esc(k)}"></button>${esc(path.basename(k, ".wav"))}<span class="dim">${fmt(v.f0_med, 0)} Hz</span><span class="tag">${fs.existsSync(path.join(proj, "audio/vo/ref_voice.wav")) && fs.statSync(path.join(proj, "audio/vo/ref_voice.wav")).size === fs.statSync(path.join(proj, k)).size ? "voice" : ""}</span></div>`).join("")}</div></div>
<h2>Lines · WhisperX word timing</h2>
${lineRows}
<h2>Music · ACE-Step</h2>
<div class="mus">${musicTakes.map((f) => `<div class="mt"><div class="hd"><button class="play sm" data-src="audio/music/${f}" aria-label="Play ${f}"></button>${f.replace(".wav", "")}<span class="dim">asked ${esc(D.music?.bpm || "")} BPM · ${esc(D.music?.key || "")}</span></div><div class="wvb">${wave(peaks("audio/music/" + f, 260), 54, "wv acc")}</div></div>`).join("") || '<div class="card dim">No music yet: demoforge music gen</div>'}</div>
${timeline ? `<h2>Film timeline · ${plan.TOTAL} s</h2>${timeline}` : ""}
</main>
<script>
let cur = null, raf = 0;
const stop = () => { if (!cur) return; cur.a.pause(); cur.b.classList.remove("on"); const s = cur.strip; if (s) { s.querySelector(".ph").style.opacity = 0; s.querySelectorAll(".w.now").forEach((w) => w.classList.remove("now")); } cancelAnimationFrame(raf); cur = null; };
function tick() {
  if (!cur) return;
  const dur = cur.dur || cur.a.duration;
  const t = Math.max(cur.a.currentTime, (performance.now() - cur.t0) / 1000), s = cur.strip;
  if (t >= dur) return stop();
  if (s && dur) {
    s.querySelector(".ph").style.cssText = "opacity:1;left:" + (t / dur * 100) + "%";
    s.querySelectorAll(".w").forEach((w) => w.classList.toggle("now", t >= +w.dataset.s && t < +w.dataset.e));
  }

  raf = requestAnimationFrame(tick);
}
document.addEventListener("click", (e) => {
  const b = e.target.closest(".play"); if (!b) return;
  if (cur && cur.b === b) return stop();
  stop();
  const a = new Audio(b.dataset.src);
  cur = { a, b, t0: performance.now(), dur: +b.dataset.dur || 0, strip: b.dataset.line ? document.querySelector('.strip[data-line="' + b.dataset.line + '"]') : null };
  b.classList.add("on"); a.play().catch(() => {}); tick();
});
</script>
</body></html>`;
fs.writeFileSync(path.join(proj, "report.html"), html);
console.log("report:", path.join(proj, "report.html"));
