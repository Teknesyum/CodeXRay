import type { InitProgressReport } from '@mlc-ai/web-llm';
import type { Locale } from '../i18n/translations';
import type { AssistantMessage } from './aiContext';
import { sanitizeLocalModelAnswer } from './aiResponse';
import { LOCAL_AI_MODELS } from './localAiModels';
import type { GodModeAgentRole } from '../types/godMode';

export { LOCAL_AI_MODELS } from './localAiModels';

interface WorkerResponse {
  id: number;
  type: 'ready' | 'progress' | 'answer' | 'error' | 'cache-status' | 'model-deleted' | 'agent-event';
  text?: string;
  progress?: InitProgressReport;
  status?: 'queued' | 'running' | 'cancelled';
}

interface PendingRequest {
  resolve: (value: string) => void;
  reject: (reason: Error) => void;
  onAgentEvent?: (event: LocalAgentProgress) => void;
}

export interface LocalAgentProgress {
  requestId: number;
  status: 'queued' | 'running' | 'cancelled';
  text: string;
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
}

export interface LocalAgentHandle {
  requestId: number;
  promise: Promise<string>;
  cancel: () => void;
}

let worker: Worker | undefined;
let requestId = 0;
const pending = new Map<number, PendingRequest>();
let readyModel: string | undefined;
let readyContextWindow: number | undefined;
let activeInteractiveRequestId: number | null = null;

const getWorker = () => {
  if (worker) return worker;
  worker = new Worker(new URL('../workers/localAi.worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
    const response = event.data;
    if (response.type === 'progress') return;
    const request = pending.get(response.id);
    if (!request) return;
    if (response.type === 'agent-event') {
      request.onAgentEvent?.({
        requestId: response.id,
        status: response.status ?? 'running',
        text: response.text ?? '',
      });
      return;
    }
    pending.delete(response.id);
    if (response.type === 'error') request.reject(new Error(response.text ?? 'Local model failed.'));
    else request.resolve(response.text ?? '');
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
  if (!await supportsLocalAi()) {
    throw new Error('WebGPU is not available in this browser.');
  }
  await requestPersistentLocalAiStorage();
  if (readyModel === model && readyContextWindow === contextWindow) return Promise.resolve();
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
  }).finally(() => {
    currentWorker.removeEventListener('message', progressHandler);
  });
};

export const askLocalModel = (
  question: string,
  context: string,
  history: Array<Pick<AssistantMessage, 'role' | 'content'>>,
  locale: Locale,
): Promise<string> => {
  if (!worker || !readyModel) {
    return Promise.reject(new Error('Load a local AI model from Settings before asking questions.'));
  }
  const id = ++requestId;
  activeInteractiveRequestId = id;
  return new Promise<string>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    worker?.postMessage({ id, type: 'generate', question, context, history, locale });
  }).then((answer) => {
    const cleaned = sanitizeLocalModelAnswer(answer);
    if (!cleaned) {
      throw new Error(locale === 'tr'
        ? 'Yerel model güvenli ve görünür bir cevap üretmedi. Lütfen tekrar deneyin.'
        : 'The local model did not produce a safe visible answer. Please try again.');
    }
    return cleaned;
  }).finally(() => {
    if (activeInteractiveRequestId === id) activeInteractiveRequestId = null;
  });
};

export const planLocalActions = (
  question: string,
  context: string,
): Promise<string> => {
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
  if (id === null || !worker) return false;
  activeInteractiveRequestId = null;
  const request = pending.get(id);
  pending.delete(id);
  request?.reject(new Error('Local AI response was interrupted.'));
  worker.postMessage({ id, type: 'agent-cancel' });
  return true;
};

export const runLocalAgent = (
  request: LocalAgentRequest,
  onProgress?: (progress: LocalAgentProgress) => void,
): LocalAgentHandle => {
  if (!worker || !readyModel) {
    return {
      requestId: -1,
      promise: Promise.reject(new Error('Load a local AI model from Settings before running God Mode agents.')),
      cancel: () => undefined,
    };
  }
  const id = ++requestId;
  const timeoutMs = Math.min(
    120_000,
    Math.max(30_000, 20_000 + (request.maxTokens ?? 500) * 60),
  );
  const basePromise = new Promise<string>((resolve, reject) => {
    pending.set(id, { resolve, reject, onAgentEvent: onProgress });
    worker?.postMessage({ id, type: 'agent-run', ...request });
  });
  const cancelRequest = (message: string) => {
    const activeRequest = pending.get(id);
    if (!activeRequest) return;
    pending.delete(id);
    activeRequest.reject(new Error(message));
    worker?.postMessage({ id, type: 'agent-cancel' });
  };
  const timeout = globalThis.setTimeout(() => {
    cancelRequest(`God Mode ${request.role} agent timed out after ${Math.round(timeoutMs / 1_000)} seconds.`);
  }, timeoutMs);
  const promise = basePromise.finally(() => globalThis.clearTimeout(timeout));
  return {
    requestId: id,
    promise,
    cancel: () => cancelRequest('God Mode agent was cancelled.'),
  };
};

export const deleteLocalModel = async (model: string): Promise<void> => {
  if (readyModel === model) resetLocalAi();
  if (typeof Worker === 'undefined') return;
  const currentWorker = getWorker();
  const id = ++requestId;
  await new Promise<string>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    currentWorker.postMessage({ id, type: 'delete-model', model });
  });
};

export const resetLocalAi = () => {
  worker?.terminate();
  worker = undefined;
  readyModel = undefined;
  readyContextWindow = undefined;
  activeInteractiveRequestId = null;
  for (const request of pending.values()) request.reject(new Error('Local model was reset.'));
  pending.clear();
};
