import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RawTrace, TracerWorkerRequest, TracerWorkerResponse } from './types';
import { terminateTracerWorker, traceJavaScriptInWorker } from './tracerWorkerClient';

class FakeWorker {
  static instances: FakeWorker[] = [];

  readonly listeners = new Map<string, Array<(event: MessageEvent<TracerWorkerResponse> | ErrorEvent) => void>>();
  readonly requests: TracerWorkerRequest[] = [];
  terminated = false;

  constructor() {
    FakeWorker.instances.push(this);
  }

  addEventListener(type: string, listener: (event: MessageEvent<TracerWorkerResponse> | ErrorEvent) => void) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  postMessage(request: TracerWorkerRequest) {
    this.requests.push(request);
  }

  terminate() {
    this.terminated = true;
  }

  respond(response: TracerWorkerResponse) {
    for (const listener of this.listeners.get('message') ?? []) {
      listener({ data: response } as MessageEvent<TracerWorkerResponse>);
    }
  }
}

const trace: RawTrace = {
  steps: [],
  truncated: false,
  budget: { maxSteps: 10, usedSteps: 0, elapsedMs: 0 },
  returnValue: null,
  consoleOutput: [],
  error: null,
};

describe('tracerWorkerClient', () => {
  beforeEach(() => {
    FakeWorker.instances = [];
    vi.stubGlobal('Worker', FakeWorker);
  });

  afterEach(() => {
    terminateTracerWorker();
    vi.unstubAllGlobals();
  });

  it('resolves a successful trace response', async () => {
    const result = traceJavaScriptInWorker('return 1;', { args: [] });
    const worker = FakeWorker.instances[0];
    const request = worker.requests[0];

    worker.respond({ id: request.id, ok: true, trace });

    await expect(result).resolves.toBe(trace);
  });

  it('rejects a failed trace response', async () => {
    const result = traceJavaScriptInWorker('throw new Error();', { args: [] });
    const worker = FakeWorker.instances[0];
    const request = worker.requests[0];

    worker.respond({ id: request.id, ok: false, reason: 'trace failed' });

    await expect(result).rejects.toThrow('trace failed');
  });

  it('rejects every in-flight request when terminated', async () => {
    const first = traceJavaScriptInWorker('return 1;', { args: [] });
    const second = traceJavaScriptInWorker('return 2;', { args: [] });
    const worker = FakeWorker.instances[0];

    terminateTracerWorker();

    await expect(first).rejects.toThrow('Tracer Worker was terminated.');
    await expect(second).rejects.toThrow('Tracer Worker was terminated.');
    expect(worker.terminated).toBe(true);
    expect(worker.requests[0].id).not.toBe(worker.requests[1].id);
  });
});
