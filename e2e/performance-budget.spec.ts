import { expect, test } from '@playwright/test';

test('keeps startup, catalog switching, simulation, timeline, and DP rendering inside interaction budgets', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('codexray.locale', 'en');
    localStorage.setItem('codexray.ai.autoLoad', 'false');
    localStorage.setItem('codexray.ai.titanMode', 'true');
    localStorage.setItem('codexray.radio.autoplay', 'false');
  });
  const started = performance.now();
  await page.goto('/');
  await expect(page.getByRole('main', { name: 'CodeXRay workspace' })).toBeVisible();
  expect(performance.now() - started, 'startup should remain interactive').toBeLessThan(5_000);

  const preset = page.getByLabel('Algorithm preset');
  const catalogStarted = performance.now();
  for (const index of [1, 13, 21, 35, 46, 53, 60]) await preset.selectOption({ index });
  expect(performance.now() - catalogStarted, 'seven cross-family preset commits').toBeLessThan(3_500);

  await preset.selectOption({ label: "3 – ✓ Dijkstra's Shortest Path" });
  const simulationStarted = performance.now();
  await page.getByRole('button', { name: /Simulate/ }).click();
  await expect(page.locator('.graph-node')).not.toHaveCount(0);
  expect(performance.now() - simulationStarted, 'default graph trace generation').toBeLessThan(2_000);

  const next = page.getByRole('button', { name: 'Next step' });
  const stepStarted = performance.now();
  for (let index = 0; index < 10 && !await next.isDisabled(); index += 1) await next.click();
  expect(performance.now() - stepStarted, 'ten timeline commits').toBeLessThan(1_000);

  const chat = page.getByPlaceholder('Type your question here...');
  const dpStarted = performance.now();
  await chat.fill('Solve LCS for ["algorithm","rhythm"] and show every 2D DP state.');
  await chat.press('Enter');
  await expect(page.getByLabel('LeetCode 1143 — Longest Common Subsequence execution')).toBeVisible();
  await expect(page.locator('.matrix-cell')).toHaveCount(70);
  expect(performance.now() - dpStarted, '70-cell matrix package and render').toBeLessThan(4_000);
});

test('survives repeated cross-subsystem use without stale state, overflow, or locked controls', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('codexray.locale', 'en');
    localStorage.setItem('codexray.ai.autoLoad', 'false');
    localStorage.setItem('codexray.ai.titanMode', 'true');
    localStorage.setItem('codexray.radio.autoplay', 'false');
  });
  await page.goto('/');
  const preset = page.getByLabel('Algorithm preset');
  const simulate = page.getByRole('button', { name: /Simulate/ });
  for (let cycle = 0; cycle < 12; cycle += 1) {
    await preset.selectOption({ index: cycle % 2 === 0 ? 36 : 22 });
    await simulate.click();
    await expect(page.locator('.visualizer-header-actions > span')).toContainText('/');
    await page.getByRole('button', { name: 'Next step' }).click();
  }
  const chat = page.getByPlaceholder('Type your question here...');
  for (const request of [
    'open DFS page',
    'Solve House Robber [2,1,4,9] and simulate every 1D state',
    'Solve longest palindromic subsequence for "cbbd" and show interval DP',
  ]) {
    await chat.fill(request);
    await chat.press('Enter');
    await expect(chat).toBeEnabled();
  }
  await expect(page.locator('.input-error')).toHaveCount(0);
  await expect(page.locator('.titan-mode-agent.failed')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(await page.evaluate(() => document.documentElement.clientWidth + 2));
});
