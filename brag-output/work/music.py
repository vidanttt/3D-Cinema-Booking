"""Soundtrack for the CINÉ brag video.

150 BPM (one beat = 0.4 s = 12 video frames), D minor. 56 beats = 22.4 s.
Musical bars start on beat 2 (beats 0-1 are a pickup), so the drop (b14),
the seat jumps (b26, b34), the booking (b38) and the outro (b46) all land on
a downbeat. Music and effects share one beat grid, one key and one reverb.
"""
import numpy as np
import wave
import sys

SR = 48000
BPM = 150
BEAT = 60 / BPM
SPB = int(round(SR * BEAT))  # 19200 samples per beat, exact
BEATS = 56
N = SPB * BEATS
rng = np.random.default_rng(7)


def t_of(n):
    return np.arange(n) / SR


def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def at(beat):
    return int(round(beat * SPB))


def place(buf, sig, beat, gain=1.0):
    i = at(beat)
    if i >= len(buf):
        return
    j = min(len(buf), i + len(sig))
    buf[i:j] += sig[: j - i] * gain


def env_ad(n, a, d, curve=4.0):
    t = t_of(n)
    e = np.where(t < a, t / max(a, 1e-6), np.exp(-curve * (t - a) / max(d, 1e-6)))
    return e


def onepole_lp(x, fc):
    """One-pole low-pass. fc may be a scalar or a per-sample array."""
    fc = np.broadcast_to(np.asarray(fc, dtype=float), x.shape)
    a = 1 - np.exp(-2 * np.pi * fc / SR)
    y = np.empty_like(x)
    s = 0.0
    xs = x.tolist()
    al = a.tolist()
    out = [0.0] * len(xs)
    for i in range(len(xs)):
        s += al[i] * (xs[i] - s)
        out[i] = s
    y[:] = out
    return y


def lp2(x, fc):
    return onepole_lp(onepole_lp(x, fc), fc)


def hp(x, fc):
    return x - onepole_lp(x, fc)


def fft_filter(x, lo=None, hi=None):
    """Static brick-ish band filter via FFT with soft edges (fast)."""
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    g = np.ones_like(f)
    if hi:
        g *= 1 / np.sqrt(1 + (f / hi) ** 4)
    if lo:
        g *= 1 / np.sqrt(1 + (lo / np.maximum(f, 1)) ** 4)
    return np.fft.irfft(X * g, len(x))


def saw(freq, n, phase=0.0):
    ph = (phase + np.cumsum(np.full(n, freq / SR))) % 1.0
    # PolyBLEP-free but softened by filtering later
    return 2 * ph - 1


def supersaw(freqs, n, detune=0.12, voices=5):
    out = np.zeros(n)
    for f in freqs:
        for v in range(voices):
            d = (v - (voices - 1) / 2) / ((voices - 1) / 2) * detune
            out += saw(f * 2 ** (d / 12), n, rng.random())
    return out / (len(freqs) * voices) * 2.2


# ---------------------------------------------------------------- harmony
#            start beat, root (bass midi), chord tones (midi)
DM = (38, [62, 65, 69])
BB = (34, [58, 62, 65])
FM = (41, [60, 65, 69])
CM = (36, [60, 64, 67])
DMAJ = (38, [62, 66, 69])
CHORDS = [
    (0, DM), (2, DM), (6, BB), (10, FM),
    (14, DM), (18, BB), (22, FM), (26, CM),
    (30, DM), (34, BB), (38, FM), (42, CM),
    (46, DMAJ), (50, DMAJ), (54, DMAJ),
]


def chord_at(beat):
    cur = CHORDS[0][1]
    for b, c in CHORDS:
        if beat >= b:
            cur = c
    return cur


# ---------------------------------------------------------------- voices
def kick(gain=1.0):
    n = int(0.42 * SR)
    t = t_of(n)
    f = 46 + 110 * np.exp(-t * 32)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t * 7.5)
    click = fft_filter(rng.standard_normal(n), lo=1500, hi=6000) * np.exp(-t * 180) * 0.25
    return np.tanh((body + click) * 1.6) * gain


