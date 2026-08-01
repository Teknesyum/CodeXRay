import { expect, test } from '@playwright/test';

test('asks for missing algorithm requirements without mutation and resumes with a concrete request', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('codexray.locale', 'en');
    localStorage.setItem('codexray.ai.autoLoad', 'false');
    localStorage.setItem('codexray.ai.godMode', 'true');
    localStorage.setItem('codexray.radio.autoplay', 'false');
  });
  await page.goto('/');
  const source = page.getByRole('textbox', { name: 'Source code' });
  const input = page.getByRole('textbox', { name: 'Array Simulation Input:' });
  const sourceBefore = await source.inputValue();
  const inputBefore = await input.inputValue();
  const question = page.getByPlaceholder('Type your question here...');

  await question.fill('write an algorithm');
  await question.press('Enter');
  await expect(page.getByText(/Which algorithm should I create/)).toBeVisible();
  await expect(page.locator('.god-mode-progress')).toHaveCount(0);
  await expect(source).toHaveValue(sourceBefore);
  await expect(input).toHaveValue(inputBefore);
  await expect(question).toBeEnabled();

  await question.fill('write bidirectional BFS for me');
  await question.press('Enter');
  await expect(page.getByLabel(/Bidirectional BFS.*Custom execution/)).toBeVisible();
  await expect(page.getByText(/code, input, and \d+-step simulation were applied/i)).toBeVisible();
});
