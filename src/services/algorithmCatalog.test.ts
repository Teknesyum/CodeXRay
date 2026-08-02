import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadCatalog, getProblem, getProblemsByDerivedCategory } from './algorithmCatalog';

// Mock fetch globally
globalThis.fetch = vi.fn();

describe('algorithmCatalog', () => {
  const mockLeetCodeData = [
    { id: '1', source: 'leetcode', title: 'Two Sum', slug: 'two-sum', difficulty: 'Easy', category: 'array', derivedCategories: ['two-pointers-array'], tags: ['array'] },
    { id: '486', source: 'leetcode', title: 'Predict the Winner', slug: 'predict-the-winner', difficulty: 'Medium', category: 'dp', derivedCategories: ['interval-dp'], tags: ['dp'] },
    { id: 'UTF8', source: 'leetcode', title: 'Türkçe Karakterler: İşıÖçĞü', slug: 'utf8-test', difficulty: 'Easy', category: 'string', derivedCategories: ['other'], tags: [] }
  ];

  beforeEach(() => {
    vi.resetAllMocks();
    (globalThis.fetch as any).mockImplementation(async (url: string) => ({
      ok: true,
      json: async () => url.includes('leetcode') ? mockLeetCodeData : [],
    }));
  });

  it('loads the catalog asynchronously via fetch (no static import bloat)', async () => {
    const problems = await loadCatalog({ source: 'leetcode' });
    expect(problems.length).toBe(3);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('retrieves problems deterministically by source + id', async () => {
    const p1 = await getProblem({ source: 'leetcode', id: '486' });
    expect(p1).not.toBeNull();
    expect(p1?.title).toBe('Predict the Winner');

    const p2 = await getProblem({ source: 'cses', id: '486' });
    expect(p2).toBeNull(); // Because our mock returns mockLeetCodeData, but getProblem doesn't find it if it was a real CSES file (here fetch returns the same mock data, but id '486' is present. Wait, mockLeetCodeData has source: 'leetcode', so if the test uses the same mock, it finds it. Let's fix the mock for different sources).
  });

  it('filters problems by derived category securely', async () => {
    const problems = await getProblemsByDerivedCategory({ source: 'leetcode', category: 'interval-dp' });
    expect(problems.length).toBe(1);
    expect(problems[0].id).toBe('486');
  });

  it('does not contain mojibake (verifies UTF-8)', async () => {
    const p = await getProblem({ source: 'leetcode', id: 'UTF8' });
    expect(p?.title).toBe('Türkçe Karakterler: İşıÖçĞü');
  });

  it('fails gracefully on invalid schema', async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => [{ invalid: 'schema' }],
    });

    await expect(loadCatalog({ source: 'bad' })).rejects.toThrow(/Invalid schema/);
  });
});
