import { Composition, Folder } from "remotion";
import { TrapReel, Q1, Q3 } from "./TrapReel";
import { Hook } from "./scenes/Hook";
import { QuestionScene } from "./scenes/QuestionScene";
import { Lock } from "./scenes/Lock";
import { Cta } from "./scenes/Cta";
import { FPS, LEN, TOTAL, fontsReady } from "./theme";

const S = { width: 1080, height: 1920, fps: FPS };
void fontsReady;

export const RemotionRoot: React.FC = () => (
  <>
    <Folder name="TrapReel-Scenes">
      <Composition id="Hook" component={Hook} durationInFrames={LEN.hook} {...S} />
      <Composition id="Question" component={QuestionScene} durationInFrames={LEN.q1} defaultProps={Q1} {...S} />
      <Composition id="Trap" component={QuestionScene} durationInFrames={LEN.trap} defaultProps={Q3} {...S} />
      <Composition id="Lock" component={Lock} durationInFrames={LEN.lock} {...S} />
      <Composition id="Cta" component={Cta} durationInFrames={LEN.cta} {...S} />
    </Folder>
    <Composition id="TrapReel" component={TrapReel} durationInFrames={TOTAL} {...S} />
  </>
);
