import { useGame } from '../store/context.js';
import { Panel } from './primitives.js';
import { dateLabel, fmtNum } from '../engine/format.js';
import { topRival, leadMonths } from '../engine/rivals.js';

// Capability over time on a log scale, AI-2027 style: our line, Anthrosoft's,
// Baiwen's once it exists, and the tier lines the race is climbing toward.
export const TIERS: { at: number; label: string }[] = [
  { at: 1, label: '2025 frontier: an intern that never sleeps' },
  { at: 2, label: 'average professional' },
  { at: 4, label: 'expert' },
  { at: 10, label: 'best human coder (SC)' },
  { at: 50, label: 'best human researcher (SAR)' },
  { at: 250, label: 'beyond Einstein (SIAR)' },
  { at: 2000, label: 'all of humanity (ASI)' },
];

const W = 300;
const H = 150;
const LEFT = 34;
const RIGHT = 8;
const TOP = 8;
const BOTTOM = 18;

export function Race() {
  const s = useGame();
  const points = s.history;
  const maxCap = Math.max(s.capability, s.rivalCapability, s.baiwen.present ? s.baiwen.capability : 0, 1);
  const yMax = Math.max(16, maxCap * 4);
  const yMin = 0.5;
  const dateStart = -0.5;
  const dateEnd = Math.max(s.date + 3, 12);
  const x = (date: number) => LEFT + ((date - dateStart) / (dateEnd - dateStart)) * (W - LEFT - RIGHT);
  const y = (cap: number) => {
    const v = Math.min(yMax, Math.max(yMin, cap));
    return TOP + (1 - Math.log(v / yMin) / Math.log(yMax / yMin)) * (H - TOP - BOTTOM);
  };
  const line = (index: number) =>
    points
      .filter((p) => (p[index] ?? 0) > 0)
      .map((p) => `${x(p[1]!).toFixed(1)},${y(p[index]!).toFixed(1)}`)
      .join(' ');
  const ours = line(2);
  const anthro = line(3);
  const baiwen = s.baiwen.present ? line(4) : '';
  const last = points[points.length - 1];
  const projection =
    last && last[2]! > 0
      ? `${x(last[1]!).toFixed(1)},${y(last[2]!).toFixed(1)} ${x(dateEnd).toFixed(1)},${y(last[2]! * Math.pow(1.6, (dateEnd - last[1]!) / 3)).toFixed(1)}`
      : '';
  const ratio = topRival(s) / Math.max(0.01, s.capability);
  const behind = ratio >= 2;
  const years = [2025, 2026, 2027]
    .map((yr) => ({ yr, date: (yr - 2025) * 12 - 6 }))
    .filter((t) => t.date >= dateStart && t.date <= dateEnd);
  const visibleTiers = TIERS.filter((t) => t.at >= yMin && t.at <= yMax);
  const nextTier = TIERS.find((t) => t.at > s.capability);
  return (
    <Panel name="race" title="The Race">
      <svg
        id="raceGraph"
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        role="img"
        aria-label="Capability over time, log scale"
      >
        {visibleTiers.map((t) => (
          <g key={t.at}>
            <line
              x1={LEFT}
              x2={W - RIGHT}
              y1={y(t.at)}
              y2={y(t.at)}
              className={`tierLine${t.at > maxCap * 1.5 ? ' faint' : ''}`}
            />
            <text x={W - RIGHT} y={y(t.at) - 2} className="tierLabel" textAnchor="end">
              {t.at}× {t.label}
            </text>
          </g>
        ))}
        {years.map((t) => (
          <text key={t.yr} x={x(t.date)} y={H - 4} className="axisLabel" textAnchor="middle">
            {t.yr}
          </text>
        ))}
        <text x={2} y={y(1) + 4} className="axisLabel">
          1×
        </text>
        {projection ? <polyline points={projection} className="projection" /> : null}
        {anthro ? <polyline points={anthro} className="rivalLine" /> : null}
        {baiwen ? <polyline points={baiwen} className="baiwenLine" /> : null}
        {ours ? <polyline points={ours} className={`ourLine${behind ? ' behind' : ''}`} /> : null}
      </svg>
      <div id="raceLegend" className="note">
        <span className="legendOurs">— OpenMind {fmtNum(s.capability, 2)}×</span> ·{' '}
        <span className="legendRival">╌ Anthrosoft {fmtNum(s.rivalCapability, 2)}×</span>
        {s.baiwen.present ? (
          <>
            {' '}
            · <span className="legendBaiwen">· Baiwen {fmtNum(s.baiwen.capability, 2)}×</span>
          </>
        ) : null}
      </div>
      {nextTier ? (
        <div id="raceNextTier" className="note">
          Next tier: {nextTier.at}× {nextTier.label}
        </div>
      ) : null}
      <span id="tempoRow" className={s.revealed['tempo'] ? 'shown' : ''}>
        Race tempo: <span id="tempo">{fmtNum(s.tempo, 0)}</span>
        <span
          className="note"
          title="How hard the whole field is running. Deploys, funding and thefts raise it; commitments and caps lower it. Rivals move faster and alignment drifts more when it is high."
        >
          {' '}
          / 100
        </span>
        <br />
        Lead over Baiwen: <span id="lead">{fmtNum(leadMonths(s), 1)}</span> months
        <br />
      </span>
      <span id="behindRow" className={behind ? 'shown warn' : ''}>
        A rival leads by {fmtNum(ratio, 1)}×.{' '}
        {ratio >= 4 ? 'Investors are leaving.' : 'Investors are watching.'}
        <br />
      </span>
      <span className="hiddenIds">
        last sample <span id="raceSampleDate">{last ? dateLabel(last[1]!) : ''}</span>
      </span>
    </Panel>
  );
}
