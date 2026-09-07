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

const PopulateMatrixTrace = () => {
  const { setAlgorithmName, setSteps } = useTimeline();
  useEffect(() => {
    setAlgorithmName('LeetCode 486 — Predict the Winner');
    setSteps([{
      lineNumber: 14,
      explanation: 'Fill dp[0][1] from its two dependencies.',
      visualData: {
        type: 'matrix',
        values: [[1, 4], [null, 5]],
        rowLabels: ['i=0 · 1', 'i=1 · 5'],
        columnLabels: ['j=0 · 1', 'j=1 · 5'],
        fillDirection: 'diagonal',
        highlights: [
          { row: 0, column: 1, role: 'active', label: 'dp[0][1] = 4' },
          { row: 1, column: 1, role: 'dependency', label: 'dp[1][1] = 5' },
          { row: 0, column: 0, role: 'dependency', label: 'dp[0][0] = 1' },
        ],
        vars: { i: 0, j: 1, takeLeft: -4, takeRight: 4 },
      },
    }]);
  }, [setAlgorithmName, setSteps]);
  return null;
};

const PopulateMatrixDecisionTrace = () => {
  const { setAlgorithmName, setSteps } = useTimeline();
  useEffect(() => {
    setAlgorithmName('0/1 Knapsack');
    setSteps([{
      lineNumber: 9,
      explanation: 'Process one knapsack item.',
      visualData: {
        type: 'matrix',
        values: [[0, 0], [0, 3]],
        rowLabels: ['i=0', 'i=1'],
        columnLabels: ['w=0', 'w=1'],
        fillDirection: 'row',
        highlights: [{ row: 1, column: 1, role: 'active', label: 'dp[1][1] = 3' }],
        vars: { phase: 'Knapsack · fill row', decision: 'include current item' },
      },
    }]);
  }, [setAlgorithmName, setSteps]);
  return null;
};

const PopulatePedagogicalGraphTrace = () => {
  const { setAlgorithmName, setSteps } = useTimeline();
  useEffect(() => {
    setAlgorithmName("Kruskal's MST");
    setSteps([{
      lineNumber: null,
      explanation: 'Reject A–C because it closes a cycle.',
      visualData: {
        type: 'graph',
        directed: false,
        nodes: [
          { id: 'A', label: 'A', x: 20, y: 50, state: 'visited' },
          { id: 'C', label: 'C', x: 80, y: 50, state: 'active' },
        ],
        edges: [{ id: 'ac', from: 'A', to: 'C', weight: 4, state: 'rejected' }],
        vars: {
          phase: 'Kruskal · reject cycle',
          decision: 'A and C already share component A.',
          components: { A: 'A', C: 'A' },
        },
      },
    }]);
  }, [setAlgorithmName, setSteps]);
  return null;
};

const PopulateSpecializedVisualTrace = () => {
  const { setSteps, setCurrentIndex } = useTimeline();
  useEffect(() => {
    setSteps([
      { lineNumber: 1, explanation: 'Align pattern.', visualData: {
        type: 'string-match', text: 'ABABA', pattern: 'ABA', alignment: 2, activeText: [2], activePattern: [0], mismatchText: 3,
        window: [2, 4], vars: { phase: 'KMP · compare text character' },
      } },
      { lineNumber: 2, explanation: 'Fill water.', visualData: {
        type: 'bars', values: [3, 0, 2], water: [0, 2, 0], pointers: { left: 0 }, vars: {},
      } },
      { lineNumber: 3, explanation: 'Merge spans.', visualData: {
        type: 'intervals', intervals: [[1, 3], [2, 5]], merged: [[1, 5]], current: [1, 5], vars: {},
      } },
      { lineNumber: 4, explanation: 'Show dependencies.', visualData: {
        type: 'rows', mode: 'rows', rows: [{ label: 'source', values: [3, 1] }, { label: 'prefix', values: [3, 4] }],
        active: [{ row: 0, column: 1, role: 'dependency' }, { row: 1, column: 1, role: 'result' }], vars: {},
      } },
    ]);
  }, [setSteps]);
  return <>
    <button type="button" onClick={() => setCurrentIndex(1)}>Show bars</button>
    <button type="button" onClick={() => setCurrentIndex(2)}>Show intervals</button>
    <button type="button" onClick={() => setCurrentIndex(3)}>Show rows</button>
  </>;
};

