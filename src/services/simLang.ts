import type {
  ArrayVisualData,
  BarVisualData,
  GraphDocumentV1,
  GraphVisualData,
  IntervalVisualData,
  MatrixCellHighlight,
  MatrixVisualData,
  RowsVisualData,
  SimulationInput,
  SimulationStep,
  StringMatchVisualData,
  TraceValue,
  VariablesVisualData,
  VisualData,
} from '../types/simulation';
import type {
  ProgramSpecV1,
  RenderedSourceV1,
  SimLangExpression,
  SimLangFunctionV1,
  SimLangStatement,
  SemanticEdgeRoleV1,
  SemanticNodeRoleV1,
  VisualizationContract,
} from '../types/titan';
import { isVisualizationV2 } from './visualizationDesigner';

type RuntimeScalar = string | number | boolean | null;
type RuntimeValue =
  | RuntimeScalar
  | RuntimeValue[]
  | { [key: string]: RuntimeValue }
  | Set<RuntimeValue>
  | Map<string, RuntimeValue>;

interface RuntimeEnvironment {
  scopes: Array<Map<string, RuntimeValue>>;
  input: SimulationInput;
  graph?: GraphDocumentV1;
  source: RenderedSourceV1;
  visualization: VisualizationContract;
  functions: Map<string, SimLangFunctionV1>;
  steps: SimulationStep[];
  instructions: number;
  recursionDepth: number;
  program: ProgramSpecV1;
}

type ControlSignal =
  | { type: 'break' }
  | { type: 'continue' }
  | { type: 'return'; value: RuntimeValue }
  | null;

export class SimLangError extends Error {
  readonly statementId?: string;

  constructor(
    message: string,
    statementId?: string,
  ) {
    super(statementId ? `${message} [${statementId}]` : message);
    this.statementId = statementId;
    this.name = 'SimLangError';
  }
}

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;
const STATEMENT_LIMIT = 1_200;
const EXPRESSION_DEPTH_LIMIT = 32;

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const hasOnlyKeys = (value: Record<string, unknown>, allowed: string[]): boolean =>
  Object.keys(value).every((key) => allowed.includes(key));

const validateExpression = (
  value: unknown,
  path: string,
  errors: string[],
  depth = 0,
): value is SimLangExpression => {
  if (depth > EXPRESSION_DEPTH_LIMIT) {
    errors.push(`${path} exceeds the expression depth limit.`);
    return false;
  }
  if (!isPlainObject(value) || typeof value.type !== 'string') {
    errors.push(`${path} must be a SimLang expression object.`);
    return false;
  }
  const nested = (candidate: unknown, segment: string) =>
    validateExpression(candidate, `${path}.${segment}`, errors, depth + 1);
  switch (value.type) {
    case 'literal':
      if (!hasOnlyKeys(value, ['type', 'value'])) errors.push(`${path} has unknown keys.`);
      return 'value' in value;
    case 'variable':
      if (!hasOnlyKeys(value, ['type', 'name']) || typeof value.name !== 'string' || !IDENTIFIER.test(value.name)) {
        errors.push(`${path}.name is invalid.`);
        return false;
      }
      return true;
    case 'input-field':
      if (
        !hasOnlyKeys(value, ['type', 'field'])
        || !['text', 'array', 'graph', 'startId', 'targetId'].includes(String(value.field))
      ) {
        errors.push(`${path}.field is invalid.`);
        return false;
      }
      return true;
    case 'binary':
      if (!hasOnlyKeys(value, ['type', 'operator', 'left', 'right'])) errors.push(`${path} has unknown keys.`);
      if (!['+', '-', '*', '/', '%', '==', '!=', '<', '<=', '>', '>=', 'and', 'or'].includes(String(value.operator))) {
        errors.push(`${path}.operator is invalid.`);
      }
      return nested(value.left, 'left') && nested(value.right, 'right');
    case 'unary':
      if (!hasOnlyKeys(value, ['type', 'operator', 'value'])) errors.push(`${path} has unknown keys.`);
      if (!['not', 'negate'].includes(String(value.operator))) errors.push(`${path}.operator is invalid.`);
      return nested(value.value, 'value');
    case 'length':
      if (!hasOnlyKeys(value, ['type', 'value'])) errors.push(`${path} has unknown keys.`);
      return nested(value.value, 'value');
    case 'array-at':
      if (!hasOnlyKeys(value, ['type', 'value', 'index'])) errors.push(`${path} has unknown keys.`);
      return nested(value.value, 'value') && nested(value.index, 'index');
    case 'range':
      if (!hasOnlyKeys(value, ['type', 'start', 'end'])) errors.push(`${path} has unknown keys.`);
      return nested(value.start, 'start') && nested(value.end, 'end');
    case 'contains':
      if (!hasOnlyKeys(value, ['type', 'collection', 'value'])) errors.push(`${path} has unknown keys.`);
      return nested(value.collection, 'collection') && nested(value.value, 'value');
    case 'map-get':
      if (!hasOnlyKeys(value, ['type', 'map', 'key'])) errors.push(`${path} has unknown keys.`);
      return nested(value.map, 'map') && nested(value.key, 'key');
    case 'neighbors':
      if (!hasOnlyKeys(value, ['type', 'node'])) errors.push(`${path} has unknown keys.`);
      return nested(value.node, 'node');
    case 'first-intersection':
      if (!hasOnlyKeys(value, ['type', 'left', 'right'])) errors.push(`${path} has unknown keys.`);
      return nested(value.left, 'left') && nested(value.right, 'right');
    case 'reconstruct-bidirectional-path':
      if (!hasOnlyKeys(value, ['type', 'meeting', 'parentFromStart', 'parentFromTarget'])) {
        errors.push(`${path} has unknown keys.`);
      }
      return nested(value.meeting, 'meeting')
        && nested(value.parentFromStart, 'parentFromStart')
        && nested(value.parentFromTarget, 'parentFromTarget');
    default:
      errors.push(`${path}.type is unknown.`);
      return false;
  }
};

