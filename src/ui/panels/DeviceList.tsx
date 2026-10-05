// src/ui/panels/DeviceList.tsx — doorbell and hall camera rows (DP-UI §6.9).
// Requirement IDs: FR-19
import { CircleCheck, OctagonX } from "lucide-react";
import { deviceOutages } from "src/domain/derive.js";
import { Surface } from "../primitives/Surface.js";
import { useModel } from "../state/hooks.js";

function kindLabel(kind: string): string {
  if (kind === "doorbell") return "Doorbell";
  if (kind === "elite_camera") return "Elite camera";
  return kind !== "" ? kind : "Camera";
}

export function DeviceList(): React.JSX.Element {
  const model = useModel();
  const outages = deviceOutages(model);
  return (
    <Surface eyebrow="Devices">
      <ul className="device-list">
        {model.devices.map((d) => {
          const offlineMin = Math.round(
            outages.filter((o) => o.deviceId === d.id).reduce((acc, o) => acc + (o.toMs - o.fromMs), 0) / 60000,
          );
          const cameras = Array.isArray(d.componentIds) ? d.componentIds.length : 0;
          const support = d.kind === "elite_camera" && cameras > 1 ? `${cameras} cameras` : kindLabel(d.kind);
          return (
            <li key={d.id} className={d.online ? "device-row" : "device-row device-row--offline"}>
              <span className="chip" data-tone={d.online ? "success" : "danger"}>
                {d.online ? <CircleCheck aria-hidden="true" /> : <OctagonX aria-hidden="true" />}
                {d.online ? "Online" : "Offline"}
              </span>
              <span className="device-row__body">
                <span className="subject">{d.description !== "" ? d.description : d.id}</span>
                <span className="support">{support}</span>
                {offlineMin > 0 ? <span className="support">{offlineMin} min offline</span> : null}
              </span>
            </li>
          );
        })}
      </ul>
    </Surface>
  );
}
