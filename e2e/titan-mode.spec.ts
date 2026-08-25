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
  await expect(page.getByText(['God', 'Mode'].join(' '), { exact: true })).toHaveCount(0);
  const chat = page.getByPlaceholder('Type your question here...');
  await chat.fill('open DFS');
  await chat.press('Enter');
  await expect(page.getByLabel('Depth First Search (DFS) execution')).toBeVisible();
  await chat.fill('go to step 3');
  await chat.press('Enter');
  await expect(page.getByText('The requested workspace action was applied.').last()).toBeVisible();
});

test('shows the five-stage pipeline and a grounded current-step answer', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('codexray.locale', 'en');
    localStorage.setItem('codexray.ai.autoLoad', 'false');
    localStorage.setItem('codexray.ai.titanMode', 'true');
    localStorage.setItem('codexray.radio.autoplay', 'false');
  });
  await page.goto('/');
  const chat = page.getByPlaceholder('Type your question here...');
  await chat.fill('open DFS');
  await chat.press('Enter');
  await expect(page.getByLabel('Depth First Search (DFS) execution')).toBeVisible();
  await chat.fill('explain bunu');
  await chat.press('Enter');

  await expect(page.getByText('Route', { exact: true })).toBeVisible();
  await expect(page.getByText('Produce', { exact: true })).toBeVisible();
  await expect(page.getByText('Semantics', { exact: true })).toBeVisible();
  await expect(page.getByText('Verify', { exact: true })).toBeVisible();
  await expect(page.getByText('Apply', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Semantics: skipped (not required)')).toBeVisible();
  await expect(page.getByText(/Code:.*Data:.*Visual:.*Reasoning:.*Time:/s).last()).toBeVisible();
});
