import { expect, test } from '@playwright/test';

test('translates a reviewed Java web solution into a verified simulation badge', async ({ page }) => {
  const readerRequests: Array<{ url: string; postData: string }> = [];
  await page.addInitScript(() => {
    localStorage.setItem('codexray.locale', 'en');
    localStorage.setItem('codexray.ai.autoLoad', 'true');
    localStorage.setItem('codexray.ai-model.v1', 'Qwen2.5-Coder-7B-Instruct-q4f16_1-MLC');
    localStorage.setItem('codexray.radio.autoplay', 'false');
    Object.defineProperty(navigator, 'gpu', { configurable: true, value: { requestAdapter: async () => ({}) } });
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: { persist: async () => true, persisted: async () => true },
    });
    const lite = [
      'program "translated_scan" "Translated Pair Scan" en array',
      'budgets 200 20 4 50',
      'entry',
      '  declare s1 values @array',
      '  trace s2 "s1" "Read verified translated input." result 1',
      '  return s3 (len $values)',
      'end',
    ].join('\n');
    const detailed = (text: string) => ({
      version: 2,
      text,
      finishReason: 'stop',
      model: 'mock-model',
      contextWindow: 4096,
      promptTokens: 100,
      completionTokens: 50,
      queueMs: 1,
      firstTokenMs: 1,
      inferenceMs: 2,
      schemaMode: 'json-schema',
    });
    class TranslationWorker {
      onmessage: ((event: MessageEvent) => void) | null = null;
      private listeners = new Set<(event: MessageEvent) => void>();
      addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
        if (type === 'message' && typeof listener === 'function') this.listeners.add(listener as (event: MessageEvent) => void);
      }
      removeEventListener(type: string, listener: EventListenerOrEventListenerObject) {
        if (type === 'message' && typeof listener === 'function') this.listeners.delete(listener as (event: MessageEvent) => void);
      }
      private emit(data: object) {
        const event = new MessageEvent('message', { data });
        this.onmessage?.(event);
        this.listeners.forEach((listener) => listener(event));
      }
      postMessage(message: { id: number; type: string; role?: string }) {
        queueMicrotask(() => {
          if (message.type === 'cache-status') return this.emit({ id: message.id, type: 'cache-status', text: 'cached' });
          if (message.type === 'initialize') return this.emit({ id: message.id, type: 'ready', text: 'mock-model' });
          if (message.type !== 'agent-run') return;
          if (message.role === 'code-author') {
            const text = JSON.stringify({
              version: 1,
              title: 'Reviewed Pair Scan',
              code: 'class Solution { public int solve(int[][] grid) { return grid.length; } }',
              explanation: 'Read the finite input. Its length is the deterministic result.',
              complexity: { time: 'O(n)', space: 'O(1)' },
            });
            return this.emit({
            id: message.id,
            type: 'answer',
              text,
              result: detailed(text),
            });
          }
          if (message.role === 'critic') {
            const text = JSON.stringify({ version: 1, passed: true, summary: 'The candidate matches the fixture.', findings: [] });
            return this.emit({
            id: message.id,
            type: 'answer',
              text,
              result: detailed(text),
            });
          }
          if (message.role === 'compiler') {
            const text = JSON.stringify({
              version: 1,
              title: 'Translated Pair Scan',
              attempts: [[lite]],
              input: { version: 1, kind: 'array', description: 'Finite translated input', constraints: [], value: { kind: 'array', text: '[3,1,2]' }, origin: 'agent' },
              visualization: { version: 1, type: 'variables', activeVariables: [], queuedVariables: [], visitedVariables: [] },
              analysis: 'O(n) time and O(1) auxiliary space.',
            });
            return this.emit({
            id: message.id,
            type: 'answer',
              text,
              result: detailed(text),
            });
          }
          return this.emit({ id: message.id, type: 'answer', text: 'ok' });
        });
      }
      terminate() { this.listeners.clear(); }
    }
    Object.defineProperty(window, 'Worker', { configurable: true, value: TranslationWorker });
  });

  await page.route('**/api/codexray/read-url', async (route) => {
    readerRequests.push({
      url: route.request().url(),
      postData: route.request().postData() ?? '',
    });
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        version: 1,
        requestId: 'translation-e2e',
        document: {
          version: 1,
          id: 'translation-source',
          requestedUrl: 'https://example.com/matrix-scan',
          finalUrl: 'https://example.com/matrix-scan',
          title: 'Matrix Scan',
          contentType: 'text/html',
          provider: 'generic-html',
          retrievedAt: '2026-08-25T00:00:00.000Z',
          contentHash: 'translation-source-hash',
          truncated: false,
          warnings: [],
          segments: [
            { id: 'description', kind: 'statement', text: 'Return the number of rows in the matrix.' },
            { id: 'signature', kind: 'signature', text: 'public int solve(int[][] grid)' },
            { id: 'example', kind: 'example', text: 'Input: [[1],[2],[3]] Output: 3' },
          ],
        },
      }),
    });
  });

  await page.goto('/');
  const chat = page.getByPlaceholder('Type your question here...');
  await expect(chat).toBeEnabled();
  await chat.fill('Solve https://example.com/matrix-scan and simulate it');
  await chat.press('Enter');

  await expect(page.getByText('Translated from JAVA · deterministically verified')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Translated Pair Scan' })).toBeVisible();
  await expect(page.locator('.step-explanation')).toContainText('verified translated input');
  for (const stage of ['Route', 'Produce', 'Semantics', 'Verify', 'Apply']) {
    await expect(page.getByText(stage, { exact: true })).toBeVisible();
  }
  expect(readerRequests).toHaveLength(1);
  expect(`${readerRequests[0].url}\n${readerRequests[0].postData}`).toContain('https://example.com/matrix-scan');
  expect(readerRequests[0].postData).not.toContain('Reviewed Pair Scan');
  expect(readerRequests[0].postData).not.toContain('[3,1,2]');
});

