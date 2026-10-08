import { useEffect, useRef, useState } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';
import { useGame } from '../store/gameStore.js';

export function cx(...parts: (string | false | null | undefined)[]): string | undefined {
  return parts.filter(Boolean).join(' ') || undefined;
}

export function fill(fraction: number): number {
  const f = Number.isFinite(fraction) ? Math.max(0, Math.min(1, fraction)) : 0;
  return Number((f * 100).toFixed(1));
}

export const width = (percent: number) => ({ width: `${percent.toFixed(1)}%` });

interface FlagProps extends HTMLAttributes<HTMLElement> {
  flag: string;
  as?: 'span' | 'div';
}

export function Reveal({ flag, as: Tag = 'span', className, ...rest }: FlagProps) {
  const shown = useGame((s) => s.revealed[flag] === true);
  return <Tag data-reveal={flag} className={cx(className, shown && 'shown')} {...rest} />;
}

export function Hide({ flag, as: Tag = 'span', className, ...rest }: FlagProps) {
  const hidden = useGame((s) => s.revealed[flag] === true);
  return <Tag data-hide={flag} className={cx(className, hidden && 'hideFlag')} {...rest} />;
}

interface PanelProps {
  name: string;
  flag?: string;
  off?: boolean;
  children?: ReactNode;
}

export function Panel({ name, flag = name, off, children }: PanelProps) {
  return (
    <Reveal as="div" flag={flag} id={`panel-${name}`} className={cx('panel', off && 'off')} data-panel={name}>
      {children}
    </Reveal>
  );
}

interface MeterProps {
  id: string;
  percent: number;
  label: string;
  warn?: boolean;
}

export function Meter({ id, percent, label, warn }: MeterProps) {
  return (
    <span
      className={cx('meter', warn && 'warn')}
      id={id}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-label={label || undefined}
      title={label || undefined}
    >
      <span className="meterFill" aria-hidden="true" style={width(percent)} />
    </span>
  );
}

export function useConfirm(action: () => void, windowMs = 4000): [boolean, () => void] {
  const [armed, setArmed] = useState(false);
  const live = useRef(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const arm = (on: boolean) => {
    live.current = on;
    setArmed(on);
  };
  const press = () => {
    window.clearTimeout(timer.current);
    if (!live.current) {
      arm(true);
      timer.current = window.setTimeout(() => arm(false), windowMs);
      return;
    }
    arm(false);
    action();
  };
  return [armed, press];
}
