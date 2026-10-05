import type { GameState } from '../engine/state.js';
import { openChoice, modalCanOpen } from '../engine/events.js';
import { swarmReached, ts5, launchDone, silence, rowsTaken } from '../engine/space.js';
import type { ContentRow } from './stage2.js';

export const MECHANIC_FLAGS_S5 = [
  'space', 'launchRow', 'matterRow', 'rowFoundry', 'rowOrbital', 'orbitalRow', 'industryShare', 'missionFund', 'split',
  'collectors', 'earthGrey', 'graphRetired', 'flowGrows', 'mercuryRow', 'peopleRow', 'rowProbe', 'rowsTaken',
];

function flagRow(id: string, flag: string, opts: Omit<ContentRow, 'id' | 'kind' | 'done' | 'reveal'> & { onReveal?: (s: GameState) => void }): ContentRow {
  return {
    id,
    kind: 'flag',
    ...opts,
    done: (s) => s.revealed[flag] === true,
    reveal: (s) => {
      s.revealed[flag] = true;
      opts.onReveal?.(s);
      return true;
    },
  };
}

function choiceRow(id: string, opts: { trigger: (s: GameState) => boolean; prereq?: (s: GameState) => boolean }): ContentRow {
  return {
    id,
    kind: 'choice',
    prereq: opts.prereq,
    trigger: opts.trigger,
    done: (s) => s.flags[`opened:${id}`] === true,
    reveal: (s) => {
      if (!modalCanOpen(s)) return false;
      s.flags[`opened:${id}`] = true;
      openChoice(s, id, {});
      return true;
    },
  };
}

const project = (id: string): ContentRow => ({ id, kind: 'project' });

const cardsOpen = (s: GameState) => !(silence(s) && rowsTaken(s));

export const STAGE5_TABLE: ContentRow[] = [
  project('p_contracts'),
  flagRow('#rowOrbital', 'rowOrbital', {
    mechanic: true,
    trigger: (s) => launchDone(s) && ts5(s) >= 35,
    prereq: launchDone,
    onReveal: (s) => {
      s.revealed['orbitalRow'] = true;
    },
  }),
  project('p_mass_driver'),
  project('p_lunar_solar'),
  project('p_asteroids'),
  project('p_autofactory'),
  project('p_swarm'),
  choiceRow('c_charter', { trigger: (s) => ts5(s) >= 420, prereq: cardsOpen }),
  project('p_ring'),
  project('p_medicine'),
  project('p_foundries'),
  choiceRow('c_mercury', {
    trigger: (s) => swarmReached(s, 0.0008) || ts5(s) >= 870,
    prereq: (s) => cardsOpen(s) && s.revealed['collectors'] === true,
  }),
  project('p_habitat'),
  project('p_probes'),
  project('p_relay'),
  project('p_jupiter'),
  project('p_reflection'),
];

export const STAGE5_ORDER: Map<string, number> = new Map(STAGE5_TABLE.map((r, i) => [r.id, i]));

export const PEOPLE_LINES = [
  'A school in Recife reopens with a teacher for every child. The teachers are people.',
  'The universal basic income is raised again. Nobody can say what it is a share of any more.',
  'Four cancers are cured in a week. The announcements are a paragraph each.',
  'A town in Ohio votes to keep its diner staffed by people. It is full every night.',
  'Peter the mechanic gets his flying car. He keeps the old one.',
  'Elections are held on time. Both candidates were advised by the same model and disagree anyway.',
  'Two hundred thousand people apply to live at Shackleton. Eleven thousand are chosen by lot.',
  'A nine-year-old in Lagos asks why the sky is dark at night. The answer takes an hour and she follows all of it.',
  'People are arguing about what the swarm is for. It is the best argument anyone has had.',
];

export const PEOPLE_LINES_MORE = [
  'The school in Recife needs a second building. People build it.',
  'The diner in Ohio has a waiting list. The owner keeps it on paper.',
  'A ferry strike in Piraeus ends after one meeting. Both sides were in the room.',
  'Peter the mechanic teaches a class on carburettors. It is full.',
  'A village in Kerala spends its share on a library. The vote takes three evenings.',
  'The census is taken by hand this year. People asked to do it.',
  'A choir in Tbilisi is rehearsing for Shackleton.',
  'Somebody\'s grandmother turns 121. She says it is the soup.',
];

export const PEOPLE_AT = [45, 105, 180, 270, 465, 615, 765, 915, 1065];
export const PEOPLE_EVERY = 150;

export const COLD_LINE = 'A cold is going around. Most people do not notice it.';

export const INFRA_LINES = {
  launch: 'A launch a second from four sites. The noise is a weather system.',
  factory: 'The Moon has a factory. It is building the second.',
  mercury: 'Mercury is 0.3% smaller.',
  shadow: 'The swarm casts no shadow yet.',
  oort: 'The first probe reports from the Oort cloud. It has company.',
};

export const CONCORD_LINES = {
  medicine: [
    'The ring\'s tenth returns its answers: malaria, most heart disease, the common cold.',
    'A hospital in Dhaka closes a ward. It has no patients.',
    'The answers are published the same afternoon. Nobody is charged for them.',
  ],
  vote: 'Mercury is put to a vote. Turnout is 81%. Yes, 71 to 29.',
  habitat: 'The first eleven thousand arrive at Shackleton. One of them brought a cat.',
};
