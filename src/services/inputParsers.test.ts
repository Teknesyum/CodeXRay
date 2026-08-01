import { describe, expect, it } from 'vitest';
import {
  parseArrayInput,
  parseBinaryTree,
  parseSimulationInput,
  parseStringInput,
  validateGraphDocument,
} from './inputParsers';

describe('input parsers', () => {
  it('accepts JSON and comma-separated arrays', () => {
    expect(parseArrayInput('[8, 3, 5, 1]')).toEqual([8, 3, 5, 1]);
    expect(parseArrayInput('8, 3, 5, 1')).toEqual([8, 3, 5, 1]);
  });

  it('rejects non-numeric array items', () => {
    expect(() => parseArrayInput('[1, "x"]')).toThrow('finite number');
    expect(() => parseArrayInput('1,,2')).toThrow('empty items');
    expect(() => parseArrayInput('1, ,2')).toThrow('empty items');
  });

  it('accepts plain, quoted, and assigned string input', () => {
    expect(parseStringInput('AABA')).toBe('AABA');
    expect(parseStringInput('"AABA"')).toBe('AABA');
    expect(parseStringInput('s = "AABA"')).toBe('AABA');
  });

  it('preserves validated algorithm-specific parameters', () => {
    expect(parseSimulationInput('string', 'ABABA', undefined, {
      pattern: 'ABA',
    }).input).toEqual({
      kind: 'string',
      text: 'ABABA',
      parameters: { pattern: 'ABA' },
    });
  });

  it('imports and positions a sparse level-order tree', () => {
    const tree = parseBinaryTree('[1,2,3,null,4]');
    expect(tree.mode).toBe('tree');
    expect(tree.nodes.map((node) => node.label)).toEqual(['1', '2', '3', '4']);
    expect(tree.edges).toHaveLength(3);
    expect(tree.rootId).toBe('n0');
  });

  it('replays seeded sparse level-order trees without losing nodes or parent edges', () => {
    const seededValues = (seed: number) => {
      let state = seed >>> 0;
      const values: Array<number | null> = [seed];
      for (let index = 1; index < 63; index += 1) {
        state = (state * 1664525 + 1013904223) >>> 0;
        const parentIndex = Math.floor((index - 1) / 2);
        values.push(values[parentIndex] === null || state % 5 === 0 ? null : seed * 100 + index);
      }
      while (values.at(-1) === null) values.pop();
      return values;
    };

    for (let seed = 1; seed <= 32; seed += 1) {
      const values = seededValues(seed);
      const serialized = JSON.stringify(values);
      const first = parseBinaryTree(serialized);
      const replay = parseBinaryTree(serialized);
      const expectedIndexes = values
        .map((value, index) => value === null ? null : index)
        .filter((index): index is number => index !== null);
      const expectedEdges = expectedIndexes
        .filter((index) => index > 0)
        .map((index) => ({ from: `n${Math.floor((index - 1) / 2)}`, to: `n${index}` }));

      expect(first).toEqual(replay);
      expect(first.nodes.map((node) => node.id)).toEqual(expectedIndexes.map((index) => `n${index}`));
      expect(first.nodes.map((node) => node.label)).toEqual(
        expectedIndexes.map((index) => String(values[index])),
      );
      expect(first.edges.map(({ from, to }) => ({ from, to }))).toEqual(expectedEdges);
      expect(() => validateGraphDocument(first)).not.toThrow();
    }
  });

  it('validates references and tree parent constraints', () => {
    expect(() => validateGraphDocument({
      version: 1,
      mode: 'graph',
      directed: false,
      weighted: false,
      nodes: [{ id: 'a', label: 'A', x: 50, y: 50 }],
      edges: [{ id: 'bad', from: 'a', to: 'missing' }],
      startId: 'a',
    })).toThrow('unknown node');

    expect(() => parseBinaryTree('[1,null,2,3]')).toThrow('has no parent');
  });

  it('rejects a disconnected cycle disguised by valid parent counts', () => {
    expect(() => validateGraphDocument({
      version: 1,
      mode: 'tree',
      directed: true,
      weighted: false,
      nodes: [
        { id: 'root', label: 'Root', x: 10, y: 10 },
        { id: 'leaf', label: 'Leaf', x: 30, y: 30 },
        { id: 'cycle-a', label: 'A', x: 60, y: 30 },
        { id: 'cycle-b', label: 'B', x: 80, y: 60 },
      ],
      edges: [
        { id: 'root-leaf', from: 'root', to: 'leaf' },
        { id: 'cycle-a-b', from: 'cycle-a', to: 'cycle-b' },
        { id: 'cycle-b-a', from: 'cycle-b', to: 'cycle-a' },
      ],
      rootId: 'root',
      startId: 'root',
    })).toThrow(/reachable|cycle/i);
  });
});
