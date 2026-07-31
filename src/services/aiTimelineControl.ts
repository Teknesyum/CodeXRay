import type { SimulationStep } from '../types/simulation';
import { resolveAlgorithmPresetFromCommand } from './codeRegistry';
import { PLANNER_MAX_ACTIONS } from './aiPlanner';

export type TimelineAction =
  | { type: 'jump'; index: number }
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'next' }
  | { type: 'previous' }
  | { type: 'next-important' }
  | { type: 'tour'; checkpoints: number[] };

export type DeterministicWorkspaceCommand =
  | TimelineAction
  | { type: 'load-preset'; presetId: string };

const IMPORTANT_EXPLANATION = [
  /match|eşleş/i,
  /found|bulun|target|hedef/i,
  /swap|değiştir|pivot/i,
  /visit|ziyaret|backtrack|geri dön/i,
  /shortest|en kısa|distance|mesafe/i,
  /merge|birleştir|insert|ekle|shift|kaydır/i,
  /enqueue|dequeue|kuyruk|stack|yığın/i,
  /complete|tamamlan|sorted|sıralan/i,
  /path|yol|relax|güncelle/i,
];

const evenlySample = <T>(values: T[], count: number): T[] => {
  if (values.length <= count) return values;
  if (count <= 1) return [values[0]];
  return Array.from({ length: count }, (_, index) =>
    values[Math.round((index * (values.length - 1)) / (count - 1))],
  );
};

export const findImportantStepIndices = (
  steps: SimulationStep[],
  maximum = 8,
): number[] => {
  if (!steps.length || maximum <= 0) return [];
  if (steps.length <= maximum) return steps.map((_, index) => index);

  const lastIndex = steps.length - 1;
  const keywordMatches = steps
    .map((step, index) => ({ step, index }))
    .filter(({ step }) => IMPORTANT_EXPLANATION.some((pattern) =>
      pattern.test(step.explanation),
    ))
    .map(({ index }) => index);
  const selected = new Set<number>([0, lastIndex]);
  for (const index of evenlySample(keywordMatches, Math.max(0, maximum - 2))) {
    selected.add(index);
  }

  if (selected.size < maximum) {
    const phaseChanges = steps
      .map((step, index) => ({ step, index }))
      .filter(({ step, index }) =>
        index > 0 && step.lineNumber !== steps[index - 1].lineNumber,
      )
      .map(({ index }) => index)
      .filter((index) => !selected.has(index));
    for (const index of evenlySample(phaseChanges, maximum - selected.size)) {
      selected.add(index);
    }
  }

  if (selected.size < maximum) {
    const remaining = steps
      .map((_, index) => index)
      .filter((index) => !selected.has(index));
    for (const index of evenlySample(remaining, maximum - selected.size)) {
      selected.add(index);
    }
  }
  return [...selected].sort((left, right) => left - right).slice(0, maximum);
};

const requestedStepNumber = (question: string): number | null => {
  const match = question.match(
    /(?:step|adım|hamle)\s*(\d+)|(\d+)\s*\.?\s*(?:step|adım|hamle)/i,
  );
  if (!match) return null;
  const value = Number(match[1] ?? match[2]);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
};

