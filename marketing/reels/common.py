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
