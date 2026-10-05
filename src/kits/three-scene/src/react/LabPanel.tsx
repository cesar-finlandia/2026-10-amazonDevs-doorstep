// Requirement IDs: HEE-KIT-01
import { useEffect, useState } from "react";
import { folder, useControls } from "leva";

export interface LabTuning {
  keyIntensity: number;
  keyAzimuth: number;
  keyElevation: number;
  hemisphere: number;
  roughness: number;
  metalness: number;
  fov: number;
  aoIntensity: number;
  aoRadius: number;
}

export const DEFAULT_LAB_TUNING: LabTuning = {
  keyIntensity: 2.2,
  keyAzimuth: 35,
  keyElevation: 50,
  hemisphere: 0.35,
  roughness: 0.6,
  metalness: 0.05,
  fov: 45,
  aoIntensity: 2,
  aoRadius: 0.05,
};

export function LabPanel({ onChange }: { onChange?: (values: LabTuning) => void }): React.JSX.Element {
  const values = useControls({
    Light: folder({
      keyIntensity: { value: DEFAULT_LAB_TUNING.keyIntensity, min: 0, max: 6 },
      keyAzimuth: { value: DEFAULT_LAB_TUNING.keyAzimuth, min: 0, max: 360 },
      keyElevation: { value: DEFAULT_LAB_TUNING.keyElevation, min: 5, max: 85 },
      hemisphere: { value: DEFAULT_LAB_TUNING.hemisphere, min: 0, max: 1 },
    }),
    Material: folder({
      roughness: { value: DEFAULT_LAB_TUNING.roughness, min: 0, max: 1 },
      metalness: { value: DEFAULT_LAB_TUNING.metalness, min: 0, max: 1 },
    }),
    Camera: folder({
      fov: { value: DEFAULT_LAB_TUNING.fov, min: 20, max: 80 },
    }),
    Effects: folder({
      aoIntensity: { value: DEFAULT_LAB_TUNING.aoIntensity, min: 0, max: 6 },
      aoRadius: { value: DEFAULT_LAB_TUNING.aoRadius, min: 0.005, max: 0.2 },
    }),
  });

  const [flat, setFlat] = useState<LabTuning>(DEFAULT_LAB_TUNING);
  useEffect(() => {
    const next: LabTuning = {
      keyIntensity: Number(values.keyIntensity),
      keyAzimuth: Number(values.keyAzimuth),
      keyElevation: Number(values.keyElevation),
      hemisphere: Number(values.hemisphere),
      roughness: Number(values.roughness),
      metalness: Number(values.metalness),
      fov: Number(values.fov),
      aoIntensity: Number(values.aoIntensity),
      aoRadius: Number(values.aoRadius),
    };
    setFlat(next);
    onChange?.(next);
  }, [values, onChange]);

  const copyValues = async (): Promise<void> => {
    const json = JSON.stringify(flat, null, 2);
    try {
      await navigator.clipboard.writeText(json);
    } catch {
      /* clipboard can be unavailable; the console still carries the values */
    }
    console.info(`[three-scene] lab values:\n${json}`);
  };

  return (
    <div style={{ position: "absolute", right: 8, bottom: 8, zIndex: 10 }}>
      <button type="button" onClick={() => void copyValues()}>
        Copy values
      </button>
    </div>
  );
}
