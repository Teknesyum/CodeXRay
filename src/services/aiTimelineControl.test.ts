import { describe, expect, it } from 'vitest';
import type { SimulationStep } from '../types/simulation';
import {
  routeDeterministicCommand,
  validateActionPlan,
  findImportantStepIndices,
  resolveTimelineTarget,
} from './aiTimelineControl';

const steps: SimulationStep[] = Array.from({ length: 40 }, (_, index) => ({
  lineNumber: (index % 4) + 1,
  explanation: index === 29
    ? 'A match is found at this position.'
    : index === 39
      ? 'Simulation completed.'
      : `Compare values at step ${index + 1}.`,
  visualData: { type: 'variables', vars: { index } },
}));

describe('AI timeline control', () => {
  it('understands bounded Turkish and English navigation requests', () => {
    expect(routeDeterministicCommand('30. hamleye sar ve anlat', steps, 0)).toEqual([{ type: 'jump', index: 29 }]);
    expect(routeDeterministicCommand('go to step 999', steps, 0)).toEqual([{ type: 'jump', index: 39 }]);
    expect(routeDeterministicCommand('durdur burada', steps, 12)).toEqual([{ type: 'pause' }]);
  });

  it('routes explicit preset commands by canonical ID without routing questions', () => {
    expect(routeDeterministicCommand('DFS sayfasını aç', [], 0)).toEqual([
      { type: 'load-preset', presetId: 'depth-first-search-dfs' },
    ]);
    expect(routeDeterministicCommand('bana DFS kodunu gösterir misin?', [], 0)).toEqual([
      { type: 'load-preset', presetId: 'depth-first-search-dfs' },
    ]);
    expect(routeDeterministicCommand('open Dijkstra', [], 0)).toEqual([
      { type: 'load-preset', presetId: 'dijkstra-s-shortest-path' },
    ]);
    expect(routeDeterministicCommand('DFS nedir?', steps, 0)).toBeNull();
    expect(routeDeterministicCommand('Can you show me how DFS works?', steps, 0)).toBeNull();
    expect(routeDeterministicCommand('DFS ve BFS sayfasını aç', steps, 0)).toBeNull();
  });

  it('builds a short chronological guided tour containing key events', () => {
    const important = findImportantStepIndices(steps);
    expect(important[0]).toBe(0);
    expect(important.at(-1)).toBe(39);
    expect(important).toContain(29);
    expect(important.length).toBeLessThanOrEqual(8);
    expect(resolveTimelineTarget({ type: 'next-important' }, steps, 20))
      .toBe(important.find((index) => index > 20));
  });

  it('accepts only bounded model directives via JSON plan', () => {
    const plan = { actions: [{ type: 'jump', step: 30 }] };
    expect(validateActionPlan(plan, steps)).toEqual([{ type: 'jump', index: 29 }]);
    expect(validateActionPlan({ actions: [{ type: 'delete-code' }] }, steps)).toBeNull();
  });

  it('rejects malformed plans as a whole instead of repairing or truncating them', () => {
    expect(validateActionPlan({ actions: [
      { type: 'play' },
      { type: 'set_code', code: 'malicious' },
    ] }, steps)).toBeNull();
    expect(validateActionPlan({ actions: [
      { type: 'play' }, { type: 'pause' }, { type: 'next' }, { type: 'previous' },
    ] }, steps)).toBeNull();
    expect(validateActionPlan({ actions: [{ type: 'play', extra: true }] }, steps)).toBeNull();
    expect(validateActionPlan({ actions: [{ type: 'jump', step: 999 }] }, steps)).toBeNull();
    expect(validateActionPlan({ actions: [] }, steps)).toEqual([]);
  });

  it('calculates bounded tour checkpoints during validation', () => {
    const result = validateActionPlan({ actions: [{ type: 'tour' }] }, steps);
    expect(result).toEqual([{ type: 'tour', checkpoints: findImportantStepIndices(steps) }]);
  });
});
