import type { GraphNode } from '../types/simulation';

export const nextNodeId = (nodes: GraphNode[]): string => {
  const ids = new Set(nodes.map((node) => node.id));
  const allNumeric = nodes.every((node) => /^[1-9]\d*$/.test(node.id));
  const prefix = allNumeric ? '' : 'n';
  let candidate = 1;
  while (ids.has(`${prefix}${candidate}`)) candidate += 1;
  return `${prefix}${candidate}`;
};

