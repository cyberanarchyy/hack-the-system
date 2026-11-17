"""Voiceover: synthesize each scene's "say" line with Kokoro TTS (runs offline).

Stretches scene durations so every line fits, and writes:
  out/<name>.vo.wav        the voice track, aligned to scene starts
  out/<name>.timed.json    the story with final scene durations
usage: python3 voice.py story.json outdir
"""
import json, os, sys
import numpy as np, soundfile as sf
from kokoro_onnx import Kokoro

HERE = os.path.dirname(os.path.abspath(__file__))
LEAD, TAIL = 0.15, 0.45   # silence before / after each line within its scene

story_path, out_dir = sys.argv[1], sys.argv[2]
name = os.path.splitext(os.path.basename(story_path))[0]
story = json.load(open(story_path))
k = Kokoro(os.path.join(HERE, "models/kokoro-v1.0.fp16.onnx"), os.path.join(HERE, "models/voices-v1.0.bin"))
voice, speed = story.get("voice", "af_heart"), story.get("speed", 1.1)
LEAD, TAIL = story.get("lead", LEAD), story.get("tail", TAIL)

clips, sr = [], 24000
for sc in story["scenes"]:
    if sc.get("say"):
        a, sr = k.create(sc["say"], voice=voice, speed=speed, lang="en-us")
        nz = np.where(np.abs(a) > 0.01)[0]          # trim leading/trailing silence
        a = a[max(0, nz[0] - 600): nz[-1] + 1200] if len(nz) else a
    else:
        a = np.zeros(0, dtype=np.float32)
    clips.append(a)
    # estimate per-word timings for captions (weighted by length, pauses at punctuation)
    shown = (sc.get("display") or sc.get("say") or "").split()
    if shown and len(a):
        wts = [len(w.strip(".,?!")) + 2 + (4 if w[-1] in ".?!" else 2 if w[-1] in ",;:" else 0) for w in shown]
        span, acc, words = len(a) / sr, 0.0, []
        for w, wt in zip(shown, wts):
            st = LEAD + span * acc / sum(wts); acc += wt
            words.append({"w": w, "s": round(st, 3), "e": round(LEAD + span * acc / sum(wts), 3)})
        sc["words"] = words
    sc["dur"] = round(max(sc.get("min", 0), sc["dur"] if not sc.get("say") else 0, LEAD + len(a) / sr + TAIL + sc.get("hold", 0)), 2)

total = sum(sc["dur"] for sc in story["scenes"])
track = np.zeros(int((total + 1) * sr), dtype=np.float32)
t = 0.0
for sc, a in zip(story["scenes"], clips):
    i = int((t + LEAD) * sr); track[i:i + len(a)] += a; t += sc["dur"]
track = track / (np.abs(track).max() + 1e-9) * 0.95
sf.write(os.path.join(out_dir, name + ".vo.wav"), track, sr)
json.dump(story, open(os.path.join(out_dir, name + ".timed.json"), "w"), indent=2)

# subtitles (.srt): ~8-word lines from the estimated word timings
def ts(x):
    ms = int(round(x * 1000)); return f"{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02},{ms%1000:03}"
cues, t0 = [], 0.0
for sc in story["scenes"]:
    ws = sc.get("words", []); i = 0
    while i < len(ws):
        j = i
        while j < len(ws) - 1 and j - i < 9 and not ws[j]["w"][-1] in ".?!": j += 1
        cues.append((t0 + ws[i]["s"], t0 + ws[j]["e"] + 0.05, " ".join(w["w"] for w in ws[i:j + 1]))); i = j + 1
    t0 += sc["dur"]
with open(os.path.join(out_dir, name + ".srt"), "w") as f:
    for k, (a, b, txt) in enumerate(cues, 1): f.write(f"{k}\n{ts(a)} --> {ts(b)}\n{txt}\n\n")
# YouTube chapters
chap, t0 = [], 0.0
for sc in story["scenes"]:
    if sc["type"] in ("title", "chapter") and sc.get("chapterName", sc.get("title")):
        chap.append(f"{int(t0//60)}:{int(t0%60):02} {sc.get('chapterName') or sc['title']}")
    t0 += sc["dur"]
if chap:
    if not chap[0].startswith("0:00"): chap[0] = "0:00 " + chap[0].split(" ", 1)[1]
    open(os.path.join(out_dir, name + ".chapters.txt"), "w").write("\n".join(chap) + "\n")
print(f"voiceover: {total:.1f}s, voice={voice}")
