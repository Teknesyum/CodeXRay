import type { RawTrace, RawTraceStep } from './types';

const scalar = (value: string): string | number | boolean | null => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null') return null;
  if (/^-?\d+(?:\.\d+)?$/.test(value)) return Number(value);
  return value.replace(/^(['"])(.*)\1$/, '$2');
};

const predicate = (expression: string): ((step: RawTraceStep) => boolean) => {
  const match = /^([A-Za-z_$][\w$]*)\s*(===|==|!==|!=|<=|>=|<|>)\s*(.+)$/.exec(expression.trim());
  if (!match) throw new Error(`Unsupported trace expression '${expression}'.`);
  const [, name, operator, raw] = match;
  const expected = scalar(raw.trim());
  return (step) => {
    const actual = step.scopes[name];
    if (operator === '===' || operator === '==') return actual === expected;
    if (operator === '!==' || operator === '!=') return actual !== expected;
    if (operator === '<') return (actual as number) < (expected as number);
    if (operator === '<=') return (actual as number) <= (expected as number);
    if (operator === '>') return (actual as number) > (expected as number);
    return (actual as number) >= (expected as number);
  };
};

export const queryTrace = (trace: RawTrace, query: string): number | null => {
  const source = query.trim();
  const line = /^line\((\d+)\)$/.exec(source);
  if (line) return trace.steps.find((step) => step.line === Number(line[1]))?.index ?? null;
  if (source === 'error()') return trace.error ? trace.steps.at(-1)?.index ?? null : null;
  const extremum = /^(max|min)\(([A-Za-z_$][\w$]*)\)$/.exec(source);
  if (extremum) {
    const values = trace.steps.filter((step) => typeof step.scopes[extremum[2]] === 'number');
    if (!values.length) return null;
    return values.reduce((best, step) => {
      const current = step.scopes[extremum[2]] as number;
      const previous = best.scopes[extremum[2]] as number;
      return extremum[1] === 'max' ? current > previous ? step : best : current < previous ? step : best;
    }).index;
  }
  const selection = /^(first|last)\((.+)\)$/.exec(source);
  if (selection) {
    const matches = trace.steps.filter(predicate(selection[2]));
    return (selection[1] === 'first' ? matches[0] : matches.at(-1))?.index ?? null;
  }
  const nth = /^nth\((\d+)\s*,\s*(.+)\)$/.exec(source);
  if (nth) return trace.steps.filter(predicate(nth[2]))[Number(nth[1])]?.index ?? null;
  throw new Error(`Unsupported trace query '${query}'.`);
};
