import type {
  GraphDocumentV1,
  GraphVisualData,
  MatrixVisualData,
  SimulationStep,
  TraceValue,
} from '../types/simulation';

interface Adjacent {
  edgeId: string;
  from: string;
  to: string;
  weight: number;
}

const adjacency = (graph: GraphDocumentV1): Map<string, Adjacent[]> => {
  const result = new Map(graph.nodes.map((node) => [node.id, [] as Adjacent[]]));
  for (const edge of graph.edges) {
    result.get(edge.from)?.push({
      edgeId: edge.id,
      from: edge.from,
      to: edge.to,
      weight: edge.weight ?? 1,
    });
    if (!graph.directed) {
      result.get(edge.to)?.push({
        edgeId: edge.id,
        from: edge.to,
        to: edge.from,
        weight: edge.weight ?? 1,
      });
    }
  }
  return result;
};

const directedEdges = (graph: GraphDocumentV1): Adjacent[] =>
  [...adjacency(graph).values()].flat();

const teachingLineNumber = (phase: TraceValue | undefined): number | null => {
  if (typeof phase !== 'string') return null;
  const mappings: Array<[string, number]> = [
    ['Kruskal · sort', 3], ['Kruskal · accept', 11], ['Kruskal · reject', 9], ['Kruskal · complete', 15],
    ['Prim · initialize', 4], ['Prim · inspect', 8], ['Prim · grow', 14], ['Prim · complete', 19], ['Prim · disconnected', 19],
    ['Bellman-Ford · initialize', 2], ['Bellman-Ford · begin', 4], ['Bellman-Ford · relax', 7], ['Bellman-Ford · reject', 7],
    ['Bellman-Ford · early', 12], ['Bellman-Ford · negative', 15], ['Bellman-Ford · complete', 18],
    ['Topological Sort · find', 5], ['Topological Sort · peel', 9], ['Topological Sort · release', 11],
    ['Topological Sort · cycle', 16], ['Topological Sort · complete', 17],
    ['Kosaraju · first', 2], ['Kosaraju · push', 5], ['Kosaraju · transpose', 12],
    ['Kosaraju · pop', 16], ['Kosaraju · second', 18], ['Kosaraju · seal', 19], ['Kosaraju · complete', 21],
    ['Tarjan · discover', 3], ['Tarjan · descend', 7], ['Tarjan · propagate', 10], ['Tarjan · process', 11], ['Tarjan · pop', 15], ['Tarjan · complete', 24],
    ['Edmonds-Karp · initialize', 2], ['Edmonds-Karp · BFS', 6], ['Edmonds-Karp · augment', 15], ['Edmonds-Karp · min-cut', 18], ['Edmonds-Karp · complete', 19],
    ['Dinic · initialize', 2], ['Dinic · build', 5], ['Dinic · send', 12], ['Dinic · complete', 18],
    ['Hopcroft-Karp · validate', 2], ['Hopcroft-Karp · alternating', 5], ['Hopcroft-Karp · augment', 8], ['Hopcroft-Karp · complete phase', 10], ['Hopcroft-Karp · maximum', 12],
    ['Graph Coloring · initialize', 2], ['Graph Coloring · prepare', 3], ['Graph Coloring · reject', 5], ['Graph Coloring · assign', 6], ['Graph Coloring · backtrack', 8], ['Graph Coloring · complete', 10],
    ['Euler · initialize', 2], ['Euler · consume', 6], ['Euler · splice', 9], ['Euler · complete', 12], ['Euler · invalid', 12],
    ['Hamilton · initialize', 2], ['Hamilton · close', 7], ['Hamilton · reject', 7], ['Hamilton · extend', 9], ['Hamilton · backtrack', 12], ['Hamilton · complete', 15], ['Hamilton · no', 15],
    ['articulation · discover', 2], ['articulation · descend', 4], ['articulation · separation', 6], ['articulation · process', 7], ['articulation · root', 8], ['articulation · finish', 9], ['articulation · complete', 10],
    ['bridges · discover', 2], ['bridges · descend', 4], ['bridges · bridge', 6], ['bridges · process', 7], ['bridges · finish', 9], ['bridges · complete', 10],
    ['Johnson · Bellman', 2], ['Johnson · reweight', 3], ['Johnson · per-source', 5], ['Johnson · restore', 6],
  ];
  return mappings.find(([prefix]) => phase.startsWith(prefix))?.[1] ?? null;
};

const addStep = (
  graph: GraphDocumentV1,
  steps: SimulationStep[],
  explanation: string,
  vars: Record<string, TraceValue>,
  visited = new Set<string>(),
  activeNode?: string,
  activeEdge?: string,
  pathNodes = new Set<string>(),
  pathEdges = new Set<string>(),
) => {
  const rejectedEdges = new Set(
    Array.isArray(vars.rejectedEdges)
      ? vars.rejectedEdges.filter((value): value is string => typeof value === 'string')
      : [],
  );
  const visitedEdges = new Set(
    Array.isArray(vars.visitedEdges)
      ? vars.visitedEdges.filter((value): value is string => typeof value === 'string')
      : [],
  );
  const queuedNodes = new Set(
    Array.isArray(vars.queue)
      ? vars.queue.filter((value): value is string => typeof value === 'string')
      : [],
  );
  const removedNodes = new Set(
    Array.isArray(vars.removedNodes)
      ? vars.removedNodes.filter((value): value is string => typeof value === 'string')
      : [],
  );
  const removedEdges = new Set(
    Array.isArray(vars.removedEdges)
      ? vars.removedEdges.filter((value): value is string => typeof value === 'string')
      : [],
  );
  const componentOf = vars.componentOf && typeof vars.componentOf === 'object' && !Array.isArray(vars.componentOf)
    ? vars.componentOf as Record<string, TraceValue>
    : null;
  const componentColors = ['#00f3ff', '#ff4fd8', '#8dff5a', '#ffb000', '#8f7dff', '#ff6b6b'];
  const edgeLabels = vars.edgeLabels && typeof vars.edgeLabels === 'object' && !Array.isArray(vars.edgeLabels)
    ? vars.edgeLabels as Record<string, TraceValue>
    : null;
  const residualValues = vars.residual && typeof vars.residual === 'object' && !Array.isArray(vars.residual)
    ? vars.residual as Record<string, TraceValue> : null;
  const residualEntries = residualValues ? Object.entries(residualValues).flatMap(([key, value]) => {
    const [from, to] = key.split('→');
    return from && to && typeof value === 'number' && value > 0 ? [{ from, to, value }] : [];
  }) : [];
  const pathOrder = Array.isArray(vars.path) ? vars.path.filter((value): value is string => typeof value === 'string') : [];
  const residualPathKeys = new Set(pathOrder.slice(0, -1).map((from, index) => `${from}→${pathOrder[index + 1]}`));
  const nodeColors = vars.colors && typeof vars.colors === 'object' && !Array.isArray(vars.colors)
    ? vars.colors as Record<string, TraceValue>
    : null;
  const visualData: GraphVisualData = {
    type: 'graph',
    directed: graph.directed,
    nodes: graph.nodes.map((node) => ({
      ...node,
      state: node.id === activeNode
        ? 'active'
        : removedNodes.has(node.id)
          ? 'removed'
        : pathNodes.has(node.id)
          ? 'path'
          : visited.has(node.id)
            ? 'visited'
            : queuedNodes.has(node.id)
              ? 'queued'
              : 'idle',
      ...(componentOf?.[node.id] !== undefined ? {
        semanticRoles: [`SCC ${String(componentOf[node.id])}`],
        semanticStyle: {
          shape: 'circle' as const,
          size: 40,
          stroke: componentColors[(Number(componentOf[node.id]) - 1) % componentColors.length],
          fill: `${componentColors[(Number(componentOf[node.id]) - 1) % componentColors.length]}24`,
          glow: 0.7,
          pulse: 'steady' as const,
        },
      } : nodeColors?.[node.id] !== undefined ? {
        semanticRoles: [`color ${String(nodeColors[node.id])}`],
        semanticStyle: {
          shape: 'circle' as const, size: 40,
          stroke: componentColors[(Number(nodeColors[node.id]) - 1) % componentColors.length],
          fill: `${componentColors[(Number(nodeColors[node.id]) - 1) % componentColors.length]}2b`,
          glow: 0.7,
        },
      } : {}),
    })),
    edges: [...graph.edges.map((edge): GraphVisualData['edges'][number] => {
      const residual = residualValues?.[`${edge.from}→${edge.to}`];
      const flowLabel = edgeLabels?.[edge.id] !== undefined ? String(edgeLabels[edge.id]) : undefined;
      return ({
      ...edge,
      ...((flowLabel || typeof residual === 'number') ? { displayLabel: [flowLabel, typeof residual === 'number' ? `r=${residual}` : ''].filter(Boolean).join(' · ') } : {}),
      state: pathEdges.has(edge.id)
        ? 'path'
        : removedEdges.has(edge.id)
          ? 'removed'
        : rejectedEdges.has(edge.id)
            ? 'rejected'
          : edge.id === activeEdge
            ? 'active'
            : visitedEdges.has(edge.id)
              ? 'visited'
              : 'idle',
    });
    }), ...residualEntries.filter(({ from, to }) => !graph.edges.some((edge) => edge.from === from && edge.to === to)).map(({ from, to, value }) => ({
      id: `residual:${from}->${to}`, from, to, displayLabel: `r=${value}`,
      state: residualPathKeys.has(`${from}→${to}`) ? 'active' as const : 'idle' as const,
      semanticRoles: ['residual reverse arc'],
    }))],
    vars,
  };
  steps.push({ lineNumber: teachingLineNumber(vars.phase), visualData, explanation });
};

