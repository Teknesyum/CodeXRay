import { describe, expect, it } from 'vitest';
import catalog from '../data/algorithmCatalog.json';
import type { AlgorithmProblem } from './algorithmCatalog';
import { getCatalogProblemUrl } from './catalogProblemDetails';

describe('complete catalog addressability', () => {
  it('keeps every source:id unique and every record canonically addressable', () => {
    const keys = new Set<string>();
    const sourceCounts = new Map<string, number>();

    for (const rawProblem of catalog) {
      const problem = rawProblem as AlgorithmProblem;
      const key = `${problem.source}:${problem.id}`;
      expect(keys.has(key), `duplicate catalog key ${key}`).toBe(false);
      keys.add(key);
      sourceCounts.set(problem.source, (sourceCounts.get(problem.source) ?? 0) + 1);

      const url = getCatalogProblemUrl(problem);
      expect(url, `missing canonical URL for ${key}`).not.toBeNull();
      expect(new URL(url!).protocol).toBe('https:');
      expect(problem.title.trim().length, `missing title for ${key}`).toBeGreaterThan(0);
      expect(problem.slug.trim().length, `missing slug for ${key}`).toBeGreaterThan(0);
      expect(problem.category.trim().length, `missing category for ${key}`).toBeGreaterThan(0);
      expect(Array.isArray(problem.tags), `invalid tags for ${key}`).toBe(true);
    }

    expect(Object.fromEntries(sourceCounts)).toEqual({
      leetcode: 3236,
      cses: 388,
      codeforces: 10544,
      atcoder: 7859,
    });
    expect(keys.size).toBe(22027);
  });
});
