import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ManagerPlanV2 } from '../types/webSource';
import { GodModeProgress } from './GodModeProgress';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('GodModeProgress timing', () => {
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
});
