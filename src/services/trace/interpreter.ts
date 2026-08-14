import type { TraceValue } from '../../types/simulation';
import type { AstNode } from './parser';
import {
  DEFAULT_TRACE_BUDGET,
  type RawTrace,
  type RawTraceStepKind,
  type TraceBudget,
  type TraceEntry,
} from './types';

type RuntimeValue = unknown;

interface Binding {
  value: RuntimeValue;
  constant: boolean;
}

interface UserFunction {
  kind: 'user-function';
  node: AstNode;
  closure: Environment;
  name: string;
}

interface NativeFunction {
  kind: 'native-function';
  name: string;
  call: (args: RuntimeValue[]) => RuntimeValue;
}

type Callable = UserFunction | NativeFunction;

class Environment {
  readonly parent: Environment | null;
  readonly values = new Map<string, Binding>();

  constructor(parent: Environment | null = null) {
    this.parent = parent;
  }

  declare(name: string, value: RuntimeValue, constant = false) {
    if (this.values.has(name)) throw new Error(`Identifier '${name}' has already been declared.`);
    this.values.set(name, { value, constant });
  }

  resolve(name: string): Environment {
    if (this.values.has(name)) return this;
    if (this.parent) return this.parent.resolve(name);
    throw new Error(`Identifier '${name}' is not defined.`);
  }

  get(name: string): RuntimeValue {
    return this.resolve(name).values.get(name)?.value;
  }

  set(name: string, value: RuntimeValue) {
    const owner = this.resolve(name);
    const binding = owner.values.get(name);
    if (!binding) throw new Error(`Identifier '${name}' is not defined.`);
    if (binding.constant) throw new Error(`Assignment to constant variable '${name}'.`);
    binding.value = value;
  }
}

class FlowSignal {
  readonly type: 'return' | 'break' | 'continue';
  readonly value: RuntimeValue;
  readonly label: string | null;

  constructor(type: 'return' | 'break' | 'continue', value?: RuntimeValue, label: string | null = null) {
    this.type = type;
    this.value = value;
    this.label = label;
  }
}

class BudgetSignal extends Error {}

const isNode = (value: unknown): value is AstNode =>
  Boolean(value && typeof value === 'object' && typeof (value as { type?: unknown }).type === 'string');

const nodeArray = (value: unknown): AstNode[] =>
  Array.isArray(value) ? value.filter(isNode) : [];

const nodeValue = (node: AstNode, key: string): AstNode => {
  const value = node[key];
  if (!isNode(value)) throw new Error(`Invalid ${node.type}.${key} node.`);
  return value;
};

const optionalNode = (node: AstNode, key: string): AstNode | null => {
  const value = node[key];
  return isNode(value) ? value : null;
};

const propertyKey = (value: RuntimeValue) => String(value);

const isCallable = (value: RuntimeValue): value is Callable =>
  Boolean(value && typeof value === 'object' && ['user-function', 'native-function'].includes(String((value as { kind?: unknown }).kind)));

export class Interpreter {
  readonly budget: TraceBudget;
  readonly startedAt: number;
  readonly steps: RawTrace['steps'] = [];
  readonly consoleOutput: string[] = [];
  readonly global: Environment;
  private callDepth = 0;
  private heapNodes = 0;
  private randomState: number;
  private currentLine = 1;

  constructor(options: Partial<TraceBudget> = {}) {
    this.budget = { ...DEFAULT_TRACE_BUDGET, ...options };
    this.startedAt = performance.now();
    this.randomState = this.budget.seed | 0;
    this.global = new Environment();
    this.installBuiltins();
  }

  run(program: AstNode, entry: TraceEntry): RawTrace {
    let returnValue: RuntimeValue = null;
    let error: RawTrace['error'] = null;
    let truncated = false;
    try {
      this.executeProgram(program, this.global);
      if (entry.functionName) {
        returnValue = this.callValue(this.global.get(entry.functionName), entry.args, null);
      }
    } catch (reason) {
      if (reason instanceof BudgetSignal) {
        truncated = true;
      } else {
        const message = reason instanceof Error ? reason.message : String(reason);
        error = { message, line: this.currentLine };
        this.emitAt(this.currentLine, 0, 'throw', [], { t: 'error', message }, true);
      }
    }
    return {
      steps: this.steps,
      truncated,
      budget: {
        maxSteps: this.budget.maxSteps,
        usedSteps: this.steps.length,
        elapsedMs: Math.max(0, performance.now() - this.startedAt),
      },
      returnValue: this.toTraceValue(returnValue),
      consoleOutput: this.consoleOutput,
      error,
    };
  }

