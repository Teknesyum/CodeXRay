import type { InitProgressReport } from '@mlc-ai/web-llm';
import type { Locale } from '../i18n/translations';
import type { AssistantMessage } from './aiContext';
import { buildPlannerInstructions, buildTutorInstructions } from './aiContext';
import { sanitizeLocalModelAnswer, splitLocalModelAnswer } from './aiResponse';
import {
  getLocalAiModelDefinition,
  LOCAL_AI_MODELS,
  resolveLocalAgentOutputTokens,
} from './localAiModels';
import type { GodModeAgentRole } from '../types/titan';
import type { LocalAgentResultV2 } from '../types/webSource';
import type {
  AiConnectionProfileV1,
  AiProviderCapabilities,
  AiProviderKind,
  DesktopAiEvent,
  DesktopChatMessage,
} from '../types/aiProvider';
import {
  cancelDesktopCompletion,
  listDesktopModels,
  probeDesktopModel,
  runDesktopCompletion,
} from './desktopAiService';

export { LOCAL_AI_MODELS } from './localAiModels';

interface WorkerResponse {
  id: number;
  type: 'ready' | 'progress' | 'answer' | 'error' | 'cache-status' | 'model-deleted' | 'agent-event' | 'stream-delta';
  text?: string;
  phase?: 'reasoning' | 'answer';
  progress?: InitProgressReport;
  status?: LocalAgentProgress['status'];
  result?: LocalAgentResultV2;
  queueMs?: number;
  firstTokenMs?: number | null;
  inferenceMs?: number;
  completionTokens?: number | null;
  finishReason?: string;
}

interface PendingRequest {
  resolve: (value: never) => void;
  reject: (reason: Error) => void;
  onAgentEvent?: (event: LocalAgentProgress) => void;
  onStream?: (update: LocalModelStreamUpdate) => void;
}

export interface LocalAgentProgress {
  requestId: number;
  status: 'queued' | 'running' | 'first-token' | 'streaming' | 'reasoning-delta' | 'answer-delta' | 'target-exceeded' | 'validating' | 'completed' | 'cancelled';
  text: string;
  queueMs?: number;
  firstTokenMs?: number | null;
  inferenceMs?: number;
  completionTokens?: number | null;
  finishReason?: string;
}

export interface LocalModelAnswer {
  content: string;
  reasoning?: string;
  reasoningTokens?: number | null;
  inferenceMs?: number;
}

export interface LocalModelStreamUpdate {
  type: 'reasoning' | 'answer';
  delta: string;
}

export interface LocalAgentRequest {
  role: GodModeAgentRole;
  instructions: string;
  context: string;
  locale: Locale;
  responseSchema?: Record<string, unknown>;
  jsonMode?: boolean;
  maxTokens?: number;
  temperature?: number;
  queueTimeoutMs?: number;
  inferenceTimeoutMs?: number;
  firstTokenTimeoutMs?: number;
  inactivityTimeoutMs?: number;
  absoluteTimeoutMs?: number;
}

export interface LocalAgentHandle {
  requestId: number;
  promise: Promise<string>;
  cancel: () => void;
}

export interface DetailedLocalAgentHandle {
  requestId: number;
  promise: Promise<LocalAgentResultV2>;
  cancel: () => void;
}

let worker: Worker | undefined;
let requestId = 0;
const pending = new Map<number, PendingRequest>();
let readyModel: string | undefined;
let readyContextWindow: number | undefined;
let activeInteractiveRequestId: number | null = null;

interface ExternalAiSession {
  profile: AiConnectionProfileV1;
  bearerToken: string;
}

let externalSession: ExternalAiSession | null = null;
let selectedProvider: AiProviderKind = 'webllm';
const externalRequestIds = new Set<number>();
let externalGeneration = 0;

export const getActiveAiProvider = (): AiProviderKind => selectedProvider;

export const getActiveAiCapabilities = (): AiProviderCapabilities | null =>
  externalSession?.profile.capabilities ?? null;

export const isActiveAiAdvancedCapable = (modelId: string): boolean =>
  externalSession
    ? externalSession.profile.model === modelId
      && externalSession.profile.capabilities?.advancedWorkflows === true
    : getLocalAiModelDefinition(modelId)?.capabilities.solveWebProblem === true;

export const listExternalAiModels = listDesktopModels;

const activateExternalSession = (
  profile: AiConnectionProfileV1,
  bearerToken: string,
): AiConnectionProfileV1 => {
  worker?.terminate();
  worker = undefined;
  readyModel = profile.model;
  readyContextWindow = profile.contextWindow;
  selectedProvider = profile.provider;
  externalSession = { profile, bearerToken };
  return profile;
};

export const connectExternalAi = async (
  profile: AiConnectionProfileV1,
  bearerToken = '',
): Promise<AiConnectionProfileV1> => {
  const connectionGeneration = ++externalGeneration;
  for (const id of externalRequestIds) void cancelDesktopCompletion(id);
  externalRequestIds.clear();
  const probe = await probeDesktopModel(profile, bearerToken);
  if (connectionGeneration !== externalGeneration) {
    throw new Error('The local AI connection was discarded because the provider changed.');
  }
  if (!probe.capabilities.chat || !probe.capabilities.streaming) {
    throw new Error('The local endpoint did not pass the chat and streaming compatibility checks.');
  }
  const connected = {
    ...profile,
    baseUrl: probe.normalizedBaseUrl,
    capabilities: probe.capabilities,
  };
  return activateExternalSession(connected, bearerToken);
};

