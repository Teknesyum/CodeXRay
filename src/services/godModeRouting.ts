import type { SimulationStep } from '../types/simulation';
import type { DeterministicWorkspaceCommand } from './aiTimelineControl';
import { resolveAlgorithmPresetFromCommand } from './codeRegistry';
import { findImportantStepIndices } from './aiTimelineControl';
import type { Locale } from '../i18n/translations';
import { localizeAlgorithmName } from '../i18n/translations';
import { resolveDpTemplateFromRequest, type DpTemplateId } from './dpTemplateCompiler';

export type GodModeIntent =
  | { type: 'create-algorithm'; template: 'bidirectional-bfs' | 'predict-winner-interval-dp' | DpTemplateId | 'model-authored' }
  | { type: 'clarify-algorithm' }
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

export const canonicalCustomTitle = (request: string, locale: Locale): string => {
  const normalized = normalizeGodModeText(request);
  const dpTemplate = resolveDpTemplateFromRequest(request);
  const base = dpTemplate === 'house-robber-1d-dp'
    ? locale === 'tr' ? 'LeetCode 198 — Ev Soyguncusu' : 'LeetCode 198 — House Robber'
    : dpTemplate === 'lcs-2d-dp'
      ? locale === 'tr' ? 'LeetCode 1143 — En Uzun Ortak Alt Dizi' : 'LeetCode 1143 — Longest Common Subsequence'
      : dpTemplate === 'longest-palindrome-interval-dp'
        ? locale === 'tr' ? 'LeetCode 516 — En Uzun Palindromik Alt Dizi' : 'LeetCode 516 — Longest Palindromic Subsequence'
        : /\b(?:leetcode\s*)?486\b|predict the winner|kazanan[ıi] tahmin/.test(normalized)
    ? locale === 'tr' ? 'LeetCode 486 — Kazananı Tahmin Et' : 'LeetCode 486 — Predict the Winner'
    : /\b(iki yonlu|cift yonlu|bidirectional)\b/.test(normalized) && /\bbfs\b/.test(normalized)
    ? locale === 'tr' ? 'İki Yönlü BFS' : 'Bidirectional BFS'
    : resolveAlgorithmPresetFromCommand(request)?.name
      ? localizeAlgorithmName(resolveAlgorithmPresetFromCommand(request)?.name ?? '', locale)
      : locale === 'tr' ? 'Özel Algoritma' : 'Custom Algorithm';
  return `${base} — ${locale === 'tr' ? 'Özel' : 'Custom'}`;
};

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
  if (/^(?:devam|continue)$/.test(text) && steps.length) {
    return { type: 'deterministic', actions: [{ type: 'next-important' }] };
  }
  if (/\b(?:onceki|geri|previous)\b.*\b(?:onemli|key|checkpoint)\b/.test(text) && steps.length) {
    return { type: 'deterministic', actions: [{ type: 'previous-important' }] };
  }
  if (/\b(oynat|baslat|devam|play|resume)\b/.test(text) && steps.length) {
    return { type: 'deterministic', actions: [{ type: 'play' }] };
  }
  if (/\b(?:leetcode\s*)?486\b|predict the winner|kazanan[ıi] tahmin/.test(text)
    && /\b(coz|cozum|yaz|olustur|kur|simule|goster|solve|write|create|simulate|show)\w*\b/.test(text)) {
    return { type: 'create-algorithm', template: 'predict-winner-interval-dp' };
  }
  const dpTemplate = resolveDpTemplateFromRequest(question);
  if (dpTemplate && /\b(coz|cozum|yaz|olustur|kur|simule|goster|solve|write|create|simulate|show)\w*\b/.test(text)) {
    return { type: 'create-algorithm', template: dpTemplate };
  }
  if (/\b(iki yonlu|cift yonlu|bidirectional)\b/.test(text) && /\bbfs\b/.test(text)
    && /\b(yaz|olustur|kur|ekle|generate|create|write|build)\b/.test(text)) {
    return { type: 'create-algorithm', template: 'bidirectional-bfs' };
  }
  if (/\b(input\w*|girdi\w*|veri\w*)\b/.test(text)
    && /\b(duzenle|uyarla|olustur|hazirla|degistir|parcala|adapt|create|prepare|change)\b/.test(text)) {
    return { type: 'adapt-input' };
  }
  if (/\b(graph\w*|graf\w*|node\w*|dugum\w*|cephe\w*|frontier\w*|layout\w*|yerlesim\w*)\b/.test(text)
    && /\b(duzenle|uyarla|degistir|ekle|sil|yay|genislet|yerlestir|renklendir|adapt|change|add|remove|spread|restyle|layout)\b/.test(text)) {
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
  if (/\b(yaz|olustur|kur|ekle|generate|create|write|build)\b/.test(text)) {
    const existingPreset = resolveAlgorithmPresetFromCommand(text);
    if (existingPreset && /\b(kod\w*|algoritma\w*|program\w*|mevcut|elimdeki|current|custom)\b/.test(text)) {
      return { type: 'create-algorithm', template: 'model-authored' };
    }
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
  if (/\b(algoritma|algorithm|kod|code|program)\b/.test(text)
    && /\b(yaz|olustur|kur|generate|create|write|build)\b/.test(text)) {
    const specificationWords = text.split(' ').filter((word) => !new Set([
      'bana', 'bir', 'benim', 'icin', 'lutfen', 'algoritma', 'algorithm', 'kod', 'code', 'program',
      'yaz', 'olustur', 'kur', 'generate', 'create', 'write', 'build', 'an', 'a', 'me', 'please',
    ]).has(word));
    if (specificationWords.length === 0) return { type: 'clarify-algorithm' };
    return { type: 'create-algorithm', template: 'model-authored' };
  }
  void currentIndex;
  return null;
};
