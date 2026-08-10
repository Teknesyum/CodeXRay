import { beforeEach, describe, expect, it, vi } from 'vitest';

const webLlm = vi.hoisted(() => ({
  createEngine: vi.fn(),
  hasCache: vi.fn(),
  deleteCache: vi.fn(),
  complete: vi.fn(),
  interrupt: vi.fn(),
}));

vi.mock('@mlc-ai/web-llm', () => ({
  CreateMLCEngine: webLlm.createEngine,
  hasModelInCache: webLlm.hasCache,
  deleteModelAllInfoInCache: webLlm.deleteCache,
  prebuiltAppConfig: { model_list: [] },
}));

interface WorkerOutput {
  id: number;
  type: string;
  text?: string;
  status?: string;
  phase?: 'reasoning' | 'answer';
  progress?: { progress: number; text: string };
}

const outputs = () => (self.postMessage as unknown as ReturnType<typeof vi.fn>).mock.calls
  .map(([message]) => message as WorkerOutput);

const send = (data: Record<string, unknown>) => {
  self.onmessage?.({ data } as MessageEvent);
};

const streamedCompletion = (text: string, finishReason = 'stop') => ({
  async *[Symbol.asyncIterator]() {
    yield {
      choices: [{ delta: { content: text }, finish_reason: null }],
      usage: undefined,
    };
    yield {
      choices: [{ delta: {}, finish_reason: finishReason }],
      usage: { prompt_tokens: 40, completion_tokens: 8, total_tokens: 48 },
    };
  },
});

const waitForOutput = async (predicate: (message: WorkerOutput) => boolean) => {
  await vi.waitFor(() => expect(outputs().some(predicate)).toBe(true));
};

const initialize = async (
  id = 1,
  contextWindow = 4096,
  model = 'Qwen2.5-Coder-0.5B-Instruct-q4f32_1-MLC',
) => {
  send({ id, type: 'initialize', model, contextWindow });
  await waitForOutput((message) => message.id === id && message.type === 'ready');
};

