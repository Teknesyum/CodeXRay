import { expect, test } from '@playwright/test';

test('shows verification failure and preserves the visible workspace on a mismatched trace', async ({ page }) => {
  await page.route(/\/src\/services\/titan\/titanPipeline\.ts(?:\?.*)?$/, async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    const comparison = 'JSON.stringify(left) === JSON.stringify(right)';
    expect(body).toContain(comparison);
    await route.fulfill({ response, body: body.replace(comparison, 'false') });
  });
  await page.addInitScript(() => {
    localStorage.setItem('codexray.locale', 'tr');
    localStorage.setItem('codexray.ai.autoLoad', 'false');
    localStorage.setItem('codexray.ai.titanMode', 'true');
    localStorage.setItem('codexray.radio.autoplay', 'false');
  });
  await page.goto('/');
  const preset = page.locator('select.registry-select');
  const option = preset.locator('option').filter({ hasText: /Binary Search|İkili Arama/ });
  await preset.selectOption(await option.getAttribute('value') ?? '');
  await page.getByRole('button', { name: /Simüle Et/ }).click();
  await page.getByRole('button', { name: 'Sonraki adım' }).click();

  const parameter = page.locator('.parameter-field input');
  const input = page.locator('.input-config input[type="text"]').first();
  const context = page.locator('.context-chip');
  const before = {
    parameter: await parameter.inputValue(),
    input: await input.inputValue(),
    context: await context.textContent(),
  };

  const chat = page.getByPlaceholder('Sorunuzu buraya yazın...');
  await chat.fill('hedefi 42 yap');
  await chat.press('Enter');

  await expect(page.getByRole('paragraph').filter({
    hasText: 'Input uyarlaması doğrulanamadı. Çalışma alanı değiştirilmedi.',
  })).toBeVisible();
  await expect(parameter).toHaveValue(before.parameter);
  await expect(input).toHaveValue(before.input);
  await expect(context).toHaveText(before.context ?? '');
});
