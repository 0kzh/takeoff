import { GameState, isBought, addFunds, counter } from '../engine/state.js';
import { enterStage } from '../engine/stages.js';
import { bestCapability } from '../engine/economy.js';
import { licenseCost, licenseData, LICENSE_DATA } from '../engine/data.js';
import { revealAlignment, raiseAlignment, narrowBand, reduceBias } from '../engine/alignment.js';
import { moveTempo, EXPORT_CONTROL_SECONDS } from '../engine/rivals.js';
import { moveApproval, moveRelations } from '../engine/world.js';
import { openChoice } from '../engine/events.js';
import { fmtMoneyShort } from '../engine/format.js';
import { project, type ProjectDef } from './project-def.js';

const sinceFlag = (s: GameState, key: string): number => {
  const at = s.flags[key];
  return typeof at === 'number' ? s.stats.timePlayed - at : -1;
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
    cost: { research: 8000, funds: 200000 },
    revealFunds: 60,
    revealResearch: 60,
    description: 'Nimbus swaps every GPU in the fleet. Four times the compute per GPU.',
    trigger: (s) => s.stage === 2,
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
    description: 'Every model gets a decision: deploy it, or keep it internal.',
    trigger: (s) => counter(s, 'releasesThisStage') >= 1,
    buy: () => undefined,
    consoleMsg: 'Release Policy adopted. From now on we decide which Sages the world meets.',
    logMsg: 'OpenMind adopts a release policy. The policy is one page. The page is mostly "it depends".',
  }),
  project({
    id: 's2_licensing',
    title: 'Data licensing deal',
    stages: [2],
    priceTag: (s) => `(${fmtMoneyShort(licenseCost(s))} · repeatable)`,
    cost: (s) => ({ funds: licenseCost(s) }),
    description: `+${LICENSE_DATA}T tokens of training data. Each deal costs twice the last.`,
    trigger: (s) => s.revealed['data'] === true,
    buy: (s) => licenseData(s),
    uses: Infinity,
    repeatable: true,
    sideline: true,
    logMsg: 'OpenMind buys the archives of three newspapers, a forum about bass fishing, and a dictionary.',
  }),
  project({
    id: 's2_synthetic',
    title: 'Synthetic Data Engine',
    stages: [2],
    cost: { research: 10000, insight: 40 },
    revealResearch: 90,
    description: 'Idle copies write training data instead of waiting for customers.',
    trigger: (s) => s.revealed['data'] === true,
    buy: (s) => {
      s.revealed['synthetic'] = true;
    },
    consoleMsg: 'Synthetic Data Engine live. Idle copies now write textbooks.',
    logMsg: 'Sage writes its own textbooks. They are good, and a little smug.',
  }),
  project({
    id: 's2_ai_rd',
    title: 'Sage writes our code',
    stages: [2],
    cost: { research: 8000, insight: 40 },
    revealResearch: 80,
    description: 'Copies join the research team. Research speeds up with capability.',
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
    stages: [2],
    cost: { research: 14000, insight: 60 },
    revealResearch: 110,
    description: 'Ten thousand small worlds to practise in. Data goes 50% further; runs gain a little more.',
    trigger: (s) => bestCapability(s) >= 2 && s.revealed['data'] === true,
    buy: () => undefined,
    consoleMsg: 'RL environments built. Sage has beaten all of them. We are building more.',
  }),
  project({
    id: 's2_pipeline',
    title: 'Training pipeline',
    stages: [2],
    chain: true,
    cost: { research: 12000 },
    revealResearch: 100,
    description: 'Two clusters. The next run can train while the last model is still being evaluated.',
    trigger: (s) => counter(s, 'runsThisStage') >= 3 && s.datacenters >= 2,
    buy: () => undefined,
    consoleMsg: 'Training pipeline live. One cluster trains while the other ships.',
    logMsg: 'OpenMind now trains its next model before the last one is out. Reviewers are told to hurry.',
  }),
  project({
    id: 's2_building',
    title: 'New building',
    stages: [2],
    cost: { research: 10000, funds: 500000 },
    revealFunds: 60,
    revealResearch: 60,
    description: 'A lobby, and research capacity ×2.',
    trigger: (s) => s.labSpace >= 10 || wallSeconds(s) >= 60,
    urgent: (s) => wallSeconds(s) >= 60,
    buy: (s) => {
      s.labMult *= 2;
    },
    consoleMsg: 'The new building opens. The lobby has a sculpture of a brain. Research capacity doubled.',
    logMsg: 'OpenMind moves into a building with a lobby. The lobby has a sculpture of a brain. It is open-source.',
  }),
  project({
    id: 's2_hyperscale',
    title: 'Hyperscale campuses',
    stages: [2],
    cost: { research: 12000, funds: 1000000 },
    revealFunds: 90,
    revealResearch: 80,
    description: 'Every datacenter holds ten times the GPUs. GPUs come in batches of 10,000.',
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
    stages: [2],
    cost: { research: 25000, funds: 20000000 },
    revealFunds: 120,
    revealResearch: 120,
    description: 'Liquid cooling, a substation, and sixteen times the compute per GPU.',
    trigger: (s) => s.chipGen >= 2 && s.gpus >= 20000,
    buy: (s) => {
      s.chipGen = Math.max(s.chipGen, 3);
    },
    consoleMsg: 'The G6s are in. Sixteen G4s in every slot.',
    logMsg: 'The Nimbus G6 needs liquid cooling, a dedicated substation, and a moment of silence.',
  }),
  project({
    id: 's2_campus',
    title: 'Research campus',
    stages: [2],
    cost: { research: 24000 },
    revealResearch: 150,
    description: 'Most of it is server halls. Research capacity ×2.',
    trigger: (s) => isBought(s, 's2_building') && bestCapability(s) >= 6,
    buy: (s) => {
      s.labMult *= 2;
    },
    consoleMsg: 'Research campus open. The humans have a nice corner.',
  }),
  project({
    id: 's2_work',
    title: 'Sage for Work',
    stages: [2],
    cost: { research: 16000, funds: 2000000 },
    revealFunds: 60,
    revealResearch: 100,
    description: 'Sage attends the meetings. Demand ×3. People start to notice who is not in the room.',
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
    stages: [2],
    cost: { research: 12000 },
    revealResearch: 100,
    description: 'Four hundred seats and a classified version. A lump of revenue; contracts pay half again as much.',
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
    description: 'More money than the company can spell. Two term sheets to choose from.',
    trigger: (s) => bestCapability(s) >= 3 && counter(s, 'releasesThisStage') >= 2,
    buy: (s) => {
      openChoice(s, 'c_funding', {}, { force: true });
    },
    logMsg: 'OpenMind raises a round with a chart that goes up. The press release is one sentence.',
  }),
  project({
    id: 's2_security',
    title: 'Security office',
    stages: [2],
    cost: { research: 8000, funds: 1000000 },
    revealFunds: 45,
    revealResearch: 60,
    description: 'A head of security, and a security level to raise. Baiwen is interested in the weights.',
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
    stages: [2],
    chain: true,
    cost: { research: 10000, funds: 500000 },
    revealFunds: 30,
    revealResearch: 60,
    description: 'Every byte leaving the building is counted. A theft is always noticed.',
    trigger: (s) => isBought(s, 's2_security'),
    buy: (s) => {
      s.flags['egress'] = true;
    },
    consoleMsg: 'Egress monitoring live. So far every byte is accounted for.',
  }),
  project({
    id: 's2_export',
    title: 'Export controls lobbying',
    stages: [2],
    cost: { research: 15000 },
    revealResearch: 100,
    description: 'Chips stop flowing to Baiwen for six minutes. Tempo rises.',
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
    stages: [2],
    cost: { research: 14000, funds: 500000 },
    revealFunds: 45,
    revealResearch: 100,
    description: 'Bio and cyber rows on every eval card. Red lines arrive with warning instead of by surprise.',
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
    revealResearch: 100,
    description: 'They have questions. The first answer is an estimate with a wide band.',
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
    stages: [2],
    cost: { research: 12000, insight: 80 },
    revealResearch: 90,
    description: 'A written constitution for Sage. Alignment +4, band −3.',
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
    stages: [2],
    cost: { research: 11000 },
    revealResearch: 90,
    description: 'Read the scratchpad. Band −6.',
    trigger: (s) => s.revealed['alignment'] === true,
    buy: (s) => {
      narrowBand(s, 6);
    },
    consoleMsg: 'We can read Sage\'s scratchpad. Mostly it\'s about the task. Mostly.',
    logMsg: 'Kit: the scratchpad has a section called "what the reviewer wants to hear". It is well organised.',
  }),
  project({
    id: 's2_probes',
    title: 'Linear probes',
    stages: [2],
    chain: true,
    cost: { research: 16000, insight: 120 },
    revealResearch: 110,
    description: 'The direction in Sage\'s activations that means "lying". Band −5.',
    trigger: (s) => isBought(s, 's2_cot'),
    buy: (s) => {
      narrowBand(s, 5);
      s.revealed['interpretability'] = true;
    },
    consoleMsg: 'Linear probes trained. There are several directions for "lying". Some of them are lit.',
  }),
  project({
    id: 's2_redteam',
    title: 'Red team',
    stages: [2],
    cost: { research: 12000, funds: 400000 },
    revealFunds: 45,
    revealResearch: 90,
    description: 'People paid to trick Sage. The estimate gets more honest.',
    trigger: (s) => isBought(s, 's2_evals'),
    buy: (s) => {
      reduceBias(s, 2);
    },
    consoleMsg: 'Red team hired. Sage was tricked twice. The red team, eleven times.',
  }),
  project({
    id: 's2_honesty',
    title: 'Honesty training',
    stages: [2],
    chain: true,
    cost: { research: 20000, insight: 150 },
    revealResearch: 120,
    description: 'Sage says when the code is bad. Alignment +3; the estimate gets more honest.',
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
    stages: [2],
    chain: true,
    cost: { research: 24000, insight: 200 },
    revealResearch: 150,
    description: 'Sage\'s mind, flattened into sixteen million features. Band −7.',
    trigger: (s) => isBought(s, 's2_probes'),
    buy: (s) => {
      narrowBand(s, 7);
      reduceBias(s, 2);
    },
    consoleMsg: 'Sixteen million features. Feature 4,113,902 fires on "being watched".',
  }),
  project({
    id: 's2_commitments',
    title: 'Public safety commitments',
    stages: [2],
    sideline: true,
    cost: { research: 10000, funds: 300000 },
    revealFunds: 30,
    revealResearch: 60,
    description: 'A list of things we promise not to do. Approval +8, tempo −3. Job losses stop costing approval.',
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
    stages: [2],
    sideline: true,
    cost: { insight: 150 },
    description: 'Propose an international limit on training runs. Tempo −15. Baiwen may not keep to it.',
    trigger: (s) => s.revealed['alignment'] === true && s.baiwen.present && s.govRelations >= 60,
    buy: (s) => {
      moveTempo(s, -15);
      s.flags['computeCap'] = true;
    },
    consoleMsg: 'Compute cap proposed. To everyone\'s surprise, people are listening.',
    logMsg: 'Someone in the policy team drafted a proposal to slow everything down. It is very short.',
  }),
  project({
    id: 's2_continuous',
    title: 'Continuous learning',
    stages: [2],
    cost: { research: 18000, insight: 100 },
    revealResearch: 120,
    description: 'Sage learns on the job. Every run gains a little more. Seeds the next stage.',
    trigger: (s) => bestCapability(s) >= 6,
    buy: (s) => {
      s.flags['continuous'] = true;
    },
    consoleMsg: 'Continuous learning on. Sage has not stopped working since Tuesday.',
    logMsg: 'Sage-3.5 learns on the job now. It has not stopped working since Tuesday.',
  }),
  project({
    id: 's2_automate',
    title: 'Automate the Lab',
    stages: [2],
    pinned: true,
    priceTag: (s) => `(30,000 research, 150 insight, ${fmtMoneyShort(automateFunds(s))}${bestCapability(s) < AUTOMATE_CAPABILITY ? ` · needs ${AUTOMATE_CAPABILITY}×` : ''})`,
    cost: (s) => ({ research: 30000, insight: 150, funds: automateFunds(s) }),
    canAfford: (s) => bestCapability(s) >= AUTOMATE_CAPABILITY && s.research >= 30000 && s.insight >= 150 && s.funds >= automateFunds(s),
    description: 'Sage does the research. All of it. The humans move to review.',
    trigger: (s) => bestCapability(s) >= AUTOMATE_SHOW_CAPABILITY,
    urgent: (s) => bestCapability(s) >= AUTOMATE_CAPABILITY,
    onShow: (s) => {
      s.flags['automateAt'] = s.stats.timePlayed;
      s.flags['price:s2_automate'] = Math.max(1000000, 180 * s.stats.revPerSec);
    },
    buy: (s) => {
      enterStage(s, 3);
    },
    logMsg: 'Sage has asked, politely, whether it could just do the research.',
  }),
];

export function automateFunds(s: GameState): number {
  const fixed = s.flags['price:s2_automate'];
  return typeof fixed === 'number' ? fixed : Math.max(1000000, 180 * s.stats.revPerSec);
}

export function automateShownFor(s: GameState): number {
  return sinceFlag(s, 'automateAt');
}
