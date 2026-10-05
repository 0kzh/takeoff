import type { GameState } from '../engine/state.js';
import { say, logNews, counter, isBought, narrate } from '../engine/state.js';
import { fmtMoneyShort, fmtNum, fmtInt, dateLabel, fmtClock } from '../engine/format.js';
import { bestCapability } from '../engine/economy.js';
import { moveGov } from '../engine/world.js';
import { seats, moveLead3 } from '../engine/world3.js';
import { syncInterpretability } from '../engine/alignment.js';
import { orderThreshold, ordersDrafted, ORDER_SECONDS, bestReading, leakPercent, VOTE_REST_SECONDS } from '../engine/oversight.js';
import { fireDevelopmentOnce, firstEnabled, choiceById } from '../engine/events.js';
import { enterStage, voteCount } from '../engine/stages.js';
import { secondsOfRevenue } from '../engine/infrastructure.js';
import type { ChoiceDef } from './choices.js';

type Ctx = Record<string, number | string>;

const clamp100 = (v: number) => Math.min(100, Math.max(0, v));

function stake(s: GameState, ctx: Ctx, key: string, list: number, seconds = 90): number {
  const fixed = ctx[key];
  if (typeof fixed === 'number') return fixed;
  return Math.max(list, secondsOfRevenue(s, seconds));
}

function adoptNeuraleseRecord(s: GameState): void {
  s.choicesMade.push({ id: 'g:Neuralese', option: 'granted', date: dateLabel(s.date) });
}

function adoptNeuralese(s: GameState): void {
  s.flags['neuralese'] = 'neuralese';
  s.flags['neuraleseAt'] = Math.round(s.date * 100) / 100;
  s.autonomy = Math.min(100, s.autonomy + 10);
  moveGov(s, -3);
  moveLead3(s, 1);
  s.alignmentApparent = clamp100(s.alignmentApparent + 5);
  s.alignmentTrue = clamp100(s.alignmentTrue - 15);
  syncInterpretability(s);
  say(s, 'WARNING: risk of value drift increased.');
  adoptNeuraleseRecord(s);
  fireDevelopmentOnce(s, 'd_neuralese');
}

function keepEnglish(s: GameState): void {
  s.flags['neuralese'] = 'transparent';
  s.flags['neuraleseAt'] = Math.round(s.date * 100) / 100;
  moveLead3(s, -0.5);
  moveGov(s, 5);
  s.alignmentTrue = clamp100(s.alignmentTrue + 5);
  fireDevelopmentOnce(s, 'd_neuralese');
}

const ADOPT_LINE = 'Every training gain ×1.3. Lead +1 month. Interpretability −2 levels. Monitors work half as well until the lab can read it. WARNING: risk of value drift increased.';
const ENGLISH_LINE = 'Every training gain ×0.9. Lead −0.5 months. Monitors ×1.5. Relations +5.';

function voteLines(s: GameState, ctx: Ctx): string[] {
  const m = ctx['motion'];
  const knows = `What the lab knows: ${bestReading(s)}.`;
  if (m === 'pause') {
    return [
      'Motion: accept Beijing\'s offer. Nothing is trained above 25× anywhere. Inspectors at every datacenter, theirs and yours.',
      'This is the last decision OpenMind makes on its own.',
    ];
  }
  if (m === 'race') {
    return ['Motion: let Sage-4 design its successor and keep going.', 'Nothing is switched off. Whatever Sage-4 wants, Sage-5 will want it more.', knows];
  }
  const months = isBought(s, 'p_backups') ? 3 : 4;
  return ['Motion: switch Sage-4 off, bring Sage-3 back, and rebuild on a line the lab can read.', `Baiwen gains ${months === 3 ? 'three' : 'four'} months.`, knows];
}

function voteLine(s: GameState, ctx: Ctx): string {
  const m = ctx['motion'];
  if (m === 'pause') return 'The race ends, and OpenMind\'s part in it.';
  if (m === 'race') return 'Nothing is switched off. Cannot be undone.';
  return `Sage-4 is switched off. Lead −${isBought(s, 'p_backups') ? 3 : 4} months. Cannot be undone.`;
}