def clap(gain=1.0):
    n = int(0.3 * SR)
    t = t_of(n)
    noise = fft_filter(rng.standard_normal(n), lo=900, hi=5200)
    e = np.zeros(n)
    for k, off in enumerate([0, 0.011, 0.022]):
        i = int(off * SR)
        e[i:] += np.exp(-t[: n - i] * (90 if k < 2 else 18))
    tone = np.sin(2 * np.pi * 196 * t) * np.exp(-t * 30) * 0.3
    return (noise * e * 0.55 + tone) * gain


def hat(open_=False, gain=1.0):
    n = int((0.22 if open_ else 0.05) * SR)
    t = t_of(n)
    noise = fft_filter(rng.standard_normal(n), lo=7500, hi=15000)
    return noise * np.exp(-t * (14 if open_ else 75)) * gain


def bass_note(m, beats, gain=1.0):
    n = int(beats * SPB)
    f = midi(m)
    x = saw(f, n) * 0.7 + np.sin(2 * np.pi * f / 2 * t_of(n)) * 0.35
    t = t_of(n)
    cutoff = 180 + 1400 * np.exp(-t * 16)
    y = lp2(x, cutoff)
    e = np.minimum(1, t / 0.004) * np.exp(-t * 2.2)
    e[-int(0.01 * SR):] *= np.linspace(1, 0, int(0.01 * SR))
    return y * e * gain


def stab(tones, beats=0.45, gain=1.0, bright=1.0):
    n = int(beats * SPB)
    t = t_of(n)
    x = supersaw([midi(m) for m in tones], n)
    cutoff = 900 + 4200 * bright * np.exp(-t * 9)
    y = lp2(x, cutoff)
    e = np.minimum(1, t / 0.003) * np.exp(-t * 6)
    return y * e * gain


def pluck(m, gain=1.0):
    n = int(0.35 * SR)
    t = t_of(n)
    f = midi(m)
    x = (np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * 2 * f * t) + 0.15 * np.sin(2 * np.pi * 3 * f * t))
    return x * np.exp(-t * 11) * np.minimum(1, t / 0.002) * gain


def braam(tones, seconds=2.4, gain=1.0):
    """Trailer brass hit: detuned low saws through a closing filter."""
    n = int(seconds * SR)
    t = t_of(n)
    x = supersaw([midi(m) for m in tones], n, detune=0.18, voices=4)
    cutoff = 220 + 2600 * np.exp(-t * 2.6)
    y = lp2(x, cutoff)
    e = np.minimum(1, t / 0.012) * np.exp(-t * 1.25)
    return np.tanh(y * 2.2) * e * gain


def impact(gain=1.0, seconds=2.2, root=38):
    """Tuned boom: sub sweep landing on D plus a soft noise body."""
    n = int(seconds * SR)
    t = t_of(n)
    f = midi(root - 12) + 90 * np.exp(-t * 9)
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 1.6)
    body = fft_filter(rng.standard_normal(n), hi=900) * np.exp(-t * 6) * 0.5
    return np.tanh((sub + body) * 1.4) * gain


def crash(gain=1.0, seconds=2.6):
    n = int(seconds * SR)
    t = t_of(n)
    noise = fft_filter(rng.standard_normal(n), lo=3500, hi=13000)
    return noise * np.exp(-t * 1.7) * np.minimum(1, t / 0.003) * gain


def riser(beats, gain=1.0, f0=300, f1=9000):
    n = int(beats * SPB)
    t = t_of(n)
    p = t / t[-1]
    noise = rng.standard_normal(n)
    y = lp2(noise, f0 * (f1 / f0) ** (p ** 1.6))
    y = hp(y, 200)
    return y * (p ** 2.2) * gain


def whoosh(beats=1.0, gain=1.0):
    """Reverse-shaped swell that peaks exactly at its end (place it before a cut)."""
    n = int(beats * SPB)
    t = t_of(n)
    p = t / t[-1]
    y = lp2(rng.standard_normal(n), 400 + 7000 * p ** 2)
    return y * (p ** 3) * gain


def blip(m, gain=1.0):
    n = int(0.12 * SR)
    t = t_of(n)
    return np.sin(2 * np.pi * midi(m) * t) * np.exp(-t * 45) * np.minimum(1, t / 0.001) * gain


