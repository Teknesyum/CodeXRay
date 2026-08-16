import type {
  ProgramSpecV1,
  SimLangExpression,
  SimLangFunctionV1,
  SimLangStatement,
} from '../types/titan';
import type { TraceValue } from '../types/simulation';
import { validateProgramSpec } from './simLang';

const quote = (value: string) => JSON.stringify(value);

const renderLiteral = (value: TraceValue): string => {
  if (Array.isArray(value)) return `(array ${value.map(renderLiteral).join(' ')})`;
  if (value && typeof value === 'object') {
    return `(object ${Object.entries(value).map(([key, item]) => `${quote(key)} ${renderLiteral(item)}`).join(' ')})`;
  }
  return typeof value === 'string' ? quote(value) : String(value);
};

const renderExpression = (expression: SimLangExpression): string => {
  switch (expression.type) {
    case 'literal': return renderLiteral(expression.value);
    case 'variable': return `$${expression.name}`;
    case 'input-field': return `@${expression.field}`;
    case 'binary': return `(${expression.operator} ${renderExpression(expression.left)} ${renderExpression(expression.right)})`;
    case 'unary': return `(${expression.operator} ${renderExpression(expression.value)})`;
    case 'length': return `(len ${renderExpression(expression.value)})`;
    case 'array-at': return `(at ${renderExpression(expression.value)} ${renderExpression(expression.index)})`;
    case 'range': return `(range ${renderExpression(expression.start)} ${renderExpression(expression.end)})`;
    case 'contains': return `(contains ${renderExpression(expression.collection)} ${renderExpression(expression.value)})`;
    case 'map-get': return `(map-get ${renderExpression(expression.map)} ${renderExpression(expression.key)})`;
    case 'neighbors': return `(neighbors ${renderExpression(expression.node)})`;
    case 'first-intersection': return `(first-intersection ${renderExpression(expression.left)} ${renderExpression(expression.right)})`;
    case 'reconstruct-bidirectional-path': return `(reconstruct ${renderExpression(expression.meeting)} ${renderExpression(expression.parentFromStart)} ${renderExpression(expression.parentFromTarget)})`;
  }
};

const indent = (depth: number) => '  '.repeat(depth);

const renderStatements = (statements: SimLangStatement[], depth: number): string[] => statements.flatMap((statement) => {
  const prefix = `${indent(depth)}${statement.type} ${statement.id}`;
  switch (statement.type) {
    case 'declare': return [`${prefix} ${statement.name} ${renderExpression(statement.value)}`];
    case 'assign': return [`${prefix} ${statement.name} ${renderExpression(statement.value)}`];
    case 'array-push': return [`${prefix} ${statement.array} ${renderExpression(statement.value)}`];
    case 'array-shift': return [`${prefix} ${statement.array} ${statement.target}`];
    case 'array-set': return [`${prefix} ${statement.array} ${renderExpression(statement.index)} ${renderExpression(statement.value)}`];
    case 'swap': return [`${prefix} ${statement.array} ${renderExpression(statement.left)} ${renderExpression(statement.right)}`];
    case 'set-add': return [`${prefix} ${statement.set} ${renderExpression(statement.value)}`];
    case 'map-set': return [`${prefix} ${statement.map} ${renderExpression(statement.key)} ${renderExpression(statement.value)}`];
    case 'if': return [
      `${prefix} ${renderExpression(statement.condition)}`,
      ...renderStatements(statement.then, depth + 1),
      ...(statement.else ? [`${indent(depth)}else`, ...renderStatements(statement.else, depth + 1)] : []),
      `${indent(depth)}end`,
    ];
    case 'while': return [`${prefix} ${statement.maxIterations} ${renderExpression(statement.condition)}`, ...renderStatements(statement.body, depth + 1), `${indent(depth)}end`];
    case 'for-each': return [`${prefix} ${statement.item} ${renderExpression(statement.values)}`, ...renderStatements(statement.body, depth + 1), `${indent(depth)}end`];
    case 'call': return [`${prefix} ${statement.functionName} ${statement.result ?? '-'} ${statement.args.map(renderExpression).join(' ')}`.trimEnd()];
    case 'return': return [`${prefix}${statement.value ? ` ${renderExpression(statement.value)}` : ''}`];
    case 'break':
    case 'continue': return [prefix];
    case 'trace': return [`${prefix} ${quote(statement.at)} ${quote(statement.explanation)} ${statement.category ?? '-'} ${statement.importance ?? '-'}`];
  }
});

export const renderLite = (program: ProgramSpecV1): string => [
  `program ${quote(program.id)} ${quote(program.title)} ${program.locale} ${program.inputKind}`,
  `budgets ${program.budgets.instructions} ${program.budgets.traceSteps} ${program.budgets.recursionDepth} ${program.budgets.collectionSize}`,
  'entry',
  ...renderStatements(program.entry, 1),
  'end',
  ...program.functions.flatMap((fn) => [`fn ${fn.name} ${fn.parameters.join(' ')}`.trimEnd(), ...renderStatements(fn.body, 1), 'end']),
].join('\n');

