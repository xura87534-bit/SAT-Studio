import sys, os, math; sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from common import *

T   = 24.0
P   = pal("Midnight Teal")
A   = P["accent"]; INKC = P["ink"]; DIM = P["dim"]; WARN = P["warn"]

# Beat boundaries from the script
B1, B2, B3, B4 = 2.0, 10.0, 18.0, 22.0

# ---------- geometry of the splitting path ----------
STEM_X, STEM_Y0, STEM_Y1 = W//2, 1430, 1000      # stem rises bottom -> fork
FORK                      = (STEM_X, STEM_Y1)
EASY_END                  = (250, 520)
HARD_END                  = (830, 430)

def bez(p0, p1, p2, t):
    x = (1-t)**2*p0[0] + 2*(1-t)*t*p1[0] + t**2*p2[0]
    y = (1-t)**2*p0[1] + 2*(1-t)*t*p1[1] + t**2*p2[1]
    return (x, y)

def branch_pts(end, prog, n=46):
    ctrl = (FORK[0] + (end[0]-FORK[0])*0.15, FORK[1] - 230)
    return [bez(FORK, ctrl, end, i/n*prog) for i in range(n+1)] if prog > 0 else []

def polyline(d, pts, col, w, a=1.0):
    if len(pts) < 2 or a <= 0: return
    d.line([(int(x),int(y)) for x,y in pts], fill=col+(int(255*a),), width=w, joint="curve")

def node(d, p, col, r, a=1.0, ring=False):
    x,y = int(p[0]), int(p[1])
    if ring:
        d.ellipse([x-r-14,y-r-14,x+r+14,y+r+14], outline=col+(int(150*a),), width=5)
    d.ellipse([x-r,y-r,x+r,y+r], fill=col+(int(255*a),))

# ---------- phases ----------
def phase_hook(img, t):
    """0-2s: ADAPTIVE assembles from glitching fragments."""
    d = ImageDraw.Draw(img,"RGBA")
    word = "ADAPTIVE"
    f = font("InterDisplay-Black.otf", 150)
    widths = [d.textlength(c, font=f) for c in word]
    total  = sum(widths)
    x0 = (W-total)/2
    rng = np.random.RandomState(7)
    for i,c in enumerate(word):
        settle = ease((t - 0.08*i) / 0.75)                 # each letter settles in turn
        jx = (1-settle) * rng.uniform(-420, 420)
        jy = (1-settle) * rng.uniform(-260, 260)
        # pre-settle ghosts in accent/warn, converging
        if settle < 0.98:
            for gi,(gc,gm) in enumerate(((A,-1),(WARN,1))):
                d.text((x0+sum(widths[:i])+jx+gm*18*(1-settle), 860+jy),
                       c, font=f, fill=gc+(int(150*(1-settle)),))
        d.text((x0+sum(widths[:i])+jx, 860+jy), c, font=f,
               fill=INKC+(int(255*min(1,settle+0.25)),))
    # underline sweeps in as the word locks
    u = ease((t-0.85)/0.5)
    if u > 0:
        uw = int(total*u); ux = int((W-total)/2)
        d.rectangle([ux, 1045, ux+uw, 1057], fill=A+(255,))
    cap(d, "The SAT changes halfway through.", P, y=1600,
        alpha=ease((t-0.5)/0.5))

def phase_split(img, t):
    """2-10s: one path splits into two routes, labels slide in."""
    u = t - B1
    d = ImageDraw.Draw(img,"RGBA")
    # stem draws up
    sp = ease(u/1.1)
    stem = [(STEM_X, STEM_Y0 + (STEM_Y1-STEM_Y0)*i/24*sp) for i in range(25)]
    polyline(d, stem, DIM, 14)
    node(d, (STEM_X, STEM_Y0), A, 16)
    d.text((STEM_X-170, STEM_Y0+46), "MODULE 1", font=font("Inter-Bold.otf",42),
           fill=DIM+(int(255*ease(u/0.6)),))
    if sp < 0.99: return
    # branches grow
    bp = ease((u-1.1)/1.5)
    node(d, FORK, A, 20, ring=True)
    def draw_branches(dd):
        polyline(dd, branch_pts(EASY_END, bp), DIM, 12)
        polyline(dd, branch_pts(HARD_END, bp), A,   14)
    softglow(img, draw_branches, blur=22)
    d = ImageDraw.Draw(img,"RGBA")
    # labels slide in at the ends
    la = ease((u-2.4)/0.6)
    if la > 0:
        for end, label, col, dx in ((EASY_END,"EASIER",DIM,-1), (HARD_END,"HARDER",A,1)):
            off = (1-la)*90*dx
            fx = font("InterDisplay-Black.otf",62)
            tw = d.textlength(label, font=fx)
            lx = end[0]-tw/2+off
            d.rounded_rectangle([lx-26, end[1]-130, lx+tw+26, end[1]-44],
                                radius=24, fill=(0,0,0,int(140*la)))
            d.text((lx, end[1]-120), label, font=fx, fill=col+(int(255*la),))
            node(d, end, col, 16, la)
    # the headline text
    ha = ease((u-3.4)/0.6)
    if ha > 0:
        ctext(d, 150, "Module 1 decides Module 2",
              font("InterDisplay-Black.otf",74), INKC, ha)
    # a marker travels the stem then up the hard branch, looping
    if u > 4.2:
        k = ((u-4.2) % 2.6)/2.6
        if k < 0.38:
            p = (STEM_X, STEM_Y0 + (STEM_Y1-STEM_Y0)*(k/0.38))
        else:
            p = branch_pts(HARD_END, 1.0)[int(((k-0.38)/0.62)*46)]
        node(d, p, P["ink"], 13)

