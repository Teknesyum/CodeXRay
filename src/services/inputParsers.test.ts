import { describe, expect, it } from 'vitest';
import {
  parseArrayInput,
  parseBinaryTree,
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
  });

  it('accepts plain, quoted, and assigned string input', () => {
    expect(parseStringInput('AABA')).toBe('AABA');
    expect(parseStringInput('"AABA"')).toBe('AABA');
    expect(parseStringInput('s = "AABA"')).toBe('AABA');
  });

  it('imports and positions a sparse level-order tree', () => {
    const tree = parseBinaryTree('[1,2,3,null,4]');
    expect(tree.mode).toBe('tree');
    expect(tree.nodes.map((node) => node.label)).toEqual(['1', '2', '3', '4']);
    expect(tree.edges).toHaveLength(3);
    expect(tree.rootId).toBe('n0');
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
});
