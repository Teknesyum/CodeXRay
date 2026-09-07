import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const PHASE_CAPTURE = /const phase = typeof vars\.phase[^;]+;/;

const openDfsTour = async (page: Page) => {
  await page.addInitScript(() => {
    localStorage.setItem('codexray.locale', 'en');
    localStorage.setItem('codexray.ai.autoLoad', 'false');
    localStorage.setItem('codexray.ai.titanMode', 'true');
    localStorage.setItem('codexray.radio.autoplay', 'false');
  });
  await page.goto('/');
  const select = page.getByLabel('Algorithm preset');
  const dfsValue = await select.locator('option').filter({ hasText: 'Depth First Search' }).getAttribute('value');
  await select.selectOption(dfsValue ?? '');
  await page.getByRole('button', { name: 'i1' }).click();
  await page.getByRole('button', { name: /Simulate/ }).click();
  await expect(page.getByLabel('Depth First Search (DFS) execution')).toBeVisible();

  const chat = page.getByPlaceholder('Type your question here...');
  await expect(chat).toBeEnabled();
  await chat.fill('walk me through the algorithm');
  await chat.press('Enter');

  const tour = page.locator('.ai-tour button');
  await expect(tour).toHaveCount(8);
  return tour;
};

test('the guided tour stops on the phases the simulator writes', async ({ page }) => {
  const tour = await openDfsTour(page);
  await expect(tour).toHaveText(['1', '2', '5', '9', '13', '14', '23', '24']);
});

test('the same tour was evenly spaced filler before the phase label was carried', async ({ page }) => {
  await page.route(/\/src\/services\/trace\/simulationTrace\.ts(?:\?.*)?$/, async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    expect(body).toMatch(PHASE_CAPTURE);
    await route.fulfill({
      response,
      body: body.replace(PHASE_CAPTURE, 'const phase = undefined;'),
    });
  });
  const tour = await openDfsTour(page);
  await expect(tour).toHaveText(['1', '2', '5', '8', '13', '18', '23', '24']);
});

test('the tour reaches steps the tie-keeping scorer never selected', async ({ page }) => {
  const tour = await openDfsTour(page);
  const stops = await tour.allTextContents();
  for (const reached of ['5', '9', '13']) expect(stops).toContain(reached);
  for (const abandoned of ['4', '7', '11']) expect(stops).not.toContain(abandoned);
});

test('walking next-checkpoint lands on a phase boundary rather than a sampled index', async ({ page }) => {
  await openDfsTour(page);
  const chat = page.getByPlaceholder('Type your question here...');
  await chat.fill('go to the next key step');
  await chat.press('Enter');
  await expect(page.locator('.ai-tour button.active')).toHaveText('2');
});
