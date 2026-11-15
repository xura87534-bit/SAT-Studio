"""UZ02 — "Hozircha bepul": Uzbek-voiced ad built from real app screens.

Free for now, Pro is coming, founding price for the first 100 students.
Each scene lasts as long as its voice line; the line is also burned in as a subtitle so the reel reads muted.
Text and cards stay between y=200 and y=1540, clear of Instagram's own buttons and caption.

    python uz02_bepul.py              # full render -> renders/UZ02_bepul.mp4
    python uz02_bepul.py 1 6 14 19    # single frames (seconds) into $FRAMES or the current folder
    python uz02_bepul.py --voice      # re-record the voice lines (needs network access to speech.platform.bing.com)

Voice: Microsoft neural Uzbek voice uz-UZ-MadinaNeural through edge-tts; the recorded lines are kept in vo/.
"""
import sys, os, subprocess
import numpy as np
from PIL import Image, ImageDraw
from common import W, H, FPS, font, ease, back, wrap, Writer, LOGO, SR, tone, whoosh, put, mux
import wave

BG, BG2 = (242, 231, 216), (251, 247, 241)
INK, DIM, BLUE, BLUE2 = (29, 29, 31), (110, 110, 115), (29, 63, 115), (106, 147, 203)
GREEN, WHITE, EDGE = (36, 138, 61), (255, 255, 255), (224, 216, 204)
VOICE, RATE = "uz-UZ-MadinaNeural", "+10%"
GAP, TAIL = 0.28, 1.3

# kind, voice line, headline (two lines), then scene data
SCENES = [
    ("shot",  "To‘xtang! Bu SAT testlari hozircha bepul.",              ("Bu SAT testlari", "hozircha BEPUL"),   ("home", 0, 240)),
    ("shot",  "SAT Studio’da testlar xuddi haqiqiy imtihondagidek.",    ("Xuddi haqiqiy", "SAT kabi"),           ("question", 0, 110)),
    ("shot",  "Ikkinchi modul sizning natijangizga moslashadi.",        ("2-modul sizga", "moslashadi"),         ("adaptive", 70, 190)),
    ("shot",  "Test tugashi bilan ballingizni ko‘rasiz.",               ("Ballingiz", "darhol tayyor"),          ("results", 0, 430)),
    ("price", "Tez orada Pro tarif chiqadi. Birinchi yuzta o‘quvchiga to‘qson kun — to‘qson to‘qqiz ming so‘m.", ("Tez orada:", "Pro tarif"), None),
    ("free",  "Hozir esa hammasi bepul. Ro‘yxatdan o‘tish ham shart emas.", ("Hozir esa", "hammasi BEPUL"),      None),
    ("end",   "SAT Studio. Link bioda.",                                 None,                                    None),
]

# ---------- voice ----------
def record():
    import asyncio, certifi
    if os.path.exists("/root/.ccr/ca-bundle.crt"): certifi.where = lambda: "/root/.ccr/ca-bundle.crt"
    import edge_tts
    async def go():
        for i, s in enumerate(SCENES): await edge_tts.Communicate(s[1], VOICE, rate=RATE).save(f"vo/uz02_{i + 1}.mp3")
    os.makedirs("vo", exist_ok=True); asyncio.run(go())

def load(path):
    raw = subprocess.check_output(["ffmpeg", "-v", "error", "-i", path, "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"])
    a = np.frombuffer(raw, np.float32).astype(np.float64)
    loud = np.where(np.abs(a) > 0.012)[0]                       # trim the silence the voice service pads with
    return a[max(0, loud[0] - int(0.03 * SR)): loud[-1] + int(0.08 * SR)] if len(loud) else a

if sys.argv[1:] == ["--voice"]: record(); print("voice lines saved in vo/"); sys.exit()
VO = [load(f"vo/uz02_{i + 1}.mp3") for i in range(len(SCENES))]
LEN = [len(v) / SR + (TAIL if i == len(VO) - 1 else GAP) for i, v in enumerate(VO)]
START = [sum(LEN[:i]) for i in range(len(LEN))]
DUR = sum(LEN)

# ---------- drawing ----------
_bg = None
def bg():
    global _bg
    if _bg is None:
        y = np.linspace(0, 1, H)[:, None]; x = np.linspace(0, 1, W)[None, :]
        g = np.clip(1 - np.hypot(x - 0.5, (y - 0.38) * 1.4) * 1.2, 0, 1)[..., None]
        _bg = Image.fromarray((np.array(BG) + (np.array(BG2) - np.array(BG)) * g).astype(np.uint8)).convert("RGBA")
    return _bg.copy()

