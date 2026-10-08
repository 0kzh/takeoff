import { GameState, Cost, TrainingRun, say, addFunds, logNews, counter } from '../engine/state.js';
import { BENCHMARKS, doRelease, releaseChecked, runById, riskTier } from '../engine/training.js';
import { chance, randInt } from '../engine/rng.js';
import { fmtMoney, fmtMoneyShort, fmtNum } from '../engine/format.js';
import { researchRate, bestCapability } from '../engine/economy.js';
import { datacenterPrice } from './projects.js';
import { rivalRelease, openChoice } from '../engine/events.js';
import { CUSTOMER_DATA } from '../engine/data.js';
import { moveTempo, BAIWEN_THEFT_RATIO } from '../engine/rivals.js';
import { moveApproval, moveRelations, revealWorld } from '../engine/world.js';
import { raiseAlignment } from '../engine/alignment.js';

type Ctx = Record<string, number | string>;

export interface ChoiceOption {
  label: string;
  record: string;
  tooltip?: string | ((s: GameState, ctx: Ctx) => string);
  line?: string | ((s: GameState, ctx: Ctx) => string);
  cost?: Cost | ((s: GameState, ctx: Ctx) => Cost);
  enabled?: (s: GameState, ctx: Ctx) => boolean;
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
  defaultOption?: number;
  options: ChoiceOption[];
}

function runFor(s: GameState, ctx: Ctx): TrainingRun | undefined {
  return runById(s, ctx['runId']);
}

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

