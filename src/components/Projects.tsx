import type { GameState } from '../engine/state.js';
import { labReason } from '../engine/training.js';
import { datacenterStatus } from '../data/projects.js';
import { visibleProjects, projectById, priceTag } from '../engine/projects.js';
import { fmtInt } from '../engine/format.js';
import { useGame, perform } from '../store/gameStore.js';
import { Panel, cx } from './primitives.js';

function datacenterTip(s: GameState): string {
  const st = datacenterStatus(s);
  return `The next model needs ${fmtInt(st.need)} GPUs; the cloud rents ${fmtInt(st.rent)}.${st.afterTooBig && !st.needed ? ' The one after will not fit.' : ''}`;
}

function projectsView(s: GameState) {
  if (!s.revealed['projects']) return [];
  return visibleProjects(s).map((def) => ({
    id: def.id,
    label: `${def.title} ${priceTag(s, def)}`,
    tip: def.id === 'p_datacenter' ? datacenterTip(s) : labReason(s, def.cost(s).research ?? 0),
    disabled: !def.canAfford(s),
  }));
}

export function Projects() {
  const projects = useGame(projectsView);
  return (
    <Panel name="projects" off={projects.length === 0}>
      <b>Projects</b>
      <hr />
      <div id="projectList">
        {projects.map((p) => {
          const def = projectById(p.id);
          return (
            <button
              key={p.id}
              className={cx('projectButton', def?.rescue && 'rescue', def?.pinned && 'pinned', def?.repeatable && 'repeatable')}
              id={`proj-${p.id}`}
              data-project={p.id}
              title={p.tip}
              disabled={p.disabled}
              onClick={() => perform('buyProject', p.id)}
            >
              <b className="projectTitle">{p.label}</b>
              <br />
              <span className="projectDesc">{def?.description}</span>
            </button>
          );
        })}
      </div>
    </Panel>
  );
}
