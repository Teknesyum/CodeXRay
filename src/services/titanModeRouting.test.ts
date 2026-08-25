import { describe, expect, it } from 'vitest';
import { extractDpDimensions, requestsUniqueDpInput, routeTitanModeRequest, routeWebSourceRequest } from './titanModeRouting';

describe('Titan Mode routing', () => {
  it('preserves platform and numeric ID from the catalog drawer command', () => {
    expect(routeTitanModeRequest('Create catalog problem: leetcode/486', [], 0)).toEqual({
      type: 'create-catalog-problem',
      source: 'leetcode',
      problemId: '486',
    });
    expect(routeTitanModeRequest('Create catalog problem: cses/1192', [], 0)).toEqual({
      type: 'create-catalog-problem',
      source: 'cses',
      problemId: '1192',
    });
  });
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
    expect(routeTitanModeRequest(request, [], 0)).toEqual({
      type: 'deterministic',
      actions: [{ type: 'load-preset', presetId: 'depth-first-search-dfs' }],
    });
  });

  it.each([
    'DFS nedir?',
    'DFS nasıl çalışır?',
    'DFS ile BFS farkını anlat',
  ])('does not mutate for a knowledge-only question: %s', (request) => {
    expect(routeTitanModeRequest(request, [], 0)).toBeNull();
  });

  it('routes input adaptation as a multi-agent intent', () => {
    expect(routeTitanModeRequest('bu kod için inputları düzenle', [], 0)).toEqual({ type: 'adapt-input' });
    expect(routeTitanModeRequest('inputu genişlet', [], 0)).toEqual({ type: 'adapt-input' });
    expect(routeTitanModeRequest('inputumuzu 2 kat karmaşıklaştır', [], 0)).toEqual({ type: 'adapt-input' });
    expect(routeTitanModeRequest('17. nolu nodu kaldır', [], 0)).toEqual({ type: 'adapt-input' });
  });

  it('routes a current-step discussion to the five-phase explanation seam', () => {
    expect(routeTitanModeRequest('bunu açıkla', [], 0)).toEqual({ type: 'discuss-current-step' });
  });

  it('routes a workspace focus request to the typed UI command', () => {
    expect(routeTitanModeRequest('kod editorüne odaklan', [], 0)).toEqual({
      type: 'ui-control',
      command: 'focus-code',
    });
  });

  it('keeps composite solve, author, input, and simulate requests on the creation pipeline', () => {
    expect(routeTitanModeRequest(
      'LeetCode 1 Two Sum solve: write code, create original input, simulate every step, and verify the final result',
      [],
      0,
    )).toEqual({ type: 'create-algorithm', template: 'model-authored' });
  });

  it.each([
    'bunu 10*10 luk bir inputla simüle eder misin',
    'bunu 10x10 bir tabloyla yeniden çalıştır',
    'mevcut algoritmayı 10 elemanlı girdiyle tekrar simüle et',
    'simülasyonu 10*10 yapar mısın',
    'mevcut simülasyonumu 10x10 boyutuna çıkar',
    'inputu 10*10 yap',
    'girdiyi 10x10 yapabilir misin',
    'gridi 8*15 yap',
  ])('routes sized follow-up simulations through input adaptation: %s', (request) => {
    expect(routeTitanModeRequest(request, [], 0)).toEqual({ type: 'adapt-input' });
  });

  it('does not mutate the workspace for a size-only knowledge question', () => {
    expect(routeTitanModeRequest('10x10 interval DP tablosu nedir?', [], 0)).toBeNull();
    expect(routeTitanModeRequest('10x10 input yapısı nedir?', [], 0)).toBeNull();
  });

  it('routes bidirectional BFS creation to the validated template', () => {
    expect(routeTitanModeRequest('bana iki yönlü BFS yaz', [], 0)).toEqual({
      type: 'create-algorithm',
      template: 'bidirectional-bfs',
    });
  });

  it('routes the exact Coin Exchange request to the deterministic Coin Change agent', () => {
    expect(routeTitanModeRequest('bana coin exchange problemi yaz ve simüle et', [], 0)).toEqual({
      type: 'create-algorithm',
      template: 'coin-change-1d-dp',
    });
  });

  it('distinguishes opening a preset, authoring code, using the current graph, and asking a question', () => {
    expect(routeTitanModeRequest('BFS sayfasını aç', [], 0)).toEqual({
      type: 'deterministic',
      actions: [{ type: 'load-preset', presetId: 'breadth-first-search-bfs' }],
    });
    expect(routeTitanModeRequest('BFS kodu yaz', [], 0)).toEqual({
      type: 'create-algorithm',
      template: 'model-authored',
    });
    expect(routeTitanModeRequest('Elimdeki graph için BFS oluştur', [], 0)).toEqual({
      type: 'create-algorithm',
      template: 'model-authored',
    });
    expect(routeTitanModeRequest('BFS nedir?', [], 0)).toBeNull();
  });

  it('routes structural and visual-only graph changes through input transactions', () => {
    expect(routeTitanModeRequest('Bu grapha iki node ekle, hedefi değiştir', [], 0)).toEqual({ type: 'adapt-input' });
    expect(routeTitanModeRequest('Nodeları daha geniş yay, iki cepheyi farklı şekillerle göster', [], 0)).toEqual({ type: 'adapt-input' });
  });

  it('resolves a follow-up memory optimization against the committed LCS workspace', () => {
    expect(routeTitanModeRequest(
      'bellek O(m*n) olmasına gerek yok O(min(m,n)) yap; kodu yaz ve simüle et',
      [],
      0,
      'LeetCode 1143 — Longest Common Subsequence',
    )).toEqual({ type: 'create-algorithm', template: 'lcs-space-optimized-1d-dp' });
  });

  it('routes the documented Jump Game optimization path', () => {
    expect(routeTitanModeRequest('Jump Game DP çöz ve simüle et', [], 0)).toEqual({
      type: 'create-algorithm', template: 'jump-game-dp',
    });
    expect(routeTitanModeRequest('aynı soruyu greedy yap, kodu yaz ve simüle et', [], 0, 'LeetCode 55 — Jump Game (DP)')).toEqual({
      type: 'create-algorithm', template: 'jump-game-greedy',
    });
  });

  it('routes the documented LIS optimization path', () => {
    expect(routeTitanModeRequest('LIS sorusunu anlat', [], 0)).toEqual({
      type: 'create-algorithm', template: 'lis-quadratic-dp',
    });
    expect(routeTitanModeRequest('LIS DP çöz ve simüle et', [], 0)).toEqual({
      type: 'create-algorithm', template: 'lis-quadratic-dp',
    });
    expect(routeTitanModeRequest('O(n log n) binary search uygula, kodu yaz ve simüle et', [], 0, 'LeetCode 300 — Longest Increasing Subsequence (O(n²) DP)')).toEqual({
      type: 'create-algorithm', template: 'lis-binary-search',
    });
  });

  it.each([
    'LeetCode 486 Predict the Winner sorusunu çöz ve simüle et',
    'Predict the Winner çözümünü 2D DP ile göster',
    'interval dp sorusu yaz ve simüle et',
    'write and simulate an interval DP problem',
  ])('routes Predict the Winner to the deterministic interval-DP template: %s', (request) => {
    expect(routeTitanModeRequest(request, [], 0)).toEqual({
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
    expect(routeTitanModeRequest(request, [], 0)).toEqual({ type: 'create-algorithm', template });
  });

  it.each([
    '2d dp yaz simüle et',
    'bir 2d dp sorusu yaz ve çöz inputunu 6*11 olacak şekilde simüle et',
    'dinamik programlama simüle et',
    '1d dp oluştur',
  ])('asks for a concrete problem before starting a generic DP graph: %s', (request) => {
    expect(routeTitanModeRequest(request, [], 0)).toEqual({ type: 'clarify-algorithm' });
  });

  it('extracts explicit DP dimensions without asking the model to interpret them', () => {
    expect(extractDpDimensions('input 6*11 olsun')).toEqual({ rows: 6, columns: 11 });
    expect(extractDpDimensions('6×11 tablo')).toEqual({ rows: 6, columns: 11 });
    expect(extractDpDimensions('6x11 matrix')).toEqual({ rows: 6, columns: 11 });
  });

  it('keeps a unique-input request separate from a unique-problem request', () => {
    const request = 'bir 2d dp sorusu yaz ve 6*11 benzersiz input ile simüle et';
    expect(requestsUniqueDpInput(request)).toBe(true);
    expect(routeTitanModeRequest(request, [], 0)).toEqual({ type: 'clarify-algorithm' });
  });

  it('allows an explicit unique-problem choice to enter model-authored mode', () => {
    expect(routeTitanModeRequest('Özgün model-authored 2D DP sorusu yaz çöz ve simüle et', [], 0)).toEqual({
      type: 'create-algorithm', template: 'model-authored',
    });
  });

  it('keeps named 2D DP requests on deterministic templates', () => {
    expect(routeTitanModeRequest('LCS için 2D DP yaz simüle et', [], 0)).toEqual({
      type: 'create-algorithm', template: 'lcs-2d-dp',
    });
    expect(routeTitanModeRequest('edit distance 2D tablo oluştur', [], 0)).toEqual({
      type: 'create-algorithm', template: 'edit-distance-2d-dp',
    });
  });

  it('never sends a concrete author-and-simulate request to ordinary chat', () => {
    expect(routeTitanModeRequest('asal çarpanlara ayırma sorusu yaz, çöz ve simüle et', [], 0)).toEqual({
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
    expect(routeTitanModeRequest('devam', steps, 0)).toEqual({
      type: 'deterministic', actions: [{ type: 'next-important' }],
    });
    expect(routeTitanModeRequest('önceki önemli adıma dön', steps, 8)).toEqual({
      type: 'deterministic', actions: [{ type: 'previous-important' }],
    });
  });

  it.each(['write an algorithm', 'bana bir algoritma yaz', 'create a program']) (
    'asks for missing requirements without starting an agent graph: %s',
    (request) => {
      expect(routeTitanModeRequest(request, [], 0)).toEqual({ type: 'clarify-algorithm' });
    },
  );
});
