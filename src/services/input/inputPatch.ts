import type { Locale } from '../../i18n/translations';
import type { CustomSimulationPackageV1, InputContractV1, WorkspaceSnapshotV1 } from '../../types/titan';
import type { GraphDocumentV1, SimulationInput } from '../../types/simulation';
import { parseSimulationInput, validateGraphDocument } from '../inputParsers';
import { createInputPreset } from '../inputPresets';
import { recompileSimulationInput } from '../recompileSimulationInput';

export type InputPatchV1 =
  | { op: 'set-array'; values: number[] }
  | { op: 'set-matrix'; values: number[][] }
  | { op: 'set-graph'; graph: GraphDocumentV1 }
  | { op: 'resize-array'; count: number; fill: 'ascending' | 'descending' | 'random-seeded' | 'duplicates' }
  | { op: 'sort-array'; direction: 'asc' | 'desc' }
  | { op: 'shuffle-array'; seed: number }
  | { op: 'set-text'; value: string }
  | { op: 'set-param'; name: string; value: number | string }
  | { op: 'set-target'; nodeId: string }
  | { op: 'graph-add-node'; id: string; label?: string; x?: number; y?: number }
  | { op: 'graph-add-edge'; from: string; to: string; weight?: number }
  | { op: 'graph-remove'; id: string }
  | { op: 'load-preset-input'; presetIndex: number };

export type InputPatchResult =
  | { ok: true; input: SimulationInput }
  | { ok: false; reason: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

export const parseInputPatch = (value: unknown): InputPatchV1 | null => {
  if (!isRecord(value) || typeof value.op !== 'string') return null;
  switch (value.op) {
    case 'set-array':
      return Array.isArray(value.values) && value.values.every(finite)
        ? { op: value.op, values: [...value.values] } : null;
    case 'set-matrix': {
      if (!Array.isArray(value.values) || value.values.length === 0) return null;
      const rows = value.values as unknown[];
      const width = Array.isArray(rows[0]) ? rows[0].length : 0;
      return width > 0 && rows.every((row) => Array.isArray(row)
        && row.length === width && row.every(finite))
        ? { op: value.op, values: rows.map((row) => Array.from(row as number[])) }
        : null;
    }
    case 'set-graph':
      if (!isRecord(value.graph)) return null;
      try {
        return { op: value.op, graph: validateGraphDocument(value.graph as unknown as GraphDocumentV1) };
      } catch {
        return null;
      }
    case 'resize-array':
      return Number.isInteger(value.count) && Number(value.count) >= 0 && Number(value.count) <= 10_000
        && ['ascending', 'descending', 'random-seeded', 'duplicates'].includes(String(value.fill))
        ? {
          op: value.op,
          count: Number(value.count),
          fill: value.fill as Extract<InputPatchV1, { op: 'resize-array' }>['fill'],
        }
        : null;
    case 'sort-array':
      return value.direction === 'asc' || value.direction === 'desc'
        ? { op: value.op, direction: value.direction } : null;
    case 'shuffle-array':
      return Number.isInteger(value.seed) ? { op: value.op, seed: Number(value.seed) } : null;
    case 'set-text':
      return typeof value.value === 'string' ? { op: value.op, value: value.value } : null;
    case 'set-param':
      return typeof value.name === 'string' && value.name.length > 0
        && (typeof value.value === 'string' || finite(value.value))
        ? { op: value.op, name: value.name, value: value.value } : null;
    case 'set-target':
      return typeof value.nodeId === 'string' && value.nodeId.length > 0
        ? { op: value.op, nodeId: value.nodeId } : null;
    case 'graph-add-node':
      return typeof value.id === 'string' && value.id.length > 0
        && (value.label === undefined || typeof value.label === 'string')
        && (value.x === undefined || finite(value.x))
        && (value.y === undefined || finite(value.y))
        ? {
          op: value.op,
          id: value.id,
          label: value.label as string | undefined,
          x: value.x as number | undefined,
          y: value.y as number | undefined,
        } : null;
    case 'graph-add-edge':
      return typeof value.from === 'string' && typeof value.to === 'string'
        && (value.weight === undefined || finite(value.weight))
        ? { op: value.op, from: value.from, to: value.to, weight: value.weight as number | undefined }
        : null;
    case 'graph-remove':
      return typeof value.id === 'string' && value.id.length > 0 ? { op: value.op, id: value.id } : null;
    case 'load-preset-input':
      return Number.isInteger(value.presetIndex) && Number(value.presetIndex) >= 0 && Number(value.presetIndex) <= 2
        ? { op: value.op, presetIndex: Number(value.presetIndex) } : null;
    default:
      return null;
  }
};

export const createInputReplacementPatch = (
  input: SimulationInput,
  options: { matrix?: boolean } = {},
): InputPatchV1 => {
  const raw: unknown = input.graph
    ? { op: 'set-graph', graph: input.graph }
    : options.matrix
      ? { op: 'set-matrix', values: JSON.parse(input.text) }
      : input.kind === 'array'
        ? { op: 'set-array', values: JSON.parse(input.text) }
        : input.kind === 'string'
          ? { op: 'set-text', value: input.text }
          : { op: 'load-preset-input', presetIndex: 2 };
  const patch = parseInputPatch(raw);
  if (!patch) throw new Error('The deterministic input adapter produced an invalid typed patch.');
  return patch;
};

const normalizedRequest = (request: string): string => request
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/ı/g, 'i')
  .toLocaleLowerCase('en-US');

