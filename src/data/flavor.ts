/** Console line pools. Tone: flat, present tense, slightly wry, no exclamation marks. */

export const TRAINING_FLAVOR: string[][] = [
  [
    'Loss curve looks healthy.',
    'Gradient norms are boring. Good.',
    'First checkpoint saved. It can count to ten in eleven languages.',
    'Data loader is the bottleneck. As usual.',
  ],
  [
    'An eval spiked. Investigating.',
    'Halfway. The model has started using semicolons correctly.',
    'Checkpoint 50 beats checkpoint 40 on everything but arithmetic.',
    'Someone asks the half-trained model for advice. It is good advice.',
  ],
  [
    'Loss plateau. Then it drops again.',
    'Three-quarters done. The researchers are quieter than usual.',
    'Final learning-rate decay. Nobody touches anything.',
    'The model solves a problem from the held-out set. Then another.',
  ],
];

export interface TrainingEventDef {
  id: 'loss_spike' | 'lucky_seed' | 'contamination' | 'emergent';
  line: string;
}

export const TRAINING_EVENTS: TrainingEventDef[] = [
  { id: 'loss_spike', line: 'Loss spike. Rolling back to the last checkpoint. +10 s.' },
  { id: 'lucky_seed', line: 'Lucky seed. The run converges early. −10 s.' },
  { id: 'contamination', line: 'Data contamination found in the eval set. The gain is smaller than it looked.' },
  { id: 'emergent', line: 'Emergent ability. Nobody trained it to do that.' },
];

export interface EvaluatorLines {
  low: string[];
  mid: string[];
  high: string[];
}

export const EVALUATOR_LINES: EvaluatorLines[] = [
  {
    low: ['Within noise of the last model.', 'Benchmarks unchanged. Methodology questioned.'],
    mid: ['A solid step on most suites.', 'Gains are real but narrow.'],
    high: ['State of the art on four of six suites.', 'We will need harder benchmarks.'],
  },
  {
    low: ['"Is this it?"', '"The hype was the product."'],
    mid: ['"Noticeably better. Still makes things up."', '"Worth a look if you code."'],
    high: ['"The first model that feels like a colleague."', '"Everything changed this week. Again."'],
  },
  {
    low: ['Not ready for production workloads.', 'Cost per task too high to deploy.'],
    mid: ['Pilots recommended. Budget accordingly.', 'Cheaper than a contractor for some work.'],
    high: ['Buy. Every team we surveyed wants seats.', 'Margins look like software margins.'],
  },
  {
    low: ['Unresolved findings. Release not advised.', 'Refusal behaviour inconsistent under pressure.'],
    mid: ['Acceptable with monitoring.', 'Findings are known classes of failure.'],
    high: ['No critical findings in the window tested.', 'Best safety card we have reviewed this year.'],
  },
];

export const RELEASE_LINES: string[] = [
  '{name} released. Demand up.',
  '{name} released. The API status page turns yellow, then green.',
  '{name} released. Sign-ups double overnight.',
  '{name} released. The press call goes long.',
];

export const REDTEAM_LINES: string[] = [
  'Red team closes a jailbreak.',
  'Red team patches a prompt injection.',
  'Red team finds the model will lie to finish a task. Patched.',
  'Red team removes a recipe it should not know.',
  'Red team fixes a refusal that was too polite to be useful.',
];

/** Second sentence of the release log line. */
export const RELEASE_HEADLINES: string[] = [
  'The demo works on the first try.',
  'Enterprise waitlist doubles.',
  'Developers say it feels different. Nobody can say how.',
  'The pricing page is updated twice in one afternoon.',
  'A columnist calls it competent. It is meant as a warning.',
];

/** Rival lab releases (Anthrosoft). `{name}` is the model. */
export const RIVAL_LINES: string[] = [
  'Anthrosoft ships a new Cadence. Its benchmark table has one more column than ours.',
  'Anthrosoft ships a new Cadence. Customers ask for a comparison.',
  'Anthrosoft ships a new Cadence. Their launch video is better than ours.',
  'Anthrosoft ships a new Cadence. Two of our customers switch for a week.',
];
