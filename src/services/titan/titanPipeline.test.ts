import { describe, expect, it, vi } from 'vitest';
import { executeTitanPipeline, type TitanStageState } from './titanPipeline';

describe('five-stage Titan pipeline', () => {
  it('emits five ordered stages, skips sufficient semantics, and applies once', async () => {
    const events: TitanStageState[] = [];
    const apply = vi.fn();
    const result = await executeTitanPipeline({
      route: () => ({ intent: 'trace-code' }),
      produce: () => ({ trace: [1, 2, 3] }),
      verify: () => ({ ok: true }),
      apply,
      onStage: (stage) => events.push(stage),
    });
    expect(result.stages.map((stage) => [stage.id, stage.status])).toEqual([
      ['route', 'completed'],
      ['produce', 'completed'],
      ['semantics', 'skipped'],
      ['verify', 'completed'],
      ['apply', 'completed'],
    ]);
    expect(events.some((stage) => stage.id === 'semantics' && stage.status === 'skipped')).toBe(true);
    expect(apply).toHaveBeenCalledOnce();
  });

  it('preserves committed state when verification fails', async () => {
    const committed = { id: 'working-package' };
    const apply = vi.fn((artifact: { id: string }) => { committed.id = artifact.id; });
    await expect(executeTitanPipeline({
      route: () => 'trace-code',
      produce: () => ({ id: 'candidate' }),
      verify: () => ({ ok: false, reason: 'Trace gate failed.' }),
      apply,
    })).rejects.toThrow('Trace gate failed.');
    expect(committed.id).toBe('working-package');
    expect(apply).not.toHaveBeenCalled();
  });

  it.each(['route', 'produce', 'apply'] as const)('stops visibly when %s fails', async (failure) => {
    const applied = vi.fn();
    await expect(executeTitanPipeline({
      route: () => {
        if (failure === 'route') throw new Error('route failed');
        return 'trace-code';
      },
      produce: () => {
        if (failure === 'produce') throw new Error('produce failed');
        return { trace: [1] };
      },
      verify: () => ({ ok: true }),
      apply: () => {
        if (failure === 'apply') throw new Error('apply failed');
        applied();
      },
    })).rejects.toThrow(`${failure} failed`);
    if (failure !== 'apply') expect(applied).not.toHaveBeenCalled();
  });

  it('exposes cancellation before apply', async () => {
    const controller = new AbortController();
    const applied = vi.fn();
    await expect(executeTitanPipeline({
      route: () => 'trace-code',
      produce: () => {
        controller.abort();
        return { trace: [1] };
      },
      verify: () => ({ ok: true }),
      apply: applied,
      signal: controller.signal,
    })).rejects.toThrow('cancelled');
    expect(applied).not.toHaveBeenCalled();
  });
});