export const createSemanticArrayPatch = (request: string): InputPatchV1 | null => {
  const text = normalizedRequest(request);
  if (!/\b(array|input|dizi|girdi)\w*\b/.test(text)) return null;

  const resizeMatch = text.match(/\b(\d{1,4})\s*(?:(?:ascending|descending|random|duplicate|artan|azalan|rastgele|tekrarli)\s+)?(?:items?|values?|elements?|eleman(?:li|a)?)\b/);
  const count = Number(resizeMatch?.[1]);
  if (Number.isInteger(count) && /\b(resize|make|change|boyut|yap|cikar)\w*\b/.test(text)) {
    const fill = /\b(descending|reverse|azalan|tersten)\b/.test(text) ? 'descending'
      : /\b(ascending|artan)\b/.test(text) ? 'ascending'
        : /\b(duplicates?|repeated|tekrarli)\b/.test(text) ? 'duplicates'
          : /\b(random|rastgele)\b/.test(text) ? 'random-seeded'
            : null;
    if (fill) return parseInputPatch({ op: 'resize-array', count, fill });
  }

  if (/\b(sort|sirala)\w*\b/.test(text)) {
    const direction = /\b(descending|reverse|azalan|tersten)\b/.test(text) ? 'desc'
      : /\b(ascending|artan)\b/.test(text) ? 'asc'
        : null;
    if (direction) return parseInputPatch({ op: 'sort-array', direction });
  }

  if (/\b(shuffle|karistir)\w*\b/.test(text)) {
    const seedMatch = text.match(/\b(?:seed|tohum)\s*(\d+)\b/) ?? text.match(/\b(\d+)\s*(?:seed|tohum)\b/);
    const seed = Number(seedMatch?.[1]);
    if (Number.isSafeInteger(seed)) return parseInputPatch({ op: 'shuffle-array', seed });
  }
  return null;
};

const seededValues = (count: number, seed = 0x9e3779b9): number[] => {
  let state = seed >>> 0 || 0x6d2b79f5;
  return Array.from({ length: count }, () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) % 100;
  });
};

const arrayForFill = (count: number, fill: Extract<InputPatchV1, { op: 'resize-array' }>['fill']): number[] => {
  if (fill === 'ascending') return Array.from({ length: count }, (_, index) => index + 1);
  if (fill === 'descending') return Array.from({ length: count }, (_, index) => count - index);
  if (fill === 'duplicates') return Array.from({ length: count }, (_, index) => (index % 3) + 1);
  return seededValues(count);
};

const shuffled = (values: number[], seed: number): number[] => {
  const result = [...values];
  let state = seed >>> 0 || 0x6d2b79f5;
  for (let index = result.length - 1; index > 0; index -= 1) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    const swapIndex = (state >>> 0) % (index + 1);
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
};

const arrayValues = (input: SimulationInput): number[] => {
  const parsed = JSON.parse(input.text) as unknown;
  if (!Array.isArray(parsed) || !parsed.every(finite)) throw new Error('The active array input is invalid.');
  return parsed;
};

