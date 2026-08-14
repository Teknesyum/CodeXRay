import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const distRoot = path.resolve(process.cwd(), 'dist');
const assetsRoot = path.join(distRoot, 'assets');
const budgets = {
  // Web-source solving and God Mode are lazy chunks. The DeepSeek profile and
  // progress-aware agent telemetry raise the aggregate ceiling slightly while
  // keeping the initial application chunk smaller than before.
  initialJavaScript: 620 * 1024,
  lazyJavaScriptChunk: 100 * 1024,
  tracerWorker: 150 * 1024,
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

const assertIndividualBudget = (label, entries, budget) => {
  for (const name of entries) {
    const bytes = sizes.get(name) ?? 0;
    if (bytes > budget) {
      throw new Error(`${label} ${name} is ${(bytes / 1024).toFixed(1)} KiB; budget is ${(budget / 1024).toFixed(1)} KiB.`);
    }
  }
  console.log(`${label}: ${entries.length} chunks, each <= ${(budget / 1024).toFixed(1)} KiB`);
};

const workerAssets = assets.filter((name) => /^localAi\.worker-.*\.js$/.test(name));
const tracerWorkerAssets = assets.filter((name) => /^tracer\.worker-.*\.js$/.test(name));
const indexHtml = await readFile(path.join(distRoot, 'index.html'), 'utf8');
const initialAssets = [...indexHtml.matchAll(/<script\b[^>]*\bsrc=["']([^"']+\.js)["'][^>]*>/g)]
  .map((match) => path.basename(match[1]));
const applicationJavaScript = assets.filter((name) =>
  name.endsWith('.js') && !workerAssets.includes(name) && !tracerWorkerAssets.includes(name));
const lazyAssets = applicationJavaScript.filter((name) => !initialAssets.includes(name));
assertBudget(
  'Initial JavaScript',
  initialAssets,
  budgets.initialJavaScript,
);
assertIndividualBudget('Lazy JavaScript', lazyAssets, budgets.lazyJavaScriptChunk);
assertBudget('Tracer worker', tracerWorkerAssets, budgets.tracerWorker);
assertBudget('Local AI worker', workerAssets, budgets.localAiWorker);
assertBudget('Styles', assets.filter((name) => name.endsWith('.css')), budgets.styles);
