import { beforeEach, describe, expect, it } from 'vitest';
import {
  AI_SELECTION_KEY,
  EXTERNAL_AI_PROFILES_KEY,
  invalidateExternalProfile,
  loadAiRuntimeSelection,
  loadExternalAiProfiles,
  saveExternalAiProfiles,
} from './aiProviderProfiles';

describe('AI provider profile persistence', () => {
  beforeEach(() => localStorage.clear());

  it('migrates the legacy WebLLM selection to the provider-aware schema', () => {
    localStorage.setItem('codexray.ai-model.v1', 'Qwen2.5-Coder-0.5B-Instruct-q4f32_1-MLC');
    localStorage.setItem('codexray.ai-context-window.v1', '8192');

    expect(loadAiRuntimeSelection(loadExternalAiProfiles())).toEqual({
      version: 2,
      provider: 'webllm',
      model: 'Qwen2.5-Coder-0.5B-Instruct-q4f32_1-MLC',
      contextWindow: 8192,
    });
  });

  it('persists external profiles without accepting a bearer token field', () => {
    const profile = {
      ...loadExternalAiProfiles()[0],
      model: 'qwen3:8b',
      bearerToken: 'must-not-persist',
    };
    saveExternalAiProfiles([profile]);

    expect(localStorage.getItem(EXTERNAL_AI_PROFILES_KEY)).not.toContain('must-not-persist');
    expect(loadExternalAiProfiles()[0]).not.toHaveProperty('bearerToken');
  });

  it('invalidates compatibility when an endpoint, model, or budget changes', () => {
    const profile = {
      ...loadExternalAiProfiles()[0],
      capabilities: {
        chat: true,
        streaming: true,
        structuredOutput: 'native' as const,
        advancedWorkflows: true,
        checkedAt: 1,
        probeVersion: 1 as const,
      },
    };

    expect(invalidateExternalProfile(profile, { model: 'new-model' })).toMatchObject({
      model: 'new-model',
      capabilities: null,
    });
  });

  it('persists expanded external context and output budgets', () => {
    const profile = {
      ...loadExternalAiProfiles()[1],
      contextWindow: 131072 as const,
      maxOutputTokens: 32768,
    };
    saveExternalAiProfiles([profile]);

    expect(loadExternalAiProfiles()[0]).toMatchObject({
      contextWindow: 131072,
      maxOutputTokens: 32768,
    });
  });

  it('migrates an oversized legacy output budget without losing the endpoint', () => {
    const legacy = {
      ...loadExternalAiProfiles()[1],
      baseUrl: 'http://127.0.0.1:8888/v1',
      model: 'reasoning-model',
      contextWindow: 16384 as const,
      maxOutputTokens: 16384,
      capabilities: {
        chat: true,
        streaming: true,
        structuredOutput: 'native' as const,
        advancedWorkflows: true,
        checkedAt: 1,
        probeVersion: 1 as const,
      },
    };
    localStorage.setItem(EXTERNAL_AI_PROFILES_KEY, JSON.stringify([legacy]));

    expect(loadExternalAiProfiles()[0]).toMatchObject({
      baseUrl: legacy.baseUrl,
      model: legacy.model,
      maxOutputTokens: 8192,
      capabilities: null,
    });
  });

  it('rejects a saved provider selection whose profile/provider pair does not match', () => {
    localStorage.setItem(AI_SELECTION_KEY, JSON.stringify({
      version: 2,
      provider: 'openai-compatible',
      profileId: 'ollama-default',
    }));

    expect(loadAiRuntimeSelection(loadExternalAiProfiles()).provider).toBe('webllm');
  });
});
