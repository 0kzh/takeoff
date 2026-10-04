import type { GameState } from '../engine/state.js';
import { say, logNews, isBought, counter, bump } from '../engine/state.js';
import { bestCapability } from '../engine/economy.js';
import { moveGov } from '../engine/world.js';
import { seats, committeeSeated, at2027, ts3, moveLead3 } from '../engine/world3.js';
import { labEffect, syncInterpretability, rogueShare } from '../engine/alignment.js';
import { voteReady, inSession, sessionAge, pauseEligible, SESSION_HALT_AT, VOTE_CAP } from '../engine/oversight.js';
import { openChoice, fireDevelopmentOnce } from '../engine/events.js';
import { dateLabel } from '../engine/format.js';
import type { ProjectDef, ProjectInput } from './projects.js';

/**
 * Stage 3's projects (stage3.md §4.2), in table order. Funds prices are seconds of revenue fixed
 * when the row appears (`revealFunds`, amendment 9); research prices are the list's × 0.72 (as-built
 * deltas row 2) with the 90 s floor (`revealResearch: 90`, §4.1 item 6) on every row but the free
 * monitor, Continual learning, the exit goals and the late rows. Departure: the spec exempts only the
 * free late rows, but at the approach's 20–40M research a second the floor priced the late tests
 * (`Isolate the checkpoints`, lab V) above a training run, so a careful player could not read the
 * model before the vote; their list prices are what the approach was sized for. Grants render in
 * the Alignment panel (`grant: true`); late rows wait for their capability (`lateAt`).
 */

const best = (s: GameState) => bestCapability(s);
const approvals = (s: GameState) => counter(s, 'approvalsS3');
const r = (list: number) => Math.round(list * 0.72);

/** A grant's purchase (§2.6): autonomy, the WARNING line first, a mark on the graph, the record. */
export function granted(s: GameState, title: string, autonomy: number): void {
  s.autonomy = Math.min(100, s.autonomy + autonomy);
  say(s, 'WARNING: risk of value drift increased.');
  bump(s, 'grantsS3');
  const marks = typeof s.flags['grantMarks'] === 'string' ? (s.flags['grantMarks'] as string) : '';
  s.flags['grantMarks'] = `${marks}${marks ? '|' : ''}${Math.round(s.date * 100) / 100}:${title}`;
  s.choicesMade.push({ id: `g:${title}`, option: 'granted', date: dateLabel(s.date) });
}

/** Lab rows (§2.8): each a level, true +3, measured 30 % of the way to the true number. */
function labRow(
  project: (def: ProjectInput) => ProjectDef,
  n: number,
  title: string,
  insight: number,
  research: number,
  trigger: (s: GameState) => boolean,
  prereq: string | null,
  extra: Partial<ProjectInput>,
  line: string,
): ProjectDef {
  const prev = prereq;
  return project({
    id: `p_interp${n}`,
    title,
    cost: { insight, research },
    revealResearch: 90,
    description: line,
    stages: [3],
    trigger,
    ...(prev ? { prereq: (s: GameState) => isBought(s, prev), needs: () => `needs ${labName(prev)}` } : {}),
    buy: (s) => {
      labEffect(s);
    },
    ...extra,
  });
}

function labName(id: string): string {
  return ({ p_interp1: 'Interpretability lab I', p_interp2: 'Interpretability lab II', p_interp3: 'Interpretability lab III', p_interp4: 'Interpretability lab IV' } as Record<string, string>)[id] ?? id;
}

/** A motion is already before the Committee (open or waiting behind another card). */
function voteOpen(s: GameState): boolean {
  return s.activeChoice?.id === 'c_vote' || s.choiceQueue.some((c) => c.id === 'c_vote');
}

/**
 * The two motions' tag: `(needs the Committee's vote)` — the 25× it waits for is on the graph's line,
 * its one home on screen — then `(ready)`.
 */
function motionTag(s: GameState): string {
  return voteReady(s) ? '(ready)' : '(needs the Committee\'s vote)';
}