def chime(tones, gain=1.0):
    n = int(2.4 * SR)
    t = t_of(n)
    y = np.zeros(n)
    for k, m in enumerate(tones):
        f = midi(m)
        d = int(k * 0.06 * SR)
        tt = t[: n - d]
        y[d:] += (np.sin(2 * np.pi * f * tt) + 0.4 * np.sin(2 * np.pi * f * 2.76 * tt) * np.exp(-tt * 6)) * np.exp(-tt * 2.2)
    return y * gain / len(tones)


def pad(tones, beats, gain=1.0):
    n = int(beats * SPB)
    t = t_of(n)
    x = supersaw([midi(m) for m in tones], n, detune=0.2, voices=4)
    y = lp2(x, 1600)
    e = np.minimum(1, t / 0.6) * np.minimum(1, (t[-1] - t) / 1.2 + 0.0)
    return y * np.clip(e, 0, 1) * gain


# ---------------------------------------------------------------- arrangement
drums = np.zeros(N)
bass = np.zeros(N)
music = np.zeros(N)
fx = np.zeros(N)
kick_env = np.zeros(N)  # for sidechain


def put_kick(beat, g=1.0):
    place(drums, kick(g), beat)
    i = at(beat)
    n = int(0.32 * SR)
    j = min(N, i + n)
    kick_env[i:j] = np.maximum(kick_env[i:j], np.exp(-t_of(j - i) * 9) * g)


# Hook (b0-5): tension. Two tuned hits, ticking 16ths, a low drone.
place(fx, impact(0.9), 0)
place(music, braam([38, 45, 50], 1.3, 0.55), 0)
place(fx, impact(0.75), 3)
place(music, braam([38, 45, 50, 53], 1.3, 0.5), 3)
for s in range(0, 24):
    b = s / 4
    if b >= 6:
        break
    place(drums, hat(False, 0.10 if s % 4 else 0.16), b)
drone = np.sin(2 * np.pi * midi(26) * t_of(at(6))) * 0.11 + np.sin(2 * np.pi * midi(38) * t_of(at(6))) * 0.06
drone *= np.minimum(1, t_of(at(6)) / 0.3) * np.minimum(1, (t_of(at(6))[-1] - t_of(at(6))) / 0.15)
place(bass, drone, 0)
place(fx, whoosh(2.0, 0.55), 4)  # swells into the brand slam

# Brand slam (b6-7)
place(fx, impact(1.0, 2.4), 6)
place(music, braam([34, 41, 46, 50, 53], 1.6, 0.75), 6)
place(fx, crash(0.35), 6)
put_kick(6, 1.0)

# Groove: b8 to b45
def groove(b0, b1, full):
    for b in range(b0, b1):
        put_kick(b, 0.95 if full else 0.62)
        rel = (b - 2) % 4  # position in bar (bars start on beat 2)
        if rel in (1, 3):
            place(drums, clap(0.55 if full else 0.42), b)
        place(drums, hat(True, 0.11 if full else 0.07), b + 0.5)
        if full:
            for s in (0.25, 0.75):
                place(drums, hat(False, 0.06), b + s)


groove(8, 13, False)
groove(14, 46, True)

# Snare roll + riser into the drop (b12-14), kick drops out for the last half beat
for k in range(16):
    b = 12 + k / 8
    place(drums, clap(0.12 + 0.3 * k / 16), b)
place(fx, riser(2.0, 0.5), 12)
put_kick(12, 0.9)
put_kick(13, 0.9)

# Bass: 8ths on the root, octave jump on the off-beats, from b8
for e in range(8 * 2, 46 * 2):
    b = e / 2
    root, _ = chord_at(b)
    if 12.5 < b < 14:
        continue
    m = root + (12 if e % 2 else 0)
    g = 0.42 if b >= 14 else 0.2
    place(bass, bass_note(m if b >= 14 else root, 0.5, g), b)

# Stabs: off-beat chords in the drop, accents on caption beats
for e in range(14 * 2, 46 * 2):
    b = e / 2
    if e % 2 == 1:
        _, tones = chord_at(b)
        place(music, stab(tones, 0.42, 0.20), b)
for b in (14, 21, 26, 34, 38):
    _, tones = chord_at(b)
    place(music, stab([t - 12 for t in tones] + tones, 1.2, 0.38, bright=1.3), b)

