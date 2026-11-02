import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
from PIL import ImageChops

T   = 22.0
P   = pal("Soft Slate")
A   = P["accent"]; INKC = P["ink"]; DIM = P["dim"]; WARN = P["warn"]
BG  = P["bg"];     BG2  = P["bg2"]

# Beat boundaries from the script
B1, B2, B3, B4 = 2.0, 9.0, 17.0, 20.0

# Brighter than BG2 so incoming bubbles read clearly against the slate background.
BUB_IN  = (74, 82, 108)
# Card fill (slightly darker/warmer than BUB_IN so the card feels like its own surface).
CARD_FILL = (64, 72, 96)
# Font sizes tuned to 1080×1920
F_BUB   = 42
F_NAME  = 28
F_HDR   = 56
F_TIME  = 40
F_NUM   = 76
F_LIST  = 70
F_CARD  = 76
F_SUB   = 60
F_TITLE = 86


# ---------- small helpers ----------
def rrect(d, x0, y0, x1, y1, r, fill=None, outline=None, width=0):
    d.rounded_rectangle([x0, y0, x1, y1], radius=r, fill=fill,
                        outline=outline, width=width)

def bubble(d, text, side, y_top, highlight=False, alpha=1.0, pop=1.0, name=None):
    """
    One chat bubble (iMessage-ish).
    side='r' -> outgoing (right, accent), 'l' -> incoming (left, slate).
    Returns the bottom y of the drawn bubble.
    """
    if alpha <= 0 or pop <= 0: return y_top
    f  = font("Inter-SemiBold.otf", F_BUB)
    pad_x, pad_y = 36, 22
    # Wrap long text to a max bubble width so we never bleed off-screen
    max_text_w = 760
    lines = wrap(d, text, f, max_text_w)
    line_h = F_BUB + 10
    tw = max(d.textlength(ln, font=f) for ln in lines)
    bw = int(tw + pad_x * 2)
    bh = int(len(lines) * line_h + pad_y * 2 - 10)
    name_h = (F_NAME + 10) if (name and side == 'l') else 0

    # Fixed inset from screen edge
    if side == 'r':
        x1 = W - 70; x0 = x1 - bw
        fill = A + (int(255 * alpha),)
        tcol = (14, 18, 32, int(255 * alpha))
    else:
        x0 = 70; x1 = x0 + bw
        fill = BUB_IN + (int(255 * alpha),)
        tcol = INKC + (int(255 * alpha),)

    # Pop anchor: outgoing scales from right edge, incoming from left edge
    anchor_x = x1 if side == 'r' else x0
    cy = y_top + name_h + bh // 2
    sw = int(bw * pop); sh = int((bh) * pop)
    if side == 'r':
        nx0 = anchor_x - sw; nx1 = anchor_x
    else:
        nx0 = anchor_x;      nx1 = anchor_x + sw
    body_top = cy - sh // 2
    body_bot = cy + sh // 2

    # Name tag above incoming
    if name and side == 'l' and pop > 0.9:
        nf = font("Inter-Medium.otf", F_NAME)
        d.text((x0 + 20, y_top), name, font=nf, fill=DIM + (int(255 * alpha),))

    # Bubble body
    rrect(d, nx0, body_top, nx1, body_bot, 32, fill)

    # Soft outline when highlighted
    if highlight and pop > 0.9:
        d.rounded_rectangle([nx0 - 3, body_top - 3, nx1 + 3, body_bot + 3],
                            radius=35, outline=A + (int(150 * alpha),), width=3)

    # Text once settled enough
    if pop > 0.85 and alpha > 0.2:
        for i, ln in enumerate(lines):
            d.text((x0 + pad_x, body_top + pad_y + i * line_h), ln,
                   font=f, fill=tcol)
    return y_top + name_h + bh

