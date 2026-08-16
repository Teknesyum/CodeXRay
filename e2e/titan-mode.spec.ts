import { expect, test } from '@playwright/test';

test('shows Titan naming and keeps deterministic navigation model-independent', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('codexray.locale', 'en');
    localStorage.setItem('codexray.ai.autoLoad', 'false');
    localStorage.setItem('codexray.ai.titanMode', 'true');
    localStorage.setItem('codexray.radio.autoplay', 'false');
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Titan Mode enabled' })).toBeVisible();
  await expect(page.getByText('God Mode', { exact: true })).toHaveCount(0);
  const chat = page.getByPlaceholder('Type your question here...');
  await chat.fill('open DFS');
  await chat.press('Enter');
  await expect(page.getByLabel('Depth First Search (DFS) execution')).toBeVisible();
  await chat.fill('go to step 3');
  await chat.press('Enter');
  await expect(page.getByText('The requested workspace action was applied.').last()).toBeVisible();
});
