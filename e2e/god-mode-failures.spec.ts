import { expect, test } from '@playwright/test';

test('cancels the visible God Mode queue and ignores a late specialist response', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('codexray.locale', 'en');
    localStorage.setItem('codexray.ai.autoLoad', 'true');
    localStorage.setItem('codexray.ai.godMode', 'true');
    localStorage.setItem('codexray.radio.autoplay', 'false');
    Object.defineProperty(navigator, 'gpu', {
      configurable: true,
      value: { requestAdapter: async () => ({}) },
    });
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: { persist: async () => true, persisted: async () => true },
    });

    type WorkerMessage = { id: number; type: string };
    class DelayedWorker {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: ((event: ErrorEvent) => void) | null = null;
      private readonly listeners = new Set<(event: MessageEvent) => void>();

      addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
        if (type === 'message' && typeof listener === 'function') {
          this.listeners.add(listener as (event: MessageEvent) => void);
        }
      }

      removeEventListener(type: string, listener: EventListenerOrEventListenerObject) {
        if (type === 'message' && typeof listener === 'function') {
          this.listeners.delete(listener as (event: MessageEvent) => void);
        }
      }

      private emit(data: Record<string, unknown>) {
        const event = new MessageEvent('message', { data });
        this.onmessage?.(event);
        this.listeners.forEach((listener) => listener(event));
      }

      postMessage(message: WorkerMessage) {
        if (message.type === 'cache-status') {
          queueMicrotask(() => this.emit({ id: message.id, type: 'cache-status', text: 'cached' }));
        } else if (message.type === 'initialize') {
          queueMicrotask(() => this.emit({ id: message.id, type: 'ready', text: 'mock-model' }));
        } else if (message.type === 'agent-cancel') {
          queueMicrotask(() => this.emit({
            id: message.id,
            type: 'error',
            text: 'God Mode agent was cancelled.',
          }));
          window.setTimeout(() => this.emit({
            id: message.id,
            type: 'answer',
            text: JSON.stringify({
              version: 1,
              title: 'Late package that must be ignored',
              inputKind: 'graph',
            }),
          }), 100);
        }
      }

      terminate() {
        this.listeners.clear();
      }
    }

    Object.defineProperty(window, 'Worker', {
      configurable: true,
      value: DelayedWorker,
    });
  });

  await page.goto('/');
  const source = page.getByRole('textbox', { name: 'Source code' });
  const input = page.getByRole('textbox', { name: 'Array Simulation Input:' });
  const preset = page.getByLabel('Algorithm preset');
  const sourceBefore = await source.inputValue();
  const inputBefore = await input.inputValue();
  const presetBefore = await preset.inputValue();
  const algorithmBefore = await page.locator('.visualizer-header h2').textContent();
  const question = page.getByPlaceholder('Type your question here...');
  await expect(question).toBeEnabled();
  await question.fill('write bidirectional BFS for me');
  await question.press('Enter');

  await expect(page.locator('.god-mode-progress')).toBeVisible();
  await expect(page.locator('.god-mode-agent.running')).toHaveCount(1);
  await page.getByRole('button', { name: 'Cancel agent run' }).click();

  await expect(page.locator('.god-mode-agent.cancelled')).not.toHaveCount(0);
  await expect(question).toBeEnabled();
  await expect(source).toHaveValue(sourceBefore);
  await expect(input).toHaveValue(inputBefore);
  await expect(preset).toHaveValue(presetBefore);
  await expect(page.locator('.visualizer-header h2')).toHaveText(algorithmBefore ?? 'Simulation View');
  await expect(page.getByLabel(/Bidirectional BFS.*Custom execution/i)).toHaveCount(0);
  await expect(page.getByRole('paragraph').filter({
    hasText: 'God Mode run was cancelled.',
  })).toBeVisible();

  await page.waitForTimeout(250);
  await expect(source).toHaveValue(sourceBefore);
  await expect(input).toHaveValue(inputBefore);
  await expect(page.getByText('Late package that must be ignored')).toHaveCount(0);
});