def whipstreak(img, cx, cy, w, h, col, a):
    """Horizontal motion streak — stand-in for a whip pan into a bubble."""
    if a <= 0.03: return
    gl = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(gl, "RGBA")
    gd.rounded_rectangle([cx - w // 2, cy - h // 2, cx + w // 2, cy + h // 2],
                         radius=h // 2, fill=col + (int(200 * a),))
    gl = gl.filter(ImageFilter.GaussianBlur(26))
    img.alpha_composite(gl)

def status_bar(d, label, a=1.0):
    if a <= 0: return
    f = font("Inter-SemiBold.otf", F_TIME)
    tw = d.textlength(label, font=f)
    d.text(((W - tw) / 2, 92), label, font=f, fill=DIM + (int(255 * a),))
    d.rectangle([120, 170, W - 120, 172], fill=DIM + (int(80 * a),))

def chat_header(d, a=1.0):
    if a <= 0: return
    f = font("InterDisplay-Bold.otf", F_HDR)
    s = "late study crew"
    tw = d.textlength(s, font=f)
    d.text(((W - tw) / 2, 200), s, font=f, fill=INKC + (int(255 * a),))
    # three stacked dots (member stand-ins) under the title
    for i, col in enumerate((A, WARN, DIM)):
        cx = (W - 44 * 3) // 2 + i * 44 + 22
        d.ellipse([cx - 14, 280, cx + 14, 308], fill=col + (int(220 * a),))

# ---------- phases ----------
def phase_hook(img, t):
    """0-2 s: chat UI, 11:04 timestamp, outgoing bubble lands."""
    d = ImageDraw.Draw(img, "RGBA")
    header_a = ease(t / 0.4)
    status_bar(d, "11:04 PM", header_a)
    chat_header(d, header_a)
    pop = back(min(1.0, (t - 0.4) / 0.7)) if t > 0.4 else 0
    if pop > 0:
        streak_a = max(0.0, 1.1 - (t - 0.4) / 0.4)
        whipstreak(img, W - 400, 820, 1200, 130, A, streak_a)
        d = ImageDraw.Draw(img, "RGBA")
        bubble(d, "studied 3 hrs. remember nothing", 'r', 780,
               highlight=True, pop=pop)
    cap(d, "it's 11:04 and the chat is spiralling", P,
        y=1620, size=44, alpha=ease((t - 0.9) / 0.5))

# Reply schedule for 2-9 s. (relative seconds inside phase_replies)
REPLIES = [
    (0.0, 'l', "same",                        "miro"),
    (1.3, 'l', "what do i even study",        "nilu"),
    (2.9, 'l', "like... which topics even",   "tim"),
    (4.3, 'r', "that's the whole problem",    None),
    (5.9, 'l', "we are so cooked",            "nilu"),
]

def _reply_block_h(d, side, text, name):
    """How much vertical space a given bubble consumes (name + body + gap)."""
    f  = font("Inter-SemiBold.otf", F_BUB)
    pad_x, pad_y = 36, 22
    max_text_w = 760
    lines = wrap(d, text, f, max_text_w)
    line_h = F_BUB + 10
    bh = int(len(lines) * line_h + pad_y * 2 - 10)
    name_h = (F_NAME + 10) if (name and side == 'l') else 0
    return name_h + bh + 24  # 24 px gap between bubbles

def phase_replies(img, t):
    """2-9 s: reply bubbles land one by one, each whipping in."""
    u = t - B1
    d = ImageDraw.Draw(img, "RGBA")
    status_bar(d, "11:04 PM", 1.0)
    chat_header(d, 1.0)

    # Full timeline of bubbles (first one is the original 'me' msg).
    seq = [('r', "studied 3 hrs. remember nothing", None)] + \
          [(s, txt, nm) for (_, s, txt, nm) in REPLIES]

    # Measure each block's height.
    heights = [_reply_block_h(d, s, txt, nm) for (s, txt, nm) in seq]

    # How many have landed (based on their trigger times)?
    land_times = [0.0] + [rt for (rt, _, _, _) in REPLIES]
    landed = [u >= rt for rt in land_times]
    # Scroll: pin latest landed block near y_bottom.
    y_bottom = 1500
    base_top = 740
    total_landed_h = sum(h for h, L in zip(heights, landed) if L)
    # If content fits comfortably, start near the top.
    if total_landed_h < (y_bottom - base_top):
        y_cur = base_top
    else:
        y_cur = y_bottom - total_landed_h

    for i, ((side, txt, nm), h) in enumerate(zip(seq, heights)):
        rt = land_times[i]
        prog = max(0.0, min(1.0, (u - rt) / 0.42))
        if prog <= 0: continue
        pop = back(prog)
        # Streak during landing
        if prog < 1.0:
            sx = (W - 300) if side == 'r' else 300
            streak_col = A if side == 'r' else INKC
            # Streak y aligned with where the bubble bottom will sit
            whipstreak(img, sx, y_cur + h // 2, 1300, 110,
                       streak_col, (1.0 - prog) * 0.9)
            d = ImageDraw.Draw(img, "RGBA")
        hl = (i > 0) and (prog > 0.3) and (prog < 1.4) and (i == max(j for j in range(len(seq)) if landed[j]))
        bubble(d, txt, side, y_cur, highlight=hl, pop=pop, name=nm)
        y_cur += h

    cap(d, "same · what do i even study", P,
        y=1620, size=44, alpha=ease((u - 0.3) / 0.4))

def phase_system(img, t):
    """
    9-17 s: chat dissolves, three lines type themselves out.
    1. One topic   2. 20 questions   3. Write every mistake
    """
    u = t - B2
    d = ImageDraw.Draw(img, "RGBA")

    # Chat ghosts out fast
    chat_a = max(0.0, 1.0 - u / 0.7)
    if chat_a > 0.02:
        status_bar(d, "11:04 PM", chat_a * 0.8)
        chat_header(d, chat_a * 0.8)
        bubble(d, "we are so cooked", 'l', 980, alpha=chat_a, pop=1.0, name="nilu")
        bubble(d, "that's the whole problem", 'r', 1180, alpha=chat_a, pop=1.0)

    # Title: "the whole plan"
    ta = ease((u - 0.5) / 0.6)
    if ta > 0:
        tf = font("InterDisplay-Black.otf", F_TITLE)
        ctext(d, 330, "the whole plan", tf, INKC, ta)
        tw = d.textlength("the whole plan", font=tf)
        ux = int((W - tw) / 2)
        uw = int(tw * ease((u - 0.8) / 0.5))
        d.rectangle([ux, 428, ux + uw, 438], fill=A + (255,))

    # Three lines type out
    lines = ["One topic.", "20 questions.", "Write every mistake."]
    nums  = ["1", "2", "3"]
    START = 1.3
    PER   = 1.9    # per-line pace
    y0 = 640
    gap = 230
    tf = font("InterDisplay-Bold.otf", F_LIST)
    nf = font("InterDisplay-Black.otf", F_NUM)

    for i, (num, txt) in enumerate(zip(nums, lines)):
        s0 = START + i * PER
        prog = max(0.0, (u - s0) / 1.0)
        if prog <= 0: continue
        y = y0 + i * gap
        a = min(1.0, prog * 2.0)

        # number chip — always accent
        chip_x0, chip_y0 = 110, y - 8
        chip_x1, chip_y1 = 240, y + 118
        rrect(d, chip_x0, chip_y0, chip_x1, chip_y1, 28,
              fill=A + (int(230 * a),))
        nw = d.textlength(num, font=nf)
        d.text(((chip_x0 + chip_x1) / 2 - nw / 2,
                (chip_y0 + chip_y1) / 2 - F_NUM / 2 - 8),
               num, font=nf, fill=(14, 18, 32, int(255 * a)))

        # typed text (reveal char by char)
        total = len(txt)
        shown = min(total, int(prog * total * 1.15))
        shown_s = txt[:shown]
        d.text((290, y + 20), shown_s, font=tf, fill=INKC + (255,))
        if shown < total and int(u * 2.5) % 2 == 0:
            cw = d.textlength(shown_s, font=tf)
            d.rectangle([294 + cw, y + 32, 302 + cw, y + 108], fill=INKC + (255,))

    cap(d, "one topic · twenty questions · log every mistake", P,
        y=1620, size=42, alpha=ease((u - 0.4) / 0.6))

def phase_card(img, t):
    """17-20 s: three lines compress into a single card."""
    u = t - B3
    d = ImageDraw.Draw(img, "RGBA")

    # Compression progress
    c = ease(min(1.0, u / 0.85))

    # Card target rectangle
    card_x0, card_y0, card_x1, card_y1 = 90, 640, W - 90, 1240
    center_y = (card_y0 + card_y1) // 2

    # Fading individual lines as they collapse inward
    lines = [("1", "One topic.",           A,    640),
             ("2", "20 questions.",        INKC, 870),
             ("3", "Write every mistake.", WARN, 1100)]
    tf = font("InterDisplay-Bold.otf", F_LIST)
    nf = font("InterDisplay-Black.otf", F_NUM)
    la = 1.0 - c
    for i, (num, txt, col, start_y) in enumerate(lines):
        if la <= 0.05: break
        yl = int(start_y + (center_y - 60 - start_y) * c)
        d.text((290, yl + 20), txt, font=tf, fill=INKC + (int(255 * la),))
        # chip
        rrect(d, 110, yl - 8, 240, yl + 118, 28,
              fill=A + (int(220 * la),))
        nw = d.textlength(num, font=nf)
        d.text((175 - nw / 2, yl + 28), num, font=nf,
               fill=(14, 18, 32, int(255 * la)))

    # The card itself grows in — filled with real contrast against the slate background.
    card_a = ease(max(0.0, (u - 0.4) / 0.6))
    if card_a > 0.02:
        # Compose onto a layer so we can fade in while keeping opaque fill.
        layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        ld = ImageDraw.Draw(layer, "RGBA")
        ld.rounded_rectangle([card_x0, card_y0, card_x1, card_y1],
                             radius=44, fill=CARD_FILL + (255,))
        ld.rounded_rectangle([card_x0, card_y0, card_x1, card_y1],
                             radius=44, outline=A + (255,), width=4)
        # Top edge highlight for a touch of dimension
        ld.line([(card_x0 + 44, card_y0 + 2), (card_x1 - 44, card_y0 + 2)],
                fill=(255, 255, 255, 36), width=2)
        if card_a < 1.0:
            alpha_mask = Image.new("L", (W, H), int(255 * card_a))
            layer.putalpha(ImageChops.multiply(layer.split()[3], alpha_mask))
        img.alpha_composite(layer)
        d = ImageDraw.Draw(img, "RGBA")

    # Headline inside the card
    hla = ease(max(0.0, (u - 0.9) / 0.6))
    if hla > 0:
        sf = font("Inter-Medium.otf", 44)
        ctext(d, 720, "the whole system", sf, DIM, hla)

        cf = font("InterDisplay-Black.otf", F_CARD)
        ctext(d, 800, "ONE · TWENTY · WRITE", cf, INKC, hla)

        sub_a = ease(max(0.0, (u - 1.3) / 0.6))
        if sub_a > 0:
            ctext(d, 950, "there isn't more.",
                  font("InterDisplay-Bold.otf", F_SUB), A, sub_a)

        # three check pips at the bottom of the card
        for i, label in enumerate(("topic", "20 Qs", "log")):
            ca = ease(max(0.0, (u - 1.6 - i * 0.18) / 0.5))
            if ca <= 0: continue
            cx = card_x0 + 220 + i * 230
            d.ellipse([cx - 26, 1090, cx + 26, 1142],
                      fill=A + (int(220 * ca),))
            cf = font("InterDisplay-Black.otf", 36)
            d.text((cx - 11, 1100), "✓", font=cf,
                   fill=(14, 18, 32, int(255 * ca)))
            lf = font("Inter-SemiBold.otf", 34)
            lw = d.textlength(label, font=lf)
            d.text((cx - lw / 2, 1156), label, font=lf,
                   fill=DIM + (int(255 * ca),))

    # Burned-in VO caption
    cap(d, "That's the whole system. There isn't more.", P,
        y=1620, size=48, alpha=ease((u - 0.4) / 0.5))

def phase_loop(img, t):
    """20-22 s: loop back to the 11:04 bubble. 'Link in bio'."""
    u = t - B4
    d = ImageDraw.Draw(img, "RGBA")

    header_a = ease(u / 0.4)
    status_bar(d, "11:04 PM", header_a)
    chat_header(d, header_a)

    pop = back(min(1.0, u / 0.55))
    if pop > 0:
        whipstreak(img, W - 400, 820, 1200, 130, A,
                   max(0, 1.0 - u / 0.4))
        d = ImageDraw.Draw(img, "RGBA")
        bubble(d, "studied 3 hrs. remember nothing", 'r', 780,
               highlight=True, pop=pop)

    ea = ease(max(0.0, (u - 0.45) / 1.0))
    if ea > 0:
        s = int(220 * back(ea))
        if s > 10:
            lg = LOGO.resize((s, s))
            img.alpha_composite(lg, ((W - s) // 2, 1140 - s // 2))
        ctext(d, 1270, "SAT STUDIO",
              font("InterDisplay-Black.otf", 78), INKC, ea)
        b = ease(max(0.0, (u - 1.0) / 0.6))
        if b > 0:
            bw_, bh_ = 440, 96
            bx, by = (W - bw_) // 2, 1380
            rrect(d, bx, by, bx + bw_, by + bh_, 48,
                  fill=A + (int(255 * b),))
            f = font("InterDisplay-Black.otf", 54)
            txt = "Link in bio"
            tw = d.textlength(txt, font=f)
            d.text(((W - tw) / 2, by + 22), txt,
                   font=f, fill=(14, 18, 32, int(255 * b)))

# ---------- whip-pan transition ----------
def whip_amount(t):
    """At each beat boundary, briefly motion-blur the whole frame."""
    g = 0.0
    for b, dur in ((B1, 0.26), (B2, 0.30), (B3, 0.26), (B4, 0.22)):
        if b - 0.08 <= t < b + dur:
            k = (t - (b - 0.08)) / (dur + 0.08)
            if k < 0.3:
                g = max(g, 1.0 * (k / 0.3))
            else:
                g = max(g, 1.0 * (1 - (k - 0.3) / 0.7))
    return g

def whip_apply(img, a):
    if a <= 0.03:
        return img
    arr = np.array(img)
    sh = int(60 * a)
    if sh > 0:
        acc = arr.astype(np.float32)
        n = 5
        for i in range(1, n + 1):
            rolled = np.roll(arr, i * (sh // n), axis=1).astype(np.float32)
            acc += rolled
        arr = (acc / (n + 1)).astype(np.uint8)
    return Image.fromarray(arr)

def frame(t):
    img = gradbg(P, t)
    if   t < B1: phase_hook(img, t)
    elif t < B2: phase_replies(img, t)
    elif t < B3: phase_system(img, t)
    elif t < B4: phase_card(img, t)
    else:        phase_loop(img, t)
    img = whip_apply(img, whip_amount(t))
    scanlines(ImageDraw.Draw(img, "RGBA"), alpha=14, step=4)
    return img

if __name__ == "__main__":
    if len(sys.argv) > 1:
        for t in map(float, sys.argv[1:]):
            frame(t).convert("RGB").save(f"./d2_{t}.jpg", quality=90)
        sys.exit()
    w = Writer("./d2_v.tmp.mp4")
    for i in range(int(T * FPS)):
        w.add(frame(i / FPS))
    assert w.close() == 0

    # ---------- sound design: music bed + SFX, room for VO ----------
    buf = np.zeros(int((T + 0.5) * SR))

    # Soft lo-fi pad bed (Soft Slate: cool, muted, late-night)
    chords = [
        (164.8, 196.0, 246.9),      # Am-ish
        (146.8, 174.6, 220.0),      # Dm
        (174.6, 220.0, 261.6),      # F
        (164.8, 196.0, 246.9),      # Am
    ]
    for i, (f1, f2, f3) in enumerate(chords * 2):
        at = i * 2.75
        for f in (f1, f2, f3):
            put(buf, tone(f, 2.9, a=0.8, r=2.0), at, 0.045)

    # Phase 1 — bubble pop + keyboard ticks
    put(buf, tone(1200, 0.07, r=0.05), 0.55, 0.18)
    put(buf, kick(), 0.56, 0.22)
    for i in range(6):
        put(buf, tone(2200 + 40 * i, 0.025, r=0.015),
            0.9 + 0.07 * i, 0.08)

    # Phase 2 — whip + bubble pop per reply landing
    reply_times = [B1 + 0.0, B1 + 1.3, B1 + 2.9, B1 + 4.3, B1 + 5.9]
    for at in reply_times:
        put(buf, whoosh(0.22), at - 0.08, 0.35)
        put(buf, tone(900 + np.random.randint(-80, 80), 0.08, r=0.06),
            at, 0.22)
        put(buf, kick(), at + 0.01, 0.18)

    # Phase 3 — typing ticks + chime per line
    for i in range(3):
        base = B2 + 1.3 + i * 1.9
        for j in range(12):
            put(buf, tone(1600 + 30 * (j % 5), 0.03, r=0.02),
                base + j * 0.07, 0.08)
        put(buf, tone(523.3 + i * 60, 0.5, r=0.3), base + 0.95, 0.14)

    # Phase 4 — compression swell into the card
    put(buf, whoosh(0.65), B3 - 0.1, 0.65)
    put(buf, kick(), B3 + 0.4, 0.75)
    for f in (196.0, 246.9, 329.6, 392.0):
        put(buf, tone(f, 2.2, a=0.02, r=1.4), B3 + 0.5, 0.11)
    for i in range(3):
        put(buf, tone(1046.5 + i * 150, 0.3, r=0.2),
            B3 + 1.7 + i * 0.2, 0.08)

    # Phase 5 — loop pop + endcard swell
    put(buf, whoosh(0.3), B4 - 0.05, 0.4)
    put(buf, tone(1200, 0.08, r=0.05), B4 + 0.1, 0.2)
    put(buf, kick(), B4 + 0.1, 0.3)
    for f in (261.6, 329.6, 392.0, 523.3):
        put(buf, tone(f, 1.8, r=1.1), B4 + 0.6, 0.1)

    save(buf, "./d2.wav")
    os.rename("./d2_v.tmp.mp4", "./d2_v.mp4")
    outname = "./Day02_the-11pm-group-chat.mp4"
    print(mux("./d2_v.mp4", "./d2.wav", outname))
