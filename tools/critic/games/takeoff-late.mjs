// Takeoff from Stage 2 on — the rules the curious first-time player follows there. Every input is a
// button (its label, its enabled state, whether it shows as on/armed or drawn urgent), the reason or
// note the game prints beside it (<span class="reason">/<span class="note">: "No power …", "No room …",
// "$2.7M short — 0:05", "· next run 1:10 later"), the Train row's GPU line ("Needs 18,000 GPUs. 14,200
// free.") or a number printed on screen (Stores: "GPUs X of Y", "power A of B MW"). Settings are never
// pressed (lib/pagelib.mjs marks toggles, ON/OFF/AUTO and "Name: value" buttons as ambient), with one
// exception below; sliders are never dragged.
import { fmtN } from '../lib/util.mjs';

/** Infrastructure buttons (ids; bought only by infraStep, never by the generic loop). */
export const INFRA = { lot: 'btn-gpuBatch', datacenter: 'btn-datacenter', standing: 'btn-standing' };
/** Any GPU-lot row (Stage 2/3 have three: btn-gpuBatch, btn-gpuBatch5, btn-gpuBatch25). */
export const LOT_RE = /^btn-gpuBatch/;
/** Train first; Release (Stages 1–2) or Approve (Stage 3) after red-teaming to zero. */
export const TRAIN = 'btn-train';
export const RELEASE_KEYS = ['btn-release', 'btn-approve'];
/** Release publicly / approve: "Keep internal" and "Send back" are never pressed. */
export const KEEP_INTERNAL = 'btn-releaseInternal';
export const SEND_BACK = 'btn-sendBack';
/** The end screen's buttons: never pressed (a new game would wipe the run). */
export const END_SCREEN = ['btn-newGame', 'btn-endingTask'];
/**
 * Stage 4: the two cards the first-timer does not buy — "Sign a halt instead" (it ends the game in The
 * Pause the moment it is lit, from 12:00) and "Revoke a grant" (it takes back the grant the first-timer
 * just accepted, which the sweep then buys again: a loop). The game's own first-timer skips the same two.
 */
export const STAGE4_NEVER = ['proj-p_halt', 'proj-p_revoke'];
/** Stage 4: the fleet's exit card ("Grant the fleet autonomy"), lit once the fleet has asked. */
export const FLEET_GRANT_CARD = 'proj-p_autonomy';

const find = (c, k) => c.buttons.find((b) => b.k === k);
/** Power sources: any button whose label offers megawatts ("Gas turbines (+20 MW)", "Reactor (+1,000 MW)"). */
export const PLANT_KEYS_RE = /\(\+[0-9][0-9,]*\s*MW\)/;
const plants = (c) => c.buttons.filter((b) => b.kind === 'button' && PLANT_KEYS_RE.test(b.l));
const mwOf = (b) => Number(/\+([0-9][0-9,]*)\s*MW/.exec(b.l)[1].replace(/,/g, ''));
const lotSizeOf = (b) => Number(((/\(([0-9][0-9,]*)\)/.exec(b.l) || [])[1] || '0').replace(/,/g, ''));
/** The GPU-lot rows on screen, smallest lot first. */
const lotRows = (c) => c.buttons.filter((b) => LOT_RE.test(b.k)).sort((x, y) => lotSizeOf(x) - lotSizeOf(y));

/** Pricing is on automatic: a setting labelled AUTO that does not say "off". */
export function priceAuto(c) {
  return c.buttons.some((b) => b.t && /^auto\b/i.test(b.l) && !/\boff\b/i.test(b.l));
}

/** Train whenever Train is enabled and not already armed (pressed again, an armed Train stands down). */
export async function trainStep(ctx) {
  const tr = find(ctx.controls, TRAIN);
  if (tr && tr.e && !tr.on && !ctx.noop.has(TRAIN)) await ctx.click(TRAIN, 'train', 'Train is enabled');
}

/** Red-team until no issue is open, then Release / Approve (publicly; never Keep internal or Send back). */
export async function shipStep(ctx) {
  let c = ctx.controls;
  for (let guard = 0; guard < 3; guard++) {
    const m = c.m;
    if (m.trainingPhase !== 'redteam') break;
    const rt = find(c, 'btn-redteam');
    const rel = RELEASE_KEYS.map((k) => find(c, k)).find(Boolean);
    const open = m.issuesOpen ?? 0;
    if (open > 0 && rt && rt.e) {
      c = await ctx.click('btn-redteam', 'redteam', `${open} open issues`);
    } else if (rel && rel.e && !ctx.noop.has(rel.k) && (open === 0 || !rt)) {
      // No Red-team button on screen (a grant took it): issues are the game's to close; ship when lit.
      c = await ctx.click(rel.k, 'release', open === 0 ? '0 open issues' : `${open} open issues, no Red-team button on screen`);
    } else break;
  }
  return c;
}

