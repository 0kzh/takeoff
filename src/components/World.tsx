import { useGame } from '../store/context.js';
import { Panel, Meter, Reveal } from './primitives.js';
import { fmtNum } from '../engine/format.js';
import { jobsMitigated } from '../engine/world.js';

export function Public() {
  const s = useGame();
  const low = s.approval < 30;
  return (
    <Panel name="public" title="Public">
      Approval{' '}
      <Meter id="approvalMeter" fraction={s.approval / 100} label={`${fmtNum(s.approval, 0)}% approve of OpenMind`} warn={low} />{' '}
      <span id="approval">{fmtNum(s.approval, 0)}</span>%
      <span id="approvalWarn" className={low ? 'shown warn' : ''}>
        {' '}calls to shut OpenMind down
      </span>
      <br />
      <Reveal flag="jobs">
        Jobs displaced: <span id="jobsDisplaced">{fmtNum(s.jobsDisplaced, 1)}M</span>{' '}
        <span className="note">{jobsMitigated(s) ? '(covered: approval falls slowly)' : '(approval falls while unaddressed)'}</span>
        <br />
      </Reveal>
    </Panel>
  );
}

export function Government() {
  const s = useGame();
  return (
    <Panel name="government" title="Government">
      Relations{' '}
      <Meter id="relationsMeter" fraction={s.govRelations / 100} label={`${fmtNum(s.govRelations, 0)} of 100`} />{' '}
      <span id="govRelations">{fmtNum(s.govRelations, 0)}</span>
      <br />
      <span className="note">
        {s.govRelations >= 60 ? 'Washington returns calls.' : s.govRelations >= 45 ? 'Washington is polite.' : 'Washington is drafting something.'}
      </span>
    </Panel>
  );
}
