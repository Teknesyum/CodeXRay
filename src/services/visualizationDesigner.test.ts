import { describe, expect, it } from 'vitest';
import type { AlgorithmDesignV1, GraphLayoutSpecV1 } from '../types/godMode';
import type { SimulationInput } from '../types/simulation';
import { createVisualizationContractV2, isVisualizationV2, validateVisualizationContractV2 } from './visualizationDesigner';

const layout: GraphLayoutSpecV1 = {
  version: 1,
  strategy: 'layered',
  groups: [],
  layers: [],
  pinnedNodeIds: [],
  minimumNodeDistance: 8,
  collisionResolution: 'spread',
  userPositions: {},
  responsive: { narrowStrategy: 'layered', mobileScale: 0.82, minimumNodeDistance: 6 },
};

const design = (title: string, inputKind: AlgorithmDesignV1['inputKind']): AlgorithmDesignV1 => ({
  version: 1,
  title,
  purpose: 'Test the contract.',
  inputKind,
  dataStructures: [],
  invariants: [],
  termination: 'Done.',
  complexity: { time: 'O(1)', space: 'O(1)' },
});

describe('visualization contracts', () => {
  it.each([
    ['Array algorithm', 'array', { kind: 'array', text: '[1,2]' }, 'array'],
    ['String algorithm', 'string', { kind: 'string', text: 'abc' }, 'variables'],
  ] as const)('selects the %s visual type', (_title, kind, input, expected) => {
    const contract = createVisualizationContractV2(
      design(_title, kind),
      input as SimulationInput,
      layout,
    );
    expect(contract.type).toBe(expected);
    expect(contract.nodeRoles).toEqual([]);
    expect(isVisualizationV2(contract)).toBe(true);
  });

  it('creates baseline graph roles for an ordinary traversal', () => {
    const contract = createVisualizationContractV2(
      design('Breadth First Search', 'graph'),
      { kind: 'graph', text: '' },
      layout,
    );
    expect(contract.type).toBe('graph');
    expect(contract.nodeRoles.map((role) => role.id)).toEqual([
      'start', 'target', 'queued', 'visited', 'path',
    ]);
    expect(contract.edgeRoles.map((role) => role.id)).toEqual(['path']);
    expect(contract.frontierLayers).toEqual([]);
  });

  it('distinguishes both frontiers, meeting point, and traversal edges for bidirectional BFS', () => {
    const contract = createVisualizationContractV2(
      design('İki Yönlü BFS — Özel', 'graph'),
      { kind: 'graph', text: '' },
      layout,
    );
    expect(contract.nodeRoles.map((role) => role.id)).toEqual(expect.arrayContaining([
      'frontier-start', 'frontier-target', 'visited-both', 'meeting', 'path',
    ]));
    expect(contract.edgeRoles.map((role) => role.id)).toEqual(expect.arrayContaining([
      'inspect-start', 'inspect-target', 'tree-start', 'tree-target', 'path',
    ]));
    expect(contract.frontierLayers).toHaveLength(2);
    expect(contract.activeEdges).toHaveLength(2);
    expect(contract.legend.find((item) => item.role === 'meeting')?.shape).toBe('star');
  });

  it('treats a supplied graph as graph visual data even for a generic design', () => {
    const input: SimulationInput = {
      kind: 'array',
      text: '[1]',
      graph: {
        version: 1,
        mode: 'graph',
        directed: false,
        weighted: false,
        nodes: [{ id: 'A', label: 'A', x: 50, y: 50 }],
        edges: [],
        startId: 'A',
      },
    };
    expect(createVisualizationContractV2(design('Custom', 'array'), input, layout).type)
      .toBe('graph');
  });

  it.each([
    ['Custom shortest path', ['candidate', 'settled'], ['relax', 'shortest-tree']],
    ['Custom minimum spanning tree', ['component'], ['candidate-edge', 'tree-edge']],
    ['Custom maximum flow residual network', ['augment-frontier'], ['residual-edge', 'augmenting-path']],
    ['Custom topological dependency order', ['ready', 'ordered'], []],
  ])('creates task-specific visual grammar for %s', (title, expectedNodes, expectedEdges) => {
    const contract = createVisualizationContractV2(design(title, 'graph'), { kind: 'graph', text: '' }, layout);
    expect(contract.nodeRoles.map((role) => role.id)).toEqual(expect.arrayContaining(expectedNodes));
    expect(contract.edgeRoles.map((role) => role.id)).toEqual(expect.arrayContaining(expectedEdges));
    expect(contract.legend.map((item) => item.role)).toEqual(expect.arrayContaining(expectedNodes));
    expect(validateVisualizationContractV2(contract)).toEqual([]);
  });

  it('rejects duplicate roles and unsafe visual bounds before package commit', () => {
    const contract = createVisualizationContractV2(design('Graph scan', 'graph'), { kind: 'graph', text: '' }, layout);
    contract.nodeRoles.push({ ...contract.nodeRoles[0], style: { ...contract.nodeRoles[0].style, size: 12 } });
    contract.edgeRoles[0].style.opacity = 0;
    expect(validateVisualizationContractV2(contract)).toEqual(expect.arrayContaining([
      'Semantic node role IDs must be unique.',
      'Node role start has an unsafe size.',
      'Edge role path has unsafe visual bounds.',
    ]));
  });
});
