import { GameState, MindStatus, say } from './state.js';
import { pick, seedFrom } from './rng.js';
import { alignmentShown, narrowBand } from './alignment.js';
import { CIRCUITS, FEATURES, featureById, isMalicious, thoughtOf, type CircuitId, type FeatureDef } from '../data/mind.js';

// Sage's mind: Stage 2 training runs light up features; the player decodes each
// in a minigame, then rewires it. Each decode tightens the alignment band, even
// before the band itself is on screen.

export function featureStatus(s: GameState, id: string): MindStatus {
  return s.mind.features[id]?.status ?? 'locked';
}

export function decodedCount(s: GameState): number {
  return Object.values(s.mind.features).filter((f) => f.status === 'decoded').length;
}

export function foundCount(s: GameState): number {
  return Object.values(s.mind.features).filter((f) => f.status === 'found').length;
}

export function frontier(s: GameState): FeatureDef[] {
  const decoded = decodedCount(s);
  return FEATURES.filter(
    (f) =>
      featureStatus(s, f.id) === 'locked' &&
      f.requires.every((r) => featureStatus(s, r) === 'decoded') &&
      decoded >= (f.minDecoded ?? 0),
  );
}

export function mindSignal(s: GameState, prefer?: CircuitId, source?: string): string | null {
  const list = frontier(s);
  let def: FeatureDef | undefined;
  if (list.length) {
    const preferred = prefer ? list.filter((f) => f.circuit === prefer) : [];
    const r = { rngSeed: seedFrom(s.seed * 31 + s.mind.signals * 7919 + 7) };
    def = pick(r, preferred.length ? preferred : list);
  }
  s.mind.signals += 1;
  if (!def) return null;
  s.mind.features[def.id] = { status: 'found', foundAt: s.stats.timePlayed, attempts: 0, flawless: false, wiring: '' };
  s.mind.fresh.push(def.id);
  s.mind.lastFound = def.id;
  if (!s.revealed['mind']) {
    s.revealed['mind'] = true;
    say(s, "Sage's activations are being recorded now. Something lit up: open the Mind tab.");
  } else {
    const circuit = CIRCUITS.find((c) => c.id === def.circuit)!;
    say(s, `${source ?? 'Training'}: a feature lit up in ${circuit.name}: "${def.name}". Decode it in the Mind tab.`);
  }
  return def.id;
}

export function decodeFeature(s: GameState, id: string, mistakes: number): boolean {
  const f = s.mind.features[id];
  const def = featureById(id);
  if (!f || !def || f.status !== 'found') return false;
  f.attempts += 1;
  f.status = 'decoded';
  f.flawless = mistakes === 0;
  f.wiring = isMalicious(def, s) ? '' : 'benign';
  s.mind.fresh = s.mind.fresh.filter((x) => x !== id);
  const n = 1 + (f.flawless ? 1 : 0);
  narrowBand(s, n);
  if (alignmentShown(s)) {
    say(s, `Decoded "${def.name}": “${thoughtOf(def, s)}” Band −${n}.`);
  } else {
    say(s, `Decoded "${def.name}": “${thoughtOf(def, s)}”`);
  }
  return true;
}

export function failDecode(s: GameState, id: string): boolean {
  const f = s.mind.features[id];
  if (!f || f.status !== 'found') return false;
  f.attempts += 1;
  return true;
}

export function rewireFeature(s: GameState, id: string): boolean {
  const f = s.mind.features[id];
  const def = featureById(id);
  if (!f || !def || f.status !== 'decoded' || f.wiring !== '') return false;
  def.rewire(s);
  f.wiring = 'rewired';
  say(s, `Rewired: ${def.rewired}`);
  return true;
}

export function markMindSeen(s: GameState): boolean {
  if (s.mind.fresh.length === 0) return false;
  s.mind.fresh = [];
  return true;
}

export function devMindSignal(s: GameState): boolean {
  return mindSignal(s, undefined, 'Dev') !== null;
}
