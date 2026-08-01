import { describe, expect, it } from 'vitest';
import { routeGodModeRequest, routeWebSourceRequest } from './godModeRouting';

describe('God Mode routing', () => {
  it('routes web URLs before punctuation cleanup and binds follow-ups', () => {
    expect(routeWebSourceRequest('Oku: https://leetcode.com/problems/two-sum/?envType=daily-question.', false)).toEqual({
      type: 'read-web-source',
      url: 'https://leetcode.com/problems/two-sum/?envType=daily-question',
    });
    expect(routeWebSourceRequest('https://example.com/problem bunu çöz ve kodla', false)).toEqual({ type: 'solve-web-problem', url: 'https://example.com/problem' });
    expect(routeWebSourceRequest('şimdi çözümü anlat', true)).toEqual({ type: 'explain-bound-solution' });
  });
  it.each([
    'dfs ile ilgili sayfayı aç',
    'DFS ile ilgili sayfayi ac',
    'DFS sayfasını açar mısın?',
    'open the DFS page',
  ])('loads DFS for explicit workspace request: %s', (request) => {
    expect(routeGodModeRequest(request, [], 0)).toEqual({
      type: 'deterministic',
      actions: [{ type: 'load-preset', presetId: 'depth-first-search-dfs' }],
    });
  });

  it.each([
    'DFS nedir?',
    'DFS nasıl çalışır?',
    'DFS ile BFS farkını anlat',
  ])('does not mutate for a knowledge-only question: %s', (request) => {
    expect(routeGodModeRequest(request, [], 0)).toBeNull();
  });

  it('routes input adaptation as a multi-agent intent', () => {
    expect(routeGodModeRequest('bu kod için inputları düzenle', [], 0)).toEqual({ type: 'adapt-input' });
  });

  it('routes bidirectional BFS creation to the validated template', () => {
    expect(routeGodModeRequest('bana iki yönlü BFS yaz', [], 0)).toEqual({
      type: 'create-algorithm',
      template: 'bidirectional-bfs',
    });
  });

  it('distinguishes opening a preset, authoring code, using the current graph, and asking a question', () => {
    expect(routeGodModeRequest('BFS sayfasını aç', [], 0)).toEqual({
      type: 'deterministic',
      actions: [{ type: 'load-preset', presetId: 'breadth-first-search-bfs' }],
    });
    expect(routeGodModeRequest('BFS kodu yaz', [], 0)).toEqual({
      type: 'create-algorithm',
      template: 'model-authored',
    });
    expect(routeGodModeRequest('Elimdeki graph için BFS oluştur', [], 0)).toEqual({
      type: 'create-algorithm',
      template: 'model-authored',
    });
    expect(routeGodModeRequest('BFS nedir?', [], 0)).toBeNull();
  });

  it('routes structural and visual-only graph changes through input transactions', () => {
    expect(routeGodModeRequest('Bu grapha iki node ekle, hedefi değiştir', [], 0)).toEqual({ type: 'adapt-input' });
    expect(routeGodModeRequest('Nodeları daha geniş yay, iki cepheyi farklı şekillerle göster', [], 0)).toEqual({ type: 'adapt-input' });
  });

  it('resolves a follow-up memory optimization against the committed LCS workspace', () => {
    expect(routeGodModeRequest(
      'bellek O(m*n) olmasına gerek yok O(min(m,n)) yap; kodu yaz ve simüle et',
      [],
      0,
      'LeetCode 1143 — Longest Common Subsequence',
    )).toEqual({ type: 'create-algorithm', template: 'lcs-space-optimized-1d-dp' });
  });

  it.each([
    'LeetCode 486 Predict the Winner sorusunu çöz ve simüle et',
    'Predict the Winner çözümünü 2D DP ile göster',
  ])('routes Predict the Winner to the deterministic interval-DP template: %s', (request) => {
    expect(routeGodModeRequest(request, [], 0)).toEqual({
      type: 'create-algorithm',
      template: 'predict-winner-interval-dp',
    });
  });

  it.each([
    ['LeetCode 198 House Robber çöz ve simüle et', 'house-robber-1d-dp'],
    ['LCS kodunu yaz ve 2D tabloyu göster', 'lcs-2d-dp'],
    ['LeetCode 516 longest palindromic subsequence çöz', 'longest-palindrome-interval-dp'],
    ['en uzun palindromik dizi sorusu yaz çöz simüle et', 'longest-palindrome-interval-dp'],
  ] as const)('routes representative DP families without model-format dependence: %s', (request, template) => {
    expect(routeGodModeRequest(request, [], 0)).toEqual({ type: 'create-algorithm', template });
  });

  it.each([
    '2d dp yaz simüle et',
    'dinamik programlama simüle et',
    '1d dp oluştur',
  ])('asks for a concrete problem before starting a generic DP graph: %s', (request) => {
    expect(routeGodModeRequest(request, [], 0)).toEqual({ type: 'clarify-algorithm' });
  });

  it('keeps named 2D DP requests on deterministic templates', () => {
    expect(routeGodModeRequest('LCS için 2D DP yaz simüle et', [], 0)).toEqual({
      type: 'create-algorithm', template: 'lcs-2d-dp',
    });
    expect(routeGodModeRequest('edit distance 2D tablo oluştur', [], 0)).toEqual({
      type: 'create-algorithm', template: 'edit-distance-2d-dp',
    });
  });

  it('never sends a concrete author-and-simulate request to ordinary chat', () => {
    expect(routeGodModeRequest('asal çarpanlara ayırma sorusu yaz, çöz ve simüle et', [], 0)).toEqual({
      type: 'create-algorithm',
      template: 'model-authored',
    });
  });

  it('navigates guided teaching checkpoints forward and backward', () => {
    const steps = Array.from({ length: 12 }, (_, index) => ({
      lineNumber: index + 1,
      explanation: index === 6 ? 'A critical meeting is found.' : `Step ${index + 1}`,
      visualData: { type: 'variables' as const, vars: { index } },
    }));
    expect(routeGodModeRequest('devam', steps, 0)).toEqual({
      type: 'deterministic', actions: [{ type: 'next-important' }],
    });
    expect(routeGodModeRequest('önceki önemli adıma dön', steps, 8)).toEqual({
      type: 'deterministic', actions: [{ type: 'previous-important' }],
    });
  });

  it.each(['write an algorithm', 'bana bir algoritma yaz', 'create a program']) (
    'asks for missing requirements without starting an agent graph: %s',
    (request) => {
      expect(routeGodModeRequest(request, [], 0)).toEqual({ type: 'clarify-algorithm' });
    },
  );
});
