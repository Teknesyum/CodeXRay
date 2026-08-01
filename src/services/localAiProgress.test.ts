import { describe, expect, it } from 'vitest';
import { normalizeLocalAiProgress } from './localAiProgress';

describe('local AI lifecycle progress normalization', () => {
  it('maps parameter fetching and model loading into one monotonic lifecycle', () => {
    const fetched = normalizeLocalAiProgress({
      progress: 1,
      text: 'Fetching param cache[8/8]: 100% completed',
    }, 0);
    const loaded = normalizeLocalAiProgress({
      progress: 0.6,
      text: 'Loading model from cache[4/8]: 60% completed',
    }, fetched);

    expect(fetched).toBe(70);
    expect(loaded).toBe(87);
  });

  it('never regresses and reserves 100 percent for the ready event', () => {
    expect(normalizeLocalAiProgress({ progress: 0.5, text: 'Compiling shaders' }, 90)).toBe(90);
    expect(normalizeLocalAiProgress({ progress: 1, text: 'Finalizing model' }, 0)).toBe(99);
  });
});
