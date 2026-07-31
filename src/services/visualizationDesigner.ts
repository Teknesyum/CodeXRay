import type {
  AlgorithmDesignV1,
  GraphLayoutSpecV1,
  SemanticEdgeRoleV1,
  SemanticNodeRoleV1,
  VisualizationContract,
  VisualizationContractV2,
} from '../types/godMode';
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
  const graphType = Boolean(input.graph) || design.inputKind === 'graph' || design.inputKind === 'tree';
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
  }

  return {
    version: 2,
    type: graphType ? 'graph' : design.inputKind === 'array' ? 'array' : 'variables',
    activeVariables: bidirectional ? ['currentStart', 'currentTarget'] : ['current', 'node', 'i', 'j'],
    queuedVariables: bidirectional ? ['frontierStart', 'frontierTarget'] : ['queue', 'frontier'],
    visitedVariables: bidirectional ? ['visitedStart', 'visitedTarget'] : ['visited'],
    pathVariable: 'path',
    activeEdges: bidirectional ? [
      { fromVariable: 'currentStart', toVariable: 'neighbor' },
      { fromVariable: 'currentTarget', toVariable: 'neighborFromTarget' },
    ] : undefined,
    traversedEdgeMapVariables: bidirectional ? ['parentFromStart', 'parentFromTarget'] : undefined,
    nodeRoles,
    edgeRoles,
    frontierLayers: bidirectional ? [
      { id: 'start', label: 'Start frontier', variable: 'frontierStart', color: '#00f3ff' },
      { id: 'target', label: 'Target frontier', variable: 'frontierTarget', color: '#ff35d3' },
    ] : [],
    layout,
    legend: nodeRoles.filter((role) => ['start', 'target', 'frontier-start', 'frontier-target', 'meeting', 'path'].includes(role.id))
      .map((role) => ({ role: role.id, label: role.label, color: role.style.stroke, shape: role.style.shape })),
    resultHighlights: ['path', 'meeting'],
    responsive: { compactLegend: true, hideEdgeLabelsBelow: 480 },
    editable: { layout: true, nodeStyles: true, graphStructure: true },
  };
};

export const isVisualizationV2 = (
  contract: VisualizationContract,
): contract is VisualizationContractV2 => contract.version === 2;
