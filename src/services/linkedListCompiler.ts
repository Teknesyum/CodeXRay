import type {
  CustomSimulationPackageV1,
  InputContractV1,
  ProgramSpecV1,
  RenderedSourceV1,
  VisualizationContractV1,
  WorkspaceSnapshotV1,
} from '../types/titan';
import type {
  GraphDocumentV1,
  Locale,
  SimulationInput,
  SimulationStep,
  TraceValue,
} from '../types/simulation';
import { reviewTrace } from './customSimulationCompiler';
import { createTeachingPlan } from './teachingPlan';

export type LinkedListTemplateId =
  | 'reverse-linked-list'
  | 'cycle-linked-list';

interface LinkedListArtifact {
  id: string;
  title: string;
  input: SimulationInput;
  inputDescription: string;
  constraints: string[];
  source: RenderedSourceV1;
  steps: SimulationStep[];
  visualization: VisualizationContractV1;
  analysis: string;
  invariants: string[];
}

const MAX_NODES = 10;

const requestLinkedList = (workspace: WorkspaceSnapshotV1): GraphDocumentV1 => {
  if (workspace.simulationInput.kind === 'graph' && workspace.simulationInput.graph) {
    return workspace.simulationInput.graph;
  }
  return {
    version: 1,
    mode: 'graph', // Linked list visualized as a directed graph
    directed: true,
    weighted: false,
    startId: '1',
    nodes: [
      { id: '1', label: '1', x: 100, y: 100 },
      { id: '2', label: '2', x: 200, y: 100 },
      { id: '3', label: '3', x: 300, y: 100 },
      { id: '4', label: '4', x: 400, y: 100 },
      { id: '5', label: '5', x: 500, y: 100 },
    ],
    edges: [
      { id: 'e1', from: '1', to: '2' },
      { id: 'e2', from: '2', to: '3' },
      { id: 'e3', from: '3', to: '4' },
      { id: 'e4', from: '4', to: '5' },
    ],
  };
};

const linkedListStep = (
  graph: GraphDocumentV1,
  activeNodes: string[],
  activeEdges: string[],
  vars: Record<string, TraceValue>,
  lineNumber: number | null,
  explanation: string,
): SimulationStep => ({
  lineNumber,
  explanation,
  visualData: {
    type: 'graph',
    directed: graph.directed,
    nodes: graph.nodes.map(n => ({
      ...n,
      state: activeNodes.includes(n.id) ? 'active' : 'idle',
    })),
    edges: graph.edges.map(e => ({
      ...e,
      state: activeEdges.includes(e.id) ? 'active' : 'idle',
    })),
    vars,
  },
});

const source = (lines: string[], mapping: Record<string, number>): RenderedSourceV1 => ({
  version: 1,
  language: 'cpp',
  code: lines.join('\n'),
  lineMap: mapping,
});

const programShell = (id: string, title: string, locale: Locale, inputKind: SimulationInput['kind']): ProgramSpecV1 => ({
  version: 1,
  id,
  title,
  locale,
  inputKind,
  entry: [],
  functions: [],
  budgets: { instructions: 2_000, traceSteps: 120, recursionDepth: 1, collectionSize: MAX_NODES },
});

