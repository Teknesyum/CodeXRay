import { useEffect } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TimelineProvider, useTimeline } from '../context/TimelineContext';
import { DynamicVisualizer } from './DynamicVisualizer';

const ModelLoadHarness = () => {
  const { setAiProgressPercent, setAiStatus } = useTimeline();

  useEffect(() => {
    const startLoading = () => {
      setAiProgressPercent(42);
      setAiStatus('loading');
    };
    window.addEventListener('codexray:loadModel', startLoading);
    return () => window.removeEventListener('codexray:loadModel', startLoading);
  }, [setAiProgressPercent, setAiStatus]);

  return (
    <button type="button" onClick={() => setAiStatus('ready')}>
      Complete model load
    </button>
  );
};

const PseudoProgressHarness = () => {
  const { setAiProgressPercent, setAiStatus } = useTimeline();

  useEffect(() => {
    const startLoading = () => {
      setAiProgressPercent(0);
      setAiStatus('loading');
    };
    window.addEventListener('codexray:loadModel', startLoading);
    return () => window.removeEventListener('codexray:loadModel', startLoading);
  }, [setAiProgressPercent, setAiStatus]);

  return (
    <button type="button" onClick={() => setAiProgressPercent(35)}>
      Set real progress
    </button>
  );
};

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('codexray.locale', 'tr');
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('DynamicVisualizer model loading notice', () => {
  it('shows loading feedback immediately and a translucent completion notice', async () => {
    const user = userEvent.setup();
    render(
      <TimelineProvider>
        <ModelLoadHarness />
        <DynamicVisualizer collapsed={false} onToggleCollapse={() => undefined} />
      </TimelineProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Yükle' }));
    const loadingNotice = await screen.findByRole('status');
    expect(loadingNotice).toHaveTextContent('Model yükleniyor…');
    expect(loadingNotice).toHaveTextContent('42%');
    expect(loadingNotice).toHaveClass('loading');

    await user.click(screen.getByRole('button', { name: 'Complete model load' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Model yüklendi.');
    expect(screen.getByRole('status')).toHaveClass('ready');
  });

  it('advances to twenty percent gradually while preferring higher real progress', async () => {
    vi.useFakeTimers();
    render(
      <TimelineProvider>
        <PseudoProgressHarness />
        <DynamicVisualizer collapsed={false} onToggleCollapse={() => undefined} />
      </TimelineProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: /Y.kle/ }));
    expect(screen.getByRole('status')).toHaveTextContent('0%');

    act(() => vi.advanceTimersByTime(900));
    expect(screen.getByRole('status')).toHaveTextContent('3%');

    fireEvent.click(screen.getByRole('button', { name: 'Set real progress' }));
    expect(screen.getByRole('status')).toHaveTextContent('35%');

    act(() => vi.advanceTimersByTime(10_000));
    expect(screen.getByRole('status')).toHaveTextContent('35%');
  });
});
