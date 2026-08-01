import { expect, test } from '@playwright/test';

const initialGraph = {
  version: 1,
  mode: 'graph',
  directed: true,
  weighted: false,
  nodes: [
    { id: '1', label: 'One', x: 15, y: 25 },
    { id: '2', label: 'Two', x: 45, y: 25 },
    { id: '4', label: 'Four', x: 25, y: 75 },
    { id: '11', label: 'Eleven', x: 75, y: 75 },
  ],
  edges: [{ id: 'base', from: '11', to: '2' }],
  startId: '1',
  targetId: '11',
};

test('supports gap reuse, atomic rename, duplicate rejection, and topology-safe dragging', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('codexray.locale', 'en');
    localStorage.setItem('codexray.ai.autoLoad', 'false');
    localStorage.setItem('codexray.radio.autoplay', 'false');
  });
  await page.goto('/');
  await page.getByLabel('Algorithm preset').selectOption({ label: '2 – ✓ Breadth First Search (BFS)' });
  await page.getByText('Import / export').click();
  const serialized = page.locator('.graph-import-export textarea');
  await serialized.fill(JSON.stringify(initialGraph));
  await page.getByRole('button', { name: 'Import JSON' }).click();

  await page.getByRole('button', { name: 'Node Two', exact: true }).click();
  await page.getByRole('button', { name: 'Delete node' }).click();
  await expect(page.getByRole('button', { name: 'Node Two', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Add node' }).click();
  await page.getByRole('button', { name: 'Node 2', exact: true }).click();
  await page.getByLabel('Node ID').fill('B');
  await page.getByLabel('Node label').fill('Bridge');
  await page.getByRole('button', { name: 'Save node' }).click();
  await expect(page.getByRole('button', { name: 'Node Bridge', exact: true })).toBeVisible();

  const from = page.locator('.edge-controls select').nth(0);
  const to = page.locator('.edge-controls select').nth(1);
  await from.selectOption('1');
  await to.selectOption('B');
  await page.getByRole('button', { name: 'Add edge' }).click();
  await page.getByRole('button', { name: 'Add edge' }).click();
  await expect(page.getByRole('alert')).toContainText('already exists');

  const canvas = page.getByLabel(/Graph builder canvas/);
  await page.getByRole('button', { name: 'Connect from node One' }).dispatchEvent('pointerdown');
  await page.getByRole('button', { name: 'Node Bridge', exact: true }).dispatchEvent('pointerup');
  await expect(page.getByRole('alert')).toContainText('already exists');

  const bridge = page.getByRole('button', { name: 'Node Bridge', exact: true });
  const canvasBox = await canvas.boundingBox();
  const bridgeBefore = await bridge.boundingBox();
  expect(canvasBox).not.toBeNull();
  expect(bridgeBefore).not.toBeNull();
  await bridge.dispatchEvent('mousedown');
  await canvas.dispatchEvent('mousemove', {
    clientX: (canvasBox?.x ?? 0) + (canvasBox?.width ?? 1) * 0.62,
    clientY: (canvasBox?.y ?? 0) + (canvasBox?.height ?? 1) * 0.42,
  });
  await canvas.dispatchEvent('mouseup');

  await page.getByRole('button', { name: 'Export to editor' }).click();
  const exported = JSON.parse(await serialized.inputValue()) as typeof initialGraph;
  expect(exported.nodes.map((node) => node.id).sort()).toEqual(['1', '11', '4', 'B']);
  expect(exported.edges).toEqual([{ id: expect.any(String), from: '1', to: 'B' }]);
  const moved = exported.nodes.find((node) => node.id === 'B');
  expect(moved?.x).not.toBe(10);
  expect(moved?.y).not.toBe(10);

  await page.getByRole('button', { name: /Simulate/ }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByLabel('Breadth First Search (BFS) execution')).toBeVisible();
});