const requireUndirected = (graph: GraphDocumentV1, name: string) => {
  if (graph.directed) throw new Error(`${name} requires an undirected graph.`);
};

const requireDirected = (graph: GraphDocumentV1, name: string) => {
  if (!graph.directed) throw new Error(`${name} requires a directed graph.`);
};

const disjointSet = (ids: string[]) => {
  const parent = new Map(ids.map((id) => [id, id]));
  const rank = new Map(ids.map((id) => [id, 0]));
  const find = (id: string): string => {
    const current = parent.get(id) as string;
    if (current !== id) parent.set(id, find(current));
    return parent.get(id) as string;
  };
  const union = (left: string, right: string) => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot === rightRoot) return false;
    const leftRank = rank.get(leftRoot) ?? 0;
    const rightRank = rank.get(rightRoot) ?? 0;
    if (leftRank < rightRank) parent.set(leftRoot, rightRoot);
    else if (leftRank > rightRank) parent.set(rightRoot, leftRoot);
    else {
      parent.set(rightRoot, leftRoot);
      rank.set(leftRoot, leftRank + 1);
    }
    return true;
  };
  return { find, union, parent };
};

const kruskal = (graph: GraphDocumentV1): SimulationStep[] => {
  requireUndirected(graph, "Kruskal's MST");
  const steps: SimulationStep[] = [];
  const sorted = [...graph.edges].sort((left, right) =>
    (left.weight ?? 1) - (right.weight ?? 1) || left.id.localeCompare(right.id));
  const sets = disjointSet(graph.nodes.map((node) => node.id));
  const chosen = new Set<string>();
  const rejected = new Set<string>();
  let totalWeight = 0;
  addStep(graph, steps, 'Sort every edge by non-decreasing weight.', {
    phase: 'Kruskal · sort edges',
    decision: 'The lightest remaining edge will be inspected first.',
    sortedEdges: sorted.map((edge) => edge.id),
    sortedWeights: sorted.map((edge) => edge.weight ?? 1),
    totalWeight,
    components: Object.fromEntries(graph.nodes.map((node) => [node.id, sets.find(node.id)])),
  });
  for (const edge of sorted) {
    const accepted = sets.union(edge.from, edge.to);
    if (accepted) {
      chosen.add(edge.id);
      totalWeight += edge.weight ?? 1;
    } else {
      rejected.add(edge.id);
    }
    addStep(
      graph,
      steps,
      accepted ? `Accept edge ${edge.from}–${edge.to}.` : `Reject edge ${edge.from}–${edge.to}; it closes a cycle.`,
      {
        phase: accepted ? 'Kruskal · accept edge' : 'Kruskal · reject cycle',
        decision: accepted
          ? `${edge.from} and ${edge.to} were in different components; merge them.`
          : `${edge.from} and ${edge.to} already share a component; crossing this edge prevents a cycle.`,
        accepted,
        totalWeight,
        mstEdges: [...chosen],
        components: Object.fromEntries(graph.nodes.map((node) => [node.id, sets.find(node.id)])),
        rejectedEdges: [...rejected],
      },
      new Set(),
      edge.to,
      edge.id,
      new Set(),
      chosen,
    );
    if (chosen.size === graph.nodes.length - 1) break;
  }
  const connected = graph.nodes.length <= 1 || chosen.size === graph.nodes.length - 1;
  addStep(graph, steps, connected
    ? `Kruskal's MST has total weight ${totalWeight}.`
    : `The graph is disconnected; Kruskal produced a minimum spanning forest with total weight ${totalWeight}.`, {
    phase: connected ? 'Kruskal · complete MST' : 'Kruskal · complete forest',
    decision: connected
      ? `${chosen.size} accepted edges connect all ${graph.nodes.length} vertices without a cycle.`
      : `${chosen.size} accepted edges are minimal inside each reachable component; no spanning tree can connect all ${graph.nodes.length} vertices.`,
    connected,
    totalWeight,
    mstEdges: [...chosen],
    rejectedEdges: [...rejected],
    components: Object.fromEntries(graph.nodes.map((node) => [node.id, sets.find(node.id)])),
  }, new Set(), undefined, undefined, new Set(), chosen);
  return steps;
};

const prim = (graph: GraphDocumentV1): SimulationStep[] => {
  requireUndirected(graph, "Prim's MST");
  const steps: SimulationStep[] = [];
  const adj = adjacency(graph);
  const visited = new Set<string>();
  const chosen = new Set<string>();
  let totalWeight = 0;
  visited.add(graph.startId);
  const frontierKeys = () => Object.fromEntries(graph.nodes.map((node) => {
    if (visited.has(node.id)) return [node.id, 0];
    const weights = [...visited].flatMap((id) => adj.get(id) ?? [])
      .filter((edge) => edge.to === node.id).map((edge) => edge.weight);
    return [node.id, weights.length > 0 ? Math.min(...weights) : '∞'];
  }));
  addStep(graph, steps, `Start Prim's tree at ${graph.startId}.`, {
    phase: 'Prim · initialize tree',
    totalWeight, mstEdges: [], keys: frontierKeys(),
  }, visited, graph.startId);
  while (visited.size < graph.nodes.length) {
    const candidates = [...visited]
      .flatMap((id) => adj.get(id) ?? [])
      .filter((edge) => !visited.has(edge.to))
      .sort((left, right) => left.weight - right.weight || left.edgeId.localeCompare(right.edgeId));
    const edge = candidates[0];
    if (!edge) break;
    addStep(graph, steps, `Compare ${candidates.length} edges crossing the current cut.`, {
      phase: 'Prim · inspect frontier cut',
      decision: `min=${edge.from}–${edge.to}:${edge.weight}`,
      frontierEdges: candidates.map((candidate) => candidate.edgeId),
      mstEdges: [...chosen], totalWeight, keys: frontierKeys(),
    }, visited, edge.from, edge.edgeId, new Set(), chosen);
    visited.add(edge.to);
    chosen.add(edge.edgeId);
    totalWeight += edge.weight;
    addStep(graph, steps, `Add the lightest crossing edge ${edge.from}–${edge.to}.`, {
      phase: 'Prim · grow tree',
      totalWeight, mstEdges: [...chosen], visited: [...visited], keys: frontierKeys(),
    }, visited, edge.to, edge.edgeId, new Set(), chosen);
  }
  const connected = visited.size === graph.nodes.length;
  addStep(graph, steps, connected
    ? `Prim's MST has total weight ${totalWeight}.`
    : `The graph is disconnected; Prim covered only ${visited.size} of ${graph.nodes.length} vertices with weight ${totalWeight}.`, {
    phase: connected ? 'Prim · complete MST' : 'Prim · disconnected graph',
    totalWeight,
    connected,
    mstEdges: [...chosen],
    keys: frontierKeys(),
  }, visited, undefined, undefined, new Set(), chosen);
  return steps;
};

