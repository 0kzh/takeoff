import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import type { GameState } from '../engine/state.js';
import { choiceById, choiceOptionEnabled, optionCost, optionTooltip, optionLine, optionNeeds, defaultIndex } from '../engine/events.js';
import { costLabel } from '../engine/projects.js';
import { useGame, getGame, perform } from '../store/gameStore.js';
import { cx } from './primitives.js';

function modalView(s: GameState) {
  const active = s.activeChoice;
  const def = active ? choiceById(active.id) : undefined;
  if (!active || !def) return null;
  const lines = def.options.some((o) => o.line !== undefined);
  const fallback = def.options[defaultIndex(def)];
  return {
    id: def.id,
    key: `${active.id}|${JSON.stringify(active.context)}`,
    shown: !s.ending,
    lines,
    timer: def.timer && fallback ? `${Math.ceil(active.remaining)} s — then: ${fallback.label}` : '',
    options: def.options.map((opt, i) => {
      const disabled = !choiceOptionEnabled(s, def, i);
      return { disabled, line: lines ? (disabled ? optionNeeds(s, opt) : optionLine(s, opt)) : '' };
    }),
  };
}

function opening(key: string | undefined) {
  const s = getGame();
  const def = key && s.activeChoice ? choiceById(s.activeChoice.id) : undefined;
  if (!def || !s.activeChoice) return null;
  return {
    title: def.title,
    text: def.text(s, s.activeChoice.context),
    options: def.options.map((opt) => {
      const cost = optionCost(s, opt);
      const tooltip = optionTooltip(s, opt);
      return {
        label: opt.label,
        tip: [tooltip, cost && !tooltip.startsWith('$') ? `Costs ${costLabel(cost)}.` : ''].filter(Boolean).join(' '),
      };
    }),
  };
}

export function Modal() {
  const v = useGame(modalView);
  const open = v !== null;
  const shown = open && v.shown;
  const content = useMemo(() => opening(v?.key), [v?.key]);
  const panel = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const current = document.activeElement;
    returnFocus.current = current instanceof HTMLElement && current !== document.body ? current : null;
    panel.current?.focus({ preventScroll: true });
    return () => {
      const back = returnFocus.current;
      const active = document.activeElement;
      const inside = active instanceof Node && !!panel.current?.contains(active);
      if (inside || active === document.body) {
        if (back && document.contains(back) && !(back as HTMLButtonElement).disabled) back.focus({ preventScroll: true });
        else if (inside) (active as HTMLElement).blur();
      }
      returnFocus.current = null;
    };
  }, [open]);

  useEffect(() => {
    if (!shown) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') perform('takeDefault');
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [shown]);

  return (
    <div id="modalOverlay" data-panel="modal" className={cx(shown && 'shown')}>
      <div id="modal" role="dialog" aria-modal="false" aria-labelledby="modalTitle" tabIndex={-1} ref={panel}>
        <div id="modalTitle">{content?.title}</div>
        <div id="modalText">{content?.text.map((line, i) => <p key={i}>{line}</p>)}</div>
        <div id="modalTimer">{v?.timer}</div>
        <div id="modalButtons">
          {v && content?.options.map((opt, i) => (
            <button
              key={`${v.key}|${i}`}
              className={cx('modalButton', v.lines && 'twoLine')}
              id={`choice-${v.id}-${i}`}
              data-option={i}
              title={opt.tip || undefined}
              disabled={v.options[i]?.disabled}
              onClick={() => perform('resolveChoice', i)}
            >
              {v.lines ? (
                <>
                  <span className="optLabel">{opt.label}</span>
                  <span className="optLine">{v.options[i]?.line}</span>
                </>
              ) : opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