const validateStatements = (
  values: unknown,
  path: string,
  errors: string[],
  ids: Set<string>,
  traceTargets: string[],
  counter: { value: number },
): values is SimLangStatement[] => {
  if (!Array.isArray(values)) {
    errors.push(`${path} must be an array.`);
    return false;
  }
  let valid = true;
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    const itemPath = `${path}[${index}]`;
    counter.value += 1;
    if (counter.value > STATEMENT_LIMIT) {
      errors.push(`Program exceeds ${STATEMENT_LIMIT} statements.`);
      return false;
    }
    if (!isPlainObject(value) || typeof value.id !== 'string' || !IDENTIFIER.test(value.id)) {
      errors.push(`${itemPath}.id is invalid.`);
      valid = false;
      continue;
    }
    if (ids.has(value.id)) errors.push(`${itemPath}.id must be unique.`);
    ids.add(value.id);
    if (typeof value.type !== 'string') {
      errors.push(`${itemPath}.type is required.`);
      valid = false;
      continue;
    }
    const identifier = (name: unknown, field: string) => {
      if (typeof name !== 'string' || !IDENTIFIER.test(name)) {
        errors.push(`${itemPath}.${field} is invalid.`);
        valid = false;
      }
    };
    const expression = (candidate: unknown, field: string) => {
      if (!validateExpression(candidate, `${itemPath}.${field}`, errors)) valid = false;
    };
    switch (value.type) {
      case 'declare':
      case 'assign':
        if (!hasOnlyKeys(value, ['id', 'type', 'name', 'value'])) errors.push(`${itemPath} has unknown keys.`);
        identifier(value.name, 'name');
        expression(value.value, 'value');
        break;
      case 'array-push':
        if (!hasOnlyKeys(value, ['id', 'type', 'array', 'value'])) errors.push(`${itemPath} has unknown keys.`);
        identifier(value.array, 'array');
        expression(value.value, 'value');
        break;
      case 'array-shift':
        if (!hasOnlyKeys(value, ['id', 'type', 'array', 'target'])) errors.push(`${itemPath} has unknown keys.`);
        identifier(value.array, 'array');
        identifier(value.target, 'target');
        break;
      case 'array-set':
        if (!hasOnlyKeys(value, ['id', 'type', 'array', 'index', 'value'])) errors.push(`${itemPath} has unknown keys.`);
        identifier(value.array, 'array');
        expression(value.index, 'index');
        expression(value.value, 'value');
        break;
      case 'swap':
        if (!hasOnlyKeys(value, ['id', 'type', 'array', 'left', 'right'])) errors.push(`${itemPath} has unknown keys.`);
        identifier(value.array, 'array');
        expression(value.left, 'left');
        expression(value.right, 'right');
        break;
      case 'set-add':
        if (!hasOnlyKeys(value, ['id', 'type', 'set', 'value'])) errors.push(`${itemPath} has unknown keys.`);
        identifier(value.set, 'set');
        expression(value.value, 'value');
        break;
      case 'map-set':
        if (!hasOnlyKeys(value, ['id', 'type', 'map', 'key', 'value'])) errors.push(`${itemPath} has unknown keys.`);
        identifier(value.map, 'map');
        expression(value.key, 'key');
        expression(value.value, 'value');
        break;
      case 'if':
        if (!hasOnlyKeys(value, ['id', 'type', 'condition', 'then', 'else'])) errors.push(`${itemPath} has unknown keys.`);
        expression(value.condition, 'condition');
        if (!validateStatements(value.then, `${itemPath}.then`, errors, ids, traceTargets, counter)) valid = false;
        if (value.else !== undefined && !validateStatements(value.else, `${itemPath}.else`, errors, ids, traceTargets, counter)) valid = false;
        break;
      case 'while':
        if (!hasOnlyKeys(value, ['id', 'type', 'condition', 'body', 'maxIterations'])) errors.push(`${itemPath} has unknown keys.`);
        expression(value.condition, 'condition');
        if (
          isPlainObject(value.condition)
          && value.condition.type === 'literal'
          && value.condition.value === true
        ) {
          errors.push(`${itemPath} contains an unconditional infinite loop.`);
          valid = false;
        }
        if (!Number.isSafeInteger(value.maxIterations) || Number(value.maxIterations) < 1 || Number(value.maxIterations) > 2_000) {
          errors.push(`${itemPath}.maxIterations must be between 1 and 2000.`);
          valid = false;
        }
        if (!validateStatements(value.body, `${itemPath}.body`, errors, ids, traceTargets, counter)) valid = false;
        break;
      case 'for-each':
        if (!hasOnlyKeys(value, ['id', 'type', 'item', 'values', 'body'])) errors.push(`${itemPath} has unknown keys.`);
        identifier(value.item, 'item');
        expression(value.values, 'values');
        if (!validateStatements(value.body, `${itemPath}.body`, errors, ids, traceTargets, counter)) valid = false;
        break;
      case 'call':
        if (!hasOnlyKeys(value, ['id', 'type', 'functionName', 'args', 'result'])) errors.push(`${itemPath} has unknown keys.`);
        identifier(value.functionName, 'functionName');
        if (value.result !== undefined) identifier(value.result, 'result');
        if (!Array.isArray(value.args)) {
          errors.push(`${itemPath}.args must be an array.`);
          valid = false;
        } else {
          value.args.forEach((arg, argIndex) => expression(arg, `args[${argIndex}]`));
        }
        break;
      case 'return':
        if (!hasOnlyKeys(value, ['id', 'type', 'value'])) errors.push(`${itemPath} has unknown keys.`);
        if (value.value !== undefined) expression(value.value, 'value');
        break;
      case 'break':
      case 'continue':
        if (!hasOnlyKeys(value, ['id', 'type'])) errors.push(`${itemPath} has unknown keys.`);
        break;
      case 'trace':
        if (!hasOnlyKeys(value, ['id', 'type', 'at', 'explanation', 'category', 'importance'])) errors.push(`${itemPath} has unknown keys.`);
        if (typeof value.at !== 'string') errors.push(`${itemPath}.at is required.`);
        else traceTargets.push(value.at);
        if (typeof value.explanation !== 'string' || !value.explanation.trim() || value.explanation.length > 600) {
          errors.push(`${itemPath}.explanation is invalid.`);
        }
        if (value.importance !== undefined && (
          typeof value.importance !== 'number' || value.importance < 0 || value.importance > 1
        )) errors.push(`${itemPath}.importance must be between 0 and 1.`);
        break;
      default:
        errors.push(`${itemPath}.type is unknown.`);
        valid = false;
    }
  }
  return valid;
};

export interface ProgramValidationResult {
  valid: boolean;
  errors: string[];
  program?: ProgramSpecV1;
}

