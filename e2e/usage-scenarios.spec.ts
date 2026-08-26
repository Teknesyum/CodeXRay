import { expect, test, type Page } from '@playwright/test';

const prepare = async (page: Page) => {
  await page.addInitScript(() => {
    localStorage.setItem('codexray.locale', 'tr');
    localStorage.setItem('codexray.ai.autoLoad', 'false');
    localStorage.setItem('codexray.ai.titanMode', 'true');
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
  await expect(page.locator('.context-chip')).toHaveText(/Adım 1\/\d+/);
  await expect(page.getByRole('button', { name: 'Sonraki adım' })).toBeEnabled();

  const expanded = await input.inputValue();
  const descending = [...JSON.parse(expanded) as number[]].sort((left, right) => right - left);
  await chat.fill('diziyi azalan sırala');
  await chat.press('Enter');
  await expect.poll(async () => JSON.parse(await input.inputValue())).toEqual(descending);
  await expect(page.locator('.context-chip')).toHaveText(/Adım 1\/\d+/);

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

test('changes a numeric algorithm parameter and rebuilds its trace from a natural command', async ({ page }) => {
  await prepare(page);
  const preset = page.locator('select.registry-select');
  const option = preset.locator('option').filter({ hasText: /Binary Search|İkili Arama/ });
  await preset.selectOption(await option.getAttribute('value') ?? '');
  await page.getByRole('button', { name: /Simüle Et/ }).click();
  const parameter = page.locator('.parameter-field input');
  const targetVariable = page.getByTestId('variable-target');
  const beforeTarget = await targetVariable.textContent();

  const chat = page.getByPlaceholder('Sorunuzu buraya yazın...');
  await chat.fill('hedefi 42 yap');
  await chat.press('Enter');

  await expect(parameter).toHaveValue('42');
  await expect(targetVariable).toContainText('42');
  await expect(page.locator('.context-chip')).toHaveText(/Adım 1\/\d+/);
  expect(beforeTarget).not.toContain('42');
});

test('changes a text algorithm parameter and rebuilds its trace from a quoted command', async ({ page }) => {
  await prepare(page);
  const preset = page.locator('select.registry-select');
  const option = preset.locator('option').filter({ hasText: /KMP/ });
  await preset.selectOption(await option.getAttribute('value') ?? '');
  await page.getByRole('button', { name: /Simüle Et/ }).click();
  const parameter = page.locator('.parameter-field input');
  const patternVariable = page.getByTestId('variable-pattern');
  const beforePattern = await patternVariable.textContent();

  const chat = page.getByPlaceholder('Sorunuzu buraya yazın...');
  await chat.fill('deseni “abc” yap');
  await chat.press('Enter');

  await expect(parameter).toHaveValue('abc');
  await expect(patternVariable).toContainText('abc');
  await expect(page.locator('.context-chip')).toHaveText(/Adım 1\/\d+/);
  expect(beforePattern).not.toContain('abc');
});
