import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExternalDocumentV1 } from '../types/webSource';
import { clearCatalogProblemDetailsCache, getCatalogProblemUrl, loadCatalogProblemDetails } from './catalogProblemDetails';
import { readWebSource } from './webSource';

vi.mock('./webSource', async (importOriginal) => {
  const original = await importOriginal<typeof import('./webSource')>();
  return { ...original, readWebSource: vi.fn() };
});

const document: ExternalDocumentV1 = {
  version: 1,
  id: 'doc-1',
  requestedUrl: 'https://leetcode.com/problems/two-sum/',
  finalUrl: 'https://leetcode.com/problems/two-sum/',
  title: '1. Two Sum',
  contentType: 'text/html',
  provider: 'leetcode',
  retrievedAt: '2026-08-02T00:00:00.000Z',
  segments: [{ id: 's1', kind: 'statement', text: 'Return two indices.' }],
  contentHash: 'abcdef0123456789',
  truncated: false,
  warnings: [],
};

describe('catalog problem details', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearCatalogProblemDetailsCache();
    vi.mocked(readWebSource).mockResolvedValue(document);
  });

  it('builds canonical URLs for every catalog platform', () => {
    expect(getCatalogProblemUrl({ id: '1', source: 'leetcode', title: 'Two Sum', slug: 'two-sum', difficulty: 'Easy', category: 'array', tags: [] }))
      .toBe('https://leetcode.com/problems/two-sum/');
    expect(getCatalogProblemUrl({ id: 'CSES-1068', source: 'cses', title: 'Weird Algorithm', slug: 'weird-algorithm', difficulty: 'Medium', category: 'array', tags: [] }))
      .toBe('https://cses.fi/problemset/task/1068/');
    expect(getCatalogProblemUrl({ id: 'CF-1A', source: 'codeforces', title: 'Theatre Square', slug: 'cf-1-a', difficulty: 'Easy', category: 'other', tags: [] }))
      .toBe('https://codeforces.com/problemset/problem/1/A');
    expect(getCatalogProblemUrl({ id: 'AC-abc086_a', source: 'atcoder', title: 'Product', slug: 'abc086_a', difficulty: 'Easy', category: 'other', tags: ['atcoder', 'abc086'] }))
      .toBe('https://atcoder.jp/contests/abc086/tasks/abc086_a');
  });

  it('loads, validates, and caches cleaned source details', async () => {
    const problem = { id: '1', source: 'leetcode', title: 'Two Sum', slug: 'two-sum', difficulty: 'Easy' as const, category: 'array', tags: ['array'] };
    const first = await loadCatalogProblemDetails(problem);
    const second = await loadCatalogProblemDetails(problem);
    expect(first.problem.description).toBe('Return two indices.');
    expect(second).toBe(first);
    expect(readWebSource).toHaveBeenCalledTimes(1);
  });

  it('rejects cleaned pages without a readable statement', async () => {
    vi.mocked(readWebSource).mockResolvedValue({ ...document, segments: [] });
    await expect(loadCatalogProblemDetails({ id: '1', source: 'leetcode', title: 'Two Sum', slug: 'two-sum', difficulty: 'Easy', category: 'array', tags: [] }))
      .rejects.toThrow(/readable statement/);
  });
});
