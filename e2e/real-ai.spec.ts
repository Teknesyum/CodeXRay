import { expect, test } from '@playwright/test';

const REAL_MODEL_TIMEOUT_MS = 20 * 60 * 1_000;

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

    const webGpuAvailable = await page.evaluate(() => 'gpu' in navigator);
    test.skip(!webGpuAvailable, 'This regression suite requires a WebGPU-capable browser.');

    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByRole('button', { name: 'Load local model' }).click();

    await expect(page.getByRole('button', { name: 'Model ready' })).toBeVisible({
      timeout: REAL_MODEL_TIMEOUT_MS - 60_000,
    });
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