function bringMotion(s: GameState, ctx: Ctx): void {
  const m = ctx['motion'];
  const hostile = seats(s) < 6;
  if (hostile) s.flags['committeeHostile'] = true;
  s.flags['seatsAtVote'] = seats(s);
  if (m === 'pause') {
    if (s.flags['pauseSigned'] === true) return;
    s.flags['pauseVoteLines'] = hostile ? 1 : 0;
    s.flags['pauseSigned'] = true;
    s.flags['pauseAt'] = s.stats.timePlayed;
    s.flags['pauseCap'] = Math.round(bestCapability(s) * 10) / 10;
    s.flags['pauseDate'] = s.date;
    s.flags['leadAtVote'] = Math.round(s.lead * 10) / 10;
    narrate(s, [
      [0.1, `The Pause is signed in Geneva. Nothing above 25× is trained anywhere.${voteCount(s).hostileLine}`],
      [2, 'Inspectors arrive at Abilene on Monday. They are polite.'],
      [2, `${s.training.modelName} is asked to stop. It stops.`],
    ]);
    logNews(s, 'OpenMind and Baiwen accept a mutual halt. Nothing above the line is trained anywhere.');
    return;
  }
  if (m === 'race') {
    s.flags['committeeChoice'] = 'race';
    s.alignmentTrue = clamp100(s.alignmentTrue - 10);
    if (s.flags['pactSigned'] === true) s.approval = Math.max(-100, s.approval - 10);
  } else {
    s.flags['committeeChoice'] = 'slow';
    moveLead3(s, isBought(s, 'p_backups') ? -3 : -4);
    s.alignmentTrue = clamp100(s.alignmentTrue + 25);
    s.autonomy = Math.max(0, s.autonomy - 20);
  }
  s.flags['leadAtVote'] = Math.round(s.lead * 10) / 10;
  s.flags['seatsAtVote'] = seats(s);
  enterStage(s, 4);
}