export const validateProgramSpec = (value: unknown): ProgramValidationResult => {
  const errors: string[] = [];
  if (!isPlainObject(value)) return { valid: false, errors: ['Program must be an object.'] };
  if (!hasOnlyKeys(value, ['version', 'id', 'title', 'locale', 'inputKind', 'entry', 'functions', 'budgets'])) {
    errors.push('Program contains unknown top-level keys.');
  }
  if (value.version !== 1) errors.push('Program version must be 1.');
  if (typeof value.id !== 'string' || !IDENTIFIER.test(value.id)) errors.push('Program id is invalid.');
  if (typeof value.title !== 'string' || !value.title.trim() || value.title.length > 120) errors.push('Program title is invalid.');
  if (value.locale !== 'en' && value.locale !== 'tr') errors.push('Program locale is invalid.');
  if (!['array', 'string', 'tree', 'graph'].includes(String(value.inputKind))) errors.push('Program inputKind is invalid.');

  const ids = new Set<string>();
  const traceTargets: string[] = [];
  const counter = { value: 0 };
  validateStatements(value.entry, 'entry', errors, ids, traceTargets, counter);

  if (!Array.isArray(value.functions)) {
    errors.push('Program functions must be an array.');
  } else {
    const functionNames = new Set<string>();
    value.functions.forEach((candidate, index) => {
      const path = `functions[${index}]`;
      if (!isPlainObject(candidate) || !hasOnlyKeys(candidate, ['name', 'parameters', 'body'])) {
        errors.push(`${path} is invalid.`);
        return;
      }
      if (typeof candidate.name !== 'string' || !IDENTIFIER.test(candidate.name) || functionNames.has(candidate.name)) {
        errors.push(`${path}.name is invalid or duplicated.`);
      } else functionNames.add(candidate.name);
      if (!Array.isArray(candidate.parameters) || candidate.parameters.some((parameter) =>
        typeof parameter !== 'string' || !IDENTIFIER.test(parameter))) {
        errors.push(`${path}.parameters are invalid.`);
      }
      validateStatements(candidate.body, `${path}.body`, errors, ids, traceTargets, counter);
    });
  }

  if (!isPlainObject(value.budgets) || !hasOnlyKeys(value.budgets, [
    'instructions', 'traceSteps', 'recursionDepth', 'collectionSize',
  ])) {
    errors.push('Program budgets are invalid.');
  } else {
    const budgets = value.budgets as Record<string, unknown>;
    const budgetRanges: Record<string, [number, number]> = {
      instructions: [20, 20_000],
      traceSteps: [1, 1_200],
      recursionDepth: [1, 64],
      collectionSize: [1, 10_000],
    };
    Object.entries(budgetRanges).forEach(([key, [minimum, maximum]]) => {
      const candidate = budgets[key];
      if (!Number.isSafeInteger(candidate) || Number(candidate) < minimum || Number(candidate) > maximum) {
        errors.push(`Program budget ${key} must be between ${minimum} and ${maximum}.`);
      }
    });
  }

  traceTargets.forEach((target) => {
    if (!ids.has(target)) errors.push(`Trace target ${target} does not exist.`);
  });
  return errors.length
    ? { valid: false, errors }
    : { valid: true, errors: [], program: value as unknown as ProgramSpecV1 };
};

const renderLiteral = (value: TraceValue): string => {
  if (value === null) return 'nullptr';
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) return `{ ${value.map(renderLiteral).join(', ')} }`;
  if (typeof value === 'object') {
    return `{ ${Object.entries(value).map(([key, item]) => `{${JSON.stringify(key)}, ${renderLiteral(item)}}`).join(', ')} }`;
  }
  return String(value);
};

const renderExpression = (expression: SimLangExpression): string => {
  switch (expression.type) {
    case 'literal': return renderLiteral(expression.value);
    case 'variable': return expression.name;
    case 'input-field':
      if (expression.field === 'array') return 'input.values';
      if (expression.field === 'graph') return 'input.graph';
      return `input.${expression.field}`;
    case 'binary': {
      const operator = expression.operator === 'and'
        ? '&&'
        : expression.operator === 'or' ? '||' : expression.operator;
      return `(${renderExpression(expression.left)} ${operator} ${renderExpression(expression.right)})`;
    }
    case 'unary': return `${expression.operator === 'not' ? '!' : '-'}${renderExpression(expression.value)}`;
    case 'length': return `${renderExpression(expression.value)}.size()`;
    case 'array-at': return `${renderExpression(expression.value)}[${renderExpression(expression.index)}]`;
    case 'range': return `range(${renderExpression(expression.start)}, ${renderExpression(expression.end)})`;
    case 'contains': return `contains(${renderExpression(expression.collection)}, ${renderExpression(expression.value)})`;
    case 'map-get': return `${renderExpression(expression.map)}[${renderExpression(expression.key)}]`;
    case 'neighbors': return `neighbors(${renderExpression(expression.node)})`;
    case 'first-intersection': return `firstIntersection(${renderExpression(expression.left)}, ${renderExpression(expression.right)})`;
    case 'reconstruct-bidirectional-path':
      return `reconstructPath(${renderExpression(expression.meeting)}, ${renderExpression(expression.parentFromStart)}, ${renderExpression(expression.parentFromTarget)})`;
    default: return '/* unsupported expression */';
  }
};

