const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function dateLabel(months: number): string {
  const index = Math.floor(months) + 6;
  const year = 2025 + Math.floor(index / 12);
  return `${MONTHS[((index % 12) + 12) % 12]} ${year}`;
}

export function monthOf(year: number, month: number): number {
  return (year - 2025) * 12 + (month - 1) - 6;
}

function commas(intString: string): string {
  return intString.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

const WORDS: [number, string][] = [
  [1e33, 'decillion'],
  [1e30, 'nonillion'],
  [1e27, 'octillion'],
  [1e24, 'septillion'],
  [1e21, 'sextillion'],
  [1e18, 'quintillion'],
  [1e15, 'quadrillion'],
  [1e12, 'trillion'],
];

export function fmtInt(n: number): string {
  if (!Number.isFinite(n)) return '0';
  const v = Math.floor(n);
  const a = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (a >= 1e36) return sign + a.toExponential(2).replace('+', '');
  for (const [size, word] of WORDS) {
    if (a >= size) return `${sign}${(a / size).toFixed(2)} ${word}`;
  }
  return sign + commas(String(a));
}

export function fmtNum(n: number, decimals = 1): string {
  if (!Number.isFinite(n)) return '0';
  if (Math.abs(n) >= 1e9) return fmtInt(n);
  const fixed = n.toFixed(decimals);
  const [whole, frac] = fixed.split('.');
  const sign = whole!.startsWith('-') ? '-' : '';
  const body = commas(whole!.replace('-', ''));
  return frac ? `${sign}${body}.${frac}` : `${sign}${body}`;
}

export function fmtMoney(n: number): string {
  if (!Number.isFinite(n)) return '$ 0.00';
  const a = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (a >= 1e12) return `$ ${sign}${fmtNum(a / 1e12, 1)}T`;
  if (a >= 1e9) return `$ ${sign}${(a / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `$ ${sign}${(a / 1e6).toFixed(1)}M`;
  return `$ ${sign}${fmtNum(a, 2)}`;
}

export function fmtMoneyShort(n: number): string {
  const m = fmtMoney(n).replace('$ ', '$');
  return m.endsWith('.00') ? m.slice(0, -3) : m;
}

export function fmtDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const parts: string[] = [];
  if (h) parts.push(`${h} hour${h === 1 ? '' : 's'}`);
  if (m) parts.push(`${m} minute${m === 1 ? '' : 's'}`);
  if (sec || parts.length === 0) parts.push(`${sec} second${sec === 1 ? '' : 's'}`);
  return parts.join(' ');
}

export function fmtClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function fmtShortNum(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e15) return `${fmtInt(Math.round(n / 1e12))}T`;
  if (a >= 1e12) return `${fmtNum(n / 1e12, 1)}T`;
  if (a >= 1e9) return `${fmtNum(n / 1e9, 1)}B`;
  if (a >= 1e6) return `${fmtNum(n / 1e6, 1)}M`;
  return fmtInt(Math.round(n));
}

const SUPERSCRIPT = '⁰¹²³⁴⁵⁶⁷⁸⁹';

export function fmtBig(n: number): string {
  const a = Math.abs(n);
  if (!Number.isFinite(n)) return '0';
  if (a < 1e15) return fmtShortNum(n);
  let e = Math.floor(Math.log10(a));
  let m = n / Math.pow(10, e);
  if (Math.abs(m) >= 9.95) {
    e += 1;
    m /= 10;
  }
  return `${m.toFixed(1)} × 10${String(e).split('').map((d) => SUPERSCRIPT[Number(d)]).join('')}`;
}

export function fmtSmallPct(p: number): string {
  if (!Number.isFinite(p) || p <= 0) return '0';
  if (p >= 10) return fmtNum(p, 0);
  const decimals = Math.min(6, Math.max(1, -Math.floor(Math.log10(p)) + 1));
  return p.toFixed(decimals);
}

export function fmtTonnes(n: number): string {
  return `${fmtShortNum(n)} t`;
}
