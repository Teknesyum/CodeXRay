import { expect, test } from '@playwright/test';

const hostileAnswer = `<think>private chain of thought that must never be shown or copied</think>

# Hostile payload

This normal explanation must wrap inside the assistant even with ${'longword'.repeat(50)}.

| Algorithm | Time | Notes |
|---|---:|---|
| BFS | O(V + E) | ${'wide-cell-'.repeat(30)} |

- First level
  - Nested level

[very long safe link](https://example.com/${'path/'.repeat(80)})

<img src=x onerror="window.__codexrayHostileExecuted=true">

[unsafe](javascript:window.__codexrayHostileExecuted=true)

\`\`\`ts
const longToken = "${'x'.repeat(512)}";`;

test('keeps hostile model Markdown inert, contained, copyable, and allows the next turn', async ({ page }) => {
  await page.addInitScript((answer) => {
    localStorage.setItem('codexray.locale', 'en');
    localStorage.setItem('codexray.ai.autoLoad', 'true');
    localStorage.setItem('codexray.radio.autoplay', 'false');
    Object.defineProperty(navigator, 'gpu', {
      configurable: true,
      value: { requestAdapter: async () => ({}) },
    });
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: { persist: async () => true, persisted: async () => true },
    });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async (value: string) => { (window as Window & { __copied?: string }).__copied = value; } },
    });

    let generated = 0;
    class MarkdownWorker {
      onmessage: ((event: MessageEvent) => void) | null = null;
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

      postMessage(message: { id: number; type: string }) {
        queueMicrotask(() => {
          const data = message.type === 'cache-status'
            ? { id: message.id, type: 'cache-status', text: 'cached' }
            : message.type === 'initialize'
              ? { id: message.id, type: 'ready', text: 'mock-model' }
              : message.type === 'plan'
                ? { id: message.id, type: 'answer', text: '{"actions":[]}' }
                : { id: message.id, type: 'answer', text: ++generated === 1
                  ? answer
                  : 'Recovered answer after malformed Markdown.' };
          const event = new MessageEvent('message', { data });
          this.onmessage?.(event);
          this.listeners.forEach((listener) => listener(event));
        });
      }

      terminate() {
        this.listeners.clear();
      }
    }
    Object.defineProperty(window, 'Worker', { configurable: true, value: MarkdownWorker });
  }, hostileAnswer);

  await page.goto('/');
  const question = page.getByPlaceholder('Type your question here...');
  await expect(question).toBeEnabled();
  await question.fill('Explain the current workspace');
  await question.press('Enter');

  const hostileMessage = page.locator('.chat-message.ai-msg').filter({ hasText: 'Hostile payload' });
  await expect(hostileMessage).toBeVisible();
  await expect(hostileMessage.locator('img, script')).toHaveCount(0);
  await expect(hostileMessage.getByRole('link', { name: 'unsafe' })).toHaveCount(0);
  expect(await page.evaluate(() => (window as Window & { __codexrayHostileExecuted?: boolean }).__codexrayHostileExecuted)).toBeUndefined();

  const containment = await page.locator('.ai-assistant').evaluate((panel) => ({
    clientWidth: panel.clientWidth,
    scrollWidth: panel.scrollWidth,
  }));
  expect(containment.scrollWidth).toBeLessThanOrEqual(containment.clientWidth + 1);
  const codeBounds = await hostileMessage.locator('.markdown-code-block').boundingBox();
  const panelBounds = await page.locator('.ai-assistant').boundingBox();
  expect(codeBounds?.width ?? 0).toBeLessThanOrEqual(panelBounds?.width ?? 0);
  await expect(hostileMessage.locator('.markdown-code-block')).toContainText('x'.repeat(512));
  await expect(hostileMessage).not.toContainText('private chain of thought');
  await expect(hostileMessage.locator('.markdown-table-scroll')).toBeVisible();
  await expect(hostileMessage.locator('li')).toHaveCount(2);

  const assistant = page.locator('.assistant-container');
  const initialHeight = (await assistant.boundingBox())?.height ?? 0;
  const upperSplitter = page.getByRole('separator', { name: 'Resize visualizer and assistant panels' });
  await upperSplitter.focus();
  for (let index = 0; index < 8; index += 1) await upperSplitter.press('ArrowDown');
  await expect.poll(async () => (await assistant.boundingBox())?.height ?? 0).toBeLessThan(initialHeight);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    await page.evaluate(() => document.documentElement.clientWidth + 1),
  );
  await page.getByRole('button', { name: 'Maximize AI panel' }).click();
  await expect(hostileMessage).toBeVisible();
  await expect(hostileMessage.getByRole('button', { name: 'Copy AI response' })).toBeVisible();
  await expect(question).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    await page.evaluate(() => document.documentElement.clientWidth + 1),
  );

  await hostileMessage.getByRole('button', { name: 'Copy AI response' }).click();
  await expect(hostileMessage.getByRole('status')).toHaveText('AI response copied');
  await expect.poll(() => page.evaluate(() => (window as Window & { __copied?: string }).__copied))
    .not.toContain('private chain of thought');
  await expect.poll(() => page.evaluate(() => (window as Window & { __copied?: string }).__copied))
    .toContain('# Hostile payload');

  await question.fill('Can you answer normally now?');
  await question.press('Enter');
  await expect(page.getByText('Recovered answer after malformed Markdown.')).toBeVisible();
  await expect(question).toBeEnabled();
});
