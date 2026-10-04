import type { GameState } from '../engine/state.js';
import { choiceById, choiceOptionEnabled, optionCost, optionTooltip, optionLine, optionNeeds } from '../engine/events.js';
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
    if (opening) takeFocus();
  }
  def.options.forEach((opt, i) => {
    const b = document.getElementById(`choice-${def.id}-${i}`) as HTMLButtonElement | null;
    if (!b) return;
    const disabled = !choiceOptionEnabled(s, def, i);
    if (b.disabled !== disabled) b.disabled = disabled;
    if (lines) {
      const line = b.querySelector('.optLine');
      const want = disabled ? optionNeeds(s, opt) : optionLine(s, opt);
      if (line && line.textContent !== want) line.textContent = want;
    }
  });
  const fallback = def.options[def.defaultOption ?? def.options.length - 1];
  setText('modalTimer', def.timer && fallback ? `${Math.ceil(active.remaining)} s — then: ${fallback.label}` : '');
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
