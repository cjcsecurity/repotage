#!/usr/bin/env python3
"""Narration with VoxCPM2 on mlx-audio (Apple Silicon). Run in the voice env.

  voice.py <project> audition N        N voice-design takes of script.audition  -> audio/vo/audition_k.wav
  voice.py <project> lines [ids...]     every line (or just ids), cloned from audio/vo/ref_voice.wav
  voice.py <project> takes N ids...     N extra takes of the named lines        -> audio/vo/<id>_t<k>.wav
  voice.py <project> chain N [ids...]   N takes per line, each read as a continuation of the line before it
                                        (its picked take from audio/vo_words.json), so the narration flows like one read

script.json: {"voice": design prompt, "style": delivery prompt, "audition": text, "lines": [{"id","text"}]}
Write numbers and acronyms the way they should be spoken ("O T X", "Mac O S"), or keep "text" as written
and add "say" with the spoken spelling ({"text": "It's called Repotage.", "say": "It's called Repo-tahzh."}).
"""
import json, os, sys, time
import numpy as np, soundfile as sf

proj, mode = sys.argv[1], sys.argv[2]
S = json.load(open(os.path.join(proj, "script.json")))

import re as _re
for _ln in S["lines"]:
    if not _re.fullmatch(r"[A-Za-z0-9_-]{1,32}", str(_ln.get("id", ""))):
        sys.exit(f"script.json: line id {_ln.get('id')!r} must be letters, digits, _ or - (it becomes a file name)")
VO = os.path.join(proj, "audio", "vo")
os.makedirs(VO, exist_ok=True)
MODEL = S.get("model", "mlx-community/VoxCPM2-bf16")
REVISION = S.get("model_revision", "a7fb80d9056983135a54ca3f71fcc5a637ccddf5" if MODEL == "mlx-community/VoxCPM2-bf16" else None)

from huggingface_hub import snapshot_download
from mlx_audio.tts.utils import load
model = load(snapshot_download(MODEL, revision=REVISION))  # a pinned revision, not whatever is newest

STEPS = int(S.get("steps", 24))   # diffusion steps per patch: more is cleaner and slower (VoxCPM default 10)
CFG = float(S.get("cfg", 2.0))
def synth(text, **kw):
    t = time.time()
    a = np.concatenate([np.array(r.audio, dtype=np.float32) for r in model.generate(text=text, inference_timesteps=STEPS, cfg_value=CFG, **kw)])
    print(f"  {len(a) / 48000:.2f} s audio in {time.time() - t:.1f} s", flush=True)
    return a

ref = os.path.join(VO, "ref_voice.wav")
# "continue" mode: the line is generated as a continuation of the reference recording (and its text), so it
# inherits that delivery's rhythm and intonation instead of a style prompt. Usually the most natural reads.
CONT = os.environ.get("REPOTAGE_VOICE_MODE", "continue") == "continue"
def read(text):
    if CONT:
        return synth(" " + text, ref_audio=ref, prompt_audio=ref, prompt_text=S["audition"])
    return synth(text, ref_audio=ref, instruct=S.get("style"))
if mode == "audition":
    for k in range(int(sys.argv[3])):
        sf.write(os.path.join(VO, f"audition_{k}.wav"), synth(S["audition"], instruct=S["voice"]), 48000)
        print("audition", k, flush=True)
elif mode == "lines":
    only = set(sys.argv[3:])
    for ln in S["lines"]:
        if not only or ln["id"] in only:
            sf.write(os.path.join(VO, f"{ln['id']}.wav"), read(ln.get("say", ln["text"])), 48000)
            print("line", ln["id"], flush=True)
elif mode == "takes":
    n, ids = int(sys.argv[3]), set(sys.argv[4:])
    for ln in S["lines"]:
        if ln["id"] in ids:
            start = len([f for f in os.listdir(VO) if f.startswith(ln["id"] + "_t")])
            for k in range(start, start + n):
                sf.write(os.path.join(VO, f"{ln['id']}_t{k}.wav"), read(ln.get("say", ln["text"])), 48000)
                print("take", ln["id"], k, flush=True)
elif mode == "chain":
    n, ids = int(sys.argv[3]), set(sys.argv[4:])
    picked = json.load(open(os.path.join(proj, "audio", "vo_words.json"))) if os.path.exists(os.path.join(proj, "audio", "vo_words.json")) else {}
    prev_audio, prev_text = ref, S["audition"]
    for ln in S["lines"]:
        if not ids or ln["id"] in ids:
            start = len([f for f in os.listdir(VO) if f.startswith(ln["id"] + "_t")])
            for k in range(start, start + n):
                a = synth(" " + ln.get("say", ln["text"]), ref_audio=ref, prompt_audio=prev_audio, prompt_text=prev_text)
                sf.write(os.path.join(VO, f"{ln['id']}_t{k}.wav"), a, 48000)
                print("chain", ln["id"], k, flush=True)
        # the next line continues from this line's picked take (or its plain take if none is picked yet)
        take = picked.get(ln["id"], {}).get("take") or f"audio/vo/{ln['id']}.wav"
        if os.path.exists(os.path.join(proj, take)):
            prev_audio, prev_text = os.path.join(proj, take), ln.get("say", ln["text"])
else:
    sys.exit(f"unknown mode {mode}")
