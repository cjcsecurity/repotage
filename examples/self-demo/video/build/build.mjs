// repotage's own demo film, built with repotage's compose kit.
// Run: repotage build examples/self-demo
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const { kit, r2, peaks, waveSvg } = await import(process.env.REPOTAGE_HOME + "/compose/kit.mjs");

const PROJECT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const REPO = path.resolve(PROJECT, "../..");
const has = (p) => fs.existsSync(path.join(PROJECT, p));
const K = kit({
  project: PROJECT,
  theme: {
    bg: "#121110", s1: "#1a1917", s2: "#22201d", line: "#2d2a26", line2: "#3a3631",
    text: "#f3efe6", muted: "#a39d92", faint: "#6f6a62", accent: "#ff6a1a", onAccent: "#1a0d00", ok: "#5fc98f",
    fontSans: '"Inter", sans-serif', fontMono: '"JetBrains Mono", monospace', windowTitle: "repotage · review",
  },
});
const S = JSON.parse(fs.readFileSync(path.join(PROJECT, "script.json"), "utf8"));

// ---------------- plan: one scene per narration line, the voice is the clock ----------------
const ORDER = [
  ["hook", "s01", 0.35, 0.6], ["reveal", "s02", 0.45, 0.55], ["script", "s03", 0.3, 0.6],
  ["capture", "s04", 0.3, 0.75], ["voice", "s05", 0.3, 0.6], ["music", "s06", 0.3, 0.6],
  ["compose", "s07", 0.3, 0.6], ["local", "s08", 0.3, 0.7], ["end", "s09", 0.5, 2.8],
];
const scenes = {}, voAt = {};
let t = 0;
for (const [id, line, lead, tail] of ORDER) {
  const d = r2(lead + K.vo[line].duration + tail);
  scenes[id] = [r2(t), d];
  voAt[line] = r2(t + lead);
  t = r2(t + d);
}
K.plan({ scenes, voAt, total: t });
const groups = K.captions({ fix: { Repotage: "repotage", Repotage: "repotage", ASTEP: "ACE-Step", "A-step": "ACE-Step", Open: "open", Models: "models" }, merge: [["vox", "cpm", "VoxCPM"], ["a", "step", "ACE-Step"], ["a-step", "", "ACE-Step"]] });
const at = (line, word, scene) => K.at(line, word, scene);

// shared look
const DOTS = `.dots-bg{position:absolute;inset:0;background-image:radial-gradient(circle,#24221f 1.5px,transparent 1.7px);background-size:40px 40px;background-position:20px 20px}`;
const WORDMARK = (id, size) => `<div id="${id}" class="wm" style="font:900 ${size}px/1 var(--sans);letter-spacing:-.045em;white-space:nowrap">repo<span style="color:var(--accent)">tage</span></div>`;

