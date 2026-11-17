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

AMBIENT = story.get("music") == "ambient"

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
if AMBIENT:
    # slow evolving pad: detuned sines on a minor progression, 8 s per chord, soft crossfades
    tt = np.arange(n) / SR
    prog = [(55.0, [1, 1.189, 1.498]), (43.65, [1, 1.26, 1.498]), (48.99, [1, 1.189, 1.498]), (41.2, [1, 1.26, 1.498])]
    seg = 8.0
    for k in range(int(total / seg) + 2):
        root, ch = prog[k % 4]
        a0, a1 = int(max(0, (k * seg - 2) * SR)), int(min(n, ((k + 1) * seg + 2) * SR))
        if a0 >= n: break
        x = tt[a0:a1] - k * seg
        w = np.clip(np.minimum((x + 2) / 2, (seg + 2 - x) / 2), 0, 1)
        sig = sum(np.sin(2 * np.pi * root * 2 * r * x * (1 + d)) for r in ch for d in (-0.002, 0.002)) / 6
        sig += 0.6 * np.sin(2 * np.pi * root * x)
        mix[a0:a1] += sig * w * (0.6 + 0.4 * np.sin(2 * np.pi * 0.07 * x)) * 0.5
    # low heartbeat pulse
    beat_t = 0.0
    e, tb = env(0.5, 0.12)
    thump = np.sin(2 * np.pi * (40 + 30 * np.exp(-tb / 0.03)) * tb) * e
    while beat_t < total:
        add(thump, beat_t, 0.35); add(thump, beat_t + 0.28, 0.2); beat_t += 2.0
    # per-scene sound design
    c = 0.0
    e, tb = env(3.5, 0.9); boom = np.sin(2 * np.pi * (32 + 50 * np.exp(-tb / 0.08)) * tb) * e + rng.uniform(-1, 1, len(tb)) * np.exp(-tb / 0.25) * 0.4
    e, tb = env(0.03, 0.006); tick = rng.uniform(-1, 1, len(tb)) * e
    for sc in story["scenes"]:
        if sc.get("boom"): add(boom, c + sc.get("boomAt", 0.0), 1.6)
        if sc["type"] == "clock":
            k = 0.4
            while k < sc["dur"] - 0.3: add(tick, c + k, 0.6); k += 1.0
        c += sc["dur"]
    t = total  # skip the beat loop
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
for d in ([] if AMBIENT else durs[:-1]):
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
