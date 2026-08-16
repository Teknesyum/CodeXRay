import { expect, test, type Page } from '@playwright/test';

const pauseAndRewind = async (page: Page) => {
  const pause = page.getByRole('button', { name: 'Pause', exact: true });
  if (await pause.isVisible().catch(() => false)) await pause.click();
  const previous = page.getByRole('button', { name: 'Previous step' });
  while (await previous.isEnabled()) await previous.click();
};

const advanceToEnd = async (page: Page) => {
  const next = page.getByRole('button', { name: 'Next step' });
  while (await next.isEnabled()) await next.click();
};

test('authors and simulates LeetCode 486 as a dependency-grounded 2D interval-DP table', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('codexray.locale', 'en');
    localStorage.setItem('codexray.ai.autoLoad', 'false');
    localStorage.setItem('codexray.ai.titanMode', 'true');
    localStorage.setItem('codexray.radio.autoplay', 'false');
  });
  await page.goto('/');
  const chat = page.getByPlaceholder('Type your question here...');
  await chat.fill('Solve and simulate LeetCode 486 Predict the Winner with [1,5,233,7] using dp[i][j] = max(nums[i] - dp[i+1][j], nums[j] - dp[i][j-1]). Show every 2D DP state.');
  await chat.press('Enter');

  await expect(page.getByLabel('LeetCode 486 — Predict the Winner execution')).toBeVisible();
  await expect(page.locator('.code-display')).toContainText('dp[i][j] = max(takeLeft, takeRight);');
  await expect(page.getByRole('grid', { name: 'DP table' })).toBeVisible();
  await expect(page.locator('.matrix-cell')).toHaveCount(16);
  await expect(page.locator('.titan-mode-percent')).toHaveText('100%');

  const messageLayout = await page.locator('.ai-body > .chat-message').evaluateAll((messages) =>
    messages.map((message) => {
      const bounds = message.getBoundingClientRect();
      return { top: bounds.top, bottom: bounds.bottom };
    }));
  for (let index = 1; index < messageLayout.length; index += 1) {
    expect(messageLayout[index].top).toBeGreaterThanOrEqual(messageLayout[index - 1].bottom - 1);
  }
  const assistantContainment = await page.locator('.ai-assistant').evaluate((assistant) => ({
    clientWidth: assistant.clientWidth,
    scrollWidth: assistant.scrollWidth,
  }));
  expect(assistantContainment.scrollWidth).toBeLessThanOrEqual(assistantContainment.clientWidth + 1);

  await pauseAndRewind(page);
  const next = page.getByRole('button', { name: 'Next step' });
  for (let index = 0; index < 5; index += 1) await next.click();
  await expect(page.locator('.matrix-cell[data-role="active"]')).toHaveCount(1);
  await expect(page.locator('.matrix-cell[data-role="dependency"]')).toHaveCount(2);
  await expect(page.locator('.step-explanation')).toContainText('dp[0][1]');
  await expect(page.locator('.step-explanation')).toContainText('left=1');
  await expect(page.locator('.step-explanation')).toContainText('right=5');

  await advanceToEnd(page);
  await expect(page.locator('.matrix-cell[data-role="result"]')).toHaveCount(1);
  await expect(page.locator('.step-explanation')).toContainText('dp[0][3] = 222');
  await expect(page.locator('.variables-content')).toContainText('winner');
  await expect(page.locator('.variables-content')).toContainText('true');

  const sourceBeforeInputChange = await page.getByLabel('LeetCode 486 — Predict the Winner execution').textContent();
  await chat.fill('Change the input to [1,5,2] and resimulate this DP table.');
  await chat.press('Enter');
  await expect(page.locator('.matrix-cell')).toHaveCount(9);
  await expect(page.getByLabel('LeetCode 486 — Predict the Winner execution'))
    .toHaveText(sourceBeforeInputChange || '');
  await pauseAndRewind(page);
  await advanceToEnd(page);
  await expect(page.locator('.step-explanation')).toContainText('dp[0][2] = -2');
  await expect(page.locator('.variables-content')).toContainText('false');
});
