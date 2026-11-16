import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Backdrop } from "./Backdrop";
import { C, DISPLAY, UI } from "../theme";

export type QuestionProps = {
  step: string;          // "1/3"
  tag: string;           // label above the question
  trap?: boolean;        // the third question: red styling, no answer
  question: string;
  options: string[];
  right: number;         // index of the correct option (ignored when trap)
  countFrom: number;     // frame the countdown starts
  seconds: number;       // countdown length
  revealAt: number;      // frame the answer (or the trap stamp) appears
  trapPick?: number;     // the option most people choose, struck through at revealAt
};

const LETTERS = ["A", "B", "C", "D"];

export const QuestionScene: React.FC<QuestionProps> = (p) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const inP = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 12 });
  const left = Math.max(0, p.seconds - (frame - p.countFrom) / fps);
  const counting = frame >= p.countFrom && frame < p.revealAt;
  const revealed = frame >= p.revealAt;
  const k = interpolate(frame, [p.revealAt, p.revealAt + 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const urgent = p.trap && counting && left <= 2;
  const accent = p.trap ? C.red : C.blue;
  const ring = frame < p.countFrom ? 1 : left / p.seconds;
  const num = Math.max(1, Math.ceil(left));
  const pulse = counting ? 1 + 0.14 * Math.max(0, 1 - ((frame - p.countFrom) % fps) / 7) : 1;
  const stamp = spring({ frame: frame - p.revealAt, fps, config: { damping: 12, stiffness: 180 } });

  return (
    <AbsoluteFill>
      <Backdrop tint={urgent ? `rgba(215,0,21,${0.05 + 0.05 * Math.sin(frame / 2)})` : undefined} />
      <AbsoluteFill style={{ padding: "150px 80px 120px", opacity: inP, transform: `translateY(${(1 - inP) * 40}px)` }}>
        {/* progress + tag */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontFamily: UI, fontWeight: 600, fontSize: 44, color: accent, letterSpacing: 2 }}>{p.tag}</div>
          <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: 52, color: C.ink }}>{p.step}</div>
        </div>

        {/* countdown */}
        <div style={{ display: "flex", justifyContent: "center", marginTop: 40, height: 210 }}>
          {!revealed ? (
            <svg width={210} height={210} viewBox="0 0 210 210">
              <circle cx={105} cy={105} r={90} fill="none" stroke="rgba(29,29,31,0.10)" strokeWidth={16} />
              <circle cx={105} cy={105} r={90} fill="none" stroke={urgent ? C.red : accent} strokeWidth={16} strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 90} strokeDashoffset={2 * Math.PI * 90 * (1 - ring)} transform="rotate(-90 105 105)" />
              <text x={105} y={105} textAnchor="middle" dominantBaseline="central" fontFamily={DISPLAY} fontWeight={900}
                fontSize={96 * pulse} fill={urgent ? C.red : accent}>{frame < p.countFrom ? p.seconds : num}</text>
            </svg>
          ) : p.trap ? (
            <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: 104, color: C.red, transform: `scale(${0.6 + 0.4 * stamp})`, alignSelf: "center" }}>Vaqt tugadi!</div>
          ) : (
            <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: 120, color: C.green, transform: `scale(${0.6 + 0.4 * stamp})`, alignSelf: "center" }}>
              Javob: {LETTERS[p.right]}
            </div>
          )}
        </div>

        {/* question card */}
        <div style={{ marginTop: 40, background: C.white, borderRadius: 48, border: `4px solid ${p.trap ? C.red : C.edge}`, padding: "56px 56px" }}>
          <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 70, lineHeight: 1.18, color: C.ink, textAlign: "center", whiteSpace: "pre-line" }}>{p.question}</div>
        </div>

        {/* options */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28, marginTop: 36 }}>
          {p.options.map((o, i) => {
            const right = !p.trap && revealed && i === p.right;
            const struck = p.trap && revealed && i === p.trapPick;
            const dim = revealed && !right && !struck;
            const appear = spring({ frame: frame - 6 - i * 3, fps, config: { damping: 200 }, durationInFrames: 10 });
            return (
              <div key={i} style={{
                position: "relative", display: "flex", alignItems: "center", gap: 28, height: 168, padding: "0 40px", borderRadius: 40,
                background: right ? C.green : C.white, border: `4px solid ${struck ? C.red : right ? C.green : C.edge}`,
                opacity: appear * (dim ? 1 - 0.5 * k : 1), transform: `scale(${0.9 + 0.1 * appear})`,
              }}>
                <span style={{ fontFamily: UI, fontWeight: 600, fontSize: 48, color: right ? C.white : C.blue2 }}>{LETTERS[i]}</span>
                <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 80, color: right ? C.white : C.ink }}>{o}</span>
                {struck ? (
                  <div style={{ position: "absolute", left: 24, right: 24, top: "50%", height: 12, background: C.red, borderRadius: 6,
                    transform: `translateY(-50%) scaleX(${stamp})`, transformOrigin: "left" }} />
                ) : null}
              </div>
            );
          })}
        </div>

        {/* trap stamp: the obvious answer is wrong */}
        {p.trap && revealed ? (
          <div style={{ marginTop: 56, alignSelf: "center", fontFamily: DISPLAY, fontWeight: 900, fontSize: 92, color: C.white, background: C.red,
            padding: "22px 52px", borderRadius: 999, transform: `rotate(-4deg) scale(${stamp})` }}>
            {p.options[p.trapPick ?? 0]} EMAS!
          </div>
        ) : null}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
