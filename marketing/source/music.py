# Original soundtrack for the SAT Studio ad, synthesized from scratch.
import numpy as np, wave

SR = 44100
DUR = 25.5
N = int(SR * DUR)
t_all = np.arange(N) / SR
rng = np.random.default_rng(7)
out = np.zeros((N, 2))

def lowpass(x, fc, order=4):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    return np.fft.irfft(X / (1 + (f / fc) ** order), len(x))

def highpass(x, fc, order=4):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    r = (f / fc) ** order
    return np.fft.irfft(X * r / (1 + r), len(x))

def add(sig, start, gain=1.0, pan=0.0):
    i = int(start * SR)
    if i >= N: return
    sig = sig[: N - i]
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    out[i:i + len(sig), 0] += sig * gain * l * 1.414
    out[i:i + len(sig), 1] += sig * gain * r * 1.414

def env(n, a, d, s_level, r_len):
    e = np.ones(n) * s_level
    A, D, R = int(a * SR), int(d * SR), int(r_len * SR)
    e[:A] = np.linspace(0, 1, A, endpoint=False)
    e[A:A + D] = np.linspace(1, s_level, D, endpoint=False)[: max(0, min(D, n - A))]
    if R: e[-R:] *= np.linspace(1, 0, R)
    return e

def midi(m): return 440 * 2 ** ((m - 69) / 12)

def saw(freq, n, detune=0.0):
    tt = np.arange(n) / SR
    s = np.zeros(n)
    for dt in (-detune, 0, detune):
        s += 2 * ((tt * freq * (1 + dt)) % 1) - 1
    return s / 3

# ---- drums ----
def kick(len_s=0.45):
    n = int(len_s * SR); tt = np.arange(n) / SR
    f = 48 + 110 * np.exp(-tt * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-tt * 7) + 0.25 * np.sin(ph * 2) * np.exp(-tt * 30)

def clap():
    n = int(0.28 * SR); tt = np.arange(n) / SR
    nz = highpass(rng.standard_normal(n), 900)
    e = np.exp(-tt * 18) * (1 + 0.6 * (np.sin(2 * np.pi * 90 * tt) > 0) * (tt < .03))
    return lowpass(nz * e, 6000) * 0.5

def hat(open_=False):
    n = int((0.18 if open_ else 0.05) * SR); tt = np.arange(n) / SR
    return highpass(rng.standard_normal(n), 7000) * np.exp(-tt * (18 if open_ else 70)) * 0.35

def impact():
    n = int(2.2 * SR); tt = np.arange(n) / SR
    f = 38 + 70 * np.exp(-tt * 9)
    boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 2.2)
    nz = lowpass(rng.standard_normal(n), 2500) * np.exp(-tt * 6) * 0.5
    return boom + nz

def riser(len_s, start_fc=300, end_fc=9000):
    n = int(len_s * SR); y = np.zeros(n); chunk = int(0.04 * SR)
    nz = rng.standard_normal(n + chunk)
    for k in range(0, n, chunk):
        fc = start_fc * (end_fc / start_fc) ** (k / n)
        seg = lowpass(nz[k:k + chunk * 2], fc)[:chunk]
        y[k:k + chunk] = seg[: len(y[k:k + chunk])]
    tt = np.arange(n) / SR
    sweep = np.sin(2 * np.pi * np.cumsum(220 * 4 ** (tt / len_s)) / SR) * 0.15
    return (y * 0.6 + sweep) * (tt / len_s) ** 2

def whoosh(len_s=0.55):
    n = int(len_s * SR); tt = np.arange(n) / SR
    e = np.sin(np.pi * tt / len_s) ** 2
    return lowpass(highpass(rng.standard_normal(n), 500), 5000) * e * 0.35

def tick():
    n = int(0.03 * SR); tt = np.arange(n) / SR
    return np.sin(2 * np.pi * 2400 * tt) * np.exp(-tt * 200) * 0.25

