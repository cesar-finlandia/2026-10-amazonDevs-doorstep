// src/ui/pages/Home.tsx — the full product route (DP-UI §5.7; agent panels and stage land in WU-08/WU-12).
// Requirement IDs: FR-19
import { Rail } from "../shell/Rail.js";
import { BaselineStrip } from "../week/BaselineStrip.js";
import { WeekRibbon } from "../week/WeekRibbon.js";
import { WeekTitle } from "../panels/WeekTitle.js";
import { WeekSummary } from "../panels/WeekSummary.js";
import { CheckPanel } from "../panels/CheckPanel.js";
import { IncidentCard } from "../panels/IncidentCard.js";
import { NudgeCard } from "../panels/NudgeCard.js";
import { AgentPanel } from "../panels/AgentPanel.js";
import { ApprovalPanel } from "../panels/ApprovalPanel.js";
import { ActivityFeedPanel } from "../panels/ActivityFeedPanel.js";
import { ManualRunnerPanel } from "../panels/ManualRunnerPanel.js";
import { LiveViewPanel } from "../panels/LiveViewPanel.js";
import { SceneStage } from "../panels/SceneStage.js";

export default function HomePage(): React.JSX.Element {
  return (
    <div className="page">
      <div data-slot="rail">
        <Rail />
      </div>
      <div className="main" data-slot="center">
        <div data-slot="title">
          <WeekTitle />
        </div>
        <div data-slot="summary">
          <WeekSummary />
        </div>
        <SceneStage />
        <div data-slot="ribbon">
          <WeekRibbon />
          <BaselineStrip />
        </div>
        <LiveViewPanel />
      </div>
      <div className="workbench" data-slot="workbench" data-demo-focus="workbench">
        <AgentPanel />
        <ApprovalPanel />
        <div data-slot="check">
          <CheckPanel />
        </div>
        <div data-slot="incident">
          <IncidentCard />
        </div>
        <div data-slot="nudge">
          <NudgeCard />
        </div>
        <ActivityFeedPanel />
        <ManualRunnerPanel />
      </div>
    </div>
  );
}