export const reconnectExternalAi = (
  profile: AiConnectionProfileV1,
  bearerToken = '',
): AiConnectionProfileV1 => {
  externalGeneration += 1;
  const connected = profile.capabilities ? profile : {
    ...profile,
    capabilities: {
      chat: true,
      streaming: true,
      structuredOutput: 'prompt-only' as const,
      advancedWorkflows: true,
      reasoningOverhead: 0,
      usableOutputTokens: profile.maxOutputTokens,
      checkedAt: Date.now(),
      probeVersion: 2 as const,
    },
  };
  return activateExternalSession(connected, bearerToken);
};

export const disconnectExternalAi = (): void => {
  externalGeneration += 1;
  for (const id of externalRequestIds) void cancelDesktopCompletion(id);
  externalRequestIds.clear();
  externalSession = null;
  selectedProvider = 'webllm';
  readyModel = undefined;
  readyContextWindow = undefined;
  activeInteractiveRequestId = null;
};

export const DEFAULT_AGENT_QUEUE_TIMEOUT_MS = 20_000;
export const DEFAULT_AGENT_FIRST_TOKEN_TIMEOUT_MS = 30_000;
export const DEFAULT_AGENT_INACTIVITY_TIMEOUT_MS = 20_000;
export const DEFAULT_AGENT_SHORT_ABSOLUTE_TIMEOUT_MS = 45_000;
export const DEFAULT_AGENT_LONG_ABSOLUTE_TIMEOUT_MS = 90_000;
const EXTERNAL_AGENT_QUEUE_TIMEOUT_MS = 30_000;
const EXTERNAL_AGENT_FIRST_TOKEN_TIMEOUT_MS = 90_000;
const EXTERNAL_AGENT_INACTIVITY_TIMEOUT_MS = 90_000;
const externalAgentAbsoluteTimeoutMs = (maxTokens: number): number =>
  Math.min(3_600_000, Math.max(1_800_000, (900 + Math.floor(maxTokens / 8)) * 1_000));
/** @deprecated Prefer the phase-specific timeout constants. */
export const DEFAULT_AGENT_INFERENCE_TIMEOUT_MS = DEFAULT_AGENT_FIRST_TOKEN_TIMEOUT_MS;
const LOCAL_MODEL_BUSY_ERROR = 'Local model files are busy in another tab.';

interface LocalModelLockManager {
  request<T>(
    name: string,
    options: { mode: 'exclusive'; ifAvailable: true },
    callback: (lock: unknown | null) => Promise<T>,
  ): Promise<T>;
}

const withExclusiveModelLock = async <T>(model: string, operation: () => Promise<T>): Promise<T> => {
  const locks = typeof navigator === 'undefined'
    ? undefined
    : (navigator as Navigator & { locks?: LocalModelLockManager }).locks;
  if (!locks?.request) return operation();
  return locks.request(
    `codexray.local-model:${model}`,
    { mode: 'exclusive', ifAvailable: true },
    async (lock) => {
      if (!lock) throw new Error(LOCAL_MODEL_BUSY_ERROR);
      return operation();
    },
  );
};

export const isLocalModelBusyError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes(LOCAL_MODEL_BUSY_ERROR);
};

export const isDisposedLocalModelError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);
  return /object has already been disposed|GPU device (?:was )?lost|device lost/i.test(message);
};

export const isRecoverableLocalModelCacheError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);
  return /Unexpected end of JSON input|OPFSStore|invalid metadata|metadata URL does not match/i.test(message);
};

const getWorker = () => {
  if (worker) return worker;
  worker = new Worker(new URL('../workers/localAi.worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
    const response = event.data;
    if (response.type === 'progress') return;
    const request = pending.get(response.id);
    if (!request) return;
    if (response.type === 'stream-delta') {
      request.onStream?.({
        type: response.phase === 'reasoning' ? 'reasoning' : 'answer',
        delta: response.text ?? '',
      });
      return;
    }
    if (response.type === 'agent-event') {
      request.onAgentEvent?.({
        requestId: response.id,
        status: response.status ?? 'running',
        text: response.text ?? '',
        queueMs: response.queueMs,
        firstTokenMs: response.firstTokenMs,
        inferenceMs: response.inferenceMs,
        completionTokens: response.completionTokens,
        finishReason: response.finishReason,
      });
      return;
    }
    pending.delete(response.id);
    if (response.type === 'error') {
      const error = new Error(response.text ?? 'Local model failed.');
      request.reject(error);
      if (isDisposedLocalModelError(error)) resetLocalAi();
    } else request.resolve((response.result ?? response.text ?? '') as never);
  };
  worker.onerror = (event) => {
    for (const request of pending.values()) request.reject(new Error(event.message));
    pending.clear();
    worker?.terminate();
    worker = undefined;
    readyModel = undefined;
    readyContextWindow = undefined;
  };
  return worker;
};

export const supportsLocalAi = async (): Promise<boolean> => {
  if (typeof Worker === 'undefined' || typeof navigator === 'undefined') return false;
  const gpu = (navigator as Navigator & {
    gpu?: { requestAdapter: () => Promise<unknown> };
  }).gpu;
  if (!gpu) return false;
  try {
    return Boolean(await gpu.requestAdapter());
  } catch {
    return false;
  }
};

export const isLocalModelCached = (model: string): Promise<boolean> => {
  if (typeof Worker === 'undefined') return Promise.resolve(false);
  const currentWorker = getWorker();
  const id = ++requestId;
  return new Promise<string>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    currentWorker.postMessage({ id, type: 'cache-status', model });
  }).then((status) => status === 'cached');
};

