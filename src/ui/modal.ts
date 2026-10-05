import type { GameState } from '../engine/state.js';
import { choiceById, choiceOptionEnabled, choiceOptionVisible, optionCost, optionTooltip, optionLine, optionNeeds, optionLabel, defaultIndex } from '../engine/events.js';
import { costLabel } from '../engine/projects.js';
import { byId, make, setShown, setText } from './dom.js';

let lastKey = '';
let returnFocus: HTMLElement | null = null;
let escapeBound = false;

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
  setShown(overlay, !!def);
  if (!active || !def) {
    if (lastKey) giveFocusBack();
    lastKey = '';
    return;
  }
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
          b.append(make('span', { class: 'optLabel' }, optionLabel(s, opt)), make('span', { class: 'optLine' }, optionLine(s, opt)));
        } else {
          b.textContent = optionLabel(s, opt);
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
  setText('modalTimer', def.timer && fallback ? `${Math.ceil(active.remaining)} s — then: ${optionLabel(s, fallback)}` : '');
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
