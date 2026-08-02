import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { deriveCategories } from '../src/services/catalogDerivation.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SOURCE_PATH = path.join(__dirname, '../src/data/algorithmCatalog.json');
const DEST_DIR = path.join(__dirname, '../public/data/catalog');

async function main() {
  console.log('Splitting algorithmCatalog.json into platform chunks...');

  if (!fs.existsSync(SOURCE_PATH)) {
    console.warn(`Source catalog not found at ${SOURCE_PATH}. Skipping split.`);
    return;
  }

  const rawData = fs.readFileSync(SOURCE_PATH, 'utf-8');
  const catalog = JSON.parse(rawData);

  fs.mkdirSync(DEST_DIR, { recursive: true });

  const platforms = {
    leetcode: [],
    cses: [],
    codeforces: [],
    atcoder: []
  };

  let processedCount = 0;

  for (const prob of catalog) {
    const source = prob.source || 'leetcode';

    // Apply deterministic pure category derivation
    prob.derivedCategories = deriveCategories(source, prob.title, prob.category, prob.tags);

    // Sanity check the primary schema
    if (!prob.id || !prob.title || !prob.slug) {
      console.warn(`Skipping invalid problem missing core fields:`, prob);
      continue;
    }

    if (platforms[source]) {
      platforms[source].push(prob);
      processedCount++;
    } else {
      console.warn(`Unknown source '${source}' for problem: ${prob.title}`);
    }
  }

  for (const [platform, problems] of Object.entries(platforms)) {
    const destFile = path.join(DEST_DIR, `${platform}.json`);
    fs.writeFileSync(destFile, JSON.stringify(problems)); // Minified JSON
    console.log(`Wrote ${problems.length} problems to public/data/catalog/${platform}.json`);
  }

  console.log(`Successfully deterministically split ${processedCount} problems.`);
}

main().catch(console.error);
