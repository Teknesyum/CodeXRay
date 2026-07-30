import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const viteCli = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');
const playwrightCli = path.join(root, 'node_modules', '@playwright', 'test', 'cli.js');
const url = 'http://127.0.0.1:4173';

const server = spawn(process.execPath, [
  viteCli,
  '--host',
  '127.0.0.1',
  '--port',
  '4173',
], {
  cwd: root,
  stdio: ['ignore', 'pipe', 'pipe'],
  shell: false,
});

const waitForServer = async () => {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Vite exited with code ${server.exitCode}.`);
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Vite is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Vite did not become ready at ${url}.`);
};

try {
  await waitForServer();
  const test = spawn(process.execPath, [playwrightCli, 'test'], {
    cwd: root,
    env: { ...process.env, PLAYWRIGHT_EXTERNAL_SERVER: '1' },
    stdio: 'inherit',
    shell: false,
  });
  const exitCode = await new Promise((resolve) => test.once('exit', resolve));
  process.exitCode = typeof exitCode === 'number' ? exitCode : 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  server.kill();
}