  private installBuiltins() {
    const native = (name: string, call: (args: RuntimeValue[]) => RuntimeValue): NativeFunction => ({
      kind: 'native-function',
      name,
      call,
    });
    const math: Record<string, RuntimeValue> = {};
    for (const name of ['abs', 'ceil', 'floor', 'round', 'trunc', 'sqrt', 'cbrt', 'pow', 'min', 'max', 'sign', 'log', 'log2', 'log10', 'exp', 'sin', 'cos', 'tan']) {
      const fn = Math[name as keyof Math];
      if (typeof fn === 'function') math[name] = native(`Math.${name}`, (args) => Reflect.apply(fn, Math, args));
    }
    math.random = native('Math.random', () => this.nextRandom());
    math.PI = Math.PI;
    math.E = Math.E;
    this.global.declare('Math', math, true);
    this.global.declare('Date', { now: native('Date.now', () => 0) }, true);
    this.global.declare('Number', native('Number', ([value]) => Number(value)), true);
    this.global.declare('String', native('String', ([value]) => String(value ?? '')), true);
    this.global.declare('Boolean', native('Boolean', ([value]) => Boolean(value)), true);
    this.global.declare('parseInt', native('parseInt', ([value, radix]) => Number.parseInt(String(value), radix === undefined ? 10 : Number(radix))), true);
    this.global.declare('parseFloat', native('parseFloat', ([value]) => Number.parseFloat(String(value))), true);
    this.global.declare('isNaN', native('isNaN', ([value]) => Number.isNaN(Number(value))), true);
    this.global.declare('JSON', {
      parse: native('JSON.parse', ([value]) => this.allocate(JSON.parse(String(value)))),
      stringify: native('JSON.stringify', ([value]) => JSON.stringify(value)),
    }, true);
    this.global.declare('console', {
      log: native('console.log', (args) => {
        this.consoleOutput.push(args.map((value) => typeof value === 'string' ? value : JSON.stringify(this.toTraceValue(value))).join(' '));
        return undefined;
      }),
    }, true);
    this.global.declare('Map', native('Map', ([entries]) => this.allocate(new Map((entries ?? []) as Iterable<[RuntimeValue, RuntimeValue]>))), true);
    this.global.declare('Set', native('Set', ([values]) => this.allocate(new Set((values ?? []) as Iterable<RuntimeValue>))), true);
    this.global.declare('undefined', undefined, true);
    this.global.declare('NaN', Number.NaN, true);
    this.global.declare('Infinity', Number.POSITIVE_INFINITY, true);
  }

  private nextRandom() {
    let value = this.randomState || 0x6d2b79f5;
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    this.randomState = value | 0;
    return (value >>> 0) / 4_294_967_296;
  }

  private allocate<T>(value: T): T {
    this.heapNodes += 1;
    if (this.heapNodes > this.budget.maxHeapNodes) throw new BudgetSignal('Heap budget exceeded.');
    return value;
  }

  private checkBudget() {
    if (this.steps.length >= this.budget.maxSteps) throw new BudgetSignal('Step budget exceeded.');
    if (performance.now() - this.startedAt > this.budget.maxElapsedMs) throw new BudgetSignal('Time budget exceeded.');
  }

  private snapshot(env: Environment): Record<string, TraceValue> {
    const result: Record<string, TraceValue> = {};
    const chain: Environment[] = [];
    for (let cursor: Environment | null = env; cursor; cursor = cursor.parent) chain.unshift(cursor);
    for (const scope of chain) {
      for (const [name, binding] of scope.values) {
        if (!isCallable(binding.value) && !['Math', 'Date', 'JSON', 'console', 'undefined', 'NaN', 'Infinity', 'Map', 'Set', 'Number', 'String', 'Boolean', 'parseInt', 'parseFloat', 'isNaN'].includes(name)) {
          result[name] = this.toTraceValue(binding.value);
        }
      }
    }
    return result;
  }