def phase_ceiling(img, t):
    """10-18s: the hard route lights up, a score range climbs beside it."""
    u = t - B2
    d = ImageDraw.Draw(img,"RGBA")
    pulse = 0.55 + 0.45*math.sin(u*3.2)
    # the stem is behind us now — it retracts, and the easy route dims out
    sfade = 1 - ease(u/0.8)
    if sfade > 0.02:
        polyline(d, [(STEM_X, STEM_Y0 + (STEM_Y1-STEM_Y0)*i/24) for i in range(25)],
                 DIM, 14, sfade*0.8)
    efade = (1 - ease(u/0.9)) * 0.55 + 0.12
    polyline(d, branch_pts(EASY_END, 1.0), DIM, 12, efade)
    node(d, EASY_END, DIM, 13, efade)
    # hard route blazes
    def draw_hard(dd):
        polyline(dd, branch_pts(HARD_END, 1.0), A, 16, 0.5+0.5*pulse)
    softglow(img, draw_hard, blur=30, passes=2)
    d = ImageDraw.Draw(img,"RGBA")
    node(d, FORK, A, 20, 1.0, ring=True)
    node(d, HARD_END, A, 20, 1.0, ring=True)
    d.text((HARD_END[0]-96, HARD_END[1]-120), "HARDER",
           font=font("InterDisplay-Black.otf",56), fill=A+(255,))
    # climbing score range, parked low where the stem used to be
    k  = ease(min(1, u/4.2))
    lo = int(round((1200 + (1340-1200)*k)/10)*10)
    hi = int(round((1340 + (1600-1340)*k)/10)*10)
    bx, by, bw, bh = 110, 1120, W-220, 230
    d.rounded_rectangle([bx,by,bx+bw,by+bh], radius=34, fill=(0,0,0,185))
    d.text((bx+44, by+28), "SCORE CEILING", font=font("Inter-Bold.otf",36), fill=DIM+(255,))
    ftxt = font("InterDisplay-Black.otf",88)
    d.text((bx+44, by+76), f"{lo}", font=ftxt, fill=INKC+(255,))
    aw = d.textlength(f"{lo}", font=ftxt)
    d.text((bx+66+aw, by+86), "→", font=font("InterDisplay-Bold.otf",66), fill=DIM+(255,))
    d.text((bx+164+aw, by+76), f"{hi}" + ("+" if k > 0.98 else ""), font=ftxt, fill=A+(255,))
    # rising bar inside the panel
    tw_, th_ = bw-88, 20
    d.rounded_rectangle([bx+44, by+bh-52, bx+44+tw_, by+bh-52+th_], radius=10,
                        fill=(255,255,255,30))
    d.rounded_rectangle([bx+44, by+bh-52, bx+44+int(tw_*k), by+bh-52+th_], radius=10,
                        fill=A+(255,))
    cap(d, "Harder second module means a higher ceiling.", P,
        y=1600, alpha=ease((u-0.6)/0.6))

