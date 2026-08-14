import type { SimulationStep } from '../types/simulation';
import { resolveAlgorithmPresetFromCommand } from './codeRegistry';
import { findImportantStepIndices } from './aiTimelineControl';
import type { Locale } from '../i18n/translations';
import { localizeAlgorithmName } from '../i18n/translations';
import { resolveDpTemplateFromRequest } from './dpTemplateCompiler';
import type { GodModeIntent } from '../types/titan';
import { extractFirstPublicHttpsUrl } from './webSource';

export type WebSourceIntent =
  | { type: 'read-web-source'; url: string }
  | { type: 'solve-web-problem'; url: string | null }
  | { type: 'explain-bound-solution' };

export const routeWebSourceRequest = (
  question: string,
  hasBoundSource: boolean,
): WebSourceIntent | null => {
  const url = extractFirstPublicHttpsUrl(question);
  const textWithoutUrl = url ? question.replace(url, ' ') : question;
  const text = normalizeGodModeText(textWithoutUrl);
  const wantsSolution = /\b(coz|cozum|kodla|yaz|uygula|simule|solve|solution|code|implement|visualize)\w*\b/.test(text);
  if (url) return wantsSolution
    ? { type: 'solve-web-problem', url }
    : { type: 'read-web-source', url };
  if (hasBoundSource && /\b(simdi|bunu|cozumu|solution)?\s*(anlat|acikla|explain|walkthrough)\w*\b/.test(text)) {
    return { type: 'explain-bound-solution' };
  }
  if (hasBoundSource && wantsSolution) return { type: 'solve-web-problem', url: null };
  return null;
};


export const normalizeGodModeText = (value: string): string => value
  .toLocaleLowerCase('tr-TR')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[×✕✖]/g, 'x')
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

export const extractDpDimensions = (request: string): { rows: number; columns: number } | null => {
  const match = normalizeGodModeText(request).match(/\b(\d{1,2})\s*(?:x|\*)\s*(\d{1,2})\b/);
  const rows = Number(match?.[1]);
  const columns = Number(match?.[2]);
  return Number.isInteger(rows) && Number.isInteger(columns)
    && rows >= 1 && rows <= 18 && columns >= 1 && columns <= 40
    ? { rows, columns }
    : null;
};

export const requestsUniqueDpInput = (request: string): boolean => {
  const text = normalizeGodModeText(request);
  return /\b(?:benzersiz|ozgun|unique|original)\s+(?:bir\s+)?(?:input|girdi|ornek|sample)\b/.test(text)
    || /\b(?:input|girdi|ornek|sample)\w*\s+(?:benzersiz|ozgun|unique|original)\b/.test(text);
};

