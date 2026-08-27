import { expect, test } from '@playwright/test';

test('shows Titan naming and keeps deterministic navigation model-independent', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('codexray.locale', 'en');
    localStorage.setItem('codexray.ai.autoLoad', 'false');
    localStorage.setItem('codexray.ai.titanMode', 'true');
    localStorage.setItem('codexray.radio.autoplay', 'false');
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Titan Mode enabled' })).toBeVisible();
  await expect(page.getByText(['God', 'Mode'].join(' '), { exact: true })).toHaveCount(0);
  const chat = page.getByPlaceholder('Type your question here...');
  await chat.fill('open DFS');
  await chat.press('Enter');
  await expect(page.getByLabel('Depth First Search (DFS) execution')).toBeVisible();
  await chat.fill('go to step 3');
  await chat.press('Enter');
  await expect(page.getByText('The requested workspace action was applied.').last()).toBeVisible();
});

test('shows the five-stage pipeline and a grounded current-step answer', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('codexray.locale', 'en');
    localStorage.setItem('codexray.ai.autoLoad', 'false');
    localStorage.setItem('codexray.ai.titanMode', 'true');
    localStorage.setItem('codexray.radio.autoplay', 'false');
  });
  await page.goto('/');
  const chat = page.getByPlaceholder('Type your question here...');
  await chat.fill('open DFS');
  await chat.press('Enter');
  await expect(page.getByLabel('Depth First Search (DFS) execution')).toBeVisible();
  await chat.fill('explain bunu');
  await chat.press('Enter');

  await expect(page.getByText('Route', { exact: true })).toBeVisible();
  await expect(page.getByText('Produce', { exact: true })).toBeVisible();
  await expect(page.getByText('Semantics', { exact: true })).toBeVisible();
  await expect(page.getByText('Verify', { exact: true })).toBeVisible();
  await expect(page.getByText('Apply', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Semantics: skipped (not required)')).toBeVisible();
  await expect(page.getByText(/Code:.*Data:.*Visual:.*Reasoning:.*Time:/s).last()).toBeVisible();
});

test('rejects a model answer whose current-step line disagrees with the committed trace', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('codexray.locale', 'en');
    localStorage.setItem('codexray.ai.autoLoad', 'true');
    localStorage.setItem('codexray.ai.titanMode', 'true');
    localStorage.setItem('codexray.radio.autoplay', 'false');
    Object.defineProperty(navigator, 'gpu', { configurable: true, value: { requestAdapter: async () => ({}) } });
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: { persist: async () => true, persisted: async () => true },
    });
    class DivergentTutorWorker {
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
          const text = message.role === 'tutor'
            ? 'Code: Active source line 999.\nData: Live variables {}.\nVisual: array.\nReasoning: Confident but wrong.\nTime: Step 1/1.'
            : `${message.role} completed.`;
          this.emit({ id: message.id, type: 'answer', text });
        });
      }
      terminate() { this.listeners.clear(); }
    }
    Object.defineProperty(window, 'Worker', { configurable: true, value: DivergentTutorWorker });
  });

  await page.goto('/');
  await page.getByLabel('Algorithm preset').selectOption({ label: '1 – ✓ Depth First Search (DFS)' });
  await page.getByRole('button', { name: /Simulate/ }).click();
  await expect(page.getByLabel('Depth First Search (DFS) execution')).toBeVisible();
  const chat = page.getByPlaceholder('Type your question here...');
  await expect(chat).toBeEnabled();
  await chat.fill('explain bunu');
  await chat.press('Enter');
  await expect(page.getByText('The current-step explanation could not be verified. The workspace was not changed.').last()).toBeVisible();
  await expect(page.getByText('Active source line 999.')).toHaveCount(0);
});
