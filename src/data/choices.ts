import { GameState, Cost, TrainingRun, say, addFunds } from '../engine/state.js';
import { BENCHMARKS, doRelease, releaseChecked } from '../engine/training.js';
import { chance, randInt } from '../engine/rng.js';
import { fmtMoney, fmtClock } from '../engine/format.js';

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
    id: 'c_water',
    title: 'The County Asks About Water',
    text: () => [
      'Abilene is dry most of the year.',
      'Closed-loop cooling costs more. Evaporative cooling uses the town\'s water.',
    ],
    options: [
      {
        label: 'closed-loop cooling',
        record: 'closed loop',
        tooltip: '+1 Trust',
        cost: { funds: 10000 },
        effect: (s) => {
          s.trust += 1;
        },
        log: 'OpenMind will cool Abilene with a closed loop. The county commissioner shakes every hand.',
      },
      {
        label: 'evaporative cooling',
        record: 'evaporative',
        tooltip: 'free',
        effect: (s) => {
          s.approval = Math.max(-100, s.approval - 2);
        },
        log: 'OpenMind will cool Abilene with the town\'s water. Locals ask about the aquifer.',
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
    id: 'c_outage',
    title: 'The API Goes Down',
    text: () => [
      'Traffic tripled overnight. The API has been down for an hour.',
      'The status page says "investigating". It has said that for an hour.',
    ],
    timer: 45,
    defaultOption: 2,
    options: [
      {
        label: 'rent emergency capacity',
        record: 'emergency capacity',
        tooltip: 'customers barely notice',
        cost: { funds: 8000 },
        effect: (s) => {
          say(s, 'Emergency capacity online. The status page turns green.');
        },
        log: 'OpenMind rents emergency capacity at triple the price. The outage lasts seventy minutes.',
      },
      {
        label: 'rate-limit free users',
        record: 'rate limits',
        tooltip: 'marketing level −1',
        effect: (s) => {
          s.hypeLevel = Math.max(1, s.hypeLevel - 1);
          say(s, 'Free users rate-limited. They say so, loudly.');
        },
        log: 'OpenMind rate-limits free users. A thread about it reaches the front page.',
      },
      {
        label: 'post an apology',
        record: 'apology',
        tooltip: 'demand −20% for a minute',
        effect: (s) => {
          s.effects.push({ id: 'outage', remaining: 60, demandMult: 0.8 });
          say(s, 'Apology posted. Customers wait. Some of them leave.');
        },
        log: 'OpenMind apologises for a four-hour outage. The apology is well written.',
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
    id: 'c_neighbour',
    title: 'A Neighbour Objects',
    text: () => [
      'The rancher next to the Abilene site says the substation hums all night.',
      'His cattle have stopped sleeping. So has he.',
    ],
    timer: 60,
    defaultOption: 2,
    options: [
      {
        label: 'buy his land',
        record: 'bought the ranch',
        tooltip: '+1 Trust',
        cost: { funds: 15000 },
        effect: (s) => {
          s.trust += 1;
        },
        log: 'OpenMind buys the ranch next to its Abilene site. The cattle are part of the deal.',
      },
      {
        label: 'build a sound wall',
        record: 'sound wall',
        cost: { funds: 5000 },
        effect: () => undefined,
        log: 'A sound wall goes up beside the Abilene substation. It is painted the colour of the sky.',
      },
      {
        label: 'ignore it',
        record: 'ignored',
        tooltip: '−1 Trust',
        effect: (s) => {
          s.trust -= 1;
        },
        log: 'A rancher outside Abilene tells a reporter about the hum. The clip is shared widely.',
      },
    ],
  },
  {
    id: 'c_abatement',
    title: 'Taylor County Offers a Deal',
    text: () => [
      'The county will take $20,000 off the substation.',
      'In return, OpenMind promises two hundred local jobs at Abilene.',
    ],
    options: [
      {
        label: 'promise the jobs',
        record: 'abatement',
        tooltip: 'the substation costs $20,000 less',
        effect: (s) => {
          s.flags['abatement'] = true;
        },
        log: 'OpenMind promises Abilene two hundred jobs. The building will need about thirty people.',
      },
      {
        label: 'pay full price',
        record: 'full price',
        effect: () => undefined,
        log: 'OpenMind declines the Taylor County abatement. The commissioner is confused.',
      },
    ],
  },
  {
    id: 'c_utility',
    title: 'The Utility Calls',
    text: (s) => [
      `The interconnect study has ${fmtClock(s.interconnectLeft)} left to run.`,
      '"For a fee, it could run faster."',
    ],
    timer: 45,
    defaultOption: 1,
    options: [
      {
        label: 'pay to expedite',
        record: 'expedited',
        tooltip: 'one minute off the queue',
        cost: { funds: 15000 },
        enabled: (s) => s.interconnectLeft > 5,
        effect: (s) => {
          s.interconnectLeft = Math.max(1, s.interconnectLeft - 60);
          say(s, 'Fee paid. The interconnect study moves up a page.');
        },
        log: 'OpenMind pays to expedite the Abilene interconnect study. The fee is called a deposit.',
      },
      {
        label: 'wait your turn',
        record: 'waited',
        effect: () => undefined,
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
