import { GameState, Cost, TrainingRun, say, addFunds, counter } from '../engine/state.js';
import { BENCHMARKS, doRelease, releaseChecked, runById } from '../engine/training.js';
import { chance, randInt, rand } from '../engine/rng.js';
import { fmtMoney, fmtMoneyShort, fmtNum } from '../engine/format.js';
import { s2, queueGulf } from '../engine/infrastructure.js';
import { moveGov, moveLead } from '../engine/world.js';
import { bestCapability, researchRate } from '../engine/economy.js';
import { datacenterPrice } from './projects.js';
import { rivalRelease } from '../engine/events.js';

type Ctx = Record<string, number | string>;

export interface ChoiceOption {
  label: string | ((s: GameState) => string);
  record: string | ((s: GameState) => string);
  tooltip?: string | ((s: GameState, ctx: Ctx) => string);
  line?: string | ((s: GameState, ctx: Ctx) => string);
  needs?: string | ((s: GameState, ctx: Ctx) => string);
  cost?: Cost | ((s: GameState, ctx: Ctx) => Cost);
  enabled?: (s: GameState, ctx: Ctx) => boolean;
  visible?: (s: GameState, ctx: Ctx) => boolean;
  effect: (s: GameState, ctx: Ctx) => void;
  log?: string | ((s: GameState, ctx: Ctx) => string);
}

export interface ChoiceDef {
  id: string;
  title: string;
  text: (s: GameState, ctx: Ctx) => string[];
  timer?: number;
  valid?: (s: GameState, ctx: Ctx) => boolean;
  onOpen?: (s: GameState, ctx: Ctx) => void;
  defaultOption?: number | ((s: GameState, ctx: Ctx) => number);
  options: ChoiceOption[];
}

function runFor(s: GameState, ctx: Ctx): TrainingRun | undefined {
  return runById(s, ctx['runId']);
}

const clamp100 = (v: number) => Math.min(100, Math.max(0, v));

function gambleCost(s: GameState): number {
  return Math.max(500, twoFigures(60 * researchRate(s)));
}

function twoFigures(raw: number): number {
  const unit = Math.pow(10, Math.max(0, Math.floor(Math.log10(Math.max(1, raw))) - 1));
  return Math.ceil(raw / unit) * unit;
}



const ctxNum = (ctx: Ctx, k: string, d = 0) => (typeof ctx[k] === 'number' ? (ctx[k] as number) : Number(ctx[k] ?? d));

function scaleContracts(s: GameState, m: number): void {
  const now = typeof s.flags['contractTermsMult'] === 'number' ? (s.flags['contractTermsMult'] as number) : 1;
  s.flags['contractTermsMult'] = now * m;
}

function gambleOdds(s: GameState): number {
  return Math.min(0.8, 0.45 + 0.05 * s.researchers);
}

const LOCKDOWN_SECONDS = 60;
const BUREAU_SECONDS = 120;

function gulfPrice(s: GameState): number {
  const base = typeof s.flags['gulfBase'] === 'number' ? (s.flags['gulfBase'] as number) : gulfBaseNow(s);
  return s.flags['gulfPremium'] === true ? Math.round(base * 1.5) : base;
}

function gulfBaseNow(s: GameState): number {
  const raw = Math.max(s2(s, 1000000), 60 * s.stats.revPerSec);
  const unit = Math.pow(10, Math.floor(Math.log10(raw)) - 1);
  return Math.round(raw / unit) * unit;
}

function runName(s: GameState, ctx: Ctx): string {
  return runFor(s, ctx)?.name ?? 'the model';
}

const publishersLicence = (s: GameState): number => s2(s, 150000);

import { CHOICES3 } from './choices3.js';
import { CHOICES4 } from './choices4.js';
import { CHOICES5 } from './choices5.js';

