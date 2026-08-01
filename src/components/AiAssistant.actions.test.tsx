import { useEffect } from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TimelineProvider, useTimeline } from '../context/TimelineContext';
import { loadLatestGodModePlan, persistGodModePlan } from '../services/godModeRunStore';
import type { ManagerPlanV1 } from '../types/godMode';
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
  sessionStorage.clear();
  mocks.askQuestion.mockReset().mockResolvedValue('DFS çalışma alanı hazır.');
  mocks.planLocalActions.mockReset().mockResolvedValue('{"actions":[]}');
});

afterEach(() => {
  cleanup();
  Object.defineProperty(document, 'execCommand', { configurable: true, value: undefined });
});

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

  it('renders the completed Markdown answer atomically without a duplicate partial message', async () => {
    let releaseAnswer: ((value: string) => void) | undefined;
    mocks.askQuestion.mockImplementation(() => new Promise<string>((resolve) => {
      releaseAnswer = resolve;
    }));
    const user = userEvent.setup();
    const { container } = renderReadyAssistant();

    const input = await screen.findByRole('textbox');
    await user.type(input, 'Çözümü anlat{Enter}');
    expect(await screen.findByText('Yerel olarak düşünüyor…')).toBeVisible();
    expect(container.querySelectorAll('.chat-message.ai-msg')).toHaveLength(1);

    releaseAnswer?.('**Türkçe yanıt**\n\nİki kısa adım.');
    expect(await screen.findByText('Türkçe yanıt')).toBeVisible();
    await waitFor(() => expect(container.querySelectorAll('.chat-message.ai-msg.typing')).toHaveLength(0));
    expect(container.querySelectorAll('.chat-message.ai-msg')).toHaveLength(1);
  });

  it('reports clipboard permission failures instead of failing silently', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('Clipboard permission denied'));
    const user = userEvent.setup();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    mocks.askQuestion.mockResolvedValue('Kopyalanacak Türkçe yanıt.');
    renderReadyAssistant();

    const input = await screen.findByRole('textbox');
    await user.type(input, 'Yanıt ver{Enter}');
    await screen.findByText('Kopyalanacak Türkçe yanıt.');
    await user.click(screen.getByRole('button', { name: 'AI cevabını kopyala' }));

    expect(writeText).toHaveBeenCalledWith('Kopyalanacak Türkçe yanıt.');
    expect(await screen.findByText('Kopyalanamadı. Pano izni verip yeniden deneyin.'))
      .toHaveClass('copy-response-feedback', 'error');
  });

  it('falls back to the legacy copy command when Clipboard API permission is denied', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('Clipboard permission denied'));
    const execCommand = vi.fn().mockReturnValue(true);
    const user = userEvent.setup();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: execCommand,
    });
    mocks.askQuestion.mockResolvedValue('Fallback ile kopyalanacak yanıt.');
    renderReadyAssistant();

    const input = await screen.findByRole('textbox');
    await user.type(input, 'Yanıt ver{Enter}');
    await screen.findByText('Fallback ile kopyalanacak yanıt.');
    await user.click(screen.getByRole('button', { name: 'AI cevabını kopyala' }));

    expect(writeText).toHaveBeenCalled();
    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(await screen.findByText('AI cevabı kopyalandı')).toHaveClass('copy-response-feedback');
  });

  it('clears a persisted failed God Mode bar with the conversation trash button', async () => {
    const plan: ManagerPlanV1 = {
      version: 1,
      runId: 'failed-architect',
      request: '2d dp yaz simüle et',
      intent: 'create-algorithm',
      createdAt: Date.now(),
      jobs: [{
        id: 'architect-design-algorithm-contract',
        role: 'architect',
        label: 'Design contract',
        dependsOn: [],
        weight: 100,
        status: 'failed',
        attempt: 1,
        maxAttempts: 1,
        error: 'Invalid contract',
      }],
    };
    persistGodModePlan(plan);
    const user = userEvent.setup();
    renderReadyAssistant();

    expect(await screen.findByText('Invalid contract')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Konuşma hafızasını temizle' }));
    await waitFor(() => expect(screen.queryByText('Invalid contract')).not.toBeInTheDocument());
    expect(loadLatestGodModePlan()).toBeNull();
  });
});
