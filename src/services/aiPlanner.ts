export const PLANNER_MAX_ACTIONS = 3;

const actionWithoutStep = (type: string) => ({
  type: 'object',
  properties: { type: { const: type } },
  required: ['type'],
  additionalProperties: false,
});

export const buildActionPlanSchema = (maximumStep: number) => ({
  type: 'object',
  properties: {
    actions: {
      type: 'array',
      items: {
        oneOf: [
          {
            type: 'object',
            properties: {
              type: { const: 'jump' },
              step: { type: 'integer', minimum: 1, maximum: maximumStep },
            },
            required: ['type', 'step'],
            additionalProperties: false,
          },
          actionWithoutStep('play'),
          actionWithoutStep('pause'),
          actionWithoutStep('next'),
          actionWithoutStep('previous'),
          actionWithoutStep('next-important'),
          actionWithoutStep('previous-important'),
          actionWithoutStep('tour'),
        ],
      },
      maxItems: PLANNER_MAX_ACTIONS,
    },
  },
  required: ['actions'],
  additionalProperties: false,
});

export const buildPlannerCompletionOptions = (maximumStep: number) => ({
  temperature: 0,
  enable_thinking: false,
  response_format: {
    type: 'json_object' as const,
    schema: JSON.stringify(buildActionPlanSchema(maximumStep)),
  },
  max_tokens: 160,
});