describe('local AI worker protocol', () => {
  beforeEach(async () => {
    vi.resetModules();
    webLlm.createEngine.mockReset();
    webLlm.hasCache.mockReset();
    webLlm.deleteCache.mockReset();
    webLlm.complete.mockReset();
    webLlm.interrupt.mockReset();
    Object.defineProperty(self, 'postMessage', { configurable: true, value: vi.fn() });
    webLlm.createEngine.mockImplementation(async (_model, options) => {
      options.initProgressCallback({ progress: 0.5, text: 'Loading weights' });
      return {
        chat: { completions: { create: webLlm.complete } },
        interruptGenerate: webLlm.interrupt,
      };
    });
    await import('./localAi.worker');
  });

  it('handles cache status, model deletion, initialization progress, and ready state', async () => {
    webLlm.hasCache.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    webLlm.deleteCache.mockResolvedValue(undefined);
    send({ id: 1, type: 'cache-status', model: 'cached-model' });
    send({ id: 2, type: 'cache-status', model: 'missing-model' });
    send({ id: 3, type: 'delete-model', model: 'cached-model' });
    await initialize(4, 32768);
    await waitForOutput((message) => message.id === 1 && message.text === 'cached');
    await waitForOutput((message) => message.id === 2 && message.text === 'not-cached');
    await waitForOutput((message) => message.id === 3 && message.type === 'model-deleted');
    expect(outputs()).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 4, type: 'progress', progress: { progress: 0.5, text: 'Loading weights' } }),
      expect.objectContaining({ id: 4, type: 'ready' }),
    ]));
    expect(webLlm.createEngine).toHaveBeenCalledWith(
      'Qwen2.5-Coder-0.5B-Instruct-q4f32_1-MLC',
      expect.objectContaining({
        appConfig: expect.objectContaining({ cacheBackend: 'cache' }),
        initProgressCallback: expect.any(Function),
      }),
      { context_window_size: 32768 },
    );
  });

  it('uses Cache API for local development and keeps OPFS for production origins', async () => {
    const { mergeContinuationText, selectLocalAiCacheBackend } = await import('./localAi.worker');
    expect(selectLocalAiCacheBackend('localhost', true)).toBe('cache');
    expect(selectLocalAiCacheBackend('127.0.0.1', true)).toBe('cache');
    expect(selectLocalAiCacheBackend('serkanozel.me', true)).toBe('opfs');
    expect(selectLocalAiCacheBackend('serkanozel.me', false)).toBe('cache');
    expect(mergeContinuationText(
      'Özet. Bu yöntem her adayı bir kez ziyaret eder ve tüm komşuları işaretler',
      'Bu yöntem her adayı bir kez ziyaret eder ve tüm komşuları işaretler. Sonuç doğrudur.',
    )).toBe('Özet. Bu yöntem her adayı bir kez ziyaret eder ve tüm komşuları işaretler. Sonuç doğrudur.');
  });

  it('serializes planner and schema-constrained specialist requests with bounded options', async () => {
    await initialize();
    webLlm.complete
      .mockResolvedValueOnce({ choices: [{ message: { content: '{"actions":[{"type":"jump","step":3}]' }, finish_reason: 'stop' }] })
      .mockResolvedValueOnce(streamedCompletion('{"passed":true}'));
    send({ id: 10, type: 'plan', question: 'step three', context: JSON.stringify({ steps: 8 }) });
    send({
      id: 11,
      type: 'agent-run',
      role: 'critic',
      instructions: 'Validate the supplied report.',
      context: '{"report":true}',
      locale: 'tr',
      responseSchema: { type: 'object', properties: { passed: { type: 'boolean' } }, required: ['passed'] },
      maxTokens: 300,
    });
    await waitForOutput((message) => message.id === 11 && message.type === 'answer');
    expect(outputs().filter((message) => message.status === 'queued').map((message) => message.id)).toEqual([10, 11]);
    expect(outputs().filter((message) => message.status === 'running').map((message) => message.id)).toEqual([10, 11]);
    const plannerOptions = webLlm.complete.mock.calls[0]?.[0];
    expect(plannerOptions).toMatchObject({ temperature: 0, enable_thinking: false, max_tokens: 160 });
    expect(JSON.parse(plannerOptions.response_format.schema).properties.actions.items.oneOf[0].properties.step.maximum).toBe(8);
    const agentOptions = webLlm.complete.mock.calls[1]?.[0];
    expect(agentOptions).toMatchObject({ temperature: 0, enable_thinking: false, max_tokens: 300 });
    expect(agentOptions.response_format.type).toBe('json_object');
    expect(agentOptions.messages[0].content).toContain('human-readable string field in Turkish');
  });

  it('releases the WebGPU queue before an immediate repair agent is submitted', async () => {
    await initialize();
    webLlm.complete
      .mockResolvedValueOnce(streamedCompletion('{"version":1,"invalid":true}'))
      .mockResolvedValueOnce(streamedCompletion('{"version":1,"repaired":true}'));

    send({
      id: 12,
      type: 'agent-run',
      role: 'code-author',
      instructions: 'Return the first candidate.',
      context: '{}',
      locale: 'en',
      jsonMode: true,
    });
    await waitForOutput((message) => message.id === 12 && message.type === 'answer');

    send({
      id: 13,
      type: 'agent-run',
      role: 'code-author',
      instructions: 'Repair the rejected candidate.',
      context: '{"errors":["invalid"]}',
      locale: 'en',
      jsonMode: true,
    });
    await waitForOutput((message) => message.id === 13 && message.type === 'answer');

    expect(outputs()).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 12, type: 'agent-event', status: 'running' }),
      expect.objectContaining({ id: 13, type: 'agent-event', status: 'running' }),
      expect.objectContaining({ id: 13, type: 'answer', text: '{"version":1,"repaired":true}' }),
    ]));
  });

  it('performs one bounded continuation and marks a still-truncated conversation honestly', async () => {
    await initialize();
    webLlm.complete
      .mockResolvedValueOnce({ choices: [{ message: { content: 'First half.' }, finish_reason: 'length' }] })
      .mockResolvedValueOnce({ choices: [{ message: { content: 'Second half.' }, finish_reason: 'length' }] });
    send({
      id: 20,
      type: 'generate',
      question: 'Explain the step.',
      context: 'CURRENT SNAPSHOT',
      history: [{ role: 'user', content: 'Earlier question' }, { role: 'ai', content: 'Earlier answer' }],
      locale: 'en',
    });
    await waitForOutput((message) => message.id === 20 && message.type === 'answer');
    const answer = outputs().find((message) => message.id === 20 && message.type === 'answer')?.text;
    expect(answer).toContain('First half.\n\nSecond half.');
    expect(answer).toContain('reached the local generation limit');
    expect(webLlm.complete).toHaveBeenCalledTimes(2);
    expect(webLlm.complete.mock.calls[1]?.[0].messages.at(-1).content).toContain('Continue exactly where it stopped');
  });

  it('publishes WebLLM conversation deltas before the final answer', async () => {
    await initialize(24);
    webLlm.complete.mockResolvedValueOnce(streamedCompletion('Canlı cevap.'));
    send({
      id: 24,
      type: 'generate',
      question: 'Canlı anlat.',
      context: 'CURRENT SNAPSHOT',
      history: [],
      locale: 'tr',
    });

    await waitForOutput((message) => message.id === 24 && message.type === 'answer');
    const deltaIndex = outputs().findIndex((message) =>
      message.id === 24 && message.type === 'stream-delta' && message.text === 'Canlı cevap.');
    const answerIndex = outputs().findIndex((message) => message.id === 24 && message.type === 'answer');
    expect(deltaIndex).toBeGreaterThanOrEqual(0);
    expect(deltaIndex).toBeLessThan(answerIndex);
  });

  it('disables reasoning narration and expands strict JSON budgets for DeepSeek R1', async () => {
    await initialize(21, 4096, 'DeepSeek-R1-Distill-Qwen-7B-q4f16_1-MLC');
    webLlm.complete
      .mockResolvedValueOnce({ choices: [{ message: { content: 'Doğrudan yanıt.' }, finish_reason: 'stop' }] })
      .mockResolvedValueOnce(streamedCompletion('{"version":1}'));
    send({
      id: 22,
      type: 'generate',
      question: 'Kısa cevap ver.',
      context: 'CURRENT SNAPSHOT',
      history: [],
      locale: 'tr',
    });
    send({
      id: 23,
      type: 'agent-run',
      role: 'architect',
      instructions: 'Return a contract.',
      context: '{}',
      locale: 'tr',
      responseSchema: { type: 'object' },
      maxTokens: 520,
    });
    await waitForOutput((message) => message.id === 23 && message.type === 'answer');

    const conversationOptions = webLlm.complete.mock.calls[0]?.[0];
    expect(conversationOptions).toMatchObject({ enable_thinking: false, max_tokens: 1400 });
    expect(conversationOptions.messages[0].content).toContain('Do not emit private reasoning');
    const architectOptions = webLlm.complete.mock.calls[1]?.[0];
    expect(architectOptions).toMatchObject({ enable_thinking: false, max_tokens: 1100 });
  });

  it('shortens oversized specialist context before inference on the stable 4K profile', async () => {
    await initialize();
    webLlm.complete.mockResolvedValueOnce(streamedCompletion('bounded'));
    send({
      id: 25,
      type: 'agent-run',
      role: 'architect',
      instructions: 'Review the current algorithm.',
      context: `REQUEST:first\n${'workspace-trace '.repeat(2_000)}\nFINAL:result`,
      locale: 'en',
      maxTokens: 520,
    });
    await waitForOutput((message) => message.id === 25 && message.type === 'answer');
    const options = webLlm.complete.mock.calls.at(-1)?.[0];
    const boundedContext = options.messages[1].content as string;
    expect(boundedContext).toContain('REQUEST:first');
    expect(boundedContext).toContain('FINAL:result');
    expect(boundedContext).toContain('context shortened');
    expect(boundedContext.length).toBeLessThan(7_000);
  });

  it('interrupts an active request and rejects its late answer', async () => {
    await initialize();
    let resolveCompletion!: (value: unknown) => void;
    webLlm.complete.mockReturnValueOnce(new Promise((resolve) => { resolveCompletion = resolve; }));
    send({ id: 30, type: 'agent-run', role: 'tutor', instructions: 'Explain.', context: '{}', locale: 'en' });
    await waitForOutput((message) => message.id === 30 && message.status === 'running');
    send({ id: 30, type: 'agent-cancel' });
    expect(webLlm.interrupt).toHaveBeenCalledOnce();
    resolveCompletion(streamedCompletion('Late answer'));
    await waitForOutput((message) => message.id === 30 && message.type === 'error');
    expect(outputs()).toContainEqual(expect.objectContaining({ id: 30, type: 'agent-event', status: 'cancelled' }));
    expect(outputs().some((message) => message.id === 30 && message.type === 'answer')).toBe(false);
  });

  it('reports unloaded-engine and administrative failures without locking the protocol', async () => {
    send({ id: 40, type: 'plan', question: 'play', context: '{"steps":2}' });
    await waitForOutput((message) => message.id === 40 && message.type === 'error');
    webLlm.hasCache.mockRejectedValueOnce(new Error('Cache unavailable'));
    send({ id: 41, type: 'cache-status', model: 'broken' });
    await waitForOutput((message) => message.id === 41 && message.type === 'error');
    expect(outputs().find((message) => message.id === 40)?.text).toContain('not been loaded');
    expect(outputs().find((message) => message.id === 41)?.text).toBe('Cache unavailable');
  });
});
