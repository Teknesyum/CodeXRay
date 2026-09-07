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

test('runs a deterministic DP template through the five visible pipeline stages and applies it', async ({ page }) => {
  await prepare(page);
  const chat = page.getByPlaceholder('Type your question here...');
  await chat.fill('Solve and simulate LeetCode 198 House Robber in Java with [2,7,9,3,1]. Show every 1D DP state.');
  await chat.press('Enter');

  const liveSource = page.locator('.titan-mode-code-typing');
  await expect(liveSource).toBeVisible();
  await expect(page.locator('.titan-mode-agent .agent-role')).toHaveText([
    'Route',
    'Produce',
    'Semantics',
    'Verify',
    'Apply',
  ]);

  await expect(page.getByLabel('LeetCode 198 — House Robber execution')).toBeVisible();
  await expect(page.locator('.code-display')).toContainText('dp[i] = Math.max(take, skip);');
  await expect(page.locator('.titan-mode-percent')).toHaveText('100%');
});

test('refuses a deterministic template whose declared answer key is missing and leaves the workspace unchanged', async ({ page }) => {
  await page.route(/\/src\/services\/titan\/titanPipeline\.ts(?:\?.*)?$/, async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    const guard = 'expectedKey.length === 0';
    expect(body).toContain(guard);
    await route.fulfill({ response, body: body.replace(guard, 'expectedKey.length >= 0') });
  });
  await prepare(page);
  const codeSource = page.locator('.code-textarea');
  const sourceBefore = await codeSource.inputValue();

  const chat = page.getByPlaceholder('Type your question here...');
  await chat.fill('Solve and simulate LeetCode 198 House Robber in Java with [2,7,9,3,1]. Show every 1D DP state.');
  await chat.press('Enter');

  await expect(page.getByRole('paragraph').filter({
    hasText: 'The generated package could not be verified. The workspace was not changed.',
  })).toBeVisible();
  await expect(page.getByLabel('LeetCode 198 — House Robber execution')).toHaveCount(0);
  await expect(codeSource).toHaveValue(sourceBefore);
});