const bellmanFord = (graph: GraphDocumentV1): SimulationStep[] => {
  if (graph.nodes.length > 60) throw new Error('Bellman-Ford supports at most 60 nodes in the visualizer.');
  const steps: SimulationStep[] = [];
  const edges = directedEdges(graph);
  const distances: Record<string, number> = Object.fromEntries(
    graph.nodes.map((node) => [node.id, Number.POSITIVE_INFINITY]),
  );
  distances[graph.startId] = 0;
  const parentEdge: Record<string, string> = {};
  const shown = () => Object.fromEntries(Object.entries(distances).map(([id, value]) =>
    [id, Number.isFinite(value) ? value : '∞']));
  addStep(graph, steps, `Set ${graph.startId}'s distance to zero.`, {
    phase: 'Bellman-Ford · initialize',
    distances: shown(), pass: 0,
  }, new Set([graph.startId]), graph.startId);
  for (let pass = 1; pass < graph.nodes.length; pass += 1) {
    let changed = false;
    const inspected: string[] = [];
    addStep(graph, steps, `Begin complete edge pass ${pass}.`, {
      phase: 'Bellman-Ford · begin pass',
      distances: shown(), pass, visitedEdges: [], treeEdges: Object.values(parentEdge),
    });
    for (const edge of edges) {
      const candidate = distances[edge.from] + edge.weight;
      inspected.push(edge.edgeId);
      if (Number.isFinite(distances[edge.from]) && candidate < distances[edge.to]) {
        const previous = distances[edge.to];
        distances[edge.to] = candidate;
        parentEdge[edge.to] = edge.edgeId;
        changed = true;
        addStep(graph, steps, `Relax ${edge.from} → ${edge.to} on pass ${pass}.`, {
          phase: 'Bellman-Ford · relax edge',
          decision: `${candidate}<${Number.isFinite(previous) ? previous : '∞'} ⇒ d[${edge.to}]=${candidate}`,
          distances: shown(), pass, candidate, visitedEdges: [...inspected],
          treeEdges: Object.values(parentEdge),
        }, new Set(Object.keys(distances).filter((id) => Number.isFinite(distances[id]))), edge.to, edge.edgeId, new Set(), new Set(Object.values(parentEdge)));
      } else {
        addStep(graph, steps, `Inspect ${edge.from} → ${edge.to}; keep the current distance.`, {
          phase: 'Bellman-Ford · reject relaxation',
          decision: Number.isFinite(distances[edge.from])
            ? `${candidate}≥${shown()[edge.to]} ⇒ keep d[${edge.to}]`
            : `d[${edge.from}]=∞ ⇒ skip`,
          distances: shown(), pass, candidate: Number.isFinite(candidate) ? candidate : '∞',
          visitedEdges: [...inspected], rejectedEdges: [edge.edgeId], treeEdges: Object.values(parentEdge),
        }, new Set(Object.keys(distances).filter((id) => Number.isFinite(distances[id]))), edge.from, edge.edgeId, new Set(), new Set(Object.values(parentEdge)));
      }
    }
    if (!changed) {
      addStep(graph, steps, `Pass ${pass} made no changes; shortest distances are final.`, {
        phase: 'Bellman-Ford · early stop',
        distances: shown(), pass, visitedEdges: edges.map((edge) => edge.edgeId),
        treeEdges: Object.values(parentEdge),
      });
      break;
    }
  }
  const negativeCycle = edges.some((edge) =>
    Number.isFinite(distances[edge.from])
    && distances[edge.from] + edge.weight < distances[edge.to]);
  addStep(graph, steps, negativeCycle ? 'A reachable negative cycle exists.' : 'Bellman-Ford is complete.', {
    phase: negativeCycle ? 'Bellman-Ford · negative cycle' : 'Bellman-Ford · complete',
    distances: shown(), negativeCycle, treeEdges: Object.values(parentEdge),
  }, new Set(Object.keys(distances).filter((id) => Number.isFinite(distances[id]))), undefined, undefined, new Set(), new Set(Object.values(parentEdge)));
  return steps;
};

const floydWarshall = (graph: GraphDocumentV1): SimulationStep[] => {
  if (graph.nodes.length > 40) throw new Error('Floyd-Warshall supports at most 40 nodes in the visualizer.');
  const steps: SimulationStep[] = [];
  const ids = graph.nodes.map((node) => node.id);
  const index = new Map(ids.map((id, position) => [id, position]));
  const distances = Array.from({ length: ids.length }, (_, row) =>
    Array.from({ length: ids.length }, (_, column) =>
      row === column ? 0 : Number.POSITIVE_INFINITY));
  for (const edge of directedEdges(graph)) {
    const from = index.get(edge.from) as number;
    const to = index.get(edge.to) as number;
    distances[from][to] = Math.min(distances[from][to], edge.weight);
  }
  const shown = () => distances.map((row) =>
    row.map((value) => Number.isFinite(value) ? value : '∞'));
  const matrixStep = (
    explanation: string,
    vars: Record<string, TraceValue>,
    highlights: MatrixVisualData['highlights'] = [],
  ) => {
    const visualData: MatrixVisualData = {
      type: 'matrix', values: shown(), rowLabels: ids, columnLabels: ids,
      highlights, fillDirection: 'diagonal', vars,
    };
    const phase = vars.phase;
    const lineNumber = typeof phase === 'string'
      ? phase.includes('initialize') ? 2 : phase.includes('update') ? 8 : phase.includes('finish') ? 6 : 13
      : null;
    steps.push({ lineNumber, visualData, explanation });
  };
  matrixStep('Initialize the all-pairs distance matrix.', {
    phase: 'Floyd-Warshall · initialize matrix',
    order: ids, distances: shown(),
  }, ids.map((_, position) => ({ row: position, column: position, role: 'base' })));
  for (let middle = 0; middle < ids.length; middle += 1) {
    let updates = 0;
    for (let from = 0; from < ids.length; from += 1) {
      for (let to = 0; to < ids.length; to += 1) {
        const candidate = distances[from][middle] + distances[middle][to];
        if (candidate < distances[from][to]) {
          const previous = distances[from][to];
          distances[from][to] = candidate;
          updates += 1;
          matrixStep(`Route ${ids[from]} → ${ids[to]} through ${ids[middle]}.`, {
            phase: 'Floyd-Warshall · update through k',
            decision: `${distances[from][middle]}+${distances[middle][to]}<${Number.isFinite(previous) ? previous : '∞'} ⇒ ${candidate}`,
            middle: ids[middle], from: ids[from], to: ids[to], candidate,
            updates, order: ids, distances: shown(),
          }, [
            { row: from, column: middle, role: 'dependency', label: 'd[i][k]' },
            { row: middle, column: to, role: 'dependency', label: 'd[k][j]' },
            { row: from, column: to, role: 'active', label: 'd[i][j]' },
          ]);
        }
      }
    }
    matrixStep(`Finish allowing ${ids[middle]} as an intermediate node.`, {
      phase: 'Floyd-Warshall · finish k layer',
      middle: ids[middle],
      updates,
      order: ids,
      distances: shown(),
    }, ids.map((_, position) => ({ row: position, column: middle, role: 'computed' })));
  }
  matrixStep('Floyd-Warshall computed every reachable pair distance.', {
    phase: 'Floyd-Warshall · complete',
    order: ids, distances: shown(),
  });
  return steps;
};

const topologicalSort = (graph: GraphDocumentV1): SimulationStep[] => {
  requireDirected(graph, 'Topological Sort');
  const steps: SimulationStep[] = [];
  const adj = adjacency(graph);
  const indegree: Record<string, number> = Object.fromEntries(graph.nodes.map((node) => [node.id, 0]));
  for (const edge of graph.edges) indegree[edge.to] += 1;
  const queue = graph.nodes.map((node) => node.id).filter((id) => indegree[id] === 0);
  const order: string[] = [];
  const removedEdges = new Set<string>();
  addStep(graph, steps, 'Queue every node whose indegree is zero.', {
    phase: 'Topological Sort · find outer layer',
    indegree: { ...indegree },
    queue: [...queue],
    order, visitedEdges: [],
  });
  while (queue.length > 0) {
    const current = queue.shift() as string;
    order.push(current);
    addStep(graph, steps, `Remove indegree-zero node ${current}.`, {
      phase: 'Topological Sort · peel node',
      indegree: { ...indegree }, queue: [...queue], order: [...order],
      visitedEdges: [...removedEdges], removedEdges: [...removedEdges], removedNodes: [...order],
    }, new Set(order), current);
    for (const edge of adj.get(current) ?? []) {
      indegree[edge.to] -= 1;
      removedEdges.add(edge.edgeId);
      if (indegree[edge.to] === 0) queue.push(edge.to);
      addStep(graph, steps, `Remove ${current} → ${edge.to}; ${edge.to}'s indegree becomes ${indegree[edge.to]}.`, {
        phase: 'Topological Sort · release edge',
        decision: `remove ${current}→${edge.to}; indegree[${edge.to}]=${indegree[edge.to]}`,
        indegree: { ...indegree }, queue: [...queue], order: [...order],
        visitedEdges: [...removedEdges], removedEdges: [...removedEdges], removedNodes: [...order],
      }, new Set(order), edge.to, edge.edgeId);
    }
  }
  const hasCycle = order.length !== graph.nodes.length;
  addStep(graph, steps, hasCycle ? 'The graph contains a cycle; no topological order exists.' : 'Topological ordering is complete.', {
    phase: hasCycle ? 'Topological Sort · cycle detected' : 'Topological Sort · complete',
    order, hasCycle, indegree: { ...indegree }, queue: [],
    visitedEdges: [...removedEdges], removedEdges: [...removedEdges], removedNodes: [...order],
  }, new Set(order), undefined, undefined, new Set(order));
  return steps;
};

