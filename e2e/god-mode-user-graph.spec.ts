import { expect, test } from '@playwright/test';

const userGraph = {
  version: 1,
  mode: 'graph',
  directed: false,
  weighted: false,
  nodes: [
    { id: 'left', label: 'Left', x: 8, y: 50 },
    { id: 'upper', label: 'Upper', x: 32, y: 25 },
    { id: 'lower', label: 'Lower', x: 32, y: 75 },
    { id: 'meet', label: 'Meet', x: 62, y: 50 },
    { id: 'right', label: 'Right', x: 90, y: 50 },
  ],
  edges: [
    { id: 'lu', from: 'left', to: 'upper' },
    { id: 'll', from: 'left', to: 'lower' },
    { id: 'um', from: 'upper', to: 'meet' },
    { id: 'lm', from: 'lower', to: 'meet' },
    { id: 'mr', from: 'meet', to: 'right' },
  ],
  startId: 'left',
};

test('requires a missing target, then builds on the exact user graph without replacing it', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('codexray.locale', 'en');
    localStorage.setItem('codexray.ai.autoLoad', 'false');
    localStorage.setItem('codexray.ai.godMode', 'true');
    localStorage.setItem('codexray.radio.autoplay', 'false');
  });
  await page.goto('/');
  await page.getByLabel('Algorithm preset').selectOption({ label: '2 – ✓ Breadth First Search (BFS)' });
  await page.getByText('Import / export').click();
  await page.locator('.graph-import-export textarea').fill(JSON.stringify(userGraph));
  await page.getByRole('button', { name: 'Import JSON' }).click();

  const sourceBefore = await page.getByRole('textbox', { name: 'Source code' }).inputValue();
  const question = page.getByPlaceholder('Type your question here...');
  await question.fill('Write bidirectional BFS on my graph');
  await question.press('Enter');
  await expect(page.getByText(/needs an explicit target/i)).toBeVisible();
  await expect(page.locator('.god-mode-progress')).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Source code' })).toHaveValue(sourceBefore);

  await page.getByLabel('Target').selectOption('right');
  await question.fill('Write bidirectional BFS on my graph');
  await question.press('Enter');
  await expect(page.getByLabel('Bidirectional BFS — Custom execution')).toBeVisible();
  await page.getByRole('button', { name: 'Show simulation' }).click();
  await expect(page.locator('.graph-node')).toHaveCount(5);
  await expect(page.locator('.graph-edge')).toHaveCount(5);
  for (const label of ['Left', 'Upper', 'Lower', 'Meet', 'Right']) {
    await expect(page.locator('.graph-node').filter({ hasText: new RegExp(`^${label}$`) })).toBeVisible();
  }
  const pause = page.getByRole('button', { name: 'Pause', exact: true });
  if (await pause.count()) await pause.click();
  const next = page.getByRole('button', { name: 'Next step' });
  for (let guard = 0; guard < 100 && !await next.isDisabled(); guard += 1) await next.click();
  await expect(page.getByTestId('variable-path')).toContainText('left');
  await expect(page.getByTestId('variable-path')).toContainText('right');
});
