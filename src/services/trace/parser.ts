import { parse, type Node } from 'acorn';
import { fullAncestor } from 'acorn-walk';

export type AstNode = Node & Record<string, unknown> & {
  loc?: { start: { line: number; column: number }; end: { line: number; column: number } };
};

const forbiddenIdentifiers = new Map([
  ['eval', 'Dynamic code execution is not supported.'],
  ['Function', 'The Function constructor is not supported.'],
  ['fetch', 'Network access is not supported.'],
  ['XMLHttpRequest', 'Network access is not supported.'],
  ['WebSocket', 'Network access is not supported.'],
  ['importScripts', 'Script loading is not supported.'],
  ['require', 'Module loading is not supported.'],
  ['process', 'Process access is not supported.'],
  ['document', 'DOM access is not supported.'],
  ['window', 'DOM access is not supported.'],
  ['globalThis', 'Host-global access is not supported.'],
  ['setTimeout', 'Timers are not supported.'],
  ['setInterval', 'Timers are not supported.'],
  ['Promise', 'Asynchronous execution is not supported.'],
]);

export class TraceSourceError extends Error {
  readonly line: number;

  constructor(message: string, line: number) {
    super(message);
    this.name = 'TraceSourceError';
    this.line = line;
  }
}

const lineOf = (node: AstNode) => node.loc?.start.line ?? 1;

export const parseTraceSource = (source: string): AstNode => {
  let program: AstNode;
  try {
    program = parse(source, {
      ecmaVersion: 'latest',
      sourceType: 'script',
      locations: true,
      allowHashBang: false,
    }) as unknown as AstNode;
  } catch (error) {
    const detail = error as Error & { loc?: { line: number } };
    throw new TraceSourceError(detail.message, detail.loc?.line ?? 1);
  }

  fullAncestor(program, (candidate, _state, ancestors) => {
    const node = candidate as AstNode;
    if (node.type === 'AwaitExpression' || node.type === 'ImportExpression') {
      throw new TraceSourceError('Asynchronous execution and module loading are not supported.', lineOf(node));
    }
    if (node.type === 'Identifier') {
      const name = String(node.name);
      const parent = ancestors.at(-2) as AstNode | undefined;
      const isProperty =
        parent?.type === 'MemberExpression' && parent.property === node && parent.computed === false;
      const reason = forbiddenIdentifiers.get(name);
      if (reason && !isProperty) throw new TraceSourceError(reason, lineOf(node));
    }
    if (node.type === 'CallExpression' || node.type === 'NewExpression') {
      const callee = node.callee as AstNode;
      if (callee?.type === 'Identifier') {
        const reason = forbiddenIdentifiers.get(String(callee.name));
        if (reason) throw new TraceSourceError(reason, lineOf(node));
      }
    }
  });

  return program;
};
