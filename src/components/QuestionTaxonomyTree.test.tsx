import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import QuestionTaxonomyTree from './QuestionTaxonomyTree';

const groups = [{
  id: 'dp',
  label: 'Dynamic Programming',
  nodes: [
    { id: 'lcs', label: 'LCS', count: 1, problems: [{ id: '1143', source: 'leetcode', title: 'Longest Common Subsequence', difficulty: 'Medium' as const }] },
    { id: 'grid-dp', label: 'Grid ve Matris DP', count: 1, problems: [{ id: '62', source: 'leetcode', title: 'Unique Paths', difficulty: 'Easy' as const }] },
  ],
}];

afterEach(cleanup);

describe('QuestionTaxonomyTree', () => {
  it('opens the routed node and navigates locally by clicking another branch', async () => {
    const user = userEvent.setup();
    render(<QuestionTaxonomyTree groups={groups} initialNodeId="lcs" locale="tr" />);

    expect(screen.getByRole('button', { name: /LCS\s*1/ })).toHaveClass('active');
    expect(screen.getByRole('button', { name: /Longest Common Subsequence/ })).toBeVisible();
    await user.click(screen.getByRole('button', { name: /Grid ve Matris DP\s*1/ }));
    expect(screen.getByRole('button', { name: /Grid ve Matris DP\s*1/ })).toHaveClass('active');
    expect(screen.getByRole('button', { name: /Unique Paths/ })).toBeVisible();
  });

  it('shows difficulty and fills the composer without submitting', async () => {
    const user = userEvent.setup();
    const onProblemSelect = vi.fn();
    render(<QuestionTaxonomyTree groups={groups} initialNodeId="lcs" locale="tr" onProblemSelect={onProblemSelect} />);
    expect(screen.getByLabelText('Medium')).toBeVisible();
    await user.click(screen.getByRole('button', { name: /Longest Common Subsequence/ }));
    expect(onProblemSelect).toHaveBeenCalledWith(expect.objectContaining({ id: '1143', title: 'Longest Common Subsequence' }));
  });

  it('paginates instead of hiding the remainder', async () => {
    const user = userEvent.setup();
    const problems = Array.from({ length: 41 }, (_, index) => ({
      id: String(index), source: 'leetcode', title: index === 40 ? 'A First Problem' : `Problem ${String(index).padStart(2, '0')}`, difficulty: 'Hard' as const,
    })).sort((left, right) => left.title.localeCompare(right.title, undefined, { sensitivity: 'base', numeric: true }));
    render(<QuestionTaxonomyTree groups={[{ id: 'dp', label: 'Dynamic Programming', nodes: [{ id: '2d-dp', label: '2D DP', count: 41, problems }] }]} initialNodeId="2d-dp" locale="tr" />);
    expect(screen.getByRole('button', { name: /A First Problem/ })).toBeVisible();
    expect(screen.queryByText(/soru daha/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Sonraki' }));
    expect(screen.getByText('2 / 2')).toBeVisible();
  });
});
