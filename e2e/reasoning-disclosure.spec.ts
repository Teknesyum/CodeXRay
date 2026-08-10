import { expect, test } from '@playwright/test';

test('renders model reasoning as a collapsed, expandable companion to the answer', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('codexray.locale', 'tr');
    localStorage.setItem('codexray.radio.autoplay', 'false');
    localStorage.setItem('codexray.ai-chat.v1', JSON.stringify([{
      role: 'ai',
      content: 'Sonuç: En kısa yol değeri güncellendi.',
      reasoning: 'Önce güncel uzaklığı kontrol ettim. Ardından gevşetme koşulunu doğruladım.',
      reasoningTokens: 101,
      inferenceMs: 3_200,
    }]));
  });
  await page.goto('/');

  const disclosure = page.locator('details.reasoning-disclosure');
  await expect(disclosure).toBeVisible();
  await expect(disclosure).not.toHaveAttribute('open', '');
  await expect(page.getByText('101 düşünme tokenı')).toBeVisible();
  await expect(page.getByText('Sonuç: En kısa yol değeri güncellendi.')).toBeVisible();

  await page.getByText('Düşünme süreci').click();
  await expect(disclosure).toHaveAttribute('open', '');
  await expect(page.getByText(/Önce güncel uzaklığı kontrol ettim/)).toBeVisible();
});
