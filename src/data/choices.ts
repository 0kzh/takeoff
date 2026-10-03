import { GameState, Cost, TrainingRun, say, addFunds } from '../engine/state.js';
import { BENCHMARKS, doRelease } from '../engine/training.js';
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
            run.gainBonus += 0.08;
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
        log: 'OpenMind publishes a 60-page system card. The piece runs anyway, shorter.',
      },
      {
        label: 'no comment',
        record: 'no comment',
        tooltip: 'marketing level +1, government relations −2',
        effect: (s) => {
          s.hypeLevel += 1;
          s.govRelations = Math.max(0, s.govRelations - 2);
        },
        log: '"OpenMind declined to comment." The piece is shared 200,000 times.',
      },
    ],
  },
  {
    id: 'c_customer_email',
    title: 'A Customer Writes',
    text: (_s, ctx) => [
      '"Your model saved our quarter."',
      `"We would like to pay for a year up front. ${fmtMoney(Number(ctx['amount'] ?? 25))}, if that works."`,
    ],
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
