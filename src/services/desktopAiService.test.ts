import { describe, expect, it } from 'vitest';
import { isDesktopRuntime, normalizeLoopbackBaseUrl } from './desktopAiService';

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
});
