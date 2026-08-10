import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AiConnectionProfileV1, DesktopCompletionResult } from '../types/aiProvider';

const desktop = vi.hoisted(() => ({
  cancel: vi.fn().mockResolvedValue(undefined),
  list: vi.fn().mockResolvedValue([]),
  probe: vi.fn(),
  run: vi.fn(),
}));

vi.mock('./desktopAiService', () => ({
  cancelDesktopCompletion: desktop.cancel,
  listDesktopModels: desktop.list,
  probeDesktopModel: desktop.probe,
  runDesktopCompletion: desktop.run,
}));

import {
  connectExternalAi,
  resetLocalAi,
  runLocalAgentDetailed,
} from './localAiService';

const profile: AiConnectionProfileV1 = {
  version: 1,
  id: 'reasoning-fixture',
  name: 'Reasoning fixture',
  provider: 'openai-compatible',
  baseUrl: 'http://127.0.0.1:8888/v1',
  model: 'reasoning-model',
  contextWindow: 65536,
  maxOutputTokens: 16384,
  capabilities: null,
};

const completion = (
  text: string,
  reasoning: string,
  finishReason: string,
): DesktopCompletionResult => ({
  text,
  reasoning,
  finishReason,
  model: profile.model,
  promptTokens: 100,
  completionTokens: 10,
  reasoningTokens: reasoning ? 10 : 0,
  queueMs: 0,
  firstTokenMs: 5,
  inferenceMs: 20,
  schemaMode: 'json-object',
});

describe('external reasoning agent budgets', () => {
  beforeEach(async () => {
    desktop.run.mockReset();
    desktop.probe.mockResolvedValue({
      normalizedBaseUrl: profile.baseUrl,
      capabilities: {
        chat: true,
        streaming: true,
        structuredOutput: 'native',
        advancedWorkflows: true,
        checkedAt: 1,
        probeVersion: 1,
      },
    });
    await connectExternalAi(profile, 'session-only-token');
  });

  afterEach(() => resetLocalAi());

  it('scales a 64K structured agent and retries a reasoning-only length stop', async () => {
    desktop.run
      .mockResolvedValueOnce(completion('', 'bounded hidden trace', 'length'))
      .mockResolvedValueOnce(completion('{"version":1}', 'short trace', 'stop'));

    const progress = vi.fn();
    const handle = runLocalAgentDetailed({
      role: 'architect',
      instructions: 'Design the contract.',
      context: 'bounded workspace',
      locale: 'en',
      jsonMode: true,
      maxTokens: 520,
    }, progress);

    await expect(handle.promise).resolves.toMatchObject({ text: '{"version":1}' });
    expect(desktop.run).toHaveBeenCalledTimes(2);
    expect(desktop.run.mock.calls[0][0]).toMatchObject({ maxTokens: 8192 });
    expect(desktop.run.mock.calls[1][0]).toMatchObject({ maxTokens: 16384 });
    expect(desktop.run.mock.calls[1][0].messages.at(-1)?.content).toContain('final JSON object now');
    expect(progress).toHaveBeenCalledWith(expect.objectContaining({
      status: 'running',
      text: expect.stringContaining('Retrying with 16384 tokens'),
    }));
  });
});
