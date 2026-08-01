import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('codexray.locale', 'en');
    localStorage.setItem('codexray.radio.autoplay', 'false');
  });
});

test('imports a sparse tree and keeps it after a cyclic document is rejected', async ({ page }) => {
  await page.goto('/');
  const preset = page.getByLabel('Algorithm preset');
  const inorder = preset.locator('option').filter({ hasText: 'Binary Tree Inorder Traversal' });
  await preset.selectOption(await inorder.getAttribute('value') ?? '');
  await page.getByRole('button', { name: 'i1' }).click();

  await page.getByText('Import / export').click();
  const editor = page.locator('.graph-import-export textarea');
  await editor.fill('[1,2,3,null,4]');
  await page.getByRole('button', { name: 'Import level-order tree' }).click();
  await page.getByRole('button', { name: 'Export to editor' }).click();
  const accepted = JSON.parse(await editor.inputValue());
  expect(accepted.nodes.map((node: { label: string }) => node.label)).toEqual(['1', '2', '3', '4']);
  expect(accepted.edges).toContainEqual(expect.objectContaining({ from: 'n1', to: 'n4' }));

  const cyclic = {
    version: 1,
    mode: 'tree',
    directed: true,
    weighted: false,
    nodes: [
      { id: 'root', label: 'Root', x: 10, y: 10 },
      { id: 'leaf', label: 'Leaf', x: 30, y: 30 },
      { id: 'a', label: 'A', x: 60, y: 30 },
      { id: 'b', label: 'B', x: 80, y: 60 },
    ],
    edges: [
      { id: 'root-leaf', from: 'root', to: 'leaf' },
      { id: 'a-b', from: 'a', to: 'b' },
      { id: 'b-a', from: 'b', to: 'a' },
    ],
    rootId: 'root',
    startId: 'root',
  };
  await editor.fill(JSON.stringify(cyclic));
  await page.getByRole('button', { name: 'Import JSON' }).click();
  await expect(page.getByRole('alert')).toContainText(/reachable|cycle/i);

  await page.getByRole('button', { name: 'Export to editor' }).click();
  expect(JSON.parse(await editor.inputValue())).toEqual(accepted);
  await page.getByRole('button', { name: /Simulate/ }).click();
  await expect(page.getByLabel('Binary Tree Inorder Traversal execution')).toBeVisible();
});

test('renames, adds, traverses, exports, reimports, and deletes a sparse-tree child', async ({ page }) => {
  await page.goto('/');
  const preset = page.getByLabel('Algorithm preset');
  const inorder = preset.locator('option').filter({ hasText: 'Binary Tree Inorder Traversal' });
  await preset.selectOption(await inorder.getAttribute('value') ?? '');
  await page.getByRole('button', { name: 'i1' }).click();
  await page.getByText('Import / export').click();
  const editor = page.locator('.graph-import-export textarea');
  await editor.fill('[1,2,3,null,4]');
  await page.getByRole('button', { name: 'Import level-order tree' }).click();

  await page.getByRole('button', { name: 'Node 4', exact: true }).click();
  await page.getByLabel('Node ID').fill('leaf-x');
  await page.getByLabel('Node label').fill('Four');
  await page.getByRole('button', { name: 'Save node' }).click();
  await page.getByRole('button', { name: 'Add node' }).click();
  await page.getByRole('button', { name: 'Export to editor' }).click();
  const beforeEdge = JSON.parse(await editor.inputValue());
  const addedNode = beforeEdge.nodes.find((node: { id: string }) =>
    !['n0', 'n1', 'n2', 'leaf-x'].includes(node.id));
  expect(addedNode).toBeDefined();
  const edgeSelectors = page.locator('.edge-controls select');
  await edgeSelectors.nth(0).selectOption('n2');
  await edgeSelectors.nth(1).selectOption({ value: addedNode.id });
  await page.getByRole('button', { name: 'Add edge' }).click();

  await page.getByRole('button', { name: 'Export to editor' }).click();
  const exported = JSON.parse(await editor.inputValue());
  expect(exported.nodes).toContainEqual(expect.objectContaining({ id: 'leaf-x', label: 'Four' }));
  expect(exported.edges).toContainEqual(expect.objectContaining({ from: 'n1', to: 'leaf-x' }));
  expect(exported.edges).toContainEqual(expect.objectContaining({ from: 'n2', to: addedNode.id }));
  await editor.fill(JSON.stringify(exported));
  await page.getByRole('button', { name: 'Import JSON' }).click();
  await page.getByRole('button', { name: 'Export to editor' }).click();
  expect(JSON.parse(await editor.inputValue())).toEqual(exported);

  await page.getByRole('button', { name: /Simulate/ }).click();
  const progress = page.locator('.visualizer-header-actions > span');
  const total = Number((await progress.textContent())?.split('/')[1].trim());
  for (let index = 1; index < total; index += 1) await page.getByRole('button', { name: 'Next step' }).click();
  await expect(page.getByTestId('variable-traversal').locator('.trace-primitive')).toHaveText([
    'leaf-x', 'n1', 'n0', addedNode.id, 'n2',
  ]);

  await page.getByRole('button', { name: 'Edit input' }).click();
  await page.locator(`.builder-node[data-node-id="${addedNode.id}"]`).click();
  await page.getByRole('button', { name: 'Delete node' }).click();
  await page.getByRole('button', { name: /Simulate/ }).click();
  const reducedTotal = Number((await progress.textContent())?.split('/')[1].trim());
  for (let index = 1; index < reducedTotal; index += 1) await page.getByRole('button', { name: 'Next step' }).click();
  await expect(page.getByTestId('variable-traversal').locator('.trace-primitive')).toHaveText([
    'leaf-x', 'n1', 'n0', 'n2',
  ]);
});
