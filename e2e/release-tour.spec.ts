import { expect, test } from '@playwright/test';

test('completes the fifteen-step release tour in one browser profile', async ({ page }) => {
  test.setTimeout(90_000);
  await page.addInitScript(() => {
    localStorage.setItem('codexray.locale', 'en');
    localStorage.setItem('codexray.ai.autoLoad', 'true');
    localStorage.setItem('codexray.ai.titanMode', 'true');
    localStorage.setItem('codexray.radio.autoplay', 'false');
    localStorage.setItem('portfolio.release-sentinel', 'preserve-me');
    Object.defineProperty(navigator, 'gpu', { configurable: true, value: { requestAdapter: async () => ({}) } });
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: { persist: async () => true, persisted: async () => true },
    });
    const state = window as Window & { __holdTitanMode?: boolean; YT?: { Player: typeof TourPlayer } };
    state.__holdTitanMode = false;
    type Listener = (event: MessageEvent) => void;
    class TourWorker {
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
        if (message.type === 'agent-run' && state.__holdTitanMode) return;
        queueMicrotask(() => {
          if (message.type === 'cache-status') this.emit({ id: message.id, type: 'cache-status', text: 'cached' });
          else if (message.type === 'initialize') this.emit({ id: message.id, type: 'ready', text: 'mock-model' });
          else if (message.type === 'plan') this.emit({ id: message.id, type: 'answer', text: '{"actions":[]}' });
          else if (message.type === 'agent-cancel') this.emit({ id: message.id, type: 'error', text: 'Release-tour cancellation.' });
          else if (message.type === 'agent-run' && message.role === 'architect') this.emit({
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
          });
          else if (message.type === 'agent-run' && message.role === 'critic') this.emit({
            id: message.id,
            type: 'answer',
            text: JSON.stringify({ passed: true, issues: [], summary: 'Validated.' }),
          });
          else this.emit({ id: message.id, type: 'answer', text: `${message.role ?? 'Local tutor'} completed.` });
        });
      }
      terminate() { this.listeners.clear(); }
    }
    Object.defineProperty(window, 'Worker', { configurable: true, value: TourWorker });

    type Events = {
      onReady: (event: { target: TourPlayer }) => void;
      onStateChange?: (event: { data: number; target: TourPlayer }) => void;
    };
    class TourPlayer {
      private state = -1;
      private readonly events: Events;
      constructor(_element: HTMLIFrameElement, options: { events: Events }) {
        this.events = options.events;
        queueMicrotask(() => this.events.onReady({ target: this }));
      }
      destroy() {}
      isMuted() { return false; }
      mute() {}
      unMute() {}
      setVolume() {}
      setLoop() {}
      setShuffle() {}
      pauseVideo() { this.state = 2; this.events.onStateChange?.({ data: 2, target: this }); }
      playVideo() { this.state = 1; this.events.onStateChange?.({ data: 1, target: this }); }
      getPlayerState() { return this.state; }
      nextVideo() {}
      previousVideo() {}
      getPlaylist() { return ['8zj8h15VmQw']; }
      getPlaylistIndex() { return 0; }
      getVideoData() { return { title: 'Up', video_id: '8zj8h15VmQw' }; }
      playVideoAt() { this.playVideo(); }
      getCurrentTime() { return 0; }
      getDuration() { return 191; }
      seekTo() {}
      loadPlaylist() {}
    }
    Object.defineProperty(state, 'YT', { configurable: true, value: { Player: TourPlayer } });
  });

  await page.goto('/');
  const preset = page.getByLabel('Algorithm preset');
  const selectPreset = async (name: string) => {
    const option = preset.locator('option').filter({ hasText: name });
    await preset.selectOption(await option.getAttribute('value') ?? '');
  };

  await selectPreset('Quick Sort');
  await page.getByRole('textbox', { name: 'Array Simulation Input:' }).fill('[11,4,9,2]');
  await page.getByRole('button', { name: /Simulate/ }).click();
  await page.getByRole('button', { name: 'Next step' }).click();
  await page.getByRole('button', { name: 'Pin array' }).click();
  await page.getByRole('button', { name: 'Previous step' }).click();
  await page.getByRole('button', { name: 'Next step' }).click();
  await expect(page.getByRole('region', { name: 'Pinned variables' })).toContainText('[11,4,9,2]');

  await selectPreset('Knuth-Morris-Pratt (KMP)');
  await page.getByRole('textbox', { name: 'String Simulation Input:' }).fill('İstanbul🙂İstanbul');
  await page.getByRole('textbox', { name: 'Pattern', exact: true }).fill('🙂İs');
  await page.getByRole('button', { name: /Simulate/ }).click();
  await expect(page.getByLabel('Knuth-Morris-Pratt (KMP) execution')).toBeVisible();

  await selectPreset('Binary Tree Inorder Traversal');
  await page.getByText('Import / export').click();
  await page.locator('.graph-import-export textarea').fill('[8,3,10,null,6]');
  await page.getByRole('button', { name: 'Import level-order tree' }).click();
  await page.getByRole('button', { name: /Simulate/ }).click();
  await expect(page.getByLabel('Binary Tree Inorder Traversal execution')).toBeVisible();

  await selectPreset("Dijkstra's Shortest Path");
  await page.getByRole('button', { name: /Simulate/ }).click();
  await expect(page.getByLabel("Dijkstra's Shortest Path execution")).toBeVisible();
  const stepBeforeTheme = await page.locator('.visualizer-header-actions > span').textContent();
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: /UI Settings/ }).click();
  await page.getByRole('button', { name: 'Dark' }).click();
  await page.getByRole('button', { name: 'Light' }).click();
  await page.getByRole('button', { name: 'Neon' }).click();
  await page.getByRole('button', { name: 'Türkçe (TR)' }).click();
  await page.getByRole('button', { name: 'English (EN)' }).click();
  await page.getByRole('button', { name: 'Close settings' }).click();
  await expect(page.locator('.visualizer-header-actions > span')).toHaveText(stepBeforeTheme ?? '');

  const question = page.getByPlaceholder('Type your question here...');
  await expect(question).toBeEnabled();
  await question.fill('Explain the current shortest-path step');
  await question.press('Enter');
  await expect(page.getByText('Local tutor completed.')).toBeVisible();
  await question.fill('Open the DFS page');
  await question.press('Enter');
  await expect(page.getByLabel('Depth First Search (DFS) execution')).toBeVisible();

  await question.fill('write bidirectional BFS for me');
  await question.press('Enter');
  await expect(page.getByLabel(/Bidirectional BFS.*Custom execution/)).toBeVisible();
  const nodesBefore = await page.locator('.graph-node').count();
  await question.fill('Add two nodes to this graph and make the last one target');
  await question.press('Enter');
  await expect(page.getByText(/Compatible input and trace applied/i)).toBeVisible();
  await expect.poll(() => page.locator('.graph-node').count()).toBe(nodesBefore + 2);

  await page.evaluate(() => { (window as Window & { __holdTitanMode?: boolean }).__holdTitanMode = true; });
  await question.fill('write bidirectional BFS for me');
  await question.press('Enter');
  await expect(page.locator('.titan-mode-agent.running')).toHaveCount(1);
  await page.getByRole('button', { name: 'Cancel agent run' }).click();
  await expect(page.locator('.titan-mode-progress')).toHaveCount(0);
  await expect(page.getByLabel(/Bidirectional BFS.*Custom execution/)).toBeVisible();

  await page.getByRole('button', { name: 'Open CodeXRay Radio' }).click();
  const radio = page.getByRole('complementary', { name: 'Radio' });
  await radio.locator('button[title="Play"]').click();
  await expect(radio.locator('button[title="Pause"]')).toBeVisible();
  await radio.locator('button[title="Loop current track"]').click();
  await page.getByRole('button', { name: 'Close CodeXRay Radio' }).click();
  await expect(page.getByRole('button', { name: 'Open CodeXRay Radio' })).toBeVisible();

  const splitter = page.getByRole('separator', { name: 'Resize left and right panels' });
  await splitter.focus();
  await splitter.press('ArrowRight');
  await page.getByRole('button', { name: 'Collapse Controls' }).click();
  await page.getByRole('button', { name: 'Expand Controls' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);

  await page.setViewportSize({ width: 1280, height: 720 });
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: /UI Settings/ }).click();
  await page.getByRole('button', { name: 'Reset interface' }).click();
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: /UI Settings/ }).click();
  page.once('dialog', (dialog) => void dialog.accept());
  await page.getByRole('button', { name: 'Reset site data' }).click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('portfolio.release-sentinel'))).toBe('preserve-me');
});
