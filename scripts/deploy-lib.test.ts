import path from 'node:path';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import {
  ensureContained,
  parseDeployArgs,
  stagePublishedDirectory,
  verifyViteBase,
} from './deploy-lib.mjs';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  const { rm } = await import('node:fs/promises');
  await Promise.all(temporaryDirectories.splice(0).map((directory) =>
    rm(directory, { recursive: true, force: true }),
  ));
});

describe('deployment helpers', () => {
  it('parses required and optional deployment arguments', () => {
    expect(parseDeployArgs(['--target', 'C:\\site', '--dry-run', '--no-push'])).toEqual({
      target: 'C:\\site',
      dryRun: true,
      noPush: true,
      message: '',
    });
    expect(() => parseDeployArgs([])).toThrow('--target');
    expect(() => parseDeployArgs(['--target', 'x', '--unknown'])).toThrow('Unknown');
  });

  it('rejects the parent itself and paths outside it', () => {
    const parent = path.resolve('fixture-public');
    expect(() => ensureContained(parent, parent)).toThrow('Unsafe');
    expect(() => ensureContained(parent, path.resolve(parent, '..', 'other'))).toThrow('Unsafe');
    expect(ensureContained(parent, path.join(parent, 'codexray'))).toBe(path.join(parent, 'codexray'));
  });

  it('verifies that all generated references use the deployment base', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'codexray-base-'));
    temporaryDirectories.push(root);
    await writeFile(path.join(root, 'index.html'), '<script src="/codexray/assets/app.js"></script>');
    await expect(verifyViteBase(root)).resolves.toEqual(['/codexray/assets/app.js']);
    await writeFile(path.join(root, 'index.html'), '<script src="/assets/app.js"></script>');
    await expect(verifyViteBase(root)).rejects.toThrow('outside /codexray/');
  });

  it('replaces only codexray and writes deterministic version metadata', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'codexray-copy-'));
    temporaryDirectories.push(root);
    const source = path.join(root, 'dist');
    const publicDirectory = path.join(root, 'public');
    await mkdir(source);
    await mkdir(path.join(publicDirectory, 'codexray'), { recursive: true });
    await writeFile(path.join(source, 'index.html'), 'new');
    await writeFile(path.join(publicDirectory, 'codexray', 'index.html'), 'old');
    await writeFile(path.join(publicDirectory, 'keep.txt'), 'keep');

    const transaction = await stagePublishedDirectory({
      sourceDirectory: source,
      publicDirectory,
      sourceCommit: 'abc123',
    });
    expect(await readFile(path.join(publicDirectory, 'codexray', 'index.html'), 'utf8')).toBe('new');
    expect(JSON.parse(await readFile(path.join(publicDirectory, 'codexray', 'version.json'), 'utf8'))).toEqual({
      sourceCommit: 'abc123',
    });
    expect(await readFile(path.join(publicDirectory, 'keep.txt'), 'utf8')).toBe('keep');
    await transaction.rollback();
    expect(await readFile(path.join(publicDirectory, 'codexray', 'index.html'), 'utf8')).toBe('old');
  });
});
