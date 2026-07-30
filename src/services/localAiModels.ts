export interface LocalAiModelDefinition {
  id: string;
  label: string;
  vramMb: number;
  contextWindow: number;
  maxContextWindow: number;
  maxOutputTokens: number;
}

export const LOCAL_AI_MODELS = [
  {
    id: 'Qwen2.5-Coder-0.5B-Instruct-q4f32_1-MLC',
    label: 'Qwen2.5 Coder 0.5B (default, faster)',
    vramMb: 1061,
    contextWindow: 4096,
    maxContextWindow: 4096,
    maxOutputTokens: 520,
  },
  {
    id: 'Qwen2.5-Coder-1.5B-Instruct-q4f32_1-MLC',
    label: 'Qwen2.5 Coder 1.5B (enhanced)',
    vramMb: 1889,
    contextWindow: 4096,
    maxContextWindow: 4096,
    maxOutputTokens: 640,
  },
  {
    id: 'Qwen2.5-Coder-7B-Instruct-q4f16_1-MLC',
    label: 'Qwen2.5 Coder 7B (ultra, highest quality)',
    vramMb: 5107,
    contextWindow: 4096,
    maxContextWindow: 4096,
    maxOutputTokens: 760,
  },
  {
    id: 'Qwen3.5-9B-q4f32_1-MLC',
    label: 'Qwen3.5 9B (16 GB class, smartest)',
    vramMb: 7545,
    contextWindow: 4096,
    maxContextWindow: 8192,
    maxOutputTokens: 900,
  },
] as const satisfies readonly LocalAiModelDefinition[];

export const getLocalAiModelDefinition = (
  id: string,
): LocalAiModelDefinition | undefined =>
  LOCAL_AI_MODELS.find((model) => model.id === id);

export const selectCachedModelForAutoLoad = (
  selectedModel: string,
  cachedModels: string[],
  allowFallback: boolean,
): string | null => {
  if (cachedModels.includes(selectedModel)) return selectedModel;
  if (!allowFallback) return null;
  return [...LOCAL_AI_MODELS]
    .reverse()
    .find((model) => cachedModels.includes(model.id))?.id ?? null;
};
