import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('codexray.locale', 'en');
    localStorage.setItem('codexray.radio.autoplay', 'false');
  });
});

test('rejects a negative Dijkstra edge without replacing the valid timeline and recovers', async ({ page }) => {
  await page.goto('/');
  const preset = page.getByLabel('Algorithm preset');
  const dijkstra = preset.locator('option').filter({ hasText: "Dijkstra's Shortest Path" });
  await preset.selectOption(await dijkstra.getAttribute('value') ?? '');

  await page.getByRole('button', { name: /Simulate/ }).click();
  const progress = page.locator('.visualizer-header-actions > span');
  await expect(progress).toHaveText(/^1 \/ \d+$/);
  const originalTotal = Number((await progress.textContent())?.split('/')[1].trim());
  await page.getByRole('button', { name: 'Next step' }).click();
  await expect(progress).toHaveText(`2 / ${originalTotal}`);

  await page.getByRole('button', { name: 'Edit input' }).click();
  await page.getByRole('button', { name: 'Edit edge A to B' }).click();
  await page.getByLabel('Edge A to B weight').fill('-5');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByRole('button', { name: /Simulate/ }).click();
  await expect(page.getByRole('alert')).toContainText('Negative edge weights');

  await page.getByRole('button', { name: 'Show simulation' }).click();
  await expect(progress).toHaveText(`2 / ${originalTotal}`);
  await expect(page.getByLabel("Dijkstra's Shortest Path execution")).toBeVisible();

  await page.getByRole('button', { name: 'Edit input' }).click();
  await page.getByRole('button', { name: 'Edit edge A to B' }).click();
  await page.getByLabel('Edge A to B weight').fill('9');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByRole('button', { name: /Simulate/ }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(progress).toHaveText(/^1 \/ \d+$/);
});
