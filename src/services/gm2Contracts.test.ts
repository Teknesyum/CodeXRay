import { describe, expect, it } from 'vitest';
import { algorithmRegistry } from './codeRegistry';
import { createAgentInputContract } from './agentInputGenerator';
import { compileCustomSimulationPackage } from './customSimulationCompiler';
import { applyGraphLayout, createGraphLayoutSpec, inspectGraphLayout } from './graphLayout';
import { createStructuralGraphPatches, spreadGraphLayout } from './graphRequestEdits';
import { applyInputPatches } from './input/inputPatch';
import { classifyGraphChange, patchPackageGraphLayout } from './graphTransactions';
import { createInputPreset, getInputKindForAlgorithm } from './inputPresets';
import { createBidirectionalBfsProgram } from './simLangBuiltins';
import { createVisualizationContractV2 } from './visualizationDesigner';
import type { AlgorithmDesignV1, WorkspaceSnapshotV1 } from '../types/titan';

const workspace: WorkspaceSnapshotV1 = {
  version: 1,
  algorithmName: 'Custom Code',
  code: '',
  simulationInput: { kind: 'array', text: '[3,1,2]' },
  steps: [],
  currentIndex: 0,
  analysis: null,
  inputError: null,
  activePackageId: null,
  packageOutOfSync: false,
};

const design: AlgorithmDesignV1 = {
  version: 1,
  title: 'İki Yönlü BFS — Özel',
  purpose: 'Find a shortest path from both ends.',
  inputKind: 'graph',
  dataStructures: ['two queues', 'two visited sets'],
  invariants: ['Each side visits a node at most once.'],
  termination: 'The frontiers meet or become empty.',
  complexity: { time: 'O(V + E)', space: 'O(V)' },
};

const buildPackage = () => {
  const input = createAgentInputContract(
    design,
    'Kendi graphını oluştur ve iki yönlü BFS yaz',
    workspace,
  );
  const layout = createGraphLayoutSpec(input.value.graph!, design.title);
  input.value = { ...input.value, graph: applyGraphLayout(input.value.graph!, layout) };
  const visualization = createVisualizationContractV2(design, input.value, layout);
  return compileCustomSimulationPackage({
    id: 'gm2-package',
    title: design.title,
    locale: 'tr',
    program: createBidirectionalBfsProgram('tr'),
    input,
    visualization,
    analysis: 'O(V + E)',
    invariants: design.invariants,
  });
};