const graphFor = (input: SimulationInput): GraphDocumentV1 => {
  if ((input.kind !== 'graph' && input.kind !== 'tree') || !input.graph) {
    throw new Error('This operation requires an active graph or tree input.');
  }
  return input.graph;
};

const constraintFailure = (input: SimulationInput, contract: InputContractV1): string | null => {
  const rejectsNegative = contract.constraints.some((constraint) => /non[- ]negative|no negative|negative.*not|pozitif|negatif.*(?:yok|kabul)/i.test(constraint));
  if (!rejectsNegative) return null;
  if (input.kind === 'array' && arrayValues(input).some((value) => value < 0)) {
    return 'This algorithm does not accept negative array values. Use zero or positive values.';
  }
  if ((input.kind === 'graph' || input.kind === 'tree') && input.graph?.edges.some((edge) => (edge.weight ?? 0) < 0)) {
    return 'This algorithm does not accept negative edge weights. Use zero or positive weights.';
  }
  return null;
};

export const applyInputPatch = (
  input: SimulationInput,
  patch: InputPatchV1,
  contract: InputContractV1,
): InputPatchResult => {
  if (input.kind !== contract.kind) {
    return { ok: false, reason: `The active input kind ${input.kind} does not match the ${contract.kind} contract.` };
  }
  try {
    let next: SimulationInput;
    if (patch.op === 'load-preset-input') {
      next = createInputPreset(contract.kind, patch.presetIndex, contract.description);
    } else if (patch.op === 'set-matrix') {
      if (input.kind !== 'array') throw new Error('This operation requires an array input.');
      next = { ...input, text: JSON.stringify(patch.values), origin: 'user' };
    } else if (patch.op === 'set-graph') {
      if (input.kind !== 'graph' && input.kind !== 'tree') throw new Error('This operation requires a graph or tree input.');
      next = { ...input, text: '', graph: patch.graph, origin: 'user' };
    } else if (patch.op === 'set-array' || patch.op === 'resize-array'
      || patch.op === 'sort-array' || patch.op === 'shuffle-array') {
      if (input.kind !== 'array') throw new Error('This operation requires an array input.');
      const values = patch.op === 'set-array' ? [...patch.values]
        : patch.op === 'resize-array' ? arrayForFill(patch.count, patch.fill)
          : patch.op === 'sort-array' ? [...arrayValues(input)].sort((left, right) =>
            patch.direction === 'asc' ? left - right : right - left)
            : shuffled(arrayValues(input), patch.seed);
      next = { ...input, text: JSON.stringify(values), origin: 'user' };
    } else if (patch.op === 'set-text') {
      if (input.kind !== 'string') throw new Error('This operation requires a string input.');
      next = { ...input, text: patch.value, origin: 'user' };
    } else if (patch.op === 'set-param') {
      next = { ...input, parameters: { ...input.parameters, [patch.name]: String(patch.value) }, origin: 'user' };
    } else {
      const graph = graphFor(input);
      if (patch.op === 'set-target') {
        if (!graph.nodes.some((node) => node.id === patch.nodeId)) throw new Error(`Graph node ${patch.nodeId} does not exist.`);
        next = { ...input, graph: { ...graph, targetId: patch.nodeId }, origin: 'user' };
      } else if (patch.op === 'graph-add-node') {
        if (graph.nodes.some((node) => node.id === patch.id)) throw new Error(`Graph node ${patch.id} already exists.`);
        const index = graph.nodes.length;
        next = {
          ...input,
          graph: {
            ...graph,
            nodes: [...graph.nodes, {
              id: patch.id,
              label: patch.label ?? patch.id,
              x: patch.x ?? 80 + (index % 6) * 110,
              y: patch.y ?? 80 + Math.floor(index / 6) * 110,
            }],
          },
          origin: 'user',
        };
      } else if (patch.op === 'graph-add-edge') {
        if (!graph.nodes.some((node) => node.id === patch.from) || !graph.nodes.some((node) => node.id === patch.to)) {
          throw new Error('Both edge endpoints must exist before an edge can be added.');
        }
        const duplicate = graph.edges.some((edge) => edge.from === patch.from && edge.to === patch.to
          || !graph.directed && edge.from === patch.to && edge.to === patch.from);
        if (duplicate) throw new Error(`Edge ${patch.from} to ${patch.to} already exists.`);
        if (graph.weighted && patch.weight === undefined) throw new Error('This weighted graph requires an edge weight.');
        if (!graph.weighted && patch.weight !== undefined) throw new Error('This unweighted graph does not accept edge weights.');
        const idBase = `${patch.from}-${patch.to}`;
        let id = idBase;
        let suffix = 2;
        while (graph.edges.some((edge) => edge.id === id)) id = `${idBase}-${suffix++}`;
        next = {
          ...input,
          graph: { ...graph, edges: [...graph.edges, { id, from: patch.from, to: patch.to, weight: patch.weight }] },
          origin: 'user',
        };
      } else {
        const nodeExists = graph.nodes.some((node) => node.id === patch.id);
        const edgeExists = graph.edges.some((edge) => edge.id === patch.id);
        if (!nodeExists && !edgeExists) throw new Error(`Graph item ${patch.id} does not exist.`);
        if (nodeExists && graph.nodes.length === 1) throw new Error('The final graph node cannot be removed.');
        const nodes = graph.nodes.filter((node) => node.id !== patch.id);
        const edges = graph.edges.filter((edge) => edge.id !== patch.id && edge.from !== patch.id && edge.to !== patch.id);
        const fallbackId = nodes[0].id;
        const childFallback = graph.edges.find((edge) => edge.from === patch.id
          && nodes.some((node) => node.id === edge.to))?.to;
        next = {
          ...input,
          graph: {
            ...graph,
            nodes,
            edges,
            startId: graph.startId === patch.id ? fallbackId : graph.startId,
            rootId: graph.rootId === patch.id ? childFallback ?? fallbackId : graph.rootId,
            targetId: graph.targetId === patch.id ? nodes.at(-1)?.id : graph.targetId,
          },
          origin: 'user',
        };
      }
    }
    if (next.graph) next = { ...next, graph: validateGraphDocument(next.graph) };
    const failure = constraintFailure(next, contract);
    if (failure) return { ok: false, reason: failure };
    if (patch.op === 'set-matrix') return { ok: true, input: next };
    const parsed = parseSimulationInput(next.kind, next.text, next.graph, next.parameters);
    if (parsed.error || !parsed.input) return { ok: false, reason: parsed.error ?? 'The patched input is invalid.' };
    return { ok: true, input: { ...parsed.input, origin: next.origin } };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : 'The input patch could not be applied.' };
  }
};

