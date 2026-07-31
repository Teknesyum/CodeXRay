import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { TimelineProvider, useTimeline } from './TimelineContext';
import { compileCustomSimulationPackage } from '../services/customSimulationCompiler';
import {
  BIDIRECTIONAL_BFS_VISUALIZATION,
  createBidirectionalBfsInput,
  createBidirectionalBfsProgram,
} from '../services/simLangBuiltins';

const packageValue = compileCustomSimulationPackage({
  id: 'transaction-package',
  title: 'Bidirectional BFS',
  locale: 'en',
  program: createBidirectionalBfsProgram('en'),
  input: createBidirectionalBfsInput(),
  visualization: BIDIRECTIONAL_BFS_VISUALIZATION,
  analysis: 'O(V + E)',
});

afterEach(cleanup);

const Harness = () => {
  const timeline = useTimeline();
  return (
    <div>
      <span data-testid="algorithm">{timeline.algorithmName}</span>
      <span data-testid="steps">{timeline.steps.length}</span>
      <span data-testid="sync">{timeline.packageOutOfSync ? 'out-of-sync' : 'synced'}</span>
      <button type="button" onClick={() => timeline.applySimulationPackage(packageValue, 'run-1')}>apply</button>
      <button type="button" onClick={() => timeline.setCode(`${timeline.code}\n// manual`)}>edit</button>
      <button type="button" onClick={timeline.undoWorkspaceTransaction}>undo</button>
      <button type="button" onClick={timeline.redoWorkspaceTransaction}>redo</button>
    </div>
  );
};

describe('TimelineContext God Mode transactions', () => {
  it('atomically applies a package and restores it with undo/redo', async () => {
    const user = userEvent.setup();
    render(<TimelineProvider><Harness /></TimelineProvider>);

    expect(screen.getByTestId('algorithm')).toHaveTextContent('Custom Code');
    await user.click(screen.getByRole('button', { name: 'apply' }));
    expect(screen.getByTestId('algorithm')).toHaveTextContent('Bidirectional BFS');
    expect(Number(screen.getByTestId('steps').textContent)).toBeGreaterThan(3);
    expect(screen.getByTestId('sync')).toHaveTextContent('synced');

    await user.click(screen.getByRole('button', { name: 'undo' }));
    expect(screen.getByTestId('algorithm')).toHaveTextContent('Custom Code');
    await user.click(screen.getByRole('button', { name: 'redo' }));
    expect(screen.getByTestId('algorithm')).toHaveTextContent('Bidirectional BFS');
  });

  it('marks a generated package out of sync after manual source edits', async () => {
    const user = userEvent.setup();
    render(<TimelineProvider><Harness /></TimelineProvider>);
    await user.click(screen.getByRole('button', { name: 'apply' }));
    await user.click(screen.getByRole('button', { name: 'edit' }));
    expect(screen.getByTestId('sync')).toHaveTextContent('out-of-sync');
  });
});