const kosaraju = (graph: GraphDocumentV1): SimulationStep[] => {
  requireDirected(graph, "Kosaraju's SCC");
  const steps: SimulationStep[] = [];
  const adj = adjacency(graph);
  const visited = new Set<string>();
  const finish: string[] = [];
  const first = (id: string) => {
    visited.add(id);
    addStep(graph, steps, `Enter ${id} in the first DFS.`, {
      phase: 'Kosaraju · first DFS enter',
      finishOrder: [...finish],
    }, new Set(visited), id);
    for (const edge of adj.get(id) ?? []) if (!visited.has(edge.to)) first(edge.to);
    finish.push(id);
    addStep(graph, steps, `Finish ${id} in the first DFS.`, {
      phase: 'Kosaraju · push finish stack',
      finishOrder: [...finish],
    }, new Set(visited), id);
  };
  for (const node of graph.nodes) if (!visited.has(node.id)) first(node.id);
  const reverse = new Map(graph.nodes.map((node) => [node.id, [] as string[]]));
  for (const edge of graph.edges) reverse.get(edge.to)?.push(edge.from);
  const transposed: GraphDocumentV1 = {
    ...graph,
    edges: graph.edges.map((edge) => ({ ...edge, from: edge.to, to: edge.from })),
  };
  addStep(transposed, steps, 'Transpose every edge before the second DFS.', {
    phase: 'Kosaraju · transpose graph',
    finishOrder: [...finish], transposed: true,
  });
  visited.clear();
  const components: string[][] = [];
  const componentOf: Record<string, number> = {};
  const second = (id: string, component: string[]) => {
    visited.add(id);
    component.push(id);
    componentOf[id] = components.length + 1;
    addStep(transposed, steps, `Collect ${id} in component ${components.length + 1}.`, {
      phase: 'Kosaraju · second DFS collect',
      components: [...components.map((value) => [...value]), [...component]],
      componentOf: { ...componentOf }, finishOrder: [...finish],
    }, new Set(visited), id, undefined, new Set(component));
    for (const next of reverse.get(id) ?? []) if (!visited.has(next)) second(next, component);
  };
  while (finish.length > 0) {
    const id = finish.pop() as string;
    if (visited.has(id)) continue;
    const component: string[] = [];
    addStep(transposed, steps, `Pop ${id} as the next second-pass root.`, {
      phase: 'Kosaraju · pop finish stack',
      components: components.map((value) => [...value]), componentOf: { ...componentOf },
      finishOrder: [...finish],
    }, new Set(visited), id);
    second(id, component);
    components.push(component);
    addStep(graph, steps, `Collect strongly connected component ${components.length}.`, {
      phase: 'Kosaraju · seal component',
      components: components.map((value) => [...value]), componentOf: { ...componentOf },
      finishOrder: [...finish],
    }, new Set(visited), id, undefined, new Set(component));
  }
  addStep(graph, steps, `Kosaraju found ${components.length} strongly connected components.`, {
    phase: 'Kosaraju · complete',
    components, componentOf,
  }, visited, undefined, undefined, new Set(graph.nodes.map((node) => node.id)));
  return steps;
};

const tarjan = (graph: GraphDocumentV1): SimulationStep[] => {
  requireDirected(graph, "Tarjan's SCC");
  const steps: SimulationStep[] = [];
  const adj = adjacency(graph);
  const discovery: Record<string, number> = {};
  const low: Record<string, number> = {};
  const stack: string[] = [];
  const onStack = new Set<string>();
  const components: string[][] = [];
  const componentOf: Record<string, number> = {};
  let time = 0;
  const visit = (id: string) => {
    discovery[id] = time;
    low[id] = time;
    time += 1;
    stack.push(id);
    onStack.add(id);
    addStep(graph, steps, `Discover ${id} and push it onto Tarjan's stack.`, {
      phase: 'Tarjan · discover and stack',
      discovery: { ...discovery },
      low: { ...low },
      stack: [...stack],
      components: components.map((value) => [...value]),
      onStack: [...onStack], componentOf: { ...componentOf },
    }, new Set(Object.keys(discovery)), id, undefined, new Set(stack));
    for (const edge of adj.get(id) ?? []) {
      if (discovery[edge.to] === undefined) {
        addStep(graph, steps, `Follow DFS tree edge ${id} → ${edge.to}.`, {
          phase: 'Tarjan · descend tree edge', discovery: { ...discovery }, low: { ...low },
          stack: [...stack], onStack: [...onStack], componentOf: { ...componentOf },
        }, new Set(Object.keys(discovery)), id, edge.edgeId, new Set(stack));
        visit(edge.to);
        const previous = low[id];
        low[id] = Math.min(low[id], low[edge.to]);
        addStep(graph, steps, `Propagate ${edge.to}'s low-link back to ${id}.`, {
          phase: 'Tarjan · propagate low-link', decision: `low[${id}]=min(${previous},${low[edge.to]})=${low[id]}`,
          discovery: { ...discovery }, low: { ...low }, stack: [...stack], onStack: [...onStack],
          componentOf: { ...componentOf },
        }, new Set(Object.keys(discovery)), id, edge.edgeId, new Set(stack));
      } else if (onStack.has(edge.to)) {
        const previous = low[id];
        low[id] = Math.min(low[id], discovery[edge.to]);
        addStep(graph, steps, `Use back edge ${id} → ${edge.to} to update the low-link.`, {
          phase: 'Tarjan · process back edge', decision: `low[${id}]=min(${previous},disc[${edge.to}])=${low[id]}`,
          discovery: { ...discovery }, low: { ...low }, stack: [...stack], onStack: [...onStack],
          componentOf: { ...componentOf },
        }, new Set(Object.keys(discovery)), id, edge.edgeId, new Set(stack));
      }
    }
    if (low[id] === discovery[id]) {
      const component: string[] = [];
      let current = '';
      do {
        current = stack.pop() as string;
        onStack.delete(current);
        component.push(current);
      } while (current !== id);
      components.push(component);
      for (const nodeId of component) componentOf[nodeId] = components.length;
      addStep(graph, steps, `Pop strongly connected component ${components.length}.`, {
        phase: 'Tarjan · pop SCC root', decision: `low[${id}]=disc[${id}] ⇒ SCC ${components.length}`,
        discovery: { ...discovery },
        low: { ...low },
        stack: [...stack],
        components: components.map((value) => [...value]), componentOf: { ...componentOf }, onStack: [...onStack],
      }, new Set(Object.keys(discovery)), id, undefined, new Set(component));
    }
  };
  for (const node of graph.nodes) if (discovery[node.id] === undefined) visit(node.id);
  addStep(graph, steps, `Tarjan found ${components.length} strongly connected components.`, {
    phase: 'Tarjan · complete', components, discovery, low, componentOf,
  }, new Set(Object.keys(discovery)), undefined, undefined, new Set(graph.nodes.map((node) => node.id)));
  return steps;
};

const residualNetwork = (graph: GraphDocumentV1) => {
  requireDirected(graph, 'Max flow');
  if (graph.edges.some((edge) => (edge.weight ?? 1) < 0)) {
    throw new Error('Max flow capacities must be non-negative.');
  }
  if (!graph.targetId || graph.targetId === graph.startId) {
    throw new Error('Max flow needs distinct start and target nodes.');
  }
  const capacity = new Map<string, number>();
  const neighbors = new Map(graph.nodes.map((node) => [node.id, new Set<string>()]));
  for (const edge of graph.edges) {
    const key = `${edge.from}\u0000${edge.to}`;
    capacity.set(key, (capacity.get(key) ?? 0) + (edge.weight ?? 1));
    neighbors.get(edge.from)?.add(edge.to);
    neighbors.get(edge.to)?.add(edge.from);
  }
  const flow = new Map<string, number>();
  const residual = (from: string, to: string) =>
    (capacity.get(`${from}\u0000${to}`) ?? 0) - (flow.get(`${from}\u0000${to}`) ?? 0);
  const augment = (from: string, to: string, value: number) => {
    const forward = `${from}\u0000${to}`;
    const reverse = `${to}\u0000${from}`;
    flow.set(forward, (flow.get(forward) ?? 0) + value);
    flow.set(reverse, (flow.get(reverse) ?? 0) - value);
  };
  const snapshot = () => ({
    edgeLabels: Object.fromEntries(graph.edges.map((edge) => {
      const key = `${edge.from}\u0000${edge.to}`;
      return [edge.id, `${Math.max(0, flow.get(key) ?? 0)}/${capacity.get(key) ?? 0}`];
    })),
    residual: Object.fromEntries([...neighbors].flatMap(([from, targets]) => [...targets]
      .map((to) => [`${from}→${to}`, residual(from, to)]))),
  });
  return { capacity, neighbors, flow, residual, augment, snapshot, target: graph.targetId };
};