// ======================= HOOK: this film's own timeline =======================
{
  const id = "hook", [S0, D] = scenes.hook;
  const WIN = 10; // seconds of film shown in the lanes
  const X0 = 300, LW = 1480, px = LW / WIN;
  const lanes = [["voice", 430], ["music", 540], ["captions", 650], ["cuts", 760]];
  const voPk = peaks(path.join(PROJECT, "video/assets/audio/vo-s01.wav"), 240);
  const muPk = peaks(path.join(PROJECT, "video/assets/audio/music-bed.wav"), 300, 0, WIN);
  const voX = X0 + voAt.s01 * px, voW = K.vo.s01.duration * px;
  const caps = groups.filter((g) => g[0].start < WIN).map((g, i) => `<div class="cap" style="left:${r2(X0 + g[0].start * px)}px;width:${r2((g[g.length - 1].end - g[0].start) * px)}px">${g.map((w) => w.text).join(" ")}</div>`).join("");
  const cuts = Object.entries(scenes).filter(([, [s]]) => s < WIN).map(([sid, [s, d]]) => `<div class="cut" style="left:${r2(X0 + s * px)}px;width:${r2(Math.min(d, WIN - s) * px - 6)}px">${sid}</div>`).join("");
  const css = `#root{background:var(--bg)}${DOTS}
.lbl{position:absolute;left:140px;top:116px;font:500 24px var(--mono);color:var(--muted);display:flex;align-items:center;gap:12px}.lbl i{width:10px;height:10px;border-radius:50%;background:var(--accent)}
.prompt{position:absolute;left:140px;top:162px;width:1640px;font:400 44px/1.36 var(--sans);letter-spacing:-.012em;color:var(--text)}
.prompt b{color:var(--accent);font-weight:400}
#hk-lanes{position:absolute;left:0;top:0;width:1920px;height:1080px;transform-origin:50% 662px}
.lane{position:absolute;left:140px;width:1640px;height:96px;border-radius:12px;background:#1a1917;border:1px solid #2d2a26;opacity:0}
.lane span{position:absolute;left:22px;top:30px;font:500 28px var(--mono);color:var(--muted)}
.wvl{position:absolute;top:0;height:96px;color:#5a3a26}.wvl svg{width:100%;height:100%;display:block}
.wvh{color:var(--accent)}
.cap{position:absolute;top:24px;height:46px;border-radius:7px;background:#2d2a26;border:1px solid #3a3631;font:500 17px/44px var(--sans);color:var(--text);padding:0 10px;white-space:nowrap;overflow:hidden}
.cut{position:absolute;top:22px;height:50px;border-radius:7px;background:#22201d;border:1px solid #3a3631;font:500 20px/48px var(--mono);color:var(--muted);padding:0 14px}
#hk-ph{position:absolute;left:${X0}px;top:414px;width:3px;height:458px;background:var(--accent);border-radius:2px}
`;
  const lane = (name, y, inner) => `<div class="lane" id="hk-${name}" style="top:${y}px"><span>${name}</span>${inner}</div>`;
  const voLane = `<div class="wvl" style="left:${r2(voX - 140)}px;width:${r2(voW)}px">${waveSvg(voPk, { w: 1000, h: 100 })}</div><div class="wvl wvh" id="hk-vo-hot" style="left:${r2(voX - 140)}px;width:${r2(voW)}px;clip-path:inset(0 100% 0 0)">${waveSvg(voPk, { w: 1000, h: 100 })}</div>`;
  const muLane = muPk ? `<div class="wvl" style="left:${X0 - 140}px;width:${LW}px;color:#8a5230">${waveSvg(muPk.map((v) => Math.sqrt(v)), { w: 1000, h: 100 })}</div>` : "";
  const html = `<div class="dots-bg"></div>
<div class="lbl" id="hk-lbl" data-layout-ignore><i></i>voice prompt · the only input to this narrator</div>
<div class="prompt" id="hk-prompt" data-layout-ignore><b>“</b>${S.voice}<b>”</b></div>
<div id="hk-lanes">
${lane("voice", 430, voLane)}
${lane("music", 540, muLane)}
${lane("captions", 650, `<div data-layout-ignore style="position:absolute;left:-140px;top:0">${caps}</div>`)}
${lane("cuts", 760, `<div data-layout-ignore style="position:absolute;left:-140px;top:0">${cuts}</div>`)}
<div id="hk-ph"></div>
</div>`;
  const tMusic = at("s01", "music", id), tCap = at("s01", "captions", id), tCut = at("s01", "cut", id), tRepo = at("s01", "repo", id);
  const fold = r2(tRepo + 0.25);
  const js = `
tl.set("#hk-voice",{opacity:1},0);
tl.fromTo("#hk-ph",{x:0},{x:${r2((fold) * px)},duration:${fold},ease:"none"},0);
tl.fromTo("#hk-vo-hot",{clipPath:"inset(0 100% 0 0)"},{clipPath:"inset(0 0% 0 0)",duration:${r2(K.vo.s01.duration)},ease:"none"},${voAt.s01});
${[["music", tMusic], ["captions", tCap], ["cuts", tCut]].map(([n, tt]) => `tl.fromTo("#hk-${n}",{opacity:0,y:18},{opacity:1,y:0,duration:0.42,ease:"expo.out"},${r2(tt - 0.12)});`).join("\n")}
tl.to(["#hk-lbl","#hk-prompt"],{opacity:0,filter:"blur(8px)",duration:0.25,ease:"power2.in"},${r2(fold - 0.25)});
tl.to(".lane",{backgroundColor:"#ff6a1a",borderColor:"#ff6a1a",duration:0.2},${r2(fold - 0.05)});
tl.to(".lane > *",{opacity:0,duration:0.15},${r2(fold - 0.05)});
tl.to("#hk-lanes",{scaleY:0.0085,duration:0.5,ease:"power3.in"},${fold});
tl.to("#hk-ph",{opacity:0,duration:0.1},${fold});
`;
  K.scene(id, css, html, js);
  K.addSfx("whoosh-short", S0 + fold + 0.15, 0.3);
  ["music", "captions", "cuts"].forEach((n, i) => K.addSfx("pop", S0 + [tMusic, tCap, tCut][i], 0.18));
}

