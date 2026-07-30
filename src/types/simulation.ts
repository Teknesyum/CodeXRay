export type TracePrimitive = string | number | boolean | null;
export type TraceValue =
  | TracePrimitive
  | TraceValue[]
  | { [key: string]: TraceValue };

export type InputKind = 'array' | 'string' | 'tree' | 'graph';
export type NodeState = 'idle' | 'queued' | 'active' | 'visited' | 'path';
export type EdgeState = 'idle' | 'active' | 'path';

export interface GraphNode {
  id: string;
  label: string;
  x: number;
  y: number;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  weight?: number;
}

export interface GraphDocumentV1 {
  version: 1;
  mode: 'tree' | 'graph';
  directed: boolean;
  weighted: boolean;
  nodes: GraphNode[];
  edges: GraphEdge[];
  rootId?: string;
  startId: string;
  targetId?: string;
}

export interface SimulationInput {
  kind: InputKind;
  text: string;
  graph?: GraphDocumentV1;
}

export interface ArrayVisualData {
  type: 'array';
  values: TracePrimitive[];
  pointers?: Record<string, number>;
  sortedIndices?: number[];
  vars: Record<string, TraceValue>;
}

export interface GraphVisualNode extends GraphNode {
  state?: NodeState;
}

export interface GraphVisualEdge extends GraphEdge {
  state?: EdgeState;
}

export interface GraphVisualData {
  type: 'graph';
  directed: boolean;
  nodes: GraphVisualNode[];
  edges: GraphVisualEdge[];
  vars: Record<string, TraceValue>;
}

export interface VariablesVisualData {
  type: 'variables';
  vars: Record<string, TraceValue>;
}

export type VisualData =
  | ArrayVisualData
  | GraphVisualData
  | VariablesVisualData;

export interface SimulationStep {
  lineNumber: number | null;
  visualData: VisualData;
  explanation: string;
}

export interface AlgorithmDefinition {
  name: string;
  code: string;
  isSupported: boolean;
}

export interface InputValidationResult {
  input?: SimulationInput;
  error?: string;
}
