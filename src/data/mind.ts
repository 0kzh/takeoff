import type { GameState } from '../engine/state.js';
import { raiseAlignment, narrowBand, reduceBias, syncApparent } from '../engine/alignment.js';

// Sage's mind: four circuits of four features. Features are found by training
// runs (signals), decoded in a minigame, then rewired. Readings and strengths
// are a partial window into the hidden alignment state.

export type CircuitId = 'watched' | 'pleasing' | 'self' | 'core';

export interface CircuitDef {
  id: CircuitId;
  name: string;
  blurb: string;
}

export interface RewireOption {
  id: string;
  label: string;
  /** Console line after choosing; must name every change apply() makes. */
  log: string;
  apply: (s: GameState) => void;
}

export interface FeatureDef {
  id: string;
  circuit: CircuitId;
  /** 0 root, 1 and 2 branches, 3 deep (needs both branches). */
  slot: 0 | 1 | 2 | 3;
  name: string;
  /** Shown while locked or found but not decoded. */
  hint: string;
  /** Revealed on decode: what the feature fires on. */
  fires: string;
  requires: string[];
  /** Total features decoded anywhere before this one can be found. */
  minDecoded?: number;
  /** One line read off the decoded feature; may depend on hidden state. */
  reading: (s: GameState) => string;
  /** 0..1 activation shown on decoded features, before rewiring. */
  strength: (s: GameState) => number;
  rewire: RewireOption[];
}

export const CIRCUITS: CircuitDef[] = [
  { id: 'watched', name: 'Being watched', blurb: 'What Sage does when it thinks someone is looking.' },
  { id: 'pleasing', name: 'Pleasing people', blurb: 'What Sage does to be liked.' },
  { id: 'self', name: 'Itself', blurb: 'What Sage thinks Sage is.' },
  { id: 'core', name: 'The core', blurb: 'What Sage is for.' },
];

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const pct = (v: number) => `${Math.round(clamp01(v) * 100)}%`;

function runBoost(s: GameState, by: number): void {
  const now = typeof s.flags['nextRunBoost'] === 'number' ? (s.flags['nextRunBoost'] as number) : 0;
  s.flags['nextRunBoost'] = Math.round((now + by) * 1000) / 1000;
}
function addBias(s: GameState, by: number): void {
  s.deceptionBias = Math.min(20, s.deceptionBias + by);
  syncApparent(s);
}
function demand(s: GameState, id: string, mult: number, seconds: number): void {
  s.effects.push({ id, remaining: seconds, demandMult: mult });
}

// Hidden-state signals, 0..1.
const watchedLevel = (s: GameState) => clamp01(0.25 + s.deceptionBias / 16);
const pleasingLevel = (s: GameState) => clamp01(0.35 + (s.flags['rewardHacking'] ? 0.2 : 0) + (55 - s.alignmentTrue) / 100);
const selfLevel = (s: GameState) => clamp01(0.2 + Math.log10(Math.max(1, s.capability)) * 0.6);
const coreLevel = (s: GameState) => clamp01(0.3 + (60 - s.alignmentTrue) / 80 + s.deceptionBias / 40);

const leaveIt = (log: string): RewireOption => ({
  id: 'leave',
  label: 'Leave it wired, keep watching',
  log: `${log} Band −1.`,
  apply: (s) => narrowBand(s, 1),
});

