// repotage compose kit: build a HyperFrames project (index.html + compositions/*.html)
// from capture metadata and narration word timings. A film's build.mjs looks like:
//
//   const { kit } = await import(process.env.REPOTAGE_HOME + "/compose/kit.mjs");
//   const K = kit({ project: PROJECT_DIR, theme: { accent: "#ff6a1a" } });
//   K.plan({ scenes: { hook: [0, 6], app: [6, 8] }, voAt: { s01: 0.4, s02: 6.3 }, total: 14 });
//   K.scene("hook", css, html, js);                     // any hand-built scene
//   K.productScene("app", { src: "flow", shots, cams }); // real footage in a window, camera + cursor
//   K.captions();
//   K.write();
//
// Rules this kit keeps for you (HyperFrames contract): one paused timeline per scene registered
// on window.__timelines, media timed on the <video> itself, deterministic GSAP only, every audio
// clip with an id, a duration and its own non-overlapping track.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

export const r2 = (v) => Math.round(v * 1000) / 1000;
/** Escape text for HTML (captions, titles, anything that came from a script or a captured page). */
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const ID = /^[A-Za-z][A-Za-z0-9_-]{0,40}$/;
const easeIO = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);


/** Peak envelope of a WAV (PCM 16/24/32 or float) between t0 and t1 seconds, n buckets in 0..1. */
export function peaks(file, n = 200, t0 = 0, t1 = Infinity) {
  if (!fs.existsSync(file)) return null;
  const b = fs.readFileSync(file);
  let o = 12, fmt, ch, bits, rate, data, len;
  while (o < b.length - 8) {
    const id = b.toString("ascii", o, o + 4), sz = b.readUInt32LE(o + 4);
    if (id === "fmt ") { fmt = b.readUInt16LE(o + 8); ch = b.readUInt16LE(o + 10); rate = b.readUInt32LE(o + 12); bits = b.readUInt16LE(o + 22); if (fmt === 0xfffe) fmt = b.readUInt16LE(o + 32); }
    if (id === "data") { data = o + 8; len = Math.min(sz, b.length - data); break; }
    o += 8 + sz + (sz % 2);
  }
  if (!data) return null;
  const bps = bits / 8, frames = Math.floor(len / (bps * ch));
  const rd = (i) => { const p = data + i * bps * ch; if (fmt === 3) return b.readFloatLE(p); if (bits === 16) return b.readInt16LE(p) / 32768; if (bits === 24) return b.readIntLE(p, 3) / 8388608; return b.readInt32LE(p) / 2147483648; };
  const a = Math.max(0, Math.floor(t0 * rate)), z = Math.min(frames, Math.floor(Math.min(t1, frames / rate) * rate));
  const out = new Array(n).fill(0), step = Math.max(1, Math.floor((z - a) / n / 48));
  for (let i = a; i < z; i += step) { const k = Math.min(n - 1, Math.floor(((i - a) / (z - a)) * n)); const v = Math.abs(rd(i)); if (v > out[k]) out[k] = v; }
  return out.map((v) => Math.round(v * 1000) / 1000);
}
/** SVG bars for a peak envelope (viewBox w x h). */
export function waveSvg(pk, { w = 1000, h = 100, gap = 0.38, id = "", cls = "", fill = "currentColor", norm = true } = {}) {
  const mx = norm ? Math.max(...pk) || 1 : 1, bw = w / pk.length;
  return `<svg ${id ? `id="${id}" ` : ""}class="${cls}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">${pk.map((v, i) => { const bh = Math.max(2, (v / mx) * (h - 2)); return `<rect x="${(i * bw).toFixed(1)}" y="${((h - bh) / 2).toFixed(1)}" width="${(bw * (1 - gap)).toFixed(2)}" height="${bh.toFixed(1)}" rx="${Math.min(2, bw * 0.3).toFixed(1)}" fill="${fill}"/>`; }).join("")}</svg>`;
}

export const CURSOR_SVG = `<svg class="arrow" viewBox="0 0 28 40" width="31" height="44" aria-hidden="true"><path d="M2 2 L2 31 L9.2 24.6 L14 36.4 L19.4 34.1 L14.7 22.6 L24.4 22.6 Z" fill="#fff" stroke="#111" stroke-width="2" stroke-linejoin="round"/></svg>`;

