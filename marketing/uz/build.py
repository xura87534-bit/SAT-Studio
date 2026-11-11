"""Builds the Uzbek-voiced SAT Studio ads described in videos.json.

  python build.py                 # every video
  python build.py 02_moslashuvchan
  python build.py 01_umumiy --frames 1.5 6 12   # PNG frames only, into check/

Voice: Microsoft neural Uzbek voices through the edge-tts package (needs
speech.platform.bing.com; set HTTPS_PROXY if the network uses a proxy).
Each scene lasts as long as its spoken line, so editing a line retimes the video.
"""
import asyncio, json, os, subprocess, sys, wave
import numpy as np
import edge_tts

HERE = os.path.dirname(os.path.abspath(__file__))
TMP = os.path.join(HERE, ".build"); OUT = os.path.join(HERE, "renders")
SR = 44100
LEAD, TAIL, MIN_SCENE, END_HOLD = 0.35, 0.55, 2.6, 1.3


def tts_text(s):
    """Spoken form: plain apostrophes read more reliably than the typographic ones shown on screen."""
    return s.replace("ʻ", "'").replace("ʼ", "'").replace("’", "'").replace("—", ",")


async def speak(text, voice, path):
    if os.path.exists(path) and os.path.getsize(path) > 0: return
    kw = {"proxy": os.environ["HTTPS_PROXY"]} if os.environ.get("HTTPS_PROXY") else {}
    await edge_tts.Communicate(tts_text(text), voice, rate="+4%", **kw).save(path)


def load(path):
    raw = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", path, "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"],
                         capture_output=True, check=True).stdout
    a = np.frombuffer(raw, np.float32).astype(np.float64)
    nz = np.nonzero(np.abs(a) > 0.01)[0]                     # trim the silence the voice service pads with
    return a[max(0, nz[0] - 800): nz[-1] + 4000] if len(nz) else a


# ---------- music bed: soft pad + plucks, written here so there is nothing to license ----------
def midi(m): return 440 * 2 ** ((m - 69) / 12)

def music(total):
    n = int(total * SR); out = np.zeros(n); rng = np.random.default_rng(3)
    beat = 60 / 96; bar = beat * 4
    chords = [[53, 57, 60, 64], [55, 59, 62, 64], [57, 60, 64, 67], [52, 55, 59, 62]]   # F  G6  Am7  Em7
    def put(sig, at, g=1.0):
        i = int(at * SR)
        if i >= n: return
        sig = sig[: n - i]; out[i:i + len(sig)] += sig * g
    k = 0; t = 0.0
    while t < total:
        ch = chords[k % 4]; L = int(bar * SR); tt = np.arange(L) / SR
        env = np.minimum(1, tt / 0.5) * np.minimum(1, (bar - tt) / 0.5)
        pad = sum(np.sin(2 * np.pi * midi(m) * tt) + 0.5 * np.sin(2 * np.pi * midi(m) * 1.004 * tt) + 0.18 * np.sin(2 * np.pi * midi(m) * 2 * tt) for m in ch)
        put(pad * env, t, 0.05)
        bass = np.sin(2 * np.pi * midi(ch[0] - 12) * tt) * env
        put(bass, t, 0.16)
        order = [0, 2, 1, 3, 2, 1, 3, 2]
        for e in range(8):
            m = ch[order[e]] + 12; pl = int(0.9 * SR); pt = np.arange(pl) / SR
            s = (np.sin(2 * np.pi * midi(m) * pt) + 0.3 * np.sin(2 * np.pi * midi(m) * 2 * pt)) * np.exp(-pt * 5.5) * np.minimum(1, pt / 0.004)
            put(s, t + e * beat / 2, 0.11 * (1.0 if e % 2 == 0 else 0.7))
        for bt in range(4):
            kl = int(0.3 * SR); kt = np.arange(kl) / SR
            if bt in (0, 2): put(np.sin(2 * np.pi * np.cumsum(50 + 70 * np.exp(-kt * 28)) / SR) * np.exp(-kt * 9), t + bt * beat, 0.22)
            sh = rng.standard_normal(int(0.05 * SR)); sh = np.diff(sh, prepend=0) * np.exp(-np.arange(len(sh)) / SR * 90)
            put(sh, t + bt * beat + beat / 2, 0.02)
        t += bar; k += 1
    fade = int(1.4 * SR); out[-fade:] *= np.linspace(1, 0, fade) ** 1.5; out[: int(0.3 * SR)] *= np.linspace(0, 1, int(0.3 * SR))
    return out / np.max(np.abs(out))


def build(video, cfg, frames=None):
    vid = video["id"]; os.makedirs(TMP, exist_ok=True); os.makedirs(OUT, exist_ok=True)
    clips = []
    for i, s in enumerate(video["scenes"]):
        mp3 = os.path.join(TMP, f"{vid}_{i:02d}.mp3")
        asyncio.run(speak(s["vo"], video["voice"], mp3)); clips.append(load(mp3))
    t = 0.0; scenes = []
    for i, (s, c) in enumerate(zip(video["scenes"], clips)):
        dur = max(MIN_SCENE, LEAD + len(c) / SR + TAIL) + (END_HOLD if s["type"] == "end" else 0)
        scenes.append({**s, "start": round(t, 3), "dur": round(dur, 3), "url": cfg["url"]}); t += dur
    total = round(t, 3)
    tl = os.path.join(TMP, f"{vid}.json")
    json.dump({"id": vid, "total": total, "scenes": scenes}, open(tl, "w"), ensure_ascii=False)
    print(vid, f"{total:.1f}s", [f'{s["dur"]:.1f}' for s in scenes])
    if frames:
        subprocess.run(["node", os.path.join(HERE, "render.cjs"), tl, os.path.join(HERE, "check"), *frames], check=True); return
    # audio: voice on top of a quiet bed that dips further while a line is spoken
    n = int(total * SR); voice = np.zeros(n); duck = np.ones(n)
    for s, c in zip(scenes, clips):
        i = int((s["start"] + LEAD) * SR); c = c[: n - i]; voice[i:i + len(c)] += c
        a, b = max(0, i - int(0.2 * SR)), min(n, i + len(c) + int(0.25 * SR)); duck[a:b] = 0.55
    win = int(0.25 * SR); duck = np.convolve(duck, np.ones(win) / win, "same")
    voice = voice / np.max(np.abs(voice)) * 0.92
    mix = voice + music(total) * 0.2 * duck
    mix = mix / max(1.0, np.max(np.abs(mix))) * 0.97
    wav = os.path.join(TMP, f"{vid}.wav")
    with wave.open(wav, "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.stack([mix, mix], 1) * 32767).astype(np.int16).tobytes())
    silent = os.path.join(TMP, f"{vid}.mp4"); final = os.path.join(OUT, f"{vid}.mp4")
    subprocess.run(["node", os.path.join(HERE, "render.cjs"), tl, silent], check=True)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", silent, "-i", wav, "-map", "0:v", "-map", "1:a", "-c:v", "copy",
                    "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", final], check=True)
    print("wrote", final)


if __name__ == "__main__":
    args = sys.argv[1:]; frames = None
    if "--frames" in args: k = args.index("--frames"); frames = args[k + 1:]; args = args[:k]
    cfg = json.load(open(os.path.join(HERE, "videos.json"), encoding="utf-8"))
    for v in cfg["videos"]:
        if not args or v["id"] in args: build(v, cfg, frames)
