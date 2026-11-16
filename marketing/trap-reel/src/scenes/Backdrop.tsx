import { AbsoluteFill } from "remotion";
import { C } from "../theme";

export const Backdrop: React.FC<{ tint?: string }> = ({ tint }) => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(120% 70% at 50% 35%, ${C.bg2} 0%, ${C.bg} 70%)`,
    }}
  >
    {tint ? <AbsoluteFill style={{ background: tint }} /> : null}
  </AbsoluteFill>
);
