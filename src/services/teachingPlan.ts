import type {
  DiscussionCheckpointV1,
  StepNarrationV1,
  TeachingPlanV1,
} from '../types/godMode';
import type { Locale, SimulationInput, SimulationStep, TraceValue } from '../types/simulation';

const same = (left: TraceValue | undefined, right: TraceValue | undefined) =>
  JSON.stringify(left) === JSON.stringify(right);

const changedVariables = (
  previous: SimulationStep | undefined,
  current: SimulationStep,
): StepNarrationV1['changedVariables'] => {
  const before = previous?.visualData.vars ?? {};
  const after = current.visualData.vars;
  const names = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  return Object.fromEntries(names.filter((name) => !same(before[name], after[name])).map((name) => [
    name,
    { before: before[name] ?? null, after: after[name] ?? null },
  ]));
};

const graphDiffs = (
  previous: SimulationStep | undefined,
  current: SimulationStep,
): { nodeDiffs: string[]; edgeDiffs: string[] } => {
  if (current.visualData.type !== 'graph') return { nodeDiffs: [], edgeDiffs: [] };
  const previousGraph = previous?.visualData.type === 'graph' ? previous.visualData : undefined;
  const nodeDiffs = current.visualData.nodes.flatMap((node) => {
    const before = previousGraph?.nodes.find((candidate) => candidate.id === node.id);
    const beforeRoles = before?.semanticRoles ?? [];
    const afterRoles = node.semanticRoles ?? [];
    if (before?.state === node.state && same(beforeRoles, afterRoles)) return [];
    return [`${node.id}: ${before?.state ?? 'none'} → ${node.state ?? 'idle'}${afterRoles.length ? ` [${afterRoles.join(', ')}]` : ''}`];
  });
  const edgeDiffs = current.visualData.edges.flatMap((edge) => {
    const before = previousGraph?.edges.find((candidate) => candidate.id === edge.id);
    const beforeRoles = before?.semanticRoles ?? [];
    const afterRoles = edge.semanticRoles ?? [];
    if (before?.state === edge.state && same(beforeRoles, afterRoles)) return [];
    return [`${edge.from}→${edge.to}: ${before?.state ?? 'none'} → ${edge.state ?? 'idle'}${afterRoles.length ? ` [${afterRoles.join(', ')}]` : ''}`];
  });
  return { nodeDiffs, edgeDiffs };
};

const matrixDiffs = (
  previous: SimulationStep | undefined,
  current: SimulationStep,
): string[] => {
  if (current.visualData.type !== 'matrix') return [];
  const previousMatrix = previous?.visualData.type === 'matrix' ? previous.visualData : undefined;
  const changed = current.visualData.values.flatMap((row, rowIndex) => row.flatMap((value, columnIndex) => {
    const before = previousMatrix?.values[rowIndex]?.[columnIndex] ?? null;
    if (same(before, value)) return [];
    return [`dp[${rowIndex}][${columnIndex}]: ${String(before)} → ${String(value)}`];
  }));
  const roles = current.visualData.highlights.map((cell) =>
    `dp[${cell.row}][${cell.column}] [${cell.role}]${cell.label ? ` ${cell.label}` : ''}`);
  return [...changed, ...roles].slice(0, 8);
};

const describeChanges = (
  changes: StepNarrationV1['changedVariables'],
  locale: Locale,
): string => {
  const names = Object.keys(changes);
  if (!names.length) return locale === 'tr' ? 'Üst seviye değişken değişmedi.' : 'No top-level variable changed.';
  return locale === 'tr'
    ? `Değişen değişkenler: ${names.join(', ')}.`
    : `Changed variables: ${names.join(', ')}.`;
};

