import { describe, expect, it } from 'vitest';
import type { GraphDocumentV1, GraphVisualData, RowsVisualData, SimulationInput } from '../types/simulation';
import { translateRuntimeText } from '../i18n/translations';
import { algorithmRegistry } from './codeRegistry';
import { simulateAlgorithm } from './simulators';

const run = (name: string, input: SimulationInput) => {
  const definition = algorithmRegistry.find((entry) => entry.name === name);
  if (!definition) throw new Error(`Missing ${name}`);
  return simulateAlgorithm(name, definition.code, input);
};
const assertPhases = (steps: ReturnType<typeof run>) => steps.forEach((step) => {
  const phase = step.visualData.vars.phase;
  if (typeof phase === 'string') expect(translateRuntimeText(phase, 'tr')).not.toBe(phase);
});
const tree: GraphDocumentV1 = {
  version: 1, mode: 'tree', directed: true, weighted: false,
  nodes: ['A', 'B', 'C', 'D', 'E'].map((id, index) => ({ id, label: id, x: 10 + index * 18, y: index < 1 ? 10 : index < 3 ? 45 : 80 })),
  edges: [
    { id: 'ab', from: 'A', to: 'B' }, { id: 'ac', from: 'A', to: 'C' },
    { id: 'bd', from: 'B', to: 'D' }, { id: 'be', from: 'B', to: 'E' },
  ], rootId: 'A', startId: 'D', targetId: 'E',
};

describe('batch 12 pedagogical number/list/tree simulations', () => {
  it('LCA visibly builds parents and climbs both ancestor paths', () => {
    const steps = run('Lowest Common Ancestor (LCA)', { kind: 'tree', text: '', graph: tree, origin: 'user' });
    assertPhases(steps);
    expect(steps.some((step) => step.visualData.vars.phase === 'LCA · mark first ancestor path')).toBe(true);
    expect(steps.some((step) => step.visualData.vars.phase === 'LCA · climb second ancestor path')).toBe(true);
    expect(steps.at(-1)!.visualData.vars.lca).toBe('B');
  });

  it('Sieve renders every integer through 50 and crosses composites one at a time', () => {
    const steps = run('Sieve of Eratosthenes', { kind: 'array', text: '[50]', origin: 'user' });
    assertPhases(steps);
    const cross = steps.find((step) => step.visualData.vars.phase === 'Sieve · cross out composite');
    expect(cross?.visualData.type).toBe('graph');
    expect((cross!.visualData as GraphVisualData).nodes).toHaveLength(49);
    const final = steps.at(-1)!.visualData as GraphVisualData;
    expect(final.nodes.find((node) => node.id === '49')?.state).toBe('removed');
    expect(final.nodes.find((node) => node.id === '47')?.state).toBe('visited');
  });

  it('Modular exponentiation shows each exponent bit and accumulator decision', () => {
    const steps = run('Fast Exponentiation (Modular)', { kind: 'array', text: '3,13,7', origin: 'user' });
    assertPhases(steps);
    const consume = steps.find((step) => step.visualData.vars.phase === 'Modular Power · consume exponent bit');
    expect(consume?.visualData.type).toBe('rows');
    expect((consume!.visualData as RowsVisualData).rows).toHaveLength(3);
    expect(steps.at(-1)!.visualData.vars.result).toBe('3');
  });

  it('Reverse Linked List flips actual directed next edges while preserving node identity', () => {
    const steps = run('Reverse Linked List', { kind: 'array', text: '10,20,30,40', origin: 'user' });
    assertPhases(steps);
    const reverse = steps.find((step) => step.visualData.vars.phase === 'Reverse List · reverse current arrow' && step.visualData.vars.current === 2);
    expect(reverse?.visualData.type).toBe('graph');
    expect((reverse!.visualData as GraphVisualData).edges.some((edge) => edge.from === '2' && edge.to === '1')).toBe(true);
    expect(steps.at(-1)!.visualData.vars.previous).toBe(3);
  });

  it('Floyd cycle detection animates one-hop/two-hop movement, meeting, and entry search', () => {
    const steps = run('Detect Cycle in Linked List', { kind: 'array', text: '3,2,0,-4', parameters: { cycleEntry: '1' }, origin: 'user' });
    assertPhases(steps);
    expect(steps.some((step) => step.visualData.vars.phase === 'Cycle Detection · pointers meet')).toBe(true);
    expect(steps.some((step) => step.visualData.vars.phase === 'Cycle Detection · locate cycle entry')).toBe(true);
    expect(steps.at(-1)!.visualData.vars).toMatchObject({ hasCycle: true, cycleEntry: 1 });
  });
});
