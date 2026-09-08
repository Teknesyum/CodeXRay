import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import {
  parseDeployArgs,
  pathExists,
  requireCleanStatus,
  requireSynchronizedMain,
  stagePublishedDirectory,
  validateStagedScope,
  validateTarget,
  verifyViteBase,
} from './deploy-lib.mjs';

const npmCli = process.env.npm_execpath;
if (!npmCli) {
  throw new Error('Run this publisher through "npm run publish:site".');
}

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
    encoding: 'utf8',
    shell: false,
    stdio: options.capture ? 'pipe' : 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const details = options.capture ? `\n${result.stderr || result.stdout}` : '';
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}.${details}`);
  }
  return (result.stdout ?? '').trim();
};

const npm = (args, options = {}) =>
  run(process.execPath, [npmCli, ...args], options);

const git = (repository, args, capture = true) =>
  run('git', ['-c', `safe.directory=${repository}`, '-C', repository, ...args], { capture });

const requireCleanRepository = (repository, label) => {
  const status = git(repository, ['status', '--porcelain']);
  requireCleanStatus(status, label);
};

const ensureSynchronizedMain = (targetRoot) => {
  const branch = git(targetRoot, ['branch', '--show-current']);
  if (branch !== 'main') throw new Error(`Target must be on main, currently ${branch || 'detached'}.`);
  git(targetRoot, ['fetch', 'origin', 'main'], false);
  const head = git(targetRoot, ['rev-parse', 'HEAD']);
  const originMain = git(targetRoot, ['rev-parse', 'origin/main']);
  requireSynchronizedMain({ branch, head, originMain });
};

const pollDeployment = async (sourceCommit, timeoutMs = 180_000) => {
  const deadline = Date.now() + timeoutMs;
  const url = 'https://serkanozel.me/codexray/version.json';
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${url}?sha=${encodeURIComponent(sourceCommit)}&t=${Date.now()}`, {
        cache: 'no-store',
        redirect: 'follow',
      });
      if (response.ok) {
        const version = await response.json();
        if (version.sourceCommit === sourceCommit) return;
      }
    } catch {
      // Cloudflare or the network may be briefly unavailable during rollout.
    }
    await new Promise((resolve) => setTimeout(resolve, 10_000));
  }
  throw new Error('Changes were pushed, but production was not confirmed within 3 minutes.');
};

const main = async () => {
  const options = parseDeployArgs(process.argv.slice(2));
  const sourceRoot = process.cwd();
  const targetRoot = path.resolve(options.target);
  const blogRoot = path.join(targetRoot, 'blog');
  const publicRoot = path.join(blogRoot, 'public');
  const distRoot = path.join(sourceRoot, 'dist');

  if (path.resolve(sourceRoot) === targetRoot) {
    throw new Error('Source and target repositories must be different.');
  }
  await validateTarget(targetRoot);
  requireCleanRepository(sourceRoot, 'CodeXRay');
  requireCleanRepository(targetRoot, 'Target repository');
  if (!options.noPush && !options.dryRun) ensureSynchronizedMain(targetRoot);

  console.log('Running CodeXRay quality checks…');
  npm(['run', 'lint'], { cwd: sourceRoot });
  npm(['run', 'test'], { cwd: sourceRoot });
  npm(['run', 'build'], {
    cwd: sourceRoot,
    env: { CODEXRAY_BASE_PATH: '/codexray/' },
  });
  const assetReferences = await verifyViteBase(distRoot);
  const sourceCommit = git(sourceRoot, ['rev-parse', 'HEAD']);
  console.log(`Verified ${assetReferences.length} base-path asset references for ${sourceCommit.slice(0, 8)}.`);

  if (options.dryRun) {
    console.log(`Dry run complete. Would publish to ${path.join(publicRoot, 'codexray')}.`);
    return;
  }

  const staged = await stagePublishedDirectory({
    sourceDirectory: distRoot,
    publicDirectory: publicRoot,
    sourceCommit,
  });
  try {
    if (!await pathExists(path.join(blogRoot, 'node_modules'))) {
      console.log('Installing target blog dependencies…');
      npm(['ci'], { cwd: blogRoot });
    }
    console.log('Validating the website build and Cloudflare Worker bundle…');
    npm(['run', 'build'], { cwd: blogRoot });
    npm(['exec', '--', 'wrangler', 'deploy', '--dry-run'], { cwd: blogRoot });

    git(targetRoot, ['add', '--', 'blog/public/codexray'], false);
    const stagedFiles = git(targetRoot, ['diff', '--cached', '--name-only']);
    if (!stagedFiles) {
      await staged.finalize();
      console.log('The published output is unchanged; nothing to commit.');
      return;
    }
    validateStagedScope(stagedFiles);
    const message = options.message || `Deploy CodeXRay ${sourceCommit.slice(0, 8)}`;
    git(targetRoot, ['commit', '-m', message], false);
    await staged.finalize();

    if (options.noPush) {
      console.log('Deployment commit created; --no-push requested.');
      return;
    }
    git(targetRoot, ['push', 'origin', 'main'], false);
    console.log('Pushed target main; waiting for Cloudflare deployment…');
    await pollDeployment(sourceCommit);
    console.log('CodeXRay is live at https://serkanozel.me/codexray/');
  } catch (error) {
    const committed = git(targetRoot, ['status', '--porcelain']).length === 0;
    if (!committed) {
      git(targetRoot, ['restore', '--staged', '--', 'blog/public/codexray'], false);
      await staged.rollback();
    }
    throw error;
  }
};

main().catch((error) => {
  console.error(`Deployment failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