const edmondsKarp = (graph: GraphDocumentV1): SimulationStep[] => {
  const network = residualNetwork(graph);
  const steps: SimulationStep[] = [];
  let maxFlow = 0;
  addStep(graph, steps, 'Initialize every edge flow to zero.', {
    phase: 'Edmonds-Karp · initialize residual network', maxFlow, ...network.snapshot(),
  });
  while (true) {
    const parent = new Map<string, string>();
    const queue = [graph.startId];
    const seen = new Set(queue);
    while (queue.length > 0 && !seen.has(network.target)) {
      const current = queue.shift() as string;
      for (const next of network.neighbors.get(current) ?? []) {
        if (seen.has(next) || network.residual(current, next) <= 0) continue;
        seen.add(next);
        parent.set(next, current);
        queue.push(next);
        const active = graph.edges.find((edge) => edge.from === current && edge.to === next)?.id;
        addStep(graph, steps, `BFS discovers residual arc ${current} → ${next}.`, {
          phase: 'Edmonds-Karp · BFS residual path', queue: [...queue], seen: [...seen],
          parent: Object.fromEntries(parent), maxFlow, ...network.snapshot(),
        }, seen, next, active);
      }
    }
    if (!seen.has(network.target)) {
      addStep(graph, steps, 'No residual source-to-sink path remains.', {
        phase: 'Edmonds-Karp · min-cut reached', maxFlow, reachable: [...seen], ...network.snapshot(),
      }, seen);
      break;
    }
    const path = [network.target];
    while (path[0] !== graph.startId) path.unshift(parent.get(path[0]) as string);
    let amount = Number.POSITIVE_INFINITY;
    for (let index = 1; index < path.length; index += 1) {
      amount = Math.min(amount, network.residual(path[index - 1], path[index]));
    }
    for (let index = 1; index < path.length; index += 1) {
      network.augment(path[index - 1], path[index], amount);
    }
    maxFlow += amount;
    const pathEdges = new Set(graph.edges.filter((edge) => path.some((id, index) =>
      index > 0 && path[index - 1] === edge.from && id === edge.to)).map((edge) => edge.id));
    addStep(graph, steps, `Augment the BFS path by ${amount}.`, {
      phase: 'Edmonds-Karp · augment shortest path', path, pathFlow: amount, maxFlow, ...network.snapshot(),
    }, seen, network.target, undefined, new Set(path), pathEdges);
  }
  addStep(graph, steps, `Edmonds-Karp maximum flow is ${maxFlow}.`, {
    phase: 'Edmonds-Karp · complete', maxFlow, ...network.snapshot(),
  });
  return steps;
};

const dinic = (graph: GraphDocumentV1): SimulationStep[] => {
  const network = residualNetwork(graph);
  const steps: SimulationStep[] = [];
  let maxFlow = 0;
  addStep(graph, steps, 'Initialize Dinic residual capacities.', {
    phase: 'Dinic · initialize residual network', maxFlow, ...network.snapshot(),
  });
  while (true) {
    const level: Record<string, number> = { [graph.startId]: 0 };
    const queue = [graph.startId];
    while (queue.length > 0) {
      const current = queue.shift() as string;
      for (const next of network.neighbors.get(current) ?? []) {
        if (level[next] !== undefined || network.residual(current, next) <= 0) continue;
        level[next] = level[current] + 1;
        queue.push(next);
      }
    }
    addStep(graph, steps, 'Build the next residual level graph.', {
      phase: 'Dinic · build level graph', level, maxFlow, ...network.snapshot(),
    }, new Set(Object.keys(level)));
    if (level[network.target] === undefined) break;
    const cursor: Record<string, number> = {};
    let lastPath: string[] = [];
    const send = (current: string, available: number, seen: Set<string>, path: string[]): number => {
      if (current === network.target) { lastPath = [...path]; return available; }
      const nextNodes = [...(network.neighbors.get(current) ?? [])];
      for (let index = cursor[current] ?? 0; index < nextNodes.length; index += 1) {
        cursor[current] = index + 1;
        const next = nextNodes[index];
        if (
          seen.has(next)
          || level[next] !== level[current] + 1
          || network.residual(current, next) <= 0
        ) continue;
        seen.add(next);
        const sent = send(next, Math.min(available, network.residual(current, next)), seen, [...path, next]);
        if (sent > 0) {
          network.augment(current, next, sent);
          return sent;
        }
      }
      return 0;
    };
    while (true) {
      const sent = send(graph.startId, Number.POSITIVE_INFINITY, new Set([graph.startId]), [graph.startId]);
      if (sent === 0) break;
      maxFlow += sent;
      const pathEdges = new Set(graph.edges.filter((edge) => lastPath.some((id, index) =>
        index > 0 && lastPath[index - 1] === edge.from && id === edge.to)).map((edge) => edge.id));
      addStep(graph, steps, `Send ${sent} units through the level graph.`, {
        phase: 'Dinic · send blocking flow', level, path: [...lastPath], blockingFlow: sent,
        maxFlow, ...network.snapshot(),
      }, new Set(Object.keys(level)), network.target, undefined, new Set(lastPath), pathEdges);
    }
  }
  addStep(graph, steps, `Dinic maximum flow is ${maxFlow}.`, {
    phase: 'Dinic · complete', maxFlow, ...network.snapshot(),
  });
  return steps;
};

const hopcroftKarp = (graph: GraphDocumentV1): SimulationStep[] => {
  requireUndirected(graph, 'Hopcroft-Karp');
  const steps: SimulationStep[] = [];
  const adj = adjacency(graph);
  const color: Record<string, number> = {};
  for (const node of graph.nodes) {
    if (color[node.id] !== undefined) continue;
    color[node.id] = 0;
    const queue = [node.id];
    while (queue.length > 0) {
      const current = queue.shift() as string;
      for (const edge of adj.get(current) ?? []) {
        if (color[edge.to] === undefined) {
          color[edge.to] = 1 - color[current];
          queue.push(edge.to);
        } else if (color[edge.to] === color[current]) {
          throw new Error('Hopcroft-Karp requires a bipartite graph.');
        }
      }
    }
  }
  const left = graph.nodes.map((node) => node.id).filter((id) => color[id] === 0);
  const right = graph.nodes.map((node) => node.id).filter((id) => color[id] === 1);
  const bipartiteGraph: GraphDocumentV1 = {
    ...graph,
    nodes: graph.nodes.map((node) => {
      const partition = color[node.id] === 0 ? left : right;
      const index = partition.indexOf(node.id);
      return { ...node, x: color[node.id] === 0 ? 22 : 78, y: 12 + index * (76 / Math.max(1, partition.length - 1)) };
    }),
  };
  const pairLeft = new Map<string, string>();
  const pairRight = new Map<string, string>();
  addStep(bipartiteGraph, steps, 'Color the graph into left and right partitions.', {
    phase: 'Hopcroft-Karp · validate bipartition', colors: Object.fromEntries(Object.entries(color).map(([id, side]) => [id, side + 1])),
    left,
    right,
  });
  let phases = 0;
  while (true) {
    const distance = new Map<string, number>();
    const queue: string[] = [];
    for (const id of left) {
      if (!pairLeft.has(id)) {
        distance.set(id, 0);
        queue.push(id);
      }
    }
    while (queue.length > 0) {
      const current = queue.shift() as string;
      for (const edge of adj.get(current) ?? []) {
        const paired = pairRight.get(edge.to);
        if (paired && !distance.has(paired)) {
          distance.set(paired, (distance.get(current) ?? 0) + 1);
          queue.push(paired);
        }
      }
    }
    addStep(bipartiteGraph, steps, 'Build alternating BFS layers from every free left vertex.', {
      phase: 'Hopcroft-Karp · alternating BFS layers',
      left, distance: Object.fromEntries(distance), queue: [], matching: Object.fromEntries(pairLeft),
      colors: Object.fromEntries(Object.entries(color).map(([id, side]) => [id, side + 1])),
    }, new Set(distance.keys()));
    let augmentingPath: string[] = [];
    const search = (id: string, seen: Set<string>, path: string[]): boolean => {
      for (const edge of adj.get(id) ?? []) {
        if (seen.has(edge.to)) continue;
        seen.add(edge.to);
        const paired = pairRight.get(edge.to);
        if (
          !paired
          || (
            distance.get(paired) === (distance.get(id) ?? 0) + 1
            && search(paired, seen, [...path, edge.to, paired])
          )
        ) {
          pairLeft.set(id, edge.to);
          pairRight.set(edge.to, id);
          augmentingPath = [...path, edge.to];
          return true;
        }
      }
      return false;
    };
    let augmented = 0;
    for (const id of left) {
      if (!pairLeft.has(id) && search(id, new Set(), [id])) {
        augmented += 1;
        const matchingEdges = new Set(graph.edges
          .filter((edge) => pairLeft.get(edge.from) === edge.to || pairLeft.get(edge.to) === edge.from)
          .map((edge) => edge.id));
        addStep(bipartiteGraph, steps, `Augment along ${augmentingPath.join(' → ')}.`, {
          phase: 'Hopcroft-Karp · augment shortest path', path: [...augmentingPath],
          matching: Object.fromEntries(pairLeft), matchingSize: pairLeft.size,
          colors: Object.fromEntries(Object.entries(color).map(([nodeId, side]) => [nodeId, side + 1])),
        }, new Set([...pairLeft.keys(), ...pairRight.keys()]), undefined, undefined, new Set(augmentingPath), matchingEdges);
      }
    }
    if (augmented === 0) break;
    phases += 1;
    const matchingEdges = new Set(graph.edges
      .filter((edge) => pairLeft.get(edge.from) === edge.to || pairLeft.get(edge.to) === edge.from)
      .map((edge) => edge.id));
    addStep(bipartiteGraph, steps, `Complete Hopcroft-Karp phase ${phases}.`, {
      phase: 'Hopcroft-Karp · complete phase', phases,
      augmented,
      matching: Object.fromEntries(pairLeft),
      matchingSize: pairLeft.size,
      colors: Object.fromEntries(Object.entries(color).map(([id, side]) => [id, side + 1])),
    }, new Set([...pairLeft.keys(), ...pairRight.keys()]), undefined, undefined, new Set(), matchingEdges);
  }
  const finalMatchingEdges = new Set(graph.edges
    .filter((edge) => pairLeft.get(edge.from) === edge.to || pairLeft.get(edge.to) === edge.from)
    .map((edge) => edge.id));
  addStep(bipartiteGraph, steps, `Maximum bipartite matching size is ${pairLeft.size}.`, {
    phase: 'Hopcroft-Karp · maximum matching',
    matching: Object.fromEntries(pairLeft),
    matchingSize: pairLeft.size,
    phases,
    colors: Object.fromEntries(Object.entries(color).map(([id, side]) => [id, side + 1])),
  }, new Set([...pairLeft.keys(), ...pairRight.keys()]), undefined, undefined, new Set(), finalMatchingEdges);
  return steps;
};

