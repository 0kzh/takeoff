import { useEffect, useMemo, useState } from 'react';
import { endingById, endStats } from '../engine/endings.js';
import { useGame, useGameStore, getGame } from '../store/gameStore.js';
import { cx, useConfirm } from './primitives.js';

export function Ending() {
  const ending = useGame((s) => s.ending);
  const epoch = useGameStore((st) => st.epoch);
  const restart = useGameStore((st) => st.restart);
  const [armed, press] = useConfirm(restart);
  const content = useMemo(() => {
    if (!ending) return null;
    const def = endingById(ending);
    return { title: def?.title ?? ending, text: def?.epilogue ?? '', stats: endStats(getGame()) };
  }, [ending, epoch]);

  return (
    <div id="endingScreen" data-panel="ending" className={cx(!!ending && 'shown')}>
      <div id="endingBox">
        <h2 id="endingTitle">{content?.title}</h2>
        <div id="endingText">{content?.text}</div>
        <table id="endingStats">
          <tbody>
            {content?.stats.map(([k, v]) => <tr key={k}><td>{k}</td><td>{v}</td></tr>)}
          </tbody>
        </table>
        <p><button className="button2" id="btn-newGame" onClick={press}>{armed ? 'Start again in July 2025? Press again' : 'New game'}</button></p>
      </div>
    </div>
  );
}

export function Toast() {
  const toasts = useGameStore((st) => st.toasts);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (toasts === 0) return;
    setVisible(true);
    const timer = window.setTimeout(() => setVisible(false), 1500);
    return () => window.clearTimeout(timer);
  }, [toasts]);
  return <div id="toast" className={cx(visible && 'visible')}>saved.</div>;
}
