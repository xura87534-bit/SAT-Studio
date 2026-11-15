"""UZ03 — the Gemini-generated two-student ad, finished for Instagram.

Takes source/r2_gemini.mp4 (30 s, 720x1280, Uzbek dialogue) and:
  - cuts the silent stretch at the start of the second clip,
  - burns in the spoken lines as subtitles, timed to where the speech is,
  - adds a small SAT Studio tag and a closing card with "Link bioda".

    python uz03_odamlar.py            # -> renders/UZ03_odamlar.mp4
    python uz03_odamlar.py 2.5 13 27  # check frames (output seconds) into $FRAMES or the current folder
"""
import sys, os, subprocess, wave
import numpy as np
from PIL import Image, ImageDraw
from common import W, H, FPS, font, ease, back, wrap, Writer, LOGO, SR, tone, put, mux

SRC = "source/r2_gemini.mp4"
CUT = (10.0, 12.3)            # dead air: both students silently looking at the phone
END = 2.6                     # closing card length
INK, DIM, BLUE, WHITE = (29, 29, 31), (110, 110, 115), (29, 63, 115), (255, 255, 255)
BG = (242, 231, 216)
# (start, end) in source seconds, taken from where the speech sits in the audio
SUBS = [
    (1.45, 4.25, "Men SAT’ga bir so‘m ham to‘lamay tayyorlanyapman."),
    (4.65, 6.10, "Hammasi shu yerda."),
    (6.95, 7.90, "Bepulmi?!"),
    (8.15, 9.90, "Hozircha, ha."),
    (14.40, 17.70, "Voy! Ballim darhol chiqdi!"),
    (18.45, 19.95, "Aytdim-ku!"),
    (20.35, 22.40, "Lekin tez orada pullik bo‘ladi."),
    (23.25, 25.40, "Ulgurib qoling!"),
    (26.65, 29.00, "Link bioda."),
]
src_len = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", SRC]))
BODY = src_len - (CUT[1] - CUT[0])
DUR = BODY + END
def to_src(t): return t if t < CUT[0] else t + (CUT[1] - CUT[0])     # output time -> source time

def overlay(img, ts, t_out):
    d = ImageDraw.Draw(img, "RGBA")
    # brand tag, top centre
    f = font("Inter-SemiBold.otf", 38); w = d.textlength("SAT Studio", font=f); x0 = (W - w - 74) / 2
    lay = Image.new("RGBA", (W, H), (0, 0, 0, 0)); ld = ImageDraw.Draw(lay)
    ld.rounded_rectangle([x0 - 22, 150, x0 + w + 96, 226], radius=38, fill=WHITE + (225,))
    lay.alpha_composite(LOGO.resize((52, 52)), (int(x0 - 8), 162)); ld.text((x0 + 58, 164), "SAT Studio", font=f, fill=INK + (255,))
    for a, b, s in SUBS:
        if a - 0.05 <= ts <= b:
            k = ease((ts - a + 0.05) / 0.12); fs = font("InterDisplay-Black.otf", 66)
            lines = wrap(ld, s, fs, 900); h = len(lines) * 84 + 44; y = 1400 - h + 14 * (1 - k)
            ld.rounded_rectangle([70, y, W - 70, y + h], radius=34, fill=INK + (int(215 * k),))
            for i, ln in enumerate(lines):
                lw = ld.textlength(ln, font=fs); ld.text(((W - lw) / 2, y + 18 + i * 84), ln, font=fs, fill=WHITE + (int(255 * k),))
    img.alpha_composite(lay)