const PopulateDecisionTrace = () => {
  const { setAlgorithmName, setSteps, setCurrentIndex, setLocale } = useTimeline();
  useEffect(() => {
    setAlgorithmName('Binary Search');
    setSteps([
      { lineNumber: 1, explanation: 'Inspect the binary-search midpoint.', visualData: {
        type: 'array', values: [1, 3, 5], pointers: { mid: 1 },
        vars: { phase: 'Binary Search · inspect midpoint', decision: 'mid<target ⇒ discard left half' },
      } },
      { lineNumber: 2, explanation: 'Show dependencies.', visualData: {
        type: 'rows', mode: 'rows', rows: [{ label: 'source', values: [3, 1] }],
        vars: { phase: 'LIS · scan predecessors', decision: 'not increasing ⇒ reject' },
      } },
    ]);
  }, [setAlgorithmName, setSteps]);
  return <>
    <button type="button" onClick={() => setCurrentIndex(1)}>Show decision rows</button>
    <button type="button" onClick={() => setLocale('tr')}>Switch to Turkish</button>
  </>;
};

const PopulateBarIntervalPhaseTrace = () => {
  const { setSteps, setCurrentIndex, setLocale } = useTimeline();
  useEffect(() => {
    setSteps([
      { lineNumber: 1, explanation: 'Fill water.', visualData: {
        type: 'bars', values: [3, 0, 2], water: [0, 2, 0], pointers: { left: 0 },
        vars: { phase: 'Trapping Rain Water · initialize boundaries' },
      } },
      { lineNumber: 2, explanation: 'Merge spans.', visualData: {
        type: 'intervals', intervals: [[1, 3], [2, 5]], merged: [[1, 5]], current: [1, 5],
        vars: { phase: 'Merge Intervals · merge overlap' },
      } },
      { lineNumber: 3, explanation: 'Nothing to draw.', visualData: {
        type: 'intervals', intervals: [], merged: [],
        vars: { phase: 'Merge Intervals · complete' },
      } },
    ]);
  }, [setSteps]);
  return <>
    <button type="button" onClick={() => setCurrentIndex(1)}>Show interval phase</button>
    <button type="button" onClick={() => setCurrentIndex(2)}>Show empty intervals</button>
    <button type="button" onClick={() => setLocale('tr')}>Switch to Turkish</button>
  </>;
};

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('codexray.locale', 'en');
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

  it('renders DP coordinates and dependency roles without relying on color', async () => {
    localStorage.setItem('codexray.pinned-variables.v1', '[]');
    render(
      <TimelineProvider>
        <PopulateMatrixTrace />
        <DynamicVisualizer collapsed={false} onToggleCollapse={() => undefined} />
      </TimelineProvider>,
    );
    const table = await screen.findByRole('grid', { name: 'DP table' });
    expect(within(table).getByRole('gridcell', { name: /dp\[0\]\[1\]: 4; dp\[0\]\[1\] = 4/ }))
      .toHaveAttribute('data-role', 'active');
    expect(within(table).getByRole('gridcell', { name: /dp\[1\]\[1\]: 5; dp\[1\]\[1\] = 5/ }))
      .toHaveAttribute('data-role', 'dependency');
  });

  it('renders graph phase, decision, node badges, and rejected edges without relying on color', async () => {
    localStorage.setItem('codexray.pinned-variables.v1', '[]');
    render(
      <TimelineProvider>
        <PopulatePedagogicalGraphTrace />
        <DynamicVisualizer collapsed={false} onToggleCollapse={() => undefined} />
      </TimelineProvider>,
    );
    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent('Kruskal · reject cycle');
    expect(status).toHaveTextContent('A and C already share component A.');
    expect(screen.getAllByText('C:A')).toHaveLength(2);
    expect(screen.getByRole('img', { name: /Edge A → C: rejected/i })).toHaveClass('rejected');
  });

  it('renders every specialized typed visual with semantic accessible state', async () => {
    localStorage.setItem('codexray.pinned-variables.v1', '[]');
    const user = userEvent.setup();
    render(
      <TimelineProvider>
        <PopulateSpecializedVisualTrace />
        <DynamicVisualizer collapsed={false} onToggleCollapse={() => undefined} />
      </TimelineProvider>,
    );
    expect(await screen.findByRole('region', { name: 'String matching view' })).toHaveTextContent('Text0A1B2A3B4A');
    expect(screen.getByText('[2, 4]')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Show bars' }));
    expect(screen.getByRole('img', { name: 'Column 1: height 0, water 2' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Show intervals' }));
    expect(screen.getByRole('img', { name: 'Merged interval 1 to 5, current' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Show rows' }));
    expect(screen.getByRole('gridcell', { name: 'prefix[1]: 4; result' })).toHaveClass('rows-result');
    expect(screen.getByRole('gridcell', { name: 'source[1]: 1; dependency' })).toHaveClass('rows-dependency');
  });
  it('renders the decision in the array and rows views in both locales', async () => {
    localStorage.setItem('codexray.pinned-variables.v1', '[]');
    const user = userEvent.setup();
    render(
      <TimelineProvider>
        <PopulateDecisionTrace />
        <DynamicVisualizer collapsed={false} onToggleCollapse={() => undefined} />
      </TimelineProvider>,
    );
    const arrayHud = await screen.findByRole('status');
    expect(arrayHud).toHaveClass('matrix-teaching-hud');
    expect(arrayHud).toHaveTextContent('mid<target ⇒ discard left half');
    expect(arrayHud).toHaveTextContent('Binary Search · inspect midpoint');

    await user.click(screen.getByRole('button', { name: 'Show decision rows' }));
    expect(screen.getByRole('status')).toHaveTextContent('LIS · scan predecessors');
    expect(screen.getByRole('status')).toHaveTextContent('not increasing ⇒ reject');

    await user.click(screen.getByRole('button', { name: 'Switch to Turkish' }));
    expect(screen.getByRole('status')).toHaveTextContent('artan değil ⇒ reddedilir');
  });

  it('renders the phase in the bar and interval views in both locales', async () => {
    localStorage.setItem('codexray.pinned-variables.v1', '[]');
    const user = userEvent.setup();
    render(
      <TimelineProvider>
        <PopulateBarIntervalPhaseTrace />
        <DynamicVisualizer collapsed={false} onToggleCollapse={() => undefined} />
      </TimelineProvider>,
    );
    const barHud = await screen.findByRole('status');
    expect(barHud).toHaveClass('matrix-teaching-hud');
    expect(barHud).toHaveTextContent('Trapping Rain Water · initialize boundaries');

    await user.click(screen.getByRole('button', { name: 'Show interval phase' }));
    expect(screen.getByRole('status')).toHaveTextContent('Merge Intervals · merge overlap');

    await user.click(screen.getByRole('button', { name: 'Show empty intervals' }));
    expect(screen.getByRole('status')).toHaveTextContent('Merge Intervals · complete');

    await user.click(screen.getByRole('button', { name: 'Switch to Turkish' }));
    expect(screen.getByRole('status')).toHaveTextContent('Aralık Birleştirme · tamamlandı');
    expect(screen.getByRole('status')).not.toHaveTextContent('Merge Intervals');
  });

  it('keeps the graph teaching hud markup byte-identical', async () => {
    localStorage.setItem('codexray.pinned-variables.v1', '[]');
    render(
      <TimelineProvider>
        <PopulatePedagogicalGraphTrace />
        <DynamicVisualizer collapsed={false} onToggleCollapse={() => undefined} />
      </TimelineProvider>,
    );
    const status = await screen.findByRole('status');
    expect(status.outerHTML).toBe(
      '<div class="graph-teaching-hud" role="status">'
      + '<strong>Kruskal · reject cycle</strong>'
      + '<span>A and C already share component A.</span>'
      + '</div>',
    );
  });

  it('keeps the matrix teaching hud markup byte-identical', async () => {
    localStorage.setItem('codexray.pinned-variables.v1', '[]');
    render(
      <TimelineProvider>
        <PopulateMatrixDecisionTrace />
        <DynamicVisualizer collapsed={false} onToggleCollapse={() => undefined} />
      </TimelineProvider>,
    );
    const status = await screen.findByRole('status');
    expect(status.outerHTML).toBe(
      '<div class="matrix-teaching-hud" role="status">'
      + '<strong>Knapsack · fill row</strong>'
      + '<span>include current item</span>'
      + '</div>',
    );
  });
});
