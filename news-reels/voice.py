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

clips, sr = [], 24000
for sc in story["scenes"]:
    if sc.get("say"):
        a, sr = k.create(sc["say"], voice=voice, speed=speed, lang="en-us")
        nz = np.where(np.abs(a) > 0.01)[0]          # trim leading/trailing silence
        a = a[max(0, nz[0] - 600): nz[-1] + 1200] if len(nz) else a
    else:
        a = np.zeros(0, dtype=np.float32)
    clips.append(a)
    sc["dur"] = round(max(sc["dur"] if not sc.get("say") else 0, LEAD + len(a) / sr + TAIL), 2)

total = sum(sc["dur"] for sc in story["scenes"])
track = np.zeros(int((total + 1) * sr), dtype=np.float32)
t = 0.0
for sc, a in zip(story["scenes"], clips):
    i = int((t + LEAD) * sr); track[i:i + len(a)] += a; t += sc["dur"]
track = track / (np.abs(track).max() + 1e-9) * 0.95
sf.write(os.path.join(out_dir, name + ".vo.wav"), track, sr)
json.dump(story, open(os.path.join(out_dir, name + ".timed.json"), "w"), indent=2)
print(f"voiceover: {total:.1f}s, voice={voice}")
