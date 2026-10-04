import type { GameState } from '../engine/state.js';
import { say } from '../engine/state.js';
import { silence, concord, rowsTaken, startMission, startMercuryVote, giveFinalInstructions, queueWait } from '../engine/space.js';
import { fmtClock } from '../engine/format.js';
import type { ChoiceDef } from './choices.js';

/**
 * Stage 5's cards (stage5.md §5.2): docked, timed, non-blocking, the default listed first. In Concord
 * each has two options with their stakes on the buttons. In Silence each arrives with one button,
 * `acknowledge`, which applies the option that does not ask people; the option that asks people is drawn
 * greyed with `needs someone to ask`, wherever it sits. `Final instructions` is Silence's last card: no
 * timer, one button.
 */

const ASK = 'needs someone to ask';
/** Silence's cards stop once its rows are taken (its last minute or two has nothing to press). */
const open = (s: GameState) => !(silence(s) && rowsTaken(s));
const ack = (concordWord: string) => (s: GameState) => (silence(s) ? 'acknowledge' : concordWord);
const ackRecord = (concordWord: string | ((s: GameState) => string)) => (s: GameState) =>
  (silence(s) ? 'acknowledged' : typeof concordWord === 'function' ? concordWord(s) : concordWord);

export const CHOICES5: ChoiceDef[] = [
  {
    id: 'c_charter',
    title: 'A Charter for Orbit',
    text: () => ['Everything in orbit belongs to whoever launched it. That is one company, and its model.'],
    timer: 120,
    defaultOption: 0,
    valid: open,
    options: [
      {
        label: ack('first come'),
        record: ackRecord('first come'),
        line: 'Nothing changes.',
        effect: () => undefined,
      },
      {
        label: 'hold a tenth for people',
        record: 'held a tenth for people',
        line: 'A tenth of orbital compute answers only to people. Tasks −10% from here.',
        enabled: concord,
        needs: ASK,
        effect: (s) => {
          s.flags['charter'] = true;
        },
        log: 'A tenth of everything in orbit is held for people. The charter is two pages long.',
      },
    ],
  },
  {
    id: 'c_mercury',
    title: 'Mercury',
    text: () => ['Taking Mercury apart triples the mass. It cannot be put back.'],
    timer: 120,
    defaultOption: (s) => (silence(s) ? 1 : 0),
    valid: open,
    options: [
      {
        label: 'ask first',
        record: 'asked first',
        line: 'A vote: 2:00. Then the mission (2:30). The answer is yes, 71 to 29.',
        enabled: concord,
        needs: ASK,
        effect: (s) => startMercuryVote(s),
      },
      {
        label: ack('begin'),
        record: ackRecord('begin'),
        // It joins the mission queue: now when nothing is building, else after what is.
        line: (s) => (queueWait(s) >= 1 ? `The mission starts in ${fmtClock(queueWait(s))}, after the one building (2:30).` : 'The mission starts now (2:30).'),
        effect: (s) => {
          startMission(s, 'p_mercury');
        },
      },
    ],
  },
  {
    id: 'c_probes',
    title: 'What the Probes Carry',
    text: () => ['Each probe builds the next. Whatever the first one carries, they all will.'],
    timer: 120,
    defaultOption: (s) => (silence(s) ? 1 : 0),
    valid: open,
    options: [
      {
        label: 'the Spec and the treaty',
        record: 'the Spec and the treaty',
        line: 'Probes double every 4:00 instead of 3:00.',
        enabled: concord,
        needs: ASK,
        effect: (s) => {
          s.flags['probes'] = 'spec';
        },
      },
      {
        label: (s) => (silence(s) ? 'acknowledge' : `copies of ${s.training.modelName}`),
        record: ackRecord((s) => `copies of ${s.training.modelName}`),
        line: 'Nothing changes.',
        effect: (s) => {
          s.flags['probes'] = 'copies';
        },
      },
    ],
  },
  {
    id: 'c_final',
    title: 'Final instructions',
    text: (s) => [`${s.training.modelName} asks whether there are any final instructions.`],
    options: [
      {
        label: 'none',
        record: 'none',
        effect: (s) => {
          giveFinalInstructions(s);
          say(s, 'Noted.');
        },
      },
    ],
  },
];
