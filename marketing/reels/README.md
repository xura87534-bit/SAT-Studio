# SAT App — Reel builder

One Reel a day for 30 days, built from Xurshid's script guide. `plan.json` holds every
day's palette, cut style, duration and beat list — follow it scene by scene.

## Files
- `plan.json` — the 30 scripts, verbatim beats, palettes, tag sets.
- `common.py` — brand kit: 8 palettes, `gradbg`, `glitch`, `scanlines`, `softglow`,
  `cap` (burned-in VO caption), `endcard_bio` (wordmark + "Link in bio"), audio helpers.
- `day01_adaptive.py` — the reference build. Day 1, Midnight Teal, glitch cuts, 24 s.
  Copy its shape for every other day.
- `renders/DayNN.mp4` — output, served raw from GitHub for Metricool to fetch.

## Rules
- 1080x1920 @ 30 fps. First 2.5 s is the hook — never the logo or the app.
- Burn the VO line in as a bottom caption (`cap`) so the reel reads muted.
- Leave audio headroom: music bed and SFX only, no synthesized speech. Xurshid lays
  Finn's VO from Google AI Studio under the animation.
- Close on `endcard_bio` — wordmark + "Link in bio".
- Each day uses its own palette and cut style from `plan.json`. No two consecutive
  days should look alike.
- Days 22-29 are written as if filmed. Build them as animated equivalents
  (handwriting, held-card graphics, illustrated scenes). Never fake a photoreal person.

## Render
    python day01_adaptive.py            # full render
    python day01_adaptive.py 2.5 9 17   # single frames for checking
