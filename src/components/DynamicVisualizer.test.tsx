import { useEffect } from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TimelineProvider, useTimeline } from '../context/TimelineContext';
import { DynamicVisualizer } from './DynamicVisualizer';

const PopulateWatchTrace = () => {
  const { setSteps, setCurrentIndex } = useTimeline();
  useEffect(() => {
    setSteps([
      {
        lineNumber: 1,
        visualData: {
          type: 'variables',
          vars: { visited: ['A', 'B'], current: 'B' },
        },
        explanation: 'First state',
      },
      {
        lineNumber: 2,
        visualData: {
          type: 'variables',
          vars: { visited: ['A', 'B', 'C'], current: 'C' },
        },
        explanation: 'Second state',
      },
    ]);
  }, [setSteps]);
  return <button type="button" onClick={() => setCurrentIndex(1)}>Next test step</button>;
};

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('codexray.pinned-variables.v1', '["visited"]');
});
afterEach(() => cleanup());

describe('DynamicVisualizer pinned watch strip', () => {
  it('tracks a pinned value live and can unpin it from the main view', async () => {
    const user = userEvent.setup();
    render(
      <TimelineProvider>
        <PopulateWatchTrace />
        <DynamicVisualizer collapsed={false} onToggleCollapse={() => undefined} />
      </TimelineProvider>,
    );

    const watchStrip = await screen.findByRole('region', { name: 'Pinned variables' });
    expect(within(watchStrip).getByText('["A","B"]')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next test step' }));
    expect(within(watchStrip).getByText('["A","B","C"]')).toBeInTheDocument();

    await user.click(within(watchStrip).getByRole('button', { name: 'Unpin visited' }));
    expect(screen.queryByRole('region', { name: 'Pinned variables' })).not.toBeInTheDocument();
    expect(localStorage.getItem('codexray.pinned-variables.v1')).toBe('[]');
  });

  it('marks a pinned key unavailable instead of showing a stale value', async () => {
    localStorage.setItem('codexray.pinned-variables.v1', '["queue"]');
    render(
      <TimelineProvider>
        <PopulateWatchTrace />
        <DynamicVisualizer collapsed={false} onToggleCollapse={() => undefined} />
      </TimelineProvider>,
    );

    const watchStrip = await screen.findByRole('region', { name: 'Pinned variables' });
    expect(within(watchStrip).getByText('Not available in this step')).toBeInTheDocument();
    expect(watchStrip.querySelector('.pinned-watch-item')).toHaveClass('unavailable');
  });
});
