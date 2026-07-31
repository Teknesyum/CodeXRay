import type { GraphDocumentV1 } from '../types/simulation';
import { nextNodeId } from './graphEditorUtils';

export const isVisualOnlyGraphRequest = (request: string): boolean =>
  /(?:node|d[uü][gğ][uü]m).*(?:geni[sş]|yay|spread|spacing|ara|yerle[sş])|(?:cephe|frontier).*(?:renk|color|[sş]ekil|shape)|(?:layout|yerle[sş]im).*(?:de[gğ]i[sş]|change|d[uü]zen|arrange)|(?:de[gğ]i[sş]|change|d[uü]zen|arrange).*(?:layout|yerle[sş]im)/i.test(request)
  && !/(?:ekle|sil|yeniden adland[ıi]r|hedefi de[gğ]i[sş]|add|remove|rename|change target)/i.test(request);

export const spreadGraphLayout = (graph: GraphDocumentV1, factor = 1.24): GraphDocumentV1 => ({
  ...graph,
  nodes: graph.nodes.map((node) => ({
    ...node,
    x: Math.min(95, Math.max(5, 50 + (node.x - 50) * factor)),
    y: Math.min(93, Math.max(7, 50 + (node.y - 50) * factor)),
  })),
});

const requestedNodeCount = (request: string): number => {
  const normalized = request.toLocaleLowerCase('tr-TR');
  const digit = normalized.match(/(\d+)\s*(?:node|d[uü][gğ][uü]m)/)?.[1];
  if (digit) return Math.min(5, Math.max(0, Number(digit)));
  if (/(?:iki|two)\s+(?:node|d[uü][gğ][uü]m)/.test(normalized)) return 2;
  if (/(?:[uü][cç]|three)\s+(?:node|d[uü][gğ][uü]m)/.test(normalized)) return 3;
  if (/(?:bir|one|a)\s+(?:node|d[uü][gğ][uü]m)/.test(normalized)) return 1;
  return 0;
};

export const applyStructuralGraphRequest = (
  graph: GraphDocumentV1,
  request: string,
): GraphDocumentV1 => {
  const count = requestedNodeCount(request);
  const next = {
    ...graph,
    nodes: graph.nodes.map((node) => ({ ...node })),
    edges: graph.edges.map((edge) => ({ ...edge })),
  };
  let anchor = graph.targetId ?? graph.nodes.at(-1)?.id ?? graph.startId;
  for (let index = 0; index < count; index += 1) {
    const id = nextNodeId(next.nodes);
    const x = Math.min(92, 68 + index * 12);
    const y = count === 1 ? 50 : 30 + (index * 40) / Math.max(1, count - 1);
    next.nodes.push({ id, label: id, x, y });
    next.edges.push({
      id: `request-${id}`,
      from: anchor,
      to: id,
      weight: next.weighted ? 1 : undefined,
    });
    anchor = id;
  }
  const explicitTarget = request.match(/(?:hedef(?:i)?|target)\s+(?:node(?:unu)?\s+)?([A-Za-z0-9_-]+)\s*(?:yap|olarak|set|make)/i)?.[1];
  if (explicitTarget && next.nodes.some((node) => node.id === explicitTarget)) {
    next.targetId = explicitTarget;
  } else if (count > 0 && /hedef|target/i.test(request)) {
    next.targetId = anchor;
  }
  return next;
};
