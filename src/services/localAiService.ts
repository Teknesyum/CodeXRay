import type { InitProgressReport } from '@mlc-ai/web-llm';

export const LOCAL_AI_MODELS = [
  {
    id: 'Qwen2.5-Coder-0.5B-Instruct-q4f32_1-MLC',
    label: 'Qwen2.5 Coder 0.5B (default, faster)',
  },
  {
    id: 'Qwen2.5-Coder-1.5B-Instruct-q4f32_1-MLC',
    label: 'Qwen2.5 Coder 1.5B (enhanced)',
  },
] as const;

interface WorkerResponse {
  id: number;
  type: 'ready' | 'progress' | 'answer' | 'error';
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

export const supportsLocalAi = () =>
  typeof Worker !== 'undefined'
  && typeof navigator !== 'undefined'
  && 'gpu' in navigator;

export const initializeLocalAi = (
  model: string,
  onProgress: (text: string) => void,
): Promise<void> => {
  if (!supportsLocalAi()) {
    return Promise.reject(new Error('WebGPU is not available in this browser.'));
  }
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
  history: Array<{ role: string; content: string }>,
): Promise<string> => {
  if (!worker || !readyModel) {
    return Promise.reject(new Error('Load a local AI model from Settings before asking questions.'));
  }
  const id = ++requestId;
  return new Promise<string>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    worker?.postMessage({ id, type: 'generate', question, context, history });
  });
};

export const resetLocalAi = () => {
  worker?.terminate();
  worker = undefined;
  readyModel = undefined;
  for (const request of pending.values()) request.reject(new Error('Local model was reset.'));
  pending.clear();
};