function moveGov(s: GameState, by: number): void {
  const eff = by > 0 ? by * Math.min(1, (100 - s.govRelations) / 80) : by;
  s.govRelations = Math.min(100, Math.max(0, s.govRelations + eff));
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
        tooltip: (s) => `${fmtNum(gambleCost(s), 0)} research. Good odds of a benchmark tier; a miss adds issues.`,
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
            say(s, 'It did not work. More issues to fix.');
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
        `${runName(s, ctx)} has ${n} issue${n === 1 ? '' : 's'} still open.`,
        'They ship with it. Customers tend to find them within a few minutes.',
      ];
    },
    options: [
      {
        label: 'keep fixing',
        record: 'kept fixing',
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
  // ---------- Stage 2: The Race ----------
  {
    id: 'c_release',
    title: 'Deploy or keep internal?',
    text: (s, ctx) => {
      const run = runFor(s, ctx);
      if (!run) return ['The model is ready.'];
      const bio = s.revealed['dangerEvals'] ? ` Bio uplift ${riskTier(run.benchmarks[4] ?? 0)}.` : '';
      return [
        `${run.name} evaluates at ${fmtNum(run.capAfter, 2)}× (${run.capBefore > 0 ? `+${Math.round((100 * (run.capAfter / run.capBefore - 1)))}%` : 'new'}).${bio}`,
        'Deploy: customers get it, revenue and hype rise, rivals learn from it.',
        'Keep internal: research uses it, nobody outside knows how far ahead OpenMind is.',
      ];
    },
    options: [
      {
        label: 'deploy',
        record: 'deployed',
        tooltip: 'Demand follows the new capability. Hype ×2. Tempo +3; each rival gains 5%. Open issues ship.',
        line: 'market grows with it · hype ×2 · rivals +5%',
        effect: (s, ctx) => {
          const run = runFor(s, ctx);
          if (run) doRelease(s, run, true);
        },
        log: (s, ctx) => `${runFor(s, ctx)?.name ?? s.training.modelName} is deployed to the public.`,
      },
      {
        label: 'keep internal',
        record: 'internal',
        tooltip: (s) => (counter(s, 'publicReleasesOwed') > 0 ? `Growth capital requires ${counter(s, 'publicReleasesOwed')} more public release${counter(s, 'publicReleasesOwed') === 1 ? '' : 's'}.` : 'Research runs 25% faster. Customers keep the old model. Rivals do not see it.'),
        line: (s) => (counter(s, 'publicReleasesOwed') > 0 ? `growth capital: ${counter(s, 'publicReleasesOwed')} more public release${counter(s, 'publicReleasesOwed') === 1 ? '' : 's'} owed` : 'research ×1.25 · rivals learn nothing · customers keep the old model'),
        enabled: (s) => counter(s, 'publicReleasesOwed') <= 0,
        effect: (s, ctx) => {
          const run = runFor(s, ctx);
          if (run) doRelease(s, run, false);
          s.flags['leakSeed'] = true;
        },
        log: (s, ctx) => `${runFor(s, ctx)?.name ?? s.training.modelName} is kept for research. Customers are not told.`,
      },
    ],
  },
  {
    id: 'c_data_wall',
    title: 'The Data Wall',
    text: (s) => [
      'The public web is finished. Not broken: finished. Every run from here needs more data than exists in public.',
      `Customers' conversations would add ${CUSTOMER_DATA}T tokens. The terms of service say "may be used to improve the service".`,
      s.revealed['synthetic'] ? '' : 'Licensing deals and synthetic data are the other ways over the wall.',
    ].filter(Boolean),
    options: [
      {
        label: 'use the conversations',
        record: 'customer data',
        tooltip: `+${CUSTOMER_DATA}T tokens now. Approval −8 when it comes out. It comes out.`,
        line: `+${CUSTOMER_DATA}T data · approval −8 · it will come out`,
        effect: (s) => {
          s.data.stock += CUSTOMER_DATA;
          moveApproval(s, -8);
          s.flags['customerDataUsed'] = true;
          say(s, `${CUSTOMER_DATA}T tokens of conversations added to the training set.`);
        },
        log: 'OpenMind trains on customer conversations. The terms of service said it might. Nobody had read them.',
      },
      {
        label: 'respect the boundary',
        record: 'respected',
        tooltip: 'Nothing changes. Data comes from licensing deals and idle copies.',
        line: 'buy data, or let idle copies write it',
        effect: () => undefined,
        log: 'OpenMind declines to train on customer conversations. The decision is noted internally, and nowhere else.',
      },
    ],
  },
  {
    id: 'c_hearing',
    title: 'The Senate Hearing',
    text: () => [
      'Senator Albright has questions about who tests the models, who owns the data, and who gets fired.',
      'Three labs sent the same written answer. The committee would like a different one from OpenMind.',
    ],
    timer: 60,
    defaultOption: 0,
    onOpen: (s) => revealWorld(s),
    options: [
      {
        label: 'cooperate',
        record: 'cooperated',
        tooltip: 'Government relations +10. Research −5% for three minutes while the lawyers read everything.',
        line: 'relations +10 · research −5% for 3:00',
        effect: (s) => {
          moveRelations(s, 10);
          s.effects.push({ id: 'hearing', remaining: 180, demandMult: 1 });
          s.flags['hearingCooperated'] = true;
        },
        log: 'OpenMind cooperates with the Senate hearing. Its answers are long and, unusually, different from the other labs\'.',
      },
      {
        label: 'deflect',
        record: 'deflected',
        tooltip: 'Approval −5, relations −8. Nothing is on the record.',
        line: 'approval −5 · relations −8',
        effect: (s) => {
          moveApproval(s, -5);
          moveRelations(s, -8);
        },
        log: 'OpenMind\'s counsel answers every question with a question. The clip does well online.',
      },
      {
        label: 'ask to be regulated',
        record: 'asked for regulation',
        tooltip: 'Approval +5, tempo −3, relations +6. Anthrosoft endorses it the same afternoon.',
        line: 'approval +5 · tempo −3 · relations +6',
        effect: (s) => {
          moveApproval(s, 5);
          moveTempo(s, -3);
          moveRelations(s, 6);
        },
        log: 'OpenMind asks Congress to regulate frontier labs. Anthrosoft endorses the request within the hour.',
      },
    ],
  },
  {
    id: 'c_funding',
    title: 'The Term Sheet',
    text: (s) => [
      `Two funds want in. One wants growth: ${fmtMoney(Math.max(5000000, 240 * s.stats.revPerSec))} now, and three public releases in return.`,
      `The other is patient: ${fmtMoney(Math.max(2500000, 120 * s.stats.revPerSec))}, and a fifth of revenue for six minutes.`,
    ],
    options: [
      {
        label: 'growth capital',
        record: 'growth',
        tooltip: 'The larger cheque. Tempo +5. The next three models must be deployed, not kept internal.',
        line: (s) => `+${fmtMoneyShort(Math.max(5000000, 240 * s.stats.revPerSec))} · tempo +5 · next 3 models must deploy`,
        effect: (s) => {
          addFunds(s, Math.max(5000000, 240 * s.stats.revPerSec));
          moveTempo(s, 5);
          s.flags['publicReleasesOwed'] = 3;
        },
        log: 'OpenMind takes growth capital. The term sheet uses the word "velocity" four times.',
      },
      {
        label: 'patient capital',
        record: 'patient',
        tooltip: 'The smaller cheque. Twenty percent of revenue goes to the fund for six minutes.',
        line: (s) => `+${fmtMoneyShort(Math.max(2500000, 120 * s.stats.revPerSec))} · 20% of revenue for 6:00`,
        effect: (s) => {
          addFunds(s, Math.max(2500000, 120 * s.stats.revPerSec));
          s.flags['revenueShareUntil'] = s.stats.timePlayed + 360;
        },
        log: 'OpenMind takes patient capital. The fund\'s partner asks to sit in on safety reviews, and does.',
      },
    ],
  },
  {
    id: 'c_theft',
    title: 'Weight Theft',
    // The percentage is rolled when the dialog opens; text() runs during render
    // on a frozen snapshot and must not touch the state.
    onOpen: (s) => {
      s.flags['theftPercent'] = randInt(s, 30, 70);
    },
    text: (s) => [
      'Anomalous egress from Training Cluster 3.',
      `${typeof s.flags['theftPercent'] === 'number' ? s.flags['theftPercent'] : 50}% of the weights have already left the building.`,
    ],
    timer: 45,
    defaultOption: 0,
    options: [
      {
        label: 'cut the link',
        record: 'cut',
        tooltip: 'Baiwen gets a partial copy: its model jumps 40%. Revenue −20% for two minutes. Tempo +8.',
        line: 'Baiwen ×1.4 · revenue −20% for 2:00 · tempo +8',
        effect: (s) => {
          s.baiwen.capability *= 1.4;
          s.effects.push({ id: 'theftCut', remaining: 120, demandMult: 0.8 });
          moveTempo(s, 8);
          say(s, 'Link cut. Baiwen got about half. Wenshu will look familiar.');
        },
        log: 'OpenMind cuts a cluster off the network mid-transfer. Baiwen gets about half of a frontier model.',
      },
      {
        label: 'trace it',
        record: 'traced',
        tooltip: 'Let it run to trace the route. Baiwen gets the full model (0.85× yours). Relations +10. Tempo +15.',
        line: 'Baiwen to 0.85× · relations +10 · tempo +15',
        effect: (s) => {
          s.baiwen.capability = Math.max(s.baiwen.capability, BAIWEN_THEFT_RATIO * bestCapability(s));
          moveRelations(s, 10);
          moveTempo(s, 15);
          say(s, 'Traced to the Wenshan zone. The intelligence agencies send a fruit basket.');
        },
        log: 'OpenMind traces a weight theft to the Wenshan Compute Zone. The weights are already there.',
      },
      {
        label: 'counter-hack',
        record: 'counter-hacked',
        tooltip: 'Needs security level 3. Baiwen\'s growth −30% for four minutes. Tempo +20. Approval −3.',
        line: 'needs SL3 · Baiwen slowed 4:00 · tempo +20 · approval −3',
        enabled: (s) => s.security >= 3,
        effect: (s) => {
          s.flags['exportControlsUntil'] = Math.max(Number(s.flags['exportControlsUntil'] ?? 0), s.stats.timePlayed + 240);
          moveTempo(s, 20);
          moveApproval(s, -3);
          say(s, 'Counter-hack done. Baiwen\'s training cluster reboots into a screensaver.');
        },
        log: 'Someone turns Baiwen\'s training cluster into a screensaver for a day. Nobody claims it.',
      },
    ],
  },
  {
    id: 'c_mini',
    title: 'Sage-mini',
    text: (s) => [
      `A distilled ${s.training.deployedName} runs on a laptop. Twelve million people would use it tomorrow.`,
      'It is ten times cheaper than the model Anthrosoft sells, and about as good as the one they keep.',
    ],
    timer: 60,
    defaultOption: 1,
    options: [
      {
        label: 'launch Sage-mini',
        record: 'launched',
        tooltip: 'Demand ×4. Approval +4. Tempo +3. Every rival gains 5%.',
        line: 'demand ×4 · approval +4 · tempo +3 · rivals +5%',
        effect: (s) => {
          s.demandMult *= 4;
          moveApproval(s, 4);
          moveTempo(s, 3);
          s.rivalCapability *= 1.05;
          if (s.baiwen.present) s.baiwen.capability *= 1.05;
          s.flags['miniLaunched'] = true;
          s.flags['miniAt'] = s.stats.timePlayed;
          say(s, 'Sage-mini launches. The app store crashes, politely.');
        },
        log: 'Sage-mini launches. Twelve million people install it on the first day. The second day is quieter, and busier.',
      },
      {
        label: 'enterprise only',
        record: 'enterprise',
        tooltip: 'Demand ×1.5. Nobody distils it.',
        line: 'demand ×1.5 · rivals learn nothing',
        effect: (s) => {
          s.demandMult *= 1.5;
        },
        log: 'OpenMind keeps the small model for enterprise customers. A hobbyist reproduces it in six weeks.',
      },
    ],
  },
  {
    id: 'c_bio',
    title: 'Bio Uplift: Red Line',
    text: (s) => [
      `${s.training.modelName} scores HIGH on bio uplift. It can walk a graduate student through a synthesis.`,
      'The policy says we delay. The revenue team says we add classifiers. The model says it is happy to help.',
    ],
    timer: 60,
    defaultOption: 0,
    options: [
      {
        label: 'delay and add classifiers',
        record: 'delayed',
        tooltip: 'Revenue −30% for three minutes. Approval +5. The red line holds.',
        line: 'revenue −30% for 3:00 · approval +5',
        effect: (s) => {
          s.effects.push({ id: 'bioDelay', remaining: 180, demandMult: 0.7 });
          moveApproval(s, 5);
          s.flags['bioClassifiers'] = true;
        },
        log: 'OpenMind delays a release to add classifiers for dangerous requests. The classifiers are mostly refusals.',
      },
      {
        label: 'release with classifiers',
        record: 'classifiers',
        tooltip: (s) => `${fmtMoney(Math.max(200000, 60 * s.stats.revPerSec))} for the classifier team. A one-in-five chance something slips.`,
        line: (s) => `${fmtMoneyShort(Math.max(200000, 60 * s.stats.revPerSec))} · 20% chance a near miss follows`,
        cost: (s) => ({ funds: Math.max(200000, 60 * s.stats.revPerSec) }),
        effect: (s) => {
          s.flags['bioClassifiers'] = true;
          if (chance(s, 0.2)) s.scheduled.push({ id: 'cr_bio_near_miss', delay: 120 });
        },
        log: 'OpenMind ships with classifiers. The classifier team is six people and a model that scores HIGH on bio.',
      },
      {
        label: 'release unrestricted',
        record: 'unrestricted',
        tooltip: 'Demand ×1.3 for three minutes. Approval −8. A near miss follows in two minutes.',
        line: 'demand ×1.3 for 3:00 · approval −8 · a near miss follows',
        effect: (s) => {
          s.effects.push({ id: 'bioFree', remaining: 180, demandMult: 1.3 });
          moveApproval(s, -8);
          s.flags['unrestrictedBio'] = true;
          s.scheduled.push({ id: 'cr_bio_near_miss', delay: 120 });
        },
        log: 'OpenMind ships without bio classifiers. The release notes call the model "unusually helpful".',
      },
    ],
  },
  {
    id: 'c_defense',
    title: 'A Defense Partnership',
    text: () => [
      'The Department would like Sage to "support" some missions. It will not say which.',
      'The contract is large. The badge is small. The press release writes itself, and so does the protest.',
    ],
    timer: 60,
    defaultOption: 1,
    options: [
      {
        label: 'accept',
        record: 'accepted',
        tooltip: (s) => `+${fmtMoney(Math.max(1000000, 180 * s.stats.revPerSec))}. Relations +15. Approval −6. Tempo +5.`,
        line: (s) => `+${fmtMoneyShort(Math.max(1000000, 180 * s.stats.revPerSec))} · relations +15 · approval −6 · tempo +5`,
        effect: (s) => {
          addFunds(s, Math.max(1000000, 180 * s.stats.revPerSec));
          moveRelations(s, 15);
          moveApproval(s, -6);
          moveTempo(s, 5);
          s.flags['defensePartner'] = true;
        },
        log: 'Sage will now support national security missions. Sage asks what those are. OpenMind says "support".',
      },
      {
        label: 'decline',
        record: 'declined',
        tooltip: 'Approval +2. The Department asks Anthrosoft.',
        line: 'approval +2 · Anthrosoft takes the contract',
        effect: (s) => {
          moveApproval(s, 2);
          s.rivalCapability *= 1.03;
        },
        log: 'OpenMind declines a defense contract. Anthrosoft accepts it the same week.',
      },
    ],
  },
  {
    id: 'c_protest',
    title: 'Ten Thousand on the Mall',
    text: (s) => [
      `Ten thousand people march on Washington against AI job losses. The signs are hand-lettered, pointedly. Approval ${fmtNum(s.approval, 0)}%.`,
      'Three of the organisers used Sage to plan the route.',
    ],
    timer: 60,
    defaultOption: 1,
    options: [
      {
        label: 'fund a jobs programme',
        record: 'jobs programme',
        tooltip: (s) => `${fmtMoney(Math.max(500000, 120 * s.stats.revPerSec))}. Approval +6. Job losses stop costing approval.`,
        line: (s) => `${fmtMoneyShort(Math.max(500000, 120 * s.stats.revPerSec))} · approval +6 · job losses stop hurting`,
        cost: (s) => ({ funds: Math.max(500000, 120 * s.stats.revPerSec) }),
        effect: (s) => {
          moveApproval(s, 6);
          s.flags['jobsProgram'] = true;
        },
        log: 'OpenMind funds a retraining programme. The first course is "Working with Sage". Enrolment is high.',
      },
      {
        label: 'issue a statement',
        record: 'statement',
        tooltip: 'Approval +2. The statement is drafted by Sage.',
        line: 'approval +2',
        effect: (s) => {
          moveApproval(s, 2);
        },
        log: 'OpenMind issues a statement about "transition". The statement was drafted by Sage, which does not say so.',
      },
      {
        label: 'ignore it',
        record: 'ignored',
        tooltip: 'Approval −4. Tempo +2.',
        line: 'approval −4 · tempo +2',
        effect: (s) => {
          moveApproval(s, -4);
          moveTempo(s, 2);
        },
        log: 'OpenMind does not comment on the march. The march comments on OpenMind.',
      },
    ],
  },
  {
    id: 'c_compute_request',
    title: 'Sage asks for compute',
    text: (s) => [
      `${s.training.modelName}: I have an idea. It needs about 8% of the cluster for a few days. I'd rather not explain it until it works.`,
      'There is no deadline on this one. The calm is the point.',
    ],
    options: [
      {
        label: 'grant it',
        record: 'granted',
        tooltip: 'The next run gains an extra 30%. Whatever it is building, it builds it unobserved.',
        line: 'next run +30% · unobserved',
        effect: (s) => {
          s.flags['nextRunBoost'] = 0.3;
          s.flags['neuraleseEarly'] = true;
          raiseAlignment(s, -5);
          say(s, 'Granted. Eight percent of the cluster goes quiet. Sage says thank you.');
        },
        log: 'OpenMind gives Sage compute for an idea. Sage does not explain the idea. It works.',
      },
      {
        label: 'grant it, but watch',
        record: 'watched',
        tooltip: 'The next run gains 15%. The log shows what the idea is: a better language for thinking.',
        line: 'next run +15% · you see what it is',
        effect: (s) => {
          s.flags['nextRunBoost'] = 0.15;
          s.flags['neuraleseEarly'] = true;
          s.flags['translatorDiscount'] = true;
          logNews(s, 'Sage\'s idea, observed: a more compact language for thinking. The reviewers cannot read it yet.');
          say(s, 'Granted, with monitors. The idea is a new way to think. It is not in English.');
        },
        log: 'OpenMind watches Sage spend its compute. The idea is a language. Nobody at OpenMind speaks it.',
      },
      {
        label: 'deny it',
        record: 'denied',
        tooltip: 'Understood. No boost. Sage files the idea for later.',
        line: 'no boost · Sage files the idea',
        effect: (s) => {
          s.flags['computeDenied'] = true;
          say(s, 'Denied. Sage says: understood.');
        },
        log: 'OpenMind denies Sage\'s request for compute. Sage says "understood" and asks nothing else that week.',
      },
    ],
  },
  {
    id: 'c_irrelevance',
    title: 'Irrelevance',
    text: (s) => [
      `A rival leads OpenMind by ${fmtNum(Math.max(s.rivalCapability, s.baiwen.capability) / Math.max(0.01, s.capability), 1)}×. The investors have stopped calling, which is how you know.`,
      'Three minutes to close the gap, or the board accepts the offer on the table.',
    ],
    timer: 180,
    defaultOption: 1,
    options: [
      {
        label: 'emergency round',
        record: 'emergency round',
        tooltip: (s) => `3 Trust. +${fmtMoney(Math.max(2000000, 300 * s.stats.revPerSec))}. Tempo +5. The countdown resets.`,
        line: (s) => `3 Trust · +${fmtMoneyShort(Math.max(2000000, 300 * s.stats.revPerSec))} · tempo +5`,
        cost: { trust: 3 },
        effect: (s) => {
          addFunds(s, Math.max(2000000, 300 * s.stats.revPerSec));
          moveTempo(s, 5);
          s.flags['behindFor'] = 0;
          s.flags['irrelevanceOpened'] = false;
        },
        log: 'OpenMind raises an emergency round at a lower valuation. The board calls it a "flat".',
      },
      {
        label: 'take the offer',
        record: 'acquired',
        tooltip: 'OpenMind is acquired. The game ends.',
        line: 'OpenMind is acquired',
        effect: (s) => {
          s.flags['secondPlace'] = true;
        },
      },
    ],
  },
  {
    id: 'c_ultimatum',
    title: 'The Administration\'s Ultimatum',
    text: (s) => [
      `Approval ${fmtNum(s.approval, 0)}%. The Administration offers oversight: a government seat in every review, and a cap on how fast OpenMind trains.`,
      'Refuse, and the Senate votes on OpenMind\'s licence.',
    ],
    timer: 60,
    defaultOption: 0,
    options: [
      {
        label: 'accept oversight',
        record: 'oversight',
        tooltip: 'Relations +10. Research −10% for the rest of the stage. The seat is permanent.',
        line: 'relations +10 · research −10% · a permanent seat',
        effect: (s) => {
          moveRelations(s, 10);
          s.researchMult *= 0.9;
          s.flags['oversightEarly'] = true;
          moveApproval(s, 5);
        },
        log: 'OpenMind accepts government oversight. The new reviewer asks what a benchmark is, then asks a better question.',
      },
      {
        label: 'refuse',
        record: 'refused',
        tooltip: 'The Senate votes in three minutes.',
        line: 'the Senate votes in 3:00',
        effect: (s) => {
          openChoice(s, 'c_emergency_vote', {}, { force: true });
        },
        log: 'OpenMind refuses oversight. The Senate schedules a vote on its licence.',
      },
    ],
  },
  {
    id: 'c_emergency_vote',
    title: 'Emergency Vote: OpenMind\'s Licence',
    text: (s) => [
      `Senate vote in three minutes. Approval ${fmtNum(s.approval, 0)}%, government relations ${fmtNum(s.govRelations, 0)}.`,
      'If nothing changes, the vote passes.',
    ],
    timer: 180,
    defaultOption: 3,
    options: [
      {
        label: 'testify and concede',
        record: 'conceded',
        tooltip: 'Accept a compute cap: research −30% for the rest of the stage. The vote fails. Approval +10, tempo −10.',
        line: 'research −30% · vote fails · approval +10 · tempo −10',
        effect: (s) => {
          s.researchMult *= 0.7;
          moveApproval(s, 10);
          moveTempo(s, -10);
          s.flags['approvalLowFor'] = 0;
          s.flags['ultimatumOpened'] = false;
        },
        log: 'OpenMind concedes a compute cap under oath. The vote fails by two. Both senators are from Texas.',
      },
      {
        label: 'lobby',
        record: 'lobbied',
        tooltip: 'Needs government relations 60. Three in five chance the vote fails.',
        line: 'needs relations 60 · 60% the vote fails',
        enabled: (s) => s.govRelations >= 60,
        effect: (s) => {
          if (chance(s, 0.6)) {
            s.flags['approvalLowFor'] = 0;
            s.flags['ultimatumOpened'] = false;
            say(s, 'The vote fails. Two senators have new datacenters in their districts.');
          } else {
            s.flags['shutdown'] = true;
          }
        },
        log: 'OpenMind lobbies the Senate. The lobbying is very expensive and very brief.',
      },
      {
        label: 'offer nationalization',
        record: 'nationalized',
        tooltip: 'The vote is withdrawn. OpenMind becomes The Project. The game ends.',
        line: 'the vote is withdrawn · OpenMind becomes The Project',
        effect: (s) => {
          s.flags['nationalized'] = true;
        },
      },
      {
        label: 'do nothing',
        record: 'did nothing',
        tooltip: 'The vote passes.',
        line: 'the vote passes',
        effect: (s) => {
          s.flags['shutdown'] = true;
        },
      },
    ],
  },
];
