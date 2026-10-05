// Requirement IDs: HEE-KIT-01
import { EffectComposer, N8AO, SMAA, ToneMapping } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import type { LabTuning } from "./LabPanel.js";

export interface EffectsProps {
  diag: number;
  tuning?: Pick<LabTuning, "aoIntensity" | "aoRadius">;
}

export function Effects({ diag, tuning }: EffectsProps): React.JSX.Element {
  return (
    <EffectComposer>
      <N8AO aoRadius={tuning?.aoRadius ?? 0.04 * diag} intensity={tuning?.aoIntensity ?? 2} />
      <SMAA />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  );
}