const graphColoring = (graph: GraphDocumentV1): SimulationStep[] => {
  requireUndirected(graph, 'Graph Coloring');
  if (graph.nodes.length > 12) throw new Error('Graph Coloring supports at most 12 nodes in the visualizer.');
  if (graph.edges.some((edge) => edge.from === edge.to)) {
    throw new Error('Graph Coloring cannot color a graph with a self-loop.');
  }
  const steps: SimulationStep[] = [];
  const adj = adjacency(graph);
  const colors: Record<string, number> = {};
  addStep(graph, steps, 'Start with every node uncolored.', { phase: 'Graph Coloring · initialize', colors });
  const ids = graph.nodes.map((node) => node.id);
  const greedyColors: Record<string, number> = {};
  for (const id of ids) {
    const unavailable = new Set((adj.get(id) ?? [])
      .map((edge) => greedyColors[edge.to])
      .filter((value) => value !== undefined));
    let color = 1;
    while (unavailable.has(color)) color += 1;
    greedyColors[id] = color;
  }
  const colorCount = Math.max(...Object.values(greedyColors));
  const paletteColors = ['#00f3ff', '#ff4fd8', '#8dff5a', '#ffb000', '#8f7dff', '#ff6b6b'];
  const palette = Array.from({ length: colorCount }, (_, index) => ({ color: index + 1, swatch: paletteColors[index % paletteColors.length] }));
  addStep(graph, steps, `Prepare a palette of ${colorCount} colors.`, {
    phase: 'Graph Coloring · prepare palette', colors: {}, colorLimit: colorCount, palette,
  });
  const search = (position: number, colorLimit: number): boolean => {
    if (position === ids.length) return true;
    const current = ids[position];
    for (let color = 1; color <= colorLimit; color += 1) {
      const conflict = (adj.get(current) ?? []).find((edge) => colors[edge.to] === color);
      if (conflict) {
        addStep(graph, steps, `Reject color ${color} for ${current}; neighbor ${conflict.to} already uses it.`, {
          phase: 'Graph Coloring · reject conflict', decision: `${current}=${color} conflicts with ${conflict.to}`,
          colors: { ...colors }, colorLimit, palette, triedColor: color, rejectedEdges: [conflict.edgeId],
        }, new Set(Object.keys(colors)), current, conflict.edgeId);
        continue;
      }
      colors[current] = color;
      addStep(graph, steps, `Assign color ${color} to ${current}.`, {
        phase: 'Graph Coloring · assign color', colors: { ...colors }, colorLimit, palette,
      }, new Set(Object.keys(colors)), current);
      if (search(position + 1, colorLimit)) return true;
      delete colors[current];
      addStep(graph, steps, `Remove color ${color} from ${current} and backtrack.`, {
        phase: 'Graph Coloring · backtrack', colors: { ...colors }, colorLimit, palette,
      }, new Set(Object.keys(colors)), current);
    }
    return false;
  };
  search(0, colorCount);
  addStep(graph, steps, `Colored the graph with ${colorCount} colors.`, {
    phase: 'Graph Coloring · complete', colors, colorCount, palette,
  }, new Set(Object.keys(colors)));
  return steps;
};

const eulerianPath = (graph: GraphDocumentV1): SimulationStep[] => {
  const steps: SimulationStep[] = [];
  const adj = adjacency(graph);
  const used = new Set<string>();
  const stack = [graph.startId];
  const path: string[] = [];
  addStep(graph, steps, `Start Hierholzer's walk at ${graph.startId}.`, {
    phase: 'Euler · initialize walk stack', stack: [...stack], path, usedEdges: [],
  }, new Set(), graph.startId);
  while (stack.length > 0) {
    const current = stack.at(-1) as string;
    const edge = (adj.get(current) ?? []).find((candidate) => !used.has(candidate.edgeId));
    if (edge) {
      used.add(edge.edgeId);
      stack.push(edge.to);
      addStep(graph, steps, `Consume edge ${edge.from} → ${edge.to}.`, {
        phase: 'Euler · consume unused edge', stack: [...stack], path: [...path], usedEdges: [...used],
      }, new Set(path), edge.to, edge.edgeId, new Set(), used);
    } else {
      path.unshift(stack.pop() as string);
      addStep(graph, steps, `Prepend ${current} while backtracking.`, {
        phase: 'Euler · splice circuit on dead end', stack: [...stack], path: [...path], usedEdges: [...used],
      }, new Set(path), current, undefined, new Set(path), used);
    }
  }
  const trailEdges = new Set<string>();
  let validTrail = path.length === graph.edges.length + 1;
  for (let index = 1; validTrail && index < path.length; index += 1) {
    const edge = graph.edges.find((candidate) => !trailEdges.has(candidate.id) && (
      (candidate.from === path[index - 1] && candidate.to === path[index])
      || (!graph.directed && candidate.to === path[index - 1] && candidate.from === path[index])
    ));
    if (!edge) validTrail = false;
    else trailEdges.add(edge.id);
  }
  const valid = used.size === graph.edges.length && validTrail && trailEdges.size === graph.edges.length;
  addStep(graph, steps, valid ? 'The Eulerian path/circuit uses every edge once.' : 'No Eulerian path from the selected start uses every edge.', {
    phase: valid ? 'Euler · complete trail' : 'Euler · invalid start or graph',
    path: valid ? path : [], valid, usedEdgeCount: used.size,
    trailEdges: valid ? [...trailEdges] : [], rejectedEdges: valid ? [] : [...used],
  }, new Set(path), undefined, undefined, valid ? new Set(path) : new Set(), valid ? trailEdges : new Set());
  return steps;
};

