#!/usr/bin/env python3
"""Score every narration wav in a project with WhisperX (run in the align env).
Adds new results to audio/align/scores.json: transcript, word error rate, pitch, pace, loudness, word timings.
Usage: score_project.py <project> [auditions]"""
import glob, json, os, re, subprocess, sys
proj = sys.argv[1]
S = json.load(open(os.path.join(proj, "script.json")))
text = {l["id"]: l["text"] for l in S["lines"]}
out = os.path.join(proj, "audio", "align", "scores.json")
os.makedirs(os.path.dirname(out), exist_ok=True)
have = json.load(open(out)) if os.path.exists(out) else {}
items = []
for p in sorted(glob.glob(os.path.join(proj, "audio", "vo", "*.wav"))):
    name = os.path.basename(p)[:-4]
    if name == "ref_voice":
        continue
    if name.startswith("audition_"):
        ref = S.get("audition", "")
    else:
        ref = text.get(re.sub(r"_t\d+$", "", name))
    if ref is None:
        continue
    key = os.path.relpath(p, proj)
    if key in have and have[key].get("mtime") == os.path.getmtime(p):
        continue
    items.append([p, ref])
if items:
    tmp = out + ".new.json"
    subprocess.run([sys.executable, os.path.join(os.path.dirname(__file__), "score.py"), json.dumps(items), tmp], check=True)
    for p, v in json.load(open(tmp)).items():
        v["mtime"] = os.path.getmtime(p)
        have[os.path.relpath(p, proj)] = v
    os.remove(tmp)
json.dump(have, open(out, "w"), indent=1)
for k, v in sorted(have.items()):
    print(f"{k:28s} cer {v.get('cer', v['wer']):.3f}  tail {v.get('tail_db', 0):4.0f} dB  pace {v['wps']:.2f} w/s  f0 {v['f0_med']:.0f} Hz  {v['dur']:.2f} s  {','.join(v.get('prosody_flags', [])) or 'clean':14s} | {v['text']}")
