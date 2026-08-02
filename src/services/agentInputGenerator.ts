import type { AlgorithmDesignV1, InputContractV1, WorkspaceSnapshotV1 } from '../types/godMode';
import type { GraphDocumentV1, SimulationInput } from '../types/simulation';
import { parseSimulationInput } from './inputParsers';
import { createInputPreset } from './inputPresets';

const hashText = (value: string): number => {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const wantsFreshInput = (request: string): boolean =>
  /kendi (?:graph|graf|input|girdi)|[oö]zg[uü]n (?:graph|graf|input|girdi)|create (?:your own|a new)|yeni (?:graph|graf)/i.test(request);

const wantsCurrentInput = (request: string): boolean =>
  /(?:bu|mevcut|elimdeki|verdi[gğ]im) (?:graph|graf|input|girdi)|current (?:graph|input)|my (?:graph|input)/i.test(request);

const createBidirectionalGraph = (seed: number): GraphDocumentV1 => {
  const suffix = ['A', 'B', 'C', 'D'][seed % 4];
  const ids = ['S', `${suffix}1`, `${suffix}2`, `${suffix}3`, 'M', `${suffix}4`, `${suffix}5`, `${suffix}6`, `${suffix}7`, 'T'];
  const labels: Record<string, string> = { S: 'Start', M: 'Meet?', T: 'Target' };
  const nodes = ids.map((id, index) => ({ id, label: labels[id] ?? id, x: 8 + index * 9, y: 50 }));
  const pairs: Array<[number, number]> = [
    [0, 1], [0, 2], [1, 3], [2, 3], [2, 4], [3, 4],
    [4, 5], [4, 6], [5, 7], [6, 8], [7, 9], [8, 9],
    [1, 6], [3, 7],
  ];
  return {
    version: 1,
    mode: 'graph',
    directed: false,
    weighted: false,
    nodes,
    edges: pairs.map(([from, to], index) => ({ id: `agent-e${index + 1}`, from: ids[from], to: ids[to] })),
    startId: 'S',
    targetId: 'T',
  };
};

const createPedagogicalInput = (
  design: AlgorithmDesignV1,
  request: string,
): SimulationInput => {
  const seed = hashText(`${design.title}:${request}`);
  if (design.inputKind === 'graph') {
    const graph = createBidirectionalGraph(seed);
    return { kind: 'graph', text: '', graph };
  }
  if (design.inputKind === 'tree') {
    return createInputPreset('tree', seed % 3, design.title);
  }
  if (design.inputKind === 'string') {
    const samples = [
      'TRACEALGORITHMWORKSPACE',
      'BANANABANDANACABANA',
      'NEONFRONTIERMEETINGPOINT',
    ];
    return { kind: 'string', text: samples[seed % samples.length] };
  }
  if (/permutation|subset|combination|backtrack/i.test(design.title)) {
    const samples = ['[2,5,7,9,12]', '[1,4,6,8,11]', '[3,10,14,18,21]'];
    return { kind: 'array', text: samples[seed % samples.length] };
  }
  const arrays = [
    '[12,-4,7,7,0,19,-8,5,13,2,21,-3,11,6]',
    '[31,4,18,9,27,1,16,8,23,5,42,14,3,29]',
    '[6,2,9,3,8,1,7,4,5,0,12,10,15,11]',
  ];
  return { kind: 'array', text: arrays[seed % arrays.length] };
};

export const createAgentInputContract = (
  design: AlgorithmDesignV1,
  request: string,
  workspace: WorkspaceSnapshotV1,
): InputContractV1 => {
  const current = workspace.simulationInput;
  const parsedCurrent = current.kind === design.inputKind
    ? parseSimulationInput(current.kind, current.text, current.graph, current.parameters).input
    : undefined;
  const preserveCurrent = Boolean(parsedCurrent)
    && !wantsFreshInput(request)
    && (wantsCurrentInput(request) || current.origin !== 'preset');
  if (preserveCurrent && parsedCurrent) {
    return {
      version: 1,
      kind: design.inputKind,
      description: `User workspace input preserved for ${design.title}.`,
      constraints: [design.termination, ...design.invariants.slice(0, 3)],
      value: { ...parsedCurrent, origin: 'user' },
      origin: 'user',
    };
  }

  try {
    const value = createPedagogicalInput(design, request);
    const parsed = parseSimulationInput(value.kind, value.text, value.graph, value.parameters);
    if (!parsed.input) throw new Error(parsed.error ?? 'Generated input failed validation.');
    return {
      version: 1,
      kind: design.inputKind,
      description: `Original teaching input generated for ${design.title}.`,
      constraints: [design.termination, ...design.invariants.slice(0, 3)],
      value: { ...parsed.input, origin: 'agent' },
      origin: 'agent',
    };
  } catch (error) {
    return {
      version: 1,
      kind: design.inputKind,
      description: `Validated fallback input for ${design.title}.`,
      constraints: [design.termination, ...design.invariants.slice(0, 3)],
      value: createInputPreset(design.inputKind, 2, design.title),
      origin: 'fallback',
      fallbackReason: error instanceof Error ? error.message : 'Agent input generation failed.',
    };
  }
};
