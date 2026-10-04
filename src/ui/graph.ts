import type { GameState } from '../engine/state.js';
import { dateLabel, fmtNum } from '../engine/format.js';
import { bestCapability } from '../engine/economy.js';
import { baiwenAt, leadWords, leadBandNote } from '../engine/world.js';
import { byId, setText, setTitle, showId } from './dom.js';

/**
 * The capability graph (stage2.md §3): capability relative to a human researcher on a log axis,
 * Jul 2025 to three months from now. Sage is a solid step line (a filled square per public
 * release, hollow per internal one), Anthrosoft dashed with a dot per Cadence release, Baiwen
 * dotted: Sage's own line, `lead` months later. Reference rungs up to the first one above the
 * player. The tooltip is a DOM element, so nothing drawn on the canvas needs to be read.
 */
export interface Rung {
  at: number;
  label: string;
}

/** Rungs for every stage; Stage 2 sees the first three (the third is the stage's goal). */
export const RUNGS: Rung[] = [
  { at: 1, label: 'human researcher' },
  { at: 1.5, label: 'reliable agent' },
  { at: 4, label: 'superhuman coder' },
  { at: 10, label: 'country of geniuses' },
  { at: 25, label: 'superhuman AI researcher' },
  // Stage 4 (stage4.md §3).
  { at: 100, label: 'superhuman remote worker' },
  { at: 250, label: 'superintelligent AI researcher' },
  { at: 1000, label: 'superintelligence' },
];

const W = 310;
const H = 190;
const PAD_L = 6;
const PAD_R = 6;
const PAD_T = 18;
const PAD_B = 16;
const BOTTOM = 0.7;

interface Dot {
  x: number;
  y: number;
  text: string;
}

let lastKey = '';
let dots: Dot[] = [];
let mounted = false;

/** The first rung above the best model: the stage's permanent carrot. */
export function nextRung(s: GameState): Rung {
  const best = bestCapability(s);
  return RUNGS.find((r) => r.at > best + 1e-9) ?? RUNGS[RUNGS.length - 1]!;
}

/** `roughly IQ 185`: 100 × capability^0.7, to the nearest 5. */
function iq(cap: number): number {
  return Math.round((100 * Math.pow(cap, 0.7)) / 5) * 5;
}

function mount(): void {
  if (mounted) return;
  mounted = true;
  const canvas = byId<HTMLCanvasElement>('graphCanvas');
  const tip = byId('graphTip');
  const move = (clientX: number, clientY: number) => {
    const box = canvas.getBoundingClientRect();
    const sx = W / Math.max(1, box.width);
    const sy = H / Math.max(1, box.height);
    const x = (clientX - box.left) * sx;
    const y = (clientY - box.top) * sy;
    let best: Dot | null = null;
    let bestD = 6 * 6;
    for (const d of dots) {
      const dd = (d.x - x) ** 2 + (d.y - y) ** 2;
      if (dd <= bestD) {
        best = d;
        bestD = dd;
      }
    }
    if (!best) {
      tip.classList.remove('open');
      return;
    }
    if (tip.textContent !== best.text) tip.textContent = best.text;
    tip.classList.add('open');
    const left = Math.min(best.x / sx + 8, box.width - tip.offsetWidth - 2);
    tip.style.left = `${Math.max(0, left)}px`;
    tip.style.top = `${Math.max(0, best.y / sy - 24)}px`;
  };
  canvas.addEventListener('mousemove', (e) => move(e.clientX, e.clientY));
  canvas.addEventListener('mouseleave', () => tip.classList.remove('open'));
  canvas.addEventListener('click', (e) => move(e.clientX, e.clientY));
}

