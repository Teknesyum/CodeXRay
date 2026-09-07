import { describe, expect, it } from 'vitest';
import type { SimulationStep } from '../types/simulation';
import {
  routeDeterministicCommand,
  validateActionPlan,
  structuralCheckpointIndices,
  resolveTimelineTarget,
} from './aiTimelineControl';
import { algorithmRegistry } from './codeRegistry';
import { createInputPreset, getInputKindForAlgorithm } from './inputPresets';
import { generateSimulationSteps } from './aiService';
import { simulationStepsToRawTrace } from './trace/simulationTrace';
import { buildTraceOutline } from './trace/traceOutline';

const steps: SimulationStep[] = Array.from({ length: 40 }, (_, index) => ({
  lineNumber: (index % 4) + 1,
  explanation: index === 29
    ? 'A match is found at this position.'
    : index === 39
      ? 'Simulation completed.'
      : `Compare values at step ${index + 1}.`,
  visualData: {
    type: 'variables',
    vars: {
      index,
      _traceEvent: index === 29 ? { t: 'result-write', name: 'match' } : null,
      _traceKind: index === 29 ? 'assign' : 'statement',
      _mutated: index === 29 ? ['match'] : [],
    },
  },
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
    const important = structuralCheckpointIndices(steps);
    expect(important[0]).toBe(0);
    expect(important.at(-1)).toBe(39);
    expect(important).toContain(29);
    expect(important.length).toBeLessThanOrEqual(8);
    expect(resolveTimelineTarget({ type: 'next-important' }, steps, 20))
      .toBe(important.find((index) => index > 20));
    expect(resolveTimelineTarget({ type: 'previous-important' }, steps, 20))
      .toBe([...important].reverse().find((index) => index < 20));
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
    expect(result).toEqual([{ type: 'tour', checkpoints: structuralCheckpointIndices(steps) }]);
  });
});

describe('checkpoints follow the simulator phases', () => {
  const runPreset = async (name: string) => {
    const entry = algorithmRegistry.find((preset) => preset.name === name);
    if (!entry) throw new Error(`missing preset ${name}`);
    const input = createInputPreset(getInputKindForAlgorithm(entry.name), 0, entry.name);
    return generateSimulationSteps(entry.name, entry.code, input);
  };

  it('draws checkpoints from a multi-phase outline instead of a single filled phase', async () => {
    const dfs = await runPreset('Depth First Search (DFS)');
    const outline = buildTraceOutline(simulationStepsToRawTrace(dfs));
    expect(outline.length).toBeGreaterThan(1);
    const keyIndices = new Set(outline.map((phase) => phase.keyIndex));
    const checkpoints = structuralCheckpointIndices(dfs);
    const fromOutline = checkpoints.filter((index) => keyIndices.has(index));
    expect(fromOutline.length).toBeGreaterThanOrEqual(checkpoints.length - 2);
    expect(checkpoints).not.toEqual([0, 1, 5, 9, 14, 18, 22, 23]);
  });

  it('produces identical checkpoints for repeated runs of the same preset', async () => {
    const first = await runPreset('Kosaraju\'s SCC');
    const second = await runPreset('Kosaraju\'s SCC');
    expect(structuralCheckpointIndices(second)).toEqual(structuralCheckpointIndices(first));
    expect(buildTraceOutline(simulationStepsToRawTrace(second)))
      .toEqual(buildTraceOutline(simulationStepsToRawTrace(first)));
  });
});
