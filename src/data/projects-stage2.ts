import { GameState, Cost, isBought, addFunds, counter } from '../engine/state.js';
import { enterStage } from '../engine/stages.js';
import { bestCapability, researchCap } from '../engine/economy.js';
import { visibleProjects } from '../engine/projects.js';
import { licenseCost, licenseData, LICENSE_DATA, scrapeCost, scrapeData, SCRAPE_DATA, WEB_TOTAL, dataShort } from '../engine/data.js';
import { revealAlignment, raiseAlignment, narrowBand, reduceBias } from '../engine/alignment.js';
import { mindSignal } from '../engine/mind.js';
import { moveTempo, EXPORT_CONTROL_SECONDS } from '../engine/rivals.js';
import { moveApproval, moveRelations } from '../engine/world.js';
import { openChoice } from '../engine/events.js';
import { fmtMoneyShort, fmtNum, fmtInt } from '../engine/format.js';
import { S2_FOCUS_BASE, trainCost, startCapability } from '../engine/training.js';
import { project, type ProjectDef } from './project-def.js';

const sinceFlag = (s: GameState, key: string): number => {
  const at = s.flags[key];
  return typeof at === 'number' ? s.stats.timePlayed - at : -1;
};

const scrapesLeftText = (s: GameState): string => {
  const n = Math.round(s.data.webRemaining / SCRAPE_DATA);
  return `${n} of ${WEB_TOTAL / SCRAPE_DATA} left`;
};

const wallSeconds = (s: GameState): number => {
  const at = s.flags['cardWallSince'];
  return typeof at === 'number' ? s.stats.timePlayed - at : 0;
};

export const AUTOMATE_CAPABILITY = 10;
export const AUTOMATE_SHOW_CAPABILITY = 5;

