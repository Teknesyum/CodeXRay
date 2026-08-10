import { describe, expect, it, vi } from 'vitest';
import {
  isDesktopRuntime,
  listDesktopModels,
  normalizeLoopbackBaseUrl,
} from './desktopAiService';

const invokeMock = vi.hoisted(() => vi.fn());

vi.mock('@tauri-apps/api/core', () => ({
  Channel: class MockChannel {},
  invoke: invokeMock,
  isTauri: () => Boolean((globalThis as typeof globalThis & { isTauri?: boolean }).isTauri),
}));

describe('desktop AI endpoint boundary', () => {
  it('normalizes localhost and default API paths', () => {
    expect(normalizeLoopbackBaseUrl('http://localhost:11434/v1/')).toBe('http://127.0.0.1:11434/v1');
    expect(normalizeLoopbackBaseUrl('http://127.0.0.1:8001')).toBe('http://127.0.0.1:8001/v1');
    expect(normalizeLoopbackBaseUrl('http://[::1]:8001/v1')).toBe('http://[::1]:8001/v1');
  });

  it('rejects non-loopback, credentialed, queried, fragmented, and unsupported URLs', () => {
    for (const endpoint of [
      'https://example.com/v1',
      'http://token@127.0.0.1:8001/v1',
      'http://127.0.0.1:8001/v1?token=x',
      'http://127.0.0.1:8001/v1#fragment',
      'ftp://127.0.0.1:8001/v1',
    ]) {
      expect(() => normalizeLoopbackBaseUrl(endpoint)).toThrow();
    }
  });

  it('does not expose native providers in an ordinary browser build', () => {
    expect(isDesktopRuntime()).toBe(false);
  });

  it('uses the supported Tauri runtime marker', () => {
    Object.defineProperty(globalThis, 'isTauri', { value: true, configurable: true });
    try {
      expect(isDesktopRuntime()).toBe(true);
    } finally {
      delete (globalThis as typeof globalThis & { isTauri?: boolean }).isTauri;
    }
  });

  it('turns Tauri string rejections into visible errors', async () => {
    Object.defineProperty(globalThis, 'isTauri', { value: true, configurable: true });
    invokeMock.mockRejectedValueOnce('Local AI endpoint returned HTTP 401.');
    try {
      await expect(listDesktopModels('http://127.0.0.1:8888/v1'))
        .rejects.toThrow('Local AI endpoint returned HTTP 401.');
    } finally {
      delete (globalThis as typeof globalThis & { isTauri?: boolean }).isTauri;
    }
  });
});
