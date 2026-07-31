import { expect, test } from '@playwright/test';

test('loads DFS in God Mode without waiting for a local model', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('codexray.locale', 'en');
    localStorage.setItem('codexray.ai.autoLoad', 'false');
    localStorage.setItem('codexray.ai.godMode', 'true');
    localStorage.setItem('codexray.radio.autoplay', 'false');
  });
  await page.goto('/');
  const chatInput = page.getByPlaceholder('Type your question here...');
  await expect(chatInput).toBeEnabled();
  await chatInput.fill('DFS ile ilgili sayfayı aç');
  await chatInput.press('Enter');
  await expect(page.getByLabel('Depth First Search (DFS) execution')).toBeVisible();
  await expect(page.getByText('The requested workspace action was applied.')).toBeVisible();
  await chatInput.fill('write bidirectional BFS for me');
  await chatInput.press('Enter');
  await expect(page.getByLabel('Bidirectional BFS — Custom execution')).toBeVisible();
  await expect(page.locator('.god-mode-percent')).toHaveText('100%');
});

test('loads DFS deterministically with a mocked on-device model bridge', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('codexray.locale', 'en');
    localStorage.setItem('codexray.ai.autoLoad', 'true');
    localStorage.setItem('codexray.radio.autoplay', 'false');

    Object.defineProperty(navigator, 'gpu', {
      configurable: true,
      value: { requestAdapter: async () => ({}) },
    });
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: {
        persist: async () => true,
        persisted: async () => true,
      },
    });

    const workerMessages: Array<{ type: string; question?: string }> = [];
    Object.defineProperty(window, '__codexrayWorkerMessages', {
      configurable: true,
      value: workerMessages,
    });

    class MockWorker {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: ((event: ErrorEvent) => void) | null = null;
      private readonly messageListeners = new Set<(event: MessageEvent) => void>();

      addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
        if (type === 'message' && typeof listener === 'function') {
          this.messageListeners.add(listener as (event: MessageEvent) => void);
        }
      }

      removeEventListener(type: string, listener: EventListenerOrEventListenerObject) {
        if (type === 'message' && typeof listener === 'function') {
          this.messageListeners.delete(listener as (event: MessageEvent) => void);
        }
      }

      postMessage(message: { id: number; type: string; question?: string }) {
        workerMessages.push({ type: message.type, question: message.question });
        queueMicrotask(() => {
          const data = message.type === 'cache-status'
            ? { id: message.id, type: 'cache-status', text: 'cached' }
            : message.type === 'initialize'
              ? { id: message.id, type: 'ready', text: 'mock-model' }
              : message.type === 'plan'
                ? { id: message.id, type: 'answer', text: '{"actions":[]}' }
                : { id: message.id, type: 'answer', text: 'DFS workspace confirmed.' };
          const event = new MessageEvent('message', { data });
          this.onmessage?.(event);
          for (const listener of this.messageListeners) listener(event);
        });
      }

      terminate() {
        this.messageListeners.clear();
      }
    }

    Object.defineProperty(window, 'Worker', {
      configurable: true,
      value: MockWorker,
    });
  });

  await page.goto('/');
  const chatInput = page.getByPlaceholder('Type your question here...');
  await expect(chatInput).toBeEnabled();
  await chatInput.fill('DFS ile ilgili sayfayı aç');
  await chatInput.press('Enter');

  await expect(page.getByLabel('Depth First Search (DFS) execution')).toBeVisible();
  await expect.poll(async () => page.evaluate(() => (
    window as Window & { __codexrayWorkerMessages?: Array<{ type: string }> }
  ).__codexrayWorkerMessages?.map((message) => message.type) ?? []))
    .toContain('generate');
  await expect(page.getByText('DFS workspace confirmed.')).toBeVisible();

  const messages = await page.evaluate(() => (
    window as Window & { __codexrayWorkerMessages?: Array<{ type: string }> }
  ).__codexrayWorkerMessages ?? []);
  expect(messages.some((message) => message.type === 'plan')).toBe(false);
  expect(messages.some((message) => message.type === 'generate')).toBe(true);
});

