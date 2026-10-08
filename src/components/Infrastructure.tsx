import type { GameState } from '../engine/state.js';
import {
  gpuCost, datacenterCost, gpuBatchCost, gridUpgradeCost, nextGridCapacity, canExpandGrid, copies, activeGpus, gpuCapacity,
  powerBlock, powerBlockCost, copiesIdle, atRentQuota, rentQuota, powerSecondsLeft, powerBillPerSec,
  GPU_BATCH, DATACENTER_GPUS, GRID_KW_PER_GPU,
} from '../engine/economy.js';
import { trainingRun } from '../engine/training.js';
import { fmtInt, fmtMoney, fmtMoneyShort, fmtMw, fmtClock } from '../engine/format.js';
import { useGame, perform } from '../store/gameStore.js';
import { Panel, Reveal, Hide, Meter, cx, fill } from './primitives.js';

function rentedView(s: GameState) {
  const quota = atRentQuota(s);
  const run = trainingRun(s);
  return {
    gpuCost: fmtMoney(gpuCost(s)),
    gpuDisabled: s.funds < gpuCost(s) || quota,
    gpuNote: quota ? 'quota reached — the provider has no more to rent' : '',
    gpus: fmtInt(s.gpus),
    quota: fmtInt(rentQuota(s)),
    quotaFill: fill(s.gpus / rentQuota(s)),
    quotaLabel: `${fmtInt(s.gpus)} of the ${fmtInt(rentQuota(s))} the cloud rents`,
    copies: fmtInt(copies(s)),
    copiesNote: copiesIdle(s) ? '(idle: no power)' : run ? `(${fmtInt(run.gpus ?? 0)} GPUs are training)` : '',
    copiesShown: copies(s) !== s.gpus,
  };
}

function RentedRows() {
  const v = useGame(rentedView);
  return (
    <Hide flag="infrastructure" id="rentRows">
      <button className="button2" id="btn-gpu" title="Rent a GPU. GPUs train Sage and, once it is trained, each runs a copy that completes tasks on its own, using power." disabled={v.gpuDisabled} onClick={() => perform('rentGpu')}>Rent GPU</button>{' '}
      Cost: <span id="gpuCost">{v.gpuCost}</span> <span id="gpuNote" className="warn">{v.gpuNote}</span><br />
      <Reveal flag="fleet">GPUs rented<Hide flag="quota">:</Hide> <Reveal flag="quota"><Meter id="quotaMeter" percent={v.quotaFill} label={v.quotaLabel} /> </Reveal><span id="gpus">{v.gpus}</span><Reveal flag="quota"> / <span id="gpuQuota">{v.quota}</span></Reveal><br /></Reveal>{' '}
      <Reveal flag="copies"><span id="copiesRow" className={cx(v.copiesShown && 'shown')}>Copies running: <span id="copies">{v.copies}</span> <span id="copiesNote" className="note">{v.copiesNote}</span><br /></span></Reveal>
    </Hide>
  );
}

function ownedView(s: GameState) {
  const room = gpuCapacity(s);
  const full = s.gpus + GPU_BATCH > room;
  return {
    gpus: fmtInt(s.gpus),
    room: fmtInt(room),
    roomFill: fill(s.gpus / room),
    roomLabel: `${fmtInt(s.gpus)} GPUs in ${fmtInt(s.datacenters)} datacenter${s.datacenters === 1 ? '' : 's'} with room for ${fmtInt(room)} · ${fmtInt(copies(s))} copies running`,
    batchCost: fmtMoneyShort(gpuBatchCost(s)),
    batchDisabled: s.funds < gpuBatchCost(s) || full,
    batchTitle: full ? 'The datacenters are full. Build another first.' : `Rack ${fmtInt(GPU_BATCH)} more GPUs. Each draws ${fmtInt(GRID_KW_PER_GPU)} kW from the grid.`,
    datacenterCost: fmtMoneyShort(datacenterCost(s)),
    datacenterDisabled: s.funds < datacenterCost(s),
    datacenterTitle: `Datacenter ${fmtInt(s.datacenters + 1)}: room for ${fmtInt(DATACENTER_GPUS)} more GPUs.`,
  };
}

function OwnedRows() {
  const v = useGame(ownedView);
  return (
    <Reveal flag="infrastructure" id="ownedRows">
      GPUs <Meter id="roomMeter" percent={v.roomFill} label={v.roomLabel} /> <span id="infraGpus">{v.gpus}</span> / <span id="gpuCapacity">{v.room}</span><br />
      <button className="button2" id="btn-gpuBatch" title={v.batchTitle} disabled={v.batchDisabled} onClick={() => perform('buyGpuBatch')}>Buy GPUs (1,000)</button>{' '}
      Cost: <span id="gpuBatchCost">{v.batchCost}</span> <span className="note">uses <span id="gpuBatchDraw">{fmtMw(GPU_BATCH * GRID_KW_PER_GPU)}</span> MW</span><br />
      <button className="button2" id="btn-datacenter" title={v.datacenterTitle} disabled={v.datacenterDisabled} onClick={() => perform('buildDatacenter')}>Build Datacenter</button>{' '}
      Cost: <span id="datacenterCost">{v.datacenterCost}</span><br />
    </Reveal>
  );
}

