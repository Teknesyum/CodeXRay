import type { SimulationInput, SimulationStep } from '../../types/simulation';
import { adaptRawTrace, buildTraceEntry } from './adapter';
import { traceJavaScriptInWorker } from './tracerWorkerClient';

export const traceCustomSimulation = (
  code: string,
  input: SimulationInput,
): Promise<SimulationStep[]> => traceJavaScriptInWorker(code, buildTraceEntry(code, input)).then(adaptRawTrace);