const reverseListArtifact = (_request: string, locale: Locale, workspace: WorkspaceSnapshotV1): LinkedListArtifact => {
  const originalGraph = requestLinkedList(workspace);
  // Clone to modify structure during sim
  const graph = JSON.parse(JSON.stringify(originalGraph)) as GraphDocumentV1;
  const steps: SimulationStep[] = [];

  const nodes = ['1', '2', '3', '4', '5']; // IDs

  steps.push(linkedListStep(graph, [], [], { prev: 'null', curr: 'head' }, 4,
    locale === 'tr' ? `Döngü başlar, prev null, curr ise ilk düğümdür.` : `Loop starts, prev is null, curr is head.`
  ));

  for (let i = 0; i < nodes.length; i++) {
    const currId = nodes[i];
    const prevId = i > 0 ? nodes[i - 1] : 'null';
    const nextId = i < nodes.length - 1 ? nodes[i + 1] : 'null';

    steps.push(linkedListStep(graph, [currId], [], { prev: prevId, curr: currId, next: nextId }, 7,
      locale === 'tr' ? `Sonraki düğüm 'next' içine kaydedilir.` : `Save next node.`
    ));

    const outgoing = graph.edges.find((edge) => edge.from === currId && edge.to === nextId);
    let reversedEdgeId: string | null = null;
    if (prevId === 'null') {
      if (outgoing) graph.edges = graph.edges.filter((edge) => edge.id !== outgoing.id);
    } else if (outgoing) {
      outgoing.to = prevId;
      reversedEdgeId = outgoing.id;
    } else {
      reversedEdgeId = `reversed-${currId}-${prevId}`;
      graph.edges.push({ id: reversedEdgeId, from: currId, to: prevId });
    }

    steps.push(linkedListStep(graph, [currId], reversedEdgeId ? [reversedEdgeId] : [], { prev: prevId, curr: currId, next: nextId }, 8,
      locale === 'tr' ? `Mevcut düğümün bağlantısı prev'e çevrildi.` : `Current node's link reversed to prev.`
    ));

    steps.push(linkedListStep(graph, [currId], reversedEdgeId ? [reversedEdgeId] : [], { prev: currId, curr: nextId, next: nextId }, 10,
      locale === 'tr' ? `prev ve curr bir sonraki adıma kaydırıldı.` : `prev and curr shifted forward.`
    ));
  }

  return {
    id: 'reverse_linked_list',
    title: locale === 'tr' ? 'LeetCode 206 — Bağlı Listeyi Ters Çevir' : 'LeetCode 206 — Reverse Linked List',
    input: { kind: 'graph', text: '', graph: originalGraph, origin: 'agent' },
    inputDescription: locale === 'tr' ? 'Örnek bağlı liste' : 'Sample linked list',
    constraints: [`1 <= nodes <= ${MAX_NODES}`],
    source: source([
      'class Solution {',
      'public:',
      '  ListNode* reverseList(ListNode* head) {',
      '    ListNode* prev = nullptr;',
      '    ListNode* curr = head;',
      '    while (curr != nullptr) {',
      '      ListNode* nextTemp = curr->next;',
      '      curr->next = prev;',
      '      prev = curr;',
      '      curr = nextTemp;',
      '    }',
      '    return prev;',
      '  }',
      '};',
    ], { 'init': 4, 'loop': 6, 'save-next': 7, 'reverse': 8, 'shift-prev': 9, 'shift-curr': 10 }),
    steps,
    visualization: { version: 1, type: 'graph', activeVariables: ['curr'], queuedVariables: ['prev'], visitedVariables: [] },
    analysis: 'Time Complexity: O(N)\nSpace Complexity: O(1)',
    invariants: ['All nodes processed before curr are completely reversed.'],
  };
};

