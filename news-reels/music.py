"""Generate a royalty-free synth beat (WAV) timed to the reel's scene cuts.

usage: python3 music.py story.json out.wav
"""
import json, sys, wave
import numpy as np

SR = 44100
BPM = 124
story = json.load(open(sys.argv[1]))
durs = [s["dur"] for s in story["scenes"]]
total = sum(durs)
n = int(SR * (total + 0.5))
mix = np.zeros(n)
beat = 60 / BPM
rng = np.random.default_rng(7)

def add(sig, t, gain=1.0):
    i = int(t * SR)
    if i >= n: return
    j = min(n, i + len(sig))
    mix[i:j] += sig[: j - i] * gain

def env(length, decay):
    tt = np.arange(int(SR * length)) / SR
    return np.exp(-tt / decay), tt

# kick
e, tt = env(0.35, 0.09)
kick = np.sin(2 * np.pi * (45 + 110 * np.exp(-tt / 0.03)) * tt) * e
# hat
e, tt = env(0.06, 0.012)
hat = rng.uniform(-1, 1, len(tt)) * e
hat = np.diff(hat, prepend=0)  # crude highpass
# clap
e, tt = env(0.2, 0.05)
clap = rng.uniform(-1, 1, len(tt)) * e

# bass line (minor, A - F - C - G)
roots = [55.0, 43.65, 65.41, 49.0]
step = 0
t = 0.0
while t < total:
    bar = int(t / (beat * 4)) % 4
    if step % 4 == 0: add(kick, t, 0.9)
    if step % 8 == 4: add(clap, t, 0.35)
    if step % 2 == 1: add(hat, t, 0.25)
    if step % 2 == 0:
        e, tt = env(beat * 0.5, 0.12)
        f = roots[bar] * (2 if step % 8 == 6 else 1)
        bass = np.tanh(2.5 * np.sin(2 * np.pi * f * tt)) * e
        add(bass, t, 0.35)
    # pluck arpeggio
    if step % 2 == 0:
        e, tt = env(0.25, 0.07)
        f = roots[bar] * 8 * [1, 1.189, 1.498, 2][(step // 2) % 4]
        add(np.sin(2 * np.pi * f * tt) * e, t, 0.08)
    t += beat / 2
    step += 1

# whoosh on each scene cut
c = 0.0
for d in durs[:-1]:
    c += d
    e_len = 0.35
    tt = np.arange(int(SR * e_len)) / SR
    sw = rng.uniform(-1, 1, len(tt)) * np.sin(np.pi * tt / e_len) ** 2
    add(sw, c - 0.2, 0.25)
    add(kick, c, 0.6)

# fade out + normalize
fade = int(SR * 0.8)
mix[-fade:] *= np.linspace(1, 0, fade)
mix = mix / (np.abs(mix).max() + 1e-9) * 0.8
pcm = (mix * 32767).astype(np.int16)
with wave.open(sys.argv[2], "wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print(f"wrote {sys.argv[2]} ({total:.1f}s)")
