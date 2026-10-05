import { GameState, say, counter, isBought, canPay, payBuild } from './state.js';
import { fmtInt, fmtClock } from './format.js';
import {
  updateShipments, runStandingOrder, freeSlots, freePowerGpus, datacenterBuilding, datacenterCost, nuclearCost,
  queueNuclear, reactorQueueFull, needsSite2, nextDatacenter, gpuCapacity, LOT_SIZES_S3, dcBuildSeconds, orderReasonS3,
  lotCostOf, standingOrderOn,
} from './infrastructure.js';
import {
  updateTakeoffTraining, gpusShort, gpusNeeded, gpusAvailable, trainSlotFree, trainCost, nextRunName, canStartTraining,
  canRedTeam, canApprove, canSendBack, researchUnit, EXPERIMENTS_MAX,
} from './training.js';
import { updateDrift, driftWatch, reimageCooldown } from './alignment.js';
import { updateWorld3, lobbyCost, counterintelCost, paymentsLevel, PAYMENT_MAX } from './world3.js';
import { sl3Cost } from './world.js';
import { humanShare } from './economy.js';
import { visibleProjects, buyProject } from './projects.js';
import { enabledPurchases } from './events.js';
import { updateOversight } from './oversight.js';
import { updateEvents3 } from './events3.js';
import { recordPrice } from './market.js';

export function stage3Tick(s: GameState, dt: number): void {
  if (s.stage !== 3) return;
  updateShipments(s, dt);
  updateTakeoffTraining(s, dt);
  updateDrift(s, dt);
}

export function stage3Slow(s: GameState): void {
  if (s.stage !== 3) return;
  if (s.flags['humanShareGone'] !== true && s.stats.timeInStage > 30 && humanShare(s) < 0.0005) {
    s.flags['humanShareGone'] = true;
    say(s, 'Human share of research: 0.0%. The line is removed.');
  }
  runStandingOrder(s);
  runBuildout(s);
  updateWorld3(s);
  driftWatch(s);
  updateOversight(s);
  updateEvents3(s);
  stage3Walls(s);
  recordPrice(s);
}

export type BuildBudget = 'lean' | 'ahead';

export function buildBudget(s: GameState): BuildBudget {
  return s.flags['buildBudget'] === 'ahead' ? 'ahead' : 'lean';
}

export function setBuildBudget(s: GameState, v: BuildBudget): boolean {
  if (s.stage < 3 || !s.revealed['buildBudget'] || (v !== 'lean' && v !== 'ahead') || buildBudget(s) === v) return false;
  s.flags['buildBudget'] = v;
  return true;
}

export function runBuildout(s: GameState): void {
  if (s.flags['buildout'] !== true) return;
  const ahead = buildBudget(s) === 'ahead';
  const big = LOT_SIZES_S3[LOT_SIZES_S3.length - 1];
  const roomShort = freeSlots(s) < big;
  const powerShort = freePowerGpus(s) < big;
  const campus = needsSite2(s) && (ahead || roomShort) ? visibleProjects(s).find((p) => p.id === 'p_site2') : undefined;
  if (campus && s.buildFund >= (campus.cost(s).build ?? Infinity)) buyProject(s, 'p_site2');
  if (!datacenterBuilding(s) && !needsSite2(s) && (ahead || roomShort)) {
    const next = nextDatacenter(s);
    if (s.buildFund >= next.cost) {
      payBuild(s, next.cost);
      const seconds = dcBuildSeconds(s);
      s.powerQueue.push({ kind: 'datacenter', mw: 0, remaining: seconds, total: seconds, label: `Datacenter ${next.n}` });
      s.flags['buildoutLine'] = `Datacenter ${next.n} ordered`;
    }
  }
  const reactorQueued = s.powerQueue.some((o) => o.kind === 'nuclear');
  if (!reactorQueued && !reactorQueueFull(s) && (ahead || powerShort)) {
    const cost = nuclearCost(s);
    if (s.buildFund >= cost) {
      payBuild(s, cost);
      queueNuclear(s);
      s.flags['buildoutReactor'] = s.reactors + 1;
    }
  }
}

export function buildoutLine(s: GameState): string {
  const parts: string[] = [];
  const hall = datacenterBuilding(s);
  if (hall) parts.push(`${hall.label} — ${fmtClock(Math.ceil(hall.remaining))}`);
  const reactor = s.powerQueue.find((o) => o.kind === 'nuclear');
  if (reactor) parts.push(`Reactor ${s.reactors + 1} — ${fmtClock(Math.ceil(reactor.remaining))}`);
  if (parts.length === 0) return needsSite2(s) ? 'Build-out: Datacenter 10 needs New Carlisle' : 'Build-out: waiting for the next lot to need it';
  return `Build-out: ${parts.join(' · ')}`;
}

export function shipmentLine(s: GameState): string {
  const q = s.shipments ?? [];
  if (q.length === 0) return s.flags['blockade'] === true ? `The Blockade — ${fmtClock(counter(s, 'blockadeLeft'))} until the strait reopens` : '';
  const head = q[0]!;
  const behind = q.length - 1;
  return `Shipment: ${fmtInt(head.gpus)} GPUs in ${fmtClock(Math.ceil(head.remaining))}${behind === 1 ? ' · another behind it' : behind > 1 ? ` · ${behind} behind it` : ''}`;
}

