"""A week of Uzbek question reels in the UZ01 format (hook -> 5 s countdown -> answer and steps -> end card).

Each entry below is one 15-second reel. The layout, timing and sound come from uz01_savol.py.

    python uz_savollar.py            # render every reel -> renders/UZ04_foiz.mp4 ...
    python uz_savollar.py UZ06       # just one
    python uz_savollar.py --check    # one frame of each question and each answer into $FRAMES or the current folder
"""
import sys, os
import uz01_savol as R
from common import Writer, mux, FPS

# hook (two lines), question line, the sentence under it, what is asked, four options, index of the right one, steps (last = answer)
QUESTIONS = {
    "UZ04_foiz": dict(
        hook=["Ko‘pchilik", "xato qiladi"], eq="+20%, keyin −20%", ask="Narx avval oshdi, keyin tushdi.", ask2="Jami o‘zgarish = ?",
        opts=["0%", "−4%", "+4%", "−2%"], right=1, steps=["1,2 × 0,8 = 0,96", "0,96 = 96%", "100% − 96% = 4%", "Narx 4% ga tushdi"],
        caption="Narx 20% oshdi, keyin 20% tushdi. Jami qancha o‘zgardi?"),
    "UZ05_kvadrat": dict(
        hook=["5 soniyada", "yecha olasizmi?"], eq="x² − 5x + 6 = 0", ask="Tenglama ildizlarining yig‘indisi nechiga teng?", ask2="x₁ + x₂ = ?",
        opts=["−5", "6", "5", "1"], right=2, steps=["(x − 2)(x − 3) = 0", "x = 2 yoki x = 3", "2 + 3 = 5"],
        caption="x² − 5x + 6 = 0. Ildizlar yig‘indisi nechiga teng?"),
    "UZ06_sistema": dict(
        hook=["Buni 5 soniyada", "yeching"], eq="x + y = 10,  x − y = 4", ask="Tenglamalar sistemasi berilgan.", ask2="xy = ?",
        opts=["14", "40", "24", "21"], right=3, steps=["2x = 14", "x = 7", "y = 3", "xy = 21"],
        caption="x + y = 10 va x − y = 4. xy nechiga teng?"),
    "UZ07_ortacha": dict(
        hook=["5 soniyada", "yecha olasizmi?"], eq="10, 14, 9, 15, ?", ask="Beshta sonning o‘rta arifmetigi 12 ga teng.", ask2="Beshinchi son = ?",
        opts=["12", "13", "11", "10"], right=0, steps=["5 × 12 = 60", "10 + 14 + 9 + 15 = 48", "60 − 48 = 12"],
        caption="Beshta sonning o‘rta arifmetigi 12. To‘rttasi: 10, 14, 9, 15. Beshinchisi nechiga teng?"),
    "UZ08_diagonal": dict(
        hook=["Ko‘pchilik", "xato qiladi"], eq="12 va 5", ask="To‘g‘ri to‘rtburchakning tomonlari berilgan.", ask2="Diagonal = ?",
        opts=["17", "13", "60", "7"], right=1, steps=["12² + 5² = 144 + 25", "= 169", "√169 = 13"],
        caption="To‘g‘ri to‘rtburchakning tomonlari 12 va 5. Diagonali nechiga teng?"),
    "UZ09_funksiya": dict(
        hook=["Buni 5 soniyada", "yeching"], eq="f(x) = x² − 4x", ask="Funksiya berilgan.", ask2="f(−2) = ?",
        opts=["−4", "4", "−12", "12"], right=3, steps=["(−2)² = 4", "−4 · (−2) = 8", "4 + 8 = 12"],
        caption="f(x) = x² − 4x. f(−2) nechiga teng?"),
    "UZ10_daraja": dict(
        hook=["5 soniyada", "yecha olasizmi?"], eq="3ˣ⁺¹ = 81", ask="Ko‘rsatkichli tenglama berilgan.", ask2="x = ?",
        opts=["2", "4", "3", "27"], right=2, steps=["81 = 3⁴", "x + 1 = 4", "x = 3"],
        caption="3ˣ⁺¹ = 81. x nechiga teng?"),
}

def load(q):
    R.HOOK, R.EQ, R.ASK, R.ASK2 = q["hook"], q["eq"], q["ask"], q["ask2"]
    R.OPTS = list(zip("ABCD", q["opts"])); R.RIGHT = q["right"]; R.STEPS = q["steps"]

def render(name):
    load(QUESTIONS[name]); os.makedirs("renders", exist_ok=True)
    w = Writer("renders/_q.mp4")
    for i in range(int(R.DUR * FPS)): w.add(R.frame(i / FPS))
    w.close(); R.audio("renders/_q.wav")
    mux("renders/_q.mp4", "renders/_q.wav", f"renders/{name}.mp4")
    os.remove("renders/_q.mp4"); os.remove("renders/_q.wav"); print(f"renders/{name}.mp4")

if __name__ == "__main__":
    args = sys.argv[1:]
    if args == ["--check"]:
        out = os.environ.get("FRAMES", ".")
        for name, q in QUESTIONS.items():
            load(q)
            for t in (5.2, 12.2): R.frame(t).convert("RGB").save(os.path.join(out, f"{name}_{t}.png"))
    else:
        for name in QUESTIONS:
            if not args or any(name.startswith(a) for a in args): render(name)
