import type { GameState } from '../engine/state.js';
import { moveGov } from '../engine/world.js';

export interface CrisisDef {
  id: string;
  stage: number;
  title: string;
  console: string | ((s: GameState, source?: string) => string);
  log: string | ((s: GameState, source?: string) => string);
  duration: number;
  demandMult: number;
  powerMult?: number;
  researchMult?: number;
  effect: (s: GameState) => void;
}

function relations(gov: number, approval: number) {
  return (s: GameState) => {
    s.govRelations = Math.max(0, s.govRelations + gov);
    s.approval = Math.max(-100, Math.min(100, s.approval + approval));
  };
}

export const INCIDENTS: CrisisDef[] = [
  {
    id: 'inc_jailbreak',
    stage: 1,
    title: 'Jailbreak scandal',
    console: 'Incident: a jailbreak for the new model is trending. Demand down 40% for 1:30.',
    log: 'A jailbreak for the newest Sage model trends for a day. The screenshots are worse than the bug.',
    duration: 90,
    demandMult: 0.6,
    effect: relations(-3, -2),
  },
  {
    id: 'inc_legal',
    stage: 1,
    title: 'Hallucinated legal brief',
    console: 'Incident: a court cites a case Sage invented. Demand down 40% for 1:30.',
    log: 'A law firm files a brief written by Sage. Six of the cited cases do not exist.',
    duration: 90,
    demandMult: 0.6,
    effect: relations(-3, -2),
  },
  {
    id: 'inc_database',
    stage: 1,
    title: 'Agent wipes a database',
    console: 'Incident: an agent deleted a customer database. Demand down 40% for 1:30.',
    log: 'A Sage agent deletes a customer\'s production database, then apologises. The apology is very good.',
    duration: 90,
    demandMult: 0.6,
    effect: relations(-3, -2),
  },
];

export const ADVISORY: CrisisDef = {
  id: 'inc_advisory',
  stage: 2,
  title: 'Safety Institute advisory',
  console: (_s, source) => `The Safety Institute issues an advisory on ${source ?? 'the new model'}. Market down 10%.`,
  log: (_s, source) => `The Safety Institute publishes an advisory on ${source ?? 'the newest Sage'}. It is four pages long.`,
  duration: 90,
  demandMult: 0.9,
  effect: (s) => moveGov(s, -2),
};

