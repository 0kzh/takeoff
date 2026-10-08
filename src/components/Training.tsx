import { Fragment } from 'react';
import type { GameState, Focus } from '../engine/state.js';
import { inPrologue } from '../engine/state.js';
import {
  trainCost, canStartTraining, canRedTeam, canRelease, releaseProgress, nextRunName, trainGpuFigures, trainGpuFix,
  evaluatorLine, totalScore, trainingRun, evalRun, needsDatacenter, EVAL_SECONDS, BENCHMARKS,
} from '../engine/training.js';
import { fmtInt, fmtNum, fmtMoneyShort } from '../engine/format.js';
import { useGame, perform } from '../store/gameStore.js';
import { Panel, Reveal, cx, fill, width } from './primitives.js';

const FOCUSES: { focus: Focus; label: string; title: string; note: string }[] = [
  {
    focus: 'capability',
    label: 'Capability',
    title: 'Capability: the next model is 10–14% more capable. Customers notice.',
    note: 'The most capable next model (about +12%).',
  },
  {
    focus: 'efficiency',
    label: 'Efficiency',
    title: 'Efficiency: +5% capability, and 25% more copies on every GPU.',
    note: 'Copies per GPU ×1.25; a smaller capability gain.',
  },
  {
    focus: 'safety',
    label: 'Safety',
    title: 'Safety: +5% capability, 1.5 fewer issues now and 0.5 fewer on every later run.',
    note: 'Fewer issues, now and on every later run.',
  },
];
const CARDS = ['HumanBench', 'Tech press', 'Enterprise analyst', 'Safety Institute'];

function modelView(s: GameState) {
  if (!s.revealed['training']) return null;
  const t = s.training;
  const lead = s.capability / s.rivalCapability;
  const slot = evalRun(s);
  return {
    prologue: inPrologue(s),
    name: t.deployedName === t.modelName ? t.modelName : `${t.deployedName} (internal: ${t.modelName})`,
    capability: fmtNum(s.capability, 2),
    capabilityShown: s.capability > 1.0001 || s.stats.trainings > 0,
    rivalCap: fmtNum(s.rivalCapability, 2),
    standing: lead > 1.02 ? 'Ahead of Anthrosoft' : lead < 0.98 ? 'Anthrosoft is ahead' : 'Level with Anthrosoft',
    focus: t.focus,
    idle: !t.run,
    running: !!trainingRun(s),
    evaluating: !!slot && !slot.prologue,
    redteam: slot?.phase === 'redteam',
  };
}

function evalView(s: GameState) {
  const run = s.revealed['training'] ? evalRun(s) : null;
  if (!run) return null;
  const evalP = run.phase === 'evaluating' ? Math.min(1, run.evalElapsed / EVAL_SECONDS) : 1;
  const done = evalP >= 1;
  return {
    collapsed: run.phase === 'redteam',
    name: run.name,
    bench: BENCHMARKS.map((_, i) => {
      const v = (run.benchmarks[i] ?? 0) * evalP;
      return { fill: fill(v / 10), value: fmtNum(v, 1) };
    }),
    cards: run.scores.map((score, i) => {
      const revealed = evalP >= (i + 1) / (run.scores.length + 1);
      return { pending: !revealed, score: revealed ? `${score}/10` : '…', line: revealed ? evaluatorLine(run.id, i, score) : '' };
    }),
    score: done ? fmtInt(totalScore(run)) : '…',
    cap: done ? fmtNum(run.capAfter, 2) : '…',
    title: done ? `Reviewers' score: ${totalScore(run)}/40.` : '',
  };
}

function TrainEval({ shown }: { shown: boolean }) {
  const v = useGame(evalView);
  return (
    <div id="train-eval" className={cx(shown && 'shown', v?.collapsed && 'collapsed')}>
      <div id="evalHeader">Evaluating <span id="evalName">{v?.name}</span></div>
      <div id="benchmarks">
        {BENCHMARKS.map((label, i) => (
          <div key={label} className="bench" id={`bench-${i}`}>
            <span className="benchLabel">{label}</span>
            <span className="benchBar"><span className="benchFill" style={width(v?.bench[i]?.fill ?? 0)} /></span>
            <span className="benchValue">{v?.bench[i]?.value ?? '0.0'}</span>
          </div>
        ))}
      </div>
      <div id="cards">
        {CARDS.map((name, i) => {
          const card = v?.cards[i];
          return (
            <div key={name} className={cx('card', card?.pending && 'pending')} id={`card-${i}`}>
              <b className="cardName">{name}</b> <span className="cardScore">{card?.score}</span><br /><span className="cardLine">{card?.line}</span>
            </div>
          );
        })}
      </div>
      <div id="evalTotal" title={v?.title}>Capability <span id="evalCap">{v?.cap}</span>×<span className="hiddenIds"> · score <span id="evalScore">{v?.score}</span>/40</span></div>
    </div>
  );
}

