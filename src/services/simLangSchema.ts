const identifier = { type: 'string', pattern: '^[A-Za-z_][A-Za-z0-9_]{0,63}$' };

const expressionReference = { $ref: '#/$defs/expression' };
const statementReference = { $ref: '#/$defs/statement' };

const expressionSchema = {
  oneOf: [
    {
      type: 'object',
      properties: { type: { const: 'literal' }, value: {} },
      required: ['type', 'value'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: { type: { const: 'variable' }, name: identifier },
      required: ['type', 'name'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        type: { const: 'input-field' },
        field: { enum: ['text', 'array', 'graph', 'startId', 'targetId'] },
      },
      required: ['type', 'field'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        type: { const: 'binary' },
        operator: { enum: ['+', '-', '*', '/', '%', '==', '!=', '<', '<=', '>', '>=', 'and', 'or'] },
        left: expressionReference,
        right: expressionReference,
      },
      required: ['type', 'operator', 'left', 'right'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        type: { const: 'unary' },
        operator: { enum: ['not', 'negate'] },
        value: expressionReference,
      },
      required: ['type', 'operator', 'value'],
      additionalProperties: false,
    },
    ...['length'].map((type) => ({
      type: 'object',
      properties: { type: { const: type }, value: expressionReference },
      required: ['type', 'value'],
      additionalProperties: false,
    })),
    {
      type: 'object',
      properties: { type: { const: 'array-at' }, value: expressionReference, index: expressionReference },
      required: ['type', 'value', 'index'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: { type: { const: 'range' }, start: expressionReference, end: expressionReference },
      required: ['type', 'start', 'end'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: { type: { const: 'contains' }, collection: expressionReference, value: expressionReference },
      required: ['type', 'collection', 'value'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: { type: { const: 'map-get' }, map: expressionReference, key: expressionReference },
      required: ['type', 'map', 'key'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: { type: { const: 'neighbors' }, node: expressionReference },
      required: ['type', 'node'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: { type: { const: 'first-intersection' }, left: expressionReference, right: expressionReference },
      required: ['type', 'left', 'right'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        type: { const: 'reconstruct-bidirectional-path' },
        meeting: expressionReference,
        parentFromStart: expressionReference,
        parentFromTarget: expressionReference,
      },
      required: ['type', 'meeting', 'parentFromStart', 'parentFromTarget'],
      additionalProperties: false,
    },
  ],
};

const statementBase = (type: string, properties: Record<string, unknown>, required: string[]) => ({
  type: 'object',
  properties: { id: identifier, type: { const: type }, ...properties },
  required: ['id', 'type', ...required],
  additionalProperties: false,
});

const statementSchema = {
  oneOf: [
    statementBase('declare', { name: identifier, value: expressionReference }, ['name', 'value']),
    statementBase('assign', { name: identifier, value: expressionReference }, ['name', 'value']),
    statementBase('array-push', { array: identifier, value: expressionReference }, ['array', 'value']),
    statementBase('array-shift', { array: identifier, target: identifier }, ['array', 'target']),
    statementBase('array-set', {
      array: identifier,
      index: expressionReference,
      value: expressionReference,
    }, ['array', 'index', 'value']),
    statementBase('swap', {
      array: identifier,
      left: expressionReference,
      right: expressionReference,
    }, ['array', 'left', 'right']),
    statementBase('set-add', { set: identifier, value: expressionReference }, ['set', 'value']),
    statementBase('map-set', {
      map: identifier,
      key: expressionReference,
      value: expressionReference,
    }, ['map', 'key', 'value']),
    statementBase('if', {
      condition: expressionReference,
      then: { type: 'array', items: statementReference, maxItems: 100 },
      else: { type: 'array', items: statementReference, maxItems: 100 },
    }, ['condition', 'then']),
    statementBase('while', {
      condition: expressionReference,
      body: { type: 'array', items: statementReference, maxItems: 100 },
      maxIterations: { type: 'integer', minimum: 1, maximum: 2_000 },
    }, ['condition', 'body', 'maxIterations']),
    statementBase('for-each', {
      item: identifier,
      values: expressionReference,
      body: { type: 'array', items: statementReference, maxItems: 100 },
    }, ['item', 'values', 'body']),
    statementBase('call', {
      functionName: identifier,
      args: { type: 'array', items: expressionReference, maxItems: 12 },
      result: identifier,
    }, ['functionName', 'args']),
    statementBase('return', { value: expressionReference }, []),
    statementBase('break', {}, []),
    statementBase('continue', {}, []),
    statementBase('trace', {
      at: identifier,
      explanation: { type: 'string', minLength: 1, maxLength: 600 },
      category: { enum: ['initialization', 'branch', 'mutation', 'frontier', 'invariant', 'meeting', 'result', 'error'] },
      importance: { type: 'number', minimum: 0, maximum: 1 },
    }, ['at', 'explanation']),
  ],
};

export const PROGRAM_SPEC_V1_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    version: { const: 1 },
    id: identifier,
    title: { type: 'string', minLength: 1, maxLength: 120 },
    locale: { enum: ['en', 'tr'] },
    inputKind: { enum: ['array', 'string', 'tree', 'graph'] },
    entry: { type: 'array', items: statementReference, minItems: 1, maxItems: 300 },
    functions: {
      type: 'array',
      maxItems: 20,
      items: {
        type: 'object',
        properties: {
          name: identifier,
          parameters: { type: 'array', items: identifier, maxItems: 12 },
          body: { type: 'array', items: statementReference, maxItems: 200 },
        },
        required: ['name', 'parameters', 'body'],
        additionalProperties: false,
      },
    },
    budgets: {
      type: 'object',
      properties: {
        instructions: { type: 'integer', minimum: 20, maximum: 20_000 },
        traceSteps: { type: 'integer', minimum: 1, maximum: 1_200 },
        recursionDepth: { type: 'integer', minimum: 1, maximum: 64 },
        collectionSize: { type: 'integer', minimum: 1, maximum: 10_000 },
      },
      required: ['instructions', 'traceSteps', 'recursionDepth', 'collectionSize'],
      additionalProperties: false,
    },
  },
  required: ['version', 'id', 'title', 'locale', 'inputKind', 'entry', 'functions', 'budgets'],
  additionalProperties: false,
  $defs: {
    expression: expressionSchema,
    statement: statementSchema,
  },
};

export const SIMLANG_AUTHOR_INSTRUCTIONS = [
  'Return one ProgramSpecV1 JSON object.',
  'Every statement id must be unique and every trace.at must reference a real non-trace statement id.',
  'Initialize arrays/sets with literal [] and maps with literal {}.',
  'Use input-field array/text/startId/targetId and neighbors for live input.',
  'Use range for deterministic index iteration, array-at for reads, array-set for writes, and swap for in-place algorithms.',
  'Use explicit trace statements after meaningful mutations so the user can step through the algorithm.',
  'A while condition must change and maxIterations must be finite; literal true loops are rejected.',
  'Keep the program compact enough for a local model response.',
].join(' ');
