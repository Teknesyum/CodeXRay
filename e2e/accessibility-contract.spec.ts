import { expect, test } from '@playwright/test';

test('keeps names, focus, keyboard resizing, semantic cues, and reduced motion usable', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    localStorage.setItem('codexray.locale', 'en');
    localStorage.setItem('codexray.ai.autoLoad', 'false');
    localStorage.setItem('codexray.radio.autoplay', 'false');
  });
  await page.goto('/');
  await expect(page.getByRole('main', { name: 'CodeXRay workspace' })).toBeVisible();

  const unnamedControls = await page.locator('button, input, select, textarea').evaluateAll((elements) =>
    elements.filter((element) => {
      const html = element as HTMLElement;
      const style = getComputedStyle(html);
      if (style.display === 'none' || style.visibility === 'hidden' || html.getClientRects().length === 0) return false;
      const input = element as HTMLInputElement;
      const label = input.labels?.[0]?.textContent?.trim();
      return !(element.getAttribute('aria-label')?.trim()
        || element.getAttribute('aria-labelledby')?.trim()
        || element.getAttribute('title')?.trim()
        || html.innerText?.trim()
        || label
        || input.placeholder?.trim());
    }).map((element) => element.outerHTML.slice(0, 180)));
  expect(unnamedControls).toEqual([]);

  for (const name of [
    'Resize code and variables panels',
    'Resize left and right panels',
    'Resize visualizer and assistant panels',
    'Resize assistant and controls panels',
  ]) {
    const separator = page.getByRole('separator', { name });
    const before = await separator.getAttribute('aria-valuenow');
    const maximum = await separator.getAttribute('aria-valuemax');
    await separator.focus();
    const increase = Number(before) < Number(maximum);
    await separator.press(name.includes('left and right')
      ? increase ? 'ArrowRight' : 'ArrowLeft'
      : increase ? 'ArrowDown' : 'ArrowUp');
    await expect(separator).toBeFocused();
    expect(await separator.getAttribute('aria-valuenow')).not.toBe(before);
  }

  await page.getByRole('button', { name: 'Settings' }).click();
  const settingsDialog = page.getByRole('dialog', { name: 'Settings' });
  await expect(settingsDialog).toBeVisible();
  await expect(settingsDialog).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Settings' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Settings' })).toBeFocused();

  await page.getByLabel('Algorithm preset').selectOption({ label: "3 – ✓ Dijkstra's Shortest Path" });
  await page.getByRole('button', { name: /Simulate/ }).click();
  const next = page.getByRole('button', { name: 'Next step' });
  for (let guard = 0; guard < 50 && !await next.isDisabled(); guard += 1) {
    if (await page.locator('.graph-edge.active').count()) break;
    await next.click();
  }
  await expect(page.locator('.graph-node').first()).toHaveAttribute('aria-label', /Node .+: (idle|queued|active|visited|path)/i);
  await expect(page.locator('.graph-edge').first()).toHaveAttribute('aria-label', /Edge .+ → .+: (idle|queued|active|visited|path)/i);
  if (await page.locator('.graph-edge.active line').count()) {
    expect(await page.locator('.graph-edge.active line').first().evaluate((line) =>
      getComputedStyle(line).animationName)).toBe('none');
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(await page.evaluate(() => document.documentElement.clientWidth + 1));
});
