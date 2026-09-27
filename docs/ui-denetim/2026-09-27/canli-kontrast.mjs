import { chromium } from 'playwright';
import fs from 'fs';
const snip = fs.readFileSync(process.env.TMP + '/denetim.js', 'utf8');
const b = await chromium.launch(); const out = {};
for (const theme of ['neon', 'dark']) for (const loc of ['en', 'tr']) {
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.addInitScript(([t, l]) => { localStorage.setItem('codexray.theme', t); localStorage.setItem('codexray.locale', l); }, [theme, loc]);
  await p.goto('http://127.0.0.1:4173/'); await p.waitForTimeout(2500);
  const states = { rest: async () => {},
    step: async () => { const sel = p.locator('select').first(); const v = await sel.locator('option').nth(1).getAttribute('value'); await sel.selectOption(v); await p.waitForTimeout(1500); await p.getByRole('button', { name: /Simulate|Simüle/ }).first().click({ timeout: 5000 }).catch(() => {}); await p.waitForTimeout(1500); for (let i = 0; i < 6; i++) await p.getByRole('button', { name: /Next step|Sonraki adım/ }).first().click({ timeout: 5000 }); await p.waitForTimeout(400); },
    settings: async () => { await p.getByRole('button', { name: /^(Settings|Ayarlar)$/ }).first().click(); await p.waitForTimeout(500); } };
  const tabs = loc === 'en' ? ['UI', 'AI', 'Radio'] : ['Arayüz', 'YZ Ayarları', 'Radyo'];
  for (const tb of tabs) states['tab-' + tb] = async () => { await p.getByRole('button', { name: new RegExp(tb) }).first().click({ timeout: 2000 }); await p.waitForTimeout(400); };
  for (const [s, act] of Object.entries(states)) {
    try { await act(); } catch (e) { out[`${theme}-${loc}-${s}`] = 'action failed: ' + e.message.split('\n')[0]; continue; }
    const r = await p.evaluate(snip);
    const fails = r.pairs.filter(x => x.ratio < r.esik);
    const tfail = (r.targets || []);
    out[`${theme}-${loc}-${s}`] = { checked: r.checked, contrastFails: fails.length, targetFails: tfail.length, worst: fails.slice(0, 8), targetsWorst: tfail.slice(0, 8) };
  }
  await p.close();
}
await b.close(); fs.writeFileSync('docs/ui-denetim/2026-09-27/canli-kontrast.json', JSON.stringify(out, null, 2));
for (const [k, v] of Object.entries(out)) console.log(k, typeof v === 'string' ? v : `checked=${v.checked} contrast=${v.contrastFails} target=${v.targetFails}`);