export const routeDeterministicCommand = (
  question: string,
  steps: SimulationStep[],
  currentIndex: number,
): DeterministicWorkspaceCommand[] | null => {
  const normalized = question.toLocaleLowerCase('tr-TR');

  const hasPresetVerb = /(?:^|\s)(?:aç|açsana|açar\s+mısın|yükle|göster(?:ir\s+misin)?|open|load|show)(?=$|\s|[?!.,])/i
    .test(normalized);
  const isExplanatoryQuestion = /(?:^|\s)(?:nedir|nasıl|neden|niye|farkı|what|how|why|difference)(?=$|\s|[?!.,])/i
    .test(normalized);
  if (hasPresetVerb && !isExplanatoryQuestion) {
    const preset = resolveAlgorithmPresetFromCommand(normalized);
    if (preset) {
      return [{ type: 'load-preset', presetId: preset.id }];
    }
  }

  // Standard timeline routing logic
  if (!steps.length) return null;
  const stepNumber = requestedStepNumber(normalized);
  if (
    stepNumber !== null
    && /(git|atla|sar|göster|aç|jump|go|show|take me)/i.test(normalized)
  ) {
    return [{
      type: 'jump',
      index: Math.min(Math.max(stepNumber - 1, 0), steps.length - 1),
    }];
  }
  if (/(durdur|duraklat|bekle|pause|stop)\b/i.test(normalized)) {
    return [{ type: 'pause' }];
  }
  if (
    /(oynat|başlat|simülasyona devam|oynatmaya devam|play|resume|continue (?:playback|simulation))\b/i
      .test(normalized)
  ) {
    return [{ type: 'play' }];
  }
  if (
    /(kodu|algoritmayı|çalışmayı).*(anlat|gezdir)|önemli (nokta|adım|hamle).*(göster|anlat)|walk me through|guided tour|explain the (code|algorithm)/i
      .test(normalized)
  ) {
    return [{ type: 'tour', checkpoints: findImportantStepIndices(steps) }];
  }
  if (
    /(sonraki|bir sonraki|next).*(önemli|eşleş|match|key)|(?:önemli|key).*(sonraki|next)/i
      .test(normalized)
  ) {
    return [{ type: 'next-important' }];
  }
  if (/(önceki adım|geri git|previous step|step back)/i.test(normalized)) {
    return [{ type: 'previous' }];
  }
  if (/(sonraki adım|bir adım iler|next step|step forward)/i.test(normalized)) {
    return [{ type: 'next' }];
  }
  if (normalized.trim() === 'pause') return [{ type: 'pause' }];
  if (normalized.trim() === 'play') return [{ type: 'play' }];
  if (normalized.trim() === 'next') return [{ type: 'next' }];
  if (normalized.trim() === 'previous') return [{ type: 'previous' }];
  void currentIndex;
  return null;
};

export const validateActionPlan = (
  jsonPlan: unknown,
  steps: SimulationStep[],
): TimelineAction[] | null => {
  const isPlainObject = (value: unknown): value is Record<string, unknown> => {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  };
  const hasExactKeys = (value: Record<string, unknown>, keys: string[]) => {
    const actualKeys = Object.keys(value).sort();
    return actualKeys.length === keys.length
      && actualKeys.every((key, index) => key === [...keys].sort()[index]);
  };

  if (!isPlainObject(jsonPlan) || !hasExactKeys(jsonPlan, ['actions'])) return null;
  if (
    !Array.isArray(jsonPlan.actions)
    || jsonPlan.actions.length > PLANNER_MAX_ACTIONS
  ) return null;

  const actions: TimelineAction[] = [];
  for (const value of jsonPlan.actions) {
    if (!isPlainObject(value) || typeof value.type !== 'string') return null;

    if (value.type === 'jump') {
      if (
        !hasExactKeys(value, ['step', 'type'])
        || !Number.isSafeInteger(value.step)
        || Number(value.step) < 1
        || Number(value.step) > steps.length
      ) return null;
      actions.push({
        type: 'jump',
        index: Number(value.step) - 1,
      });
    } else if (value.type === 'tour') {
      if (!hasExactKeys(value, ['type']) || !steps.length) return null;
      actions.push({ type: 'tour', checkpoints: findImportantStepIndices(steps) });
    } else if (
      value.type === 'play'
      || value.type === 'pause'
      || value.type === 'next'
      || value.type === 'previous'
      || value.type === 'next-important'
    ) {
      if (!hasExactKeys(value, ['type']) || !steps.length) return null;
      actions.push({ type: value.type });
    } else return null;
  }

  return actions;
};

export const stripThinkBlock = (answer: string): string => {
  return answer.replace(/<think>[\s\S]*?(<\/think>|$)/gi, '').trim();
};

export const resolveTimelineTarget = (
  action: TimelineAction,
  steps: SimulationStep[],
  currentIndex: number,
): number => {
  const lastIndex = Math.max(steps.length - 1, 0);
  if (action.type === 'jump') return Math.min(Math.max(action.index, 0), lastIndex);
  if (action.type === 'next') return Math.min(currentIndex + 1, lastIndex);
  if (action.type === 'previous') return Math.max(currentIndex - 1, 0);
  if (action.type === 'tour') return action.checkpoints[0] ?? currentIndex;
  if (action.type === 'next-important') {
    return findImportantStepIndices(steps).find((index) => index > currentIndex)
      ?? lastIndex;
  }
  return currentIndex;
};
