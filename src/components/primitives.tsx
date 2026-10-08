import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { useGameStore } from '../store/context.js';

export const fractionPercent = (fraction: number) =>
  `${(Number.isFinite(fraction) ? Math.max(0, Math.min(1, fraction)) * 100 : 0).toFixed(1)}%`;
export function Reveal({
  flag,
  hide = false,
  children,
  ...props
}: ComponentProps<'span'> & { flag: string; hide?: boolean }) {
  const revealed = useGameStore((state) => state.game.revealed[flag] === true);
  return (
    <span
      {...props}
      data-reveal={hide ? undefined : flag}
      data-hide={hide ? flag : undefined}
      className={[props.className, hide ? (revealed ? 'hideFlag' : '') : revealed ? 'shown' : '']
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </span>
  );
}
export function Panel({
  name,
  flag = name,
  title,
  children,
  off = false,
}: {
  name: string;
  flag?: string;
  title?: string;
  children: ReactNode;
  off?: boolean;
}) {
  const shown = useGameStore((state) => state.game.revealed[flag] === true);
  return (
    <div
      id={`panel-${name}`}
      data-panel={name}
      data-reveal={flag}
      className={`panel${shown ? ' shown' : ''}${off ? ' off' : ''}`}
    >
      {title ? (
        <>
          <b>{title}</b>
          <hr />
        </>
      ) : null}
      {children}
    </div>
  );
}
export function Meter({
  id,
  fraction,
  label,
  warn = false,
}: {
  id: string;
  fraction: number;
  label: string;
  warn?: boolean;
}) {
  const width = fractionPercent(fraction);
  return (
    <span
      id={id}
      className={`meter${warn ? ' warn' : ''}`}
      role="progressbar"
      aria-label={label}
      title={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={parseFloat(width)}
    >
      <span className="meterFill" aria-hidden="true" style={{ width }} />
    </span>
  );
}
export function Progress({ id, fraction }: { id?: string; fraction: number }) {
  return (
    <div className="progress">
      <div id={id} className="progressFill" style={{ width: fractionPercent(fraction) }} />
    </div>
  );
}
export function ConfirmButton({
  prompt,
  onConfirm,
  children,
  ...props
}: ComponentProps<'button'> & { prompt: string; onConfirm: () => void }) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <button
      {...props}
      onClick={() => {
        clearTimeout(timer.current);
        if (armed) {
          setArmed(false);
          onConfirm();
        } else {
          setArmed(true);
          timer.current = setTimeout(() => setArmed(false), 4000);
        }
      }}
    >
      {armed ? prompt : children}
    </button>
  );
}