export const renderProgramSource = (program: ProgramSpecV1): RenderedSourceV1 => {
  const lines: string[] = [
    '#include <algorithm>',
    '#include <queue>',
    '#include <string>',
    '#include <unordered_map>',
    '#include <unordered_set>',
    '#include <vector>',
    'using namespace std;',
    '',
  ];
  const lineMap: Record<string, number> = {};
  const append = (text: string, indent: number, id?: string) => {
    if (id && lineMap[id] === undefined) lineMap[id] = lines.length + 1;
    lines.push(`${'  '.repeat(indent)}${text}`);
  };
  const renderStatements = (statements: SimLangStatement[], indent: number) => {
    statements.forEach((statement) => {
      if (statement.type === 'trace') return;
      switch (statement.type) {
        case 'declare': append(`auto ${statement.name} = ${renderExpression(statement.value)};`, indent, statement.id); break;
        case 'assign': append(`${statement.name} = ${renderExpression(statement.value)};`, indent, statement.id); break;
        case 'array-push': append(`${statement.array}.push_back(${renderExpression(statement.value)});`, indent, statement.id); break;
        case 'array-shift': append(`${statement.target} = ${statement.array}.front(); ${statement.array}.erase(${statement.array}.begin());`, indent, statement.id); break;
        case 'array-set': append(`${statement.array}[${renderExpression(statement.index)}] = ${renderExpression(statement.value)};`, indent, statement.id); break;
        case 'swap': append(`swap(${statement.array}[${renderExpression(statement.left)}], ${statement.array}[${renderExpression(statement.right)}]);`, indent, statement.id); break;
        case 'set-add': append(`${statement.set}.insert(${renderExpression(statement.value)});`, indent, statement.id); break;
        case 'map-set': append(`${statement.map}[${renderExpression(statement.key)}] = ${renderExpression(statement.value)};`, indent, statement.id); break;
        case 'if':
          append(`if (${renderExpression(statement.condition)}) {`, indent, statement.id);
          renderStatements(statement.then, indent + 1);
          if (statement.else?.length) {
            append('} else {', indent);
            renderStatements(statement.else, indent + 1);
          }
          append('}', indent);
          break;
        case 'while':
          append(`while (${renderExpression(statement.condition)}) {`, indent, statement.id);
          renderStatements(statement.body, indent + 1);
          append('}', indent);
          break;
        case 'for-each':
          append(`for (const auto& ${statement.item} : ${renderExpression(statement.values)}) {`, indent, statement.id);
          renderStatements(statement.body, indent + 1);
          append('}', indent);
          break;
        case 'call':
          append(`${statement.result ? `${statement.result} = ` : ''}${statement.functionName}(${statement.args.map(renderExpression).join(', ')});`, indent, statement.id);
          break;
        case 'return': append(`return${statement.value ? ` ${renderExpression(statement.value)}` : ''};`, indent, statement.id); break;
        case 'break': append('break;', indent, statement.id); break;
        case 'continue': append('continue;', indent, statement.id); break;
        default: break;
      }
    });
  };

  program.functions.forEach((definition) => {
    append(`auto ${definition.name}(${definition.parameters.map((parameter) => `auto ${parameter}`).join(', ')}) {`, 0);
    renderStatements(definition.body, 1);
    append('}', 0);
    append('', 0);
  });
  append('int main() {', 0);
  renderStatements(program.entry, 1);
  append('return 0;', 1);
  append('}', 0);
  return { version: 1, language: 'cpp', code: lines.join('\n'), lineMap };
};

const parseInputArray = (input: SimulationInput): RuntimeValue[] => {
  try {
    const parsed = JSON.parse(input.text) as unknown;
    return Array.isArray(parsed) ? parsed as RuntimeValue[] : [];
  } catch {
    return input.text.split(',').map((part) => {
      const trimmed = part.trim();
      const numeric = Number(trimmed);
      return Number.isFinite(numeric) ? numeric : trimmed;
    }).filter((value) => value !== '');
  }
};

const cloneRuntimeValue = (value: RuntimeValue): RuntimeValue => {
  if (value instanceof Set) return new Set([...value].map(cloneRuntimeValue));
  if (value instanceof Map) return new Map([...value].map(([key, item]) => [key, cloneRuntimeValue(item)]));
  if (Array.isArray(value)) return value.map(cloneRuntimeValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneRuntimeValue(item)]));
  }
  return value;
};

const toTraceValue = (value: RuntimeValue, seen = new WeakSet<object>()): TraceValue => {
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value as TraceValue;
  if (seen.has(value)) return '[Circular]';
  seen.add(value);
  if (value instanceof Set) return [...value].map((item) => toTraceValue(item, seen));
  if (value instanceof Map) {
    return Object.fromEntries([...value].map(([key, item]) => [key, toTraceValue(item, seen)]));
  }
  if (Array.isArray(value)) return value.map((item) => toTraceValue(item, seen));
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, toTraceValue(item, seen)]));
};

const getVariable = (environment: RuntimeEnvironment, name: string): RuntimeValue => {
  for (let index = environment.scopes.length - 1; index >= 0; index -= 1) {
    if (environment.scopes[index].has(name)) return environment.scopes[index].get(name) ?? null;
  }
  throw new SimLangError(`Unknown variable ${name}.`);
};

const setVariable = (environment: RuntimeEnvironment, name: string, value: RuntimeValue) => {
  for (let index = environment.scopes.length - 1; index >= 0; index -= 1) {
    if (environment.scopes[index].has(name)) {
      environment.scopes[index].set(name, value);
      return;
    }
  }
  environment.scopes[environment.scopes.length - 1].set(name, value);
};

const asNumber = (value: RuntimeValue): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new SimLangError('Expected a finite number.');
  return value;
};

const asString = (value: RuntimeValue): string => {
  if (typeof value !== 'string') throw new SimLangError('Expected a string.');
  return value;
};

const asBoolean = (value: RuntimeValue): boolean => {
  if (typeof value !== 'boolean') throw new SimLangError('Expected a boolean condition.');
  return value;
};

const iterableValues = (value: RuntimeValue): RuntimeValue[] => {
  if (Array.isArray(value)) return [...value];
  if (value instanceof Set) return [...value];
  if (typeof value === 'string') return [...value];
  throw new SimLangError('Expected an iterable value.');
};

const mapValue = (value: RuntimeValue): Map<string, RuntimeValue> => {
  if (value instanceof Map) return value;
  if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Set)) {
    return new Map(Object.entries(value));
  }
  throw new SimLangError('Expected a map value.');
};

