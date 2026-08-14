import type {
  AlgorithmDesignV1,
  GraphLayoutSpecV1,
  SemanticEdgeRoleV1,
  SemanticNodeRoleV1,
  VisualizationContract,
  VisualizationContractV2,
} from '../types/titan';
import type { SimulationInput } from '../types/simulation';

const nodeStyle = (
  stroke: string,
  fill: string,
  shape: SemanticNodeRoleV1['style']['shape'] = 'circle',
  glow = 0.55,
  pulse: SemanticNodeRoleV1['style']['pulse'] = 'steady',
): SemanticNodeRoleV1['style'] => ({ shape, size: shape === 'star' ? 52 : 44, stroke, fill, glow, pulse });

const edgeStyle = (
  color: string,
  width: number,
  opacity: number,
  animation: SemanticEdgeRoleV1['style']['animation'],
): SemanticEdgeRoleV1['style'] => ({ color, width, opacity, animation });

export const createVisualizationContractV2 = (
  design: AlgorithmDesignV1,
  input: SimulationInput,
  layout: GraphLayoutSpecV1,
): VisualizationContractV2 => {
  const bidirectional = /bidirectional|[iİ]ki y[oö]nl[uü]|[cç]ift y[oö]nl[uü]/i.test(design.title);
  const designText = [design.title, design.purpose, ...design.dataStructures].join(' ').toLocaleLowerCase('en-US');
  const shortestPath = /shortest|dijkstra|a\*|a-star|en k[ıi]sa/.test(designText);
  const spanningTree = /spanning|kruskal|prim|mst|kapsayan a[gğ]a[cç]/.test(designText);
  const networkFlow = /flow|ak[ıi][sş]|residual|augment/.test(designText);
  const dependencyOrder = /topological|indegree|dependency|ba[gğ][ıi]ml[ıi]l[ıi]k/.test(designText);
  const graphType = Boolean(input.graph) || design.inputKind === 'graph' || design.inputKind === 'tree';
  const requestedVisual = design.visualization;
  const visualType = graphType ? 'graph' : requestedVisual?.type
    ?? (design.inputKind === 'array' ? 'array' : 'variables');
  const nodeRoles: SemanticNodeRoleV1[] = graphType ? [
    { id: 'start', label: 'Start', source: { kind: 'input-start' }, priority: 70, style: nodeStyle('#00f3ff', 'rgba(0,243,255,.18)', 'circle', 0.9, 'outward') },
    { id: 'target', label: 'Target', source: { kind: 'input-target' }, priority: 70, style: nodeStyle('#ff35d3', 'rgba(255,0,255,.18)', 'diamond', 0.9, 'inward') },
    { id: 'queued', label: 'Queued', source: { kind: 'collection', variable: 'frontier' }, priority: 20, style: nodeStyle('#ffb000', 'rgba(255,176,0,.10)') },
    { id: 'visited', label: 'Visited', source: { kind: 'collection', variable: 'visited' }, priority: 30, style: nodeStyle('#7ee7ff', 'rgba(0,243,255,.20)') },
    { id: 'path', label: 'Result path', source: { kind: 'collection', variable: 'path' }, priority: 90, style: nodeStyle('#77ff43', 'rgba(57,255,20,.24)', 'rounded', 1, 'steady') },
  ] : [];
  const edgeRoles: SemanticEdgeRoleV1[] = graphType ? [
    { id: 'path', label: 'Result path', source: { kind: 'path', variable: 'path' }, priority: 100, style: edgeStyle('#77ff43', 5, 1, 'pulse') },
  ] : [];

  if (bidirectional) {
    nodeRoles.push(
      { id: 'frontier-start', label: 'Start frontier', source: { kind: 'collection', variable: 'frontierStart' }, priority: 45, style: nodeStyle('#00f3ff', 'rgba(0,243,255,.16)', 'circle', 0.75, 'outward') },
      { id: 'frontier-target', label: 'Target frontier', source: { kind: 'collection', variable: 'frontierTarget' }, priority: 45, style: nodeStyle('#ff35d3', 'rgba(255,0,255,.16)', 'diamond', 0.75, 'inward') },
      { id: 'visited-start', label: 'Visited from start', source: { kind: 'collection', variable: 'visitedStart' }, priority: 35, style: nodeStyle('#00c9ff', 'rgba(0,201,255,.20)') },
      { id: 'visited-target', label: 'Visited from target', source: { kind: 'collection', variable: 'visitedTarget' }, priority: 35, style: nodeStyle('#ff35d3', 'rgba(255,53,211,.20)', 'diamond') },
      { id: 'visited-both', label: 'Visited by both', source: { kind: 'intersection', variables: ['visitedStart', 'visitedTarget'] }, priority: 75, style: nodeStyle('#d8ff45', 'linear-gradient(135deg, rgba(0,243,255,.38) 0 50%, rgba(255,53,211,.38) 50% 100%)', 'hexagon', 0.95) },
      { id: 'meeting', label: 'Meeting', source: { kind: 'variable', variable: 'meeting' }, priority: 110, style: nodeStyle('#baff37', 'rgba(186,255,55,.28)', 'star', 1, 'outward') },
    );
    edgeRoles.push(
      { id: 'inspect-start', label: 'Inspect from start', source: { kind: 'active-variables', fromVariable: 'currentStart', toVariable: 'neighbor' }, priority: 70, style: edgeStyle('#00f3ff', 3.5, 1, 'flow') },
      { id: 'inspect-target', label: 'Inspect from target', source: { kind: 'active-variables', fromVariable: 'currentTarget', toVariable: 'neighborFromTarget' }, priority: 70, style: edgeStyle('#ff35d3', 3.5, 1, 'flow') },
      { id: 'tree-start', label: 'Start search tree', source: { kind: 'parent-map', variable: 'parentFromStart' }, priority: 40, style: edgeStyle('#00c9ff', 2.5, 0.72, 'none') },
      { id: 'tree-target', label: 'Target search tree', source: { kind: 'parent-map', variable: 'parentFromTarget' }, priority: 40, style: edgeStyle('#ff35d3', 2.5, 0.72, 'none') },
    );
  } else if (shortestPath) {
    nodeRoles.push(
      { id: 'candidate', label: 'Distance candidate', source: { kind: 'collection', variable: 'frontier' }, priority: 45, style: nodeStyle('#ffd65a', 'rgba(255,214,90,.16)', 'hexagon', 0.75, 'outward') },
      { id: 'settled', label: 'Final distance', source: { kind: 'collection', variable: 'settled' }, priority: 60, style: nodeStyle('#59f5c7', 'rgba(89,245,199,.20)', 'rounded', 0.8) },
    );
    edgeRoles.push(
      { id: 'relax', label: 'Relaxing edge', source: { kind: 'active-variables', fromVariable: 'current', toVariable: 'neighbor' }, priority: 75, style: edgeStyle('#ffd65a', 3.5, 1, 'flow') },
      { id: 'shortest-tree', label: 'Shortest-path tree', source: { kind: 'parent-map', variable: 'parent' }, priority: 45, style: edgeStyle('#59f5c7', 2.7, 0.82, 'none') },
    );
  } else if (spanningTree) {
    nodeRoles.push(
      { id: 'component', label: 'Current component', source: { kind: 'collection', variable: 'component' }, priority: 55, style: nodeStyle('#a98cff', 'rgba(169,140,255,.20)', 'hexagon', 0.8) },
    );
    edgeRoles.push(
      { id: 'candidate-edge', label: 'Candidate edge', source: { kind: 'active-variables', fromVariable: 'from', toVariable: 'to' }, priority: 65, style: edgeStyle('#ffd65a', 3.2, 1, 'flow') },
      { id: 'tree-edge', label: 'Accepted tree edge', source: { kind: 'parent-map', variable: 'parent' }, priority: 85, style: edgeStyle('#77ff43', 4.2, 1, 'pulse') },
    );
  } else if (networkFlow) {
    nodeRoles.push(
      { id: 'augment-frontier', label: 'Augmenting frontier', source: { kind: 'collection', variable: 'queue' }, priority: 55, style: nodeStyle('#ff9e43', 'rgba(255,158,67,.18)', 'diamond', 0.85, 'outward') },
    );
    edgeRoles.push(
      { id: 'residual-edge', label: 'Residual capacity', source: { kind: 'active-variables', fromVariable: 'current', toVariable: 'neighbor' }, priority: 70, style: edgeStyle('#ff9e43', 3.5, 1, 'flow') },
      { id: 'augmenting-path', label: 'Augmenting path', source: { kind: 'path', variable: 'path' }, priority: 95, style: edgeStyle('#77ff43', 5, 1, 'pulse') },
    );
  } else if (dependencyOrder) {
    nodeRoles.push(
      { id: 'ready', label: 'Zero indegree', source: { kind: 'collection', variable: 'queue' }, priority: 60, style: nodeStyle('#ffd65a', 'rgba(255,214,90,.18)', 'star', 0.85, 'outward') },
      { id: 'ordered', label: 'Committed order', source: { kind: 'collection', variable: 'order' }, priority: 80, style: nodeStyle('#77ff43', 'rgba(119,255,67,.22)', 'rounded', 0.9) },
    );
  }

  return {
    version: 2,
    type: visualType,
    activeVariables: bidirectional ? ['currentStart', 'currentTarget'] : ['current', 'node', 'i', 'j'],
    queuedVariables: bidirectional ? ['frontierStart', 'frontierTarget'] : ['queue', 'frontier'],
    visitedVariables: bidirectional ? ['visitedStart', 'visitedTarget'] : ['visited'],
    pathVariable: 'path',
    activeEdges: bidirectional ? [
      { fromVariable: 'currentStart', toVariable: 'neighbor' },
      { fromVariable: 'currentTarget', toVariable: 'neighborFromTarget' },
    ] : undefined,
    traversedEdgeMapVariables: bidirectional ? ['parentFromStart', 'parentFromTarget'] : undefined,
    matrix: visualType === 'matrix' ? requestedVisual?.matrix : undefined,
    stringMatch: visualType === 'string-match' ? requestedVisual?.stringMatch : undefined,
    bars: visualType === 'bars' ? requestedVisual?.bars : undefined,
    intervals: visualType === 'intervals' ? requestedVisual?.intervals : undefined,
    rows: visualType === 'rows' ? requestedVisual?.rows : undefined,
    nodeRoles,
    edgeRoles,
    frontierLayers: bidirectional ? [
      { id: 'start', label: 'Start frontier', variable: 'frontierStart', color: '#00f3ff' },
      { id: 'target', label: 'Target frontier', variable: 'frontierTarget', color: '#ff35d3' },
    ] : [],
    layout,
    legend: nodeRoles.filter((role) => [
      'start', 'target', 'frontier-start', 'frontier-target', 'meeting', 'path',
      'candidate', 'settled', 'component', 'augment-frontier', 'ready', 'ordered',
    ].includes(role.id))
      .map((role) => ({ role: role.id, label: role.label, color: role.style.stroke, shape: role.style.shape })),
    resultHighlights: ['path', 'meeting'],
    responsive: { compactLegend: true, hideEdgeLabelsBelow: 480 },
    editable: { layout: true, nodeStyles: true, graphStructure: true },
  };
};

