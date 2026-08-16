import { describe, expect, it } from 'vitest';
import type { GraphDocumentV1, InputKind, SimulationStep } from '../types/simulation';
import { parseSimulationInput } from './inputParsers';
import { routeTitanModeRequest } from './titanModeRouting';
import { validateProgramSpec } from './simLang';

const seeded = (initial: number) => {
  let state = initial >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x1_0000_0000;
  };
};

const alphabet = 'abcçdefgğhıijklmnoöprsştuüvyz ABCXYZ0123456789[]{}:,.-_\n\t😀\u0000';
const randomText = (next: () => number, maximum = 120) => Array.from(
  { length: Math.floor(next() * maximum) },
  () => alphabet[Math.floor(next() * alphabet.length)],
).join('');

describe('fixed-seed robustness fuzzing', () => {
  it('never throws for 800 hostile parser and bilingual router strings', () => {
    const seed = 0xC0DE_2026;
    const next = seeded(seed);
    const steps: SimulationStep[] = Array.from({ length: 12 }, (_, index) => ({
      lineNumber: index + 1,
      explanation: `Step ${index + 1}`,
      visualData: { type: 'variables', vars: { index } },
    }));
    const kinds: InputKind[] = ['array', 'string', 'tree', 'graph'];
    for (let iteration = 0; iteration < 800; iteration += 1) {
      const input = randomText(next);
      const kind = kinds[iteration % kinds.length];
      expect(() => parseSimulationInput(kind, input), `seed=${seed}; iteration=${iteration}; input=${JSON.stringify(input)}`)
        .not.toThrow();
      expect(() => routeTitanModeRequest(input, steps, iteration % steps.length), `seed=${seed}; iteration=${iteration}; input=${JSON.stringify(input)}`)
        .not.toThrow();
    }
  });

  it('rejects malformed generated-program objects without executing or crashing', () => {
    const seed = 0x51A1_2026;
    const next = seeded(seed);
    for (let iteration = 0; iteration < 400; iteration += 1) {
      const candidate: Record<string, unknown> = {
        version: next() > 0.5 ? 1 : Math.floor(next() * 9),
        id: randomText(next, 30),
        title: randomText(next, 50),
        locale: next() > 0.5 ? 'en' : randomText(next, 5),
        inputKind: ['array', 'string', 'tree', 'graph', randomText(next, 8)][Math.floor(next() * 5)],
        entry: next() > 0.5 ? [] : randomText(next, 30),
        functions: next() > 0.5 ? [] : null,
        budgets: { instructions: Math.floor(next() * 100_000), traceSteps: -1, recursionDepth: 999, collectionSize: 0 },
      };
      const validation = validateProgramSpec(candidate);
      expect(validation.valid, `seed=${seed}; iteration=${iteration}`).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    }
  });

  it('preserves graph validation atomicity across randomized dangling, duplicate, and out-of-bounds edits', () => {
    const seed = 0x6A4F_2026;
    const next = seeded(seed);
    for (let iteration = 0; iteration < 160; iteration += 1) {
      const nodeCount = 1 + Math.floor(next() * 8);
      const nodes = Array.from({ length: nodeCount }, (_, index) => ({
        id: `N${index}`,
        label: `N${index}`,
        x: Math.round((next() * 140) - 20),
        y: Math.round((next() * 140) - 20),
      }));
      const graph: GraphDocumentV1 = {
        version: 1,
        mode: 'graph',
        directed: next() > 0.5,
        weighted: next() > 0.5,
        nodes,
        edges: [{ id: 'e0', from: 'N0', to: next() > 0.5 ? `N${nodeCount - 1}` : 'MISSING' }],
        startId: next() > 0.5 ? 'N0' : 'MISSING',
      };
      const original = JSON.stringify(graph);
      expect(() => parseSimulationInput('graph', '', graph), `seed=${seed}; iteration=${iteration}`).not.toThrow();
      expect(JSON.stringify(graph), `seed=${seed}; iteration=${iteration}`).toBe(original);
    }
  });
});
