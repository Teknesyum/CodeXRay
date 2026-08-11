import { beforeEach, describe, expect, it } from 'vitest';
import { beginDesktopSession } from './desktopSession';

const SESSION_MARKER_KEY = 'codexray.desktop-session.active.v1';
const TRANSIENT_LOCAL_KEYS = ['codexray.ai-chat.v1', 'codexray.workspace.v1', 'codexray.pinned-variables.v1'];

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe('desktop session lifecycle', () => {
  it('starts a clean desktop work session while preserving preferences', () => {
    for (const key of TRANSIENT_LOCAL_KEYS) localStorage.setItem(key, 'old-session');
    localStorage.setItem('codexray.ai-profile.v1', 'lm-studio');
    localStorage.setItem('codexray.theme', 'dark');
    sessionStorage.setItem('codexray.god-mode.run-index.v1', '["stale"]');

    expect(beginDesktopSession(true)).toBe(true);
    for (const key of TRANSIENT_LOCAL_KEYS) expect(localStorage.getItem(key)).toBeNull();
    expect(localStorage.getItem('codexray.ai-profile.v1')).toBe('lm-studio');
    expect(localStorage.getItem('codexray.theme')).toBe('dark');
    expect(sessionStorage.getItem('codexray.god-mode.run-index.v1')).toBeNull();
    expect(sessionStorage.getItem(SESSION_MARKER_KEY)).toBe('1');
  });

  it('does not erase the current session on a renderer remount or in web mode', () => {
    sessionStorage.setItem(SESSION_MARKER_KEY, '1');
    localStorage.setItem('codexray.workspace.v1', 'current-session');
    expect(beginDesktopSession(true)).toBe(false);
    expect(beginDesktopSession(false)).toBe(false);
    expect(localStorage.getItem('codexray.workspace.v1')).toBe('current-session');
  });
});
