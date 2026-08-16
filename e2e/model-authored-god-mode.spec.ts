import { expect, test } from '@playwright/test';

test('commits a validated model-authored algorithm and keeps its queue, source, input, trace, and teaching grounded', async ({ page }) => {
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
    (window as Window & { __agentRoles?: string[] }).__agentRoles = [];
    const program = {
      version: 1,
      id: 'prefix_maximum_scan',
      title: 'Prefix Maximum Scan',
      locale: 'en',
      inputKind: 'array',
      functions: [],
      budgets: { instructions: 400, traceSteps: 40, recursionDepth: 2, collectionSize: 100 },
      entry: [
        { id: 'load', type: 'declare', name: 'array', value: { type: 'input-field', field: 'array' } },
        { id: 'result', type: 'trace', at: 'load', explanation: 'The validated input is {{array}}.', category: 'result', importance: 1 },
      ],
    };
    class AgentWorker {
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
        if (message.type === 'agent-run' && message.role) {
          (window as Window & { __agentRoles?: string[] }).__agentRoles?.push(message.role);
        }
        queueMicrotask(() => {
          if (message.type === 'cache-status') return this.emit({ id: message.id, type: 'cache-status', text: 'cached' });
          if (message.type === 'initialize') return this.emit({ id: message.id, type: 'ready', text: 'mock-model' });
          if (message.type !== 'agent-run') return;
          if (message.role === 'architect') return this.emit({
            id: message.id, type: 'answer', text: JSON.stringify({
              version: 1,
              title: 'Prefix Maximum Scan',
              purpose: 'Expose a custom model-authored array trace.',
              inputKind: 'array',
              dataStructures: ['array'],
              invariants: ['The committed input is never mutated.'],
              termination: 'The validated input is emitted once.',
              complexity: { time: 'O(n)', space: 'O(n)' },
            }),
          });
          if (message.role === 'code-author') return this.emit({ id: message.id, type: 'answer', text: JSON.stringify(program) });
          if (message.role === 'critic') return this.emit({
            id: message.id, type: 'answer', text: JSON.stringify({ passed: true, issues: [], summary: 'Source, input, trace, and visual agree.' }),
          });
          return this.emit({ id: message.id, type: 'answer', text: `${message.role} verified the committed snapshot.` });
        });
      }
      terminate() { this.listeners.clear(); }
    }
    Object.defineProperty(window, 'Worker', { configurable: true, value: AgentWorker });
  });

  await page.goto('/');
  const chat = page.getByPlaceholder('Type your question here...');
  await expect(chat).toBeEnabled();
  await chat.fill('Write a custom prefix maximum scan algorithm and simulate it on my current array.');
  await chat.press('Enter');

  await expect(page.getByLabel('Prefix Maximum Scan — Custom execution')).toBeVisible();
  await expect(page.locator('.code-display')).toContainText('auto array = input.values;');
  await expect(page.locator('.step-explanation')).toContainText('validated input');
  const finalAnswer = page.locator('.chat-message.ai-msg').filter({ hasText: 'code, input, and 1-step simulation were applied' });
  await expect(finalAnswer).toContainText('Code:');
  await expect(finalAnswer).toContainText('Time:');
  expect(await page.evaluate(() => (window as Window & { __agentRoles?: string[] }).__agentRoles)).toEqual(expect.arrayContaining([
    'architect', 'code-author', 'input-engineer', 'visual-designer', 'critic', 'trace-director', 'result-analyst', 'tutor',
  ]));
  expect(await page.evaluate(() => (window as Window & { __agentRoles?: string[] }).__agentRoles)).not.toContain('manager');
  await expect(page.locator('.titan-mode-progress')).toHaveCount(0, { timeout: 4_000 });
});
