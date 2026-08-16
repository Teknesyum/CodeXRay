import { sanitizeLocalModelAnswer } from '../aiResponse';

export type TolerantJsonResult<T> =
  | { ok: true; value: T; repaired: boolean }
  | { ok: false; reason: string };

const firstBalancedObject = (source: string): string | null => {
  let start = -1;
  let depth = 0;
  let quote: '"' | "'" | null = null;
  let escaped = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'") { quote = character; continue; }
    if (character === '{') {
      if (depth === 0) start = index;
      depth += 1;
    } else if (character === '}' && depth > 0) {
      depth -= 1;
      if (depth === 0 && start >= 0) return source.slice(start, index + 1);
    }
  }
  return null;
};

const repairObject = (source: string): string => source
  .replace(/([{,]\s*)'([^'\\]*(?:\\.[^'\\]*)*)'\s*:/g, '$1"$2":')
  .replace(/:\s*'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_match, value: string) => `:${JSON.stringify(value.replace(/\\'/g, "'"))}`)
  .replace(/,\s*([}\]])/g, '$1');

export const extractTolerantJson = <T>(
  answer: string,
  validate: (value: unknown) => value is T,
): TolerantJsonResult<T> => {
  const cleaned = sanitizeLocalModelAnswer(answer)
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  const object = firstBalancedObject(cleaned);
  if (!object) return { ok: false, reason: 'No balanced JSON object was found in the model output.' };
  for (const [candidate, repaired] of [[object, false], [repairObject(object), true]] as const) {
    try {
      const parsed: unknown = JSON.parse(candidate);
      if (validate(parsed)) return { ok: true, value: parsed, repaired };
    } catch {
      continue;
    }
  }
  return { ok: false, reason: 'The extracted object did not match the required schema.' };
};
