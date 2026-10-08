import { Fragment } from 'react';
import { useGame, usePerform } from '../store/context.js';
import { Panel, Reveal, Progress, fractionPercent } from './primitives.js';
import { inPrologue, type Focus, type TrainingRun } from '../engine/state.js';
import {
  trainCost,
  canStartTraining,
  canRedTeam,
  canRelease,
  releaseProgress,
  nextRunName,
  trainGpuFigures,
  trainGpuFix,
  evaluatorLine,
  totalScore,
  trainingRun,
  evalRun,
  EVAL_SECONDS,
  BENCHMARKS,
  needsDatacenter,
  pipelineRun,
  pipelineOpen,
  trainSlotFree,
  riskTier,
  knowsTested,
  honestyProbe,
  startCapability,
  S2_FOCUS_BASE,
} from '../engine/training.js';
import { effectiveData, dataRequired } from '../engine/data.js';
import { fmtInt, fmtNum, fmtMoneyShort } from '../engine/format.js';

const FOCUSES: { id: Focus; label: string; title: string; note: string }[] = [
  {
    id: 'capability',
    label: 'Capability',
    title: 'Capability: the next model is 10–14% more capable. Customers notice.',
    note: 'The most capable next model (about +12%).',
  },
  {
    id: 'efficiency',
    label: 'Efficiency',
    title: 'Efficiency: +5% capability, and 25% more copies on every GPU.',
    note: 'Copies per GPU ×1.25; a smaller capability gain.',
  },
  {
    id: 'safety',
    label: 'Safety',
    title: 'Safety: +5% capability, 1.5 fewer issues now and 0.5 fewer on every later run.',
    note: 'Fewer issues, now and on every later run.',
  },
];
const REVIEWERS = ['HumanBench', 'Tech press', 'Enterprise analyst', 'Safety Institute'];
export function Training() {
  const s = useGame();
  const perform = usePerform();
  const t = s.training;
  const running = trainingRun(s);
  const evaluating = evalRun(s);
  const lead = s.capability / s.rivalCapability;
  const focusNote = (id: Focus): string => {
    if (s.stage < 2) return FOCUSES.find((f) => f.id === id)?.note ?? '';
    if (id === 'capability')
      return `The most capable next model (about +${Math.round(100 * (S2_FOCUS_BASE.capability + 0.03))}%).`;
    if (id === 'efficiency')
      return `Copies per GPU ×1.25; about +${Math.round(100 * S2_FOCUS_BASE.efficiency)}% capability.`;
    return `About +${Math.round(100 * S2_FOCUS_BASE.safety)}%; fewer issues; alignment drifts less and the band narrows.`;
  };
  return (
    <Panel name="training" title="Training">
      <div id="modelLines" className={inPrologue(s) ? 'off' : ''}>
        Current model:{' '}
        <span id="modelName">
          {t.deployedName === t.modelName ? t.modelName : `${t.deployedName} (internal: ${t.modelName})`}
        </span>
        <span id="capabilityPart" className={s.capability > 1.0001 || s.stats.trainings > 0 ? 'shown' : ''}>
          {' '}
          · <span id="capability">{fmtNum(s.capability, 2)}</span>×
        </span>
        <br />
        <Reveal flag="rival">
          <span id="rivalLine" title={`Anthrosoft's latest Cadence model: ${fmtNum(s.rivalCapability, 2)}×.`}>
            <span id="rivalStanding">
              {lead > 1.02
                ? 'Ahead of Anthrosoft'
                : lead < 0.98
                  ? 'Anthrosoft is ahead'
                  : 'Level with Anthrosoft'}
            </span>
            <span className="hiddenIds">
              {' '}
              (<span id="rivalCap">{fmtNum(s.rivalCapability, 2)}</span>×)
            </span>
          </span>
          <br />
        </Reveal>
      </div>
      <div id="focusRow" data-reveal="focus" className={s.revealed['focus'] ? 'shown' : ''}>
        Focus:{' '}
        {FOCUSES.map((focus) => (
          <Fragment key={focus.id}>
            <button
              className={`button2 focusButton${t.focus === focus.id ? ' selected' : ''}`}
              id={`btn-focus-${focus.id}`}
              data-focus={focus.id}
              title={focus.title}
              aria-pressed={t.focus === focus.id}
              onClick={() => perform('setFocus', focus.id)}
            >
              {focus.label}
            </button>{' '}
          </Fragment>
        ))}
        <div id="focusNote" className="note">
          {focusNote(t.focus)}
        </div>
      </div>
      <Evaluation run={evaluating} />
      <RedTeam run={evaluating} />
      <IdleTraining />
      <QueuedTraining />
      <div id="train-running" className={running ? 'shown' : ''}>
        Training <span id="runName">{running?.name}</span> (<span id="runFocus">{running?.focus}</span>)
        <span className="hiddenIds">
          :{' '}
          <span id="runPct">
            {running ? fmtInt(Math.floor((running.elapsed / running.duration) * 100)) : 0}
          </span>
          %
        </span>
        <Progress id="runBar" fraction={running ? running.elapsed / running.duration : 0} />
        <span
          id="runLine"
          title={`Training on ${fmtInt(running?.gpus ?? 0)} GPUs. The copies keep serving customers meanwhile.`}
        >
          {running ? Math.max(0, Math.ceil(running.duration - running.elapsed)) : 0} s remaining
        </span>
        <span className="hiddenIds">
          {' '}
          <span id="runRemaining">
            {running ? Math.max(0, Math.ceil(running.duration - running.elapsed)) : 0} s
          </span>
        </span>
      </div>
    </Panel>
  );
}
function QueuedTraining() {
  const s = useGame();
  const queued = pipelineRun(s);
  const training = queued?.phase === 'training';
  return (
    <div id="train-queued" className={queued ? 'shown' : ''}>
      {training ? (
        <>
          Also training <span id="queuedName">{queued?.name}</span> ({queued?.focus})
          <Progress id="queuedBar" fraction={queued ? queued.elapsed / queued.duration : 0} />
          <span className="note">
            {queued ? Math.max(0, Math.ceil(queued.duration - queued.elapsed)) : 0} s remaining · it waits for
            the model above to ship
          </span>
        </>
      ) : (
        <span className="note">
          <span id="queuedName">{queued?.name}</span> is trained and waiting for the model above to ship.
        </span>
      )}
    </div>
  );
}
function trainShortfall(s: ReturnType<typeof useGame>): string {
  const parts: string[] = [];
  const cost = trainCost(s);
  if ((cost.funds ?? 0) > s.funds) parts.push(`${fmtMoneyShort((cost.funds ?? 0) - s.funds)} more`);
  const g = trainGpuFigures(s);
  if (g.need > g.have) parts.push(`${fmtInt(g.need - g.have)} more idle GPUs`);
  if (!trainSlotFree(s)) parts.push('the current model has to ship first');
  return parts.length ? `it needs ${parts.join(' and ')}` : 'it is not ready';
}
function IdleTraining() {
  const s = useGame();
  const perform = usePerform();
  const cost = trainCost(s);
  const gpus = trainGpuFigures(s);
  const wall = needsDatacenter(s);
  const fix = wall ? '' : trainGpuFix(s);
  const dataNeed = s.stage >= 2 ? dataRequired(startCapability(s)) : 0;
  const rows: [string, (n: number) => string, number, number][] = [
    ['funds', fmtMoneyShort, s.funds, cost.funds ?? 0],
    ['power', (n) => `${fmtInt(n)} kWh`, s.power, cost.power ?? 0],
    ['gpus', (n) => `${fmtInt(n)} GPU${n === 1 ? '' : 's'}`, gpus.have, gpus.need],
    ['data', (n) => `${fmtNum(n, 1)}T data`, effectiveData(s), dataNeed],
  ];
  const slotFree = trainSlotFree(s);
  const queuedNote = s.stage >= 2 && s.training.run && pipelineOpen(s) && !s.training.next;
  return (
    <div id="train-idle" className={slotFree ? 'shown' : ''}>
      {queuedNote ? (
        <div className="note" id="pipelineNote">
          The pipeline is free: the next run can start now.
        </div>
      ) : null}
      <button
        className="button2"
        id="btn-train"
        disabled={!canStartTraining(s)}
        title={
          canStartTraining(s)
            ? 'Start the run.'
            : wall
              ? 'Not yet: it needs the First Datacenter.'
              : s.stage >= 2
                ? `Not yet: ${trainShortfall(s)}.`
                : 'Not yet: it needs its price and its GPUs.'
        }
        onClick={() => perform('startTraining')}
      >
        Train <span id="nextRunName">{nextRunName(s)}</span>
      </button>
      <div id="trainCosts">
        <span className="note">Resources needed</span>
        {rows.map(([key, fmt, have, need]) => (
          <div
            key={key}
            className={`costRow${need > 0 && !wall ? ' shown' : ''}${key === 'data' && have < need ? ' short' : ''}`}
            id={`costRow-${key}`}
            title={
              key === 'data'
                ? `${fmt(have)} of ${fmt(need)}. Data is not spent; a shortfall shrinks the gain.`
                : `${fmt(have)} of ${fmt(need)}`
            }
          >
            <Progress id={`costBar-${key}`} fraction={have / need} />
            <span className="costText" id={`costText-${key}`}>
              {fmt(need)}
            </span>
          </div>
        ))}
        <div className={`costRow${wall ? ' shown' : ''}`} id="costRow-datacenter" title="0 of 1 Datacenter">
          <Progress fraction={0} />
          <span className="costText">1 Datacenter</span>
        </div>
      </div>
      <span id="trainGpuLine" className={fix ? 'shown' : ''}>
        <span id="trainGpus">{fix}</span>
        <br />
      </span>
    </div>
  );
}
function RiskRows({ run, p }: { run: TrainingRun; p: number }) {
  const s = useGame();
  if (s.stage < 2 || p < 1) return null;
  const tested = knowsTested(s, run);
  return (
    <div id="evalRisk" className="note">
      <span id="riskBio" className={s.revealed['dangerEvals'] ? 'shown' : ''}>
        Bio uplift: <b>{riskTier(run.benchmarks[4] ?? 0)}</b> · Cyber range:{' '}
        <b>{riskTier(run.benchmarks[5] ?? 0)}</b>
        <br />
      </span>
      <span id="riskHonesty" className={s.revealed['alignment'] ? 'shown' : ''}>
        Honesty probe: {honestyProbe(s)}%{tested !== null ? ` · Knows it's tested: ${tested}%` : ''}
        <br />
      </span>
      <span id="riskTested" className={tested !== null && !s.revealed['alignment'] ? 'shown' : ''}>
        Knows it's tested: {tested ?? 0}%
        <br />
      </span>
    </div>
  );
}
function Evaluation({ run }: { run: TrainingRun | null | undefined }) {
  const p = run ? (run.phase === 'evaluating' ? Math.min(1, run.evalElapsed / EVAL_SECONDS) : 1) : 0;
  return (
    <div
      id="train-eval"
      className={`${run && !run.prologue ? 'shown' : ''}${run?.phase === 'redteam' ? ' collapsed' : ''}`}
    >
      <div id="evalHeader">
        Evaluating <span id="evalName">{run?.name}</span>
      </div>
      <div id="benchmarks">
        {BENCHMARKS.map((label, i) => {
          const value = (run?.benchmarks[i] ?? 0) * p;
          return (
            <div className="bench" id={`bench-${i}`} key={label}>
              <span className="benchLabel">{label}</span>
              <span className="benchBar">
                <span className="benchFill" style={{ width: fractionPercent(value / 10) }} />
              </span>
              <span className="benchValue">{fmtNum(value, 1)}</span>
            </div>
          );
        })}
      </div>
      <div id="cards">
        {REVIEWERS.map((name, i) => {
          const score = run?.scores[i] ?? 0;
          const revealed = !!run && p >= (i + 1) / (run.scores.length + 1);
          return (
            <div className={`card${revealed ? '' : ' pending'}`} id={`card-${i}`} key={name}>
              <b className="cardName">{name}</b>{' '}
              <span className="cardScore">{revealed ? `${score}/10` : '…'}</span>
              <br />
              <span className="cardLine">{revealed ? evaluatorLine(run.id, i, score) : ''}</span>
            </div>
          );
        })}
      </div>
      {run ? <RiskRows run={run} p={p} /> : null}
      <div id="evalTotal" title={run && p >= 1 ? `Reviewers' score: ${totalScore(run)}/40.` : ''}>
        Capability <span id="evalCap">{run && p >= 1 ? fmtNum(run.capAfter, 2) : '…'}</span>×
        <span className="hiddenIds">
          {' '}
          · score <span id="evalScore">{run && p >= 1 ? fmtInt(totalScore(run)) : '…'}</span>/40
        </span>
      </div>
    </div>
  );
}
function RedTeam({ run }: { run: TrainingRun | null | undefined }) {
  const s = useGame();
  const perform = usePerform();
  const cooling =
    s.training.redTeamRemaining > 0 ? s.training.redTeamRemaining / s.training.redTeamDuration : 0;
  const rollout = releaseProgress(s);
  const progress = rollout ? Math.max(0.01, rollout.p) : 0;
  return (
    <div id="train-redteam" className={run?.phase === 'redteam' ? 'shown' : ''}>
      <span id="issuesLine" className={run?.prologue ? 'off' : ''}>
        Open issues: <span id="issuesOpen">{fmtInt(run?.issues ?? 0)}</span>
        <span className="hiddenIds">
          {' '}
          of <span id="issuesFound">{fmtInt(run?.issuesFound ?? 0)}</span>
        </span>
        <br />
      </span>
      <button
        className={`button2 cooldown${run?.prologue ? ' off' : ''}${cooling > 0 ? ' cooling' : ''}`}
        id="btn-redteam"
        disabled={!canRedTeam(s)}
        title={`Close one open issue every ${s.training.redTeamDuration} s.`}
        onClick={() => perform('redTeam')}
      >
        <span className="cooldownBar" id="redteamBar" style={{ width: fractionPercent(cooling) }} />
        <span className="cooldownLabel" id="redteamLabel">
          Fix issue
        </span>
      </button>{' '}
      <button
        className={`button2 cooldown${progress > 0 ? ' cooling' : ''}`}
        id="btn-release"
        disabled={!canRelease(s)}
        title={
          run?.prologue
            ? `Deploy ${run.name}: each GPU runs a copy that completes tasks on its own, using power.`
            : run && run.issues > 0
              ? `${run.issues} open issue${run.issues === 1 ? '' : 's'} will ship with ${run.name}. Expect incidents.`
              : `Release ${run?.name ?? ''} to customers. Demand and hype go up; +1 Trust.`
        }
        onClick={() => perform('release')}
      >
        <span className="cooldownBar" id="releaseBar" style={{ width: fractionPercent(progress) }} />
        <span className="cooldownLabel" id="releaseLabel">
          {run?.prologue
            ? `Deploy ${run.name}`
            : run && run.issues > 0
              ? `Release (${run.issues} open)`
              : 'Release'}
        </span>
      </button>
    </div>
  );
}