export const canonicalCustomTitle = (request: string, locale: Locale): string => {
  const normalized = normalizeGodModeText(request);
  const dpTemplate = resolveDpTemplateFromRequest(request);
  const base = dpTemplate === 'house-robber-1d-dp'
    ? locale === 'tr' ? 'LeetCode 198 — Ev Soyguncusu' : 'LeetCode 198 — House Robber'
    : dpTemplate === 'lcs-2d-dp'
      ? locale === 'tr' ? 'LeetCode 1143 — En Uzun Ortak Alt Dizi' : 'LeetCode 1143 — Longest Common Subsequence'
    : dpTemplate === 'lcs-space-optimized-1d-dp'
      ? locale === 'tr' ? 'LeetCode 1143 — Bellek Optimize LCS' : 'LeetCode 1143 — Space-Optimized LCS'
    : dpTemplate === 'coin-change-1d-dp'
        ? locale === 'tr' ? 'LeetCode 322 — Bozuk Para Değişimi' : 'LeetCode 322 — Coin Change'
      : dpTemplate === 'edit-distance-2d-dp'
        ? locale === 'tr' ? 'LeetCode 72 — Düzenleme Mesafesi' : 'LeetCode 72 — Edit Distance'
      : dpTemplate === 'knapsack-2d-dp'
        ? locale === 'tr' ? '0/1 Sırt Çantası' : '0/1 Knapsack'
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
  algorithmName = '',
): GodModeIntent | null => {
  const catalogMatch = question.match(/^Create catalog problem:\s*([^/\s]+)\/(.+)$/i);
  if (catalogMatch) {
    return {
      type: 'create-catalog-problem',
      source: catalogMatch[1].trim().toLowerCase(),
      problemId: catalogMatch[2].trim(),
    };
  }
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
  const requestsGreedy = /\b(greedy|acgozlu)\b/.test(text);
  const currentIsJumpGame = /\bjump game\b/i.test(algorithmName);
  const currentIsLis = /\b(?:lis|longest increasing subsequence)\b/i.test(algorithmName);
  if ((/\bjump game\b/.test(text) || (currentIsJumpGame && requestsGreedy))
    && /\b(coz|yaz|olustur|simule|uygula|solve|write|create|simulate|apply)\w*\b/.test(text)) {
    return { type: 'create-algorithm', template: requestsGreedy ? 'jump-game-greedy' : 'jump-game-dp' };
  }
  const requestsFastLis = /\b(?:o\s*n\s*log\s*n|n\s*log\s*n|binary search|ikili arama)\b/.test(text);
  if ((/\b(?:lis|longest increasing subsequence)\b/.test(text) || (currentIsLis && requestsFastLis))
    && /\b(coz|yaz|olustur|simule|uygula|anlat|solve|write|create|simulate|apply|explain)\w*\b/.test(text)) {
    return { type: 'create-algorithm', template: requestsFastLis ? 'lis-binary-search' : 'lis-quadratic-dp' };
  }
  if (/\b(?:leetcode\s*)?486\b|predict the winner|kazanan[ıi] tahmin/.test(text)
    && /\b(coz|cozum|yaz|olustur|kur|simule|goster|solve|write|create|simulate|show)\w*\b/.test(text)) {
    return { type: 'create-algorithm', template: 'predict-winner-interval-dp' };
  }
  const dpTemplate = resolveDpTemplateFromRequest(question);
  if (dpTemplate && /\b(coz|cozum|yaz|olustur|kur|simule|goster|solve|write|create|simulate|show)\w*\b/.test(text)) {
    return { type: 'create-algorithm', template: dpTemplate };
  }
  const requestsGenericDp = /\b(?:1d|2d|interval)?\s*(?:dp|dynamic programming|dinamik programlama)\b/.test(text);
  const requestsGenericIntervalDp = /\binterval\s*(?:dp|dynamic programming|dinamik programlama)\b/.test(text);
  const requestsUniqueDp = /\b(?:model-authored|model authored)\b/.test(text)
    || /\b(?:ozgun|unique)\s+(?:bir\s+)?(?:2d\s+dp\s+)?(?:soru|problem|question)\b/.test(text);
  if (requestsGenericDp
    && /\b(coz|cozum|yaz|olustur|kur|simule|goster|solve|write|create|simulate|show)\w*\b/.test(text)) {
    if (/\b2d\b/.test(text) && !dpTemplate && !requestsUniqueDp) return { type: 'clarify-algorithm' };
    if (requestsUniqueDp) return { type: 'create-algorithm', template: 'model-authored' };
    const ignored = new Set([
      '1d', '2d', 'interval', 'dp', 'dynamic', 'programming', 'dinamik', 'programlama', 'tablo', 'table',
      'coz', 'cozum', 'yaz', 'olustur', 'kur', 'simule', 'goster', 'solve', 'write', 'create', 'simulate',
      'show', 'bana', 'bir', 'benim', 'icin', 'lutfen', 'please', 'et', 've', 'and', 'a', 'an', 'me',
      'soru', 'sorusu', 'problem', 'question',
    ]);
    const specificationWords = text.split(' ').filter((word) => !ignored.has(word));
    if (specificationWords.length === 0) return requestsGenericIntervalDp
      ? { type: 'create-algorithm', template: 'predict-winner-interval-dp' }
      : { type: 'clarify-algorithm' };
  }
  const requestsMemoryOptimization = /\b(bellek|memory|space)\b.*\b(optimi|min|azalt|dusur)|\bo min m n\b/.test(text);
  const currentAlgorithmIsLcs = /\b(lcs|longest common subsequence|en uzun ortak alt dizi)\b/i.test(algorithmName);
  if (requestsMemoryOptimization && currentAlgorithmIsLcs
    && /\b(yaz|olustur|kur|simule|goster|uygula|write|create|simulate|show|apply)\w*\b/.test(text)) {
    return { type: 'create-algorithm', template: 'lcs-space-optimized-1d-dp' };
  }
  if (/\b(iki yonlu|cift yonlu|bidirectional)\b/.test(text) && /\bbfs\b/.test(text)
    && /\b(yaz|olustur|kur|ekle|generate|create|write|build)\b/.test(text)) {
    return { type: 'create-algorithm', template: 'bidirectional-bfs' };
  }
  const leetCodeMatch = question.match(/^LeetCode problemi oluştur:\s*(.+)$/i) ?? question.match(/^Create LeetCode problem:\s*(.+)$/i);
  if (leetCodeMatch) {
    const problemId = leetCodeMatch[1].trim();
    // Support existing DP templates seamlessly
    const dpTemplate = resolveDpTemplateFromRequest(problemId);
    if (dpTemplate) return { type: 'create-algorithm', template: dpTemplate };
    if (problemId === 'predict-winner-interval-dp') return { type: 'create-algorithm', template: 'predict-winner-interval-dp' };
    if (problemId === 'bidirectional-bfs') return { type: 'create-algorithm', template: 'bidirectional-bfs' };
    if (problemId === 'dfs-graph') return { type: 'create-catalog-problem', source: 'leetcode', problemId: 'dfs-graph' };
    if (problemId === 'bfs-graph') return { type: 'create-catalog-problem', source: 'leetcode', problemId: 'bfs-graph' };

    return { type: 'create-catalog-problem', source: 'leetcode', problemId };
  }
  const requestsCompositeCreation = /\b(coz|cozum|yaz|generate|write|build|solve)\w*\b/.test(text)
    && /\b(simule|calistir|uygula|goster|simulate|run|execute|visualize|show)\w*\b/.test(text);
  const hasSizedInput = (
    /\b\d{1,2}\s*(?:x|\*)\s*\d{1,2}\b/.test(text)
    || /\b\d{1,2}\s*(?:elemanli|boyutlu|uzunlugunda)\b/.test(text)
  );
  const hasSizedInputTarget = /\b(bunu|bu|mevcut|current|this|simulasyon\w*|simulation\w*|input\w*|girdi\w*|dizi\w*|tablo\w*|matrix\w*|matris\w*|grid\w*)\b/.test(text);
  const hasResizeCommand = /\b(yap|yapar|yapin|yapalim|yapsana|yapabilir|cikar\w*|buyut\w*|degistir\w*|uyarla\w*|kur|make|resize|change|adapt)\b/.test(text);
  const hasExecutionCommand = /\b(simule|calistir|uygula|tekrar|yeniden|simulate|run|execute|rerun)\w*\b/.test(text);
  const requestsSizedResimulation = hasSizedInput
    && hasSizedInputTarget
    && (hasResizeCommand || hasExecutionCommand);
  if (!requestsCompositeCreation && requestsSizedResimulation) {
    return { type: 'adapt-input' };
  }
  if (!requestsCompositeCreation
    && /\b(input\w*|girdi\w*|veri\w*)\b/.test(text)
    && /\b(duzenle|uyarla|olustur|hazirla|degistir|parcala|genislet|buyut|uzat|karmasiklastir|adapt|create|prepare|change|expand|extend|grow|complexify)\w*\b/.test(text)) {
    return { type: 'adapt-input' };
  }
  if (/\b(graph\w*|graf\w*|node\w*|nod\w*|dugum\w*|cephe\w*|frontier\w*|layout\w*|yerlesim\w*)\b/.test(text)
    && /\b(duzenle|uyarla|degistir|ekle|sil|kaldir|yay|genislet|yerlestir|renklendir|adapt|change|add|remove|delete|spread|restyle|layout)\b/.test(text)) {
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
      '2d', '1d', 'dp', 'dinamik', 'programlama', 'dynamic', 'programming',
      'array', 'dizi', 'graph', 'graf', 'matrix', 'matris', 'tree', 'agac',
      'linked', 'list', 'bagli', 'liste', 'bfs', 'dfs'
    ]).has(word));
    if (specificationWords.length === 0) return { type: 'clarify-algorithm' };
    return { type: 'create-algorithm', template: 'model-authored' };
  }
  const requestsAuthoredSolution = /\b(coz|cozum|yaz|olustur|kur|generate|create|write|build|solve)\w*\b/.test(text);
  const requestsExecutableResult = /\b(simule|calistir|uygula|goster|simulate|run|execute|visualize|show)\w*\b/.test(text);
  if (requestsAuthoredSolution && requestsExecutableResult) {
    const specificationWords = text.split(' ').filter((word) => !new Set([
      'bana', 'bir', 'benim', 'icin', 'lutfen', 'soru', 'sorusu', 'problem', 'algoritma', 'algorithm',
      'kod', 'code', 'program', 'coz', 'cozum', 'yaz', 'olustur', 'kur', 'simule', 'calistir', 'uygula',
      'goster', 'generate', 'create', 'write', 'build', 'solve', 'simulate', 'run', 'execute', 'visualize',
      'show', 'an', 'a', 'me', 'please', 'et', 've', 'and',
      '2d', '1d', 'dp', 'dinamik', 'programlama', 'dynamic', 'programming',
      'array', 'dizi', 'graph', 'graf', 'matrix', 'matris', 'tree', 'agac',
      'linked', 'list', 'bagli', 'liste', 'bfs', 'dfs'
    ]).has(word));
    return specificationWords.length > 0
      ? { type: 'create-algorithm', template: 'model-authored' }
      : { type: 'clarify-algorithm' };
  }
  void currentIndex;
  return null;
};
