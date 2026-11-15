"""mini-ai: a tiny language model you train yourself, on text you collect yourself.

    python ai.py collect              # browse the sites in seeds.txt and save their text to data/corpus.txt
    python ai.py train                # train the model on that text  -> data/model.pt
    python ai.py talk "SAT bu"        # let the model continue a sentence
    python ai.py info                 # how much text and what model you have

It is a real GPT-style model, only about a million times smaller than the ones behind chat assistants,
so expect sentences that look like the language it read, not correct answers. See README.md.
"""
import argparse, collections, os, re, sys, time, urllib.parse, urllib.request, urllib.robotparser
from html.parser import HTMLParser

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data")
CORPUS, SEEN, MODEL = (os.path.join(DATA, f) for f in ("corpus.txt", "seen.txt", "model.pt"))
AGENT = "mini-ai-learning-crawler/1.0"

# ---------------------------------------------------------------- collect
class Page(HTMLParser):
    """Pulls paragraph text and links out of one HTML page."""
    SKIP = {"script", "style", "nav", "footer", "header", "aside", "form", "table", "sup"}
    def __init__(self):
        super().__init__(); self.paras, self.links, self.buf, self.depth, self.in_p = [], [], [], 0, False
    def handle_starttag(self, tag, attrs):
        if tag in self.SKIP: self.depth += 1
        elif tag == "p": self.in_p, self.buf = True, []
        elif tag == "a":
            href = dict(attrs).get("href")
            if href: self.links.append(href)
    def handle_endtag(self, tag):
        if tag in self.SKIP: self.depth = max(0, self.depth - 1)
        elif tag == "p" and self.in_p:
            text = re.sub(r"\s+", " ", "".join(self.buf)).strip()
            text = re.sub(r"\[\d+\]", "", text)                     # footnote marks like [3]
            if len(text) >= 80: self.paras.append(text)             # skip menus, captions and one-liners
            self.in_p = False
    def handle_data(self, data):
        if self.in_p and not self.depth: self.buf.append(data)

def collect(args):
    seeds = [l.strip() for l in open(args.seeds, encoding="utf-8") if l.strip() and not l.startswith("#")]
    if not seeds: sys.exit("seeds.txt is empty: add one web address per line.")
    os.makedirs(DATA, exist_ok=True)
    seen = set(open(SEEN, encoding="utf-8").read().split()) if os.path.exists(SEEN) else set()
    allowed = {urllib.parse.urlparse(s).netloc for s in seeds}      # never wander off the sites you listed
    queue, robots, pages, chars, last = collections.deque(seeds), {}, 0, 0, {}
    def may_fetch(url):
        u = urllib.parse.urlparse(url); host = u.netloc
        if host not in robots:
            rp = urllib.robotparser.RobotFileParser(f"{u.scheme}://{host}/robots.txt")
            try: rp.read()
            except Exception: rp = None                             # no readable rules: stay out, to be safe
            robots[host] = rp
        return robots[host] is not None and robots[host].can_fetch(AGENT, url)
    with open(CORPUS, "a", encoding="utf-8") as out, open(SEEN, "a", encoding="utf-8") as log:
        while queue and pages < args.pages:
            url = queue.popleft().split("#")[0]
            host = urllib.parse.urlparse(url).netloc
            if url in seen or host not in allowed or not url.startswith("http"): continue
            seen.add(url); log.write(url + "\n")
            if not may_fetch(url): print("  skipped (site rules):", url); continue
            wait = args.delay - (time.time() - last.get(host, 0))   # be polite: one request per site every few seconds
            if wait > 0: time.sleep(wait)
            last[host] = time.time()
            try:
                req = urllib.request.Request(url, headers={"User-Agent": AGENT})
                with urllib.request.urlopen(req, timeout=20) as r:
                    if "text/html" not in r.headers.get("Content-Type", ""): continue
                    html = r.read(2_000_000).decode(r.headers.get_content_charset() or "utf-8", "replace")
            except Exception as e:
                print("  failed:", url, "-", e); continue
            page = Page()
            try: page.feed(html)
            except Exception: continue
            if page.paras:
                text = "\n".join(page.paras) + "\n\n"; out.write(text); out.flush()
                pages += 1; chars += len(text); print(f"[{pages}/{args.pages}] {len(text):>7,} characters  {url}")
            for href in page.links:
                nxt = urllib.parse.urljoin(url, href)
                if urllib.parse.urlparse(nxt).netloc in allowed and nxt not in seen and not re.search(r"\.(jpg|png|gif|svg|pdf|zip|mp4|css|js)$|[?&]action=|/Special:|/Maxsus:", nxt, re.I):
                    queue.append(nxt)
    total = os.path.getsize(CORPUS) if os.path.exists(CORPUS) else 0
    print(f"\nSaved {pages} pages, {chars:,} new characters. The corpus is now {total / 1e6:.2f} MB.")
    if total < 1_000_000: print("Tip: the model needs at least 1 MB of text to say anything sensible. Run collect again with --pages 500.")

