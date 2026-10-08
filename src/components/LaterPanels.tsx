import type { GameState } from '../engine/state.js';
import { fmtInt } from '../engine/format.js';
import { useGame } from '../store/gameStore.js';
import { Panel } from './primitives.js';

function laterView(s: GameState) {
  return {
    govRelations: fmtInt(s.govRelations),
    approval: fmtInt(s.approval),
    alignmentApparent: fmtInt(s.alignmentApparent),
    lead: fmtInt(s.lead),
    oversight: typeof s.flags['committeeChoice'] === 'string' ? s.flags['committeeChoice'] : 'not convened',
    treaty: s.flags['treatySigned'] ? 'signed' : 'not negotiating',
  };
}

export function LeftLaterPanels() {
  const v = useGame(laterView);
  return (
    <>
      <Panel name="government">
        <b>Government</b>
        <hr />
        Relations: <span id="govRelations">{v.govRelations}</span>
      </Panel>
      <Panel name="public">
        <b>Public</b>
        <hr />
        Approval: <span id="approval">{v.approval}</span><br />
        Jobs displaced: 0
      </Panel>
      <Panel name="robots">
        <b>Robots</b>
        <hr />
        Robots deployed: 0
      </Panel>
      <Panel name="society">
        <b>Society</b>
        <hr />
        Approval: <span id="societyApproval">{v.approval}</span><br />
        Jobs displaced: 0
      </Panel>
    </>
  );
}

export function MiddleLaterPanels() {
  const v = useGame(laterView);
  return (
    <>
      <Panel name="security">
        <b>Security</b>
        <hr />
        Security level: SL1
      </Panel>
      <Panel name="oversight">
        <b>Oversight</b>
        <hr />
        Committee decision: <span id="oversightStatus">{v.oversight}</span>
      </Panel>
      <Panel name="treaty">
        <b>Treaty</b>
        <hr />
        Status: <span id="treatyStatus">{v.treaty}</span>
      </Panel>
    </>
  );
}

export function RightLaterPanels() {
  const v = useGame(laterView);
  return (
    <>
      <Panel name="alignment">
        <b>Alignment</b>
        <hr />
        Apparent alignment: <span id="alignmentApparent">{v.alignmentApparent}</span><br />
        Interpretability: 0
      </Panel>
      <Panel name="geopolitics">
        <b>Geopolitics</b>
        <hr />
        Lead over Baiwen: <span id="lead">{v.lead}</span> months<br />
        Baiwen capability: 0.70×
      </Panel>
      <Panel name="monitors">
        <b>Monitors</b>
        <hr />
        Monitor coverage: 0%
      </Panel>
      <Panel name="space">
        <b>Space</b>
        <hr />
        Launch capacity: 0<br />
        Orbital compute: 0
      </Panel>
    </>
  );
}
