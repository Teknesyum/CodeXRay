import { expect, test } from '@playwright/test';

test('keeps source, input, and chat payloads out of external network requests', async ({ page }) => {
  const external: Array<{ url: string; method: string; postData: string }> = [];
  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) {
      external.push({ url: request.url(), method: request.method(), postData: request.postData() ?? '' });
      await route.abort();
      return;
    }
    await route.continue();
  });
  await page.addInitScript(() => {
    localStorage.setItem('codexray.locale', 'en');
    localStorage.setItem('codexray.ai.autoLoad', 'true');
    localStorage.setItem('codexray.radio.autoplay', 'false');
    Object.defineProperty(navigator, 'gpu', { configurable: true, value: { requestAdapter: async () => ({}) } });
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: { persist: async () => true, persisted: async () => true },
    });
    type Listener = (event: MessageEvent) => void;
    class PrivateWorker {
      onmessage: Listener | null = null;
      private readonly listeners = new Set<Listener>();
      addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
        if (type === 'message' && typeof listener === 'function') this.listeners.add(listener as Listener);
      }
      removeEventListener(type: string, listener: EventListenerOrEventListenerObject) {
        if (type === 'message' && typeof listener === 'function') this.listeners.delete(listener as Listener);
      }
      postMessage(message: { id: number; type: string }) {
        queueMicrotask(() => {
          const data = message.type === 'cache-status'
            ? { id: message.id, type: 'cache-status', text: 'cached' }
            : message.type === 'initialize'
              ? { id: message.id, type: 'ready', text: 'mock-model' }
              : message.type === 'plan'
                ? { id: message.id, type: 'answer', text: '{"actions":[]}' }
                : { id: message.id, type: 'answer', text: 'Processed entirely in the local worker.' };
          const event = new MessageEvent('message', { data });
          this.onmessage?.(event);
          this.listeners.forEach((listener) => listener(event));
        });
      }
      terminate() { this.listeners.clear(); }
    }
    Object.defineProperty(window, 'Worker', { configurable: true, value: PrivateWorker });
  });

  await page.goto('/');
  const preset = page.getByLabel('Algorithm preset');
  const quickSort = preset.locator('option').filter({ hasText: 'Quick Sort' });
  await preset.selectOption(await quickSort.getAttribute('value') ?? '');
  const privateInput = '[314159,271828,161803]';
  const privateQuestion = 'PRIVATE_CHAT_SENTINEL_9f31 explain my input';
  await page.getByRole('textbox', { name: 'Array Simulation Input:' }).fill(privateInput);
  await page.getByRole('button', { name: /Simulate/ }).click();
  const question = page.getByPlaceholder('Type your question here...');
  await expect(question).toBeEnabled();
  await question.fill(privateQuestion);
  await question.press('Enter');
  await expect(page.getByText('Processed entirely in the local worker.')).toBeVisible();
  await page.getByRole('button', { name: 'Open CodeXRay Radio' }).click();
  await expect(page.getByTitle('CodeXRay YouTube playlist player')).toHaveAttribute('src', /^https:\/\/www\.youtube\.com\/embed\//);

  const allowedHosts = new Set([
    'www.youtube.com',
    'i.ytimg.com',
    'fonts.googleapis.com',
    'fonts.gstatic.com',
  ]);
  expect(external.length).toBeGreaterThan(0);
  for (const request of external) {
    expect(allowedHosts.has(new URL(request.url).hostname), request.url).toBe(true);
    expect(`${request.url}\n${request.postData}`).not.toContain('PRIVATE_CHAT_SENTINEL_9f31');
    expect(`${request.url}\n${request.postData}`).not.toContain('314159');
    expect(request.method).toBe('GET');
  }
});
