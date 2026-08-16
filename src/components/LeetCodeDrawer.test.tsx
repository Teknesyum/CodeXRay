import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TimelineProvider } from '../context/TimelineContext';
import { loadCatalog } from '../services/algorithmCatalog';
import { loadCatalogProblemDetails } from '../services/catalogProblemDetails';
import { LeetCodeDrawer } from './LeetCodeDrawer';

const problems = Array.from({ length: 55 }, (_, index) => ({
  id: String(index + 1),
  source: 'leetcode',
  title: `Problem ${index + 1}`,
  slug: `problem-${index + 1}`,
  difficulty: (['Easy', 'Medium', 'Hard'] as const)[index % 3],
  category: index % 2 === 0 ? 'array' : 'tree',
  derivedCategories: [index % 2 === 0 ? 'array' : 'tree'],
  tags: [index % 2 === 0 ? 'array' : 'tree'],
}));

vi.mock('../services/algorithmCatalog', () => ({
  loadCatalog: vi.fn(async () => problems),
  clearCatalogCache: vi.fn(),
}));

vi.mock('../services/catalogSupportRegistry', () => ({
  checkProblemSupport: vi.fn(async (_source: string, problemId: string) => (
    problemId === '1'
      ? { type: 'exact-simulation', template: 'house-robber-1d-dp' }
      : { type: 'needs-source' }
  )),
}));

vi.mock('../services/catalogProblemDetails', () => ({
  clearCatalogProblemDetailsCache: vi.fn(),
  getCatalogProblemUrl: vi.fn((problem: { source: string; slug: string }) => `https://leetcode.com/problems/${problem.slug}/`),
  loadCatalogProblemDetails: vi.fn(async (problem: { id: string; source: string; title: string }) => ({
    source: problem.source,
    problemId: problem.id,
    canonicalUrl: `https://leetcode.com/problems/problem-${problem.id}/`,
    document: { version: 1 },
    problem: {
      version: 1,
      id: `detail-${problem.id}`,
      sourceDocumentId: `document-${problem.id}`,
      sourceHash: `hash-${problem.id}`,
      title: problem.title,
      description: `Statement for ${problem.title} with $$$n$$$ values.`,
      inputFormat: 'An integer array.',
      outputFormat: 'Return one integer.',
      examples: [{ input: '[1,2,3]', output: '3', sourceSegmentIds: ['example-1'] }],
      constraints: ['1 <= n <= 100', '$$$1 \\le n \\le 10^4$$$'],
      notes: ['Try a smaller prefix first.'],
      signature: 'public int solve(int[] values)',
      sourceSegmentIds: { description: [], inputFormat: [], outputFormat: [], examples: [], constraints: [], notes: [], signature: [] },
      simulationCompatibility: { compatible: true, reason: 'test' },
    },
  })),
}));

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('codexray.locale', 'en');
});

afterEach(() => cleanup());

