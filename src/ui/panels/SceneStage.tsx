// src/ui/panels/SceneStage.tsx — the 3D doorway stage with shot toolbar (DP-UI §6.9).
// Requirement IDs: FR-19
import { Surface } from "../primitives/Surface.js";
import { Button } from "../primitives/Button.js";
import { useModel } from "../state/hooks.js";
import { useApp } from "../state/SessionProvider.js";
import { SceneHost } from "../scene/SceneHost.js";

export function SceneStage(): React.JSX.Element {
  const model = useModel();
  const { session } = useApp();
  const shot = model.ui.shotId;
  const selected = model.incidents.find((i) => i.id === model.ui.selectedIncidentId) ?? null;
  const open = model.incidents.filter((i) => i.status === "open");
  const focusTarget = selected ?? open[0] ?? null;
  const shoot = (shotName: "overview" | "walk" | "focus", incidentId?: string): void => {
    void session
      .call("set_camera_shot", incidentId !== undefined ? { shot: shotName, incidentId } : { shot: shotName }, { source: "human" })
      .catch(() => undefined);
  };
  return (
    <div data-slot="stage">
      <Surface well title="Doorway view" help="scene-3d" resultRegion="scene-3d">
        <div className="scene-stage">
          <div className="scene-toolbar" role="group" aria-label="Doorway view shots">
            <Button variant="ghost" data-shot="overview" aria-pressed={shot === "overview" ? "true" : "false"} onClick={() => shoot("overview")}>
              Overview
            </Button>
            <Button
              variant="ghost"
              data-shot="focus"
              aria-pressed={shot.startsWith("focus:") ? "true" : "false"}
              {...(focusTarget ? {} : { "aria-disabled": "true", title: "Open a moment first" } as Record<string, string>)}
              onClick={() => {
                if (focusTarget) shoot("focus", focusTarget.id);
              }}
            >
              Focus
            </Button>
            <Button variant="ghost" data-shot="walk" aria-pressed={shot === "walk" ? "true" : "false"} onClick={() => shoot("walk")}>
              Walk
            </Button>
          </div>
          <SceneHost />
        </div>
      </Surface>
    </div>
  );
}
