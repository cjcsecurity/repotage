#!/usr/bin/env python3
"""Music with ACE-Step 1.5.

  music.py gen <project>     write audio/music/bed.toml from demo.json "music" and generate takes (run with system python)
  music.py bed <project>     film-aligned bed: place a take, keep it low before the reveal, duck under every line,
                             fade out -> video/assets/audio/music-bed.wav  (run in the align env)

demo.json "music": {"caption": "...", "bpm": 100, "key": "D minor", "duration": 105, "takes": 2,
                    "use": 0, "align": [film_s, file_s], "quiet_until": film_s, "gap_db": -9, "duck_db": 8, "quiet_db": -21}
"bed" reads video/build/plan.json (VO_AT, TOTAL) written by the composition build.
"""
import glob, json, os, shutil, subprocess, sys
mode, proj = sys.argv[1], os.path.abspath(sys.argv[2])
D = json.load(open(os.path.join(proj, "demo.json")))
M = D.get("music", {})
MUS = os.path.join(proj, "audio", "music")
os.makedirs(MUS, exist_ok=True)

if mode == "gen":
    ace = os.environ.get("DEMOFORGE_ACESTEP") or os.path.join(os.path.dirname(__file__), "..", ".vendor", "ACE-Step-1.5")
    out = os.path.join(MUS, "out")
    shutil.rmtree(out, ignore_errors=True)
    toml = f'''task_type = "text2music"
config_path = "acestep-v15-turbo"
lm_model_path = "acestep-5Hz-lm-1.7B"
save_dir = "{out}"
audio_format = "wav"
caption = {json.dumps(M.get("caption", "Minimal cinematic electronic underscore, pulsing synth bass, no vocals."))}
lyrics = "[Instrumental]"
instrumental = true
duration = {M.get("duration", 100)}
bpm = {M.get("bpm", 100)}
keyscale = "{M.get("key", "D minor")}"
timesignature = "4"
batch_size = {M.get("takes", 2)}
thinking = true
inference_steps = 8
'''
    open(os.path.join(MUS, "bed.toml"), "w").write(toml)
    env = dict(os.environ, ACESTEP_LM_BACKEND="mlx", TOKENIZERS_PARALLELISM="false")
    subprocess.run(["uv", "run", "python", "cli.py", "--config", os.path.join(MUS, "bed.toml")], cwd=ace, env=env, input=b"y\n", check=True)
    for k, f in enumerate(sorted(glob.glob(os.path.join(out, "*.wav")))):
        shutil.copy(f, os.path.join(MUS, f"take{k}.wav"))
        print("music", f"audio/music/take{k}.wav")
elif mode == "bed":
    import numpy as np, soundfile as sf
    from scipy.ndimage import uniform_filter1d
    plan = json.load(open(os.path.join(proj, "video", "build", "plan.json")))
    vo = json.load(open(os.path.join(proj, "audio", "vo_words.json")))
    y, sr = sf.read(os.path.join(MUS, f"take{M.get('use', 0)}.wav"))
    if y.ndim == 1:
        y = np.stack([y, y], 1)
    total = plan["TOTAL"]
    film_s, file_s = M.get("align", [0, 0])
    offset = film_s - file_s
    n = int(total * sr)
    out = np.zeros((n, 2))
    src0 = max(0, int(-offset * sr)); dst0 = max(0, int(offset * sr))
    seg = y[src0:src0 + n - dst0]
    out[dst0:dst0 + len(seg)] = seg
    t = np.arange(n) / sr
    quiet_until = M.get("quiet_until", 0)
    g = np.where(t < quiet_until, M.get("quiet_db", -21.0), M.get("gap_db", -9.0))
    ramp = (t >= quiet_until - 0.6) & (t < quiet_until)
    g[ramp] = M.get("quiet_db", -21.0) + (t[ramp] - (quiet_until - 0.6)) / 0.6 * (M.get("gap_db", -9.0) - M.get("quiet_db", -21.0))
    duck = np.zeros(n)
    for k, at in plan["VO_AT"].items():
        duck[(t >= at - 0.15) & (t < at + vo[k]["duration"] + 0.4)] = 1
    duck = uniform_filter1d(duck, size=int(0.25 * sr))
    g = g - M.get("duck_db", 8.0) * duck * (t >= quiet_until)
    lin = 10 ** (g / 20)
    fi = t < max(offset, 0) + 1.5
    lin[fi] *= np.clip((t[fi] - max(offset, 0)) / 1.5, 0, 1)
    fo = t > total - 3.0
    lin[fo] *= np.clip((total - t[fo]) / 3.0, 0, 1)
    out *= lin[:, None]
    pk = np.abs(out).max() or 1
    out *= min(1.0, 10 ** (-1.5 / 20) / pk)
    os.makedirs(os.path.join(proj, "video", "assets", "audio"), exist_ok=True)
    sf.write(os.path.join(proj, "video", "assets", "audio", "music-bed.wav"), out.astype(np.float32), sr)
    json.dump({"offset": offset, "gain_db": g[::sr // 50].round(2).tolist(), "rate": 50}, open(os.path.join(proj, "audio", "music", "bed_envelope.json"), "w"))
    print(f"music bed {total:.1f} s, take{M.get('use', 0)}, offset {offset:+.2f} s")
else:
    sys.exit(f"unknown mode {mode}")
