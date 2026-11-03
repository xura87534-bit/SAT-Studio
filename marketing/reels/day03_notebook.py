import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
from PIL import ImageChops

_MONO_PATH = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"
def mono(size):
    if os.path.exists(_MONO_PATH):
        return ImageFont.truetype(_MONO_PATH, size)
    return font("Inter-Medium.otf", size)

T   = 23.0
P   = pal("Forest Terminal")
A   = P["accent"]; INKC = P["ink"]; DIM = P["dim"]; WARN = P["warn"]
BG  = P["bg"];     BG2  = P["bg2"]

# Beat boundaries from the script
B1, B2, B3, B4 = 2.0, 10.0, 17.0, 21.0

# --- notebook layout ---
PAGE_X0, PAGE_Y0, PAGE_X1, PAGE_Y1 = 110, 300, W-110, 1540
HEADER_H  = 90                        # top strip for "~/notebook" header
LINE_Y0   = PAGE_Y0 + HEADER_H + 110  # first ruled line
LINE_STEP = 110
MARGIN_X  = 250                       # the red vertical margin line
# Page fill: a warm paper-against-terminal mid tone (brighter than bg)
PAGE_FILL = (28, 54, 36)


def rrect(d, x0, y0, x1, y1, r, fill=None, outline=None, width=0):
    d.rounded_rectangle([x0, y0, x1, y1], radius=r, fill=fill,
                        outline=outline, width=width)


def ruled_page(d, a=1.0, n_lines=11, shift_y=0):
    """A sheet of ruled notebook paper, rendered as a terminal-tinted card."""
    if a <= 0: return
    rrect(d, PAGE_X0, PAGE_Y0+shift_y, PAGE_X1, PAGE_Y1+shift_y, 28,
          fill=PAGE_FILL + (int(250 * a),))
    # top header strip (slightly darker)
    hdr_y1 = PAGE_Y0 + HEADER_H + shift_y
    d.rectangle([PAGE_X0+2, PAGE_Y0+shift_y+30, PAGE_X1-2, hdr_y1-2],
                fill=(18, 36, 24, int(230*a)))
    # thin divider under header
    d.line([(PAGE_X0+30, hdr_y1), (PAGE_X1-30, hdr_y1)],
           fill=DIM+(int(180*a),), width=2)
    # ruled lines
    for i in range(n_lines):
        y = LINE_Y0 + i*LINE_STEP + shift_y
        if y > PAGE_Y1-30+shift_y: break
        d.line([(PAGE_X0+40, y), (PAGE_X1-40, y)],
               fill=(80, 120, 92, int(170*a)), width=2)
    # red margin line, the handwritten anchor
    d.line([(MARGIN_X, hdr_y1+10),
            (MARGIN_X, PAGE_Y1-40+shift_y)],
           fill=WARN+(int(170*a),), width=3)
    # three hole-punches on the left (subtle)
    for ry in (PAGE_Y0+200, PAGE_Y0+ (PAGE_Y1-PAGE_Y0)//2,
               PAGE_Y1-200):
        cy = ry + shift_y
        d.ellipse([PAGE_X0+36, cy-14, PAGE_X0+64, cy+14],
                  fill=BG+(int(220*a),))


# ---------------- handwriting sim ----------------
def _jittered_char(img, x, y, ch, f, col, seed):
    rng = random.Random(seed)
    jx = rng.uniform(-3.0, 3.0)
    jy = rng.uniform(-2.5, 2.5)
    rot = rng.uniform(-3.5, 3.5)
    # Rotation via a tiny temp image so chars feel handwritten
    tmp = Image.new("RGBA", (140, 160), (0,0,0,0))
    td = ImageDraw.Draw(tmp, "RGBA")
    td.text((20, 20), ch, font=f, fill=col)
    tmp = tmp.rotate(rot, resample=Image.BILINEAR)
    img.alpha_composite(tmp, (int(x+jx)-20, int(y+jy)-20))

def hw(img, d, x, y, text, col, size=58, prog=1.0, seed=0, italic=True,
       underline_c=None):
    """
    Handwritten-style text reveal, character by character.
    prog: 0..1 — shown fraction (chars). >1 means fully shown.
    """
    f = font("Inter-MediumItalic.otf" if italic else "Inter-Medium.otf", size)
    n = len(text)
    if n == 0: return x
    shown = max(0, min(n, int(prog * n * 1.08)))
    cx = x
    for i, ch in enumerate(text):
        if i >= shown: break
        if ch == " ":
            cx += d.textlength(" ", font=f)
            continue
        _jittered_char(img, cx, y, ch, f, col, seed + i * 17)
        cx += d.textlength(ch, font=f) + 1
    if underline_c is not None and shown >= n:
        d.line([(x-2, y+size+8), (cx+2, y+size+8)],
               fill=underline_c+(220,), width=3)
    return cx


