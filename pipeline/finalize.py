#!/usr/bin/env python3
"""Pick the best take of every line, trim silence, normalize to -16 LUFS (-1.5 dBFS peak),
write video/assets/audio/vo-<id>.wav and audio/vo_words.json (word timings per file).
Best take = lowest word error rate, then pace closest to the line median. Override with
"pick": {"s03": "s03_t2"} in script.json. Run in the align env.
Usage: finalize.py <project>"""
import json, os, re, sys
import numpy as np, soundfile as sf, pyloudnorm as pyln
proj = sys.argv[1]
S = json.load(open(os.path.join(proj, "script.json")))
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
    cands = {k: v for k, v in scores.items() if re.fullmatch(rf"audio/vo/{lid}(_t\d+)?\.wav", k)}
    if not cands:
        sys.exit(f"no scored take for {lid}")
    forced = S.get("pick", {}).get(lid)
    key = f"audio/vo/{forced}.wav" if forced else min(cands, key=lambda k: (int(cands[k].get("cer", cands[k]["wer"]) // 0.06), abs((cands[k]["f0_med"] if cands[k]["f0_med"] == cands[k]["f0_med"] else ref_f0) - ref_f0) / 40 + abs(cands[k]["wps"] - med)))
    v = scores[key]
    y, sr = sf.read(os.path.join(proj, key))
    w = v["words"]
    a = max(0.0, w[0]["start"] - 0.06)
    b = min(len(y) / sr, w[-1]["end"] + 0.12)
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
    print(f"{lid}  {key:24s} {res[lid]['duration']:.2f} s  cer {v.get('cer', v['wer']):.3f}  f0 {v['f0_med']:.0f} Hz (ref {ref_f0:.0f})")
json.dump(res, open(os.path.join(proj, "audio", "vo_words.json"), "w"), indent=1)
