import { useGame } from '../store/context.js';
import { fmtNum } from '../engine/format.js';
import { alignmentZone, interpretabilityPercent } from '../engine/alignment.js';

// A full-width strip under the console: the estimate and its band. The true
// value is never shown; the band is how little the player knows.
export function AlignmentStrip() {
  const s = useGame();
  const shown = s.revealed['alignment'] === true;
  const estimate = s.alignmentApparent;
  const band = s.alignmentBand;
  const lo = Math.max(0, estimate - band);
  const hi = Math.min(100, estimate + band);
  const zone = alignmentZone(estimate);
  return (
    <div id="alignmentStrip" data-panel="alignment" data-reveal="alignment" className={shown ? 'shown' : ''}>
      <span className="stripLabel">Alignment</span>
      <span
        className="stripTrack"
        role="img"
        aria-label={`Alignment estimate ${fmtNum(estimate, 0)} plus or minus ${fmtNum(band, 0)}`}
      >
        <span className="stripZone low" style={{ left: '0%', width: '50%' }} />
        <span className="stripZone mid" style={{ left: '50%', width: '30%' }} />
        <span className="stripZone high" style={{ left: '80%', width: '20%' }} />
        <span className="stripBand" style={{ left: `${lo}%`, width: `${Math.max(0, hi - lo)}%` }} />
        <span className="stripMarker" style={{ left: `${Math.min(100, Math.max(0, estimate))}%` }} />
      </span>
      <span className={`stripValue ${zone}`} id="alignmentValue">
        {fmtNum(estimate, 0)} ± {fmtNum(band, 0)}
      </span>
      <span className="note stripNote" id="alignmentNote">
        {s.revealed['interpretability']
          ? `interpretability ${interpretabilityPercent(s)}%${s.mind.narrowed > 0 ? ` · mind -${fmtNum(s.mind.narrowed, 0)}` : ''}`
          : band >= 20
            ? 'the band is how little we know'
            : 'narrowing'}
      </span>
    </div>
  );
}