export const STAGE2_PROJECTS: ProjectDef[] = [
  project({
    id: 's2_chip_g5',
    title: 'Nimbus G5 chips',
    stages: [2],
    cost: { research: 6000, funds: 200000 },
    revealFunds: 60,
    description: 'Compute per GPU ×4.',
    trigger: (s) => s.stage === 2,
    urgent: (s) => s.stage === 2 && s.chipGen < 2,
    buy: (s) => {
      s.chipGen = Math.max(s.chipGen, 2);
    },
    consoleMsg: 'The G5s are in. Every GPU does the work of four.',
    logMsg: 'Nimbus ships the G5. OpenMind\'s G4s are now "legacy", which means slow.',
  }),
  project({
    id: 's2_release_policy',
    title: 'Release Policy',
    stages: [2],
    cost: { insight: 20 },
    description: 'Choose whether each model ships.',
    trigger: (s) => counter(s, 'releasesThisStage') >= 1,
    buy: () => undefined,
    consoleMsg: 'Release Policy adopted. From now on we decide which Sages the world meets.',
    logMsg: 'OpenMind adopts a release policy. The policy is one page. The page is mostly "it depends".',
  }),
  project({
    id: 's2_scrape',
    title: 'Scrape the web',
    stages: [1, 2, 3],
    priceTag: (s) => `${fmtInt(scrapeCost(s))} research · ${scrapesLeftText(s)}`,
    cost: (s) => ({ research: scrapeCost(s) }),
    description: `+${SCRAPE_DATA}T tokens of training data.`,
    trigger: (s) => s.revealed['data'] === true && s.data.webRemaining > 0,
    urgent: (s) => dataShort(s, startCapability(s)),
    buy: (s) => scrapeData(s),
    uses: WEB_TOTAL / SCRAPE_DATA,
    repeatable: true,
    sideline: true,
  }),
  project({
    id: 's2_licensing',
    title: 'Data licensing deal',
    stages: [2, 3],
    priceTag: (s) => `${fmtMoneyShort(licenseCost(s))} · repeatable`,
    cost: (s) => ({ funds: licenseCost(s) }),
    description: `+${LICENSE_DATA}T tokens of training data. Price doubles each time.`,
    trigger: (s) => s.flags['webExhausted'] === true,
    buy: (s) => licenseData(s),
    uses: Infinity,
    repeatable: true,
    sideline: true,
    logMsg: 'OpenMind buys the archives of three newspapers, a forum about bass fishing, and a dictionary.',
  }),
  project({
    id: 's2_ai_rd',
    title: 'Sage writes our code',
    stages: [2],
    cost: { research: 6000, insight: 40 },
    description: "Research scales with Sage's capability.",
    trigger: (s) => bestCapability(s) >= 2,
    buy: (s) => {
      s.revealed['researchShare'] = true;
    },
    consoleMsg: 'Sage joins the research team. The humans review its pull requests. Slowly.',
    logMsg: 'Sage wrote 30% of this week\'s commits. The other 70% reviewed Sage\'s commits.',
  }),
  project({
    id: 's2_rl_envs',
    title: 'RL environments',
    stages: [2, 3],
    cost: { research: 11000, insight: 60 },
    description: 'Data goes 50% further. Runs gain a little more.',
    trigger: (s) => bestCapability(s) >= 2,
    buy: () => undefined,
    consoleMsg: 'RL environments built. Sage has beaten all of them. We are building more.',
  }),
  project({
    id: 's2_pipeline',
    title: 'Training pipeline',
    stages: [2],
    chain: true,
    cost: { research: 9000 },
    description: 'Train the next run during evals.',
    trigger: (s) => counter(s, 'runsThisStage') >= 3 && s.datacenters >= 2,
    buy: () => undefined,
    consoleMsg: 'Training pipeline live. One cluster trains while the other ships.',
    logMsg: 'OpenMind now trains its next model before the last one is out. Reviewers are told to hurry.',
  }),
  project({
    id: 's2_recruiting',
    title: 'Recruiting drive',
    stages: [2, 3],
    revealFunds: 45,
    cost: (s) => ({ funds: 300000 * Math.pow(3, s.projects['s2_recruiting']?.bought ?? 0) }),
    description: '+8 researchers. Each drive costs ×3.',
    trigger: (s) => s.research < 0.6 * researchCap(s) && (s.flags['runsThisStage'] as number | undefined ?? 0) >= 1,
    buy: (s) => {
      s.researchers += 8;
    },
    uses: 3,
    repeatable: true,
    rehide: true,
    sideline: true,
    consoleMsg: 'Eight researchers start Monday. Three of them already have badges from somewhere else.',
  }),
  project({
    id: 's2_inference',
    title: 'Inference optimizations',
    stages: [2, 3],
    revealFunds: 60,
    cost: (s) => ({ funds: 500000 * Math.pow(4, s.projects['s2_inference']?.bought ?? 0) }),
    description: 'Copies per GPU ×1.25.',
    trigger: (s) => s.gpus >= 2000,
    buy: (s) => {
      s.copyBoost *= 1.25;
    },
    uses: 2,
    repeatable: true,
    rehide: true,
    sideline: true,
    consoleMsg: 'Inference optimized. The same GPUs serve a quarter more customers.',
  }),
  project({
    id: 's2_building',
    title: 'New building',
    stages: [2, 3],
    cost: (s) => buildingCost(s),
    description: 'Research capacity ×2.',
    trigger: (s) => researchDemand(s) > 0.8 * researchCap(s) || wallSeconds(s) >= 60,
    urgent: (s) => researchDemand(s) > researchCap(s) || wallSeconds(s) >= 60,
    buy: (s) => {
      s.labMult *= 2;
    },
    uses: 3,
    repeatable: true,
    rehide: true,
    consoleMsg: 'The new building opens. The lobby has a sculpture of a brain. Research capacity doubled.',
    logMsg: 'OpenMind moves into a building with a lobby. The lobby has a sculpture of a brain. It is open-source.',
  }),
  project({
    id: 's2_hyperscale',
    title: 'Hyperscale campuses',
    stages: [2, 3],
    cost: { research: 9000, funds: 1000000 },
    revealFunds: 90,
    description: 'Datacenters hold ×10 GPUs, bought 10,000 at a time.',
    trigger: (s) => s.datacenters >= 3,
    buy: (s) => {
      s.dcTier = Math.max(s.dcTier, 2);
    },
    consoleMsg: 'Campus plans approved. Every hall holds ten times the GPUs; batches of 10,000.',
    logMsg: 'Abilene wants a second substation. Abilene gets a second substation.',
  }),
  project({
    id: 's2_chip_g6',
    title: 'Nimbus G6 chips',
    stages: [2, 3],
    cost: { research: 25000, funds: 20000000 },
    revealFunds: 120,
    description: 'Compute per GPU ×4.',
    trigger: (s) => s.chipGen >= 2 && s.gpus >= 20000,
    buy: (s) => {
      s.chipGen = Math.max(s.chipGen, 3);
    },
    consoleMsg: 'The G6s are in. Sixteen G4s in every slot.',
    logMsg: 'The Nimbus G6 needs liquid cooling, a dedicated substation, and a moment of silence.',
  }),
  project({
    id: 's2_work',
    title: 'Sage for Work',
    stages: [2],
    cost: { research: 16000, funds: 2000000 },
    revealFunds: 60,
    description: 'Demand ×3, tempo +3. Jobs start to go.',
    trigger: (s) => bestCapability(s) >= 3,
    buy: (s) => {
      s.demandMult *= 3;
      s.flags['workAt'] = s.stats.timePlayed;
      moveTempo(s, 3);
    },
    consoleMsg: 'Sage for Work launches. Demand triples.',
    logMsg: 'Sage for Work attends meetings so you don\'t have to. The meetings remain.',
  }),
  project({
    id: 's2_gov_contracts',
    title: 'Government contracts',
    stages: [2, 3],
    cost: { research: 9000 },
    description: 'Cash now. Contracts pay ×1.5.',
    trigger: (s) => s.revealed['government'] === true && s.govRelations >= 55,
    buy: (s) => {
      addFunds(s, Math.max(100000, 60 * s.stats.revPerSec));
      const now = typeof s.flags['contractMult'] === 'number' ? (s.flags['contractMult'] as number) : 1;
      s.flags['contractMult'] = now * 1.5;
      moveRelations(s, 5);
    },
    consoleMsg: 'The Department of Energy signs. Sixty seconds of revenue, up front.',
    logMsg: 'The Department of Energy buys 400 seats and a classified Sage. The classified one is the same, with a badge.',
  }),
  project({
    id: 's2_mega_round',
    title: 'Mega-round',
    stages: [2],
    cost: { insight: 150 },
    description: 'Pick one of two term sheets.',
    trigger: (s) => bestCapability(s) >= 3 && counter(s, 'releasesThisStage') >= 2,
    buy: (s) => {
      openChoice(s, 'c_funding', {}, { force: true });
    },
    logMsg: 'OpenMind raises a round with a chart that goes up. The press release is one sentence.',
  }),
  project({
    id: 's2_security',
    title: 'Security office',
    stages: [2, 3],
    cost: { research: 8000, funds: 1000000 },
    revealFunds: 45,
    description: 'Unlocks security levels. Baiwen wants the weights.',
    trigger: (s) => s.baiwen.present,
    urgent: (s) => s.baiwen.present && !s.revealed['security'],
    buy: (s) => {
      s.revealed['security'] = true;
    },
    consoleMsg: 'Mo took the whiteboards out of the hallway. Security level 1.',
    logMsg: 'OpenMind hires a head of security. Her first act is to remove the whiteboards from the hallway.',
  }),
  project({
    id: 's2_egress',
    title: 'Egress monitoring',
    stages: [2, 3],
    chain: true,
    cost: { research: 10000, funds: 500000 },
    revealFunds: 30,
    description: 'Every theft is noticed.',
    trigger: (s) => isBought(s, 's2_security'),
    buy: (s) => {
      s.flags['egress'] = true;
    },
    consoleMsg: 'Egress monitoring live. So far every byte is accounted for.',
  }),
  project({
    id: 's2_export',
    title: 'Export controls lobbying',
    stages: [2, 3],
    cost: { research: 15000 },
    description: 'Baiwen gets no chips for 6 minutes. Tempo +4.',
    trigger: (s) => s.baiwen.present && s.revealed['government'] === true && s.govRelations >= 60,
    buy: (s) => {
      s.flags['exportControlsUntil'] = s.stats.timePlayed + EXPORT_CONTROL_SECONDS;
      moveTempo(s, 4);
    },
    consoleMsg: 'Chip exports to Baiwen restricted. Baiwen announces its own chips. Everyone checks the calendar.',
    logMsg: 'Chip exports to Baiwen are restricted. Baiwen announces it will build its own. Everyone checks the calendar.',
  }),
  project({
    id: 's2_evals',
    title: 'Dangerous capability evals',
    stages: [2, 3],
    cost: { research: 11000, funds: 500000 },
    revealFunds: 45,
    description: 'Red lines come with warning.',
    trigger: (s) => bestCapability(s) >= 4,
    buy: (s) => {
      s.revealed['dangerEvals'] = true;
    },
    consoleMsg: 'Dangerous capability evals running. We would like the bio answer to stay "no".',
    logMsg: 'OpenMind now tests whether Sage can help build a bioweapon. It would like the answer to stay no.',
  }),
  project({
    id: 's2_alignment_team',
    title: 'Alignment team',
    stages: [2],
    cost: { research: 10000, insight: 50 },
    description: "Shows Sage's alignment, roughly.",
    trigger: (s) => s.flags['rewardHacking'] === true && !isBought(s, 'p_alignment_team'),
    urgent: (s) => s.flags['rewardHacking'] === true,
    buy: (s) => {
      revealAlignment(s);
    },
    consoleMsg: 'Alignment team formed. They have a lot of questions. So do we.',
  }),
  project({
    id: 's2_spec',
    title: 'Model Spec',
    stages: [2, 3],
    cost: { research: 9000, insight: 80 },
    description: "Sage's constitution. Alignment +4, band −3.",
    trigger: (s) => s.revealed['alignment'] === true,
    buy: (s) => {
      raiseAlignment(s, 4);
      narrowBand(s, 3);
    },
    consoleMsg: 'Model Spec published. Sage read it in 0.2 seconds and had no notes, which is a little suspicious.',
  }),
  project({
    id: 's2_cot',
    title: 'Chain-of-thought monitoring',
    stages: [2, 3],
    cost: { research: 9000 },
    description: 'Read the scratchpad. Band −6.',
    trigger: (s) => s.revealed['alignment'] === true,
    buy: (s) => {
      narrowBand(s, 6);
      mindSignal(s, 'pleasing', 'Chain-of-thought monitoring');
    },
    consoleMsg: 'We can read Sage\'s scratchpad. Mostly it\'s about the task. Mostly.',
    logMsg: 'Kit: the scratchpad has a section called "what the reviewer wants to hear". It is well organised.',
  }),
  project({
    id: 's2_probes',
    title: 'Linear probes',
    stages: [2, 3],
    chain: true,
    cost: { research: 16000, insight: 120 },
    description: 'Catch Sage lying. Band −5.',
    trigger: (s) => isBought(s, 's2_cot'),
    buy: (s) => {
      narrowBand(s, 5);
      s.revealed['interpretability'] = true;
      mindSignal(s, 'watched', 'Linear probes');
    },
    consoleMsg: 'Linear probes trained. There are several directions for "lying". Some of them are lit.',
  }),
  project({
    id: 's2_redteam',
    title: 'Red team',
    stages: [2, 3],
    cost: { research: 9000, funds: 400000 },
    revealFunds: 45,
    description: 'Paid to trick Sage. Truer estimate.',
    trigger: (s) => isBought(s, 's2_evals'),
    buy: (s) => {
      reduceBias(s, 2);
    },
    consoleMsg: 'Red team hired. Sage was tricked twice. The red team, eleven times.',
  }),
  project({
    id: 's2_honesty',
    title: 'Honesty training',
    stages: [2, 3],
    chain: true,
    cost: { research: 20000, insight: 150 },
    description: 'Sage admits bad code. Alignment +3, truer estimate.',
    trigger: (s) => isBought(s, 's2_spec'),
    buy: (s) => {
      raiseAlignment(s, 3);
      reduceBias(s, 2);
    },
    consoleMsg: 'Honesty training done. Morale is down. Code quality is up.',
  }),
  project({
    id: 's2_sae',
    title: 'Sparse autoencoders',
    stages: [2, 3],
    chain: true,
    cost: { research: 24000, insight: 200 },
    description: 'Sixteen million features. Band −7, truer estimate.',
    trigger: (s) => isBought(s, 's2_probes'),
    buy: (s) => {
      narrowBand(s, 7);
      reduceBias(s, 2);
      mindSignal(s, 'watched', 'Sparse autoencoders');
      mindSignal(s, undefined, 'Sparse autoencoders');
    },
    consoleMsg: 'Sixteen million features. Feature 4,113,902 fires on "being watched".',
  }),
  project({
    id: 's2_commitments',
    title: 'Safety pledges',
    stages: [2, 3],
    sideline: true,
    cost: { research: 10000, funds: 300000 },
    revealFunds: 30,
    description: 'Approval +8, tempo −3. Job losses stop hurting approval.',
    trigger: (s) => s.revealed['public'] === true,
    buy: (s) => {
      moveApproval(s, 8);
      moveTempo(s, -3);
    },
    consoleMsg: 'Safety commitments published. Two newspapers publish a list of things we did.',
    logMsg: 'OpenMind publishes a list of things it promises not to do. Two papers publish a list of things it did.',
  }),
  project({
    id: 's2_compute_cap',
    title: 'Compute cap proposal',
    stages: [2, 3],
    sideline: true,
    cost: { insight: 150 },
    description: 'Tempo −15. Baiwen may cheat.',
    trigger: (s) => s.revealed['alignment'] === true && s.baiwen.present && s.govRelations >= 60,
    buy: (s) => {
      moveTempo(s, -15);
      s.flags['computeCap'] = true;
    },
    consoleMsg: 'Compute cap proposed. To everyone\'s surprise, people are listening.',
    logMsg: 'Someone in the policy team drafted a proposal to slow everything down. It is very short.',
  }),
  project({
    id: 's2_automate',
    title: 'Automate the Lab',
    stages: [2],
    pinned: true,
    cost: () => ({ research: 30000, insight: 150 }),
    canAfford: (s) => bestCapability(s) >= AUTOMATE_CAPABILITY && s.research >= 30000 && s.insight >= 150,
    description: 'Sage does all the research.',
    status: (s) => {
      const c = bestCapability(s);
      if (c >= AUTOMATE_CAPABILITY) return { text: `Sage ${fmtNum(c, 1)}× · ready`, fraction: 1 };
      const runs = Math.max(1, Math.ceil(Math.log(AUTOMATE_CAPABILITY / c) / Math.log(1 + S2_FOCUS_BASE.capability + 0.03)));
      return { text: `Sage ${fmtNum(c, 1)}× / ${AUTOMATE_CAPABILITY}× · ~${runs} run${runs === 1 ? '' : 's'}`, fraction: Math.log(c / AUTOMATE_SHOW_CAPABILITY) / Math.log(AUTOMATE_CAPABILITY / AUTOMATE_SHOW_CAPABILITY) };
    },
    trigger: (s) => bestCapability(s) >= AUTOMATE_SHOW_CAPABILITY,
    urgent: (s) => bestCapability(s) >= AUTOMATE_CAPABILITY,
    onShow: (s) => {
      s.flags['automateAt'] = s.stats.timePlayed;
    },
    buy: (s) => {
      enterStage(s, 3);
    },
    logMsg: 'Sage has asked, politely, whether it could just do the research.',
  }),
];

export function automateShownFor(s: GameState): number {
  return sinceFlag(s, 'automateAt');
}

export const BUILDING_RESEARCH = 6000;
export const BUILDING_FUNDS = 500000;

export function buildingCost(s: GameState): Cost {
  const n = s.projects['s2_building']?.bought ?? 0;
  return { research: BUILDING_RESEARCH * Math.pow(1.5, n), funds: BUILDING_FUNDS * Math.pow(3, n) };
}

/** The most research anything on screen, or the next run, asks for. */
export function researchDemand(s: GameState): number {
  let most = trainCost(s).research ?? 0;
  for (const p of visibleProjects(s)) {
    if (p.id === 's2_building') continue;
    most = Math.max(most, p.cost(s).research ?? 0);
  }
  return most;
}
