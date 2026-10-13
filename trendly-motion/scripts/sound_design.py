"""Synthesised soundtrack for the TRENDLY film (no samples, no licences).

A minimal 120 BPM bed (pad, pulsing bass, hats) plus sound effects placed on
the exact frames of src/timeline.ts (60 fps). Re-run after changing the
timeline:  python scripts/sound_design.py [vendeurs]   (needs numpy, scipy)
Writes public/audio/trendly-sound.wav, or trendly-sound-vendeurs.wav for the
seller cut (adds a cue when the « Demande » row lights up).
48 kHz, 16-bit, stereo, 15.000 s.
"""

import sys
from pathlib import Path

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, fftconvolve, lfilter, sosfilt

VARIANT = sys.argv[1] if len(sys.argv) > 1 else "original"
SR = 48_000
DUR = 15.0
N = int(SR * DUR)
FPS = 60
rng = np.random.default_rng(42)
OUT = Path(__file__).resolve().parent.parent / "public" / "audio"
OUT.mkdir(parents=True, exist_ok=True)

# --- Timeline (frames), mirrored from src/timeline.ts ------------------------
T = dict(
    hookText2=60, matchCut=132, swipe=176, viralPop=206, statusIn=252, curve=(258, 342),
    statusExit=356, tapAnalysis=398, push=406, ring=(436, 498), tiles=452, explode=(440, 522),
    scroll=540, reasons=552, demand=562, scrollBack=616, tapSave=642, fly=(652, 702), morph=(752, 778),
    ignite=(786, 798), arm=(796, 812), hit=814, word=800, tagline=822,
)


def bezier(x1, y1, x2, y2):
    """CSS cubic-bezier easing (same as Remotion's Easing.bezier)."""

    def f(x):
        t = x
        for _ in range(30):
            cx = 3 * x1 * t * (1 - t) ** 2 + 3 * x2 * t * t * (1 - t) + t ** 3
            dx = 3 * x1 * (1 - t) ** 2 + 6 * (x2 - x1) * t * (1 - t) + 3 * (1 - x2) * t * t
            if abs(dx) < 1e-9:
                break
            t = min(1, max(0, t - (cx - x) / dx))
        return 3 * y1 * t * (1 - t) ** 2 + 3 * y2 * t * t * (1 - t) + t ** 3

    return f


in_out = bezier(0.65, 0, 0.35, 1)
ease_out = bezier(0.22, 1, 0.36, 1)


def status_hit(u):
    a, b = T["curve"]
    for f in range(a, b + 1):
        if in_out((f - a) / (b - a)) >= u:
            return f
    return b


STATUS_HITS = [status_hit(u) for u in (0.2, 0.56, 0.88)]
sec = lambda frame: frame / FPS

# --- DSP helpers ------------------------------------------------------------
L = np.zeros(N)
R = np.zeros(N)
FX_L = np.zeros(N)  # reverb send
FX_R = np.zeros(N)


def t_axis(dur):
    return np.arange(int(dur * SR)) / SR


def place(sig, t0, gain=1.0, pan=0.0, send=0.0):
    """Mix a mono/stereo signal at time t0 (s) with equal-power pan."""
    i0 = int(t0 * SR)
    if sig.ndim == 1:
        sl, sr = sig, sig
    else:
        sl, sr = sig[0], sig[1]
    n = min(len(sl), N - i0)
    if n <= 0:
        return
    pl = np.cos((pan + 1) * np.pi / 4)
    pr = np.sin((pan + 1) * np.pi / 4)
    L[i0 : i0 + n] += sl[:n] * gain * pl * np.sqrt(2)
    R[i0 : i0 + n] += sr[:n] * gain * pr * np.sqrt(2)
    if send:
        FX_L[i0 : i0 + n] += sl[:n] * gain * send
        FX_R[i0 : i0 + n] += sr[:n] * gain * send


def fade(sig, a=0.003, r=0.01):
    n = len(sig)
    env = np.ones(n)
    na, nr = int(a * SR), int(r * SR)
    if na:
        env[:na] = np.linspace(0, 1, na)
    if nr:
        env[-nr:] *= np.linspace(1, 0, nr)
    return sig * env


