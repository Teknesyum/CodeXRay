import { describe, expect, it } from 'vitest';
import type { AiProviderCapabilities } from '../../types/aiProvider';
import type { SimulationStep } from '../../types/simulation';
import { structuralCheckpointIndices } from '../aiTimelineControl';
import { routeTitanRequest } from './titanRouter';

const longTrace: SimulationStep[] = Array.from({ length: 520 }, (_, index) => ({
  lineNumber: (index % 12) + 1,
  explanation: `Language-dependent prose ${index}`,
  visualData: {
    type: 'variables',
    vars: {
      cursor: index,
      _traceKind: index === 259 ? 'assign' : 'statement',
      _mutated: index === 259 ? ['answer'] : [],
      _traceEvent: index === 259 ? { t: 'result-write', name: 'answer' } : null,
    },
  },
}));

const capabilities = (mode: AiProviderCapabilities['structuredOutput']): AiProviderCapabilities => ({
  chat: true,
  streaming: true,
  structuredOutput: mode,
  advancedWorkflows: mode !== 'none',
  reasoningOverhead: 500,
  usableOutputTokens: 524,
  checkedAt: 1,
  probeVersion: 2,
});

describe('Titan deterministic-first router', () => {
  it('selects structural index 259 from a 500+ step trace without explanation text', () => {
    expect(routeTitanRequest({
      question: 'go to the most important step', steps: longTrace, currentIndex: 0,
    })).toMatchObject({ intent: 'navigate', actions: [{ type: 'jump', index: 259 }], source: 'deterministic' });
  });

  it('keeps checkpoints identical when explanations are empty or translated', () => {
    const empty = longTrace.map((step) => ({ ...step, explanation: '' }));
    const translated = longTrace.map((step, index) => ({ ...step, explanation: `Türkçe açıklama ${index}` }));
    expect(structuralCheckpointIndices(empty)).toEqual(structuralCheckpointIndices(longTrace));
    expect(structuralCheckpointIndices(translated)).toEqual(structuralCheckpointIndices(longTrace));
    expect(structuralCheckpointIndices(longTrace)).toContain(259);
  });

  it('routes forty English and forty Turkish navigation expressions deterministically', () => {
    const english = Array.from({ length: 40 }, (_, index) =>
      `${['go to', 'jump to', 'show', 'take me to'][index % 4]} step ${(index % 20) + 1}`);
    const turkish = Array.from({ length: 40 }, (_, index) =>
      `${(index % 20) + 1}. adıma ${['git', 'atla', 'sar', 'göster'][index % 4]}`);
    for (const [index, phrase] of [...english, ...turkish].entries()) {
      const expected = (index % 40) % 20;
      expect(routeTitanRequest({ question: phrase, steps: longTrace, currentIndex: 300 }).actions)
        .toEqual([{ type: 'jump', index: expected }]);
    }
  });

  it('routes the closed deterministic intent set before consulting a model', () => {
    expect(routeTitanRequest({ question: 'diziyi tersten sırala', steps: longTrace, currentIndex: 0 }).intent).toBe('edit-input');
    expect(routeTitanRequest({ question: 'bu kodu simüle et', steps: longTrace, currentIndex: 0 }).intent).toBe('trace-code');
    expect(routeTitanRequest({ question: 'Python kodunu SimLang biçimine çevir', steps: longTrace, currentIndex: 0 }).intent).toBe('translate-code');
    expect(routeTitanRequest({ question: 'neden bu adım gerekli?', steps: longTrace, currentIndex: 0 }).intent).toBe('explain');
    expect(routeTitanRequest({ question: 'paneli büyüt', steps: longTrace, currentIndex: 0 }).intent).toBe('ui-control');
    expect(routeTitanRequest({
      question: 'diziyi tersten sırala', steps: longTrace, currentIndex: 0,
      capabilities: capabilities('native'), modelOutput: '{"intent":"explain"}',
    })).toMatchObject({ intent: 'edit-input', source: 'deterministic' });
  });

  it('covers model-off, none, invalid, prompt-only, and native ambiguity paths', () => {
    const base = { question: 'lütfen bunu hallet', steps: longTrace, currentIndex: 0 };
    expect(routeTitanRequest(base)).toMatchObject({ intent: 'unclear', source: 'deterministic', notice: expect.any(String) });
    expect(routeTitanRequest({ ...base, capabilities: capabilities('none'), modelOutput: '{"intent":"explain"}' }))
      .toMatchObject({ intent: 'unclear', source: 'deterministic', notice: expect.any(String) });
    expect(routeTitanRequest({ ...base, capabilities: capabilities('native'), modelOutput: 'broken' }))
      .toMatchObject({ intent: 'unclear', source: 'deterministic', notice: expect.any(String) });
    expect(routeTitanRequest({ ...base, capabilities: capabilities('prompt-only'), modelOutput: "answer {'intent':'explain',}" }))
      .toMatchObject({ intent: 'explain', source: 'model', notice: expect.stringContaining('tolerant') });
    expect(routeTitanRequest({ ...base, capabilities: capabilities('native'), modelOutput: '{"intent":"explain"}' }))
      .toMatchObject({ intent: 'explain', source: 'model', notice: null });
  });

  it('does not let a model supply a navigation target', () => {
    expect(routeTitanRequest({
      question: 'lütfen bunu hallet', steps: longTrace, currentIndex: 0,
      capabilities: capabilities('native'), modelOutput: '{"intent":"navigate","index":259}',
    })).toMatchObject({ intent: 'unclear', actions: [], source: 'deterministic' });
    expect(routeTitanRequest({
      question: 'lütfen bunu hallet', steps: longTrace, currentIndex: 0,
      capabilities: capabilities('native'), modelOutput: '{"intent":"navigate"}',
    })).toMatchObject({ intent: 'unclear', actions: [], source: 'deterministic', notice: expect.any(String) });
  });
});
