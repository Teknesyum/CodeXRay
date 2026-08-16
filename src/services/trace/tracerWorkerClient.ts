import type { RawTrace, TraceBudget, TraceEntry, TracerWorkerRequest, TracerWorkerResponse } from './types';

let worker: Worker | null = null;
let requestSequence = 0;
const pending = new Map<string, { resolve: (trace: RawTrace) => void; reject: (reason: Error) => void }>();

const getWorker = () => {
  if (worker) return worker;
  worker = new Worker(new URL('../../workers/tracer.worker.ts', import.meta.url), { type: 'module' });
  worker.addEventListener('message', (event: MessageEvent<TracerWorkerResponse>) => {
    const response = event.data;
    const request = pending.get(response.id);
    if (!request) return;
    pending.delete(response.id);
    if ('trace' in response) request.resolve(response.trace);
    else request.reject(new Error(response.reason));
  });
  worker.addEventListener('error', (event) => {
    const error = new Error(event.message || 'Tracer Worker failed.');
    for (const request of pending.values()) request.reject(error);
    pending.clear();
    worker?.terminate();
    worker = null;
  });
  return worker;
};

export const traceJavaScriptInWorker = (
  source: string,
  entry: TraceEntry,
  options: Partial<TraceBudget> = {},
): Promise<RawTrace> => new Promise((resolve, reject) => {
  const id = `trace-${Date.now()}-${requestSequence++}`;
  pending.set(id, { resolve, reject });
  const request: TracerWorkerRequest = { id, source, entry, options };
  getWorker().postMessage(request);
});

export const terminateTracerWorker = () => {
  worker?.terminate();
  worker = null;
  const error = new Error('Tracer Worker was terminated.');
  for (const request of pending.values()) request.reject(error);
  pending.clear();
};
