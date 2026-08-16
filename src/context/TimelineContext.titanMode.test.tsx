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

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const Harness = () => {
  const timeline = useTimeline();
  return (
    <div>
      <span data-testid="algorithm">{timeline.algorithmName}</span>
      <span data-testid="steps">{timeline.steps.length}</span>
      <span data-testid="sync">{timeline.packageOutOfSync ? 'out-of-sync' : 'synced'}</span>
      <span data-testid="graph-x">{timeline.simulationInput.graph?.nodes[0]?.x ?? 'none'}</span>
      <span data-testid="trace-signature">{JSON.stringify(timeline.steps.map((step) => [step.lineNumber, step.explanation]))}</span>
      <span data-testid="input-error">{timeline.inputError ?? ''}</span>
      <span data-testid="titan-enabled">{String(timeline.titanModeEnabled)}</span>
      <button type="button" onClick={() => timeline.applySimulationPackage(packageValue, 'run-1')}>apply</button>
      <button type="button" onClick={() => timeline.setCode(`${timeline.code}\n// manual`)}>edit</button>
      <button type="button" onClick={timeline.undoWorkspaceTransaction}>undo</button>
      <button type="button" onClick={timeline.redoWorkspaceTransaction}>redo</button>
      <button type="button" onClick={() => {
        const graph = timeline.simulationInput.graph;
        if (!graph) return;
        timeline.applyGraphTransaction({
          ...graph,
          nodes: graph.nodes.map((node, index) => index === 0 ? { ...node, x: node.x + 1 } : node),
        });
      }}>move graph</button>
      <button type="button" onClick={() => {
        const graph = timeline.simulationInput.graph;
        if (!graph) return;
        timeline.applyGraphTransaction({ ...graph, nodes: graph.nodes.slice(0, 1) });
      }}>break graph</button>
    </div>
  );
};

describe('TimelineContext Titan Mode transactions', () => {
  it('migrates the legacy disabled preference without silently enabling Titan Mode', () => {
    localStorage.setItem(`codexray.ai.${['god', 'Mode'].join('')}`, 'false');
    render(<TimelineProvider><Harness /></TimelineProvider>);
    expect(screen.getByTestId('titan-enabled')).toHaveTextContent('false');
    expect(localStorage.getItem('codexray.ai.titanMode')).toBe('false');
  });
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

  it('keeps layout edits trace-stable and rolls back a failed structural edit', async () => {
    const user = userEvent.setup();
    render(<TimelineProvider><Harness /></TimelineProvider>);
    await user.click(screen.getByRole('button', { name: 'apply' }));
    const beforeX = Number(screen.getByTestId('graph-x').textContent);
    const beforeTrace = screen.getByTestId('trace-signature').textContent;

    await user.click(screen.getByRole('button', { name: 'move graph' }));
    expect(Number(screen.getByTestId('graph-x').textContent)).toBe(beforeX + 1);
    expect(screen.getByTestId('trace-signature').textContent).toBe(beforeTrace);
    expect(screen.getByTestId('sync')).toHaveTextContent('synced');

    await user.click(screen.getByRole('button', { name: 'break graph' }));
    expect(Number(screen.getByTestId('graph-x').textContent)).toBe(beforeX + 1);
    expect(screen.getByTestId('input-error').textContent).not.toBe('');
    expect(screen.getByTestId('trace-signature').textContent).toBe(beforeTrace);
  });
});
