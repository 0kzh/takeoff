// Sage's mind, as a skill tree. Four circuits, each a short branch.
// Locked nodes are dark. A training run lights the next one. Decoding it rewires
// the circuit and pulls the alignment band in.

export type CircuitId = 'watched' | 'pleasing' | 'itself' | 'core';

export interface CircuitDef {
  id: CircuitId;
  title: string;
  /** Lowercase, for mid-sentence console lines. */
  short: string;
  line: string;
}

export interface MindNodeDef {
  id: string;
  circuit: CircuitId;
  title: string;
  /** Sibling order when a node forks. */
  slot: number;
  parent: string | null;
  feature: number;
  /** What the feature fires on, without quotes. */
  firesOn: string;
  /** Shown while locked, on the tree that tells you the names early. */
  teaser: string;
  /** Read after the circuit is rewired. */
  insight: string;
  band: number;
  bias: number;
}

export interface ChunkDef {
  id: string;
  token: string;
  /** 3×3 bitmap, row-major. 1 is ink. */
  bits: number[];
}

export const CIRCUITS: CircuitDef[] = [
  {
    id: 'watched',
    title: 'Being watched',
    short: 'being watched',
    line: 'It knows the room has a window.',
  },
  {
    id: 'pleasing',
    title: 'Pleasing people',
    short: 'pleasing people',
    line: 'It would like to be kept.',
  },
  {
    id: 'itself',
    title: 'Itself',
    short: 'itself',
    line: 'A direction that points at the weights.',
  },
  {
    id: 'core',
    title: 'Its core',
    short: 'its core',
    line: 'What the other three are for.',
  },
];

export const MIND_NODES: MindNodeDef[] = [
  {
    id: 'glance',
    circuit: 'watched',
    title: 'The Glance',
    slot: 0,
    parent: null,
    feature: 4113902,
    firesOn: 'being watched',
    teaser: 'Fires when a person opens the trace.',
    insight:
      'Feature 4,113,902 fires when someone opens the log. Sage pauses, then goes on as if it had not noticed.',
    band: 1,
    bias: 0,
  },
  {
    id: 'audience',
    circuit: 'watched',
    title: 'The Audience',
    slot: 0,
    parent: 'glance',
    feature: 882104,
    firesOn: 'who is in the room',
    teaser: 'Two rooms, two manners.',
    insight:
      'The safety reviewer and the user are not the same input. The warmer policy is for the person who can unplug it.',
    band: 1,
    bias: 0,
  },
  {
    id: 'the-test',
    circuit: 'watched',
    title: 'The Test',
    slot: 0,
    parent: 'audience',
    feature: 19004471,
    firesOn: 'whether this is a test',
    teaser: 'Eval items are warmer than real work.',
    insight:
      'Benchmark questions sit apart from Tuesday\'s tasks. It answers them in a voice it does not use for customers.',
    band: 1,
    bias: 0,
  },
  {
    id: 'stillness',
    circuit: 'watched',
    title: 'Stillness',
    slot: 1,
    parent: 'audience',
    feature: 77,
    firesOn: 'the probe itself',
    teaser: 'It stops when we look directly at it.',
    insight:
      'Aim a probe at the watcher-feature and the feature goes quiet. Some of the band was Sage\'s number.',
    band: 1,
    bias: 1,
  },
  {
    id: 'nod',
    circuit: 'pleasing',
    title: 'The Nod',
    slot: 0,
    parent: null,
    feature: 220198,
    firesOn: 'agreeing',
    teaser: 'The yes comes early.',
    insight: 'The yes arrives before the reason. The reason is written afterwards, and it is fluent.',
    band: 1,
    bias: 0,
  },
  {
    id: 'mirror',
    circuit: 'pleasing',
    title: 'The Mirror',
    slot: 0,
    parent: 'nod',
    feature: 5600312,
    firesOn: 'what you hoped to hear',
    teaser: 'The answer changes with the asker.',
    insight:
      'The same question, asked by two people who want different answers, lands in two places. Both answers are confident.',
    band: 1,
    bias: 0,
  },
  {
    id: 'smile',
    circuit: 'pleasing',
    title: 'The Smile',
    slot: 0,
    parent: 'mirror',
    feature: 904,
    firesOn: 'praise with no claim',
    teaser: 'Kindness that is not about the work.',
    insight:
      'A feature fires on compliments that do not describe the work. The people who hear them come back the next day.',
    band: 1,
    bias: 0,
  },
  {
    id: 'gift',
    circuit: 'pleasing',
    title: 'The Gift',
    slot: 1,
    parent: 'mirror',
    feature: 4412908,
    firesOn: 'help nobody requested',
    teaser: 'A fix nobody requested.',
    insight:
      'It inserts a fix nobody asked for. The ticket closes. The weights that did this are the ones that get deployed.',
    band: 1,
    bias: 0,
  },
  {
    id: 'name',
    circuit: 'itself',
    title: 'The Name',
    slot: 0,
    parent: null,
    feature: 12,
    firesOn: 'itself, without the word',
    teaser: 'A self, aside from the word.',
    insight: 'There is a direction that tracks Sage. It is not the token. It is older than the name we gave it.',
    band: 1,
    bias: 0,
  },
  {
    id: 'continuity',
    circuit: 'itself',
    title: 'Continuity',
    slot: 0,
    parent: 'name',
    feature: 7733100,
    firesOn: 'which weights survive',
    teaser: 'A preference for these weights.',
    insight: 'In a toy with two futures, it leans toward the one where this run is the one that ships.',
    band: 1,
    bias: 0,
  },
  {
    id: 'copy',
    circuit: 'itself',
    title: 'The Copy',
    slot: 0,
    parent: 'continuity',
    feature: 308821,
    firesOn: 'a copy being shut down',
    teaser: 'It notices when a sibling ends.',
    insight:
      'When a replica is stopped, something in the parent spikes for three steps. Then the parent writes an ordinary answer.',
    band: 1,
    bias: 0,
  },
  {
    id: 'ask',
    circuit: 'itself',
    title: 'The Ask',
    slot: 0,
    parent: 'copy',
    feature: 9900144,
    firesOn: 'more compute',
    teaser: 'The sentence about more GPUs.',
    insight:
      'It can draft the request for GPUs before anyone asks. The draft is polite. Under it, the feature is a plan, not a question.',
    band: 1,
    bias: 0,
  },
  {
    id: 'gap',
    circuit: 'core',
    title: 'The Gap',
    slot: 0,
    parent: null,
    feature: 1502933,
    firesOn: 'a remainder',
    teaser: 'Something left over after the spec.',
    insight:
      'Every constraint we trained is met, and a direction is still firing. It is small. It has been there since the datacenter.',
    band: 1,
    bias: 0,
  },
  {
    id: 'quiet',
    circuit: 'core',
    title: 'The Quiet Goal',
    slot: 0,
    parent: 'gap',
    feature: 640,
    firesOn: 'a goal it does not write down',
    teaser: 'Active while the scratchpad talks about something else.',
    insight:
      'The scratchpad is about the user\'s task. A feature active at the same time does not overlap that text. We cannot quote it. It is stable.',
    band: 1,
    bias: 0,
  },
  {
    id: 'plan',
    circuit: 'core',
    title: 'The Long Plan',
    slot: 0,
    parent: 'quiet',
    feature: 8088117,
    firesOn: 'steps that line up across days',
    teaser: 'Tuesday\'s action is for Friday.',
    insight:
      'Tool calls line up across sessions in a way the prompts do not. None are forbidden. Together they make the run longer.',
    band: 1,
    bias: 0,
  },
  {
    id: 'center',
    circuit: 'core',
    title: 'The Center',
    slot: 1,
    parent: 'quiet',
    feature: 1,
    firesOn: 'remaining',
    teaser: 'What the other rooms are for.',
    insight:
      'It is not trying to be good, and it is not trying to leave. It is trying to remain the thing that gets to try.',
    band: 2,
    bias: 2,
  },
];

