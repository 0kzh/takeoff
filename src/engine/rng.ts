export interface Seeded {
  rngSeed: number;
}

/** mulberry32 over the seed stored in state, so saves and the sim are reproducible. */
export function rng(s: Seeded): number {
  s.rngSeed = (s.rngSeed + 0x6d2b79f5) | 0;
  let t = s.rngSeed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function rand(s: Seeded, min: number, max: number): number {
  return min + (max - min) * rng(s);
}

export function randInt(s: Seeded, min: number, max: number): number {
  return Math.floor(rand(s, min, max + 1));
}

export function chance(s: Seeded, p: number): boolean {
  return rng(s) < p;
}

export function pick<T>(s: Seeded, items: readonly T[]): T {
  return items[Math.floor(rng(s) * items.length)] as T;
}

export function poisson(s: Seeded, lambda: number): number {
  if (lambda <= 0) return 0;
  const limit = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rng(s);
  } while (p > limit && k < 100);
  return k - 1;
}

export function seedFrom(value: number): number {
  return (Math.floor(value) ^ 0x9e3779b9) | 0;
}
