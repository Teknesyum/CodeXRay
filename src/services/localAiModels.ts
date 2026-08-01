export interface LocalAiModelDefinition {
  id: string;
  label: string;
  vramMb: number;
  contextWindow: number;
  maxContextWindow: number;
  maxOutputTokens: number;
  capabilities: {
    solveWebProblem: boolean;
    strictJson: boolean;
  };
}

export const LOCAL_AI_CONTEXT_WINDOWS = [4096, 8192, 16384, 32768] as const;

export type LocalAiContextWindow = typeof LOCAL_AI_CONTEXT_WINDOWS[number];

export const parseLocalAiContextWindow = (value: string | number): LocalAiContextWindow => {
  const parsed = Number(value);
  return LOCAL_AI_CONTEXT_WINDOWS.find((contextWindow) => contextWindow === parsed) ?? 4096;
};

export const LOCAL_AI_MODELS = [
  {
    id: 'Qwen2.5-Coder-0.5B-Instruct-q4f32_1-MLC',
    label: 'Qwen2.5 Coder 0.5B (default, faster)',
    vramMb: 1061,
    contextWindow: 4096,
    maxContextWindow: 32768,
    maxOutputTokens: 520,
    capabilities: { solveWebProblem: false, strictJson: false },
  },
  {
    id: 'Qwen2.5-Coder-1.5B-Instruct-q4f32_1-MLC',
    label: 'Qwen2.5 Coder 1.5B (enhanced)',
    vramMb: 1889,
    contextWindow: 4096,
    maxContextWindow: 32768,
    maxOutputTokens: 640,
    capabilities: { solveWebProblem: false, strictJson: true },
  },
  {
    id: 'Qwen2.5-Coder-7B-Instruct-q4f16_1-MLC',
    label: 'Qwen2.5 Coder 7B (ultra, highest quality)',
    vramMb: 5107,
    contextWindow: 4096,
    maxContextWindow: 32768,
    maxOutputTokens: 760,
    capabilities: { solveWebProblem: true, strictJson: true },
  },
  {
    id: 'Qwen3.5-9B-q4f32_1-MLC',
    label: 'Qwen3.5 9B (16 GB class, smartest)',
    vramMb: 7545,
    contextWindow: 4096,
    maxContextWindow: 32768,
    maxOutputTokens: 900,
    capabilities: { solveWebProblem: true, strictJson: true },
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