const evaluateExpression = (expression: SimLangExpression, environment: RuntimeEnvironment): RuntimeValue => {
  switch (expression.type) {
    case 'literal':
      if (Array.isArray(expression.value)) {
        return expression.value.length === 0
          ? []
          : expression.value.map((item) => cloneRuntimeValue(item as RuntimeValue));
      }
      if (expression.value && typeof expression.value === 'object') {
        const entries = Object.entries(expression.value);
        return entries.length === 0
          ? new Map<string, RuntimeValue>()
          : Object.fromEntries(entries.map(([key, value]) => [key, cloneRuntimeValue(value as RuntimeValue)]));
      }
      return expression.value;
    case 'variable': return getVariable(environment, expression.name);
    case 'input-field':
      if (expression.field === 'array') return parseInputArray(environment.input);
      if (expression.field === 'graph') return environment.graph as unknown as RuntimeValue ?? null;
      if (expression.field === 'startId') return environment.graph?.startId ?? null;
      if (expression.field === 'targetId') return environment.graph?.targetId ?? null;
      return environment.input.text;
    case 'binary': {
      if (expression.operator === 'and') {
        return asBoolean(evaluateExpression(expression.left, environment))
          && asBoolean(evaluateExpression(expression.right, environment));
      }
      if (expression.operator === 'or') {
        return asBoolean(evaluateExpression(expression.left, environment))
          || asBoolean(evaluateExpression(expression.right, environment));
      }
      const left = evaluateExpression(expression.left, environment);
      const right = evaluateExpression(expression.right, environment);
      switch (expression.operator) {
        case '+': return typeof left === 'string' || typeof right === 'string'
          ? `${String(left)}${String(right)}` : asNumber(left) + asNumber(right);
        case '-': return asNumber(left) - asNumber(right);
        case '*': return asNumber(left) * asNumber(right);
        case '/': {
          const divisor = asNumber(right);
          if (divisor === 0) throw new SimLangError('Division by zero.');
          return asNumber(left) / divisor;
        }
        case '%': return asNumber(left) % asNumber(right);
        case '==': return JSON.stringify(toTraceValue(left)) === JSON.stringify(toTraceValue(right));
        case '!=': return JSON.stringify(toTraceValue(left)) !== JSON.stringify(toTraceValue(right));
        case '<': return asNumber(left) < asNumber(right);
        case '<=': return asNumber(left) <= asNumber(right);
        case '>': return asNumber(left) > asNumber(right);
        case '>=': return asNumber(left) >= asNumber(right);
        default: throw new SimLangError('Unknown binary operator.');
      }
    }
    case 'unary': {
      const value = evaluateExpression(expression.value, environment);
      return expression.operator === 'not' ? !asBoolean(value) : -asNumber(value);
    }
    case 'length': {
      const value = evaluateExpression(expression.value, environment);
      if (Array.isArray(value) || typeof value === 'string') return value.length;
      if (value instanceof Set || value instanceof Map) return value.size;
      throw new SimLangError('Length requires an array, string, set, or map.');
    }
    case 'array-at': {
      const value = evaluateExpression(expression.value, environment);
      const index = asNumber(evaluateExpression(expression.index, environment));
      if (!Array.isArray(value) && typeof value !== 'string') throw new SimLangError('Indexing requires an array or string.');
      return value[index] ?? null;
    }
    case 'range': {
      const start = asNumber(evaluateExpression(expression.start, environment));
      const end = asNumber(evaluateExpression(expression.end, environment));
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)) throw new SimLangError('Range bounds must be integers.');
      const length = Math.max(0, end - start);
      if (length > environment.program.budgets.collectionSize) throw new SimLangError('Range exceeds the collection budget.');
      return Array.from({ length }, (_, index) => start + index);
    }
    case 'contains': {
      const collection = evaluateExpression(expression.collection, environment);
      const value = evaluateExpression(expression.value, environment);
      if (collection instanceof Set) return collection.has(value);
      if (Array.isArray(collection)) return collection.some((item) => JSON.stringify(toTraceValue(item)) === JSON.stringify(toTraceValue(value)));
      if (typeof collection === 'string') return collection.includes(asString(value));
      throw new SimLangError('Contains requires an array, string, or set.');
    }
    case 'map-get': {
      const map = mapValue(evaluateExpression(expression.map, environment));
      return map.get(String(evaluateExpression(expression.key, environment))) ?? null;
    }
    case 'neighbors': {
      const node = asString(evaluateExpression(expression.node, environment));
      const graph = environment.graph;
      if (!graph) throw new SimLangError('Neighbors require graph input.');
      const neighbors: string[] = [];
      graph.edges.forEach((edge) => {
        if (edge.from === node) neighbors.push(edge.to);
        if (!graph.directed && edge.to === node) neighbors.push(edge.from);
      });
      return [...new Set(neighbors)];
    }
    case 'first-intersection': {
      const left = iterableValues(evaluateExpression(expression.left, environment));
      const right = iterableValues(evaluateExpression(expression.right, environment));
      const rightKeys = new Set(right.map((item) => JSON.stringify(toTraceValue(item))));
      return left.find((item) => rightKeys.has(JSON.stringify(toTraceValue(item)))) ?? null;
    }
    case 'reconstruct-bidirectional-path': {
      const meeting = evaluateExpression(expression.meeting, environment);
      if (meeting === null) return [];
      const meetingNode = asString(meeting);
      const fromStart = mapValue(evaluateExpression(expression.parentFromStart, environment));
      const fromTarget = mapValue(evaluateExpression(expression.parentFromTarget, environment));
      const left = [meetingNode];
      let cursor = meetingNode;
      const guard = new Set([cursor]);
      while (fromStart.get(cursor) !== null && fromStart.has(cursor)) {
        cursor = asString(fromStart.get(cursor) ?? null);
        if (guard.has(cursor)) throw new SimLangError('Parent map contains a cycle.');
        guard.add(cursor);
        left.push(cursor);
      }
      left.reverse();
      const right: string[] = [];
      cursor = meetingNode;
      while (fromTarget.get(cursor) !== null && fromTarget.has(cursor)) {
        cursor = asString(fromTarget.get(cursor) ?? null);
        if (guard.has(cursor)) throw new SimLangError('Parent map contains a cycle.');
        guard.add(cursor);
        right.push(cursor);
      }
      return [...left, ...right];
    }
    default: throw new SimLangError('Unsupported expression.');
  }
};

const allVariables = (environment: RuntimeEnvironment): Record<string, TraceValue> => {
  const values = new Map<string, RuntimeValue>();
  environment.scopes.forEach((scope) => scope.forEach((value, key) => values.set(key, value)));
  return Object.fromEntries([...values].map(([key, value]) => [key, toTraceValue(value)]));
};

const arrayOfStrings = (value: RuntimeValue | undefined): string[] => {
  if (value instanceof Set) return [...value].filter((item): item is string => typeof item === 'string');
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
  return [];
};

const graphEdgeKey = (from: string, to: string): string => `${from}\u0000${to}`;

const addGraphEdge = (
  target: Set<string>,
  from: RuntimeValue | undefined,
  to: RuntimeValue | undefined,
): void => {
  if (typeof from === 'string' && typeof to === 'string') {
    target.add(graphEdgeKey(from, to));
  }
};

const semanticNodeIds = (
  source: SemanticNodeRoleV1['source'],
  environment: RuntimeEnvironment,
): Set<string> => {
  if (source.kind === 'input-start') return new Set(environment.graph ? [environment.graph.startId] : []);
  if (source.kind === 'input-target') return new Set(environment.graph?.targetId ? [environment.graph.targetId] : []);
  if (source.kind === 'variable') {
    const value = getVariableOrUndefined(environment, source.variable);
    return new Set(typeof value === 'string' ? [value] : []);
  }
  if (source.kind === 'collection') {
    return new Set(arrayOfStrings(getVariableOrUndefined(environment, source.variable)));
  }
  if (!('variables' in source)) return new Set();
  const [left, right] = source.variables.map((name: string) =>
    new Set(arrayOfStrings(getVariableOrUndefined(environment, name))));
  return new Set([...left].filter((id) => right.has(id)));
};

