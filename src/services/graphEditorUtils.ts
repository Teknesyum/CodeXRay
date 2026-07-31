import type { GraphNode } from '../types/simulation';

export const nextNodeId = (nodes: GraphNode[]): string => {
  const ids = new Set(nodes.map((node) => node.id));
  let candidate = 1;
  while (ids.has(String(candidate))) candidate += 1;
  return String(candidate);
};
