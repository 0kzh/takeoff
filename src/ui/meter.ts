/**
 * The capacity meter (owner feedback 1, B3): ten cells, `｢￭￭￭￭￭￭￭･･･｣` (U+FFED filled, U+FF65 empty,
 * U+FF62 / U+FF63 caps). Halfwidth forms keep one width in a proportional font, so the bar is the same
 * width at every fill. At boot `checkMeterGlyphs` measures both glyphs; if either is missing or their
 * widths differ by more than a pixel the meter falls back to `[■■■□□□□□□□]` in a monospace span.
 * `meter()` itself is DOM-free and adds no digits to the screen (the numbers stay beside it).
 */
export type MeterMode = 'drain' | 'use';

const HALF = { open: '｢', full: '￭', empty: '･', close: '｣' };
const BLOCK = { open: '[', full: '■', empty: '□', close: ']' };
let glyphs = HALF;

export const METER_CELLS = 10;

/** True when the boot check fell back to the monospace block style. */
export function meterFallback(): boolean {
  return glyphs === BLOCK;
}

export function useBlockMeter(on: boolean): void {
  glyphs = on ? BLOCK : HALF;
}

/**
 * Lit cells for a fraction: a store that drains shows `ceil(10 × f)` (the last cell goes out only at
 * zero); a capacity in use shows `round(10 × f)`, the tenth lighting only at 99.5 %.
 */
export function meterCells(fraction: number, mode: MeterMode = 'use'): number {
  const f = Number.isFinite(fraction) ? Math.max(0, Math.min(1, fraction)) : 0;
  if (mode === 'drain') return Math.min(METER_CELLS, Math.ceil(METER_CELLS * f - 1e-9));
  if (f >= 0.995) return METER_CELLS;
  return Math.min(METER_CELLS - 1, Math.round(METER_CELLS * f));
}

export function meter(fraction: number, mode: MeterMode = 'use'): string {
  const n = meterCells(fraction, mode);
  return `${glyphs.open}${glyphs.full.repeat(n)}${glyphs.empty.repeat(METER_CELLS - n)}${glyphs.close}`;
}
