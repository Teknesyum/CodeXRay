import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('codexray.locale', 'en');
    localStorage.setItem('codexray.ai.autoLoad', 'false');
    localStorage.setItem('codexray.ai.godMode', 'true');
    localStorage.setItem('codexray.radio.autoplay', 'false');
  });
});

test('completes simulation, AI command, settings, and radio flows at 390px without page overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  for (const splitter of await page.getByRole('separator').all()) await expect(splitter).toBeHidden();

  const preset = page.getByLabel('Algorithm preset');
  const quickSort = preset.locator('option').filter({ hasText: 'Quick Sort' });
  await preset.selectOption(await quickSort.getAttribute('value') ?? '');
  await page.getByRole('textbox', { name: 'Array Simulation Input:' }).fill('[8,3,5,1]');
  await page.getByRole('button', { name: /Simulate/ }).click();
  await page.getByRole('button', { name: 'Next step' }).click();
  await expect(page.locator('.visualizer-header-actions > span')).toHaveText(/^2 \/ \d+$/);

  const question = page.getByPlaceholder('Type your question here...');
  await question.fill('Open the BFS page');
  await question.press('Enter');
  await expect(page.getByLabel('Breadth First Search (BFS) execution')).toBeVisible();

  await page.getByRole('button', { name: 'Settings' }).click();
  const dialog = page.getByRole('dialog', { name: 'Settings' });
  await expect(dialog).toBeVisible();
  const dialogBox = await dialog.boundingBox();
  expect(dialogBox?.x ?? -1).toBeGreaterThanOrEqual(0);
  expect((dialogBox?.x ?? 0) + (dialogBox?.width ?? 0)).toBeLessThanOrEqual(390);
  await page.getByRole('button', { name: 'Close settings' }).click();

  await page.getByRole('button', { name: 'Open CodeXRay Radio' }).click();
  const radio = page.getByRole('complementary', { name: 'Radio' });
  await expect(radio).toBeVisible();
  const radioBox = await radio.boundingBox();
  expect(radioBox?.x ?? -1).toBeGreaterThanOrEqual(0);
  expect((radioBox?.x ?? 0) + (radioBox?.width ?? 0)).toBeLessThanOrEqual(390);

  const overflow = await page.evaluate(() => ({
    body: document.body.scrollWidth - document.body.clientWidth,
    root: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));
  expect(overflow.body).toBeLessThanOrEqual(1);
  expect(overflow.root).toBeLessThanOrEqual(1);
  await expect(question).toBeVisible();
  await expect(page.getByRole('button', { name: 'Collapse Source Code' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Collapse Variables & Trace' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Collapse Simulation View' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Collapse Master Coder' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Collapse Controls' })).toBeVisible();
});

test('persists keyboard resizing and collapse state across reload', async ({ page }) => {
  await page.goto('/');
  const separators = [
    ['Resize code and variables panels', 'ArrowDown'],
    ['Resize left and right panels', 'ArrowRight'],
    ['Resize visualizer and assistant panels', 'ArrowDown'],
    ['Resize assistant and controls panels', 'ArrowUp'],
  ] as const;
  for (const [name, key] of separators) {
    const splitter = page.getByRole('separator', { name });
    await splitter.focus();
    await splitter.press(key);
  }
  await page.getByRole('button', { name: 'Collapse Source Code' }).click();
  await page.getByRole('button', { name: 'Collapse Controls' }).click();
  const storedBefore = await page.evaluate(() => JSON.parse(localStorage.getItem('codexray.layout.v2') ?? '{}'));
  expect(storedBefore.version).toBe(6);
  expect(storedBefore.collapsed).toMatchObject({ code: true, controls: true });

  await page.reload();
  await expect(page.getByRole('button', { name: 'Expand Source Code' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Expand Controls' })).toBeVisible();
  const storedAfter = await page.evaluate(() => JSON.parse(localStorage.getItem('codexray.layout.v2') ?? '{}'));
  expect(storedAfter).toEqual(storedBefore);

  await page.getByRole('button', { name: 'Expand Source Code' }).click();
  await page.getByRole('button', { name: 'Expand Controls' }).click();
  for (const panel of ['Source Code', 'Variables & Trace', 'Simulation View', 'Master Coder', 'Controls']) {
    await expect(page.getByRole('button', { name: `Collapse ${panel}` })).toBeVisible();
  }
});
