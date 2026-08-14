import { describe, expect, it } from 'vitest';
import type { DiscussionCheckpointV1 } from '../types/titan';
import type { SimulationStep } from '../types/simulation';
import { reviewTrace } from './customSimulationCompiler';
import { createStepNarration, createTeachingPlan } from './teachingPlan';

const checkpoint = (stepIndex: number): DiscussionCheckpointV1 => ({
  stepIndex,
  category: 'mutation',
  priority: 0.5,
  reason: 'checkpoint',
  lenses: ['code', 'data', 'visual', 'reasoning', 'time'],
  autoPause: false,
});

const variableStep = (
  lineNumber: number | null,
  explanation: string,
  vars: Record<string, string | number | null | Array<string | number>>,
): SimulationStep => ({
  lineNumber,
  explanation,
  visualData: { type: 'variables', vars },
});

describe('teaching plans', () => {
  it('grounds changed and removed variables in adjacent trace snapshots', () => {
    const steps = [
      variableStep(1, 'Initialize.', { current: 'A', stale: 9 }),
      variableStep(2, 'Advance.', { current: 'B', queue: ['C'] }),
    ];
    const narration = createStepNarration(steps, checkpoint(1), 'en', 'Queue is valid.');
    expect(narration.changedVariables).toEqual({
      current: { before: 'A', after: 'B' },
      queue: { before: null, after: ['C'] },
      stale: { before: 9, after: null },
    });
    expect(narration.activeLine).toBe(2);
    expect(narration.nextMove).toBe('The simulation is complete.');
    expect(narration.lenses.reasoning).toBe('Advance.');
  });

  it('describes graph node and edge state transitions from the selected step', () => {
    const steps: SimulationStep[] = [
      {
        lineNumber: 1,
        explanation: 'Start.',
        visualData: {
          type: 'graph', directed: true, vars: {},
          nodes: [{ id: 'A', label: 'A', x: 10, y: 10, state: 'idle' }],
          edges: [{ id: 'ab', from: 'A', to: 'B', state: 'idle' }],
        },
      },
      {
        lineNumber: 2,
        explanation: 'Visit A.',
        visualData: {
          type: 'graph', directed: true, vars: { current: 'A' },
          nodes: [{ id: 'A', label: 'A', x: 10, y: 10, state: 'visited', semanticRoles: ['start'] }],
          edges: [{ id: 'ab', from: 'A', to: 'B', state: 'active', semanticRoles: ['inspect'] }],
        },
      },
    ];
    const narration = createStepNarration(steps, checkpoint(1), 'en', 'Visited is monotonic.');
    expect(narration.nodeDiffs[0]).toContain('A: idle → visited [start]');
    expect(narration.edgeDiffs[0]).toContain('A→B: idle → active [inspect]');
    expect(narration.lenses.visual).toContain('A→B');
  });

  it('grounds matrix narration in changed cells and semantic dependency roles', () => {
    const steps: SimulationStep[] = [
      {
        lineNumber: 4,
        explanation: 'Empty table.',
        visualData: {
          type: 'matrix', values: [[0, null], [null, null]], rowLabels: ['0', '1'], columnLabels: ['0', '1'],
          highlights: [{ row: 0, column: 0, role: 'base' }], fillDirection: 'row', vars: { filledCells: 1 },
        },
      },
      {
        lineNumber: 9,
        explanation: 'Use the upper and left dependencies.',
        visualData: {
          type: 'matrix', values: [[0, 0], [null, 1]], rowLabels: ['0', '1'], columnLabels: ['0', '1'],
          highlights: [
            { row: 1, column: 1, role: 'active', label: 'dp[1][1]=1' },
            { row: 0, column: 1, role: 'dependency', label: 'up=0' },
          ], fillDirection: 'row', vars: { i: 1, j: 1, filledCells: 3 },
        },
      },
    ];
    const narration = createStepNarration(steps, checkpoint(1), 'en', 'Dependencies are final.');
    expect(narration.cellDiffs).toEqual(expect.arrayContaining([
      'dp[0][1]: null → 0',
      'dp[1][1]: null → 1',
      'dp[1][1] [active] dp[1][1]=1',
      'dp[0][1] [dependency] up=0',
    ]));
    expect(narration.lenses.visual).toContain('dp[1][1]');
  });

  it('rejects a checkpoint that has no real trace step', () => {
    expect(() => createStepNarration(
      [variableStep(1, 'Only step.', {})],
      checkpoint(4),
      'en',
      'Invariant.',
    )).toThrow('has no trace step');
  });

  it('builds final path metrics and localized follow-up prompts from the final snapshot', () => {
    const steps = [
      variableStep(1, 'Start.', { path: [] }),
      variableStep(null, 'Result path.', { path: ['S', 'A', 'T'], cost: 7, visited: ['S', 'A', 'T'] }),
    ];
    const plan = createTeachingPlan(
      steps,
      [checkpoint(0), checkpoint(1)],
      { kind: 'array', text: '[1]' },
      'tr',
      ['Maliyet en kısa yoldur.'],
    );
    expect(plan.finalResult.metrics).toMatchObject({
      traceSteps: 2,
      path: ['S', 'A', 'T'],
      pathLength: 2,
      cost: 7,
    });
    expect(plan.finalResult.summary).toContain('S → A → T');
    expect(plan.followUpQuestions).toHaveLength(3);
  });

  it('keeps checkpoint selection within its hard maximum even with many result-like steps', () => {
    const steps = Array.from({ length: 30 }, (_, index) =>
      variableStep(index + 1, `Result path update ${index}.`, { index }));
    const selected = reviewTrace(steps, 6);
    expect(selected).toHaveLength(6);
    expect(selected[0].stepIndex).toBe(0);
    expect(selected.at(-1)?.stepIndex).toBe(29);
    expect(reviewTrace(steps, 0)).toEqual([]);
  });
});
