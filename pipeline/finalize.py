#!/usr/bin/env python3
"""Pick the best take of every line, trim silence, normalize to -16 LUFS (-1.5 dBFS peak),
write video/assets/audio/vo-<id>.wav and audio/vo_words.json (word timings per file).
Best take = lowest word error rate, then pace closest to the line median. Override with
"pick": {"s03": "s03_t2"} in script.json. Run in the align env.
Usage: finalize.py <project>"""
import json, os, re, sys
import numpy as np, soundfile as sf, pyloudnorm as pyln

def speech_bounds(y, sr, first_start, last_start, last_end):
    """Where speech really starts and stops. Forced alignment often ends the last word early,
    so the end comes from loudness (20 ms RMS above max(-45 dBFS, peak - 40 dB)), never earlier
    than the aligned end."""
    mono = y.mean(1) if y.ndim > 1 else y
    hop = int(0.02 * sr)
    rms = np.array([np.sqrt(np.mean(mono[i:i + hop] ** 2)) for i in range(0, len(mono) - hop, hop)])
    db = 20 * np.log10(rms + 1e-9)
    thr = max(-45.0, db.max() - 40.0)
    loud = np.where(db > thr)[0]
    after = loud[loud * hop / sr >= last_start]
    end = (after[-1] + 1) * hop / sr + 0.15 if len(after) else last_end + 0.15
    before = loud[loud * hop / sr <= first_start + 0.05]
    start = before[0] * hop / sr - 0.06 if len(before) else first_start - 0.06
    return max(0.0, min(start, first_start - 0.06)), min(len(mono) / sr, max(end, last_end + 0.12))


def norm_tok(x):
    return re.sub(r"[^a-z0-9]", "", x.lower())

def judged(v, ref_text):
    """Re-judge a take's intonation against the script: a pause after a word the script punctuates is a
    breath, not a hesitation; wide pitch spread only counts as erratic when it comes with jumps."""
    ref = [(norm_tok(t), bool(re.search(r"[,.!?:;]$", t))) for t in ref_text.split()]
    words = v.get("words", [])
    punct, j = [], 0
    for w in words:
        n = norm_tok(w.get("word", "")); hit = False
        for k in range(j, min(j + 4, len(ref))):
            if ref[k][0] and (ref[k][0] == n or ref[k][0].startswith(n) or n.startswith(ref[k][0])):
                hit = ref[k][1]; j = k + 1; break
        punct.append(hit or bool(re.search(r"[,.!?:;]$", w.get("word", ""))))
    gaps = [b["start"] - a["end"] for a, b, p in zip(words, words[1:], punct) if not p]
    pause = max(gaps) if gaps else 0.0
    pen = v.get("prosody_pen", 0) - max(0, v.get("max_pause_s", 0) - 0.35) * 3 + max(0, pause - 0.35) * 3
    flags = [f for f in v.get("prosody_flags", []) if f not in ("pause", "erratic")]
    if pause > 0.35: flags.append("pause")
    if v.get("pitch_sd_st", 0) > 5.0 and v.get("jumps_per_s", 0) > 0.6: flags.append("erratic")
    return pen, flags

proj = sys.argv[1]
S = json.load(open(os.path.join(proj, "script.json")))

import re as _re
for _ln in S["lines"]:
    if not _re.fullmatch(r"[A-Za-z0-9_-]{1,32}", str(_ln.get("id", ""))):
        sys.exit(f"script.json: line id {_ln.get('id')!r} must be letters, digits, _ or - (it becomes a file name)")
scores = json.load(open(os.path.join(proj, "audio", "align", "scores.json")))
out_dir = os.path.join(proj, "video", "assets", "audio")
os.makedirs(out_dir, exist_ok=True)
paces = [v["wps"] for k, v in scores.items() if "audition" not in k]
med = float(np.median(paces)) if paces else 2.8
# pitch of the reference voice (the audition kept with `voice use`), to keep every line sounding like one person
ref_path = os.path.join(proj, "audio", "vo", "ref_voice.wav")
ref_f0 = None
if os.path.exists(ref_path):
    for k, v in scores.items():
        if "audition_" in k and os.path.getsize(os.path.join(proj, k)) == os.path.getsize(ref_path):
            ref_f0 = v["f0_med"]
if not ref_f0 or ref_f0 != ref_f0:
    ref_f0 = float(np.nanmedian([v["f0_med"] for v in scores.values()]))
res = {}
for ln in S["lines"]:
    lid = ln["id"]
    for k, v in scores.items():
        if re.fullmatch(rf"audio/vo/{lid}(_t\d+)?\.wav", k):
            v["_pen"], v["_flags"] = judged(v, ln["text"])
    cands = {k: v for k, v in scores.items() if re.fullmatch(rf"audio/vo/{lid}(_t\d+)?\.wav", k)}
    if not cands:
        sys.exit(f"no scored take for {lid}")
    forced = S.get("pick", {}).get(lid)
    key = f"audio/vo/{forced}.wav" if forced else min(cands, key=lambda k: (int(cands[k].get("cer", cands[k]["wer"]) // 0.06) + (cands[k].get("tail_db", -99) > -45), cands[k].get("_pen", 0) + abs((cands[k]["f0_med"] if cands[k]["f0_med"] == cands[k]["f0_med"] else ref_f0) - ref_f0) / 40 + abs(cands[k]["wps"] - med)))
    v = scores[key]
    y, sr = sf.read(os.path.join(proj, key))
    w = v["words"]
    a, b = speech_bounds(y, sr, w[0]["start"], w[-1]["start"], w[-1]["end"])
    seg = y[int(a * sr):int(b * sr)].astype(np.float64)
    f = int(0.01 * sr)
    seg[:f] *= np.linspace(0, 1, f)
    seg[-f:] *= np.linspace(1, 0, f)
    meter = pyln.Meter(sr)
    import warnings
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        seg = pyln.normalize.loudness(seg, meter.integrated_loudness(seg), -16.0)
    pk = np.max(np.abs(seg))
    if pk > 10 ** (-1.5 / 20):
        seg *= 10 ** (-1.5 / 20) / pk
    sf.write(os.path.join(out_dir, f"vo-{lid}.wav"), seg.astype(np.float32), sr)
    res[lid] = {"take": key, "file": f"assets/audio/vo-{lid}.wav", "duration": round(len(seg) / sr, 3), "wer": v["wer"],
                "words": [{"text": x["word"], "start": round(x["start"] - a, 3), "end": round(x["end"] - a, 3)} for x in w]}
    print(f"{lid}  {key:24s} {res[lid]['duration']:.2f} s  {','.join(v.get('_flags', [])) or 'clean':16s} cer {v.get('cer', v['wer']):.3f}  f0 {v['f0_med']:.0f} Hz (ref {ref_f0:.0f})")
json.dump(res, open(os.path.join(proj, "audio", "vo_words.json"), "w"), indent=1)