export const getCachedLocalModels = async (): Promise<string[]> => {
  const statuses = await Promise.all(
    LOCAL_AI_MODELS.map(async (model) => ({
      id: model.id,
      cached: await isLocalModelCached(model.id),
    })),
  );
  return statuses.filter((status) => status.cached).map((status) => status.id);
};

export const getPersistentStorageStatus = async (): Promise<boolean | null> => {
  if (typeof navigator === 'undefined' || !navigator.storage?.persisted) return null;
  try {
    return await navigator.storage.persisted();
  } catch {
    return null;
  }
};

export const requestPersistentLocalAiStorage = async (): Promise<boolean | null> => {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return null;
  try {
    return await navigator.storage.persist();
  } catch {
    return null;
  }
};

export const initializeLocalAi = async (
  model: string,
  contextWindow: number,
  onProgress: (progress: InitProgressReport) => void,
): Promise<void> => {
  externalSession = null;
  selectedProvider = 'webllm';
  if (!await supportsLocalAi()) {
    throw new Error('WebGPU is not available in this browser.');
  }
  await requestPersistentLocalAiStorage();
  return withExclusiveModelLock(model, async () => {
    if (readyModel === model && readyContextWindow === contextWindow) return;
    const currentWorker = getWorker();
    const id = ++requestId;
    const progressHandler = (event: MessageEvent<WorkerResponse>) => {
      if (event.data.id === id && event.data.type === 'progress') {
        onProgress(event.data.progress ?? {
          progress: 0,
          timeElapsed: 0,
          text: 'Loading local model…',
        });
      }
    };
    currentWorker.addEventListener('message', progressHandler);
    return new Promise<string>((resolve, reject) => {
      pending.set(id, { resolve, reject });
      currentWorker.postMessage({ id, type: 'initialize', model, contextWindow });
    }).then(() => {
      readyModel = model;
      readyContextWindow = contextWindow;
    }).catch((error) => {
      // A failed WebLLM initialization can leave its worker-level loader in a
      // poisoned state. Preserve downloaded artifacts, but always recreate the
      // worker before the next attempt.
      if (worker === currentWorker) {
        currentWorker.terminate();
        worker = undefined;
        readyModel = undefined;
        readyContextWindow = undefined;
      }
      throw error;
    }).finally(() => {
      currentWorker.removeEventListener('message', progressHandler);
    });
  });
};

const mergeExternalContinuation = (answer: string, continuation: string): string => {
  const left = answer.trimEnd();
  const right = continuation.trimStart();
  const maximumOverlap = Math.min(left.length, right.length, 2_000);
  for (let overlap = maximumOverlap; overlap >= 16; overlap -= 1) {
    if (left.slice(-overlap) === right.slice(0, overlap)) {
      return `${left}${right.slice(overlap)}`;
    }
  }
  return `${left}\n\n${right}`;
};

const requireExternalSession = (): ExternalAiSession => {
  if (!externalSession) throw new Error('Connect a desktop local AI provider from Settings first.');
  return externalSession;
};

const runExternalRequest = (
  id: number,
  messages: DesktopChatMessage[],
  locale: Locale,
  options: { temperature: number; maxTokens: number; jsonMode?: boolean },
  onEvent?: (event: DesktopAiEvent) => void,
) => {
  const session = requireExternalSession();
  const generation = externalGeneration;
  externalRequestIds.add(id);
  return runDesktopCompletion({
    requestId: id,
    baseUrl: session.profile.baseUrl,
    model: session.profile.model,
    bearerToken: session.bearerToken || undefined,
    messages,
    temperature: options.temperature,
    maxTokens: Math.min(options.maxTokens, session.profile.maxOutputTokens),
    jsonMode: Boolean(options.jsonMode
      && session.profile.capabilities?.structuredOutput === 'native'),
    contextWindow: session.profile.contextWindow,
    locale,
  }, onEvent).then((result) => {
    if (generation !== externalGeneration) {
      throw new Error('The local AI response was discarded because the provider changed.');
    }
    return result;
  }).finally(() => externalRequestIds.delete(id));
};

