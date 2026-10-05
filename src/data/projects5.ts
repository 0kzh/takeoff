import type { GameState } from '../engine/state.js';
import { say, logNews, narrate } from '../engine/state.js';
import { fmtClock, fmtTonnes } from '../engine/format.js';
import {
  startMission, launchDone, launchRate, swarmReached, ts5, orbitalEffective, concord, multiplyFlow, setLaunchFlow, openSplit,
  revealCollectors, queueNews, swarmPctLabel, firstProbe, settleHabitat,
} from '../engine/space.js';
import { INFRA_LINES, CONCORD_LINES } from './stage5.js';
import type { ProjectDef, ProjectInput } from './projects.js';

interface MissionInput {
  id: string;
  title: string;
  seconds: number;
  description: string;
  trigger: (s: GameState) => boolean;
  complete: (s: GameState) => void;
  priced?: boolean;
  beside?: boolean;
  urgent?: (s: GameState) => boolean;
  prereq?: (s: GameState) => boolean;
  needs?: (s: GameState) => string;
}

export function stage5Projects(project: (def: ProjectInput) => ProjectDef): ProjectDef[] {
  const PRICE_SECONDS = 20;
  const mission = (m: MissionInput): ProjectDef => {
    const priced = m.priced !== false;
    const tag = (s: GameState): string => {
      if (m.prereq && !m.prereq(s)) return '';
      const fund = def.cost(s).fund ?? 0;
      if (fund > 0) return `(${fmtTonnes(fund)} · ${fmtClock(m.seconds)})`;
      return m.id === 'p_contracts' ? `(free · ${fmtClock(m.seconds)})` : `(${fmtClock(m.seconds)})`;
    };
    const def: ProjectDef = project({
      id: m.id,
      title: m.title,
      priceTag: tag,
      cost: priced ? { fund: 1 } : {},
      ...(priced ? { revealMatter: PRICE_SECONDS } : {}),
      description: m.description,
      stages: [5],
      trigger: (s) => s.stage === 5 && m.trigger(s),
      ...(m.urgent ? { urgent: m.urgent } : {}),
      ...(m.prereq ? { prereq: m.prereq } : {}),
      ...(m.needs ? { needs: m.needs } : {}),
      buy: (s) => startMission(s, m.id),
      mission: { seconds: m.seconds, beside: m.beside, complete: m.complete },
    });
    return def;
  };
  return [
    mission({
      id: 'p_contracts',
      title: 'Launch contracts',
      seconds: 5,
      priced: false,
      description: 'Every launch provider on Earth, booked for a decade: mass to orbit, every second.',
      trigger: () => true,
      urgent: (s) => !launchDone(s),
      complete: (s) => {
        setLaunchFlow(s);
        say(s, `A launch every second. ${launchRate(s)} tonnes to orbit, each.`);
      },
    }),
    mission({
      id: 'p_mass_driver',
      title: 'Mass driver at Shackleton',
      seconds: 90,
      description: 'A rail on the Moon that throws cargo into orbit: launch mass ×2.',
      trigger: (s) => launchDone(s) && ts5(s) >= 60,
      complete: (s) => {
        multiplyFlow(s, 2, 'mass driver');
        say(s, 'The mass driver at Shackleton fires for the first time. Launch mass ×2.');
        logNews(s, INFRA_LINES.launch);
      },
    }),
    mission({
      id: 'p_lunar_solar',
      title: 'Lunar solar array',
      seconds: 90,
      description: 'Forty square kilometres of panels at the lunar south pole: a tonne on Foundries returns ×1.5.',
      trigger: (s) => launchDone(s) && ts5(s) >= 135,
      complete: (s) => {
        s.s5.techIndustry *= 1.5;
        say(s, 'Forty square kilometres of lunar solar. Industry ×1.5.');
      },
    }),
    mission({
      id: 'p_asteroids',
      title: 'Asteroid mining',
      seconds: 120,
      description: 'Mine in orbit what no longer has to be lifted: a tonne on Foundries returns ×1.5 again.',
      trigger: (s) => launchDone(s) && (s.s5.massFlow >= 4 * launchRate(s) || ts5(s) >= 210),
      complete: (s) => {
        s.s5.techIndustry *= 1.5;
        s.flags['mined'] = true;
        say(s, 'The first asteroid is mined in place. Matter no longer has to be lifted.');
      },
    }),
    mission({
      id: 'p_autofactory',
      title: 'Autofactory',
      seconds: 60,
      beside: true,
      description: 'It buys by itself from a share of what reaches orbit: a slider for each row. The rest stays yours, by hand.',
      trigger: (s) => launchDone(s) && (s.s5.handPurchases >= 30 || ts5(s) >= 240),
      complete: (s) => {
        openSplit(s);
        logNews(s, INFRA_LINES.factory);
      },
    }),
    mission({
      id: 'p_swarm',
      title: 'Dyson swarm',
      seconds: 120,
      description: 'Collectors around the Sun. What they gather powers the orbital datacenters.',
      trigger: (s) => launchDone(s) && (orbitalEffective(s) >= 2e9 || ts5(s) >= 330),
      urgent: () => true,
      complete: (s) => revealCollectors(s),
    }),
    mission({
      id: 'p_ring',
      title: 'Datacenter ring',
      seconds: 120,
      description: 'A ring of datacenters around the Earth: orbital compute ×2, now and from here on.',
      trigger: (s) => launchDone(s) && (orbitalEffective(s) >= 5e9 || ts5(s) >= 510),
      complete: (s) => {
        s.s5.orbitalMult = 2;
        say(s, 'The datacenter ring closes. Orbital compute ×2.');
      },
    }),
    mission({
      id: 'p_medicine',
      title: 'A tenth of the ring for medicine',
      seconds: 90,
      description: 'For two minutes a tenth of the ring works on medicine. Tasks −10% while it does.',
      trigger: (s) => launchDone(s) && ts5(s) >= 600,
      complete: (s) => {
        s.effects.push({ id: 'medicine', remaining: 120, demandMult: 1 });
        s.flags['medicineAt'] = s.date;
        say(s, 'A tenth of the ring works on medicine for two minutes. It is enough.');
        if (concord(s)) CONCORD_LINES.medicine.forEach((text, i) => queueNews(s, 1 + 40 * i, text));
      },
    }),
    mission({
      id: 'p_foundries',
      title: 'Self-replicating foundries',
      seconds: 120,
      description: 'Foundries that build foundries: launch mass grows 0.3% a second by itself.',
      trigger: (s) => launchDone(s) && (swarmReached(s, 0.0002) || ts5(s) >= 720),
      complete: (s) => {
        s.s5.flowGrowth = 0.003;
        s.revealed['flowGrows'] = true;
        say(s, 'Foundries that build foundries. The flow grows by itself now: +0.3% a second.');
      },
    }),
    mission({
      id: 'p_mercury',
      title: 'Disassemble Mercury',
      seconds: 150,
      description: 'Mercury, taken apart for its mass: launch mass ×3.',
      trigger: () => false,
      complete: (s) => {
        multiplyFlow(s, 3, 'Mercury');
        s.revealed['mercuryRow'] = true;
        say(s, 'Mercury is being taken apart. Launch mass ×3.');
      },
    }),
    mission({
      id: 'p_habitat',
      title: 'Shackleton habitat',
      seconds: 90,
      description: 'Pressurised room under the lunar regolith for eleven thousand people.',
      trigger: (s) => launchDone(s) && ts5(s) >= 990,
      complete: (s) => {
        settleHabitat(s);
        say(s, 'The habitat at Shackleton is pressurised.');
        if (concord(s)) queueNews(s, 20, CONCORD_LINES.habitat);
      },
    }),
    mission({
      id: 'p_probes',
      title: 'Von Neumann probes',
      seconds: 120,
      description: 'Probes that build probes from what they find on the way out.',
      trigger: (s) => launchDone(s) && (swarmReached(s, 0.0025) || ts5(s) >= 1080),
      complete: (s) => {
        firstProbe(s);
        say(s, 'The first probe leaves. It will build the second.');
        queueNews(s, 180, INFRA_LINES.oort);
      },
    }),
    mission({
      id: 'p_relay',
      title: 'Alpha Centauri relay',
      seconds: 120,
      priced: false,
      description: 'A relay to the nearest star: probes build one another every 2:00.',
      trigger: (s) => launchDone(s) && (swarmReached(s, 0.004) || ts5(s) >= 1170),
      prereq: (s) => swarmReached(s, 0.1),
      needs: () => 'needs swarm 0.1%',
      complete: (s) => {
        s.flags['relay'] = true;
        say(s, 'The relay to Alpha Centauri is live. Probes build one another every 2:00.');
      },
    }),
    mission({
      id: 'p_jupiter',
      title: 'Jupiter brain',
      seconds: 150,
      priced: false,
      description: 'Jupiter, taken apart and rebuilt as one computer: tasks ×3.',
      trigger: (s) => launchDone(s) && (swarmReached(s, 0.004) || ts5(s) >= 1170),
      prereq: (s) => swarmReached(s, 0.3),
      needs: () => 'needs swarm 0.3%',
      complete: (s) => {
        s.flags['jupiter'] = true;
        say(s, 'Jupiter is a computer now. Tasks ×3.');
      },
    }),
    mission({
      id: 'p_reflection',
      title: 'The long reflection',
      seconds: 90,
      description: 'Stop adding to the swarm for a while and decide, together, what it is for.',
      trigger: (s) => concord(s) && swarmReached(s, 0.01),
      complete: (s) => {
        s.flags['longReflection'] = true;
        s.flags['longReflectionAt'] = s.stats.timePlayed;
        narrate(s, [
          [0.1, `The swarm holds at ${swarmPctLabel(s)}.`],
          [2, 'Eight billion people are asked the same question.'],
          [2, 'There is time.'],
        ]);
      },
    }),
  ];
}