  private toTraceValue(value: RuntimeValue, seen = new Set<object>()): TraceValue {
    if (value === undefined) return null;
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
    if (typeof value === 'number') return Number.isFinite(value) ? value : String(value);
    if (typeof value === 'bigint') return value.toString();
    if (isCallable(value)) return `[Function ${value.name}]`;
    if (typeof value !== 'object') return String(value);
    if (seen.has(value)) return '[Circular]';
    seen.add(value);
    if (Array.isArray(value)) return value.map((item) => this.toTraceValue(item, seen));
    if (value instanceof Map) {
      const result: Record<string, TraceValue> = {};
      for (const [key, item] of value) result[String(key)] = this.toTraceValue(item, seen);
      return result;
    }
    if (value instanceof Set) return [...value].map((item) => this.toTraceValue(item, seen));
    const result: Record<string, TraceValue> = {};
    for (const [key, item] of Object.entries(value)) result[key] = this.toTraceValue(item, seen);
    return result;
  }

  private emit(node: AstNode, kind: RawTraceStepKind, env: Environment, mutated: string[] = []) {
    this.emitAt(node.loc?.start.line ?? 1, node.loc?.start.column ?? 0, kind, mutated, undefined, false, env);
  }

  private emitAt(line: number, column: number, kind: RawTraceStepKind, mutated: string[], event?: RawTrace['steps'][number]['event'], force = false, env = this.global) {
    if (!force) this.checkBudget();
    this.currentLine = line;
    this.steps.push({ index: this.steps.length, line, column, kind, callDepth: this.callDepth, scopes: this.snapshot(env), mutated, event });
  }

  private executeProgram(program: AstNode, env: Environment) {
    for (const statement of nodeArray(program.body)) this.execute(statement, env);
  }

  private execute(node: AstNode, env: Environment, label: string | null = null): RuntimeValue {
    this.currentLine = node.loc?.start.line ?? this.currentLine;
    switch (node.type) {
      case 'EmptyStatement': return undefined;
      case 'BlockStatement': return this.executeBlock(nodeArray(node.body), new Environment(env));
      case 'ExpressionStatement': {
        const result = this.evaluate(nodeValue(node, 'expression'), env);
        this.emit(node, 'statement', env);
        return result;
      }
      case 'VariableDeclaration': {
        for (const declaration of nodeArray(node.declarations)) {
          const value = optionalNode(declaration, 'init') ? this.evaluate(nodeValue(declaration, 'init'), env) : undefined;
          this.bindPattern(nodeValue(declaration, 'id'), value, env, String(node.kind) === 'const');
        }
        this.emit(node, 'assign', env, nodeArray(node.declarations).flatMap((item) => this.patternNames(nodeValue(item, 'id'))));
        return undefined;
      }
      case 'FunctionDeclaration': {
        const id = nodeValue(node, 'id');
        env.declare(String(id.name), this.makeFunction(node, env, String(id.name)), true);
        return undefined;
      }
      case 'ReturnStatement': {
        const value = optionalNode(node, 'argument') ? this.evaluate(nodeValue(node, 'argument'), env) : undefined;
        this.emit(node, 'return', env);
        throw new FlowSignal('return', value);
      }
      case 'IfStatement': {
        const taken = Boolean(this.evaluate(nodeValue(node, 'test'), env));
        this.emit(node, 'branch', env);
        if (taken) return this.execute(nodeValue(node, 'consequent'), env);
        const alternate = optionalNode(node, 'alternate');
        return alternate ? this.execute(alternate, env) : undefined;
      }
      case 'WhileStatement': return this.executeWhile(node, env, false, label);
      case 'DoWhileStatement': return this.executeWhile(node, env, true, label);
      case 'ForStatement': return this.executeFor(node, env, label);
      case 'ForOfStatement': return this.executeForEach(node, env, false, label);
      case 'ForInStatement': return this.executeForEach(node, env, true, label);
      case 'BreakStatement': throw new FlowSignal('break', undefined, optionalNode(node, 'label') ? String(nodeValue(node, 'label').name) : null);
      case 'ContinueStatement': throw new FlowSignal('continue', undefined, optionalNode(node, 'label') ? String(nodeValue(node, 'label').name) : null);
      case 'LabeledStatement': return this.execute(nodeValue(node, 'body'), env, String(nodeValue(node, 'label').name));
      case 'ThrowStatement': throw this.evaluate(nodeValue(node, 'argument'), env);
      case 'TryStatement': return this.executeTry(node, env);
      case 'SwitchStatement': return this.executeSwitch(node, env, label);
      default: throw new Error(`Unsupported statement '${node.type}'.`);
    }
  }

