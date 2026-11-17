import sys, json, soundfile as sf, numpy as np
from kokoro_onnx import Kokoro
k = Kokoro("kokoro-v1.0.onnx", "voices-v1.0.bin")
import json as _j
LINES = _j.load(open(sys.argv[3]))
voice, out = sys.argv[1], sys.argv[2]
SR = 24000
track = np.zeros(int(float(sys.argv[4]) * SR), dtype=np.float32)
report = []
for start, maxlen, text in LINES:
    speed = 1.1
    while True:
        audio, sr = k.create(text, voice=voice, speed=speed, lang=sys.argv[5] if len(sys.argv) > 5 else "en-us")
        # trim silence
        nz = np.where(np.abs(audio) > 0.01)[0]
        audio = audio[nz[0]:nz[-1] + 1] if len(nz) else audio
        if len(audio) / sr <= maxlen or speed >= 1.45: break
        speed += 0.05
    s = int(start * SR)
    e = min(len(track), s + len(audio))
    track[s:e] += audio[: e - s]
    report.append((text, round(len(audio) / sr, 2), maxlen, round(speed, 2)))
sf.write(out, track, SR)
print(json.dumps(report, indent=0))
