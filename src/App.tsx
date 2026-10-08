import { useEffect, useState } from 'react';
import { useGameStore, useGameStoreApi, usePerform } from './store/context.js';
import { Panel } from './components/primitives.js';
import { Business } from './components/Business.js';
import { Infrastructure } from './components/Infrastructure.js';
import { Research, Projects } from './components/Research.js';
import { Training } from './components/Training.js';
import { Console, Developments, ChoiceDialog, Ending } from './components/Narrative.js';
import { DevPanel } from './components/DevPanel.js';
import { Race } from './components/Race.js';
import { AlignmentStrip } from './components/AlignmentStrip.js';
import { Public, Government } from './components/World.js';
import { TICK_MS } from './engine/tick.js';
import { fmtInt, fmtNum, dayLabel } from './engine/format.js';
import { startPersistence } from './ui/save.js';
import { installDebugApi } from './ui/debug.js';

function Header() {
  const tasks = useGameStore((state) => fmtInt(state.game.tasks));
  const date = useGameStore((state) => dayLabel(state.game.date));
  const shown = useGameStore((state) => state.game.revealed['log']);
  return (
    <div id="topDiv">
      <h2 id="tasksHeader">
        Tasks Completed: <span id="tasks">{tasks}</span>
      </h2>
      <div id="headerRight">
        <span id="gameDate" data-reveal="log" className={shown ? 'shown' : ''}>
          {date}
        </span>
      </div>
    </div>
  );
}
function LaterPanels({ column }: { column: 'left' | 'middle' | 'right' }) {
  const s = useGameStore((state) => state.game);
  if (column === 'left')
    return (
      <>
        <Public />
        <Government />
        <Panel name="robots" title="Robots">
          Robots deployed: 0
        </Panel>
        <Panel name="society" title="Society">
          Approval: <span id="societyApproval">{fmtInt(s.approval)}</span>
          <br />
          Jobs displaced: 0
        </Panel>
      </>
    );
  if (column === 'middle')
    return (
      <>
        <Panel name="oversight" title="Oversight">
          Committee decision:{' '}
          <span id="oversightStatus">
            {typeof s.flags['committeeChoice'] === 'string' ? s.flags['committeeChoice'] : 'not convened'}
          </span>
        </Panel>
        <Panel name="treaty" title="Treaty">
          Status: <span id="treatyStatus">{s.flags['treatySigned'] ? 'signed' : 'not negotiating'}</span>
        </Panel>
      </>
    );
  return (
    <>
      <Race />
      <Panel name="geopolitics" title="Geopolitics">
        Baiwen capability: <span id="baiwenCapability">{fmtNum(s.baiwen.capability, 2)}</span>×
      </Panel>
      <Panel name="monitors" title="Monitors">
        Monitor coverage: 0%
      </Panel>
      <Panel name="space" title="Space">
        Launch capacity: 0<br />
        Orbital compute: 0
      </Panel>
    </>
  );
}
export function App({ seed }: { seed: number }) {
  const store = useGameStoreApi();
  const perform = usePerform();
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    let lastToast = -Infinity;
    let toastTimer: ReturnType<typeof setTimeout> | undefined;
    const persistence = startPersistence(store, () => {
      if (performance.now() - lastToast < 30000) return;
      lastToast = performance.now();
      setSaved(true);
      toastTimer = setTimeout(() => setSaved(false), 1500);
    });
    const removeDebug = installDebugApi(store, persistence, seed);
    let active = true;
    let last = performance.now();
    let frameId: number;
    let accumulated = 0;
    const frame = (now: number) => {
      if (!active) return;
      const dt = Math.min(250, Math.max(0, now - last));
      last = now;
      accumulated += dt * store.getState().speed;
      if (accumulated >= TICK_MS) {
        store.getState().advance(accumulated);
        accumulated = 0;
      }
      frameId = requestAnimationFrame(frame);
    };
    frameId = requestAnimationFrame(frame);
    document.body.classList.remove('boot');
    return () => {
      active = false;
      cancelAnimationFrame(frameId);
      clearTimeout(toastTimer);
      persistence.dispose();
      removeDebug();
    };
  }, [store, seed]);
  return (
    <>
      <Console />
      <AlignmentStrip />
      <Header />
      <div id="columns">
        <div id="logColumn" className="column">
          <Developments />
        </div>
        <div id="leftColumn" className="column">
          <Panel name="task">
            <button
              className="button2"
              id="btn-task"
              title="Complete one task by hand. Never needs power."
              onClick={() => perform('clickTask')}
            >
              Complete Task
            </button>
          </Panel>
          <Business />
          <Infrastructure />
          <LaterPanels column="left" />
        </div>
        <div id="middleColumn" className="column">
          <Research />
          <Projects />
          <LaterPanels column="middle" />
        </div>
        <div id="rightColumn" className="column">
          <Training />
          <LaterPanels column="right" />
        </div>
      </div>
      <ChoiceDialog />
      <Ending />
      <div id="toast" className={saved ? 'visible' : ''} role="status">
        saved.
      </div>
      <DevPanel seed={seed} />
    </>
  );
}
