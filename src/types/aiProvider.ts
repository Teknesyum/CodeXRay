import type { Locale } from '../i18n/translations';

export type AiProviderKind = 'webllm' | 'ollama' | 'openai-compatible';

export type AiStructuredOutputMode = 'none' | 'native' | 'prompt-only';

export type ExternalAiContextWindow = 4096 | 8192 | 16384 | 32768 | 65536 | 131072;

export interface AiProviderCapabilities {
  chat: boolean;
  streaming: boolean;
  structuredOutput: AiStructuredOutputMode;
  advancedWorkflows: boolean;
  checkedAt: number;
  probeVersion: 1;
}

export interface AiConnectionProfileV1 {
  version: 1;
  id: string;
  name: string;
  provider: Exclude<AiProviderKind, 'webllm'>;
  baseUrl: string;
  model: string;
  contextWindow: ExternalAiContextWindow;
  maxOutputTokens: number;
  capabilities: AiProviderCapabilities | null;
}

export type AiRuntimeSelection =
  | {
    version: 2;
    provider: 'webllm';
    model: string;
    contextWindow: 4096 | 8192 | 16384 | 32768;
  }
  | {
    version: 2;
    provider: Exclude<AiProviderKind, 'webllm'>;
    profileId: string;
  };

export interface DesktopChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface DesktopCompletionRequest {
  requestId: number;
  baseUrl: string;
  model: string;
  bearerToken?: string;
  messages: DesktopChatMessage[];
  temperature: number;
  maxTokens: number;
  jsonMode: boolean;
  contextWindow: number;
  locale: Locale;
}

export interface DesktopAiEvent {
  requestId: number;
  type: 'queued' | 'running' | 'first-token' | 'streaming' | 'validating' | 'completed' | 'cancelled' | 'error';
  text: string;
  queueMs?: number;
  firstTokenMs?: number | null;
  inferenceMs?: number;
  completionTokens?: number | null;
  finishReason?: string;
}

export interface DesktopCompletionResult {
  text: string;
  model: string;
  finishReason: string;
  promptTokens: number | null;
  completionTokens: number | null;
  queueMs: number;
  firstTokenMs: number | null;
  inferenceMs: number;
  schemaMode: 'none' | 'json-object';
}

export interface DesktopProbeResult {
  normalizedBaseUrl: string;
  capabilities: AiProviderCapabilities;
}
