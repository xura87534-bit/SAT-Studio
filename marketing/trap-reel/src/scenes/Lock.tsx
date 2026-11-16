import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Backdrop } from "./Backdrop";
import { C, DISPLAY } from "../theme";

// The answer is held back: three blurred options and a lock.
export const Lock: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = spring({ frame, fps, config: { damping: 14 } });
  const b = spring({ frame: frame - 14, fps, config: { damping: 12, stiffness: 200 } });
  const shake = frame > 30 && frame < 42 ? Math.sin(frame * 2.4) * 10 : 0;
  return (
    <AbsoluteFill>
      <Backdrop />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", gap: 60, padding: "0 80px" }}>
        <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: 130, lineHeight: 1.05, color: C.ink, textAlign: "center", transform: `scale(${a})` }}>Unda to‘g‘ri<br />javob qaysi?</div>
        <div style={{ position: "relative", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 28, width: "100%" }}>
          {["−5%", "0%", "+45%"].map((o) => (
            <div key={o} style={{ height: 190, borderRadius: 40, background: C.white, border: `4px solid ${C.edge}`, display: "flex",
              alignItems: "center", justifyContent: "center", fontFamily: DISPLAY, fontWeight: 900, fontSize: 84, color: C.ink, filter: "blur(22px)" }}>{o}</div>
          ))}
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
            transform: `translateX(${shake}px) scale(${b})` }}>
            <svg width={200} height={220} viewBox="0 0 100 110">
              <rect x={14} y={46} width={72} height={58} rx={12} fill={C.blue} />
              <path d="M30 46 V32 a20 20 0 0 1 40 0 V46" fill="none" stroke={C.blue} strokeWidth={11} />
              <circle cx={50} cy={72} r={8} fill={C.white} />
              <rect x={46.5} y={72} width={7} height={18} rx={3} fill={C.white} />
            </svg>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
