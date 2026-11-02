import numpy as np, subprocess, math, wave
from PIL import Image, ImageDraw, ImageFont, ImageFilter
W,H,FPS=1080,1920,30
F="/usr/share/fonts/opentype/inter/"
def font(name,size): return ImageFont.truetype(F+name,size)
NAVY=(9,12,22); GOLD=(246,190,94); INK=(233,237,248); MUTED=(141,151,182); LAV=(174,183,255); RED=(255,124,143); GREEN=(67,211,162)
def ease(x): x=max(0,min(1,x)); return 1-(1-x)**3
def back(x): x=max(0,min(1,x)); c=1.7; return 1+(c+1)*(x-1)**3+c*(x-1)**2
_bg=None
def background():
    global _bg
    if _bg is None:
        y=np.linspace(0,1,H)[:,None]; x=np.linspace(0,1,W)[None,:]
        r=np.hypot(x-0.5,(y-0.35)*1.6)
        base=np.zeros((H,W,3))
        top=np.array([27,33,64]); bot=np.array(NAVY)
        base+= (top*(1-y)+bot*y)[...,:]  if False else 0
        g=np.clip(1-r*1.3,0,1)[...,None]
        base=bot+ (top-bot)*g
        img=Image.fromarray(base.astype(np.uint8))
        d=ImageDraw.Draw(img)
        for gx in range(0,W,72): d.line([(gx,0),(gx,H)],fill=(20,26,46))
        for gy in range(0,H,72): d.line([(0,gy),(W,gy)],fill=(20,26,46))
        _bg=img
    return _bg.copy()
def ctext(d,y,s,f,fill,alpha=1.0,img=None):
    w=d.textlength(s,font=f); x=(W-w)/2
    d.text((x,y),s,font=f,fill=fill+(int(255*alpha),) if len(fill)==3 else fill)
    return w
def wrap(d,s,f,maxw):
    words=s.split(); lines=[]; cur=""
    for w in words:
        t=(cur+" "+w).strip()
        if d.textlength(t,font=f)<=maxw: cur=t
        else: lines.append(cur); cur=w
    if cur: lines.append(cur)
    return lines
class Writer:
    def __init__(self,path):
        self.p=subprocess.Popen(["ffmpeg","-y","-loglevel","error","-f","rawvideo","-pix_fmt","rgb24","-s",f"{W}x{H}","-r",str(FPS),"-i","-","-c:v","libx264","-preset","veryfast","-crf","18","-pix_fmt","yuv420p",path],stdin=subprocess.PIPE)
    def add(self,img): self.p.stdin.write(img.convert("RGB").tobytes())
    def close(self): self.p.stdin.close(); return self.p.wait()
# ---------- audio ----------
SR=44100
def env(n,a=0.005,r=0.2):
    t=np.arange(n)/SR; e=np.minimum(1,t/a)*np.exp(-t/r); return e
def tone(f,dur,a=0.005,r=0.3,kind="sine"):
    n=int(dur*SR); t=np.arange(n)/SR
    w=np.sin(2*np.pi*f*t) if kind=="sine" else np.sign(np.sin(2*np.pi*f*t))*0.5
    return w*env(n,a,r)
def noise(dur,r=0.05):
    n=int(dur*SR); return np.random.randn(n)*env(n,0.001,r)
def kick(): n=int(0.35*SR); t=np.arange(n)/SR; f=55+90*np.exp(-t*30); return np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-t*7)
def whoosh(dur=0.6):
    n=int(dur*SR); x=np.random.randn(n); 
    from numpy.fft import rfft,irfft
    t=np.linspace(0,1,n); e=np.sin(np.pi*t)**2
    y=np.convolve(x,np.ones(30)/30,'same')*e; return y*0.8
def put(buf,s,at,g=1.0):
    i=int(at*SR)
    if i>=len(buf): return
    j=min(len(buf),i+len(s)); buf[i:j]+=s[:j-i]*g
def save(buf,path):
    buf=buf/max(1e-9,np.max(np.abs(buf)))*0.89
    st=np.stack([buf,buf],1); d=(st*32767).astype(np.int16)
    with wave.open(path,"wb") as w: w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(d.tobytes())
def mux(v,a,out):
    return subprocess.run(["ffmpeg","-y","-loglevel","error","-i",v,"-i",a,"-map","0:v","-map","1:a","-c:v","copy","-c:a","aac","-b:a","192k","-shortest",out]).returncode
