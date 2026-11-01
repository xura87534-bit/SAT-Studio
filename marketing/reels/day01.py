import sys; sys.path.insert(0,"/home/claude/reels")
from common import *
T=15.9
Q="The price of a commodity increased by 20% in the first year and then by p% in the second year. Over the two years, the price increased by a total of 50%. What is p?"
def frame(t):
    img=background().convert("RGBA"); d=ImageDraw.Draw(img,"RGBA")
    if t<2.8:   # hook
        # massive "90%" number
        p0=back(t/0.35); a0=ease(t/0.2)
        f0=font("InterDisplay-Black.otf",int(360*max(0.01,p0)))
        ctext(d,460,"90%",f0,RED,a0)
        a1=ease((t-0.6)/0.3)
        ctext(d,920,"get this wrong.",font("InterDisplay-Black.otf",96),INK,a1)
        a2=ease((t-1.3)/0.3); p=back((t-1.3)/0.4)
        ctext(d,1120+(1-p)*30,"Can you?",font("InterDisplay-Black.otf",118),GOLD,a2)
        # stamp
        pa=ease((t-2.0)/0.2)
        d.rounded_rectangle([290,1340,790,1420],radius=40,outline=LAV+(int(255*pa),),width=5)
        ctext(d,1352,"SAT MATH · MODULE 2",font("Inter-Bold.otf",36),LAV,pa)
    elif t<11.2:  # question + ring
        u=t-2.8
        a=ease(u/0.35); off=(1-ease(u/0.45))*80
        d.rounded_rectangle([70,300+off,1010,880+off],radius=44,fill=(17,23,39,int(240*a)),outline=(148,163,255,int(60*a)),width=2)
        d.text((120,345+off),"QUESTION",font=font("Inter-Bold.otf",36),fill=LAV+(int(255*a),))
        fq=font("Inter-SemiBold.otf",52); lines=wrap(d,Q,fq,840)
        for i,ln in enumerate(lines):
            col=INK
            d.text((120,420+off+i*74),ln,font=fq,fill=col+(int(255*a),))
        # highlight numbers
        # ring
        cx,cy,R=540,1160,170
        rem=max(0,30-(u-0.6)/7.4*30) if u>0.6 else 30
        frac=rem/30
        d.ellipse([cx-R,cy-R,cx+R,cy+R],outline=(40,48,80,255),width=26)
        col=GOLD if rem>10 else RED
        if frac>0: d.arc([cx-R,cy-R,cx+R,cy+R],start=-90,end=-90+360*frac,fill=col+(255,),width=26)
        ctext(d,cy-95,f"{int(math.ceil(rem))}",font("InterDisplay-Black.otf",170),INK)
        ctext(d,cy+80,"seconds",font("Inter-Medium.otf",38),MUTED)
        pa=0.55+0.45*math.sin(u*5)
        ctext(d,1395,"PAUSE & SOLVE",font("Inter-Bold.otf",48),INK,pa)
    elif t<14.9:  # trap exposed, then real answer
        u=t-11.2
        if u<2.2:
            a0=ease(u/0.25)
            ctext(d,290,"THE TRAP",font("Inter-Bold.otf",44),RED,a0)
            f=font("InterDisplay-Black.otf",180)
            ctext(d,370,"p = 30",f,INK,a0)
            if u>0.8:
                ca=ease((u-0.8)/0.25); x1,x2=320,760; y=490
                d.line([(x1,y-40),(x2,y+60)],fill=RED+(int(255*ca),),width=12)
            ca=ease((u-1.3)/0.3)
            ctext(d,640,"20% + 30% ≠ 50%",font("InterDisplay-Bold.otf",64),RED,ca)
        else:
            v=u-2.2
            fl=max(0,1-v/0.25)
            if fl>0: d.rectangle([0,0,W,H],fill=(255,255,255,int(160*fl)))
            ctext(d,290,"ACTUALLY",font("Inter-Bold.otf",44),GOLD,ease(v/0.2))
            p=back(v/0.4); fr=font("InterDisplay-Black.otf",int(200*max(0.01,p)))
            ctext(d,380,"p = 25",fr,GOLD,ease(v/0.2))
            steps=["1.2 × (1 + p/100) = 1.5","1 + p/100 = 1.25","p = 25"]
            fs=font("Inter-SemiBold.otf",58)
            for i,s in enumerate(steps):
                a=ease((v-0.5-0.4*i)/0.3); off=(1-a)*30
                ctext(d,780+i*110+off,s,fs,INK if i<2 else GREEN,a)
            a=ease((v-1.8)/0.3)
            ctext(d,1240,"Percent growth multiplies.",font("InterDisplay-Bold.otf",54),GOLD,a)
            ctext(d,1320,"It does not add.",font("Inter-Medium.otf",46),MUTED,a)
    else:
        endcard(img,(t-14.9)/1.0)
    return img
if __name__=="__main__":
    if len(sys.argv)>1:
        for t in map(float,sys.argv[1:]): frame(t).convert("RGB").save(f"/home/claude/reels/d1_{t}.jpg",quality=90)
        sys.exit()
    w=Writer("/home/claude/reels/d1_v.tmp.mp4")
    for i in range(int(T*FPS)): w.add(frame(i/FPS))
    assert w.close()==0
    # audio
    buf=np.zeros(int((T+0.5)*SR))
    put(buf,whoosh(0.5),0.0,0.5)
    for k in range(5): put(buf,tone(880,0.08,r=0.05),0.12*k,0.25)
    put(buf,kick(),1.0,0.9); put(buf,noise(0.3,0.08),1.0,0.2)
    put(buf,whoosh(0.6),2.5,0.6)
    # tense pulse 120bpm during question
    bt=0.5
    for i in range(int(8.4/bt)):
        at=2.8+i*bt; put(buf,kick(),at,0.7)
        put(buf,tone(110,0.45,r=0.25,kind="sq"),at,0.12)
        put(buf,tone(220 if i%4<2 else 207.65,0.2,r=0.12),at+0.25,0.08)
    for k in range(30):
        at=3.4+k*7.4/30; put(buf,noise(0.03,0.01),at,0.35); put(buf,tone(2000,0.03,r=0.01),at,0.15)
    # reveal hit + chord
    put(buf,kick(),11.2,1.0); put(buf,noise(0.6,0.25),11.2,0.35)
    for f in [261.6,329.6,392,523.3]: put(buf,tone(f,2.5,r=1.2),11.2,0.18)
    for i in range(3): put(buf,tone(660+110*i,0.15,r=0.1),11.9+0.55*i,0.2)
    put(buf,whoosh(0.6),14.6,0.5)
    for f in [392,493.9,587.3,784]: put(buf,tone(f,2.2,r=1.0),14.9,0.15)
    save(buf,"/home/claude/reels/d1.wav")
    import os; os.rename("/home/claude/reels/d1_v.tmp.mp4","/home/claude/reels/d1_v.mp4")
    print(mux("/home/claude/reels/d1_v.mp4","/home/claude/reels/d1.wav","/home/claude/reels/Day01_30-second-challenge.mp4"))