# ---------------- phase 1: hook ----------------
def phase_hook(img, t):
    """0-2 s: paper lights up, a wrong equation and answer handwrite in,
       then a red strike crosses the answer out."""
    d = ImageDraw.Draw(img, "RGBA")
    pa = ease(t / 0.45)
    ruled_page(d, a=pa)

    # Page header
    hf = mono(38)
    hdr = "~/notebook  mistakes.md"
    hw_label = INKC+(int(210*pa),)
    d.text((PAGE_X0+60, PAGE_Y0+42), hdr, font=hf, fill=hw_label)
    d.text((PAGE_X1-190, PAGE_Y0+42), "p.01", font=hf, fill=hw_label)

    # Equation on first ruled line
    eq_y = LINE_Y0 - 64
    # Full equation revealed over 0.0 .. 0.9 s
    eq_prog = max(0.0, (t - 0.1) / 0.75)
    hw(img, d, MARGIN_X+60, eq_y, "2x - 3 = 5", INKC, 68,
       prog=eq_prog, seed=1001)

    # Wrong answer on the next ruled line
    ans_y = LINE_Y0 + LINE_STEP - 64
    ans_prog = max(0.0, (t - 0.85) / 0.55)
    # label "x ="
    d_label_a = min(1.0, ans_prog * 1.3)
    if d_label_a > 0:
        lf = font("Inter-SemiBold.otf", 68)
        d.text((MARGIN_X+60, ans_y+6), "x =",
               font=lf, fill=INKC+(int(240*d_label_a),))
    hw(img, d, MARGIN_X+250, ans_y, "7", INKC, 80,
       prog=ans_prog, seed=2002)

    # Strike-through across "x = 7"
    strk = ease((t - 1.45) / 0.35)
    if strk > 0:
        sx0 = MARGIN_X + 46
        sx1 = MARGIN_X + 46 + int(320 * strk)
        d.line([(sx0, ans_y+56), (sx1, ans_y+64)],
               fill=WARN+(int(250),), width=8)
        # small x mark at right once the strike completes
        if strk > 0.9:
            d.line([(sx1+22, ans_y+24),(sx1+74, ans_y+76)],
                   fill=WARN+(255,), width=7)
            d.line([(sx1+22, ans_y+76),(sx1+74, ans_y+24)],
                   fill=WARN+(255,), width=7)

    cap(d, "One notebook. Only mistakes.", P,
        y=1680, size=54, alpha=ease((t - 0.3) / 0.5))


