import { expect, test } from '@playwright/test';
import { waitForProgressTerminalState } from '../src/test/progressWatchdog';

const REAL_MODEL_TIMEOUT_MS = 20 * 60 * 1_000;
const MODEL_INACTIVITY_TIMEOUT_MS = Number(
  process.env.CODEXRAY_AI_INACTIVITY_TIMEOUT_MS || 3 * 60 * 1_000,
);

interface WebGpuProbeResult {
  adapterAvailable: boolean;
  reason: string;
}

const probeWebGpuAdapter = async (page: import('@playwright/test').Page) =>
  page.evaluate(async (): Promise<WebGpuProbeResult> => {
    const gpu = (navigator as Navigator & {
      gpu?: { requestAdapter: () => Promise<unknown> };
    }).gpu;
    if (!gpu) {
      return { adapterAvailable: false, reason: 'navigator.gpu is unavailable' };
    }

    try {
      const adapter = await gpu.requestAdapter();
      return {
        adapterAvailable: Boolean(adapter),
        reason: adapter ? 'WebGPU adapter acquired' : 'requestAdapter() returned null',
      };
    } catch (error) {
      return {
        adapterAvailable: false,
        reason: error instanceof Error ? error.message : String(error),
      };
    }
  });

const waitForModelLifecycle = async (
  page: import('@playwright/test').Page,
  phase: 'first-load' | 'cache-return',
  observedProgress: number[],
  observedStatuses: string[] = [],
  pollIntervalMs = 1_000,
) => waitForProgressTerminalState({
  inactivityTimeoutMs: MODEL_INACTIVITY_TIMEOUT_MS,
  pollIntervalMs,
  readSnapshot: async () => {
    const ready = await page.getByRole('button', { name: 'Model ready' }).isVisible();
    const failure = page.locator('.ai-status.error, .ai-status.unsupported');
    const failureVisible = await failure.isVisible();
    const progress = page.getByRole('progressbar', { name: 'Model download progress' });
    const progressVisible = await progress.isVisible();
    const status = (await page.locator('.ai-status').textContent())?.trim()
      || (ready ? 'Model ready' : 'Model initialization requested');
    return {
      progress: ready
        ? 100
        : progressVisible
          ? Number(await progress.getAttribute('value') || 0)
          : null,
      status: failureVisible ? (await failure.textContent())?.trim() || status : status,
      terminal: ready ? 'ready' as const : failureVisible ? 'failed' as const : undefined,
    };
  },
  onChange: ({ progress, status }) => {
    if (progress !== null) observedProgress.push(progress);
    observedStatuses.push(status);
    console.log(`[real-ai] phase=${phase}; progress=${progress ?? 'unknown'}%; status=${status}`);
  },
});

const expectTruthfulProgress = (observedProgress: number[]) => {
  expect(observedProgress.length).toBeGreaterThan(0);
  expect(observedProgress).toEqual([...observedProgress].sort((left, right) => left - right));
  expect(observedProgress.at(-1)).toBe(100);
  expect(observedProgress.slice(0, -1).every((progress) => progress < 100)).toBe(true);
};