const tokenize = (source: string): string[] => source.match(/"(?:\\.|[^"\\])*"|\(|\)|[^\s()]+/g) ?? [];

class LiteError extends Error {
  constructor(line: number, message: string) {
    super(`Line ${line}: ${message}`);
    this.name = 'SimLangLiteError';
  }
}

class ExpressionReader {
  private index = 0;
  readonly tokens: string[];
  readonly line: number;

  constructor(source: string, line: number) {
    this.tokens = tokenize(source);
    this.line = line;
  }

  done() { return this.index >= this.tokens.length; }

  read(): SimLangExpression {
    const token = this.tokens[this.index++];
    if (!token) throw new LiteError(this.line, 'Expected expression.');
    if (token.startsWith('$')) return { type: 'variable', name: token.slice(1) };
    if (token.startsWith('@')) return { type: 'input-field', field: token.slice(1) as 'text' | 'array' | 'graph' | 'startId' | 'targetId' };
    if (token !== '(') return { type: 'literal', value: this.literal(token) };
    const operator = this.tokens[this.index++];
    if (!operator) throw new LiteError(this.line, 'Expected expression operator.');
    const close = () => {
      if (this.tokens[this.index++] !== ')') throw new LiteError(this.line, `Expected ')' after ${operator}.`);
    };
    if (operator === 'array') {
      const value: TraceValue[] = [];
      while (this.tokens[this.index] !== ')') value.push(this.readLiteralValue());
      close();
      return { type: 'literal', value };
    }
    if (operator === 'object') {
      const value: Record<string, TraceValue> = {};
      while (this.tokens[this.index] !== ')') {
        const key = this.literal(this.tokens[this.index++]);
        if (typeof key !== 'string') throw new LiteError(this.line, 'Object key must be a string.');
        value[key] = this.readLiteralValue();
      }
      close();
      return { type: 'literal', value };
    }
    const first = this.read();
    if (['not', 'negate'].includes(operator)) { close(); return { type: 'unary', operator: operator as 'not' | 'negate', value: first }; }
    if (operator === 'len') { close(); return { type: 'length', value: first }; }
    if (operator === 'neighbors') { close(); return { type: 'neighbors', node: first }; }
    const second = this.read();
    if (operator === 'at') { close(); return { type: 'array-at', value: first, index: second }; }
    if (operator === 'range') { close(); return { type: 'range', start: first, end: second }; }
    if (operator === 'contains') { close(); return { type: 'contains', collection: first, value: second }; }
    if (operator === 'map-get') { close(); return { type: 'map-get', map: first, key: second }; }
    if (operator === 'first-intersection') { close(); return { type: 'first-intersection', left: first, right: second }; }
    if (operator === 'reconstruct') {
      const third = this.read(); close();
      return { type: 'reconstruct-bidirectional-path', meeting: first, parentFromStart: second, parentFromTarget: third };
    }
    close();
    return { type: 'binary', operator: operator as never, left: first, right: second };
  }

  private readLiteralValue(): TraceValue {
    const expression = this.read();
    if (expression.type !== 'literal') throw new LiteError(this.line, 'Nested literal cannot contain an expression.');
    return expression.value;
  }

  private literal(token: string): TraceValue {
    if (token === 'null') return null;
    if (token === 'true') return true;
    if (token === 'false') return false;
    if (token.startsWith('"')) return JSON.parse(token) as string;
    const number = Number(token);
    if (Number.isFinite(number)) return number;
    throw new LiteError(this.line, `Invalid literal '${token}'.`);
  }
}

const expression = (source: string, line: number): SimLangExpression => {
  const reader = new ExpressionReader(source, line);
  const result = reader.read();
  if (!reader.done()) throw new LiteError(line, 'Unexpected tokens after expression.');
  return result;
};

const expressions = (source: string, line: number): SimLangExpression[] => {
  const reader = new ExpressionReader(source, line);
  const result: SimLangExpression[] = [];
  while (!reader.done()) result.push(reader.read());
  return result;
};

const splitHead = (line: string, count: number) => {
  const parts = line.trim().split(/\s+/, count);
  const offset = parts.reduce((total, part) => total + part.length + 1, 0);
  return { parts, rest: line.trim().slice(offset) };
};

