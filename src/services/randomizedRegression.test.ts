import { describe, expect, it } from 'vitest';
import type { GraphDocumentV1 } from '../types/simulation';
import { algorithmRegistry } from './codeRegistry';
import { simulateAlgorithm } from './simulators';

const createRandom = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
};

const algorithm = (name: string) => {
  const found = algorithmRegistry.find((candidate) => candidate.name === name);
  if (!found) throw new Error(`Missing algorithm fixture: ${name}`);
  return found;
};

describe('seeded unknown-input regression', () => {
  it('matches an independent sort for varied negative, duplicate, and ordered arrays', () => {
    const names = [
      'Quick Sort',
      'Merge Sort',
      'Heap Sort',
      'Bubble Sort',
      'Insertion Sort',
      'Selection Sort',
    ];
    const random = createRandom(0xC0DE_2026);
    const arrays = Array.from({ length: 24 }, (_, caseIndex) => {
      const length = 1 + Math.floor(random() * 22);
      const values = Array.from({ length }, () => Math.floor(random() * 31) - 15);
      if (caseIndex % 6 === 0) values.sort((a, b) => a - b);
      if (caseIndex % 6 === 1) values.sort((a, b) => b - a);
      return values;
    });

    for (const name of names) {
      const preset = algorithm(name);
      for (const [caseIndex, values] of arrays.entries()) {
        const expected = [...values].sort((a, b) => a - b);
        const steps = simulateAlgorithm(preset.name, preset.code, {
          kind: 'array', text: JSON.stringify(values), origin: 'user',
        });
        const final = steps.at(-1)?.visualData;
        expect(final?.type, `${name}, seed case ${caseIndex}, input ${JSON.stringify(values)}`)
          .toBe('array');
        expect(final?.type === 'array' ? final.values : [],
          `${name}, seed case ${caseIndex}, input ${JSON.stringify(values)}`)
          .toEqual(expected);
      }
    }
  });

  it('matches native substring positions for Unicode and repeated-pattern strings', () => {
    const names = [
      'Knuth-Morris-Pratt (KMP)',
      'Rabin-Karp Algorithm',
      'Boyer-Moore Algorithm',
    ];
    const random = createRandom(0x51A1_2026);
    const alphabet = ['a', 'b', 'ç', 'ğ', 'İ', 'ö'];
    for (let caseIndex = 0; caseIndex < 20; caseIndex += 1) {
      const text = Array.from({ length: 8 + Math.floor(random() * 18) }, () =>
        alphabet[Math.floor(random() * alphabet.length)]).join('');
      const patternStart = Math.floor(random() * Math.max(1, text.length - 3));
      const pattern = caseIndex % 4 === 0
        ? 'yok'
        : text.slice(patternStart, patternStart + 1 + Math.floor(random() * 3));
      const expected: number[] = [];
      for (let index = text.indexOf(pattern); index >= 0; index = text.indexOf(pattern, index + 1)) {
        expected.push(index);
      }

      for (const name of names) {
        const preset = algorithm(name);
        const final = simulateAlgorithm(preset.name, preset.code, {
          kind: 'string',
          text,
          parameters: { pattern, modulus: '1009' },
          origin: 'user',
        }).at(-1)?.visualData.vars;
        expect(final?.matches, `${name}, case ${caseIndex}, text=${text}, pattern=${pattern}`)
          .toEqual(expected);
      }
    }
  });

  it('matches an independent shortest-path result on generated connected graphs', () => {
    const preset = algorithm("Dijkstra's Shortest Path");
    const random = createRandom(0xD1A5_2026);
    for (let caseIndex = 0; caseIndex < 12; caseIndex += 1) {
      const ids = Array.from({ length: 7 }, (_, index) => `v${index}`);
      const edges: GraphDocumentV1['edges'] = ids.slice(1).map((id, index) => ({
        id: `chain-${index}`,
        from: ids[index],
        to: id,
        weight: 1 + Math.floor(random() * 9),
      }));
      for (let from = 0; from < ids.length; from += 1) {
        for (let to = from + 2; to < ids.length; to += 1) {
          if (random() < 0.28) edges.push({
            id: `extra-${from}-${to}`,
            from: ids[from],
            to: ids[to],
            weight: 1 + Math.floor(random() * 9),
          });
        }
      }
      const graph: GraphDocumentV1 = {
        version: 1,
        mode: 'graph',
        directed: false,
        weighted: true,
        nodes: ids.map((id, index) => ({ id, label: id, x: 8 + index * 14, y: 50 })),
        edges,
        startId: ids[0],
        targetId: ids.at(-1),
      };

      const expected = Object.fromEntries(ids.map((id) => [id, Number.POSITIVE_INFINITY]));
      expected[ids[0]] = 0;
      const visited = new Set<string>();
      while (visited.size < ids.length) {
        const current = ids
          .filter((id) => !visited.has(id))
          .sort((left, right) => expected[left] - expected[right])[0];
        visited.add(current);
        for (const edge of edges) {
          const neighbor = edge.from === current ? edge.to : edge.to === current ? edge.from : null;
          if (neighbor) expected[neighbor] = Math.min(
            expected[neighbor], expected[current] + (edge.weight ?? 1),
          );
        }
      }

      const final = simulateAlgorithm(preset.name, preset.code, {
        kind: 'graph', text: '', graph, origin: 'user',
      }).at(-1)?.visualData.vars;
      expect((final?.distances as Record<string, number> | undefined)?.[ids.at(-1)!],
        `graph seed case ${caseIndex}: ${JSON.stringify(edges)}`)
        .toBe(expected[ids.at(-1)!]);
    }
  });
});
