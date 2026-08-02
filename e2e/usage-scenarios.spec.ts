import { expect, test, type Page } from '@playwright/test';

const prepare = async (page: Page) => {
  await page.addInitScript(() => {
    localStorage.setItem('codexray.locale', 'tr');
    localStorage.setItem('codexray.ai.autoLoad', 'false');
    localStorage.setItem('codexray.ai.godMode', 'true');
    localStorage.setItem('codexray.radio.autoplay', 'false');
  });
  await page.goto('/');
};

test('changes Jump Game from quadratic DP to linear greedy', async ({ page }) => {
  await prepare(page);
  const chat = page.getByPlaceholder('Sorunuzu buraya yazın...');
  await chat.fill('Jump Game sorusunu dinamik programlama ile çöz ve simüle et');
  await chat.press('Enter');
  await expect(page.getByLabel(/LeetCode 55 — Jump Game \(DP\).*çalışması/)).toBeVisible();
  await expect(page.locator('.analysis-outline')).toContainText('O(n^2)');

  await chat.fill('Şimdi aynı sorunun Greedy yaklaşımıyla çözümünü simüle et');
  await chat.press('Enter');
  await expect(page.getByLabel(/LeetCode 55 — Jump Game \(Greedy\).*çalışması/)).toBeVisible();
  await expect(page.locator('.code-display')).toContainText('farthest');
  await expect(page.locator('.analysis-outline')).toContainText('O(n)');
});

test('changes LIS from quadratic DP to n-log-n binary search', async ({ page }) => {
  await prepare(page);
  const chat = page.getByPlaceholder('Sorunuzu buraya yazın...');
  await chat.fill('LIS sorusunu anlat');
  await chat.press('Enter');
  await expect(page.getByLabel(/LeetCode 300 — Longest Increasing Subsequence \(O\(n²\) DP\).*çalışması/)).toBeVisible();
  await expect(page.locator('.code-display')).toContainText('vector<int> dp');

  await chat.fill('Bunu O(N log N) zamanında çalışacak Binary Search optimizasyonu ile çöz ve simüle et');
  await chat.press('Enter');
  await expect(page.getByLabel(/LeetCode 300 — Longest Increasing Subsequence \(O\(n log n\)\).*çalışması/)).toBeVisible();
  await expect(page.locator('.code-display')).toContainText('lower_bound');
  await expect(page.locator('.analysis-outline')).toContainText('O(n log n)');
});

test('edits, expands, and recompiles the active input from natural commands', async ({ page }) => {
  await prepare(page);
  const chat = page.getByPlaceholder('Sorunuzu buraya yazın...');
  await chat.fill('Jump Game DP çöz ve simüle et');
  await chat.press('Enter');
  await expect(page.getByLabel(/LeetCode 55 — Jump Game \(DP\).*çalışması/)).toBeVisible();
  const input = page.locator('.input-config input[type="text"]').first();
  await expect(input).toHaveValue('[2,3,1,1,4]');

  await chat.fill('inputu genişlet');
  await chat.press('Enter');
  await expect.poll(async () => JSON.parse(await input.inputValue()).length).toBe(8);

  const expanded = await input.inputValue();
  await chat.fill('inputu düzenle');
  await chat.press('Enter');
  await expect.poll(() => input.inputValue()).not.toBe(expanded);
  await expect(page.getByLabel(/LeetCode 55 — Jump Game \(DP\).*çalışması/)).toBeVisible();
});

test('resizes a true matrix simulation to a rectangular 8 by 15 grid', async ({ page }) => {
  await prepare(page);
  const chat = page.getByPlaceholder('Sorunuzu buraya yazın...');
  await chat.fill('Create catalog problem: leetcode/54');
  await chat.press('Enter');
  await expect(page.getByLabel(/LeetCode 54 — Spiral Matris.*çalışması/)).toBeVisible();

  await chat.fill('gridi 8*15 yap');
  await chat.press('Enter');
  await expect(page.locator('.matrix-cell')).toHaveCount(120);
  const matrix = JSON.parse(await page.locator('.input-config input[type="text"]').first().inputValue()) as number[][];
  expect(matrix).toHaveLength(8);
  expect(matrix.every((row) => row.length === 15)).toBe(true);
});
