// Takeoff from Stage 2 on — the rules the curious first-time player follows there. Every input is a
// button, its inline reason (<span class="reason">: "no power", "no room", "power to spare",
// "room to spare", "queue full", "standing order", "joins the queue"), a label, or a number printed
// on screen (Stores: "GPUs X / Y", "power A / B MW"). Settings are never pressed (lib/pagelib.mjs
// marks toggles, ON/OFF and "Name: value" buttons as ambient); the slider is never dragged.
import { fmtN } from '../lib/util.mjs';

/** Infrastructure buttons (ids; bought only by infraStep, never by the generic loop). */
export const INFRA = { lot: 'btn-gpuBatch', datacenter: 'btn-datacenter' };
/** Train first, then the release-slot rules in takeoff.mjs. */
export const TRAIN = 'btn-train';
/** Release publicly: "Keep internal" is never pressed. */
export const KEEP_INTERNAL = 'btn-releaseInternal';

const find = (c, k) => c.buttons.find((b) => b.k === k);
/** Power sources: any button whose label offers megawatts ("Gas turbines (+20 MW)"). */
const plants = (c) => c.buttons.filter((b) => b.kind === 'button' && /\(\+[0-9][0-9,]*\s*MW\)/.test(b.l));
const mwOf = (b) => Number(/\+([0-9][0-9,]*)\s*MW/.exec(b.l)[1].replace(/,/g, ''));
export const PLANT_KEYS_RE = /\(\+[0-9][0-9,]*\s*MW\)/;

/** Pricing is on automatic: a setting labelled AUTO that does not say "off". */
export function priceAuto(c) {
  return c.buttons.some((b) => b.t && /^auto\b/i.test(b.l) && !/\boff\b/i.test(b.l));
}

/** Train whenever Train is enabled (two pipelines: whenever a slot is free and it is affordable). */
export async function trainStep(ctx) {
  const tr = find(ctx.controls, TRAIN);
  if (tr && tr.e && !ctx.noop.has(TRAIN)) await ctx.click(TRAIN, 'train', 'Train is enabled');
}

/**
 * Infrastructure from the lot row's reason: enabled → a GPU lot; "no power" → the power source with
 * the lowest shown price per MW; "no room" → a datacenter; "standing order" (it buys the lots) →
 * whichever of room or power the Stores panel shows nearer full. Plants and datacenters the screen
 * calls "to spare" are disabled by the game and never bought. Up to three steps per check.
 */
export async function infraStep(ctx) {
  for (let i = 0; i < 3; i++) {
    const c = ctx.controls;
    const m = c.m;
    const lot = find(c, INFRA.lot);
    if (!lot) return;
    const why = lot.why || '';
    let need = null;
    if (lot.e) need = 'gpus';
    else if (/no power/i.test(why)) need = 'power';
    else if (/no room/i.test(why)) need = 'room';
    else if (/standing order/i.test(why) && m.gpuCapacity > 0 && m.powerCapMW > 0) need = m.gpusShown / m.gpuCapacity >= m.powerDrawMW / m.powerCapMW ? 'room' : 'power';
    if (!need) return;
    const before = ctx.controls;
    if (need === 'gpus') {
      await ctx.click(INFRA.lot, 'infra', `GPU lot (${lot.l})`);
    } else if (need === 'room') {
      const dc = find(c, INFRA.datacenter);
      if (!(dc && dc.e) || ctx.noop.has(INFRA.datacenter)) return;
      await ctx.click(INFRA.datacenter, 'infra', `${why === 'no room' ? 'GPU lot says "no room"' : `standing order on; GPUs ${fmtN(m.gpusShown)} / ${fmtN(m.gpuCapacity)} is nearer full than power`}`);
    } else {
      const options = plants(c).filter((b) => b.e && !ctx.noop.has(b.k) && (b.funds || 0) > 0);
      if (!options.length) return;
      const best = options.reduce((x, y) => (y.funds / mwOf(y) < x.funds / mwOf(x) ? y : x));
      await ctx.click(best.k, 'infra', `${why === 'no power' ? 'GPU lot says "no power"' : `standing order on; power ${fmtN(m.powerDrawMW, 1)} / ${fmtN(m.powerCapMW)} MW is nearer full than room`}: lowest $/MW (${best.l}${best.why ? `, ${best.why}` : ''})`);
    }
    if (ctx.controls === before) return;
  }
}
