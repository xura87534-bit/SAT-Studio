import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Backdrop } from "./Backdrop";
import { C, DISPLAY, UI } from "../theme";

export const Cta: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = spring({ frame, fps, config: { damping: 13, stiffness: 200 } });
  const b = spring({ frame: frame - 10, fps, config: { damping: 200 }, durationInFrames: 12 });
  const c = spring({ frame: frame - 20, fps, config: { damping: 12, stiffness: 200 } });
  const bob = Math.sin(frame / 4) * 14;
  const glow = 0.5 + 0.5 * Math.sin(frame / 5);
  const fade = interpolate(frame, [32, 44], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill>
      <Backdrop />
      <AbsoluteFill style={{ alignItems: "center", padding: "150px 80px 120px", gap: 36 }}>
        {/* arrow toward the profile link at the top of the screen */}
        <svg width={150} height={150} viewBox="0 0 24 24" style={{ transform: `translateY(${bob}px)`, opacity: b }}>
          <path d="M12 3 L5 11 h4.5 v10 h5 V11 H19 Z" fill={C.blue} />
        </svg>
        <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: 132, lineHeight: 1.02, color: C.ink, textAlign: "center", transform: `scale(${a})` }}>
          Javob<br />ilovada
        </div>
        <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: 96, color: C.white, background: C.blue, padding: "26px 70px", borderRadius: 999,
          transform: `scale(${c})`, boxShadow: `0 0 ${40 + 40 * glow}px rgba(29,63,115,${0.35 + 0.3 * glow})` }}>Link bioda</div>
        <div style={{ fontFamily: UI, fontWeight: 600, fontSize: 50, lineHeight: 1.35, color: C.ink, textAlign: "center", opacity: fade, marginTop: 10 }}>
          Reeldagi 3 ta savol + 7 ta yangi
        </div>
        <div style={{ fontFamily: UI, fontWeight: 600, fontSize: 46, color: C.blue, opacity: fade }}>O‘zbek tilida · Bepul · 2 daqiqa</div>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 22, opacity: fade }}>
          <Img src={staticFile("logo.png")} style={{ width: 92, height: 92, borderRadius: 22 }} />
          <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: 64, color: C.ink }}>SAT Studio</div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
