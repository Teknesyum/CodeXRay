import { describe, expect, it } from 'vitest';
import { routeGodModeRequest } from './godModeRouting';

describe('God Mode routing', () => {
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
});
