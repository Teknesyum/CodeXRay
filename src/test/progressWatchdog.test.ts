import { describe, expect, it, vi } from 'vitest';
import {
  waitForProgressTerminalState,
  type ProgressWatchdogSnapshot,
} from './progressWatchdog';

const createClock = () => {
  let current = 0;
  return {
    now: () => current,
    sleep: async (milliseconds: number) => {
      current += milliseconds;
    },
  };
};

describe('progress inactivity watchdog', () => {
  it('resets the inactivity window only when observable progress changes', async () => {
    const snapshots: ProgressWatchdogSnapshot[] = [
      { progress: 0, status: 'Starting' },
      { progress: 0, status: 'Starting' },
      { progress: 12, status: 'Downloading shard 1' },
      { progress: 12, status: 'Downloading shard 1' },
      { progress: 100, status: 'Model ready', terminal: 'ready' },
    ];
    const clock = createClock();
    const onChange = vi.fn();

    const result = await waitForProgressTerminalState({
      readSnapshot: async () => snapshots.shift() ?? snapshots.at(-1)!,
      inactivityTimeoutMs: 250,
      pollIntervalMs: 100,
      now: clock.now,
      sleep: clock.sleep,
      onChange,
    });

    expect(result).toEqual({ progress: 100, status: 'Model ready', terminal: 'ready' });
    expect(onChange).toHaveBeenCalledTimes(3);
  });

  it('fails with the last observation and bounded change history after inactivity', async () => {
    const clock = createClock();

    await expect(waitForProgressTerminalState({
      readSnapshot: async () => ({ progress: 37, status: 'Loading shard 3' }),
      inactivityTimeoutMs: 300,
      pollIntervalMs: 100,
      now: clock.now,
      sleep: clock.sleep,
    })).rejects.toThrow(
      'No model initialization progress for 300ms. Last observation: 37% — Loading shard 3. Changes: 0ms: 37% — Loading shard 3',
    );
  });

  it('returns explicit failure terminals without waiting for the inactivity deadline', async () => {
    const clock = createClock();
    const result = await waitForProgressTerminalState({
      readSnapshot: async () => ({
        progress: null,
        status: 'WebGPU device lost',
        terminal: 'failed',
      }),
      inactivityTimeoutMs: 300,
      pollIntervalMs: 100,
      now: clock.now,
      sleep: clock.sleep,
    });

    expect(result.terminal).toBe('failed');
  });
});
