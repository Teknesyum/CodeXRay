import { Fragment, createElement, type ReactNode } from 'react';
import './MarkdownPreview.css';

interface MarkdownPreviewProps {
  content: string;
  className?: string;
}

type TextAlignment = 'left' | 'center' | 'right' | undefined;

const INLINE_TOKEN_SOURCE = /(`[^`\n]+`|\[[^\]\n]+\]\((?:[^()\n]|\([^()\n]*\))+\)|\*\*.+?\*\*|__.+?__|~~.+?~~|\*[^*\n]+?\*|_[^_\n]+?_)/.source;
const LINK_TOKEN = /^\[([^\]]+)]\((.+)\)$/;

const getSafeHref = (candidate: string): string | null => {
  const href = candidate.trim().replace(/^<|>$/g, '');
  if (href.startsWith('#')) return href;

  try {
    const protocol = new URL(href).protocol.toLowerCase();
    return ['http:', 'https:', 'mailto:'].includes(protocol) ? href : null;
  } catch {
    return null;
  }
};

const renderInline = (value: string, keyPrefix: string): ReactNode[] => {
  const nodes: ReactNode[] = [];
  const inlineToken = new RegExp(INLINE_TOKEN_SOURCE, 'g');
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = inlineToken.exec(value)) !== null) {
    if (match.index > cursor) nodes.push(value.slice(cursor, match.index));

    const token = match[0];
    const key = `${keyPrefix}-${match.index}`;

    if (token.startsWith('`')) {
      nodes.push(<code key={key}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith('**') || token.startsWith('__')) {
      nodes.push(<strong key={key}>{renderInline(token.slice(2, -2), `${key}-strong`)}</strong>);
    } else if (token.startsWith('~~')) {
      nodes.push(<del key={key}>{renderInline(token.slice(2, -2), `${key}-del`)}</del>);
    } else if (token.startsWith('[')) {
      const link = token.match(LINK_TOKEN);
      const destination = link?.[2].trim().match(/^(\S+?)(?:\s+["']([^"']*)["'])?$/);
      const href = destination ? getSafeHref(destination[1]) : null;
      if (link && destination && href) {
        const external = href.startsWith('http://') || href.startsWith('https://');
        nodes.push(
          <a
            key={key}
            href={href}
            title={destination[2] || undefined}
            target={external ? '_blank' : undefined}
            rel={external ? 'noreferrer noopener' : undefined}
          >
            {renderInline(link[1], `${key}-link`)}
          </a>,
        );
      } else if (link) {
        nodes.push(<span key={key}>{link[1]} ({destination?.[1] ?? link[2]})</span>);
      } else {
        nodes.push(token);
      }
    } else {
      nodes.push(<em key={key}>{renderInline(token.slice(1, -1), `${key}-em`)}</em>);
    }

    cursor = match.index + token.length;
  }

  if (cursor < value.length) nodes.push(value.slice(cursor));
  return nodes;
};

const renderInlineLines = (lines: string[], keyPrefix: string): ReactNode[] => lines.map((line, index) => (
  <Fragment key={`${keyPrefix}-${index}`}>
    {index > 0 && <br />}
    {renderInline(line, `${keyPrefix}-${index}`)}
  </Fragment>
));

const splitTableRow = (line: string): string[] => line
  .trim()
  .replace(/^\|/, '')
  .replace(/\|$/, '')
  .split('|')
  .map(cell => cell.trim());

const getTableAlignments = (line: string): TextAlignment[] | null => {
  const cells = splitTableRow(line);
  if (cells.length === 0 || cells.some(cell => !/^:?-{3,}:?$/.test(cell))) return null;
  return cells.map((cell) => {
    if (cell.startsWith(':') && cell.endsWith(':')) return 'center';
    if (cell.endsWith(':')) return 'right';
    return cell.startsWith(':') ? 'left' : undefined;
  });
};

