import { describe, expect, it } from 'vitest';
import type { AiProviderCapabilities } from '../../types/aiProvider';
import { capabilityBudgetWarning, resolveCommandOutput } from './commandOutput';

interface Route { intent: 'navigate' | 'explain' }
const validateRoute = (value: unknown): value is Route => Boolean(
  value && typeof value === 'object'
  && ['navigate', 'explain'].includes(String((value as Record<string, unknown>).intent)),
);
const capabilities = (
  structuredOutput: AiProviderCapabilities['structuredOutput'],
  usableOutputTokens = 568,
): AiProviderCapabilities => ({
  chat: true,
  streaming: true,
  structuredOutput,
  advancedWorkflows: structuredOutput !== 'none',
  reasoningOverhead: 456,
  usableOutputTokens,
  checkedAt: 1,
  probeVersion: 2,
});

describe('deterministic-first command output resolution', () => {
  it('uses validated native output only as an additive model decision', () => {
    expect(resolveCommandOutput<Route>(
      { intent: 'explain' }, capabilities('native'), '{"intent":"navigate"}', validateRoute,
    )).toEqual({ value: { intent: 'navigate' }, source: 'model', notice: null });
  });

  it('makes prompt-only tolerant extraction visible', () => {
    expect(resolveCommandOutput<Route>(
      { intent: 'explain' }, capabilities('prompt-only'), "answer {'intent':'navigate',}", validateRoute,
    )).toMatchObject({ source: 'model', notice: expect.stringContaining('tolerant extraction') });
  });

  it('uses the deterministic decision visibly for none or invalid output', () => {
    expect(resolveCommandOutput<Route>(
      { intent: 'explain' }, capabilities('none'), '{"intent":"navigate"}', validateRoute,
    )).toMatchObject({ value: { intent: 'explain' }, source: 'deterministic', notice: expect.any(String) });
    expect(resolveCommandOutput<Route>(
      { intent: 'explain' }, capabilities('native'), 'not json', validateRoute,
    )).toMatchObject({ value: { intent: 'explain' }, source: 'deterministic', notice: expect.any(String) });
  });

  it('produces an actionable low usable-output warning', () => {
    expect(capabilityBudgetWarning(capabilities('prompt-only', 120))).toContain('2048');
    expect(capabilityBudgetWarning(capabilities('native', 250))).toBeNull();
  });
});
