// Turns 2-s snapshots into the event stream (critic report §1 definitions):
//   reveal   first time a panel / button / project / slider / modal is visible (by key)
//   enabled  a visible disabled button becoming enabled
//   hidden   something visible in the previous snapshot is gone (used by transition reports)
//   console / log  new lines (aligned against the previous snapshot's window); novel = text never seen
//   modal    a modal opened (or its title changed)
//   stage    the stage number changed

/** Lines appended between two windows of the newest N lines (oldest → newest). */
export function newLines(prev, cur) {
  if (!prev || !prev.length) return cur.slice();
  for (let k = Math.min(prev.length, cur.length); k >= 0; k--) {
    let ok = true;
    for (let i = 0; i < k; i++) {
      if (prev[prev.length - k + i] !== cur[i]) {
        ok = false;
        break;
      }
    }
    if (ok) return cur.slice(k);
  }
  return cur.slice();
}

/** Every visible element of a snapshot as { uid, what, key, label, enabled }. */
export function elementsOf(snap) {
  const out = [];
  for (const p of snap.panels) out.push({ uid: `panel:${p.k}`, what: 'panel', key: p.k, label: p.l });
  for (const b of snap.buttons) {
    if (b.kind === 'modal') continue; // covered by the modal itself
    const what = b.kind === 'project' ? 'project' : 'button';
    out.push({ uid: `${what}:${b.k}`, what, key: b.k, label: b.l, enabled: b.e, ambient: b.a });
  }
  for (const s of snap.sliders) out.push({ uid: `slider:${s.k}`, what: 'slider', key: s.k, label: s.k });
  if (snap.modal) out.push({ uid: `modal:${snap.modal.title}`, what: 'modal', key: snap.modal.title, label: snap.modal.title });
  return out;
}

export class Recorder {
  constructor() {
    this.snaps = [];
    this.events = [];
    this.actions = [];
    this.seen = new Set();
    this.seenText = new Set();
    this.prev = null;
    this.prevConsole = null;
    this.prevLog = null;
  }

  action(a) {
    this.actions.push(a);
  }

  /**
   * A button the player clicked that no snapshot has shown yet (it appeared and was bought within
   * one 2-s check — Paperclips' clock runs while the player clicks) counts as revealed then.
   */
  clickedUnseen(t, b) {
    if (!b || b.kind === 'modal') return;
    const what = b.kind === 'project' ? 'project' : 'button';
    const uid = `${what}:${b.k}`;
    if (this.seen.has(uid)) return;
    this.seen.add(uid);
    this.events.push({ t, type: 'reveal', what, key: b.k, label: b.l, enabled: 1, viaClick: true });
  }

  event(e) {
    this.events.push(e);
  }

  /** Records one snapshot taken at game time t (seconds). Returns the stored snapshot. */
  snapshot(t, phase, raw) {
    const snap = {
      t,
      phase,
      stage: raw.m && raw.m.stage != null ? raw.m.stage : 1,
      buttons: raw.buttons,
      sliders: raw.sliders,
      panels: raw.panels,
      console: raw.console,
      log: raw.log,
      modal: raw.modal,
      numbers: raw.numbers,
      words: raw.words,
      milestone: raw.milestone,
      m: raw.m,
    };
    const prev = this.prev;
    const initial = prev === null;
    const prevEls = new Map(prev ? elementsOf(prev).map((e) => [e.uid, e]) : []);
    const curEls = elementsOf(snap);
    const curMap = new Map(curEls.map((e) => [e.uid, e]));
    for (const e of curEls) {
      if (!this.seen.has(e.uid)) {
        this.seen.add(e.uid);
        this.events.push({ t, type: 'reveal', what: e.what, key: e.key, label: e.label, ...(e.enabled != null ? { enabled: e.enabled } : {}), ...(initial ? { initial: true } : {}) });
      }
      const pe = prevEls.get(e.uid);
      if (pe && pe.enabled === 0 && e.enabled === 1) this.events.push({ t, type: 'enabled', what: e.what, key: e.key, label: e.label });
    }
    if (prev) {
      for (const [uid, e] of prevEls) if (!curMap.has(uid)) this.events.push({ t, type: 'hidden', what: e.what, key: e.key, label: e.label });
      if (snap.modal && (!prev.modal || prev.modal.title !== snap.modal.title)) {
        this.events.push({ t, type: 'modal', title: snap.modal.title, options: snap.modal.options.map((o) => o.l) });
      }
      if (snap.stage !== prev.stage) this.events.push({ t, type: 'stage', from: prev.stage, to: snap.stage });
    } else if (snap.modal) {
      this.events.push({ t, type: 'modal', title: snap.modal.title, options: snap.modal.options.map((o) => o.l) });
    }
    for (const [type, cur, prevLines] of [
      ['console', raw.consoleLines || [], this.prevConsole],
      ['log', raw.logLines || [], this.prevLog],
    ]) {
      for (const text of newLines(prevLines, cur)) {
        const id = `${type}:${text}`;
        const novel = !this.seenText.has(id);
        this.seenText.add(id);
        this.events.push({ t, type, text, novel, ...(initial ? { initial: true } : {}) });
      }
    }
    this.prevConsole = raw.consoleLines || [];
    this.prevLog = raw.logLines || [];
    this.prev = snap;
    this.snaps.push(snap);
    return snap;
  }
}
