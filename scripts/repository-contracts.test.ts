import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const sourceRoot = path.resolve(process.cwd(), 'src');

const collectSourceFiles = async (directory: string): Promise<string[]> => {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(absolutePath);
    if (!/\.(?:ts|tsx|css)$/.test(entry.name) || /\.test\.(?:ts|tsx)$/.test(entry.name)) return [];
    return [absolutePath];
  }));
  return nested.flat();
};

const readApplicationSource = async () => {
  const files = await collectSourceFiles(sourceRoot);
  return Promise.all(files.map(async (file) => ({
    file: path.relative(process.cwd(), file),
    content: await readFile(file, 'utf8'),
  })));
};

describe('repository safety and architecture contracts', () => {
  it('contains no dynamic JavaScript execution or raw HTML injection path', async () => {
    const sources = await readApplicationSource();
    const forbidden = /\beval\s*\(|new\s+Function\s*\(|dangerouslySetInnerHTML/;
    expect(sources.filter(({ content }) => forbidden.test(content))).toEqual([]);
  });

  it('keeps AI local and contains no embedded provider endpoint or secret', async () => {
    const sources = await readApplicationSource();
    const forbidden = /(?:api\.openai\.com|api\.anthropic\.com|generativelanguage\.googleapis\.com|\bsk-[A-Za-z0-9_-]{16,}|api[_-]?key\s*[:=])/i;
    expect(sources.filter(({ content }) => forbidden.test(content))).toEqual([]);
  });

  it('uses the Vanilla CSS stack without Tailwind dependencies or directives', async () => {
    const packageJson = JSON.parse(await readFile(path.resolve(process.cwd(), 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const dependencyNames = [
      ...Object.keys(packageJson.dependencies ?? {}),
      ...Object.keys(packageJson.devDependencies ?? {}),
    ];
    expect(dependencyNames.filter((name) => name.includes('tailwind'))).toEqual([]);
    const sources = await readApplicationSource();
    expect(sources.filter(({ content }) => /@tailwind\b|@apply\b/.test(content))).toEqual([]);
  });
});