describe('Problem catalog drawer', () => {
  it('renders one page, selects details, marks verified entries, and emits source plus ID', async () => {
    const eventListener = vi.fn();
    window.addEventListener('titan-mode-user-message', eventListener);
    const user = userEvent.setup();
    render(
      <TimelineProvider>
        <LeetCodeDrawer isOpen onClose={vi.fn()} />
      </TimelineProvider>,
    );

    expect(await screen.findByRole('heading', { name: 'Examples' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(50));
    await user.click(screen.getByRole('button', { name: /^#1Problem 1Easy/ }));
    expect(await screen.findByRole('heading', { name: 'Problem 1' })).toBeInTheDocument();
    expect(await screen.findByText(/Statement for Problem 1/)).toBeInTheDocument();
    expect(screen.getByText('1 <= n <= 100')).toBeInTheDocument();
    expect(screen.getByRole('math', { name: '1 \\le n \\le 10^4' })).toBeInTheDocument();
    expect(document.querySelector('.examples-problem-content')).not.toHaveTextContent('$$$');
    expect(screen.getAllByLabelText('Simulation verified').length).toBeGreaterThan(0);
    const simulate = screen.getByRole('button', { name: 'Simulate with Titan Mode' });
    expect(simulate).toBeEnabled();
    await user.click(simulate);
    expect(eventListener).toHaveBeenCalledOnce();
    expect((eventListener.mock.calls[0][0] as CustomEvent).detail).toEqual({
      text: 'Create catalog problem: leetcode/1',
    });
    window.removeEventListener('titan-mode-user-message', eventListener);
  });

  it('closes on Escape and keeps keyboard focus inside the dialog', async () => {
    const onClose = vi.fn();
    render(
      <TimelineProvider>
        <LeetCodeDrawer isOpen onClose={onClose} />
      </TimelineProvider>,
    );
    await screen.findByRole('heading', { name: 'Examples' });
    const closeButton = screen.getByRole('button', { name: 'Close examples' });
    expect(document.activeElement).toBe(closeButton);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('keeps signature, examples, and hints collapsed until their headings are clicked', async () => {
    const user = userEvent.setup();
    render(
      <TimelineProvider>
        <LeetCodeDrawer isOpen onClose={vi.fn()} />
      </TimelineProvider>,
    );
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(50));
    await user.click(screen.getByRole('button', { name: /^#1Problem 1Easy/ }));
    await screen.findByRole('heading', { name: 'Problem 1' });

    for (const title of ['Function signature', 'Examples', 'Hints and notes']) {
      const heading = screen.getByText(title, { selector: 'h4' });
      const disclosure = heading.closest('details');
      expect(disclosure).not.toHaveAttribute('open');
      await user.click(heading);
      expect(disclosure).toHaveAttribute('open');
    }
  });

  it('filters the catalog by difficulty and problem type', async () => {
    const user = userEvent.setup();
    render(
      <TimelineProvider>
        <LeetCodeDrawer isOpen onClose={vi.fn()} />
      </TimelineProvider>,
    );
    await screen.findByRole('heading', { name: 'Examples' });
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(50));

    await user.selectOptions(screen.getByRole('combobox', { name: 'Difficulty' }), 'Hard');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Problem type' }), 'tree');

    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(9));
    expect(screen.getAllByRole('button', { name: /Problem/ }).every((button) => button.textContent?.includes('Hard'))).toBe(true);
  });

  it('routes unverified problems through their source instead of claiming exact support', async () => {
    const eventListener = vi.fn();
    window.addEventListener('titan-mode-user-message', eventListener);
    const user = userEvent.setup();
    render(
      <TimelineProvider>
        <LeetCodeDrawer isOpen onClose={vi.fn()} />
      </TimelineProvider>,
    );
    await screen.findByRole('heading', { name: 'Examples' });
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(50));

    await user.click(screen.getByRole('button', { name: '#2Problem 2Medium' }));

    expect(await screen.findByRole('heading', { name: 'Problem 2' })).toBeInTheDocument();
    expect(screen.getByText('No exact simulation is verified yet; Titan Mode will attempt it from the problem source.')).toBeInTheDocument();
    const simulate = screen.getByRole('button', { name: 'Simulate with Titan Mode' });
    expect(simulate).toBeEnabled();
    await user.click(simulate);
    expect((eventListener.mock.calls[0][0] as CustomEvent).detail).toEqual({
      text: 'Solve and simulate this catalog problem: https://leetcode.com/problems/problem-2/',
    });
    window.removeEventListener('titan-mode-user-message', eventListener);
  });

  it('loads only the selected platform catalog', async () => {
    const user = userEvent.setup();
    render(
      <TimelineProvider>
        <LeetCodeDrawer isOpen onClose={vi.fn()} />
      </TimelineProvider>,
    );
    await screen.findByRole('heading', { name: 'Examples' });

    await user.selectOptions(screen.getByRole('combobox', { name: 'Platform' }), 'cses');

    await waitFor(() => expect(vi.mocked(loadCatalog)).toHaveBeenCalledWith({ source: 'cses' }));
  });

  it('keeps source failures visible and retryable without inventing details', async () => {
    vi.mocked(loadCatalogProblemDetails).mockRejectedValueOnce(new Error('The upstream site returned HTTP 403.'));
    const user = userEvent.setup();
    render(
      <TimelineProvider>
        <LeetCodeDrawer isOpen onClose={vi.fn()} />
      </TimelineProvider>,
    );
    await screen.findByRole('heading', { name: 'Examples' });
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(50));
    await user.click(screen.getByRole('button', { name: '#2Problem 2Medium' }));

    expect(await screen.findByText('Problem details are currently unavailable.')).toBeInTheDocument();
    expect(screen.getByText('The upstream site returned HTTP 403.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry details' })).toBeEnabled();
  });
});