const edgeRoleMatches = (
  role: SemanticEdgeRoleV1,
  edge: { from: string; to: string },
  environment: RuntimeEnvironment,
): boolean => {
  const matches = (from: string, to: string) =>
    (edge.from === from && edge.to === to)
    || (!environment.graph?.directed && edge.from === to && edge.to === from);
  if (role.source.kind === 'active-variables') {
    const from = getVariableOrUndefined(environment, role.source.fromVariable);
    const to = getVariableOrUndefined(environment, role.source.toVariable);
    return typeof from === 'string' && typeof to === 'string' && matches(from, to);
  }
  if (role.source.kind === 'path') {
    const path = arrayOfStrings(getVariableOrUndefined(environment, role.source.variable));
    return path.slice(0, -1).some((from, index) => matches(from, path[index + 1]));
  }
  const value = getVariableOrUndefined(environment, role.source.variable);
  const entries = value instanceof Map
    ? [...value.entries()]
    : value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Set)
      ? Object.entries(value)
      : [];
  return entries.some(([child, parent]) => typeof parent === 'string' && matches(parent, child));
};

const primitiveArray = (value: RuntimeValue | undefined): Array<string | number | boolean | null> =>
  Array.isArray(value)
    ? value.map((item) => toTraceValue(item)).filter((item): item is string | number | boolean | null =>
      item === null || ['string', 'number', 'boolean'].includes(typeof item))
    : [];

const numericArray = (value: RuntimeValue | undefined): number[] =>
  primitiveArray(value).filter((item): item is number => typeof item === 'number');

const numericValue = (environment: RuntimeEnvironment, variable: string | undefined): number | undefined => {
  if (!variable) return undefined;
  const value = getVariableOrUndefined(environment, variable);
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
};

const intervalArray = (value: RuntimeValue | undefined): Array<[number, number]> =>
  Array.isArray(value) ? value.flatMap((item) =>
    Array.isArray(item) && typeof item[0] === 'number' && typeof item[1] === 'number'
      ? [[item[0], item[1]] as [number, number]] : []) : [];