export function renderGraph(s: GameState): void {
  if (!s.revealed['graph']) return;
  mount();
  const rung = nextRung(s);
  // The stage goal's card names the number once it is on screen; the line under the graph names the rung.
  const goalUp = s.projects['p_superhuman_coder']?.shown === true && !(s.projects['p_superhuman_coder']?.bought ?? 0);
  // Stage 3 (stage3.md §3): a country of geniuses at 10×, a superhuman AI researcher at 25×, then the vote.
  const best4 = bestCapability(s);
  const next = s.stage >= 4
    ? (best4 >= 1000 - 1e-9 ? '' : `Next: ${rung.label} at ${fmtNum(rung.at, 0)}×`)
    : s.stage === 3 && bestCapability(s) >= 25 - 1e-9
    ? 'The Committee votes'
    : goalUp && rung.label === 'superhuman coder' ? `Next: ${rung.label}` : `Next: ${rung.label === 'country of geniuses' ? 'a country of geniuses' : rung.label === 'superhuman AI researcher' ? 'superhuman AI researcher' : rung.label} at ${fmtNum(rung.at, rung.at < 10 ? 2 : 0)}×`;
  setText('nextTier', next);
  setText('leadLine', `Baiwen: ${leadWords(s)}`);
  // What the lead's band does (exports, relations) is in the line's hover.
  setTitle('leadLine', leadBandNote(s));
  // The Stats panel takes the lead over once it exists; the line under the graph goes.
  showId('leadLine', s.revealed['stats'] !== true);

  const models = s.training.models;
  const key = `${models.length}|${s.rivalHistory.length}|${Math.round(s.lead * 4)}|${Math.floor(s.date * (s.stage >= 3 ? 4 : 1))}|${window.devicePixelRatio}|${s.flags['grantMarks'] ?? ''}|${s.flags['neuraleseAt'] ?? ''}|${s.flags['weightsStolen'] ?? ''}|${s.flags['verifyMarks'] ?? ''}|${s.stage}`;
  if (key === lastKey) return;
  lastKey = key;
  draw(s);
}

