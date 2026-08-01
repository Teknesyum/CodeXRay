import { describe, expect, it } from 'vitest';
import { prebuiltAppConfig } from '@mlc-ai/web-llm';
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
    expect(getLocalAiModelDefinition('DeepSeek-R1-Distill-Qwen-7B-q4f16_1-MLC')).toMatchObject({
      contextWindow: 4096,
      maxContextWindow: 32768,
      maxOutputTokens: 1100,
      vramMb: 5107,
      reasoningModel: true,
      fallbackEligible: false,
      agentTimeouts: { firstTokenMs: 45_000, longAbsoluteMs: 150_000 },
    });
    expect(LOCAL_AI_MODELS.every((model) => model.maxContextWindow === 32768)).toBe(true);
    expect(prebuiltAppConfig.model_list.find((model) =>
      model.model_id === 'DeepSeek-R1-Distill-Qwen-7B-q4f16_1-MLC')).toMatchObject({
      vram_required_MB: 5106.67,
      overrides: { context_window_size: 4096 },
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
    const reasoning = LOCAL_AI_MODELS.find((model) => model.reasoningModel)!.id;
    expect(selectCachedModelForAutoLoad('missing', [fast, reasoning], true)).toBe(fast);
    expect(selectCachedModelForAutoLoad(reasoning, [reasoning], true)).toBe(reasoning);
  });
});
