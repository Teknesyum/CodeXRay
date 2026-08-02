import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

interface ValidationAttempt {
  outcome?: 'passed' | 'failed';
  gates?: Record<string, boolean>;
}

interface ValidationProblem {
  id: string;
  source: string;
  categories: string[];
  validations: ValidationAttempt[];
}

interface ValidationCategory {
  id: string;
  status: 'untested' | 'passed' | 'failed';
  marker: '' | '+';
  representativeProblemId: string;
  passedProblemIds: string[];
  problemIds: string[];
}

interface ValidationMatrix {
  problemCount: number;
  categoryCount: number;
  categories: ValidationCategory[];
  problems: ValidationProblem[];
}

interface CatalogProblem {
  id: string | number;
  source: string;
}

const readJson = <T,>(relativePath: string): T => JSON.parse(
  readFileSync(resolve(process.cwd(), relativePath), 'utf8'),
) as T;

const matrix = readJson<ValidationMatrix>('src/data/leetcodeCategoryValidation.json');
const catalog = readJson<CatalogProblem[]>('src/data/algorithmCatalog.json');

describe('LeetCode category validation matrix', () => {
  it('contains every LeetCode catalog title exactly once', () => {
    const catalogIds = catalog
      .filter((problem) => problem.source === 'leetcode')
      .map((problem) => String(problem.id))
      .sort();
    const matrixIds = matrix.problems.map((problem) => problem.id).sort();

    expect(new Set(matrixIds).size).toBe(matrixIds.length);
    expect(matrixIds).toEqual(catalogIds);
    expect(matrix.problemCount).toBe(catalogIds.length);
    expect(matrix.problems.every((problem) => problem.source === 'leetcode')).toBe(true);
  });

  it('keeps every detailed acceptance category non-empty and addressable', () => {
    const requiredCategories = [
      '1d-dp',
      '2d-dp',
      'interval-dp',
      'knapsack-dp',
      'bitmask-dp',
      'game-theory-dp',
      'tree-dp',
      'graph-dp',
      'sliding-window-array',
      'two-pointers-array',
      'prefix-sum-array',
      'binary-search-array',
      'permutations-backtracking',
      'combinations-backtracking',
      'subsets-backtracking',
      'two-pointers-linked-list',
      'cycle-linked-list',
      'reverse-linked-list',
      'bfs-graph',
      'dfs-graph',
      'shortest-path-graph',
      'topological-sort-graph',
      'mst-graph',
      'union-find-graph',
      'bst-tree',
      'segment-tree',
      'trie-tree',
      'sliding-window-string',
      'two-pointers-string',
    ];
    const categoriesById = new Map(matrix.categories.map((category) => [category.id, category]));
    const problemsById = new Map(matrix.problems.map((problem) => [problem.id, problem]));

    expect(matrix.categoryCount).toBe(matrix.categories.length);
    for (const categoryId of requiredCategories) {
      const category = categoriesById.get(categoryId);
      expect(category, `${categoryId} is missing`).toBeDefined();
      expect(category?.problemIds.length, `${categoryId} is empty`).toBeGreaterThan(0);
      expect(category?.problemIds).toContain(category?.representativeProblemId);
      expect(problemsById.get(category?.representativeProblemId ?? '')?.categories).toContain(categoryId);
    }
  });

  it('never awards a category marker without complete passing gate evidence', () => {
    const problemsById = new Map(matrix.problems.map((problem) => [problem.id, problem]));
    const requiredGates = ['source', 'input', 'trace', 'visual', 'finalResult'];

    for (const category of matrix.categories) {
      if (category.marker !== '+') {
        expect(category.status).not.toBe('passed');
        continue;
      }

      expect(category.status).toBe('passed');
      expect(category.passedProblemIds.length).toBeGreaterThan(0);
      const hasCompleteEvidence = category.passedProblemIds.some((problemId) => {
        const problem = problemsById.get(problemId);
        return problem?.validations.some((attempt) => (
          attempt.outcome === 'passed'
          && requiredGates.every((gate) => attempt.gates?.[gate] === true)
        ));
      });
      expect(hasCompleteEvidence, `${category.id} lacks complete passing evidence`).toBe(true);
    }
  });
});
