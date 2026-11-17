import sys, json, numpy as np, soundfile as sf
SR = 48000; DUR = float(sys.argv[3]); N = int(SR * DUR)
t = np.arange(N) / SR
rng = np.random.default_rng(7)
music = np.zeros(N, np.float32)
bpm = 120; beat = 60 / bpm
def add(sig, at, gain=1.0):
    s = int(at * SR); e = min(N, s + len(sig)); 
    if s < N: music[s:e] += gain * sig[: e - s]
# kick
kl = int(0.35 * SR); kt = np.arange(kl) / SR
kick = np.sin(2 * np.pi * (50 + 90 * np.exp(-kt * 30)) * kt) * np.exp(-kt * 9)
# hat
hl = int(0.06 * SR); hat = rng.standard_normal(hl) * np.exp(-np.arange(hl) / SR * 70)
hat = np.diff(hat, prepend=0)  # brighten
# bass line (synthwave-ish), notes per bar
notes = [55.0, 55.0, 43.65, 49.0]  # A1 A1 F1 G1
for i in range(int(DUR / beat)):
    at = i * beat
    if at < 0.05: continue
    add(kick, at, 0.9)
    add(hat, at + beat / 2, 0.25)
    f = notes[(i // 4) % 4]
    for half in (0, beat / 2):
        bl = int(beat / 2 * SR); bt = np.arange(bl) / SR
        saw = 2 * ((f * bt) % 1) - 1
        add((saw * 0.5 + np.sin(2 * np.pi * f * bt)) * np.exp(-bt * 6) , at + half, 0.22)
# pad
pad = sum(np.sin(2 * np.pi * f * t + p) for f, p in [(220, 0), (277.18, 1), (329.63, 2)]) / 3
music += (0.05 * pad * (0.6 + 0.4 * np.sin(2 * np.pi * t / 4))).astype(np.float32)
# impacts on scene changes
il = int(1.2 * SR); it = np.arange(il) / SR
boom = (np.sin(2 * np.pi * (40 + 60 * np.exp(-it * 12)) * it) * 1.0 + rng.standard_normal(il) * 0.35 * np.exp(-it * 8)) * np.exp(-it * 3.5)
whl = int(0.45 * SR); wht = np.arange(whl) / SR
whoosh = rng.standard_normal(whl) * np.sin(np.pi * wht / wht[-1]) ** 2
for at, g in json.loads(sys.argv[4]):
    add(boom, at, g)
    add(whoosh, max(0, at - 0.4), 0.18)
# voice
vo, vsr = sf.read(sys.argv[1], dtype='float32')
if vo.ndim > 1: vo = vo.mean(1)
vo = np.interp(np.arange(N) / SR, np.arange(len(vo)) / vsr, vo).astype(np.float32)
# duck music under the voice
env = np.abs(vo)
win = int(0.15 * SR); env = np.convolve(env, np.ones(win) / win, mode='same')
duck = 1 - 0.6 * np.clip(env / 0.03, 0, 1)
duck = np.convolve(duck, np.ones(win) / win, mode='same')
music *= duck
music *= np.minimum(1, (DUR - t) / 0.6)  # fade out
mix = music / (np.max(np.abs(music)) + 1e-9) * 0.45 + vo / (np.max(np.abs(vo)) + 1e-9) * 0.9
mix = np.tanh(mix * 1.1)
sf.write(sys.argv[2], np.stack([mix, mix], 1), SR)
