import { useEffect } from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TimelineProvider, useTimeline } from '../context/TimelineContext';
import { clearCatalogCache } from '../services/algorithmCatalog';
import { AiAssistant } from './AiAssistant';

const ReadyFixture = () => {
  const { algorithmName, setAiStatus } = useTimeline();
  useEffect(() => setAiStatus('ready'), [setAiStatus]);
  return <output aria-label="active algorithm">{algorithmName}</output>;
};

beforeEach(() => {
  localStorage.clear();
  clearCatalogCache();
  vi.stubGlobal('fetch', vi.fn(async (url: string) => ({
    ok: true,
    json: async () => url.includes('leetcode') ? [
      {
        id: '1143', source: 'leetcode', title: 'Longest Common Subsequence', slug: 'lcs',
        difficulty: 'Medium', category: '2d-dp', derivedCategories: ['2d-dp'], tags: ['dynamic-programming'],
      },
      {
        id: '207', source: 'leetcode', title: 'Course Schedule', slug: 'course-schedule',
        difficulty: 'Medium', category: 'graph', derivedCategories: ['graph', 'topological-sort-graph'], tags: ['graph'],
      },
    ] : [],
  })));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('AiAssistant taxonomy cleanup', () => {
  it('removes the interactive taxonomy tree with the trash action', async () => {
    const user = userEvent.setup();
    render(<TimelineProvider><ReadyFixture /><AiAssistant collapsed={false} onToggleCollapse={() => undefined} /></TimelineProvider>);

    const composer = await screen.findByRole('textbox');
    await user.type(composer, '2d dp elinde neler var?{Enter}');
    expect(await screen.findByRole('region', { name: /Soru ağacı|Problem tree/i })).toBeVisible();

    await user.click(screen.getByRole('button', { name: /Konuşma hafızasını temizle|Clear conversation memory/i }));
    expect(screen.queryByRole('region', { name: /Soru ağacı|Problem tree/i })).not.toBeInTheDocument();
  });

  it('runs the selected catalog problem when its unchanged title is submitted', async () => {
    const user = userEvent.setup();
    render(<TimelineProvider><ReadyFixture /><AiAssistant collapsed={false} onToggleCollapse={() => undefined} /></TimelineProvider>);
    const composer = await screen.findByRole('textbox');
    await user.type(composer, 'graf soruların var mı{Enter}');
    await user.click(await screen.findByRole('button', { name: /Course Schedule/ }));
    expect(composer).toHaveValue('Course Schedule');
    await user.type(composer, '{Enter}');
    await waitFor(() => expect(screen.getByLabelText('active algorithm')).toHaveTextContent('Course Schedule'), { timeout: 4_000 });
  });
});
