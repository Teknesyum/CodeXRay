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

const requestedNodeId = (request: string): string | null => {
  const beforeVerb = request.match(/(?:^|\s)([\p{L}\p{N}_-]+)\s+(?:node|d[uü][gğ][uü]m)(?:['’]?[\p{L}]+)?\s+(?:ekle|add)/iu)?.[1];
  const afterVerb = request.match(/(?:add|ekle)\s+(?:the\s+)?(?:node|d[uü][gğ][uü]m)\s+([\p{L}\p{N}_-]+)/iu)?.[1];
  const value = beforeVerb ?? afterVerb;
  return value && !/^(?:bir|iki|üç|uc|one|two|three|a|the|\d+)$/i.test(value) ? value : null;
};

const resolveRequestedNode = (
  graph: GraphDocumentV1,
  token: string,
): string | null => {
  if (/^(?:hedef|target)$/i.test(token)) return graph.targetId ?? null;
  if (/^(?:ba[sş]lang[ıi][cç]|start)$/i.test(token)) return graph.startId;
  const normalized = token.toLocaleLowerCase('tr-TR');
  return graph.nodes.find((node) =>
    node.id.toLocaleLowerCase('tr-TR') === normalized
    || node.label.toLocaleLowerCase('tr-TR') === normalized)?.id ?? null;
};

const requestedConnections = (request: string): Array<[string, string]> => {
  const pairs: Array<[string, string]> = [];
  const token = '[\\p{L}\\p{N}_-]+';
  const patterns = [
    new RegExp(`(?=(${token})\\s+ile\\s+(${token}))`, 'giu'),
    new RegExp(`(?=(?:connect\\s+)?(${token})\\s+(?:to|-)\\s+(${token}))`, 'giu'),
  ];
  for (const pattern of patterns) {
    for (const match of request.matchAll(pattern)) {
      if (match[1] && match[2]) pairs.push([match[1], match[2]]);
    }
  }
  return pairs;
};

export const applyStructuralGraphRequest = (
  graph: GraphDocumentV1,
  request: string,
): GraphDocumentV1 => {
  const count = requestedNodeCount(request);
  const namedNodeId = requestedNodeId(request);
  const next = {
    ...graph,
    nodes: graph.nodes.map((node) => ({ ...node })),
    edges: graph.edges.map((edge) => ({ ...edge })),
  };
  if (namedNodeId && !next.nodes.some((node) => node.id.toLocaleLowerCase('tr-TR') === namedNodeId.toLocaleLowerCase('tr-TR'))) {
    const target = next.nodes.find((node) => node.id === next.targetId);
    next.nodes.push({
      id: namedNodeId,
      label: namedNodeId,
      x: target ? Math.max(8, target.x - 14) : 68,
      y: target ? Math.min(92, target.y + 18) : 50,
    });
  }
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
  for (const [fromToken, toToken] of requestedConnections(request)) {
    const from = resolveRequestedNode(next, fromToken);
    const to = resolveRequestedNode(next, toToken);
    if (!from || !to || from === to) continue;
    const duplicate = next.edges.some((edge) =>
      (edge.from === from && edge.to === to)
      || (!next.directed && edge.from === to && edge.to === from));
    if (duplicate) continue;
    next.edges.push({
      id: `request-${from}-${to}`,
      from,
      to,
      weight: next.weighted ? 1 : undefined,
    });
  }
  const explicitTarget = request.match(/(?:hedef(?:i)?|target)\s+(?:node(?:unu)?\s+)?([A-Za-z0-9_-]+)\s*(?:yap|olarak|set|make)/i)?.[1];
  if (explicitTarget && next.nodes.some((node) => node.id === explicitTarget)) {
    next.targetId = explicitTarget;
  } else if (count > 0 && /hedef|target/i.test(request)) {
    next.targetId = anchor;
  }
  return next;
};
