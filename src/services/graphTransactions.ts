import type { CustomSimulationPackageV1 } from '../types/titan';
import type { GraphDocumentV1, SimulationStep } from '../types/simulation';
import { createGraphLayoutSpec } from './graphLayout';
import { isVisualizationV2 } from './visualizationDesigner';

const structuralSignature = (graph: GraphDocumentV1): string => JSON.stringify({
  version: graph.version,
  mode: graph.mode,
  directed: graph.directed,
  weighted: graph.weighted,
  nodeIds: graph.nodes.map((node) => node.id),
  edges: graph.edges.map((edge) => ({
    id: edge.id,
    from: edge.from,
    to: edge.to,
    weight: edge.weight,
  })),
  rootId: graph.rootId,
  startId: graph.startId,
  targetId: graph.targetId,
});

export const classifyGraphChange = (
  previous: GraphDocumentV1,
  next: GraphDocumentV1,
): 'layout' | 'structural' =>
  structuralSignature(previous) === structuralSignature(next) ? 'layout' : 'structural';

export const patchGraphLayoutInSteps = (
  steps: SimulationStep[],
  graph: GraphDocumentV1,
): SimulationStep[] => {
  const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
  return steps.map((step) => step.visualData.type !== 'graph' ? step : ({
    ...step,
    visualData: {
      ...step.visualData,
      nodes: step.visualData.nodes.map((node) => ({
        ...node,
        ...(nodes.get(node.id) ?? {}),
      })),
    },
  }));
};

export const patchPackageGraphLayout = (
  packageValue: CustomSimulationPackageV1,
  graph: GraphDocumentV1,
): CustomSimulationPackageV1 => {
  const visualization = isVisualizationV2(packageValue.visualization)
    ? {
      ...packageValue.visualization,
      layout: createGraphLayoutSpec(
        graph,
        packageValue.title,
        Object.fromEntries(graph.nodes.map((node) => [node.id, { x: node.x, y: node.y }])),
      ),
    }
    : packageValue.visualization;
  return {
    ...packageValue,
    input: {
      ...packageValue.input,
      value: { ...packageValue.input.value, text: '', graph, origin: 'user' },
    },
    visualization,
    steps: patchGraphLayoutInSteps(packageValue.steps, graph),
  };
};
