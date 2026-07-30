import type { InitProgressReport } from '@mlc-ai/web-llm';
import type { Locale } from '../i18n/translations';
import type { AssistantMessage } from './aiContext';
import { sanitizeLocalModelAnswer } from './aiResponse';

export const LOCAL_AI_MODELS = [
  {
    id: 'Qwen2.5-Coder-0.5B-Instruct-q4f32_1-MLC',
    label: 'Qwen2.5 Coder 0.5B (default, faster)',
    vramMb: 1061,
  },
  {
    id: 'Qwen2.5-Coder-1.5B-Instruct-q4f32_1-MLC',
    label: 'Qwen2.5 Coder 1.5B (enhanced)',
    vramMb: 1889,
  },
  {
    id: 'Qwen2.5-Coder-7B-Instruct-q4f16_1-MLC',
    label: 'Qwen2.5 Coder 7B (ultra, highest quality)',
    vramMb: 5107,
  },
] as const;

interface WorkerResponse {
  id: number;
  type: 'ready' | 'progress' | 'answer' | 'error' | 'cache-status';
  text?: string;
  progress?: InitProgressReport;
}

interface PendingRequest {
  resolve: (value: string) => void;
  reject: (reason: Error) => void;
}

let worker: Worker | undefined;
let requestId = 0;
const pending = new Map<number, PendingRequest>();
let readyModel: string | undefined;

const getWorker = () => {
  if (worker) return worker;
  worker = new Worker(new URL('../workers/localAi.worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
    const response = event.data;
    if (response.type === 'progress') return;
    const request = pending.get(response.id);
    if (!request) return;
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
  onProgress: (text: string) => void,
): Promise<void> => {
  if (!await supportsLocalAi()) {
    throw new Error('WebGPU is not available in this browser.');
  }
  await requestPersistentLocalAiStorage();
  if (readyModel === model) return Promise.resolve();
  const currentWorker = getWorker();
  const id = ++requestId;
  const progressHandler = (event: MessageEvent<WorkerResponse>) => {
    if (event.data.id === id && event.data.type === 'progress') {
      onProgress(event.data.progress?.text ?? 'Loading local model…');
    }
  };
  currentWorker.addEventListener('message', progressHandler);
  return new Promise<string>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    currentWorker.postMessage({ id, type: 'initialize', model });
  }).then(() => {
    readyModel = model;
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
  return new Promise<string>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    worker?.postMessage({ id, type: 'generate', question, context, history, locale });
  }).then(sanitizeLocalModelAnswer);
};

export const resetLocalAi = () => {
  worker?.terminate();
  worker = undefined;
  readyModel = undefined;
  for (const request of pending.values()) request.reject(new Error('Local model was reset.'));
  pending.clear();
};
