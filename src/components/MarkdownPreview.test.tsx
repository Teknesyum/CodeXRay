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
});
