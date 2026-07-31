import { useEffect } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { SimulationStep } from '../types/simulation';
import { TimelineProvider, useTimeline } from '../context/TimelineContext';
import { ControlBar } from './ControlBar';

const steps: SimulationStep[] = [0, 1, 2].map((index) => ({
  lineNumber: index + 1,
  explanation: `Step ${index + 1}.`,
  visualData: { type: 'variables', vars: { index } },
}));

const Setup = ({ index }: { index: number }) => {
  const { setSteps, setCurrentIndex } = useTimeline();
  useEffect(() => {
    setSteps(steps);
    setCurrentIndex(index);
  }, [index, setCurrentIndex, setSteps]);
  return null;
};

const Harness = ({ index = 0 }: { index?: number }) => (
  <TimelineProvider>
    <Setup index={index} />
    <ControlBar onSimulate={() => undefined} onAnalyze={() => undefined} collapsed={false} onToggleCollapse={() => undefined} />
  </TimelineProvider>
);

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('codexray.locale', 'en');
});

afterEach(cleanup);

describe('ControlBar integration', () => {
  it('disables timeline navigation at the real boundaries', () => {
    const { rerender } = render(<Harness index={0} />);
    expect(screen.getByRole('button', { name: 'Previous step' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next step' })).toBeEnabled();

    rerender(<Harness index={2} />);
    expect(screen.getByRole('button', { name: 'Previous step' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Next step' })).toBeDisabled();
  });

  it('moves focus into settings and restores it to the trigger on close', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Settings' });
    await user.click(trigger);
    expect(screen.getByRole('dialog', { name: 'Settings' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Close settings' }));
    expect(trigger).toHaveFocus();
  });
});
