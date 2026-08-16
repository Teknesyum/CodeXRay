import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  askLocalModel,
  deleteLocalModel,
  getCachedLocalModels,
  initializeLocalAi,
  isDisposedLocalModelError,
  isLocalModelBusyError,
  isRecoverableLocalModelCacheError,
  isLocalModelCached,
  LOCAL_AI_MODELS,
  resetLocalAi,
  repairLocalModel,
  runLocalAgent,
  runLocalAgentDetailed,
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

const setNavigatorFeature = (key: 'gpu' | 'storage' | 'locks', value: unknown) => {
  Object.defineProperty(navigator, key, { configurable: true, value });
};

const waitForWorker = async (): Promise<FakeWorker> => {
  await vi.waitFor(() => expect(FakeWorker.instances.length).toBeGreaterThan(0));
  return FakeWorker.instances.at(-1)!;
};

const initialize = async (model: string = LOCAL_AI_MODELS[0].id) => {
  const progress = vi.fn();
  const promise = initializeLocalAi(model, 4096, progress);
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
  vi.useRealTimers();
  resetLocalAi();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  setNavigatorFeature('gpu', undefined);
  setNavigatorFeature('storage', undefined);
  setNavigatorFeature('locks', undefined);
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
      LOCAL_AI_MODELS[4].id,
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
    const cancelled = expect(handle.promise).rejects.toThrow('Titan Mode agent was cancelled.');
    handle.cancel();
    expect(worker.posted.at(-1)).toMatchObject({ id: handle.requestId, type: 'agent-cancel' });
    await cancelled;
    worker.fail('GPU device lost');
    expect(worker.terminated).toBe(true);
  });

  it('refuses a repair while another tab holds the model operation lock', async () => {
    const request = vi.fn(async (
      _name: string,
      _options: unknown,
      callback: (lock: unknown | null) => Promise<unknown>,
    ) => callback(null));
    setNavigatorFeature('locks', { request });

    const repair = repairLocalModel(LOCAL_AI_MODELS[2].id);
    await expect(repair).rejects.toThrow('busy in another tab');
    expect(isLocalModelBusyError(new Error('Local model files are busy in another tab.'))).toBe(true);
    expect(request).toHaveBeenCalledWith(
      `codexray.local-model:${LOCAL_AI_MODELS[2].id}`,
      { mode: 'exclusive', ifAvailable: true },
      expect.any(Function),
    );
    expect(FakeWorker.instances).toHaveLength(0);
  });

  it('drops a stale ready worker after WebLLM reports a disposed engine', async () => {
    const { worker } = await initialize();
    const answer = askLocalModel('Explain', 'context', [], 'en');
    const request = worker.posted.at(-1)!;
    worker.emit({ id: request.id, type: 'error', text: 'The current Object has already been disposed' });

    await expect(answer).rejects.toThrow('already been disposed');
    expect(isDisposedLocalModelError(new Error('The current Object has already been disposed'))).toBe(true);
    expect(worker.terminated).toBe(true);
    await expect(askLocalModel('Retry', 'context', [], 'en')).rejects.toThrow(
      'Load a local AI model',
    );
  });

  it('returns structured local attempt diagnostics', async () => {
    const { worker } = await initialize();
    const handle = runLocalAgentDetailed({
      role: 'critic',
      instructions: 'Review the candidate.',
      context: 'bounded source and candidate',
      locale: 'en',
      jsonMode: true,
    });
    const result = {
      version: 2 as const,
      text: '{"passed":true}',
      finishReason: 'stop',
      model: LOCAL_AI_MODELS[2].id,
      contextWindow: 4096,
      promptTokens: 120,
      completionTokens: 12,
      queueMs: 4,
      firstTokenMs: 6,
      inferenceMs: 18,
      schemaMode: 'json-object' as const,
    };
    worker.emit({ id: handle.requestId, type: 'answer', text: result.text, result });
    await expect(handle.promise).resolves.toEqual(result);
    expect(worker.posted.at(-1)).toMatchObject({ type: 'agent-run', detailed: true });
  });

  it('times out an agent whose WebGPU inference never settles', async () => {
    const { worker } = await initialize();
    vi.useFakeTimers();
    const handle = runLocalAgent({
      role: 'code-author',
      instructions: 'Author the validated program.',
      context: 'bounded context',
      locale: 'en',
      maxTokens: 150,
    });
    const timedOut = expect(handle.promise).rejects.toThrow('timed out in the WebGPU queue after 20 seconds');
    await vi.advanceTimersByTimeAsync(20_000);
    await timedOut;
    expect(worker.posted.at(-1)).toMatchObject({ id: handle.requestId, type: 'agent-cancel' });
    vi.useRealTimers();
  });

  it('starts a separate role-aware timeout when queued work begins inference', async () => {
    const { worker } = await initialize();
    vi.useFakeTimers();
    const handle = runLocalAgent({
      role: 'critic',
      instructions: 'Review the artifact.',
      context: 'bounded context',
      locale: 'en',
      maxTokens: 100,
    });
    worker.emit({ id: handle.requestId, type: 'agent-event', status: 'running', text: 'Running inference' });
    const timedOut = expect(handle.promise).rejects.toThrow('produced no first token within 30 seconds');
    await vi.advanceTimersByTimeAsync(30_000);
    await timedOut;
    expect(worker.posted.at(-1)).toMatchObject({ id: handle.requestId, type: 'agent-cancel' });
  });

  it('keeps an architect alive past the 20 second target while streamed output is progressing', async () => {
    const { worker } = await initialize();
    vi.useFakeTimers();
    const progress = vi.fn();
    const handle = runLocalAgent({
      role: 'architect',
      instructions: 'Design a validated contract.',
      context: 'bounded context',
      locale: 'en',
      maxTokens: 520,
    }, progress);
    worker.emit({ id: handle.requestId, type: 'agent-event', status: 'running', text: 'Waiting' });
    await vi.advanceTimersByTimeAsync(25_000);
    expect(progress).toHaveBeenCalledWith(expect.objectContaining({ status: 'target-exceeded' }));
    worker.emit({ id: handle.requestId, type: 'agent-event', status: 'first-token', text: 'First token' });
    await vi.advanceTimersByTimeAsync(15_000);
    worker.emit({ id: handle.requestId, type: 'agent-event', status: 'streaming', text: 'Still streaming' });
    await vi.advanceTimersByTimeAsync(15_000);
    worker.emit({ id: handle.requestId, type: 'answer', text: '{"version":1}' });
    await expect(handle.promise).resolves.toBe('{"version":1}');
    expect(worker.posted.filter((message) => message.type === 'agent-cancel')).toHaveLength(0);
  });

  it('stops a stream that becomes inactive after its first token', async () => {
    const { worker } = await initialize();
    vi.useFakeTimers();
    const handle = runLocalAgent({
      role: 'architect',
      instructions: 'Design a validated contract.',
      context: 'bounded context',
      locale: 'en',
      maxTokens: 520,
    });
    worker.emit({ id: handle.requestId, type: 'agent-event', status: 'running', text: 'Waiting' });
    worker.emit({ id: handle.requestId, type: 'agent-event', status: 'first-token', text: 'First token' });
    const timedOut = expect(handle.promise).rejects.toThrow('stopped producing output for 20 seconds');
    await vi.advanceTimersByTimeAsync(20_000);
    await timedOut;
  });

  it('uses the longer first-token profile for DeepSeek R1 7B', async () => {
    const reasoningModel = LOCAL_AI_MODELS.find((model) => model.reasoningModel)!;
    const { worker } = await initialize(reasoningModel.id);
    vi.useFakeTimers();
    const handle = runLocalAgent({
      role: 'architect',
      instructions: 'Design a validated contract.',
      context: 'bounded context',
      locale: 'en',
      maxTokens: 520,
    });
    worker.emit({ id: handle.requestId, type: 'agent-event', status: 'running', text: 'Waiting' });
    const timedOut = expect(handle.promise).rejects.toThrow('produced no first token within 45 seconds');
    await vi.advanceTimersByTimeAsync(45_000);
    await timedOut;
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

  it('recreates the worker after an initialization failure and identifies damaged cache metadata', async () => {
    const first = initializeLocalAi(LOCAL_AI_MODELS[2].id, 4096, vi.fn());
    const failedWorker = await waitForWorker();
    const failedRequest = failedWorker.posted.find((message) => message.type === 'initialize')!;
    failedWorker.emit({ id: failedRequest.id, type: 'error', text: 'Unexpected end of JSON input' });
    await expect(first).rejects.toThrow('Unexpected end of JSON input');
    expect(failedWorker.terminated).toBe(true);
    expect(isRecoverableLocalModelCacheError(new Error('Unexpected end of JSON input'))).toBe(true);
    expect(isRecoverableLocalModelCacheError(new Error('GPU device lost'))).toBe(false);

    const second = initializeLocalAi(LOCAL_AI_MODELS[2].id, 4096, vi.fn());
    await vi.waitFor(() => expect(FakeWorker.instances).toHaveLength(2));
    const freshWorker = FakeWorker.instances[1];
    expect(freshWorker).not.toBe(failedWorker);
    const nextRequest = freshWorker.posted.find((message) => message.type === 'initialize')!;
    freshWorker.emit({ id: nextRequest.id, type: 'ready', text: nextRequest.model });
    await expect(second).resolves.toBeUndefined();
  });
});
