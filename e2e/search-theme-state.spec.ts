import { expect, test, type Page } from '@playwright/test';

const finishTimeline = async (page: Page) => {
  const next = page.getByRole('button', { name: /Next step|Sonraki adım/ });
  for (let guard = 0; guard < 250 && !await next.isDisabled(); guard += 1) await next.click();
  await expect(next).toBeDisabled();
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('codexray.locale', 'en');
    localStorage.setItem('codexray.ai.autoLoad', 'false');
    localStorage.setItem('codexray.radio.autoplay', 'false');
  });
});

test('compares found and missing user search targets without stale result state', async ({ page }) => {
  await page.goto('/');
  const preset = page.getByLabel('Algorithm preset');
  const binarySearch = preset.locator('option').filter({ hasText: 'Binary Search' });
  await preset.selectOption(await binarySearch.getAttribute('value') ?? '');

  const input = page.getByRole('textbox', { name: 'Array Simulation Input:' });
  const target = page.locator('.parameter-field').filter({ hasText: 'Target' }).locator('input');
  await input.fill('[2,4,7,11,18,29]');
  await target.fill('11');
  await page.getByRole('button', { name: /Simulate/ }).click();
  await finishTimeline(page);
  await expect(page.getByTestId('variable-foundIndex')).toContainText('3');
  await expect(page.locator('.array-cell.active-pointer')).toContainText('11');
  await expect(page.locator('.pointer-label')).toHaveText('found');

  await target.fill('12');
  await page.getByRole('button', { name: /Simulate/ }).click();
  await expect(page.locator('.visualizer-header-actions > span')).toHaveText(/^1 \/ \d+$/);
  await expect(page.getByTestId('variable-foundIndex')).toContainText('-1');
  await expect(page.locator('.pointer-label').filter({ hasText: /^found$/ })).toHaveCount(0);
  await finishTimeline(page);
  await expect(page.getByTestId('variable-foundIndex')).toContainText('-1');
  await expect(page.locator('.pointer-label').filter({ hasText: /^found$/ })).toHaveCount(0);
  await expect(input).toHaveValue('[2,4,7,11,18,29]');
});

test('changes language and every theme mid-run without regenerating timeline semantics', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Algorithm preset').selectOption({ label: '1 – ✓ Depth First Search (DFS)' });
  await page.getByRole('button', { name: /Simulate/ }).click();
  await page.getByRole('button', { name: 'Next step' }).click();
  await page.getByRole('button', { name: 'Next step' }).click();

  const progress = page.locator('.visualizer-header-actions > span');
  const progressBefore = await progress.textContent();
  const graphBefore = await page.locator('.graph-node').evaluateAll((nodes) => nodes.map((node) => ({
    text: node.textContent,
    state: [...node.classList].find((value) => value.startsWith('node-')),
    roles: node.getAttribute('data-semantic-roles'),
  })));
  const highlightedCode = await page.locator('.code-line.highlighted').textContent();

  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: '🎨 UI Settings' }).click();
  for (const theme of ['Dark', 'Light', 'Neon (Default)']) {
    await page.getByRole('button', { name: theme, exact: true }).click();
    await expect(progress).toHaveText(progressBefore ?? '');
    expect(await page.locator('.graph-node').evaluateAll((nodes) => nodes.map((node) => ({
      text: node.textContent,
      state: [...node.classList].find((value) => value.startsWith('node-')),
      roles: node.getAttribute('data-semantic-roles'),
    })))).toEqual(graphBefore);
  }

  await page.getByRole('button', { name: 'Türkçe (TR)', exact: true }).click();
  await expect(progress).toHaveText(progressBefore ?? '');
  await expect(page.locator('.code-line.highlighted')).toHaveText(highlightedCode ?? '');
  await expect(page.getByRole('button', { name: 'Sonraki adım' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ayarları kapat' })).toBeVisible();
  expect(await page.locator('.graph-node').evaluateAll((nodes) => nodes.map((node) => ({
    text: node.textContent,
    state: [...node.classList].find((value) => value.startsWith('node-')),
    roles: node.getAttribute('data-semantic-roles'),
  })))).toEqual(graphBefore);
  expect(await page.evaluate(() => localStorage.getItem('codexray.theme'))).toBe('neon');
  expect(await page.evaluate(() => localStorage.getItem('codexray.locale'))).toBe('tr');
});
