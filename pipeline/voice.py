#!/usr/bin/env python3
"""Narration with VoxCPM2 on mlx-audio (Apple Silicon). Run in the voice env.

  voice.py <project> audition N        N voice-design takes of script.audition  -> audio/vo/audition_k.wav
  voice.py <project> lines [ids...]     every line (or just ids), cloned from audio/vo/ref_voice.wav
  voice.py <project> takes N ids...     N extra takes of the named lines        -> audio/vo/<id>_t<k>.wav

script.json: {"voice": design prompt, "style": delivery prompt, "audition": text, "lines": [{"id","text"}]}
Write numbers and acronyms the way they should be spoken ("O T X", "Mac O S").
"""
import json, os, sys, time
import numpy as np, soundfile as sf

proj, mode = sys.argv[1], sys.argv[2]
S = json.load(open(os.path.join(proj, "script.json")))
VO = os.path.join(proj, "audio", "vo")
os.makedirs(VO, exist_ok=True)
MODEL = S.get("model", "mlx-community/VoxCPM2-bf16")

from mlx_audio.tts.utils import load
model = load(MODEL)

def synth(text, **kw):
    t = time.time()
    a = np.concatenate([np.array(r.audio, dtype=np.float32) for r in model.generate(text=text, inference_timesteps=16, cfg_value=2.0, **kw)])
    print(f"  {len(a) / 48000:.2f} s audio in {time.time() - t:.1f} s", flush=True)
    return a

ref = os.path.join(VO, "ref_voice.wav")
if mode == "audition":
    for k in range(int(sys.argv[3])):
        sf.write(os.path.join(VO, f"audition_{k}.wav"), synth(S["audition"], instruct=S["voice"]), 48000)
        print("audition", k, flush=True)
elif mode == "lines":
    only = set(sys.argv[3:])
    for ln in S["lines"]:
        if not only or ln["id"] in only:
            sf.write(os.path.join(VO, f"{ln['id']}.wav"), synth(ln["text"], ref_audio=ref, instruct=S.get("style")), 48000)
            print("line", ln["id"], flush=True)
elif mode == "takes":
    n, ids = int(sys.argv[3]), set(sys.argv[4:])
    for ln in S["lines"]:
        if ln["id"] in ids:
            start = len([f for f in os.listdir(VO) if f.startswith(ln["id"] + "_t")])
            for k in range(start, start + n):
                sf.write(os.path.join(VO, f"{ln['id']}_t{k}.wav"), synth(ln["text"], ref_audio=ref, instruct=S.get("style")), 48000)
                print("take", ln["id"], k, flush=True)
else:
    sys.exit(f"unknown mode {mode}")