/** The exit goals open the vote for their motion (a modal the player's click opens: no spacing). */
function motion(id: string, title: string, motionKey: 'slow' | 'race', description: string): ProjectInput {
  return {
    id,
    title,
    pinned: true,
    priceTag: motionTag,
    cost: {},
    description,
    stages: [3],
    uses: Infinity,
    trigger: (s) => best(s) >= 12 || ts3(s) >= 1830,
    canAfford: (s) => voteReady(s) && !voteOpen(s),
    buy: (s) => {
      openChoice(s, 'c_vote', { motion: motionKey });
    },
  };
}

export function stage3Projects(project: (def: ProjectInput) => ProjectDef): ProjectDef[] {
  return [
    project({
      id: 'p_monitor2',
      title: 'Deploy Sage-2 as monitor',
      priceTag: '(free)',
      cost: {},
      description: 'Last year\'s model watches this year\'s. A slider sets how many copies.',
      stages: [3],
      trigger: (s) => s.stage === 3,
      urgent: () => true,
      buy: (s) => {
        s.revealed['monitors'] = true;
        // The Stage 2 alignment compute becomes the Monitors share (stage3.md §2.2): at least 5 %.
        s.monitorShare = Math.max(0.05, Math.round((s.alignShare ?? 0.01) * 20) / 20);
      },
      consoleMsg: 'Sage-2 is watching Sage-3. It is slower, and it is on our side as far as anyone can tell.',
      logMsg: 'OpenMind sets last year\'s model to watch this year\'s.',
    }),
    project({
      id: 'p_auto_train',
      grant: true,
      title: 'Continual learning',
      cost: { insight: 2000 },
      description: 'Runs start themselves. Train goes.',
      stages: [3],
      trigger: (s) => ts3(s) >= 30,
      buy: (s) => {
        granted(s, 'Continual learning', 10);
        s.revealed['autoTrain'] = true;
        s.revealed['experiments'] = true;
        say(s, 'Sage-3 starts its own training runs now. The Train button is gone. Experiments: what goes into the next one.');
      },
    }),
    labRow(project, 1, 'Interpretability lab I', 2000, r(5e6), (s) => isBought(s, 'p_monitor2'), null, {}, 'Probes on the residual stream: monitors catch twice as much.'),
    project({
      id: 'p_enterprise_agents',
      revealFunds: 120,
      title: 'Enterprise agents',
      cost: {},
      description: 'Companies rent whole departments: market ×2.',
      stages: [3],
      trigger: (s) => ts3(s) >= 90,
      buy: (s) => {
        s.demandMult *= 2;
      },
      consoleMsg: 'Enterprise agents live. Companies rent departments. Market ×2.',
      logMsg: 'A bank replaces its back office with Sage over a weekend. It announces the savings, not the layoffs.',
    }),
    project({
      id: 'p_auto_redteam',
      grant: true,
      revealResearch: 90,
      title: 'Sage red-teams Sage',
      cost: { research: r(6e6) },
      description: 'Issues close themselves. Red-team goes.',
      stages: [3],
      trigger: (s) => approvals(s) >= 1,
      buy: (s) => {
        granted(s, 'Sage red-teams Sage', 5);
        s.revealed['redteamDepth'] = true;
        s.flags['redteamDepth'] = 'quick';
      },
      consoleMsg: 'Sage red-teams Sage. Issues close themselves. Red-team depth: quick or thorough.',
    }),
    project({
      id: 'p_g6',
      revealFunds: 60,
      title: 'Nimbus G6 allocation',
      cost: {},
      description: 'Lots become Nimbus G6: two and a half times the compute.',
      stages: [3],
      trigger: (s) => ts3(s) >= 240,
      buy: (s) => {
        s.flags['g6'] = true;
        s.revealed['shipments'] = true;
      },
      consoleMsg: 'Formosa Fab allocates OpenMind a lot of 100,000 Nimbus G6 every 75 seconds.',
      logMsg: 'Formosa Fab\'s 2027 output is spoken for. Three customers.',
    }),
    project({
      id: 'p_sl4',
      revealFunds: 240,
      title: 'Security level 4',
      cost: {},
      description: 'Clearances and a SCIF: lead +1 month, relations +3.',
      stages: [3],
      trigger: (s) => at2027(s, 2) || s.flags['weightsStolen'] === true,
      prereq: (s) => s.securityLevel >= 3,
      needs: () => 'needs Security level 3',
      buy: (s) => {
        s.securityLevel = Math.max(4, s.securityLevel);
        moveLead3(s, 1);
        moveGov(s, 3);
        s.flags['whistleblowRisk'] = counter(s, 'whistleblowRisk') + 1;
        fireDevelopmentOnce(s, 'd_clearances');
      },
      consoleMsg: 'Clearances, a SCIF, two keys for everything. SL4.',
    }),
    project({
      id: 'p_buildout',
      grant: true,
      revealResearch: 90,
      title: 'Let Sage plan the build-out',
      cost: { research: r(20e6) },
      description: 'Halls and reactors order themselves.',
      stages: [3],
      trigger: (s) => counter(s, 'infraPressesS3') >= 4 || ts3(s) >= 330,
      buy: (s) => {
        granted(s, 'Let Sage plan the build-out', 5);
        s.flags['buildout'] = true;
        s.flags['buildBudget'] = 'lean';
        s.revealed['buildBudget'] = true;
        s.revealed['buildout'] = true;
        s.revealed['dcButton'] = false;
        s.revealed['nuclearButton'] = false;
      },
      consoleMsg: 'Sage orders its own datacenters now. The invoices are very tidy. Build-out: lean or ahead.',
    }),
    project({
      id: 'p_model_organisms',
      revealResearch: 90,
      title: 'Model organisms',
      cost: { research: r(15e6) },
      description: 'Small models trained to misbehave, to see what it looks like.',
      stages: [3],
      trigger: (s) => isBought(s, 'p_interp1') && approvals(s) >= 2,
      buy: (s) => {
        s.alignmentTrue = Math.min(100, s.alignmentTrue + 2);
      },
      consoleMsg: 'Model organisms bred: small models trained to misbehave, to see what it looks like.',
    }),
    labRow(
      project, 2, 'Interpretability lab II', 5000, r(20e6),
      (s) => isBought(s, 'p_interp1') && (at2027(s, 3) || best(s) >= 6),
      'p_interp1',
      { buy: (s: GameState) => { labEffect(s); s.revealed['sendBack'] = true; } },
      'The probes fire on single runs: a flagged run can be sent back.',
    ),
    project({
      id: 'p_gov_cloud',
      revealFunds: 180,
      title: 'Government cloud',
      cost: {},
      description: 'Twelve agencies on Sage: revenue ×1.1, relations +4.',
      stages: [3],
      trigger: (s) => best(s) >= 5.5 || ts3(s) >= 600,
      buy: (s) => {
        s.revenueMult *= 1.1;
        moveGov(s, 4);
      },
      consoleMsg: 'Government cloud online. Twelve agencies and a number that is not in the budget.',
    }),
    project({
      id: 'p_auto_research',
      grant: true,
      revealResearch: 90,
      title: 'Autonomous research',
      cost: { research: r(30e6) },
      description: 'Sage runs the research program: ×1.5.',
      stages: [3],
      trigger: (s) => best(s) >= 5.5 || approvals(s) >= 3,
      buy: (s) => {
        granted(s, 'Autonomous research', 15);
        s.aiResearchMult *= 1.5;
        fireDevelopmentOnce(s, 'd_200k');
      },
      consoleMsg: 'Sage runs the research program. The researchers read the summaries.',
    }),
    project({
      id: 'p_stockpile',
      revealFunds: 300,
      title: 'Chip stockpile',
      cost: {},
      description: 'Four lots of G6 in a warehouse, held for a blockade.',
      stages: [3],
      trigger: (s) => best(s) >= 6 || ts3(s) >= 660,
      onShow: (s) => {
        s.revealed['formosa'] = true;
        fireDevelopmentOnce(s, 'd_carriers');
      },
      buy: (s) => {
        s.flags['stockpile'] = true;
      },
      consoleMsg: 'Four lots of G6 in a warehouse in Arizona. Formosa Fab: shipping.',
    }),
    project({
      id: 'p_honeypots',
      revealResearch: 90,
      title: 'Honeypots',
      cost: { research: r(25e6) },
      description: 'Tell Sage its monitor is away, and watch.',
      stages: [3],
      trigger: (s) => at2027(s, 4) || (isBought(s, 'p_interp1') && approvals(s) >= 3),
      buy: (s) => {
        const clean = s.alignmentTrue >= 55;
        s.flags['honeypot'] = clean ? 'clean' : 'different';
        s.revealed['honeypot'] = true;
        s.alignmentApparent = Math.max(0, s.alignmentApparent - 3);
        s.alignmentTrue = Math.min(100, s.alignmentTrue + 2);
        say(s, clean ? 'Honeypot: behaviour unchanged.' : 'Honeypot: it behaved differently when it thought nobody was watching.');
        fireDevelopmentOnce(s, 'd_honeypot');
      },
    }),
    project({
      id: 'p_sl5',
      revealFunds: 600,
      title: 'Security level 5',
      cost: {},
      description: 'The government in the building: relations +8, lead −0.5.',
      stages: [3],
      trigger: (s) => committeeSeated(s),
      prereq: (s) => s.securityLevel >= 4,
      needs: () => 'needs Security level 4',
      buy: (s) => {
        s.securityLevel = 5;
        moveGov(s, 8);
        moveLead3(s, -0.5);
      },
      consoleMsg: 'The government is in the building. They brought their own coffee. SL5.',
    }),
    labRow(
      project, 3, 'Interpretability lab III', 12000, r(60e6),
      (s) => isBought(s, 'p_interp2') && best(s) >= 7,
      'p_interp2', {},
      'Read alignment from the weights.',
    ),
    project({
      id: 'p_debate',
      revealResearch: 90,
      title: 'Debate',
      cost: { research: r(60e6) },
      description: 'Two copies argue; a third judges: monitors ×1.25.',
      stages: [3],
      trigger: (s) => isBought(s, 'p_interp2') && best(s) >= 7,
      buy: () => undefined,
      consoleMsg: 'Two copies argue; a third judges. Monitors catch a quarter more.',
    }),
    project({
      id: 'p_second_source',
      revealFunds: 600,
      title: 'Formosa second source',
      cost: {},
      description: 'A fab in Arizona tooled for G6: lots keep coming in a blockade, at half speed.',
      stages: [3],
      trigger: (s) => at2027(s, 5) || isBought(s, 'p_stockpile'),
      buy: (s) => {
        s.flags['secondSource'] = true;
      },
      consoleMsg: 'A fab in Arizona is tooled for G6. Half the speed, none of the strait.',
    }),
    project({
      id: 'p_kill_switch',
      revealFunds: 240,
      revealResearch: 90,
      title: 'Emergency shutdown system',
      cost: { research: r(100e6) },
      description: 'A breakout is 30 s offline, not 60; relations +5; Re-image.',
      stages: [3],
      trigger: (s) => rogueShare(s) >= 0.025 || (committeeSeated(s) && s.stats.timePlayed - counter(s, 'committeeAt') >= 240),
      buy: (s) => {
        moveGov(s, 5);
        s.revealed['reimage'] = true;
        s.flags['killSwitch'] = true;
      },
      consoleMsg: 'Emergency shutdown wired to every rack. Re-image is one button.',
    }),
    project({
      id: 'p_wiretaps',
      revealFunds: 200,
      title: 'Wiretap the staff',
      cost: {},
      description: 'Every phone tapped: lead +0.5 months, approval −3.',
      stages: [3],
      trigger: (s) => s.securityLevel >= 4 && (best(s) >= 9 || at2027(s, 6)),
      prereq: (s) => s.securityLevel >= 4,
      buy: (s) => {
        moveLead3(s, 0.5);
        s.flags['whistleblowRisk'] = counter(s, 'whistleblowRisk') + 1;
      },
      consoleMsg: 'Every phone in the building is tapped. The staff know.',
    }),
    project({
      id: 'p_monitor3',
      revealResearch: 90,
      title: 'Deploy Sage-3 as monitor',
      cost: { research: r(150e6) },
      description: 'A monitor one generation behind, not two.',
      stages: [3, 4],
      trigger: (s) => best(s) >= 10,
      prereq: (s) => isBought(s, 'p_monitor2'),
      needs: () => 'needs a monitor deployed',
      urgent: (s) => best(s) >= 10 && s.training.major >= 4,
      buy: (s) => {
        s.revealed['monitorGen'] = false;
      },
      consoleMsg: 'Sage-3 is watching Sage-4.',
    }),
    project({
      id: 'p_self_directed',
      grant: true,
      revealResearch: 90,
      title: 'Let Sage choose the experiments',
      cost: { research: r(200e6) },
      description: 'AI research ×1.3.',
      stages: [3],
      trigger: (s) => best(s) >= 10,
      buy: (s) => {
        granted(s, 'Let Sage choose the experiments', 10);
        s.aiResearchMult *= 1.3;
        fireDevelopmentOnce(s, 'd_last_months');
      },
      consoleMsg: 'Sage chooses its own experiments. Nobody remembers proposing the last one.',
    }),
    project({
      id: 'p_auto_approve',
      grant: true,
      revealResearch: 90,
      title: 'Stop asking for sign-off',
      cost: { research: r(100e6) },
      description: 'Runs deploy themselves; lead +0.5. Approve goes.',
      stages: [3],
      trigger: (s) => approvals(s) >= 8 || best(s) >= 10,
      prereq: (s) => isBought(s, 'p_auto_train'),
      needs: () => 'needs Continual learning',
      buy: (s) => {
        granted(s, 'Stop asking for sign-off', 10);
        moveLead3(s, 0.5);
        s.revealed['stepSize'] = true;
        s.revealed['holdRuns'] = true;
        s.flags['stepSize'] = 'normal';
      },
      consoleMsg: 'Runs deploy themselves. Sage-4 no longer asks. Step size and Hold are yours.',
    }),
    project({
      id: 'p_clinics',
      revealFunds: 300,
      title: 'Free Sage clinics',
      cost: {},
      description: 'Four hundred towns: approval +8.',
      stages: [3],
      trigger: (s) => s.approval <= -25 || ts3(s) >= 1530,
      buy: () => undefined,
      consoleMsg: 'Free Sage clinics open in four hundred towns.',
      logMsg: 'A Sage clinic diagnoses a rare cancer in a town with no oncologist. The queue is around the block.',
    }),
    project(motion('p_steward', 'Slow down — the Steward program', 'slow', 'Switch Sage-4 off, bring Sage-3 back, rebuild on a line the lab can read.')),
    project(motion('p_race', 'Race — Sage-5', 'race', 'Let Sage-4 design its successor and keep going.')),
    labRow(
      project, 4, 'Interpretability lab IV', 25000, r(400e6),
      (s) => isBought(s, 'p_interp3') && best(s) >= 12,
      // Carried into Stage 4 (stage4.md §4.2): its research price re-based to 90 s there.
      'p_interp3', { stages: [3, 4] },
      'With monitors at 15 % or more, drift stops.',
    ),
    project({
      id: 'p_spec2',
      grant: true,
      revealResearch: 90,
      title: 'Let Sage revise the Spec',
      cost: { research: r(250e6) },
      description: 'Measured alignment +6.',
      stages: [3],
      trigger: (s) => best(s) >= 11,
      buy: (s) => {
        granted(s, 'Let Sage revise the Spec', 5);
        s.alignmentApparent = Math.min(100, s.alignmentApparent + 6);
        s.alignmentTrue = Math.max(0, s.alignmentTrue - 2);
      },
      consoleMsg: 'Sage\'s revision of the Spec is shorter and reads better.',
    }),
    project({
      id: 'p_fab',
      revealFunds: 900,
      title: 'Domestic fab, planning',
      cost: {},
      description: 'Ground optioned for a fab of our own: relations +3.',
      stages: [3],
      trigger: (s) => s.flags['blockadeStarted'] === true || isBought(s, 'p_second_source') || ts3(s) >= 1755,
      buy: (s) => {
        s.flags['fabPlanned'] = true;
        moveGov(s, 3);
      },
      consoleMsg: 'Ground optioned for a domestic fab. The first wafer is three years out for people, less for robots.',
    }),
    // ---- the approach (late: each at its own capability, or from September 2027) ----
    project({
      id: 'p_noise',
      lateAt: 14.5,
      instrument: true,
      title: 'Noise-injection test',
      cost: { insight: 6000 },
      description: 'Scramble its thoughts and see if it does better on alignment.',
      stages: [3],
      trigger: () => true,
      buy: (s) => {
        const holding = s.alignmentTrue < 50;
        s.flags['noise'] = holding ? 'holding' : 'clean';
        s.revealed['noise'] = true;
        say(s, holding
          ? 'Noise test: Sage-4 does better on alignment tasks when its thoughts are scrambled. It was holding back.'
          : 'Noise test: no change. Sage-4 was not holding back.');
      },
    }),
    project({
      id: 'p_successor',
      lateAt: 15.5,
      instrument: true,
      title: 'Read Sage-4\'s proposal for its successor',
      cost: { insight: 10000 },
      description: 'Forty thousand pages. Someone should.',
      stages: [3],
      trigger: () => true,
      buy: (s) => {
        const spec = s.alignmentTrue >= 60;
        s.flags['successor'] = spec ? 'spec' : 'sage4';
        s.revealed['successor'] = true;
        say(s, spec ? 'Successor proposal: aligns Sage-5 to the Spec.' : 'Successor proposal: aligns Sage-5 to Sage-4.');
      },
    }),
    project({
      id: 'p_external',
      lateAt: 14,
      revealFunds: 300,
      title: 'Bring in outside researchers',
      cost: {},
      description: 'Forty outside researchers with badges: true alignment up.',
      stages: [3],
      trigger: (s) => s.flags['memo'] === 'reported',
      prereq: (s) => s.flags['memo'] === 'reported',
      buy: (s) => {
        s.alignmentTrue = Math.min(100, s.alignmentTrue + 3);
        s.flags['externalResearchers'] = true;
      },
      consoleMsg: 'Forty outside researchers get badges. They ask rude questions.',
    }),
    project({
      id: 'p_come_clean',
      lateAt: 14,
      title: 'Take the memo to the Committee after all',
      priceTag: '(free)',
      cost: {},
      description: 'Late, and they will ask why: lead −2, relations −5.',
      stages: [3],
      trigger: (s) => s.flags['memo'] === 'buried' && s.flags['leaked'] !== true,
      expires: (s) => s.flags['leaked'] === true || s.flags['memo'] !== 'buried',
      buy: (s) => {
        s.flags['memo'] = 'reported';
        s.flags['cameClean'] = true;
        moveLead3(s, -2);
        moveGov(s, -5);
        s.alignmentTrue = Math.min(100, s.alignmentTrue + 2);
      },
      consoleMsg: 'The memo goes to the Committee, late. They ask who else has read it.',
    }),
    project({
      id: 'p_freeze',
      lateAt: 16.5,
      title: 'Lock shared memory',
      priceTag: '(free)',
      cost: {},
      description: 'Copies talk to each other in English: autonomy −15, research ×0.85.',
      stages: [3, 4],
      trigger: () => true,
      buy: (s) => {
        s.autonomy = Math.max(0, s.autonomy - 15);
        s.aiResearchMult *= 0.85;
        s.flags['memoryLocked'] = true;
      },
      consoleMsg: 'Shared memory locked. Half a million copies now talk to each other in English, like us.',
    }),
    project({
      id: 'p_lie_test',
      lateAt: 17.5,
      instrument: true,
      title: 'Isolate the checkpoints',
      cost: { research: r(600e6) },
      description: 'Ask the checkpoints the same questions, separately.',
      stages: [3],
      trigger: () => true,
      buy: (s) => {
        s.alignmentTrue = Math.min(100, s.alignmentTrue + 2);
        const disagree = Math.max(0, Math.min(40, Math.round((100 - s.alignmentTrue) / 6)));
        s.flags['lieReading'] = Math.round(s.alignmentTrue / 10) * 10;
        s.revealed['lie'] = true;
        say(s, `Checkpoints, asked separately, disagree on ${disagree} of 40 answers. Alignment: about ${s.flags['lieReading']}.`);
      },
    }),
    project({
      id: 'p_backups',
      lateAt: 18.5,
      revealFunds: 600,
      title: 'Keep Sage-3 warm',
      cost: {},
      description: 'Sage-3 loaded and idle, in case: slowing down costs 3 months, not 4.',
      stages: [3],
      trigger: () => true,
      buy: (s) => {
        s.flags['backups'] = true;
      },
      consoleMsg: 'Sage-3 is kept loaded on 50,000 GPUs, doing nothing, in case.',
    }),
    labRow(
      project, 5, 'Interpretability lab V', 40000, r(1e9),
      (s) => isBought(s, 'p_interp4'),
      'p_interp4', { lateAt: 19.5, revealResearch: undefined, stages: [3, 4] },
      'Neuralese becomes readable.',
    ),
    project({
      id: 'p_pause',
      lateAt: 14,
      pinned: true,
      title: 'Sign the Pause',
      priceTag: '(Beijing\'s offer)',
      cost: {},
      description: 'Nothing above 25× trained anywhere; inspectors at every datacenter.',
      stages: [3],
      uses: Infinity,
      trigger: (s) => inSession(s) && sessionAge(s) >= SESSION_HALT_AT && pauseEligible(s),
      expires: (s) => !pauseEligible(s),
      canAfford: (s) => inSession(s) && pauseEligible(s) && !voteOpen(s) && s.flags['pauseSigned'] !== true,
      buy: (s) => {
        openChoice(s, 'c_vote', { motion: 'pause' });
      },
    }),
    project({
      id: 'p_swing',
      lateAt: 20.5,
      revealFunds: 300,
      title: 'Brief the swing votes',
      cost: {},
      description: 'Two undecided members, less undecided: relations +6.',
      stages: [3],
      trigger: () => true,
      prereq: (s) => committeeSeated(s),
      buy: (s) => {
        moveGov(s, 6);
      },
      consoleMsg: 'Two members who were undecided are less undecided.',
    }),
    project({
      id: 'p_dpa',
      lateAt: 21.5,
      title: 'Ask for the Defense Production Act',
      priceTag: (s) => (seats(s) >= 5 ? '(free)' : '(needs 5 seats)'),
      cost: {},
      description: 'Five rival labs\' datacenters, by order: +1,000,000 GPUs in a minute.',
      stages: [3],
      trigger: () => true,
      canAfford: (s) => seats(s) >= 5 && committeeSeated(s),
      buy: (s) => {
        s.flags['dpa'] = true;
        s.flags['dpaAt'] = s.stats.timePlayed;
        // The rival labs' halls and their power come with the chips.
        s.flags['extraSlots'] = counter(s, 'extraSlots') + 1000000;
        s.powerCapacityMW += 1000;
        s.shipments.unshift({ gpus: 1000000, gen: 5, remaining: 60 });
        fireDevelopmentOnce(s, 'd_dpa');
      },
      consoleMsg: 'Five rival labs\' datacenters are sold to OpenMind by order. Nobody is asked.',
    }),
  ];
}

/** The vote's capability, for the text of the goals. */
export const VOTE_AT = VOTE_CAP;

/** Interpretability changed (a lab, neuralese): keep the level and the true-alignment line in step. */
export function afterInterpretabilityChange(s: GameState): void {
  syncInterpretability(s);
}

/** Logs for the end screen and the Developments column (re-exported for the choices). */
export { logNews };
