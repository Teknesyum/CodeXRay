import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEST_PATH = path.join(__dirname, '../src/data/algorithmCatalog.json');

const normalizeTitle = (title) => {
  return title.toLowerCase().replace(/[^a-z0-9]/g, '');
};

const mapSectionToCategory = (sectionTitle, problemTitle) => {
  const s = sectionTitle.toLowerCase();
  const t = problemTitle.toLowerCase();

  if (s.includes('dynamic programming')) {
    if (t.includes('grid') || t.includes('path') || t.includes('array')) return '2d-dp';
    if (t.includes('coin') || t.includes('dice') || t.includes('knapsack')) return 'knapsack-dp';
    return '1d-dp';
  }
  if (s.includes('graph')) {
    if (t.includes('shortest') || t.includes('route') || t.includes('dijkstra')) return 'shortest-path-graph';
    if (t.includes('tree') && !s.includes('tree')) return 'mst-graph';
    return 'graph';
  }
  if (s.includes('tree')) return 'tree';
  if (s.includes('string')) return 'string';
  if (s.includes('geometry')) return 'matrix';
  if (s.includes('range queries')) return 'segment-tree';

  if (s.includes('sorting') || s.includes('introductory')) {
    if (t.includes('subarray') || t.includes('sum')) return 'prefix-sum-array';
    if (t.includes('sliding')) return 'sliding-window-array';
    return 'array';
  }

  return 'other';
};

async function main() {
  console.log('Fetching CSES problem catalog...');
  const response = await fetch('https://cses.fi/problemset/list/');
  const html = await response.text();

  // Load existing LeetCode catalog to check for duplicates
  let existingCatalog = [];
  try {
    const rawData = fs.readFileSync(DEST_PATH, 'utf-8');
    existingCatalog = JSON.parse(rawData);
  } catch {
    console.log('Existing algorithmCatalog.json not found, starting fresh.');
  }

  const existingNormalizedTitles = new Set(
    existingCatalog.map(p => normalizeTitle(p.title))
  );

  const sections = html.split('<h2>').slice(1);
  const csesProblems = [];
  let skippedCount = 0;

  for (const sec of sections) {
    const sectionTitle = sec.split('</h2>')[0].trim();
    const matches = [...sec.matchAll(/<a href="\/problemset\/task\/(\d+)">([^<]+)<\/a>/g)];

    for (const match of matches) {
      const id = match[1];
      const title = match[2].trim();
      const normTitle = normalizeTitle(title);

      if (existingNormalizedTitles.has(normTitle)) {
        console.log(`Skipping duplicate problem: ${title}`);
        skippedCount++;
        continue;
      }

      csesProblems.push({
        id: `CSES-${id}`,
        source: 'cses',
        title: title,
        slug: title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
        difficulty: 'Medium', // Default for CSES since they don't provide it
        category: mapSectionToCategory(sectionTitle, title),
        tags: ['cses', sectionTitle.toLowerCase().replace(/\s+/g, '-')]
      });
    }
  }

  console.log(`Successfully extracted ${csesProblems.length} new CSES problems. (Skipped ${skippedCount} duplicates)`);

  const combinedCatalog = [...existingCatalog, ...csesProblems];
  fs.writeFileSync(DEST_PATH, JSON.stringify(combinedCatalog, null, 2));
  console.log(`Saved combined catalog with ${combinedCatalog.length} total problems to ${DEST_PATH}`);
}

main().catch(console.error);
