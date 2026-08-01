import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const assertNoSeriousViolations = async (page: Page, label: string) => {
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .exclude('iframe')
    .analyze();
  const blocking = result.violations.filter(({ impact }) => impact === 'critical' || impact === 'serious');
  expect(blocking.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    targets: violation.nodes.map((node) => ({
      selector: node.target.join(' '),
      summary: node.failureSummary,
      data: node.any.map((check) => check.data),
    })),
  })), label).toEqual([]);
};

const load = async (page: Page, locale: 'en' | 'tr', theme: 'neon' | 'dark' | 'light') => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.evaluate(({ requestedLocale, requestedTheme }) => {
    localStorage.setItem('codexray.locale', requestedLocale);
    localStorage.setItem('codexray.theme', requestedTheme);
    localStorage.setItem('codexray.ai.autoLoad', 'false');
    localStorage.setItem('codexray.radio.autoplay', 'false');
  }, { requestedLocale: locale, requestedTheme: theme });
  await page.reload();
  await page.waitForFunction(({ requestedLocale, requestedTheme }) => (
    document.documentElement.dataset.theme === requestedTheme
    && document.documentElement.lang === requestedLocale
  ), { requestedLocale: locale, requestedTheme: theme });
};

test('has no serious WCAG A/AA violations across themes and languages', async ({ page }) => {
  for (const locale of ['en', 'tr'] as const) {
    for (const theme of ['neon', 'dark', 'light'] as const) {
      await load(page, locale, theme);
      await assertNoSeriousViolations(page, `${locale}/${theme}`);
    }
  }
});

test('keeps dialogs, graph semantics, radio shell, and mobile stacking axe-clean', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await load(page, 'en', 'neon');
  await page.getByRole('button', { name: 'Settings' }).click();
  await assertNoSeriousViolations(page, 'mobile settings dialog');
  await page.keyboard.press('Escape');
  await page.getByLabel('Algorithm preset').selectOption({ label: "3 – ✓ Dijkstra's Shortest Path" });
  await page.getByRole('button', { name: /Simulate/ }).click();
  await assertNoSeriousViolations(page, 'mobile graph simulation');
  await page.getByRole('button', { name: 'Open CodeXRay Radio' }).click();
  await expect(page.locator('iframe')).toHaveCount(1);
  await expect(page.locator('iframe')).toHaveAttribute('title', /.+/);
  await assertNoSeriousViolations(page, 'mobile radio shell');
});

test('reflows like 200 and 400 percent zoom without losing core controls', async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 720 });
  await load(page, 'en', 'dark');
  await expect(page.getByPlaceholder('Type your question here...')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Settings' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(await page.evaluate(() => document.documentElement.clientWidth + 2));
  await assertNoSeriousViolations(page, '200 percent equivalent reflow');
  await page.setViewportSize({ width: 320, height: 640 });
  await expect(page.getByPlaceholder('Type your question here...')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Settings' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(await page.evaluate(() => document.documentElement.clientWidth + 2));
  await assertNoSeriousViolations(page, '400 percent equivalent reflow');
});