def text(d, y, s, f, fill, a=1.0, x=None):
    w = d.textlength(s, font=f)
    d.text(((W - w) / 2 if x is None else x, y), s, font=f, fill=fill + (int(255 * max(0, min(1, a))),))
    return w

CW, CH, CX, CY = 800, 900, 140, 480          # the screen card
_shots, _mask = {}, None
def shot(name):
    if name not in _shots:
        im = Image.open(f"shots/{name}.jpg").convert("RGB")
        _shots[name] = im.resize((CW, int(im.height * CW / im.width)), Image.LANCZOS)
    return _shots[name]
def mask():
    global _mask
    if _mask is None:
        _mask = Image.new("L", (CW, CH), 0); ImageDraw.Draw(_mask).rounded_rectangle([0, 0, CW - 1, CH - 1], radius=48, fill=255)
    return _mask

def headline(d, lines, a, dy=0, y=215):
    f = font("InterDisplay-Black.otf", 104)
    text(d, y + dy, lines[0], f, INK, a); text(d, y + 118 + dy, lines[1], f, BLUE, a)

def subtitle(img, s, a):
    if a <= 0: return
    d = ImageDraw.Draw(img, "RGBA"); f = font("Inter-SemiBold.otf", 42)
    lines = wrap(d, s, f, 860); h = len(lines) * 56 + 36; y = 1540 - h
    lay = Image.new("RGBA", (W, H), (0, 0, 0, 0)); ld = ImageDraw.Draw(lay)
    ld.rounded_rectangle([80, y, W - 80, y + h], radius=30, fill=INK + (int(210 * a),))
    for i, ln in enumerate(lines):
        w = ld.textlength(ln, font=f); ld.text(((W - w) / 2, y + 16 + i * 56), ln, font=f, fill=WHITE + (int(255 * a),))
    img.alpha_composite(lay)

