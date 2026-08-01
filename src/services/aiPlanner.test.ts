import { describe, expect, it } from 'vitest';
import { buildActionPlanSchema, buildPlannerCompletionOptions } from './aiPlanner';

describe('local timeline planner configuration', () => {
  it('uses deterministic non-thinking JSON generation', () => {
    const options = buildPlannerCompletionOptions(40);
    expect(options).toMatchObject({
      temperature: 0,
      enable_thinking: false,
      max_tokens: 160,
      response_format: { type: 'json_object' },
    });
  });

  it('builds a closed bounded schema', () => {
    const schema = buildActionPlanSchema(40);
    expect(schema.additionalProperties).toBe(false);
    expect(schema.properties.actions.maxItems).toBe(3);
    const variants = schema.properties.actions.items.oneOf;
    expect(variants).toHaveLength(8);
    expect(variants.every((variant) => variant.additionalProperties === false)).toBe(true);
    const jumpProperties = variants[0].properties;
    expect('step' in jumpProperties).toBe(true);
    if (!('step' in jumpProperties)) throw new Error('Jump schema is missing its step property.');
    expect(jumpProperties.step).toMatchObject({ minimum: 1, maximum: 40 });
  });
});
