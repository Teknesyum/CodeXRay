import { Fragment, type ReactNode } from 'react';

const COMMAND_SYMBOLS: Readonly<Record<string, string>> = {
  cdot: '·', dots: '…', ldots: '…', ellipsis: '…',
  le: '≤', leq: '≤', ge: '≥', geq: '≥', ne: '≠', neq: '≠',
  approx: '≈', equiv: '≡', in: '∈', notin: '∉', pm: '±',
  times: '×', div: '÷', to: '→', rightarrow: '→', leftarrow: '←',
  infty: '∞', sum: '∑', prod: '∏', sqrt: '√',
  min: 'min', max: 'max', log: 'log', ln: 'ln', gcd: 'gcd',
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε',
  theta: 'θ', lambda: 'λ', mu: 'μ', pi: 'π', sigma: 'σ', phi: 'φ', omega: 'ω',
};

interface ParsedSequence {
  nodes: ReactNode[];
  next: number;
}

const readCommand = (source: string, start: number): { value: string; next: number } => {
  let next = start + 1;
  while (/[A-Za-z]/.test(source[next] ?? '')) next += 1;
  if (next === start + 1 && source[next]) next += 1;
  return { value: source.slice(start + 1, next), next };
};

const parseSequence = (source: string, start = 0, stopAtBrace = false): ParsedSequence => {
  const nodes: ReactNode[] = [];
  let cursor = start;

  const readGroup = (): ReactNode[] => {
    if (source[cursor] !== '{') return [];
    const parsed = parseSequence(source, cursor + 1, true);
    cursor = parsed.next;
    return parsed.nodes;
  };

  const readScript = (): ReactNode[] => {
    while (source[cursor] === ' ') cursor += 1;
    if (source[cursor] === '{') return readGroup();
    if (source[cursor] === '\\') {
      const command = readCommand(source, cursor);
      cursor = command.next;
      return [COMMAND_SYMBOLS[command.value] ?? command.value];
    }
    const value = source[cursor] ?? '';
    cursor += value ? 1 : 0;
    return [value];
  };

  while (cursor < source.length) {
    if (stopAtBrace && source[cursor] === '}') return { nodes, next: cursor + 1 };

    let base: ReactNode;
    if (source[cursor] === '{') {
      base = <Fragment key={`group-${cursor}`}>{readGroup()}</Fragment>;
    } else if (source[cursor] === '\\') {
      const commandStart = cursor;
      const command = readCommand(source, cursor);
      cursor = command.next;
      if (command.value === 'frac' && source[cursor] === '{') {
        const numerator = readGroup();
        const denominator = source[cursor] === '{' ? readGroup() : [];
        base = <span className="problem-math-fraction" key={`frac-${commandStart}`}><span>{numerator}</span><span>{denominator}</span></span>;
      } else if (command.value === 'text' && source[cursor] === '{') {
        base = <span className="problem-math-text" key={`text-${commandStart}`}>{readGroup()}</span>;
      } else {
        base = COMMAND_SYMBOLS[command.value] ?? command.value;
      }
    } else {
      base = source[cursor];
      cursor += 1;
    }

    let superscript: ReactNode[] | null = null;
    let subscript: ReactNode[] | null = null;
    while (source[cursor] === '^' || source[cursor] === '_') {
      const marker = source[cursor];
      cursor += 1;
      if (marker === '^') superscript = readScript();
      else subscript = readScript();
    }
    if (superscript || subscript) {
      nodes.push(<span className="problem-math-script" key={`script-${cursor}`}>
        {base}{subscript && <sub>{subscript}</sub>}{superscript && <sup>{superscript}</sup>}
      </span>);
    } else {
      nodes.push(base);
    }
  }
  return { nodes, next: cursor };
};

const renderMath = (expression: string, key: string, block: boolean): ReactNode => (
  <span
    className={`problem-math${block ? ' is-block' : ''}`}
    role="math"
    aria-label={expression.trim()}
    key={key}
  >
    {parseSequence(expression.trim()).nodes}
  </span>
);

const renderPlainText = (text: string, key: string): ReactNode[] => {
  const nodes: ReactNode[] = [];
  const exponent = /\b([A-Za-z0-9]+)\^(\{[^}\n]+\}|[+-]?\d+)|\b(10)[\u2009\u200a\u202f ]+([1-9])(?=[\s.,;)])/g;
  let cursor = 0;
  for (const match of text.matchAll(exponent)) {
    const index = match.index ?? 0;
    if (index > cursor) nodes.push(text.slice(cursor, index));
    nodes.push(renderMath(`${match[1] ?? match[3]}^${match[2] ?? match[4]}`, `${key}-power-${index}`, false));
    cursor = index + match[0].length;
  }
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
};

const DELIMITED_MATH = /(\$\$\$[\s\S]*?\$\$\$|\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\$[^$\n]+?\$)/g;

export const ProblemRichText = ({ text, className = '' }: { text: string; className?: string }) => {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  for (const match of text.matchAll(DELIMITED_MATH)) {
    const index = match.index ?? 0;
    if (index > cursor) nodes.push(...renderPlainText(text.slice(cursor, index), `plain-${cursor}`));
    const raw = match[0];
    const triple = raw.startsWith('$$$');
    const double = !triple && raw.startsWith('$$');
    const bracket = raw.startsWith('\\[');
    const expression = triple ? raw.slice(3, -3)
      : double ? raw.slice(2, -2)
        : raw.startsWith('\\') ? raw.slice(2, -2)
          : raw.slice(1, -1);
    nodes.push(renderMath(expression, `math-${index}`, double || bracket));
    cursor = index + raw.length;
  }
  if (cursor < text.length) nodes.push(...renderPlainText(text.slice(cursor), `plain-${cursor}`));

  return <div className={`problem-rich-text ${className}`.trim()}>{nodes}</div>;
};
