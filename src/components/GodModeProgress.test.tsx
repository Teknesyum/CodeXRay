import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ManagerPlanV2 } from '../types/webSource';
import { GodModeProgress } from './GodModeProgress';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('GodModeProgress timing', () => {
  it('shows live subagent reasoning in a muted collapsible disclosure', () => {
    const plan: ManagerPlanV2 = {
      version: 2,
      runId: 'reasoning-run',
      request: 'design',
      intent: 'solve-web-problem',
      createdAt: Date.now(),
      jobs: [{
        version: 2,
        id: 'architect-live',
        role: 'architect',
        label: 'Design contract',
        dependsOn: [],
        consumes: ['problem-spec'],
        produces: ['simulation-package'],
        resourceLocks: ['webgpu'],
        status: 'running',
        attempt: 1,
        maxAttempts: 1,
        reasoning: 'Checking the input contract in real time…',
      }],
    };

    render(
      <GodModeProgress
        plan={plan}
        locale="en"
        onCancel={() => undefined}
        onDismiss={() => undefined}
        onUndo={() => undefined}
        onRedo={() => undefined}
        onRetry={() => undefined}
        canUndo={false}
        canRedo={false}
      />,
    );

    const disclosure = screen.getByText('thinking').closest('details');
    expect(disclosure).toHaveAttribute('open');
    expect(disclosure).toHaveClass('live');
    expect(screen.getByText('Checking the input contract in real time…')).toBeVisible();
    fireEvent.click(screen.getByText('thinking'));
    expect(disclosure).not.toHaveAttribute('open');
  });

  it('shows a live elapsed duration on each started agent chip', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-01T20:00:00.000Z'));
    const plan: ManagerPlanV2 = {
      version: 2,
      runId: 'web-timing',
      request: 'solve',
      intent: 'solve-web-problem',
      createdAt: Date.now(),
      jobs: [{
        version: 2,
        id: 'java-author',
        role: 'code-author',
        label: 'Draft Java',
        dependsOn: [],
        consumes: ['problem-spec'],
        produces: ['java-solution'],
        resourceLocks: ['webgpu'],
        status: 'running',
        attempt: 1,
        maxAttempts: 2,
        startedAt: Date.now(),
      }],
    };

    render(
      <GodModeProgress
        plan={plan}
        locale="tr"
        onCancel={() => undefined}
        onDismiss={() => undefined}
        onUndo={() => undefined}
        onRedo={() => undefined}
        onRetry={() => undefined}
        canUndo={false}
        canRedo={false}
      />,
    );

    expect(screen.getByText('0.0s')).toBeVisible();
    await vi.advanceTimersByTimeAsync(1_250);
    expect(screen.getByText('1.3s')).toBeVisible();
  });

  it('keeps retry and dismiss controls available after a failed run', () => {
    const onRetry = vi.fn();
    const onDismiss = vi.fn();
    const plan: ManagerPlanV2 = {
      version: 2,
      runId: 'failed-run',
      request: 'solve',
      intent: 'solve-web-problem',
      createdAt: Date.now(),
      jobs: [{
        version: 2,
        id: 'java-author',
        role: 'code-author',
        label: 'Draft Java',
        dependsOn: [],
        consumes: ['problem-spec'],
        produces: ['java-solution'],
        resourceLocks: ['webgpu'],
        status: 'failed',
        attempt: 1,
        maxAttempts: 2,
        error: 'Invalid contract',
      }],
    };
    render(
      <GodModeProgress
        plan={plan}
        locale="tr"
        onCancel={() => undefined}
        onDismiss={onDismiss}
        onUndo={() => undefined}
        onRedo={() => undefined}
        onRetry={onRetry}
        canUndo={false}
        canRedo={false}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Başarısız ajan çalışmasını yeniden dene' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ajan çalışmasını kapat' }));
    expect(onRetry).toHaveBeenCalledOnce();
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
