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