# ---------------- phase 2: the reason writes itself in ----------------
def phase_why(img, t):
    """2-10 s: beneath the wrong answer, the reason writes in,
       then the correct answer, then a yellow 'Wrong answer + why' tag."""
    u = t - B1
    d = ImageDraw.Draw(img, "RGBA")
    ruled_page(d, a=1.0)

    # Page header carried over
    hf = mono(38)
    d.text((PAGE_X0+60, PAGE_Y0+42), "~/notebook  mistakes.md",
           font=hf, fill=INKC+(210,))
    d.text((PAGE_X1-190, PAGE_Y0+42), "p.01",
           font=hf, fill=INKC+(210,))

    eq_y  = LINE_Y0 - 64
    ans_y = LINE_Y0 + LINE_STEP - 64

    # Carry the wrong eq + struck-out answer
    hw(img, d, MARGIN_X+60, eq_y, "2x - 3 = 5", INKC, 68, prog=1.1, seed=1001)
    lf56 = font("Inter-SemiBold.otf", 68)
    d.text((MARGIN_X+60, ans_y+6), "x =", font=lf56, fill=INKC+(240,))
    hw(img, d, MARGIN_X+250, ans_y, "7", INKC, 80, prog=1.1, seed=2002)
    # strike
    d.line([(MARGIN_X+46, ans_y+56), (MARGIN_X+366, ans_y+64)],
           fill=WARN+(250,), width=8)
    d.line([(MARGIN_X+388, ans_y+24),(MARGIN_X+440, ans_y+76)],
           fill=WARN+(255,), width=7)
    d.line([(MARGIN_X+388, ans_y+76),(MARGIN_X+440, ans_y+24)],
           fill=WARN+(255,), width=7)

    # --- "why" line ---
    why_y = LINE_Y0 + 2 * LINE_STEP - 64
    # small "why" chip just right of the margin line, inline with the reason
    chip_a = ease(u / 0.5)
    if chip_a > 0:
        rrect(d, MARGIN_X+30, why_y+16, MARGIN_X+156, why_y+84, 18,
              fill=A+(int(230*chip_a),))
        wf = font("InterDisplay-Bold.otf", 38)
        tw = d.textlength("why", font=wf)
        d.text((MARGIN_X+93-tw/2, why_y+26),
               "why", font=wf, fill=(14,20,14,int(255*chip_a)))

    # the reason itself handwrites over u: 0.5 .. 3.6 s
    reason_prog = max(0.0, (u - 0.5) / 3.1)
    hw(img, d, MARGIN_X+180, why_y, "forgot to add 3 first",
       A, 50, prog=reason_prog, seed=3003)

    # --- corrected answer on the next line ---
    right_y = LINE_Y0 + 3 * LINE_STEP - 64
    chip2_a = ease((u - 3.6) / 0.4)
    if chip2_a > 0:
        rrect(d, MARGIN_X+30, right_y+16, MARGIN_X+180, right_y+84, 18,
              fill=INKC+(int(230*chip2_a),))
        wf = font("InterDisplay-Bold.otf", 38)
        tw = d.textlength("right", font=wf)
        d.text((MARGIN_X+105-tw/2, right_y+26),
               "right", font=wf, fill=(14,20,14,int(255*chip2_a)))
    right_prog = max(0.0, (u - 3.9) / 1.0)
    if right_prog > 0.01:
        d.text((MARGIN_X+210, right_y+6), "x =",
               font=lf56, fill=INKC+(int(240*min(1,right_prog*2)),))
        hw(img, d, MARGIN_X+400, right_y, "4", INKC, 80,
           prog=right_prog, seed=4004)
    if right_prog >= 1.0:
        # a soft green checkmark
        cx, cy = MARGIN_X+520, right_y+54
        ck = min(1.0, (u - 4.9) / 0.35)
        if ck > 0:
            d.line([(cx, cy),(cx+24*ck, cy+24*ck)],
                   fill=A+(255,), width=8)
            if ck > 0.6:
                d.line([(cx+24, cy+24),(cx+24+48*((ck-0.6)/0.4),
                                         cy+24-48*((ck-0.6)/0.4))],
                       fill=A+(255,), width=8)

    # --- the tag "Wrong answer + why" lands bottom-right ---
    tag_a = ease((u - 5.3) / 0.6)
    if tag_a > 0:
        tx0, ty0 = PAGE_X0+90, PAGE_Y1-230
        tx1, ty1 = PAGE_X1-90, PAGE_Y1-100
        # label rail
        layer = Image.new("RGBA", (W, H), (0,0,0,0))
        ld = ImageDraw.Draw(layer, "RGBA")
        ld.rounded_rectangle([tx0, ty0, tx1, ty1], radius=28,
                             fill=(14, 28, 18, int(250*tag_a)))
        ld.rounded_rectangle([tx0, ty0, tx1, ty1], radius=28,
                             outline=A+(int(255*tag_a),), width=3)
        img.alpha_composite(layer)
        d = ImageDraw.Draw(img, "RGBA")
        hf = font("InterDisplay-Black.otf", 72)
        s = "Wrong answer + why"
        tw = d.textlength(s, font=hf)
        d.text(((W-tw)/2, ty0+28), s, font=hf, fill=INKC+(int(255*tag_a),))

    # No bottom caption in this phase — the on-page tag IS the text beat.


# ---------------- phase 3: speed-ramp through pages ----------------
PAGE_ROWS = [
    # (eq, wrong, reason, right)
    ("5x + 2 = 22", "6", "subtracted first", "4"),
    ("3(x-2) = 9",  "11", "forgot to distribute", "5"),
    ("x² = 49", "7", "missed the negative root", "±7"),
    ("|x-1| = 4",   "5", "only took the positive case", "5 or -3"),
    ("2x = -8",     "4",  "lost the sign when dividing", "-4"),
    ("x/3 = 9",     "3",  "divided instead of multiplying", "27"),
    ("(x+1)²=9", "2", "took one root only",      "2 or -4"),
    ("x+x = 10",    "10", "doubled both sides",     "5"),
    ("4-x = 1",     "5",  "rushed the sign flip",   "3"),
    ("x²-4=0", "2",  "ignored  ±",         "±2"),
    ("2(x+3)=14",   "8",  "multiplied just one term","4"),
    ("x³ = 27","9",  "confused cube with square","3"),
]