def endcard(last, u):
    p = ease(u / 0.35)
    img = Image.blend(last.convert("RGBA"), Image.new("RGBA", (W, H), BG + (255,)), p)
    d = ImageDraw.Draw(img, "RGBA")
    def text(y, s, f, fill, a):
        w = d.textlength(s, font=f); d.text(((W - w) / 2, y), s, font=f, fill=fill + (int(255 * max(0, min(1, a))),))
    s = int(300 * back((u - 0.15) / 0.4)) if u > 0.15 else 0
    if s > 10: img.alpha_composite(LOGO.resize((s, s)), ((W - s) // 2, 610 - s // 2))
    text(860, "SAT STUDIO", font("InterDisplay-Black.otf", 100), INK, ease((u - 0.35) / 0.3))
    text(1010, "Hozircha hammasi bepul", font("InterDisplay-Bold.otf", 62), DIM, ease((u - 0.5) / 0.3))
    ab = ease((u - 0.65) / 0.3); f = font("InterDisplay-Black.otf", 80); w = d.textlength("Link bioda", font=f)
    d.rounded_rectangle([(W - w) / 2 - 64, 1150, (W + w) / 2 + 64, 1296], radius=73, fill=BLUE + (int(255 * ab),))
    text(1174, "Link bioda", f, WHITE, ab)
    return img

def frames():
    """Yield (output time, composed frame) for the body, reading the source at 30 fps and skipping the cut."""
    p = subprocess.Popen(["ffmpeg", "-v", "error", "-i", SRC, "-vf", f"fps={FPS},scale={W}:{H}:flags=lanczos", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE)
    n = W * H * 3; i = 0; k = 0
    while True:
        raw = p.stdout.read(n)
        if len(raw) < n: break
        ts = i / FPS; i += 1
        if CUT[0] <= ts < CUT[1]: continue
        img = Image.frombytes("RGB", (W, H), raw).convert("RGBA"); t_out = k / FPS; k += 1
        yield t_out, ts, img
    p.wait()

def audio(path):
    raw = subprocess.check_output(["ffmpeg", "-v", "error", "-i", SRC, "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"])
    a = np.frombuffer(raw, np.float32).astype(np.float64)
    a0, a1 = int(CUT[0] * SR), int(CUT[1] * SR); f = int(0.02 * SR)
    left, right = a[:a0].copy(), a[a1:].copy(); left[-f:] *= np.linspace(1, 0, f); right[:f] *= np.linspace(0, 1, f)
    body = np.concatenate([left, right]); tail = np.zeros(int(END * SR))
    for j, f0 in enumerate([523.3, 659.3, 784, 1046.5]): put(tail, tone(f0, 1.6, r=0.55) * 0.22, 0.15 + j * 0.1)
    body[-int(0.25 * SR):] *= np.linspace(1, 0, int(0.25 * SR))
    mix = np.clip(np.concatenate([body, tail]), -1, 1); st = (np.stack([mix, mix], 1) * 32767).astype(np.int16)
    with wave.open(path, "wb") as w: w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(st.tobytes())

if __name__ == "__main__":
    want = [float(x) for x in sys.argv[1:]]
    if want:
        out = os.environ.get("FRAMES", "."); last = None
        for t, ts, img in frames():
            overlay(img, ts, t); last = img
            for x in list(want):
                if t >= x: img.convert("RGB").save(os.path.join(out, f"uz03_{x}.png")); want.remove(x)
        for x in want: endcard(last, x - BODY).convert("RGB").save(os.path.join(out, f"uz03_{x}.png"))
        print("length", round(DUR, 2))
    else:
        os.makedirs("renders", exist_ok=True); w = Writer("renders/_uz03.mp4"); last = None
        for t, ts, img in frames(): overlay(img, ts, t); w.add(img); last = img
        for i in range(int(END * FPS)): w.add(endcard(last, i / FPS))
        w.close(); audio("renders/_uz03.wav")
        # even out the level: the source has one loud thud and quiet voices
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", "renders/_uz03.mp4", "-i", "renders/_uz03.wav", "-map", "0:v", "-map", "1:a", "-c:v", "copy",
                        "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-c:a", "aac", "-b:a", "192k", "renders/UZ03_odamlar.mp4"], check=True)
        os.remove("renders/_uz03.mp4"); os.remove("renders/_uz03.wav")
        print("renders/UZ03_odamlar.mp4", round(DUR, 2), "s")