  private executeBlock(statements: AstNode[], env: Environment) {
    for (const statement of statements) this.execute(statement, env);
    return undefined;
  }

  private executeWhile(node: AstNode, env: Environment, first: boolean, label: string | null) {
    this.emit(node, 'loop-enter', env);
    let initial = first;
    while (initial || Boolean(this.evaluate(nodeValue(node, 'test'), env))) {
      initial = false;
      this.emit(node, 'loop-iter', env);
      try {
        this.execute(nodeValue(node, 'body'), env);
      } catch (reason) {
        if (reason instanceof FlowSignal && reason.type === 'continue' && (!reason.label || reason.label === label)) continue;
        if (reason instanceof FlowSignal && reason.type === 'break' && (!reason.label || reason.label === label)) break;
        throw reason;
      }
    }
    this.emit(node, 'loop-exit', env);
    return undefined;
  }

  private executeFor(node: AstNode, env: Environment, label: string | null) {
    const scope = new Environment(env);
    const init = optionalNode(node, 'init');
    if (init) {
      if (init.type === 'VariableDeclaration') this.execute(init, scope);
      else this.evaluate(init, scope);
    }
    this.emit(node, 'loop-enter', scope);
    while (!optionalNode(node, 'test') || Boolean(this.evaluate(nodeValue(node, 'test'), scope))) {
      this.emit(node, 'loop-iter', scope);
      try {
        this.execute(nodeValue(node, 'body'), scope);
      } catch (reason) {
        if (reason instanceof FlowSignal && reason.type === 'break' && (!reason.label || reason.label === label)) break;
        if (!(reason instanceof FlowSignal && reason.type === 'continue' && (!reason.label || reason.label === label))) throw reason;
      }
      const update = optionalNode(node, 'update');
      if (update) this.evaluate(update, scope);
    }
    this.emit(node, 'loop-exit', scope);
    return undefined;
  }

  private executeForEach(node: AstNode, env: Environment, keys: boolean, label: string | null) {
    const source = this.evaluate(nodeValue(node, 'right'), env);
    const items = keys ? Object.keys(Object(source)) : [...(source as Iterable<RuntimeValue>)];
    this.emit(node, 'loop-enter', env);
    for (const item of items) {
      const scope = new Environment(env);
      const left = nodeValue(node, 'left');
      if (left.type === 'VariableDeclaration') this.bindPattern(nodeValue(nodeArray(left.declarations)[0], 'id'), item, scope, String(left.kind) === 'const');
      else this.assign(left, item, scope);
      this.emit(node, 'loop-iter', scope);
      try {
        this.execute(nodeValue(node, 'body'), scope);
      } catch (reason) {
        if (reason instanceof FlowSignal && reason.type === 'break' && (!reason.label || reason.label === label)) break;
        if (reason instanceof FlowSignal && reason.type === 'continue' && (!reason.label || reason.label === label)) continue;
        throw reason;
      }
    }
    this.emit(node, 'loop-exit', env);
    return undefined;
  }

  private executeTry(node: AstNode, env: Environment) {
    let pending: unknown;
    try {
      this.execute(nodeValue(node, 'block'), env);
    } catch (reason) {
      const handler = optionalNode(node, 'handler');
      if (!handler || reason instanceof FlowSignal || reason instanceof BudgetSignal) pending = reason;
      else {
        const scope = new Environment(env);
        const parameter = optionalNode(handler, 'param');
        if (parameter) this.bindPattern(parameter, reason instanceof Error ? reason.message : reason, scope, false);
        this.execute(nodeValue(handler, 'body'), scope);
      }
    } finally {
      const finalizer = optionalNode(node, 'finalizer');
      if (finalizer) this.execute(finalizer, env);
    }
    if (pending !== undefined) throw pending;
    return undefined;
  }

  private executeSwitch(node: AstNode, env: Environment, label: string | null) {
    const value = this.evaluate(nodeValue(node, 'discriminant'), env);
    let matched = false;
    try {
      for (const item of nodeArray(node.cases)) {
        const test = optionalNode(item, 'test');
        if (!matched && (!test || this.evaluate(test, env) === value)) matched = true;
        if (matched) for (const statement of nodeArray(item.consequent)) this.execute(statement, env);
      }
    } catch (reason) {
      if (reason instanceof FlowSignal && reason.type === 'break' && (!reason.label || reason.label === label)) return undefined;
      throw reason;
    }
    return undefined;
  }

