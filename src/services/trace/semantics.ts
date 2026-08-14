import type { TracePrimitive, TraceValue, VisualData } from '../../types/simulation';

const primitive = (value: TraceValue): value is TracePrimitive =>
  value === null || ['string', 'number', 'boolean'].includes(typeof value);

const rectangularMatrix = (value: TraceValue): value is TracePrimitive[][] => {
  if (!Array.isArray(value) || value.length === 0 || !value.every(Array.isArray)) return false;
  const width = value[0]?.length ?? 0;
  return width > 0 && value.every((row) => row.length === width && row.every(primitive));
};

const flatArray = (value: TraceValue): value is TracePrimitive[] =>
  Array.isArray(value) && value.length > 0 && value.every(primitive);

const adjacency = (value: TraceValue): value is Record<string, TraceValue[]> =>
  Boolean(value && !Array.isArray(value) && typeof value === 'object'
    && Object.keys(value).length > 0
    && Object.values(value).every((neighbors) => Array.isArray(neighbors) && neighbors.every(primitive)));

export const inferTraceVisual = (scopes: Record<string, TraceValue>): VisualData => {
  const entries = Object.entries(scopes)
    .filter(([name]) => !name.startsWith('_'))
    .sort(([left], [right]) => left.localeCompare(right));
  const matrix = entries.find(([, value]) => rectangularMatrix(value));
  if (matrix && rectangularMatrix(matrix[1])) {
    return {
      type: 'matrix',
      values: matrix[1],
      rowLabels: matrix[1].map((_, index) => String(index)),
      columnLabels: matrix[1][0].map((_, index) => String(index)),
      highlights: [],
      fillDirection: 'row',
      vars: scopes,
    };
  }

  const graph = entries.find(([, value]) => adjacency(value));
  if (graph && adjacency(graph[1])) {
    const ids = [...new Set([...Object.keys(graph[1]), ...Object.values(graph[1]).flat().map(String)])].sort();
    const nodes = ids.map((id, index) => {
      const angle = ids.length === 1 ? 0 : 2 * Math.PI * index / ids.length;
      return { id, label: id, x: 50 + 38 * Math.cos(angle), y: 50 + 38 * Math.sin(angle) };
    });
    const edges = Object.entries(graph[1]).flatMap(([from, targets]) => targets.map((target, index) => ({
      id: `${from}-${String(target)}-${index}`,
      from,
      to: String(target),
    })));
    return { type: 'graph', directed: true, nodes, edges, vars: scopes };
  }

  const array = entries.find(([, value]) => flatArray(value));
  if (array && flatArray(array[1])) {
    const arrayValues = array[1];
    const pointers = Object.fromEntries(entries.filter(([, value]) =>
      typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < arrayValues.length));
    return {
      type: 'array',
      values: arrayValues,
      pointers: Object.keys(pointers).length >= 2 ? pointers as Record<string, number> : undefined,
      vars: scopes,
    };
  }

  return { type: 'variables', vars: scopes };
};
