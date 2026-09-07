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

const advanceUntilText = async (page: Page, hud: Locator, pattern: RegExp) => {
  const pause = page.getByRole('button', { name: 'Pause', exact: true });
  if (await pause.isVisible().catch(() => false)) await pause.click();
  const next = page.getByRole('button', { name: 'Next step' });
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (await hud.isVisible().catch(() => false)) {
      const text = await hud.textContent() ?? '';
      if (pattern.test(text)) return;
    }
    if (!await next.isEnabled()) break;
    await next.click();
  }
  await expect(hud).toHaveText(pattern);
};

const expectFits = async (visual: Locator) => {
  const viewport = visual.locator('xpath=ancestor::div[contains(@class,"visual-auto-fit-viewport")][1]');
  await expect(viewport).toBeVisible();
  const inner = await visual.boundingBox();
  const outer = await viewport.boundingBox();
  expect(inner).not.toBeNull();
  expect(outer).not.toBeNull();
  expect(inner!.width).toBeLessThanOrEqual(outer!.width + 1);
  expect(inner!.height).toBeLessThanOrEqual(outer!.height + 1);
  expect(inner!.x).toBeGreaterThanOrEqual(outer!.x - 1);
  expect(inner!.y).toBeGreaterThanOrEqual(outer!.y - 1);
};

const cases: Array<{ algorithm: string; view: string; selector: string; en: RegExp; tr: RegExp; noEnglish: RegExp }> = [
  {
    algorithm: 'Binary Search',
    view: 'array',
    selector: '.visualizer-content .visual-array',
    en: /Binary Search · (initialize active range|inspect midpoint|complete)/,
    tr: /İkili Arama · (etkin aralığı başlat|orta noktayı incele|tamamlandı)/,
    noEnglish: /Binary Search|initialize|inspect|complete/,
  },
  {
    algorithm: 'Longest Increasing Subsequence',
    view: 'rows',
    selector: '.visualizer-content .rows-view',
    en: /LIS · (initialize per-index DP|compare predecessor candidate|traceback sequence|complete)/,
    tr: /LIS · (indeks başına DP durumunu başlat|öncül adayını karşılaştır|diziyi geri izle|tamamlandı)/,
    noEnglish: /initialize|compare|traceback|complete/,
  },
  {
    algorithm: 'Trapping Rain Water',
    view: 'bars',
    selector: '.visualizer-content .bar-view',
    en: /Rain Water · (Start boundaries|fill from smaller boundary|complete)/,
    tr: /Yağmur Suyu · (sınırları başlat|küçük sınırdan doldur|tamamlandı)/,
    noEnglish: /Rain Water|Start|fill|boundary|complete/,
  },
  {
    algorithm: 'Merge Intervals',
    view: 'intervals',
    selector: '.visualizer-content .interval-view',
    en: /Merge Intervals · (sort on number line|start disjoint span|merge overlap|complete)/,
    tr: /Aralık Birleştirme · (sayı doğrusunda sırala|ayrık aralık başlat|örtüşmeyi birleştir|tamamlandı)/,
    noEnglish: /Merge Intervals|sort on|disjoint|overlap|complete/,
  },
];

for (const testCase of cases) {
  test(`shows the phase strip over the ${testCase.view} view in both locales`, async ({ page }) => {
    await run(page, testCase.algorithm);
    const hud = page.locator('.visualizer-content .matrix-teaching-hud');
    const visual = page.locator(testCase.selector).first();
    await expect(visual).toBeVisible();
    await advanceUntilText(page, hud, testCase.en);
    await expect(hud.locator('strong')).toHaveCount(1);
    await expectFits(visual);

    await switchToTurkish(page);
    await expect(hud).toHaveText(testCase.tr);
    await expect(hud).not.toHaveText(testCase.noEnglish);
    await expect(visual).toBeVisible();
    await expectFits(visual);
  });
}
