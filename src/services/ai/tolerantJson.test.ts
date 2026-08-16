import { describe, expect, it } from 'vitest';
import { extractTolerantJson } from './tolerantJson';
import { LOCAL_AI_USABLE_OUTPUT_TOKENS, roleMaxTokens } from './roleBudgets';

interface Command { action: 'jump'; phase: string }
const command = (value: unknown): value is Command => Boolean(value && typeof value === 'object'
  && (value as Record<string, unknown>).action === 'jump'
  && typeof (value as Record<string, unknown>).phase === 'string');

describe('tolerant local-model structured output', () => {
  it('removes reasoning and extracts the first schema-valid object', () => {
    const result = extractTolerantJson('<think>private reasoning</think> Answer: ```json\n{"action":"jump","phase":"p2"}\n``` trailing', command);
    expect(result).toEqual({ ok: true, value: { action: 'jump', phase: 'p2' }, repaired: false });
  });

  it('repairs single quotes and trailing commas', () => {
    const result = extractTolerantJson("prose {'action':'jump','phase':'p2.b',}", command);
    expect(result).toEqual({ ok: true, value: { action: 'jump', phase: 'p2.b' }, repaired: true });
  });

  it('fails closed when extraction or schema validation fails', () => {
    expect(extractTolerantJson('plain prose', command)).toMatchObject({ ok: false });
    expect(extractTolerantJson('{"action":"none"}', command)).toMatchObject({ ok: false });
  });

  it('adds measured reasoning overhead to usable role budgets within the profile limit', () => {
    expect(LOCAL_AI_USABLE_OUTPUT_TOKENS).toEqual({ route: 120, navigate: 120, 'edit-input': 160, explain: 600, translate: 900 });
    expect(roleMaxTokens('navigate', 500, 1024)).toBe(620);
    expect(roleMaxTokens('translate', 500, 1024)).toBe(1024);
  });
});