export const createStepNarration = (
  steps: SimulationStep[],
  checkpoint: DiscussionCheckpointV1,
  locale: Locale,
  invariant: string,
): StepNarrationV1 => {
  const current = steps[checkpoint.stepIndex];
  if (!current) throw new Error(`Teaching checkpoint ${checkpoint.stepIndex} has no trace step.`);
  const previous = checkpoint.stepIndex > 0 ? steps[checkpoint.stepIndex - 1] : undefined;
  const next = steps[checkpoint.stepIndex + 1];
  const changes = changedVariables(previous, current);
  const { nodeDiffs, edgeDiffs } = graphDiffs(previous, current);
  const cellDiffs = matrixDiffs(previous, current);
  const visualSummary = [...nodeDiffs, ...edgeDiffs, ...cellDiffs].slice(0, 8).join('; ')
    || (locale === 'tr' ? 'Görsel durum bu checkpointte sabit.' : 'The visual state is stable at this checkpoint.');
  const stepLabel = `${checkpoint.stepIndex + 1}/${steps.length}`;
  return {
    version: 1,
    stepIndex: checkpoint.stepIndex,
    activeLine: current.lineNumber,
    changedVariables: changes,
    nodeDiffs,
    edgeDiffs,
    cellDiffs,
    decisionReason: current.explanation,
    invariant,
    nextMove: next?.explanation ?? (locale === 'tr' ? 'Simülasyon tamamlandı.' : 'The simulation is complete.'),
    previousDifference: describeChanges(changes, locale),
    lenses: locale === 'tr' ? {
      code: current.lineNumber === null ? 'Sonuç checkpointi; aktif kaynak satırı yok.' : `Kaynak kodun ${current.lineNumber}. satırı aktif.`,
      data: describeChanges(changes, locale),
      visual: visualSummary,
      reasoning: current.explanation,
      time: `${stepLabel}. adım. ${next ? 'Sonraki deterministik hareket hazır.' : 'Final state.'}`,
    } : {
      code: current.lineNumber === null ? 'Result checkpoint; no source line is active.' : `Source line ${current.lineNumber} is active.`,
      data: describeChanges(changes, locale),
      visual: visualSummary,
      reasoning: current.explanation,
      time: `Step ${stepLabel}. ${next ? 'The next deterministic move is ready.' : 'Final state.'}`,
    },
  };
};

const resultMetrics = (steps: SimulationStep[]): Record<string, TraceValue> => {
  const final = steps.at(-1)?.visualData.vars ?? {};
  const metrics: Record<string, TraceValue> = { traceSteps: steps.length };
  for (const key of ['path', 'meeting', 'visited', 'visitedStart', 'visitedTarget', 'result', 'cost', 'distance', 'maxFlow']) {
    if (Object.prototype.hasOwnProperty.call(final, key)) metrics[key] = final[key];
  }
  if (Array.isArray(final.path)) metrics.pathLength = Math.max(0, final.path.length - 1);
  return metrics;
};

export const createTeachingPlan = (
  steps: SimulationStep[],
  checkpoints: DiscussionCheckpointV1[],
  input: SimulationInput,
  locale: Locale,
  invariants: string[] = [],
): TeachingPlanV1 => {
  const graph = input.graph;
  const metrics = resultMetrics(steps);
  const path = Array.isArray(metrics.path) ? metrics.path.join(' → ') : null;
  const invariant = invariants[0]
    ?? (locale === 'tr' ? 'Trace yalnızca doğrulanmış simülasyon durumlarından oluşur.' : 'The trace contains only validated simulation states.');
  return {
    version: 1,
    introduction: locale === 'tr'
      ? `${graph ? `${graph.startId} düğümünden ${graph.targetId ?? 'sonuca'} uzanan` : 'Verilen input üzerindeki'} gerçek trace başlatılmaya hazır.`
      : `The real trace ${graph ? `from ${graph.startId} to ${graph.targetId ?? 'the result'}` : 'for the supplied input'} is ready to start.`,
    checkpoints: checkpoints.map((checkpoint) => ({
      checkpoint,
      narration: createStepNarration(steps, checkpoint, locale, invariant),
    })),
    autoStart: true,
    suggestedSpeed: 850,
    finalResult: {
      summary: locale === 'tr'
        ? path ? `Bulunan sonuç yolu: ${path}.` : `Simülasyon ${steps.length} doğrulanmış adımda tamamlandı.`
        : path ? `Result path: ${path}.` : `The simulation completed in ${steps.length} validated steps.`,
      inputComparison: locale === 'tr'
        ? `Başlangıç inputu korunarak ${Object.keys(metrics).length} sonuç metriği üretildi.`
        : `The starting input produced ${Object.keys(metrics).length} result metrics without mutation.`,
      metrics,
      correctness: locale === 'tr'
        ? `Sonuç, gerçek final snapshot ve şu değişmez koşul üzerinden doğrulandı: ${invariant}`
        : `The result is grounded in the real final snapshot and this invariant: ${invariant}`,
    },
    followUpQuestions: locale === 'tr'
      ? ['Bu checkpointi daha ayrıntılı anlat.', 'Bir önceki kritik adıma dön.', 'Sonucun neden doğru olduğunu göster.']
      : ['Explain this checkpoint in more detail.', 'Return to the previous critical step.', 'Show why the result is correct.'],
  };
};

