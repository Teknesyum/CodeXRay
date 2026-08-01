import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TimelineProvider } from '../context/TimelineContext';
import {
  deleteLocalModel,
  getCachedLocalModels,
  initializeLocalAi,
  LOCAL_AI_MODELS,
  supportsLocalAi,
} from '../services/localAiService';
import { ControlBar } from './ControlBar';

vi.mock('../services/localAiService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/localAiService')>();
  return {
    ...actual,
    getCachedLocalModels: vi.fn().mockResolvedValue([]),
    getPersistentStorageStatus: vi.fn().mockResolvedValue(true),
    requestPersistentLocalAiStorage: vi.fn().mockResolvedValue(true),
    supportsLocalAi: vi.fn().mockResolvedValue(true),
    initializeLocalAi: vi.fn(),
    deleteLocalModel: vi.fn(),
  };
});

const Harness = () => (
  <TimelineProvider>
    <ControlBar
      onSimulate={() => undefined}
      onAnalyze={() => undefined}
      collapsed={false}
      onToggleCollapse={() => undefined}
    />
  </TimelineProvider>
);

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('codexray.locale', 'en');
  vi.mocked(supportsLocalAi).mockResolvedValue(true);
  vi.mocked(getCachedLocalModels).mockResolvedValue([]);
  vi.mocked(initializeLocalAi).mockReset();
  vi.mocked(deleteLocalModel).mockReset();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ControlBar local model lifecycle integration', () => {
  it('keeps deterministic controls usable and reports real progress before ready', async () => {
    let finishInitialization: () => void = () => undefined;
    vi.mocked(initializeLocalAi).mockImplementation(async (_model, _context, onProgress) => {
      onProgress({ progress: 0.88, timeElapsed: 6, text: 'Fetching param cache[7/8]' });
      onProgress({ progress: 0.72, timeElapsed: 8, text: 'Loading model from cache[5/8]' });
      await new Promise<void>((resolve) => {
        finishInitialization = resolve;
      });
    });

    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await user.click(screen.getByRole('button', { name: 'Load local model' }));

    const progress = await screen.findByRole('progressbar', { name: 'Model download progress' });
    expect(progress).toHaveAttribute('value', '91');
    expect(screen.getByText('Loading model from cache[5/8]')).toBeVisible();
    expect(screen.getByRole('button', { name: /Simulate/ })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Model ready' })).not.toBeInTheDocument();

    finishInitialization();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Model ready' })).toBeVisible());
    expect(screen.getByText(/Local model ready/)).toBeVisible();
  });

  it('shows a terminal error and never reports ready when initialization rejects', async () => {
    vi.mocked(initializeLocalAi).mockRejectedValue(new Error('GPU device lost'));
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await user.click(screen.getByRole('button', { name: 'Load local model' }));

    expect(await screen.findByText('GPU device lost')).toHaveClass('ai-status', 'error');
    expect(screen.queryByRole('button', { name: 'Model ready' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Load local model' })).toBeEnabled();
  });

  it('deletes only the selected cached model and returns the UI to an idle load state', async () => {
    const model = LOCAL_AI_MODELS[0];
    vi.mocked(getCachedLocalModels).mockResolvedValue([model.id]);
    vi.mocked(deleteLocalModel).mockResolvedValue();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Settings' }));

    const deleteButton = await screen.findByRole('button', {
      name: `Delete stored model ${model.label}`,
    });
    await user.click(deleteButton);

    expect(deleteLocalModel).toHaveBeenCalledWith(model.id);
    await waitFor(() => expect(screen.queryByRole('button', {
      name: `Delete stored model ${model.label}`,
    })).not.toBeInTheDocument());
    expect(screen.getByText('Stored model files deleted.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Load local model' })).toBeEnabled();
  });
});
