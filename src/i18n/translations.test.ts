import { describe, expect, it } from 'vitest';
import { algorithmRegistry } from '../services/codeRegistry';
import {
  localizeAlgorithmName,
  t,
  translateRuntimeText,
} from './translations';

describe('translations', () => {
  it('provides Turkish UI labels and interpolation', () => {
    expect(t('sourceCode', 'tr')).toBe('Kaynak Kod');
    expect(t('arrayCount', 'tr', { count: 15 })).toBe('Dizi(15)');
  });

  it('localizes every supported algorithm label', () => {
    for (const algorithm of algorithmRegistry.filter((item) => item.isSupported)) {
      expect(localizeAlgorithmName(algorithm.name, 'tr'), algorithm.name)
        .not.toBe(algorithm.name);
    }
  });

  it('translates existing runtime explanations without rerunning a simulation', () => {
    expect(translateRuntimeText(
      'Visit node 12 and continue depth-first.',
      'tr',
    )).toBe('12 düğümünü ziyaret et ve derinlik öncelikli devam et.');
    expect(translateRuntimeText(
      'Sorting completed. Every value is in its final position.',
      'tr',
    )).toBe('Sıralama tamamlandı. Her değer son konumunda.');
  });
});