  private evaluate(node: AstNode, env: Environment): RuntimeValue {
    this.currentLine = node.loc?.start.line ?? this.currentLine;
    switch (node.type) {
      case 'Literal': return node.value;
      case 'Identifier': return env.get(String(node.name));
      case 'ThisExpression': return env.get('this');
      case 'ArrayExpression': {
        const result: RuntimeValue[] = [];
        for (const item of nodeArray(node.elements)) {
          if (item.type === 'SpreadElement') result.push(...(this.evaluate(nodeValue(item, 'argument'), env) as Iterable<RuntimeValue>));
          else result.push(this.evaluate(item, env));
        }
        return this.allocate(result);
      }
      case 'ObjectExpression': return this.evaluateObject(node, env);
      case 'TemplateLiteral': return this.evaluateTemplate(node, env);
      case 'BinaryExpression': return this.binary(String(node.operator), this.evaluate(nodeValue(node, 'left'), env), this.evaluate(nodeValue(node, 'right'), env));
      case 'LogicalExpression': return this.logical(node, env);
      case 'UnaryExpression': return this.unary(String(node.operator), this.evaluate(nodeValue(node, 'argument'), env));
      case 'UpdateExpression': return this.update(node, env);
      case 'AssignmentExpression': return this.assignment(node, env);
      case 'MemberExpression': return this.readMember(node, env);
      case 'CallExpression': return this.evaluateCall(node, env);
      case 'NewExpression': return this.evaluateNew(node, env);
      case 'FunctionExpression':
      case 'ArrowFunctionExpression': return this.makeFunction(node, env, optionalNode(node, 'id') ? String(nodeValue(node, 'id').name) : '<anonymous>');
      case 'ConditionalExpression': return this.evaluate(nodeValue(node, 'test'), env) ? this.evaluate(nodeValue(node, 'consequent'), env) : this.evaluate(nodeValue(node, 'alternate'), env);
      case 'SequenceExpression': return nodeArray(node.expressions).reduce<RuntimeValue>((_, item) => this.evaluate(item, env), undefined);
      case 'ChainExpression': return this.evaluate(nodeValue(node, 'expression'), env);
      default: throw new Error(`Unsupported expression '${node.type}'.`);
    }
  }

  private evaluateObject(node: AstNode, env: Environment) {
    const result: Record<string, RuntimeValue> = {};
    for (const property of nodeArray(node.properties)) {
      if (property.type === 'SpreadElement') Object.assign(result, this.evaluate(nodeValue(property, 'argument'), env));
      else {
        const keyNode = nodeValue(property, 'key');
        const key = property.computed ? propertyKey(this.evaluate(keyNode, env)) : String(keyNode.name ?? keyNode.value);
        result[key] = property.kind === 'init' ? this.evaluate(nodeValue(property, 'value'), env) : undefined;
      }
    }
    return this.allocate(result);
  }

  private evaluateTemplate(node: AstNode, env: Environment) {
    const expressions = nodeArray(node.expressions);
    const quasis = nodeArray(node.quasis);
    return quasis.map((item, index) => String((item.value as { cooked?: unknown })?.cooked ?? '') + (index < expressions.length ? String(this.evaluate(expressions[index], env)) : '')).join('');
  }

  private logical(node: AstNode, env: Environment) {
    const left = this.evaluate(nodeValue(node, 'left'), env);
    const operator = String(node.operator);
    if (operator === '&&') return left ? this.evaluate(nodeValue(node, 'right'), env) : left;
    if (operator === '||') return left ? left : this.evaluate(nodeValue(node, 'right'), env);
    return left ?? this.evaluate(nodeValue(node, 'right'), env);
  }

  private binary(operator: string, left: RuntimeValue, right: RuntimeValue): RuntimeValue {
    switch (operator) {
      case '+': return (left as number) + (right as number);
      case '-': return Number(left) - Number(right);
      case '*': return Number(left) * Number(right);
      case '/': return Number(left) / Number(right);
      case '%': return Number(left) % Number(right);
      case '**': return Number(left) ** Number(right);
      case '<': return (left as number) < (right as number);
      case '<=': return (left as number) <= (right as number);
      case '>': return (left as number) > (right as number);
      case '>=': return (left as number) >= (right as number);
      case '==': return left == right;
      case '!=': return left != right;
      case '===': return left === right;
      case '!==': return left !== right;
      case '&': return Number(left) & Number(right);
      case '|': return Number(left) | Number(right);
      case '^': return Number(left) ^ Number(right);
      case '<<': return Number(left) << Number(right);
      case '>>': return Number(left) >> Number(right);
      case '>>>': return Number(left) >>> Number(right);
      case 'in': return propertyKey(left) in Object(right);
      default: throw new Error(`Unsupported binary operator '${operator}'.`);
    }
  }

