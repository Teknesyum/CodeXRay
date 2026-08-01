import { expect, test } from '@playwright/test';

test('separates BFS questions from commands and discards interrupted narration', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('codexray.locale', 'en');
    localStorage.setItem('codexray.ai.autoLoad', 'true');
    localStorage.setItem('codexray.ai.godMode', 'false');
    localStorage.setItem('codexray.radio.autoplay', 'false');
    Object.defineProperty(navigator, 'gpu', { configurable: true, value: { requestAdapter: async () => ({}) } });
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: { persist: async () => true, persisted: async () => true },
    });

    type Listener = (event: MessageEvent) => void;
    class RoutingWorker {
      onmessage: Listener | null = null;
      private readonly listeners = new Set<Listener>();
      private delayedId: number | null = null;
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
      postMessage(message: { id: number; type: string; question?: string }) {
        if (message.type === 'generate' && message.question?.includes('interruptible narration')) {
          this.delayedId = message.id;
          return;
        }
        if (message.type === 'agent-cancel' && message.id === this.delayedId) {
          window.setTimeout(() => this.emit({
            id: message.id,
            type: 'answer',
            text: 'LATE NARRATION MUST NOT APPEAR',
          }), 120);
          return;
        }
        queueMicrotask(() => {
          if (message.type === 'cache-status') this.emit({ id: message.id, type: 'cache-status', text: 'cached' });
          else if (message.type === 'initialize') this.emit({ id: message.id, type: 'ready', text: 'mock-model' });
          else if (message.type === 'plan') this.emit({ id: message.id, type: 'answer', text: '{"actions":[]}' });
          else this.emit({
            id: message.id,
            type: 'answer',
            text: message.question?.includes('step 7') ? 'Step 7 grounded answer.' : 'BFS explanation only.',
          });
        });
      }
      terminate() { this.listeners.clear(); }
    }
    Object.defineProperty(window, 'Worker', { configurable: true, value: RoutingWorker });
  });

  await page.goto('/');
  const preset = page.getByLabel('Algorithm preset');
  const presetBefore = await preset.inputValue();
  const question = page.getByPlaceholder('Type your question here...');
  await expect(question).toBeEnabled();

  await question.fill('What is BFS?');
  await question.press('Enter');
  await expect(page.getByText('BFS explanation only.')).toBeVisible();
  await expect(preset).toHaveValue(presetBefore);
  await expect(page.getByLabel('Breadth First Search (BFS) execution')).toHaveCount(0);

  await question.fill('Open the BFS page');
  await question.press('Enter');
  await expect(page.getByLabel('Breadth First Search (BFS) execution')).toBeVisible();
  await expect(page.getByText('BFS explanation only.')).toHaveCount(2);
  const progress = page.locator('.visualizer-header-actions > span');
  await expect(progress).toHaveText(/^1 \/ \d+$/);

  await question.fill('Give me an interruptible narration of this BFS');
  await question.press('Enter');
  await expect(page.getByRole('button', { name: 'Stop AI response' })).toBeVisible();
  await page.getByRole('button', { name: 'Stop AI response' }).click();
  await expect(question).toBeEnabled();

  await question.fill('Go to step 7 and explain it');
  await question.press('Enter');
  await expect(progress).toHaveText(/^7 \/ \d+$/);
  await expect(page.getByText('Step 7 grounded answer.')).toBeVisible();
  await page.waitForTimeout(250);
  await expect(page.getByText('LATE NARRATION MUST NOT APPEAR')).toHaveCount(0);
  await expect(progress).toHaveText(/^7 \/ \d+$/);
});
