import { beforeEach, describe, expect, it, vi } from 'vitest';

const freshTranslations = async () => {
  vi.resetModules();
  return import('./translations');
};

describe('runtime text loading', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('serves English without the table and refuses Turkish before the table is loaded', async () => {
    const { isRuntimeTextReady, translateRuntimeText } = await freshTranslations();
    expect(isRuntimeTextReady('en')).toBe(true);
    expect(isRuntimeTextReady('tr')).toBe(false);
    expect(translateRuntimeText('split depth 2', 'en')).toBe('split depth 2');
    expect(() => translateRuntimeText('split depth 2', 'tr')).toThrow(/before loadRuntimeText resolved/);
  });

  it('translates Turkish once the table is loaded and loads it exactly once', async () => {
    const { isRuntimeTextReady, loadRuntimeText, translateRuntimeText } = await freshTranslations();
    const first = loadRuntimeText('tr');
    const second = loadRuntimeText('tr');
    expect(second).toBe(first);
    await first;
    expect(isRuntimeTextReady('tr')).toBe(true);
    expect(translateRuntimeText('split depth 2', 'tr')).toBe('bölünme derinliği 2');
    expect(translateRuntimeText('Insertion Sort · lift key', 'tr')).toBe('Eklemeli Sıralama · anahtarı kaldır');
    await expect(loadRuntimeText('tr')).resolves.toBeUndefined();
  });

  it('resolves immediately for English without importing the table', async () => {
    const { loadRuntimeText, isRuntimeTextReady } = await freshTranslations();
    await loadRuntimeText('en');
    expect(isRuntimeTextReady('tr')).toBe(false);
  });
});