  private unary(operator: string, value: RuntimeValue): RuntimeValue {
    switch (operator) {
      case '!': return !value;
      case '+': return Number(value);
      case '-': return -Number(value);
      case '~': return ~Number(value);
      case 'typeof': return typeof value;
      case 'void': return undefined;
      default: throw new Error(`Unsupported unary operator '${operator}'.`);
    }
  }

  private update(node: AstNode, env: Environment) {
    const argument = nodeValue(node, 'argument');
    const previous = Number(this.evaluate(argument, env));
    const next = String(node.operator) === '++' ? previous + 1 : previous - 1;
    this.assign(argument, next, env);
    this.emit(node, 'assign', env, this.patternNames(argument));
    return node.prefix ? next : previous;
  }

  private assignment(node: AstNode, env: Environment) {
    const left = nodeValue(node, 'left');
    const right = this.evaluate(nodeValue(node, 'right'), env);
    const operator = String(node.operator);
    const value = operator === '=' ? right : this.binary(operator.slice(0, -1), this.evaluate(left, env), right);
    this.assign(left, value, env);
    const names = this.patternNames(left);
    this.emit(node, left.type === 'MemberExpression' ? 'mutate' : 'assign', env, names);
    return value;
  }

  private memberTarget(node: AstNode, env: Environment): [RuntimeValue, string] {
    const object = this.evaluate(nodeValue(node, 'object'), env);
    if (object === null || object === undefined) throw new Error(`Cannot read properties of ${object}.`);
    const property = node.computed ? this.evaluate(nodeValue(node, 'property'), env) : nodeValue(node, 'property').name;
    return [object, propertyKey(property)];
  }

  private readMember(node: AstNode, env: Environment): RuntimeValue {
    const [object, key] = this.memberTarget(node, env);
    if (key === 'length' && (Array.isArray(object) || typeof object === 'string')) return object.length;
    if (object instanceof Map && key === 'size') return object.size;
    if (object instanceof Set && key === 'size') return object.size;
    return (object as Record<string, RuntimeValue>)[key];
  }

  private assign(node: AstNode, value: RuntimeValue, env: Environment) {
    if (node.type === 'Identifier') env.set(String(node.name), value);
    else if (node.type === 'MemberExpression') {
      const [object, key] = this.memberTarget(node, env);
      (object as Record<string, RuntimeValue>)[key] = value;
    } else this.bindPattern(node, value, env, false, true);
  }

  private evaluateCall(node: AstNode, env: Environment) {
    const callee = nodeValue(node, 'callee');
    const args = nodeArray(node.arguments).flatMap((argument) => argument.type === 'SpreadElement' ? [...(this.evaluate(nodeValue(argument, 'argument'), env) as Iterable<RuntimeValue>)] : [this.evaluate(argument, env)]);
    if (callee.type === 'MemberExpression') {
      const [object, key] = this.memberTarget(callee, env);
      const result = this.callMember(object, key, args);
      this.emit(node, this.isMutatingMethod(object, key) ? 'mutate' : 'call', env);
      return result;
    }
    const result = this.callValue(this.evaluate(callee, env), args, null);
    this.emit(node, 'call', env);
    return result;
  }

  private evaluateNew(node: AstNode, env: Environment) {
    const callee = this.evaluate(nodeValue(node, 'callee'), env);
    const args = nodeArray(node.arguments).map((argument) => this.evaluate(argument, env));
    if (isCallable(callee) && (callee.name === 'Map' || callee.name === 'Set')) return this.callValue(callee, args, null);
    throw new Error('Only Map and Set construction is supported.');
  }

  private isMutatingMethod(object: RuntimeValue, key: string) {
    return (Array.isArray(object) && ['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse', 'fill'].includes(key)) ||
      (object instanceof Map && ['set', 'delete', 'clear'].includes(key)) ||
      (object instanceof Set && ['add', 'delete', 'clear'].includes(key));
  }

