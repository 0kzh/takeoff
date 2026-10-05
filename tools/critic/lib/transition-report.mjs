// What changed around a stage transition: built from a run's snapshots/events/actions.
import path from 'node:path';
import { elementsOf } from './recorder.mjs';
import { mmss, fmtN } from './util.mjs';

/** Returns a markdown/plain-text report, or a "not reached" note. */
export function transitionReport({ meta, snaps, events, actions }, { before = 20, after = 30 } = {}) {
  const T = meta.stageEnd;
  const name = path.basename(meta.prefix);
  if (T == null) return `# Transition: ${name}\n\nStage end not reached (ran to ${mmss(meta.endT)}).\n`;
  const start = meta.stageStart;
  const preSnaps = snaps.filter((s) => s.stage === start && s.t <= T);
  const pre = preSnaps[preSnaps.length - 1];
  const postSnaps = snaps.filter((s) => s.stage !== start && s.t >= T && s.t <= T + after);
  const post = postSnaps[0];
  const late = postSnaps[postSnaps.length - 1];
  const out = [];
  out.push(`# Transition: ${name} (${meta.title}, Stage ${start} → ${post ? post.stage : '?'})`, '');
  out.push(`Stage change at ${mmss(T)}; window ${mmss(T - before)} → ${mmss(T + after)}. Last pre-transition snapshot ${pre ? mmss(pre.t) : '—'}, first post-transition snapshot ${post ? mmss(post.t) : '—'}.`, '');
  if (!pre || !post) {
    out.push('Not enough snapshots on both sides of the change.');
    return out.join('\n') + '\n';
  }

  out.push('## Console and log lines in the window', '');
  const lines = events.filter((e) => (e.type === 'console' || e.type === 'log') && e.t >= T - before && e.t <= T + after);
  if (!lines.length) out.push('- (none)');
  for (const e of lines) out.push(`- ${mmss(e.t)} [${e.type}] ${e.text}`);
  const blank = postSnaps.filter((s) => !s.console).map((s) => mmss(s.t));
  if (blank.length) out.push('', `Console showed no line at: ${blank.join(', ')}.`);
  const fine = events.find((e) => e.type === 'transition-samples');
  if (fine) {
    out.push('', 'First 2 s after the change, every 250 ms (newest console line · panels):', '');
    for (const s of fine.samples) out.push(`- +${s.dt.toFixed(2)} s: ${s.console ? `"${s.console}"` : '(console blank)'} · ${s.panels.join(', ')}`);
  }
  out.push('');

  const preEls = new Map(elementsOf(pre).map((e) => [e.uid, e]));
  const postUnion = new Map();
  for (const s of postSnaps) for (const e of elementsOf(s)) if (!postUnion.has(e.uid)) postUnion.set(e.uid, { ...e, t: s.t });
  const vanished = [...preEls.values()].filter((e) => !postUnion.has(e.uid));
  const appeared = [...postUnion.values()].filter((e) => !preEls.has(e.uid));
  const boughtKeys = new Set((actions || []).filter((a) => a.t >= T - before && a.t <= T + after).map((a) => a.key));

  out.push('## Vanished at the transition (visible before, not visible in the 30 s after)', '');
  if (!vanished.length) out.push('- (none)');
  for (const e of vanished) {
    const note = e.what === 'project' ? (boughtKeys.has(e.key) ? ' — bought' : meta.autoplay ? ' — gone (autoplay: purchase not tracked)' : ' — **gone un-bought**') : '';
    out.push(`- ${e.what}: ${e.label}${e.enabled === 0 ? ' (was grey)' : e.enabled === 1 ? ' (was enabled)' : ''}${note}`);
  }
  out.push('', '## Appeared after the transition', '');
  if (!appeared.length) out.push('- (none)');
  for (const e of appeared) out.push(`- ${mmss(e.t)} ${e.what}: ${e.label}`);

  out.push('', '## New buttons on arrival (first post-transition snapshot)', '');
  const arrival = post.buttons.filter((b) => b.kind !== 'modal' && !preEls.has(`${b.kind === 'project' ? 'project' : 'button'}:${b.k}`));
  if (!arrival.length) out.push('- (none)');
  for (const b of arrival) out.push(`- ${b.l} — ${b.e ? 'affordable/enabled' : 'grey'}${b.a ? ' (ambient)' : ''}`);
  const afford = post.buttons.filter((b) => b.e && !b.a && b.kind !== 'modal');
  out.push('', `Enabled non-ambient buttons on arrival: ${afford.length ? afford.map((b) => b.l).join('; ') : 'none'}.`);

  out.push('', '## Numbers before / after', '');
  const keys = ['rate', 'funds', 'automation', 'research', 'trust', 'stock', 'clips', 'unusedClips', 'ops'];
  const row = (s) => keys.map((k) => (s && s.m && s.m[k] != null ? fmtN(s.m[k], k === 'funds' ? 2 : 0) : '—'));
  const mid = postSnaps.find((s) => s.t >= T + 10) || late;
  out.push(`| | t | ${keys.join(' | ')} | numbers on screen | buttons | panels |`);
  out.push(`|---|---|${keys.map(() => '---').join('|')}|---|---|---|`);
  for (const [label, s] of [['before', pre], ['arrival', post], ['+10 s', mid], [`+${after} s`, late]]) {
    out.push(`| ${label} | ${mmss(s.t)} | ${row(s).join(' | ')} | ${s.numbers} | ${s.buttons.length} | ${s.panels.length} |`);
  }
  out.push('', `Screenshots: \`${name}.tpre.png\` (before the purchase, when the policy bought the gate), \`${name}.tend.png\` (at the change), \`${name}.transition.png\` (+4 s).`, '');
  return out.join('\n');
}