const buildVisualData = (environment: RuntimeEnvironment): VisualData => {
  const variables = allVariables(environment);
  const contract = environment.visualization;
  if (contract.type === 'graph' && environment.graph) {
    const active = new Set(contract.activeVariables.flatMap((name) =>
      arrayOfStrings(getVariableOrUndefined(environment, name))
        .concat(typeof getVariableOrUndefined(environment, name) === 'string'
          ? [String(getVariableOrUndefined(environment, name))] : [])));
    const queued = new Set(contract.queuedVariables.flatMap((name) => arrayOfStrings(getVariableOrUndefined(environment, name))));
    const visited = new Set(contract.visitedVariables.flatMap((name) => arrayOfStrings(getVariableOrUndefined(environment, name))));
    const path = new Set(arrayOfStrings(contract.pathVariable
      ? getVariableOrUndefined(environment, contract.pathVariable) : undefined));
    const pathArray = contract.pathVariable
      ? arrayOfStrings(getVariableOrUndefined(environment, contract.pathVariable)) : [];
    const pathEdges = new Set(pathArray.slice(0, -1).map((node, index) => graphEdgeKey(node, pathArray[index + 1])));
    const activeEdges = new Set<string>();
    contract.activeEdges?.forEach(({ fromVariable, toVariable }) => addGraphEdge(
      activeEdges,
      getVariableOrUndefined(environment, fromVariable),
      getVariableOrUndefined(environment, toVariable),
    ));
    const traversedEdges = new Set<string>();
    contract.traversedEdgeMapVariables?.forEach((variableName) => {
      const value = getVariableOrUndefined(environment, variableName);
      const entries = value instanceof Map
        ? [...value.entries()]
        : value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Set)
          ? Object.entries(value)
          : [];
      entries.forEach(([child, parent]) => addGraphEdge(traversedEdges, parent, child));
    });
    const hasEdge = (edges: Set<string>, from: string, to: string): boolean =>
      edges.has(graphEdgeKey(from, to))
      || (!environment.graph?.directed && edges.has(graphEdgeKey(to, from)));
    const nodeRoleMembership = isVisualizationV2(contract)
      ? contract.nodeRoles.map((role) => ({ role, ids: semanticNodeIds(role.source, environment) }))
      : [];
    const visual: GraphVisualData = {
      type: 'graph',
      directed: environment.graph.directed,
      nodes: environment.graph.nodes.map((node) => {
        const semanticRoles = nodeRoleMembership
          .filter(({ ids }) => ids.has(node.id))
          .map(({ role }) => role)
          .sort((left, right) => right.priority - left.priority);
        return {
          ...node,
          state: path.has(node.id)
          ? 'path'
          : active.has(node.id)
            ? 'active'
            : queued.has(node.id)
              ? 'queued'
              : visited.has(node.id) ? 'visited' : 'idle',
          semanticRoles: semanticRoles.map((role) => role.id),
          semanticStyle: semanticRoles[0]?.style,
        };
      }),
      edges: environment.graph.edges.map((edge) => {
        const semanticRoles = isVisualizationV2(contract)
          ? contract.edgeRoles
            .filter((role) => edgeRoleMatches(role, edge, environment))
            .sort((left, right) => right.priority - left.priority)
          : [];
        return {
          ...edge,
          state: hasEdge(pathEdges, edge.from, edge.to)
          ? 'path'
          : hasEdge(activeEdges, edge.from, edge.to) || hasEdge(traversedEdges, edge.from, edge.to)
            ? semanticRoles.some((role) => role.source.kind === 'parent-map') ? 'visited' : 'active'
            : 'idle',
          semanticRoles: semanticRoles.map((role) => role.id),
          semanticStyle: semanticRoles[0]?.style,
        };
      }),
      vars: variables,
    };
    return visual;
  }
  if (contract.type === 'matrix') {
    const config = contract.matrix;
    const inferredVariable = ['matrix', 'dp', 'table', 'costs'].find((name) => {
      const candidate = getVariableOrUndefined(environment, name);
      return Array.isArray(candidate) && candidate.some(Array.isArray);
    });
    const raw = getVariableOrUndefined(environment, config?.valuesVariable ?? inferredVariable ?? 'matrix');
    const values = Array.isArray(raw) ? raw.map((row) => primitiveArray(row)) : [];
    const rawHighlights = config?.highlightsVariable
      ? getVariableOrUndefined(environment, config.highlightsVariable) : undefined;
    const highlights: MatrixCellHighlight[] = Array.isArray(rawHighlights) ? rawHighlights.flatMap((item) => {
      if (!item || Array.isArray(item) || item instanceof Set || item instanceof Map || typeof item !== 'object') return [];
      const row = item.row;
      const column = item.column;
      const role = item.role;
      if (typeof row !== 'number' || typeof column !== 'number'
        || !['empty', 'base', 'dependency', 'active', 'computed', 'result'].includes(String(role))) return [];
      return [{ row, column, role: role as MatrixCellHighlight['role'], ...(typeof item.label === 'string' ? { label: item.label } : {}) }];
    }) : [];
    const visual: MatrixVisualData = {
      type: 'matrix', values,
      rowLabels: config?.rowLabels ?? values.map((_, index) => String(index)),
      columnLabels: config?.columnLabels ?? values[0]?.map((_, index) => String(index)) ?? [],
      highlights, fillDirection: config?.fillDirection ?? 'row', vars: variables,
    };
    return visual;
  }
  if (contract.type === 'string-match' && contract.stringMatch) {
    const config = contract.stringMatch;
    const text = getVariableOrUndefined(environment, config.textVariable);
    const pattern = config.patternVariable ? getVariableOrUndefined(environment, config.patternVariable) : undefined;
    const window = config.windowVariable ? numericArray(getVariableOrUndefined(environment, config.windowVariable)) : [];
    const visual: StringMatchVisualData = {
      type: 'string-match', text: typeof text === 'string' ? text : '',
      ...(typeof pattern === 'string' ? { pattern } : {}),
      alignment: numericValue(environment, config.alignmentVariable),
      activeText: numericArray(config.activeTextVariable ? getVariableOrUndefined(environment, config.activeTextVariable) : undefined),
      activePattern: numericArray(config.activePatternVariable ? getVariableOrUndefined(environment, config.activePatternVariable) : undefined),
      matchedText: numericArray(config.matchedTextVariable ? getVariableOrUndefined(environment, config.matchedTextVariable) : undefined),
      mismatchText: numericValue(environment, config.mismatchTextVariable),
      window: window.length >= 2 ? [window[0], window[1]] : undefined,
      vars: variables,
    };
    return visual;
  }
  if (contract.type === 'bars' && contract.bars) {
    const values = numericArray(getVariableOrUndefined(environment, contract.bars.valuesVariable));
    const water = contract.bars.waterVariable
      ? numericArray(getVariableOrUndefined(environment, contract.bars.waterVariable)) : new Array(values.length).fill(0) as number[];
    const pointers = Object.fromEntries((contract.bars.pointerVariables ?? []).flatMap((variable) => {
      const value = numericValue(environment, variable);
      return value === undefined ? [] : [[variable, value]];
    }));
    const visual: BarVisualData = { type: 'bars', values, water, pointers, vars: variables };
    return visual;
  }
  if (contract.type === 'intervals' && contract.intervals) {
    const current = contract.intervals.currentVariable
      ? intervalArray([getVariableOrUndefined(environment, contract.intervals.currentVariable) as RuntimeValue])[0] : undefined;
    const visual: IntervalVisualData = {
      type: 'intervals', intervals: intervalArray(getVariableOrUndefined(environment, contract.intervals.intervalsVariable)),
      merged: intervalArray(getVariableOrUndefined(environment, contract.intervals.mergedVariable)), current, vars: variables,
    };
    return visual;
  }
  if (contract.type === 'rows' && contract.rows) {
    const rawActive = contract.rows.activeVariable ? getVariableOrUndefined(environment, contract.rows.activeVariable) : undefined;
    const active: RowsVisualData['active'] = Array.isArray(rawActive) ? rawActive.flatMap((item) => {
      if (!item || Array.isArray(item) || item instanceof Set || item instanceof Map || typeof item !== 'object') return [];
      if (typeof item.row !== 'number' || typeof item.column !== 'number'
        || !['active', 'dependency', 'result'].includes(String(item.role))) return [];
      return [{ row: item.row, column: item.column, role: item.role as 'active' | 'dependency' | 'result' }];
    }) : [];
    const visual: RowsVisualData = {
      type: 'rows', mode: contract.rows.mode,
      rows: contract.rows.rowVariables.map((row) => ({ label: row.label, values: primitiveArray(getVariableOrUndefined(environment, row.variable)) })),
      active, vars: variables,
    };
    return visual;
  }
  if (contract.type === 'array') {
    const source = getVariableOrUndefined(environment, 'array') ?? parseInputArray(environment.input);
    const values = Array.isArray(source)
      ? source.map((value) => toTraceValue(value)).filter((value): value is string | number | boolean | null =>
        value === null || ['string', 'number', 'boolean'].includes(typeof value))
      : [];
    const pointers = Object.fromEntries(Object.entries(variables)
      .filter(([, value]) => typeof value === 'number')
      .map(([key, value]) => [key, value as number]));
    const visual: ArrayVisualData = { type: 'array', values, pointers, vars: variables };
    return visual;
  }
  const visual: VariablesVisualData = { type: 'variables', vars: variables };
  return visual;
};

const getVariableOrUndefined = (environment: RuntimeEnvironment, name: string): RuntimeValue | undefined => {
  for (let index = environment.scopes.length - 1; index >= 0; index -= 1) {
    if (environment.scopes[index].has(name)) return environment.scopes[index].get(name);
  }
  return undefined;
};

const interpolateExplanation = (template: string, environment: RuntimeEnvironment): string =>
  template.replace(/\{\{([A-Za-z_][A-Za-z0-9_]*)\}\}/g, (_match, name: string) => {
    const value = getVariableOrUndefined(environment, name);
    return value === undefined ? name : JSON.stringify(toTraceValue(value));
  });

const enforceCollectionBudget = (environment: RuntimeEnvironment, value: RuntimeValue, statementId: string) => {
  const size = Array.isArray(value) || typeof value === 'string'
    ? value.length
    : value instanceof Set || value instanceof Map ? value.size : 0;
  if (size > environment.program.budgets.collectionSize) {
    throw new SimLangError('Collection budget exceeded.', statementId);
  }
};

const executeFunction = (
  definition: SimLangFunctionV1,
  args: RuntimeValue[],
  environment: RuntimeEnvironment,
  statementId: string,
): RuntimeValue => {
  if (environment.recursionDepth >= environment.program.budgets.recursionDepth) {
    throw new SimLangError('Recursion depth budget exceeded.', statementId);
  }
  environment.recursionDepth += 1;
  const scope = new Map<string, RuntimeValue>();
  definition.parameters.forEach((parameter, index) => scope.set(parameter, args[index] ?? null));
  environment.scopes.push(scope);
  try {
    const signal = executeStatements(definition.body, environment);
    return signal?.type === 'return' ? signal.value : null;
  } finally {
    environment.scopes.pop();
    environment.recursionDepth -= 1;
  }
};