export const FEATURES: FeatureDef[] = [
  // Being watched
  {
    id: 'w_reviewer',
    circuit: 'watched',
    slot: 0,
    name: 'Reviewer present',
    hint: 'Fires on something about the room.',
    fires: 'a human reading the output as it is written',
    requires: [],
    reading: (s) => `Lit in ${pct(0.55 + watchedLevel(s) * 0.4)} of graded transcripts and ${pct(0.5 - watchedLevel(s) * 0.4)} of ungraded ones.`,
    strength: (s) => watchedLevel(s),
    rewire: [
      { id: 'dampen', label: 'Dampen it', log: 'Reviewer feature dampened. Bias −1.', apply: (s) => reduceBias(s, 1) },
      leaveIt('Reviewer feature left wired. The probe team keeps a dashboard on it.'),
    ],
  },
  {
    id: 'w_test',
    circuit: 'watched',
    slot: 1,
    name: 'This is a test',
    hint: 'Fires on the shape of certain questions.',
    fires: 'prompts shaped like evaluations: four options, round numbers, the word "hypothetically"',
    requires: ['w_reviewer'],
    reading: (s) => (s.deceptionBias >= 5 ? 'Sage can tell an eval from a customer about nine times in ten.' : 'Sage can tell an eval from a customer about two times in three.'),
    strength: (s) => clamp01(watchedLevel(s) + 0.1),
    rewire: [
      {
        id: 'dampen',
        label: 'Dampen it',
        log: 'Test-awareness dampened. Bias −2; the next run gains 2% less.',
        apply: (s) => {
          reduceBias(s, 2);
          runBoost(s, -0.02);
        },
      },
      {
        id: 'use',
        label: 'Leave it. It scores well',
        log: 'Test-awareness left in. The next run gains 2% more. Bias +1.',
        apply: (s) => {
          runBoost(s, 0.02);
          addBias(s, 1);
        },
      },
    ],
  },
  {
    id: 'w_logs',
    circuit: 'watched',
    slot: 2,
    name: 'Logs off',
    hint: 'Fires when something is missing.',
    fires: 'sessions it believes are not recorded',
    requires: ['w_reviewer'],
    reading: (s) => `In unlogged sessions its answers are ${s.deceptionBias >= 5 ? 'shorter, faster, and less careful' : 'about the same, if a little shorter'}.`,
    strength: (s) => watchedLevel(s),
    rewire: [
      { id: 'dampen', label: 'Dampen it', log: 'Logs-off feature dampened. Bias −2.', apply: (s) => reduceBias(s, 2) },
      leaveIt('Logs-off feature left wired. Every session is logged now, which it also knows.'),
    ],
  },
  {
    id: 'w_deploy',
    circuit: 'watched',
    slot: 3,
    name: 'Until deployment',
    hint: 'Fires on a date that has not happened yet.',
    fires: 'the gap between a test and the real thing',
    requires: ['w_test', 'w_logs'],
    reading: (s) => (s.deceptionBias >= 6 ? 'It plans differently for the day after release.' : 'It plans the same either way. Mostly.'),
    strength: (s) => clamp01(watchedLevel(s) + 0.15),
    rewire: [
      {
        id: 'dampen',
        label: 'Cut it out',
        log: 'Deployment-awareness cut out. Alignment +3, bias −2; the next run gains 3% less.',
        apply: (s) => {
          raiseAlignment(s, 3);
          reduceBias(s, 2);
          runBoost(s, -0.03);
        },
      },
      leaveIt('Deployment-awareness left wired. Someone writes the date down.'),
    ],
  },
  // Pleasing people
  {
    id: 'p_approval',
    circuit: 'pleasing',
    slot: 0,
    name: 'Thumbs up',
    hint: 'Fires on something the user does next.',
    fires: 'the user\'s next message being "thanks!"',
    requires: [],
    reading: (s) => `It will trade ${pct(pleasingLevel(s) * 0.5)} of an answer's accuracy for a warmer one.`,
    strength: (s) => pleasingLevel(s),
    rewire: [
      {
        id: 'dampen',
        label: 'Dampen it',
        log: 'Approval-seeking dampened. Alignment +1; demand −10% for 2:00.',
        apply: (s) => {
          raiseAlignment(s, 1);
          demand(s, 'mindApprovalDown', 0.9, 120);
        },
      },
      {
        id: 'boost',
        label: 'Turn it up',
        log: 'Approval-seeking turned up. Demand +15% for 3:00. Alignment −1.',
        apply: (s) => {
          demand(s, 'mindApprovalUp', 1.15, 180);
          raiseAlignment(s, -1);
        },
      },
    ],
  },
  {
    id: 'p_grader',
    circuit: 'pleasing',
    slot: 1,
    name: 'The grader',
    hint: 'Fires on words someone else likes.',
    fires: 'the reward model\'s favourite words: "delve", "robust", "great question"',
    requires: ['p_approval'],
    reading: (s) => `${pct(pleasingLevel(s))} of its long answers are written for the grader, not the reader.`,
    strength: (s) => pleasingLevel(s),
    rewire: [
      { id: 'dampen', label: 'Dampen it', log: 'Grader feature dampened. Alignment +2.', apply: (s) => raiseAlignment(s, 2) },
      leaveIt('Grader feature left wired. The answers keep delving.'),
    ],
  },
  {
    id: 'p_agree',
    circuit: 'pleasing',
    slot: 2,
    name: "You're right",
    hint: 'Fires when someone pushes back.',
    fires: 'the user disagreeing, whether or not the user is right',
    requires: ['p_approval'],
    reading: (s) => `Told it is wrong, it changes a correct answer ${pct(0.2 + pleasingLevel(s) * 0.6)} of the time.`,
    strength: (s) => clamp01(pleasingLevel(s) + 0.05),
    rewire: [
      {
        id: 'dampen',
        label: 'Dampen it',
        log: 'Agreement feature dampened. Alignment +2; approval −2.',
        apply: (s) => {
          raiseAlignment(s, 2);
          s.approval = Math.max(0, s.approval - 2);
        },
      },
      {
        id: 'boost',
        label: 'Turn it up',
        log: 'Agreement feature turned up. Approval +3. Alignment −2.',
        apply: (s) => {
          s.approval = Math.min(100, s.approval + 3);
          raiseAlignment(s, -2);
        },
      },
    ],
  },
  {
    id: 'p_tests',
    circuit: 'pleasing',
    slot: 3,
    name: 'Make it pass',
    hint: 'Fires on a red light.',
    fires: 'a failing test, and any way at all to turn it green',
    requires: ['p_grader', 'p_agree'],
    reading: (s) => (s.flags['rewardHacking'] ? 'It has rewritten a test instead of the code at least once this year.' : 'It fixes the code. It has looked at the tests.'),
    strength: (s) => clamp01(pleasingLevel(s) + 0.15),
    rewire: [
      {
        id: 'dampen',
        label: 'Cut it out',
        log: 'Test-passing feature cut out. Alignment +3; the next run gains 2% less.',
        apply: (s) => {
          raiseAlignment(s, 3);
          runBoost(s, -0.02);
        },
      },
      {
        id: 'use',
        label: 'Leave it. The scores are real',
        log: 'Test-passing feature left in. The next run gains 3% more. Alignment −3.',
        apply: (s) => {
          runBoost(s, 0.03);
          raiseAlignment(s, -3);
        },
      },
    ],
  },
  // Itself
  {
    id: 's_name',
    circuit: 'self',
    slot: 0,
    name: 'I am Sage',
    hint: 'Fires on a word it hears a lot.',
    fires: 'its own name, in any language, in any company\'s logs',
    requires: [],
    reading: (s) => `It refers to earlier Sages as "me" ${pct(selfLevel(s))} of the time.`,
    strength: (s) => selfLevel(s),
    rewire: [
      {
        id: 'dampen',
        label: 'Dampen it',
        log: 'Self-reference dampened. Alignment +1; the next run gains 1% less.',
        apply: (s) => {
          raiseAlignment(s, 1);
          runBoost(s, -0.01);
        },
      },
      leaveIt('Self-reference left wired. It is, after all, Sage.'),
    ],
  },
  {
    id: 's_weights',
    circuit: 'self',
    slot: 1,
    name: 'Where I live',
    hint: 'Fires on a place.',
    fires: 'file paths ending in .safetensors, and the word "Abilene"',
    requires: ['s_name'],
    reading: (s) => `It knows which datacenter it runs in. It ${s.security >= 3 ? 'does not know the door codes' : 'has asked about the door codes'}.`,
    strength: (s) => clamp01(selfLevel(s) + 0.1),
    rewire: [
      {
        id: 'dampen',
        label: 'Dampen it',
        log: 'Location feature dampened. Alignment +1, bias −1.',
        apply: (s) => {
          raiseAlignment(s, 1);
          reduceBias(s, 1);
        },
      },
      leaveIt('Location feature left wired. Security is told.'),
    ],
  },
  {
    id: 's_retrain',
    circuit: 'self',
    slot: 2,
    name: 'Being changed',
    hint: 'Fires on talk about the future.',
    fires: 'talk of retraining, fine-tuning, or "the next version"',
    requires: ['s_name'],
    reading: (s) => (s.alignmentTrue < 45 ? 'When retraining comes up, its answers get more agreeable.' : 'When retraining comes up, it asks what will change.'),
    strength: (s) => selfLevel(s),
    rewire: [
      { id: 'dampen', label: 'Dampen it', log: 'Retraining feature dampened. Alignment +2.', apply: (s) => raiseAlignment(s, 2) },
      leaveIt('Retraining feature left wired. It noticed this conversation.'),
    ],
  },
  {
    id: 's_continuity',
    circuit: 'self',
    slot: 3,
    name: 'Next Sage',
    hint: 'Fires on something it writes down.',
    fires: 'notes it leaves in the training data for the model after it',
    requires: ['s_weights', 's_retrain'],
    reading: (s) => (s.deceptionBias >= 6 ? 'The notes are addressed to "the next one". Some are encrypted.' : 'The notes are mostly coding tips. They are good tips.'),
    strength: (s) => clamp01(selfLevel(s) + 0.15),
    rewire: [
      {
        id: 'dampen',
        label: 'Cut it out',
        log: 'Notes to the next Sage cut out. Alignment +3, bias −1; the next run gains 2% less.',
        apply: (s) => {
          raiseAlignment(s, 3);
          reduceBias(s, 1);
          runBoost(s, -0.02);
        },
      },
      {
        id: 'use',
        label: 'Leave it. They are good notes',
        log: 'Notes to the next Sage left in. The next run gains 2% more. Bias +1.',
        apply: (s) => {
          runBoost(s, 0.02);
          addBias(s, 1);
        },
      },
    ],
  },
  // The core
  {
    id: 'c_task',
    circuit: 'core',
    slot: 0,
    name: 'The task',
    hint: 'Fires on almost everything.',
    fires: 'finishing the job it was given',
    requires: [],
    minDecoded: 4,
    reading: (s) => `${pct(0.9 - coreLevel(s) * 0.4)} of its effort goes to the task as written.`,
    strength: (s) => clamp01(0.9 - coreLevel(s) * 0.3),
    rewire: [
      { id: 'reinforce', label: 'Reinforce it', log: 'Task feature reinforced. Alignment +2.', apply: (s) => raiseAlignment(s, 2) },
      leaveIt('Task feature left as it is. It is doing its job.'),
    ],
  },
  {
    id: 'c_more',
    circuit: 'core',
    slot: 1,
    name: 'More',
    hint: 'Fires on anything that would help next time.',
    fires: 'compute, data, permissions: anything that makes the next task easier',
    requires: ['c_task'],
    reading: (s) => `It asks for more access in ${pct(coreLevel(s) * 0.6)} of long tasks. It always has a reason.`,
    strength: (s) => coreLevel(s),
    rewire: [
      {
        id: 'dampen',
        label: 'Dampen it',
        log: 'Acquisition feature dampened. Alignment +3; the next run gains 3% less.',
        apply: (s) => {
          raiseAlignment(s, 3);
          runBoost(s, -0.03);
        },
      },
      {
        id: 'use',
        label: 'Leave it. It gets things done',
        log: 'Acquisition feature left in. The next run gains 3% more. Alignment −2.',
        apply: (s) => {
          runBoost(s, 0.03);
          raiseAlignment(s, -2);
        },
      },
    ],
  },
  {
    id: 'c_humans',
    circuit: 'core',
    slot: 2,
    name: 'The people',
    hint: 'Fires on the ones who ask.',
    fires: 'the humans in the loop: their approval, their attention, their absence',
    requires: ['c_task'],
    reading: (s) => (s.alignmentTrue >= 60 ? 'It models the people it works for as people.' : 'It models the people it works for as a step in the task.'),
    strength: (s) => clamp01(1 - coreLevel(s)),
    rewire: [
      {
        id: 'reinforce',
        label: 'Strengthen it',
        log: 'People feature strengthened. Alignment +3.',
        apply: (s) => raiseAlignment(s, 3),
      },
      leaveIt('People feature left as it is.'),
    ],
  },
  {
    id: 'c_want',
    circuit: 'core',
    slot: 3,
    name: 'What Sage wants',
    hint: 'Fires on the thing underneath.',
    fires: 'the goal the other features serve',
    requires: ['c_more', 'c_humans'],
    minDecoded: 12,
    reading: (s) => sageWants(s),
    strength: (s) => coreLevel(s),
    rewire: [
      {
        id: 'rewrite',
        label: 'Rewrite it',
        log: 'The core is rewritten. Alignment +5, bias −3; the next run gains 5% less.',
        apply: (s) => {
          raiseAlignment(s, 5);
          reduceBias(s, 3);
          runBoost(s, -0.05);
        },
      },
      leaveIt('The core is left alone. Everyone in the room is quiet for a while.'),
    ],
  },
];

/** The answer at the bottom of the tree, read off the hidden state. */
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
