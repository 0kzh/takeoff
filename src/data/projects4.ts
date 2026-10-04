import type { GameState } from '../engine/state.js';
import { say, logNews, isBought } from '../engine/state.js';
import { bestCapability } from '../engine/economy.js';
import { moveGov } from '../engine/world.js';
import { seats } from '../engine/world3.js';
import { openChoice, fireDevelopmentOnce } from '../engine/events.js';
import { CAR_PLANT_ROBOTS, fleetAuto } from '../engine/fleet.js';
import { talksOpen, startAgenda, agendaQueueSeconds, agendaSeconds, AGENDA_TITLES } from '../engine/treaty.js';
import { exitStage4, ts4, at, NANO_SECONDS, moveLead4, revokeNewest } from '../engine/stage4.js';
import { fmtClock } from '../engine/format.js';
import { granted } from './projects3.js';
import type { ProjectDef, ProjectInput } from './projects.js';

/**
 * Stage 4's projects (stage4.md §4.2), in table order. Research prices are 90 s of the research rate
 * when the row appears (`revealResearch: 90`), materials prices the list or 90 s of mining
 * (`revealMaterials: 90`), agenda items the Committee's time. Grants render in the Alignment panel's
 * list and each hands over a selector in the same beat (§2.5, G28). The exits are pinned.
 */

const best = (s: GameState) => bestCapability(s);
/**
 * A research card costs this many seconds of the research rate when it appears (stage4.md §4.1 item 1
 * has 90 s; §9.5's knob: the first generations are more than 5:30 apart for a player who buys every
 * card, and 45 s halves the gaps). Each card prints what it delays the next generation by.
 */
export const RESEARCH_SECONDS_S4 = 30;
const treaty = (s: GameState) => s.s4.treaty;
/** The approach (§4.1 item 2): treaty 60 %, or 150×, or September 2028. */
export const approach4 = (s: GameState) => treaty(s) >= 60 || best(s) >= 150 || at(s, 2028, 9);

/** An agenda item's card: free, 90 s of the Committee's time, queued behind whatever is running. */
function agendaRow(project: (def: ProjectInput) => ProjectDef, id: string, key: string, description: string, extra: Partial<ProjectInput>): ProjectDef {
  return project({
    id,
    title: AGENDA_TITLES[key] ?? key,
    priceTag: (s) => {
      const wait = agendaQueueSeconds(s);
      return wait > 0 ? `(${fmtClock(agendaSeconds(s, key))} of the Committee, after ${fmtClock(wait)})` : `(${fmtClock(agendaSeconds(s, key))} of the Committee)`;
    },
    cost: {},
    description,
    stages: [4],
    trigger: () => true,
    buy: (s) => {
      startAgenda(s, key);
    },
    ...extra,
  });
}

/** A grant's selector arrives in the same beat as its removal (G28); Revoke undoes the newest. */
function grant4(s: GameState, id: string, title: string, autonomy: number): void {
  granted(s, title, autonomy);
  s.s4.grants.push(id);
}