# Plucked arp over the map (b8-13) and the booking (b38-45)
pattern = [0, 1, 2, 1, 2, 0, 1, 2]
for s in range(8 * 4, 12 * 4):
    b = s / 4
    _, tones = chord_at(b)
    place(music, pluck(tones[pattern[s % 8]] + 12, 0.16), b)
for s in range(38 * 4, 46 * 4):
    b = s / 4
    _, tones = chord_at(b)
    place(music, pluck(tones[pattern[s % 8]] + 12, 0.12), b)

# UI clicks on the seat picks (tuned to the chord)
place(fx, blip(81, 0.18), 10)
place(fx, blip(84, 0.18), 11)
place(fx, blip(86, 0.16), 14)

# The drop
place(fx, impact(1.0, 2.6), 14)
place(fx, crash(0.4), 14)
place(music, braam([38, 45, 50, 53, 57], 1.8, 0.6), 14)

# Seat jumps
place(fx, whoosh(1.0, 0.45), 25)
place(fx, impact(0.55, 1.4), 26)
place(fx, blip(86, 0.12), 26)
place(fx, whoosh(1.0, 0.45), 33)
place(fx, impact(0.55, 1.4), 34)
place(fx, blip(86, 0.12), 34)

# Booking: confirm click, the "BOOKED." slam, ticket chime
place(fx, blip(81, 0.16), 38)
place(fx, impact(0.6, 1.6), 40)
place(music, chime([72, 76, 79, 84], 0.45), 42)

# Outro: final hit on D major, everything rings out
place(fx, impact(1.0, 3.0), 46)
place(fx, crash(0.42, 3.4), 46)
place(music, braam([38, 45, 50, 54, 57], 3.2, 0.7), 46)
place(music, pad([62, 66, 69, 74], 9.5, 0.22), 46)
for k, m in enumerate([74, 78, 81, 86, 81, 78, 74, 69]):
    place(music, pluck(m, 0.12 * (1 - k / 10)), 46 + 1 + k * 0.5)
_tail = t_of(at(9))
place(bass, np.sin(2 * np.pi * midi(26) * _tail) * np.exp(-_tail * 1.4) * 0.3, 46)

# ---------------------------------------------------------------- mix
duck = 1 - 0.55 * np.clip(kick_env, 0, 1)
bass *= duck
music *= 1 - 0.35 * np.clip(kick_env, 0, 1)
fx_soft = fft_filter(fx, hi=9000)  # nothing spiky


def reverb(x, seconds=1.8, mix=0.22):
    n = int(seconds * SR)
    t = t_of(n)
    ir = rng.standard_normal(n) * np.exp(-t * 3.2)
    ir = fft_filter(ir, lo=250, hi=7000)
    ir /= np.sqrt(np.sum(ir ** 2))
    L = len(x) + n
    size = 1 << (L - 1).bit_length()
    wet = np.fft.irfft(np.fft.rfft(x, size) * np.fft.rfft(ir, size), size)[: len(x)]
    return wet * mix


send = music * 0.8 + fx_soft * 0.7 + drums * 0.12
wet = reverb(send)

mixL = drums * 0.85 + bass * 0.95 + music * 0.9 + fx_soft * 0.8 + wet
# light stereo: reverb decorrelated, hats panned by a hair
wetR = np.roll(wet, int(0.011 * SR))
mixR = drums * 0.85 + bass * 0.95 + music * 0.9 + fx_soft * 0.8 + wetR

stereo = np.stack([mixL, mixR], axis=1)
stereo = fft_filter(stereo[:, 0], lo=32), fft_filter(stereo[:, 1], lo=32)
stereo = np.stack(stereo, axis=1)
peak = np.max(np.abs(stereo))
stereo = np.tanh(stereo / peak * 1.35) / np.tanh(1.35)
# fade the very end
fade = int(1.2 * SR)
stereo[-fade:] *= np.linspace(1, 0, fade)[:, None] ** 1.5
stereo *= 10 ** (-1.0 / 20)

out = sys.argv[1] if len(sys.argv) > 1 else 'music.wav'
pcm = (np.clip(stereo, -1, 1) * 32767).astype('<i2')
with wave.open(out, 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print('wrote', out, f'{N / SR:.2f}s')
