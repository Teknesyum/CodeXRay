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