export const parseLite = (text: string): ProgramSpecV1 => {
  const lines = text.split(/\r?\n/).map((raw, index) => ({ raw: raw.trim(), number: index + 1 })).filter((line) => line.raw);
  let cursor = 0;
  const header = tokenize(lines[cursor]?.raw ?? '');
  if (header[0] !== 'program' || header.length !== 5) throw new LiteError(lines[cursor]?.number ?? 1, 'Expected program header.');
  cursor += 1;
  const budget = tokenize(lines[cursor]?.raw ?? '');
  if (budget[0] !== 'budgets' || budget.length !== 5) throw new LiteError(lines[cursor]?.number ?? 2, 'Expected budgets header.');
  cursor += 1;

  const parseBlock = (terminators: string[]): SimLangStatement[] => {
    const statements: SimLangStatement[] = [];
    while (cursor < lines.length && !terminators.includes(lines[cursor].raw)) {
      const line = lines[cursor++];
      const { parts, rest } = splitHead(line.raw, 3);
      const [type, id, name] = parts;
      if (!id) throw new LiteError(line.number, 'Statement ID is required.');
      if (type === 'declare' || type === 'assign' || type === 'array-push' || type === 'set-add') {
        statements.push({ type, id, ...(type === 'array-push' ? { array: name } : type === 'set-add' ? { set: name } : { name }), value: expression(rest, line.number) } as SimLangStatement);
      } else if (type === 'array-shift') {
        const tokens = tokenize(line.raw); statements.push({ type, id, array: tokens[2], target: tokens[3] });
      } else if (type === 'array-set') {
        const values = expressions(rest, line.number);
        if (values.length !== 2) throw new LiteError(line.number, 'array-set requires index and value expressions.');
        statements.push({ type, id, array: name, index: values[0], value: values[1] });
      } else if (type === 'swap') {
        const values = expressions(rest, line.number);
        if (values.length !== 2) throw new LiteError(line.number, 'swap requires two index expressions.');
        statements.push({ type, id, array: name, left: values[0], right: values[1] });
      } else if (type === 'map-set') {
        const values = expressions(rest, line.number);
        if (values.length !== 2) throw new LiteError(line.number, 'map-set requires key and value expressions.');
        statements.push({ type, id, map: name, key: values[0], value: values[1] });
      } else if (type === 'break' || type === 'continue') statements.push({ type, id });
      else if (type === 'return') statements.push({ type, id, value: rest ? expression(`${name}${rest ? ` ${rest}` : ''}`, line.number) : name ? expression(name, line.number) : undefined });
      else if (type === 'if') {
        const condition = expression(`${name} ${rest}`.trim(), line.number);
        const then = parseBlock(['else', 'end']);
        let otherwise: SimLangStatement[] | undefined;
        if (lines[cursor]?.raw === 'else') { cursor += 1; otherwise = parseBlock(['end']); }
        if (lines[cursor++]?.raw !== 'end') throw new LiteError(line.number, 'Unclosed if.');
        statements.push({ type, id, condition, then, else: otherwise });
      } else if (type === 'while') {
        const tokens = splitHead(line.raw, 4);
        const maxIterations = Number(tokens.parts[2]);
        const condition = expression(`${tokens.parts[3]} ${tokens.rest}`.trim(), line.number);
        const body = parseBlock(['end']); cursor += 1;
        statements.push({ type, id, maxIterations, condition, body });
      } else if (type === 'for-each') {
        const body = parseBlock(['end']); cursor += 1;
        statements.push({ type, id, item: name, values: expression(rest, line.number), body });
      } else if (type === 'call') {
        const tokens = splitHead(line.raw, 4);
        statements.push({
          type,
          id,
          functionName: tokens.parts[2],
          result: tokens.parts[3] === '-' ? undefined : tokens.parts[3],
          args: expressions(tokens.rest, line.number),
        });
      } else if (type === 'trace') {
        const tokens = tokenize(line.raw);
        statements.push({ type, id, at: JSON.parse(tokens[2]), explanation: JSON.parse(tokens[3]), category: tokens[4] === '-' ? undefined : tokens[4] as never, importance: tokens[5] === '-' ? undefined : Number(tokens[5]) });
      } else {
        throw new LiteError(line.number, `Unsupported statement '${type}'.`);
      }
    }
    return statements;
  };

  if (lines[cursor++]?.raw !== 'entry') throw new LiteError(lines[cursor - 1]?.number ?? 3, 'Expected entry block.');
  const entry = parseBlock(['end']); cursor += 1;
  const functions: SimLangFunctionV1[] = [];
  while (cursor < lines.length) {
    const tokens = tokenize(lines[cursor]?.raw ?? '');
    const line = lines[cursor++]?.number ?? 1;
    if (tokens[0] !== 'fn' || !tokens[1]) throw new LiteError(line, 'Expected function header.');
    const body = parseBlock(['end']); cursor += 1;
    functions.push({ name: tokens[1], parameters: tokens.slice(2), body });
  }
  const program: ProgramSpecV1 = {
    version: 1,
    id: JSON.parse(header[1]), title: JSON.parse(header[2]), locale: header[3] as 'en' | 'tr', inputKind: header[4] as ProgramSpecV1['inputKind'],
    entry, functions,
    budgets: { instructions: Number(budget[1]), traceSteps: Number(budget[2]), recursionDepth: Number(budget[3]), collectionSize: Number(budget[4]) },
  };
  const validation = validateProgramSpec(program);
  if (!validation.valid) throw new LiteError(1, validation.errors.join('; '));
  return program;
};