function redteamView(s: GameState) {
  const run = s.revealed['training'] ? evalRun(s) : null;
  if (!run || run.phase !== 'redteam') return null;
  const t = s.training;
  const cooling = t.redTeamRemaining > 0 ? t.redTeamRemaining / t.redTeamDuration : 0;
  const rollout = releaseProgress(s);
  const releasing = rollout ? Math.max(0.01, rollout.p) : 0;
  return {
    prologue: !!run.prologue,
    found: fmtInt(run.issuesFound),
    open: fmtInt(run.issues),
    fixDisabled: !canRedTeam(s),
    fixCooling: cooling > 0,
    fixBar: fill(cooling),
    fixTitle: `Close one open issue every ${t.redTeamDuration} s.`,
    releaseDisabled: !canRelease(s),
    releaseCooling: releasing > 0,
    releaseBar: fill(releasing),
    releaseLabel: run.prologue ? `Deploy ${run.name}` : run.issues > 0 ? `Release (${run.issues} open)` : 'Release',
    releaseTitle: run.prologue
      ? `Deploy ${run.name}: each GPU runs a copy that completes tasks on its own, using power.`
      : run.issues > 0
        ? `${run.issues} open issue${run.issues === 1 ? '' : 's'} will ship with ${run.name}. Expect incidents.`
        : `Release ${run.name} to customers. Demand and hype go up; +1 Trust.`,
  };
}

function TrainRedteam({ shown }: { shown: boolean }) {
  const v = useGame(redteamView);
  return (
    <div id="train-redteam" className={cx(shown && 'shown')}>
      <span id="issuesLine" className={cx(v?.prologue && 'off')}>Open issues: <span id="issuesOpen">{v?.open ?? '0'}</span><span className="hiddenIds"> of <span id="issuesFound">{v?.found ?? '0'}</span></span><br /></span>{' '}
      <button className={cx('button2 cooldown', v?.fixCooling && 'cooling', v?.prologue && 'off')} id="btn-redteam" title={v?.fixTitle} disabled={v?.fixDisabled} onClick={() => perform('redTeam')}>
        <span className="cooldownBar" id="redteamBar" style={width(v?.fixBar ?? 0)} />
        <span className="cooldownLabel" id="redteamLabel">Fix issue</span>
      </button>{' '}
      <button className={cx('button2 cooldown', v?.releaseCooling && 'cooling')} id="btn-release" title={v?.releaseTitle} disabled={v?.releaseDisabled} onClick={() => perform('release')}>
        <span className="cooldownBar" id="releaseBar" style={width(v?.releaseBar ?? 0)} />
        <span className="cooldownLabel" id="releaseLabel">{v?.releaseLabel ?? 'Release'}</span>
      </button>
    </div>
  );
}

function idleView(s: GameState) {
  if (!s.revealed['training'] || s.training.run) return null;
  const cost = trainCost(s);
  const can = canStartTraining(s);
  const wall = needsDatacenter(s);
  const gpus = trainGpuFigures(s);
  const prices: [string, (n: number) => string, number, number][] = [
    ['funds', fmtMoneyShort, s.funds, cost.funds ?? 0],
    ['power', (n) => `${fmtInt(n)} kWh`, s.power, cost.power ?? 0],
    ['gpus', (n) => `${fmtInt(n)} GPUs`, gpus.have, gpus.need],
  ];
  const fix = wall ? '' : trainGpuFix(s);
  return {
    name: nextRunName(s),
    disabled: !can,
    title: can ? 'Start the run.' : wall ? 'Not yet: it needs the First Datacenter.' : 'Not yet: it needs its price and its GPUs.',
    wall,
    prices: prices.map(([key, fmt, have, need]) => {
      const shown = need > 0 && !wall;
      return { key, shown, text: shown ? fmt(need) : '', title: shown ? `${fmt(have)} of ${fmt(need)}` : '', fill: shown ? fill(have / need) : 0 };
    }),
    fix,
  };
}