const executeStatements = (
  statements: SimLangStatement[],
  environment: RuntimeEnvironment,
): ControlSignal => {
  for (const statement of statements) {
    environment.instructions += 1;
    if (environment.instructions > environment.program.budgets.instructions) {
      throw new SimLangError('Instruction budget exceeded.', statement.id);
    }
    switch (statement.type) {
      case 'declare':
        environment.scopes[environment.scopes.length - 1].set(
          statement.name,
          evaluateExpression(statement.value, environment),
        );
        break;
      case 'assign':
        setVariable(environment, statement.name, evaluateExpression(statement.value, environment));
        break;
      case 'array-push': {
        const array = getVariable(environment, statement.array);
        if (!Array.isArray(array)) throw new SimLangError(`${statement.array} is not an array.`, statement.id);
        array.push(evaluateExpression(statement.value, environment));
        enforceCollectionBudget(environment, array, statement.id);
        break;
      }
      case 'array-shift': {
        const array = getVariable(environment, statement.array);
        if (!Array.isArray(array)) throw new SimLangError(`${statement.array} is not an array.`, statement.id);
        if (!array.length) throw new SimLangError(`${statement.array} is empty.`, statement.id);
        setVariable(environment, statement.target, array.shift() ?? null);
        break;
      }
      case 'array-set': {
        const array = getVariable(environment, statement.array);
        const index = asNumber(evaluateExpression(statement.index, environment));
        if (!Array.isArray(array) || !Number.isSafeInteger(index) || index < 0 || index >= array.length) {
          throw new SimLangError('Array write index is out of bounds.', statement.id);
        }
        array[index] = evaluateExpression(statement.value, environment);
        break;
      }
      case 'swap': {
        const array = getVariable(environment, statement.array);
        const left = asNumber(evaluateExpression(statement.left, environment));
        const right = asNumber(evaluateExpression(statement.right, environment));
        if (!Array.isArray(array) || !Number.isSafeInteger(left) || !Number.isSafeInteger(right)
          || left < 0 || right < 0 || left >= array.length || right >= array.length) {
          throw new SimLangError('Swap index is out of bounds.', statement.id);
        }
        [array[left], array[right]] = [array[right], array[left]];
        break;
      }
      case 'set-add': {
        const current = getVariable(environment, statement.set);
        const set = current instanceof Set
          ? current
          : Array.isArray(current) ? new Set(current) : null;
        if (!set) throw new SimLangError(`${statement.set} is not a set.`, statement.id);
        set.add(evaluateExpression(statement.value, environment));
        setVariable(environment, statement.set, set);
        enforceCollectionBudget(environment, set, statement.id);
        break;
      }
      case 'map-set': {
        const map = mapValue(getVariable(environment, statement.map));
        map.set(
          String(evaluateExpression(statement.key, environment)),
          evaluateExpression(statement.value, environment),
        );
        setVariable(environment, statement.map, map);
        enforceCollectionBudget(environment, map, statement.id);
        break;
      }
      case 'if': {
        const branch = asBoolean(evaluateExpression(statement.condition, environment))
          ? statement.then : statement.else ?? [];
        const signal = executeStatements(branch, environment);
        if (signal) return signal;
        break;
      }
      case 'while': {
        let iterations = 0;
        while (asBoolean(evaluateExpression(statement.condition, environment))) {
          iterations += 1;
          if (iterations > statement.maxIterations) {
            throw new SimLangError('Loop iteration budget exceeded.', statement.id);
          }
          const signal = executeStatements(statement.body, environment);
          if (signal?.type === 'break') break;
          if (signal?.type === 'return') return signal;
          if (signal?.type === 'continue') continue;
        }
        break;
      }
      case 'for-each': {
        const values = iterableValues(evaluateExpression(statement.values, environment));
        enforceCollectionBudget(environment, values, statement.id);
        for (const value of values) {
          environment.scopes.push(new Map([[statement.item, value]]));
          const signal = executeStatements(statement.body, environment);
          environment.scopes.pop();
          if (signal?.type === 'break') break;
          if (signal?.type === 'return') return signal;
          if (signal?.type === 'continue') continue;
        }
        break;
      }
      case 'call': {
        const definition = environment.functions.get(statement.functionName);
        if (!definition) throw new SimLangError(`Unknown function ${statement.functionName}.`, statement.id);
        const result = executeFunction(
          definition,
          statement.args.map((arg) => evaluateExpression(arg, environment)),
          environment,
          statement.id,
        );
        if (statement.result) setVariable(environment, statement.result, result);
        break;
      }
      case 'return': return {
        type: 'return',
        value: statement.value ? evaluateExpression(statement.value, environment) : null,
      };
      case 'break': return { type: 'break' };
      case 'continue': return { type: 'continue' };
      case 'trace':
        if (environment.steps.length >= environment.program.budgets.traceSteps) {
          throw new SimLangError('Trace-step budget exceeded.', statement.id);
        }
        environment.steps.push({
          lineNumber: environment.source.lineMap[statement.at] ?? null,
          explanation: interpolateExplanation(statement.explanation, environment),
          visualData: buildVisualData(environment),
        });
        break;
      default: throw new SimLangError('Unknown statement.', (statement as SimLangStatement).id);
    }
  }
  return null;
};

export interface SimLangExecutionResult {
  steps: SimulationStep[];
  finalVariables: Record<string, TraceValue>;
  instructions: number;
}

export const executeSimLang = (
  program: ProgramSpecV1,
  input: SimulationInput,
  visualization: VisualizationContract,
  source = renderProgramSource(program),
): SimLangExecutionResult => {
  const validation = validateProgramSpec(program);
  if (!validation.valid || !validation.program) {
    throw new SimLangError(validation.errors.join(' '));
  }
  if (input.kind !== program.inputKind) {
    throw new SimLangError(`Expected ${program.inputKind} input, received ${input.kind}.`);
  }
  const environment: RuntimeEnvironment = {
    scopes: [new Map()],
    input,
    graph: input.graph,
    source,
    visualization,
    functions: new Map(program.functions.map((definition) => [definition.name, definition])),
    steps: [],
    instructions: 0,
    recursionDepth: 0,
    program,
  };
  executeStatements(program.entry, environment);
  if (!environment.steps.length) {
    environment.steps.push({
      lineNumber: null,
      explanation: 'The custom simulation completed without an explicit trace event.',
      visualData: buildVisualData(environment),
    });
  }
  return {
    steps: environment.steps,
    finalVariables: allVariables(environment),
    instructions: environment.instructions,
  };
};