function powerView(s: GameState) {
  const cap = s.gridCapacity;
  const left = powerSecondsLeft(s);
  const draw = s.stage < 2 ? 'Each task a copy completes uses 1 kWh; clicks use none.' : `Each powered GPU draws ${fmtInt(GRID_KW_PER_GPU)} kWh a second.`;
  return {
    power: fmtInt(s.power),
    fill: fill(Math.min(1, s.power / cap)),
    label: `${fmtInt(s.power)} kWh · a full bar is ${fmtInt(cap)} kWh${Number.isFinite(left) ? ` · ${fmtClock(left)} at this draw` : ''}`,
    warn: left < 20,
    note: copiesIdle(s) ? 'copies idle' : '',
    block: fmtInt(powerBlock(s)),
    cost: s.revealed['infrastructure'] ? fmtMoneyShort(powerBlockCost(s)) : fmtMoney(powerBlockCost(s)),
    buyDisabled: s.funds < powerBlockCost(s),
    buyTitle: `Buy ${fmtInt(powerBlock(s))} kWh. ${draw}`,
    bill: fmtMoney(powerBillPerSec(s)),
    billTitle: `${draw} Billed at ${fmtMoneyShort(s.powerPrice)} per 1,000 kWh.`,
  };
}

function gridView(s: GameState) {
  const owned = s.revealed['infrastructure'] === true;
  const cap = s.gridCapacity;
  const need = s.gpus * GRID_KW_PER_GPU;
  const short = owned && need > cap;
  const next = nextGridCapacity(s);
  const blocks = s.gridAuto ? '' : ` Power is bought ${fmtInt(next)} kWh at a time.`;
  const room = owned ? ` Enough for ${fmtInt(next / GRID_KW_PER_GPU)} GPUs.` : '';
  return {
    shown: canExpandGrid(s),
    capacity: fmtMw(cap),
    load: fmtMw(Math.min(need, cap)),
    fill: fill(need / cap),
    label: short
      ? `${fmtInt(activeGpus(s))} of ${fmtInt(s.gpus)} GPUs powered: the grid is full. Expand Grid powers the rest.`
      : `Each GPU draws ${fmtInt(GRID_KW_PER_GPU)} kW · ${fmtInt(s.gpus)} GPUs draw ${fmtMw(need)} of the grid's ${fmtMw(cap)} MW`,
    short,
    note: short ? `${fmtInt(s.gpus)} GPUs need ${fmtMw(need)} MW. ${fmtInt(s.gpus - activeGpus(s))} sit dark.` : '',
    next: fmtMw(next),
    cost: fmtMoneyShort(gridUpgradeCost(s)),
    expandDisabled: s.funds < gridUpgradeCost(s),
    expandTitle: `Raise the grid connection to ${fmtMw(next)} MW.${room}${blocks}`,
  };
}

function PowerRows() {
  const v = useGame(powerView);
  const g = useGame(gridView);
  return (
    <Reveal flag="power" id="powerRows">
      <br />
      <Hide flag="gridContract">
        <span id="powerLine">Power <Meter id="powerMeter" percent={v.fill} label={v.label} warn={v.warn} /> <span id="power">{v.power}</span> kWh <span id="powerNote" className="warn">{v.note}</span></span><br />
        <Reveal flag="buyPower">
          <span id="buyPowerRow" className="shown">
            <button className="button2" id="btn-buyPower" title={v.buyTitle} disabled={v.buyDisabled} onClick={() => perform('buyPower')}>Buy Power<span className="hiddenIds"> (<span id="powerBlock">{v.block}</span> kWh)</span></button>{' '}
            Cost: <span id="powerCost">{v.cost}</span><br />
          </span>
        </Reveal>
      </Hide>{' '}
      <span id="gridRows" className={cx(g.shown && 'shown')}>
        <Hide flag="gridContract"><br /></Hide>{' '}
        Grid<Hide flag="infrastructure">:</Hide> <Reveal flag="infrastructure"><Meter id="gridMeter" percent={g.fill} label={g.label} warn={g.short} /> <span id="gridLoad">{g.load}</span> / </Reveal><span id="gridCapacity">{g.capacity}</span> MW<br />
        <span id="gridNoteRow" className={cx(g.short && 'shown')}><span id="gridNote" className="warn">{g.note}</span><br /></span>{' '}
        <button className="button2" id="btn-expandGrid" title={g.expandTitle} disabled={g.expandDisabled} onClick={() => perform('expandGrid')}>Expand Grid (<span id="gridNext">{g.next}</span> MW)</button>{' '}
        Cost: <span id="gridCost">{g.cost}</span><br />
      </span>{' '}
      <Reveal flag="gridContract">
        <span id="billGap" className={cx(g.shown && 'shown')}><br /></span>{' '}
        Power bill: <span id="powerBill" title={v.billTitle}>{v.bill}</span> per sec<br />
      </Reveal>
    </Reveal>
  );
}

export function Infrastructure() {
  const owned = useGame((s) => s.revealed['infrastructure'] === true);
  return (
    <Panel name="infrastructure" flag="compute">
      <b id="infraTitle">{owned ? 'Infrastructure' : 'Compute'}</b>
      <hr />
      <RentedRows />{' '}
      <OwnedRows />{' '}
      <PowerRows />
    </Panel>
  );
}
