import { expect, test } from '@playwright/test';

test('asks for missing algorithm requirements without mutation and resumes with a concrete request', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('codexray.locale', 'en');
    localStorage.setItem('codexray.ai.autoLoad', 'false');
    localStorage.setItem('codexray.ai.godMode', 'true');
    localStorage.setItem('codexray.radio.autoplay', 'false');
  });
  await page.goto('/');
  const source = page.getByRole('textbox', { name: 'Source code' });
  const input = page.getByRole('textbox', { name: 'Array Simulation Input:' });
  const sourceBefore = await source.inputValue();
  const inputBefore = await input.inputValue();
  const question = page.getByPlaceholder('Type your question here...');

  await question.fill('write an algorithm');
  await question.press('Enter');
  await expect(page.getByText(/Which problem should I simulate/)).toBeVisible();
  await expect(page.locator('.god-mode-progress')).toHaveCount(0);
  await expect(source).toHaveValue(sourceBefore);
  await expect(input).toHaveValue(inputBefore);
  await expect(question).toBeEnabled();

  await question.fill('write bidirectional BFS for me');
  await question.press('Enter');
  await expect(page.getByLabel(/Bidirectional BFS.*Custom execution/)).toBeVisible();
  await expect(page.getByText(/code, input, and \d+-step simulation were applied/i)).toBeVisible();
});

test('offers deterministic template, random, unique, and custom paths for a generic 2D DP request', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('codexray.locale', 'tr');
    localStorage.setItem('codexray.ai.autoLoad', 'false');
    localStorage.setItem('codexray.ai.godMode', 'true');
    localStorage.setItem('codexray.radio.autoplay', 'false');
  });
  await page.goto('/');
  const question = page.getByPlaceholder('Sorunuzu buraya yazın...');

  await question.fill('2d dp yaz simüle et');
  await question.press('Enter');

  const chooser = page.locator('.dp-choice-panel');
  await expect(chooser).toBeVisible();
  await expect(chooser.getByRole('button')).toHaveCount(6);
  await expect(chooser.getByRole('button', { name: 'LCS hazır şablonu' })).toBeVisible();
  await expect(chooser.getByRole('button', { name: 'Rastgele şablon' })).toBeVisible();
  await expect(chooser.getByRole('button', { name: 'Özgün soru üret' })).toBeVisible();
  await expect(chooser.getByRole('button', { name: 'Kendi sorumu yazacağım' })).toBeVisible();
  await expect(page.locator('.god-mode-progress')).toHaveCount(0);
  await expect(question).toBeEnabled();
});