def phase_collapse(img, t):
    """18-22s: routes collapse into the wordmark."""
    u = t - B3
    d = ImageDraw.Draw(img,"RGBA")
    c = ease(u/1.1)                                  # collapse amount
    # branches retract toward the fork, then the fork rises to center
    if c < 1:
        polyline(d, branch_pts(HARD_END, 1-c), A, 16, 1-c*0.4)
        polyline(d, branch_pts(EASY_END, 1-c), DIM, 12, (1-c)*0.5)
        stem_top = STEM_Y1 + (STEM_Y0-STEM_Y1)*c
        polyline(d, [(STEM_X, STEM_Y0 + (stem_top-STEM_Y0)*i/16) for i in range(17)],
                 DIM, 14, 1-c)
        node(d, FORK, A, int(20*(1-c)+6), 1-c)
    # wordmark forms out of the collapse point
    w = ease((u-0.75)/0.9)
    if w > 0:
        s = int(240*back((u-0.75)/0.9))
        if s > 10:
            lg = LOGO.resize((s,s)); img.alpha_composite(lg, ((W-s)//2, 700-s//2))
        ctext(d, 880, "SAT STUDIO", font("InterDisplay-Black.otf",96), INKC, w)
        ctext(d, 1010, "builds Module 2 the same way",
              font("Inter-SemiBold.otf",52), A, ease((u-1.3)/0.6))
    cap(d, "SAT Studio builds that second module the same way.", P,
        y=1600, alpha=ease((u-0.5)/0.6))

def phase_hold(img, t):
    """22-24s: wordmark holds, link in bio."""
    u = t - B4
    d = ImageDraw.Draw(img,"RGBA")
    s = 240
    lg = LOGO.resize((s,s)); img.alpha_composite(lg, ((W-s)//2, 700-s//2))
    ctext(d, 880, "SAT STUDIO", font("InterDisplay-Black.otf",96), INKC)
    b = ease(u/0.5)
    bw_, bh_ = 520, 118
    bx, by = (W-bw_)//2, 1060
    d.rounded_rectangle([bx,by,bx+bw_,by+bh_], radius=59, fill=A+(int(255*b),))
    f = font("InterDisplay-Black.otf",62); txt="Link in bio"
    tw = d.textlength(txt, font=f)
    d.text(((W-tw)/2, by+26), txt, font=f, fill=(6,18,24,int(255*b)))

def frame(t):
    img = gradbg(P, t)
    if   t < B1: phase_hook(img, t)
    elif t < B2: phase_split(img, t)
    elif t < B3: phase_ceiling(img, t)
    elif t < B4: phase_collapse(img, t)
    else:        phase_hold(img, t)
    # glitch bursts: opening, and a hard cut on every beat boundary
    g = 0.0
    if t < 0.85: g = max(g, 0.85*(1 - t/0.85))
    for b in (B1, B2, B3, B4):
        if b <= t < b+0.28: g = max(g, 0.9*(1 - (t-b)/0.28))
    img = glitch(img, g)
    scanlines(ImageDraw.Draw(img,"RGBA"), alpha=20, step=4)
    return img

if __name__ == "__main__":
    if len(sys.argv) > 1:
        for t in map(float, sys.argv[1:]):
            frame(t).convert("RGB").save(f"./a_{t}.jpg", quality=90)
        sys.exit()
    w = Writer("./d1a_v.tmp.mp4")
    for i in range(int(T*FPS)): w.add(frame(i/FPS))
    assert w.close() == 0
    # ---- sound design: room for the Finn VO on top ----
    buf = np.zeros(int((T+0.5)*SR))
    # hook: digital assemble clicks + sub boom
    put(buf, kick(), 0.0, 1.0); put(buf, noise(0.45,0.16), 0.0, 0.30)
    for i in range(8): put(buf, tone(1500+90*i, 0.035, r=0.02), 0.06*i, 0.16)
    put(buf, whoosh(0.5), 1.72, 0.55)
    # pad bed under the whole piece (teal = airy, cool)
    for i,(f1,f2,f3) in enumerate([(130.8,196,261.6),(146.8,220,293.7),
                                   (164.8,246.9,329.6),(146.8,220,293.7)]*2):
        at = i*3.0
        for f in (f1,f2,f3): put(buf, tone(f, 3.2, a=1.0, r=2.0), at, 0.055)
    # split section: two soft pings as the branches land
    put(buf, tone(523.3,0.5,r=0.3), B1+1.3, 0.16)
    put(buf, tone(659.3,0.6,r=0.35), B1+1.6, 0.18)
    for i in range(6): put(buf, kick(), B1+2.6+i*1.2, 0.30)
    # ceiling: rising shimmer as the number climbs
    for i in range(26):
        put(buf, tone(700+i*52, 0.22, r=0.14), B2+0.5+i*0.16, 0.055)
    put(buf, kick(), B2, 0.8); put(buf, noise(0.3,0.12), B2, 0.18)
    # collapse: reverse-swell into the wordmark
    put(buf, whoosh(0.7), B3-0.2, 0.7)
    put(buf, kick(), B3+0.9, 0.9)
    for f in (196, 261.6, 329.6, 392): put(buf, tone(f, 2.6, a=0.02, r=1.5), B3+0.9, 0.13)
    # hold: clean chord
    for f in (261.6, 329.6, 392, 523.3): put(buf, tone(f, 2.0, r=1.2), B4, 0.12)
    save(buf, "./d1a.wav")
    os.rename("./d1a_v.tmp.mp4","./d1a_v.mp4")
    print(mux("./d1a_v.mp4","./d1a.wav",
              "./Day01_the-test-that-changes-halfway.mp4"))