/**
 * The Standing order (it buys GPU lots from the build fund) is the setting a first-timer's own Stage 2
 * leaves on: the game switches it on when its card is bought and the first-timer never touches it. A
 * start that inherits it off (the Stage 3 presets come from the game's bot, which buys lots by hand)
 * has it switched on once, at the first check that shows it — as the game's own first-timer policy does.
 */
export async function standingStep(ctx) {
  const mem = (ctx.memory.standing ||= { seen: false });
  if (mem.seen) return;
  const b = find(ctx.controls, INFRA.standing);
  if (!b) return;
  mem.seen = true;
  if (b.e && !b.on && /\boff\b/i.test(b.l)) await ctx.click(INFRA.standing, 'setting', `inherited "${b.l}" at the start; switched on once`);
}

/** "Needs 18,000 GPUs. 14,200 free." / "Needs 6,700 powered GPUs. 4,000 are dark: add power." */
const trainShort = (m) => /^Needs [0-9][0-9,]* (?:powered )?GPUs\./.test(m.trainGpus || '');

/**
 * Infrastructure from what the screen says, up to three purchases a check:
 *   a wall on a lot row — "No power …" → the power source with the lowest shown $ per MW; "No room …"
 *     → Build Datacenter (nothing when the row says the build-out orders it, or names a card);
 *   the Train row short of power ("… are dark: add power") → the same power rule;
 *   a datacenter or power plant the game draws urgent → that one;
 *   GPU lots: the largest lit lot when the Train row says the run is short of GPUs, or when no Standing
 *     order is on to buy them (before its card, or switched off); otherwise the order buys them.
 * Plants and halls are bought by this rule only (never by the sweep). The game greys a purchase only
 * for its purse's shortfall (printed with a clock), a stated requirement, or the queue.
 */
export async function infraStep(ctx) {
  for (let i = 0; i < 3; i++) {
    const c = ctx.controls;
    const m = c.m;
    const rows = lotRows(c);
    if (!rows.length && !find(c, INFRA.datacenter) && !plants(c).length) return;
    const wall = rows.map((b) => b.why || '').find((w) => /no power|no room/i.test(w)) || '';
    const automated = /build-out orders|needs .*(campus|New Carlisle)/i.test(wall);
    const standing = find(c, INFRA.standing);
    const orderOn = !!(standing && (standing.on || /:\s*on\b/i.test(standing.l)));
    const short = trainShort(m);
    let need = null;
    let why = '';
    if (wall && !automated && /no power/i.test(wall)) [need, why] = ['power', `lot row says "${wall}"`];
    else if (wall && !automated && /no room/i.test(wall)) [need, why] = ['room', `lot row says "${wall}"`];
    else if (short && /add power/i.test(m.trainGpus)) [need, why] = ['power', `Train row says "${m.trainGpus}"`];
    if (!need) {
      const urgent = [find(c, INFRA.datacenter), ...plants(c)].find((b) => b && b.u && b.e && !ctx.noop.has(b.k));
      if (urgent) [need, why] = [urgent.k === INFRA.datacenter ? 'room' : 'power', `"${urgent.l}" drawn urgent`];
    }
    if (!need && rows.some((b) => b.e) && (short || !orderOn)) [need, why] = ['gpus', short ? `Train row says "${m.trainGpus}"` : standing ? `${standing.l}` : 'no Standing order on screen'];
    if (!need) return;
    const before = ctx.controls;
    if (need === 'gpus') {
      const lit = rows.filter((b) => b.e && !ctx.noop.has(b.k));
      if (!lit.length) return;
      const big = lit[lit.length - 1];
      await ctx.click(big.k, 'infra', `largest lit lot (${big.l}): ${why}`);
    } else if (need === 'room') {
      const dc = find(c, INFRA.datacenter);
      if (!(dc && dc.e) || ctx.noop.has(INFRA.datacenter)) return;
      await ctx.click(INFRA.datacenter, 'infra', why);
    } else {
      const options = plants(c).filter((b) => b.e && !ctx.noop.has(b.k) && (b.funds || 0) > 0);
      if (!options.length) return;
      const best = options.reduce((x, y) => (y.funds / mwOf(y) < x.funds / mwOf(x) ? y : x));
      await ctx.click(best.k, 'infra', `${why}: lowest $/MW (${best.l}, $${fmtN(best.funds)})`);
    }
    if (ctx.controls === before) return;
  }
}
