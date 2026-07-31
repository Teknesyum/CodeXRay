import { beforeEach, describe, expect, it } from 'vitest';
import {
  resetCodeXRayInterfaceState,
  resetCodeXRaySiteState,
} from './siteReset';



beforeEach(() => localStorage.clear());

describe('CodeXRay site reset', () => {
  it('removes every CodeXRay state key without touching unrelated origin data', () => {
    localStorage.setItem('codexray.workspace.v1', '{"input":"saved"}');
    localStorage.setItem('codexray.pinned-variables.v1', '["visited"]');
    localStorage.setItem('codexray.ai-chat.v1', '[{"role":"user"}]');
    localStorage.setItem('portfolio.theme', 'dark');

    expect(resetCodeXRaySiteState()).toBe(3);
    expect(localStorage.getItem('codexray.workspace.v1')).toBeNull();
    expect(localStorage.getItem('codexray.pinned-variables.v1')).toBeNull();
    expect(localStorage.getItem('codexray.ai-chat.v1')).toBeNull();
    expect(localStorage.getItem('portfolio.theme')).toBe('dark');
  });

  it('resets only panel layout while preserving pins, chat and preferences', () => {
    localStorage.setItem('codexray.layout.v1', '{"leftWidth":800}');
    localStorage.setItem('codexray.layout.v2', '{"leftWidth":700}');
    localStorage.setItem('codexray.pinned-variables.v1', '["visited"]');
    localStorage.setItem('codexray.ai-chat.v1', '[{"role":"user"}]');
    localStorage.setItem('codexray.locale', 'tr');

    expect(resetCodeXRayInterfaceState()).toBe(2);
    expect(localStorage.getItem('codexray.layout.v1')).toBeNull();
    expect(localStorage.getItem('codexray.layout.v2')).toBeNull();
    expect(localStorage.getItem('codexray.pinned-variables.v1')).toBe('["visited"]');
    expect(localStorage.getItem('codexray.ai-chat.v1')).toBe('[{"role":"user"}]');
    expect(localStorage.getItem('codexray.locale')).toBe('tr');
  });
});