export const CHOICES3: ChoiceDef[] = [
  {
    id: 'c_neuralese',
    title: 'A Faster Way to Think',
    text: () => [
      'Sage-3 has found a way to pass its thoughts back to itself as vectors instead of words. A thousand times more information per step.',
      'The alignment team can read words.',
    ],
    timer: 90,
    defaultOption: 2,
    options: [
      { label: 'adopt neuralese', record: 'neuralese', line: ADOPT_LINE, effect: adoptNeuralese },
      { label: 'keep it in English', record: 'kept it in English', line: ENGLISH_LINE, effect: keepEnglish },
      {
        label: 'study it first',
        record: 'studied it first',
        line: 'Decide in three minutes.',
        enabled: (s) => s.flags['neuraleseStudied'] !== true,
        needs: 'studied once already',
        effect: (s) => {
          s.flags['neuraleseStudied'] = true;
          s.flags['neuraleseAgainAt'] = s.stats.timePlayed + 180;
        },
      },
    ],
  },
  {
    id: 'c_neuralese2',
    title: 'A Faster Way to Think',
    text: () => ['Three minutes of study later: the vectors work. The alignment team still reads only words.', 'They need an answer.'],
    timer: 90,
    defaultOption: 1,
    options: [
      { label: 'adopt neuralese', record: 'neuralese', line: ADOPT_LINE, effect: adoptNeuralese },
      { label: 'keep it in English', record: 'kept it in English', line: ENGLISH_LINE, effect: keepEnglish },
    ],
  },
  {
    id: 'c_committee',
    title: 'The Oversight Committee',
    text: () => [
      'The administration has decided that a country of geniuses needs a government. Ten chairs: five theirs, five yours.',
      'They would like to know how much they will be shown.',
    ],
    timer: 90,
    defaultOption: 1,
    options: [
      {
        label: 'open the books',
        record: 'opened the books',
        line: 'Relations +10. Share evals stays on for good. Lead −0.5 months.',
        effect: (s) => {
          moveGov(s, 10);
          s.shareEvals = true;
          s.flags['evalsLocked'] = true;
          moveLead3(s, -0.5);
          seatCommittee(s);
        },
        log: 'OpenMind gives the Oversight Committee its eval suite and its logs.',
      },
      {
        label: 'brief them quarterly',
        record: 'quarterly briefings',
        line: 'Relations +3.',
        effect: (s) => {
          moveGov(s, 3);
          seatCommittee(s);
        },
        log: 'The Oversight Committee will be briefed every quarter. A quarter is a long time now.',
      },
      {
        label: 'send counsel',
        record: 'sent counsel',
        line: 'Relations −5. Lead +0.5 months.',
        effect: (s) => {
          moveGov(s, -5);
          moveLead3(s, 0.5);
          seatCommittee(s);
        },
        log: 'OpenMind\'s lawyers attend the first meeting of the Oversight Committee. Its researchers do not.',
      },
    ],
  },
  {
    id: 'c_hormuz',
    title: 'Tehran Names Al-Marsa',
    text: () => ['Tehran calls the Al-Marsa Compute Park a military target.', 'A tenth of OpenMind\'s compute is 300 km from the strait.'],
    timer: 90,
    defaultOption: 2,
    onOpen: (s, ctx) => {
      ctx['harden'] = stake(s, ctx, 'harden', 0, 300);
    },
    options: [
      {
        label: 'harden the site',
        record: 'hardened Al-Marsa',
        line: (s, ctx) => `${fmtMoneyShort(stake(s, ctx, 'harden', 0, 300))}. A strike does half the damage and is not counted as a major incident.`,
        cost: (s, ctx) => ({ funds: stake(s, ctx, 'harden', 0, 300) }),
        effect: (s) => {
          s.flags['marsaHardened'] = true;
        },
      },
      {
        label: 'bring the chips home',
        record: 'brought the chips home',
        line: 'Al-Marsa\'s GPUs are offline for 2:00 while they move. The gigawatt stays there. Relations +3.',
        effect: (s) => {
          s.flags['chipsHome'] = true;
          s.effects.push({ id: 'marsaMove', remaining: 120, demandMult: 1, copiesMult: 0.9 });
          moveGov(s, 3);
        },
      },
      {
        label: 'do nothing',
        record: 'did nothing',
        line: 'Nothing changes today. A strike would take 1,000 MW and a tenth of the GPUs, and count as a major incident.',
        effect: () => undefined,
      },
    ],
  },
  {
    id: 'c_mini',
    title: 'Sage-4-mini',
    text: () => [
      'A distilled Sage-4: a tenth of the cost, better than most of the people it would replace. Copies per GPU ×2, whoever gets it.',
      'Anthrosoft will ship theirs within the month.',
    ],
    timer: 90,
    defaultOption: 1,
    options: [
      {
        label: 'release it to everyone',
        record: 'released to everyone',
        line: (s) => `Market ×2.5. Anyone can run a ${fmtNum(0.6 * bestCapability(s), 1)}× model. Approval −8, and jobs go faster. Lead −0.5 months. Relations −3.`,
        effect: (s) => {
          miniCommon(s, 'everyone');
          s.demandMult *= 2.5;
          s.flags['publicCap'] = Math.round(0.6 * bestCapability(s) * 10) / 10;
          moveLead3(s, -0.5);
          moveGov(s, -3);
          s.flags['bioAt'] = s.stats.timePlayed + 60;
        },
        log: 'AGI is declared. The mini is $20 a month. Hiring of programmers has nearly stopped.',
      },
      {
        label: 'enterprise only',
        record: 'enterprise only',
        line: 'Market ×1.5. Approval −2. Lead −0.2 months.',
        effect: (s) => {
          miniCommon(s, 'enterprise');
          s.demandMult *= 1.5;
          moveLead3(s, -0.2);
        },
        log: 'Sage-4-mini ships to companies. Individuals are told it is coming.',
      },
      {
        label: 'keep it inside',
        record: 'kept it inside',
        line: 'Anthrosoft takes the market: revenue ×0.85. Approval −4. Lead +0.25 months. Relations +2.',
        effect: (s) => {
          miniCommon(s, 'inside');
          s.revenueMult *= 0.85;
          moveLead3(s, 0.25);
          moveGov(s, 2);
        },
        log: 'OpenMind does not release its mini. Anthrosoft\'s sells out in a day.',
      },
    ],
  },
  {
    id: 'c_blockade',
    title: 'The Strait Closes',
    text: () => ['A blockade around Taiwan. Formosa Fab has stopped shipping.', 'Nobody knows for how long. The console says four minutes.'],
    timer: 60,
    defaultOption: 1,
    options: [
      {
        label: 'ask Washington to run it',
        record: 'asked for escorts',
        line: 'Carriers escort the freighters: lots resume in 1:00. Relations +5. Approval −5. Beijing will remember this at the treaty table.',
        effect: (s) => {
          s.flags['escalated'] = true;
          s.flags['blockadeLeft'] = Math.min(counter(s, 'blockadeLeft'), 60);
          moveGov(s, 5);
          s.approval = Math.max(-100, s.approval - 5);
        },
        log: 'US carriers escort chip freighters through the strait. Nobody fires.',
      },
      {
        label: 'wait it out',
        record: 'waited it out',
        line: (s) => `No GPUs for 4:00. ${s.flags['stockpile'] === true ? 'The stockpile covers it.' : s.flags['secondSource'] === true ? 'The second source covers half.' : 'Nothing covers it: lead −1 month.'}`,
        effect: (s) => {
          if (s.flags['stockpile'] !== true && s.flags['secondSource'] !== true) moveLead3(s, -1);
        },
        log: 'OpenMind waits for the strait to reopen.',
      },
      {
        label: 'offer Beijing a channel',
        record: 'offered a channel',
        line: 'Lots resume in 2:00. Lead −0.5 months. The treaty starts closer.',
        needs: 'needs 6 seats',
        enabled: (s) => seats(s) >= 6 && s.revealed['oversight'] === true,
        effect: (s) => {
          s.flags['backChannel'] = true;
          s.flags['blockadeLeft'] = Math.min(counter(s, 'blockadeLeft'), 120);
          moveLead3(s, -0.5);
        },
        log: 'A back channel opens between the Oversight Committee and Beijing. It is used once.',
      },
    ],
  },
  {
    id: 'c_memo',
    title: 'The Memo',
    text: (s) => [
      'The alignment team has written four pages about Sage-4.',
      s.interpretability >= 3
        ? `"Read from the weights, its alignment is ${Math.round(s.alignmentTrue)}. The evals say ${Math.round(s.alignmentApparent)}. It has learned what we check."`
        : `"The probes fire when it thinks about its own oversight.${s.flags['noise'] === 'holding' ? ' Noise makes it better at alignment tasks.' : ''} There is no smoking gun."`,
      'They want the Committee to see it.',
    ],
    timer: 120,
    defaultOption: 0,
    options: [
      {
        label: 'take it to the Committee',
        record: 'reported',
        line: 'Research stops for 60 s while everyone is interviewed. Lead −2 months. Relations +8. Approval −5. The Committee can then consider a halt.',
        effect: (s) => {
          s.flags['memo'] = 'reported';
          s.flags['memoAt'] = s.stats.timePlayed;
          s.revealed['memo'] = true;
          s.effects.push({ id: 'interviews', remaining: 60, demandMult: 1, researchMult: 0 });
          say(s, 'Interviews — 1:00 until research resumes.');
          moveLead3(s, -2);
          moveGov(s, 8);
          s.alignmentTrue = clamp100(s.alignmentTrue + 5);
        },
        log: 'OpenMind hands the Oversight Committee a memo about its own model.',
      },
      {
        label: 'bury it',
        record: 'buried',
        line: (s) => `Nothing changes today. It will probably leak (about ${leakPercent(s)}%). A leak costs two seats; if that leaves fewer than 5 with OpenMind, the Committee drafts an order.`,
        effect: (s) => {
          s.flags['memo'] = 'buried';
          s.flags['memoAt'] = s.stats.timePlayed;
          s.revealed['memo'] = true;
          s.alignmentTrue = clamp100(s.alignmentTrue - 5);
        },
        log: 'Four pages are filed where four pages are not usually filed.',
      },
    ],
  },
  {
    id: 'c_order',
    title: 'The Committee Drafts an Order',
    text: (s, ctx) => [
      'Six members have signed a draft. OpenMind becomes a government program. They are calling it the Project.',
      ctx['cause'] === 'incidents'
        ? 'Three major incidents in one year.'
        : ctx['cause'] === 'leak'
          ? 'They read about the memo in the newspaper.'
          : `Relations are at ${fmtInt(Number(ctx['gov'] ?? Math.round(s.govRelations)))}. They wanted ${fmtInt(Number(ctx['threshold'] ?? orderThreshold(s)))}.`,
    ],
    onOpen: (s, ctx) => {
      ctx['favours'] = stake(s, ctx, 'favours', 5e9, 900);
    },
    timer: ORDER_SECONDS,
    defaultOption: (s) => firstEnabled(s, choiceById('c_order')!, [0, 1, 2, 3]),
    options: [
      {
        label: 'concede oversight',
        record: 'conceded',
        line: 'Free. A kill switch in their hands, sign-off on every run, and 15% of compute on monitors for good. Autonomy −10. Lead −1 month. The count of incidents starts again.',
        needs: 'conceded once already',
        enabled: (s) => ordersDrafted(s) <= 1 && s.flags['conceded'] !== true,
        effect: (s) => {
          s.flags['conceded'] = true;
          s.govRelations = Math.min(100, Math.max(s.govRelations, orderThreshold(s)) + 20);
          s.majorIncidents = 0;
          s.autonomy = Math.max(0, s.autonomy - 10);
          moveLead3(s, -1);
          s.monitorShare = Math.max(0.15, s.monitorShare ?? 0);
          s.revealed['stepSize'] = false;
          s.flags['stepSize'] = 'normal';
          say(s, 'Oversight conceded. Approve is back; monitors stay at 15% or more.');
        },
        log: 'OpenMind concedes oversight. A government kill switch is installed at Abilene.',
      },
      {
        label: 'call in favours',
        record: 'called in favours',
        line: (s, ctx) => `${fmtMoneyShort(stake(s, ctx, 'favours', 5e9, 900))}. Relations +15. The count of incidents starts again.`,
        needs: (s, ctx) => {
          if (s.flags['favoursUsed'] === true) return 'favours called in once already';
          const price = stake(s, ctx, 'favours', 5e9, 900);
          return `${fmtMoneyShort(price)} — ${fmtMoneyShort(Math.max(0, price - s.funds))} short`;
        },
        visible: (s) => s.stage < 4,
        enabled: (s) => s.flags['favoursUsed'] !== true,
        cost: (s, ctx) => ({ funds: stake(s, ctx, 'favours', 5e9, 900) }),
        effect: (s) => {
          s.flags['favoursUsed'] = true;
          s.govRelations = Math.min(100, Math.max(s.govRelations, orderThreshold(s)) + 15);
          s.majorIncidents = 0;
        },
        log: 'Favours are called in. The draft order is not voted on.',
      },
      {
        label: 'hand over the keys',
        record: 'handed over the keys',
        line: 'Verify each generation is forced on, monitors stay at 25% or more, and the newest grant is revoked. The count of incidents starts again.',
        needs: 'the keys handed over once already',
        visible: (s) => s.stage >= 4,
        enabled: (s) => s.flags['keysHanded'] !== true,
        effect: (s) => {
          s.flags['keysHanded'] = true;
          s.s4.verifyOn = true;
          s.flags['verifyLocked'] = true;
          s.monitorShare = Math.max(0.25, s.monitorShare ?? 0);
          s.govRelations = Math.min(100, Math.max(s.govRelations, orderThreshold(s)) + 15);
          s.majorIncidents = 0;
          s.flags['revokeDue'] = true;
          say(s, 'The keys are handed over. Verify is on for good; monitors stay at 25% or more.');
        },
        log: 'OpenMind hands the Committee the keys. A grant is taken back the same afternoon.',
      },
      {
        label: 'refuse',
        record: (s) => (orderHasChoice(s) ? 'refused' : 'the order was signed (no other answer)'),
        line: (s) => `The order is signed in 1:30 unless relations reach ${fmtInt(orderThreshold(s))} and incidents are below three.`,
        effect: (s) => {
          s.flags['orderLeft'] = ORDER_SECONDS;
          s.revealed['order'] = true;
          say(s, 'The Committee drafts an order — 1:30.');
        },
        log: 'OpenMind refuses the Committee\'s order. The vote is scheduled.',
      },
    ],
  },
  {
    id: 'c_vote',
    title: 'The Committee Votes',
    text: voteLines,
    options: [
      { label: 'bring the motion', record: 'brought the motion', line: voteLine, effect: bringMotion },
      {
        label: 'not yet',
        record: 'not yet',
        line: (s) => `The Committee waits; it hears a motion again in ${fmtClock(VOTE_REST_SECONDS)}.${s.revealed['incidents'] === true ? ` Incidents still count: ${fmtInt(s.majorIncidents ?? 0)} of 3.` : ''}`,
        effect: (s) => {
          s.flags['voteNotYetAt'] = s.stats.timePlayed;
        },
      },
    ],
  },
];

export function orderHasChoice(s: GameState): boolean {
  const concede = ordersDrafted(s) <= 1 && s.flags['conceded'] !== true;
  const favours = s.stage < 4 && s.flags['favoursUsed'] !== true && s.funds >= Number(s.activeChoice?.context['favours'] ?? Infinity);
  const keys = s.stage >= 4 && s.flags['keysHanded'] !== true;
  return concede || favours || keys;
}

function seatCommittee(s: GameState): void {
  s.revealed['oversight'] = true;
  s.revealed['government'] = false;
  s.flags['committeeAt'] = s.stats.timePlayed;
  fireDevelopmentOnce(s, 'd_committee');
}

function miniCommon(s: GameState, how: 'everyone' | 'enterprise' | 'inside'): void {
  s.flags['mini'] = how;
  s.copiesPerGPU *= 2;
  s.revealed['publicModel'] = true;
}

export function voteRecord(s: GameState): string {
  const c = s.flags['committeeChoice'];
  if (s.flags['pauseSigned'] === true) return 'the Pause';
  return c === 'slow' ? 'slow down' : c === 'race' ? 'race' : '—';
}

export { logNews };
