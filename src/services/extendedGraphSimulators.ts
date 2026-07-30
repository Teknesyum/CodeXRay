import type {
  GraphDocumentV1,
  GraphVisualData,
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
  const visualData: GraphVisualData = {
    type: 'graph',
    directed: graph.directed,
    nodes: graph.nodes.map((node) => ({
      ...node,
      state: pathNodes.has(node.id)
        ? 'path'
        : node.id === activeNode
          ? 'active'
          : visited.has(node.id)
            ? 'visited'
            : 'idle',
    })),
    edges: graph.edges.map((edge) => ({
      ...edge,
      state: pathEdges.has(edge.id)
        ? 'path'
        : edge.id === activeEdge
          ? 'active'
          : 'idle',
    })),
    vars,
  };
  steps.push({ lineNumber: null, visualData, explanation });
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
  let totalWeight = 0;
  addStep(graph, steps, 'Sort every edge by non-decreasing weight.', {
    sortedEdges: sorted.map((edge) => edge.id),
    totalWeight,
  });
  for (const edge of sorted) {
    const accepted = sets.union(edge.from, edge.to);
    if (accepted) {
      chosen.add(edge.id);
      totalWeight += edge.weight ?? 1;
    }
    addStep(
      graph,
      steps,
      accepted ? `Accept edge ${edge.from}–${edge.to}.` : `Reject edge ${edge.from}–${edge.to}; it closes a cycle.`,
      {
        accepted,
        totalWeight,
        mstEdges: [...chosen],
        components: Object.fromEntries(graph.nodes.map((node) => [node.id, sets.find(node.id)])),
      },
      new Set(),
      edge.to,
      edge.id,
      new Set(),
      chosen,
    );
    if (chosen.size === graph.nodes.length - 1) break;
  }
  addStep(graph, steps, `Kruskal's MST has total weight ${totalWeight}.`, {
    totalWeight,
    mstEdges: [...chosen],
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
  addStep(graph, steps, `Start Prim's tree at ${graph.startId}.`, {
    totalWeight,
    mstEdges: [],
  }, visited, graph.startId);
  while (visited.size < graph.nodes.length) {
    const candidates = [...visited]
      .flatMap((id) => adj.get(id) ?? [])
      .filter((edge) => !visited.has(edge.to))
      .sort((left, right) => left.weight - right.weight || left.edgeId.localeCompare(right.edgeId));
    const edge = candidates[0];
    if (!edge) break;
    visited.add(edge.to);
    chosen.add(edge.edgeId);
    totalWeight += edge.weight;
    addStep(graph, steps, `Add the lightest crossing edge ${edge.from}–${edge.to}.`, {
      totalWeight,
      mstEdges: [...chosen],
      visited: [...visited],
    }, visited, edge.to, edge.edgeId, new Set(), chosen);
  }
  addStep(graph, steps, `Prim's MST has total weight ${totalWeight}.`, {
    totalWeight,
    connected: visited.size === graph.nodes.length,
    mstEdges: [...chosen],
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
  const shown = () => Object.fromEntries(Object.entries(distances).map(([id, value]) =>
    [id, Number.isFinite(value) ? value : '∞']));
  addStep(graph, steps, `Set ${graph.startId}'s distance to zero.`, {
    distances: shown(),
    pass: 0,
  }, new Set([graph.startId]), graph.startId);
  for (let pass = 1; pass < graph.nodes.length; pass += 1) {
    let changed = false;
    for (const edge of edges) {
      const candidate = distances[edge.from] + edge.weight;
      if (Number.isFinite(distances[edge.from]) && candidate < distances[edge.to]) {
        distances[edge.to] = candidate;
        changed = true;
        addStep(graph, steps, `Relax ${edge.from} → ${edge.to} on pass ${pass}.`, {
          distances: shown(),
          pass,
        }, new Set(Object.keys(distances).filter((id) => Number.isFinite(distances[id]))), edge.to, edge.edgeId);
      }
    }
    if (!changed) {
      addStep(graph, steps, `Pass ${pass} made no changes; shortest distances are final.`, {
        distances: shown(),
        pass,
      });
      break;
    }
  }
  const negativeCycle = edges.some((edge) =>
    Number.isFinite(distances[edge.from])
    && distances[edge.from] + edge.weight < distances[edge.to]);
  addStep(graph, steps, negativeCycle ? 'A reachable negative cycle exists.' : 'Bellman-Ford is complete.', {
    distances: shown(),
    negativeCycle,
  });
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
  addStep(graph, steps, 'Initialize the all-pairs distance matrix.', {
    order: ids,
    distances: shown(),
  });
  for (let middle = 0; middle < ids.length; middle += 1) {
    let updates = 0;
    for (let from = 0; from < ids.length; from += 1) {
      for (let to = 0; to < ids.length; to += 1) {
        const candidate = distances[from][middle] + distances[middle][to];
        if (candidate < distances[from][to]) {
          distances[from][to] = candidate;
          updates += 1;
        }
      }
    }
    addStep(graph, steps, `Allow ${ids[middle]} as an intermediate node.`, {
      middle: ids[middle],
      updates,
      order: ids,
      distances: shown(),
    }, new Set([ids[middle]]), ids[middle]);
  }
  addStep(graph, steps, 'Floyd-Warshall computed every reachable pair distance.', {
    order: ids,
    distances: shown(),
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
  addStep(graph, steps, 'Queue every node whose indegree is zero.', {
    indegree: { ...indegree },
    queue: [...queue],
    order,
  }, new Set(queue));
  while (queue.length > 0) {
    const current = queue.shift() as string;
    order.push(current);
    for (const edge of adj.get(current) ?? []) {
      indegree[edge.to] -= 1;
      if (indegree[edge.to] === 0) queue.push(edge.to);
    }
    addStep(graph, steps, `Remove ${current} and release its outgoing neighbors.`, {
      indegree: { ...indegree },
      queue: [...queue],
      order: [...order],
    }, new Set(order), current);
  }
  const hasCycle = order.length !== graph.nodes.length;
  addStep(graph, steps, hasCycle ? 'The graph contains a cycle; no topological order exists.' : 'Topological ordering is complete.', {
    order,
    hasCycle,
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
    for (const edge of adj.get(id) ?? []) if (!visited.has(edge.to)) first(edge.to);
    finish.push(id);
    addStep(graph, steps, `Finish ${id} in the first DFS.`, {
      finishOrder: [...finish],
    }, new Set(visited), id);
  };
  for (const node of graph.nodes) if (!visited.has(node.id)) first(node.id);
  const reverse = new Map(graph.nodes.map((node) => [node.id, [] as string[]]));
  for (const edge of graph.edges) reverse.get(edge.to)?.push(edge.from);
  visited.clear();
  const components: string[][] = [];
  const second = (id: string, component: string[]) => {
    visited.add(id);
    component.push(id);
    for (const next of reverse.get(id) ?? []) if (!visited.has(next)) second(next, component);
  };
  while (finish.length > 0) {
    const id = finish.pop() as string;
    if (visited.has(id)) continue;
    const component: string[] = [];
    second(id, component);
    components.push(component);
    addStep(graph, steps, `Collect strongly connected component ${components.length}.`, {
      components: components.map((value) => [...value]),
      finishOrder: [...finish],
    }, new Set(visited), id, undefined, new Set(component));
  }
  addStep(graph, steps, `Kosaraju found ${components.length} strongly connected components.`, {
    components,
  }, visited);
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
  let time = 0;
  const visit = (id: string) => {
    discovery[id] = time;
    low[id] = time;
    time += 1;
    stack.push(id);
    onStack.add(id);
    addStep(graph, steps, `Discover ${id} and push it onto Tarjan's stack.`, {
      discovery: { ...discovery },
      low: { ...low },
      stack: [...stack],
      components: components.map((value) => [...value]),
    }, new Set(Object.keys(discovery)), id);
    for (const edge of adj.get(id) ?? []) {
      if (discovery[edge.to] === undefined) {
        visit(edge.to);
        low[id] = Math.min(low[id], low[edge.to]);
      } else if (onStack.has(edge.to)) {
        low[id] = Math.min(low[id], discovery[edge.to]);
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
      addStep(graph, steps, `Pop strongly connected component ${components.length}.`, {
        discovery: { ...discovery },
        low: { ...low },
        stack: [...stack],
        components: components.map((value) => [...value]),
      }, new Set(Object.keys(discovery)), id, undefined, new Set(component));
    }
  };
  for (const node of graph.nodes) if (discovery[node.id] === undefined) visit(node.id);
  addStep(graph, steps, `Tarjan found ${components.length} strongly connected components.`, {
    components,
    discovery,
    low,
  });
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
  return { capacity, neighbors, flow, residual, augment, target: graph.targetId };
};

const edmondsKarp = (graph: GraphDocumentV1): SimulationStep[] => {
  const network = residualNetwork(graph);
  const steps: SimulationStep[] = [];
  let maxFlow = 0;
  addStep(graph, steps, 'Initialize every edge flow to zero.', { maxFlow });
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
      }
    }
    if (!seen.has(network.target)) break;
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
    addStep(graph, steps, `Augment the BFS path by ${amount}.`, {
      path,
      pathFlow: amount,
      maxFlow,
    }, seen, network.target, undefined, new Set(path));
  }
  addStep(graph, steps, `Edmonds-Karp maximum flow is ${maxFlow}.`, { maxFlow });
  return steps;
};

const dinic = (graph: GraphDocumentV1): SimulationStep[] => {
  const network = residualNetwork(graph);
  const steps: SimulationStep[] = [];
  let maxFlow = 0;
  addStep(graph, steps, 'Initialize Dinic residual capacities.', { maxFlow });
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
      level,
      maxFlow,
    }, new Set(Object.keys(level)));
    if (level[network.target] === undefined) break;
    const cursor: Record<string, number> = {};
    const send = (current: string, available: number, seen: Set<string>): number => {
      if (current === network.target) return available;
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
        const sent = send(next, Math.min(available, network.residual(current, next)), seen);
        if (sent > 0) {
          network.augment(current, next, sent);
          return sent;
        }
      }
      return 0;
    };
    while (true) {
      const sent = send(graph.startId, Number.POSITIVE_INFINITY, new Set([graph.startId]));
      if (sent === 0) break;
      maxFlow += sent;
      addStep(graph, steps, `Send ${sent} units through the level graph.`, {
        level,
        blockingFlow: sent,
        maxFlow,
      });
    }
  }
  addStep(graph, steps, `Dinic maximum flow is ${maxFlow}.`, { maxFlow });
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
  const pairLeft = new Map<string, string>();
  const pairRight = new Map<string, string>();
  addStep(graph, steps, 'Color the graph into left and right partitions.', {
    left,
    right: graph.nodes.map((node) => node.id).filter((id) => color[id] === 1),
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
    const search = (id: string, seen: Set<string>): boolean => {
      for (const edge of adj.get(id) ?? []) {
        if (seen.has(edge.to)) continue;
        seen.add(edge.to);
        const paired = pairRight.get(edge.to);
        if (
          !paired
          || (
            distance.get(paired) === (distance.get(id) ?? 0) + 1
            && search(paired, seen)
          )
        ) {
          pairLeft.set(id, edge.to);
          pairRight.set(edge.to, id);
          return true;
        }
      }
      return false;
    };
    let augmented = 0;
    for (const id of left) {
      if (!pairLeft.has(id) && search(id, new Set())) augmented += 1;
    }
    if (augmented === 0) break;
    phases += 1;
    const matchingEdges = new Set(graph.edges
      .filter((edge) => pairLeft.get(edge.from) === edge.to || pairLeft.get(edge.to) === edge.from)
      .map((edge) => edge.id));
    addStep(graph, steps, `Complete Hopcroft-Karp phase ${phases}.`, {
      phases,
      augmented,
      matching: Object.fromEntries(pairLeft),
      matchingSize: pairLeft.size,
    }, new Set([...pairLeft.keys(), ...pairRight.keys()]), undefined, undefined, new Set(), matchingEdges);
  }
  addStep(graph, steps, `Maximum bipartite matching size is ${pairLeft.size}.`, {
    matching: Object.fromEntries(pairLeft),
    matchingSize: pairLeft.size,
    phases,
  });
  return steps;
};

const graphColoring = (graph: GraphDocumentV1): SimulationStep[] => {
  requireUndirected(graph, 'Graph Coloring');
  if (graph.nodes.length > 12) throw new Error('Graph Coloring supports at most 12 nodes in the visualizer.');
  const steps: SimulationStep[] = [];
  const adj = adjacency(graph);
  const colors: Record<string, number> = {};
  addStep(graph, steps, 'Start with every node uncolored.', { colors });
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
  const search = (position: number, colorLimit: number): boolean => {
    if (position === ids.length) return true;
    const current = ids[position];
    for (let color = 1; color <= colorLimit; color += 1) {
      const safe = (adj.get(current) ?? []).every((edge) => colors[edge.to] !== color);
      if (!safe) continue;
      colors[current] = color;
      addStep(graph, steps, `Assign color ${color} to ${current}.`, {
        colors: { ...colors },
        colorLimit,
      }, new Set(Object.keys(colors)), current);
      if (search(position + 1, colorLimit)) return true;
      delete colors[current];
      addStep(graph, steps, `Remove color ${color} from ${current} and backtrack.`, {
        colors: { ...colors },
        colorLimit,
      }, new Set(Object.keys(colors)), current);
    }
    return false;
  };
  search(0, colorCount);
  addStep(graph, steps, `Colored the graph with ${colorCount} colors.`, {
    colors,
    colorCount,
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
    stack: [...stack],
    path,
  }, new Set(), graph.startId);
  while (stack.length > 0) {
    const current = stack.at(-1) as string;
    const edge = (adj.get(current) ?? []).find((candidate) => !used.has(candidate.edgeId));
    if (edge) {
      used.add(edge.edgeId);
      stack.push(edge.to);
      addStep(graph, steps, `Consume edge ${edge.from} → ${edge.to}.`, {
        stack: [...stack],
        path: [...path],
        usedEdges: [...used],
      }, new Set(path), edge.to, edge.edgeId, new Set(), used);
    } else {
      path.unshift(stack.pop() as string);
      addStep(graph, steps, `Prepend ${current} while backtracking.`, {
        stack: [...stack],
        path: [...path],
        usedEdges: [...used],
      }, new Set(path), current, undefined, new Set(path), used);
    }
  }
  const valid = used.size === graph.edges.length;
  addStep(graph, steps, valid ? 'The Eulerian path/circuit uses every edge once.' : 'No Eulerian path from the selected start uses every edge.', {
    path,
    valid,
    usedEdgeCount: used.size,
  }, new Set(path), undefined, undefined, new Set(path), used);
  return steps;
};

const hamiltonianCycle = (graph: GraphDocumentV1): SimulationStep[] => {
  if (graph.nodes.length > 12) throw new Error('Hamiltonian Cycle supports at most 12 nodes in the visualizer.');
  const steps: SimulationStep[] = [];
  const adj = adjacency(graph);
  const path = [graph.startId];
  const used = new Set(path);
  addStep(graph, steps, `Start the Hamiltonian path at ${graph.startId}.`, {
    path: [...path],
  }, used, graph.startId);
  const search = (): boolean => {
    if (path.length === graph.nodes.length) {
      return (adj.get(path.at(-1) as string) ?? []).some((edge) => edge.to === path[0]);
    }
    const current = path.at(-1) as string;
    for (const edge of adj.get(current) ?? []) {
      if (used.has(edge.to)) continue;
      path.push(edge.to);
      used.add(edge.to);
      addStep(graph, steps, `Try ${edge.to} as the next cycle node.`, {
        path: [...path],
      }, used, edge.to, edge.edgeId, new Set(path));
      if (search()) return true;
      used.delete(edge.to);
      path.pop();
      addStep(graph, steps, `Backtrack from ${edge.to}.`, {
        path: [...path],
      }, used, current, edge.edgeId, new Set(path));
    }
    return false;
  };
  const found = search();
  const cycle = found ? [...path, path[0]] : [];
  addStep(graph, steps, found ? 'A Hamiltonian cycle was found.' : 'No Hamiltonian cycle exists.', {
    found,
    cycle,
  }, new Set(path), undefined, undefined, new Set(cycle));
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
  const visit = (id: string, parent?: string) => {
    discovery[id] = time;
    low[id] = time;
    time += 1;
    let children = 0;
    for (const edge of adj.get(id) ?? []) {
      if (edge.to === parent) continue;
      if (discovery[edge.to] === undefined) {
        children += 1;
        visit(edge.to, id);
        low[id] = Math.min(low[id], low[edge.to]);
        if (parent !== undefined && low[edge.to] >= discovery[id]) points.add(id);
        if (low[edge.to] > discovery[id]) bridges.add(edge.edgeId);
      } else {
        low[id] = Math.min(low[id], discovery[edge.to]);
      }
    }
    if (parent === undefined && children > 1) points.add(id);
    addStep(graph, steps, `Finish low-link processing for ${id}.`, {
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
  addStep(graph, steps, 'Bellman-Ford computes the vertex potentials.', { potential });
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
      source,
      potential,
      allPairs: { ...allPairs },
    }, done, source);
  }
  addStep(graph, steps, 'Johnson computed all-pairs shortest paths.', {
    potential,
    allPairs,
  });
  return steps;
};

const treeTraversal = (
  graph: GraphDocumentV1,
  order: 'inorder' | 'preorder' | 'postorder',
): SimulationStep[] => {
  if (graph.mode !== 'tree') throw new Error('Tree traversal requires a tree input.');
  const steps: SimulationStep[] = [];
  const children = adjacency(graph);
  const visited = new Set<string>();
  const result: string[] = [];
  const visit = (id: string) => {
    const next = (children.get(id) ?? []).map((edge) => edge.to);
    const left = next[0];
    const right = next[1];
    if (order === 'preorder') result.push(id);
    if (left) visit(left);
    if (order === 'inorder') result.push(id);
    if (right) visit(right);
    if (order === 'postorder') result.push(id);
    visited.add(id);
    addStep(graph, steps, `Visit ${id} in ${order} order.`, {
      traversal: [...result],
      order,
    }, new Set(visited), id, undefined, new Set(result));
  };
  addStep(graph, steps, `Start ${order} traversal at ${graph.rootId ?? graph.startId}.`, {
    traversal: [],
    order,
  });
  visit(graph.rootId ?? graph.startId);
  addStep(graph, steps, `${order} traversal is complete.`, {
    traversal: result,
    order,
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
    first: graph.startId,
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
      parent: Object.fromEntries(parent),
      queue: [...queue],
    }, new Set(seen), current);
  }
  const ancestors = new Set<string>();
  let current: string | undefined = graph.startId;
  while (current) {
    ancestors.add(current);
    current = parent.get(current);
  }
  const secondPath: string[] = [];
  current = graph.targetId;
  while (current && !ancestors.has(current)) {
    secondPath.push(current);
    current = parent.get(current);
  }
  const lca = current ?? root;
  addStep(graph, steps, `The lowest common ancestor is ${lca}.`, {
    first: graph.startId,
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
