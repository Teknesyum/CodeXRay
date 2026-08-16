import type { AiProviderCapabilities } from '../../types/aiProvider';
import type { SimulationStep } from '../../types/simulation';
import { resolveCommandOutput } from '../ai/commandOutput';
import {
  routeDeterministicCommand,
  type DeterministicWorkspaceCommand,
} from '../aiTimelineControl';
import { queryTrace } from '../trace/traceQuery';
import { buildTraceOutline, resolvePhaseId } from '../trace/traceOutline';
import { mostSignificantIndex } from '../trace/significance';
import { simulationStepsToRawTrace } from '../trace/simulationTrace';

export type TitanIntent =
  | 'navigate'
  | 'edit-input'
  | 'explain'
  | 'trace-code'
  | 'translate-code'
  | 'load-preset'
  | 'ui-control'
  | 'unclear';

export interface TitanRouteDecision {
  intent: TitanIntent;
  actions: DeterministicWorkspaceCommand[];
  source: 'deterministic' | 'model';
  notice: string | null;
}

interface ModelIntent {
  intent: TitanIntent;
}

const MODEL_INTENTS = new Set<TitanIntent>([
  'navigate', 'edit-input', 'explain', 'trace-code', 'translate-code', 'load-preset', 'ui-control', 'unclear',
]);

const validateModelIntent = (value: unknown): value is ModelIntent => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return Object.keys(record).length === 1 && typeof record.intent === 'string'
    && MODEL_INTENTS.has(record.intent as TitanIntent);
};

const normalize = (question: string): string => question
  .toLocaleLowerCase('tr-TR')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/ı/g, 'i')
  .replace(/ş/g, 's')
  .replace(/ğ/g, 'g')
  .replace(/ç/g, 'c')
  .replace(/ö/g, 'o')
  .replace(/ü/g, 'u');

const structuralNavigation = (
  question: string,
  steps: SimulationStep[],
): DeterministicWorkspaceCommand[] | null => {
  if (!steps.length) return null;
  const text = normalize(question);
  const trace = simulationStepsToRawTrace(steps);
  if (/(en onemli|en kritik|most important|most significant|key moment)/.test(text)) {
    const index = mostSignificantIndex(trace);
    return index === null ? null : [{ type: 'jump', index }];
  }
  const phase = /(?:faz|phase)\s*(p?\d+)/.exec(text);
  if (phase) {
    const id = phase[1].startsWith('p') ? phase[1] : `p${phase[1]}`;
    const index = resolvePhaseId(buildTraceOutline(trace), id);
    return index === null ? null : [{ type: 'jump', index }];
  }
  const expression = /(?:trace|iz)\s+(line\(\d+\)|error\(\)|(?:max|min)\([A-Za-z_$][\w$]*\)|(?:first|last)\(.+\)|nth\(\d+\s*,.+\))/.exec(question);
  if (expression) {
    try {
      const index = queryTrace(trace, expression[1]);
      return index === null ? null : [{ type: 'jump', index }];
    } catch {
      return null;
    }
  }
  return null;
};

const deterministicIntent = (
  question: string,
  steps: SimulationStep[],
  currentIndex: number,
): TitanRouteDecision => {
  const navigation = structuralNavigation(question, steps)
    ?? routeDeterministicCommand(question, steps, currentIndex);
  if (navigation) {
    return {
      intent: navigation.some((action) => action.type === 'load-preset') ? 'load-preset' : 'navigate',
      actions: navigation,
      source: 'deterministic',
      notice: null,
    };
  }
  const text = normalize(question);
  if (/(input|girdi|dizi|array|metin|text|hedef|target|dugum|node|kenar|edge)/.test(text)
    && /(degistir|duzenle|sirala|karistir|boyut|eleman|ekle|sil|set|change|edit|sort|shuffle|resize|add|remove)/.test(text)) {
    return { intent: 'edit-input', actions: [], source: 'deterministic', notice: null };
  }
  if (/(cevir|donustur|translate|convert)/.test(text)
    && /(javascript|typescript|python|java|c\+\+|simlang)/.test(text)) {
    return { intent: 'translate-code', actions: [], source: 'deterministic', notice: null };
  }
  if (/(izle|trace|simule|simulate|calistir|execute)/.test(text)
    && /(kod|code|source|kaynak)/.test(text)) {
    return { intent: 'trace-code', actions: [], source: 'deterministic', notice: null };
  }
  if (/(tema|theme|panel|layout|odaklan|focus|maximize|buyut)/.test(text)) {
    return { intent: 'ui-control', actions: [], source: 'deterministic', notice: null };
  }
  if (/(anlat|acikla|neden|nasil|nedir|explain|why|how|what)/.test(text)) {
    return { intent: 'explain', actions: [], source: 'deterministic', notice: null };
  }
  return { intent: 'unclear', actions: [], source: 'deterministic', notice: null };
};

export const routeTitanRequest = (options: {
  question: string;
  steps: SimulationStep[];
  currentIndex: number;
  capabilities?: AiProviderCapabilities | null;
  modelOutput?: string | null;
}): TitanRouteDecision => {
  const deterministic = deterministicIntent(options.question, options.steps, options.currentIndex);
  if (deterministic.intent !== 'unclear') return deterministic;
  const resolved = resolveCommandOutput<ModelIntent>(
    { intent: 'unclear' },
    options.capabilities ?? null,
    options.modelOutput ?? null,
    validateModelIntent,
  );
  if (resolved.value.intent === 'navigate' || resolved.value.intent === 'load-preset') {
    return {
      ...deterministic,
      notice: 'The model recognized a navigation request but no deterministic target was found; no timeline action was applied.',
    };
  }
  return {
    intent: resolved.value.intent,
    actions: [],
    source: resolved.source,
    notice: resolved.notice,
  };
};
