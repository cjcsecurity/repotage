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
    dur = len(y)/sr
    out[path] = {"text": text, "wer": round(wer(ref, text),3), "cer": round(cer(ref, text),3), "f0_med": float(np.nanmedian(f0)), "f0_iqr": float(np.nanpercentile(f0,75)-np.nanpercentile(f0,25)),
                 "dur": round(dur,2), "wps": round(len(norm(ref))/dur,2), "lufs": round(lufs,1), "lead": round(words[0]["start"],2) if words else None,
                 "tail": round(dur-words[-1]["end"],2) if words else None, "words": words}
    print(path, round(out[path]['cer'],3), out[path]['text'], flush=True)
json.dump(out, open(sys.argv[2], "w"), indent=1)
