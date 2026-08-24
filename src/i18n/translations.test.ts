import { describe, expect, it } from 'vitest';
import { algorithmRegistry } from '../services/codeRegistry';
import {
  dictionaries,
  localizeAlgorithmName,
  t,
  translateRuntimeText,
} from './translations';

describe('translations', () => {
  it('keeps English and Turkish translation key sets identical', () => {
    expect(Object.keys(dictionaries.en).sort()).toEqual(Object.keys(dictionaries.tr).sort());
    expect(Object.keys(dictionaries.tr).sort()).toEqual(Object.keys(dictionaries.en).sort());
  });

  it('provides Turkish UI labels and interpolation', () => {
    expect(t('sourceCode', 'tr')).toBe('Kaynak Kod');
    expect(t('arrayCount', 'tr', { count: 15 })).toBe('Dizi(15)');
    expect(t('trackFallback', 'en', { number: 3 })).toBe('Track 3');
    expect(t('trackFallback', 'tr', { number: 3 })).toBe('Şarkı 3');
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

  it('localizes validation errors from untrusted input parsing', () => {
    expect(translateRuntimeText('Array input cannot contain empty items.', 'tr'))
      .toBe('Dizi girdisi boş eleman içeremez.');
  });

  it('localizes typed visual row labels and semantic cell roles', () => {
    expect(translateRuntimeText('split depth 2', 'tr')).toBe('bölünme derinliği 2');
    expect(translateRuntimeText('LIS ending here', 'tr')).toBe('burada biten LIS');
    expect(translateRuntimeText('dependency', 'tr')).toBe('bağımlılık');
  });
});
