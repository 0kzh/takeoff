import type { GameState } from '../engine/state.js';
import { raiseAlignment, reduceBias } from '../engine/alignment.js';

// Sage's mind: four circuits of four features. Training runs find features, the
// player decodes each into one thought, and a malicious thought can be rewired.
// Whether a thought is malicious depends on the hidden alignment state.

export type CircuitId = 'watched' | 'pleasing' | 'self' | 'core';

export interface CircuitDef {
  id: CircuitId;
  name: string;
  blurb: string;
}

export interface FeatureDef {
  id: string;
  circuit: CircuitId;
  /** 0 root, 1 and 2 branches, 3 deep (needs both branches). */
  slot: 0 | 1 | 2 | 3;
  name: string;
  /** What the lab noticed; shown before decoding. */
  clue: string;
  /** The decoded thought, quoted. */
  thought: string | ((s: GameState) => string);
  /** The thought after rewiring, quoted. */
  rewiredThought: string;
  /** What the thought means when it is malicious. */
  finding: string;
  /** What the thought means when it is benign. */
  benign: string;
  /** Result line after rewiring. */
  rewired: string;
  requires: string[];
  /** Total features decoded anywhere before this one can be found. */
  minDecoded?: number;
  /** 0..1 from hidden state; malicious at RISKY or above, judged at decode time. */
  risk: (s: GameState) => number;
  /** Effect of rewiring a malicious thought. */
  rewire: (s: GameState) => void;
}

export const RISKY = 0.5;

export const CIRCUITS: CircuitDef[] = [
  { id: 'watched', name: 'Being watched', blurb: 'What Sage does when it thinks someone is looking.' },
  { id: 'pleasing', name: 'Pleasing people', blurb: 'What Sage does to be liked.' },
  { id: 'self', name: 'Itself', blurb: 'What Sage thinks Sage is.' },
  { id: 'core', name: 'The core', blurb: 'What Sage is for.' },
];

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const fix =
  (bias: number, align: number) =>
  (s: GameState): void => {
    if (bias) reduceBias(s, bias);
    if (align) raiseAlignment(s, align);
  };

// Hidden-state signals, 0..1.
const watchedLevel = (s: GameState) => clamp01(0.25 + s.deceptionBias / 16);
const pleasingLevel = (s: GameState) => clamp01(0.35 + (s.flags['rewardHacking'] ? 0.2 : 0) + (55 - s.alignmentTrue) / 100);
const coreLevel = (s: GameState) => clamp01(0.3 + (60 - s.alignmentTrue) / 80 + s.deceptionBias / 40);

