import { expect, test, type Page } from '@playwright/test';

const prepare = async (page: Page) => {
  await page.addInitScript(() => {
    localStorage.setItem('codexray.locale', 'en');
    localStorage.setItem('codexray.ai.autoLoad', 'false');
    localStorage.setItem('codexray.ai.godMode', 'true');
    localStorage.setItem('codexray.radio.autoplay', 'false');
  });
  await page.goto('/');
};

const pauseAndRewind = async (page: Page) => {
  const pause = page.getByRole('button', { name: 'Pause' });
  if (await pause.isVisible().catch(() => false)) await pause.click();
  const previous = page.getByRole('button', { name: 'Previous step' });
  while (await previous.isEnabled()) await previous.click();
};

const advanceToEnd = async (page: Page) => {
  const next = page.getByRole('button', { name: 'Next step' });
  while (await next.isEnabled()) await next.click();
};

test('authors, visualizes, and teaches a 1D House Robber DP recurrence', async ({ page }) => {
  await prepare(page);
  const chat = page.getByPlaceholder('Type your question here...');
  await chat.fill('Solve and simulate LeetCode 198 House Robber with [2,7,9,3,1]. Show every 1D DP state.');
  await chat.press('Enter');
  await expect(page.getByLabel('LeetCode 198 — House Robber execution')).toBeVisible();
  await expect(page.locator('.code-display')).toContainText('dp[i] = max(take, skip);');
  await expect(page.locator('.god-mode-percent')).toHaveText('100%');
  await pauseAndRewind(page);
  await advanceToEnd(page);
  await expect(page.locator('.step-explanation')).toContainText('final 1D DP result is 12');
  await expect(page.locator('.variables-content')).toContainText('result');
  await expect(page.locator('.variables-content')).toContainText('12');
});

test('authors a rectangular LCS table and exposes exact dependencies', async ({ page }) => {
  await prepare(page);
  const chat = page.getByPlaceholder('Type your question here...');
  await chat.fill('Solve LCS for ["abcde","ace"] and show every 2D DP state.');
  await chat.press('Enter');
  await expect(page.getByLabel('LeetCode 1143 — Longest Common Subsequence execution')).toBeVisible();
  await expect(page.getByRole('grid', { name: 'DP table' })).toBeVisible();
  await expect(page.locator('.matrix-cell')).toHaveCount(24);
  await pauseAndRewind(page);
  const next = page.getByRole('button', { name: 'Next step' });
  for (let index = 0; index < 10; index += 1) await next.click();
  await expect(page.locator('.matrix-cell[data-role="active"]')).toHaveCount(1);
  await expect(page.locator('.matrix-cell[data-role="dependency"]')).toHaveCount(1);
  await advanceToEnd(page);
  await expect(page.locator('.matrix-cell[data-role="result"]')).toHaveCount(1);
  await expect(page.locator('.step-explanation')).toContainText('LCS length is 3');
});

test('authors an interval-palindrome table and preserves diagonal fill semantics', async ({ page }) => {
  await prepare(page);
  const chat = page.getByPlaceholder('Type your question here...');
  await chat.fill('Solve LeetCode 516 longest palindromic subsequence for "bbbab" and simulate the interval DP table.');
  await chat.press('Enter');
  await expect(page.getByLabel('LeetCode 516 — Longest Palindromic Subsequence execution')).toBeVisible();
  await expect(page.locator('.matrix-fill-direction')).toContainText('diagonal / increasing interval');
  await expect(page.locator('.matrix-cell')).toHaveCount(25);
  await pauseAndRewind(page);
  await advanceToEnd(page);
  await expect(page.locator('.step-explanation')).toContainText('length is 4');
  await expect(page.locator('.matrix-cell[data-role="result"]')).toHaveCount(1);
});