  private callMember(object: RuntimeValue, key: string, args: RuntimeValue[]): RuntimeValue {
    if (Array.isArray(object)) return this.callArrayMethod(object, key, args);
    if (typeof object === 'string') return this.callStringMethod(object, key, args);
    if (object instanceof Map) {
      if (key === 'get') return object.get(args[0]);
      if (key === 'set') { object.set(args[0], args[1]); return object; }
      if (key === 'has') return object.has(args[0]);
      if (key === 'delete') return object.delete(args[0]);
      if (key === 'keys') return [...object.keys()];
      if (key === 'values') return [...object.values()];
      if (key === 'entries') return [...object.entries()];
    }
    if (object instanceof Set) {
      if (key === 'add') { object.add(args[0]); return object; }
      if (key === 'has') return object.has(args[0]);
      if (key === 'delete') return object.delete(args[0]);
      if (key === 'values' || key === 'keys') return [...object.values()];
    }
    const value = (object as Record<string, RuntimeValue>)[key];
    return this.callValue(value, args, object);
  }

  private callArrayMethod(array: RuntimeValue[], key: string, args: RuntimeValue[]): RuntimeValue {
    if (key === 'push') return array.push(...args);
    if (key === 'pop') return array.pop();
    if (key === 'shift') return array.shift();
    if (key === 'unshift') return array.unshift(...args);
    if (key === 'slice') return this.allocate(array.slice(Number(args[0] ?? 0), args[1] === undefined ? undefined : Number(args[1])));
    if (key === 'splice') return this.allocate(array.splice(Number(args[0]), Number(args[1]), ...args.slice(2)));
    if (key === 'indexOf') return array.indexOf(args[0], Number(args[1] ?? 0));
    if (key === 'includes') return array.includes(args[0], Number(args[1] ?? 0));
    if (key === 'join') return array.join(String(args[0] ?? ','));
    if (key === 'reverse') return array.reverse();
    if (key === 'fill') return array.fill(args[0], Number(args[1] ?? 0), args[2] === undefined ? undefined : Number(args[2]));
    if (key === 'concat') return this.allocate(array.concat(...args as RuntimeValue[][]));
    if (key === 'flat') return this.allocate(array.flat(Number(args[0] ?? 1)));
    if (key === 'sort') {
      const callback = args[0];
      return array.sort(callback === undefined ? undefined : (left, right) => Number(this.callValue(callback, [left, right], null)));
    }
    const callback = args[0];
    if (!isCallable(callback)) throw new Error(`Array.${key} requires a function.`);
    if (key === 'map') return this.allocate(array.map((value, index) => this.callValue(callback, [value, index, array], null)));
    if (key === 'filter') return this.allocate(array.filter((value, index) => Boolean(this.callValue(callback, [value, index, array], null))));
    if (key === 'forEach') { array.forEach((value, index) => this.callValue(callback, [value, index, array], null)); return undefined; }
    if (key === 'find') return array.find((value, index) => Boolean(this.callValue(callback, [value, index, array], null)));
    if (key === 'some') return array.some((value, index) => Boolean(this.callValue(callback, [value, index, array], null)));
    if (key === 'every') return array.every((value, index) => Boolean(this.callValue(callback, [value, index, array], null)));
    if (key === 'reduce') {
      if (args.length > 1) return array.reduce((accumulator, value, index) => this.callValue(callback, [accumulator, value, index, array], null), args[1]);
      return array.reduce((accumulator, value, index) => this.callValue(callback, [accumulator, value, index, array], null));
    }
    throw new Error(`Unsupported array method '${key}'.`);
  }

  private callStringMethod(value: string, key: string, args: RuntimeValue[]): RuntimeValue {
    const numeric = (index: number, fallback = 0) => args[index] === undefined ? fallback : Number(args[index]);
    const optionalNumeric = (index: number) => args[index] === undefined ? undefined : Number(args[index]);
    if (key === 'charAt') return value.charAt(numeric(0, 0));
    if (key === 'charCodeAt') return value.charCodeAt(numeric(0, 0));
    if (key === 'slice') return value.slice(numeric(0), optionalNumeric(1));
    if (key === 'substring') return value.substring(numeric(0), optionalNumeric(1));
    if (key === 'split') return this.allocate(args[0] === undefined ? [value] : value.split(String(args[0]), optionalNumeric(1)));
    if (key === 'toUpperCase') return value.toUpperCase();
    if (key === 'toLowerCase') return value.toLowerCase();
    if (key === 'indexOf') return value.indexOf(String(args[0]), numeric(1, 0));
    if (key === 'includes') return value.includes(String(args[0]), numeric(1, 0));
    if (key === 'startsWith') return value.startsWith(String(args[0]), numeric(1, 0));
    if (key === 'endsWith') return value.endsWith(String(args[0]), optionalNumeric(1));
    if (key === 'repeat') return value.repeat(numeric(0, 0));
    if (key === 'padStart') return value.padStart(numeric(0, 0), String(args[1] ?? ' '));
    if (key === 'trim') return value.trim();
    throw new Error(`Unsupported string method '${key}'.`);
  }

