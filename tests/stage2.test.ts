import { describe, expect, it } from 'vitest';
import { newGame, serialize, deserialize, SAVE_VERSION, type GameState } from '../src/engine/state.js';
import { actions, step, tick } from '../src/engine/tick.js';
import { presetFor, stage2Checkpoint } from '../src/data/presets.js';
import { newBotMemory, policyStep } from '../src/sim/policy.js';
import { dataFactor, dataRequired, effectiveData } from '../src/engine/data.js';
import {
  gpusNeeded,
  trainSlotFree,
  pipelineOpen,
  startCapability,
  trainCost,
  S2_RUN_MAX,
} from '../src/engine/training.js';
import { applyDrift } from '../src/engine/alignment.js';
import { updateTheft, updateIrrelevance, enterBaiwen, IRRELEVANCE_SECONDS } from '../src/engine/rivals.js';
import { updateWorld, ULTIMATUM_SECONDS } from '../src/engine/world.js';
import {
  chipMult,
  gpuCapacity,
  batchSize,
  adoption,
  researchRate,
  humanResearchShare,
  gpuBlock,
  gpuBatchCost,
} from '../src/engine/economy.js';
import { dayLabel } from '../src/engine/format.js';
import { projectById, buyProject, visibleProjects } from '../src/engine/projects.js';
import { choiceById } from '../src/engine/events.js';

function arrival(seed = 1): GameState {
  return presetFor(2).build(seed);
}

function buy(s: GameState, id: string): void {
  const def = projectById(id)!;
  s.projects[id] = { shown: true, bought: 0 };
  s.research = Math.max(s.research, def.cost(s).research ?? 0);
  s.insight = Math.max(s.insight, def.cost(s).insight ?? 0);
  s.funds = Math.max(s.funds, def.cost(s).funds ?? 0);
  expect(buyProject(s, id)).toBe(true);
}

function runTicks(s: GameState, seconds: number): void {
  for (let i = 0; i < seconds * 10; i++) step(s);
}

describe('Stage 2 arrival', () => {
  it('retires the task button, owns the fleet, and seeds the race', () => {
    const s = arrival();
    expect(s.stage).toBe(2);
    expect(s.revealed['task']).toBe(false);
    expect(s.revealed['infrastructure']).toBe(true);
    expect(s.revealed['capabilityHeader']).toBe(true);
    expect(s.gridAuto).toBe(true);
    expect(s.gpus).toBe(1000);
    expect(s.datacenters).toBe(1);
    expect(s.approval).toBeGreaterThan(50);
    expect(s.tempo).toBe(50);
    expect(s.data.webRemaining).toBeLessThanOrEqual(20);
    expect(s.data.webRemaining).toBeGreaterThanOrEqual(0);
    expect(s.revealed['data']).toBe(true);
    expect(s.history.length).toBeGreaterThan(0);
  });

  it('migrates a version 14 Stage 1 save and rejects a version 14 Stage 2 save', () => {
    const raw = JSON.parse(serialize(newGame(5))) as Record<string, unknown>;
    raw['version'] = 14;
    delete raw['chipGen'];
    delete raw['data'];
    const migrated = deserialize(JSON.stringify(raw));
    expect(migrated).not.toBeNull();
    expect(migrated!.version).toBe(SAVE_VERSION);
    expect(migrated!.chipGen).toBe(1);
    expect(migrated!.data.webRemaining).toBe(20);
    raw['stage'] = 2;
    expect(deserialize(JSON.stringify(raw))).toBeNull();
  });
});

describe('Stage 2 economy', () => {
  it('scales compute per GPU with chip generations and room with datacenter tiers', () => {
    const s = arrival();
    expect(chipMult(s)).toBe(1);
    expect(gpuCapacity(s)).toBe(10000);
    buy(s, 's2_chip_g5');
    expect(chipMult(s)).toBe(4);
    s.datacenters = 3;
    buy(s, 's2_hyperscale');
    expect(gpuCapacity(s)).toBe(300000);
    expect(batchSize(s)).toBe(10000);
    expect(adoption(s)).toBeGreaterThan(1);
  });

  it('shrinks a run by the square root of its data coverage', () => {
    const s = arrival();
    const c = startCapability(s);
    s.tasks = 0;
    s.data.stock = dataRequired(c) / 4;
    expect(effectiveData(s)).toBeCloseTo(dataRequired(c) / 4);
    expect(dataFactor(s, c)).toBeCloseTo(0.5);
    s.data.stock = dataRequired(c) * 3;
    expect(dataFactor(s, c)).toBe(1);
  });

  it('lets Sage take over research once it writes the code', () => {
    const s = arrival();
    expect(humanResearchShare(s)).toBe(1);
    s.capability = 10;
    const humansOnly = researchRate(s);
    buy(s, 's2_ai_rd');
    expect(researchRate(s)).toBeGreaterThan(humansOnly);
    expect(humanResearchShare(s)).toBeLessThan(0.6);
  });
});

