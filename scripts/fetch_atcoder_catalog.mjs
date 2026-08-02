import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEST_PATH = path.join(__dirname, '../src/data/algorithmCatalog.json');

const normalizeTitle = (title) => {
  return title.toLowerCase().replace(/[^a-z0-9]/g, '');
};

const mapAtCoderCategory = (contestId) => {
  if (!contestId) return 'other';
  if (contestId.startsWith('abc')) return 'array'; // AtCoder Beginner Contest often starts with array/string
  if (contestId.startsWith('arc')) return 'graph'; // Regular is usually harder math/graph
  if (contestId.startsWith('agc')) return '1d-dp'; // Grand is usually very hard DP/Math
  return 'other';
};

async function main() {
  console.log('Fetching AtCoder problem catalog from Kenkoooo API...');
  const response = await fetch('https://kenkoooo.com/atcoder/resources/problems.json');

  if (!response.ok) {
    throw new Error(`Failed to fetch AtCoder API: ${response.status}`);
  }

  const data = await response.json();

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

  const acProblems = [];
  let skippedCount = 0;

  for (const prob of data) {
    const normTitle = normalizeTitle(prob.title);

    if (existingNormalizedTitles.has(normTitle)) {
      skippedCount++;
      continue;
    }

    acProblems.push({
      id: `AC-${prob.id}`,
      source: 'atcoder',
      title: prob.title,
      slug: prob.id,
      difficulty: 'Hard', // AtCoder problems are generally harder, and we don't have exact ratings here
      category: mapAtCoderCategory(prob.contest_id),
      tags: ['atcoder', prob.contest_id]
    });

    existingNormalizedTitles.add(normTitle);
  }

  console.log(`Successfully extracted ${acProblems.length} new AtCoder problems. (Skipped ${skippedCount} duplicates)`);

  const combinedCatalog = [...existingCatalog, ...acProblems];
  fs.writeFileSync(DEST_PATH, JSON.stringify(combinedCatalog, null, 2));
  console.log(`Saved combined catalog with ${combinedCatalog.length} total problems to ${DEST_PATH}`);
}

main().catch(console.error);
