import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProblemRichText } from './ProblemRichText';

describe('ProblemRichText', () => {
  it('renders Codeforces triple-dollar formulas without leaking delimiters', () => {
    const { container } = render(<ProblemRichText text={'There are $$$n$$$ vertices and $$$m$$$ edges where $$$1 \\le n \\le 10^4$$$.'} />);

    expect(container).not.toHaveTextContent('$$$');
    expect(container).toHaveTextContent('n vertices');
    expect(container).toHaveTextContent('1 ≤ n ≤ 104');
    expect(container.querySelector('sup')).toHaveTextContent('4');
    expect(screen.getAllByRole('math')).toHaveLength(3);
  });

  it('renders plain powers, subscripts, fractions, and standard math delimiters', () => {
    const { container } = render(<ProblemRichText text={'Limit 10^4. Path \\(p_0, p_1, \\ldots, p_k\\) and $$\\frac{a}{b}$$.'} />);

    expect(container).not.toHaveTextContent('$$');
    expect(container).not.toHaveTextContent('\\ldots');
    expect(container.querySelectorAll('sup')).toHaveLength(1);
    expect(container.querySelectorAll('sub')).toHaveLength(3);
    expect(container.querySelector('.problem-math-fraction')).toHaveTextContent('ab');
    expect(container.querySelector('.problem-math.is-block')).toBeInTheDocument();
  });

  it('repairs the flattened power notation returned by some cleaned Codeforces pages', () => {
    const { container } = render(<ProblemRichText text={'1 ≤ n, m, a ≤ 10 9.'} />);

    expect(container.querySelector('.problem-math')).toHaveAttribute('aria-label', '10^9');
    expect(container.querySelector('sup')).toHaveTextContent('9');
  });
});
