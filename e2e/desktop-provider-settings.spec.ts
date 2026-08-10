import { expect, test } from '@playwright/test';

test('shows desktop AI providers and the Ollama connection form', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(globalThis, 'isTauri', { value: true, configurable: true });
    localStorage.setItem('codexray.locale', 'tr');
    localStorage.setItem('codexray.radio.autoplay', 'false');
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Ayarlar' }).click();

  const provider = page.getByLabel('Yapay zekâ sağlayıcısı');
  await expect(provider).toBeVisible();
  const providerBox = await provider.boundingBox();
  const webLlmModelBox = await page.getByLabel('Cihaz üzerindeki model').first().boundingBox();
  expect(providerBox).not.toBeNull();
  expect(webLlmModelBox).not.toBeNull();
  expect(providerBox!.y + providerBox!.height).toBeLessThan(webLlmModelBox!.y);
  await expect(provider.locator('option[value="ollama"]')).toBeEnabled();
  await expect(provider.locator('option[value="openai-compatible"]')).toBeEnabled();

  await provider.selectOption('ollama');
  await expect(page.getByText('Ollama', { exact: true }).last()).toBeVisible();
  await expect(page.locator('input.api-provider-select').first()).toHaveValue('http://127.0.0.1:11434/v1');
  const externalContext = page.getByLabel('Bağlam penceresi');
  await externalContext.selectOption('131072');
  await expect(externalContext).toHaveValue('131072');
  const outputLimit = page.getByLabel('Azami çıktı tokenı');
  await expect(outputLimit).toHaveAttribute('max', '16384');
  await outputLimit.fill('16384');
  await expect(outputLimit).toHaveValue('16384');
  await expect(page.getByRole('button', { name: 'Test et ve bağlan' })).toBeVisible();
});