const externalConversation = async (
  id: number,
  question: string,
  context: string,
  history: Array<Pick<AssistantMessage, 'role' | 'content'>>,
  locale: Locale,
  onStream?: (update: LocalModelStreamUpdate) => void,
): Promise<LocalModelAnswer> => {
  const session = requireExternalSession();
  const messages: DesktopChatMessage[] = [
    { role: 'system', content: buildTutorInstructions(locale) },
    ...history
      .filter((item) => item.role === 'user' || item.role === 'ai')
      .map((item): DesktopChatMessage => ({
        role: item.role === 'ai' ? 'assistant' : 'user',
        content: item.content,
      })),
    { role: 'user', content: `${context}\n\nQuestion: ${question}` },
  ];
  const first = await runExternalRequest(id, messages, locale, {
    temperature: 0.15,
    maxTokens: session.profile.maxOutputTokens,
  }, (event) => {
    if (event.type === 'reasoning-delta') onStream?.({ type: 'reasoning', delta: event.text });
    if (event.type === 'answer-delta') onStream?.({ type: 'answer', delta: event.text });
  });
  let answer = first.text;
  let reasoning = first.reasoning;
  let reasoningTokens = first.reasoningTokens;
  let inferenceMs = first.inferenceMs;
  if (first.finishReason === 'length' && answer.trim()) {
    const continuation = await runExternalRequest(id, [
      ...messages,
      { role: 'assistant', content: answer },
      {
        role: 'user',
        content: 'Continue exactly where the answer stopped. Do not repeat earlier text. Finish concisely.',
      },
    ], locale, {
      temperature: 0.1,
      maxTokens: Math.max(256, Math.floor(session.profile.maxOutputTokens / 2)),
    }, (event) => {
      if (event.type === 'reasoning-delta') onStream?.({ type: 'reasoning', delta: event.text });
      if (event.type === 'answer-delta') onStream?.({ type: 'answer', delta: event.text });
    });
    if (continuation.text.trim()) answer = mergeExternalContinuation(answer, continuation.text);
    if (continuation.reasoning.trim()) {
      reasoning = reasoning.trim()
        ? `${reasoning.trim()}\n\n${continuation.reasoning.trim()}`
        : continuation.reasoning;
    }
    reasoningTokens = (reasoningTokens ?? 0) + (continuation.reasoningTokens ?? 0) || null;
    inferenceMs += continuation.inferenceMs;
    if (continuation.finishReason === 'length') {
      answer += locale === 'tr'
        ? '\n\n[Yanıt yerel üretim sınırına ulaştı.]'
        : '\n\n[The response reached the local generation limit.]';
    }
  }
  return { content: answer, reasoning, reasoningTokens, inferenceMs };
};

export const askLocalModelDetailed = (
  question: string,
  context: string,
  history: Array<Pick<AssistantMessage, 'role' | 'content'>>,
  locale: Locale,
  onStream?: (update: LocalModelStreamUpdate) => void,
): Promise<LocalModelAnswer> => {
  if (externalSession) {
    const id = ++requestId;
    activeInteractiveRequestId = id;
    return externalConversation(id, question, context, history, locale, onStream).then((result) => {
      const cleaned = sanitizeLocalModelAnswer(result.content);
      if (!cleaned) throw new Error('The local model did not produce a safe visible answer.');
      return { ...result, content: cleaned, reasoning: result.reasoning?.trim() || undefined };
    }).finally(() => {
      if (activeInteractiveRequestId === id) activeInteractiveRequestId = null;
    });
  }
  if (!worker || !readyModel) {
    return Promise.reject(new Error('Load a local AI model from Settings before asking questions.'));
  }
  const id = ++requestId;
  activeInteractiveRequestId = id;
  return new Promise<string>((resolve, reject) => {
    pending.set(id, { resolve, reject, onStream });
    worker?.postMessage({ id, type: 'generate', question, context, history, locale });
  }).then((answer) => {
    const split = splitLocalModelAnswer(answer);
    if (!split.content) {
      throw new Error(locale === 'tr'
        ? 'Yerel model güvenli ve görünür bir cevap üretmedi. Lütfen tekrar deneyin.'
        : 'The local model did not produce a safe visible answer. Please try again.');
    }
    return { content: split.content, reasoning: split.reasoning || undefined };
  }).finally(() => {
    if (activeInteractiveRequestId === id) activeInteractiveRequestId = null;
  });
};

export const askLocalModel = (
  question: string,
  context: string,
  history: Array<Pick<AssistantMessage, 'role' | 'content'>>,
  locale: Locale,
): Promise<string> => {
  return askLocalModelDetailed(question, context, history, locale).then((result) => result.content);
};

export const planLocalActions = (
  question: string,
  context: string,
): Promise<string> => {
  if (externalSession) {
    const id = ++requestId;
    activeInteractiveRequestId = id;
    const parsed = JSON.parse(context) as { steps?: unknown };
    const maximumStep = typeof parsed.steps === 'number' && parsed.steps > 0
      ? Math.floor(parsed.steps)
      : 1;
    const schemaHint = `Return JSON with an actions array of at most 3 items. A jump action needs an integer step from 1 to ${maximumStep}; other allowed action types are play, pause, next, previous, next-important, previous-important, and tour.`;
    return runExternalRequest(id, [
      { role: 'system', content: `${buildPlannerInstructions()}\n${schemaHint}` },
      { role: 'user', content: `${context}\n\nQuestion: ${question}` },
    ], 'en', { temperature: 0, maxTokens: 160, jsonMode: true }).then((result) => result.text)
      .finally(() => {
        if (activeInteractiveRequestId === id) activeInteractiveRequestId = null;
      });
  }
  if (!worker || !readyModel) {
    return Promise.reject(new Error('Load a local AI model from Settings before asking questions.'));
  }
  const id = ++requestId;
  activeInteractiveRequestId = id;
  return new Promise<string>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    worker?.postMessage({ id, type: 'plan', question, context });
  }).finally(() => {
    if (activeInteractiveRequestId === id) activeInteractiveRequestId = null;
  });
};