LOGO=Image.open("logo.png").convert("RGBA")
def endcard(img,p,line1=None,line2=None):
    # The branded 1-s end card: just logo + "More in bio"
    d=ImageDraw.Draw(img,"RGBA")
    s=int(360*back(p))
    if s>10:
        lg=LOGO.resize((s,s)); img.alpha_composite(lg,((W-s)//2,760-s//2))
    b=ease((p-0.25)/0.4)
    ctext(d,1180,"More in bio",font("InterDisplay-Black.otf",96),GOLD,b)

# ---------- per-day palettes from the script guide ----------
PALETTES = {
 "Midnight Teal":   {"bg":(8,22,30),  "bg2":(12,42,52),  "ink":(226,244,246), "accent":(64,224,208), "warn":(255,110,120), "dim":(96,126,136)},
 "Soft Slate":      {"bg":(24,26,34), "bg2":(40,44,58),  "ink":(232,234,244), "accent":(150,170,255), "warn":(255,138,150), "dim":(124,130,152)},
 "Forest Terminal": {"bg":(10,20,14), "bg2":(16,36,24),  "ink":(222,240,226), "accent":(86,222,130), "warn":(255,150,100), "dim":(98,130,108)},
 "Ice Minimal":     {"bg":(238,242,248),"bg2":(255,255,255),"ink":(22,28,40), "accent":(44,112,220), "warn":(214,64,80),  "dim":(132,146,170)},
 "Brick Red":       {"bg":(26,12,12), "bg2":(52,20,20),  "ink":(248,232,228), "accent":(232,88,72),  "warn":(255,196,96), "dim":(146,100,94)},
 "Olive Stone":     {"bg":(22,24,16), "bg2":(40,44,28),  "ink":(238,238,224), "accent":(186,196,90), "warn":(246,160,92), "dim":(130,134,104)},
 "Dusty Clay":      {"bg":(28,20,18), "bg2":(52,36,30),  "ink":(246,236,228), "accent":(224,146,104),"warn":(255,206,120),"dim":(150,120,106)},
 "Warm Gold":       {"bg":(22,18,10), "bg2":(44,34,16),  "ink":(248,240,224), "accent":(246,190,94), "warn":(255,130,110),"dim":(146,128,96)},
}
def pal(name): return PALETTES[name]

def gradbg(P, t=0.0):
    """Soft radial gradient background for a palette."""
    y=np.linspace(0,1,H)[:,None]; x=np.linspace(0,1,W)[None,:]
    r=np.hypot(x-0.5,(y-0.40)*1.5)
    g=np.clip(1-r*1.25,0,1)[...,None]
    base=np.array(P["bg"])+(np.array(P["bg2"])-np.array(P["bg"]))*g
    img=Image.fromarray(base.astype(np.uint8)).convert("RGBA")
    return img

def glitch(img, amt):
    """RGB split + horizontal slice displacement. amt 0..1."""
    if amt<=0.001: return img
    a=np.array(img)
    sh=int(14*amt)
    if sh>0:
        a[:,sh:,0]=a[:,:-sh,0]            # red left
        a[:,:-sh,2]=a[:,sh:,2]            # blue right
    rng=np.random.RandomState(int(amt*9173)%2048)
    for _ in range(int(10*amt)+1):
        y0=rng.randint(0,H-8); hgt=rng.randint(6,60); dx=rng.randint(-90,90)
        y1=min(H,y0+hgt)
        a[y0:y1]=np.roll(a[y0:y1],dx,axis=1)
    return Image.fromarray(a)

def scanlines(d, alpha=26, step=4):
    for y in range(0,H,step): d.line([(0,y),(W,y)],fill=(0,0,0,alpha))

def softglow(img, draw_fn, blur=26, passes=1):
    """Draw once into a layer, blur it, composite as glow, then draw sharp on top."""
    gl=Image.new("RGBA",(W,H),(0,0,0,0)); gd=ImageDraw.Draw(gl,"RGBA")
    draw_fn(gd)
    for _ in range(passes): gl=gl.filter(ImageFilter.GaussianBlur(blur))
    img.alpha_composite(gl)
    draw_fn(ImageDraw.Draw(img,"RGBA"))

def cap(d, text, P, y=1620, size=54, alpha=1.0, box=True):
    """Bottom caption bar carrying the VO line so the reel reads muted."""
    if alpha<=0: return
    f=font("Inter-SemiBold.otf",size)
    lines=wrap(d,text,f,900)
    hgt=len(lines)*(size+14)+36
    if box:
        d.rounded_rectangle([60,y-20,W-60,y-20+hgt],radius=28,
                            fill=(0,0,0,int(150*alpha)))
    for i,ln in enumerate(lines):
        ctext(d,y+i*(size+14),ln,f,P["ink"],alpha)

def endcard_bio(img,p,P):
    """Script's close: wordmark holds + 'Link in bio'."""
    d=ImageDraw.Draw(img,"RGBA")
    s=int(300*back(p))
    if s>10:
        lg=LOGO.resize((s,s)); img.alpha_composite(lg,((W-s)//2,720-s//2))
    a=ease((p-0.18)/0.35)
    ctext(d,980,"SAT STUDIO",font("InterDisplay-Black.otf",92),P["ink"],a)
    b=ease((p-0.42)/0.35)
    ctext(d,1140,"Link in bio",font("InterDisplay-Bold.otf",68),P["accent"],b)
