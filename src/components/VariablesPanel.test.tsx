import { useEffect } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TimelineProvider, useTimeline } from '../context/TimelineContext';
import { VariablesPanel } from './VariablesPanel';

const PopulateTrace = () => {
  const { setSteps } = useTimeline();
  useEffect(() => {
    setSteps([{
      lineNumber: 1,
      visualData: {
        type: 'variables',
        vars: { visited: Array.from({ length: 15 }, (_, index) => index + 1) },
      },
      explanation: 'Trace',
    }]);
  }, [setSteps]);
  return null;
};

describe('VariablesPanel', () => {
  it('renders every array item without truncation', async () => {
    render(
      <TimelineProvider>
        <PopulateTrace />
        <VariablesPanel />
      </TimelineProvider>,
    );
    expect(await screen.findByText('Array(15)')).toBeInTheDocument();
    expect(screen.getByText('[14]')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.queryByText('...')).not.toBeInTheDocument();
  });
});
