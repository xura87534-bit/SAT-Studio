"""Builds public/track.wav: a soft bed plus sound effects placed on the reel's frames (30 fps).
Run from this folder: python make_audio.py  (uses the synth helpers in ../reels/common.py)."""
import sys, os
import numpy as np
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "reels"))
os.chdir(os.path.join(os.path.dirname(__file__), "..", "reels"))   # common.py loads logo.png relative to its folder
from common import SR, tone, noise, kick, whoosh, put, save
os.chdir(os.path.dirname(os.path.abspath(__file__)))

F = lambda f: f / 30
DUR = F(600)
buf = np.zeros(int(DUR * SR) + SR)
for i, f0 in enumerate([110, 82.4, 98, 73.4, 110, 87.3]):                                   # bed
    put(buf, (tone(f0, 4.0, a=0.6, r=2.4) + 0.5 * tone(f0 * 1.5, 4.0, a=0.8, r=2.2)) * 0.5, i * 3.4)
put(buf, kick(), F(0), 1.0); put(buf, kick(), F(16), 0.8); put(buf, noise(0.2, 0.06), F(16), 0.4)  # hook hits
for s in (66, 180, 294, 450, 510): put(buf, whoosh(0.45), F(s) - 0.15, 0.55)                 # scene changes
def ticks(start, n, hi_from):
    for i in range(n): put(buf, tone(1600 if i >= hi_from else 1000, 0.08, r=0.03), F(start) + i, 0.55)
def chime(at):
    for j, f0 in enumerate([659.3, 830.6, 987.8]): put(buf, tone(f0, 0.9, r=0.35), F(at) + j * 0.08, 0.45)
ticks(82, 3, 9); chime(172)
ticks(196, 3, 9); chime(286)
ticks(310, 4, 2)                                                                             # trap: last two ticks higher
put(buf, tone(196, 0.55, r=0.2, kind="square") + tone(185, 0.55, r=0.2, kind="square"), F(430), 0.5)   # buzzer: "+5% EMAS!"
put(buf, kick(), F(430), 0.9)
riser = np.linspace(0, 1, int(1.6 * SR)); t = np.arange(len(riser)) / SR                    # suspense riser under the lock
put(buf, np.sin(2 * np.pi * (300 + 500 * riser) * t) * riser * 0.5, F(450))
put(buf, noise(0.12, 0.03), F(464), 0.6); put(buf, kick(), F(480), 0.7)                     # lock clunk
for j, f0 in enumerate([523.3, 659.3, 784, 1046.5]): put(buf, tone(f0, 1.6, r=0.6), F(512) + j * 0.1, 0.45)
save(buf[: int(DUR * SR)], "public/track.wav")
print("public/track.wav", round(DUR, 2), "s")
