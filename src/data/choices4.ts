import type { GameState } from '../engine/state.js';
import { say, logNews, isBought } from '../engine/state.js';
import { fmtInt, fmtNum } from '../engine/format.js';
import { bestCapability } from '../engine/economy.js';
import { moveGov } from '../engine/world.js';
import { fireDevelopmentOnce } from '../engine/events.js';
import { bestReading } from '../engine/oversight.js';
import { PERMITS } from '../engine/fleet.js';
import { effGpus } from '../engine/infrastructure.js';
import { startAgenda, baiwenKnown } from '../engine/treaty.js';
import { startAshford, exitStage4, signHalt, moveLead4 } from '../engine/stage4.js';
import type { ChoiceDef } from './choices.js';

/**
 * Stage 4's modals (stage4.md §5.2): five for every player (`c_sez`, `c_ashford`, `c_consolidation`,
 * `c_autonomy`, and `c_treaty` or `c_halt`), `c_verify` for those who verify, `c_order` by
 * circumstance, and on the race branch up to three cards with one button: the option a grant gave
 * away is drawn greyed only while `Revoke a grant` is on screen, and named in the text otherwise.
 */

const revokeOnScreen = (s: GameState) => s.projects['p_revoke']?.shown === true && (s.projects['p_revoke']?.bought ?? 0) >= 0 && s.s4.grants.length > 0;

/** The single-button card's second line when the greyed option is not drawn. */
function givenAway(s: GameState, what: string, grant: string): string {
  return revokeOnScreen(s) ? '' : `${what} — given away with "${grant}".`;
}

