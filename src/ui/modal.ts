import type { GameState } from '../engine/state.js';
import { choiceById, choiceOptionEnabled, choiceOptionVisible, optionCost, optionTooltip, optionLine, optionNeeds, defaultIndex } from '../engine/events.js';
import { costLabel } from '../engine/projects.js';
import { byId, make, setShown, setText } from './dom.js';

let lastKey = '';
/** Where keyboard focus was before the event panel took it; it goes back when the panel closes. */
let returnFocus: HTMLElement | null = null;
let escapeBound = false;

/**
 * ADR event panel. The game keeps running underneath, and so does the page: the panel does not
 * catch clicks outside itself. It takes keyboard focus when it opens; Escape on a timed panel
 * takes its default (what the timer would do), and does nothing on an untimed one.
 * From Stage 2, each option prints its effect and cost under its label; a greyed one says what it needs.
 */
export function renderModal(s: GameState, choose: (index: number) => void, dismiss: () => void): void {
  if (!escapeBound) {
    escapeBound = true;
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && lastKey && byId('modalOverlay').classList.contains('shown')) dismiss();
    });
  }
  const active = s.activeChoice;
  const overlay = byId('modalOverlay');
  const def = active ? choiceById(active.id) : undefined;
  setShown(overlay, !!def && !s.ending);
  if (!active || !def) {
    if (lastKey) giveFocusBack();
    lastKey = '';
    return;
  }
  // Effect and cost under each label (critic round 2 §5), wherever the modal's options carry them.
  const lines = def.options.some((o) => o.line !== undefined);
  const key = `${active.id}|${JSON.stringify(active.context)}`;
  if (key !== lastKey) {
    const opening = lastKey === '';
    lastKey = key;
    setText('modalTitle', def.title);
    const text = byId('modalText');
    text.replaceChildren(...def.text(s, active.context).map((line) => make('p', {}, line)));
    const buttons = byId('modalButtons');
    buttons.replaceChildren(
      ...def.options.map((opt, i) => {
        const cost = optionCost(s, opt);
        const tip = [optionTooltip(s, opt), cost && !optionTooltip(s, opt).startsWith('$') ? `Costs ${costLabel(cost)}.` : ''].filter(Boolean).join(' ');
        const b = make('button', { class: lines ? 'modalButton twoLine' : 'modalButton', id: `choice-${def.id}-${i}`, 'data-option': String(i) });
        if (lines) {
          b.append(make('span', { class: 'optLabel' }, opt.label), make('span', { class: 'optLine' }, optionLine(s, opt)));
        } else {
          b.textContent = opt.label;
        }
        if (tip) b.title = tip;
        b.addEventListener('click', () => choose(i));
        return b;
      }),
    );
    if (opening) {
      placeModal();
      takeFocus();
    }
  }
  def.options.forEach((opt, i) => {
    const b = document.getElementById(`choice-${def.id}-${i}`) as HTMLButtonElement | null;
    if (!b) return;
    const hidden = !choiceOptionVisible(s, def, i);
    if (b.classList.contains('off') !== hidden) b.classList.toggle('off', hidden);
    const disabled = !choiceOptionEnabled(s, def, i);
    if (b.disabled !== disabled) b.disabled = disabled;
    if (lines) {
      const line = b.querySelector('.optLine');
      const want = disabled ? optionNeeds(s, opt) : optionLine(s, opt);
      if (line && line.textContent !== want) line.textContent = want;
    }
  });
  const fallback = def.options[defaultIndex(s, def)];
  setText('modalTimer', def.timer && fallback ? `${Math.ceil(active.remaining)} s — then: ${fallback.label}` : '');
}

/**
 * The panel opens beside the Stores, not over them (critic C10: its options are priced in the funds it
 * covered): its left edge on the middle column. One column (≤ 700 px) keeps the stylesheet's place.
 */
function placeModal(): void {
  const modal = byId('modal');
  const mid = document.getElementById('middleColumn');
  if (window.innerWidth <= 700 || !mid) {
    modal.style.left = '';
    modal.style.transform = '';
    modal.style.top = '';
    modal.style.maxHeight = '';
    return;
  }
  const left = Math.max(8, Math.min(window.innerWidth - modal.offsetWidth - 8, Math.round(mid.getBoundingClientRect().left)));
  modal.style.left = `${left}px`;
  modal.style.transform = 'none';
  // Docked below any slider under it (critic S3 round 1 §9 item 8: the panel sat on both sliders for the
  // length of every timed event, the one about monitors on the monitors slider).
  const right = left + modal.offsetWidth;
  let top = 120;
  for (const el of Array.from(document.querySelectorAll<HTMLInputElement>('#columns input[type="range"]'))) {
    if (!el.checkVisibility()) continue;
    const b = el.getBoundingClientRect();
    if (b.right > left && b.left < right && b.bottom > 0) top = Math.max(top, Math.round(b.bottom + 16));
  }
  // No room below them on this screen: beside the column instead, at the usual height.
  if (top + Math.min(modal.offsetHeight, 300) > window.innerHeight) {
    const beside = Math.min(window.innerWidth - modal.offsetWidth - 8, Math.round(mid.getBoundingClientRect().right + 12));
    modal.style.left = `${Math.max(8, beside)}px`;
    top = 120;
  }
  modal.style.top = `${top}px`;
  modal.style.maxHeight = `calc(100vh - ${top + 20}px)`;
}

function takeFocus(): void {
  const current = document.activeElement;
  returnFocus = current instanceof HTMLElement && current !== document.body ? current : null;
  byId('modal').focus({ preventScroll: true });
}

function giveFocusBack(): void {
  const panel = byId('modal');
  const inside = document.activeElement instanceof Node && panel.contains(document.activeElement);
  if (inside || document.activeElement === document.body) {
    if (returnFocus && document.contains(returnFocus) && !(returnFocus as HTMLButtonElement).disabled) {
      returnFocus.focus({ preventScroll: true });
    } else if (inside) {
      (document.activeElement as HTMLElement).blur();
    }
  }
  returnFocus = null;
}