def _fast_page(img, idx, alpha=1.0, x_off=0, y_off=0, scale=1.0,
               rot=0.0, with_header=True, rows=None):
    """Draw a compressed page preview at a scale/offset for the whip."""
    if alpha <= 0: return
    # Composite onto a scratch layer so we can scale/rotate whole page
    layer = Image.new("RGBA", (W, H), (0,0,0,0))
    ld = ImageDraw.Draw(layer, "RGBA")
    # ruled page on the layer
    ld.rounded_rectangle([PAGE_X0, PAGE_Y0, PAGE_X1, PAGE_Y1], radius=28,
                         fill=PAGE_FILL+(255,))
    for i in range(11):
        y = LINE_Y0 + i*LINE_STEP
        if y > PAGE_Y1-30: break
        ld.line([(PAGE_X0+40, y), (PAGE_X1-40, y)],
                fill=DIM+(110,), width=2)
    ld.line([(MARGIN_X, PAGE_Y0+40),(MARGIN_X, PAGE_Y1-40)],
            fill=WARN+(140,), width=3)
    for ry in (PAGE_Y0+200, PAGE_Y0+ (PAGE_Y1-PAGE_Y0)//2, PAGE_Y1-200):
        ld.ellipse([PAGE_X0+40, ry-14, PAGE_X0+68, ry+14],
                   fill=BG+(220,))
    if with_header:
        hf = mono(36)
        ld.text((PAGE_X0+60, PAGE_Y0+30),
                "~/notebook — mistakes.md",
                font=hf, fill=DIM+(230,))
        ld.text((PAGE_X1-230, PAGE_Y0+30),
                f"p.{idx+1:02d}", font=hf, fill=DIM+(230,))
    # entries
    rows = rows or PAGE_ROWS[idx % len(PAGE_ROWS)*1:idx % len(PAGE_ROWS)+3]
    use = PAGE_ROWS[(idx) % len(PAGE_ROWS)], \
          PAGE_ROWS[(idx+1) % len(PAGE_ROWS)], \
          PAGE_ROWS[(idx+2) % len(PAGE_ROWS)]
    ef = font("Inter-Medium.otf", 42)
    wf = font("Inter-MediumItalic.otf", 38)
    for ri, (eq, wrong, reason, right) in enumerate(use):
        base = LINE_Y0 + ri*3*LINE_STEP
        if base + 3*LINE_STEP > PAGE_Y1-30: break
        # eq
        ld.text((MARGIN_X+30, base-44), eq, font=ef, fill=INKC+(230,))
        # wrong answer (struck out)
        aw = f"x = {wrong}"
        ld.text((MARGIN_X+30, base + LINE_STEP - 44),
                aw, font=ef, fill=INKC+(230,))
        aw_w = int(ld.textlength(aw, font=ef))
        ld.line([(MARGIN_X+25, base+LINE_STEP-14),
                 (MARGIN_X+30+aw_w+10, base+LINE_STEP-14)],
                fill=WARN+(230,), width=5)
        # why
        ld.text((MARGIN_X+30, base + 2*LINE_STEP - 40),
                reason, font=wf, fill=A+(255,))

    # scale + rotate
    if scale != 1.0:
        ns = max(1, int(W * scale))
        layer = layer.resize((ns, int(H * scale)), Image.BILINEAR)
        pad_w = (W - ns) // 2
        pad_h = (H - int(H * scale)) // 2
        padded = Image.new("RGBA", (W, H), (0,0,0,0))
        padded.alpha_composite(layer, (pad_w, pad_h))
        layer = padded
    if rot != 0.0:
        layer = layer.rotate(rot, resample=Image.BILINEAR)
    if alpha < 1.0:
        alpha_mask = Image.new("L", (W, H), int(255 * alpha))
        layer.putalpha(ImageChops.multiply(layer.split()[3], alpha_mask))
    img.alpha_composite(layer, (x_off, y_off))


def phase_speedramp(img, t):
    """
    10-17 s: pages flip past, accelerating, then slamming to a
    tally at the end — 'you've filled a notebook' moment.
    """
    u = t - B2
    d = ImageDraw.Draw(img, "RGBA")

    # Speed-ramp mapping u -> which page index is onscreen
    # Start slow: one page per 1.1 s, accelerate to ~16 pages/s by u~4.
    def pages_passed(x):
        if x <= 0: return 0.0
        # cubic ramp
        return 0.9 * x + 1.8 * x * x
    pp = pages_passed(u)
    idx_f = pp

    # When we want the final hold panel (counter), start at u >= 5.4
    hold = u >= 5.4

    if not hold:
        # Show 3 pages at once scrolling by. Each "page" occupies a wide slot.
        # Pages slide upward (as if flipped off the top).
        PAGE_SLOT = 1.0        # a slot of 1 index worth of travel
        base_idx = int(idx_f)
        frac = idx_f - base_idx
        # vertical travel per page
        SLIDE = H + 200
        for off in range(-1, 3):
            i = base_idx + off
            if i < 0: continue
            # position: current page sits at y0; prev has slid up; next
            # waits below.
            y_off = int((off - frac) * SLIDE * 0.55)
            # scale a little bigger for the one closest to center
            s = 1.0 - 0.06 * abs(off - frac)
            alpha = max(0.0, 1.0 - 0.6 * abs(off - frac))
            rot = (-2 if off % 2 == 0 else 2) * 0.6 * (1 - frac)
            _fast_page(img, i, alpha=alpha, y_off=y_off, scale=s,
                       rot=rot, with_header=True)

        # motion blur (speed ramp) grows with speed
        # This happens outside this function via whip_amount(t).

        # Running counter in top-right overlay — climbs from 01 to 47
        cnt = max(1, min(47, int(1 + 46 * (u / 5.4))))
        cf = font("InterDisplay-Black.otf", 54)
        label = f"entry {cnt:02d}"
        tw = d.textlength(label, font=cf)
        d.rounded_rectangle([W-80-tw-40, 220, W-80, 320],
                            radius=24, fill=(0,0,0,170))
        d.text((W-80-tw-20, 232), label, font=cf, fill=A+(255,))

    else:
        # HOLD panel: one page, with a big tally counter climbing/landing
        _fast_page(img, 7, alpha=1.0, with_header=True, scale=0.98)
        # darken slightly
        overlay = Image.new("RGBA", (W, H), (0,0,0,110))
        img.alpha_composite(overlay)
        d = ImageDraw.Draw(img, "RGBA")

        # Big tally card
        hu = u - 5.4
        cx0, cy0, cx1, cy1 = 150, 760, W-150, 1180
        card_a = ease(hu / 0.4)
        rrect(d, cx0, cy0, cx1, cy1, 40,
              fill=(16, 32, 22, int(240*card_a)),
              outline=A+(int(255*card_a),), width=4)
        if card_a > 0.05:
            lf = font("Inter-Medium.otf", 44)
            ctext(d, cy0+36, "ENTRIES THIS WEEK", lf, DIM, card_a)
            # counter number climbs
            nf = font("InterDisplay-Black.otf", 230)
            k = ease(min(1, hu / 0.9))
            n = int(round(47 * k))
            s = f"{n}"
            tw = d.textlength(s, font=nf)
            d.text(((W-tw)/2, cy0+100), s, font=nf, fill=INKC+(255,))
            # ticker line underneath
            sa = ease(max(0, (hu - 0.95) / 0.5))
            if sa > 0:
                sf = font("Inter-SemiBold.otf", 48)
                sub = "and I still miss the same ones"
                tw2 = d.textlength(sub, font=sf)
                d.text(((W-tw2)/2, cy1-110), sub, font=sf,
                       fill=A+(int(255*sa),))

    cap(d, "Same mistake twice means you never understood it.", P,
        y=1750, size=44,
        alpha=ease((u - 0.5) / 0.6))


# ---------------- phase 4: one page holds, pattern circles itself ----------------
def phase_pattern(img, t):
    """
    17-21 s: a single page holds. The 'setup' step on three entries
    is highlighted — a red loop ties them together.
    'The pattern: rushing the setup'
    """
    u = t - B3
    d = ImageDraw.Draw(img, "RGBA")

    pa = ease(u / 0.4)
    ruled_page(d, a=pa)
    hf = mono(36)
    d.text((PAGE_X0+60, PAGE_Y0+30),
           "~/notebook — mistakes.md",
           font=hf, fill=DIM+(int(230*pa),))
    d.text((PAGE_X1-230, PAGE_Y0+30),
           "p.08", font=hf, fill=DIM+(int(230*pa),))

    # Three entries, condensed, each with a "setup / solve" split.
    entries = [
        ("3(x-2) = 9",  "setup", "x-2 = 3",  "solve", "x = 5"),
        ("|x-1| = 4",   "setup", "x-1 = ±4", "solve", "x = 5 or -3"),
        ("x²-4=0", "setup", "(x-2)(x+2)=0", "solve", "x = ±2"),
    ]

    ef = font("Inter-Medium.otf", 44)
    tf = font("Inter-SemiBold.otf", 36)
    row_h = 340
    y0 = LINE_Y0 - 20
    setup_rects = []      # for the red loop
    for i, (eq, s_lab, s_val, v_lab, v_val) in enumerate(entries):
        y = y0 + i * row_h
        ra = ease(max(0, (u - 0.2 - 0.12*i) / 0.5))
        if ra <= 0.02: continue
        # equation
        d.text((MARGIN_X+30, y), eq, font=ef, fill=INKC+(int(255*ra),))
        # "setup:" label + value
        d.text((MARGIN_X+30, y + 90), f"{s_lab}:",
               font=tf, fill=DIM+(int(240*ra),))
        sv_x = MARGIN_X + 30 + int(d.textlength(f"{s_lab}:", font=tf)) + 24
        d.text((sv_x, y + 90), s_val, font=tf, fill=A+(int(255*ra),))
        sv_w = d.textlength(s_val, font=tf)
        # record setup rect for the loop
        setup_rects.append((sv_x-12, y+80, int(sv_x+sv_w+12), y+140))
        # "solve:" label + value
        d.text((MARGIN_X+30, y + 170), f"{v_lab}:",
               font=tf, fill=DIM+(int(240*ra),))
        vv_x = MARGIN_X + 30 + int(d.textlength(f"{v_lab}:", font=tf)) + 24
        d.text((vv_x, y + 170), v_val, font=tf, fill=INKC+(int(230*ra),))

    # --- hand-drawn red loops around EACH setup value, drawn in sequence ---
    # Each circle gets its own ~0.55 s window; dash connects them after.
    for ri, (rx0, ry0, rx1, ry1) in enumerate(setup_rects):
        start = 2.0 + ri * 0.35
        lp = ease(max(0, (u - start) / 0.55))
        if lp <= 0: continue
        cx = (rx0 + rx1) // 2
        cy = (ry0 + ry1) // 2
        rxh = (rx1 - rx0) // 2 + 28
        ryh = (ry1 - ry0) // 2 + 22
        steps = 72
        arc_end = int(steps * min(1.0, lp))
        for k in range(arc_end):
            a0 = 2 * math.pi * (k / steps) - math.pi / 2
            a1 = 2 * math.pi * ((k + 1) / steps) - math.pi / 2
            rngv = (math.sin(k * 1.73 + ri) + math.cos(k * 0.91 + ri)) * 2.0
            x0i = cx + math.cos(a0) * (rxh + rngv)
            y0i = cy + math.sin(a0) * (ryh + rngv)
            x1i = cx + math.cos(a1) * (rxh + rngv)
            y1i = cy + math.sin(a1) * (ryh + rngv)
            d.line([(x0i, y0i), (x1i, y1i)], fill=WARN + (235,), width=6)
    # Connector arrow from circle 1 to 2 to 3 once all three are drawn
    la_arrow = ease(max(0, (u - 3.3) / 0.6))
    if la_arrow > 0 and len(setup_rects) == 3:
        for i in range(2):
            x0 = (setup_rects[i][0] + setup_rects[i][2]) // 2
            y0 = setup_rects[i][3] + 28
            x1 = (setup_rects[i+1][0] + setup_rects[i+1][2]) // 2
            y1 = setup_rects[i+1][1] - 28
            dx = x1 - x0; dy = y1 - y0
            n = max(8, int(math.hypot(dx, dy) // 28))
            end = int(n * la_arrow)
            for k in range(end):
                px = x0 + dx * k / n
                py = y0 + dy * k / n
                d.ellipse([px-4, py-4, px+4, py+4], fill=WARN+(220,))

    # --- The pattern label as a red sticker across the bottom ---
    la = ease(max(0, (u - 2.8) / 0.6))
    if la > 0:
        sx0, sy0 = 40, 1680
        sx1, sy1 = W - 40, 1830
        layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        ld = ImageDraw.Draw(layer, "RGBA")
        ld.rounded_rectangle([sx0, sy0, sx1, sy1], radius=30,
                             fill=WARN + (int(245 * la),))
        img.alpha_composite(layer)
        d = ImageDraw.Draw(img, "RGBA")
        hdr = font("InterDisplay-Black.otf", 48)
        s = "The pattern: rushing the setup"
        tw = d.textlength(s, font=hdr)
        d.text(((W - tw) / 2, sy0 + 44), s, font=hdr,
               fill=(14, 22, 16, int(255 * la)))

    # The on-page sticker IS the text beat; no bottom caption here.


# ---------------- phase 5: page closes + endcard ----------------
def phase_close(img, t):
    """21-23 s: notebook page curls/closes, wordmark lands.
       No app name — script says 'Link in bio' only."""
    u = t - B4
    d = ImageDraw.Draw(img, "RGBA")

    # Page fold-down: draw page fading/shrinking upward
    pf = ease(min(1, u / 0.9))
    if pf < 1.0:
        # Page shrinks toward the top by scaling the page region vertically
        layer = Image.new("RGBA", (W, H), (0,0,0,0))
        ld = ImageDraw.Draw(layer, "RGBA")
        rrect(ld, PAGE_X0, PAGE_Y0, PAGE_X1, PAGE_Y1, 28,
              fill=PAGE_FILL+(230,))
        # ruled lines
        for i in range(11):
            y = LINE_Y0 + i*LINE_STEP
            if y > PAGE_Y1-30: break
            ld.line([(PAGE_X0+40, y), (PAGE_X1-40, y)],
                    fill=DIM+(110,), width=2)
        ld.line([(MARGIN_X, PAGE_Y0+40),(MARGIN_X, PAGE_Y1-40)],
                fill=WARN+(140,), width=3)
        # A big diagonal crease shows the page closing
        crease_y = int(PAGE_Y0 + (PAGE_Y1-PAGE_Y0) * (1 - pf))
        ld.rectangle([PAGE_X0, PAGE_Y0, PAGE_X1, crease_y],
                     fill=(14, 22, 16, 230))
        alpha_val = int(255 * (1 - pf))
        if alpha_val > 0:
            amask = Image.new("L", (W, H), alpha_val)
            layer.putalpha(ImageChops.multiply(layer.split()[3], amask))
        img.alpha_composite(layer)
        d = ImageDraw.Draw(img, "RGBA")

    # Endcard — wordmark + "Link in bio" (no app name per app:false)
    end_p = max(0.0, (u - 0.5) / 1.5)
    endcard_bio(img, end_p, P)


# ---------------- speed-ramp motion blur ----------------
def speed_amount(t):
    """
    Motion-blur envelope.
    - short ramps at each beat boundary (cut flash)
    - heavier blur across phase 3 (speed ramp) proportional to velocity
    """
    g = 0.0
    for b, dur in ((B1, 0.26), (B2, 0.30), (B3, 0.26), (B4, 0.22)):
        if b - 0.05 <= t < b + dur:
            k = (t - (b - 0.05)) / (dur + 0.05)
            if k < 0.3: g = max(g, 1.0 * (k / 0.3))
            else:       g = max(g, 1.0 * (1 - (k - 0.3) / 0.7))
    # continuous blur across phase 3
    if B2 <= t < B3:
        u = t - B2
        if u < 5.4:
            # velocity of the ramp (derivative of pages_passed)
            v = 0.9 + 3.6 * u
            g = max(g, min(0.85, v / 22.0))
    return g


def speed_apply(img, a, horizontal=False):
    """Direction-aware blur: vertical during page flips, horizontal on cuts."""
    if a <= 0.03:
        return img
    arr = np.array(img)
    sh = int(90 * a)
    if sh <= 0: return img
    acc = arr.astype(np.float32)
    n = 5
    axis = 1 if horizontal else 0
    for i in range(1, n + 1):
        rolled = np.roll(arr, i * (sh // n), axis=axis).astype(np.float32)
        acc += rolled
    return Image.fromarray((acc / (n + 1)).astype(np.uint8))


# ---------------- frame ----------------
def frame(t):
    img = gradbg(P, t)
    if   t < B1: phase_hook(img, t)
    elif t < B2: phase_why(img, t)
    elif t < B3: phase_speedramp(img, t)
    elif t < B4: phase_pattern(img, t)
    else:        phase_close(img, t)
    # speed-ramp blur: vertical during pages flipping, horizontal at cuts
    vertical_blur = (B2 <= t < B2 + 5.4)
    a = speed_amount(t)
    img = speed_apply(img, a, horizontal=not vertical_blur)
    # tiny glitch at beats
    gp = 0.0
    for b in (B1, B2, B3, B4):
        if b <= t < b + 0.18:
            gp = max(gp, 0.55 * (1 - (t-b)/0.18))
    img = glitch(img, gp)
    scanlines(ImageDraw.Draw(img, "RGBA"), alpha=22, step=4)
    return img


if __name__ == "__main__":
    if len(sys.argv) > 1:
        for t in map(float, sys.argv[1:]):
            frame(t).convert("RGB").save(f"./d3_{t}.jpg", quality=90)
        sys.exit()

    w = Writer("./d3_v.tmp.mp4")
    for i in range(int(T * FPS)):
        w.add(frame(i / FPS))
    assert w.close() == 0

    # ---------- sound design: music bed + SFX, headroom for VO ----------
    buf = np.zeros(int((T + 0.5) * SR))

    # Forest Terminal mood: warm pad + pencil-scratch textures.
    # Calm pad: a slow Dorian-ish chord bed in the mid-low register.
    chords = [
        (130.8, 164.8, 196.0),     # Cmaj-ish low
        (146.8, 174.6, 220.0),     # Dm
        (164.8, 196.0, 246.9),     # Em
        (146.8, 174.6, 220.0),     # Dm
    ]
    for i, (f1, f2, f3) in enumerate(chords * 2):
        at = i * 3.0
        for f in (f1, f2, f3):
            put(buf, tone(f, 3.1, a=1.0, r=2.1), at, 0.05)

    # Phase 1 — pencil scratch & a soft 'nope' thunk for the strike
    for i in range(10):
        put(buf, noise(0.08, 0.04), 0.15 + i * 0.09, 0.08)
    put(buf, noise(0.14, 0.05), 1.40, 0.22)       # the strike
    put(buf, tone(220.0, 0.22, r=0.14), 1.44, 0.12)

    # Phase 2 — a slower, more deliberate scratch as the reason writes in
    for i in range(16):
        at = B1 + 0.6 + i * 0.22
        put(buf, noise(0.07, 0.035), at, 0.065)
    # soft chime when the "right" chip lands
    put(buf, tone(659.3, 0.35, r=0.25), B1 + 4.0, 0.14)
    put(buf, tone(880.0, 0.25, r=0.2),  B1 + 4.3, 0.10)
    # thump on the tag landing
    put(buf, kick(), B1 + 5.3, 0.25)
    put(buf, whoosh(0.3), B1 + 5.25, 0.3)

    # Phase 3 — the ramp. Pages fly: paper flip textures (noise bursts)
    # accelerating alongside the visual ramp.
    # Match pages_passed() growth so audio matches the picture.
    flip_times = []
    passed = 0.0
    for k in range(600):
        # inverse of: pp = 0.9x + 1.8x^2  (solve for next integer page)
        target = passed + 1
        # quadratic solve
        x = (-0.9 + math.sqrt(0.9**2 + 4*1.8*target)) / (2*1.8)
        if x > 5.4: break
        flip_times.append(B2 + x)
        passed = target
    for ft in flip_times:
        put(buf, noise(0.055, 0.03), ft, 0.14)
    # swell to the counter land
    put(buf, whoosh(0.7), B2 + 5.1, 0.6)
    put(buf, kick(), B2 + 5.4, 0.7)
    # counter rising shimmer
    for i in range(14):
        put(buf, tone(700 + i * 38, 0.18, r=0.12), B2 + 5.5 + i * 0.05, 0.05)

    # Phase 4 — a slower scratch as the red loop draws, resolving chord
    for i in range(10):
        put(buf, noise(0.06, 0.035), B3 + 2.0 + i * 0.07, 0.06)
    put(buf, tone(329.6, 0.45, r=0.3), B3 + 2.9, 0.1)
    put(buf, tone(392.0, 0.45, r=0.3), B3 + 3.0, 0.1)

    # Phase 5 — page close + endcard pad
    put(buf, whoosh(0.55), B4 - 0.1, 0.55)
    put(buf, kick(), B4 + 0.3, 0.5)
    for f in (261.6, 329.6, 392.0, 523.3):
        put(buf, tone(f, 1.8, a=0.02, r=1.2), B4 + 0.4, 0.09)

    save(buf, "./d3.wav")
    os.rename("./d3_v.tmp.mp4", "./d3_v.mp4")
    outname = "./Day03_the-notebook-that-writes-itself.mp4"
    print(mux("./d3_v.mp4", "./d3.wav", outname))
