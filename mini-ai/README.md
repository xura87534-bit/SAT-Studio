# mini-ai

A tiny language model you train yourself, on text you collect yourself. It is separate from the SAT Studio app and is not deployed with it.

It is a real GPT-style model, the same kind of design as the big assistants, but about a million times smaller. It learns to continue text one character at a time.

## What to expect

- After training it writes text that looks like the language it read: real-looking Uzbek words and sentence shapes, often nonsense in meaning.
- It cannot answer questions, do maths or hold a conversation. Models that can were trained on vastly more text with vastly more computing power.
- It is for learning how these models work: collect text, train, watch the loss fall, see the output improve.

## Set up (once)

You need Python 3.10 or newer.

```bash
pip install torch
```

## Use

Run these from inside the `mini-ai` folder.

**1. Collect text**

```bash
python ai.py collect
```

This browses the sites listed in `seeds.txt`, follows links inside those sites, and saves the paragraph text to `data/corpus.txt`. It saves 200 pages per run; run it again to add more, or ask for more at once:

```bash
python ai.py collect --pages 1000
```

**2. Train**

```bash
python ai.py train
```

On a recent Mac this takes roughly 5 to 15 minutes with the default settings. The "check loss" number should go down; around 1.5 or lower the output starts to read like the language.

**3. Try it**

```bash
python ai.py talk "Matematika bu"
```

**See what you have**

```bash
python ai.py info
```

## Choosing what it reads

Edit `seeds.txt`: one web address per line. The crawler starts from those pages and never leaves the sites listed there. The default list is Uzbek Wikipedia pages about maths and education, so the model learns Uzbek.

How the crawler behaves:

- It reads each site's `robots.txt` and skips any page the site forbids.
- It waits 2 seconds between requests to the same site.
- It keeps only paragraphs of 80 characters or more, so menus and captions are left out.
- It remembers the addresses it has visited (`data/seen.txt`), so running it again continues instead of starting over.

Only list sites whose terms allow this. Wikipedia text is free to reuse under its licence. Text you collect is for your own experiments; it does not become yours to republish.

## Making it better

| Change | Command | Effect |
|---|---|---|
| More text | `python ai.py collect --pages 2000` | The biggest improvement. Aim for 5 MB or more. |
| Longer training | `python ai.py train --steps 10000` | Better, slower. |
| Bigger model | `python ai.py train --width 384 --layers 6 --heads 6` | Better with enough text; several times slower. |
| Wilder or safer output | `python ai.py talk "..." --temperature 1.0` (or `0.5`) | Higher is more varied, lower is more repetitive. |

To start over, delete the `data` folder.
