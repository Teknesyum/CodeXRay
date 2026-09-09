import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('codexray.locale', 'tr');
    localStorage.setItem('codexray.ai.autoLoad', 'false');
    localStorage.setItem('codexray.radio.autoplay', 'false');
  });
});

test('paints the first Turkish hud without any step navigation', async ({ page }) => {
  const started = performance.now();
  await page.goto('/');
  await expect(page.getByRole('main')).toBeVisible();
  const startupMs = performance.now() - started;
  console.log(`TR_STARTUP_MEASUREMENT ${JSON.stringify({ startupMs })}`);

  const select = page.getByLabel('Algoritma hazırı');
  const option = select.locator('option').filter({ hasText: 'İkili Arama' });
  await select.selectOption(await option.getAttribute('value') ?? '');
  await page.getByRole('button', { name: /Simüle Et/ }).click();

  const hud = page.locator('.visualizer-content .matrix-teaching-hud');
  await expect(hud).toBeVisible();
  const phase = hud.locator('strong').first();
  await expect(phase).toHaveText(/İkili Arama · (etkin aralığı başlat|orta noktayı incele|tamamlandı)/);
  await expect(phase).not.toHaveText(/Binary Search|initialize|inspect|complete/);
});

test('switches an existing simulation from English to Turkish without rerunning it', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('codexray.locale', 'en');
  });
  await page.goto('/');
  const select = page.getByLabel('Algorithm preset');
  const option = select.locator('option').filter({ hasText: 'Insertion Sort' });
  await select.selectOption(await option.getAttribute('value') ?? '');
  await page.getByRole('button', { name: /Simulate/ }).click();

  const hud = page.locator('.visualizer-content .matrix-teaching-hud');
  const phase = hud.locator('strong').first();
  await expect(phase).toHaveText(/Insertion Sort · /);
  const pause = page.getByRole('button', { name: 'Pause', exact: true });
  if (await pause.isVisible().catch(() => false)) await pause.click();
  const stepBefore = await page.locator('.visualizer-content .visual-array').textContent();

  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: /UI Settings/ }).click();
  await page.getByRole('button', { name: 'Türkçe (TR)' }).click();

  await expect(phase).toHaveText(/Eklemeli Sıralama · /);
  await expect(phase).not.toHaveText(/Insertion Sort|Ekleme Sıralaması/);
  expect(await page.locator('.visualizer-content .visual-array').textContent()).toBe(stepBefore);
});