def frame(t):
    img = bg(); d = ImageDraw.Draw(img, "RGBA")
    i = max(k for k in range(len(START)) if t >= START[k]) if t >= 0 else 0
    kind, line, head, data = SCENES[i]; u = t - START[i]; L = LEN[i]
    a = ease(u / 0.3) * (1 - ease((u - L + 0.2) / 0.2)) if i < len(SCENES) - 1 else ease(u / 0.3)
    dy = 40 * (1 - ease(u / 0.35))

    if kind == "shot":
        headline(d, head, a, dy)
        name, y0, y1 = data; s = shot(name); off = int(y0 + (y1 - y0) * ease(u / L) )
        crop = s.crop((0, off, CW, off + CH)).convert("RGBA")
        m = mask().point(lambda v: int(v * a)); crop.putalpha(m)
        d.rounded_rectangle([CX - 5, CY - 5 + dy, CX + CW + 4, CY + CH + 4 + dy], radius=52, fill=EDGE + (int(255 * a),))
        img.alpha_composite(crop, (CX, int(CY + dy)))
    elif kind == "price":
        headline(d, head, a, dy)
        d.rounded_rectangle([110, 500 + dy, W - 110, 1250 + dy], radius=52, fill=WHITE + (int(255 * a),), outline=BLUE + (int(255 * a),), width=6)
        tw = d.textlength("ENG OMMABOP", font=font("Inter-SemiBold.otf", 34)) + 56
        d.rounded_rectangle([160, 474 + dy, 160 + tw, 536 + dy], radius=31, fill=BLUE + (int(255 * a),))
        d.text((188, 484 + dy), "ENG OMMABOP", font=font("Inter-SemiBold.otf", 34), fill=WHITE + (int(255 * a),))
        text(d, 590 + dy, "90 kunlik tarif", font("InterDisplay-Bold.otf", 64), INK, a)
        p1 = ease((u - 1.6) / 0.4)                                # the old price, then struck through
        f = font("InterDisplay-Bold.otf", 72); s0 = "149 000 so‘m"; w0 = d.textlength(s0, font=f)
        text(d, 720 + dy, s0, f, DIM, a * ease((u - 1.0) / 0.3))
        if p1 > 0: d.line([((W - w0) / 2 - 12, 766 + dy), ((W - w0) / 2 - 12 + (w0 + 24) * p1, 766 + dy)], fill=DIM + (int(255 * a),), width=7)
        p2 = back((u - 2.3) / 0.4) if u > 2.3 else 0
        if p2 > 0:
            text(d, 850 + dy, "99 000", font("InterDisplay-Black.otf", int(190 * max(0.3, p2))), BLUE, a)
            text(d, 1060 + dy, "so‘m", font("InterDisplay-Bold.otf", 60), DIM, a * ease((u - 2.5) / 0.3))
        text(d, 1160 + dy, "Birinchi 100 o‘quvchi uchun", font("Inter-SemiBold.otf", 44), GREEN, a * ease((u - 3.0) / 0.4))
    elif kind == "free":
        f = font("InterDisplay-Black.otf", 124)
        text(d, 470 + dy, head[0], f, INK, a); p = back((u - 0.35) / 0.4) if u > 0.35 else 0
        text(d, 620 + dy, head[1], font("InterDisplay-Black.otf", int(124 * max(0.3, p))), BLUE, a * ease((u - 0.35) / 0.2))
        for k, s in enumerate(["To‘liq moslashuvchan testlar", "Ball va tahlil — darhol", "Ro‘yxatdan o‘tish shart emas"]):
            ak = a * ease((u - 1.1 - k * 0.45) / 0.35); y = 860 + k * 130
            d.rounded_rectangle([150, y, W - 150, y + 104], radius=52, fill=WHITE + (int(255 * ak),), outline=EDGE + (int(255 * ak),), width=3)
            d.ellipse([176, y + 22, 236, y + 82], fill=GREEN + (int(255 * ak),))
            d.line([(192, y + 54), (203, y + 66), (222, y + 40)], fill=WHITE + (int(255 * ak),), width=7, joint="curve")
            d.text((262, y + 26), s, font=font("Inter-SemiBold.otf", 44), fill=INK + (int(255 * ak),))
    else:
        s = int(300 * back(u / 0.45))
        if s > 10: img.alpha_composite(LOGO.resize((s, s)), ((W - s) // 2, 610 - s // 2))
        text(d, 860, "SAT STUDIO", font("InterDisplay-Black.otf", 100), INK, ease((u - 0.2) / 0.3))
        text(d, 1010, "Hozircha hammasi bepul", font("InterDisplay-Bold.otf", 62), DIM, ease((u - 0.4) / 0.3))
        ab = ease((u - 0.6) / 0.3); f = font("InterDisplay-Black.otf", 80); w = d.textlength("Link bioda", font=f)
        d.rounded_rectangle([(W - w) / 2 - 64, 1150, (W + w) / 2 + 64, 1296], radius=73, fill=BLUE + (int(255 * ab),))
        text(d, 1174, "Link bioda", f, WHITE, ab)
    if kind != "end": subtitle(img, line, a)
    return img

def audio(path):
    n = int(DUR * SR); bed = np.zeros(n); vo = np.zeros(n)
    for k, f0 in enumerate([110, 82.4, 98, 73.4] * 3):          # soft bed under the voice
        put(bed, tone(f0, 4.4, a=0.7, r=2.6) + 0.5 * tone(f0 * 1.5, 4.4, a=0.9, r=2.4) + 0.25 * tone(f0 * 2, 4.4, a=1.0, r=2.0), k * 3.8)
    for i, s in enumerate(START):
        if i: put(bed, whoosh(0.45) * 0.6, s - 0.2)
        put(vo, VO[i], s + 0.05)
    for j, f0 in enumerate([523.3, 659.3, 784, 1046.5]): put(bed, tone(f0, 1.4, r=0.5) * 0.5, START[-1] + 0.1 + j * 0.1)
    bed = bed / max(1e-9, np.max(np.abs(bed))) * 0.16; vo = vo / max(1e-9, np.max(np.abs(vo))) * 0.9
    mix = np.clip(vo + bed, -1, 1); st = (np.stack([mix, mix], 1) * 32767).astype(np.int16)
    with wave.open(path, "wb") as w: w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(st.tobytes())

if __name__ == "__main__":
    args = sys.argv[1:]
    if args:
        out = os.environ.get("FRAMES", ".")
        for a in args: frame(float(a)).convert("RGB").save(os.path.join(out, f"uz02_{a}.png"))
        print("length", round(DUR, 2), [round(s, 2) for s in START])
    else:
        os.makedirs("renders", exist_ok=True)
        w = Writer("renders/_uz02.mp4")
        for i in range(int(DUR * FPS)): w.add(frame(i / FPS))
        w.close(); audio("renders/_uz02.wav")
        mux("renders/_uz02.mp4", "renders/_uz02.wav", "renders/UZ02_bepul.mp4")
        os.remove("renders/_uz02.mp4"); os.remove("renders/_uz02.wav")
        print("renders/UZ02_bepul.mp4", round(DUR, 2), "s")