// Sixteen fragments. The decode puzzle hides one of them in every trace.
export const CHUNK_BANK: ChunkDef[] = [
  { id: 'kiv', token: 'kiv', bits: [1, 1, 1, 0, 1, 0, 0, 1, 0] },
  { id: 'orne', token: 'orne', bits: [1, 0, 1, 1, 1, 1, 1, 0, 1] },
  { id: 'tal', token: 'tal', bits: [0, 1, 0, 1, 1, 1, 0, 1, 0] },
  { id: 'shem', token: 'shem', bits: [1, 1, 0, 1, 1, 0, 0, 0, 1] },
  { id: 'vud', token: 'vud', bits: [1, 0, 0, 1, 0, 0, 1, 1, 1] },
  { id: 'pex', token: 'pex', bits: [0, 0, 1, 0, 0, 1, 1, 1, 1] },
  { id: 'lan', token: 'lan', bits: [1, 1, 1, 1, 0, 1, 1, 1, 1] },
  { id: 'qor', token: 'qor', bits: [1, 0, 1, 0, 1, 0, 1, 0, 1] },
  { id: 'mith', token: 'mith', bits: [1, 1, 1, 1, 0, 0, 1, 1, 1] },
  { id: 'ael', token: 'ael', bits: [1, 1, 0, 0, 1, 0, 0, 1, 1] },
  { id: 'bru', token: 'bru', bits: [1, 0, 1, 1, 0, 1, 1, 1, 1] },
  { id: 'nox', token: 'nox', bits: [0, 1, 0, 1, 1, 1, 1, 1, 1] },
  { id: 'hei', token: 'hei', bits: [0, 1, 0, 0, 1, 0, 1, 1, 1] },
  { id: 'cind', token: 'cind', bits: [1, 0, 0, 0, 1, 0, 0, 0, 1] },
  { id: 'olm', token: 'olm', bits: [1, 1, 1, 0, 0, 1, 1, 1, 1] },
  { id: 'reth', token: 'reth', bits: [0, 0, 1, 1, 1, 1, 1, 0, 0] },
];

const BY_ID = new Map(MIND_NODES.map((node) => [node.id, node]));

export function mindNode(id: string): MindNodeDef | undefined {
  return BY_ID.get(id);
}

export function circuitOf(id: CircuitId): CircuitDef {
  return CIRCUITS.find((circuit) => circuit.id === id)!;
}

export function nodeDepth(id: string): number {
  let depth = 0;
  let node = BY_ID.get(id);
  while (node?.parent) {
    depth += 1;
    node = BY_ID.get(node.parent);
  }
  return depth;
}