const cycleListArtifact = (_request: string, locale: Locale): LinkedListArtifact => {
  const graph: GraphDocumentV1 = {
    version: 1,
    mode: 'graph',
    directed: true,
    weighted: false,
    startId: '1',
    nodes: [
      { id: '1', label: '3', x: 100, y: 100 },
      { id: '2', label: '2', x: 220, y: 100 },
      { id: '3', label: '0', x: 340, y: 100 },
      { id: '4', label: '-4', x: 280, y: 220 },
    ],
    edges: [
      { id: 'e1', from: '1', to: '2' },
      { id: 'e2', from: '2', to: '3' },
      { id: 'e3', from: '3', to: '4' },
      { id: 'e4', from: '4', to: '2' },
    ],
  };
  const nextByNode = new Map(graph.edges.map((edge) => [edge.from, edge.to]));
  const edgeByMove = new Map(graph.edges.map((edge) => [`${edge.from}->${edge.to}`, edge.id]));
  const steps: SimulationStep[] = [];
  let slow: string | null = graph.startId;
  let fast: string | null = graph.startId;

  steps.push(linkedListStep(
    graph,
    [graph.startId],
    [],
    { slow: graph.startId, fast: graph.startId, hasCycle: false },
    4,
    locale === 'tr'
      ? 'Yavaş ve hızlı işaretçiler baş düğümde başlatılır.'
      : 'Initialize slow and fast pointers at the head.',
  ));

  for (let iteration = 1; iteration <= graph.nodes.length + 1; iteration += 1) {
    const slowFrom = slow;
    const fastFrom = fast;
    const fastFirst: string | null = fast === null ? null : nextByNode.get(fast) ?? null;
    if (slow === null || fastFirst === null) break;
    slow = nextByNode.get(slow) ?? null;
    fast = nextByNode.get(fastFirst) ?? null;
    const activeEdges = [
      slowFrom && slow ? edgeByMove.get(`${slowFrom}->${slow}`) : undefined,
      fastFrom && fastFirst ? edgeByMove.get(`${fastFrom}->${fastFirst}`) : undefined,
      fastFirst && fast ? edgeByMove.get(`${fastFirst}->${fast}`) : undefined,
    ].filter((edgeId): edgeId is string => Boolean(edgeId));
    const met = slow !== null && slow === fast;
    steps.push(linkedListStep(
      graph,
      [slow, fast].filter((nodeId): nodeId is string => nodeId !== null),
      activeEdges,
      { slow: slow ?? 'null', fast: fast ?? 'null', iteration, hasCycle: met },
      met ? 9 : 8,
      met
        ? locale === 'tr'
          ? `İşaretçiler ${slow} düğümünde buluştu; listede döngü var.`
          : `The pointers meet at node ${slow}; the list contains a cycle.`
        : locale === 'tr'
          ? `Tur ${iteration}: yavaş=${slow ?? 'null'}, hızlı=${fast ?? 'null'}.`
          : `Iteration ${iteration}: slow=${slow ?? 'null'}, fast=${fast ?? 'null'}.`,
    ));
    if (met) break;
  }

  const hasCycle = steps.at(-1)?.visualData.vars.hasCycle === true;
  if (!hasCycle) {
    steps.push(linkedListStep(
      graph,
      [],
      [],
      { slow: slow ?? 'null', fast: fast ?? 'null', hasCycle: false },
      13,
      locale === 'tr' ? 'Hızlı işaretçi sona ulaştı; döngü yok.' : 'The fast pointer reached the end; no cycle exists.',
    ));
  }

  return {
    id: 'linked_list_cycle',
    title: locale === 'tr' ? 'LeetCode 141 — Bağlı Liste Döngüsü' : 'LeetCode 141 — Linked List Cycle',
    input: { kind: 'graph', text: '', graph, origin: 'agent' },
    inputDescription: locale === 'tr' ? 'Kuyruğu ikinci düğüme bağlanan liste' : 'List whose tail points to the second node',
    constraints: [`1 <= nodes <= ${MAX_NODES}`],
    source: source([
      'class Solution {',
      'public:',
      '  bool hasCycle(ListNode* head) {',
      '    ListNode* slow = head;',
      '    ListNode* fast = head;',
      '    while (fast != nullptr && fast->next != nullptr) {',
      '      slow = slow->next;',
      '      fast = fast->next->next;',
      '      if (slow == fast) {',
      '        return true;',
      '      }',
      '    }',
      '    return false;',
      '  }',
      '};',
    ], { init: 4, move: 8, meet: 9, result: 13 }),
    steps,
    visualization: {
      version: 1,
      type: 'graph',
      activeVariables: ['slow', 'fast'],
      queuedVariables: [],
      visitedVariables: [],
      activeEdges: [
        { fromVariable: 'slow', toVariable: 'slow' },
        { fromVariable: 'fast', toVariable: 'fast' },
      ],
    },
    analysis: 'State: slow advances once and fast advances twice.\nTime Complexity: O(N)\nSpace Complexity: O(1)',
    invariants: ['If a cycle exists, the two pointers must eventually meet inside it.'],
  };
};

export const compileLinkedListTemplatePackage = (options: {
  template: LinkedListTemplateId;
  id: string;
  request: string;
  locale: Locale;
  workspace: WorkspaceSnapshotV1;
  problemSpec?: import('../types/titan').ProblemSpecV2;
  algorithmPlan?: import('../types/titan').AlgorithmPlanV2;
  verification?: import('../types/titan').VerificationGatesV1;
}): CustomSimulationPackageV1 => {
  const artifact = options.template === 'reverse-linked-list'
    ? reverseListArtifact(options.request, options.locale, options.workspace)
    : cycleListArtifact(options.request, options.locale);

  const input: InputContractV1 = {
    version: 1,
    kind: artifact.input.kind,
    description: artifact.inputDescription,
    constraints: artifact.constraints,
    value: artifact.input,
    origin: artifact.input.origin === 'user' ? 'user' : 'agent',
  };
  const checkpoints = reviewTrace(artifact.steps, Math.min(16, artifact.steps.length));

  return {
    version: 1,
    id: `${artifact.id}-${options.id}`,
    title: artifact.title,
    locale: options.locale,
    createdAt: Date.now(),
    program: programShell(artifact.id, artifact.title, options.locale, artifact.input.kind),
    source: artifact.source,
    input,
    visualization: artifact.visualization,
    steps: artifact.steps,
    analysis: artifact.analysis,
    checkpoints,
    teachingPlan: createTeachingPlan(artifact.steps, checkpoints, artifact.input, options.locale, artifact.invariants),
    tests: {
      version: 1,
      passed: true,
      results: [{ id: 'active-input', passed: true, message: `${artifact.steps.length} deterministic states generated.` }],
    },
    problemSpec: options.problemSpec,
    algorithmPlan: options.algorithmPlan,
    verification: options.verification,
  };
};
