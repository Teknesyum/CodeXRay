import type {
  GraphDocumentV1,
  GraphEdge,
  GraphNode,
  InputKind,
  InputValidationResult,
} from '../types/simulation';

const MAX_INPUT_ITEMS = 200;

const assertFiniteNumber = (value: unknown, label: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number.`);
  }
  return value;
};

const normalizeNode = (value: unknown, index: number): GraphNode => {
  if (!value || typeof value !== 'object') {
    throw new Error(`Node ${index + 1} must be an object.`);
  }
  const node = value as Record<string, unknown>;
  const id = String(node.id ?? '').trim();
  if (!id) throw new Error(`Node ${index + 1} needs a non-empty id.`);
  return {
    id,
    label: String(node.label ?? id),
    x: Math.min(96, Math.max(4, assertFiniteNumber(node.x, `Node ${id} x`))),
    y: Math.min(94, Math.max(6, assertFiniteNumber(node.y, `Node ${id} y`))),
  };
};

const normalizeEdge = (
  value: unknown,
  index: number,
  nodeIds: Set<string>,
  weighted: boolean,
): GraphEdge => {
  if (!value || typeof value !== 'object') {
    throw new Error(`Edge ${index + 1} must be an object.`);
  }
  const edge = value as Record<string, unknown>;
  const from = String(edge.from ?? '').trim();
  const to = String(edge.to ?? '').trim();
  if (!nodeIds.has(from) || !nodeIds.has(to)) {
    throw new Error(`Edge ${index + 1} references an unknown node.`);
  }
  const normalized: GraphEdge = {
    id: String(edge.id ?? `${from}-${to}-${index}`),
    from,
    to,
  };
  if (weighted) {
    const weight = edge.weight ?? 1;
    normalized.weight = assertFiniteNumber(weight, `Edge ${index + 1} weight`);
  }
  return normalized;
};

export const validateGraphDocument = (value: unknown): GraphDocumentV1 => {
  if (!value || typeof value !== 'object') {
    throw new Error('Graph input must be a JSON object.');
  }
  const document = value as Record<string, unknown>;
  if (document.version !== 1) throw new Error('Only graph document version 1 is supported.');
  if (document.mode !== 'tree' && document.mode !== 'graph') {
    throw new Error('mode must be either "tree" or "graph".');
  }
  if (!Array.isArray(document.nodes) || !Array.isArray(document.edges)) {
    throw new Error('nodes and edges must be arrays.');
  }
  if (document.nodes.length === 0) throw new Error('Add at least one node.');
  if (document.nodes.length > MAX_INPUT_ITEMS) {
    throw new Error(`A graph can contain at most ${MAX_INPUT_ITEMS} nodes.`);
  }

  const nodes = document.nodes.map(normalizeNode);
  const nodeIds = new Set(nodes.map((node) => node.id));
  if (nodeIds.size !== nodes.length) throw new Error('Node ids must be unique.');

  const weighted = Boolean(document.weighted);
  const edges = document.edges.map((edge, index) =>
    normalizeEdge(edge, index, nodeIds, weighted),
  );
  const startId = String(document.startId ?? nodes[0].id);
  if (!nodeIds.has(startId)) throw new Error('startId must reference an existing node.');

  const rootId = document.rootId === undefined ? undefined : String(document.rootId);
  const targetId = document.targetId === undefined ? undefined : String(document.targetId);
  if (rootId && !nodeIds.has(rootId)) throw new Error('rootId must reference an existing node.');
  if (targetId && !nodeIds.has(targetId)) throw new Error('targetId must reference an existing node.');

  if (document.mode === 'tree') {
    const root = rootId ?? startId;
    if (edges.length !== nodes.length - 1) {
      throw new Error('A tree must have exactly nodes.length - 1 edges.');
    }
    const incoming = new Map(nodes.map((node) => [node.id, 0]));
    for (const edge of edges) incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1);
    if ((incoming.get(root) ?? 0) !== 0) throw new Error('The tree root cannot have a parent.');
    for (const node of nodes) {
      if (node.id !== root && incoming.get(node.id) !== 1) {
        throw new Error(`Tree node ${node.id} must have exactly one parent.`);
      }
    }
  }

  return {
    version: 1,
    mode: document.mode,
    directed: document.mode === 'tree' ? true : Boolean(document.directed),
    weighted,
    nodes,
    edges,
    rootId: document.mode === 'tree' ? rootId ?? startId : rootId,
    startId,
    targetId,
  };
};

export const parseArrayInput = (text: string): number[] => {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('Enter an array, for example [8, 3, 5, 1].');
  let value: unknown;
  try {
    value = JSON.parse(trimmed);
  } catch {
    value = trimmed.split(',').map((part) => Number(part.trim()));
  }
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('Array input must contain at least one number.');
  }
  if (value.length > MAX_INPUT_ITEMS) {
    throw new Error(`An array can contain at most ${MAX_INPUT_ITEMS} values.`);
  }
  return value.map((item, index) => assertFiniteNumber(item, `Array item ${index + 1}`));
};

export const parseStringInput = (text: string): string => {
  const trimmed = text.trim();
  const assignment = trimmed.match(/^[a-zA-Z_]\w*\s*=\s*(['"])(.*)\1$/);
  const value = assignment ? assignment[2] : trimmed.replace(/^(['"])(.*)\1$/, '$2');
  if (!value) throw new Error('Enter a non-empty string, for example AABAABAAZ.');
  if (value.length > MAX_INPUT_ITEMS) {
    throw new Error(`A string can contain at most ${MAX_INPUT_ITEMS} characters.`);
  }
  return value;
};

export const parseBinaryTree = (text: string): GraphDocumentV1 => {
  let values: unknown;
  try {
    values = JSON.parse(text);
  } catch {
    throw new Error('Use a level-order JSON array, for example [1,2,3,null,4].');
  }
  if (!Array.isArray(values) || values.length === 0 || values[0] === null) {
    throw new Error('The level-order array must start with a root value.');
  }
  if (values.length > MAX_INPUT_ITEMS) {
    throw new Error(`A tree can contain at most ${MAX_INPUT_ITEMS} positions.`);
  }

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const levels = Math.max(1, Math.floor(Math.log2(values.length)) + 1);
  values.forEach((rawValue, index) => {
    if (rawValue === null || rawValue === undefined) return;
    const level = Math.floor(Math.log2(index + 1));
    const position = index - (2 ** level - 1);
    const count = 2 ** level;
    const id = `n${index}`;
    nodes.push({
      id,
      label: String(rawValue),
      x: ((position + 1) / (count + 1)) * 100,
      y: 10 + (level / Math.max(1, levels - 1)) * 80,
    });
    if (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      if (values[parentIndex] === null || values[parentIndex] === undefined) {
        throw new Error(`Position ${index} has no parent. Add null placeholders correctly.`);
      }
      edges.push({
        id: `n${parentIndex}-n${index}`,
        from: `n${parentIndex}`,
        to: id,
      });
    }
  });

  return validateGraphDocument({
    version: 1,
    mode: 'tree',
    directed: true,
    weighted: false,
    nodes,
    edges,
    rootId: 'n0',
    startId: 'n0',
  });
};

export const parseSimulationInput = (
  kind: InputKind,
  text: string,
  graph?: GraphDocumentV1,
): InputValidationResult => {
  try {
    if (kind === 'array') {
      parseArrayInput(text);
      return { input: { kind, text } };
    }
    if (kind === 'string') {
      parseStringInput(text);
      return { input: { kind, text } };
    }
    if (!graph) throw new Error(`Create or import a ${kind} before simulating.`);
    const validated = validateGraphDocument({ ...graph, mode: kind });
    return { input: { kind, text, graph: validated } };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Invalid simulation input.' };
  }
};