export const CHOICES: ChoiceDef[] = [
  {
    id: 'c_gamble',
    title: 'Can I try something?',
    text: (s, ctx) => [
      `A researcher has an idea for the ${runName(s, ctx)} run.`,
      '"It might work. It might also break a few things."',
    ],
    timer: 20,
    defaultOption: 0,
    valid: (s, ctx) => runFor(s, ctx)?.phase === 'training',
    options: [
      {
        label: 'not now',
        record: 'no gamble',
        line: 'the run trains as planned',
        effect: (s, ctx) => {
          const run = runFor(s, ctx);
          if (run) run.gamble = 'declined';
        },
      },
      {
        label: 'let her try',
        record: 'gamble',
        tooltip: (s) => `${fmtNum(gambleCost(s), 0)} research. Good odds of a benchmark tier; a miss adds red-team issues.`,
        line: (s) => `${Math.round(100 * gambleOdds(s))}%: a benchmark tier · else more issues · ${fmtNum(gambleCost(s), 0)} research`,
        cost: (s) => ({ research: gambleCost(s) }),
        enabled: (s, ctx) => runFor(s, ctx)?.phase === 'training',
        effect: (s, ctx) => {
          const run = runFor(s, ctx);
          if (!run) return;
          const odds = gambleOdds(s);
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
    ],
  },
  {
    id: 'c_sage2',
    title: 'Release Sage-2',
    timer: 90,
    defaultOption: 0,
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
        line: 'market grows with it · +1 Trust · lead −0.15 months',
        effect: (s, ctx) => {
          s.flags['sage2Decided'] = true;
          if (s.stage >= 2) s.revealed['releaseInternal'] = true;
          const run = runFor(s, ctx);
          if (run) doRelease(s, run, true);
        },
        log: (s, ctx) => `${runFor(s, ctx)?.name ?? s.training.deployedName} is released to the public.`,
      },
      {
        label: 'keep it internal',
        record: 'internal',
        tooltip: 'Research uses it at once; customers keep the old model. Lead +0.5 months. It will come out eventually.',
        line: 'research ×1.25 · lead +0.5 months · customers keep the old model',
        effect: (s, ctx) => {
          s.flags['sage2Decided'] = true;
          if (s.stage >= 2) s.revealed['releaseInternal'] = true;
          const run = runFor(s, ctx);
          if (run) doRelease(s, run, false);
        },
        log: (s, ctx) => `${runFor(s, ctx)?.name ?? s.training.modelName} is kept for research. Customers are not told.`,
      },
    ],
  },
  {
    id: 'c_ship_issues',
    title: 'Ship With Open Issues?',
    timer: 60,
    defaultOption: 0,
    text: (s, ctx) => {
      const n = Number(ctx['issues'] ?? 1);
      return [
        `${runName(s, ctx)} has ${n} open issue${n === 1 ? '' : 's'} the red team has not closed.`,
        'They ship with it. Customers tend to find them within a few minutes.',
      ];
    },
    options: [
      {
        label: 'keep red-teaming',
        record: 'red-teamed',
        line: 'a clean release: +1 Trust',
        effect: (s) => {
          s.flags['shipIssuesAsked'] = true;
        },
      },
      {
        label: 'release anyway',
        record: 'shipped issues',
        tooltip: 'Incidents follow in 2–4 minutes: each cuts demand by 40% and pauses the contract customers for 1:30, and costs 1 Trust. No Trust for this release.',
        line: 'incidents in 2–4 min: each pauses the contracts 1:30 · no Trust',
        effect: (s, ctx) => {
          s.flags['shipIssuesAsked'] = true;
          const run = runFor(s, ctx);
          if (run) releaseChecked(s, run);
        },
      },
    ],
  },
  {
    id: 'c_bridge',
    title: 'A Bridge Round',
    onOpen: (s, ctx) => {
      if (!ctx['amount']) ctx['amount'] = Math.round((0.05 * datacenterPrice(s)) / 1000) * 1000;
    },
    text: (_s, ctx) => [
      `A fund offers ${fmtMoney(ctxNum(ctx, 'amount', 10000))} now, ahead of a proper round.`,
      'It wants a board observer, and the observer wants a say in which banks sign with OpenMind.',
    ],
    timer: 60,
    defaultOption: 0,
    options: [
      {
        label: 'wait for a real round',
        record: 'no bridge',
        tooltip: (_s, ctx) => `The Series A pays ${fmtMoney(ctxNum(ctx, 'amount', 10000))} more when it comes.`,
        line: (_s, ctx) => `the Series A pays ${fmtMoneyShort(ctxNum(ctx, 'amount', 10000))} more`,
        effect: (s, ctx) => {
          s.flags['seriesABonus'] = ctxNum(ctx, 'amount', 10000);
        },
        log: 'OpenMind turns down a bridge round. The fund calls twice more.',
      },
      {
        label: 'take the bridge',
        record: 'bridge',
        tooltip: (_s, ctx) => `+${fmtMoney(ctxNum(ctx, 'amount', 10000))} now. −1 Trust. The observer steers deals to the fund's portfolio: contract customers buy 30% less, for good.`,
        line: (_s, ctx) => `+${fmtMoneyShort(ctxNum(ctx, 'amount', 10000))} now · −1 Trust · contracts 30% smaller`,
        cost: { trust: 1 },
        effect: (s, ctx) => {
          addFunds(s, ctxNum(ctx, 'amount', 10000));
          scaleContracts(s, 0.7);
          say(s, `Bridge closed. ${fmtMoneyShort(ctxNum(ctx, 'amount', 10000))} and a new face at board meetings.`);
        },
        log: 'OpenMind takes a bridge round. The observer takes notes on everything.',
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
    defaultOption: 0,
    options: [
      {
        label: 'say nothing',
        record: 'silence',
        tooltip: 'Nothing changes.',
        line: 'nothing changes',
        effect: () => undefined,
        log: 'OpenMind does not comment on the letter. The eleven signatories are asked to lunch.',
      },
      {
        label: 'sign it',
        record: 'signed',
        tooltip: '+2 Trust: the eleven stay, and say so. Customers trust a lab that signs: demand +5% for good. True alignment +1.',
        line: '+2 Trust · demand +5% for good',
        effect: (s) => {
          s.trust += 2;
          s.demandMult *= 1.05;
          s.alignmentTrue = Math.min(100, s.alignmentTrue + 1);
        },
        log: 'OpenMind signs the letter. Its training runs continue on schedule.',
      },
      {
        label: 'publish a rebuttal',
        record: 'rebuttal',
        tooltip: 'Marketing level +1. Three of the eleven resign: −3 researchers.',
        line: 'marketing level +1 · −3 researchers',
        effect: (s) => {
          s.hypeLevel += 1;
          s.researchers = Math.max(1, s.researchers - 3);
          say(s, 'Three of the signatories resign. Researchers −3.');
        },
        log: 'OpenMind publishes a rebuttal: "the safest lab should be at the frontier." Three signatories resign.',
      },
    ],
  },
  {
    id: 'c_poach',
    title: 'A Better Offer',
    onOpen: (s, ctx) => {
      if (!ctx['price']) ctx['price'] = Math.max(2000, twoFigures(60 * s.stats.revPerSec));
    },
    text: (s) => [
      'A larger lab has offered two of your researchers twice their salary.',
      (s.projects['p_contract']?.bought ?? 0) > 0 ? 'They built the contract models. Their bank would follow them.' : 'They built the last two training runs.',
    ],
    timer: 60,
    defaultOption: 0,
    options: [
      {
        label: 'let them go',
        record: 'let go',
        tooltip: (s) => ((s.projects['p_contract']?.bought ?? 0) > 0 ? '−2 researchers, and the newest contract leaves with them.' : '−2 researchers.'),
        line: (s) => ((s.projects['p_contract']?.bought ?? 0) > 0 ? '−2 researchers · the newest contract leaves with them' : '−2 researchers'),
        effect: (s) => {
          s.researchers = Math.max(1, s.researchers - 2);
          const st = s.projects['p_contract'];
          if (st && st.bought > 0) {
            st.bought -= 1;
            say(s, 'Two researchers leave for a larger lab. Their bank follows them: one contract fewer.');
          } else {
            say(s, 'Two researchers leave for a larger lab.');
          }
        },
        log: 'Two OpenMind researchers leave for a larger lab. They take a whiteboard, and a bank.',
      },
      {
        label: 'offer equity',
        record: 'equity',
        tooltip: '1 Trust. Both stay.',
        line: 'both stay · 1 Trust',
        cost: { trust: 1 },
        effect: () => undefined,
        log: 'Two OpenMind researchers take equity instead of a raise. They check the valuation daily.',
      },
      {
        label: 'match the offer',
        record: 'matched',
        tooltip: (_s, ctx) => `${fmtMoney(ctxNum(ctx, 'price', 12000))}. Both stay.`,
        line: (_s, ctx) => `both stay · ${fmtMoneyShort(ctxNum(ctx, 'price', 12000))}`,
        cost: (_s, ctx) => ({ funds: ctxNum(ctx, 'price', 12000) }),
        effect: () => undefined,
        log: 'OpenMind matches an offer for two researchers. Salaries come up at lunch.',
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
    defaultOption: 0,
    options: [
      {
        label: 'decline',
        record: 'declined',
        tooltip: 'Nothing changes.',
        line: 'nothing changes',
        effect: () => undefined,
        log: 'OpenMind declines the year-end leaderboard. Its row reads "declined to participate".',
      },
      {
        label: 'submit Sage',
        record: 'submitted',
        tooltip: 'Ahead of Anthrosoft: marketing level +2. Behind: marketing level −2.',
        line: 'ahead of Cadence: marketing +2 · behind: marketing −2',
        effect: (s) => {
          const won = s.capability >= s.rivalCapability;
          s.flags['leaderboardWon'] = won;
          if (won) {
            s.hypeLevel += 2;
            say(s, `${s.training.deployedName} tops the year-end board. Marketing level +2.`);
          } else {
            s.hypeLevel = Math.max(1, s.hypeLevel - 2);
            say(s, `${s.training.deployedName} places second, behind Cadence. Marketing level −2.`);
          }
        },
        log: (s) => (s.flags['leaderboardWon']
          ? `${s.training.deployedName} tops the year-end leaderboard. Two labs dispute the methodology.`
          : `${s.training.deployedName} places second on the year-end leaderboard. OpenMind disputes the methodology.`),
      },
    ],
  },
  {
    id: 'c_anthrosoft',
    title: 'A Rival Lab',
    onOpen: (s) => {
      if (!s.revealed['rival']) rivalRelease(s);
    },
    text: (s) => {
      const lead = s.capability / s.rivalCapability;
      const sage = s.training.deployedName;
      return [
        `Another lab, Anthrosoft, releases Cadence-${s.rivalVersion}.`,
        lead > 1.02 ? `Reviewers put it a step behind ${sage}.` : lead < 0.98 ? `Reviewers put it a step ahead of ${sage}.` : `Reviewers cannot tell it from ${sage}.`,
        'Customers compare the two from now on. Demand follows whichever model is ahead.',
      ];
    },
    timer: 60,
    defaultOption: 0,
    options: [
      {
        label: 'back to work',
        record: 'noted',
        tooltip: 'Where Sage stands against Anthrosoft is on the Training panel.',
        line: 'its standing is on the Training panel',
        effect: () => undefined,
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
    defaultOption: 0,
    options: [
      {
        label: 'say nothing',
        record: 'silence',
        tooltip: 'Customers try the free model: demand −15% for 3:00.',
        line: 'demand −15% for 3:00',
        effect: (s) => {
          s.effects.push({ id: 'freeModel', remaining: 180, demandMult: 0.85 });
        },
      },
      {
        label: 'open-source the first Sage',
        record: 'open-sourced',
        tooltip: '+1 Trust. Developers build on the open model: demand +10% for good. The lead over Baiwen shrinks by a month.',
        line: '+1 Trust · demand +10% for good',
        effect: (s) => {
          s.trust += 1;
          s.demandMult *= 1.1;
          s.lead = Math.max(0, s.lead - 1);
        },
        log: 'OpenMind releases the weights of Sage-1. Downloads crash the mirror.',
      },
      {
        label: 'cut the price',
        record: 'price cut',
        tooltip: 'Price −20% now. Every contract renews at the lower price: contract customers pay 30% less, for good.',
        line: 'price −20% · contracts 30% smaller for good',
        effect: (s) => {
          if (!s.autoPrice) s.price = Math.max(0.01, Math.round(s.price * 0.8 * 100) / 100);
          scaleContracts(s, 0.7);
        },
        log: 'OpenMind cuts prices by a fifth. Its banks ask for the same.',
      },
    ],
  },
  {
    id: 'c_journalist',
    title: 'A Reporter Calls',
    onOpen: (s, ctx) => {
      if (!ctx['research']) ctx['research'] = Math.max(1500, twoFigures(30 * researchRate(s)));
    },
    text: (s) => [
      `The piece is about how ${s.training.deployedName} was tested.`,
      'She has a source on the red team.',
    ],
    timer: 60,
    defaultOption: 0,
    options: [
      {
        label: 'no comment',
        record: 'no comment',
        tooltip: 'The piece runs without OpenMind: demand −30% for 3:00. Government relations −2.',
        line: 'the piece runs: demand −30% for 3:00',
        effect: (s) => {
          s.effects.push({ id: 'thePiece', remaining: 180, demandMult: 0.7 });
          moveGov(s, -2);
        },
        log: '"OpenMind did not respond to a request for comment." The piece is shared widely.',
      },
      {
        label: 'publish the system card',
        record: 'system card',
        tooltip: (_s, ctx) => `${fmtNum(ctxNum(ctx, 'research', 1500), 0)} research. +1 Trust. Customers trust what they can read: demand +10% for good.`,
        line: (_s, ctx) => `+1 Trust · demand +10% · ${fmtNum(ctxNum(ctx, 'research', 1500), 0)} research`,
        cost: (_s, ctx) => ({ research: ctxNum(ctx, 'research', 1500) }),
        effect: (s) => {
          s.trust += 1;
          s.demandMult *= 1.1;
          s.alignmentApparent = Math.min(100, s.alignmentApparent + 2);
          moveGov(s, 2);
        },
        log: 'OpenMind publishes a long system card. The piece runs anyway, shorter.',
      },
    ],
  },
  {
    id: 'c_customer_email',
    title: 'A Customer Writes',
    timer: 60,
    defaultOption: 0,
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
        line: (_s, ctx) => `+${fmtMoney(Number(ctx['amount'] ?? 25))} now`,
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
        line: 'marketing level +1',
        effect: (s) => {
          s.hypeLevel += 1;
          say(s, 'Case study published. Marketing level up.');
        },
      },
    ],
  },
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
        line: 'government +8 · approval +3 · lead −0.5 months',
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
        line: 'government −5 · nothing on the record',
        effect: (s) => {
          moveGov(s, -5);
          hearingDone(s);
        },
        log: 'OpenMind\'s counsel reads a statement. The committee schedules a second hearing.',
      },
      {
        label: 'bring a demo',
        record: 'demo',
        tooltip: '100,000 research. Marketing level +1, government relations +3.',
        line: 'marketing level +1 · government +3 · 100,000 research',
        cost: { research: 100000 },
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
    timer: 90,
    defaultOption: 2,
    text: () => [
      'The crawl is finished. There is no more public internet to read.',
      'Forty publishers have noticed where their archives went. They would like to talk.',
    ],
    options: [
      {
        label: 'license the archives',
        record: 'licensed',
        tooltip: (s) => `${fmtMoneyShort(publishersLicence(s))}. +10 T of data now. Approval +2.`,
        line: (s) => `+10 T data now · approval +2 · ${fmtMoneyShort(publishersLicence(s))}`,
        cost: (s) => ({ funds: publishersLicence(s) }),
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
        line: '+5 T data now · government −3 · approval −4 · a lawsuit',
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
        line: 'no data now · synthetic data at half price',
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
    onOpen: (s) => {
      if (typeof s.flags['gulfBase'] !== 'number') s.flags['gulfBase'] = gulfBaseNow(s);
    },
    options: [
      {
        label: 'sign for Al-Marsa',
        record: 'signed Al-Marsa',
        tooltip: (s) => `${fmtMoneyShort(gulfPrice(s))}. +1,000 MW in 2:00. Government relations −8, approval −3, lead −0.5 months. The site is abroad.`,
        line: (s) => `+1,000 MW in 2:00 · government −8 · approval −3 · lead −0.5 months · ${fmtMoneyShort(gulfPrice(s))}`,
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
        line: 'government +3 · a nuclear PPA is offered now',
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
        tooltip: (s) => `The offer returns once, at ${fmtMoneyShort(Math.round(gulfPrice(s) * 1.5))}.`,
        line: (s) => `the offer returns once, at ${fmtMoneyShort(Math.round(gulfPrice(s) * 1.5))}`,
        needs: 'asked once already',
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
        line: 'next run waits 1:00 · alignment +2',
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
        line: 'next run waits 0:15',
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
        line: 'no delay · they will remember',
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
        tooltip: 'Revenue +12 % for good. Government relations +8, lead +0.5 months, approval −8. The government becomes a customer it will not want to lose.',
        line: 'revenue +12% for good · government +8 · approval −8',
        effect: (s) => {
          s.flags['defenseContract'] = true;
          s.revenueMult *= 1.12;
          moveGov(s, 8);
          moveLead(s, 0.5);
        },
        log: 'OpenMind signs a ten-year contract with the Pentagon. Two researchers resign by email.',
      },
      {
        label: 'decline',
        record: 'declined',
        tooltip: 'Government relations −2, approval +3.',
        line: 'government −2 · approval +3',
        effect: (s) => {
          moveGov(s, -2);
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
        tooltip: `Research stops for ${LOCKDOWN_SECONDS} s while every credential is rotated. With the building already locked down, Security level 3 costs a fifth and no Trust for 5 minutes.`,
        line: 'research stops 1:00 · security level 3 at a fifth, no Trust, for 5:00',
        effect: (s) => {
          s.effects.push({ id: 'lockdown', remaining: LOCKDOWN_SECONDS, demandMult: 1, researchMult: 0 });
          s.flags['sl3DiscountUntil'] = s.stats.timePlayed + 300;
          s.revealed['sl3Button'] = true;
        },
        log: 'An intrusion at Abilene is stopped at the firewall. Every password in the building changes.',
      },
      {
        label: 'call the Bureau',
        record: 'called the Bureau',
        tooltip: `Government relations +5, lead +0.5 months. Research −20 % for ${BUREAU_SECONDS} s while agents sit in the office.`,
        line: 'government +5 · lead +0.5 months · research −20% for 2:00',
        effect: (s) => {
          moveGov(s, 5);
          moveLead(s, 0.5);
          s.effects.push({ id: 'bureau', remaining: BUREAU_SECONDS, demandMult: 1, researchMult: 0.8 });
          s.revealed['sl3Button'] = true;
        },
        log: 'The FBI opens a counterintelligence file on OpenMind\'s behalf.',
      },
      {
        label: 'review it quietly',
        record: 'reviewed quietly',
        tooltip: 'Nothing changes today. Lead −0.5 months; government relations −3 when the Bureau hears of it.',
        line: 'lead −0.5 months · government −3',
        effect: (s) => {
          moveLead(s, -0.5);
          moveGov(s, -3);
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
        line: 'approval +5 · government +5 · releases from 4× wait 0:30',
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
        line: 'approval −2 · no wait on releases',
        effect: (s) => {
          s.flags['pactDeclined'] = true;
          s.revealed['shareEvals'] = true;
        },
        log: 'Anthrosoft publishes a pledge. One signature line is empty.',
      },
    ],
  },
];

function hearingDone(s: GameState): void {
  s.flags['hearingDone'] = true;
  s.revealed['government'] = true;
}


CHOICES.push(...CHOICES3, ...CHOICES4, ...CHOICES5);
