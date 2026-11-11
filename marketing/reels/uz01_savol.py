"""UZ01 — "5 soniyada yecha olasizmi?"  A real SAT question, in Uzbek, 15 s.

Hook (0-1.6) -> question + 5 s countdown (1.6-7.6) -> answer and steps (7.6-12.4) -> end card (12.4-15).
App colours: Washington blue on ballet white. Text only, no voice: ticks, a chime and a soft bed.

    python uz01_savol.py              # full render -> renders/UZ01_savol.mp4
    python uz01_savol.py 0.9 5 10 14  # single frames -> /tmp-style check PNGs next to the script
"""
import sys, math, os
import numpy as np
from PIL import Image, ImageDraw
from common import W, H, FPS, font, ease, back, wrap, Writer, LOGO, SR, tone, noise, kick, whoosh, put, save, mux

BG, BG2 = (242, 231, 216), (251, 247, 241)
INK, DIM, BLUE, BLUE2 = (29, 29, 31), (110, 110, 115), (29, 63, 115), (106, 147, 203)
GREEN, RED, WHITE = (36, 138, 61), (215, 0, 21), (255, 255, 255)
DUR = 15.0
T_Q, T_COUNT, T_UP, T_END = 1.6, 2.6, 7.6, 12.4   # question in, countdown starts, time's up / reveal, end card
SECS = 5

HOOK = ["5 soniyada", "yecha olasizmi?"]
EQ = "6x + 4 = 2(3x + k)"
ASK = "Tenglama cheksiz ko’p yechimga ega."
ASK2 = "k = ?"
OPTS = [("A", "0"), ("B", "2"), ("C", "4"), ("D", "6")]
RIGHT = 1
STEPS = ["2(3x + k) = 6x + 2k", "6x + 4 = 6x + 2k", "2k = 4", "k = 2"]
CTA1, CTA2 = "Shunaqa savollar bepul", "Link bioda"

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

def card(d, box, a=1.0, fill=WHITE, outline=None, width=0, r=44):
    x0, y0, x1, y1 = box
    d.rounded_rectangle(box, radius=r, fill=fill + (int(255 * a),), outline=(outline or (224, 216, 204)) + (int(255 * a),), width=width or 3)  # fills replace pixels on RGBA, so the edge is a solid tint