test('shows a refused Java fallback without changing workspace or persisted bound source', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('codexray.locale', 'en');
    localStorage.setItem('codexray.ai.autoLoad', 'true');
    localStorage.setItem('codexray.ai-model.v1', 'Qwen2.5-Coder-7B-Instruct-q4f16_1-MLC');
    localStorage.setItem('codexray.radio.autoplay', 'false');
    Object.defineProperty(navigator, 'gpu', { configurable: true, value: { requestAdapter: async () => ({}) } });
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: { persist: async () => true, persisted: async () => true },
    });
    const detailed = (text: string) => ({
      version: 2,
      text,
      finishReason: 'stop',
      model: 'mock-model',
      contextWindow: 4096,
      promptTokens: 100,
      completionTokens: 50,
      queueMs: 1,
      firstTokenMs: 1,
      inferenceMs: 2,
      schemaMode: 'json-schema',
    });
    class RefusingTranslationWorker {
      onmessage: ((event: MessageEvent) => void) | null = null;
      private listeners = new Set<(event: MessageEvent) => void>();
      addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
        if (type === 'message' && typeof listener === 'function') this.listeners.add(listener as (event: MessageEvent) => void);
      }
      removeEventListener(type: string, listener: EventListenerOrEventListenerObject) {
        if (type === 'message' && typeof listener === 'function') this.listeners.delete(listener as (event: MessageEvent) => void);
      }
      private emit(data: object) {
        const event = new MessageEvent('message', { data });
        this.onmessage?.(event);
        this.listeners.forEach((listener) => listener(event));
      }
      postMessage(message: { id: number; type: string; role?: string }) {
        queueMicrotask(() => {
          if (message.type === 'cache-status') return this.emit({ id: message.id, type: 'cache-status', text: 'cached' });
          if (message.type === 'initialize') return this.emit({ id: message.id, type: 'ready', text: 'mock-model' });
          if (message.type !== 'agent-run') return;
          if (message.role === 'code-author') {
            const text = JSON.stringify({
              version: 1,
              title: 'Rejected Java',
              code: 'class Solution { public int solve(int[][] grid) { return 0; } }',
              explanation: 'Return a value. The draft is reviewed locally.',
              complexity: { time: 'O(1)', space: 'O(1)' },
            });
            return this.emit({ id: message.id, type: 'answer', text, result: detailed(text) });
          }
          if (message.role === 'critic') {
            const text = JSON.stringify({ version: 1, passed: true, summary: 'The mock critic accepted the draft.', findings: [] });
            return this.emit({ id: message.id, type: 'answer', text, result: detailed(text) });
          }
          if (message.role === 'compiler') {
            const text = JSON.stringify({
              version: 1,
              title: 'Rejected Translation',
              attempts: [['program "broken" "Broken" en array\nentry\n  unsupported instruction\nend']],
              input: { version: 1, kind: 'array', description: 'Rejected input', constraints: [], value: { kind: 'array', text: '[3,1,2]' }, origin: 'agent' },
              visualization: { version: 1, type: 'variables', activeVariables: [], queuedVariables: [], visitedVariables: [] },
              analysis: 'This invalid translation must never commit.',
            });
            return this.emit({ id: message.id, type: 'answer', text, result: detailed(text) });
          }
        });
      }
      terminate() { this.listeners.clear(); }
    }
    Object.defineProperty(window, 'Worker', { configurable: true, value: RefusingTranslationWorker });
  });

  await page.route('**/api/codexray/read-url', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        version: 1,
        requestId: 'translation-refusal-e2e',
        document: {
          version: 1,
          id: 'translation-refusal-source',
          requestedUrl: 'https://example.com/refused-matrix-scan',
          finalUrl: 'https://example.com/refused-matrix-scan',
          title: 'Refused Matrix Scan',
          contentType: 'text/html',
          provider: 'generic-html',
          retrievedAt: '2026-08-28T00:00:00.000Z',
          contentHash: 'translation-refusal-source-hash',
          truncated: false,
          warnings: [],
          segments: [
            { id: 'description', kind: 'statement', text: 'Return the number of rows in the matrix.' },
            { id: 'signature', kind: 'signature', text: 'public int solve(int[][] grid)' },
            { id: 'example', kind: 'example', text: 'Input: [[1],[2],[3]] Output: 3' },
          ],
        },
      }),
    });
  });

  await page.goto('/');
  const chat = page.getByPlaceholder('Type your question here...');
  await expect(chat).toBeEnabled();
  await chat.fill('Read https://example.com/refused-matrix-scan');
  await chat.press('Enter');
  await expect(page.getByLabel('Bound web source').getByText('Refused Matrix Scan')).toBeVisible();

  const preset = page.getByLabel('Algorithm preset');
  const input = page.getByRole('textbox', { name: 'Array Simulation Input:' });
  const stepExplanation = page.locator('.step-explanation');
  const stepCount = await stepExplanation.count();
  const workspaceBefore = {
    preset: await preset.inputValue(),
    input: await input.inputValue(),
    stepCount,
    step: stepCount ? await stepExplanation.textContent() : null,
  };
  const storageBefore = await page.evaluate(() => Object.fromEntries(
    Object.keys(localStorage)
      .filter((key) => key.startsWith('codexray.'))
      .sort()
      .map((key) => [key, localStorage.getItem(key)]),
  ));

  await chat.fill('Solve this problem');
  await chat.press('Enter');
  await expect(page.getByText(/Translation verification failed/)).toBeVisible();
  await expect(page.getByText('Translated from JAVA · deterministically verified')).toHaveCount(0);
  await expect(preset).toHaveValue(workspaceBefore.preset);
  await expect(input).toHaveValue(workspaceBefore.input);
  await expect(stepExplanation).toHaveCount(workspaceBefore.stepCount);
  if (workspaceBefore.step !== null) await expect(stepExplanation).toHaveText(workspaceBefore.step);
  const storageAfter = await page.evaluate(() => Object.fromEntries(
    Object.keys(localStorage)
      .filter((key) => key.startsWith('codexray.'))
      .sort()
      .map((key) => [key, localStorage.getItem(key)]),
  ));
  expect(storageAfter).toEqual(storageBefore);
});
