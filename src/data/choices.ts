import { GameState, Cost, TrainingRun, say, addFunds, counter } from '../engine/state.js';
import { BENCHMARKS, doRelease, releaseChecked, runById } from '../engine/training.js';
import { chance, randInt, rand } from '../engine/rng.js';
import { fmtMoney, fmtMoneyShort, fmtNum } from '../engine/format.js';
import { s2, queueGulf } from '../engine/infrastructure.js';
import { moveGov, moveLead } from '../engine/world.js';
import { bestCapability } from '../engine/economy.js';

type Ctx = Record<string, number | string>;

export interface ChoiceOption {
  label: string;
  /** Short id recorded in the choice history and shown on the end screen. */
  record: string;
  /** A function when it names a price that scales with the stage. */
  tooltip?: string | ((s: GameState) => string);
  cost?: Cost | ((s: GameState) => Cost);
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
  return runById(s, ctx['runId']);
}

const clamp100 = (v: number) => Math.min(100, Math.max(0, v));

/** Al-Marsa's price: $8M at scale 1, half again if the lab asked for a month. */
function gulfPrice(s: GameState): number {
  return s2(s.flags['gulfPremium'] === true ? 12000000 : 8000000);
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
      `${runName(s, ctx)} is twice the model Sage-1 was. It can hold a job for a day.`,
      'Public: customers get it, the market grows, the press reads every transcript.',
      'Internal: the research copies get it. Nobody outside knows how far ahead OpenMind is.',
    ],
    options: [
      {
        label: 'release publicly',
        record: 'public',
        tooltip: 'Market grows with capability. Release hype ×2. Open issues become incidents. Lead −0.15 months.',
        effect: (s, ctx) => {
          s.flags['sage2Decided'] = true;
          if (s.stage >= 2) s.revealed['releaseInternal'] = true;
          const run = runFor(s, ctx);
          if (run) doRelease(s, run, true);
        },
        log: (s) => `${s.training.deployedName} is released to the public.`,
      },
      {
        label: 'keep it internal',
        record: 'internal',
        tooltip: 'Research uses it at once; customers keep the old model. Lead +0.5 months. It will come out eventually.',
        effect: (s, ctx) => {
          s.flags['sage2Decided'] = true;
          if (s.stage >= 2) s.revealed['releaseInternal'] = true;
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
  // ---- Stage 2 (stage2.md §5.2): seven unprompted modals, ≥ 150 s apart ----
  {
    id: 'c_hearing',
    title: 'A Senate Hearing',
    text: () => [
      'The Commerce Committee wants to know what a "reliable agent" is and who it reports to.',
      'The hearing is on Thursday. It will be televised.',
    ],
    timer: 60,
    defaultOption: 1,
    options: [
      {
        label: 'testify candidly',
        record: 'testified',
        tooltip: 'Government relations +8, approval +3. The roadmap goes on the record: lead −0.5 months.',
        effect: (s) => {
          moveGov(s, 8);
          s.flags['candid'] = true;
          moveLead(s, -0.5);
          hearingDone(s);
        },
        log: 'OpenMind testifies for four hours. A senator asks the model a question directly. It answers.',
      },
      {
        label: 'send the lawyers',
        record: 'lawyers',
        tooltip: 'Government relations −5.',
        effect: (s) => {
          moveGov(s, -5);
          hearingDone(s);
        },
        log: 'OpenMind\'s counsel reads a statement. The committee schedules a second hearing.',
      },
      {
        label: 'bring a demo',
        record: 'demo',
        tooltip: '40,000 research. Marketing level +1, government relations +3.',
        cost: { research: 40000 },
        effect: (s) => {
          s.hypeLevel += 1;
          moveGov(s, 3);
          hearingDone(s);
        },
        log: 'The demo books a senator\'s flights live on camera. The clip is everywhere by dinner.',
      },
    ],
  },
  {
    id: 'c_publishers',
    title: 'The Publishers',
    text: () => [
      'The crawl is finished. There is no more public internet to read.',
      'Forty publishers have noticed where their archives went. They would like to talk.',
    ],
    options: [
      {
        label: 'license the archives',
        record: 'licensed',
        tooltip: () => `${fmtMoneyShort(s2(400000))}. +10 T of data now. Approval +2.`,
        cost: () => ({ funds: s2(400000) }),
        effect: (s) => {
          s.data += 10;
          s.flags['licensedPublishers'] = true;
          s.flags['publishersDone'] = true;
        },
        log: 'OpenMind signs licensing deals with forty publishers. The price per word is not disclosed.',
      },
      {
        label: 'fight it',
        record: 'fought',
        tooltip: '+5 T now. Government relations −3, approval −4. They will sue.',
        effect: (s) => {
          s.data += 5;
          moveGov(s, -3);
          s.flags['foughtPublishers'] = true;
          s.flags['publishersDone'] = true;
          s.scheduled.push({ id: 'cr_lawsuit', delay: rand(s, 180, 300) });
        },
        log: 'OpenMind calls its training fair use. Forty publishers call their lawyers.',
      },
      {
        label: 'write our own',
        record: 'synthetic',
        tooltip: 'No deal. Synthetic data costs half as much.',
        effect: (s) => {
          s.flags['synthHalf'] = true;
          s.flags['publishersDone'] = true;
        },
        log: 'OpenMind declines to license. "The model can write its own textbooks."',
      },
    ],
  },
  {
    id: 'c_gulf',
    title: 'Al-Marsa',
    text: () => [
      'A Gulf sovereign fund offers a finished site: one gigawatt, energised in weeks, no interconnect queue, no hearings.',
      'It is 300 km from the Strait of Hormuz. The fund asks for a board observer.',
    ],
    timer: 90,
    defaultOption: 1,
    options: [
      {
        label: 'sign for Al-Marsa',
        record: 'signed Al-Marsa',
        tooltip: (s) => `${fmtMoneyShort(gulfPrice(s))}. +1,000 MW in 2:00. Government relations −8, approval −3, lead −0.5 months. The site is abroad.`,
        cost: (s) => ({ funds: gulfPrice(s) }),
        effect: (s) => {
          queueGulf(s);
          moveGov(s, -8);
          moveLead(s, -0.5);
          s.flags['gulfSigned'] = true;
        },
        log: 'OpenMind signs for the Al-Marsa Compute Park. A gigawatt, and no questions.',
      },
      {
        label: 'domestic only',
        record: 'domestic',
        tooltip: 'Government relations +3. A nuclear PPA is offered now.',
        effect: (s) => {
          moveGov(s, 3);
          s.flags['gulfDeclined'] = true;
          s.revealed['nuclearButton'] = true;
        },
        log: 'OpenMind turns down a gigawatt in the Gulf. The fund calls Anthrosoft.',
      },
      {
        label: 'ask for a month',
        record: 'asked for a month',
        tooltip: () => `The offer returns once, at ${fmtMoneyShort(s2(12000000))}.`,
        enabled: (s) => s.flags['gulfPremium'] !== true,
        effect: (s) => {
          s.flags['gulfPremium'] = true;
          s.flags['gulfReturnAt'] = s.stats.timePlayed + 210;
        },
      },
    ],
  },
  {
    id: 'c_evals_month',
    title: 'A Month of Evals',
    text: (s) => [
      `Three researchers on the alignment team ask for a month with ${s.training.deployedName} before the next run.`,
      '"We can\'t tell whether it follows the Spec or has learned what following the Spec looks like."',
    ],
    timer: 45,
    defaultOption: 1,
    options: [
      {
        label: 'give them the month',
        record: 'month',
        tooltip: 'The next run cannot start for 60 s. Alignment (as measured) +2. They will remember.',
        effect: (s) => {
          s.training.cooldown = Math.max(s.training.cooldown, 60);
          s.alignmentApparent = clamp100(s.alignmentApparent + 2);
          s.alignmentTrue = clamp100(s.alignmentTrue + 4);
          s.flags['whistleblowRisk'] = Math.max(0, counter(s, 'whistleblowRisk') - 1);
          say(s, 'Evaluation month — 1:00 until the next run may start.');
        },
        log: 'OpenMind pauses training for a month of evaluations. Anthrosoft ships in the gap.',
      },
      {
        label: 'give them a week',
        record: 'week',
        tooltip: 'The next run cannot start for 15 s.',
        effect: (s) => {
          s.training.cooldown = Math.max(s.training.cooldown, 15);
          s.alignmentTrue = clamp100(s.alignmentTrue + 1);
          say(s, 'Evaluation week — 0:15 until the next run may start.');
        },
        log: 'The alignment team gets a week. They use all of it.',
      },
      {
        label: 'not now',
        record: 'not now',
        tooltip: 'No delay.',
        effect: (s) => {
          s.alignmentTrue = clamp100(s.alignmentTrue - 1);
          s.flags['whistleblowRisk'] = counter(s, 'whistleblowRisk') + 1;
        },
        log: 'Three alignment researchers ask for time. They are thanked.',
      },
    ],
  },
  {
    id: 'c_defense',
    title: 'The Pentagon Calls',
    text: () => [
      'The Department of Defense wants Sage for cyber, analysis and logistics. The contract runs ten years.',
      'Payment arrives whether or not anyone uses it.',
    ],
    timer: 90,
    defaultOption: 1,
    valid: (s) => s.govRelations >= 40,
    options: [
      {
        label: 'sign the contract',
        record: 'signed',
        tooltip: 'Revenue +12 % for good. Government relations +15, lead +0.5 months, approval −8. The government becomes a customer it will not want to lose.',
        effect: (s) => {
          s.flags['defenseContract'] = true;
          s.revenueMult *= 1.12;
          moveGov(s, 15);
          moveLead(s, 0.5);
        },
        log: 'OpenMind signs a ten-year contract with the Pentagon. Two researchers resign by email.',
      },
      {
        label: 'decline',
        record: 'declined',
        tooltip: 'Government relations −5, approval +3.',
        effect: (s) => {
          moveGov(s, -5);
          s.flags['declinedDefense'] = true;
        },
        log: 'OpenMind declines defense work. The Pentagon calls Anthrosoft.',
      },
    ],
  },
  {
    id: 'c_theft_warning',
    title: '4 a.m.',
    text: () => [
      'A traffic-monitoring agent flags a 40 GB transfer leaving Abilene at 4 a.m. It is stopped at the firewall.',
      'The checkpoint is 3 TB. Somebody was taking it in pieces. At SL3 they could not have started.',
    ],
    timer: 60,
    defaultOption: 2,
    valid: (s) => s.securityLevel < 3,
    options: [
      {
        label: 'lock it down',
        record: 'locked down',
        tooltip: 'Research stops for 45 s while every credential is rotated. Security level 3 is 25 % off for 5 minutes.',
        effect: (s) => {
          s.effects.push({ id: 'lockdown', remaining: 45, demandMult: 1, researchMult: 0 });
          s.flags['sl3DiscountUntil'] = s.stats.timePlayed + 300;
          s.revealed['sl3Button'] = true;
        },
        log: 'An intrusion at Abilene is stopped at the firewall. Every password in the building changes.',
      },
      {
        label: 'call the Bureau',
        record: 'called the Bureau',
        tooltip: 'Government relations +5, lead +0.5 months. Research −20 % for 90 s while agents sit in the office.',
        effect: (s) => {
          moveGov(s, 5);
          moveLead(s, 0.5);
          s.effects.push({ id: 'bureau', remaining: 90, demandMult: 1, researchMult: 0.8 });
          s.revealed['sl3Button'] = true;
        },
        log: 'The FBI opens a counterintelligence file on OpenMind\'s behalf.',
      },
      {
        label: 'review it quietly',
        record: 'reviewed quietly',
        tooltip: 'Nothing changes today. Lead −0.5 months.',
        effect: (s) => {
          moveLead(s, -0.5);
          s.flags['theftIgnored'] = true;
          s.revealed['sl3Button'] = true;
        },
        log: 'A security incident at OpenMind is reviewed internally. No report is filed.',
      },
    ],
  },
  {
    id: 'c_pact',
    title: 'A Joint Statement',
    text: (s) => [
      'Anthrosoft proposes a joint pledge: no model above 4× is released without an outside evaluation.',
      `Their Cadence line is at ${fmtNum(s.rivalCapability, 2)}×. Sage is at ${fmtNum(bestCapability(s), 2)}×.`,
    ],
    timer: 90,
    defaultOption: 1,
    options: [
      {
        label: 'sign it',
        record: 'signed',
        tooltip: 'Approval +5, government relations +5. Releases from 4× up wait 30 s for the evaluator.',
        effect: (s) => {
          s.flags['pactSigned'] = true;
          moveGov(s, 5);
          s.revealed['shareEvals'] = true;
        },
        log: 'OpenMind and Anthrosoft pledge outside evaluations above the superhuman-coder line. Baiwen is not asked.',
      },
      {
        label: 'decline',
        record: 'declined',
        tooltip: 'Anthrosoft publishes the letter anyway. Approval −2.',
        effect: (s) => {
          s.flags['pactDeclined'] = true;
          s.revealed['shareEvals'] = true;
        },
        log: 'Anthrosoft publishes a pledge. One signature line is empty.',
      },
    ],
  },
];

/** Every answer to the hearing puts the government on the board. */
function hearingDone(s: GameState): void {
  s.flags['hearingDone'] = true;
  s.revealed['government'] = true;
}

