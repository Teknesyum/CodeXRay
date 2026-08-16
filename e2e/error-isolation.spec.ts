import { expect, test } from '@playwright/test';

test('isolates corrupt layout, invalid input, AI, radio, and Titan Mode failures without reset', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('codexray.locale', 'en');
    localStorage.setItem('codexray.layout.v2', '{broken-json');
    localStorage.setItem('codexray.ai.autoLoad', 'true');
    localStorage.setItem('codexray.ai.titanMode', 'true');
    localStorage.setItem('codexray.radio.autoplay', 'true');
    localStorage.setItem('codexray.radio.minimizeSeconds', '16');
    Object.defineProperty(navigator, 'gpu', {
      configurable: true,
      value: { requestAdapter: async () => ({}) },
    });
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: { persist: async () => true, persisted: async () => true },
    });

    type Listener = (event: MessageEvent) => void;
    let generateCount = 0;
    class FaultWorker {
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
      postMessage(message: { id: number; type: string }) {
        if (message.type === 'agent-run') return;
        queueMicrotask(() => {
          if (message.type === 'cache-status') this.emit({ id: message.id, type: 'cache-status', text: 'cached' });
          else if (message.type === 'initialize') this.emit({ id: message.id, type: 'ready', text: 'mock-model' });
          else if (message.type === 'plan') this.emit({ id: message.id, type: 'answer', text: '{"actions":[]}' });
          else if (message.type === 'agent-cancel') this.emit({ id: message.id, type: 'error', text: 'Injected agent cancellation.' });
          else if (++generateCount === 1) this.emit({ id: message.id, type: 'error', text: 'Injected inference failure.' });
          else this.emit({ id: message.id, type: 'answer', text: 'AI recovered locally.' });
        });
      }
      terminate() { this.listeners.clear(); }
    }
    Object.defineProperty(window, 'Worker', { configurable: true, value: FaultWorker });

    type PlayerEvents = {
      onReady: (event: { target: FaultPlayer }) => void;
      onStateChange?: (event: { data: number; target: FaultPlayer }) => void;
      onError?: (event: { data: number; target: FaultPlayer }) => void;
    };
    const radioWindow = window as Window & { __failRadio?: () => void; YT?: { Player: typeof FaultPlayer } };
    class FaultPlayer {
      private readonly events: PlayerEvents;
      constructor(_element: HTMLIFrameElement, options: { events: PlayerEvents }) {
        this.events = options.events;
        radioWindow.__failRadio = () => this.events.onError?.({ data: 150, target: this });
        queueMicrotask(() => this.events.onReady({ target: this }));
      }
      destroy() {}
      isMuted() { return false; }
      mute() {}
      unMute() {}
      setVolume() {}
      setLoop() {}
      setShuffle() {}
      pauseVideo() { this.events.onStateChange?.({ data: 2, target: this }); }
      playVideo() {}
      getPlayerState() { return -1; }
      nextVideo() {}
      previousVideo() {}
      getPlaylist() { return ['8zj8h15VmQw']; }
      getPlaylistIndex() { return 0; }
      getVideoData() { return { title: 'Up', video_id: '8zj8h15VmQw' }; }
      playVideoAt() {}
      getCurrentTime() { return 0; }
      getDuration() { return 191; }
      seekTo() {}
      loadPlaylist() {}
    }
    Object.defineProperty(radioWindow, 'YT', { configurable: true, value: { Player: FaultPlayer } });
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Source Code' })).toBeVisible();
  const preset = page.getByLabel('Algorithm preset');
  const quickSort = preset.locator('option').filter({ hasText: 'Quick Sort' });
  await preset.selectOption(await quickSort.getAttribute('value') ?? '');
  const input = page.getByRole('textbox', { name: 'Array Simulation Input:' });
  await input.fill('1,,2');
  await page.getByRole('button', { name: /Simulate/ }).click();
  await expect(page.getByRole('alert')).toContainText('empty items');
  await input.fill('[9,1,5,3]');
  await page.getByRole('button', { name: /Simulate/ }).click();
  await expect(page.getByLabel('Quick Sort execution')).toBeVisible();
  const progress = page.locator('.visualizer-header-actions > span');
  await expect(progress).toHaveText(/^1 \/ \d+$/);

  const question = page.getByPlaceholder('Type your question here...');
  await expect(question).toBeEnabled();
  await question.fill('Explain the current quick sort step');
  await question.press('Enter');
  await expect(page.getByText('Injected inference failure.')).toBeVisible();
  await page.getByRole('button', { name: 'Next step' }).click();
  await expect(progress).toHaveText(/^2 \/ \d+$/);
  await question.fill('Try the explanation again');
  await question.press('Enter');
  await expect(page.getByText('AI recovered locally.')).toBeVisible();

  await page.evaluate(() => (window as Window & { __failRadio?: () => void }).__failRadio?.());
  await expect(page.getByRole('complementary', { name: 'Radio' }).getByRole('status')).toContainText('error 150');
  await page.getByRole('button', { name: 'Next step' }).click();
  await expect(progress).toHaveText(/^3 \/ \d+$/);

  await question.fill('write bidirectional BFS for me');
  await question.press('Enter');
  await expect(page.locator('.titan-mode-agent.running')).toHaveCount(1);
  await page.getByRole('button', { name: 'Cancel agent run' }).click();
  await expect(page.locator('.titan-mode-progress')).toHaveCount(0);
  await expect(page.getByLabel('Quick Sort execution')).toBeVisible();
  await expect(progress).toHaveText(/^3 \/ \d+$/);
  await expect(question).toBeEnabled();
});