  private callValue(value: RuntimeValue, args: RuntimeValue[], thisValue: RuntimeValue): RuntimeValue {
    if (!isCallable(value)) throw new Error('Value is not callable.');
    if (value.kind === 'native-function') return value.call(args);
    if (this.callDepth >= 200) throw new Error('Maximum supported recursion depth of 200 was exceeded.');
    const scope = new Environment(value.closure);
    scope.declare('this', thisValue, true);
    const parameters = nodeArray(value.node.params);
    parameters.forEach((parameter, index) => this.bindPattern(parameter, parameter.type === 'RestElement' ? args.slice(index) : args[index], scope, false));
    this.callDepth += 1;
    this.emit(value.node, 'call', scope);
    try {
      const body = nodeValue(value.node, 'body');
      if (body.type !== 'BlockStatement') return this.evaluate(body, scope);
      this.executeBlock(nodeArray(body.body), scope);
    } catch (reason) {
      if (reason instanceof FlowSignal && reason.type === 'return') return reason.value;
      throw reason;
    } finally {
      this.callDepth -= 1;
    }
    return undefined;
  }

  private makeFunction(node: AstNode, env: Environment, name: string): UserFunction {
    return { kind: 'user-function', node, closure: env, name };
  }

  private bindPattern(node: AstNode, value: RuntimeValue, env: Environment, constant: boolean, assign = false) {
    if (node.type === 'Identifier') {
      if (assign) env.set(String(node.name), value);
      else env.declare(String(node.name), value, constant);
      return;
    }
    if (node.type === 'AssignmentPattern') {
      this.bindPattern(nodeValue(node, 'left'), value === undefined ? this.evaluate(nodeValue(node, 'right'), env) : value, env, constant, assign);
      return;
    }
    if (node.type === 'RestElement') {
      this.bindPattern(nodeValue(node, 'argument'), value, env, constant, assign);
      return;
    }
    if (node.type === 'ArrayPattern') {
      nodeArray(node.elements).forEach((item, index) => this.bindPattern(item, item.type === 'RestElement' ? (value as RuntimeValue[] | undefined)?.slice(index) : (value as RuntimeValue[] | undefined)?.[index], env, constant, assign));
      return;
    }
    if (node.type === 'ObjectPattern') {
      for (const property of nodeArray(node.properties)) {
        if (property.type === 'RestElement') {
          const used = new Set(nodeArray(node.properties).filter((item) => item.type === 'Property').map((item) => String(nodeValue(item, 'key').name ?? nodeValue(item, 'key').value)));
          this.bindPattern(nodeValue(property, 'argument'), Object.fromEntries(Object.entries(Object(value)).filter(([key]) => !used.has(key))), env, constant, assign);
        } else {
          const key = String(nodeValue(property, 'key').name ?? nodeValue(property, 'key').value);
          this.bindPattern(nodeValue(property, 'value'), (value as Record<string, RuntimeValue> | undefined)?.[key], env, constant, assign);
        }
      }
      return;
    }
    throw new Error(`Unsupported binding pattern '${node.type}'.`);
  }

  private patternNames(node: AstNode): string[] {
    if (node.type === 'Identifier') return [String(node.name)];
    if (node.type === 'MemberExpression') return [];
    if (node.type === 'AssignmentPattern') return this.patternNames(nodeValue(node, 'left'));
    if (node.type === 'RestElement') return this.patternNames(nodeValue(node, 'argument'));
    if (node.type === 'ArrayPattern') return nodeArray(node.elements).flatMap((item) => this.patternNames(item));
    if (node.type === 'ObjectPattern') return nodeArray(node.properties).flatMap((item) => this.patternNames(item.type === 'RestElement' ? nodeValue(item, 'argument') : nodeValue(item, 'value')));
    return [];
  }
}
