import { describe, expect, it } from 'vitest';
import { calculateVisualAutoFitScale } from './visualAutoFit';

describe('visual auto-fit scale', () => {
  it('keeps content at its natural size when it fits', () => {
    expect(calculateVisualAutoFitScale(800, 500, 600, 320)).toBe(1);
  });

  it('preserves aspect ratio while fitting the limiting dimension', () => {
    expect(calculateVisualAutoFitScale(400, 300, 800, 400)).toBe(0.5);
    expect(calculateVisualAutoFitScale(500, 200, 600, 800)).toBe(0.25);
  });

  it('falls back safely until measurable browser dimensions exist', () => {
    expect(calculateVisualAutoFitScale(0, 300, 800, 400)).toBe(1);
    expect(calculateVisualAutoFitScale(400, 300, 0, 400)).toBe(1);
  });
});