// ======================= REVEAL: the name, and the one command =======================
{
  const id = "reveal", [S0] = scenes.reveal;
  const cmd = "repotage new ./your-repo";
  const css = `#root{background:var(--bg)}${DOTS}
#rv-line{position:absolute;left:140px;top:658px;width:1640px;height:8px;border-radius:4px;background:var(--accent);transform-origin:50% 50%}
#rv-mask{position:absolute;left:0;right:0;top:330px;height:328px;overflow:hidden;display:flex;justify-content:center;align-items:flex-end}
#rv-wm{padding-bottom:22px}
#rv-cmd{position:absolute;left:0;right:0;top:736px;text-align:center;font:500 52px var(--mono);color:var(--text)}
#rv-cmd .p{color:var(--accent)}#rv-cmd .c{opacity:0}
.caret{display:inline-block;width:4px;height:54px;background:var(--accent);vertical-align:-10px;margin-left:4px;opacity:0}
`;
  const html = `<div class="dots-bg"></div><div id="rv-line"></div><div id="rv-mask">${WORDMARK("rv-wm", 250)}</div>
<div id="rv-cmd"><span class="p c" id="rv-dollar">$ </span>${[...cmd].map((c, i) => `<span class="c" id="rv-c${i}">${c === " " ? "&nbsp;" : c}</span>`).join("")}<span class="caret" id="rv-caret"></span></div>`;
  const tName = at("s02", "repotage", id), tPoint = at("s02", "point", id);
  const js = `
tl.fromTo("#rv-wm",{y:330},{y:0,duration:0.7,ease:"expo.out"},${r2(Math.max(0.15, tName - 0.35))});
tl.to("#rv-line",{scaleX:0.62,duration:0.6,ease:"power3.inOut"},${r2(tName - 0.2)});
tl.set("#rv-caret",{opacity:1},${r2(tPoint - 0.15)});tl.set("#rv-dollar",{opacity:1},${r2(tPoint - 0.15)});
${[...cmd].map((_, i) => `tl.set("#rv-c${i}",{opacity:1},${r2(tPoint + i * 0.04)});`).join("")}
${[0, 1, 2, 3, 4, 5].map((i) => `tl.set("#rv-caret",{opacity:${i % 2 ? 1 : 0}},${r2(tPoint + cmd.length * 0.04 + 0.4 + i * 0.45)});`).join("")}
`;
  K.scene(id, css, html, js);
  K.addSfx("impact-bass-1", S0 + tName - 0.05, 0.4);
  K.addSfx("typing", S0 + tPoint, 0.22, { dur: 1.1 });
}

