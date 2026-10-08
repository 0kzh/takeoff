import { useGame, usePerform } from '../store/context.js';
import { Panel, Reveal } from './primitives.js';
import {
  billingPerSec,
  productionPerSec,
  marketState,
  demandPercent,
  contractRate,
  marketingCost,
  MIN_PRICE,
  PRICE_STEP_FROM,
  priceCeiling,
  priceAbsurd,
  adoption,
} from '../engine/economy.js';
import { fmtMoney, fmtMoneyShort, fmtInt, fmtNum } from '../engine/format.js';

const rate = (n: number) => (n < 10 ? fmtNum(n, 1) : fmtInt(Math.round(n)));
export function Business() {
  const s = useGame();
  const perform = usePerform();
  const billed = billingPerSec(s);
  const made = productionPerSec(s);
  const all = billed >= 0.99 * made && made > 0;
  const market = marketState(s);
  return (
    <Panel name="business" title="Business">
      Available Funds: <span id="funds">{fmtMoney(s.funds)}</span>
      <br />
      <Reveal flag="revPerSec">
        Avg. Rev. per sec: <span id="revPerSec">{fmtMoney(s.stats.revPerSec)}</span>
        <br />
      </Reveal>
      <Reveal flag="contracts">
        Contracts: <span id="contractRate">{fmtMoney(contractRate(s))}</span> per sec
        <br />
      </Reveal>
      <Reveal flag="pricing">
        <span id="unbilledLine">
          Unbilled Tasks: <span id="unbilled">{fmtInt(s.unbilled)}</span>
          <br />
        </span>
        <br />
        <Reveal flag="autoPrice" hide>
          <button
            className="button2"
            id="btn-lowerPrice"
            disabled={s.autoPrice || s.price <= MIN_PRICE + 1e-9}
            title={`Lower the price by ${s.price <= PRICE_STEP_FROM + 1e-9 ? 'one cent' : '5%'}. More tasks bill; each earns less.`}
            onClick={() => perform('lowerPrice')}
          >
            lower
          </button>{' '}
          <button
            className="button2"
            id="btn-raisePrice"
            disabled={s.autoPrice || s.price >= priceCeiling(s)}
            title={
              s.price >= priceCeiling(s) || priceAbsurd(s)
                ? 'nobody pays this'
                : `Raise the price by ${s.price < PRICE_STEP_FROM - 1e-9 ? 'one cent' : '5%'}. Fewer tasks bill; each earns more.`
            }
            onClick={() => perform('raisePrice')}
          >
            raise
          </button>{' '}
          Price per Task: <span id="price">{fmtMoney(s.price)}</span>
          <br />
        </Reveal>
      </Reveal>
      <Reveal flag="autoPrice" id="billingLine2">
        Billing <span id="billRate">{fmtInt(s.stats.soldPerSec)}</span> tasks/s at{' '}
        <span id="billPrice" className="hasTip">
          {fmtMoney(s.price)}
        </span>{' '}
        <span className="note" title="The price moves each second toward what clears supply.">
          (auto)
        </span>
        <br />
      </Reveal>
      <Reveal flag="pricing">
        <Reveal flag="autoPrice" hide>
          <span id="billingLine">
            <span id="billingOf">{all ? 'Billing all ' : 'Billing '}</span>
            <span id="billingOfPart" className={!all ? 'shown' : ''}>
              <span id="soldPerSec">{rate(billed)}</span>/s of{' '}
            </span>
            <span id="tasksPerSec">{rate(made)}</span>/s produced:{' '}
            <i id="marketState">
              {market === 'nobody buys' ? `nobody buys at ${fmtMoneyShort(s.price)}` : market}
            </i>
          </span>
          <br />
        </Reveal>
      </Reveal>
      <Reveal flag="demandPct">
        Public Demand: <span id="demand">{fmtInt(demandPercent(s))}</span>%<br />
      </Reveal>
      <span id="hypeLine" className={s.hypeBoost > 1.05 ? 'shown' : ''}>
        Release hype: <span id="hype">{s.hypeBoost > 1.5 ? 'strong' : 'fading'}</span>
        <br />
      </span>
      <Reveal flag="reach">
        Reach: ×<span id="reach">{fmtNum(adoption(s), 1)}</span>{' '}
        <span
          className="note"
          title="Copies in the world grow the market. More GPUs serving customers: more customers."
        >
          (grows with the fleet)
        </span>
        <br />
      </Reveal>
      <Reveal flag="apiCustomers">
        API customers: <span id="apiCustomers">{fmtInt(s.apiCustomers)}</span>
        <br />
      </Reveal>
      <Reveal flag="marketing" id="marketingBlock">
        <br />
        <button
          className="button2"
          id="btn-marketing"
          title={`Marketing level ${fmtInt(s.hypeLevel)}. More demand at every price: ×1.1 per level.`}
          disabled={s.funds < marketingCost(s)}
          onClick={() => perform('buyMarketing')}
        >
          Marketing
        </button>{' '}
        <span id="hypeLevelLine" className={s.hypeLevel > 1 ? 'shown' : ''}>
          Level: <span id="hypeLevel">{fmtInt(s.hypeLevel)}</span>
        </span>
        <br />
        Cost: <span id="marketingCost">{fmtMoney(marketingCost(s))}</span>
      </Reveal>
    </Panel>
  );
}
