import { expect, test } from '@playwright/test';

type WriteLog = { key: string; at: number; failed: boolean };
type ProbeWindow = Window & { __runWrites?: WriteLog[]; __cancelAt?: number };

const UNWIND_WINDOW_MS = 1_500;

test('a cancelled Titan run never returns after a reload', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('codexray.locale', 'en');
    localStorage.setItem('codexray.ai.autoLoad', 'true');
    localStorage.setItem('codexray.ai.titanMode', 'true');
    localStorage.setItem('codexray.radio.autoplay', 'false');
    Object.defineProperty(navigator, 'gpu', {
      configurable: true,
      value: { requestAdapter: async () => ({}) },
    });
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: { persist: async () => true, persisted: async () => true },
    });

    const probe = window as ProbeWindow;
    probe.__runWrites = [];
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function patchedSetItem(this: Storage, key: string, value: string) {
      if (this === sessionStorage && key.startsWith('codexray.titan-mode.run.v1.')) {
        probe.__runWrites?.push({ key, at: performance.now(), failed: value.includes('"status":"failed"') });
      }
      return setItem.call(this, key, value);
    };

    type WorkerMessage = { id: number; type: string };
    class StallingWorker {
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
            text: 'Titan Mode agent was cancelled.',
          }));
        }
      }

      terminate() {
        this.listeners.clear();
      }
    }

    Object.defineProperty(window, 'Worker', {
      configurable: true,
      value: StallingWorker,
    });
  });

  await page.goto('/');
  const question = page.getByRole('textbox', { name: 'Your question' });
  await expect(question).toBeEnabled();
  await question.fill('write bidirectional BFS for me');
  await question.press('Enter');

  await expect(page.locator('.titan-mode-agent.running')).toHaveCount(1);
  const runId = await page.evaluate(() => {
    const index = JSON.parse(sessionStorage.getItem('codexray.titan-mode.runs.v1') ?? '[]') as string[];
    return index[0] ?? '';
  });
  expect(runId).not.toBe('');

  await page.evaluate(() => { (window as ProbeWindow).__cancelAt = performance.now(); });
  await page.getByRole('button', { name: 'Cancel agent run' }).click();
  await expect(page.locator('.titan-mode-progress')).toHaveCount(0);
  await page.waitForTimeout(UNWIND_WINDOW_MS);

  const afterCancel = await page.evaluate((id) => {
    const probe = window as ProbeWindow;
    const cancelAt = probe.__cancelAt ?? 0;
    const writes = (probe.__runWrites ?? [])
      .filter((write) => write.key.endsWith(id) && write.at >= cancelAt)
      .map((write) => ({ ms: Math.round(write.at - cancelAt), failed: write.failed }));
    return {
      writes,
      runKey: sessionStorage.getItem(`codexray.titan-mode.run.v1.${id}`),
      index: sessionStorage.getItem('codexray.titan-mode.runs.v1'),
    };
  }, runId);
  console.log(`R34 post-cancel writes for ${runId}: ${JSON.stringify(afterCancel.writes)}`);
  console.log(`R34 storage after unwind: run=${afterCancel.runKey === null ? 'null' : 'present'} index=${afterCancel.index}`);

  expect(afterCancel.runKey).toBeNull();
  expect(JSON.parse(afterCancel.index ?? '[]')).not.toContain(runId);

  await page.reload();
  await expect(question).toBeEnabled();
  await page.waitForTimeout(UNWIND_WINDOW_MS);
  await expect(page.locator('.titan-mode-progress')).toHaveCount(0);
});
