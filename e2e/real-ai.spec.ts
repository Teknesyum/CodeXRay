import { expect, test } from '@playwright/test';

const REAL_MODEL_TIMEOUT_MS = 20 * 60 * 1_000;

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

test.describe('real on-device WebLLM', () => {
  test.skip(
    process.env.CODEXRAY_REAL_AI !== '1',
    'Run explicitly with npm run test:e2e:ai on a WebGPU-capable machine.',
  );

  test('downloads, initializes, and answers with the default local model', async ({ page }) => {
    test.setTimeout(REAL_MODEL_TIMEOUT_MS);

    await page.addInitScript(() => {
      localStorage.setItem('codexray.locale', 'en');
      localStorage.setItem('codexray.ai.autoLoad', 'false');
      localStorage.setItem('codexray.radio.autoplay', 'false');
    });
    await page.goto('/');

    const webGpu = await probeWebGpuAdapter(page);
    test.skip(
      !webGpu.adapterAvailable,
      `This regression suite requires a usable WebGPU adapter: ${webGpu.reason}.`,
    );

    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByRole('button', { name: 'Load local model' }).click();

    console.log(
      `[real-ai] ${webGpu.reason}; waiting up to ${Math.round((REAL_MODEL_TIMEOUT_MS - 60_000) / 60_000)} minutes for model initialization.`,
    );
    const terminalState = await Promise.race([
      page.getByRole('button', { name: 'Model ready' }).waitFor({
        state: 'visible',
        timeout: REAL_MODEL_TIMEOUT_MS - 60_000,
      }).then(() => 'ready'),
      page.locator('.ai-status.error, .ai-status.unsupported').waitFor({
        state: 'visible',
        timeout: REAL_MODEL_TIMEOUT_MS - 60_000,
      }).then(async () => {
        const message = await page.locator('.ai-status.error, .ai-status.unsupported').textContent();
        return `failed: ${message?.trim() || 'unknown local AI error'}`;
      }),
    ]);
    expect(terminalState, 'Local model initialization must not end in an error state.').toBe('ready');
    await page.getByRole('button', { name: 'Close settings' }).click();

    const question = page.getByPlaceholder('Type your question here...');
    await expect(question).toBeEnabled();
    await question.fill('In one short sentence, state the time complexity of binary search.');
    await question.press('Enter');

    const latestAnswer = page.locator('.chat-message.ai-msg').last();
    await expect(latestAnswer).toBeVisible({ timeout: 180_000 });
    await expect(latestAnswer).toContainText(/logarith|O\s*\(\s*log\s*n\s*\)/i);
    await expect(latestAnswer).not.toContainText(/<(?:think|analysis|reasoning)>/i);
    await expect(page.getByRole('button', { name: 'Copy AI response' }).last()).toBeVisible();
  });
});
