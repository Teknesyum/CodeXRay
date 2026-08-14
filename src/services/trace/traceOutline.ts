import type { RawTrace, RawTraceStepKind } from './types';
import { scoreTrace } from './significance';

export interface TracePhase {
  id: string;
  label: string;
  kind: 'setup' | 'loop' | 'branch' | 'recursion' | 'update' | 'result' | 'error';
  startIndex: number;
  endIndex: number;
  keyIndex: number;
  score: number;
  children?: TracePhase[];
}

const phaseKind = (kind: RawTraceStepKind): TracePhase['kind'] => {
  if (kind.startsWith('loop')) return 'loop';
  if (kind === 'branch') return 'branch';
  if (kind === 'call' || kind === 'return') return 'recursion';
  if (kind === 'assign' || kind === 'mutate') return 'update';
  if (kind === 'throw') return 'error';
  return 'setup';
};

export const buildTraceOutline = (trace: RawTrace): TracePhase[] => {
  const scored = scoreTrace(trace);
  const groups: Array<typeof scored> = [];
  for (const item of scored) {
    const kind = item.step.event?.t === 'result-write' ? 'result' : phaseKind(item.step.kind);
    const current = groups.at(-1);
    const currentKind = current?.[0]
      ? current[0].step.event?.t === 'result-write' ? 'result' : phaseKind(current[0].step.kind)
      : null;
    if (!current || currentKind !== kind) groups.push([item]);
    else current.push(item);
  }
  return groups.map((group, index) => {
    const best = group.reduce((winner, item) => item.score > winner.score ? item : winner);
    const kind = group[0].step.event?.t === 'result-write' ? 'result' : phaseKind(group[0].step.kind);
    return {
      id: `p${index + 1}`,
      label: `${kind} ${group[0].step.line}-${group.at(-1)?.step.line ?? group[0].step.line}`,
      kind,
      startIndex: group[0].step.index,
      endIndex: group.at(-1)?.step.index ?? group[0].step.index,
      keyIndex: best.step.index,
      score: best.score,
    };
  });
};

export const resolvePhaseId = (outline: TracePhase[], id: string): number | null => {
  for (const phase of outline) {
    if (phase.id === id) return phase.keyIndex;
    const nested = phase.children ? resolvePhaseId(phase.children, id) : null;
    if (nested !== null) return nested;
  }
  return null;
};

export const renderOutlineForModel = (outline: TracePhase[], maxRows = 40): string => {
  const rows: string[] = [];
  const visit = (phases: TracePhase[]) => {
    for (const phase of phases) {
      if (rows.length >= maxRows) return;
      rows.push(`${phase.id} ${phase.kind} ${phase.startIndex}-${phase.endIndex} key ${phase.keyIndex} ${phase.label}`);
      if (phase.children) visit(phase.children);
    }
  };
  visit(outline);
  return rows.join('\n');
};
