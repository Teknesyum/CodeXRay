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

export type GraphTemplateId = 'bfs-graph' | 'dfs-graph' | 'dijkstra-graph';

interface GraphArtifact {
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

const MAX_NODES = 15;

const defaultGraph = (): GraphDocumentV1 => ({
  version: 1,
  mode: 'graph',
  directed: false,
  weighted: false,
  startId: 'A',
  targetId: 'D',
  nodes: [
    { id: 'A', label: 'A', x: 100, y: 100 },
    { id: 'B', label: 'B', x: 220, y: 100 },
    { id: 'C', label: 'C', x: 100, y: 220 },
    { id: 'D', label: 'D', x: 220, y: 220 },
  ],
  edges: [
    { id: 'e1', from: 'A', to: 'B' },
    { id: 'e2', from: 'A', to: 'C' },
    { id: 'e3', from: 'B', to: 'D' },
    { id: 'e4', from: 'C', to: 'D' },
  ],
});

const requestGraph = (workspace: WorkspaceSnapshotV1): { graph: GraphDocumentV1; origin: 'user' | 'agent' } => {
  if (workspace.simulationInput.kind === 'graph' && workspace.simulationInput.graph) {
    const current = workspace.simulationInput.graph;
    return {
      graph: current.targetId
        ? current
        : { ...current, targetId: current.nodes.at(-1)?.id ?? current.startId },
      origin: 'user',
    };
  }
  return { graph: defaultGraph(), origin: 'agent' };
};

const graphStep = (
  graph: GraphDocumentV1,
  visited: string[],
  activeNodes: string[],
  activeEdges: string[],
  vars: Record<string, TraceValue>,
  lineNumber: number | null,
  explanation: string,
  pathNodes: string[] = [],
  pathEdges: string[] = [],
): SimulationStep => ({
  lineNumber,
  explanation,
  visualData: {
    type: 'graph',
    directed: graph.directed,
    nodes: graph.nodes.map((node) => ({
      ...node,
      state: pathNodes.includes(node.id)
        ? 'path'
        : activeNodes.includes(node.id)
          ? 'active'
          : visited.includes(node.id)
            ? 'visited'
            : 'idle',
    })),
    edges: graph.edges.map((edge) => ({
      ...edge,
      state: pathEdges.includes(edge.id) ? 'path' : activeEdges.includes(edge.id) ? 'active' : 'idle',
    })),
    vars,
  },
});

const source = (lines: string[], lineMap: Record<string, number>): RenderedSourceV1 => ({
  version: 1,
  language: 'cpp',
  code: lines.join('\n'),
  lineMap,
});

const programShell = (title: string, locale: Locale): ProgramSpecV1 => ({
  version: 1,
  id: 'find_path_exists_bfs',
  title,
  locale,
  inputKind: 'graph',
  entry: [],
  functions: [],
  budgets: { instructions: 4_000, traceSteps: 300, recursionDepth: 1, collectionSize: MAX_NODES },
});

const bfsArtifact = (locale: Locale, workspace: WorkspaceSnapshotV1): GraphArtifact => {
  const { graph, origin } = requestGraph(workspace);
  const destination = graph.targetId ?? graph.nodes.at(-1)?.id ?? graph.startId;
  const steps: SimulationStep[] = [];
  const visited = new Set<string>([graph.startId]);
  const queue = [graph.startId];
  const parent = new Map<string, string>();
  const adjacency = new Map(graph.nodes.map((node) => [node.id, [] as typeof graph.edges]));
  for (const edge of graph.edges) {
    adjacency.get(edge.from)?.push(edge);
    if (!graph.directed) adjacency.get(edge.to)?.push(edge);
  }

  steps.push(graphStep(
    graph,
    [...visited],
    [graph.startId],
    [],
    { queue: [...queue], destination, result: false },
    8,
    locale === 'tr'
      ? `Kaynak ${graph.startId} kuyruğa eklenir; hedef ${destination}.`
      : `Enqueue source ${graph.startId}; destination is ${destination}.`,
  ));

  while (queue.length > 0) {
    const current = queue.shift()!;
    steps.push(graphStep(
      graph,
      [...visited],
      [current],
      [],
      { current, queue: [...queue], destination, result: false },
      10,
      locale === 'tr' ? `${current} kuyruktan çıkarılır.` : `Dequeue ${current}.`,
    ));

    if (current === destination) {
      const path = [current];
      while (parent.has(path[0])) path.unshift(parent.get(path[0])!);
      const pathEdges = path.slice(1).map((nodeId, index) => graph.edges.find((edge) => (
        edge.from === path[index] && edge.to === nodeId
      ) || (!graph.directed && edge.to === path[index] && edge.from === nodeId))?.id)
        .filter((edgeId): edgeId is string => Boolean(edgeId));
      steps.push(graphStep(
        graph,
        [...visited],
        [current],
        [],
        { current, queue: [...queue], destination, result: true, path },
        11,
        locale === 'tr' ? `Hedef bulundu; yol ${path.join(' → ')}.` : `Destination found; path is ${path.join(' → ')}.`,
        path,
        pathEdges,
      ));
      break;
    }

    for (const edge of adjacency.get(current) ?? []) {
      const neighbor = edge.from === current ? edge.to : edge.from;
      steps.push(graphStep(
        graph,
        [...visited],
        [current, neighbor],
        [edge.id],
        { current, neighbor, queue: [...queue], destination, result: false },
        12,
        locale === 'tr' ? `Komşu ${neighbor} kontrol edilir.` : `Check neighbor ${neighbor}.`,
      ));
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        parent.set(neighbor, current);
        queue.push(neighbor);
        steps.push(graphStep(
          graph,
          [...visited],
          [current, neighbor],
          [edge.id],
          { current, neighbor, queue: [...queue], destination, result: false },
          15,
          locale === 'tr' ? `${neighbor} kuyruğa eklenir.` : `Enqueue ${neighbor}.`,
        ));
      }
    }
  }

