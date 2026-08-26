import type { GraphDocumentV1, SimulationInput } from '../types/simulation';
import { nextNodeId } from './graphEditorUtils';
import { applyInputPatch, parseInputPatch, type InputPatchV1 } from './input/inputPatch';

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
  const digit = normalized.match(/(?:add|ekle)\s+(\d+)\s*(?:node|d[uü][gğ][uü]m)/)?.[1]
    ?? normalized.match(/(\d+)\s*(?:node|d[uü][gğ][uü]m)(?:['’]?\p{L}+)?\s+(?:ekle|add)/u)?.[1];
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

const requestedRemovalIds = (request: string): string[] => {
  const ids = new Set<string>();
  const token = '[\\p{L}\\p{N}_-]+';
  const patterns = [
    new RegExp(`(${token})(?:\\.)?\\s*(?:nolu\\s+)?(?:node|nod|d[uü][gğ][uü]m)(?:['’]?\\p{L}+)?\\s+(?:sil|kald[ıi]r|remove|delete)`, 'giu'),
    new RegExp(`(?:sil|kald[ıi]r|remove|delete)\\s+(?:the\\s+)?(?:node|nod|d[uü][gğ][uü]m)\\s+(${token})`, 'giu'),
  ];
  for (const pattern of patterns) {
    for (const match of request.matchAll(pattern)) if (match[1]) ids.add(match[1]);
  }
  return [...ids];
};

const requestedAnchorBelow = (request: string): string | null =>
  request.match(/([\p{L}\p{N}_-]+)(?:\.)?\s*(?:nolu\s+)?(?:node|nod|d[uü][gğ][uü]m)(?:['’]?\p{L}+)?\s+(?:alt[ıi]na|a[sş]a[gğ][ıi]s[ıi]na|below|under)/iu)?.[1]
  ?? request.match(/(?:alt[ıi]na|a[sş]a[gğ][ıi]s[ıi]na|below|under)\s+(?:bir\s+|a\s+)?(?:node|nod|d[uü][gğ][uü]m).*?([\p{L}\p{N}_-]+)/iu)?.[1]
  ?? null;

const requestsDoubleComplexity = (request: string): boolean =>
  /(?:2|iki|two)\s*(?:kat|x|times).*?(?:karma[sş][ıi]k|complex|buyuk|büyük|geni[sş])/iu.test(request)
  || /(?:twice|double).*?(?:complex|size|input|graph)/iu.test(request);

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
  const seen = new Set<string>();
  const token = '[\\p{L}\\p{N}_-]+';
  const patterns = [
    new RegExp(`(?=(?<![\\p{L}\\p{N}_-])(${token})\\s+ile\\s+(${token}))`, 'giu'),
    new RegExp(`(?=(?<![\\p{L}\\p{N}_-])connect\\s+(${token})\\s+(?:to|-)\\s+(${token}))`, 'giu'),
  ];
  for (const pattern of patterns) {
    for (const match of request.matchAll(pattern)) {
      if (match[1] && match[2]) {
        const key = `${match[1].toLocaleLowerCase('tr-TR')}\u0000${match[2].toLocaleLowerCase('tr-TR')}`;
        if (!seen.has(key)) {
          seen.add(key);
          pairs.push([match[1], match[2]]);
        }
      }
    }
  }
  return pairs;
};

export type StructuralGraphPatchResult =
  | { ok: true; patches: InputPatchV1[] }
  | { ok: false; reason: string };

export const createStructuralGraphPatches = (
  graph: GraphDocumentV1,
  request: string,
): StructuralGraphPatchResult => {
  const count = requestedNodeCount(request);
  const namedNodeId = requestedNodeId(request);
  const removalIds = requestedRemovalIds(request);
  const belowToken = requestedAnchorBelow(request);
  const patches: InputPatchV1[] = [];
  let planningInput: SimulationInput = {
    kind: graph.mode,
    text: '',
    graph,
    origin: 'user',
  };
  const contract = {
    version: 1 as const,
    kind: graph.mode,
    description: 'Deterministic graph request',
    constraints: [],
    value: planningInput,
    origin: 'user' as const,
  };
  const append = (raw: unknown): string | null => {
    const patch = parseInputPatch(raw);
    if (!patch) return 'The graph request produced an invalid typed operation.';
    const applied = applyInputPatch(planningInput, patch, contract);
    if (applied.ok === false) return applied.reason;
    patches.push(patch);
    planningInput = applied.input;
    return null;
  };

  for (const token of removalIds) {
    const currentGraph = planningInput.graph!;
    const id = resolveRequestedNode(currentGraph, token);
    if (!id) return { ok: false, reason: `Graph node ${token} does not exist.` };
    const incoming = currentGraph.edges.find((edge) => edge.to === id)?.from;
    const children = currentGraph.edges.filter((edge) => edge.from === id).map((edge) => edge.to);
    const removalFailure = append({ op: 'graph-remove', id });
    if (removalFailure) return { ok: false, reason: removalFailure };
    if (currentGraph.mode === 'tree' && incoming) {
      for (const child of children) {
        const edgeFailure = append({
          op: 'graph-add-edge',
          from: incoming,
          to: child,
          weight: currentGraph.weighted ? 1 : undefined,
        });
        if (edgeFailure) return { ok: false, reason: edgeFailure };
      }
    }
  }

  if (namedNodeId) {
    const currentGraph = planningInput.graph!;
    if (currentGraph.nodes.some((node) => node.id.toLocaleLowerCase('tr-TR') === namedNodeId.toLocaleLowerCase('tr-TR'))) {
      return { ok: false, reason: `Graph node ${namedNodeId} already exists.` };
    }
    const target = currentGraph.nodes.find((node) => node.id === currentGraph.targetId);
    const namedFailure = append({
      op: 'graph-add-node',
      id: namedNodeId,
      label: namedNodeId,
      x: target ? Math.max(8, target.x - 14) : 68,
      y: target ? Math.min(92, target.y + 18) : 50,
    });
    if (namedFailure) return { ok: false, reason: namedFailure };
  }

  let anchor = graph.targetId ?? graph.nodes.at(-1)?.id ?? graph.startId;
  const belowAnchor = belowToken ? resolveRequestedNode(planningInput.graph!, belowToken) : null;
  if (belowToken && !belowAnchor) return { ok: false, reason: `Graph node ${belowToken} does not exist.` };
  if (belowAnchor) anchor = belowAnchor;
  const doubledCount = requestsDoubleComplexity(request)
    ? Math.min(20, Math.max(0, planningInput.graph!.nodes.length))
    : 0;
  const totalToAdd = Math.max(count, belowAnchor && count === 0 ? 1 : 0, doubledCount);
  for (let index = 0; index < totalToAdd; index += 1) {
    const currentGraph = planningInput.graph!;
    const id = nextNodeId(currentGraph.nodes);
    const anchorNode = currentGraph.nodes.find((node) => node.id === anchor);
    const x = belowAnchor && index === 0 ? anchorNode?.x ?? 68 : Math.min(92, 68 + (index % 3) * 12);
    const y = belowAnchor && index === 0 ? Math.min(93, (anchorNode?.y ?? 50) + 18) : 24 + ((index * 17) % 62);
    const nodeFailure = append({ op: 'graph-add-node', id, label: id, x, y });
    if (nodeFailure) return { ok: false, reason: nodeFailure };
    const edgeFailure = append({
      op: 'graph-add-edge',
      from: anchor,
      to: id,
      weight: currentGraph.weighted ? 1 : undefined,
    });
    if (edgeFailure) return { ok: false, reason: edgeFailure };
    anchor = id;
  }

  for (const [fromToken, toToken] of requestedConnections(request)) {
    const currentGraph = planningInput.graph!;
    const from = resolveRequestedNode(currentGraph, fromToken);
    const to = resolveRequestedNode(currentGraph, toToken);
    if (!from || !to) {
      return {
        ok: false,
        reason: `Both requested edge endpoints must exist: ${fromToken}, ${toToken}; available: ${currentGraph.nodes.map((node) => node.id).join(', ')}.`,
      };
    }
    if (from === to) return { ok: false, reason: 'A graph edge cannot connect a node to itself.' };
    const edgeFailure = append({
      op: 'graph-add-edge',
      from,
      to,
      weight: currentGraph.weighted ? 1 : undefined,
    });
    if (edgeFailure) return { ok: false, reason: edgeFailure };
  }

  const explicitTarget = request.match(/(?:hedef(?:i)?|target)\s+(?:node(?:unu)?\s+)?([A-Za-z0-9_-]+)\s*(?:yap|olarak|set|make)/i)?.[1];
  if (explicitTarget) {
    const targetFailure = append({ op: 'set-target', nodeId: explicitTarget });
    if (targetFailure) return { ok: false, reason: targetFailure };
  } else if (totalToAdd > 0 && /hedef|target/i.test(request)) {
    const targetFailure = append({ op: 'set-target', nodeId: anchor });
    if (targetFailure) return { ok: false, reason: targetFailure };
  }
  return { ok: true, patches };
};
