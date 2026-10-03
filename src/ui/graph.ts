import type { GameState } from '../engine/state.js';
import { dateLabel } from '../engine/format.js';
import { byId } from './dom.js';

let lastKey = '';

/** Capability per released model on a log scale (Stage 2 panel; drawn only when revealed). */
export function renderGraph(s: GameState): void {
  if (!s.revealed['graph']) return;
  const models = s.training.models;
  const key = `${models.length}|${s.rivalCapability.toFixed(2)}`;
  if (key === lastKey) return;
  lastKey = key;
  const canvas = byId<HTMLCanvasElement>('graphCanvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  const pad = 22;
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = '#000';
  ctx.fillStyle = '#000';
  ctx.font = '10px "Times New Roman", serif';
  ctx.strokeRect(pad, 4, w - pad - 4, h - pad - 4);
  if (models.length === 0) return;
  const maxCap = Math.max(2, s.rivalCapability, ...models.map((m) => m.capability));
  const t0 = models[0]!.date;
  const t1 = Math.max(t0 + 1, s.date);
  const x = (t: number) => pad + ((t - t0) / (t1 - t0)) * (w - pad - 8);
  const y = (c: number) => h - pad - (Math.log(c) / Math.log(maxCap)) * (h - pad - 10);
  ctx.beginPath();
  models.forEach((m, i) => (i === 0 ? ctx.moveTo(x(m.date), y(m.capability)) : ctx.lineTo(x(m.date), y(m.capability))));
  ctx.stroke();
  for (const m of models) ctx.fillRect(x(m.date) - 2, y(m.capability) - 2, 4, 4);
  ctx.setLineDash([3, 3]);
  ctx.strokeStyle = '#888';
  ctx.beginPath();
  ctx.moveTo(pad, y(s.rivalCapability));
  ctx.lineTo(w - 4, y(s.rivalCapability));
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillText(dateLabel(t0), pad, h - 8);
  ctx.fillText(dateLabel(t1), w - 50, h - 8);
  ctx.fillText(`${maxCap.toFixed(1)}×`, 0, 12);
}
