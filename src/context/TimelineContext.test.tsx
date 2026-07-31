import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SimulationStep } from '../types/simulation';
import { TimelineProvider, useTimeline } from './TimelineContext';

const steps: SimulationStep[] = Array.from({ length: 4 }, (_, index) => ({
  lineNumber: index + 1,
  explanation: `Step ${index + 1}`,
  visualData: { type: 'variables', vars: { index } },
}));

const Probe = () => {
  const timeline = useTimeline();
  return (
    <div>
      <output aria-label="index">{timeline.currentIndex}</output>
      <output aria-label="playing">{String(timeline.isPlaying)}</output>
      <output aria-label="speed">{timeline.speed}</output>
      <output aria-label="theme">{timeline.theme}</output>
      <output aria-label="locale">{timeline.locale}</output>
      <output aria-label="radio-minimize">{timeline.radioMinimizeSeconds}</output>
      <output aria-label="pins">{timeline.pinnedVariables.join(',')}</output>
      <output aria-label="algorithm">{timeline.algorithmName}</output>
      <output aria-label="undo">{String(timeline.canUndoWorkspace)}</output>
      <output aria-label="redo">{String(timeline.canRedoWorkspace)}</output>
      <button onClick={() => timeline.setSteps(steps)}>steps</button>
      <button onClick={timeline.stepForward}>next</button>
      <button onClick={timeline.stepBackward}>previous</button>
      <button onClick={() => timeline.jumpTo(2)}>jump-valid</button>
      <button onClick={() => timeline.jumpTo(99)}>jump-invalid</button>
      <button onClick={timeline.play}>play</button>
      <button onClick={timeline.pause}>pause</button>
      <button onClick={() => timeline.setSpeed(50)}>speed-50</button>
      <button onClick={() => timeline.setSpeed(100)}>speed-100</button>
      <button onClick={() => timeline.togglePinnedVariable('queue')}>pin-queue</button>
      <button onClick={() => timeline.applyPresetTransaction({
        algorithmName: 'Regression Preset',
        code: 'return 1;',
        input: { kind: 'array', text: '[1]' },
        steps,
        analysis: 'O(1)',
      }, 'test-run')}>apply-preset</button>
      <button onClick={timeline.undoWorkspaceTransaction}>undo-workspace</button>
      <button onClick={timeline.redoWorkspaceTransaction}>redo-workspace</button>
    </div>
  );
};

const renderTimeline = () => render(<TimelineProvider><Probe /></TimelineProvider>);

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('TimelineProvider integration', () => {
  it('moves exactly one step and ignores invalid direct jumps', () => {
    renderTimeline();
    fireEvent.click(screen.getByRole('button', { name: 'steps' }));
    fireEvent.click(screen.getByRole('button', { name: 'next' }));
    expect(screen.getByLabelText('index')).toHaveTextContent('1');
    fireEvent.click(screen.getByRole('button', { name: 'jump-valid' }));
    expect(screen.getByLabelText('index')).toHaveTextContent('2');
    fireEvent.click(screen.getByRole('button', { name: 'jump-invalid' }));
    expect(screen.getByLabelText('index')).toHaveTextContent('2');
    fireEvent.click(screen.getByRole('button', { name: 'previous' }));
    expect(screen.getByLabelText('index')).toHaveTextContent('1');
  });

  it('plays to the final step and stops there', () => {
    vi.useFakeTimers();
    renderTimeline();
    fireEvent.click(screen.getByRole('button', { name: 'steps' }));
    fireEvent.click(screen.getByRole('button', { name: 'speed-50' }));
    fireEvent.click(screen.getByRole('button', { name: 'play' }));
    expect(screen.getByLabelText('playing')).toHaveTextContent('true');
    act(() => vi.advanceTimersByTime(250));
    expect(screen.getByLabelText('index')).toHaveTextContent('3');
    expect(screen.getByLabelText('playing')).toHaveTextContent('false');
  });

  it('replaces the playback interval when speed changes without skipping a step', () => {
    vi.useFakeTimers();
    renderTimeline();
    fireEvent.click(screen.getByRole('button', { name: 'steps' }));
    fireEvent.click(screen.getByRole('button', { name: 'speed-100' }));
    fireEvent.click(screen.getByRole('button', { name: 'play' }));
    act(() => vi.advanceTimersByTime(100));
    expect(screen.getByLabelText('index')).toHaveTextContent('1');
    fireEvent.click(screen.getByRole('button', { name: 'speed-50' }));
    act(() => vi.advanceTimersByTime(50));
    expect(screen.getByLabelText('index')).toHaveTextContent('2');
  });

  it('loads only valid persisted preferences and repairs corrupt values', () => {
    localStorage.setItem('codexray.theme', 'broken-theme');
    localStorage.setItem('codexray.locale', 'de');
    localStorage.setItem('codexray.radio.minimizeSeconds', 'NaN');
    renderTimeline();
    expect(screen.getByLabelText('theme')).toHaveTextContent('neon');
    expect(screen.getByLabelText('locale')).toHaveTextContent('tr');
    expect(screen.getByLabelText('radio-minimize')).toHaveTextContent('4');
    expect(document.documentElement.dataset.theme).toBe('neon');
  });

  it('still mounts when browser storage reads are unavailable', () => {
    vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new Error('storage denied');
    });
    expect(() => renderTimeline()).not.toThrow();
    expect(screen.getByLabelText('theme')).toHaveTextContent('neon');
  });

  it('persists top-level pins and toggles them without duplicates', () => {
    renderTimeline();
    fireEvent.click(screen.getByRole('button', { name: 'pin-queue' }));
    expect(screen.getByLabelText('pins')).toHaveTextContent('queue');
    expect(localStorage.getItem('codexray.pinned-variables.v1')).toBe('["queue"]');
    fireEvent.click(screen.getByRole('button', { name: 'pin-queue' }));
    expect(screen.getByLabelText('pins')).toBeEmptyDOMElement();
  });

  it('applies preset changes transactionally and supports undo and redo', () => {
    renderTimeline();
    fireEvent.click(screen.getByRole('button', { name: 'apply-preset' }));
    expect(screen.getByLabelText('algorithm')).toHaveTextContent('Regression Preset');
    expect(screen.getByLabelText('undo')).toHaveTextContent('true');
    fireEvent.click(screen.getByRole('button', { name: 'undo-workspace' }));
    expect(screen.getByLabelText('algorithm')).toHaveTextContent('Custom Code');
    expect(screen.getByLabelText('redo')).toHaveTextContent('true');
    fireEvent.click(screen.getByRole('button', { name: 'redo-workspace' }));
    expect(screen.getByLabelText('algorithm')).toHaveTextContent('Regression Preset');
  });
});