function stage3Walls(s: GameState): void {
  const now = s.stats.timePlayed;
  if (trainSlotFree(s) && gpusShort(s) && s.research >= (trainCost(s).research ?? 0)) {
    if (typeof s.flags['gpuWallSince'] !== 'number') s.flags['gpuWallSince'] = now;
    else if (now - (s.flags['gpuWallSince'] as number) >= 20 && now - counter(s, 'gpuWallSaidAt') >= 180) {
      s.flags['gpuWallSaidAt'] = now;
      const fix = needsSite2(s) && freeSlots(s) < LOT_SIZES_S3[0]
        ? 'Datacenter 10 needs the New Carlisle campus, from the build fund or funds.'
        : !standingOrderOn(s)
          ? 'Buy GPUs, or switch the Standing order on.'
          : s.flags['buildout'] === true ? 'The lots and the build-out are on it.' : 'Buy GPUs; a hall or a reactor when the lots stop.';
      say(s, `${nextRunName(s)} needs ${fmtInt(gpusNeeded(s))} GPUs; ${fmtInt(gpusAvailable(s))} free. ${fix}`);
    }
  } else {
    delete s.flags['gpuWallSince'];
  }
  if (!s.revealed['infrastructure']) return;
  const small = LOT_SIZES_S3[0];
  const why = orderReasonS3(s, small);
  if (why === 'no room' && !datacenterBuilding(s)) {
    const key = `noRoom3:${s.datacenters}`;
    if (!s.flags[key]) {
      s.flags[key] = true;
      const fix = needsSite2(s) ? 'Datacenter 10 needs the New Carlisle campus, from the build fund or funds.' : s.flags['buildout'] === true ? 'The build-out orders the next hall.' : `Build Datacenter ${nextDatacenter(s).n}: ${fmtClock(dcBuildSeconds(s))}.`;
      say(s, `No room for more GPUs — all ${fmtInt(gpuCapacity(s))} slots full. ${fix}`);
    }
  } else if (why === 'no power' && !s.powerQueue.some((o) => o.kind === 'nuclear')) {
    const key = `noPower3:${s.powerCapacityMW}`;
    if (!s.flags[key]) {
      s.flags[key] = true;
      say(s, `No power for more GPUs — all ${fmtInt(s.powerCapacityMW)} MW in use. ${s.flags['buildout'] === true ? 'The build-out orders a reactor.' : 'A reactor adds 1,000 MW in 2:00.'}`);
    }
  }
}

export function hallUrgent(s: GameState): boolean {
  return s.stage === 3 && !datacenterBuilding(s) && freeSlots(s) < LOT_SIZES_S3[0] && !needsSite2(s);
}

export function reactorUrgent(s: GameState): boolean {
  return s.stage === 3 && !s.powerQueue.some((o) => o.kind === 'nuclear') && freePowerGpus(s) < LOT_SIZES_S3[0];
}

export function enabledPurchasesS3(s: GameState): string[] {
  if (s.stage !== 3) return enabledPurchases(s);
  const out: string[] = [];
  for (const p of visibleProjects(s)) if (p.canAfford(s)) out.push(p.id);
  if (canStartTraining(s) && !isBought(s, 'p_auto_train')) out.push('train');
  if (canRedTeam(s) && !isBought(s, 'p_auto_redteam')) out.push('redteam');
  if (canApprove(s)) out.push('approve');
  if (canSendBack(s)) out.push('sendBack');
  if (s.revealed['infrastructure']) {
    if (LOT_SIZES_S3.some((n) => !orderReasonS3(s, n) && s.buildFund >= lotCostOf(s, n))) out.push('gpuLot');
    if (s.flags['buildout'] !== true && s.revealed['dcButton'] && !datacenterBuilding(s) && !needsSite2(s) && s.buildFund >= datacenterCost(s)) out.push('datacenter');
    if (s.flags['buildout'] !== true && s.revealed['nuclearButton'] && !reactorQueueFull(s) && s.buildFund >= nuclearCost(s)) out.push('nuclear');
  }
  if (s.revealed['sl3Button'] && s.securityLevel < 3 && canPay(s, sl3Cost(s))) out.push('sl3');
  if (s.revealed['experiments'] && counter(s, 'expPts') < EXPERIMENTS_MAX && s.research >= researchUnit(s)) out.push('experiments');
  if (s.revealed['lobby'] && s.funds >= lobbyCost(s)) out.push('lobby');
  if (s.revealed['counterintel'] && s.funds >= counterintelCost(s)) out.push('counterintel');
  if (s.revealed['payments'] && paymentsLevel(s) < PAYMENT_MAX) out.push('payments');
  if (s.revealed['reimage'] && reimageCooldown(s) <= 0) out.push('reimage');
  return out;
}

export function hallPrice(s: GameState): number {
  return datacenterCost(s);
}

export { isBought };
