# Trap reel (UZ11)

A 20-second Instagram reel made with Remotion: three SAT questions, the third is a trap.
The first two are answered on screen; the third shows time running out, strikes through the answer
most people give (+5%), locks the real answer and sends viewers to the app, where the reel's three
questions are waiting (the app shows them to visitors from Instagram, see `reelItems()` in `public/index.html`).

```bash
npm i
python make_audio.py
npx remotion studio
npx remotion render TrapReel out/UZ11_tuzoq.mp4
```

On a machine without Remotion's own Chrome, add `--browser-executable=<path to chrome-headless-shell> --chrome-mode=headless-shell`.

The finished file is copied to `marketing/reels/renders/UZ11_tuzoq.mp4`.