def frame(t):
    img = bg(); d = ImageDraw.Draw(img, "RGBA")

    # ---- hook ----
    if t < T_Q + 0.25:
        out = ease((t - T_Q + 0.1) / 0.3)
        f1, f2 = font("InterDisplay-Black.otf", 150), font("InterDisplay-Black.otf", 118)
        p1, p2 = back(t / 0.35), back((t - 0.25) / 0.35)
        text(d, 700 - 60 * (1 - p1) - 240 * out, HOOK[0], f1, BLUE, p1 * (1 - out))
        text(d, 880 + 60 * (1 - p2) - 240 * out, HOOK[1], f2, INK, max(0, p2) * (1 - out))
        if t > 0.7:
            text(d, 1080 - 240 * out, "SAT Math", font("Inter-SemiBold.otf", 52), DIM, ease((t - 0.7) / 0.3) * (1 - out))

    # ---- question card ----
    if T_Q <= t < T_END + 0.2:
        a = ease((t - T_Q) / 0.35) * (1 - ease((t - T_END + 0.15) / 0.3))
        dy = 50 * (1 - ease((t - T_Q) / 0.35))
        reveal = t >= T_UP
        # countdown ring
        cx, cy, R = W // 2, 300 + dy, 118
        left = SECS - (t - T_COUNT)
        if not reveal:
            frac = max(0, min(1, left / SECS)) if t >= T_COUNT else 1
            col = RED if left <= 2 and t >= T_COUNT else BLUE
            d.ellipse([cx - R, cy - R, cx + R, cy + R], outline=(29, 29, 31, int(26 * a)), width=16)
            d.arc([cx - R, cy - R, cx + R, cy + R], -90, -90 + 360 * frac, fill=col + (int(255 * a),), width=16)
            n = str(SECS if t < T_COUNT else max(1, math.ceil(left)))
            pulse = 1 + 0.12 * max(0, 1 - ((t - T_COUNT) % 1) / 0.25) if t >= T_COUNT else 1
            fn = font("InterDisplay-Black.otf", int(128 * pulse))
            w = d.textlength(n, font=fn); d.text((cx - w / 2, cy - 78 * pulse), n, font=fn, fill=col + (int(255 * a),))
        else:
            p = back((t - T_UP) / 0.35)
            text(d, cy - 70, "Javob: B", font("InterDisplay-Black.otf", int(120 * max(0.2, p))), GREEN, a * ease((t - T_UP) / 0.2))
        # card
        card(d, [70, 470 + dy, W - 70, 1010 + dy], a)
        text(d, 510 + dy, "SAT · MATH", font("Inter-SemiBold.otf", 38), BLUE2, a)
        text(d, 590 + dy, EQ, font("InterDisplay-Bold.otf", 96), INK, a)
        text(d, 765 + dy, ASK, font("Inter-SemiBold.otf", 46), DIM, a)
        text(d, 870 + dy, ASK2, font("InterDisplay-Black.otf", 92), BLUE, a)
        # options, 2 x 2
        fo, fl = font("InterDisplay-Bold.otf", 76), font("Inter-SemiBold.otf", 46)
        for i, (L, v) in enumerate(OPTS):
            ai = a * ease((t - T_Q - 0.25 - i * 0.08) / 0.3)
            x0 = 70 + (i % 2) * 485; y0 = 1060 + dy + (i // 2) * 190; box = [x0, y0, x0 + 455, y0 + 160]
            ok = reveal and i == RIGHT; dim = reveal and i != RIGHT
            k = ease((t - T_UP) / 0.3) if reveal else 0
            if ok: card(d, box, ai, fill=tuple(int(255 + (c - 255) * k) for c in GREEN), r=36)
            else: card(d, box, ai * (1 - 0.55 * k if dim else 1), r=36)
            d.text((x0 + 44, y0 + 52), L, font=fl, fill=((WHITE if ok and k > .5 else BLUE2) + (int(255 * ai),)))
            w = d.textlength(v, font=fo)
            d.text((x0 + 455 / 2 - w / 2 + 16, y0 + 34), v, font=fo, fill=((WHITE if ok and k > .5 else INK) + (int(255 * ai * (1 - 0.6 * k if dim else 1)),)))
        # under the options: prompt while counting, steps after
        if not reveal:
            text(d, 1500 + dy, "Javobni izohga yozing", font("Inter-SemiBold.otf", 54), INK, a * ease((t - T_Q - 0.8) / 0.4))
        else:
            fs = font("InterDisplay-Bold.otf", 62)
            for i, s in enumerate(STEPS):
                ts = T_UP + 0.7 + i * 0.75; ps = ease((t - ts) / 0.3)
                last = i == len(STEPS) - 1
                text(d, 1470 + i * 86 + 20 * (1 - ps), s, font("InterDisplay-Black.otf", 76) if last else fs, GREEN if last else INK, a * ps)

    # ---- end card ----
    if t >= T_END:
        p = (t - T_END) / (DUR - T_END)
        s = int(300 * back(p / 0.25))
        if s > 10: img.alpha_composite(LOGO.resize((s, s)), ((W - s) // 2, 640 - s // 2))
        text(d, 900, "SAT STUDIO", font("InterDisplay-Black.otf", 96), INK, ease((p - 0.12) / 0.2))
        text(d, 1060, CTA1, font("InterDisplay-Bold.otf", 66), DIM, ease((p - 0.22) / 0.2))
        a = ease((p - 0.34) / 0.2); f = font("InterDisplay-Black.otf", 78); w = d.textlength(CTA2, font=f)
        d.rounded_rectangle([(W - w) / 2 - 60, 1200, (W + w) / 2 + 60, 1340], radius=70, fill=BLUE + (int(255 * a),))
        text(d, 1222, CTA2, f, WHITE, a)
    return img

def audio(path):
    buf = np.zeros(int(DUR * SR))
    for i, f0 in enumerate([110, 82.4, 98, 110]):                       # soft bed
        put(buf, tone(f0, 4.2, a=0.6, r=2.4) + 0.5 * tone(f0 * 1.5, 4.2, a=0.8, r=2.2), i * 3.7, 0.18)
    put(buf, kick(), 0.0, 0.9); put(buf, kick(), 0.25, 0.7)
    put(buf, whoosh(0.5), T_Q - 0.25, 0.5)
    for i in range(SECS):                                               # ticks, higher on the last two
        put(buf, tone(1500 if i >= SECS - 2 else 1000, 0.09, r=0.03), T_COUNT + i, 0.5)
    put(buf, tone(220, 0.5, r=0.18, kind="square"), T_UP - 0.02, 0.35)  # time's up
    for j, f0 in enumerate([659.3, 830.6, 987.8]): put(buf, tone(f0, 0.9, r=0.35), T_UP + 0.3 + j * 0.09, 0.4)
    for i in range(len(STEPS)): put(buf, noise(0.05, 0.02), T_UP + 0.7 + i * 0.75, 0.25)
    put(buf, whoosh(0.5), T_END - 0.2, 0.5)
    for j, f0 in enumerate([523.3, 659.3, 784, 1046.5]): put(buf, tone(f0, 1.4, r=0.5), T_END + 0.2 + j * 0.1, 0.35)
    save(buf, path)

if __name__ == "__main__":
    if len(sys.argv) > 1:
        out = os.environ.get("FRAMES", ".")
        for a in sys.argv[1:]: frame(float(a)).convert("RGB").save(os.path.join(out, f"uz01_{a}.png"))
    else:
        os.makedirs("renders", exist_ok=True)
        w = Writer("renders/_uz01.mp4")
        for i in range(int(DUR * FPS)): w.add(frame(i / FPS))
        w.close(); audio("renders/_uz01.wav")
        mux("renders/_uz01.mp4", "renders/_uz01.wav", "renders/UZ01_savol.mp4")
        os.remove("renders/_uz01.mp4"); os.remove("renders/_uz01.wav")
        print("renders/UZ01_savol.mp4")