export type InputPatchRecompileResult =
  | { ok: true; input: SimulationInput; package: CustomSimulationPackageV1; currentIndex: 0 }
  | { ok: false; reason: string; package: CustomSimulationPackageV1 };

export const applyInputPatches = (
  input: SimulationInput,
  patches: InputPatchV1[],
  contract: InputContractV1,
): InputPatchResult => {
  let candidate = input;
  for (const patch of patches) {
    const applied = applyInputPatch(candidate, patch, contract);
    if (applied.ok === false) return { ...applied };
    candidate = applied.input;
  }
  return { ok: true, input: candidate };
};

export const applyAndRecompileInputPatches = (options: {
  activePackage: CustomSimulationPackageV1;
  currentInput: SimulationInput;
  patches: InputPatchV1[];
  locale: Locale;
  workspace: WorkspaceSnapshotV1;
}): InputPatchRecompileResult => {
  const applied = applyInputPatches(options.currentInput, options.patches, options.activePackage.input);
  if (applied.ok === false) return { ...applied, package: options.activePackage };
  try {
    const nextPackage = recompileSimulationInput({
      activePackage: options.activePackage,
      input: applied.input,
      locale: options.locale,
      workspace: options.workspace,
    });
    return { ok: true, input: applied.input, package: nextPackage, currentIndex: 0 };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : 'The patched input could not be recompiled.',
      package: options.activePackage,
    };
  }
};

export const applyAndRecompileInputPatch = (options: {
  activePackage: CustomSimulationPackageV1;
  currentInput: SimulationInput;
  patch: InputPatchV1;
  locale: Locale;
  workspace: WorkspaceSnapshotV1;
}): InputPatchRecompileResult => {
  return applyAndRecompileInputPatches({ ...options, patches: [options.patch] });
};
