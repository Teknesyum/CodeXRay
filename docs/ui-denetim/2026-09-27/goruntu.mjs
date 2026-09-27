import { chromium } from 'playwright';
const dir = 'docs/ui-denetim/2026-09-27/';
const targets = { once: 'http://127.0.0.1:4174/', sonra: 'http://127.0.0.1:4173/' };
const b = await chromium.launch();
for (const [tag, url] of Object.entries(targets)) for (const scale of [1, 1.25, 1.5]) {
  const ctx = await b.newContext({ viewport: { width: Math.round(1440 / scale), height: Math.round(900 / scale) }, deviceScaleFactor: scale });
  const p = await ctx.newPage();
  await p.addInitScript(() => { localStorage.setItem('codexray.theme', 'neon'); localStorage.setItem('codexray.locale', 'tr'); });
  await p.goto(url); await p.waitForTimeout(2500);
  const pct = Math.round(scale * 100);
  const shot = async (name) => p.screenshot({ path: `${dir}${name}-${pct}-${tag}.png` });
  await shot('ana');
  const sel = p.locator('select').first(); await sel.selectOption(await sel.locator('option').nth(1).getAttribute('value'));
  await p.getByRole('button', { name: /Simulate|Simüle/ }).first().click().catch(() => {});
  await p.waitForTimeout(1500);
  for (let i = 0; i < 6; i++) await p.getByRole('button', { name: /Sonraki adım|Next step/ }).first().click({ timeout: 5000 }).catch(() => {});
  await p.waitForTimeout(500); await shot('adim');
  await p.getByRole('button', { name: /^(Ayarlar|Settings)$/ }).first().click().catch(() => {});
  for (const [n, re] of [['ayar-arayuz', /Arayüz/], ['ayar-yz', /YZ Ayarları/], ['ayar-radyo', /Radyo/]]) {
    await p.getByRole('button', { name: re }).first().click({ timeout: 3000 }).catch(() => {}); await p.waitForTimeout(500); await shot(n);
  }
  await ctx.close();
}
await b.close(); console.log('ok');
