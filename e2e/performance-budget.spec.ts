import { expect, test } from '@playwright/test';

const TIMELINE_COMMIT_BUDGET_MS = 400;
const deliberateTimelineDelayMs = Number(process.env.TIMELINE_TEST_DELAY_MS ?? 0);

const summarize = (samples: number[]) => {
  const sorted = [...samples].sort((left, right) => left - right);
  return {
    min: sorted[0],
    median: (sorted[4] + sorted[5]) / 2,
    max: sorted[sorted.length - 1],
  };
};

test('keeps startup, catalog switching, simulation, timeline, and DP rendering inside interaction budgets', {
  tag: '@performance',
}, async ({ page }) => {
  test.setTimeout(120_000);
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
  const previous = page.getByRole('button', { name: 'Previous step' });
  const playwrightSamples: number[] = [];
  const inPageSamples: number[] = [];
  const handlerSamples: number[] = [];
  for (let sample = 0; sample < 10; sample += 1) {
    while (!await previous.isDisabled()) await previous.click();
    const playwrightStarted = performance.now();
    for (let index = 0; index < 10 && !await next.isDisabled(); index += 1) await next.click();
    playwrightSamples.push(performance.now() - playwrightStarted);

    const inPage = await page.evaluate(async (deliberateDelayMs) => {
      const nextButton = document.querySelector<HTMLButtonElement>('button[aria-label="Next step"]');
      const previousButton = document.querySelector<HTMLButtonElement>('button[aria-label="Previous step"]');
      if (!nextButton || !previousButton) throw new Error('Timeline controls are unavailable.');
      const afterPaint = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const delayCommit = () => {
        const delayStarted = performance.now();
        while (performance.now() - delayStarted < deliberateDelayMs) {
          // Deliberate test-only slowdown used to prove that the budget fails closed.
        }
      };
      if (deliberateDelayMs > 0) nextButton.addEventListener('click', delayCommit, true);
      while (!previousButton.disabled) {
        previousButton.click();
        await afterPaint();
      }
      let handlerMs = 0;
      const started = performance.now();
      for (let index = 0; index < 10 && !nextButton.disabled; index += 1) {
        const handlerStarted = performance.now();
        nextButton.click();
        handlerMs += performance.now() - handlerStarted;
        await afterPaint();
      }
      if (deliberateDelayMs > 0) nextButton.removeEventListener('click', delayCommit, true);
      return { totalMs: performance.now() - started, handlerMs };
    }, deliberateTimelineDelayMs);
    inPageSamples.push(inPage.totalMs);
    handlerSamples.push(inPage.handlerMs);
  }
  const timelineMeasurements = {
    playwright: summarize(playwrightSamples),
    inPage: summarize(inPageSamples),
    handler: summarize(handlerSamples),
    deliberateDelayMs: deliberateTimelineDelayMs,
  };
  console.log(`TIMELINE_MEASUREMENTS ${JSON.stringify(timelineMeasurements)}`);
  expect(timelineMeasurements.inPage.max, 'ten in-page timeline commits').toBeLessThan(TIMELINE_COMMIT_BUDGET_MS);

  const chat = page.getByPlaceholder('Type your question here...');
  const dpStarted = performance.now();
  await chat.fill('Solve LCS for ["algorithm","rhythm"] and show every 2D DP state.');
  await chat.press('Enter');
  await expect(page.getByLabel('LeetCode 1143 — Longest Common Subsequence execution')).toBeVisible();
  await expect(page.locator('.matrix-cell')).toHaveCount(70);
  expect(performance.now() - dpStarted, '70-cell matrix package and render').toBeLessThan(4_000);
});

test('survives repeated cross-subsystem use without stale state, overflow, or locked controls', { tag: '@performance' }, async ({ page }) => {
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
