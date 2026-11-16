import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Backdrop } from "./Backdrop";
import { C, DISPLAY, UI } from "../theme";

export const Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = spring({ frame, fps, config: { damping: 14, stiffness: 200 } });
  const b = spring({ frame: frame - 16, fps, config: { damping: 12, stiffness: 220 } });
  const line = interpolate(frame, [30, 44], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill>
      <Backdrop />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: "0 80px", gap: 30 }}>
        <div style={{ fontFamily: UI, fontWeight: 600, fontSize: 48, color: C.blue, letterSpacing: 4, opacity: a }}>SAT · MATH</div>
        <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: 160, lineHeight: 1, color: C.ink, textAlign: "center", whiteSpace: "nowrap", transform: `scale(${a})` }}>3 ta savol.</div>
        <div style={{ position: "relative", transform: `scale(${Math.max(0, b)})` }}>
          <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: 124, lineHeight: 1.05, color: C.red, textAlign: "center", whiteSpace: "nowrap" }}>Uchinchisi —<br />tuzoq.</div>
          <div style={{ position: "absolute", left: "8%", right: "8%", bottom: -18, height: 14, background: C.red, borderRadius: 7,
            transform: `scaleX(${line})`, transformOrigin: "left" }} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
