import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  askLocalModel,
  deleteLocalModel,
  getCachedLocalModels,
  initializeLocalAi,
  isLocalModelCached,
  LOCAL_AI_MODELS,
  resetLocalAi,
  runLocalAgent,
  supportsLocalAi,
} from './localAiService';

interface PostedMessage {
  id: number;
  type: string;
  model?: string;
  [key: string]: unknown;
}

class FakeWorker {
  static instances: FakeWorker[] = [];

  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  posted: PostedMessage[] = [];
  terminated = false;
  private listeners = new Set<(event: MessageEvent) => void>();

  constructor() {
    FakeWorker.instances.push(this);
  }

  postMessage(message: PostedMessage) {
    this.posted.push(message);
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
    if (type === 'message' && typeof listener === 'function') {
      this.listeners.add(listener as (event: MessageEvent) => void);
    }
  }

  removeEventListener(type: string, listener: EventListenerOrEventListenerObject) {
    if (type === 'message' && typeof listener === 'function') {
      this.listeners.delete(listener as (event: MessageEvent) => void);
    }
  }

  terminate() {
    this.terminated = true;
  }

  emit(data: Record<string, unknown>) {
    const event = { data } as MessageEvent;
    this.onmessage?.(event);
    this.listeners.forEach((listener) => listener(event));
  }

  fail(message: string) {
    this.onerror?.({ message } as ErrorEvent);
  }
}

const setNavigatorFeature = (key: 'gpu' | 'storage', value: unknown) => {
  Object.defineProperty(navigator, key, { configurable: true, value });
};

const waitForWorker = async (): Promise<FakeWorker> => {
  await vi.waitFor(() => expect(FakeWorker.instances.length).toBeGreaterThan(0));
  return FakeWorker.instances.at(-1)!;
};

const initialize = async () => {
  const progress = vi.fn();
  const promise = initializeLocalAi(LOCAL_AI_MODELS[0].id, 4096, progress);
  const worker = await waitForWorker();
  const request = worker.posted.find((message) => message.type === 'initialize')!;
  worker.emit({ id: request.id, type: 'ready', text: request.model });
  await promise;
  return { worker, progress };
};

beforeEach(() => {
  FakeWorker.instances = [];
  vi.stubGlobal('Worker', FakeWorker as unknown as typeof Worker);
  setNavigatorFeature('gpu', { requestAdapter: vi.fn().mockResolvedValue({}) });
  setNavigatorFeature('storage', {
    persist: vi.fn().mockResolvedValue(true),
    persisted: vi.fn().mockResolvedValue(true),
  });
});

afterEach(() => {
  resetLocalAi();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  setNavigatorFeature('gpu', undefined);
  setNavigatorFeature('storage', undefined);
});

describe('local AI worker bridge', () => {
  it('reports WebGPU support defensively', async () => {
    expect(await supportsLocalAi()).toBe(true);
    setNavigatorFeature('gpu', { requestAdapter: vi.fn().mockRejectedValue(new Error('blocked')) });
    expect(await supportsLocalAi()).toBe(false);
    setNavigatorFeature('gpu', undefined);
    expect(await supportsLocalAi()).toBe(false);
  });

  it('queries each registered model and returns only cached IDs', async () => {
    const promise = getCachedLocalModels();
    const worker = await waitForWorker();
    expect(worker.posted).toHaveLength(LOCAL_AI_MODELS.length);
    worker.posted.forEach((message, index) => worker.emit({
      id: message.id,
      type: 'cache-status',
      text: index % 2 === 0 ? 'cached' : 'missing',
    }));
    await expect(promise).resolves.toEqual([
      LOCAL_AI_MODELS[0].id,
      LOCAL_AI_MODELS[2].id,
    ]);
  });

  it('returns false without creating a worker when Worker is unavailable', async () => {
    resetLocalAi();
    vi.stubGlobal('Worker', undefined);
    await expect(isLocalModelCached(LOCAL_AI_MODELS[0].id)).resolves.toBe(false);
    expect(FakeWorker.instances).toHaveLength(0);
  });

  it('forwards progress and avoids reinitializing an already ready model/context pair', async () => {
    const progress = vi.fn();
    const promise = initializeLocalAi(LOCAL_AI_MODELS[0].id, 4096, progress);
    const worker = await waitForWorker();
    const request = worker.posted.find((message) => message.type === 'initialize')!;
    worker.emit({
      id: request.id,
      type: 'progress',
      progress: { progress: 0.42, timeElapsed: 12, text: 'Loading shards' },
    });
    expect(progress).toHaveBeenCalledWith(expect.objectContaining({ progress: 0.42 }));
    worker.emit({ id: request.id, type: 'ready', text: request.model });
    await promise;

    await initializeLocalAi(LOCAL_AI_MODELS[0].id, 4096, progress);
    expect(worker.posted.filter((message) => message.type === 'initialize')).toHaveLength(1);
  });

  it('cleans visible answers and rejects output containing only hidden reasoning', async () => {
    const { worker } = await initialize();
    const first = askLocalModel('Where?', 'context', [], 'en');
    const firstRequest = worker.posted.at(-1)!;
    worker.emit({
      id: firstRequest.id,
      type: 'answer',
      text: '<analysis>private</analysis>\n\nPaused at step 3.',
    });
    await expect(first).resolves.toBe('Paused at step 3.');

    const second = askLocalModel('Where?', 'context', [], 'tr');
    const secondRequest = worker.posted.at(-1)!;
    worker.emit({ id: secondRequest.id, type: 'answer', text: '<think>only private</think>' });
    await expect(second).rejects.toThrow('güvenli ve görünür');
  });

  it('forwards agent status, sends cancellation, and rejects all pending work on worker failure', async () => {
    const { worker } = await initialize();
    const onProgress = vi.fn();
    const handle = runLocalAgent({
      role: 'tutor',
      instructions: 'Explain the current checkpoint.',
      context: 'bounded context',
      locale: 'en',
    }, onProgress);
    worker.emit({ id: handle.requestId, type: 'agent-event', status: 'running', text: 'Working' });
    expect(onProgress).toHaveBeenCalledWith({
      requestId: handle.requestId,
      status: 'running',
      text: 'Working',
    });
    handle.cancel();
    expect(worker.posted.at(-1)).toMatchObject({ id: handle.requestId, type: 'agent-cancel' });
    worker.fail('GPU device lost');
    await expect(handle.promise).rejects.toThrow('GPU device lost');
    expect(worker.terminated).toBe(true);
  });

  it('deletes a ready model through a fresh worker after terminating active inference', async () => {
    const { worker: activeWorker } = await initialize();
    const deletion = deleteLocalModel(LOCAL_AI_MODELS[0].id);
    const deletionWorker = await waitForWorker();
    expect(activeWorker.terminated).toBe(true);
    expect(deletionWorker).not.toBe(activeWorker);
    const request = deletionWorker.posted.find((message) => message.type === 'delete-model')!;
    deletionWorker.emit({ id: request.id, type: 'model-deleted', text: request.model });
    await expect(deletion).resolves.toBeUndefined();
  });
});