export const validateVisualizationContractV2 = (contract: VisualizationContractV2): string[] => {
  const issues: string[] = [];
  const nodeRoleIds = contract.nodeRoles.map((role) => role.id);
  const edgeRoleIds = contract.edgeRoles.map((role) => role.id);
  if (new Set(nodeRoleIds).size !== nodeRoleIds.length) issues.push('Semantic node role IDs must be unique.');
  if (new Set(edgeRoleIds).size !== edgeRoleIds.length) issues.push('Semantic edge role IDs must be unique.');
  for (const role of contract.nodeRoles) {
    if (!role.id.trim() || !role.label.trim()) issues.push('Node roles require stable IDs and labels.');
    if (role.style.size < 28 || role.style.size > 80) issues.push(`Node role ${role.id} has an unsafe size.`);
    if (!role.style.stroke.trim() || !role.style.fill.trim()) issues.push(`Node role ${role.id} has incomplete visual styling.`);
    if (role.priority < 0 || role.priority > 200) issues.push(`Node role ${role.id} has an invalid priority.`);
  }
  for (const role of contract.edgeRoles) {
    if (!role.id.trim() || !role.label.trim()) issues.push('Edge roles require stable IDs and labels.');
    if (role.style.width < 1 || role.style.width > 10 || role.style.opacity <= 0 || role.style.opacity > 1) {
      issues.push(`Edge role ${role.id} has unsafe visual bounds.`);
    }
  }
  const knownNodeRoles = new Set(contract.nodeRoles.map((role) => role.id));
  for (const legend of contract.legend) {
    if (!knownNodeRoles.has(legend.role)) issues.push(`Legend references unknown node role ${legend.role}.`);
    if (!legend.label.trim() || !legend.color.trim()) issues.push(`Legend role ${legend.role} is incomplete.`);
  }
  if (contract.layout.minimumNodeDistance < 4) issues.push('Layout minimum node distance is too small.');
  if (contract.responsive.hideEdgeLabelsBelow < 240) issues.push('Responsive edge-label threshold is unsafe.');
  return issues;
};

export const isVisualizationV2 = (
  contract: VisualizationContract,
): contract is VisualizationContractV2 => contract.version === 2;
