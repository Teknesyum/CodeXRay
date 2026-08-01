import { expect, test, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('codexray.locale', 'en');
    localStorage.setItem('codexray.ai.autoLoad', 'false');
    localStorage.setItem('codexray.radio.autoplay', 'false');
  });
});

const finishTimeline = async (page: Page) => {
  const progress = page.locator('.visualizer-header-actions > span');
  const total = Number((await progress.textContent())?.split('/')[1].trim());
  for (let index = 1; index < total; index += 1) await page.getByRole('button', { name: 'Next step' }).click();
};

test('finds and then clears Unicode KMP results without replacing user text', async ({ page }) => {
  await page.goto('/');
  const preset = page.getByLabel('Algorithm preset');
  const kmp = preset.locator('option').filter({ hasText: 'Knuth-Morris-Pratt' });
  await preset.selectOption(await kmp.getAttribute('value') ?? '');
  const text = page.getByRole('textbox', { name: 'String Simulation Input:' });
  const pattern = page.getByRole('textbox', { name: 'Pattern', exact: true });
  await text.fill('ÇAĞRI🙂ÇAĞRI');
  await pattern.fill('ĞRI🙂');
  await page.getByRole('button', { name: /Simulate/ }).click();
  await finishTimeline(page);
  await expect(page.getByTestId('variable-matches').locator('.trace-primitive')).toHaveText(['2']);
  await expect(text).toHaveValue('ÇAĞRI🙂ÇAĞRI');
  await expect(pattern).toHaveValue('ĞRI🙂');

  await pattern.fill('🚀');
  await page.getByRole('button', { name: /Simulate/ }).click();
  await finishTimeline(page);
  await expect(page.getByTestId('variable-matches').locator('.trace-primitive')).toHaveCount(0);
  await expect(page.getByTestId('variable-matches')).toContainText('Array(0)');
  await expect(page.locator('.string-char.match')).toHaveCount(0);
  await expect(text).toHaveValue('ÇAĞRI🙂ÇAĞRI');
  await expect(pattern).toHaveValue('🚀');
});

test('clears incompatible timeline and analysis while touring catalog families', async ({ page }) => {
  await page.goto('/');
  const preset = page.getByLabel('Algorithm preset');
  const inputKind = page.getByLabel('Simulation Input:', { exact: true });
  const tour = [
    { name: 'Quick Sort', kind: 'array' },
    { name: 'Knuth-Morris-Pratt (KMP)', kind: 'string' },
    { name: 'Depth First Search (DFS)', kind: 'graph' },
    { name: 'Binary Tree Preorder Traversal', kind: 'tree' },
    { name: '0/1 Knapsack', kind: 'array' },
    { name: 'Reverse Linked List', kind: 'array' },
  ];
  let previousName: string | null = null;
  for (const item of tour) {
    const option = preset.locator('option').filter({ hasText: item.name });
    await preset.selectOption(await option.getAttribute('value') ?? '');
    if (previousName) await expect(page.getByLabel(`${previousName} execution`)).toHaveCount(0);
    await expect(inputKind).toHaveValue(item.kind);
    await expect(page.getByRole('button', { name: 'Previous step' })).toBeDisabled();
    await expect(page.locator('.system-msg')).not.toContainText('Time Complexity:');
    await page.getByRole('button', { name: 'Analyze' }).click();
    await expect(page.locator('.system-msg')).toContainText('Time Complexity:');
    await page.getByRole('button', { name: /Simulate/ }).click();
    await expect(page.getByLabel(`${item.name} execution`)).toBeVisible();
    previousName = item.name;
  }
});
