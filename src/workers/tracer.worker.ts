import { traceJavaScript } from '../services/trace/jsTracer';
import type { TracerWorkerRequest, TracerWorkerResponse } from '../services/trace/types';

interface TracerWorkerScope {
  addEventListener(type: 'message', listener: (event: MessageEvent<TracerWorkerRequest>) => void): void;
  postMessage(response: TracerWorkerResponse): void;
}

const workerScope = self as unknown as TracerWorkerScope & Record<string, unknown>;

Object.defineProperties(workerScope, {
  fetch: { value: undefined, writable: false, configurable: false },
  XMLHttpRequest: { value: undefined, writable: false, configurable: false },
  importScripts: { value: undefined, writable: false, configurable: false },
});

workerScope.addEventListener('message', (event: MessageEvent<TracerWorkerRequest>) => {
  const request = event.data;
  try {
    const trace = traceJavaScript(request.source, request.entry, request.options);
    const response: TracerWorkerResponse = { id: request.id, ok: true, trace };
    workerScope.postMessage(response);
  } catch (reason) {
    const response: TracerWorkerResponse = {
      id: request.id,
      ok: false,
      reason: reason instanceof Error ? reason.message : String(reason),
    };
    workerScope.postMessage(response);
  }
});
