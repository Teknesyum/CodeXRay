import { expect, test, type Page } from '@playwright/test';

const graph = {
  version: 1,
  mode: 'graph',
  directed: true,
  weighted: true,
  nodes: [
    { id: 'baş', label: 'Baş', x: 8, y: 50 },
    { id: 'A-1', label: 'A-1', x: 28, y: 25 },
    { id: 'β', label: 'Beta', x: 28, y: 75 },
    { id: 'middle node', label: 'Middle', x: 55, y: 50 },
    { id: 'cycle!', label: 'Cycle', x: 55, y: 18 },
    { id: 'goal', label: 'Goal', x: 82, y: 50 },
    { id: 'isolated', label: 'Isolated', x: 82, y: 84 },
  ],
  edges: [
    { id: 'sa', from: 'baş', to: 'A-1', weight: 2 },
    { id: 'sb', from: 'baş', to: 'β', weight: 2 },
    { id: 'am', from: 'A-1', to: 'middle node', weight: 2 },
    { id: 'bm', from: 'β', to: 'middle node', weight: 2 },
    { id: 'mg', from: 'middle node', to: 'goal', weight: 3 },
    { id: 'ac', from: 'A-1', to: 'cycle!', weight: 1 },
    { id: 'ca', from: 'cycle!', to: 'A-1', weight: 1 },
    { id: 'cg', from: 'cycle!', to: 'goal', weight: 10 },
  ],
  startId: 'baş',
  targetId: 'goal',
};

const runGraph = async (page: Page, name: string) => {
  const preset = page.getByLabel('Algorithm preset');
  const option = preset.locator('option').filter({ hasText: name });
  await preset.selectOption(await option.getAttribute('value') ?? '');
  await page.getByText('Import / export').click();
  const editor = page.locator('.graph-import-export textarea');
  await editor.fill(JSON.stringify(graph));
  await page.getByRole('button', { name: 'Import JSON' }).click();
  await page.getByRole('button', { name: /Simulate/ }).click();
  const progress = page.locator('.visualizer-header-actions > span');
  const total = Number((await progress.textContent())?.split('/')[1].trim());
  let inspectedEdge = await page.locator('.graph-edge.active').count() > 0;
  for (let index = 1; index < total; index += 1) {
    await page.getByRole('button', { name: 'Next step' }).click();
    inspectedEdge ||= await page.locator('.graph-edge.active').count() > 0;
  }
  expect(inspectedEdge, `${name} must expose an inspected edge in its timeline`).toBe(true);
  await expect(page.getByTestId('variable-distances')).toContainText('goal7');
  await expect(page.getByTestId('variable-distances')).toContainText('isolated∞');
  const pathNodes = await page.locator('.graph-node.node-path .graph-node-label').allTextContents();
  expect(pathNodes).toContain('Baş');
  expect(pathNodes).toContain('Middle');
  expect(pathNodes).toContain('Goal');
  expect(pathNodes.some((label) => label === 'A-1' || label === 'Beta')).toBe(true);
  expect(pathNodes).not.toContain('Isolated');
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('codexray.locale', 'en');
    localStorage.setItem('codexray.radio.autoplay', 'false');
  });
});

test('keeps unusual IDs, cycles, equal paths, and unreachable nodes correct in Dijkstra and A*', async ({ page }) => {
  await page.goto('/');
  await runGraph(page, "Dijkstra's Shortest Path");
  await runGraph(page, 'A* Search Algorithm');
});
