export type TracePrimitive = string | number | boolean | null;
export type TraceValue =
  | TracePrimitive
  | TraceValue[]
  | { [key: string]: TraceValue };

export type InputKind = 'array' | 'string' | 'tree' | 'graph';
export type NodeState = 'idle' | 'queued' | 'active' | 'visited' | 'path' | 'removed';
export type EdgeState = 'idle' | 'active' | 'visited' | 'path' | 'rejected' | 'removed';
export type GraphNodeShape = 'circle' | 'rounded' | 'diamond' | 'hexagon' | 'star';

export interface GraphNodeVisualStyle {
  shape: GraphNodeShape;
  size: number;
  stroke: string;
  fill: string;
  glow: number;
  pulse?: 'outward' | 'inward' | 'steady';
}

export interface GraphEdgeVisualStyle {
  color: string;
  width: number;
  opacity: number;
  animation?: 'none' | 'flow' | 'pulse';
}

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
  parameters?: Record<string, string>;
  origin?: 'preset' | 'user' | 'agent';
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
  semanticRoles?: string[];
  semanticStyle?: GraphNodeVisualStyle;
}

export interface GraphVisualEdge extends GraphEdge {
  state?: EdgeState;
  displayLabel?: string;
  semanticRoles?: string[];
  semanticStyle?: GraphEdgeVisualStyle;
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

export type MatrixCellRole = 'empty' | 'base' | 'dependency' | 'active' | 'computed' | 'result';

export interface MatrixCellHighlight {
  row: number;
  column: number;
  role: MatrixCellRole;
  label?: string;
}

export interface MatrixVisualData {
  type: 'matrix';
  values: Array<Array<TracePrimitive>>;
  rowLabels: string[];
  columnLabels: string[];
  highlights: MatrixCellHighlight[];
  fillDirection: 'row' | 'column' | 'diagonal';
  vars: Record<string, TraceValue>;
}

export interface StringMatchVisualData {
  type: 'string-match';
  text: string;
  pattern?: string;
  alignment?: number;
  activeText?: number[];
  activePattern?: number[];
  matchedText?: number[];
  mismatchText?: number;
  window?: [number, number];
  vars: Record<string, TraceValue>;
}

export interface BarVisualData {
  type: 'bars';
  values: number[];
  water: number[];
  pointers?: Record<string, number>;
  vars: Record<string, TraceValue>;
}

export interface IntervalVisualData {
  type: 'intervals';
  intervals: Array<[number, number]>;
  merged: Array<[number, number]>;
  current?: [number, number];
  vars: Record<string, TraceValue>;
}

export interface RowsVisualData {
  type: 'rows';
  mode: 'rows' | 'heap' | 'buckets';
  rows: Array<{ label: string; values: TracePrimitive[] }>;
  active?: Array<{ row: number; column: number; role: 'active' | 'dependency' | 'result' }>;
  vars: Record<string, TraceValue>;
}

export type VisualData =
  | ArrayVisualData
  | GraphVisualData
  | MatrixVisualData
  | StringMatchVisualData
  | BarVisualData
  | IntervalVisualData
  | RowsVisualData
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

export type { Locale } from '../i18n/translations';
