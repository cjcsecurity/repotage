"""Transcribe + word-align wavs with WhisperX; report accuracy, pitch, pace, loudness."""
import sys, json, re, warnings
warnings.filterwarnings("ignore")
import numpy as np, librosa, pyloudnorm as pyln, whisperx

def norm(s): return re.findall(r"[a-z0-9']+", s.lower().replace("-", " "))
def cer(ref, hyp):
    # character error rate on letters and digits only, so "Vox C P M" == "VoxCPM" and "Gee Sap" ~ "GSAP" stay comparable
    r = re.sub(r"[^a-z0-9]", "", ref.lower()); h = re.sub(r"[^a-z0-9]", "", hyp.lower())
    d = list(range(len(h) + 1))
    for i in range(1, len(r) + 1):
        prev, d[0] = d[0], i
        for j in range(1, len(h) + 1):
            prev, d[j] = d[j], min(d[j] + 1, d[j - 1] + 1, prev + (r[i - 1] != h[j - 1]))
    return d[-1] / max(1, len(r))
def wer(ref, hyp):
    r, h = norm(ref), norm(hyp)
    d = np.zeros((len(r)+1, len(h)+1), int); d[:,0] = range(len(r)+1); d[0,:] = range(len(h)+1)
    for i in range(1,len(r)+1):
        for j in range(1,len(h)+1):
            d[i,j] = min(d[i-1,j]+1, d[i,j-1]+1, d[i-1,j-1]+(r[i-1]!=h[j-1]))
    return d[-1,-1]/max(1,len(r))

def prosody(y, sr, f0, vf, words):
    """Intonation checks a listener notices: statements that end rising (uptalk), pitch glitches,
    a flat or erratic range, and pauses in the middle of a phrase."""
    hop = 512
    t = librosa.times_like(f0, sr=sr, hop_length=hop)
    f = np.where(vf, f0, np.nan)
    med = np.nanmedian(f)
    st = 12 * np.log2(f / med)
    # smooth tracker noise: 5-frame running median over voiced frames
    sm = st.copy()
    for i in range(len(st)):
        w = st[max(0, i - 2):i + 3]; w = w[~np.isnan(w)]
        sm[i] = np.median(w) if len(w) else np.nan
    v = ~np.isnan(sm)
    sd = float(np.nanstd(sm)) if v.any() else 0.0
    d = np.abs(np.diff(sm)); d = d[~np.isnan(d)]
    jumps = float(np.sum((d > 4) & (d < 10)) / (len(y) / sr))   # >4 st in 21 ms, excluding octave-tracker errors
    # sentence ends: last word, and any word ending in . ! ?
    ends = [w for w in words if re.search(r"[.!?]$", w.get("word", ""))] or words[-1:]
    rise = 0.0
    for w in ends:
        seg = (t >= w["start"]) & (t <= w["end"] + 0.15) & v
        idx = np.where(seg)[0]
        if len(idx) >= 6:
            h = len(idx) // 2
            rise = max(rise, float(np.median(sm[idx[h:]]) - np.median(sm[idx[:h]])))
    gaps = [b["start"] - a["end"] for a, b in zip(words, words[1:]) if not re.search(r"[,.!?:;]$", a.get("word", ""))]
    max_pause = float(max(gaps)) if gaps else 0.0
    flags = [n for n, bad in (("uptalk", rise > 1.5), ("glitchy", jumps > 1.0), ("flat", sd < 1.2), ("erratic", sd > 5.0 and jumps > 0.6), ("pause", max_pause > 0.35)) if bad]
    pen = max(0, rise - 1.0) * 0.8 + max(0, jumps - 0.5) * 0.6 + max(0, sd - 4.5) * 0.5 + max(0, 1.2 - sd) + max(0, max_pause - 0.35) * 3
    return {"end_rise_st": round(rise, 2), "pitch_sd_st": round(sd, 2), "jumps_per_s": round(jumps, 2), "max_pause_s": round(max_pause, 2), "prosody_flags": flags, "prosody_pen": round(pen, 3)}

model = whisperx.load_model("large-v3", "cpu", compute_type="int8", language="en")
amodel, meta = whisperx.load_align_model(language_code="en", device="cpu")
out = {}
items = json.loads(sys.argv[1])  # [[path, reference_text], ...]
for path, ref in items:
    audio = whisperx.load_audio(path)
    res = model.transcribe(audio, batch_size=4, language="en")
    al = whisperx.align(res["segments"], amodel, meta, audio, "cpu", return_char_alignments=False)
    words = [w for s in al["segments"] for w in s.get("words", []) if "start" in w]
    text = " ".join(s["text"].strip() for s in res["segments"])
    y, sr = librosa.load(path, sr=24000)
    f0, vf, _ = librosa.pyin(y, fmin=60, fmax=400, sr=sr)
    lufs = pyln.Meter(sr).integrated_loudness(y)
    tail_db = float(20*np.log10(np.sqrt(np.mean(y[-int(0.08*sr):]**2))+1e-9))  # loud tail = generation cut off mid-word
    dur = len(y)/sr
    out[path] = {"text": text, "wer": round(wer(ref, text),3), "cer": round(cer(ref, text),3), "f0_med": float(np.nanmedian(f0)), "f0_iqr": float(np.nanpercentile(f0,75)-np.nanpercentile(f0,25)),
                 "dur": round(dur,2), "wps": round(len(norm(ref))/dur,2), "lufs": round(lufs,1), "tail_db": round(tail_db,1), "lead": round(words[0]["start"],2) if words else None,
                 "tail": round(dur-words[-1]["end"],2) if words else None, "words": words}
    out[path].update(prosody(y, sr, f0, vf, words) if words else {"prosody_pen": 9, "prosody_flags": ["no words"]})
    print(path, round(out[path]['cer'],3), out[path].get('prosody_flags'), out[path]['text'], flush=True)
json.dump(out, open(sys.argv[2], "w"), indent=1)
