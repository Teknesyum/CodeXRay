import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TracerWorkerRequest, TracerWorkerResponse } from './trace/types';
import { traceJavaScript } from './trace/jsTracer';

class FakeTracerWorker {
  private messageListeners: Array<(event: MessageEvent<TracerWorkerResponse>) => void> = [];

  addEventListener(type: string, listener: EventListener) {
    if (type === 'message') this.messageListeners.push(listener as (event: MessageEvent<TracerWorkerResponse>) => void);
  }

  postMessage(request: TracerWorkerRequest) {
    queueMicrotask(() => {
      const response: TracerWorkerResponse = {
        id: request.id,
        ok: true,
        trace: traceJavaScript(request.source, request.entry, request.options),
      };
      for (const listener of this.messageListeners) listener({ data: response } as MessageEvent<TracerWorkerResponse>);
    });
  }

  terminate() {}
}

describe('custom trace fallback', () => {
  beforeEach(() => vi.stubGlobal('Worker', FakeTracerWorker));

  afterEach(async () => {
    const { terminateTracerWorker } = await import('./trace/tracerWorkerClient');
    terminateTracerWorker();
    vi.unstubAllGlobals();
  });

  it('runs unknown JavaScript through the Worker client and adapts every step', async () => {
    const { generateSimulationSteps } = await import('./aiService');
    const steps = await generateSimulationSteps(
      'Custom sum',
      `function solve(values) { let total = 0; for (const value of values) total += value; return total; }`,
      { kind: 'array', text: '[3, 4, 5]', origin: 'user' },
    );
    expect(steps.length).toBeGreaterThan(3);
    expect(steps.at(-1)?.visualData.vars._returnValue).toBe(12);
    expect(steps.every((step) => step.lineNumber === null || step.lineNumber >= 1)).toBe(true);
  });

  it('surfaces forbidden source without an empty timeline', async () => {
    const { generateSimulationSteps } = await import('./aiService');
    const steps = await generateSimulationSteps(
      'Custom network code',
      `function solve() { return fetch('https://example.com'); }`,
      { kind: 'array', text: '[1]', origin: 'user' },
    );
    expect(steps).toHaveLength(1);
    expect(steps[0].explanation).toContain('Network access is not supported');
  });
});
