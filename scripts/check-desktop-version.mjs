import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const packageJson = readJson('package.json');
const tauriConfig = readJson('src-tauri/tauri.conf.json');
const cargoToml = fs.readFileSync(path.join(root, 'src-tauri', 'Cargo.toml'), 'utf8');
const cargoVersion = cargoToml.match(/^version\s*=\s*"([^"]+)"/m)?.[1];

if (!packageJson.version || packageJson.version !== tauriConfig.version || packageJson.version !== cargoVersion) {
  throw new Error(
    `Desktop version mismatch: package=${packageJson.version ?? 'missing'}, `
    + `tauri=${tauriConfig.version ?? 'missing'}, cargo=${cargoVersion ?? 'missing'}.`,
  );
}

const requestedTag = process.argv[2] || process.env.CODEXRAY_RELEASE_TAG;
if (requestedTag && requestedTag.replace(/^v/, '') !== packageJson.version) {
  throw new Error(`Release tag ${requestedTag} does not match package version ${packageJson.version}.`);
}

console.log(`CodeXRay desktop version ${packageJson.version} is synchronized.`);