const PRICE_KEYS = ['funds', 'power', 'gpus'];

function TrainIdle({ shown }: { shown: boolean }) {
  const v = useGame(idleView);
  return (
    <div id="train-idle" className={cx(shown && 'shown')}>
      <button className="button2" id="btn-train" title={v?.title ?? 'Train the next model. The GPUs it needs train it; the rest keep serving.'} disabled={v?.disabled} onClick={() => perform('startTraining')}>Train <span id="nextRunName">{v?.name}</span></button>
      <div id="trainCosts">
        <span className="note">Resources needed</span>
        {PRICE_KEYS.map((key, i) => {
          const price = v?.prices[i];
          return (
            <div key={key} className={cx('costRow', price?.shown && 'shown')} id={`costRow-${key}`} title={price?.title}>
              <div className="progress"><div className="progressFill" id={`costBar-${key}`} style={width(price?.fill ?? 0)} /></div>
              <span className="costText" id={`costText-${key}`}>{price?.text}</span>
            </div>
          );
        })}
        <div className={cx('costRow', v?.wall && 'shown')} id="costRow-datacenter" title="0 of 1 Datacenter">
          <div className="progress"><div className="progressFill" /></div>
          <span className="costText">1 Datacenter</span>
        </div>
      </div>
      <span id="trainGpuLine" className={cx(!!v?.fix && 'shown')}><span id="trainGpus">{v?.fix}</span><br /></span>
    </div>
  );
}

function runningView(s: GameState) {
  const run = s.revealed['training'] ? trainingRun(s) : null;
  if (!run) return null;
  const p = run.elapsed / run.duration;
  const left = Math.max(0, Math.ceil(run.duration - run.elapsed));
  return {
    name: run.name,
    focus: run.focus,
    pct: fmtInt(Math.floor(p * 100)),
    bar: fill(p),
    left,
    title: `Training on ${fmtInt(run.gpus ?? 0)} GPUs. They serve no customers until it is done.`,
  };
}

function TrainRunning({ shown }: { shown: boolean }) {
  const v = useGame(runningView);
  return (
    <div id="train-running" className={cx(shown && 'shown')}>
      Training <span id="runName">{v?.name}</span> (<span id="runFocus">{v?.focus}</span>)<span className="hiddenIds">: <span id="runPct">{v?.pct ?? '0'}</span>%</span>
      <div className="progress"><div className="progressFill" id="runBar" style={width(v?.bar ?? 0)} /></div>
      <span id="runLine" title={v?.title}>{v ? `${v.left} s remaining` : ''}</span><span className="hiddenIds"> <span id="runRemaining">{v ? `${v.left} s` : ''}</span></span>
    </div>
  );
}

export function Training() {
  const v = useGame(modelView);
  return (
    <Panel name="training">
      <b>Training</b>
      <hr />
      <div id="modelLines" className={cx(v?.prologue && 'off')}>
        Current model: <span id="modelName">{v?.name ?? 'Sage-1'}</span><span id="capabilityPart" className={cx(v?.capabilityShown && 'shown')}> · <span id="capability">{v?.capability ?? '1.00'}</span>×</span><br />
        <Reveal flag="rival"><span id="rivalLine" title={`Anthrosoft's latest Cadence model: ${v?.rivalCap ?? '1.00'}×.`}><span id="rivalStanding">{v?.standing ?? 'Level with Anthrosoft'}</span><span className="hiddenIds"> (<span id="rivalCap">{v?.rivalCap ?? '1.00'}</span>×)</span></span><br /></Reveal>
      </div>
      <Reveal as="div" flag="focus" id="focusRow">
        Focus:
        {FOCUSES.map(({ focus, label, title }) => (
          <Fragment key={focus}>
            {' '}
            <button className={cx('button2 focusButton', v?.focus === focus && 'selected')} id={`btn-focus-${focus}`} data-focus={focus} title={title} onClick={() => perform('setFocus', focus)}>{label}</button>
          </Fragment>
        ))}
        <div id="focusNote" className="note">{FOCUSES.find((f) => f.focus === v?.focus)?.note}</div>
      </Reveal>
      <TrainEval shown={!!v?.evaluating} />
      <TrainRedteam shown={!!v?.redteam} />
      <TrainIdle shown={!!v?.idle} />
      <TrainRunning shown={!!v?.running} />
    </Panel>
  );
}
