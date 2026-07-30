import { describe, expect, it } from 'vitest';
import {
  constrainRightPanelSizes,
  createDefaultRightPanelSizes,
  RIGHT_PANEL_LIMITS,
} from './workspaceLayout';

describe('workspace layout sizing', () => {
  it('keeps the default controls compact across common desktop heights', () => {
    expect(createDefaultRightPanelSizes(720).controlHeight).toBe(104);
    expect(createDefaultRightPanelSizes(1080).controlHeight).toBe(104);
  });

  it('clamps oversized saved panels while preserving every panel minimum', () => {
    const constrained = constrainRightPanelSizes(720, 900, 700);
    expect(constrained.visualizerHeight).toBeGreaterThanOrEqual(
      RIGHT_PANEL_LIMITS.visualizer,
    );
    expect(constrained.assistantHeight).toBeGreaterThanOrEqual(
      RIGHT_PANEL_LIMITS.assistant,
    );
    expect(constrained.controlHeight).toBeGreaterThanOrEqual(
      RIGHT_PANEL_LIMITS.controls,
    );
    expect(
      constrained.visualizerHeight
      + constrained.assistantHeight
      + constrained.controlHeight
      + RIGHT_PANEL_LIMITS.splitterTotal,
    ).toBe(720);
  });
});