test('shows the failing specialist after bounded SimLang retries and preserves the committed workspace', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('codexray.locale', 'en');
    localStorage.setItem('codexray.ai.autoLoad', 'true');
    localStorage.setItem('codexray.ai.godMode', 'true');
    localStorage.setItem('codexray.radio.autoplay', 'false');
    Object.defineProperty(navigator, 'gpu', { configurable: true, value: { requestAdapter: async () => ({}) } });
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: { persist: async () => true, persisted: async () => true },
    });
    const state = window as Window & { __codeAuthorAttempts?: number };
    state.__codeAuthorAttempts = 0;
    type Listener = (event: MessageEvent) => void;
    class InvalidProgramWorker {
      onmessage: Listener | null = null;
      private readonly listeners = new Set<Listener>();
      addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
        if (type === 'message' && typeof listener === 'function') this.listeners.add(listener as Listener);
      }
      removeEventListener(type: string, listener: EventListenerOrEventListenerObject) {
        if (type === 'message' && typeof listener === 'function') this.listeners.delete(listener as Listener);
      }
      private emit(data: object) {
        const event = new MessageEvent('message', { data });
        this.onmessage?.(event);
        this.listeners.forEach((listener) => listener(event));
      }
      postMessage(message: { id: number; type: string; role?: string }) {
        queueMicrotask(() => {
          if (message.type === 'cache-status') this.emit({ id: message.id, type: 'cache-status', text: 'cached' });
          else if (message.type === 'initialize') this.emit({ id: message.id, type: 'ready', text: 'mock-model' });
          else if (message.type === 'agent-run' && message.role === 'architect') this.emit({
            id: message.id,
            type: 'answer',
            text: JSON.stringify({
              version: 1,
              title: 'Broken BFS',
              purpose: 'Exercise rollback.',
              inputKind: 'graph',
              dataStructures: ['queue'],
              invariants: ['No partial state.'],
              termination: 'Never compiles.',
              complexity: { time: 'O(V + E)', space: 'O(V)' },
            }),
          });
          else if (message.type === 'agent-run' && message.role === 'code-author') {
            state.__codeAuthorAttempts = (state.__codeAuthorAttempts ?? 0) + 1;
            this.emit({ id: message.id, type: 'answer', text: '{"version":1,"entry":"not-an-array"}' });
          }
          else if (message.type === 'agent-run') this.emit({ id: message.id, type: 'answer', text: `${message.role} completed.` });
        });
      }
      terminate() { this.listeners.clear(); }
    }
    Object.defineProperty(window, 'Worker', { configurable: true, value: InvalidProgramWorker });
  });

  await page.goto('/');
  const preset = page.getByLabel('Algorithm preset');
  const quickSort = preset.locator('option').filter({ hasText: 'Quick Sort' });
  await preset.selectOption(await quickSort.getAttribute('value') ?? '');
  const input = page.getByRole('textbox', { name: 'Array Simulation Input:' });
  await input.fill('[7,2,5]');
  await page.getByRole('button', { name: /Simulate/ }).click();
  await page.getByRole('button', { name: 'Next step' }).click();
  const sourceBefore = await page.getByLabel('Quick Sort execution').textContent();
  const inputBefore = await input.inputValue();
  const progressBefore = await page.locator('.visualizer-header-actions > span').textContent();

  const question = page.getByPlaceholder('Type your question here...');
  await question.fill('Write a custom BFS algorithm');
  await question.press('Enter');
  await expect(page.locator('.god-mode-agent.failed')).toContainText('Code Author');
  await expect(page.locator('.god-mode-agent.failed')).toContainText('could not produce valid SimLang');
  await expect(page.getByRole('button', { name: 'Retry failed agent run' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as Window & { __codeAuthorAttempts?: number }).__codeAuthorAttempts)).toBe(2);

  await expect(page.getByLabel('Quick Sort execution')).toHaveText(sourceBefore ?? '');
  await expect(input).toHaveValue(inputBefore);
  await expect(preset).toHaveValue(await quickSort.getAttribute('value') ?? '');
  await expect(page.locator('.visualizer-header-actions > span')).toHaveText(progressBefore ?? '');
  await expect(page.getByLabel(/Custom Algorithm.*execution/)).toHaveCount(0);
  await expect(question).toBeEnabled();
});