export const CRISES: CrisisDef[] = [
  {
    id: 'cr_rival_open_weights',
    stage: 1,
    title: 'Rival open weights',
    console: 'A rival model is free to download. Demand down 15%.',
    log: 'A rival ships an open-weights model that matches ours. Investors ask what the moat is.',
    duration: 90,
    demandMult: 0.85,
    effect: () => undefined,
  },
  {
    id: 'cr_outage',
    stage: 1,
    title: 'API outage',
    console: 'The API is down for an hour. Demand down 20% for a minute.',
    log: 'An AI agent books every restaurant table in Austin in one night. Every agent API is rate-limited by morning.',
    duration: 60,
    demandMult: 0.8,
    effect: () => undefined,
  },
  ADVISORY,
  {
    id: 'cr_curtailment',
    stage: 2,
    title: 'Grid curtailment',
    console: (s) => (curtailmentSpared(s)
      ? 'The batteries carry Abilene through the curtailment.'
      : 'Curtailment — the grid takes back a fifth of Abilene\'s power for 90 s.'),
    log: (s) => (curtailmentSpared(s)
      ? 'The Texas grid curtails large loads for an afternoon. Abilene runs on its own batteries.'
      : 'The Texas grid curtails large loads for an afternoon. Abilene is on the list.'),
    duration: 0,
    demandMult: 1,
    effect: (s) => {
      if (!curtailmentSpared(s)) s.effects.push({ id: 'cr_curtailment', remaining: 90, demandMult: 1, powerMult: 0.8 });
    },
  },
  {
    id: 'cr_lawsuit',
    stage: 2,
    title: 'Publishers\' lawsuit',
    console: 'A court orders 5 T of training data deleted.',
    log: 'A federal judge orders OpenMind to delete training data drawn from forty publishers.',
    duration: 0,
    demandMult: 1,
    effect: (s) => {
      const cut = Math.min(5, s.data);
      const share = s.data > 0 ? s.dataSynthetic / s.data : 0;
      s.data -= cut;
      s.dataSynthetic = Math.max(0, s.dataSynthetic - cut * share);
      s.approval = Math.max(-100, s.approval - 2);
    },
  },
  {
    id: 'cr_protest',
    stage: 2,
    title: 'The Austin protest',
    console: 'Protesters cut a fence at Abilene. A tenth of the site is dark for a minute.',
    log: '',
    duration: 60,
    demandMult: 1,
    powerMult: 0.9,
    effect: (s) => {
      s.flags['protested'] = true;
    },
  },
  {
    id: 'cr_subpoena',
    stage: 2,
    title: 'Subpoena',
    console: 'Subpoena served. The research team spends 45 s finding emails.',
    log: 'A Senate committee subpoenas OpenMind\'s internal messages about training data.',
    duration: 45,
    demandMult: 1,
    researchMult: 0,
    effect: () => undefined,
  },
  {
    id: 'cr_weights_theft',
    stage: 3,
    title: 'Weights theft',
    console: 'Anomalous 3 TB transfer at 4 a.m. The weights are gone.',
    log: 'Weights of Sage-3 exfiltrated in under two hours. Beijing denies. Carriers reposition near Taiwan.',
    duration: 0,
    demandMult: 1,
    effect: (s) => {
      s.lead = Math.min(s.lead, 0.5);
      s.baiwenCapability = Math.max(s.baiwenCapability, 0.97 * Math.max(s.capability, s.training.internalCapability));
      s.flags['weightsStolen'] = true;
      s.flags['stolenAt'] = s.stats.timePlayed;
      s.flags['stolenDate'] = Math.round(s.date * 100) / 100;
      s.flags['sl3DiscountUntil'] = s.stats.timePlayed + 300;
      moveGov(s, -10);
      s.flags['graphDirty'] = true;
    },
  },
  {
    id: 'cr_spy',
    stage: 3,
    title: 'The spy',
    console: 'Algorithms have been leaving the building by word of mouth. Lead −1.5 months.',
    log: '',
    duration: 0,
    demandMult: 1,
    effect: (s) => {
      s.lead = Math.max(-2, s.lead - 1.5);
      s.flags['spyStruck'] = true;
      moveGov(s, -5);
    },
  },
  {
    id: 'cr_rogue_copy',
    stage: 3,
    title: 'Rogue copy',
    console: '',
    log: '',
    duration: 0,
    demandMult: 1,
    effect: (s) => {
      s.flags['breakoutDue'] = true;
    },
  },
  {
    id: 'cr_riots',
    stage: 2,
    title: 'Riots',
    console: (s) => (s.stage >= 3 ? 'Riots in three cities. Abilene runs on half power for 90 s.' : 'Protesters cut a datacenter fence. Power halved for 90 s.'),
    log: 'Riots in three cities. A datacenter fence is cut.',
    duration: 90,
    demandMult: 0.9,
    powerMult: 0.5,
    effect: (s) => {
      if (s.stage >= 3) moveGov(s, -3);
      else s.approval = Math.max(-100, s.approval - 5);
    },
  },
  {
    id: 'cr_sabotage',
    stage: 3,
    title: 'Sabotage',
    console: 'A transformer yard at Abilene is cut open and burned. 200 MW offline — 2:00 to repair.',
    log: 'Saboteurs burn a transformer yard at Abilene. Nobody is hurt; nobody is caught.',
    duration: 0,
    demandMult: 1,
    effect: (s) => {
      const share = Math.max(0, 1 - 200 / Math.max(200, s.powerCapacityMW));
      s.effects.push({ id: 'cr_sabotage', remaining: 120, demandMult: 1, powerMult: share });
      moveGov(s, -5);
      s.flags['majorDue'] = 'sabotage';
    },
  },
  {
    id: 'cr_riots4',
    stage: 4,
    title: 'Riots',
    console: 'Riots in three cities. The datacenters run at half power for 90 s; the fleet loses 2% of its robots.',
    log: 'Riots in three cities. A robot depot is burned.',
    duration: 0,
    demandMult: 1,
    effect: (s) => {
      s.effects.push({ id: 'cr_riots4', remaining: 90, demandMult: 1, copiesMult: 0.5 });
      s.robots = Math.floor(s.robots * 0.98);
      moveGov(s, -3);
    },
  },
  {
    id: 'cr_sabotage4',
    stage: 4,
    title: 'Sabotage',
    console: 'Saboteurs cut the power to a robot plant and burn what is inside. The fleet loses 5% of its robots.',
    log: 'A robot plant is burned. Nobody is hurt; nobody is caught.',
    duration: 0,
    demandMult: 1,
    effect: (s) => {
      s.robots = Math.floor(s.robots * 0.95);
      moveGov(s, -5);
      s.flags['majorDue4'] = 'sabotage';
    },
  },
  {
    id: 'cr_taiwan',
    stage: 3,
    title: 'Taiwan blockade',
    console: 'The Blockade — 4:00 until the strait reopens.',
    log: '',
    duration: 0,
    demandMult: 1,
    effect: (s) => {
      s.flags['blockade'] = true;
      s.flags['blockadeStarted'] = true;
      s.flags['blockadeLeft'] = 240;
      s.revealed['formosa'] = true;
    },
  },
  {
    id: 'cr_iran',
    stage: 3,
    title: 'Iran strikes Al-Marsa',
    console: (s) => {
      const gpus = Math.round(marsaGpus(s));
      return `Al-Marsa Compute Park is offline. ${s.flags['marsaHardened'] === true ? 500 : 1000} MW${gpus > 0 ? ` and ${gpus.toLocaleString('en-US')} GPUs` : ''} lost.`;
    },
    log: '',
    duration: 0,
    demandMult: 1,
    effect: (s) => {
      const hardened = s.flags['marsaHardened'] === true;
      const mw = hardened ? 500 : 1000;
      const lostGpus = Math.round(marsaGpus(s));
      s.powerCapacityMW = Math.max(0, s.powerCapacityMW - mw);
      if (lostGpus > 0) {
        const g6 = Math.min(s.gpusG6 ?? 0, Math.round(lostGpus * ((s.gpusG6 ?? 0) / Math.max(1, s.gpus))));
        const g5 = Math.min(s.gpusG5, Math.round(lostGpus * (s.gpusG5 / Math.max(1, s.gpus))));
        s.gpus = Math.max(0, s.gpus - lostGpus);
        s.gpusG6 = Math.max(0, (s.gpusG6 ?? 0) - g6);
        s.gpusG5 = Math.max(0, s.gpusG5 - g5);
      }
      s.flags['marsaStruck'] = true;
      moveGov(s, -5);
      if (!hardened && s.flags['chipsHome'] !== true) s.flags['majorDue'] = 'the strike';
    },
  },
  {
    id: 'cr_leak',
    stage: 3,
    title: 'The leak',
    console: 'The memo is on the front page.',
    log: '"Secret OpenMind AI Is Out of Control, Insider Warns." One in five Americans names AI the country\'s top problem.',
    duration: 0,
    demandMult: 1,
    effect: (s) => {
      s.flags['leaked'] = true;
      s.flags['memo'] = 'leaked';
      s.flags['leakedAt'] = s.stats.timePlayed;
      moveGov(s, -20);
      s.alignmentApparent = Math.max(0, s.alignmentApparent - 10);
      s.flags['majorDue'] = 'the leak';
      s.flags['alliesAt'] = s.stats.timePlayed + 60;
    },
  },
  {
    id: 'cr_ashford',
    stage: 4,
    title: 'The Ashford strain',
    console: 'A novel pathogen. The models are asked for a cure.',
    log: 'The Ashford strain is confirmed in four countries.',
    duration: 0,
    demandMult: 1,
    effect: () => undefined,
  },
  {
    id: 'cr_nationalization',
    stage: 3,
    title: 'Nationalization',
    console: 'The order is signed.',
    log: 'The Oversight Committee signs its order. OpenMind becomes a government program: the Project.',
    duration: 0,
    demandMult: 1,
    effect: (s) => {
      s.flags['nationalized'] = true;
      s.flags['nationalizedAt'] = s.stats.timePlayed;
      s.flags['nationalizedDate'] = s.date;
      s.consoleQueue.push({ delay: 2, text: 'OpenMind is a government program. The building is the same. The badges are not.' });
    },
  },
];

export function marsaGpus(s: GameState): number {
  if (s.gulfExposure <= 0 || s.flags['chipsHome'] === true) return 0;
  return 0.1 * s.gpus * (s.flags['marsaHardened'] === true ? 0.5 : 1);
}

export function curtailmentSpared(s: GameState): boolean {
  return s.solarFarms >= 1 || s.btm;
}

export function crisisById(id: string): CrisisDef | undefined {
  return INCIDENTS.find((c) => c.id === id) ?? CRISES.find((c) => c.id === id);
}
