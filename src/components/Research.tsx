import { useGame, usePerform } from '../store/context.js';
import { Panel, Reveal, Meter } from './primitives.js';
import { researchCap, humanResearchShare, researchRate } from '../engine/economy.js';
import { visibleProjects, priceTag } from '../engine/projects.js';
import { datacenterStatus } from '../data/projects.js';
import { labReason } from '../engine/training.js';
import { fmtInt } from '../engine/format.js';

export function Research() {
  const s = useGame();
  const perform = usePerform();
  const cap = researchCap(s);
  return (
    <Panel name="research" title="Research">
      Trust: <span id="trust">{s.trust >= 0 ? fmtInt(s.trust) : `0 (${fmtInt(-s.trust)} owed)`}</span>
      <br />
      Next Trust at <span id="nextTrust">{fmtInt(s.nextTrust)}</span> tasks
      <br />
      <Reveal flag="hireResearcher">
        <button
          className="button2"
          id="btn-hireResearcher"
          title="1 Trust: one more researcher, +10 research per second."
          disabled={s.trust < 1}
          onClick={() => perform('hireResearcher')}
        >
          Hire Researcher
        </button>
      </Reveal>{' '}
      <Reveal flag="expandLab">
        <button
          className="button2"
          id="btn-expandLab"
          title={`1 Trust: room for ${fmtInt(1000 * s.labMult)} more research.`}
          disabled={s.trust < 1}
          onClick={() => perform('expandLab')}
        >
          Expand Lab
        </button>
      </Reveal>{' '}
      <span className="note" id="trustCostNote">
        (costs Trust)
      </span>
      <br />
      Researchers: <span id="researchers">{fmtInt(s.researchers)}</span>
      <br />
      <Reveal flag="researchShare">
        Who does the research{' '}
        <Meter
          id="researchShareMeter"
          fraction={humanResearchShare(s)}
          label={`Humans ${Math.round(100 * humanResearchShare(s))}% · Sage ${Math.round(100 * (1 - humanResearchShare(s)))}% of ${fmtInt(researchRate(s))} research a second`}
        />{' '}
        <span className="note">
          humans <span id="humanShare">{Math.round(100 * humanResearchShare(s))}</span>% · Sage{' '}
          <span id="sageShare">{Math.round(100 * (1 - humanResearchShare(s)))}</span>%
        </span>
        <br />
      </Reveal>
      <span className="hiddenIds">
        Lab Space: <span id="labSpace">{fmtInt(s.labSpace)}</span>
        <br />
      </span>
      <br />
      Research{' '}
      <Meter
        id="researchMeter"
        fraction={s.research / cap}
        label={`${fmtInt(Math.floor(s.research))} of ${fmtInt(cap)} the lab holds`}
      />{' '}
      <span id="research">{fmtInt(Math.floor(s.research))}</span> /{' '}
      <span id="researchCap">{fmtInt(cap)}</span>
      <br />
      <Reveal flag="insight">
        Insight: <span id="insight">{s.insight >= 1 ? fmtInt(Math.floor(s.insight)) : 'none yet'}</span>{' '}
        <span id="insightNote" className="note">
          {s.research >= cap ? '(accruing)' : '(accrues at capacity)'}
        </span>
        <br />
      </Reveal>
    </Panel>
  );
}
export function Projects() {
  const s = useGame();
  const perform = usePerform();
  const projects = s.revealed['projects'] ? visibleProjects(s) : [];
  const dc = datacenterStatus(s);
  return (
    <Panel name="projects" title="Projects" off={projects.length === 0}>
      <div id="projectList">
        {projects.map((project) => (
          <button
            key={project.id}
            id={`proj-${project.id}`}
            data-project={project.id}
            className={`projectButton${project.rescue ? ' rescue' : ''}${project.pinned ? ' pinned' : ''}${project.repeatable ? ' repeatable' : ''}`}
            title={
              project.id === 'p_datacenter'
                ? `The next model needs ${fmtInt(dc.need)} GPUs; the cloud rents ${fmtInt(dc.rent)}.${dc.afterTooBig && !dc.needed ? ' The one after will not fit.' : ''}`
                : labReason(s, project.cost(s).research ?? 0)
            }
            disabled={!project.canAfford(s)}
            onClick={() => perform('buyProject', project.id)}
          >
            <b className="projectTitle">
              {project.title} {priceTag(s, project)}
            </b>
            <br />
            <span className="projectDesc">{project.description}</span>
          </button>
        ))}
      </div>
    </Panel>
  );
}
