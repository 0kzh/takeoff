import { describe, expect, it } from 'vitest';
import { newGame } from '../src/engine/state.js';
import { PROJECTS } from '../src/data/projects.js';
import { STAGE2_PROJECTS } from '../src/data/projects-stage2.js';

describe('project copy formatting', () => {
  it.each([...PROJECTS, ...STAGE2_PROJECTS])('$id keeps descriptions and effects separate', (project) => {
    const s = newGame(1);
    const description = typeof project.description === 'function' ? project.description(s) : project.description;
    const effects = typeof project.effects === 'function' ? project.effects(s) : project.effects;

    expect(description).not.toContain('(');
    if (effects !== undefined) {
      expect(effects).toBeTruthy();
      expect(effects).not.toContain('(');
      expect(effects).not.toContain(')');
      expect(effects).not.toMatch(/\.$/);
    }
  });
});