test('builds and applies bidirectional BFS through the visible God Mode queue', async ({ page }) => {
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

    class MockWorker {
      onmessage: ((event: MessageEvent) => void) | null = null;
      private readonly messageListeners = new Set<(event: MessageEvent) => void>();

      addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
        if (type === 'message' && typeof listener === 'function') {
          this.messageListeners.add(listener as (event: MessageEvent) => void);
        }
      }

      removeEventListener(type: string, listener: EventListenerOrEventListenerObject) {
        if (type === 'message' && typeof listener === 'function') {
          this.messageListeners.delete(listener as (event: MessageEvent) => void);
        }
      }

      postMessage(message: { id: number; type: string; role?: string }) {
        queueMicrotask(() => {
          let data: object;
          if (message.type === 'cache-status') {
            data = { id: message.id, type: 'cache-status', text: 'cached' };
          } else if (message.type === 'initialize') {
            data = { id: message.id, type: 'ready', text: 'mock-model' };
          } else if (message.type === 'agent-run' && message.role === 'architect') {
            data = {
              id: message.id,
              type: 'answer',
              text: JSON.stringify({
                version: 1,
                title: 'Bidirectional BFS',
                purpose: 'Find a shortest path from two endpoints.',
                inputKind: 'graph',
                dataStructures: ['two queues', 'two visited sets', 'two parent maps'],
                invariants: ['Each side visits a node once.'],
                termination: 'The frontiers meet or one becomes empty.',
                complexity: { time: 'O(V + E)', space: 'O(V)' },
              }),
            };
          } else if (message.type === 'agent-run' && message.role === 'critic') {
            data = {
              id: message.id,
              type: 'answer',
              text: JSON.stringify({ passed: true, issues: [], summary: 'Validated.' }),
            };
          } else {
            data = { id: message.id, type: 'answer', text: `${message.role ?? 'Tutor'} completed.` };
          }
          const event = new MessageEvent('message', { data });
          this.onmessage?.(event);
          for (const listener of this.messageListeners) listener(event);
        });
      }

      terminate() {
        this.messageListeners.clear();
      }
    }

    Object.defineProperty(window, 'Worker', { configurable: true, value: MockWorker });
  });

  await page.goto('/');
  const chatInput = page.getByPlaceholder('Type your question here...');
  await expect(chatInput).toBeEnabled();
  await chatInput.fill('write bidirectional BFS for me');
  await chatInput.press('Enter');

  await expect(page.locator('.code-display')).toContainText('reconstructPath');
  await expect(page.getByLabel('Bidirectional BFS — Custom execution')).toBeVisible();
  await expect(page.locator('.graph-node[data-semantic-roles~="start"]')).toHaveCount(1);
  await expect(page.locator('.graph-node[data-semantic-roles~="target"]')).toHaveClass(/shape-diamond/);
  await expect(page.getByText('Start frontier', { exact: true })).toBeVisible();
  await expect(page.getByText('Target frontier', { exact: true })).toBeVisible();
  await expect(page.getByText('Code Author', { exact: true })).toBeVisible();
  await expect(page.locator('.god-mode-percent')).toHaveText('100%');
  await expect(page.getByText(/code, input, and \d+-step simulation were applied/i)).toBeVisible();
  await expect(page.getByText(/Code: Two independent BFS frontiers/i)).toBeVisible();
  await expect(page.locator('.god-mode-progress')).toHaveCount(0, { timeout: 4_000 });

  const pauseButton = page.getByRole('button', { name: 'Pause' });
  if (await pauseButton.count()) await pauseButton.click();
  const previousStep = page.getByRole('button', { name: 'Previous step' });
  for (let index = 0; index < 60 && !await previousStep.isDisabled(); index += 1) {
    await previousStep.click();
  }
  const nextStep = page.getByRole('button', { name: 'Next step' });
  let inspectedEdgeFound = false;
  for (let index = 0; index < 60; index += 1) {
    if (await page.locator('.graph-edge[data-semantic-roles~="inspect-start"], .graph-edge[data-semantic-roles~="inspect-target"]').count()) {
      inspectedEdgeFound = true;
      break;
    }
    if (await nextStep.isDisabled()) break;
    await nextStep.click();
  }
  expect(inspectedEdgeFound).toBe(true);
  await expect(page.locator('.graph-edge[data-semantic-roles~="tree-start"], .graph-edge[data-semantic-roles~="tree-target"]').first()).toBeVisible();

  await chatInput.fill('bu kod için inputları düzenle');
  await chatInput.press('Enter');
  await expect(page.getByText(/Compatible input and trace applied/i)).toBeVisible();
  await expect(page.getByLabel('Bidirectional BFS — Custom execution')).toBeVisible();
  await expect(page.locator('.god-mode-percent')).toHaveText('100%');
});
