#!/usr/bin/env python3
"""Resample a recorded clip to constant 30 fps: output frame n shows the newest
screencast frame at or before t0 + n/30. Writes <clipdir>.mp4 next to the folder.
Usage: encode.py <clipdir> [<clipdir> ...]"""
import bisect, json, os, shutil, subprocess, sys

FPS = 30
for c in sys.argv[1:]:
    c = c.rstrip("/")
    m = json.load(open(f"{c}/meta.json"))
    fr, t0, t_end = m["frames"], m["t0"], m["tEnd"]
    ts = [f["t"] for f in fr]
    out = f"{c}/cfr"
    shutil.rmtree(out, ignore_errors=True)
    os.makedirs(out)
    n = int((t_end - t0) * FPS)
    for i in range(n):
        k = max(0, bisect.bisect_right(ts, t0 + i / FPS) - 1)
        os.link(f"{c}/{fr[k]['file']}", f"{out}/{i:05d}.jpg")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-framerate", str(FPS), "-i", f"{out}/%05d.jpg",
                    "-c:v", "libx264", "-preset", "slow", "-crf", "12", "-pix_fmt", "yuv420p", "-g", "15",
                    "-movflags", "+faststart", f"{c}.mp4"], check=True)
    shutil.rmtree(out)
    print(f"{c}.mp4  {n / FPS:.2f} s")