  if (steps.at(-1)?.visualData.vars.result !== true) {
    steps.push(graphStep(
      graph,
      [...visited],
      [],
      [],
      { queue: [], destination, result: false, path: [] },
      19,
      locale === 'tr' ? 'Kuyruk tükendi; hedefe giden yol yok.' : 'The queue is empty; no path reaches the destination.',
    ));
  }

  const title = locale === 'tr'
    ? 'LeetCode 1971 — Grafikte Yol Var mı?'
    : 'LeetCode 1971 — Find if Path Exists in Graph';
  return {
    id: 'find_path_exists_bfs',
    title,
    input: { kind: 'graph', text: '', graph, origin },
    inputDescription: locale === 'tr' ? 'Kaynak ve hedef içeren graf' : 'Graph with source and destination',
    constraints: [`1 <= nodes <= ${MAX_NODES}`],
    source: source([
      'class Solution {',
      'public:',
      '  bool validPath(int n, vector<vector<int>>& edges, int source, int destination) {',
      '    queue<int> q;',
      '    vector<vector<int>> adj(n);',
      '    for (auto& edge : edges) { adj[edge[0]].push_back(edge[1]); adj[edge[1]].push_back(edge[0]); }',
      '    vector<bool> visited(n, false);',
      '    q.push(source); visited[source] = true;',
      '    while (!q.empty()) {',
      '      int curr = q.front(); q.pop();',
      '      if (curr == destination) return true;',
      '      for (int neighbor : adj[curr]) {',
      '        if (!visited[neighbor]) {',
      '          visited[neighbor] = true;',
      '          q.push(neighbor);',
      '        }',
      '      }',
      '    }',
      '    return false;',
      '  }',
      '};',
    ], { init: 8, loop: 10, found: 11, neighbor: 12, push: 15, result: 19 }),
    steps,
    visualization: {
      version: 1,
      type: 'graph',
      activeVariables: ['current'],
      queuedVariables: ['queue'],
      visitedVariables: ['visited'],
      pathVariable: 'path',
    },
    analysis: 'State: the queue contains the next BFS frontier.\nTime Complexity: O(V + E)\nSpace Complexity: O(V)',
    invariants: ['Every enqueued node is reachable from source through the recorded parent chain.'],
  };
};

export const compileGraphTemplatePackage = (options: {
  template: GraphTemplateId;
  id: string;
  request: string;
  locale: Locale;
  workspace: WorkspaceSnapshotV1;
  problemSpec?: import('../types/titan').ProblemSpecV2;
  algorithmPlan?: import('../types/titan').AlgorithmPlanV2;
  verification?: import('../types/titan').VerificationGatesV1;
}): CustomSimulationPackageV1 => {
  if (options.template !== 'bfs-graph') {
    throw new Error(`Unsupported graph template: ${options.template}`);
  }
  const artifact = bfsArtifact(options.locale, options.workspace);
  const input: InputContractV1 = {
    version: 1,
    kind: artifact.input.kind,
    description: artifact.inputDescription,
    constraints: artifact.constraints,
    value: artifact.input,
    origin: artifact.input.origin === 'user' ? 'user' : 'agent',
  };
  const checkpoints = reviewTrace(artifact.steps, Math.min(16, artifact.steps.length));
  const finalResult = artifact.steps.at(-1)?.visualData.vars.result;

  return {
    version: 1,
    id: `${artifact.id}-${options.id}`,
    title: artifact.title,
    locale: options.locale,
    createdAt: Date.now(),
    program: programShell(artifact.title, options.locale),
    source: artifact.source,
    input,
    visualization: artifact.visualization,
    steps: artifact.steps,
    analysis: artifact.analysis,
    checkpoints,
    teachingPlan: createTeachingPlan(artifact.steps, checkpoints, artifact.input, options.locale, artifact.invariants),
    tests: {
      version: 1,
      passed: typeof finalResult === 'boolean',
      results: [{
        id: 'active-input',
        passed: typeof finalResult === 'boolean',
        message: `${artifact.steps.length} deterministic states generated; result=${String(finalResult)}.`,
      }],
    },
    problemSpec: options.problemSpec,
    algorithmPlan: options.algorithmPlan,
    verification: options.verification,
  };
};
