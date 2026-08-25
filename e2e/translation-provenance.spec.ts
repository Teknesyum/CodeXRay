import { expect, test } from '@playwright/test';

test('translates a reviewed Java web solution into a verified simulation badge', async ({ page }) => {
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
});
