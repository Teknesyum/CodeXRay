import type { GraphDocumentV1, GraphNode } from '../types/simulation';
import type { GraphLayoutSpecV1, GraphLayoutStrategy } from '../types/titan';

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

const adjacencyFor = (graph: GraphDocumentV1): Map<string, string[]> => {
  const adjacency = new Map(graph.nodes.map((node) => [node.id, [] as string[]]));
  graph.edges.forEach((edge) => {
    adjacency.get(edge.from)?.push(edge.to);
    if (!graph.directed) adjacency.get(edge.to)?.push(edge.from);
  });
  adjacency.forEach((neighbors) => neighbors.sort((left, right) => left.localeCompare(right)));
  return adjacency;
};

const breadthLayers = (graph: GraphDocumentV1, startId: string): string[][] => {
  const adjacency = adjacencyFor(graph);
  const visited = new Set<string>([startId]);
  const layers: string[][] = [[startId]];
  while (layers.at(-1)?.length) {
    const next = [...new Set(layers.at(-1)?.flatMap((id) => adjacency.get(id) ?? []) ?? [])]
      .filter((id) => !visited.has(id));
    if (!next.length) break;
    next.forEach((id) => visited.add(id));
    layers.push(next);
  }
  const disconnected = graph.nodes.map((node) => node.id).filter((id) => !visited.has(id));
  if (disconnected.length) layers.push(disconnected);
  return layers;
};

const chooseStrategy = (graph: GraphDocumentV1, algorithmName = ''): GraphLayoutStrategy => {
  if (graph.mode === 'tree') return 'tree';
  if (/bidirectional|[iİ]ki y[oö]nl[uü]|[cç]ift y[oö]nl[uü]/i.test(algorithmName)
    && graph.targetId) return 'dual-frontier';
  if (graph.directed) return 'layered';
  if (graph.nodes.length <= 9 && graph.edges.length >= graph.nodes.length) return 'radial';
  return 'force-directed';
};

export const createGraphLayoutSpec = (
  graph: GraphDocumentV1,
  algorithmName = '',
  userPositions: Record<string, { x: number; y: number }> = {},
): GraphLayoutSpecV1 => {
  const strategy = chooseStrategy(graph, algorithmName);
  const layers = breadthLayers(graph, graph.rootId ?? graph.startId);
  return {
    version: 1,
    strategy,
    groups: layers.map((nodeIds, layer) => ({ id: `layer-${layer}`, nodeIds, layer })),
    layers,
    pinnedNodeIds: Object.keys(userPositions),
    minimumNodeDistance: graph.nodes.length > 12 ? 8 : 11,
    axis: graph.targetId ? { startId: graph.startId, targetId: graph.targetId } : undefined,
    collisionResolution: strategy === 'radial' ? 'radial-jitter' : 'spread',
    userPositions,
    responsive: {
      narrowStrategy: strategy === 'dual-frontier' ? 'layered' : strategy,
      mobileScale: 0.82,
      minimumNodeDistance: graph.nodes.length > 12 ? 6 : 8,
    },
  };
};

const layeredPositions = (layers: string[][]): Map<string, { x: number; y: number }> => {
  const positions = new Map<string, { x: number; y: number }>();
  const lastLayer = Math.max(1, layers.length - 1);
  layers.forEach((ids, layer) => {
    ids.forEach((id, index) => positions.set(id, {
      x: 10 + (80 * layer) / lastLayer,
      y: ids.length === 1 ? 50 : 12 + (76 * index) / (ids.length - 1),
    }));
  });
  return positions;
};

const radialPositions = (nodes: GraphNode[]): Map<string, { x: number; y: number }> => {
  const positions = new Map<string, { x: number; y: number }>();
  nodes.forEach((node, index) => {
    const angle = (-Math.PI / 2) + (index * Math.PI * 2) / Math.max(nodes.length, 1);
    positions.set(node.id, { x: 50 + Math.cos(angle) * 38, y: 50 + Math.sin(angle) * 38 });
  });
  return positions;
};

const resolveCollisions = (
  nodes: GraphNode[],
  minimumDistance: number,
  pinned: Set<string>,
): GraphNode[] => {
  const next = nodes.map((node) => ({ ...node }));
  for (let pass = 0; pass < 16; pass += 1) {
    let moved = false;
    for (let left = 0; left < next.length; left += 1) {
      for (let right = left + 1; right < next.length; right += 1) {
        const a = next[left];
        const b = next[right];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distance = Math.hypot(dx, dy);
        if (distance >= minimumDistance) continue;
        const angle = distance > 0 ? Math.atan2(dy, dx) : ((left + right + pass) * 1.618) % (Math.PI * 2);
        const shift = (minimumDistance - distance) / 2 + 0.15;
        if (!pinned.has(a.id)) {
          a.x = clamp(a.x - Math.cos(angle) * shift, 6, 94);
          a.y = clamp(a.y - Math.sin(angle) * shift, 8, 92);
        }
        if (!pinned.has(b.id)) {
          b.x = clamp(b.x + Math.cos(angle) * shift, 6, 94);
          b.y = clamp(b.y + Math.sin(angle) * shift, 8, 92);
        }
        moved = true;
      }
    }
    if (!moved) break;
  }
  return next;
};

export const applyGraphLayout = (
  graph: GraphDocumentV1,
  spec: GraphLayoutSpecV1,
): GraphDocumentV1 => {
  const automatic = spec.strategy === 'radial' || spec.strategy === 'force-directed'
    ? radialPositions(graph.nodes)
    : layeredPositions(spec.layers);
  const positioned = graph.nodes.map((node) => ({
    ...node,
    ...(automatic.get(node.id) ?? { x: node.x, y: node.y }),
    ...(spec.userPositions[node.id] ?? {}),
  }));
  const nodes = resolveCollisions(positioned, spec.minimumNodeDistance, new Set(spec.pinnedNodeIds));
  return { ...graph, nodes };
};

export interface GraphLayoutQuality {
  valid: boolean;
  overlaps: Array<[string, string]>;
  outOfBounds: string[];
  missingEdgeEndpoints: string[];
}

export const inspectGraphLayout = (
  graph: GraphDocumentV1,
  minimumDistance = 5,
): GraphLayoutQuality => {
  const overlaps: Array<[string, string]> = [];
  graph.nodes.forEach((node, index) => graph.nodes.slice(index + 1).forEach((other) => {
    if (Math.hypot(node.x - other.x, node.y - other.y) < minimumDistance) {
      overlaps.push([node.id, other.id]);
    }
  }));
  const ids = new Set(graph.nodes.map((node) => node.id));
  const outOfBounds = graph.nodes
    .filter((node) => node.x < 0 || node.x > 100 || node.y < 0 || node.y > 100)
    .map((node) => node.id);
  const missingEdgeEndpoints = graph.edges
    .filter((edge) => !ids.has(edge.from) || !ids.has(edge.to))
    .map((edge) => edge.id);
  return {
    valid: overlaps.length === 0 && outOfBounds.length === 0 && missingEdgeEndpoints.length === 0,
    overlaps,
    outOfBounds,
    missingEdgeEndpoints,
  };
};
