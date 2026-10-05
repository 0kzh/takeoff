const cache = new Map<string, HTMLElement>();

export function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  let el = cache.get(id);
  if (!el || !el.isConnected) {
    const found = document.getElementById(id);
    if (!found) throw new Error(`Missing element #${id}`);
    el = found;
    cache.set(id, el);
  }
  return el as T;
}

/** Writes only when the text changed, so a 60 fps render does not thrash the DOM. */
export function setText(id: string, text: string): void {
  const el = byId(id);
  if (el.textContent !== text) el.textContent = text;
}

export function setShown(el: Element, on: boolean): void {
  if (el.classList.contains('shown') !== on) el.classList.toggle('shown', on);
}

export function showId(id: string, on: boolean): void {
  setShown(byId(id), on);
}

/** Tooltips change with state (an absurd price, open issues); write only on change. */
export function setTitle(id: string, title: string): void {
  const el = byId(id);
  if (el.title !== title) el.title = title;
}

export function setDisabled(id: string, disabled: boolean): void {
  const b = byId<HTMLButtonElement>(id);
  if (b.disabled !== disabled) b.disabled = disabled;
}

export function setWidth(el: HTMLElement, fraction: number): void {
  const w = `${Math.max(0, Math.min(100, fraction * 100)).toFixed(1)}%`;
  if (el.style.width !== w) el.style.width = w;
}

export function make<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  text?: string,
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (text !== undefined) el.textContent = text;
  return el;
}