const hamiltonianCycle = (graph: GraphDocumentV1): SimulationStep[] => {
  if (graph.nodes.length > 12) throw new Error('Hamiltonian Cycle supports at most 12 nodes in the visualizer.');
  const steps: SimulationStep[] = [];
  const adj = adjacency(graph);
  const path = [graph.startId];
  const used = new Set(path);
  const pathEdgeIds = () => new Set(graph.edges.filter((edge) => path.some((id, index) =>
    index > 0 && ((path[index - 1] === edge.from && id === edge.to)
      || (!graph.directed && path[index - 1] === edge.to && id === edge.from)))).map((edge) => edge.id));
  addStep(graph, steps, `Start the Hamiltonian path at ${graph.startId}.`, {
    phase: 'Hamilton · initialize candidate path', path: [...path],
  }, used, graph.startId);
  const search = (): boolean => {
    if (path.length === graph.nodes.length) {
      const closing = (adj.get(path.at(-1) as string) ?? []).find((edge) => edge.to === path[0]);
      addStep(graph, steps, closing ? 'The final node reconnects to the start.' : 'Reject the full path because its final node cannot close the cycle.', {
        phase: closing ? 'Hamilton · close cycle' : 'Hamilton · reject missing closing edge',
        path: [...path], rejectedEdges: closing ? [] : [],
      }, used, path.at(-1), closing?.edgeId, new Set(path), closing ? new Set([...pathEdgeIds(), closing.edgeId]) : pathEdgeIds());
      return Boolean(closing);
    }
    const current = path.at(-1) as string;
    for (const edge of adj.get(current) ?? []) {
      if (used.has(edge.to)) {
        addStep(graph, steps, `Reject ${edge.to}; it already appears in the candidate path.`, {
          phase: 'Hamilton · reject repeated vertex', path: [...path], rejectedEdges: [edge.edgeId],
        }, used, current, edge.edgeId, new Set(path), new Set([...pathEdgeIds()].filter((id) => id !== edge.edgeId)));
        continue;
      }
      path.push(edge.to);
      used.add(edge.to);
      addStep(graph, steps, `Try ${edge.to} as the next cycle node.`, {
        phase: 'Hamilton · extend candidate path', path: [...path],
      }, used, edge.to, edge.edgeId, new Set(path), pathEdgeIds());
      if (search()) return true;
      used.delete(edge.to);
      path.pop();
      addStep(graph, steps, `Backtrack from ${edge.to}.`, {
        phase: 'Hamilton · backtrack', path: [...path], rejectedEdges: [edge.edgeId],
      }, used, current, edge.edgeId, new Set(path), pathEdgeIds());
    }
    return false;
  };
  const found = search();
  const cycle = found ? [...path, path[0]] : [];
  addStep(graph, steps, found ? 'A Hamiltonian cycle was found.' : 'No Hamiltonian cycle exists.', {
    phase: found ? 'Hamilton · complete cycle' : 'Hamilton · no cycle', found, cycle,
  }, new Set(path), undefined, undefined, found ? new Set(cycle) : new Set(), found ? pathEdgeIds() : new Set());
  return steps;
};

const lowLinkUndirected = (
  graph: GraphDocumentV1,
  mode: 'articulation' | 'bridges',
): SimulationStep[] => {
  requireUndirected(graph, mode === 'articulation' ? 'Articulation Points' : 'Bridges');
  const steps: SimulationStep[] = [];
  const adj = adjacency(graph);
  const discovery: Record<string, number> = {};
  const low: Record<string, number> = {};
  const points = new Set<string>();
  const bridges = new Set<string>();
  let time = 0;
  const visit = (id: string, parentEdgeId?: string) => {
    discovery[id] = time;
    low[id] = time;
    time += 1;
    addStep(graph, steps, `Discover ${id} for low-link analysis.`, {
      phase: `${mode} · discover vertex`, discovery: { ...discovery }, low: { ...low },
      articulationPoints: [...points], bridges: [...bridges],
    }, new Set(Object.keys(discovery)), id);
    let children = 0;
    for (const edge of adj.get(id) ?? []) {
      if (edge.edgeId === parentEdgeId) continue;
      if (discovery[edge.to] === undefined) {
        children += 1;
        addStep(graph, steps, `Descend through DFS tree edge ${id} → ${edge.to}.`, {
          phase: `${mode} · descend tree edge`, discovery: { ...discovery }, low: { ...low },
          articulationPoints: [...points], bridges: [...bridges],
        }, new Set(Object.keys(discovery)), id, edge.edgeId);
        visit(edge.to, edge.edgeId);
        const previous = low[id];
        low[id] = Math.min(low[id], low[edge.to]);
        const separates = parentEdgeId !== undefined && low[edge.to] >= discovery[id];
        const isBridge = low[edge.to] > discovery[id];
        if (separates) points.add(id);
        if (isBridge) bridges.add(edge.edgeId);
        addStep(graph, steps, `Evaluate the subtree returning from ${edge.to} to ${id}.`, {
          phase: mode === 'articulation' ? 'articulation · separation test' : 'bridges · bridge test',
          decision: mode === 'articulation'
            ? `low[${edge.to}]=${low[edge.to]} ${separates ? '≥' : '<'} disc[${id}]=${discovery[id]}`
            : `low[${edge.to}]=${low[edge.to]} ${isBridge ? '>' : '≤'} disc[${id}]=${discovery[id]}`,
          previousLow: previous, discovery: { ...discovery }, low: { ...low },
          articulationPoints: [...points], bridges: [...bridges],
        }, new Set(Object.keys(discovery)), id, edge.edgeId, points, bridges);
      } else {
        const previous = low[id];
        low[id] = Math.min(low[id], discovery[edge.to]);
        addStep(graph, steps, `Use back edge ${id} → ${edge.to} in low-link analysis.`, {
          phase: `${mode} · process back edge`, decision: `low[${id}]=min(${previous},${discovery[edge.to]})=${low[id]}`,
          discovery: { ...discovery }, low: { ...low }, articulationPoints: [...points], bridges: [...bridges],
        }, new Set(Object.keys(discovery)), id, edge.edgeId, points, bridges);
      }
    }
    if (parentEdgeId === undefined && children > 1) {
      points.add(id);
      addStep(graph, steps, `Root ${id} has ${children} DFS children and is an articulation point.`, {
        phase: 'articulation · root child test', discovery: { ...discovery }, low: { ...low },
        articulationPoints: [...points], bridges: [...bridges], children,
      }, new Set(Object.keys(discovery)), id, undefined, points, bridges);
    }
    addStep(graph, steps, `Finish low-link processing for ${id}.`, {
      phase: `${mode} · finish vertex`,
      discovery: { ...discovery },
      low: { ...low },
      articulationPoints: [...points],
      bridges: [...bridges],
    }, new Set(Object.keys(discovery)), id, undefined, points, bridges);
  };
  for (const node of graph.nodes) if (discovery[node.id] === undefined) visit(node.id);
  addStep(
    graph,
    steps,
    mode === 'articulation'
      ? `Found ${points.size} articulation points.`
      : `Found ${bridges.size} bridges.`,
    {
      phase: mode === 'articulation' ? 'articulation · complete' : 'bridges · complete',
      discovery,
      low,
      articulationPoints: [...points],
      bridges: [...bridges],
    },
    new Set(Object.keys(discovery)),
    undefined,
    undefined,
    points,
    bridges,
  );
  return steps;
};

