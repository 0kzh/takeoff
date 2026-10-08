import { useEffect } from 'react';
import { fmtInt, dateLabel } from '../engine/format.js';
import { useGame, useGameStore, perform } from '../store/gameStore.js';
import { Panel, Reveal } from './primitives.js';
import { Console } from './Console.js';
import { Log } from './Log.js';
import { Business } from './Business.js';
import { Infrastructure } from './Infrastructure.js';
import { Research } from './Research.js';
import { Projects } from './Projects.js';
import { Training } from './Training.js';
import { LeftLaterPanels, MiddleLaterPanels, RightLaterPanels } from './LaterPanels.js';
import { Modal } from './Modal.js';
import { Ending, Toast } from './Overlays.js';
import { DevPanel } from './DevPanel.js';

const MAX_FRAME_MS = 250;

function useGameLoop(): void {
  useEffect(() => {
    let last = performance.now();
    let id = requestAnimationFrame(function frame(now) {
      const dt = Math.min(MAX_FRAME_MS, Math.max(0, now - last));
      last = now;
      const { advance, touch, speed } = useGameStore.getState();
      advance(dt * speed);
      touch();
      id = requestAnimationFrame(frame);
    });
    return () => cancelAnimationFrame(id);
  }, []);
}

function useBootClass(): void {
  useEffect(() => {
    let id = requestAnimationFrame(() => {
      id = requestAnimationFrame(() => document.body.classList.remove('boot'));
    });
    return () => cancelAnimationFrame(id);
  }, []);
}

function TopBar() {
  const tasks = useGame((s) => fmtInt(s.tasks));
  const date = useGame((s) => dateLabel(s.date));
  return (
    <div id="topDiv">
      <h2 id="tasksHeader">Tasks Completed: <span id="tasks">{tasks}</span></h2>
      <Reveal as="div" flag="log" id="gameDate">{date}</Reveal>
    </div>
  );
}

export function App() {
  useGameLoop();
  useBootClass();
  return (
    <>
      <Console />
      <TopBar />
      <div id="columns">
        <div id="logColumn" className="column">
          <Log />
        </div>
        <div id="leftColumn" className="column">
          <Panel name="task">
            <button className="button2" id="btn-task" title="Complete one task by hand. Never needs power." onClick={() => perform('clickTask')}>Complete Task</button>
          </Panel>
          <Business />
          <Infrastructure />
          <LeftLaterPanels />
        </div>
        <div id="middleColumn" className="column">
          <Research />
          <Projects />
          <MiddleLaterPanels />
        </div>
        <div id="rightColumn" className="column">
          <Training />
          <RightLaterPanels />
        </div>
      </div>
      <Modal />
      <Ending />
      <Toast />
      <DevPanel />
    </>
  );
}
