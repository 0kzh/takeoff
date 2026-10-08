import { useGame, usePerform } from '../store/context.js';
import { Panel, Reveal, Meter } from './primitives.js';
import {
  gpuCost,
  atRentQuota,
  rentQuota,
  copies,
  copiesIdle,
  gpuCapacity,
  gpuBatchCost,
  GRID_KW_PER_GPU,
  datacenterCost,
  DATACENTER_GPUS,
  powerSecondsLeft,
  powerBlock,
  powerBlockCost,
  powerBillPerSec,
  canExpandGrid,
  activeGpus,
  nextGridCapacity,
  gridUpgradeCost,
  chipName,
  chipMult,
  batchSize,
  gpuBlock,
  gpuBlockReason,
  canBuyGpuBatch,
  securityCost,
  canUpgradeSecurity,
  theftOdds,
  SECURITY_MAX,
} from '../engine/economy.js';
import { startCapability } from '../engine/training.js';
import { effectiveData, dataRequired, syntheticRatePerMin, webShare, WEB_TOTAL } from '../engine/data.js';
import { fmtMoney, fmtMoneyShort, fmtInt, fmtMw, fmtClock, fmtNum } from '../engine/format.js';

export function Infrastructure() {
  const s = useGame();
  const perform = usePerform();
  const owned = s.revealed['infrastructure'] === true;
  const room = gpuCapacity(s);
  const batch = gpuBlock(s);
  const full = !canBuyGpuBatch(s);
  const fullReason = gpuBlockReason(s);
  const nominal = batchSize(s);
  const dataNeed = dataRequired(startCapability(s));
  const dataHave = effectiveData(s);
  const dataShort = dataHave < dataNeed;
  const left = powerSecondsLeft(s);
  const draw =
    s.stage < 2
      ? 'Each task a copy completes uses 1 kWh; clicks use none.'
      : `Each powered GPU draws ${fmtInt(GRID_KW_PER_GPU)} kWh a second.`;
  const need = s.gpus * GRID_KW_PER_GPU;
  const short = owned && need > s.gridCapacity;
  const next = nextGridCapacity(s);
  return (
    <Panel name="infrastructure" flag="compute">
      <b id="infraTitle">{owned ? 'Infrastructure' : 'Compute'}</b>
      <hr />
      <Reveal flag="infrastructure" hide id="rentRows">
        <button
          className="button2"
          id="btn-gpu"
          title="Rent a GPU. GPUs train Sage and, once it is trained, each runs a copy that completes tasks on its own, using power."
          disabled={s.funds < gpuCost(s) || atRentQuota(s)}
          onClick={() => perform('rentGpu')}
        >
          Rent GPU
        </button>{' '}
        Cost: <span id="gpuCost">{fmtMoney(gpuCost(s))}</span>{' '}
        <span id="gpuNote" className="warn">
          {atRentQuota(s) ? 'quota reached — the provider has no more to rent' : ''}
        </span>
        <br />
        <Reveal flag="fleet">
          GPUs rented
          <Reveal flag="quota" hide>
            :
          </Reveal>{' '}
          <Reveal flag="quota">
            <Meter
              id="quotaMeter"
              fraction={s.gpus / rentQuota(s)}
              label={`${fmtInt(s.gpus)} of the ${fmtInt(rentQuota(s))} the cloud rents`}
            />{' '}
          </Reveal>
          <span id="gpus">{fmtInt(s.gpus)}</span>
          <Reveal flag="quota">
            {' '}
            / <span id="gpuQuota">{fmtInt(rentQuota(s))}</span>
          </Reveal>
          <br />
        </Reveal>
        <Reveal flag="copies">
          <span id="copiesRow" className={copies(s) !== s.gpus ? 'shown' : ''}>
            Copies running: <span id="copies">{fmtInt(copies(s))}</span>{' '}
            <span id="copiesNote" className="note">
              {copiesIdle(s) ? '(idle: no power)' : ''}
            </span>
            <br />
          </span>
        </Reveal>
      </Reveal>
      <Reveal flag="infrastructure" id="ownedRows">
        GPUs{' '}
        <Meter
          id="roomMeter"
          fraction={s.gpus / room}
          label={`${fmtInt(s.gpus)} ${chipName(s)} GPUs in ${fmtInt(s.datacenters)} datacenter${s.datacenters === 1 ? '' : 's'} with room for ${fmtInt(room)} · ${fmtInt(copies(s))} copies running${chipMult(s) > 1 ? ` · each GPU does the work of ${chipMult(s)}` : ''}`}
        />{' '}
        <span id="infraGpus">{fmtInt(s.gpus)}</span> / <span id="gpuCapacity">{fmtInt(room)}</span>{' '}
        <span className="note" id="chipName">
          {chipName(s)}
          {chipMult(s) > 1 ? ` ×${chipMult(s)}` : ''}
        </span>
        <br />
        <button
          className="button2"
          id="btn-gpuBatch"
          disabled={s.funds < gpuBatchCost(s) || full}
          title={
            full
              ? fullReason || 'No room for more GPUs.'
              : `Rack ${fmtInt(batch)} more ${chipName(s)}s. Each draws ${fmtInt(GRID_KW_PER_GPU)} kW from the grid. More copies: more tasks, and more customers.`
          }
          onClick={() => perform('buyGpuBatch')}
        >
          Buy GPUs ({fmtInt(batch)})
        </button>{' '}
        Cost: <span id="gpuBatchCost">{fmtMoneyShort(gpuBatchCost(s))}</span>
        <span id="gpuFullNote" className={full && fullReason ? 'shown warn' : ''}>
          {' '}
          {fullReason}
        </span>
        <span className="note hiddenIds">
          {' '}
          of <span id="gpuBatchNominal">{fmtInt(nominal)}</span> ·{' '}
          <span id="gpuBatchDraw">{fmtMw(batch * GRID_KW_PER_GPU)}</span> MW
        </span>
        <br />
        <button
          className="button2"
          id="btn-datacenter"
          disabled={s.funds < datacenterCost(s)}
          title={`Datacenter ${fmtInt(s.datacenters + 1)}: room for ${fmtInt(DATACENTER_GPUS)} more GPUs.`}
          onClick={() => perform('buildDatacenter')}
        >
          Build Datacenter
        </button>{' '}
        Cost: <span id="datacenterCost">{fmtMoneyShort(datacenterCost(s))}</span>
        <br />
        <Reveal flag="data" id="dataRow">
          <br />
          Data{' '}
          <Meter
            id="dataMeter"
            fraction={dataHave / dataNeed}
            warn={dataShort}
            label={`${fmtNum(dataHave, 1)}T tokens of the ${fmtNum(dataNeed, 1)}T the next run needs · public web ${Math.round(100 * webShare(s))}% of ${WEB_TOTAL}T read`}
          />{' '}
          <span id="dataStock">{fmtNum(dataHave, 1)}</span>T{' '}
          <span className="note">
            (the next run needs <span id="dataNeed">{fmtNum(dataNeed, 1)}</span>T)
          </span>
          <span id="dataShortNote" className={dataShort ? 'shown warn' : ''}>
            {' '}
            short: the next run gains less
          </span>
          <br />
          <Reveal flag="synthetic">
            <span className="note">
              Idle copies write <span id="syntheticRate">{fmtNum(syntheticRatePerMin(s), 2)}</span>T a minute
            </span>
            <br />
          </Reveal>
        </Reveal>
        <Reveal flag="security" id="securityRow">
          <br />
          Security: <span id="securityLevel">SL{s.security}</span>{' '}
          <span
            className="note"
            title={`A weight theft goes unnoticed ${Math.round(100 * theftOdds(s))}% of the time at this level.`}
          >
            {s.security >= 4
              ? '(sealed)'
              : s.security === 3
                ? '(hard to rob)'
                : s.security === 2
                  ? '(harder to rob)'
                  : '(the weights are exposed)'}
          </span>
          <br />
          <button
            className="button2"
            id="btn-security"
            disabled={!canUpgradeSecurity(s) || s.funds < securityCost(s)}
            title={
              s.security >= SECURITY_MAX
                ? 'Weights never leave the enclave.'
                : `Security level ${s.security + 1}: theft less likely; research 3% slower.`
            }
            onClick={() => perform('upgradeSecurity')}
          >
            Upgrade security
          </button>{' '}
          Cost:{' '}
          <span id="securityCost">
            {s.security >= SECURITY_MAX ? 'maxed' : fmtMoneyShort(securityCost(s))}
          </span>
          <br />
        </Reveal>
      </Reveal>
      <Reveal flag="power" id="powerRows">
        <br />
        <Reveal flag="gridContract" hide>
          <span id="powerLine">
            Power{' '}
            <Meter
              id="powerMeter"
              fraction={s.power / s.gridCapacity}
              label={`${fmtInt(s.power)} kWh · a full bar is ${fmtInt(s.gridCapacity)} kWh${Number.isFinite(left) ? ` · ${fmtClock(left)} at this draw` : ''}`}
              warn={left < 20}
            />{' '}
            <span id="power">{fmtInt(s.power)}</span> kWh{' '}
            <span id="powerNote" className="warn">
              {copiesIdle(s) ? 'copies idle' : ''}
            </span>
          </span>
          <br />
          <Reveal flag="buyPower">
            <span id="buyPowerRow" className="shown">
              <button
                className="button2"
                id="btn-buyPower"
                disabled={s.funds < powerBlockCost(s)}
                title={`Buy ${fmtInt(powerBlock(s))} kWh. ${draw}`}
                onClick={() => perform('buyPower')}
              >
                Buy Power
                <span className="hiddenIds">
                  {' '}
                  (<span id="powerBlock">{fmtInt(powerBlock(s))}</span> kWh)
                </span>
              </button>{' '}
              Cost:{' '}
              <span id="powerCost">
                {owned ? fmtMoneyShort(powerBlockCost(s)) : fmtMoney(powerBlockCost(s))}
              </span>
              <br />
            </span>
          </Reveal>
        </Reveal>
        <span id="gridRows" className={canExpandGrid(s) ? 'shown' : ''}>
          <Reveal flag="gridContract" hide>
            <br />
          </Reveal>
          Grid
          <Reveal flag="infrastructure" hide>
            :
          </Reveal>{' '}
          <Reveal flag="infrastructure">
            <Meter
              id="gridMeter"
              fraction={need / s.gridCapacity}
              warn={short}
              label={
                short
                  ? `${fmtInt(activeGpus(s))} of ${fmtInt(s.gpus)} GPUs powered: the grid is full. Expand Grid powers the rest.`
                  : `Each GPU draws ${fmtInt(GRID_KW_PER_GPU)} kW · ${fmtInt(s.gpus)} GPUs draw ${fmtMw(need)} of the grid's ${fmtMw(s.gridCapacity)} MW`
              }
            />{' '}
            <span id="gridLoad">{fmtMw(Math.min(need, s.gridCapacity))}</span> /{' '}
          </Reveal>
          <span id="gridCapacity">{fmtMw(s.gridCapacity)}</span> MW
          <br />
          <span id="gridNoteRow" className={short ? 'shown' : ''}>
            <span id="gridNote" className="warn">
              {short
                ? `${fmtInt(s.gpus)} GPUs need ${fmtMw(need)} MW. ${fmtInt(s.gpus - activeGpus(s))} sit dark.`
                : ''}
            </span>
            <br />
          </span>
          <button
            className="button2"
            id="btn-expandGrid"
            disabled={s.funds < gridUpgradeCost(s)}
            title={`Raise the grid connection to ${fmtMw(next)} MW.${owned ? ` Enough for ${fmtInt(next / GRID_KW_PER_GPU)} GPUs.` : ''}${s.gridAuto ? '' : ` Power is bought ${fmtInt(next)} kWh at a time.`}`}
            onClick={() => perform('expandGrid')}
          >
            Expand Grid ({s.stage >= 2 ? '+' : ''}
            <span id="gridNext">{fmtMw(s.stage >= 2 ? next - s.gridCapacity : next)}</span> MW)
          </button>{' '}
          Cost: <span id="gridCost">{fmtMoneyShort(gridUpgradeCost(s))}</span>
          <br />
        </span>
        <Reveal flag="gridContract">
          <span id="billGap" className={canExpandGrid(s) ? 'shown' : ''}>
            <br />
          </span>
          Power bill:{' '}
          <span id="powerBill" title={`${draw} Billed at ${fmtMoneyShort(s.powerPrice)} per 1,000 kWh.`}>
            {fmtMoney(powerBillPerSec(s))}
          </span>{' '}
          per sec
          <br />
        </Reveal>
      </Reveal>
    </Panel>
  );
}
