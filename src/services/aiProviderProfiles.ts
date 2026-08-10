import type {
  AiConnectionProfileV1,
  AiProviderCapabilities,
  AiProviderKind,
  AiRuntimeSelection,
} from '../types/aiProvider';
import { LOCAL_AI_MODELS, parseLocalAiContextWindow } from './localAiModels';

export const AI_SELECTION_KEY = 'codexray.ai-selection.v2';
export const EXTERNAL_AI_PROFILES_KEY = 'codexray.ai-external-profiles.v1';

export const DEFAULT_EXTERNAL_AI_PROFILES: readonly AiConnectionProfileV1[] = [
  {
    version: 1,
    id: 'ollama-default',
    name: 'Ollama',
    provider: 'ollama',
    baseUrl: 'http://127.0.0.1:11434/v1',
    model: '',
    contextWindow: 4096,
    maxOutputTokens: 1024,
    capabilities: null,
  },
  {
    version: 1,
    id: 'openai-compatible-default',
    name: 'Unsloth / llama.cpp',
    provider: 'openai-compatible',
    baseUrl: 'http://127.0.0.1:8001/v1',
    model: '',
    contextWindow: 4096,
    maxOutputTokens: 1024,
    capabilities: null,
  },
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const parseCapabilities = (value: unknown): AiProviderCapabilities | null => {
  if (!isRecord(value) || typeof value.chat !== 'boolean' || typeof value.streaming !== 'boolean'
    || !['none', 'native', 'prompt-only'].includes(String(value.structuredOutput))
    || typeof value.advancedWorkflows !== 'boolean' || typeof value.checkedAt !== 'number'
    || value.probeVersion !== 1) return null;
  return value as unknown as AiProviderCapabilities;
};

const parseProfile = (value: unknown): AiConnectionProfileV1 | null => {
  if (!isRecord(value) || value.version !== 1 || typeof value.id !== 'string'
    || typeof value.name !== 'string' || typeof value.baseUrl !== 'string'
    || typeof value.model !== 'string'
    || (value.provider !== 'ollama' && value.provider !== 'openai-compatible')) return null;
  const maxOutputTokens = Number(value.maxOutputTokens);
  if (!Number.isInteger(maxOutputTokens) || maxOutputTokens < 256 || maxOutputTokens > 4096) return null;
  return {
    version: 1,
    id: value.id.slice(0, 80),
    name: value.name.slice(0, 80),
    provider: value.provider,
    baseUrl: value.baseUrl.slice(0, 500),
    model: value.model.slice(0, 240),
    contextWindow: parseLocalAiContextWindow(Number(value.contextWindow)),
    maxOutputTokens,
    capabilities: parseCapabilities(value.capabilities),
  };
};

export const loadExternalAiProfiles = (storage: Storage = localStorage): AiConnectionProfileV1[] => {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(EXTERNAL_AI_PROFILES_KEY) ?? 'null');
    if (!Array.isArray(parsed)) return DEFAULT_EXTERNAL_AI_PROFILES.map((profile) => ({ ...profile }));
    const profiles = parsed.map(parseProfile).filter((profile): profile is AiConnectionProfileV1 => Boolean(profile));
    return profiles.length ? profiles : DEFAULT_EXTERNAL_AI_PROFILES.map((profile) => ({ ...profile }));
  } catch {
    return DEFAULT_EXTERNAL_AI_PROFILES.map((profile) => ({ ...profile }));
  }
};

export const saveExternalAiProfiles = (
  profiles: AiConnectionProfileV1[],
  storage: Storage = localStorage,
): void => storage.setItem(EXTERNAL_AI_PROFILES_KEY, JSON.stringify(
  profiles.map((profile) => parseProfile(profile)).filter(Boolean),
));

export const loadAiRuntimeSelection = (
  profiles: AiConnectionProfileV1[],
  storage: Storage = localStorage,
): AiRuntimeSelection => {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(AI_SELECTION_KEY) ?? 'null');
    if (isRecord(parsed) && parsed.version === 2 && parsed.provider === 'webllm'
      && typeof parsed.model === 'string' && LOCAL_AI_MODELS.some((model) => model.id === parsed.model)) {
      return {
        version: 2,
        provider: 'webllm',
        model: parsed.model,
        contextWindow: parseLocalAiContextWindow(Number(parsed.contextWindow)),
      };
    }
    if (isRecord(parsed) && parsed.version === 2
      && (parsed.provider === 'ollama' || parsed.provider === 'openai-compatible')
      && typeof parsed.profileId === 'string'
      && profiles.some((profile) => profile.id === parsed.profileId && profile.provider === parsed.provider)) {
      return parsed as unknown as AiRuntimeSelection;
    }
  } catch {
    // Migrate the legacy WebLLM selection below.
  }
  const legacyModel = storage.getItem('codexray.ai-model.v1');
  return {
    version: 2,
    provider: 'webllm',
    model: LOCAL_AI_MODELS.some((model) => model.id === legacyModel) ? legacyModel! : LOCAL_AI_MODELS[0].id,
    contextWindow: parseLocalAiContextWindow(storage.getItem('codexray.ai-context-window.v1') ?? 4096),
  };
};

export const invalidateExternalProfile = (
  profile: AiConnectionProfileV1,
  patch: Partial<Pick<AiConnectionProfileV1, 'baseUrl' | 'model' | 'contextWindow' | 'maxOutputTokens'>>,
): AiConnectionProfileV1 => ({ ...profile, ...patch, capabilities: null });

export const providerProfile = (
  provider: Exclude<AiProviderKind, 'webllm'>,
  profiles: AiConnectionProfileV1[],
): AiConnectionProfileV1 => profiles.find((profile) => profile.provider === provider)
  ?? DEFAULT_EXTERNAL_AI_PROFILES.find((profile) => profile.provider === provider)!;
