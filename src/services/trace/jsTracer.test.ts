import { describe, expect, it } from 'vitest';
import type { TraceValue } from '../../types/simulation';
import { traceJavaScript } from './jsTracer';
import type { TraceBudget } from './types';

const run = (body: string, args: TraceValue[] = [], options: Partial<TraceBudget> = {}) =>
  traceJavaScript(`function solve(input) { ${body} }`, { functionName: 'solve', args: [args] }, options);

describe('traceJavaScript', () => {
  it('traces declarations, assignments, operators, branches, and loops', () => {
    const trace = run(`
      let total = 0;
      for (let i = 0; i < input.length; i++) {
        if (input[i] % 2 === 0) total += input[i];
      }
      return total;
    `, [1, 2, 3, 4]);
    expect(trace.error).toBeNull();
    expect(trace.returnValue).toBe(6);
    expect(trace.steps.some((step) => step.kind === 'branch')).toBe(true);
    expect(trace.steps.some((step) => step.mutated.includes('total'))).toBe(true);
  });

  it('supports while, do-while, for-of, for-in, and labelled control flow', () => {
    const trace = run(`
      let out = [];
      let n = 0;
      do { n++; } while (n < 2);
      outer: for (const value of input) {
        for (const key in {a: 1, b: 2}) {
          if (value === 3) break outer;
          if (key === 'a') continue;
          out.push(value);
        }
      }
      while (n < 3) n++;
      return [out, n];
    `, [1, 2, 3, 4]);
    expect(trace.error).toBeNull();
    expect(trace.returnValue).toEqual([[1, 2], 3]);
  });

  it('supports recursion, closures, arrows, defaults, rest, and spread', () => {
    const trace = run(`
      const offset = 2;
      const add = (value = 0) => value + offset;
      function fact(n) { return n <= 1 ? 1 : n * fact(n - 1); }
      const collect = (...values) => values.map(add);
      return [...collect(...input), fact(5)];
    `, [1, 2]);
    expect(trace.error).toBeNull();
    expect(trace.returnValue).toEqual([3, 4, 120]);
  });

  it('supports destructuring, objects, templates, Map, Set, and JSON', () => {
    const trace = run(`
      const [first, ...rest] = input;
      const source = { first, rest, extra: 4 };
      const { extra, ...kept } = source;
      const map = new Map();
      map.set('sum', first + extra);
      const set = new Set();
      set.add(map.get('sum'));
      const text = JSON.stringify({label: \`v=\${first}\`, kept});
      return [JSON.parse(text), set.has(5)];
    `, [1, 2, 3]);
    expect(trace.error).toBeNull();
    expect(trace.returnValue).toEqual([{ label: 'v=1', kept: { first: 1, rest: [2, 3] } }, true]);
  });

  it('supports the required array and string methods', () => {
    const trace = run(`
      const a = input.slice().sort((x, y) => x - y);
      a.push(5); a.pop(); a.unshift(0); a.shift();
      const mapped = a.map(x => x * 2).filter(x => x > 2);
      const sum = mapped.reduce((x, y) => x + y, 0);
      const checks = [a.includes(2), a.indexOf(3), a.find(x => x === 2), a.some(x => x > 2), a.every(x => x > 0)];
      const filled = [0, 0].fill(7).concat([8]).reverse().flat();
      const text = ' ababc '.trim().toUpperCase();
      return [sum, checks, filled, text.slice(1, 4), text.substring(1, 3), text.split('B').join('-'), text.charAt(0), text.charCodeAt(0), text.includes('BA'), text.startsWith('A'), text.endsWith('C'), 'x'.repeat(2).padStart(3, '0')];
    `, [3, 1, 2]);
    expect(trace.error).toBeNull();
    expect(trace.returnValue).toEqual([10, [true, 2, 2, true, true], [8, 7, 7], 'BAB', 'BA', 'A-A-C', 'A', 65, true, true, true, '0xx']);
  });

  it('supports try, catch, finally, throw, and console output', () => {
    const trace = run(`
      let result = '';
      try { throw 'bad'; }
      catch (error) { result = error; }
      finally { console.log('done'); }
      return result;
    `);
    expect(trace.error).toBeNull();
    expect(trace.returnValue).toBe('bad');
    expect(trace.consoleOutput).toEqual(['done']);
  });

  it('returns partial trace and a visible runtime error', () => {
    const trace = run(`let value = 1; value = input.missing[0]; return value;`, []);
    expect(trace.error?.message).toContain('Cannot read properties');
    expect(trace.steps.length).toBeGreaterThan(0);
    expect(trace.steps.at(-1)?.kind).toBe('throw');
  });

  it('truncates infinite execution at the step budget', () => {
    const trace = run(`let i = 0; while (true) i++;`, [], { maxSteps: 30 });
    expect(trace.truncated).toBe(true);
    expect(trace.steps).toHaveLength(30);
    expect(trace.error).toBeNull();
  });

  it('produces identical seeded random traces', () => {
    const source = `function solve() { return [Math.random(), Math.random()]; }`;
    const traces = Array.from({ length: 10 }, () => traceJavaScript(source, { functionName: 'solve', args: [] }, { seed: 42 }));
    expect(traces.every((trace) => JSON.stringify(trace.returnValue) === JSON.stringify(traces[0].returnValue))).toBe(true);
  });

  it('supports a call depth of 200 and rejects the next frame visibly', () => {
    const source = `function solve(n) { function dive(value) { return value === 0 ? 0 : 1 + dive(value - 1); } return dive(n); }`;
    const accepted = traceJavaScript(source, { functionName: 'solve', args: [198] });
    const rejected = traceJavaScript(source, { functionName: 'solve', args: [199] });
    expect(accepted.error).toBeNull();
    expect(accepted.returnValue).toBe(198);
    expect(rejected.error?.message).toContain('recursion depth');
  });

  it('enforces the heap budget', () => {
    const trace = run(`const a = []; const b = []; return [a, b];`, [], { maxHeapNodes: 1 });
    expect(trace.truncated).toBe(true);
    expect(trace.error).toBeNull();
  });

  it.each([
    ['fetch("https://example.com")', 'Network access'],
    ['eval("1 + 1")', 'Dynamic code execution'],
    ['new Function("return 1")', 'Function constructor'],
    ['setTimeout(() => {}, 1)', 'Timers'],
    ['Promise.resolve(1)', 'Asynchronous'],
    ['require("x")', 'Module loading'],
    ['document.body', 'DOM access'],
    ['process.exit()', 'Process access'],
    ['async function x(){ await 1; }', 'Asynchronous'],
  ])('rejects forbidden source: %s', (source, reason) => {
    const trace = traceJavaScript(source, { args: [] });
    expect(trace.steps).toEqual([]);
    expect(trace.error?.message).toContain(reason);
  });
});
