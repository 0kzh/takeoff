import { GameState, say, logNews, isBought, counter } from './state.js';
import { monthOf, fmtNum } from './format.js';
import { openChoice } from './events.js';

// The outside world: approval, government relations, displaced jobs. Approval
// is the hinge: below 30 the Administration moves against the lab.
export const APPROVAL_START = 62;
export const JOBS_PER_MIN_PER_X = 0.02;
export const JOBS_APPROVAL_PER_MIN = 1;
export const JOBS_APPROVAL_PER_MIN_COVERED = 0.3;
export const DEPLOY_APPROVAL = 1;
export const PROTEST_MONTH = monthOf(2026, 10);
export const PROTEST_APPROVAL = 45;
export const ULTIMATUM_APPROVAL = 30;
export const ULTIMATUM_SECONDS = 120;

export function clampApproval(s: GameState): void {
  s.approval = Math.min(100, Math.max(0, s.approval));
}

export function moveApproval(s: GameState, by: number): void {
  s.approval += by;
  clampApproval(s);
}

export function moveRelations(s: GameState, by: number): void {
  const eff = by > 0 ? by * Math.min(1, (100 - s.govRelations) / 80) : by;
  s.govRelations = Math.min(100, Math.max(0, s.govRelations + eff));
}

export function jobsMitigated(s: GameState): boolean {
  return isBought(s, 's2_commitments') || s.flags['jobsProgram'] === true;
}

export function updateWorld(s: GameState): void {
  if (s.stage < 2 || s.ending) return;
  if (isBought(s, 's2_work')) {
    s.jobsDisplaced += (JOBS_PER_MIN_PER_X * s.capability) / 60;
    const headline = counter(s, 'jobsHeadline');
    if (s.jobsDisplaced >= 2 * (headline + 1)) {
      s.flags['jobsHeadline'] = headline + 1;
      const lines = [
        'The Ledger: junior developer hiring falls for a third straight quarter.',
        'The Ledger: a call centre in Ohio closes. Its last call was answered by Sage.',
        'The Ledger: paralegals, copywriters and a surprising number of radiologists. The list is a column now.',
        'The Ledger: the unemployment office has deployed Sage to handle the volume.',
      ];
      logNews(s, lines[Math.min(lines.length - 1, headline)]!);
    }
    moveApproval(s, -(jobsMitigated(s) ? JOBS_APPROVAL_PER_MIN_COVERED : JOBS_APPROVAL_PER_MIN) / 60);
  }
  if (s.revealed['public'] && s.date >= PROTEST_MONTH && s.approval < PROTEST_APPROVAL && !s.flags['protestOpened'] && !s.activeChoice) {
    s.flags['protestOpened'] = true;
    openChoice(s, 'c_protest', {});
  }
  if (s.revealed['public'] && s.approval < ULTIMATUM_APPROVAL) {
    const low = counter(s, 'approvalLowFor') + 1;
    s.flags['approvalLowFor'] = low;
    if (low === 1) {
      say(s, `Approval ${fmtNum(s.approval, 0)}%. Calls grow to shut down OpenMind.`);
      logNews(s, 'The Ledger: Calls grow to shut down OpenMind. OpenMind\'s AI drafts the response.');
    }
    if (low >= ULTIMATUM_SECONDS && !s.flags['ultimatumOpened'] && !s.activeChoice) {
      s.flags['ultimatumOpened'] = true;
      openChoice(s, 'c_ultimatum', {}, { force: true });
    }
  } else if (counter(s, 'approvalLowFor') > 0) {
    s.flags['approvalLowFor'] = 0;
  }
}

export function revealWorld(s: GameState): void {
  if (s.revealed['public']) return;
  s.revealed['public'] = true;
  s.revealed['government'] = true;
  say(s, `The hearing is televised. Approval ${fmtNum(s.approval, 0)}%, and now it matters.`);
}