const isBlockStart = (lines: string[], index: number): boolean => {
  const line = lines[index];
  if (!line.trim()) return true;
  if (/^\s*```/.test(line)) return true;
  if (/^\s{0,3}#{1,6}\s+/.test(line)) return true;
  if (/^\s{0,3}>\s?/.test(line)) return true;
  if (/^\s{0,3}(?:[-+*]\s+|\d+[.)]\s+)/.test(line)) return true;
  if (/^\s{0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) return true;
  return index + 1 < lines.length && line.includes('|') && getTableAlignments(lines[index + 1]) !== null;
};

export const MarkdownPreview = ({ content, className = '' }: MarkdownPreviewProps) => {
  const lines = content.replace(/\r\n?/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    const fence = line.match(/^\s*```\s*([\w.+-]*)\s*$/);
    if (fence) {
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !/^\s*```\s*$/.test(lines[index])) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push(
        <pre key={`code-${index}`} className="markdown-code-block" data-language={fence[1] || undefined}>
          <code>{codeLines.join('\n')}</code>
        </pre>,
      );
      continue;
    }

    const heading = line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      const level = heading[1].length;
      blocks.push(createElement(
        `h${level}`,
        { key: `heading-${index}` },
        renderInline(heading[2], `heading-${index}`),
      ));
      index += 1;
      continue;
    }

    if (/^\s{0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      blocks.push(<hr key={`hr-${index}`} />);
      index += 1;
      continue;
    }

    if (/^\s{0,3}>\s?/.test(line)) {
      const quoteLines: string[] = [];
      while (index < lines.length) {
        const quote = lines[index].match(/^\s{0,3}>\s?(.*)$/);
        if (!quote) break;
        quoteLines.push(quote[1]);
        index += 1;
      }
      blocks.push(
        <blockquote key={`quote-${index}`}>
          {renderInlineLines(quoteLines, `quote-${index}`)}
        </blockquote>,
      );
      continue;
    }

    const unordered = line.match(/^\s{0,3}[-+*]\s+(.+)$/);
    const ordered = line.match(/^\s{0,3}(\d+)[.)]\s+(.+)$/);
    if (unordered || ordered) {
      const items: ReactNode[] = [];
      const orderedList = Boolean(ordered);
      const start = ordered ? Number(ordered[1]) : undefined;

      while (index < lines.length) {
        const item = orderedList
          ? lines[index].match(/^\s{0,3}\d+[.)]\s+(.+)$/)
          : lines[index].match(/^\s{0,3}[-+*]\s+(.+)$/);
        if (!item) break;
        const itemIndex = index;
        const itemContent = item[item.length - 1];
        const task = itemContent.match(/^\[([ xX])]\s+(.+)$/);
        index += 1;

        const nestedItems: ReactNode[] = [];
        if (orderedList) {
          let nestedIndex = index;
          while (nestedIndex < lines.length && !lines[nestedIndex].trim()) nestedIndex += 1;
          while (nestedIndex < lines.length) {
            const nested = lines[nestedIndex].match(/^\s{2,3}[-+*]\s+(.+)$/);
            if (!nested) break;
            const nestedTask = nested[1].match(/^\[([ xX])]\s+(.+)$/);
            nestedItems.push(
              <li key={`nested-item-${nestedIndex}`} className={nestedTask ? 'markdown-task-item' : undefined}>
                {nestedTask && <input type="checkbox" checked={nestedTask[1].toLowerCase() === 'x'} readOnly tabIndex={-1} />}
                {renderInline(nestedTask ? nestedTask[2] : nested[1], `nested-item-${nestedIndex}`)}
              </li>,
            );
            nestedIndex += 1;
          }
          if (nestedItems.length) index = nestedIndex;
        }

        items.push(
          <li key={`item-${itemIndex}`} className={task ? 'markdown-task-item' : undefined}>
            {task && <input type="checkbox" checked={task[1].toLowerCase() === 'x'} readOnly tabIndex={-1} />}
            {renderInline(task ? task[2] : itemContent, `item-${itemIndex}`)}
            {nestedItems.length > 0 && <ul>{nestedItems}</ul>}
          </li>,
        );
      }

      blocks.push(orderedList
        ? <ol key={`list-${index}`} start={start}>{items}</ol>
        : <ul key={`list-${index}`}>{items}</ul>);
      continue;
    }

    const alignments = index + 1 < lines.length && line.includes('|')
      ? getTableAlignments(lines[index + 1])
      : null;
    if (alignments) {
      const headers = splitTableRow(line);
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length && lines[index].includes('|') && lines[index].trim()) {
        rows.push(splitTableRow(lines[index]));
        index += 1;
      }
      blocks.push(
        <div className="markdown-table-scroll" key={`table-${index}`}>
          <table>
            <thead>
              <tr>{headers.map((cell, cellIndex) => (
                <th key={`head-${cellIndex}`} style={alignments[cellIndex] ? { textAlign: alignments[cellIndex] } : undefined}>
                  {renderInline(cell, `head-${cellIndex}`)}
                </th>
              ))}</tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={`row-${rowIndex}`}>
                  {headers.map((_, cellIndex) => (
                    <td key={`cell-${cellIndex}`} style={alignments[cellIndex] ? { textAlign: alignments[cellIndex] } : undefined}>
                      {renderInline(row[cellIndex] ?? '', `cell-${rowIndex}-${cellIndex}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    const paragraphLines = [line];
    index += 1;
    while (index < lines.length && !isBlockStart(lines, index)) {
      paragraphLines.push(lines[index]);
      index += 1;
    }
    blocks.push(<p key={`paragraph-${index}`}>{renderInlineLines(paragraphLines, `paragraph-${index}`)}</p>);
  }

  return <div className={`markdown-preview ${className}`.trim()}>{blocks}</div>;
};