describe('GM-2 visual and teaching contracts', () => {
  it('generates richer teaching inputs while respecting exponential trace budgets', () => {
    const arrayDesign: AlgorithmDesignV1 = {
      ...design,
      title: 'Dynamic Programming Teaching Case',
      inputKind: 'array',
    };
    const arrayInput = createAgentInputContract(arrayDesign, 'create a new input', workspace);
    expect(JSON.parse(arrayInput.value.text)).toHaveLength(14);

    const backtrackingInput = createAgentInputContract(
      { ...arrayDesign, title: 'Permutations Backtracking' },
      'create a new input',
      workspace,
    );
    expect(JSON.parse(backtrackingInput.value.text)).toHaveLength(5);

    const stringInput = createAgentInputContract(
      { ...arrayDesign, title: 'String Window', inputKind: 'string' },
      'create a new input',
      workspace,
    );
    expect(stringInput.value.text.length).toBeGreaterThanOrEqual(19);
  });

  it('generates an original collision-free graph with semantic frontier roles', () => {
    const packageValue = buildPackage();
    expect(packageValue.input.origin).toBe('agent');
    expect(packageValue.input.value.graph?.nodes.map((node) => node.id)).toContain('S');
    expect(inspectGraphLayout(packageValue.input.value.graph!, 5).valid).toBe(true);
    expect(packageValue.visualization.version).toBe(2);
    if (packageValue.visualization.version === 2) {
      expect(packageValue.visualization.nodeRoles.map((role) => role.id)).toEqual(expect.arrayContaining([
        'frontier-start', 'frontier-target', 'visited-both', 'meeting', 'path',
      ]));
      expect(packageValue.visualization.edgeRoles.map((role) => role.id)).toEqual(expect.arrayContaining([
        'inspect-start', 'inspect-target', 'tree-start', 'tree-target', 'path',
      ]));
    }
    const meetingStep = packageValue.steps.find((step) =>
      step.visualData.type === 'graph'
      && step.visualData.nodes.some((node) => node.semanticRoles?.includes('meeting')),
    );
    expect(meetingStep).toBeDefined();
    expect(packageValue.steps.some((step) => step.visualData.type === 'graph'
      && step.visualData.edges.some((edge) => edge.semanticRoles?.some((role) => role.startsWith('inspect-')))))
      .toBe(true);
  });

  it('grounds every narration in a real trace step and produces final metrics', () => {
    const packageValue = buildPackage();
    for (const { checkpoint, narration } of packageValue.teachingPlan.checkpoints) {
      const step = packageValue.steps[checkpoint.stepIndex];
      expect(step).toBeDefined();
      expect(narration.stepIndex).toBe(checkpoint.stepIndex);
      expect(narration.activeLine).toBe(step.lineNumber);
      expect(narration.lenses.reasoning).toBe(step.explanation);
      for (const variable of Object.keys(narration.changedVariables)) {
        expect(
          Object.prototype.hasOwnProperty.call(step.visualData.vars, variable)
          || Object.prototype.hasOwnProperty.call(packageValue.steps[checkpoint.stepIndex - 1]?.visualData.vars ?? {}, variable),
        ).toBe(true);
      }
    }
    expect(packageValue.teachingPlan.finalResult.metrics).toMatchObject({
      traceSteps: packageValue.steps.length,
    });
    expect(packageValue.teachingPlan.finalResult.metrics.path).toBeInstanceOf(Array);
  });

  it('keeps layout edits trace-stable and classifies topology edits as structural', () => {
    const packageValue = buildPackage();
    const graph = packageValue.input.value.graph!;
    const spread = spreadGraphLayout(graph);
    expect(classifyGraphChange(graph, spread)).toBe('layout');
    const patched = patchPackageGraphLayout(packageValue, spread);
    expect(patched.steps.map((step) => [step.lineNumber, step.explanation]))
      .toEqual(packageValue.steps.map((step) => [step.lineNumber, step.explanation]));
    expect(patched.steps[0].visualData).not.toEqual(packageValue.steps[0].visualData);

    const plan = createStructuralGraphPatches(graph, 'Bu grapha iki node ekle, hedefi değiştir');
    expect(plan.ok).toBe(true);
    if (plan.ok === false) throw new Error(plan.reason);
    const input = packageValue.input.value;
    const applied = applyInputPatches(input, plan.patches, packageValue.input);
    expect(applied.ok).toBe(true);
    if (applied.ok === false) throw new Error(applied.reason);
    if (!applied.input.graph) throw new Error('Missing graph');
    const structural = applied.input.graph;
    expect(classifyGraphChange(graph, structural)).toBe('structural');
    expect(structural.nodes).toHaveLength(graph.nodes.length + 2);
    expect(structural.edges).toHaveLength(graph.edges.length + 2);
    expect(structural.targetId).not.toBe(graph.targetId);
  });
});

describe('teaching-quality input presets', () => {
  it('provides three distinct valid scenarios for every supported algorithm', () => {
    for (const algorithm of algorithmRegistry) {
      const kind = getInputKindForAlgorithm(algorithm.name);
      const presets = [0, 1, 2].map((index) => createInputPreset(kind, index, algorithm.name));
      const signatures = presets.map((input) => JSON.stringify(input));
      expect(new Set(signatures).size, algorithm.name).toBe(3);
      if (kind === 'graph') {
        for (const input of presets) {
          expect(input.graph?.nodes.length, algorithm.name).toBeGreaterThanOrEqual(5);
          expect(inspectGraphLayout(input.graph!, 5).valid, algorithm.name).toBe(true);
        }
      }
    }
  });

  it('uses algorithm-specific edge cases instead of one shared array', () => {
    expect(createInputPreset('array', 1, "Kadane's Algorithm").text).toBe('[-8,-3,-6,-2,-5,-4]');
    expect(createInputPreset('array', 1, 'Bubble Sort').text).toBe('[1,2,3,5,4,6]');
    expect(createInputPreset('array', 2, 'Binary Search').parameters?.target).toBe('26');
    expect(createInputPreset('string', 2, 'Trie Insert & Search').parameters?.query).toBe('grow');
  });
});
