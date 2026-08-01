import path from 'node:path';
import { cp, mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';

export const parseDeployArgs = (argv) => {
  const options = {
    target: '',
    dryRun: false,
    noPush: false,
    message: '',
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--target') options.target = argv[++index] ?? '';
    else if (argument === '--dry-run') options.dryRun = true;
    else if (argument === '--no-push') options.noPush = true;
    else if (argument === '--message') options.message = argv[++index] ?? '';
    else throw new Error(`Unknown argument: ${argument}`);
  }
  if (!options.target) {
    throw new Error('Missing --target <website-repository-path>.');
  }
  return options;
};

export const ensureContained = (parent, child) => {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Unsafe deployment directory: ${child}`);
  }
  return path.resolve(child);
};

export const pathExists = async (candidate) => {
  try {
    await stat(candidate);
    return true;
  } catch {
    return false;
  }
};

export const validateTarget = async (targetRoot) => {
  const required = ['.git', 'blog/package.json', 'blog/astro.config.mjs', 'blog/wrangler.jsonc'];
  for (const relativePath of required) {
    if (!await pathExists(path.join(targetRoot, relativePath))) {
      throw new Error(`Target is missing ${relativePath}.`);
    }
  }
  const packageJson = JSON.parse(await readFile(path.join(targetRoot, 'blog/package.json'), 'utf8'));
  if (!packageJson.scripts?.build) throw new Error('Target blog has no build script.');
};

export const requireCleanStatus = (status, label) => {
  if (status.trim()) throw new Error(`${label} has uncommitted changes:\n${status}`);
};

export const requireSynchronizedMain = ({ branch, head, originMain }) => {
  if (branch !== 'main') throw new Error(`Target must be on main, currently ${branch || 'detached'}.`);
  if (head !== originMain) throw new Error('Target main must exactly match origin/main before deployment.');
};

export const validateStagedScope = (stagedFiles) => {
  const unexpected = stagedFiles
    .split(/\r?\n/)
    .filter(Boolean)
    .filter((file) => !file.startsWith('blog/public/codexray/'));
  if (unexpected.length > 0) {
    throw new Error(`Refusing to commit files outside the deployment subtree: ${unexpected.join(', ')}`);
  }
  return stagedFiles.split(/\r?\n/).filter(Boolean);
};

export const verifyViteBase = async (distDirectory, expectedBase = '/codexray/') => {
  const indexPath = path.join(distDirectory, 'index.html');
  const html = await readFile(indexPath, 'utf8');
  const references = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((match) => match[1]);
  const localAssets = references.filter((reference) =>
    !reference.startsWith('http')
    && !reference.startsWith('data:')
    && !reference.startsWith('#'),
  );
  const invalid = localAssets.filter((reference) => !reference.startsWith(expectedBase));
  if (invalid.length > 0) {
    throw new Error(`Build contains assets outside ${expectedBase}: ${invalid.join(', ')}`);
  }
  return localAssets;
};

export const stagePublishedDirectory = async ({
  sourceDirectory,
  publicDirectory,
  sourceCommit,
}) => {
  const destination = ensureContained(publicDirectory, path.join(publicDirectory, 'codexray'));
  const staging = ensureContained(publicDirectory, path.join(publicDirectory, `.codexray-staging-${process.pid}`));
  const backup = ensureContained(publicDirectory, path.join(publicDirectory, `.codexray-backup-${process.pid}`));
  await rm(staging, { recursive: true, force: true });
  await rm(backup, { recursive: true, force: true });
  await mkdir(staging, { recursive: true });
  await cp(sourceDirectory, staging, { recursive: true });
  await writeFile(
    path.join(staging, 'version.json'),
    `${JSON.stringify({ sourceCommit }, null, 2)}\n`,
    'utf8',
  );
  const hadDestination = await pathExists(destination);
  if (hadDestination) await rename(destination, backup);
  await rename(staging, destination);
  return {
    destination,
    async rollback() {
      await rm(destination, { recursive: true, force: true });
      if (hadDestination && await pathExists(backup)) await rename(backup, destination);
    },
    async finalize() {
      await rm(backup, { recursive: true, force: true });
      await rm(staging, { recursive: true, force: true });
    },
  };
};