// ======================= SCRIPT: read the repo, pick a story, write the lines =======================
{
  const id = "script";
  const files = ["bin/", "capture/", "compose/", "pipeline/", "report/", "skills/", "templates/", "examples/self-demo/", "setup.sh", "README.md"].filter((f) => fs.existsSync(path.join(REPO, f)));
  const story = fs.readFileSync(path.join(PROJECT, "STORYLINES.md"), "utf8").match(/^## .+$/gm).map((h) => h.replace(/^## /, "").replace(/ \(picked\)$/, ""));
  const lines = S.lines.slice(0, 5).map((l) => `{ "id": "${l.id}", "text": "${l.text}" }`);
  const css = `#root{background:var(--bg)}${DOTS}
.pane{position:absolute;top:150px;height:780px;background:var(--s1);border:1px solid var(--line);border-radius:14px;overflow:hidden;opacity:0}
.pane .hd{height:58px;border-bottom:1px solid var(--line);display:flex;align-items:center;padding:0 22px;font:500 22px var(--mono);color:var(--muted)}
.tree{padding:18px 0;font:500 30px/1.75 var(--mono)}.tree div{padding:0 24px;color:var(--muted);background:rgba(255,106,26,0)}.tree div.on{background:color-mix(in srgb,var(--accent) 14%,transparent);color:var(--text)}
.sto{padding:20px;display:flex;flex-direction:column;gap:16px}.sto div{border:1px solid var(--line2);border-radius:10px;padding:20px 22px;font:600 30px/1.3 var(--sans);color:var(--text)}
.sto div em{display:block;font:500 28px var(--mono);font-style:normal;color:var(--accent);margin-top:10px;opacity:0}
.sto div.pick{border-color:var(--accent)}
.code{padding:20px 24px;font:400 22px/1.6 var(--mono);color:var(--text);white-space:pre-wrap;word-break:break-word}.code .k{color:var(--accent)}.code div{opacity:0;margin-bottom:10px}
`;
  const html = `<div class="dots-bg"></div>
<div class="pane" id="sc-tree" style="left:90px;width:430px"><div class="hd" data-layout-ignore>repotage/</div><div class="tree">${files.map((f, i) => `<div id="sc-f${i}">${f}</div>`).join("")}</div></div>
<div class="pane" id="sc-sto" style="left:550px;width:520px"><div class="hd" data-layout-ignore>STORYLINES.md</div><div class="sto">${story.map((s, i) => `<div id="sc-s${i}"${i ? " data-layout-ignore" : ""}>${s}${i === 0 ? '<em id="sc-pick">picked</em>' : ""}</div>`).join("")}</div></div>
<div class="pane" id="sc-code" style="left:1100px;width:730px"><div class="hd" data-layout-ignore>script.json · lines</div><div class="code" data-layout-ignore>${lines.map((l, i) => `<div id="sc-l${i}">${l.replace(/"(id|text)"/g, '<span class="k">"$1"</span>')}</div>`).join("")}</div></div>`;
  const tRead = at("s03", "reads", id), tPick = at("s03", "picks", id), tWrite = at("s03", "writes", id);
  const js = `
tl.fromTo("#sc-tree",{opacity:0,y:30},{opacity:1,y:0,duration:0.45,ease:"expo.out"},0.05);
${files.map((_, i) => `tl.set("#sc-f${i}",{backgroundColor:"rgba(255,106,26,0.16)",color:"#f3efe6"},${r2(tRead + i * 0.09)});tl.set("#sc-f${i}",{backgroundColor:"rgba(255,106,26,0)",color:"#a39d92"},${r2(tRead + i * 0.09 + 0.2)});`).join("")}
tl.fromTo("#sc-sto",{opacity:0,y:30},{opacity:1,y:0,duration:0.45,ease:"expo.out"},${r2(tPick - 0.35)});
tl.to("#sc-s1,#sc-s2",{opacity:0.35,duration:0.3},${r2(tPick + 0.45)});
tl.set("#sc-s0",{borderColor:"#ff6a1a"},${r2(tPick + 0.45)});tl.to("#sc-pick",{opacity:1,duration:0.2},${r2(tPick + 0.45)});
tl.fromTo("#sc-code",{opacity:0,y:30},{opacity:1,y:0,duration:0.45,ease:"expo.out"},${r2(tWrite - 0.4)});
${lines.map((_, i) => `tl.fromTo("#sc-l${i}",{opacity:0,filter:"blur(6px)"},{opacity:1,filter:"blur(0px)",duration:0.18,ease:"power4.out"},${r2(tWrite - 0.1 + i * 0.2)});`).join("\n")}
`;
  K.scene(id, css, html, js);
  K.addSfx("pop", scenes.script[0] + tPick + 0.45, 0.25);
}

// ======================= REPORT FOOTAGE: capture, voice, music =======================
const placeholder = (id, text) => K.scene(id, `#root{background:var(--bg)}#p{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:500 40px var(--mono);color:var(--faint)}`, `<div id="p">${text}</div>`, "");
if (has("capture/clips/report/meta.json") && has("video/assets/footage/report.mp4")) {
  const src = "report";
  const cT = (l) => K.clickT(src, l), sT = (n) => K.sceneT(src, n);
  // capture: the review page at its top, the cursor plays the narrator's audition
  {
    const id = "capture", [S0, D] = scenes.capture;
    const shots = [{ start: 0, dur: D, m0: 0.2, m1: cT("Stop voice") + 0.5 }];
    const rate = (shots[0].m1 - shots[0].m0) / D;
    const auds = K.box(src, "top", "auds"), card = K.box(src, "top", "narrator");
    const tRes = at("s04", "twice", id), tClick = at("s04", "logs", id) + 0.3;
    const evs = K.meta(src).filter((e) => (e.type === "click" || (e.type === "move" && Math.hypot(e.to.x - e.from.x, e.to.y - e.from.y) > 2)) && e.t <= shots[0].m1).slice(0, 6);
    const log = evs.map((e, i) => `<div id="cp-e${i}">${e.type === "click" ? `<b>click</b> ${Math.round(e.x)},${Math.round(e.y)}  "${e.label}"` : `move  ${Math.round(e.from.x)},${Math.round(e.from.y)} → ${Math.round(e.to.x)},${Math.round(e.to.y)}`}</div>`).join("");
    const after = `<div id="cp-res" class="chip">2560 × 1600 · 60 fps</div><div id="cp-log"><div class="hd" data-layout-ignore>capture/clips/report/meta.json</div>${log}</div>`;
    const css = `.chip{position:absolute;left:260px;top:${K.W.top + 48}px;background:var(--bg);border:1px solid var(--accent);color:var(--text);font:500 30px var(--mono);padding:10px 18px;border-radius:9px;opacity:0;z-index:30}
#cp-log{position:absolute;right:60px;bottom:110px;width:820px;background:rgba(18,17,16,.96);border:1px solid #3a3631;border-radius:12px;padding:0 0 12px;font:400 28px/1.6 var(--mono);color:var(--muted);opacity:0;z-index:30;box-shadow:0 20px 50px rgba(0,0,0,.45)}
#cp-log .hd{font:500 18px var(--mono);color:var(--faint);padding:12px 18px;border-bottom:1px solid #2d2a26;margin-bottom:6px}#cp-log div{padding:0 18px;white-space:nowrap}#cp-log b{color:var(--accent);font-weight:500}`;
    const cams = [K.HOME, { ...K.frame([card[0], card[1] - 10, card[2], card[3] + 20]), t: 0.5, d: 0.6 }];
    const js = `tl.fromTo("#cp-res",{opacity:0,y:10},{opacity:1,y:0,duration:0.35,ease:"expo.out"},${r2(tRes - 0.1)});tl.to("#cp-res",{opacity:0,duration:0.2},${r2(tClick - 0.6)});
tl.fromTo("#cp-log",{opacity:0,y:20},{opacity:1,y:0,duration:0.4,ease:"expo.out"},${r2(tClick - 0.5)});
${evs.map((_, i) => `tl.fromTo("#cp-e${i}",{opacity:0},{opacity:1,duration:0.12},${r2(tClick - 0.35 + i * 0.12)});`).join("")}`;
    K.productScene(id, { src, shots, cams, css, js, after });
  }
  // voice: scroll to the line, play it with word timing, the takes and their scores
  {
    const id = "voice", [S0, D] = scenes.voice;
    const m0 = sT("scroll-lines") - 0.1, m1 = sT("takes") + 1.4;
    const shots = [{ start: 0, dur: D, m0, m1 }];
    const line = K.box(src, "line", "line"), strip = K.box(src, "line", "strip"), takes = K.box(src, "line", "takes");
    const rate = (m1 - m0) / D;
    const tKar = r2((sT("karaoke") - m0) / rate);
    const cams = [K.frame([line[0], line[1] - 40, line[2], line[3] + 80]), { ...K.frame([line[0], line[1], line[2], line[3]]), t: r2(tKar - 0.4), d: 0.55 }, { ...K.frame([strip[0], strip[1] - 10, strip[2] * 0.62, strip[3] + 70]), t: at("s05", "times", id) - 0.3, d: 0.55 }];
    const overlays = `<div class="hl" id="vc-hl" style="${K.hlRect(takes, 6)}"></div>`;
    const js = K.hlIn("#vc-hl", at("s05", "checks", id)) + `tl.to("#vc-hl",{opacity:0,duration:0.2},${r2(at("s05", "times", id) - 0.35)});`;
    K.productScene(id, { src, shots, cams, overlays, js });
  }
  // music: the film's timeline, music ducking under each line of voice
  {
    const id = "music", [S0, D] = scenes.music;
    const m0 = K.sceneT(src, "scroll-timeline") - 0.1, m1 = K.meta(src).duration - 0.2;
    const shots = [{ start: 0, dur: D, m0, m1 }];
    const tlb = K.box(src, "timeline", "tl"), mus = K.box(src, "timeline", "music");
    const cams = [K.frame([tlb[0], tlb[1] - 220, tlb[2], 260]), { ...K.frame([tlb[0], tlb[1], tlb[2], tlb[3]]), t: 0.9, d: 0.6 }];
    const overlays = `<div class="hl" id="mu-hl" style="${K.hlRect(mus, 4)}"></div>`;
    const js = K.hlIn("#mu-hl", at("s06", "ducks", id));
    K.productScene(id, { src, shots, cams, overlays, js });
  }
} else { placeholder("capture", "capture: run capture/flow.mjs"); placeholder("voice", "voice"); placeholder("music", "music"); }

// ======================= COMPOSE: build + check, for real =======================
if (has("video/assets/footage/build.mp4") && has("terminal/build.json")) {
  const id = "compose", [S0, D] = scenes.compose;
  const T = JSON.parse(fs.readFileSync(path.join(PROJECT, "terminal/build.json"), "utf8")); // {typeEnd, buildOut, checkTyped, checkOut, end}
  const shots = [
    { src: "build", start: 0, dur: 1.9, m0: 0.3, m1: T.buildOut + 0.6 },
    { src: "build", start: 1.9, dur: r2(D - 1.9), m0: T.checkOut - 1.0, m1: T.end },
  ];
  // build output sits at the top; the check summary fills the screen, "Check passed" at the bottom
  K.footageScene(id, { shots, cams: [{ scale: 1.3 }, { scale: 1.16, x: 0, y: -170, t: 1.9, d: 0.01 }, { scale: 1.12, x: 0, y: -128, t: r2(D - 1.4), d: 1.3, ease: "power1.inOut" }] });
} else placeholder("compose", "compose: record terminal/build.tape");

// ======================= LOCAL: doctor =======================
if (has("video/assets/footage/doctor.mp4")) {
  const id = "local", [S0, D] = scenes.local;
  const shots = [{ src: "doctor", start: 0, dur: D, m0: 0.5, m1: 5.0 }];
  const row = (i) => 200 + i * 52 - 26; // doctor rows: 0 = Apple Silicon ... 7 = VoxCPM2, 8 = WhisperX, 9 = ACE-Step
  const tMac = at("s08", "mac", id), tOpen = at("s08", "open", id);
  const overlays = `<div class="rail" id="lc-r1" style="top:${row(0)}px;height:52px"></div><div class="rail" id="lc-r2" style="top:${row(7)}px;height:156px"></div>`;
  const css = `.rail{position:absolute;left:40px;width:6px;border-radius:3px;background:var(--accent);opacity:0}`;
  const js = `tl.fromTo("#lc-r1",{opacity:0},{opacity:1,duration:0.2},${r2(tMac - 0.1)});tl.to("#lc-r1",{opacity:0,duration:0.2},${r2(tOpen - 0.2)});tl.fromTo("#lc-r2",{opacity:0},{opacity:1,duration:0.2},${r2(tOpen)});`;
  K.footageScene(id, { shots, overlays, css, js, cams: [{ scale: 1.25, x: 0, y: -60 }, { scale: 1.25, x: 0, y: -380, t: r2(tOpen - 0.5), d: 0.6 }] });
} else placeholder("local", "local: record terminal/doctor.tape");

// ======================= END CARD =======================
{
  const id = "end", [S0] = scenes.end;
  const css = `#root{background:var(--bg)}${DOTS}
#en-wrap{position:absolute;left:0;right:0;top:360px;display:flex;justify-content:center}
#en-line{position:absolute;left:640px;width:640px;top:628px;height:8px;border-radius:4px;background:var(--accent);transform-origin:50% 50%}
#en-cmd{position:absolute;left:0;right:0;top:690px;text-align:center;font:500 46px var(--mono);color:var(--text)}#en-cmd .p{color:var(--accent)}
#en-url{position:absolute;left:0;right:0;top:790px;text-align:center;font:400 30px var(--mono);color:var(--muted)}`;
  const html = `<div class="dots-bg"></div><div id="en-wrap">${WORDMARK("en-wm", 200)}</div><div id="en-line"></div>
<div id="en-cmd"><span class="p">$ </span>repotage new ./your-repo</div><div id="en-url">github.com/cjcsecurity/repotage</div>`;
  const tName = at("s09", "repotage", id), tRepo = at("s09", "repo", id), tFilm = at("s09", "film", id);
  const js = `
tl.fromTo("#en-wm",{opacity:0,y:40,filter:"blur(10px)"},{opacity:1,y:0,filter:"blur(0px)",duration:0.55,ease:"expo.out"},${r2(Math.max(0.1, tName - 0.25))});
tl.fromTo("#en-line",{scaleX:0},{scaleX:1,duration:0.5,ease:"power3.out"},${r2(tName + 0.1)});
tl.fromTo("#en-cmd",{opacity:0,y:14},{opacity:1,y:0,duration:0.4,ease:"expo.out"},${r2(tRepo - 0.2)});
tl.fromTo("#en-url",{opacity:0},{opacity:1,duration:0.45},${r2(tFilm)});
`;
  K.scene(id, css, html, js);
  K.addSfx("pop", S0 + tName, 0.3);
}

K.write({ title: "repotage" });
