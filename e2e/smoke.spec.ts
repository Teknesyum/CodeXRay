import { expect, test } from '@playwright/test';

test('runs DFS and exposes the complete visited trace', async ({ page }) => {
  await page.goto('/');
  const select = page.getByLabel('Algorithm preset');
  const dfsValue = await select.locator('option').filter({ hasText: 'Depth First Search' }).getAttribute('value');
  await select.selectOption(dfsValue ?? '');
  await expect(page.locator('.panel-right .graph-input-editor')).toBeVisible();
  await expect(page.locator('.panel-left .graph-input-editor')).toHaveCount(0);
  await page.getByRole('button', { name: /Simulate/ }).click();
  await expect(page.getByLabel('Depth First Search (DFS) execution')).toBeVisible();
  await page.getByRole('button', { name: 'Play' }).click();
  await page.getByRole('button', { name: 'Pause' }).click();
  await expect(page.getByText(/tracked/)).toBeVisible();
});

test('renames graph nodes and creates edges by dragging node handles', async ({ page }) => {
  await page.goto('/');
  const select = page.getByLabel('Algorithm preset');
  const dfsValue = await select.locator('option').filter({ hasText: 'Depth First Search' }).getAttribute('value');
  await select.selectOption(dfsValue ?? '');

  await page.getByRole('button', { name: 'Node 1', exact: true }).click();
  await page.getByLabel('Node ID').fill('21');
  await page.getByLabel('Node label').fill('Start');
  await page.getByRole('button', { name: 'Save node' }).click();
  await expect(page.getByRole('button', { name: 'Node Start', exact: true })).toBeVisible();

  const connector = page.getByRole('button', { name: 'Connect from node Start' });
  const target = page.getByRole('button', { name: 'Node 5', exact: true });
  const sourceBox = await connector.boundingBox();
  const targetBox = await target.boundingBox();
  expect(sourceBox).not.toBeNull();
  expect(targetBox).not.toBeNull();
  await page.mouse.move(
    (sourceBox?.x ?? 0) + (sourceBox?.width ?? 0) / 2,
    (sourceBox?.y ?? 0) + (sourceBox?.height ?? 0) / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    (targetBox?.x ?? 0) + (targetBox?.width ?? 0) / 2,
    (targetBox?.y ?? 0) + (targetBox?.height ?? 0) / 2,
  );
  await page.mouse.up();

  await page.getByText('Import / export').click();
  await page.getByRole('button', { name: 'Export to editor' }).click();
  const exported = JSON.parse(await page.locator('.graph-import-export textarea').inputValue());
  expect(exported.startId).toBe('21');
  expect(exported.nodes).toContainEqual(expect.objectContaining({ id: '21', label: 'Start' }));
  expect(exported.edges).toContainEqual(expect.objectContaining({ from: '21', to: '5' }));
  expect(exported.edges.some((edge: { from: string; to: string }) =>
    edge.from === '1' || edge.to === '1')).toBe(false);
});

test('switches the visible interface to Turkish instantly', async ({ page }) => {
  await page.goto('/');
  const select = page.getByLabel('Algorithm preset');
  const dfsValue = await select.locator('option').filter({ hasText: 'Depth First Search' }).getAttribute('value');
  await select.selectOption(dfsValue ?? '');
  await page.getByRole('button', { name: /Simulate/ }).click();
  await page.getByRole('button', { name: 'Türkçeye geç' }).click();
  await expect(page.getByRole('heading', { name: 'Kaynak Kod' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Simüle Et/ })).toBeVisible();
  await expect(page.getByText('Değişkenler ve İz')).toBeVisible();
  await expect(page.locator('.step-explanation')).toContainText('düğümünü ziyaret et');
  await expect(page.locator('html')).toHaveAttribute('lang', 'tr');
});

test('accepts custom array input for a sorting algorithm', async ({ page }) => {
  await page.goto('/');
  const select = page.getByLabel('Algorithm preset');
  const selectionValue = await select.locator('option').filter({ hasText: 'Selection Sort' }).getAttribute('value');
  await select.selectOption(selectionValue ?? '');
  await page.getByLabel(/Array.*Simulation Input/).fill('[9, 2, 7, 1]');
  await page.getByRole('button', { name: /Simulate/ }).click();
  await expect(page.getByLabel('Selection Sort execution')).toBeVisible();
  await expect(page.getByText('1 /')).toBeVisible();
  await expect(page.locator('.context-chip')).toHaveText(/Step 1\/\d+/);
  await page.getByRole('button', { name: 'Pin array' }).click();
  const watchStrip = page.getByRole('region', { name: 'Pinned variables' });
  await expect(watchStrip).toBeVisible();
  await expect(watchStrip.locator('.pinned-watch-name')).toHaveText('array');
  await expect(watchStrip.locator('.pinned-watch-value')).toHaveText('[9,2,7,1]');
});

test('resizes and collapses workspace panels', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('separator')).toHaveCount(4);
  const leftPanel = page.locator('.panel-left');
  const initialWidth = (await leftPanel.boundingBox())?.width ?? 0;
  const splitter = page.getByRole('separator', { name: 'Resize left and right panels' });
  const box = await splitter.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move((box?.x ?? 0) + 2, (box?.y ?? 0) + 100);
  await page.mouse.down();
  await page.mouse.move((box?.x ?? 0) + 82, (box?.y ?? 0) + 100);
  await page.mouse.up();
  await expect.poll(async () => (await leftPanel.boundingBox())?.width ?? 0)
    .toBeGreaterThan(initialWidth + 50);

  await page.getByRole('button', { name: 'Collapse Controls' }).click();
  await expect(page.getByRole('button', { name: 'Expand Controls' })).toBeVisible();
});

test('opens the playlist radio without loading it before user interaction', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTitle('CodeXRay YouTube playlist player')).toHaveCount(0);
  await page.getByRole('button', { name: 'Open CodeXRay Radio' }).click();
  await expect(page.getByTitle('CodeXRay YouTube playlist player')).toHaveAttribute(
    'src',
    /OLAK5uy_kojiLJf49fStilkx_cFUhxqoDXzcSyfg0/,
  );
});

test('offers the 9B model and its experimental 8K context profile', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('combobox', { name: 'On-device model' })
    .selectOption('Qwen3.5-9B-q4f32_1-MLC');
  const context = page.getByRole('combobox', { name: 'Context window' });
  await expect(context.locator('option[value="8192"]'))
    .toHaveText(/8K context.*experimental/);
  await context.selectOption('8192');
  await expect(page.getByText(/8192-token context.*1200 response tokens/))
    .toBeVisible();
});
