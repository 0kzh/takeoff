import { useEffect, useState } from 'react';
import { mindNode } from '../data/mind.js';
import { fmtInt, fmtNum } from '../engine/format.js';
import { missLine, type MindDecodeSkin } from '../engine/mind.js';
import type { MindPuzzle } from '../engine/state.js';

const HELP: Record<MindDecodeSkin, string> = {
  tiles: 'The same new fragment was added to every trace. It is not in the before-trace.',
  tape: 'One token was added to every trace. It is not in the line labeled Before.',
  stack: 'Click a fragment to test it against the traces. Click it again to cut it in.',
};

export function MindDecode({
  skin,
  puzzle,
  band,
  estimate,
  onGuess,
  onClose,
}: {
  skin: MindDecodeSkin;
  puzzle: MindPuzzle;
  band: number;
  estimate: number;
  onGuess: (id: string) => void;
  onClose: () => void;
}) {
  const node = mindNode(puzzle.nodeId);
  const [armed, setArmed] = useState<string | null>(null);
  useEffect(() => {
    setArmed(null);
  }, [puzzle.nodeId, puzzle.struck.length, puzzle.solved]);
  const lastMiss = puzzle.struck[puzzle.struck.length - 1];
  return (
    <>
      <div id="mindDecodeShade" onClick={onClose} />
      <div
        id="mindDecode"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mindDecodeTitle"
        data-skin={skin}
        tabIndex={-1}
      >
        <div id="mindDecodeTitle">{puzzle.solved ? node?.title : 'Find the new fragment'}</div>
        {puzzle.solved && node ? (
          <div className="mindInsight">
            <p>{node.insight}</p>
            <p className="note">
              Feature {fmtInt(node.feature)}. The band is now {fmtNum(estimate, 0)} ± {fmtNum(band, 0)}.
              {node.bias ? ' The estimate got a little more honest.' : ''}
            </p>
            <button type="button" className="button2" id="mind-close-decode" onClick={onClose}>
              Back to the map
            </button>
          </div>
        ) : (
          <>
            <p className="mindHelp">{HELP[skin]}</p>
            <p className="note mindWhich">{node ? `${node.title} is lit.` : ''}</p>
            {skin === 'stack' ? (
              <Stack puzzle={puzzle} armed={armed} onArm={setArmed} onGuess={onGuess} />
            ) : (
              <Rows puzzle={puzzle} skin={skin} onGuess={onGuess} />
            )}
            {lastMiss ? <p className="mindMiss">{missLine(puzzle, lastMiss)}</p> : null}
            <button type="button" className="modalButton" id="mind-close-decode" onClick={onClose}>
              Leave it crossed
            </button>
          </>
        )}
      </div>
    </>
  );
}

function Rows({
  puzzle,
  skin,
  onGuess,
}: {
  puzzle: MindPuzzle;
  skin: MindDecodeSkin;
  onGuess: (id: string) => void;
}) {
  return (
    <div className="mindSamples">
      <Sample label="Before" ids={puzzle.baseline} puzzle={puzzle} skin={skin} onGuess={onGuess} baseline />
      {puzzle.rows.map((row, index) => (
        <Sample
          key={index}
          label={`Trace ${index + 1}`}
          ids={row}
          puzzle={puzzle}
          skin={skin}
          onGuess={onGuess}
        />
      ))}
    </div>
  );
}

function Sample({
  label,
  ids,
  puzzle,
  skin,
  onGuess,
  baseline = false,
}: {
  label: string;
  ids: string[];
  puzzle: MindPuzzle;
  skin: MindDecodeSkin;
  onGuess: (id: string) => void;
  baseline?: boolean;
}) {
  return (
    <div className={`mindSample${baseline ? ' before' : ''}`}>
      <span className="mindSampleLabel">{label}</span>
      <span className="mindSampleRow">
        {ids.map((id, index) => (
          <ChunkButton key={`${id}-${index}`} puzzle={puzzle} id={id} skin={skin} onGuess={onGuess} />
        ))}
      </span>
    </div>
  );
}