export const cancelLocalResponse = (): boolean => {
  const id = activeInteractiveRequestId;
  if (id === null) return false;
  if (externalSession) {
    activeInteractiveRequestId = null;
    void cancelDesktopCompletion(id);
    return true;
  }
  if (!worker) return false;
  activeInteractiveRequestId = null;
  const request = pending.get(id);
  pending.delete(id);
  request?.reject(new Error('Local AI response was interrupted.'));
  worker.postMessage({ id, type: 'agent-cancel' });
  return true;
};

const runExternalAgentDetailed = (
  request: LocalAgentRequest,
  onProgress?: (progress: LocalAgentProgress) => void,
): DetailedLocalAgentHandle => {
  if (!externalSession) {
    return {
      requestId: -1,
      promise: Promise.reject(new Error('Connect a desktop local AI provider before running agents.')),
      cancel: () => undefined,
    };
  }
  const session = externalSession;
  const id = ++requestId;
  const expectsJson = Boolean(request.responseSchema || request.jsonMode);
  const queueTimeoutMs = request.queueTimeoutMs ?? EXTERNAL_AGENT_QUEUE_TIMEOUT_MS;
  const firstTokenTimeoutMs = request.firstTokenTimeoutMs ?? request.inferenceTimeoutMs
    ?? EXTERNAL_AGENT_FIRST_TOKEN_TIMEOUT_MS;
  const inactivityTimeoutMs = request.inactivityTimeoutMs ?? request.inferenceTimeoutMs
    ?? EXTERNAL_AGENT_INACTIVITY_TIMEOUT_MS;
  const requestedMaxTokens = Math.min(
    request.maxTokens ?? session.profile.maxOutputTokens,
    session.profile.maxOutputTokens,
  );
  // Agent contracts describe the desired payload size. Reasoning endpoints also
  // count their hidden trace against max_tokens, so reserve room for that trace
  // without weakening the user's profile/context safety boundaries.
  const structuredOutputFloor = session.profile.contextWindow >= 131_072
    ? 16_384
    : session.profile.contextWindow >= 65_536
      ? 8_192
      : session.profile.contextWindow >= 32_768
        ? 4_096
        : 2_048;
  const maxTokens = expectsJson
    ? Math.min(session.profile.maxOutputTokens, Math.max(requestedMaxTokens, structuredOutputFloor))
    : requestedMaxTokens;
  const retryMaxTokens = Math.min(
    session.profile.maxOutputTokens,
    Math.max(maxTokens * 2, 4_096),
  );
  const absoluteTimeoutMs = request.absoluteTimeoutMs ?? request.inferenceTimeoutMs
    ?? externalAgentAbsoluteTimeoutMs(maxTokens);
  let settled = false;
  let phaseTimer: ReturnType<typeof globalThis.setTimeout>;
  let absoluteTimer: ReturnType<typeof globalThis.setTimeout> | undefined;
  let targetTimer: ReturnType<typeof globalThis.setTimeout> | undefined;
  let rejectPromise: ((reason: Error) => void) | undefined;

  const clearTimers = () => {
    globalThis.clearTimeout(phaseTimer);
    if (absoluteTimer) globalThis.clearTimeout(absoluteTimer);
    if (targetTimer) globalThis.clearTimeout(targetTimer);
  };
  const cancel = (message = 'Local AI agent was cancelled.') => {
    if (settled) return;
    settled = true;
    clearTimers();
    void cancelDesktopCompletion(id);
    rejectPromise?.(new Error(message));
  };
  const armInactivity = () => {
    globalThis.clearTimeout(phaseTimer);
    phaseTimer = globalThis.setTimeout(() => {
      cancel(`Local AI ${request.role} agent stopped producing output for ${Math.round(inactivityTimeoutMs / 1_000)} seconds.`);
    }, inactivityTimeoutMs);
  };
  const schemaText = request.responseSchema ? JSON.stringify(request.responseSchema) : '';
  const systemContent = [
    `You are the isolated CodeXRay ${request.role} specialist.`,
    request.instructions,
    'Use only supplied workspace state and artifacts. Never claim that application state changed.',
    expectsJson
      ? `Return exactly one JSON object${schemaText ? ` matching this schema: ${schemaText}` : ''}. Do not use markdown. Write human-readable strings in ${request.locale === 'tr' ? 'Turkish' : 'English'}.`
      : `Match answer depth to the task and respond completely in ${request.locale === 'tr' ? 'Turkish' : 'English'}.`,
  ].join('\n');
  const promptBudget = Math.max(
    900,
    (session.profile.contextWindow - retryMaxTokens - 420) * 2 - systemContent.length,
  );
  const boundedContext = request.context.length <= promptBudget
    ? request.context
    : `${request.context.slice(0, Math.floor(promptBudget * 0.72))}\n[Context shortened]\n${request.context.slice(-Math.floor(promptBudget * 0.28))}`;

  const baseMessages: DesktopChatMessage[] = [
    { role: 'system', content: systemContent },
    { role: 'user', content: boundedContext },
  ];
  const handleEvent = (event: DesktopAiEvent) => {
    if (settled) return;
    if (event.type === 'reasoning-delta' || event.type === 'answer-delta') {
      armInactivity();
      onProgress?.({
        requestId: id,
        status: event.type,
        text: event.text,
      });
      return;
    }
    // Native completion fires before we can decide whether a reasoning-only
    // length stop needs a retry. Publish the terminal event only once below.
    if (event.type !== 'error' && event.type !== 'completed') {
      onProgress?.({
        requestId: id,
        status: event.type,
        text: event.text,
        queueMs: event.queueMs,
        firstTokenMs: event.firstTokenMs,
        inferenceMs: event.inferenceMs,
        completionTokens: event.completionTokens,
        finishReason: event.finishReason,
      });
    }
    if (event.type === 'running') {
      globalThis.clearTimeout(phaseTimer);
      phaseTimer = globalThis.setTimeout(() => {
        cancel(`Local AI ${request.role} agent produced no first token within ${Math.round(firstTokenTimeoutMs / 1_000)} seconds.`);
      }, firstTokenTimeoutMs);
      absoluteTimer = globalThis.setTimeout(() => {
        cancel(`Local AI ${request.role} agent reached its ${Math.round(absoluteTimeoutMs / 1_000)} second absolute limit.`);
      }, absoluteTimeoutMs);
      targetTimer = globalThis.setTimeout(() => {
        onProgress?.({
          requestId: id,
          status: 'target-exceeded',
          text: 'The 20 second performance target was exceeded; the local model is still working.',
        });
      }, 20_000);
    } else if (event.type === 'first-token' || event.type === 'streaming') {
      armInactivity();
    } else if (event.type === 'validating' || event.type === 'completed') {
      globalThis.clearTimeout(phaseTimer);
    }
  };
  const execute = (
    messages: DesktopChatMessage[],
    outputTokens: number,
  ) => runExternalRequest(id, messages, request.locale, {
    temperature: request.temperature ?? (expectsJson ? 0 : 0.12),
    maxTokens: outputTokens,
    jsonMode: expectsJson,
  }, handleEvent);

  const operation = (async () => {
    const first = await execute(baseMessages, maxTokens);
    if (first.text.trim() || first.finishReason !== 'length' || !first.reasoning.trim()) {
      return first;
    }
    onProgress?.({
      requestId: id,
      status: 'running',
      text: retryMaxTokens > maxTokens
        ? `The reasoning model used its first ${maxTokens}-token budget before the final answer. Retrying with ${retryMaxTokens} tokens.`
        : `The reasoning model used the full ${maxTokens}-token output limit before the final answer. Retrying once with a compact-answer instruction.`,
    });
    const retryMessages: DesktopChatMessage[] = [
      ...baseMessages,
      {
        role: 'user',
        content: expectsJson
          ? 'Return the final JSON object now. Keep internal reasoning brief and spend the available budget on the complete schema-valid JSON. Do not use markdown.'
          : 'Return the final answer now. Keep internal reasoning brief and answer completely and concisely.',
      },
    ];
    const retry = await execute(retryMessages, retryMaxTokens);
    if (!retry.text.trim()) {
      throw new Error(
        retry.finishReason === 'length'
          ? `The reasoning model used the entire ${retryMaxTokens}-token output limit before producing the final answer. Increase the profile output limit in AI Settings and retry.`
          : 'Local AI stream completed without visible content.',
      );
    }
    return retry;
  })();

  const promise = new Promise<LocalAgentResultV2>((resolve, reject) => {
    rejectPromise = reject;
    operation.then((result) => {
      if (settled) return;
      settled = true;
      clearTimers();
      onProgress?.({
        requestId: id,
        status: 'completed',
        text: 'Local inference completed.',
        queueMs: result.queueMs,
        firstTokenMs: result.firstTokenMs,
        inferenceMs: result.inferenceMs,
        completionTokens: result.completionTokens,
        finishReason: result.finishReason,
      });
      resolve({
        version: 2,
        text: result.text || (expectsJson ? '{}' : ''),
        finishReason: result.finishReason,
        model: session.profile.model,
        contextWindow: session.profile.contextWindow,
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        queueMs: result.queueMs,
        firstTokenMs: result.firstTokenMs,
        inferenceMs: result.inferenceMs,
        schemaMode: expectsJson
          ? session.profile.capabilities?.structuredOutput === 'native' ? 'json-object' : 'none'
          : 'none',
      });
    }).catch((error) => {
      if (settled) return;
      settled = true;
      clearTimers();
      reject(error instanceof Error ? error : new Error(String(error)));
    });
  });
  phaseTimer = globalThis.setTimeout(() => {
    cancel(`Local AI ${request.role} agent timed out in the queue after ${Math.round(queueTimeoutMs / 1_000)} seconds.`);
  }, queueTimeoutMs);
  return { requestId: id, promise, cancel: () => cancel() };
};

