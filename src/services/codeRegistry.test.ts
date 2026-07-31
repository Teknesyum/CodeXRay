import { describe, expect, it } from 'vitest';
import {
  resolveAlgorithmPreset,
  resolveAlgorithmPresetById,
  resolveAlgorithmPresetFromCommand,
} from './codeRegistry';

describe('algorithm preset resolution', () => {
  it('resolves canonical IDs and exact aliases', () => {
    expect(resolveAlgorithmPresetById('depth-first-search-dfs')?.name)
      .toBe('Depth First Search (DFS)');
    expect(resolveAlgorithmPreset('dfs')?.id).toBe('depth-first-search-dfs');
  });

  it('finds English and Turkish display names inside explicit commands', () => {
    expect(resolveAlgorithmPresetFromCommand('Topolojik Sıralama sayfasını aç')?.id)
      .toBe('topological-sort');
    expect(resolveAlgorithmPresetFromCommand('load Matrix Chain Multiplication')?.id)
      .toBe('matrix-chain-multiplication');
  });

  it('fails closed when multiple presets or only partial names are present', () => {
    expect(resolveAlgorithmPresetFromCommand('DFS ve BFS sayfasını aç')).toBeUndefined();
    expect(resolveAlgorithmPresetFromCommand('depth sayfasını aç')).toBeUndefined();
  });
});