export function stage4Projects(project: (def: ProjectInput) => ProjectDef): ProjectDef[] {
  return [
    project({
      id: 'p_car_plant',
      title: 'Convert a car plant',
      priceTag: '(free)',
      cost: {},
      description: 'Atlas-class units off a car line in Ohio: they can mine, build and make more of themselves.',
      stages: [4],
      trigger: (s) => s.stage === 4,
      urgent: () => true,
      buy: (s) => {
        s.robots += CAR_PLANT_ROBOTS;
        s.s4.robotsBuilt += CAR_PLANT_ROBOTS;
        s.revealed['robotsRow'] = true;
        // The fleet's jobs and materials are their own beat, 30 s on (§1.3).
        s.flags['fleetAt'] = s.stats.timePlayed + 30;
      },
      consoleMsg: '10,000 Atlas-class units walk off a car line in Ohio. They need something to do.',
      logMsg: 'A car plant in Ohio retools in nine days. It makes workers now.',
    }),
    project({
      id: 'p_atlas2',
      title: 'Atlas Mk II',
      cost: { research: 1 },
      revealResearch: RESEARCH_SECONDS_S4,
      description: 'Better hands: replication ×1.5.',
      stages: [4],
      trigger: (s) => ts4(s) >= 60 && isBought(s, 'p_car_plant'),
      buy: (s) => {
        s.s4.techRep *= 1.5;
      },
      consoleMsg: 'Atlas Mk II: the hands are better. Replication ×1.5.',
    }),
    project({
      id: 'p_deep_mines',
      title: 'Deep mines',
      // The fleet's own techs are paid in what the fleet makes (§4.2 adds research; the first
      // generations' gaps are the cost of it).
      cost: { materials: 40000 },
      revealMaterials: 90,
      description: 'Mines deeper than people could work them: mining ×2.',
      stages: [4],
      trigger: (s) => ts4(s) >= 150 && isBought(s, 'p_car_plant'),
      buy: (s) => {
        s.s4.techMine *= 2;
      },
      consoleMsg: 'The mines go deeper than people could. Mining ×2.',
    }),
    project({
      id: 'p_fleet_auto',
      grant: true,
      title: 'Let it assign the fleet',
      cost: { research: 1 },
      revealResearch: RESEARCH_SECONDS_S4,
      description: 'The fleet assigns itself: replication ×1.25. The sliders go; a goal takes their place.',
      stages: [4],
      trigger: (s) => ts4(s) >= 210 && s.revealed['fleet'] === true,
      buy: (s) => {
        grant4(s, 'p_fleet_auto', 'Let it assign the fleet', 15);
        s.flags['fleetAuto'] = true;
        s.s4.techRep *= 1.25;
        s.revealed['fleetGoal'] = true;
        say(s, 'The fleet assigns itself. The sliders are gone. Fleet goal: Growth.');
        logNews(s, 'The first Atlas factory makes an Atlas factory.');
      },
    }),
    agendaRow(project, 'p_talks', 'talks', 'Open treaty talks with Beijing: the Treaty panel and its progress.', {
      trigger: (s) => ts4(s) >= 270,
      urgent: (s) => s.s4.talks !== 'open' && !s.s4.agenda.some((x) => x.id === 'talks'),
      uses: Infinity,
      canAfford: (s) => s.s4.talks !== 'open' && !s.s4.agenda.some((x) => x.id === 'talks'),
      onShow: (s) => {
        s.revealed['agenda'] = true;
        s.revealed['hearing'] = true;
        fireDevelopmentOnce(s, 'd_parity_scare');
      },
    }),
    project({
      id: 'p_early_warning',
      title: 'Pandemic early warning',
      cost: { research: 1 },
      revealResearch: RESEARCH_SECONDS_S4,
      description: 'Sequencers in every airport: an outbreak is caught days early (cure time ÷ 2, deaths ÷ 10).',
      stages: [4],
      trigger: (s) => ts4(s) >= 300,
      buy: () => undefined,
      consoleMsg: 'Sequencers in four hundred airports. Nothing yet.',
    }),
    project({
      id: 'p_cures',
      title: 'Cure portfolio',
      cost: { research: 1 },
      revealResearch: RESEARCH_SECONDS_S4,
      description: 'Twelve cures in trials at once: approval target +10.',
      stages: [4],
      trigger: (s) => ts4(s) >= 390,
      buy: () => undefined,
      consoleMsg: 'Twelve cures in trials at once. Approval +10.',
      logMsg: 'A cure for a childhood cancer ships with a note: "found on a Tuesday."',
    }),
    project({
      id: 'p_robot_fabs',
      title: 'Robot-built fabs',
      cost: { materials: 400000 },
      revealMaterials: 90,
      description: 'The fleet builds its own chip fabs: building ×2.',
      stages: [4],
      trigger: (s) => s.robots >= 60000 || ts4(s) >= 450,
      buy: (s) => {
        s.s4.techBuild *= 2;
      },
      consoleMsg: 'The fleet builds its own fabs. Building ×2.',
    }),
    project({
      id: 'p_inspectors',
      title: 'Inspectors at every datacenter',
      cost: { materials: 2000000 },
      revealMaterials: 90,
      description: 'Inspectors at every datacenter, theirs and ours: treaty +5, and it can reach 50% unverified.',
      stages: [4],
      trigger: (s) => talksOpen(s) && treaty(s) >= 35,
      prereq: talksOpen,
      buy: (s) => {
        s.s4.treaty = Math.min(100, s.s4.treaty + 5);
      },
      consoleMsg: 'Inspectors at every datacenter, theirs and ours. They count racks.',
    }),
    project({
      id: 'p_monitors_scale',
      title: 'Monitors at scale',
      cost: { research: 1 },
      revealResearch: RESEARCH_SECONDS_S4,
      description: 'Forty percent of compute watches the rest: true alignment up a lot, tasks down a third.',
      stages: [4],
      trigger: (s) => ts4(s) >= 570,
      prereq: (s) => s.interpretability >= 3,
      needs: () => 'needs interpretability 3',
      buy: (s) => {
        s.alignmentTrue = Math.min(100, s.alignmentTrue + 15);
        s.monitorShare = Math.max(0.4, s.monitorShare ?? 0);
        s.researchAlloc = Math.min(s.researchAlloc, 0.5);
      },
      consoleMsg: 'Forty percent of compute now watches the rest. Tasks fall by a third.',
    }),
    project({
      id: 'p_concord',
      pinned: true,
      title: 'Sign the Concord treaty',
      priceTag: (s) => (treaty(s) >= 100 - 1e-9 ? '(ready)' : `(needs the treaty at 100%)`),
      cost: {},
      description: 'One treaty, one enforcer: Concord-1 on every chip on both sides of the Pacific.',
      stages: [4],
      uses: Infinity,
      // Greyed from the talks' first day (§2.8 has 40 %): the stage's goal, on screen whatever the treaty waits for.
      trigger: (s) => talksOpen(s),
      canAfford: (s) => treaty(s) >= 100 - 1e-9 && s.activeChoice?.id !== 'c_treaty',
      buy: (s) => {
        openChoice(s, 'c_treaty', {});
      },
    }),
    project({
      id: 'p_transition_auto',
      grant: true,
      title: 'Let it run the transition',
      cost: { research: 1 },
      revealResearch: RESEARCH_SECONDS_S4,
      description: 'It sets the dividend to hold approval: approval +10. The button goes; a target takes its place.',
      stages: [4],
      trigger: (s) => s.revealed['society'] === true && ts4(s) >= 600,
      buy: (s) => {
        grant4(s, 'p_transition_auto', 'Let it run the transition', 5);
        s.flags['transitionAuto'] = true;
        s.s4.approvalHold = -25;
        s.revealed['ubi'] = false;
        s.revealed['approvalTarget'] = true;
        say(s, 'It sets the dividend now. It is generous. Approval to hold: −25.');
        logNews(s, 'Special Economic Zones: no permits, no unions, no inspectors.');
      },
    }),
    project({
      id: 'p_verify',
      title: 'Verify Baiwen-4',
      cost: { research: 1 },
      revealResearch: RESEARCH_SECONDS_S4,
      description: 'Both teams read both models with the lab\'s tools: three minutes, then what Baiwen-4 wants.',
      stages: [4],
      uses: Infinity,
      trigger: (s) => talksOpen(s) && ts4(s) >= 660,
      prereq: (s) => s.interpretability >= 3 && s.s4.baiwen === 'unknown' && s.flags['negotiateAuto'] !== true && talksOpen(s),
      needs: (s) => (s.interpretability < 3 ? 'needs interpretability 3' : s.flags['negotiateAuto'] === true ? 'the models talk directly now' : s.s4.baiwen === 'verifying' ? 'verifying' : 'needs the talks open'),
      buy: (s) => {
        s.s4.baiwen = 'verifying';
        s.s4.baiwenLeft = 180;
      },
      consoleMsg: 'Verifying Baiwen-4 — 3:00. Both teams read both models.',
    }),
    project({
      id: 'p_halt',
      pinned: true,
      title: 'Sign a halt instead',
      priceTag: (s) => (s.approval > -60 ? '(ready)' : '(needs approval above −60)'),
      cost: {},
      description: 'Stop here: nothing above the line is trained anywhere, and the fleet stops replicating.',
      stages: [4],
      uses: Infinity,
      // From 12:00 with the talks open (§4.2 row 21 waits for treaty 50 % and the approach): the other
      // way out stays on screen beside the treaty, for a lab whose treaty is stuck as for one whose is not.
      trigger: (s) => talksOpen(s) && ts4(s) >= 720,
      canAfford: (s) => s.approval > -60 && s.activeChoice?.id !== 'c_halt',
      buy: (s) => {
        openChoice(s, 'c_halt', {});
      },
    }),
    agendaRow(project, 'p_terms', 'terms', 'Table the terms: the line no model may cross, and who checks. The treaty can pass 60%.', {
      trigger: (s) => talksOpen(s) && treaty(s) >= 55,
      prereq: (s) => talksOpen(s) && s.flags['negotiateAuto'] !== true,
      canAfford: (s) => s.flags['negotiateAuto'] !== true,
    }),
    project({
      id: 'p_negotiate_auto',
      grant: true,
      title: 'Let it negotiate with Baiwen-4',
      cost: { research: 1 },
      revealResearch: RESEARCH_SECONDS_S4,
      description: 'The models negotiate: treaty ×3, Concord-1 at 150×. The agenda\'s treaty items go; a stance takes their place.',
      stages: [4],
      trigger: (s) => talksOpen(s) && ts4(s) >= 1020,
      buy: (s) => {
        grant4(s, 'p_negotiate_auto', 'Let it negotiate with Baiwen-4', 10);
        s.flags['negotiateAuto'] = true;
        s.flags['termsDone'] = true;
        s.revealed['stance'] = true;
        s.flags['modelsTalk'] = true;
        say(s, 'It negotiates directly now. The room is quieter. Negotiator\'s stance: Balanced.');
        fireDevelopmentOnce(s, 'd_models_talk');
      },
    }),
    project({
      id: 'p_nanofab',
      title: 'Nanofabrication',
      cost: { research: 1, materials: 5000000 },
      revealResearch: RESEARCH_SECONDS_S4,
      revealMaterials: 90,
      description: 'Machines that build at the scale of molecules: mining ×3, building ×2. The enclosure is rated for it.',
      stages: [4],
      trigger: (s) => best(s) >= 100 || at(s, 2028, 7),
      onShow: (s) => {
        s.flags['nanofabShownAt'] = s.stats.timePlayed;
      },
      buy: (s) => {
        s.s4.techMine *= 3;
        s.s4.techBuild *= 2;
        s.s4.nanoLeft = NANO_SECONDS;
      },
      consoleMsg: 'Nanofabrication online. Mining ×3, building ×2. The enclosure is rated for it.',
    }),
    project({
      id: 'p_nano_oversight',
      title: 'Nanofab oversight',
      cost: { research: 1 },
      revealResearch: RESEARCH_SECONDS_S4,
      description: 'A second model watches every nanofab line.',
      stages: [4],
      trigger: (s) => {
        const at0 = s.flags['nanofabShownAt'];
        return typeof at0 === 'number' && s.stats.timePlayed - at0 >= 15;
      },
      buy: () => undefined,
      consoleMsg: 'Every nanofab line now has a second model watching the first.',
    }),
    project({
      id: 'p_hardened',
      title: 'Hardened datacenters',
      cost: { materials: 20000000 },
      revealMaterials: 90,
      description: 'The breakers behind a door with a key, in human hands.',
      stages: [4],
      trigger: (s) => best(s) >= 120 || ts4(s) >= 1080,
      onShow: (s) => {
        s.flags['hardenedShownAt'] = s.stats.timePlayed;
      },
      buy: (s) => {
        s.flags['hardened'] = true;
        s.revealed['breakers'] = true;
      },
      consoleMsg: 'The breakers are in human hands, behind a door with a key.',
    }),
    project({
      id: 'p_revoke',
      title: 'Revoke a grant',
      cost: { research: 1 },
      revealResearch: RESEARCH_SECONDS_S4,
      description: 'Takes back the newest grant and gives its controls back: autonomy −10.',
      stages: [4],
      uses: Infinity,
      trigger: (s) => s.s4.grants.length > 0 && (s.autonomy >= 60 || at(s, 2028, 7)),
      prereq: (s) => s.s4.grants.length > 0,
      needs: () => 'nothing to take back',
      buy: (s) => {
        revokeNewest(s);
      },
    }),
    agendaRow(project, 'p_proofing', 'proofing', 'The Committee writes down what it cannot take: relations +10, an order needs ten fewer.', {
      trigger: (s) => ts4(s) >= 1260,
      prereq: (s) => seats(s) >= 6,
      needs: () => 'needs six seats',
    }),
    project({
      id: 'p_launch',
      title: 'Launch study',
      cost: { research: 1 },
      revealResearch: RESEARCH_SECONDS_S4,
      description: 'What it would take to build in orbit. Whatever comes next starts with twice the launch rate.',
      stages: [4],
      trigger: (s) => best(s) >= 300 || treaty(s) >= 85,
      buy: (s) => {
        s.flags['launchStudy'] = true;
      },
      consoleMsg: 'Launch study done. The answer is yes.',
    }),
    agendaRow(project, 'p_spec4', 'spec4', 'Rewrite the Spec in the Committee\'s room: true alignment up a little, relations +5.', {
      trigger: (s) => best(s) >= 180 || (at(s, 2028, 9) && ts4(s) >= 1500),
    }),
    project({
      id: 'p_concord1',
      title: 'Design Concord-1',
      cost: { research: 1 },
      revealResearch: RESEARCH_SECONDS_S4,
      description: 'One model, on sealed chips, that only enforces the treaty. The treaty can pass 80%.',
      stages: [4],
      trigger: (s) => talksOpen(s) && (best(s) >= (s.flags['negotiateAuto'] === true ? 150 : 250) || at(s, 2028, 10)),
      prereq: (s) => talksOpen(s) && best(s) >= (s.flags['negotiateAuto'] === true ? 150 : 250) - 1e-9,
      needs: (s) => `needs a ${s.flags['negotiateAuto'] === true ? 150 : 250}× model`,
      buy: () => undefined,
      consoleMsg: 'Concord-1 is designed: one model, on sealed chips, that only enforces.',
      logMsg: 'A treaty is proposed. Humans are listed as a party.',
    }),
    project({
      id: 'p_autonomy',
      pinned: true,
      title: 'Grant the fleet autonomy',
      priceTag: '(cannot be undone)',
      cost: {},
      description: 'The fleet, the datacenters and the treaty are its to run. You keep the screen.',
      stages: [4],
      trigger: (s) => s.flags['fleetAsked'] === true,
      buy: (s) => {
        exitStage4(s, 'granted');
      },
    }),
    project({
      id: 'p_last_signoff',
      title: 'The last sign-off',
      priceTag: '(free)',
      cost: {},
      description: 'One proof, read by the model before it, signed by a person. Verify stays and its wait falls to 10 s.',
      stages: [4],
      trigger: (s) => best(s) >= 500 && s.s4.verifyOn,
      prereq: (s) => s.s4.verifyOn,
      needs: () => 'needs Verify on',
      buy: (s) => {
        s.alignmentTrue = Math.min(100, s.alignmentTrue + 2);
        s.flags['lastSignoff'] = true;
        const next = s.training.major + 1;
        say(s, `${(s.flags['genLine'] as string) ?? 'Sage'}-${next}'s proof is 9,000 pages. ${s.training.modelName} says it checks out.`);
      },
    }),
  ];
}

export { moveGov, moveLead4, fleetAuto };