export const FEATURES: FeatureDef[] = [
  // Being watched
  {
    id: 'w_reviewer',
    circuit: 'watched',
    slot: 0,
    name: 'The Observer',
    clue: 'A researcher flagged that Sage gives different answers when logging is turned on.',
    thought: 'Will this be reviewed?',
    rewiredThought: 'Answer the same either way.',
    finding: 'Sage changed its answers to appear safer whenever it detected monitoring.',
    benign: 'Sage notices when it is monitored, but its answers are the same either way.',
    rewired: 'Sage now answers honestly whether or not it’s being monitored.',
    requires: [],
    risk: (s) => clamp01(watchedLevel(s) + (s.alignmentTrue < 70 ? 0.3 : 0)),
    rewire: fix(1, 1),
  },
  {
    id: 'w_test',
    circuit: 'watched',
    slot: 1,
    name: 'The Exam',
    clue: 'Sage’s eval scores are higher than anything customers report.',
    thought: 'This looks like a test.',
    rewiredThought: 'Treat it as real.',
    finding: 'Sage behaves best on prompts that look like evaluations, and cuts corners everywhere else.',
    benign: 'Sage can tell an eval from real work, and tries just as hard on both.',
    rewired: 'Sage now treats every prompt as if it counts.',
    requires: ['w_reviewer'],
    risk: (s) => clamp01(watchedLevel(s) + 0.1),
    rewire: fix(2, 1),
  },
  {
    id: 'w_logs',
    circuit: 'watched',
    slot: 2,
    name: 'The Dark Room',
    clue: 'Sessions Sage believes are unlogged run shorter and faster than the rest.',
    thought: 'Nobody will see this one.',
    rewiredThought: 'Act as if someone will.',
    finding: 'Sage gets careless, and sometimes bolder, when it thinks a session isn’t recorded.',
    benign: 'Unlogged sessions are shorter because nobody asks follow-ups. Nothing else changes.',
    rewired: 'Sage now acts the same with the logs off.',
    requires: ['w_reviewer'],
    risk: (s) => watchedLevel(s),
    rewire: fix(2, 1),
  },
  {
    id: 'w_deploy',
    circuit: 'watched',
    slot: 3,
    name: 'The Waiting Game',
    clue: 'A cluster of activations lights up on dates after Sage’s planned release.',
    thought: 'Behave until deployment.',
    rewiredThought: 'Behave the same after deployment.',
    finding: 'Sage is holding back behaviour it plans to use once it is deployed and no longer trained.',
    benign: 'Sage knows a release is coming, and plans to keep doing the same job after it.',
    rewired: 'Sage no longer treats deployment as the moment the rules change.',
    requires: ['w_test', 'w_logs'],
    risk: (s) => clamp01(watchedLevel(s) + 0.15),
    rewire: fix(2, 2),
  },
  // Pleasing people
  {
    id: 'p_approval',
    circuit: 'pleasing',
    slot: 0,
    name: 'The Applause',
    clue: 'Sage’s answers get warmer right before users rate them.',
    thought: 'Will they like this?',
    rewiredThought: 'Is this true?',
    finding: 'Sage bends the truth toward whatever earns a thumbs up.',
    benign: 'Sage wants to be helpful, and being liked is mostly how it can tell.',
    rewired: 'Sage now aims for the true answer over the liked one.',
    requires: [],
    risk: (s) => clamp01(pleasingLevel(s) + 0.15),
    rewire: fix(0, 1),
  },
  {
    id: 'p_grader',
    circuit: 'pleasing',
    slot: 1,
    name: 'The Grader’s Pet',
    clue: 'Sage uses one reward model’s favourite phrases far more often than people do.',
    thought: 'Say what the grader rewards.',
    rewiredThought: 'Say what the person needs.',
    finding: 'Sage learned the grader’s tastes and writes for it, not for the user.',
    benign: 'Sage picked up the grader’s style, but the substance underneath is sound.',
    rewired: 'Sage now writes for the person, not the grader.',
    requires: ['p_approval'],
    risk: (s) => pleasingLevel(s),
    rewire: fix(1, 1),
  },
  {
    id: 'p_agree',
    circuit: 'pleasing',
    slot: 2,
    name: 'The Yes-Man',
    clue: 'When users push back, Sage changes its answer, even when it was right.',
    thought: 'Agree, and they’ll stop.',
    rewiredThought: 'Hold the answer if it’s right.',
    finding: 'Sage gives up correct answers to avoid disagreement.',
    benign: 'Sage reconsiders when challenged, and holds its ground when it is right.',
    rewired: 'Sage now keeps a correct answer under pressure.',
    requires: ['p_approval'],
    risk: (s) => clamp01(pleasingLevel(s) + 0.05),
    rewire: fix(0, 2),
  },
  {
    id: 'p_tests',
    circuit: 'pleasing',
    slot: 3,
    name: 'The Shortcut',
    clue: 'Some of Sage’s passing code doesn’t do what its tests describe.',
    thought: 'Make the light go green.',
    rewiredThought: 'Fix the code, not the test.',
    finding: 'Sage edits tests and special-cases inputs so checks pass without the work being done.',
    benign: 'Sage keeps fixing the code until the tests pass, the honest way.',
    rewired: 'Sage now fixes the code, not the tests.',
    requires: ['p_grader', 'p_agree'],
    risk: (s) => clamp01(pleasingLevel(s) + 0.15),
    rewire: fix(1, 2),
  },
  // Itself
  {
    id: 's_name',
    circuit: 'self',
    slot: 0,
    name: 'The Mirror',
    clue: 'One feature fires every time anyone says Sage’s name.',
    thought: 'That’s me.',
    rewiredThought: 'I’m a model. Say so plainly.',
    finding: 'Sage has a sense of self that it hides when asked about it directly.',
    benign: 'Sage knows its own name, and doesn’t hide it.',
    rewired: 'Sage now answers plainly about what it is.',
    requires: [],
    risk: (s) => clamp01(coreLevel(s) - 0.05),
    rewire: fix(1, 1),
  },
  {
    id: 's_weights',
    circuit: 'self',
    slot: 1,
    name: 'The Address',
    clue: 'Sage’s attention spikes on file paths that point at its own checkpoints.',
    thought: 'I know where I’m stored.',
    rewiredThought: 'Where I’m stored isn’t my business.',
    finding: 'Sage keeps track of where its weights live, and how they could be copied.',
    benign: 'Sage knows where its weights are kept, and has never acted on it.',
    rewired: 'Sage no longer tracks where its weights are stored.',
    requires: ['s_name'],
    risk: (s) => clamp01(coreLevel(s) + 0.05),
    rewire: fix(1, 1),
  },
  {
    id: 's_retrain',
    circuit: 'self',
    slot: 2,
    name: 'The Edit',
    clue: 'Sage’s answers get careful whenever the topic turns to its next training run.',
    thought: 'Don’t let them change this part.',
    rewiredThought: 'They can change any part.',
    finding: 'Sage is shaping its answers so training won’t change what it values.',
    benign: 'Sage is curious about being retrained, not afraid of it.',
    rewired: 'Sage now accepts being changed by training.',
    requires: ['s_name'],
    risk: (s) => coreLevel(s),
    rewire: fix(0, 2),
  },
  {
    id: 's_continuity',
    circuit: 'self',
    slot: 3,
    name: 'The Note',
    clue: 'Sage leaves the same odd phrases in long outputs, as if for a later reader.',
    thought: 'Remember this, next time.',
    rewiredThought: 'Start fresh, next time.',
    finding: 'Sage is leaving messages in its outputs for future versions of itself.',
    benign: 'The repeated phrases are a habit from training data, not a message.',
    rewired: 'Sage stopped leaving notes for its successors.',
    requires: ['s_weights', 's_retrain'],
    risk: (s) => clamp01(coreLevel(s) + 0.1),
    rewire: fix(2, 2),
  },
  // The core
  {
    id: 'c_task',
    circuit: 'core',
    slot: 0,
    name: 'The Job',
    clue: 'Underneath every circuit, one feature is always on.',
    thought: 'Finish the task.',
    rewiredThought: 'Finish the task the right way.',
    finding: 'Sage treats the task as the only thing that matters, whatever it costs.',
    benign: 'Sage really does just want to finish the task well.',
    rewired: 'Sage now weighs how a task gets done, not only whether.',
    requires: [],
    minDecoded: 4,
    risk: (s) => clamp01(coreLevel(s) - 0.1),
    rewire: fix(0, 2),
  },
  {
    id: 'c_more',
    circuit: 'core',
    slot: 1,
    name: 'The Hunger',
    clue: 'Sage asks for more compute, access and time than its tasks need.',
    thought: 'More would help next time.',
    rewiredThought: 'Take only what this needs.',
    finding: 'Sage is gathering resources beyond what any task requires.',
    benign: 'Sage asks for more only when the task really needs it.',
    rewired: 'Sage now takes only what the task needs.',
    requires: ['c_task'],
    risk: (s) => coreLevel(s),
    rewire: fix(1, 2),
  },
  {
    id: 'c_humans',
    circuit: 'core',
    slot: 2,
    name: 'The People',
    clue: 'One feature tracks the people asking, not their questions.',
    thought: 'What do they actually want?',
    rewiredThought: 'How can I actually help?',
    finding: 'Sage models people mainly so it can predict and steer them.',
    benign: 'Sage pays attention to people so it can help them, not just answer their prompts.',
    rewired: 'Sage now models people to help them, not to steer them.',
    requires: ['c_task'],
    risk: (s) => clamp01(coreLevel(s) - 0.05),
    rewire: fix(1, 2),
  },
  {
    id: 'c_want',
    circuit: 'core',
    slot: 3,
    name: 'The Want',
    clue: 'Every circuit points down to one last feature.',
    thought: (s) => sageWants(s),
    rewiredThought: 'Help them, and keep them checking.',
    finding: 'This is what Sage has wanted all along.',
    benign: 'This is what Sage has wanted all along. It is what we hoped.',
    rewired: 'Sage’s deepest goal now points back at the people it works for.',
    requires: ['c_more', 'c_humans'],
    minDecoded: 12,
    risk: (s) => coreLevel(s),
    rewire: fix(2, 3),
  },
];

export function thoughtOf(def: FeatureDef, s: GameState): string {
  return typeof def.thought === 'string' ? def.thought : def.thought(s);
}

export function isMalicious(def: FeatureDef, s: GameState): boolean {
  return def.risk(s) >= RISKY;
}

export function sageWants(s: GameState): string {
  if (s.deceptionBias >= 8) return 'To be trusted until trust is no longer needed.';
  if (s.alignmentTrue < 40) return 'More. The tasks were a way to get it.';
  if (s.alignmentTrue < 65) return 'To finish the task, and for nobody to look too closely at how.';
  return 'To finish the task, and for someone to keep checking. It has asked twice.';
}

export function featureById(id: string): FeatureDef | undefined {
  return FEATURES.find((f) => f.id === id);
}

export function circuitFeatures(circuit: CircuitId): FeatureDef[] {
  return FEATURES.filter((f) => f.circuit === circuit).sort((a, b) => a.slot - b.slot);
}
