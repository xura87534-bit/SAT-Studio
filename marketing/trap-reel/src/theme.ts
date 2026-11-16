import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

// The app's own look: Washington blue on ballet white.
export const C = {
  bg: "#F2E7D8",
  bg2: "#FBF7F1",
  ink: "#1D1D1F",
  dim: "#6E6E73",
  blue: "#1D3F73",
  blue2: "#6A93CB",
  green: "#248A3D",
  red: "#D70015",
  white: "#FFFFFF",
  edge: "#E0D8CC",
};

export const DISPLAY = "InterDisplay";
export const UI = "InterUI";

export const fontsReady = Promise.all([
  loadFont({ family: DISPLAY, url: staticFile("InterDisplay-Black.otf"), weight: "900" }),
  loadFont({ family: DISPLAY, url: staticFile("InterDisplay-Bold.otf"), weight: "700" }),
  loadFont({ family: UI, url: staticFile("Inter-SemiBold.otf"), weight: "600" }),
]);

export const FPS = 30;

// Scene lengths in frames. The whole reel is the sum (600 = 20 s).
export const LEN = { hook: 66, q1: 114, q2: 114, trap: 156, lock: 60, cta: 90 };
export const TOTAL = Object.values(LEN).reduce((a, b) => a + b, 0);