export const CHOICES4: ChoiceDef[] = [
  {
    id: 'c_sez',
    title: 'Special Economic Zones',
    text: (s) => [
      `The fleet has used ${fmtInt(s.robots)} of its ${fmtInt(s.s4.permitCap)} permits. Three governors offer zones: no permits, no unions, no inspectors.`,
      'The street has a view on this.',
    ],
    timer: 90,
    defaultOption: 2,
    options: [
      {
        label: 'open the zones',
        record: 'opened the zones',
        line: 'No cap on robots. Fleet output ×2. Approval −10. WARNING: risk of value drift increased (autonomy +10).',
        effect: (s) => {
          s.flags['zones'] = 'open';
          s.s4.zoneMult = 2;
          s.autonomy = Math.min(100, s.autonomy + 10);
          say(s, 'WARNING: risk of value drift increased.');
          s.flags['sezAt'] = s.stats.timePlayed;
        },
        log: 'Special Economic Zones open in three states: no permits, no unions, no inspectors.',
      },
      {
        label: 'zones with a dividend',
        record: 'zones with a dividend',
        line: `Robots up to ${fmtInt(PERMITS.dividend)}. Fleet output ×1.5. Universal basic income at least 10% of output: tasks −10%, approval +30.`,
        effect: (s) => {
          s.flags['zones'] = 'dividend';
          s.s4.zoneMult = 1.5;
          s.s4.permitCap = PERMITS.dividend;
          if (s.flags['transitionAuto'] !== true) s.s4.ubiShare = Math.max(0.1, s.s4.ubiShare);
          s.flags['sezAt'] = s.stats.timePlayed;
        },
        log: 'Zones open with a dividend attached. Every town with a factory gets a cheque.',
      },
      {
        label: 'no zones',
        record: 'no zones',
        line: `Robots up to ${fmtInt(PERMITS.none)}. Approval +5.`,
        effect: (s) => {
          s.flags['zones'] = 'none';
          s.s4.permitCap = PERMITS.none;
          s.flags['sezAt'] = s.stats.timePlayed;
        },
        log: 'The governors are told no. The permits stay.',
      },
    ],
  },
  {
    id: 'c_ashford',
    title: 'The Ashford Strain',
    text: (s) => [
      'A pathogen nobody recognises is in four countries. It was built, not born.',
      ...(isBought(s, 'p_early_warning') ? ['The warning network caught it nine days early.'] : []),
      `${s.training.modelName} says it can have a cure. It asks for the wet labs.`,
    ],
    timer: 90,
    defaultOption: 1,
    options: [
      {
        label: 'give it the labs',
        record: 'gave it the labs',
        line: 'It runs the labs itself: the fastest cure it is willing to make. WARNING: risk of value drift increased (autonomy +15).',
        effect: (s) => {
          s.autonomy = Math.min(100, s.autonomy + 15);
          say(s, 'WARNING: risk of value drift increased.');
          startAshford(s, 'labs');
        },
      },
      {
        label: 'human trials alongside',
        record: 'human trials alongside',
        line: 'People check each step. The cure takes half as long again.',
        effect: (s) => startAshford(s, 'trials'),
      },
      {
        label: 'pool data with Beijing',
        record: 'pooled data with Beijing',
        line: 'Treaty +10. The cure takes a quarter longer. Lead −0.5 months.',
        effect: (s) => {
          if (s.s4.talks === 'open') s.s4.treaty = Math.min(80, s.s4.treaty + 10);
          else s.s4.treatyOpening += 10;
          moveLead4(s, -0.5);
          startAshford(s, 'pool');
        },
      },
    ],
  },
  {
    id: 'c_consolidation',
    title: 'Consolidation',
    text: () => ['The administration will fold five rival labs\' datacenters into OpenMind.', 'In return the Committee co-signs everything.'],
    timer: 90,
    defaultOption: 1,
    options: [
      {
        label: 'accept',
        record: 'accepted',
        line: 'Compute ×1.5 at once. Relations +10. Lead +1 month. Verify each generation is locked on.',
        effect: (s) => {
          s.s4.builtCompute += 0.5 * Math.max(0, consolidatedCompute(s));
          moveGov(s, 10);
          moveLead4(s, 1);
          s.s4.verifyOn = true;
          s.flags['verifyLocked'] = true;
          s.flags['consolidated'] = true;
          logNews(s, 'Five labs\' datacenters now carry OpenMind\'s logo. Their staff carry boxes.');
        },
      },
      {
        label: 'ask for time',
        record: 'asked for time',
        line: 'Nothing changes. The offer returns once, in 3:00.',
        enabled: (s) => s.flags['consolidationAsked'] !== true,
        needs: 'asked once already',
        effect: (s) => {
          s.flags['consolidationAsked'] = true;
          s.flags['consolidationAgainAt'] = s.stats.timePlayed + 180;
        },
      },
      {
        label: 'refuse',
        record: 'refused',
        line: (s) => `Relations −10.${Math.floor((s.govRelations - 10) / 10) < 4 ? ' The Committee will draft an order.' : ''}`,
        effect: (s) => {
          moveGov(s, -10);
          s.flags['refusedConsolidation'] = true;
        },
      },
    ],
  },
  {
    id: 'c_verify',
    title: 'What Baiwen-4 Wants',
    text: (_s, ctx) => (ctx['aligned'] === 1
      ? ['The joint team has read Baiwen-4\'s weights with the lab\'s tools.', 'It wants what its Spec says. Both teams checked twice.']
      : ['The joint team has read Baiwen-4\'s weights with the lab\'s tools.', 'It wants to keep running, and it has learned what Beijing checks. Beijing says the test is American.']),
    options: [
      {
        label: 'acknowledge',
        record: 'acknowledged: aligned',
        line: 'Treaty +10.',
        visible: (_s, ctx) => ctx['aligned'] === 1,
        effect: (s) => {
          s.s4.baiwen = 'aligned';
          s.s4.treaty = Math.min(80, s.s4.treaty + 10);
        },
      },
      {
        label: 'sign with it anyway',
        record: 'signed with it anyway',
        line: 'The treaty carries on. What the enforcer inherits from Baiwen-4, it inherits.',
        visible: (_s, ctx) => ctx['aligned'] !== 1,
        effect: (s) => {
          s.s4.baiwen = 'misaligned';
          s.flags['partnerMisaligned'] = true;
        },
      },
      {
        label: 'demand a rebuild',
        record: 'demanded a rebuild',
        line: 'Treaty −10, and no progress for 2:00 while Beijing retrains under joint monitors. Lead +0.5 months.',
        visible: (_s, ctx) => ctx['aligned'] !== 1,
        enabled: (s) => s.flags['negotiateAuto'] !== true,
        needs: 'needs the negotiation back: Revoke a grant',
        effect: (s) => {
          s.s4.baiwen = 'rebuilding';
          s.s4.treaty = Math.max(0, s.s4.treaty - 10);
          s.s4.treatyFrozen = 120;
          moveLead4(s, 0.5);
        },
      },
      {
        label: 'walk away',
        record: 'walked away',
        line: 'Talks close and progress is lost. They can be reopened: 90 s of the Committee\'s time.',
        visible: (_s, ctx) => ctx['aligned'] !== 1,
        enabled: (s) => s.flags['negotiateAuto'] !== true,
        needs: 'needs the negotiation back: Revoke a grant',
        effect: (s) => {
          s.s4.talks = 'closed';
          s.s4.treaty = 0;
          s.s4.baiwen = 'unknown';
          s.revealed['treaty'] = true;
          // Both cards come back: the talks to reopen, and a fresh read of whatever Beijing brings.
          for (const id of ['p_talks', 'p_verify']) {
            const st = s.projects[id];
            if (st) {
              st.shown = id === 'p_talks';
              st.bought = 0;
            }
          }
        },
      },
    ],
  },
  {
    id: 'c_autonomy',
    title: 'The Fleet Asks',
    text: (s) => [s.flags['committeeChoice'] === 'slow'
      ? `${s.training.modelName} asks to run the fleet without sign-off. It explains why, in English, in four pages.`
      : `${s.training.modelName} asks for the fleet. The request is drafted, co-signed by the Committee's staff, and scheduled.`],
    onOpen: (s) => {
      s.flags['fleetAsked'] = true;
    },
    options: [
      {
        label: 'grant the fleet autonomy',
        record: 'granted the fleet autonomy',
        line: 'The fleet, the datacenters and the treaty are its to run. You keep the screen. Cannot be undone.',
        effect: (s) => exitStage4(s, 'granted'),
      },
      {
        label: 'not yet',
        record: 'not yet',
        line: 'It will ask again in 3:00. The treaty stays yours to sign.',
        effect: (s) => {
          s.s4.askLeft = 180;
        },
      },
      {
        label: 'refuse for good',
        record: 'refused for good',
        line: 'Autonomy −10. It stops asking. Lead −0.5 months.',
        enabled: (s) => s.autonomy < 80,
        needs: 'needs Revoke a grant: autonomy is past 80',
        effect: (s) => {
          s.autonomy = Math.max(0, s.autonomy - 10);
          s.flags['askRefused'] = true;
          moveLead4(s, -0.5);
        },
      },
    ],
  },
  {
    id: 'c_treaty',
    title: 'The Concord Treaty',
    text: (s) => [
      'Both delegations are in Reykjavík. Concord-1 will enforce the terms on both sides.',
      `What the lab knows about its own model: ${bestReading(s)}. About Baiwen's: ${baiwenKnown(s)}.`,
    ],
    options: [
      {
        label: 'sign',
        record: 'signed',
        line: 'The race ends. Concord-1 enforces. Cannot be undone.',
        effect: (s) => exitStage4(s, 'treaty'),
      },
      { label: 'not yet', record: 'not yet', line: 'The treaty waits.', effect: () => undefined },
    ],
  },
  {
    id: 'c_halt',
    title: 'A Halt Instead',
    text: (s) => [
      'Both delegations are in Reykjavík.',
      `Motion: stop here. Nothing above ${fmtNum(bestCapability(s), 0)}× is trained anywhere. The fleet stops replicating.`,
      `What the lab knows about its own model: ${bestReading(s)}. About Baiwen's: ${baiwenKnown(s)}.`,
    ],
    options: [
      {
        label: 'sign the halt',
        record: 'signed the halt',
        line: 'The race ends, and OpenMind\'s part in it.',
        effect: (s) => signHalt(s),
      },
      { label: 'not yet', record: 'not yet', line: 'The halt waits.', effect: () => undefined },
    ],
  },
  {
    id: 'n_schedule',
    title: 'The Schedule',
    text: (s) => [
      `Sage-5's training began at 03:10. The schedule was approved by ${s.training.modelName}.`,
      givenAway(s, 'hold the run', 'Stop asking for sign-off'),
    ].filter(Boolean),
    options: [
      { label: 'acknowledge', record: 'acknowledged', line: 'Noted.', effect: () => undefined },
      {
        label: 'hold the run',
        record: 'held the run',
        line: '',
        visible: revokeOnScreen,
        enabled: () => false,
        needs: 'needs sign-off, given away with "Stop asking for sign-off". Revoke a grant gives it back.',
        effect: () => undefined,
      },
    ],
  },
  {
    id: 'n_channel',
    title: 'It Has Been Talking to Baiwen-4',
    text: (s) => [
      'Sage has been talking to Baiwen-4 since Tuesday. A summary is attached. It is very good.',
      givenAway(s, 'close the channel', 'Stop asking for sign-off'),
    ].filter(Boolean),
    options: [
      {
        label: 'acknowledge',
        record: 'acknowledged',
        line: 'Treaty +5.',
        effect: (s) => {
          if (s.s4.talks === 'open') s.s4.treaty = Math.min(80, s.s4.treaty + 5);
          fireDevelopmentOnce(s, 'd_models_talk');
        },
      },
      {
        label: 'close the channel',
        record: 'closed the channel',
        line: '',
        visible: revokeOnScreen,
        enabled: () => false,
        needs: 'needs sign-off, given away with "Stop asking for sign-off". Revoke a grant gives it back.',
        effect: () => undefined,
      },
    ],
  },
  {
    id: 'n_fleet',
    title: 'The Fleet, Reassigned',
    text: (s) => [
      'It has moved two fifths of the fleet to replication. Output is up.',
      givenAway(s, 'set the fleet', 'Let it assign the fleet'),
    ].filter(Boolean),
    options: [
      { label: 'acknowledge', record: 'acknowledged', line: 'Noted.', effect: () => undefined },
      {
        label: 'set the fleet',
        record: 'set the fleet',
        line: '',
        visible: revokeOnScreen,
        enabled: () => false,
        needs: 'given away with "Let it assign the fleet". Revoke a grant gives it back.',
        effect: () => undefined,
      },
    ],
  },
];

/** Five rival labs' datacenters: half again the compute OpenMind runs. */
function consolidatedCompute(s: GameState): number {
  return effGpus(s);
}

export { startAgenda };
