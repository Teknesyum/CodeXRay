import { useEffect } from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TimelineProvider, useTimeline } from '../context/TimelineContext';
import { AiAssistant } from './AiAssistant';

const mocks = vi.hoisted(() => ({
  askQuestion: vi.fn(),
  planLocalActions: vi.fn(),
}));

vi.mock('../services/aiService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/aiService')>();
  return { ...actual, askQuestion: mocks.askQuestion };
});

vi.mock('../services/localAiService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/localAiService')>();
  return { ...actual, planLocalActions: mocks.planLocalActions };
});

const WorkspaceProbe = () => {
  const {
    algorithmName,
    code,
    simulationInput,
    steps,
    setAiStatus,
    setLocale,
  } = useTimeline();

  useEffect(() => {
    setLocale('tr');
    setAiStatus('ready');
  }, [setAiStatus, setLocale]);

  return (
    <div>
      <output data-testid="algorithm-name">{algorithmName}</output>
      <output data-testid="source-code">{code}</output>
      <output data-testid="input-kind">{simulationInput.kind}</output>
      <output data-testid="step-count">{steps.length}</output>
    </div>
  );
};

const renderReadyAssistant = () => render(
  <TimelineProvider>
    <WorkspaceProbe />
    <AiAssistant collapsed={false} onToggleCollapse={() => undefined} />
  </TimelineProvider>,
);

beforeEach(() => {
  localStorage.clear();
  mocks.askQuestion.mockReset().mockResolvedValue('DFS çalışma alanı hazır.');
  mocks.planLocalActions.mockReset().mockResolvedValue('{"actions":[]}');
});

afterEach(cleanup);

describe('AiAssistant safe action pipeline', () => {
  it('loads an explicit DFS command by canonical preset ID before explaining it', async () => {
    const user = userEvent.setup();
    renderReadyAssistant();

    const input = await screen.findByRole('textbox');
    await user.type(input, 'DFS sayfasını aç{Enter}');

    await waitFor(() => {
      expect(screen.getByTestId('algorithm-name')).toHaveTextContent('Depth First Search (DFS)');
    });
    expect(screen.getByTestId('source-code').textContent).toContain('void DFS');
    expect(screen.getByTestId('input-kind')).toHaveTextContent('graph');
    expect(Number(screen.getByTestId('step-count').textContent)).toBeGreaterThan(0);
    expect(mocks.planLocalActions).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(mocks.askQuestion).toHaveBeenCalledWith(
        expect.stringContaining('successfully applied'),
        expect.objectContaining({
          algorithmName: 'Depth First Search (DFS)',
          currentIndex: 0,
        }),
        expect.any(Array),
      );
    });
  });

  it('shows planner feedback and leaves the workspace unchanged for a question', async () => {
    let releasePlan: ((value: string) => void) | undefined;
    mocks.planLocalActions.mockImplementation(() => new Promise<string>((resolve) => {
      releasePlan = resolve;
    }));
    const user = userEvent.setup();
    renderReadyAssistant();

    const input = await screen.findByRole('textbox');
    await user.type(input, 'DFS nedir?{Enter}');

    expect(await screen.findByText('Güvenli zaman çizelgesi planlanıyor…')).toBeInTheDocument();
    expect(screen.getByTestId('algorithm-name')).toHaveTextContent('Custom Code');
    releasePlan?.('{"actions":[]}');

    await waitFor(() => expect(mocks.askQuestion).toHaveBeenCalled());
    expect(screen.getByTestId('algorithm-name')).toHaveTextContent('Custom Code');
    expect(screen.getByTestId('source-code')).toBeEmptyDOMElement();
  });
});
