import { AbsoluteFill, Sequence, staticFile } from "remotion";
import { Audio } from "@remotion/media";
import { Hook } from "./scenes/Hook";
import { QuestionScene } from "./scenes/QuestionScene";
import { Lock } from "./scenes/Lock";
import { Cta } from "./scenes/Cta";
import { LEN } from "./theme";

/* Story: 3 questions, the third is a trap. The first two are answered on screen (the viewer feels smart),
   the third shows the time running out, strikes through the answer most people give (+5%),
   then locks the real answer and sends the viewer to the app, where it is waiting. */
export const Q1 = { step: "1/3", tag: "OSON", question: "3x + 7 = 22\nx = ?", options: ["3", "5", "7", "15"], right: 1, countFrom: 16, seconds: 3, revealAt: 106 };
export const Q2 = { step: "2/3", tag: "O‘RTA", question: "Uchburchak burchaklari\n2 : 3 : 4 nisbatda.\nEng kattasi = ?", options: ["60°", "80°", "90°", "100°"], right: 1, countFrom: 16, seconds: 3, revealAt: 106 };
export const Q3 = { step: "3/3", tag: "TUZOQ", trap: true, question: "Narx 25% oshdi,\nkeyin 20% tushdi.\nJami o‘zgarish = ?", options: ["+5%", "−5%", "0%", "+45%"], right: 2, trapPick: 0, countFrom: 16, seconds: 4, revealAt: 136 };

export const TrapReel: React.FC = () => {
  let at = 0;
  const seq = (len: number) => { const from = at; at += len; return { from, durationInFrames: len }; };
  return (
    <AbsoluteFill>
      <Sequence name="Hook" {...seq(LEN.hook)}><Hook /></Sequence>
      <Sequence name="Question 1" {...seq(LEN.q1)}><QuestionScene {...Q1} /></Sequence>
      <Sequence name="Question 2" {...seq(LEN.q2)}><QuestionScene {...Q2} /></Sequence>
      <Sequence name="Trap question" {...seq(LEN.trap)}><QuestionScene {...Q3} /></Sequence>
      <Sequence name="Answer locked" {...seq(LEN.lock)}><Lock /></Sequence>
      <Sequence name="Call to action" {...seq(LEN.cta)}><Cta /></Sequence>
      <Audio src={staticFile("track.wav")} />
    </AbsoluteFill>
  );
};
