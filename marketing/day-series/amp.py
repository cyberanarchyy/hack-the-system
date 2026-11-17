# Per-frame mouth movement for the avatar from a voiceover WAV (30 fps).
# Usage: python amp.py vo.wav amp.json
import sys, json, numpy as np, soundfile as sf
a, sr = sf.read(sys.argv[1]); a = a if a.ndim == 1 else a.mean(1)
hop = sr // 30
out = np.array([float(np.sqrt(np.mean(a[i*hop:(i+1)*hop]**2))) for i in range(len(a) // hop)])
loud = out[out > 0.005]
out = np.clip(out / (np.percentile(loud, 95) if len(loud) else 1), 0, 1.2)
json.dump([round(x, 3) for x in np.convolve(out, [0.25, 0.5, 0.25], mode='same')], open(sys.argv[2], 'w'))