def bp_sweep(noise, f_from, f_to, q=1.2, curve=None):
    """Band-pass filter whose centre frequency glides (block-wise biquads)."""
    out = np.zeros_like(noise)
    block = 256
    zi = np.zeros(2)
    nb = len(noise) // block + 1
    for b in range(nb):
        s = slice(b * block, (b + 1) * block)
        if s.start >= len(noise):
            break
        p = b / max(1, nb - 1)
        if curve is not None:
            p = curve(p)
        fc = f_from * (f_to / f_from) ** p
        w0 = 2 * np.pi * min(fc, SR * 0.45) / SR
        alpha = np.sin(w0) / (2 * q)
        bcoef = np.array([alpha, 0, -alpha]) / (1 + alpha)
        acoef = np.array([1, -2 * np.cos(w0) / (1 + alpha), (1 - alpha) / (1 + alpha)])
        out[s], zi = lfilter(bcoef, acoef, noise[s], zi=zi)
    return out


def lowpass(sig, fc, order=2):
    return sosfilt(butter(order, fc, "low", fs=SR, output="sos"), sig)


def highpass(sig, fc, order=2):
    return sosfilt(butter(order, fc, "high", fs=SR, output="sos"), sig)


def saw(freq, t):
    ph = (freq * t) % 1.0
    return 2 * ph - 1


# --- Sound effects -----------------------------------------------------------
def whoosh(t0, dur, f_from=400, f_to=4000, gain=0.5, pan_from=-0.4, pan_to=0.4, q=1.0):
    t = t_axis(dur)
    env = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 2
    sig = bp_sweep(rng.standard_normal(len(t)), f_from, f_to, q=q) * env
    half = len(t) // 2
    place(fade(sig[:half]), t0, gain, pan_from, send=0.25)
    place(fade(sig[half:]), t0 + half / SR, gain, pan_to, send=0.25)


def suction(t0, dur, gain=0.55):
    """Reverse whoosh: swells into t0 + dur and stops dead."""
    t = t_axis(dur)
    p = t / dur
    env = p ** 2.4
    sig = bp_sweep(rng.standard_normal(len(t)), 5000, 300, q=0.9) * env
    place(fade(sig, 0.01, 0.004), t0, gain, 0, send=0.3)


def boom(t0, gain=0.9, f_from=72, f_to=42, dur=1.4):
    t = t_axis(dur)
    f = f_to + (f_from - f_to) * np.exp(-t * 7)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t * 3.2)
    thump = lowpass(rng.standard_normal(len(t)), 180) * np.exp(-t * 28) * 0.6
    sig = np.tanh((body + thump) * 1.6)
    place(fade(sig, 0.001, 0.05), t0, gain, 0, send=0.15)


def kick(t0, gain=0.8):
    t = t_axis(0.45)
    f = 45 + 110 * np.exp(-t * 38)
    ph = 2 * np.pi * np.cumsum(f) / SR
    sig = np.sin(ph) * np.exp(-t * 9) + highpass(rng.standard_normal(len(t)), 2000) * np.exp(-t * 300) * 0.25
    place(fade(np.tanh(sig * 1.4), 0.0005, 0.02), t0, gain)


def crash(t0, gain=0.25, dur=1.6):
    t = t_axis(dur)
    sig = highpass(rng.standard_normal(len(t)), 4500, 3) * np.exp(-t * 2.6)
    st = np.vstack([sig, np.roll(sig, 37)])
    place(st * np.array([[1], [1]]) , t0, gain, 0, send=0.3)


def pop(t0, f0=700, gain=0.35, pan=0.0):
    t = t_axis(0.18)
    f = f0 * (1 + 0.7 * np.exp(-t * 90))
    ph = 2 * np.pi * np.cumsum(f) / SR
    sig = np.sin(ph) * np.exp(-t * 26) + 0.15 * np.sin(2 * ph) * np.exp(-t * 40)
    place(fade(sig, 0.0008, 0.01), t0, gain, pan, send=0.35)


def tick(t0, f=3100, gain=0.12, pan=0.0):
    t = t_axis(0.03)
    sig = np.sin(2 * np.pi * f * t) * np.exp(-t * 260)
    place(fade(sig, 0.0003, 0.004), t0, gain, pan, send=0.1)


def tap(t0, gain=0.3):
    t = t_axis(0.06)
    sig = np.sin(2 * np.pi * 1100 * t) * np.exp(-t * 120) + highpass(rng.standard_normal(len(t)), 3000) * np.exp(-t * 500) * 0.4
    place(fade(sig, 0.0003, 0.005), t0, gain, 0.1, send=0.15)


def chime(t0, base=1318.5, gain=0.22, dur=1.8, pan=0.0):
    t = t_axis(dur)
    sig = np.zeros(len(t))
    for ratio, amp, dec in ((1, 1, 2.2), (2.0, 0.35, 3.5), (2.76, 0.25, 4.5), (5.4, 0.12, 7)):
        sig += amp * np.sin(2 * np.pi * base * ratio * t) * np.exp(-t * dec)
    place(fade(sig * 0.5, 0.002, 0.05), t0, gain, pan, send=0.5)


