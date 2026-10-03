import type { GameState } from '../engine/state.js';
import { choiceById, choiceOptionEnabled, optionCost, optionTooltip } from '../engine/events.js';
import { costLabel } from '../engine/projects.js';
import { byId, make, setShown, setText } from './dom.js';

let lastKey = '';

/** ADR event panel. The game keeps running underneath; timed choices count down. */
export function renderModal(s: GameState, choose: (index: number) => void): void {
  const active = s.activeChoice;
  const overlay = byId('modalOverlay');
  const def = active ? choiceById(active.id) : undefined;
  setShown(overlay, !!def && !s.ending);
  if (!active || !def) {
    lastKey = '';
    return;
  }
  const key = `${active.id}|${JSON.stringify(active.context)}`;
  if (key !== lastKey) {
    lastKey = key;
    setText('modalTitle', def.title);
    const text = byId('modalText');
    text.replaceChildren(...def.text(s, active.context).map((line) => make('p', {}, line)));
    const buttons = byId('modalButtons');
    buttons.replaceChildren(
      ...def.options.map((opt, i) => {
        const cost = optionCost(s, opt);
        const tip = [optionTooltip(s, opt), cost && !optionTooltip(s, opt).startsWith('$') ? `Costs ${costLabel(cost)}.` : ''].filter(Boolean).join(' ');
        const b = make('button', { class: 'modalButton', id: `choice-${def.id}-${i}`, 'data-option': String(i) }, opt.label);
        if (tip) b.title = tip;
        b.addEventListener('click', () => choose(i));
        return b;
      }),
    );
  }
  def.options.forEach((_, i) => {
    const b = document.getElementById(`choice-${def.id}-${i}`) as HTMLButtonElement | null;
    const disabled = !choiceOptionEnabled(s, def, i);
    if (b && b.disabled !== disabled) b.disabled = disabled;
  });
  const fallback = def.options[def.defaultOption ?? def.options.length - 1];
  setText('modalTimer', def.timer && fallback ? `${Math.ceil(active.remaining)} s — then: ${fallback.label}` : '');
}
