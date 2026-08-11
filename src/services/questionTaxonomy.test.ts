import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearCatalogCache } from './algorithmCatalog';
import answerQuestionTaxonomy from './questionTaxonomy';

const problems = [
  { id: '1143', source: 'leetcode', title: 'Longest Common Subsequence', slug: 'lcs', difficulty: 'Medium', category: '2d-dp', derivedCategories: ['2d-dp'], tags: ['dynamic-programming'] },
  { id: '72', source: 'leetcode', title: 'Edit Distance', slug: 'edit-distance', difficulty: 'Medium', category: '2d-dp', derivedCategories: ['2d-dp'], tags: ['dynamic-programming'] },
  { id: '62', source: 'leetcode', title: 'Unique Paths', slug: 'unique-paths', difficulty: 'Medium', category: '2d-dp', derivedCategories: ['2d-dp'], tags: ['matrix', 'dynamic-programming'] },
  { id: '486', source: 'leetcode', title: 'Predict the Winner', slug: 'predict-the-winner', difficulty: 'Medium', category: '2d-dp', derivedCategories: ['interval-dp'], tags: ['dynamic-programming'] },
  { id: '133', source: 'leetcode', title: 'Clone Graph', slug: 'clone-graph', difficulty: 'Medium', category: 'graph', derivedCategories: ['graph'], tags: ['graph'] },
];

beforeEach(() => {
  clearCatalogCache();
  vi.stubGlobal('fetch', vi.fn(async (url: string) => ({
    ok: true,
    json: async () => url.includes('leetcode') ? problems : [],
  })));
});

describe('question taxonomy fast path', () => {
  it('returns a deterministic 2D DP tree without invoking a model', async () => {
    const answer = await answerQuestionTaxonomy('2d dp elinde neler var?', 'tr');
    expect(answer?.content).toContain('2D DP soru ağacı');
    expect(answer?.selectedNodeId).toBe('2d-dp');
    expect(answer?.groups.flatMap((group) => group.nodes).find((item) => item.id === 'lcs')?.count).toBe(1);
    expect(answer?.groups.flatMap((group) => group.nodes).find((item) => item.id === 'interval-dp')?.count).toBe(1);
    expect(answer?.groups.flatMap((group) => group.nodes).find((item) => item.id === '2d-dp')?.problems.map((problem) => problem.title))
      .toEqual(['Edit Distance', 'Longest Common Subsequence', 'Predict the Winner', 'Unique Paths']);
  });

  it('answers an LCS count follow-up directly from catalog records', async () => {
    const answer = await answerQuestionTaxonomy('LCS kaç soru biliyon?', 'tr');
    expect(answer?.content).toContain('Katalogda 1 doğrudan eşleşme');
    expect(answer?.content).toContain('Longest Common Subsequence (leetcode 1143)');
    expect(answer?.selectedNodeId).toBe('lcs');
  });

  it('routes a grid DP navigation phrase to the local tree node', async () => {
    const answer = await answerQuestionTaxonomy('grid dp sorularını göster', 'tr');
    expect(answer?.selectedNodeId).toBe('grid-dp');
    expect(answer?.groups.flatMap((group) => group.nodes).find((node) => node.id === 'grid-dp')?.count).toBeGreaterThan(0);
  });

  it.each([
    'grafik soruların var mı',
    'graf sorusu biliyor musun',
    'graph problems do you have?',
  ])('routes a graph catalog inquiry locally without planning: %s', async (question) => {
    const answer = await answerQuestionTaxonomy(question, 'tr');
    expect(answer?.selectedNodeId).toBe('graph');
    expect(answer?.groups.flatMap((group) => group.nodes).find((node) => node.id === 'graph')?.count).toBe(1);
  });

  it('ignores ordinary questions so the existing assistant routing continues', async () => {
    await expect(answerQuestionTaxonomy('Bu kod neden yavaş?', 'tr')).resolves.toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(['soru havuzu', 'sorular', 'soru', 'problem listesi'])('opens the full local pool for: %s', async (question) => {
    const answer = await answerQuestionTaxonomy(question, 'tr');
    expect(answer?.groups.length).toBeGreaterThan(1);
    expect(answer?.selectedNodeId).toBeNull();
  });
});