def sparkle(t0, dur=0.6, gain=0.12, n=18, seed=0):
    r = np.random.default_rng(seed)
    for _ in range(n):
        dt = r.uniform(0, dur)
        f = r.uniform(3500, 8000)
        t = t_axis(0.12)
        sig = np.sin(2 * np.pi * f * t) * np.exp(-t * 40)
        place(fade(sig, 0.001, 0.01), t0 + dt, gain * r.uniform(0.4, 1), r.uniform(-0.8, 0.8), send=0.5)


def riser(t0, dur, gain=0.3, f_from=220, f_to=2200):
    t = t_axis(dur)
    p = t / dur
    f = f_from * (f_to / f_from) ** (p ** 1.6)
    ph = 2 * np.pi * np.cumsum(f) / SR
    tone = np.sin(ph) * 0.4 + saw(f * 0.5, t) * 0.08
    noise = bp_sweep(rng.standard_normal(len(t)), 600, 7000, q=0.8, curve=lambda x: x ** 1.5) * 0.6
    sig = (tone + noise) * p ** 2
    place(fade(sig, 0.01, 0.003), t0, gain, 0, send=0.35)


def buzz(t0, dur, pattern, gain=0.18):
    """Neon tube ignition: mains buzz gated by the flicker pattern, crackles."""
    t = t_axis(dur)
    sig = sum(saw(120 * k, t) / k for k in (1, 2, 3, 5))
    sig = bp_sweep(sig, 400, 2600, q=0.7)
    steps = len(pattern)
    idx = np.minimum((t / dur * steps).astype(int), steps - 1)
    gate = np.array(pattern)[idx]
    gate = lowpass(gate, 300)
    place(fade(sig * gate, 0.002, 0.03), t0, gain, 0, send=0.2)
    for k in range(steps):
        if pattern[k] > 0.5:
            tick(t0 + k * dur / steps, f=1800, gain=0.08, pan=rng.uniform(-0.4, 0.4))


# --- Music bed (120 BPM) -----------------------------------------------------
NOTE = lambda name: 440 * 2 ** ((name - 69) / 12)  # MIDI → Hz
A2, C3, E2, F2, G2 = 45, 48, 40, 41, 43
CHORDS = [  # (start s, bass midi, chord midi notes)
    (0.0, A2, [57, 60, 64, 67, 71]),  # Am9
    (sec(T["matchCut"]), F2, [53, 57, 60, 64]),  # Fmaj7
    (sec(T["statusIn"]), C3, [55, 60, 64, 67, 74]),  # Cadd9
    (sec(T["tapAnalysis"]), G2, [55, 59, 62, 64]),  # G6
    (sec(T["scroll"]), A2, [57, 60, 64, 67, 71]),  # Am9
    (sec(T["tapSave"]), F2, [53, 57, 60, 64, 67]),  # Fmaj9
    (sec(T["morph"][0]), E2, [52, 56, 59, 62]),  # E7 (build)
    (sec(T["hit"]), 36, [48, 55, 60, 64, 67, 71, 74]),  # Cmaj9 (resolution)
]
END_BED = sec(T["morph"][0])


def chord_at(ts):
    cur = CHORDS[0]
    for c in CHORDS:
        if ts >= c[0]:
            cur = c
    return cur


def pad():
    t = np.arange(N) / SR
    out_l = np.zeros(N)
    out_r = np.zeros(N)
    for i, (start, _, notes) in enumerate(CHORDS):
        end = CHORDS[i + 1][0] if i + 1 < len(CHORDS) else DUR
        s0, s1 = int(start * SR), min(N, int((end + 0.5) * SR))
        seg_t = t[s0:s1] - start
        env = np.minimum(1, seg_t / 0.25) * np.clip((end + 0.5 - (seg_t + start)) / 0.5, 0, 1)
        if i == len(CHORDS) - 1:
            env = np.minimum(1, seg_t / 0.02) * np.exp(-seg_t * 0.9)
        for n in notes:
            f = NOTE(n)
            for det, side in ((-0.07, 0), (0.0, None), (0.07, 1)):
                v = saw(f * 2 ** (det / 12), seg_t + 0.13 * n) * env / len(notes)
                if side in (0, None):
                    out_l[s0:s1] += v * (0.8 if side is None else 1)
                if side in (1, None):
                    out_r[s0:s1] += v * (0.8 if side is None else 1)
    out_l = lowpass(out_l, 1400)
    out_r = lowpass(out_r, 1400)
    return out_l, out_r


