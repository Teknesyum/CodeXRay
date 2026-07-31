import type { SimulationStep } from '../types/simulation';
import type { DeterministicWorkspaceCommand } from './aiTimelineControl';
import { resolveAlgorithmPresetFromCommand } from './codeRegistry';
import { findImportantStepIndices } from './aiTimelineControl';

export type GodModeIntent =
  | { type: 'create-algorithm'; template: 'bidirectional-bfs' | 'model-authored' }
  | { type: 'adapt-input' }
  | { type: 'discuss-current-step' }
  | {
    type: 'ui-control';
    command:
      | 'focus-code'
      | 'focus-simulation'
      | 'focus-assistant'
      | 'balanced'
      | 'theme-neon'
      | 'theme-dark'
      | 'theme-light'
      | 'radio-open'
      | 'radio-play'
      | 'radio-pause';
  }
  | { type: 'deterministic'; actions: DeterministicWorkspaceCommand[] };

export const normalizeGodModeText = (value: string): string => value
  .toLocaleLowerCase('tr-TR')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/ı/g, 'i')
  .replace(/ş/g, 's')
  .replace(/ğ/g, 'g')
  .replace(/ü/g, 'u')
  .replace(/ö/g, 'o')
  .replace(/ç/g, 'c')
  .replace(/[’']/g, '')
  .replace(/[^a-z0-9*+\s.-]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const hasWorkspaceVerb = (text: string): boolean =>
  /\b(ac|acsana|acabilir|acar|yukle|goster|getir|sec|open|load|show|switch)\b/.test(text);

const requestedStep = (text: string): number | null => {
  const match = text.match(/(?:step|adim|hamle)\s*(\d+)|(\d+)\s*\.?\s*(?:step|adim|hamle)/);
  const numeric = Number(match?.[1] ?? match?.[2]);
  return Number.isSafeInteger(numeric) && numeric > 0 ? numeric : null;
};

export const routeGodModeRequest = (
  question: string,
  steps: SimulationStep[],
  currentIndex: number,
): GodModeIntent | null => {
  const text = normalizeGodModeText(question);
  if (/\b(radyo|radio)\b.*\b(ac|goster|open|show)\b/.test(text)) {
    return { type: 'ui-control', command: 'radio-open' };
  }
  if (/\b(radyo|radio)\b.*\b(oynat|baslat|play)\b/.test(text)) {
    return { type: 'ui-control', command: 'radio-play' };
  }
  if (/\b(radyo|radio)\b.*\b(durdur|duraklat|pause|stop)\b/.test(text)) {
    return { type: 'ui-control', command: 'radio-pause' };
  }
  const step = requestedStep(text);
  if (step !== null && /\b(git|atla|sar|goster|jump|go|show)\b/.test(text) && steps.length) {
    return {
      type: 'deterministic',
      actions: [{ type: 'jump', index: Math.min(step - 1, steps.length - 1) }],
    };
  }
  if (/\b(durdur|duraklat|bekle|pause|stop)\b/.test(text) && steps.length) {
    return { type: 'deterministic', actions: [{ type: 'pause' }] };
  }
  if (/\b(oynat|baslat|devam|play|resume)\b/.test(text) && steps.length) {
    return { type: 'deterministic', actions: [{ type: 'play' }] };
  }
  if (/\b(iki yonlu|cift yonlu|bidirectional)\b/.test(text) && /\bbfs\b/.test(text)
    && /\b(yaz|olustur|kur|ekle|generate|create|write)\b/.test(text)) {
    return { type: 'create-algorithm', template: 'bidirectional-bfs' };
  }
  if (/\b(input\w*|girdi\w*|veri\w*)\b/.test(text)
    && /\b(duzenle|uyarla|olustur|hazirla|degistir|parcala|adapt|create|prepare|change)\b/.test(text)) {
    return { type: 'adapt-input' };
  }
  if (/\b(bunu|burayi|bu adimi|mevcut adimi)\b/.test(text)
    && /\b(tartis|anlat|incele|acikla|discuss|explain)\b/.test(text)) {
    return { type: 'discuss-current-step' };
  }
  if (/\b(kod|editor)\b.*\b(odaklan|buyut|focus|maximize)\b/.test(text)) {
    return { type: 'ui-control', command: 'focus-code' };
  }
  if (/\b(simulasyon|gorsel)\b.*\b(odaklan|buyut|focus|maximize)\b/.test(text)) {
    return { type: 'ui-control', command: 'focus-simulation' };
  }
  if (/\b(asistan|bilgic dede|ai)\b.*\b(odaklan|buyut|focus|maximize)\b/.test(text)) {
    return { type: 'ui-control', command: 'focus-assistant' };
  }
  if (/\b(denge|dengeli|balanced|reset layout)\b/.test(text)) {
    return { type: 'ui-control', command: 'balanced' };
  }
  if (/\b(neon)\b.*\b(tema|theme|yap|gec|sec)\b|\b(tema|theme)\b.*\b(neon)\b/.test(text)) {
    return { type: 'ui-control', command: 'theme-neon' };
  }
  if (/\b(karanlik|dark)\b.*\b(tema|theme|yap|gec|sec)\b|\b(tema|theme)\b.*\b(karanlik|dark)\b/.test(text)) {
    return { type: 'ui-control', command: 'theme-dark' };
  }
  if (/\b(acik|light)\b.*\b(tema|theme|yap|gec|sec)\b|\b(tema|theme)\b.*\b(acik|light)\b/.test(text)) {
    return { type: 'ui-control', command: 'theme-light' };
  }
  if (/\b(yaz|olustur|kur|ekle|generate|create|write)\b/.test(text)) {
    const existingPreset = resolveAlgorithmPresetFromCommand(text);
    if (existingPreset) return {
      type: 'deterministic',
      actions: [{ type: 'load-preset', presetId: existingPreset.id }],
    };
  }
  const explanatory = /\b(nedir|nasil|neden|niye|farki|anlat|acikla|what|how|why|difference)\b/.test(text);
  if (hasWorkspaceVerb(text) && !explanatory) {
    const preset = resolveAlgorithmPresetFromCommand(text);
    if (preset) return {
      type: 'deterministic',
      actions: [{ type: 'load-preset', presetId: preset.id }],
    };
  }
  if (steps.length && /\b(kritik|onemli|key)\b.*\b(nokta|adim|moment)\b/.test(text)) {
    return {
      type: 'deterministic',
      actions: [{ type: 'tour', checkpoints: findImportantStepIndices(steps) }],
    };
  }
  if (/\b(algoritma|kod|program)\b/.test(text)
    && /\b(yaz|olustur|kur|generate|create|write)\b/.test(text)) {
    return { type: 'create-algorithm', template: 'model-authored' };
  }
  void currentIndex;
  return null;
};
