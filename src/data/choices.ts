import { GameState, Cost, TrainingRun, say, addFunds } from '../engine/state.js';
import { BENCHMARKS, doRelease, releaseChecked } from '../engine/training.js';
import { chance, randInt } from '../engine/rng.js';
import { fmtMoney } from '../engine/format.js';

type Ctx = Record<string, number | string>;

export interface ChoiceOption {
  label: string;
  /** Short id recorded in the choice history and shown on the end screen. */
  record: string;
  tooltip?: string;
  cost?: Cost;
  enabled?: (s: GameState, ctx: Ctx) => boolean;
  effect: (s: GameState, ctx: Ctx) => void;
  /** Logged in italics in the Developments column. */
  log?: string | ((s: GameState, ctx: Ctx) => string);
}

/** An ADR-style modal: title, a few lines of text, 2–3 buttons. The game does not pause. */
export interface ChoiceDef {
  id: string;
  title: string;
  text: (s: GameState, ctx: Ctx) => string[];
  /** Seconds before `defaultOption` is chosen automatically. */
  timer?: number;
  /** A queued modal that no longer applies when its turn comes is dropped. */
  valid?: (s: GameState, ctx: Ctx) => boolean;
  defaultOption?: number;
  options: ChoiceOption[];
}

function runFor(s: GameState, ctx: Ctx): TrainingRun | undefined {
  const run = s.training.run;
  return run && run.id === ctx['runId'] ? run : undefined;
}

function runName(s: GameState, ctx: Ctx): string {
  return runFor(s, ctx)?.name ?? 'the model';
}

