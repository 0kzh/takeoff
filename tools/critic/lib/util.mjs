import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

export const CRITIC_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const REPO_ROOT = path.resolve(CRITIC_DIR, '../..');
export const OUT_DIR = path.join(REPO_ROOT, 'agent-tools', 'critic-out');
export const REFS_DIR = path.join(REPO_ROOT, 'agent-tools', 'refs');
export const FIXTURE_DIR = path.join(CRITIC_DIR, 'fixtures');

/** `label` → agent-tools/critic-out/label; anything with a slash is used as a path prefix. */
export function resolvePrefix(p) {
  const out = p.includes('/') ? path.resolve(p) : path.join(OUT_DIR, p);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  return out;
}

/** Minimal flag parser: positional args + --flag value / --flag (boolean). */
export function parseArgs(argv, booleans = []) {
  const pos = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const [k, inline] = a.slice(2).split('=');
      const key = k.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      if (inline !== undefined) flags[key] = inline;
      else if (booleans.includes(k) || booleans.includes(key)) flags[key] = true;
      else flags[key] = argv[++i];
    } else pos.push(a);
  }
  return { pos, flags };
}

/** 754.3 → "12:34" (whole seconds). */
export function mmss(sec) {
  if (sec == null || !Number.isFinite(sec)) return '—';
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function fmtN(n, d = 0) {
  if (n == null || !Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

export function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 1));
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function median(arr) {
  if (!arr.length) return null;
  const a = [...arr].sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

export async function loadAdapter(game) {
  const known = ['takeoff', 'paperclips', 'adr'];
  if (!known.includes(game)) throw new Error(`unknown game "${game}" (expected ${known.join(' | ')})`);
  return (await import(`../games/${game}.mjs`)).default;
}

/** Markdown table from a header row and body rows. */
export function mdTable(header, rows) {
  const esc = (v) => String(v ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
  return [`| ${header.map(esc).join(' | ')} |`, `|${header.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.map(esc).join(' | ')} |`)].join('\n');
}
