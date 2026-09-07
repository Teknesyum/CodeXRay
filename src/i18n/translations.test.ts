import { describe, expect, it } from 'vitest';
import { algorithmRegistry } from '../services/codeRegistry';
import { generateSimulationSteps } from '../services/aiService';
import { createInputPreset, getInputKindForAlgorithm } from '../services/inputPresets';
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

  it('provides Titan pipeline status and verification copy in both locales', () => {
    expect(t('titanStatus_running', 'en')).toBe('running');
    expect(t('titanStatus_running', 'tr')).toBe('çalışıyor');
    expect(t('titanCurrentStepVerificationFailed', 'en')).toContain('workspace was not changed');
    expect(t('titanCurrentStepVerificationFailed', 'tr')).toContain('Çalışma alanı değiştirilmedi');
  });

  it('localizes verified translation provenance without rerunning the package', () => {
    expect(t('translationProvenanceBadge', 'en', { language: 'JAVA' }))
      .toBe('Translated from JAVA · deterministically verified');
    expect(t('translationProvenanceBadge', 'tr', { language: 'JAVA' }))
      .toBe('JAVA kaynağından çevrildi · deterministik doğrulandı');
    expect(t('webTranslatedSimulationApplied', 'en')).toContain('deterministically verified');
    expect(t('webTranslatedSimulationApplied', 'tr')).toContain('deterministik doğrulanan');
  });

  it('localizes failed input adaptation without claiming a mutation', () => {
    expect(t('titanInputAdaptationVerificationFailed', 'en')).toContain('workspace was not changed');
    expect(t('titanInputAdaptationVerificationFailed', 'tr')).toContain('Çalışma alanı değiştirilmedi');
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
  it('leaves no English decision word in the Turkish locale', async () => {
    const mathematicalIdentifiers = new Set([
      'DFS', 'BFS', 'MST', 'SCC', 'LIS', 'min', 'max', 'low', 'disc',
    ]);
    const tokensOf = (value: string): string[] => value.match(/[A-Za-z]{3,}/g) ?? [];
    const englishVocabulary = new Set<string>();
    const turkishTokens = new Set<string>();
    const inputIdentifiers = new Set<string>();
    let decisionTotal = 0;
    let decisionUntranslated = 0;
    const distinct = new Set<string>();
    for (const algorithm of algorithmRegistry.filter((item) => item.isSupported)) {
      const input = createInputPreset(getInputKindForAlgorithm(algorithm.name), 0, algorithm.name);
      for (const node of input.graph?.nodes ?? []) {
        for (const token of tokensOf(`${node.id} ${node.label ?? ''}`)) inputIdentifiers.add(token);
      }
      const steps = await generateSimulationSteps(algorithm.name, algorithm.code, input);
      for (const step of steps) {
        const decision = step.visualData.vars.decision;
        if (typeof decision !== 'string' || !decision) continue;
        if (distinct.has(decision)) continue;
        distinct.add(decision);
        decisionTotal += 1;
        const turkish = translateRuntimeText(decision, 'tr');
        if (turkish === decision) decisionUntranslated += 1;
        for (const token of tokensOf(decision)) englishVocabulary.add(token);
        for (const token of tokensOf(turkish)) turkishTokens.add(token);
      }
    }
    const residual = [...turkishTokens]
      .filter((token) => englishVocabulary.has(token))
      .filter((token) => !mathematicalIdentifiers.has(token))
      .filter((token) => !inputIdentifiers.has(token))
      .sort();
    expect(decisionTotal).toBe(175);
    expect(residual).toEqual([]);
    expect(decisionUntranslated).toBe(47);
  }, 120000);

  it('keeps every untranslated decision free of English words', async () => {
    const notation = new Set<string>();
    for (const algorithm of algorithmRegistry.filter((item) => item.isSupported)) {
      const input = createInputPreset(getInputKindForAlgorithm(algorithm.name), 0, algorithm.name);
      const identifiers = new Set(
        (input.graph?.nodes ?? []).flatMap((node) => [node.id, node.label ?? '']),
      );
      const steps = await generateSimulationSteps(algorithm.name, algorithm.code, input);
      for (const step of steps) {
        const decision = step.visualData.vars.decision;
        if (typeof decision !== 'string' || !decision) continue;
        if (translateRuntimeText(decision, 'tr') !== decision) continue;
        notation.add(decision);
        const words = (decision.match(/[A-Za-z]{2,}/g) ?? [])
          .filter((word) => !identifiers.has(word))
          .filter((word) => !['min', 'max', 'low', 'disc', 'SCC'].includes(word));
        expect(words, decision).toEqual([]);
      }
    }
    expect(notation.size).toBe(47);
  }, 120000);

  it('translates decision templates without touching phases or explanations', () => {
    expect(translateRuntimeText('A is unvisited, so this edge becomes part of the DFS tree.', 'tr'))
      .toBe('A ziyaret edilmemiş, bu yüzden bu kenar DFS ağacının parçası olur.');
    expect(translateRuntimeText('mid<target ⇒ discard left half', 'tr'))
      .toBe('orta<hedef ⇒ sol yarı elenir');
    expect(translateRuntimeText('DFS · inspect edge', 'tr'))
      .toBe('DFS · kenarı incele');
    expect(translateRuntimeText('Kadane · choose extend or restart', 'tr'))
      .toBe('Kadane · uzat veya yeniden başlat');
    expect(translateRuntimeText('Follow the edge from A to unvisited node B.', 'tr'))
      .toBe('A düğümünden ziyaret edilmemiş B düğümüne giden kenarı izle.');
  });
});
