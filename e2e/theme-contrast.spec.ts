import { expect, test, type Page } from '@playwright/test';

interface ContrastFailure {
  selector: string;
  text: string;
  ratio: number;
  required: number;
}

const findVisibleTextContrastFailures = async (page: Page): Promise<ContrastFailure[]> =>
  page.evaluate(() => {
    const parseColor = (value: string): [number, number, number, number] | null => {
      const match = value.match(/rgba?\(([^)]+)\)/);
      if (!match) return null;
      const parts = match[1].split(/[\s,/]+/).filter(Boolean).map(Number);
      return [parts[0], parts[1], parts[2], parts[3] ?? 1];
    };
    const blend = (
      foreground: [number, number, number, number],
      background: [number, number, number, number],
    ): [number, number, number, number] => {
      const alpha = foreground[3] + background[3] * (1 - foreground[3]);
      return [
        (foreground[0] * foreground[3] + background[0] * background[3] * (1 - foreground[3])) / alpha,
        (foreground[1] * foreground[3] + background[1] * background[3] * (1 - foreground[3])) / alpha,
        (foreground[2] * foreground[3] + background[2] * background[3] * (1 - foreground[3])) / alpha,
        alpha,
      ];
    };
    const luminance = (color: number[]) => {
      const channels = color.slice(0, 3).map((value) => {
        const normalized = value / 255;
        return normalized <= 0.04045
          ? normalized / 12.92
          : ((normalized + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
    };
    const contrast = (left: number[], right: number[]) => {
      const first = luminance(left);
      const second = luminance(right);
      return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
    };
    const effectiveBackground = (element: Element) => {
      const chain: Element[] = [];
      for (let node: Element | null = element; node; node = node.parentElement) chain.unshift(node);
      let result: [number, number, number, number] = [255, 255, 255, 1];
      for (const node of chain) {
        const background = parseColor(getComputedStyle(node).backgroundColor);
        if (background && background[3] > 0) result = blend(background, result);
      }
      return result;
    };

    const failures: ContrastFailure[] = [];
    for (const element of document.querySelectorAll<HTMLElement>('body *')) {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      if (style.display === 'none' || style.visibility === 'hidden'
        || Number(style.opacity) === 0 || rect.width < 1 || rect.height < 1) continue;
      if (element.matches(':disabled, input[type="checkbox"], input[type="range"]')) continue;
      const ownsText = [...element.childNodes].some((node) =>
        node.nodeType === Node.TEXT_NODE && node.textContent?.trim());
      const exposesFormText = element.matches('input, textarea, select');
      if (!ownsText && !exposesFormText) continue;
      const text = (element.innerText || (element as HTMLInputElement).value
        || element.getAttribute('placeholder') || '').replace(/\s+/g, ' ').trim();
      if (!text) continue;

      const foreground = parseColor(style.color);
      if (!foreground) continue;
      const ratio = contrast(foreground, effectiveBackground(element));
      const fontSize = Number.parseFloat(style.fontSize);
      const fontWeight = Number(style.fontWeight) || (style.fontWeight === 'bold' ? 700 : 400);
      const required = fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700) ? 3 : 4.5;
      if (ratio + 0.01 < required) failures.push({
        selector: element.tagName.toLowerCase()
          + (element.id ? `#${element.id}` : '')
          + [...element.classList].slice(0, 3).map((name) => `.${name}`).join(''),
        text: text.slice(0, 100),
        ratio: Number(ratio.toFixed(2)),
        required,
      });
    }
    return failures;
  });

test('keeps visible text readable across neon, dark, and light themes', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('codexray.locale', 'en');
    localStorage.setItem('codexray.radio.autoplay', 'false');
    localStorage.setItem('codexray.ai.autoLoad', 'false');
    localStorage.setItem('codexray.ai.showWarning', 'true');
  });
  await page.goto('/');
  await page.getByLabel('Algorithm preset').selectOption({
    label: "3 – ✓ Dijkstra's Shortest Path",
  });
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: '🎨 UI Settings' }).click();

  for (const theme of ['Neon (Default)', 'Dark', 'Light']) {
    await page.getByRole('button', { name: theme, exact: true }).click();
    await page.waitForTimeout(400);
    expect(await findVisibleTextContrastFailures(page), theme).toEqual([]);
  }
});