describe('Stage 1 runs price the same four resources', () => {
  it('costs money, GPUs, research and data once Research is on screen, with data starting under 1T', () => {
    const s = newGame(1);
    s.revealed['training'] = true;
    s.revealed['research'] = true;
    s.revealed['data'] = true;
    s.flags['prologue'] = false;
    s.training.internalCapability = 1.13;
    s.capability = 1.13;
    const cost = trainCost(s);
    expect(cost.funds).toBeGreaterThan(0);
    expect(cost.research).toBeGreaterThan(0);
    expect(cost.research!).toBeLessThan(1000);
    expect(gpusNeeded(s)).toBeGreaterThan(0);
    expect(dataRequired(1)).toBeGreaterThan(0.5);
    expect(dataRequired(1)).toBeLessThan(1);
    expect(dataRequired(1.8)).toBeCloseTo(10);
    expect(newGame(1).data.webRemaining).toBe(20);
  });
});

describe('Date labels', () => {
  it('ticks by day inside the month', () => {
    expect(dayLabel(0)).toBe('1 Jul 2025');
    expect(dayLabel(0.5)).toBe('16 Jul 2025');
    expect(dayLabel(0.999)).toBe('31 Jul 2025');
    expect(dayLabel(7)).toBe('1 Feb 2026');
    expect(dayLabel(7.99)).toBe('28 Feb 2026');
    expect(dayLabel(31.99)).toBe('29 Feb 2028');
  });
});

describe('Stage 2 GPU purchases', () => {
  it('delivers the block the button named even when the money only just covers it', () => {
    const s = arrival();
    s.gridCapacity = 1e9;
    s.datacenters = 100;
    s.funds = 1e12;
    const full = gpuBatchCost(s);
    s.funds = full + 1;
    const block = gpuBlock(s);
    expect(block).toBe(batchSize(s));
    const before = s.gpus;
    expect(actions.buyGpuBatch(s)).toBe(true);
    expect(s.gpus - before).toBe(block);
  });
});

describe('Stage 2 training', () => {
  it('needs more GPUs and money at higher capability and never runs longer than the cap', () => {
    const s = arrival();
    const low = gpusNeeded(s);
    s.capability = 8;
    s.training.internalCapability = 8;
    expect(gpusNeeded(s)).toBeGreaterThan(low * 20);
    expect(trainCost(s).funds).toBeGreaterThan(trainCost(arrival()).funds!);
    s.flags['runsThisStage'] = 20;
    s.gpus = gpusNeeded(s);
    s.gridCapacity = s.gpus;
    s.datacenters = 100;
    s.funds = trainCost(s).funds!;
    s.research = trainCost(s).research!;
    expect(actions.startTraining(s)).toBe(true);
    expect(s.training.run!.duration).toBeLessThanOrEqual(S2_RUN_MAX);
  });

  it('allows a queued run only after the pipeline, and promotes it when the front model ships', () => {
    const s = arrival();
    s.funds = 1e9;
    s.research = 1e6;
    expect(actions.startTraining(s)).toBe(true);
    actions.finishTraining(s);
    runTicks(s, 6);
    expect(s.training.run!.phase).toBe('redteam');
    expect(trainSlotFree(s)).toBe(false);
    buy(s, 's2_pipeline');
    expect(pipelineOpen(s)).toBe(true);
    s.gpus = 50000;
    s.datacenters = 10;
    s.gridCapacity = 100000;
    expect(trainSlotFree(s)).toBe(true);
    expect(actions.startTraining(s)).toBe(true);
    expect(s.training.next).not.toBeNull();
    expect(s.training.next!.capBefore).toBeGreaterThanOrEqual(s.training.run!.capAfter);
    actions.finishTraining(s);
    runTicks(s, 1);
    expect(s.training.next!.phase).toBe('waiting');
    s.training.run!.issues = 0;
    s.flags['sage2Decided'] = true;
    expect(actions.release(s)).toBe(true);
    runTicks(s, 6);
    expect(s.training.next).toBeNull();
    expect(s.training.run).not.toBeNull();
    expect(['evaluating', 'redteam']).toContain(s.training.run!.phase);
  });

  it('asks deploy or keep internal after Release Policy and applies tempo and distillation on deploy', () => {
    const s = arrival();
    s.funds = 1e9;
    buy(s, 's2_release_policy');
    actions.startTraining(s);
    actions.finishTraining(s);
    runTicks(s, 6);
    s.training.run!.issues = 0;
    const rival = s.rivalCapability;
    const tempo = s.tempo;
    expect(actions.release(s)).toBe(true);
    expect(s.activeChoice?.id).toBe('c_release');
    expect(actions.resolveChoice(s, 0)).toBe(true);
    runTicks(s, 6);
    expect(s.rivalCapability).toBeGreaterThan(rival);
    expect(s.tempo).toBeCloseTo(tempo + 3, 0);
    expect(s.stats.publicReleases).toBeGreaterThan(5);
  });
});