test.describe('real on-device WebLLM', () => {
  test.skip(
    process.env.CODEXRAY_REAL_AI !== '1',
    'Run explicitly with npm run test:e2e:ai on a WebGPU-capable machine.',
  );

  test('downloads, initializes, and answers with the default local model', async ({
    page,
    browserName,
  }) => {
    test.setTimeout(REAL_MODEL_TIMEOUT_MS);

    await page.addInitScript(() => {
      localStorage.setItem('codexray.locale', 'en');
      if (localStorage.getItem('codexray.ai.autoLoad') === null) {
        localStorage.setItem('codexray.ai.autoLoad', 'false');
      }
      localStorage.setItem('codexray.radio.autoplay', 'false');
    });
    await page.goto('/');

    const webGpu = await probeWebGpuAdapter(page);
    test.skip(
      !webGpu.adapterAvailable,
      `This regression suite requires a usable WebGPU adapter: ${webGpu.reason}.`,
    );

    await page.getByRole('button', { name: 'Settings' }).click();
    const modelId = await page.getByLabel('On-device model').inputValue();
    const userAgent = await page.evaluate(() => navigator.userAgent);
    const initializationStartedAt = Date.now();
    await page.getByRole('button', { name: 'Load local model' }).click();

    console.log(
      `[real-ai] browser=${browserName}; model=${modelId}; ${webGpu.reason}; userAgent=${userAgent}`,
    );
    const firstLoadProgress: number[] = [];
    const terminalState = await waitForModelLifecycle(page, 'first-load', firstLoadProgress);
    console.log(`[real-ai] first-load-ms=${Date.now() - initializationStartedAt}`);
    expect(
      terminalState,
      `Local model initialization failed: ${terminalState.status}`,
    ).toMatchObject({ terminal: 'ready' });
    expectTruthfulProgress(firstLoadProgress);
    await page.getByRole('button', { name: 'Close settings' }).click();

    const question = page.getByPlaceholder('Type your question here...');
    await expect(question).toBeEnabled();
    const askModel = async (prompt: string) => {
      const copyButtons = page.getByRole('button', { name: 'Copy AI response' });
      const previousCount = await copyButtons.count();
      await question.fill(prompt);
      await question.press('Enter');
      await expect(copyButtons).toHaveCount(previousCount + 1, { timeout: 180_000 });
      await expect(page.locator('.chat-message.ai-msg.typing')).toHaveCount(0);
      return copyButtons.nth(previousCount).locator('..');
    };

    const latestAnswer = await askModel(
      'In one short sentence, state the time complexity of binary search.',
    );
    await expect(latestAnswer).toContainText(/logarith|O\s*\(\s*log\s*n\s*\)/i);
    await expect(latestAnswer).not.toContainText(/<(?:think|analysis|reasoning)>/i);
    await expect(page.getByRole('button', { name: 'Copy AI response' }).last()).toBeVisible();

    await askModel('Open the DFS page.');
    await expect(page.getByLabel('Depth First Search (DFS) execution')).toBeVisible();
    const stepAnswer = await askModel(
      "DFS'i 10. adıma kadar ilerlet ve mevcut doğrulanmış adımı kısaca açıkla.",
    );
    await expect(page.locator('.visualizer-header-actions > span')).toContainText(/^10 \/ /);
    await expect(stepAnswer).not.toContainText(
      /Specific User Input|Snapshot Data|System Prompt|CODEXRAY_ACTION|Assume learner|Conflict Check|<(?:think|analysis|reasoning)>/i,
    );

    const execution = page.getByLabel('Depth First Search (DFS) execution');
    const sourceBeforeClear = await execution.textContent();
    const workspaceBeforeClear = await page.evaluate(() =>
      localStorage.getItem('codexray.workspace.v1'));
    const variablesBeforeClear = await page.locator('.variables-content').textContent();
    const stepBeforeClear = await page.locator('.visualizer-header-actions > span').textContent();
    const clearConversation = page.getByRole('button', { name: 'Clear conversation memory' });
    await clearConversation.click();
    await expect(page.locator('.chat-message.ai-msg, .chat-message.user-msg')).toHaveCount(0);
    await expect(clearConversation).toBeDisabled();
    await expect(execution).toHaveText(sourceBeforeClear || '');
    expect(await page.evaluate(() => localStorage.getItem('codexray.workspace.v1')))
      .toBe(workspaceBeforeClear);
    await expect(page.locator('.variables-content')).toHaveText(variablesBeforeClear || '');
    await expect(page.locator('.visualizer-header-actions > span')).toHaveText(stepBeforeClear || '');

    await page.reload();
    await page.getByRole('button', { name: 'Settings' }).click();
    await expect(page.getByText('Model files are stored locally')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Initialize stored model' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Model ready' })).toHaveCount(0);

    await page.evaluate(() => localStorage.setItem('codexray.ai.autoLoad', 'true'));
    const cacheWeightRequests: string[] = [];
    const captureCacheRequest = (request: import('@playwright/test').Request) => {
      if (/huggingface\.co|raw\.githubusercontent\.com|mlc-ai/i.test(request.url())) {
        cacheWeightRequests.push(request.url());
      }
    };
    page.on('request', captureCacheRequest);
    const cacheReturnStartedAt = Date.now();
    await page.reload();
    await page.getByRole('button', { name: 'Settings' }).click();
    const cacheProgress: number[] = [];
    const cacheStatuses: string[] = [];
    const cacheTerminalState = await waitForModelLifecycle(
      page,
      'cache-return',
      cacheProgress,
      cacheStatuses,
      100,
    );
    page.off('request', captureCacheRequest);
    const cacheReturnMs = Date.now() - cacheReturnStartedAt;
    console.log(`[real-ai] cache-return-ms=${cacheReturnMs}`);
    expect(
      cacheTerminalState,
      `Cached model initialization failed: ${cacheTerminalState.status}`,
    ).toMatchObject({ terminal: 'ready' });
    expectTruthfulProgress(cacheProgress);
    expect(cacheStatuses.some((status) => /Loading model from cache/i.test(status))).toBe(true);
    expect(cacheStatuses.some((status) => /Fetching param cache/i.test(status))).toBe(false);
    expect(cacheWeightRequests.filter((url) => /params[_-]shard|\.bin(?:\?|$)/i.test(url))).toEqual([]);
    expect(cacheReturnMs).toBeLessThan(30_000);
    await expect(page.getByText('Model files are stored locally')).toBeVisible();

    const workspaceBeforeDelete = await page.evaluate(() =>
      localStorage.getItem('codexray.workspace.v1'));
    const algorithmBeforeDelete = await page.getByLabel('Algorithm preset').inputValue();
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', {
      name: /Delete stored model Qwen2\.5 Coder 0\.5B/,
    }).click();
    await expect(page.getByText('No model files are currently stored for this site.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Load local model' })).toBeEnabled();
    expect(await page.evaluate(() => localStorage.getItem('codexray.workspace.v1')))
      .toBe(workspaceBeforeDelete);
    await expect(page.getByLabel('Algorithm preset')).toHaveValue(algorithmBeforeDelete);
  });
});
