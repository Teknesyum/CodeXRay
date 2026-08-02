import { useEffect } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TimelineProvider, useTimeline } from '../context/TimelineContext';
import { AiAssistant } from './AiAssistant';

const COMPLEXITY = 'Multi-source BFS over (node,mask): O((V+E)2^V) time, O(V2^V) space.';
const INTERVAL_DP_ANALYSIS = [
  'State: dp[i][j] is the best score difference on interval nums[i..j].',
  'Transition: dp[i][j] = max(nums[i] - dp[i+1][j], nums[j] - dp[i][j-1]).',
  'Fill order: main diagonal first, then interval lengths 2..n.',
  'Time Complexity: O(n^2)',
  'Space Complexity: O(n^2)',
].join('\n');

const AnalysisFixture = ({ value = COMPLEXITY }: { value?: string }) => {
  const { setAnalysis } = useTimeline();
  useEffect(() => setAnalysis(value), [setAnalysis, value]);
  return null;
};

const renderAnalysis = (value = COMPLEXITY) => render(
  <TimelineProvider>
    <AnalysisFixture value={value} />
    <AiAssistant collapsed={false} onToggleCollapse={() => undefined} />
  </TimelineProvider>,
);

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('codexray.locale', 'en');
});

afterEach(() => cleanup());

describe('AiAssistant algorithm analysis outline', () => {
  it('keeps analysis outside chat messages and clears it from its own action', async () => {
    const user = userEvent.setup();
    const { container } = renderAnalysis();

    const outline = screen.getByRole('region', { name: 'Algorithm analysis' });
    expect(outline).toHaveTextContent('Multi-source BFS over (node,mask)');
    expect(outline.closest('.chat-message')).toBeNull();
    expect(container.querySelector('.system-msg')).not.toHaveTextContent('Multi-source BFS');

    await user.click(screen.getByRole('button', { name: 'Clear analysis' }));
    expect(screen.queryByRole('region', { name: 'Algorithm analysis' })).not.toBeInTheDocument();
  });

  it('enables the conversation trash action when analysis is the only removable content', async () => {
    const user = userEvent.setup();
    renderAnalysis();
    const clearConversation = screen.getByRole('button', { name: 'Clear conversation memory' });

    expect(clearConversation).toBeEnabled();
    await user.click(clearConversation);
    expect(screen.queryByRole('region', { name: 'Algorithm analysis' })).not.toBeInTheDocument();
  });

  it('localizes analysis labels and explanatory values when Turkish is selected', () => {
    localStorage.setItem('codexray.locale', 'tr');
    renderAnalysis(INTERVAL_DP_ANALYSIS);

    const outline = screen.getByRole('region', { name: 'Algoritma analizi' });
    expect(outline).toHaveTextContent('Durum');
    expect(outline).toHaveTextContent('Geçiş');
    expect(outline).toHaveTextContent('Doldurma sırası');
    expect(outline).toHaveTextContent('Zaman Karmaşıklığı');
    expect(outline).toHaveTextContent('Alan Karmaşıklığı');
    expect(outline).toHaveTextContent('Önce ana köşegen, ardından 2..n aralık uzunlukları doldurulur.');
    expect(outline).not.toHaveTextContent('best score difference');
    expect(outline).not.toHaveTextContent('main diagonal first');
  });
});
