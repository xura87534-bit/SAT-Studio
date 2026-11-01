# SAT App — Reel builder

One Reel a day for 30 days. See `plan.json` for the hook, scenario, and style of each day.

- Day 1 (`day01.py`) is implemented as the template. Each later day is produced by a scheduled task that clones this repo, reads the plan, and renders that day's reel following Day 1's drawing patterns in `common.py`.
- `common.py` holds the brand (navy #090C16, gold #F6BE5E, lavender #AEB7FF, Inter Display), a shared Writer, and the 1-second end card (logo + "More in bio").
- Render: `python day01.py` → `Day01_90-percent-get-this-wrong.mp4`.
