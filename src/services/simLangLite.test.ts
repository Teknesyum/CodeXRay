import { describe, expect, it } from 'vitest';
import type { ProgramSpecV1, SimLangExpression, SimLangStatement } from '../types/titan';
import { parseLite, renderLite } from './simLangLite';

const literal = (value: number): SimLangExpression => ({ type: 'literal', value });
const variable = (name: string): SimLangExpression => ({ type: 'variable', name });

const expressions: SimLangExpression[] = [
  { type: 'literal', value: { label: 'x', values: [1, true, null] } },
  variable('value'),
  { type: 'input-field', field: 'array' },
  { type: 'binary', operator: '+', left: variable('value'), right: literal(1) },
  { type: 'unary', operator: 'not', value: variable('done') },
  { type: 'length', value: variable('values') },
  { type: 'array-at', value: variable('values'), index: literal(0) },
  { type: 'range', start: literal(0), end: literal(3) },
  { type: 'contains', collection: variable('seen'), value: variable('value') },
  { type: 'map-get', map: variable('parents'), key: variable('value') },
  { type: 'neighbors', node: variable('value') },
  { type: 'first-intersection', left: variable('left'), right: variable('right') },
  { type: 'reconstruct-bidirectional-path', meeting: variable('value'), parentFromStart: variable('left'), parentFromTarget: variable('right') },
];

const statements: SimLangStatement[] = [
  { id: 's1', type: 'declare', name: 'value', value: expressions[0] },
  { id: 's2', type: 'assign', name: 'value', value: expressions[3] },
  { id: 's3', type: 'array-push', array: 'values', value: expressions[1] },
  { id: 's4', type: 'array-shift', array: 'values', target: 'value' },
  { id: 's5', type: 'array-set', array: 'values', index: literal(0), value: literal(2) },
  { id: 's6', type: 'swap', array: 'values', left: literal(0), right: literal(1) },
  { id: 's7', type: 'set-add', set: 'seen', value: expressions[1] },
  { id: 's8', type: 'map-set', map: 'parents', key: expressions[1], value: literal(0) },
  { id: 's9', type: 'if', condition: expressions[8], then: [{ id: 's10', type: 'continue' }], else: [{ id: 's11', type: 'break' }] },
  { id: 's12', type: 'while', condition: expressions[4], maxIterations: 20, body: [{ id: 's13', type: 'assign', name: 'done', value: { type: 'literal', value: true } }] },
  { id: 's14', type: 'for-each', item: 'item', values: expressions[7], body: [{ id: 's15', type: 'array-push', array: 'values', value: variable('item') }] },
  { id: 's16', type: 'call', functionName: 'helper', args: expressions.slice(9), result: 'answer' },
  { id: 's17', type: 'trace', at: 's1', explanation: 'Initialize values.', importance: 0.5 },
  { id: 's18', type: 'return', value: variable('answer') },
];

const program: ProgramSpecV1 = {
  version: 1,
  id: 'lite_roundtrip',
  title: 'Lite round trip',
  locale: 'en',
  inputKind: 'array',
  entry: statements,
  functions: [{ name: 'helper', parameters: ['node'], body: [{ id: 'f1', type: 'return', value: variable('node') }] }],
  budgets: { instructions: 2000, traceSteps: 200, recursionDepth: 16, collectionSize: 500 },
};

describe('SimLang-Lite', () => {
  it('round-trips every expression and statement variant canonically', () => {
    const lite = renderLite(program);
    expect(parseLite(lite)).toEqual(program);
    expect(renderLite(parseLite(lite))).toBe(lite);
  });

  it('is materially smaller than formatted JSON', () => {
    expect(renderLite(program).length).toBeLessThan(JSON.stringify(program, null, 2).length * 0.6);
  });

  it('reports malformed input with a line number', () => {
    expect(() => parseLite('program "x" "X" en array\nbudgets 20 1 1 1\nentry\n  nope s1\nend'))
      .toThrow(/Line 4: Unsupported statement/);
  });
});
