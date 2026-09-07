import { expect, test, type Page } from '@playwright/test';

const prepare = async (page: Page) => {
  await page.addInitScript(() => {
    localStorage.setItem('codexray.locale', 'en');
    localStorage.setItem('codexray.ai.autoLoad', 'false');
    localStorage.setItem('codexray.ai.titanMode', 'true');
    localStorage.setItem('codexray.radio.autoplay', 'false');
  });
  await page.goto('/');
};

test('types the Jump Game DP source into the editor while the array-template pipeline produces it', async ({ page }) => {
  await prepare(page);
  const coldSource = page.locator('.code-textarea');
  await expect(coldSource).toBeVisible();

  const chat = page.getByPlaceholder('Type your question here...');
  await chat.fill('Solve and simulate Jump Game with dynamic programming');
  await chat.press('Enter');

  const typingSource = page.locator('.titan-mode-code-typing');
  await expect(typingSource).toBeVisible();

  await expect(page.getByLabel(/LeetCode 55 — Jump Game \(DP\).*execution/)).toBeVisible();
  await expect(page.locator('.code-display')).toContainText('reachable');
});
