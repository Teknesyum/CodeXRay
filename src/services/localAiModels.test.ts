import { describe, expect, it } from 'vitest';
import {
  getLocalAiModelDefinition,
  LOCAL_AI_MODELS,
  parseLocalAiContextWindow,
  selectCachedModelForAutoLoad,
} from './localAiModels';

describe('local AI model profiles', () => {
  it('scales answer budgets with model capability within the shared context window', () => {
    const budgets = LOCAL_AI_MODELS.map((model) => model.maxOutputTokens);
    expect(budgets).toEqual([...budgets].sort((left, right) => left - right));
    expect(getLocalAiModelDefinition('Qwen3.5-9B-q4f32_1-MLC')).toMatchObject({
      contextWindow: 4096,
      maxContextWindow: 32768,
      maxOutputTokens: 900,
      vramMb: 7545,
    });
  });

  it('accepts only the four supported context-window profiles', () => {
    expect(parseLocalAiContextWindow('4096')).toBe(4096);
    expect(parseLocalAiContextWindow('8192')).toBe(8192);
    expect(parseLocalAiContextWindow('16384')).toBe(16384);
    expect(parseLocalAiContextWindow('32768')).toBe(32768);
    expect(parseLocalAiContextWindow('65536')).toBe(4096);
    expect(parseLocalAiContextWindow('invalid')).toBe(4096);
  });

  it('restores the selected cache or falls back once to the strongest stored model', () => {
    const fast = LOCAL_AI_MODELS[0].id;
    const ultra = LOCAL_AI_MODELS[2].id;
    expect(selectCachedModelForAutoLoad(ultra, [fast, ultra], true)).toBe(ultra);
    expect(selectCachedModelForAutoLoad('missing', [fast, ultra], true)).toBe(ultra);
    expect(selectCachedModelForAutoLoad('missing', [fast, ultra], false)).toBeNull();
  });
});
