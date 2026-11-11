# Uzbek-voiced ads

Three vertical ads (1080x1920, 30 fps) built from real app screens, with an Uzbek voiceover,
on-screen Uzbek text and a quiet music bed.

| File | Length | Voice | What it sells |
|---|---|---|---|
| `renders/01_umumiy.mp4` | 40 s | Madina | Overview: tests, adaptive Module 2, calculator, score, word bank, progress |
| `renders/02_moslashuvchan.mp4` | 22 s | Sardor | The adaptive test and the score estimate |
| `renders/03_lugat_va_kurs.mp4` | 27 s | Madina | Word bank with Uzbek translations, Quick Practice, 90-Day Course |

## Change the words or the voice

Everything spoken and shown is in `videos.json`. Each scene's `vo` line is both the voiceover and
the on-screen subtitle, and a scene lasts as long as its line takes to say, so editing a line
retimes the video. `voice` is `uz-UZ-MadinaNeural` (female) or `uz-UZ-SardorNeural` (male).

    pip install edge-tts numpy
    python build.py                    # all three
    python build.py 02_moslashuvchan   # one
    python build.py 01_umumiy --frames 2.5 6 12   # still frames into check/

The voice comes from Microsoft's neural Uzbek voices through `edge-tts`, which needs network
access to `speech.platform.bing.com`. Delete `.build/` to force lines to be spoken again.

## Retake the screenshots

`shots/` holds the app screens. They come from the app running offline with demo data: nine
practice tests taken automatically (Math 390 to 750, Reading & Writing 470 to 640) and eight
word-bank entries. To retake them after a redesign:

    (cd ../../public && python3 -m http.server 8765) &
    mkdir -p /tmp/sat && node capture/seed.cjs /tmp/sat
    mkdir -p /tmp/sat/raw && node capture/capture.cjs /tmp/sat /tmp/sat/raw
    node capture/capture_test.cjs /tmp/sat /tmp/sat/raw

Then resize the ones you need to 860 px wide JPEGs in `shots/`. `ring` in `videos.json` is the
highlighted box, in the app's own 430-px-wide coordinates.
