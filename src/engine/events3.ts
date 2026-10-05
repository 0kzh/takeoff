import { GameState, say, counter, isBought, heldForPlayer } from './state.js';
import { rand } from './rng.js';
import { fmtInt, fmtClock, monthOf } from './format.js';
import { fireCrisis, fireDevelopmentOnce, openChoice } from './events.js';
import { moveGov } from './world.js';
import { addMajorIncident } from './oversight.js';
import { breakout } from './alignment.js';
import { ts3 } from './world3.js';

const MONTH = 270;

export function scheduleStage3(s: GameState): void {
  const base = s.flags['theftIgnored'] === true ? 150 : MONTH;
  s.flags['theftTs'] = Math.round(base + rand(s, 0, 60));
}

export function updateEvents3(s: GameState): void {
  if (s.stage !== 3) return;
  const now = s.stats.timePlayed;
  const t = ts3(s);

  if (heldForPlayer(s)) return;

  const due = s.flags['majorDue'];
  if (typeof due === 'string') {
    delete s.flags['majorDue'];
    addMajorIncident(s, due);
  }
  if (s.flags['breakoutDue'] === true) {
    delete s.flags['breakoutDue'];
    breakout(s);
  }

  if (s.flags['theftDone'] !== true && t >= counter(s, 'theftTs') && counter(s, 'theftTs') > 0) {
    s.flags['theftDone'] = true;
    if (s.securityLevel >= 3) {
      fireDevelopmentOnce(s, 'd_airgap3');
    } else {
      fireCrisis(s, 'cr_weights_theft');
      say(s, 'Security level 3 is half price while the forensics team is in the building.');
      s.revealed['geopolitics'] = true;
      s.revealed['counterintel'] = true;
    }
  }

  const spyAt = monthOf(2027, 6) + 30 / MONTH;
  if (s.flags['spyDone'] !== true && s.date >= spyAt) {
    s.flags['spyDone'] = true;
    if (s.securityLevel < 4) fireCrisis(s, 'cr_spy');
    fireDevelopmentOnce(s, 'd_spy');
  }

  const strikeAt = monthOf(2027, 7) + 60 / MONTH;
  if (s.flags['strikeDone'] !== true && s.date >= strikeAt) {
    s.flags['strikeDone'] = true;
    if (s.gulfExposure > 0) fireCrisis(s, 'cr_iran');
    fireDevelopmentOnce(s, 'd_strike');
  }

  if (t >= 180) {
    if (s.approval <= -30 && now - counter(s, 'riotWarnAt') >= 180 && s.approval > -40) {
      s.flags['riotWarnAt'] = now;
      say(s, `Approval ${fmtInt(Math.round(s.approval))}. Below −40 the marches turn into riots. Payments and clinics answer it.`);
    }
    if (s.approval <= -45 && now - counter(s, 'sabotageWarnAt') >= 180 && s.approval > -55) {
      s.flags['sabotageWarnAt'] = now;
      say(s, `Approval ${fmtInt(Math.round(s.approval))}. Below −55 somebody will bring bolt cutters. Payments and clinics answer it.`);
    }
    if (s.approval <= -40 && now - counter(s, 'riots3At') >= 300) {
      s.flags['riots3At'] = now;
      fireCrisis(s, 'cr_riots');
    }
    if (s.approval <= -55 && now - counter(s, 'sabotageAt') >= 300) {
      s.flags['sabotageAt'] = now;
      fireCrisis(s, 'cr_sabotage');
    }
  }

  if (s.flags['blockade'] === true) {
    const left = Math.max(0, counter(s, 'blockadeLeft') - 1);
    s.flags['blockadeLeft'] = left;
    if (s.flags['stockpile'] === true && counter(s, 'stockpileUsed') < 4 && s.shipments.length === 0) {
      s.flags['stockpileUsed'] = counter(s, 'stockpileUsed') + 1;
      s.shipments.push({ gpus: 100000, gen: 6, remaining: 75 });
    }
    if (left <= 0) {
      s.flags['blockade'] = false;
      s.flags['chipsDear'] = true;
      say(s, 'The strait reopens. Lots resume at one and a half times the price.');
      fireDevelopmentOnce(s, 'd_reopen');
    }
  }

  const again = s.flags['neuraleseAgainAt'];
  if (typeof again === 'number' && now >= again && s.flags['neuralese'] === undefined) {
    delete s.flags['neuraleseAgainAt'];
    openChoice(s, 'c_neuralese2', {});
  }

  const bio = s.flags['bioAt'];
  if (typeof bio === 'number' && now >= bio) {
    delete s.flags['bioAt'];
    fireDevelopmentOnce(s, 'd_bio');
  }
  const allies = s.flags['alliesAt'];
  if (typeof allies === 'number' && now >= allies) {
    delete s.flags['alliesAt'];
    fireDevelopmentOnce(s, 'd_allies');
  }

  if (s.lead < 0.5 && s.flags['parityDone'] !== true && t >= 30) {
    s.flags['parityDone'] = true;
    moveGov(s, -10);
    fireDevelopmentOnce(s, 'd_parity');
    say(s, `Baiwen is level with Sage. Relations −10. Counter-intelligence and Security level 4 widen the gap.`);
  }
}

export function securityArrivalLine(s: GameState): void {
  if (s.securityLevel >= 3) return;
  say(s, 'Security level 2. The weights are worth more than the building. Theft risk: high.');
}

export function theftRiskNote(s: GameState): string {
  if (s.stage !== 3 || s.securityLevel >= 3) return '';
  if (s.flags['theftDone'] === true) return 'the weights were stolen';
  const left = counter(s, 'theftTs') - ts3(s);
  return left > 0 && left < 600 ? `Theft risk: high until SL3 · February — ${fmtClock(left)}` : 'Theft risk: high until SL3';
}

export { isBought };
