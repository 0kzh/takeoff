import type { GameState } from '../engine/state.js';
import { storeBreakdown, StoreKey } from '../engine/stores.js';
import { byId, make } from './dom.js';

const SLOTS = ['funds', 'research', 'researchCap', 'insight', 'trust', 'infraGpus', 'gpuCapacity', 'powerMW', 'powerCapMW', 'infraCopies'];

interface Home {
  parent: Node;
  next: Node | null;
}

const homes = new Map<string, Home>();
let openKey: StoreKey | null = null;
let openRow: HTMLElement | null = null;
let touch = false;

export function mountStores(): void {
  for (const id of SLOTS) {
    const el = byId(id);
    homes.set(id, { parent: el.parentNode!, next: el.nextSibling });
  }
  for (const row of Array.from(document.querySelectorAll<HTMLElement>('.storeRow'))) {
    const key = row.dataset['store'] as StoreKey;
    row.addEventListener('mouseenter', () => {
      if (!touch) open(row, key);
    });
    row.addEventListener('mouseleave', () => {
      if (!touch) close();
    });
    row.addEventListener('touchstart', () => {
      touch = true;
    }, { passive: true });
    row.addEventListener('click', (e) => {
      if (!touch) return;
      e.stopPropagation();
      if (openKey === key) close();
      else open(row, key);
    });
  }
  document.addEventListener('click', () => {
    if (touch && openKey) close();
  });
}

function open(row: HTMLElement, key: StoreKey): void {
  if (openRow) openRow.classList.remove('tipOpen');
  openKey = key;
  openRow = row;
  row.classList.add('tipOpen');
  byId('storeTip').classList.add('open');
  lastTip = '';
}

function close(): void {
  if (openRow) openRow.classList.remove('tipOpen');
  openKey = null;
  openRow = null;
  byId('storeTip').classList.remove('open');
}

let lastTip = '';

export function renderStores(s: GameState): void {
  const on = s.revealed['stores'] === true;
  for (const id of SLOTS) {
    const el = byId(id);
    if (on) {
      const slot = document.querySelector<HTMLElement>(`[data-slot="${id}"]`);
      if (slot && el.parentNode !== slot) slot.appendChild(el);
    } else {
      const home = homes.get(id);
      if (home && el.parentNode !== home.parent) {
        const next = home.next && home.next.parentNode === home.parent ? home.next : null;
        home.parent.insertBefore(el, next);
      }
    }
  }
  if (!on && openKey) close();
  if (!openKey || !openRow) return;
  if (!openRow.checkVisibility()) {
    close();
    return;
  }
  const rows = storeBreakdown(s, openKey);
  if (rows.length === 0) {
    close();
    return;
  }
  const key = JSON.stringify(rows);
  const tip = byId('storeTip');
  if (key !== lastTip) {
    lastTip = key;
    tip.replaceChildren(
      ...rows.map(([label, text, kind]) => {
        const r = make('div', { class: `tipRow${kind ? ` ${kind}` : ''}` });
        r.append(make('span', {}, label), make('span', {}, text));
        return r;
      }),
    );
  }
  const box = openRow.getBoundingClientRect();
  const left = Math.max(4, Math.min(window.scrollX + box.left + 12, window.scrollX + document.documentElement.clientWidth - tip.offsetWidth - 4));
  const top = window.scrollY + box.bottom + 2;
  tip.style.left = `${left}px`;
  tip.style.top = `${top}px`;
}
