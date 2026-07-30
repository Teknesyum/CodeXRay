import { useEffect } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TimelineProvider, useTimeline } from '../context/TimelineContext';
import { VariablesPanel } from './VariablesPanel';

const PopulateTrace = () => {
  const { setSteps } = useTimeline();
  useEffect(() => {
    setSteps([{
      lineNumber: 1,
      visualData: {
        type: 'variables',
        vars: {
          index: 14,
          visited: Array.from({ length: 15 }, (_, index) => index + 1),
        },
      },
      explanation: 'Trace',
    }]);
  }, [setSteps]);
  return null;
};

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

describe('VariablesPanel', () => {
  it('renders every array item without truncation', async () => {
    render(
      <TimelineProvider>
        <PopulateTrace />
        <VariablesPanel collapsed={false} onToggleCollapse={() => undefined} />
      </TimelineProvider>,
    );
    expect(await screen.findByText('Array(15)')).toBeInTheDocument();
    expect(screen.getByText('[14]')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.queryByText('...')).not.toBeInTheDocument();
  });

  it('moves a pinned variable to the top and persists the choice locally', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <TimelineProvider>
        <PopulateTrace />
        <VariablesPanel collapsed={false} onToggleCollapse={() => undefined} />
      </TimelineProvider>,
    );
    await screen.findByText('Array(15)');
    expect(container.querySelector('.var-item:first-child')).toHaveAttribute('data-testid', 'variable-index');

    await user.click(screen.getByRole('button', { name: 'Pin visited' }));

    expect(container.querySelector('.var-item:first-child')).toHaveAttribute('data-testid', 'variable-visited');
    expect(screen.getByRole('button', { name: 'Unpin visited' })).toHaveAttribute('aria-pressed', 'true');
    expect(localStorage.getItem('codexray.pinned-variables.v1')).toBe('["visited"]');
  });
});
