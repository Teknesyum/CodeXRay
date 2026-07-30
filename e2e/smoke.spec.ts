import { expect, test } from '@playwright/test';

test('runs DFS and exposes the complete visited trace', async ({ page }) => {
  await page.goto('/');
  const select = page.getByLabel('Algorithm preset');
  const dfsValue = await select.locator('option').filter({ hasText: 'Depth First Search' }).getAttribute('value');
  await select.selectOption(dfsValue ?? '');
  await expect(page.locator('.panel-right .graph-input-editor')).toBeVisible();
  await expect(page.locator('.panel-left .graph-input-editor')).toHaveCount(0);
  await page.getByRole('button', { name: /Simulate/ }).click();
  await expect(page.getByLabel('Depth First Search (DFS) execution')).toBeVisible();
  await page.getByRole('button', { name: 'Play' }).click();
  await page.getByRole('button', { name: 'Pause' }).click();
  await expect(page.getByText(/tracked/)).toBeVisible();
});

test('switches the visible interface to Turkish instantly', async ({ page }) => {
  await page.goto('/');
  const select = page.getByLabel('Algorithm preset');
  const dfsValue = await select.locator('option').filter({ hasText: 'Depth First Search' }).getAttribute('value');
  await select.selectOption(dfsValue ?? '');
  await page.getByRole('button', { name: /Simulate/ }).click();
  await page.getByRole('button', { name: 'Türkçeye geç' }).click();
  await expect(page.getByRole('heading', { name: 'Kaynak Kod' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Simüle Et/ })).toBeVisible();
  await expect(page.getByText('Değişkenler ve İz')).toBeVisible();
  await expect(page.locator('.step-explanation')).toContainText('düğümünü ziyaret et');
  await expect(page.locator('html')).toHaveAttribute('lang', 'tr');
});

test('accepts custom array input for a sorting algorithm', async ({ page }) => {
  await page.goto('/');
  const select = page.getByLabel('Algorithm preset');
  const selectionValue = await select.locator('option').filter({ hasText: 'Selection Sort' }).getAttribute('value');
  await select.selectOption(selectionValue ?? '');
  await page.getByLabel(/Array.*Simulation Input/).fill('[9, 2, 7, 1]');
  await page.getByRole('button', { name: /Simulate/ }).click();
  await expect(page.getByLabel('Selection Sort execution')).toBeVisible();
  await expect(page.getByText('1 /')).toBeVisible();
});

test('resizes and collapses workspace panels', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('separator')).toHaveCount(4);
  const leftPanel = page.locator('.panel-left');
  const initialWidth = (await leftPanel.boundingBox())?.width ?? 0;
  const splitter = page.getByRole('separator', { name: 'Resize left and right panels' });
  const box = await splitter.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move((box?.x ?? 0) + 2, (box?.y ?? 0) + 100);
  await page.mouse.down();
  await page.mouse.move((box?.x ?? 0) + 82, (box?.y ?? 0) + 100);
  await page.mouse.up();
  await expect.poll(async () => (await leftPanel.boundingBox())?.width ?? 0)
    .toBeGreaterThan(initialWidth + 50);

  await page.getByRole('button', { name: 'Collapse Controls' }).click();
  await expect(page.getByRole('button', { name: 'Expand Controls' })).toBeVisible();
});