function ChunkButton({
  puzzle,
  id,
  skin,
  onGuess,
}: {
  puzzle: MindPuzzle;
  id: string;
  skin: MindDecodeSkin;
  onGuess: (id: string) => void;
}) {
  const chunk = puzzle.chunks.find((item) => item.id === id);
  if (!chunk) return null;
  const struck = puzzle.struck.includes(id);
  const solved = puzzle.solved && id === puzzle.answer;
  return (
    <button
      type="button"
      className={`mindChunk${struck ? ' struck' : ''}${solved ? ' solved' : ''}`}
      aria-label={`fragment ${chunk.token}`}
      disabled={struck || puzzle.solved}
      onClick={() => onGuess(id)}
    >
      {skin === 'tape' ? <span className="mindToken">{chunk.token}</span> : <Glyph bits={chunk.bits} />}
    </button>
  );
}

function Glyph({ bits }: { bits: number[] }) {
  return (
    <span className="mindGlyph" aria-hidden="true">
      {bits.map((on, index) => (
        <i key={index} className={on ? 'on' : ''} />
      ))}
    </span>
  );
}

function Stack({
  puzzle,
  armed,
  onArm,
  onGuess,
}: {
  puzzle: MindPuzzle;
  armed: string | null;
  onArm: (id: string | null) => void;
  onGuess: (id: string) => void;
}) {
  const note = armed ? coverage(puzzle, armed) : 'Pick a fragment. The traces will show where it landed.';
  return (
    <div className="mindStack">
      <div className="mindSamples">
        <StackRow label="Before" ids={puzzle.baseline} armed={armed} />
        {puzzle.rows.map((row, index) => (
          <StackRow key={index} label={`Trace ${index + 1}`} ids={row} armed={armed} />
        ))}
      </div>
      <div className="mindPalette" role="group" aria-label="Fragments">
        {puzzle.chunks.map((chunk) => {
          const struck = puzzle.struck.includes(chunk.id);
          return (
            <button
              key={chunk.id}
              type="button"
              className={`mindChunk${struck ? ' struck' : ''}${armed === chunk.id ? ' armed' : ''}`}
              aria-label={`fragment ${chunk.token}`}
              disabled={struck}
              onClick={() => {
                if (armed === chunk.id) onGuess(chunk.id);
                else onArm(chunk.id);
              }}
            >
              <Glyph bits={chunk.bits} />
              <span className="mindToken">{chunk.token}</span>
            </button>
          );
        })}
      </div>
      <p className="mindMiss">{note}</p>
    </div>
  );
}

function StackRow({ label, ids, armed }: { label: string; ids: string[]; armed: string | null }) {
  const hit = armed !== null && ids.includes(armed);
  return (
    <div className={`mindSample${hit ? ' hit' : ''}${label === 'Before' ? ' before' : ''}`}>
      <span className="mindSampleLabel">{label}</span>
      <span className="mindSampleRow">
        {ids.map((id, index) => (
          <span
            key={`${id}-${index}`}
            className={`mindBlip${armed === id ? ' hot' : ''}`}
            aria-hidden="true"
          />
        ))}
      </span>
    </div>
  );
}

function coverage(puzzle: MindPuzzle, id: string): string {
  if (puzzle.baseline.includes(id))
    return 'Already in the before-trace. Click again if you want to rule it out.';
  const hits = puzzle.rows.filter((row) => row.includes(id)).length;
  if (hits === puzzle.rows.length) return `In all ${hits} traces. Click again to cut it in.`;
  const missing = puzzle.rows.findIndex((row) => !row.includes(id));
  return `In ${hits} of ${puzzle.rows.length} traces. Missing from trace ${missing + 1}. Click again to rule it out.`;
}