export const runLocalAgent = (
  request: LocalAgentRequest,
  onProgress?: (progress: LocalAgentProgress) => void,
): LocalAgentHandle => {
  if (externalSession) {
    const handle = runExternalAgentDetailed(request, onProgress);
    return {
      requestId: handle.requestId,
      promise: handle.promise.then((result) => result.text),
      cancel: handle.cancel,
    };
  }
  if (!worker || !readyModel) {
    return {
      requestId: -1,
      promise: Promise.reject(new Error('Load a local AI model from Settings before running God Mode agents.')),
      cancel: () => undefined,
    };
  }
  const id = ++requestId;
  const definition = getLocalAiModelDefinition(readyModel);
  const profile = definition?.agentTimeouts;
  const queueTimeoutMs = request.queueTimeoutMs ?? profile?.queueMs ?? DEFAULT_AGENT_QUEUE_TIMEOUT_MS;
  const legacyInferenceTimeoutMs = request.inferenceTimeoutMs;
  const firstTokenTimeoutMs = request.firstTokenTimeoutMs ?? legacyInferenceTimeoutMs
    ?? profile?.firstTokenMs ?? DEFAULT_AGENT_FIRST_TOKEN_TIMEOUT_MS;
  const inactivityTimeoutMs = request.inactivityTimeoutMs ?? legacyInferenceTimeoutMs
    ?? profile?.inactivityMs ?? DEFAULT_AGENT_INACTIVITY_TIMEOUT_MS;
  const effectiveOutputTokens = resolveLocalAgentOutputTokens(
    definition,
    request.maxTokens,
    Boolean(request.responseSchema || request.jsonMode),
    readyContextWindow,
  );
  const absoluteTimeoutMs = request.absoluteTimeoutMs ?? legacyInferenceTimeoutMs
    ?? (effectiveOutputTokens <= 260
      ? profile?.shortAbsoluteMs ?? DEFAULT_AGENT_SHORT_ABSOLUTE_TIMEOUT_MS
      : profile?.longAbsoluteMs ?? DEFAULT_AGENT_LONG_ABSOLUTE_TIMEOUT_MS);
  let phase: 'queue' | 'first-token' | 'streaming' | 'validating' = 'queue';
  let phaseTimeout: ReturnType<typeof globalThis.setTimeout>;
  let absoluteTimeout: ReturnType<typeof globalThis.setTimeout> | undefined;
  let targetTimeout: ReturnType<typeof globalThis.setTimeout> | undefined;
  const clearTimers = () => {
    globalThis.clearTimeout(phaseTimeout);
    if (absoluteTimeout) globalThis.clearTimeout(absoluteTimeout);
    if (targetTimeout) globalThis.clearTimeout(targetTimeout);
  };
  const cancelRequest = (message: string) => {
    const activeRequest = pending.get(id);
    if (!activeRequest) return;
    pending.delete(id);
    clearTimers();
    activeRequest.reject(new Error(message));
    worker?.postMessage({ id, type: 'agent-cancel' });
  };
  const armInactivityTimeout = () => {
    globalThis.clearTimeout(phaseTimeout);
    phaseTimeout = globalThis.setTimeout(() => {
      cancelRequest(`God Mode ${request.role} agent stopped producing output for ${Math.round(inactivityTimeoutMs / 1_000)} seconds.`);
    }, inactivityTimeoutMs);
  };
  const basePromise = new Promise<string>((resolve, reject) => {
    pending.set(id, {
      resolve: ((value: string | LocalAgentResultV2) => resolve(
        typeof value === 'string' ? value : value.text,
      )) as (value: never) => void,
      reject,
      onAgentEvent: (progress) => {
        onProgress?.(progress);
        if (progress.status === 'running' && phase === 'queue') {
          phase = 'first-token';
          globalThis.clearTimeout(phaseTimeout);
          phaseTimeout = globalThis.setTimeout(() => {
            cancelRequest(`God Mode ${request.role} agent produced no first token within ${Math.round(firstTokenTimeoutMs / 1_000)} seconds.`);
          }, firstTokenTimeoutMs);
          absoluteTimeout = globalThis.setTimeout(() => {
            cancelRequest(`God Mode ${request.role} agent reached its ${Math.round(absoluteTimeoutMs / 1_000)} second absolute limit.`);
          }, absoluteTimeoutMs);
          targetTimeout = globalThis.setTimeout(() => {
            onProgress?.({
              requestId: id,
              status: 'target-exceeded',
              text: 'The 20 second performance target was exceeded; the local model is still working.',
            });
          }, 20_000);
        } else if (progress.status === 'first-token' || progress.status === 'streaming') {
          phase = 'streaming';
          armInactivityTimeout();
        } else if (progress.status === 'validating' || progress.status === 'completed') {
          phase = 'validating';
          globalThis.clearTimeout(phaseTimeout);
        }
      },
    });
    worker?.postMessage({ id, type: 'agent-run', ...request });
  });
  phaseTimeout = globalThis.setTimeout(() => {
    cancelRequest(`God Mode ${request.role} agent timed out in the WebGPU queue after ${Math.round(queueTimeoutMs / 1_000)} seconds.`);
  }, queueTimeoutMs);
  const promise = basePromise.finally(clearTimers);
  return {
    requestId: id,
    promise,
    cancel: () => cancelRequest('God Mode agent was cancelled.'),
  };
};