# ---------------------------------------------------------------- the model
def build(vocab, cfg):
    import torch, torch.nn as nn, torch.nn.functional as F
    class Block(nn.Module):
        def __init__(self):
            super().__init__()
            self.ln1, self.ln2 = nn.LayerNorm(cfg["width"]), nn.LayerNorm(cfg["width"])
            self.attn = nn.MultiheadAttention(cfg["width"], cfg["heads"], dropout=cfg["dropout"], batch_first=True)
            self.mlp = nn.Sequential(nn.Linear(cfg["width"], 4 * cfg["width"]), nn.GELU(), nn.Linear(4 * cfg["width"], cfg["width"]), nn.Dropout(cfg["dropout"]))
        def forward(self, x, mask):
            h = self.ln1(x); x = x + self.attn(h, h, h, attn_mask=mask, need_weights=False)[0]
            return x + self.mlp(self.ln2(x))
    class GPT(nn.Module):
        """Reads up to `context` characters and guesses the next one."""
        def __init__(self):
            super().__init__()
            self.tok, self.pos = nn.Embedding(vocab, cfg["width"]), nn.Embedding(cfg["context"], cfg["width"])
            self.blocks = nn.ModuleList(Block() for _ in range(cfg["layers"]))
            self.ln, self.head = nn.LayerNorm(cfg["width"]), nn.Linear(cfg["width"], vocab)
        def forward(self, idx, targets=None):
            T = idx.shape[1]
            x = self.tok(idx) + self.pos(torch.arange(T, device=idx.device))
            mask = torch.triu(torch.ones(T, T, device=idx.device, dtype=torch.bool), 1)   # no peeking at later characters
            for b in self.blocks: x = b(x, mask)
            logits = self.head(self.ln(x))
            loss = F.cross_entropy(logits.view(-1, logits.size(-1)), targets.view(-1)) if targets is not None else None
            return logits, loss
    return GPT()

def device():
    import torch
    return "cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu"

def train(args):
    try: import torch
    except ImportError: sys.exit("PyTorch is missing. Install it with:  pip install torch")
    if not os.path.exists(CORPUS): sys.exit("No text yet. Run:  python ai.py collect")
    text = open(CORPUS, encoding="utf-8").read()
    if len(text) < 20_000: sys.exit(f"Only {len(text):,} characters collected: too little to learn from. Collect more first.")
    chars = sorted(set(text)); stoi = {c: i for i, c in enumerate(chars)}
    data = torch.tensor([stoi[c] for c in text], dtype=torch.long)
    split = int(0.9 * len(data)); tr, va = data[:split], data[split:]      # keep 10% aside to check it isn't just memorising
    cfg = dict(context=args.context, width=args.width, layers=args.layers, heads=args.heads, dropout=0.1)
    dev = device(); torch.manual_seed(1); model = build(len(chars), cfg).to(dev)
    n = sum(p.numel() for p in model.parameters())
    print(f"{len(text) / 1e6:.2f} MB of text, {len(chars)} different characters, model of {n / 1e6:.2f} million numbers, training on {dev}.")
    opt = torch.optim.AdamW(model.parameters(), lr=args.lr)
    def batch(src):
        ix = torch.randint(len(src) - cfg["context"] - 1, (args.batch,))
        x = torch.stack([src[i:i + cfg["context"]] for i in ix]); y = torch.stack([src[i + 1:i + cfg["context"] + 1] for i in ix])
        return x.to(dev), y.to(dev)
    @torch.no_grad()
    def check(src):
        model.eval(); l = sum(model(*batch(src))[1].item() for _ in range(20)) / 20; model.train(); return l
    t0 = time.time(); best = 1e9
    for step in range(1, args.steps + 1):
        for g in opt.param_groups: g["lr"] = args.lr * min(1, step / 100) * (0.1 + 0.9 * (1 - step / args.steps))   # warm up, then ease off
        _, loss = model(*batch(tr)); opt.zero_grad(set_to_none=True); loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0); opt.step()
        if step % args.every == 0 or step == args.steps:
            v = check(va); print(f"step {step:>5}/{args.steps}  train loss {check(tr):.3f}  check loss {v:.3f}  {time.time() - t0:.0f}s")
            if v < best: best = v; torch.save({"model": model.state_dict(), "chars": chars, "cfg": cfg}, MODEL)
    print(f"\nSaved the best version to {MODEL}. Lower loss is better; about 1.5 or less starts to read like the language.")
    print('Try it:  python ai.py talk "SAT bu"')