const johnson = (graph: GraphDocumentV1): SimulationStep[] => {
  requireDirected(graph, "Johnson's Algorithm");
  if (graph.nodes.length > 40) throw new Error("Johnson's Algorithm supports at most 40 nodes.");
  const steps: SimulationStep[] = [];
  const ids = graph.nodes.map((node) => node.id);
  const edges = directedEdges(graph);
  const potential: Record<string, number> = Object.fromEntries(ids.map((id) => [id, 0]));
  const superSource = '__johnson_super_source__';
  const superSourceVisual: GraphVisualData = {
    type: 'graph', directed: true,
    nodes: [
      { id: superSource, label: 'Q', x: 50, y: 4, state: 'active', semanticRoles: ['super-source'] },
      ...graph.nodes.map((node) => ({ ...node, state: 'queued' as const })),
    ],
    edges: [
      ...graph.edges.map((edge) => ({ ...edge, state: 'idle' as const })),
      ...ids.map((id) => ({ id: `${superSource}->${id}`, from: superSource, to: id, weight: 0, displayLabel: '0', state: 'active' as const })),
    ],
    vars: { phase: 'Johnson · add zero-weight super-source', superSource, potential: { ...potential } },
  };
  steps.push({ lineNumber: 2, visualData: superSourceVisual, explanation: 'Add a virtual super-source with a zero-weight edge to every vertex.' });
  for (let pass = 1; pass < ids.length; pass += 1) {
    let changed = false;
    for (const edge of edges) {
      if (potential[edge.to] > potential[edge.from] + edge.weight) {
        potential[edge.to] = potential[edge.from] + edge.weight;
        changed = true;
      }
    }
    if (!changed) break;
  }
  if (edges.some((edge) => potential[edge.to] > potential[edge.from] + edge.weight)) {
    throw new Error("Johnson's Algorithm cannot run on a graph with a negative cycle.");
  }
  const reweightedLabels = Object.fromEntries(graph.edges.map((edge) => [
    edge.id, `w'=${(edge.weight ?? 1) + potential[edge.from] - potential[edge.to]}`,
  ]));
  addStep(graph, steps, 'Bellman-Ford computes the vertex potentials.', {
    phase: 'Johnson · Bellman-Ford potentials', potential,
  });
  addStep(graph, steps, 'Reweight every edge to a non-negative cost.', {
    phase: 'Johnson · reweight edges', potential, edgeLabels: reweightedLabels,
  });
  const allPairs: Record<string, Record<string, number | string>> = {};
  const adj = adjacency(graph);
  for (const source of ids) {
    const distance: Record<string, number> = Object.fromEntries(ids.map((id) => [id, Number.POSITIVE_INFINITY]));
    const done = new Set<string>();
    distance[source] = 0;
    while (done.size < ids.length) {
      const current = ids
        .filter((id) => !done.has(id))
        .sort((left, right) => distance[left] - distance[right])[0];
      if (!current || !Number.isFinite(distance[current])) break;
      done.add(current);
      addStep(graph, steps, `Select ${current} in reweighted Dijkstra from ${source}.`, {
        phase: 'Johnson · per-source Dijkstra', source, current, potential,
        distances: Object.fromEntries(ids.map((id) => [id, Number.isFinite(distance[id]) ? distance[id] : '∞'])),
        edgeLabels: reweightedLabels, allPairs: { ...allPairs },
      }, done, current);
      for (const edge of adj.get(current) ?? []) {
        const reweighted = edge.weight + potential[current] - potential[edge.to];
        distance[edge.to] = Math.min(distance[edge.to], distance[current] + reweighted);
      }
    }
    allPairs[source] = Object.fromEntries(ids.map((target) => [
      target,
      Number.isFinite(distance[target])
        ? distance[target] - potential[source] + potential[target]
        : '∞',
    ]));
    addStep(graph, steps, `Run reweighted Dijkstra from ${source}.`, {
      phase: 'Johnson · restore source row', source, potential, allPairs: { ...allPairs }, edgeLabels: reweightedLabels,
    }, done, source);
  }
  const visualData: MatrixVisualData = {
    type: 'matrix', rowLabels: ids, columnLabels: ids,
    values: ids.map((source) => ids.map((target) => allPairs[source][target])),
    highlights: ids.map((_, index) => ({ row: index, column: index, role: 'base' as const })),
    fillDirection: 'row',
    vars: { phase: 'Johnson · complete distance matrix', potential, allPairs },
  };
  steps.push({ lineNumber: 6, visualData, explanation: 'Johnson computed all-pairs shortest paths.' });
  return steps;
};

const treeTraversal = (
  graph: GraphDocumentV1,
  order: 'inorder' | 'preorder' | 'postorder',
): SimulationStep[] => {
  if (graph.mode !== 'tree') throw new Error('Tree traversal requires a tree input.');
  const steps: SimulationStep[] = [];
  const children = adjacency(graph);
  for (const node of graph.nodes) {
    if ((children.get(node.id) ?? []).length > 2) {
      throw new Error(`Binary node ${node.id} has more than two children.`);
    }
  }
  const visited = new Set<string>();
  const result: string[] = [];
  const stack: string[] = [];
  const recordVisit = (id: string) => {
    result.push(id);
    addStep(graph, steps, `Emit ${id} in ${order} order.`, {
      phase: `Tree ${order} · visit node`, traversal: [...result], order, callStack: [...stack], decision: `emit ${id}`,
    }, new Set(visited), id, undefined, new Set(result));
  };
  const visit = (id: string) => {
    stack.push(id);
    addStep(graph, steps, `Enter the recursive frame for ${id}.`, {
      phase: `Tree ${order} · enter frame`, traversal: [...result], order, callStack: [...stack],
    }, new Set(visited), id, undefined, new Set(stack));
    const next = (children.get(id) ?? []).map((edge) => edge.to);
    const left = next[0];
    const right = next[1];
    if (order === 'preorder') recordVisit(id);
    if (left) {
      addStep(graph, steps, `Descend from ${id} to left child ${left}.`, {
        phase: `Tree ${order} · descend left`, traversal: [...result], order, callStack: [...stack],
      }, new Set(visited), left, undefined, new Set(stack));
      visit(left);
    }
    if (order === 'inorder') recordVisit(id);
    if (right) {
      addStep(graph, steps, `Descend from ${id} to right child ${right}.`, {
        phase: `Tree ${order} · descend right`, traversal: [...result], order, callStack: [...stack],
      }, new Set(visited), right, undefined, new Set(stack));
      visit(right);
    }
    if (order === 'postorder') recordVisit(id);
    visited.add(id);
    stack.pop();
    addStep(graph, steps, `Return from ${id} to its caller.`, {
      phase: `Tree ${order} · return from frame`, traversal: [...result], order, callStack: [...stack],
    }, new Set(visited), stack.at(-1), undefined, new Set(result));
  };
  addStep(graph, steps, `Start ${order} traversal at ${graph.rootId ?? graph.startId}.`, {
    phase: `Tree ${order} · initialize`, traversal: [], order, callStack: [],
  });
  visit(graph.rootId ?? graph.startId);
  addStep(graph, steps, `${order} traversal is complete.`, {
    phase: `Tree ${order} · complete`, traversal: result, order, callStack: [],
  }, visited, undefined, undefined, new Set(result));
  return steps;
};

const lowestCommonAncestor = (graph: GraphDocumentV1): SimulationStep[] => {
  if (graph.mode !== 'tree') throw new Error('Lowest Common Ancestor requires a tree input.');
  if (!graph.targetId || graph.targetId === graph.startId) {
    throw new Error('Lowest Common Ancestor needs distinct Start and Target query nodes.');
  }
  const root = graph.rootId ?? graph.nodes[0].id;
  const adj = adjacency(graph);
  const parent = new Map<string, string>();
  const queue = [root];
  const seen = new Set(queue);
  const steps: SimulationStep[] = [];
  addStep(graph, steps, `Build parent links from root ${root}.`, {
    phase: 'LCA · initialize parent traversal', first: graph.startId,
    second: graph.targetId,
  }, seen, root);
  while (queue.length > 0) {
    const current = queue.shift() as string;
    for (const edge of adj.get(current) ?? []) {
      if (seen.has(edge.to)) continue;
      seen.add(edge.to);
      parent.set(edge.to, current);
      queue.push(edge.to);
    }
    addStep(graph, steps, `Record children of ${current}.`, {
      phase: 'LCA · build parent links', parent: Object.fromEntries(parent),
      queue: [...queue],
    }, new Set(seen), current);
  }
  const ancestors = new Set<string>();
  let current: string | undefined = graph.startId;
  while (current) {
    ancestors.add(current);
    addStep(graph, steps, `Mark ${current} on the first node's ancestor path.`, {
      phase: 'LCA · mark first ancestor path', first: graph.startId, second: graph.targetId,
      firstAncestors: [...ancestors], parent: Object.fromEntries(parent),
    }, seen, current, undefined, new Set(ancestors));
    current = parent.get(current);
  }
  const secondPath: string[] = [];
  current = graph.targetId;
  while (current && !ancestors.has(current)) {
    secondPath.push(current);
    addStep(graph, steps, `Climb from ${current} toward the first shared ancestor.`, {
      phase: 'LCA · climb second ancestor path', firstAncestors: [...ancestors], secondPath: [...secondPath],
      first: graph.startId, second: graph.targetId,
    }, seen, current, undefined, new Set([...ancestors, ...secondPath]));
    current = parent.get(current);
  }
  const lca = current ?? root;
  addStep(graph, steps, `The lowest common ancestor is ${lca}.`, {
    phase: 'LCA · complete', first: graph.startId,
    second: graph.targetId,
    firstAncestors: [...ancestors],
    secondPath,
    lca,
  }, seen, lca, undefined, new Set([lca]));
  return steps;
};

export const extendedGraphSimulators: Record<
  string,
  (graph: GraphDocumentV1) => SimulationStep[]
> = {
  kruskal,
  prim,
  bellmanFord,
  floydWarshall,
  topologicalSort,
  kosaraju,
  tarjan,
  edmondsKarp,
  dinic,
  hopcroftKarp,
  graphColoring,
  eulerianPath,
  hamiltonianCycle,
  articulationPoints: (graph) => lowLinkUndirected(graph, 'articulation'),
  bridges: (graph) => lowLinkUndirected(graph, 'bridges'),
  johnson,
  inorder: (graph) => treeTraversal(graph, 'inorder'),
  preorder: (graph) => treeTraversal(graph, 'preorder'),
  postorder: (graph) => treeTraversal(graph, 'postorder'),
  lca: lowestCommonAncestor,
};
