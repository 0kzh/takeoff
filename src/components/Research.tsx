import type { GameState } from '../engine/state.js';
import { researchCap } from '../engine/economy.js';
import { fmtInt } from '../engine/format.js';
import { useGame, perform } from '../store/gameStore.js';
import { Panel, Reveal, Meter, fill } from './primitives.js';

function fmtTrust(trust: number): string {
  return trust >= 0 ? fmtInt(trust) : `0 (${fmtInt(-trust)} owed)`;
}

const UNREVEALED = {
  trust: '2',
  nextTrust: '3,000',
  noTrust: false,
  expandTitle: '1 Trust: room for more research.',
  researchers: '1',
  labSpace: '1',
  research: '0',
  cap: '1,000',
  fill: 0,
  label: '',
  insight: '0',
  insightNote: '',
};

function researchView(s: GameState): typeof UNREVEALED {
  if (!s.revealed['research']) return UNREVEALED;
  const cap = researchCap(s);
  return {
    trust: fmtTrust(s.trust),
    nextTrust: fmtInt(s.nextTrust),
    noTrust: s.trust < 1,
    expandTitle: `1 Trust: room for ${fmtInt(1000 * s.labMult)} more research.`,
    researchers: fmtInt(s.researchers),
    labSpace: fmtInt(s.labSpace),
    research: fmtInt(Math.floor(s.research)),
    cap: fmtInt(cap),
    fill: fill(s.research / cap),
    label: `${fmtInt(Math.floor(s.research))} of ${fmtInt(cap)} the lab holds`,
    insight: s.insight >= 1 ? fmtInt(Math.floor(s.insight)) : 'none yet',
    insightNote: s.research >= cap ? '(accruing)' : '(accrues at capacity)',
  };
}

export function Research() {
  const v = useGame(researchView);
  return (
    <Panel name="research">
      <b>Research</b>
      <hr />
      Trust: <span id="trust">{v.trust}</span><br />
      Next Trust at <span id="nextTrust">{v.nextTrust}</span> tasks<br />
      <Reveal flag="hireResearcher"><button className="button2" id="btn-hireResearcher" title="1 Trust: one more researcher, +10 research per second." disabled={v.noTrust} onClick={() => perform('hireResearcher')}>Hire Researcher</button></Reveal>{' '}
      <Reveal flag="expandLab"><button className="button2" id="btn-expandLab" title={v.expandTitle} disabled={v.noTrust} onClick={() => perform('expandLab')}>Expand Lab</button></Reveal>{' '}
      <span className="note" id="trustCostNote">(costs Trust)</span><br />
      Researchers: <span id="researchers">{v.researchers}</span><br />
      <span className="hiddenIds">Lab Space: <span id="labSpace">{v.labSpace}</span><br /></span>
      <br />Research <Meter id="researchMeter" percent={v.fill} label={v.label} /> <span id="research">{v.research}</span> / <span id="researchCap">{v.cap}</span><br />
      <Reveal flag="insight">Insight: <span id="insight">{v.insight}</span> <span id="insightNote" className="note">{v.insightNote}</span><br /></Reveal>
    </Panel>
  );
}
