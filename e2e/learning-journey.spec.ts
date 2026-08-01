import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('codexray.locale', 'en');
    localStorage.setItem('codexray.ai.autoLoad', 'false');
    localStorage.setItem('codexray.radio.autoplay', 'false');
  });
});

test('keeps source, visual data, variables, and pins synchronized while navigating unknown input', async ({ page }) => {
  await page.goto('/');
  const preset = page.getByLabel('Algorithm preset');
  const quickSort = preset.locator('option').filter({ hasText: 'Quick Sort' });
  await preset.selectOption(await quickSort.getAttribute('value') ?? '');
  await page.getByRole('textbox', { name: 'Array Simulation Input:' }).fill('[13,-2,13,0,5]');
  await page.getByRole('button', { name: /Simulate/ }).click();

  const progress = page.locator('.visualizer-header-actions > span');
  await expect(progress).toHaveText(/^1 \/ \d+$/);
  await page.getByRole('button', { name: 'Next step' }).click();
  await expect(progress).toHaveText(/^2 \/ \d+$/);
  const highlightedAtStep2 = await page.locator('.code-line.highlighted').textContent();
  const visualAtStep2 = await page.locator('.visual-array').textContent();
  const variableAtStep2 = await page.getByTestId('variable-array').textContent();
  expect(highlightedAtStep2).toBeTruthy();
  expect(visualAtStep2).toContain('13');
  expect(variableAtStep2).toContain('-2');

  await page.getByRole('button', { name: 'Pin array' }).click();
  const pinned = page.locator('.pinned-watch-item').filter({ hasText: 'array' });
  await expect(pinned).toContainText('[13,-2,13,0,5]');

  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect.poll(async () => Number((await progress.textContent())?.split('/')[0].trim()))
    .toBeGreaterThan(2);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  const pausedIndex = Number((await progress.textContent())?.split('/')[0].trim());
  await page.waitForTimeout(350);
  await expect(progress).toHaveText(new RegExp(`^${pausedIndex} \\/ \\d+$`));

  while (Number((await progress.textContent())?.split('/')[0].trim()) > 2) {
    await page.getByRole('button', { name: 'Previous step' }).click();
  }
  await expect(progress).toHaveText(/^2 \/ \d+$/);
  expect(await page.locator('.code-line.highlighted').textContent()).toBe(highlightedAtStep2);
  expect(await page.locator('.visual-array').textContent()).toBe(visualAtStep2);
  expect(await page.getByTestId('variable-array').textContent()).toBe(variableAtStep2);
  await expect(pinned).toContainText('[13,-2,13,0,5]');

  const binarySearch = preset.locator('option').filter({ hasText: 'Binary Search' });
  await preset.selectOption(await binarySearch.getAttribute('value') ?? '');
  await expect(page.getByLabel('Quick Sort execution')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Previous step' })).toBeDisabled();
  await expect(pinned).toContainText('Not available in this step');
  await expect(pinned).not.toContainText('[13,-2,13,0,5]');
});