export const CHOICES: ChoiceDef[] = [
  {
    id: 'c_gamble',
    title: 'Can I try something?',
    text: (s, ctx) => [
      `A researcher has an idea for the ${runName(s, ctx)} run.`,
      '"It might work. It might also break a few things."',
    ],
    timer: 20,
    defaultOption: 1,
    valid: (s, ctx) => runFor(s, ctx)?.phase === 'training',
    options: [
      {
        label: 'let her try',
        record: 'gamble',
        tooltip: '500 research. Good odds of a benchmark tier; a miss adds red-team issues.',
        cost: { research: 500 },
        enabled: (s, ctx) => runFor(s, ctx)?.phase === 'training',
        effect: (s, ctx) => {
          const run = runFor(s, ctx);
          if (!run) return;
          const odds = Math.min(0.8, 0.45 + 0.05 * s.researchers);
          if (chance(s, odds)) {
            run.gamble = 'success';
            const bench = randInt(s, 0, BENCHMARKS.length - 1);
            run.benchBonus[bench]! += 1;
            run.gainBonus += 0.02;
            say(s, `It worked. ${BENCHMARKS[bench]} jumps a tier.`);
          } else {
            run.gamble = 'fail';
            run.extraIssues += randInt(s, 4, 6);
            s.hypeBoost = Math.max(1, s.hypeBoost - 0.2);
            say(s, 'It did not work. The red team has more to do.');
          }
        },
      },
      {
        label: 'not now',
        record: 'no gamble',
        effect: (s, ctx) => {
          const run = runFor(s, ctx);
          if (run) run.gamble = 'declined';
        },
      },
    ],
  },
  {
    id: 'c_sage2',
    title: 'Release Sage-2',
    text: (s, ctx) => [
      `${runName(s, ctx)} is twice as capable as Sage-1.`,
      'Public: revenue, hype, and scrutiny.',
      'Internal: research runs faster, and nobody outside knows how far ahead OpenMind is.',
    ],
    options: [
      {
        label: 'release publicly',
        record: 'public',
        tooltip: 'capability for customers, hype ×2, incidents if issues remain',
        effect: (s, ctx) => {
          s.flags['sage2Decided'] = true;
          const run = runFor(s, ctx);
          if (run) doRelease(s, run, true);
        },
        log: (s) => `${s.training.deployedName} is released to the public.`,
      },
      {
        label: 'keep it internal',
        record: 'internal',
        tooltip: 'research +25%, lead +1 month, customers keep the old model',
        effect: (s, ctx) => {
          s.flags['sage2Decided'] = true;
          const run = runFor(s, ctx);
          if (run) doRelease(s, run, false);
        },
        log: (s) => `${s.training.modelName} is kept for research. Customers are not told.`,
      },
    ],
  },
  {
    id: 'c_ship_issues',
    title: 'Ship With Open Issues?',
    text: (s, ctx) => {
      const n = Number(ctx['issues'] ?? 1);
      return [
        `${runName(s, ctx)} has ${n} open issue${n === 1 ? '' : 's'} the red team has not closed.`,
        'They ship with it. Customers tend to find them within a few minutes.',
      ];
    },
    options: [
      {
        label: 'release anyway',
        record: 'shipped issues',
        tooltip: 'incidents follow in 2–4 minutes; each cuts demand for a minute',
        effect: (s, ctx) => {
          s.flags['shipIssuesAsked'] = true;
          const run = runFor(s, ctx);
          if (run) releaseChecked(s, run);
        },
      },
      {
        label: 'keep red-teaming',
        record: 'red-teamed',
        effect: (s) => {
          s.flags['shipIssuesAsked'] = true;
        },
      },
    ],
  },
  {
    id: 'c_bridge',
    title: 'A Bridge Round',
    text: () => [
      'A fund offers $8,000 now, ahead of a proper round.',
      'It wants a board observer, and the observer wants a seat at every meeting.',
    ],
    timer: 60,
    defaultOption: 1,
    options: [
      {
        label: 'take the bridge',
        record: 'bridge',
        tooltip: '+$8,000, −1 Trust',
        effect: (s) => {
          addFunds(s, 8000);
          s.trust -= 1;
          say(s, 'Bridge closed. $8,000 and a new face at board meetings.');
        },
        log: 'OpenMind takes a bridge round. The observer takes notes on everything.',
      },
      {
        label: 'wait for a real round',
        record: 'no bridge',
        effect: () => undefined,
        log: 'OpenMind turns down a bridge round. The fund calls twice more.',
      },
    ],
  },
  {
    id: 'c_letter',
    title: 'An Open Letter',
    text: () => [
      'Two hundred researchers have signed a letter asking the labs to slow down.',
      'Eleven of them work here. A reporter asks whether OpenMind will sign.',
    ],
    timer: 60,
    defaultOption: 2,
    options: [
      {
        label: 'sign it',
        record: 'signed',
        tooltip: '+1 Trust, marketing level −1',
        effect: (s) => {
          s.trust += 1;
          s.hypeLevel = Math.max(1, s.hypeLevel - 1);
          s.alignmentTrue = Math.min(100, s.alignmentTrue + 1);
        },
        log: 'OpenMind signs the letter. Its training runs continue on schedule.',
      },
      {
        label: 'publish a rebuttal',
        record: 'rebuttal',
        tooltip: 'marketing level +1, −1 Trust',
        effect: (s) => {
          s.hypeLevel += 1;
          s.trust -= 1;
        },
        log: 'OpenMind publishes a rebuttal: "the safest lab should be at the frontier." It is widely shared.',
      },
      {
        label: 'say nothing',
        record: 'silence',
        effect: () => undefined,
        log: 'OpenMind does not comment on the letter. The eleven signatories are asked to lunch.',
      },
    ],
  },
  {
    id: 'c_poach',
    title: 'A Better Offer',
    text: () => [
      'A larger lab has offered two of your researchers twice their salary.',
      'They would rather stay. They would also rather be paid.',
    ],
    timer: 60,
    defaultOption: 2,
    options: [
      {
        label: 'match the offer',
        record: 'matched',
        tooltip: 'both stay',
        cost: { funds: 12000 },
        effect: () => undefined,
        log: 'OpenMind matches an offer for two researchers. Salaries come up at lunch.',
      },
      {
        label: 'offer equity',
        record: 'equity',
        tooltip: 'both stay',
        cost: { trust: 1 },
        effect: () => undefined,
        log: 'Two OpenMind researchers take equity instead of a raise. They check the valuation daily.',
      },
      {
        label: 'let them go',
        record: 'let go',
        tooltip: '−2 researchers',
        effect: (s) => {
          s.researchers = Math.max(1, s.researchers - 2);
          say(s, 'Two researchers leave for a larger lab.');
        },
        log: 'Two OpenMind researchers leave for a larger lab. They take a whiteboard.',
      },
    ],
  },
  {
    id: 'c_leaderboard',
    title: 'The Leaderboard Wants Sage',
    text: (s) => [
      `The year-end leaderboard wants ${s.training.deployedName} on its hardware, on its tests.`,
      'Anthrosoft has already said yes.',
    ],
    timer: 60,
    defaultOption: 1,
    options: [
      {
        label: 'submit Sage',
        record: 'submitted',
        tooltip: 'ahead of Anthrosoft: marketing level +1. Behind: −1 Trust',
        effect: (s) => {
          const won = s.capability >= s.rivalCapability;
          s.flags['leaderboardWon'] = won;
          if (won) {
            s.hypeLevel += 1;
            say(s, `${s.training.deployedName} tops the year-end board. Marketing level +1.`);
          } else {
            s.trust -= 1;
            say(s, `${s.training.deployedName} places second, behind Cadence. Trust −1.`);
          }
        },
        log: (s) => (s.flags['leaderboardWon']
          ? `${s.training.deployedName} tops the year-end leaderboard. Two labs dispute the methodology.`
          : `${s.training.deployedName} places second on the year-end leaderboard. OpenMind disputes the methodology.`),
      },
      {
        label: 'decline',
        record: 'declined',
        effect: () => undefined,
        log: 'OpenMind declines the year-end leaderboard. Its row reads "declined to participate".',
      },
    ],
  },
  {
    id: 'c_rival',
    title: 'Open Weights',
    text: () => [
      'A rival has released a model as good as Sage, for free.',
      'The board wants a response by the end of the day.',
    ],
    timer: 60,
    defaultOption: 2,
    options: [
      {
        label: 'open-source Sage-1',
        record: 'open-sourced',
        tooltip: '+1 Trust, marketing level +1, lead −1 month',
        effect: (s) => {
          s.trust += 1;
          s.hypeLevel += 1;
          s.lead = Math.max(0, s.lead - 1);
        },
        log: 'OpenMind releases the weights of Sage-1. Downloads crash the mirror.',
      },
      {
        label: 'cut the price',
        record: 'price cut',
        tooltip: 'price −20%',
        effect: (s) => {
          s.price = Math.max(0.01, Math.round(s.price * 0.8 * 100) / 100);
        },
        log: 'OpenMind cuts prices by a fifth.',
      },
      {
        label: 'say nothing',
        record: 'silence',
        effect: () => undefined,
      },
    ],
  },
  {
    id: 'c_journalist',
    title: 'A Reporter Calls',
    text: (s) => [
      `The piece is about how ${s.training.deployedName} was tested.`,
      'She has a source on the red team.',
    ],
    timer: 60,
    defaultOption: 1,
    options: [
      {
        label: 'publish the system card',
        record: 'system card',
        tooltip: '1,500 research. +1 Trust, apparent alignment +2, government relations +2',
        cost: { research: 1500 },
        effect: (s) => {
          s.trust += 1;
          s.alignmentApparent = Math.min(100, s.alignmentApparent + 2);
          s.govRelations = Math.min(100, s.govRelations + 2);
        },
        log: 'OpenMind publishes a long system card. The piece runs anyway, shorter.',
      },
      {
        label: 'no comment',
        record: 'no comment',
        tooltip: 'marketing level +1, government relations −2',
        effect: (s) => {
          s.hypeLevel += 1;
          s.govRelations = Math.max(0, s.govRelations - 2);
        },
        log: '"OpenMind declined to comment." The piece is shared widely.',
      },
    ],
  },
  {
    id: 'c_customer_email',
    title: 'A Customer Writes',
    text: (_s, ctx) => {
      const amount = Number(ctx['amount'] ?? 25);
      return amount >= 25
        ? ['"Your model saved our quarter."', `"We would like to pay for a year up front. ${fmtMoney(amount)}, if that works."`]
        : ['"Your model did my homework."', `"I would like to tip. ${fmtMoney(amount)}, if that works."`];
    },
    options: [
      {
        label: 'accept',
        record: 'prepayment',
        effect: (s, ctx) => {
          const amount = Number(ctx['amount'] ?? 25);
          addFunds(s, amount);
          say(s, `Prepayment received. ${fmtMoney(amount)}.`);
        },
      },
      {
        label: 'ask for a case study',
        record: 'case study',
        tooltip: 'marketing level +1',
        effect: (s) => {
          s.hypeLevel += 1;
          say(s, 'Case study published. Marketing level up.');
        },
      },
    ],
  },
];