export const runLocalAgentDetailed = (
  request: LocalAgentRequest,
  onProgress?: (progress: LocalAgentProgress) => void,
): DetailedLocalAgentHandle => {
  if (externalSession) return runExternalAgentDetailed(request, onProgress);
  if (!worker || !readyModel) {
    return {
      requestId: -1,
      promise: Promise.reject(new Error('Load a solve-capable local AI model before running web problem agents.')),
      cancel: () => undefined,
    };
  }
  const id = ++requestId;
  const definition = getLocalAiModelDefinition(readyModel);
  const profile = definition?.agentTimeouts;
  const queueTimeoutMs = request.queueTimeoutMs ?? profile?.queueMs ?? DEFAULT_AGENT_QUEUE_TIMEOUT_MS;
  const legacyInferenceTimeoutMs = request.inferenceTimeoutMs;
  const firstTokenTimeoutMs = request.firstTokenTimeoutMs ?? legacyInferenceTimeoutMs
    ?? profile?.firstTokenMs ?? DEFAULT_AGENT_FIRST_TOKEN_TIMEOUT_MS;
  const inactivityTimeoutMs = request.inactivityTimeoutMs ?? legacyInferenceTimeoutMs
    ?? profile?.inactivityMs ?? DEFAULT_AGENT_INACTIVITY_TIMEOUT_MS;
  const effectiveOutputTokens = resolveLocalAgentOutputTokens(
    definition,
    request.maxTokens,
    Boolean(request.responseSchema || request.jsonMode),
    readyContextWindow,
  );
  const absoluteTimeoutMs = request.absoluteTimeoutMs ?? legacyInferenceTimeoutMs
    ?? (effectiveOutputTokens <= 260
      ? profile?.shortAbsoluteMs ?? DEFAULT_AGENT_SHORT_ABSOLUTE_TIMEOUT_MS
      : profile?.longAbsoluteMs ?? DEFAULT_AGENT_LONG_ABSOLUTE_TIMEOUT_MS);
  let phase: 'queue' | 'first-token' | 'streaming' | 'validating' = 'queue';
  let phaseTimeout: ReturnType<typeof globalThis.setTimeout>;
  let absoluteTimeout: ReturnType<typeof globalThis.setTimeout> | undefined;
  let targetTimeout: ReturnType<typeof globalThis.setTimeout> | undefined;
  const clearTimers = () => {
    globalThis.clearTimeout(phaseTimeout);
    if (absoluteTimeout) globalThis.clearTimeout(absoluteTimeout);
    if (targetTimeout) globalThis.clearTimeout(targetTimeout);
  };
  const cancelRequest = (message: string) => {
    const activeRequest = pending.get(id);
    if (!activeRequest) return;
    pending.delete(id);
    clearTimers();
    activeRequest.reject(new Error(message));
    worker?.postMessage({ id, type: 'agent-cancel' });
  };
  const armInactivityTimeout = () => {
    globalThis.clearTimeout(phaseTimeout);
    phaseTimeout = globalThis.setTimeout(() => {
      cancelRequest(`Web problem ${request.role} agent stopped producing output for ${Math.round(inactivityTimeoutMs / 1_000)} seconds.`);
    }, inactivityTimeoutMs);
  };
  const basePromise = new Promise<LocalAgentResultV2>((resolve, reject) => {
    pending.set(id, {
      resolve: resolve as (value: never) => void,
      reject,
      onAgentEvent: (progress) => {
        onProgress?.(progress);
        if (progress.status === 'running' && phase === 'queue') {
          phase = 'first-token';
          globalThis.clearTimeout(phaseTimeout);
          phaseTimeout = globalThis.setTimeout(() => {
            cancelRequest(`Web problem ${request.role} agent produced no first token within ${Math.round(firstTokenTimeoutMs / 1_000)} seconds.`);
          }, firstTokenTimeoutMs);
          absoluteTimeout = globalThis.setTimeout(() => {
            cancelRequest(`Web problem ${request.role} agent reached its ${Math.round(absoluteTimeoutMs / 1_000)} second absolute limit.`);
          }, absoluteTimeoutMs);
          targetTimeout = globalThis.setTimeout(() => {
            onProgress?.({
              requestId: id,
              status: 'target-exceeded',
              text: 'The 20 second performance target was exceeded; the local model is still working.',
            });
          }, 20_000);
        } else if (progress.status === 'first-token' || progress.status === 'streaming') {
          phase = 'streaming';
          armInactivityTimeout();
        } else if (progress.status === 'validating' || progress.status === 'completed') {
          phase = 'validating';
          globalThis.clearTimeout(phaseTimeout);
        }
      },
    });
    worker?.postMessage({ id, type: 'agent-run', detailed: true, ...request });
  });
  phaseTimeout = globalThis.setTimeout(() => {
    cancelRequest(`Web problem ${request.role} agent timed out in the WebGPU queue after ${Math.round(queueTimeoutMs / 1_000)} seconds.`);
  }, queueTimeoutMs);
  return {
    requestId: id,
    promise: basePromise.finally(clearTimers),
    cancel: () => cancelRequest('Web problem agent was cancelled.'),
  };
};

const deleteLocalModelUnlocked = async (model: string): Promise<void> => {
  if (readyModel === model) resetLocalAi();
  if (typeof Worker === 'undefined') return;
  const currentWorker = getWorker();
  const id = ++requestId;
  await new Promise<string>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    currentWorker.postMessage({ id, type: 'delete-model', model });
  });
};

export const deleteLocalModel = (model: string): Promise<void> =>
  withExclusiveModelLock(model, () => deleteLocalModelUnlocked(model));

export const repairLocalModel = (model: string): Promise<void> =>
  withExclusiveModelLock(model, async () => {
    resetLocalAi();
    await deleteLocalModelUnlocked(model);
  });

export const resetLocalAi = () => {
  externalGeneration += 1;
  for (const id of externalRequestIds) void cancelDesktopCompletion(id);
  externalRequestIds.clear();
  externalSession = null;
  selectedProvider = 'webllm';
  worker?.terminate();
  worker = undefined;
  readyModel = undefined;
  readyContextWindow = undefined;
  activeInteractiveRequestId = null;
  for (const request of pending.values()) request.reject(new Error('Local model was reset.'));
  pending.clear();
};