def bass_and_drums():
    beat = 0.5
    t16 = beat / 4
    k = 0
    while k * t16 < END_BED:
        ts = k * t16
        _, b, _ = chord_at(ts)
        if k % 2 == 0:  # 8th-note pulse
            t = t_axis(0.22)
            f = NOTE(b)
            sig = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(4 * np.pi * f * t) + 0.12 * saw(f, t)
            sig = highpass(lowpass(sig * np.exp(-t * 11), 420), 45)
            place(fade(sig, 0.004, 0.02), ts, 0.24 if k % 4 == 0 else 0.16)
        if ts >= sec(T["matchCut"]) - 0.01:  # hats lift the energy after the match cut
            t = t_axis(0.05)
            hat = highpass(rng.standard_normal(len(t)), 8000) * np.exp(-t * (90 if k % 2 else 140))
            place(fade(hat, 0.0005, 0.005), ts, 0.07 if k % 2 else 0.04, 0.3 if k % 4 == 1 else -0.3)
        if k % 4 == 0 and ts >= 1.0:
            kick(ts, 0.42)
        if k % 8 == 4 and ts >= sec(T["matchCut"]):
            t = t_axis(0.2)
            clap = bp_sweep(rng.standard_normal(len(t)), 1200, 1800, q=1.2) * np.exp(-t * 22)
            place(fade(clap, 0.001, 0.02), ts, 0.16, 0, send=0.4)
        k += 1


# --- Arrange -----------------------------------------------------------------
pl, pr = pad()
L += pl * 0.22
R += pr * 0.22
FX_L += pl * 0.05
FX_R += pr * 0.05
bass_and_drums()

# 1. Hook
boom(0.0, 0.75)
crash(0.0, 0.18)
whoosh(0.0, 0.7, 6000, 300, 0.45, 0.3, -0.3)
whoosh(sec(T["hookText2"]) - 0.12, 0.45, 500, 3500, 0.22)
# 2. Feed
suction(sec(T["matchCut"]) - 0.45, 0.45, 0.35)
boom(sec(T["matchCut"]), 0.6, 80, 40, 1.0)
kick(sec(T["matchCut"]), 0.6)
whoosh(sec(T["swipe"]) - 0.05, 0.4, 300, 5000, 0.4, -0.2, 0.2, q=1.4)
pop(sec(T["viralPop"]), 620, 0.4)
sparkle(sec(T["viralPop"]), 0.4, 0.1, 12, 1)
# 3. Statuses
whoosh(sec(T["statusIn"]) - 0.1, 0.5, 300, 2500, 0.3, -0.5, 0.3)
riser(sec(T["curve"][0]), sec(STATUS_HITS[2] - T["curve"][0]), 0.22, 200, 1600)
for i, (f, fr) in enumerate(zip(STATUS_HITS, (523, 659, 784))):
    pop(sec(f), fr, 0.32 + 0.08 * i, pan=(-0.5, 0, 0.5)[i])
boom(sec(STATUS_HITS[2]), 0.55, 90, 45, 1.0)
crash(sec(STATUS_HITS[2]), 0.12)
sparkle(sec(STATUS_HITS[2]), 0.5, 0.12, 16, 2)
whoosh(sec(T["statusExit"]), 0.45, 5000, 400, 0.35, 0.4, -0.4)
# 4. Analysis
tap(sec(T["tapAnalysis"]))
whoosh(sec(T["push"]), 0.4, 600, 3000, 0.28, 0.5, -0.2)
whoosh(sec(T["explode"][0]), 0.5, 1500, 6000, 0.18, -0.3, 0.3, q=2)
last = -1
for f in range(T["ring"][0], T["ring"][1] + 1):
    v = round(75 * ease_out((f - T["ring"][0]) / (T["ring"][1] - T["ring"][0])))
    if v // 5 != last // 5 and v > 0:
        tick(sec(f), 2600 + v * 12, 0.11, pan=0.3)
    last = v
chime(sec(T["ring"][1]), 1318.5, 0.22, pan=0.3)
for i in range(6):
    pop(sec(T["tiles"] + i * 5), 900 + i * 60, 0.12, pan=-0.4 + i * 0.16)
whoosh(sec(T["explode"][1]), 0.4, 6000, 1500, 0.14, 0.3, -0.3, q=2)
whoosh(sec(T["scroll"]), 0.5, 800, 2400, 0.18, 0, 0, q=1.6)
for i in range(4):
    tick(sec(T["reasons"] + i * 6), 2200, 0.1, pan=-0.2 + i * 0.13)
