import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('codexray.locale', 'en');
    localStorage.setItem('codexray.radio.autoplay', 'false');
  });
});

const switchToTurkish = async (page: Page) => {
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: /UI Settings/ }).click();
  await page.getByRole('button', { name: 'Türkçe (TR)' }).click();
};

const run = async (page: Page, label: string) => {
  await page.goto('/');
  const select = page.getByLabel('Algorithm preset');
  const option = select.locator('option').filter({ hasText: label });
  await select.selectOption(await option.getAttribute('value') ?? '');
  await page.getByRole('button', { name: /Simulate/ }).click();
};

const advanceUntilDecision = async (page: Page, hud: Locator, decision: RegExp) => {
  const pause = page.getByRole('button', { name: 'Pause', exact: true });
  if (await pause.isVisible().catch(() => false)) await pause.click();
  const next = page.getByRole('button', { name: 'Next step' });
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (await hud.isVisible().catch(() => false)) {
      if (decision.test(await hud.textContent() ?? '')) return;
    }
    if (!await next.isEnabled()) break;
    await next.click();
  }
  await expect(hud).toBeVisible();
};

test('shows the Binary Search decision in the array view in both locales', async ({ page }) => {
  await run(page, 'Binary Search');
  await expect(page.getByLabel('Binary Search execution')).toBeVisible();
  const hud = page.locator('.visualizer-content .matrix-teaching-hud');
  const binaryDecision = /mid<target ⇒ discard left half|mid>target ⇒ discard right half|equal ⇒ found/;
  await advanceUntilDecision(page, hud, binaryDecision);
  await expect(hud).toHaveText(binaryDecision);

  await switchToTurkish(page);
  await expect(hud).toHaveText(/orta<hedef ⇒ sol yarı elenir|orta>hedef ⇒ sağ yarı elenir|eşit ⇒ bulundu/);
  await expect(hud).not.toHaveText(/discard|found/);
});

test('shows the Longest Increasing Subsequence decision in the rows view in both locales', async ({ page }) => {
  await run(page, 'Longest Increasing Subsequence');
  await expect(page.getByLabel('Longest Increasing Subsequence execution')).toBeVisible();
  const hud = page.locator('.visualizer-content .matrix-teaching-hud');
  const lisDecision = /not increasing ⇒ reject|extend predecessor subsequence|does not improve current length/;
  await advanceUntilDecision(page, hud, lisDecision);
  await expect(hud).toHaveText(lisDecision);

  await switchToTurkish(page);
  await expect(hud).toHaveText(/artan değil ⇒ reddedilir|öncül alt diziyi genişlet|mevcut uzunluğu iyileştirmez/);
  await expect(hud).not.toHaveText(/reject|extend|improve/);
});
