import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const distRoot = path.resolve(process.cwd(), 'dist');
const assetsRoot = path.join(distRoot, 'assets');
const budgets = {
  mainJavaScript: 600 * 1024,
  localAiWorker: 6_500 * 1024,
  styles: 100 * 1024,
};

const assets = await readdir(assetsRoot);
const sizes = new Map(await Promise.all(assets.map(async (name) => [
  name,
  (await stat(path.join(assetsRoot, name))).size,
])));

const assertBudget = (label, entries, budget) => {
  if (entries.length === 0) throw new Error(`No ${label} build asset was found.`);
  const bytes = entries.reduce((sum, name) => sum + (sizes.get(name) ?? 0), 0);
  if (bytes > budget) {
    throw new Error(`${label} is ${(bytes / 1024).toFixed(1)} KiB; budget is ${(budget / 1024).toFixed(1)} KiB.`);
  }
  console.log(`${label}: ${(bytes / 1024).toFixed(1)} / ${(budget / 1024).toFixed(1)} KiB`);
};

const workerAssets = assets.filter((name) => /^localAi\.worker-.*\.js$/.test(name));
assertBudget(
  'Main JavaScript',
  assets.filter((name) => name.endsWith('.js') && !workerAssets.includes(name)),
  budgets.mainJavaScript,
);
assertBudget('Local AI worker', workerAssets, budgets.localAiWorker);
assertBudget('Styles', assets.filter((name) => name.endsWith('.css')), budgets.styles);