describe('Stage 2 world', () => {
  it('drifts true alignment down on capability gains and more at high tempo', () => {
    const calm = arrival(2);
    calm.tempo = 0;
    const hot = arrival(2);
    hot.tempo = 100;
    applyDrift(calm, 2, 4, 'capability');
    applyDrift(hot, 2, 4, 'capability');
    expect(calm.alignmentTrue).toBeLessThan(arrival(2).alignmentTrue);
    expect(hot.alignmentTrue).toBeLessThan(calm.alignmentTrue);
  });

  it('rolls theft against the security level and always detects it with egress monitoring', () => {
    const silent = arrival(3);
    enterBaiwen(silent);
    silent.flags['baiwenAt'] = -1000;
    silent.capability = 6;
    silent.security = 1;
    let detected = 0;
    for (let seed = 0; seed < 40; seed++) {
      const s = arrival(seed);
      enterBaiwen(s);
      s.flags['baiwenAt'] = -1000;
      s.capability = 6;
      s.security = 1;
      updateTheft(s);
      if (s.activeChoice?.id === 'c_theft') detected++;
      else expect(s.baiwen.capability).toBeGreaterThanOrEqual(0.85 * 6);
    }
    expect(detected).toBeLessThan(20);
    const watched = arrival(4);
    enterBaiwen(watched);
    watched.flags['baiwenAt'] = -1000;
    watched.capability = 6;
    watched.projects['s2_egress'] = { shown: true, bought: 1 };
    updateTheft(watched);
    expect(watched.activeChoice?.id).toBe('c_theft');
  });

  it('ends in Second Place after three minutes of irrelevance unless rescued', () => {
    const s = arrival();
    s.rivalCapability = s.capability * 5;
    for (let i = 0; i < IRRELEVANCE_SECONDS + 1; i++) updateIrrelevance(s);
    expect(s.activeChoice?.id).toBe('c_irrelevance');
    const def = choiceById('c_irrelevance')!;
    expect(def.options[1]!.record).toBe('acquired');
    actions.resolveChoice(s, 1);
    step(s);
    expect(s.ending).toBe('secondPlace');
  });

  it('issues the ultimatum when approval collapses, and shuts the lab down if the vote passes', () => {
    const s = arrival();
    s.revealed['public'] = true;
    s.approval = 10;
    for (let i = 0; i < ULTIMATUM_SECONDS + 1; i++) updateWorld(s);
    expect(s.activeChoice?.id).toBe('c_ultimatum');
    actions.resolveChoice(s, 1);
    expect(s.activeChoice?.id).toBe('c_emergency_vote');
    actions.resolveChoice(s, 3);
    step(s);
    expect(s.ending).toBe('shutdown');
  });
});

describe('Stage 2 gate and persistence', () => {
  it('shows Automate the Lab at 5x but only sells it at 10x, and it starts Stage 3', () => {
    const s = arrival();
    s.capability = 5;
    s.training.internalCapability = 5;
    runTicks(s, 2);
    const def = projectById('s2_automate')!;
    expect(def.trigger(s)).toBe(true);
    s.research = 1e6;
    s.labSpace = 1000;
    s.insight = 1e4;
    s.funds = 1e12;
    expect(def.canAfford(s)).toBe(false);
    s.capability = 10;
    s.training.internalCapability = 10;
    expect(def.canAfford(s)).toBe(true);
    s.projects['s2_automate'] = { shown: true, bought: 0 };
    expect(buyProject(s, 's2_automate')).toBe(true);
    expect(s.stage).toBe(3);
  });

  it('resumes a saved game identically after ten minutes of bot play', () => {
    const a = arrival(9);
    const mem = newBotMemory('bot');
    for (let i = 0; i < 3000; i++) {
      policyStep(a, actions, mem);
      step(a);
    }
    const b = deserialize(serialize(a))!;
    tick(a, 30000);
    tick(b, 30000);
    expect(serialize(b)).toBe(serialize(a));
  });

  it('builds bot-driven checkpoints deterministically', () => {
    const x = stage2Checkpoint('datawall', 1);
    const y = stage2Checkpoint('datawall', 1);
    expect(serialize(x)).toBe(serialize(y));
    expect(x.stage).toBe(2);
    expect(x.flags['webExhausted'] === true || x.capability >= 3).toBe(true);
    expect(visibleProjects(x).length).toBeGreaterThan(0);
  });
});
