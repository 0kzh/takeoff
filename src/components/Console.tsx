import { Fragment } from 'react';
import type { GameState } from '../engine/state.js';
import { CONSOLE_LINES } from '../engine/state.js';
import { useGame } from '../store/gameStore.js';
import { Reveal } from './primitives.js';

const consoleView = (s: GameState) =>
  Array.from({ length: CONSOLE_LINES }, (_, i) => s.console[s.console.length - 1 - i] ?? '');

export function Console() {
  const lines = useGame(consoleView);
  const older = lines.map((text, i) => ({ n: i + 1, text })).slice(1).reverse();
  return (
    <Reveal as="div" flag="console" id="consoleDiv" data-panel="console">
      <p className="consoleOld" id="consoleOld">
        {older.map(({ n, text }, i) => (
          <Fragment key={n}>
            <span className="consoleLine"><span>&nbsp;.&nbsp;</span><span id={`readout${n}`}>{text}</span></span>
            {i < older.length - 1 && <br />}
          </Fragment>
        ))}
      </p>
      <p className="console"><span>&nbsp;&gt;&nbsp;</span><span id="readout1">{lines[0]}</span><span id="cursor" className="pulsate">|</span></p>
    </Reveal>
  );
}