# ---- harmony ----
BPM = 120; beat = 60 / BPM; bar = 4 * beat
groove_start, groove_end = 2.3, 21.9
prog = [(57, [57, 60, 64]), (53, [53, 57, 60]), (48, [48, 52, 55]), (55, [55, 59, 62])]  # Am F C G

def pad_chord(notes, len_s, cutoff=1800):
    n = int(len_s * SR)
    s = sum(saw(midi(m + 12), n, 0.004) for m in notes) / len(notes)
    return lowpass(s, cutoff) * env(n, 0.25, 0.4, 0.8, 0.5)

def bass_note(m, len_s):
    n = int(len_s * SR); tt = np.arange(n) / SR
    s = np.sin(2 * np.pi * midi(m - 24) * tt) + 0.3 * lowpass(saw(midi(m - 24), n), 600)
    return s * env(n, 0.005, 0.1, 0.7, 0.06)

def pluck(m, len_s=0.4):
    n = int(len_s * SR); tt = np.arange(n) / SR
    s = np.sin(2 * np.pi * midi(m) * tt) + 0.4 * np.sin(4 * np.pi * midi(m) * tt) * np.exp(-tt * 12)
    return s * np.exp(-tt * 6) * 0.5

# intro: soft pad + riser + counter ticks
add(pad_chord([57, 60, 64, 69], 2.6, 900), 0.0, 0.25)
add(riser(2.3), 0.0, 0.55)
for k in range(24):
    add(tick(), 0.5 + k * (1.8 / 24), 0.6 + 0.4 * k / 24, pan=0.3 * np.sin(k))
add(impact(), 2.3, 0.9)

# groove
tb = groove_start; i = 0
while tb < groove_end - 0.01:
    root, notes = prog[i % 4]
    blen = min(bar, groove_end - tb)
    add(pad_chord(notes, blen + 0.3), tb, 0.22)
    for b8 in range(8):
        tt8 = tb + b8 * beat / 2
        if tt8 >= groove_end: break
        if b8 % 2 == 0: add(kick(), tt8, 0.85)
        if b8 in (2, 6): add(clap(), tt8, 0.55, pan=0.05)
        add(hat(open_=(b8 % 4 == 3)), tt8, 0.5, pan=-0.35 if b8 % 2 else 0.35)
        bn = root if b8 not in (3, 7) else root + 7
        add(bass_note(bn, beat / 2 * 0.9), tt8, 0.45)
    arp = [notes[0] + 12, notes[1] + 12, notes[2] + 12, notes[1] + 24]
    for k, m in enumerate(arp * 2):
        add(pluck(m), tb + k * beat / 2 + beat / 4, 0.16, pan=0.5 if k % 2 else -0.5)
    tb += bar; i += 1

# whooshes into each scene change
for cut in (3.4, 7.3, 11.0, 14.6, 18.4):
    add(whoosh(), cut - 0.4, 0.8)
add(riser(1.4), groove_end - 1.4, 0.45)

# end card: hit + held chord + rising arpeggio
add(impact(), groove_end, 0.85)
add(pad_chord([57, 60, 64, 69, 72], DUR - groove_end, 2400), groove_end, 0.3)
for k, m in enumerate([69, 72, 76, 81, 84]):
    add(pluck(m, 1.2), groove_end + 0.3 + k * 0.18, 0.22, pan=-0.4 + 0.2 * k)

# master: gentle limiting and fade
out *= np.linspace(1, 1, N)[:, None]
fade = int(1.2 * SR); out[-fade:] *= np.linspace(1, 0, fade)[:, None]
out = np.tanh(out * 0.9) / np.tanh(0.9)
out /= np.max(np.abs(out)) / 0.89
pcm = (out * 32767).astype(np.int16)
with wave.open("/tmp/claude-0/-home-user-sat-studio/d525a4a4-e503-5ae9-b7ae-ce176bc95dab/scratchpad/ad/music.wav", "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print("ok")
