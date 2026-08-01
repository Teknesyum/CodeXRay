export interface LocalAiModelDefinition {
  id: string;
  label: string;
  vramMb: number;
  contextWindow: number;
  maxContextWindow: number;
  maxOutputTokens: number;
  reasoningModel?: boolean;
  fallbackEligible?: boolean;
  recommendedGpuMb?: number;
  agentTimeouts?: {
    queueMs: number;
    firstTokenMs: number;
    inactivityMs: number;
    shortAbsoluteMs: number;
    longAbsoluteMs: number;
  };
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
    reasoningModel: false,
    fallbackEligible: true,
    capabilities: { solveWebProblem: false, strictJson: false },
  },
  {
    id: 'Qwen2.5-Coder-1.5B-Instruct-q4f32_1-MLC',
    label: 'Qwen2.5 Coder 1.5B (enhanced)',
    vramMb: 1889,
    contextWindow: 4096,
    maxContextWindow: 32768,
    maxOutputTokens: 640,
    reasoningModel: false,
    fallbackEligible: true,
    capabilities: { solveWebProblem: false, strictJson: true },
  },
  {
    id: 'Qwen2.5-Coder-7B-Instruct-q4f16_1-MLC',
    label: 'Qwen2.5 Coder 7B (ultra, highest quality)',
    vramMb: 5107,
    contextWindow: 4096,
    maxContextWindow: 32768,
    maxOutputTokens: 760,
    reasoningModel: false,
    fallbackEligible: true,
    capabilities: { solveWebProblem: true, strictJson: true },
  },
  {
    id: 'Qwen3.5-9B-q4f32_1-MLC',
    label: 'Qwen3.5 9B (16 GB class, smartest)',
    vramMb: 7545,
    contextWindow: 4096,
    maxContextWindow: 32768,
    maxOutputTokens: 900,
    reasoningModel: false,
    fallbackEligible: true,
    capabilities: { solveWebProblem: true, strictJson: true },
  },
  {
    id: 'DeepSeek-R1-Distill-Qwen-7B-q4f16_1-MLC',
    label: 'DeepSeek R1 Distill Qwen 7B (reasoning, experimental)',
    vramMb: 5107,
    contextWindow: 4096,
    maxContextWindow: 32768,
    maxOutputTokens: 1100,
    reasoningModel: true,
    fallbackEligible: false,
    recommendedGpuMb: 8000,
    agentTimeouts: {
      queueMs: 20_000,
      firstTokenMs: 45_000,
      inactivityMs: 25_000,
      shortAbsoluteMs: 75_000,
      longAbsoluteMs: 150_000,
    },
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
    .find((model) => model.fallbackEligible !== false && cachedModels.includes(model.id))?.id ?? null;
};