function draw(s: GameState): void {
  const canvas = byId<HTMLCanvasElement>('graphCanvas');
  const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
  if (canvas.width !== W * dpr || canvas.height !== H * dpr) {
    canvas.width = W * dpr;
    canvas.height = H * dpr;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.font = '10px "Times New Roman", Times, serif';
  ctx.textBaseline = 'alphabetic';

  const models = s.training.models;
  const rivals = s.rivalHistory;
  const best = bestCapability(s);
  const plottedMax = Math.max(best, s.rivalCapability, ...models.map((m) => m.capability), ...rivals.map((r) => r.capability));
  const above = RUNGS.find((r) => r.at > plottedMax + 1e-9) ?? RUNGS[RUNGS.length - 1]!;
  // Stage 3's axis tops (stage3.md §3): 12.5× until 10× is passed, then 31×, then 60×; Stage 4's is 1,250×.
  const top = s.stage >= 4 ? Math.max(1250, plottedMax * 1.25) : s.stage === 3 ? (plottedMax < 10 ? 12.5 : plottedMax < 25 ? 31 : 60) : above.at * 1.25;
  // From Jan 2027 the window is the last 18 months, so the 2027 curve is not squeezed.
  const t1 = Math.max(12, s.date + 3);
  const t0 = s.stage >= 3 ? Math.max(0, t1 - 21) : 0;
  const x = (t: number) => PAD_L + ((t - t0) / (t1 - t0)) * (W - PAD_L - PAD_R);
  const y = (c: number) => {
    const f = (Math.log(Math.max(BOTTOM, c)) - Math.log(BOTTOM)) / (Math.log(top) - Math.log(BOTTOM));
    return H - PAD_B - f * (H - PAD_B - PAD_T);
  };

  // Time axis: a tick at each January and July, labelled.
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD_L, H - PAD_B + 0.5);
  ctx.lineTo(W - PAD_R, H - PAD_B + 0.5);
  ctx.stroke();
  ctx.fillStyle = '#000';
  for (let m = Math.ceil(t0 / 6) * 6; m <= t1; m += 6) {
    const px = Math.round(x(m)) + 0.5;
    ctx.beginPath();
    ctx.moveTo(px, H - PAD_B);
    ctx.lineTo(px, H - PAD_B + 3);
    ctx.stroke();
    const label = dateLabel(m);
    const w = ctx.measureText(label).width;
    ctx.fillText(label, Math.min(W - PAD_R - w, Math.max(0, px - w / 2)), H - 3);
  }

  // Reference rungs: up to the first one above everything plotted; that one black, the rest grey.
  // Their labels are drawn last, on a white ground, so the series never overdraws them (critic C10).
  const labels: { text: string; x: number; y: number; color: string }[] = [];
  for (const r of RUNGS) {
    if (r.at > top) break;
    if (r.at > above.at && s.stage < 4) break;
    // Stage 3 keeps 4× (crossed, grey), 10× and 25×; the low rungs leave the window. Stage 4 draws 10× to 1,000×.
    if (s.stage >= 3 && r.at < 4) continue;
    if (s.stage >= 4 && r.at < 10) continue;
    const py = Math.round(y(r.at)) + 0.5;
    const isNext = r === above;
    ctx.strokeStyle = r.at === 1 ? '#2a623d' : isNext ? '#000' : '#aaa';
    ctx.setLineDash(r.at === 1 ? [] : [1, 3]);
    ctx.beginPath();
    ctx.moveTo(PAD_L, py);
    ctx.lineTo(W - PAD_R, py);
    ctx.stroke();
    ctx.setLineDash([]);
    const label = `${fmtNum(r.at, r.at % 1 ? 1 : 0)}× ${r.label}`;
    const w = ctx.measureText(label).width;
    labels.push({ text: label, x: W - PAD_R - w, y: py - 2, color: r.at === 1 ? '#2a623d' : isNext ? '#000' : '#888' });
  }

  dots = [];
  // Sage: a step line through the best model so far, a square per release. On the slow branch the Sage
  // line ends at the vote (a hollow square, `Sage-4, switched off`) and a dark green Steward line
  // starts lower (stage4.md §3).
  const offAt = typeof s.flags['sage4Off'] === 'number' ? (s.flags['sage4Off'] as number) : null;
  const steward = (m: { name: string }) => m.name.startsWith('Steward');
  const sageModels = offAt === null ? models : models.filter((m) => !steward(m));
  const stewardModels = offAt === null ? [] : models.filter(steward);
  const steps: [number, number][] = [];
  let level = 0;
  for (const m of sageModels) {
    level = Math.max(level, m.capability);
    steps.push([m.date, level]);
  }
  const stewardSteps: [number, number][] = [];
  let level2s = 0;
  for (const m of stewardModels) {
    level2s = Math.max(level2s, m.capability);
    stewardSteps.push([m.date, level2s]);
  }
  // Baiwen follows the line the lab has now: Sage to the vote, then Steward.
  const ownSteps = offAt === null ? steps : [...steps.filter(([d]) => d <= offAt), ...stewardSteps];
  const stepPath = (points: [number, number][], shift: number, floor: number, end = t1) => {
    ctx.beginPath();
    let started = false;
    let prev = floor;
    for (const [t, c] of points) {
      const tx = x(Math.max(t0, Math.min(t1, t + shift)));
      if (!started) {
        ctx.moveTo(x(Math.max(t0, Math.min(t1, shift))), y(Math.max(floor, c)));
        started = true;
      } else {
        ctx.lineTo(tx, y(prev));
      }
      ctx.lineTo(tx, y(Math.max(floor, c)));
      prev = Math.max(floor, c);
    }
    ctx.lineTo(x(Math.max(t0, Math.min(t1, end))), y(prev));
    ctx.stroke();
  };

  // Baiwen first (dotted), so Sage draws over it: Sage's own line `lead` months later; after a theft
  // it jumps to the stolen model and is drawn from there (stage3.md §3).
  ctx.strokeStyle = '#555';
  ctx.setLineDash([1, 2]);
  const stolenAt = typeof s.flags['stolenDate'] === 'number' ? (s.flags['stolenDate'] as number) : null;
  if (stolenAt !== null && s.stage >= 3) {
    const before = steps.filter(([d]) => d + s.lead < stolenAt);
    const jump = Math.max(s.baiwenCapability ?? 0, ...steps.filter(([d]) => d <= stolenAt).map(([, c]) => 0.97 * c));
    stepPath([...before, [stolenAt - s.lead, jump], ...steps.filter(([d]) => d + s.lead >= stolenAt && d > stolenAt)], s.lead, BOTTOM);
  } else {
    stepPath(ownSteps, s.lead, BOTTOM);
  }
  ctx.setLineDash([]);

  // Anthrosoft: dashed grey, a dot per Cadence release.
  if (rivals.length) {
    ctx.strokeStyle = '#888';
    ctx.setLineDash([4, 3]);
    stepPath([[0, 1], ...rivals.map((r) => [r.date, r.capability] as [number, number])], 0, BOTTOM);
    ctx.setLineDash([]);
    ctx.fillStyle = '#888';
    for (const r of rivals) {
      const px = x(r.date);
      const py = y(r.capability);
      ctx.beginPath();
      ctx.arc(px, py, 2.2, 0, Math.PI * 2);
      ctx.fill();
      dots.push({ x: px, y: py, text: `${r.name} · ${dateLabel(r.date)} · ${fmtNum(r.capability, 2)}×` });
    }
  }

  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1.5;
  stepPath(steps, 0, BOTTOM, offAt ?? t1);
  if (offAt !== null && stewardSteps.length) {
    ctx.strokeStyle = '#2a623d';
    stepPath(stewardSteps, 0, BOTTOM);
    ctx.strokeStyle = '#000';
  }
  ctx.lineWidth = 1;
  if (offAt !== null && offAt >= t0) {
    // The switched-off model: a hollow square where the Sage line ends.
    const capOff = typeof s.flags['sage4OffCap'] === 'number' ? (s.flags['sage4OffCap'] as number) : level;
    const px = x(offAt);
    const py = y(capOff);
    ctx.fillStyle = '#fff';
    ctx.fillRect(px - 3.5, py - 3.5, 7, 7);
    ctx.strokeStyle = '#000';
    ctx.strokeRect(px - 3.5, py - 3.5, 7, 7);
    dots.push({ x: px, y: py, text: `Sage-4 · ${dateLabel(offAt)} · ${fmtNum(capOff, 1)}× · switched off` });
    labels.push({ text: 'Sage-4, switched off', x: Math.max(PAD_L, px - ctx.measureText('Sage-4, switched off').width - 6), y: py - 6, color: '#555' });
  }
  for (const m of models) {
    const px = x(m.date);
    const py = y(m.capability);
    const ink = steward(m) ? '#2a623d' : '#000';
    ctx.fillStyle = '#fff';
    ctx.fillRect(px - 2.5, py - 2.5, 5, 5);
    ctx.strokeStyle = ink;
    ctx.strokeRect(px - 2.5, py - 2.5, 5, 5);
    if (m.public) {
      ctx.fillStyle = ink;
      ctx.fillRect(px - 2.5, py - 2.5, 5, 5);
    }
    // The IQ gloss stops at 10× (stage3.md §3): past it no human is a useful comparison.
    const gloss = m.capability >= 10 ? 'no human is a useful comparison' : `roughly IQ ${iq(m.capability)}`;
    dots.push({ x: px, y: py, text: `${m.name} · ${dateLabel(m.date)} · ${fmtNum(m.capability, 2)}× · ${gloss}${m.public ? '' : ' · internal'}` });
  }
  // Stage 3: a small × on the Sage line at each autonomy grant, and a dotted line at the neuralese decision.
  if (s.stage >= 3) {
    const marks = typeof s.flags['grantMarks'] === 'string' ? (s.flags['grantMarks'] as string).split('|') : [];
    ctx.strokeStyle = '#000';
    for (const mark of marks) {
      const [d, ...title] = mark.split(':');
      const date = Number(d);
      if (!(date >= t0)) continue;
      const level2 = Math.max(BOTTOM, ...steps.filter(([t]) => t <= date).map(([, c]) => c));
      const px = x(date);
      const py = y(level2);
      ctx.beginPath();
      ctx.moveTo(px - 3, py - 3 - 6);
      ctx.lineTo(px + 3, py + 3 - 6);
      ctx.moveTo(px + 3, py - 3 - 6);
      ctx.lineTo(px - 3, py + 3 - 6);
      ctx.stroke();
      dots.push({ x: px, y: py - 6, text: `${title.join(':')} · ${dateLabel(date)} · granted` });
    }
    // Stage 4: a `+` over each generation that was read first (Verify).
    const verified = typeof s.flags['verifyMarks'] === 'string' ? (s.flags['verifyMarks'] as string).split('|').map(Number) : [];
    for (const date of verified) {
      if (!(date >= t0)) continue;
      const line = offAt !== null && date >= offAt ? stewardSteps : steps;
      const lv = Math.max(BOTTOM, ...line.filter(([t]) => t <= date + 1e-6).map(([, c]) => c));
      const px = x(date);
      const py = y(lv) + 7;
      ctx.strokeStyle = '#555';
      ctx.beginPath();
      ctx.moveTo(px - 2.5, py);
      ctx.lineTo(px + 2.5, py);
      ctx.moveTo(px, py - 2.5);
      ctx.lineTo(px, py + 2.5);
      ctx.stroke();
      dots.push({ x: px, y: py, text: `${dateLabel(date)} · read first` });
    }
    const nAt = s.flags['neuraleseAt'];
    if (typeof nAt === 'number' && nAt >= t0) {
      const px = Math.round(x(nAt)) + 0.5;
      ctx.setLineDash([1, 3]);
      ctx.beginPath();
      ctx.moveTo(px, PAD_T);
      ctx.lineTo(px, H - PAD_B);
      ctx.stroke();
      ctx.setLineDash([]);
      const label = s.flags['neuralese'] === 'neuralese' ? 'neuralese' : 'transparent';
      labels.push({ text: label, x: Math.min(W - PAD_R - ctx.measureText(label).width, px + 2), y: H - PAD_B - 3, color: '#555' });
    }
  }
  // A label never covers a point of the series (critic S2 round 2 §8.10: `4× superhuman coder` sat on
  // the gate's model): it moves to the left edge, and below its line if that is taken too.
  const covers = (lx: number, ly: number, w: number) => dots.some((d) => d.x >= lx - 4 && d.x <= lx + w + 4 && d.y >= ly - 12 && d.y <= ly + 4);
  for (const l of labels) {
    const w = ctx.measureText(l.text).width;
    if (covers(l.x, l.y, w)) {
      const left = PAD_L + 2;
      if (!covers(left, l.y, w)) l.x = left;
      else if (!covers(l.x, l.y + 11, w)) l.y += 11;
      else l.x = left;
    }
  }
  for (const l of labels) {
    const w = ctx.measureText(l.text).width;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillRect(l.x - 2, l.y - 9, w + 4, 10);
    ctx.fillStyle = l.color;
    ctx.fillText(l.text, l.x, l.y);
  }
  // Baiwen's current position is hoverable too.
  const bNow = baiwenAt(s, s.date);
  dots.push({ x: x(s.date), y: y(bNow), text: `Baiwen (estimated) · ${dateLabel(s.date)} · ${fmtNum(bNow, 2)}×` });

  // Legend: three words at the top left, in their line styles.
  const legend: [string, string, number[]][] = offAt !== null
    ? [['Sage', '#000', []], ['Steward', '#2a623d', []], ['Baiwen', '#555', [1, 2]]]
    : [['Sage', '#000', []], ['Anthrosoft', '#888', [4, 3]], ['Baiwen', '#555', [1, 2]]];
  let lx = PAD_L + 2;
  for (const [name, color, dash] of legend) {
    ctx.strokeStyle = color;
    ctx.setLineDash(dash);
    ctx.lineWidth = name === 'Sage' || name === 'Steward' ? 1.5 : 1;
    ctx.beginPath();
    ctx.moveTo(lx, 9.5);
    ctx.lineTo(lx + 12, 9.5);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = color;
    ctx.fillText(name, lx + 15, 13);
    lx += 15 + ctx.measureText(name).width + 10;
  }
  ctx.lineWidth = 1;
}

/** Forget the last drawing (a load replaced the state). */
export function resetGraph(): void {
  lastKey = '';
}
