import { describe, expect, it } from 'vitest';
import { algorithmRegistry } from './codeRegistry';
import { parseBinaryTree } from './inputParsers';
import { simulateAlgorithm } from './simulators';

const traversalOracle = (
  values: Array<number | null>,
  order: 'inorder' | 'preorder' | 'postorder',
) => {
  const result: string[] = [];
  const visit = (index: number) => {
    if (index >= values.length || values[index] === null) return;
    if (order === 'preorder') result.push(`n${index}`);
    visit(index * 2 + 1);
    if (order === 'inorder') result.push(`n${index}`);
    visit(index * 2 + 2);
    if (order === 'postorder') result.push(`n${index}`);
  };
  visit(0);
  return result;
};

describe('seeded sparse tree traversal regression', () => {
  it('matches independent inorder, preorder, and postorder oracles without mutating input', () => {
    let state = 0x7EED_2026;
    for (let caseIndex = 0; caseIndex < 40; caseIndex += 1) {
      const values: Array<number | null> = [caseIndex];
      for (let index = 1; index < 47; index += 1) {
        state = (state * 1664525 + 1013904223) >>> 0;
        const parent = Math.floor((index - 1) / 2);
        values.push(values[parent] === null || state % 4 === 0 ? null : (state % 201) - 100);
      }
      while (values.at(-1) === null) values.pop();
      const graph = parseBinaryTree(JSON.stringify(values));
      const original = structuredClone(graph);
      for (const [name, order] of [
        ['Binary Tree Inorder Traversal', 'inorder'],
        ['Binary Tree Preorder Traversal', 'preorder'],
        ['Binary Tree Postorder Traversal', 'postorder'],
      ] as const) {
        const preset = algorithmRegistry.find((candidate) => candidate.name === name);
        const steps = simulateAlgorithm(preset?.name ?? '', preset?.code ?? '', {
          kind: 'tree', text: '', graph, origin: 'user',
        });
        expect(
          steps.at(-1)?.visualData.vars.traversal,
          `seed=0x7EED2026 case=${caseIndex} order=${order} input=${JSON.stringify(values)}`,
        ).toEqual(traversalOracle(values, order));
        expect(graph).toEqual(original);
        expect(steps.every((step) => step.lineNumber === null || step.lineNumber > 0)).toBe(true);
      }
    }
  });
});