if VARIANT == "vendeurs":  # the « Demande » row lights up
    chime(sec(T["demand"]) + 0.07, 1567.98, 0.2, 1.6, 0.2)
    pop(sec(T["demand"]) + 0.07, 784, 0.22, 0.2)
    sparkle(sec(T["demand"]) + 0.07, 0.4, 0.09, 10, 6)
# 5. Save
whoosh(sec(T["scrollBack"]), 0.35, 2400, 800, 0.15, 0, 0, q=1.6)
tap(sec(T["tapSave"]))
pop(sec(T["tapSave"]) + 0.02, 880, 0.42)
chime(sec(T["tapSave"]) + 0.02, 1760, 0.12)
sparkle(sec(T["tapSave"]), 0.35, 0.1, 10, 3)
whoosh(sec(T["fly"][0]), sec(T["fly"][1] - T["fly"][0]) + 0.05, 400, 3000, 0.32, 0.2, -0.4)
pop(sec(T["fly"][1]), 520, 0.4)
kick(sec(T["fly"][1]), 0.45)
sparkle(sec(T["fly"][1]), 0.3, 0.08, 8, 4)
# 6. Finale
suction(sec(T["morph"][0]), sec(T["morph"][1] - T["morph"][0]), 0.6)
riser(sec(T["morph"][0]) - 0.3, sec(T["hit"] - T["morph"][0]) + 0.3, 0.26, 150, 2400)
boom(sec(T["morph"][1]), 0.5, 70, 40, 0.8)
buzz(sec(T["ignite"][0]), sec(T["ignite"][1] - T["ignite"][0]) + 0.05, [0, 0.85, 0.12, 0.9, 0.3, 1, 0.65, 1], 0.16)
whoosh(sec(T["word"]), 0.6, 2000, 6000, 0.1, -0.6, 0.6, q=2.5)
boom(sec(T["hit"]), 0.95, 85, 40, 2.2)
kick(sec(T["hit"]), 0.7)
crash(sec(T["hit"]), 0.22, 2.4)
chime(sec(T["hit"]), 1046.5, 0.22, 2.5, -0.2)
chime(sec(T["hit"]) + 0.04, 1568, 0.16, 2.5, 0.3)
sparkle(sec(T["hit"]), 1.2, 0.12, 30, 5)

# --- Reverb, master ----------------------------------------------------------
ir_t = t_axis(2.2)
ir = rng.standard_normal((2, len(ir_t))) * np.exp(-ir_t * 3.1)
ir[:, : int(0.02 * SR)] = 0
ir = np.vstack([lowpass(ir[0], 6000), lowpass(ir[1], 6000)])
ir /= np.sqrt((ir ** 2).sum(axis=1, keepdims=True))
L += fftconvolve(FX_L, ir[0])[:N] * 0.9
R += fftconvolve(FX_R, ir[1])[:N] * 0.9

mix = np.vstack([L, R])
mix = highpass(mix, 32)
mix -= mix.mean(axis=1, keepdims=True)
mix /= np.sqrt((mix ** 2).mean()) / 10 ** (-15.5 / 20)  # pre-gain: ~-14 LUFS after limiting


def limiter(x, ceiling=10 ** (-1.5 / 20), release=0.08):
    """Peak limiter: instant attack (5 ms look-ahead), exponential release."""
    look = int(0.005 * SR)
    env = np.abs(x).max(axis=0)
    env = np.maximum.accumulate(np.lib.stride_tricks.sliding_window_view(np.pad(env, (0, look)), look + 1), axis=1)[:, -1]
    gain = np.minimum(1.0, ceiling / np.maximum(env, 1e-9))
    a = np.exp(-1 / (release * SR))
    sm = np.empty_like(gain)
    g = 1.0
    for i, v in enumerate(gain):
        g = v if v < g else a * g + (1 - a) * v
        sm[i] = g
    return x * sm


mix = limiter(mix)
mix = np.tanh(mix * 1.05) / np.tanh(1.05) * 10 ** (-1.2 / 20)
tail = int(0.25 * SR)
mix[:, -tail:] *= np.linspace(1, 0, tail) ** 2
mix[:, : int(0.002 * SR)] *= np.linspace(0, 1, int(0.002 * SR))

rms_db = 20 * np.log10(np.sqrt((mix ** 2).mean()))
name = "trendly-sound.wav" if VARIANT == "original" else f"trendly-sound-{VARIANT}.wav"
wavfile.write(OUT / name, SR, (mix.T * 32767).astype(np.int16))
print(f"wrote public/audio/{name}  {DUR}s  RMS {rms_db:.1f} dBFS  status hits {STATUS_HITS}")
