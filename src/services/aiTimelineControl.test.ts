import { describe, expect, it } from 'vitest';
import type { SimulationStep } from '../types/simulation';
import {
  extractTimelineAction,
  findImportantStepIndices,
  interpretTimelineRequest,
  resolveTimelineTarget,
  stripTimelineActions,
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
    expect(interpretTimelineRequest('30. hamleye sar ve anlat', steps, 0))
      .toEqual({ type: 'jump', index: 29 });
    expect(interpretTimelineRequest('go to step 999', steps, 0))
      .toEqual({ type: 'jump', index: 39 });
    expect(interpretTimelineRequest('durdur burada', steps, 12))
      .toEqual({ type: 'pause' });
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

  it('accepts only bounded model directives and removes them from chat text', () => {
    const answer = 'Moving to the match. [[CODEXRAY_ACTION:{"type":"jump","step":30}]]';
    expect(extractTimelineAction(answer, steps, 0)).toEqual({ type: 'jump', index: 29 });
    expect(stripTimelineActions(answer)).toBe('Moving to the match.');
    expect(extractTimelineAction(
      'No action. [[CODEXRAY_ACTION:{"type":"delete-code"}]]',
      steps,
      0,
    )).toBeNull();
  });
});