def talk(args):
    try: import torch
    except ImportError: sys.exit("PyTorch is missing. Install it with:  pip install torch")
    if not os.path.exists(MODEL): sys.exit("No trained model yet. Run:  python ai.py train")
    ck = torch.load(MODEL, map_location="cpu"); chars, cfg = ck["chars"], ck["cfg"]; stoi = {c: i for i, c in enumerate(chars)}
    dev = device(); model = build(len(chars), cfg).to(dev); model.load_state_dict(ck["model"]); model.eval()
    prompt = "".join(c for c in args.prompt if c in stoi) or chars[0]      # it can only use characters it has seen
    idx = torch.tensor([[stoi[c] for c in prompt]], device=dev)
    with torch.no_grad():
        for _ in range(args.length):
            logits = model(idx[:, -cfg["context"]:])[0][:, -1] / args.temperature
            idx = torch.cat([idx, torch.multinomial(torch.softmax(logits, -1), 1)], 1)
    print("".join(chars[i] for i in idx[0].tolist()))

def info(_):
    size = os.path.getsize(CORPUS) if os.path.exists(CORPUS) else 0
    pages = sum(1 for _ in open(SEEN, encoding="utf-8")) if os.path.exists(SEEN) else 0
    print(f"Text collected: {size / 1e6:.2f} MB from about {pages} addresses visited.")
    print("Trained model:  " + (f"yes, {os.path.getsize(MODEL) / 1e6:.1f} MB" if os.path.exists(MODEL) else "not yet"))

if __name__ == "__main__":
    p = argparse.ArgumentParser(description="A tiny language model you collect data for and train yourself.")
    sub = p.add_subparsers(dest="cmd", required=True)
    c = sub.add_parser("collect", help="browse the sites in seeds.txt and save their text")
    c.add_argument("--pages", type=int, default=200, help="how many pages to save this run (default 200)")
    c.add_argument("--seeds", default=os.path.join(HERE, "seeds.txt"), help="file with the starting addresses (default seeds.txt)")
    c.add_argument("--delay", type=float, default=2.0, help="seconds to wait between requests to one site (default 2)")
    t = sub.add_parser("train", help="train the model on the collected text")
    t.add_argument("--steps", type=int, default=3000); t.add_argument("--batch", type=int, default=32); t.add_argument("--lr", type=float, default=3e-4)
    t.add_argument("--context", type=int, default=128); t.add_argument("--width", type=int, default=192)
    t.add_argument("--layers", type=int, default=4); t.add_argument("--heads", type=int, default=4); t.add_argument("--every", type=int, default=250)
    k = sub.add_parser("talk", help="let the model continue a sentence")
    k.add_argument("prompt"); k.add_argument("--length", type=int, default=300); k.add_argument("--temperature", type=float, default=0.8)
    sub.add_parser("info", help="show what you have so far")
    a = p.parse_args(); {"collect": collect, "train": train, "talk": talk, "info": info}[a.cmd](a)
