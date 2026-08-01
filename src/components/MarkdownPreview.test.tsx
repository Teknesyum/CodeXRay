import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MarkdownPreview } from './MarkdownPreview';

afterEach(cleanup);

describe('MarkdownPreview', () => {
  it('renders structured Markdown output', () => {
    render(<MarkdownPreview content={`# Result

- first item
- **important** item

> Keep the invariant.

\`\`\`ts
const answer = 42;
\`\`\`

| Step | State |
| :--- | ---: |
| 1 | ready |`} />);

    expect(screen.getByRole('heading', { name: 'Result', level: 1 })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('important').tagName).toBe('STRONG');
    expect(screen.getByText('Keep the invariant.').closest('blockquote')).not.toBeNull();
    expect(screen.getByText('const answer = 42;').closest('pre')).toHaveAttribute('data-language', 'ts');
    expect(within(screen.getByRole('table')).getByRole('columnheader', { name: 'Step' })).toBeInTheDocument();
    expect(within(screen.getByRole('table')).getByText('ready')).toBeInTheDocument();
  });

  it('keeps indented bullets nested under their numbered step', () => {
    render(<MarkdownPreview content={`1. Read the input
2. Traverse the grid
3. Count components
4. Apply the checks

   - Outer loop
   - Inner loop
   - Cell condition`} />);

    const ordered = screen.getAllByRole('list')[0];
    const orderedItems = within(ordered).getAllByRole('listitem', { hidden: false });
    const fourthItem = screen.getByText('Apply the checks').closest('li');
    const nestedList = fourthItem?.querySelector(':scope > ul');

    expect(ordered.tagName).toBe('OL');
    expect(orderedItems).toHaveLength(7);
    expect(nestedList).not.toBeNull();
    expect(nestedList?.querySelectorAll(':scope > li')).toHaveLength(3);
  });

  it('allows safe links without interpreting raw HTML', () => {
    const { container } = render(<MarkdownPreview content={`[Docs](https://example.com) and [unsafe](javascript:alert(1))

<script>alert('no')</script>`} />);

    expect(screen.getByRole('link', { name: 'Docs' })).toHaveAttribute('href', 'https://example.com');
    expect(screen.getByRole('link', { name: 'Docs' })).toHaveAttribute('rel', 'noreferrer noopener');
    expect(screen.queryByRole('link', { name: 'unsafe' })).not.toBeInTheDocument();
    expect(screen.getByText(/unsafe \(javascript:alert\(1\)\)/)).toBeInTheDocument();
    expect(container.querySelector('script')).toBeNull();
    expect(screen.getByText("<script>alert('no')</script>")).toBeInTheDocument();
  });

  it('contains malformed fences, event-handler HTML, and unsafe URL protocols as inert text', () => {
    const { container } = render(<MarkdownPreview content={`# Partial response

<img src=x onerror="window.__markdownExecuted=true">

[data payload](data:text/html,<script>alert(1)</script>)

\`\`\`ts
const unfinished = "${'x'.repeat(512)}";`} />);

    expect(screen.getByRole('heading', { name: 'Partial response' })).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
    expect(screen.queryByRole('link', { name: 'data payload' })).not.toBeInTheDocument();
    expect(screen.getByText(/data payload \(data:text\/html/)).toBeInTheDocument();
    const code = container.querySelector('.markdown-code-block code');
    expect(code).toHaveTextContent('const unfinished');
    expect(code?.textContent).toContain('x'.repeat(512));
  });

  it('keeps a deterministic hostile Markdown matrix inert and renderable', () => {
    const fixtures = [
      '<svg onload="window.__xss=true"><script>window.__xss=true</script></svg>',
      '[js](javascript:window.__xss=true) [vb](vbscript:msgbox(1))',
      '[data](data:text/html;base64,PHNjcmlwdD4=) [file](file:///etc/passwd)',
      '<iframe srcdoc="<script>window.__xss=true</script>"></iframe>',
      `| ${'wide'.repeat(300)} | value |\n| --- | --- |\n| cell | ${'x'.repeat(2_048)} |`,
      `${'> '.repeat(12)}nested quote\n\n${'  '.repeat(12)}- deeply nested item`,
      `\`\`\`tsx\nconst unicode = "ÄŸÃ¼ÅŸiÃ¶Ã§ ðŸ§  ðŸš€";\n${'const n = 1;\n'.repeat(100)}`,
      '[unterminated](https://example.com/' + 'segment/'.repeat(200),
    ];

    fixtures.forEach((content) => {
      const { container, unmount } = render(<MarkdownPreview content={content} />);
      expect(container.textContent?.length).toBeGreaterThan(0);
      expect(container.querySelector('script, iframe, svg, object, embed, style')).toBeNull();
      expect([...container.querySelectorAll('a')].every((link) =>
        /^(?:https?:|mailto:)/i.test(link.getAttribute('href') ?? ''))).toBe(true);
      unmount();
    });
    expect((window as Window & { __xss?: boolean }).__xss).not.toBe(true);
  });
});
