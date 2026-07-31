import { describe, expect, it } from 'vitest';
import {
  constrainRightPanelSizes,
  createDefaultRightPanelSizes,
  RIGHT_PANEL_LIMITS,
} from './workspaceLayout';

describe('workspace layout sizing', () => {
  it('keeps the default controls compact across common desktop heights', () => {
    expect(createDefaultRightPanelSizes(720)).toEqual({
      visualizerHeight: 377,
      assistantHeight: 273,
      controlHeight: 58,
    });
    expect(createDefaultRightPanelSizes(1080)).toEqual({
      visualizerHeight: 586,
      assistantHeight: 424,
      controlHeight: 58,
    });
  });

  it('clamps oversized saved panels while preserving every panel minimum', () => {
    const constrained = constrainRightPanelSizes(720, 900, 700, 500);
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

  it('preserves the ratios of all three panels when viewport height changes', () => {
    const constrained = constrainRightPanelSizes(720, 569, 379, 120);
    expect(constrained.visualizerHeight).toBeGreaterThan(constrained.assistantHeight);
    expect(constrained.assistantHeight).toBeGreaterThan(constrained.controlHeight);
    expect(
      constrained.visualizerHeight
      + constrained.assistantHeight
      + constrained.controlHeight
      + RIGHT_PANEL_LIMITS.splitterTotal,
    ).toBeCloseTo(720, 8);
  });
});
