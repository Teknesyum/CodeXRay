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

test('authors, visualizes, and teaches a 1D House Robber DP recurrence', async ({ page }) => {
  await prepare(page);
  const chat = page.getByPlaceholder('Type your question here...');
  await chat.fill('Solve and simulate LeetCode 198 House Robber in Java with [2,7,9,3,1]. Show every 1D DP state.');
  await chat.press('Enter');
  await expect(page.getByLabel('LeetCode 198 — House Robber execution')).toBeVisible();
  await expect(page.locator('.code-display')).toContainText('int[] dp = new int[n]');
  await expect(page.locator('.code-display')).toContainText('dp[i] = Math.max(take, skip);');
  await expect(page.locator('.code-display')).not.toContainText('vector<int>');
  await expect(page.locator('.titan-mode-percent')).toHaveText('100%');
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
  await expect(page.locator('.code-display')).toContainText('public int longestCommonSubsequence(String text1, String text2)');
  await expect(page.locator('.code-token.keyword').filter({ hasText: 'public' })).toHaveCount(1);
  await expect(page.locator('.code-token.type').filter({ hasText: 'int' })).not.toHaveCount(0);
  await expect(page.locator('.code-token.function').filter({ hasText: 'longestCommonSubsequence' })).toHaveCount(1);
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

test('turns the committed LCS into a space-optimized 1D follow-up without overflowing context', async ({ page }) => {
  await prepare(page);
  const chat = page.getByPlaceholder('Type your question here...');
  await chat.fill('Solve LCS for ["abcde","ace"] and show every 2D DP state.');
  await chat.press('Enter');
  await expect(page.getByLabel('LeetCode 1143 — Longest Common Subsequence execution')).toBeVisible();

  await chat.fill('Memory does not need to be O(m*n). Write the O(min(m,n)) version and simulate it.');
  await chat.press('Enter');
  await expect(page.getByLabel('LeetCode 1143 — Space-Optimized LCS execution')).toBeVisible();
  await expect(page.locator('.code-display')).toContainText('int[] dp = new int[columns.length() + 1]');
  await expect(page.locator('.code-display')).toContainText('diagonal = upper');
  await expect(page.locator('.visual-array')).toBeVisible();
  await expect(page.locator('.ai-msg.system')).toHaveCount(0);
});

test('authors and simulates the exact Java Coin Change contract', async ({ page }) => {
  await prepare(page);
  const chat = page.getByPlaceholder('Type your question here...');
  await chat.fill('bana coin exchange problemi yaz ve simüle et');
  await chat.press('Enter');
  await expect(page.getByLabel('LeetCode 322 — Coin Change execution')).toBeVisible();
  await expect(page.locator('.code-display')).toContainText('public int coinChange(int[] coins, int amount)');
  await pauseAndRewind(page);
  await advanceToEnd(page);
  await expect(page.locator('.step-explanation')).toContainText('minimum coin count is 3');
  await expect(page.locator('.variables-content')).toContainText('result');
  await expect(page.locator('.variables-content')).toContainText('3');
});

test('authors and simulates the exact Java Edit Distance contract as a 2D table', async ({ page }) => {
  await prepare(page);
  const chat = page.getByPlaceholder('Type your question here...');
  await chat.fill('Solve Edit Distance in Java for ["horse","ros"] and simulate the 2D DP table.');
  await chat.press('Enter');
  await expect(page.getByLabel('LeetCode 72 — Edit Distance execution')).toBeVisible();
  await expect(page.locator('.code-display')).toContainText('public int minDistance(String word1, String word2)');
  await expect(page.getByRole('grid', { name: 'DP table' })).toBeVisible();
  await pauseAndRewind(page);
  await advanceToEnd(page);
  await expect(page.locator('.step-explanation')).toContainText('edit distance is 3');
  await expect(page.locator('.matrix-cell[data-role="result"]')).toHaveCount(1);
});

test('authors and simulates the exact Java 0/1 Knapsack contract without item reuse', async ({ page }) => {
  await prepare(page);
  const chat = page.getByPlaceholder('Type your question here...');
  await chat.fill('Solve 0/1 Knapsack in Java weight=[1,3,4,5], value=[1,4,5,7], W=7 and simulate every state.');
  await chat.press('Enter');
  await expect(page.getByLabel('0/1 Knapsack execution')).toBeVisible();
  await expect(page.locator('.code-display')).toContainText('public int knapsack(int[] weight, int[] value, int W)');
  await expect(page.getByRole('grid', { name: 'DP table' })).toBeVisible();
  await pauseAndRewind(page);
  await advanceToEnd(page);
  await expect(page.locator('.step-explanation')).toContainText('maximum knapsack value is 9');
  await expect(page.locator('.matrix-cell[data-role="result"]')).toHaveCount(1);
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

test('routes the exact Turkish palindrome request through agents, types source, then teaches the trace', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('codexray.locale', 'tr');
    localStorage.setItem('codexray.ai.autoLoad', 'false');
    localStorage.setItem('codexray.ai.titanMode', 'true');
    localStorage.setItem('codexray.radio.autoplay', 'false');
  });
  await page.goto('/');
  const chat = page.getByPlaceholder('Sorunuzu buraya yazın...');
  await chat.fill('en uzun palindromik dizi sorusu yaz çöz simüle et');
  await chat.press('Enter');

  const liveSource = page.locator('.titan-mode-code-typing');
  await expect(liveSource).toBeVisible();
  await expect.poll(async () => liveSource.textContent().then((value) => value?.length ?? 0))
    .toBeGreaterThan(0);
  await expect(page.locator('.titan-mode-agent.running')).toContainText('Üret');

  await expect(page.getByLabel('LeetCode 516 — En Uzun Palindromik Alt Dizi çalışması')).toBeVisible();
  await expect(page.locator('.code-display')).toContainText('dp[i][j]');
  await expect(page.getByRole('grid', { name: 'DP tablosu' })).toBeVisible();
  await expect(page.locator('.matrix-fill-direction')).toContainText('artan aralık');
  const groundedAnswer = page.locator('.ai-msg').filter({ hasText: 'Kod:' });
  await expect(groundedAnswer).toHaveCount(1);
  await expect(groundedAnswer).toContainText('Görsel:');
});
