import type { GameState } from '../engine/state.js';
import {
  marketingCost, demandPercent, contractRate, billingPerSec, productionPerSec, marketState, priceAbsurd, priceCeiling,
  MIN_PRICE, PRICE_STEP_FROM,
} from '../engine/economy.js';
import { fmtInt, fmtNum, fmtMoney, fmtMoneyShort } from '../engine/format.js';
import { useGame, perform } from '../store/gameStore.js';
import { Panel, Reveal, Hide, cx } from './primitives.js';

function fmtRate(n: number): string {
  return n < 10 ? fmtNum(n, 1) : fmtInt(Math.round(n));
}

function businessView(s: GameState) {
  const billed = billingPerSec(s);
  const made = productionPerSec(s);
  const market = marketState(s);
  const ceiling = s.price >= priceCeiling(s);
  const step = s.price < PRICE_STEP_FROM - 1e-9 ? 'one cent' : '5%';
  return {
    funds: fmtMoney(s.funds),
    revPerSec: fmtMoney(s.stats.revPerSec),
    contractRate: fmtMoney(contractRate(s)),
    unbilled: fmtInt(s.unbilled),
    price: fmtMoney(s.price),
    billRate: fmtInt(s.stats.soldPerSec),
    sold: fmtRate(billed),
    made: fmtRate(made),
    all: billed >= 0.99 * made && made > 0,
    market: market === 'nobody buys' ? `nobody buys at ${fmtMoneyShort(s.price)}` : market,
    demand: fmtInt(demandPercent(s)),
    lowerDisabled: s.autoPrice || s.price <= MIN_PRICE + 1e-9,
    lowerTitle: `Lower the price by ${s.price <= PRICE_STEP_FROM + 1e-9 ? 'one cent' : '5%'}. More tasks bill; each earns less.`,
    raiseDisabled: s.autoPrice || ceiling,
    raiseTitle: ceiling || priceAbsurd(s) ? 'nobody pays this' : `Raise the price by ${step}. Fewer tasks bill; each earns more.`,
    hypeShown: s.hypeBoost > 1.05,
    hype: s.hypeBoost > 1.5 ? 'strong' : 'fading',
    apiCustomers: fmtInt(s.apiCustomers),
    hypeLevel: fmtInt(s.hypeLevel),
    hypeLevelShown: s.hypeLevel > 1,
    marketingCost: fmtMoney(marketingCost(s)),
    marketingDisabled: s.funds < marketingCost(s),
    marketingTitle: `Marketing level ${fmtInt(s.hypeLevel)}. More demand at every price: ×1.1 per level.`,
  };
}

export function Business() {
  const v = useGame(businessView);
  return (
    <Panel name="business">
      <b>Business</b>
      <hr />
      Available Funds: <span id="funds">{v.funds}</span><br />
      <Reveal flag="revPerSec">Avg. Rev. per sec: <span id="revPerSec">{v.revPerSec}</span><br /></Reveal>{' '}
      <Reveal flag="contracts">Contracts: <span id="contractRate">{v.contractRate}</span> per sec<br /></Reveal>{' '}
      <Reveal flag="pricing">
        <span id="unbilledLine">Unbilled Tasks: <span id="unbilled">{v.unbilled}</span><br /></span>
        <br />
        <Hide flag="autoPrice">
          <button className="button2" id="btn-lowerPrice" title={v.lowerTitle} disabled={v.lowerDisabled} onClick={() => perform('lowerPrice')}>lower</button>{' '}
          <button className="button2" id="btn-raisePrice" title={v.raiseTitle} disabled={v.raiseDisabled} onClick={() => perform('raisePrice')}>raise</button>
        </Hide>{' '}
        <Hide flag="autoPrice">Price per Task: <span id="price">{v.price}</span><br /></Hide>
      </Reveal>{' '}
      <Reveal flag="autoPrice" id="billingLine2">
        Billing <span id="billRate">{v.billRate}</span> tasks/s at <span id="billPrice" className="hasTip">{v.price}</span> <span className="note" title="The price moves each second toward what clears supply.">(auto)</span><br />
      </Reveal>{' '}
      <Reveal flag="pricing">
        <Hide flag="autoPrice">
          <span id="billingLine">
            <span id="billingOf">{v.all ? 'Billing all ' : 'Billing '}</span>
            <span id="billingOfPart" className={cx(!v.all && 'shown')}><span id="soldPerSec">{v.sold}</span>/s of </span>
            <span id="tasksPerSec">{v.made}</span>/s produced: <i id="marketState">{v.market}</i>
          </span>
          <br />
        </Hide>
      </Reveal>{' '}
      <Reveal flag="demandPct">Public Demand: <span id="demand">{v.demand}</span>%<br /></Reveal>{' '}
      <span id="hypeLine" className={cx(v.hypeShown && 'shown')}>Release hype: <span id="hype">{v.hype}</span><br /></span>{' '}
      <Reveal flag="apiCustomers">API customers: <span id="apiCustomers">{v.apiCustomers}</span><br /></Reveal>
      <Reveal as="div" flag="marketing" id="marketingBlock">
        <br />
        <button className="button2" id="btn-marketing" title={v.marketingTitle} disabled={v.marketingDisabled} onClick={() => perform('buyMarketing')}>Marketing</button>{' '}
        <span id="hypeLevelLine" className={cx(v.hypeLevelShown && 'shown')}>Level: <span id="hypeLevel">{v.hypeLevel}</span></span><br />
        Cost: <span id="marketingCost">{v.marketingCost}</span>
      </Reveal>
    </Panel>
  );
}
