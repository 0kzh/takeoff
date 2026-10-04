import { setWidth } from './dom.js';

/** Inline capacity/progress meters use the original training bar's bordered track and gray fill. */
export function renderMeter(el: HTMLElement, fraction: number): void {
  let fill = el.firstElementChild as HTMLElement | null;
  if (!fill) {
    fill = document.createElement('span');
    fill.className = 'meterFill';
    fill.setAttribute('aria-hidden', 'true');
    el.replaceChildren(fill);
    el.setAttribute('role', 'progressbar');
    el.setAttribute('aria-valuemin', '0');
    el.setAttribute('aria-valuemax', '100');
  }
  const f = Number.isFinite(fraction) ? Math.max(0, Math.min(1, fraction)) : 0;
  setWidth(fill, f);
  const value = (f * 100).toFixed(1);
  if (el.getAttribute('aria-valuenow') !== value) el.setAttribute('aria-valuenow', value);
}

/** A cooldown button drains the same bar behind its label: while it cools it takes the bar's track and border. */
export function renderCooldown(button: HTMLElement, bar: HTMLElement, fraction: number): void {
  setWidth(bar, fraction);
  const cooling = fraction > 0;
  if (button.classList.contains('cooling') !== cooling) button.classList.toggle('cooling', cooling);
}