const THEME = {
  bg: "#0e0f11", s1: "#15171a", s2: "#1c1f23", line: "#262a30", line2: "#30353c",
  text: "#e6e8eb", muted: "#9ba1a8", faint: "#6e757d", accent: "#f5a524", onAccent: "#1a1200", ok: "#4cc38a",
  ground: null, // product-world ground; defaults to accent
  fontSans: '"Inter", sans-serif', fontMono: '"JetBrains Mono", monospace', fontFaces: "",
  windowTitle: "",
};

export function kit({ project, width = 1920, height = 1080, theme = {}, window: win = {}, viewport = {} }) {
  const T = { ...THEME, ...theme };
  T.ground = T.ground || T.accent;
  const V = path.join(project, "video");
  const VW = viewport.w || 1280, VH = viewport.h || 800;
  const W = { left: 240, top: 40, bar: 32, w: 1440, h: 900, ...win };
  const K = W.w / VW;
  const SCR_TOP = W.top + W.bar;
  const files = {};
  const sfx = [];
  const P = { scenes: {}, voAt: {}, total: 0 };
  const vo = fs.existsSync(path.join(project, "audio", "vo_words.json")) ? JSON.parse(fs.readFileSync(path.join(project, "audio", "vo_words.json"), "utf8")) : {};
  const metas = {};

  // ---------- capture metadata ----------
  function meta(src) {
    if (!metas[src]) {
      const m = JSON.parse(fs.readFileSync(path.join(project, "capture", "clips", src, "meta.json"), "utf8"));
      metas[src] = m.events.map((e) => ({ ...e, t: e.t - m.t0, tEnd: e.tEnd ? e.tEnd - m.t0 : undefined }));
      metas[src].duration = m.tEnd - m.t0;
    }
    return metas[src];
  }
  const find = (src, pred, what) => { const e = meta(src).find(pred); if (!e) throw new Error(`${src}: no ${what}`); return e; };
  const clickT = (src, label) => find(src, (e) => e.type === "click" && e.label === label, `click "${label}"`).t;
  const sceneT = (src, name) => find(src, (e) => e.type === "scene" && e.name === name, `scene "${name}"`).t;
  const evT = (src, type) => find(src, (e) => e.type === type, type).t;
  const box = (src, name, key) => find(src, (e) => e.type === "measure" && e.name === name, `measure "${name}"`).rects[key];

  // ---------- plan + narration ----------
  function plan({ scenes, voAt, total }) {
    for (const id of [...Object.keys(scenes), ...Object.keys(voAt)]) if (!ID.test(id)) throw new Error(`id ${JSON.stringify(id)} must match ${ID}`);
    Object.assign(P, { scenes, voAt, total });
  }
  /** Scene-local time (s) of the i-th spoken word of a narration line. */
  function word(line, i, scene) {
    if (!vo[line]) throw new Error(`no narration ${line}`);
    return r2(P.voAt[line] + vo[line].words[i].start - P.scenes[scene][0]);
  }
  /** Index of the first word matching `text` (case-insensitive, punctuation ignored). */
  function wordIdx(line, text, from = 0) {
    const n = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    const i = vo[line].words.findIndex((w, k) => k >= from && n(w.text) === n(text));
    if (i < 0) throw new Error(`"${text}" not spoken in ${line}`);
    return i;
  }
  const at = (line, text, scene) => word(line, wordIdx(line, text), scene);

  // ---------- camera ----------
  const HOME = { x: 0, y: 0, scale: 1 };
  /** Camera that frames a viewport rect [x,y,w,h], keeping the window edges outside the frame when zoomed. */
  function frame([vx, vy, vw, vh], { maxZ = 2.1, cy = height * 0.443 } = {}) {
    let Z = Math.min((width * 0.94) / (vw * K), (height * 0.83 * 0.92) / (vh * K));
    Z = Math.max(1, Math.min(maxZ, Z));
    const cx = vx + vw / 2, cyv = vy + vh / 2;
    let x = width / 2 - Z * (W.left + cx * K);
    let y = cy - Z * (SCR_TOP + cyv * K);
    const L = Z * W.left, R = Z * (W.left + W.w);
    if (R - L >= width + 40) x = Math.max(Math.min(x, -L - 20), width - R + 20);
    else x = (width - (R - L)) / 2 - L;
    const Tp = Z * W.top, B = Z * (SCR_TOP + W.h);
    if (B - Tp >= height + 40) y = Math.max(Math.min(y, -Z * SCR_TOP), height - B + 20);
    return { x: r2(x), y: r2(y), scale: r2(Z) };
  }

  // ---------- cursor (replays the real pointer) ----------
  function posAt(src, m) {
    let p = { x: VW * 0.82, y: VH * 0.92 };
    for (const e of meta(src)) {
      if (e.type === "dragStart" && e.t <= m) { p = { x: e.x, y: e.y }; continue; }
      if (e.type !== "move" || e.t > m) continue;
      if (m < e.tEnd) { const q = easeIO((m - e.t) / (e.tEnd - e.t)); return { x: e.from.x + (e.to.x - e.from.x) * q, y: e.from.y + (e.to.y - e.from.y) * q }; }
      p = { ...e.to };
    }
    return p;
  }
  function cursorJs(id, shots, sceneStart, { clickSfx = true } = {}) {
    const L = [];
    for (const s of shots) {
      if (s.noCursor) { L.push(`tl.set("#${id}-cursor",{opacity:0},${r2(s.start)});`); continue; }
      const rate = (s.m1 - s.m0) / s.dur;
      const at = (m) => r2(s.start + (m - s.m0) / rate);
      const p0 = posAt(s.src, s.m0);
      L.push(`tl.set("#${id}-cursor",{x:${r2(p0.x * K)},y:${r2(p0.y * K)},opacity:1},${r2(s.start)});`);
      for (const e of meta(s.src)) {
        if (e.type === "dragStart" && e.t >= s.m0 && e.t < s.m1) L.push(`tl.set("#${id}-cursor",{x:${r2(e.x * K)},y:${r2(e.y * K)}},${at(e.t)});`);
        if (e.type === "move" && e.tEnd > s.m0 && e.t < s.m1) {
          const t0 = Math.max(e.t, s.m0), t1 = Math.min(e.tEnd, s.m1);
          if (e.t >= s.m0) L.push(`tl.set("#${id}-cursor",{x:${r2(e.from.x * K)},y:${r2(e.from.y * K)}},${at(e.t)});`);
          const pe = posAt(s.src, t1);
          L.push(`tl.to("#${id}-cursor",{x:${r2(pe.x * K)},y:${r2(pe.y * K)},duration:${r2((t1 - t0) / rate)},ease:"${e.t >= s.m0 ? "power2.inOut" : "power2.out"}"},${at(t0)});`);
        }
        if (e.type === "click" && e.t >= s.m0 && e.t < s.m1) {
          const t = at(e.t);
          L.push(`tl.to("#${id}-cursor .arrow",{scale:0.82,duration:0.07,ease:"power2.in"},${t});tl.to("#${id}-cursor .arrow",{scale:1,duration:0.16,ease:"power2.out"},${r2(t + 0.07)});`);
          if (clickSfx) addSfx(sfx.filter((x) => x.kind === "click").length % 2 ? "click-soft" : "click", sceneStart + t + 0.02, 0.5, { kind: "click" });
        }
      }
    }
    return L.join("\n");
  }

  // ---------- markup helpers ----------
  const tokens = `--bg:${T.bg};--s1:${T.s1};--s2:${T.s2};--line:${T.line};--line2:${T.line2};--text:${T.text};--muted:${T.muted};--faint:${T.faint};--accent:${T.accent};--on-accent:${T.onAccent};--ok:${T.ok};--ground:${T.ground};--sans:${T.fontSans};--mono:${T.fontMono};`;
  function sceneDoc(id, css, html, js) {
    return `<template>
<style>
${T.fontFaces}
#root{position:absolute;inset:0;overflow:hidden;${tokens}font-family:var(--sans);color:var(--text)}
${css}
</style>
<div id="root" data-composition-id="${id}" data-width="${width}" data-height="${height}">
${html}
</div>
<script>
(function(){
const tl = gsap.timeline({ paused: true });
${js}
window.__timelines["${id}"] = tl;
})();
</script>
</template>
`;
  }
  function scene(id, css, html, js) { if (!ID.test(id)) throw new Error(`scene id ${JSON.stringify(id)} must match ${ID}`); files[id] = sceneDoc(id, css, html, js); return id; }

  const WINDOW_CSS = (id, ground) => `
#root{background:${ground}}
#${id}-cam{position:absolute;left:0;top:0;width:${width}px;height:${height}px}
.win{position:absolute;left:${W.left}px;top:${W.top}px;width:${W.w}px;height:${W.h + W.bar}px;border-radius:14px;overflow:hidden;background:var(--bg);box-shadow:0 28px 70px rgba(0,0,0,.38),0 0 0 1px rgba(0,0,0,.35)}
.bar{position:absolute;left:0;top:0;right:0;height:${W.bar}px;background:var(--s1);border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:center;font-size:14px;color:var(--faint)}
.dots{position:absolute;left:14px;top:${(W.bar - 11) / 2}px;display:flex;gap:8px}.dots i{width:11px;height:11px;border-radius:50%;background:var(--line2);display:block}
.screen{position:absolute;left:0;top:${W.bar}px;width:${W.w}px;height:${W.h}px;overflow:hidden;background:var(--bg)}
.screen video,.screen img.still{position:absolute;left:0;top:0;width:${W.w}px;height:${W.h}px;object-fit:cover}
.cursor{position:absolute;left:0;top:0;width:31px;height:44px;opacity:0;z-index:20}
.cursor .arrow{display:block;transform-origin:4px 4px;filter:drop-shadow(0 3px 5px rgba(0,0,0,.45))}
.hl{position:absolute;border:3px solid var(--accent);border-radius:8px;background:color-mix(in srgb,var(--accent) 10%,transparent);opacity:0;z-index:10}
`;
  const camJs = (id, steps) => [`tl.set("#${id}-cam",{transformOrigin:"0 0",x:${steps[0].x},y:${steps[0].y},scale:${steps[0].scale}},0);`]
    .concat(steps.slice(1).map((c) => `tl.to("#${id}-cam",{x:${c.x},y:${c.y},scale:${c.scale},duration:${c.d ?? 0.55},ease:"${c.ease ?? "power2.inOut"}"},${r2(c.t)});`)).join("\n");
  /** CSS position for a highlight box over a viewport rect. */
  const hlRect = ([x, y, w, h], pad = 6) => `left:${r2(x * K - pad)}px;top:${r2(y * K - pad)}px;width:${r2(w * K + pad * 2)}px;height:${r2(h * K + pad * 2)}px`;
  const hlIn = (sel, t) => `tl.fromTo("${sel}",{opacity:0,clipPath:"inset(0 100% 0 0 round 8px)"},{opacity:1,clipPath:"inset(0 0% 0 0 round 8px)",duration:0.38,ease:"expo.out"},${r2(t)});`;

  /**
   * Real footage inside a window, with camera moves and the replayed cursor.
   * shots: [{ src, start, dur, m0, m1 }]  -- scene-local start/dur, source seconds m0..m1 (rate = (m1-m0)/dur)
   * cams:  [frame(...) | HOME, { ...frame(rect), t, d?, ease? }, ...]
   */
  function productScene(id, { title = T.windowTitle, src, shots, cams = [HOME], overlays = "", js = "", css = "", ground = T.ground, before = "", after = "" }) {
    const start = P.scenes[id][0];
    shots = shots.map((s) => ({ ...s, src: s.src || src }));
    const vids = shots.map((s, i) => `<video id="${id}-v${i}" class="clip" src="assets/footage/${s.src}.mp4" data-start="${r2(s.start)}" data-duration="${r2(s.dur)}" data-media-start="${r2(s.m0)}" data-playback-rate="${r2((s.m1 - s.m0) / s.dur)}" data-track-index="${i + 1}" muted playsinline></video>`).join("\n");
    const html = `${before}<div id="${id}-cam"><div class="win"><div class="bar" data-layout-ignore><span class="dots"><i></i><i></i><i></i></span>${esc(title)}</div>
<div class="screen">${vids}${overlays}<div class="cursor" id="${id}-cursor">${CURSOR_SVG}<div class="cursor-extra" id="${id}-cursor-extra"></div></div></div></div></div>${after}`;
    files[id] = sceneDoc(id, WINDOW_CSS(id, ground) + css, html, `${camJs(id, cams)}\n${cursorJs(id, shots, start)}\n${js}`);
    return id;
  }

  /** Full-frame footage (a VHS terminal recording, a screen recording) with an optional camera. */
  function footageScene(id, { shots, cams, overlays = "", js = "", css = "", ground = T.bg }) {
    const vids = shots.map((s, i) => `<video id="${id}-v${i}" class="clip" src="assets/footage/${s.src}.mp4" data-start="${r2(s.start)}" data-duration="${r2(s.dur)}" data-media-start="${r2(s.m0)}" data-playback-rate="${r2((s.m1 - s.m0) / s.dur)}" data-track-index="${i + 1}" muted playsinline></video>`).join("\n");
    const cam = cams ? [`tl.set("#${id}-cam",{transformOrigin:"0 0",x:${cams[0].x || 0},y:${cams[0].y || 0},scale:${cams[0].scale || 1}},0);`, ...cams.slice(1).map((c) => `tl.to("#${id}-cam",{x:${c.x || 0},y:${c.y || 0},scale:${c.scale || 1},duration:${c.d ?? 0.55},ease:"${c.ease ?? "power2.inOut"}"},${r2(c.t)});`)].join("\n") : "";
    files[id] = sceneDoc(id, `#root{background:${ground}}#${id}-cam{position:absolute;inset:0}#${id}-cam video{position:absolute;left:0;top:0;width:${width}px;height:${height}px}${css}`, `<div id="${id}-cam">${vids}${overlays}</div>`, `${cam}\n${js}`);
    return id;
  }

  // ---------- captions ----------
  /** One caption group at a time from the narration word timings; words brighten as they are spoken. */
  function captions({ fix = {}, merge = [], maxWords = 5, bottom = 34, size = 40, font = "var(--sans)", weight = 500 } = {}) {
    const groups = [];
    for (const [line, at0] of Object.entries(P.voAt)) {
      const raw = vo[line].words, ws = [];
      for (let i = 0; i < raw.length; i++) {
        let w = { ...raw[i] };
        for (const [a, b, into] of merge) if (w.text.toLowerCase() === a && raw[i + 1]?.text.toLowerCase().replace(/[^a-z-]/g, "") === b) { w = { text: into + (raw[i + 1].text.match(/[.,?!:]$/)?.[0] || ""), start: w.start, end: raw[i + 1].end }; i++; }
        const bare = w.text.replace(/[.,?!:]$/, ""), punct = w.text.slice(bare.length);
        if (fix[bare] !== undefined) w.text = fix[bare] + punct;
        ws.push({ text: w.text, start: r2(at0 + w.start), end: r2(at0 + w.end) });
      }
      let cur = [];
      const flush = () => { if (cur.length) groups.push(cur); cur = []; };
      ws.forEach((w, i) => {
        cur.push(w);
        const nxt = ws[i + 1];
        if (/[.,?!:]$/.test(w.text) && cur.length >= 2) flush();
        else if (cur.length >= maxWords || (nxt ? nxt.start - w.end : 1) > 0.25) flush();
      });
      flush();
    }
    const css = `#root{pointer-events:none}
.cg{position:absolute;left:0;right:0;bottom:${bottom}px;text-align:center;opacity:0;visibility:hidden}
.cg .pill{display:inline-block;background:rgba(10,10,11,.84);border-radius:12px;padding:10px 24px 12px;font:${weight} ${size}px/1.25 ${font};color:rgba(240,240,240,.5);box-shadow:0 6px 20px rgba(0,0,0,.25)}`;
    const html = groups.map((g, gi) => `<div class="cg" id="cap-${gi}" data-layout-allow-caption-zone><span class="pill">${g.map((w, wi) => `<span id="cap-${gi}-${wi}">${esc(w.text)}</span>`).join(" ")}</span></div>`).join("\n");
    const js = groups.map((g, gi) => {
      const s = r2(g[0].start - 0.08), e = r2(g[g.length - 1].end + 0.25);
      const next = groups[gi + 1];
      const end = next ? Math.min(e, r2(next[0].start - 0.1)) : e;
      return `tl.set("#cap-${gi}",{visibility:"visible"},${s});tl.fromTo("#cap-${gi}",{opacity:0},{opacity:1,duration:0.1},${s});`
        + g.map((w, wi) => `tl.to("#cap-${gi}-${wi}",{color:"#ffffff",duration:0.08},${r2(w.start)});`).join("")
        + `tl.to("#cap-${gi}",{opacity:0,duration:0.1,ease:"power2.in"},${r2(end - 0.1)});tl.set("#cap-${gi}",{opacity:0,visibility:"hidden"},${r2(end)});`;
    }).join("\n");
    files.captions = sceneDoc("captions", css, html, js);
    return groups;
  }

  // ---------- sound ----------
  const sfxLen = {};
  function lenOf(name) {
    if (sfxLen[name] === undefined) {
      const f = path.join(V, "assets", "sfx", `${name}.mp3`);
      sfxLen[name] = fs.existsSync(f) ? Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString().trim()) : 0;
    }
    return sfxLen[name];
  }
  /** Place a sound effect at film time t (skipped if the file is not in video/assets/sfx). */
  function addSfx(name, t, vol = 0.35, { dur, kind } = {}) {
    if (!lenOf(name)) return;
    sfx.push({ name, t: r2(Math.max(0, t)), vol, len: r2(dur ?? lenOf(name)), kind });
  }

  // ---------- write the project ----------
  function write({ music = "assets/audio/music-bed.wav", motionBlur = true, title = "film" } = {}) {
    if (!P.total) throw new Error("call plan() first");
    for (const id of Object.keys(P.scenes)) if (!files[id]) throw new Error(`scene ${id} was planned but not built`);
    sfx.sort((a, b) => a.t - b.t);
    const lanes = [];
    for (const x of sfx) { let L = lanes.findIndex((e) => e <= x.t); if (L < 0) { L = lanes.length; lanes.push(0); } lanes[L] = x.t + x.len + 0.01; x.lane = 22 + L; }
    const hosts = Object.entries(P.scenes).map(([id, [s, d]], i) => `      <div id="${id}" data-composition-id="${id}" data-composition-src="compositions/${id}.html" data-start="${s}" data-duration="${d}" data-track-index="1" data-track-kind="graphics" data-width="${width}" data-height="${height}" style="z-index:${i + 1}"></div>`).join("\n");
    const cap = files.captions ? `      <div id="captions" data-composition-id="captions" data-composition-src="compositions/captions.html" data-start="0" data-duration="${P.total}" data-track-index="2" data-track-kind="captions" data-width="${width}" data-height="${height}" style="z-index:50"></div>` : "";
    const mus = music && fs.existsSync(path.join(V, music)) ? `      <audio id="music" class="clip" src="${music}" data-start="0" data-duration="${P.total}" data-track-index="21" data-volume="1"></audio>` : "";
    const voTags = Object.entries(P.voAt).map(([k, t]) => `      <audio id="vo-${k}" class="clip" src="assets/audio/vo-${k}.wav" data-start="${t}" data-duration="${vo[k].duration}" data-track-index="20" data-volume="1"></audio>`).join("\n");
    const sfxTags = sfx.map((s, i) => `      <audio id="sfx-${i}" class="clip" src="assets/sfx/${s.name}.mp3" data-start="${s.t}" data-duration="${s.len}" data-track-index="${s.lane}" data-volume="${s.vol}"></audio>`).join("\n");
    const index = `<!doctype html>
<html lang="en" data-resolution="landscape">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${width}, height=${height}" />
    <title>${esc(title)}</title>
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js" integrity="sha384-XmJ9SoHtVOHoQUcKvFAzVXwdkKo1Ie3bhmSoIAkcdsHGaIrVJIkmozyq0FJeb/Ly" crossorigin="anonymous"></script>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { margin: 0; width: ${width}px; height: ${height}px; overflow: hidden; background: ${T.bg}; }
      #root { position: relative; width: 100%; height: 100%; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="${P.total}" data-width="${width}" data-height="${height}"${motionBlur ? ' data-motion-blur="on"' : ""}>
${hosts}
${cap}
${mus}
${voTags}
${sfxTags}
    </div>
    <script>
      window.__timelines = window.__timelines || {};
      window.__timelines["main"] = gsap.timeline({ paused: true });
    </script>
  </body>
</html>
`;
    fs.mkdirSync(path.join(V, "compositions"), { recursive: true });
    fs.mkdirSync(path.join(V, "build"), { recursive: true });
    for (const [id, doc] of Object.entries(files)) fs.writeFileSync(path.join(V, "compositions", `${id}.html`), doc);
    fs.writeFileSync(path.join(V, "index.html"), index);
    fs.writeFileSync(path.join(V, "build", "plan.json"), JSON.stringify({ SC: P.scenes, VO_AT: P.voAt, TOTAL: P.total, SFX: sfx }, null, 1));
    console.log(`wrote ${Object.keys(files).length} compositions, ${Object.keys(P.voAt).length} narration clips, ${sfx.length} sound effects, ${P.total} s`);
  }

  return {
    esc, T, K, W, SCR_TOP, HOME, vo, P, width, height, files, sfx,
    meta, clickT, sceneT, evT, box, plan, word, wordIdx, at, frame, posAt, cursorJs,
    sceneDoc, scene, productScene, footageScene, hlRect, hlIn, captions, addSfx, write,
  };
}
