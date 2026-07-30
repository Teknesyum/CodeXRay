import type {
  ArrayVisualData,
  GraphDocumentV1,
  GraphVisualData,
  SimulationInput,
  SimulationStep,
  TraceValue,
} from '../types/simulation';
import { parseArrayInput, parseStringInput, validateGraphDocument } from './inputParsers';

type StepEmitter = (
  lineNumber: number | null,
  explanation: string,
  pointers?: Record<string, number>,
  extraVars?: Record<string, TraceValue>,
  sortedIndices?: number[],
) => void;

const arrayEmitter = (steps: SimulationStep[], values: number[]): StepEmitter =>
  (lineNumber, explanation, pointers = {}, extraVars = {}, sortedIndices = []) => {
    const visualData: ArrayVisualData = {
      type: 'array',
      values: [...values],
      pointers: { ...pointers },
      sortedIndices: [...sortedIndices],
      vars: {
        array: [...values],
        ...extraVars,
      },
    };
    steps.push({ lineNumber, visualData, explanation });
  };

const completionStep = (
  steps: SimulationStep[],
  values: number[],
  comparisons: number,
  writes: number,
) => {
  arrayEmitter(steps, values)(
    null,
    'Sorting completed. Every value is in its final position.',
    {},
    { comparisons, writes },
    values.map((_, index) => index),
  );
};

const selectionSort = (source: number[]): SimulationStep[] => {
  const values = [...source];
  const steps: SimulationStep[] = [];
  const emit = arrayEmitter(steps, values);
  let comparisons = 0;
  let writes = 0;
  for (let i = 0; i < values.length - 1; i += 1) {
    let minIndex = i;
    emit(3, `Start pass ${i + 1}; ${values[i]} is the current minimum.`, { i, minIndex }, { comparisons, writes });
    for (let j = i + 1; j < values.length; j += 1) {
      comparisons += 1;
      emit(5, `Compare ${values[j]} with ${values[minIndex]}.`, { i, j, minIndex }, { comparisons, writes });
      if (values[j] < values[minIndex]) minIndex = j;
    }
    if (minIndex !== i) {
      [values[i], values[minIndex]] = [values[minIndex], values[i]];
      writes += 2;
    }
    emit(7, `Place the smallest remaining value at index ${i}.`, { i, minIndex }, { comparisons, writes }, Array.from({ length: i + 1 }, (_, index) => index));
  }
  completionStep(steps, values, comparisons, writes);
  return steps;
};

const bubbleSort = (source: number[]): SimulationStep[] => {
  const values = [...source];
  const steps: SimulationStep[] = [];
  const emit = arrayEmitter(steps, values);
  let comparisons = 0;
  let writes = 0;
  for (let i = 0; i < values.length - 1; i += 1) {
    let swapped = false;
    for (let j = 0; j < values.length - i - 1; j += 1) {
      comparisons += 1;
      emit(4, `Compare adjacent values ${values[j]} and ${values[j + 1]}.`, { i, j, next: j + 1 }, { comparisons, writes });
      if (values[j] > values[j + 1]) {
        [values[j], values[j + 1]] = [values[j + 1], values[j]];
        writes += 2;
        swapped = true;
        emit(5, 'Swap the out-of-order pair.', { i, j, next: j + 1 }, { comparisons, writes });
      }
    }
    if (!swapped) break;
  }
  completionStep(steps, values, comparisons, writes);
  return steps;
};

const insertionSort = (source: number[]): SimulationStep[] => {
  const values = [...source];
  const steps: SimulationStep[] = [];
  const emit = arrayEmitter(steps, values);
  let comparisons = 0;
  let writes = 0;
  for (let i = 1; i < values.length; i += 1) {
    const key = values[i];
    let j = i - 1;
    emit(3, `Take ${key} as the next insertion key.`, { i, j }, { key, comparisons, writes });
    while (j >= 0) {
      comparisons += 1;
      emit(5, `Compare ${values[j]} with key ${key}.`, { i, j }, { key, comparisons, writes });
      if (values[j] <= key) break;
      values[j + 1] = values[j];
      writes += 1;
      emit(6, `Shift ${values[j]} one position to the right.`, { i, j, write: j + 1 }, { key, comparisons, writes });
      j -= 1;
    }
    values[j + 1] = key;
    writes += 1;
    emit(9, `Insert ${key} at index ${j + 1}.`, { i, insert: j + 1 }, { key, comparisons, writes });
  }
  completionStep(steps, values, comparisons, writes);
  return steps;
};

const quickSort = (source: number[]): SimulationStep[] => {
  const values = [...source];
  const steps: SimulationStep[] = [];
  const emit = arrayEmitter(steps, values);
  let comparisons = 0;
  let writes = 0;
  const sorted = new Set<number>();

  const partition = (low: number, high: number): number => {
    const pivot = values[high];
    let i = low - 1;
    emit(2, `Choose ${pivot} as pivot for range ${low}–${high}.`, { low, high, pivot: high }, { pivot, comparisons, writes }, [...sorted]);
    for (let j = low; j < high; j += 1) {
      comparisons += 1;
      emit(5, `Compare ${values[j]} with pivot ${pivot}.`, { low, high, i, j, pivot: high }, { pivot, comparisons, writes }, [...sorted]);
      if (values[j] < pivot) {
        i += 1;
        [values[i], values[j]] = [values[j], values[i]];
        writes += 2;
        emit(7, 'Move the smaller value to the pivot’s left partition.', { i, j, pivot: high }, { pivot, comparisons, writes }, [...sorted]);
      }
    }
    [values[i + 1], values[high]] = [values[high], values[i + 1]];
    writes += 2;
    sorted.add(i + 1);
    emit(10, `Put pivot ${pivot} in its final position.`, { pivot: i + 1 }, { pivot, comparisons, writes }, [...sorted]);
    return i + 1;
  };

  const sort = (low: number, high: number) => {
    if (low > high) return;
    if (low === high) {
      sorted.add(low);
      return;
    }
    const pivotIndex = partition(low, high);
    sort(low, pivotIndex - 1);
    sort(pivotIndex + 1, high);
  };
  sort(0, values.length - 1);
  completionStep(steps, values, comparisons, writes);
  return steps;
};

const mergeSort = (source: number[]): SimulationStep[] => {
  const values = [...source];
  const steps: SimulationStep[] = [];
  const emit = arrayEmitter(steps, values);
  let comparisons = 0;
  let writes = 0;

  const merge = (left: number, middle: number, right: number) => {
    const leftValues = values.slice(left, middle + 1);
    const rightValues = values.slice(middle + 1, right + 1);
    let i = 0;
    let j = 0;
    let target = left;
    emit(2, `Merge sorted ranges ${left}–${middle} and ${middle + 1}–${right}.`, { left, middle, right }, { leftValues, rightValues, comparisons, writes });
    while (i < leftValues.length && j < rightValues.length) {
      comparisons += 1;
      values[target] = leftValues[i] <= rightValues[j] ? leftValues[i++] : rightValues[j++];
      writes += 1;
      emit(9, `Write the smaller front value at index ${target}.`, { i: left + i, j: middle + 1 + j, target }, { leftValues, rightValues, comparisons, writes });
      target += 1;
    }
    while (i < leftValues.length) {
      values[target] = leftValues[i++];
      writes += 1;
      emit(12, 'Copy the remaining value from the left buffer.', { target }, { comparisons, writes });
      target += 1;
    }
    while (j < rightValues.length) {
      values[target] = rightValues[j++];
      writes += 1;
      emit(13, 'Copy the remaining value from the right buffer.', { target }, { comparisons, writes });
      target += 1;
    }
  };

  const sort = (left: number, right: number) => {
    if (left >= right) return;
    const middle = Math.floor((left + right) / 2);
    sort(left, middle);
    sort(middle + 1, right);
    merge(left, middle, right);
  };
  sort(0, values.length - 1);
  completionStep(steps, values, comparisons, writes);
  return steps;
};

const heapSort = (source: number[]): SimulationStep[] => {
  const values = [...source];
  const steps: SimulationStep[] = [];
  const emit = arrayEmitter(steps, values);
  let comparisons = 0;
  let writes = 0;

  const heapify = (size: number, root: number) => {
    let largest = root;
    const left = 2 * root + 1;
    const right = left + 1;
    if (left < size) {
      comparisons += 1;
      if (values[left] > values[largest]) largest = left;
    }
    if (right < size) {
      comparisons += 1;
      if (values[right] > values[largest]) largest = right;
    }
    emit(4, `Find the largest value in the heap rooted at ${root}.`, { root, left, right, largest }, { heapSize: size, comparisons, writes });
    if (largest !== root) {
      [values[root], values[largest]] = [values[largest], values[root]];
      writes += 2;
      emit(7, 'Swap the root with its larger child.', { root, largest }, { heapSize: size, comparisons, writes });
      heapify(size, largest);
    }
  };

  for (let root = Math.floor(values.length / 2) - 1; root >= 0; root -= 1) {
    heapify(values.length, root);
  }
  for (let end = values.length - 1; end > 0; end -= 1) {
    [values[0], values[end]] = [values[end], values[0]];
    writes += 2;
    emit(14, `Move the current maximum to final index ${end}.`, { root: 0, end }, { heapSize: end, comparisons, writes }, Array.from({ length: values.length - end }, (_, index) => values.length - 1 - index));
    heapify(end, 0);
  }
  completionStep(steps, values, comparisons, writes);
  return steps;
};

const countingSort = (source: number[]): SimulationStep[] => {
  if (source.some((value) => !Number.isInteger(value))) {
    throw new Error('Counting Sort requires integer values.');
  }
  const min = Math.min(...source);
  const max = Math.max(...source);
  if (max - min > 10_000) throw new Error('Counting Sort range must not exceed 10,000.');
  const values = [...source];
  const steps: SimulationStep[] = [];
  const emit = arrayEmitter(steps, values);
  const counts = new Array(max - min + 1).fill(0) as number[];
  let writes = 0;
  source.forEach((value, index) => {
    counts[value - min] += 1;
    emit(6, `Count value ${value}.`, { i: index }, { min, max, counts: [...counts], writes });
  });
  let target = 0;
  counts.forEach((count, offset) => {
    for (let occurrence = 0; occurrence < count; occurrence += 1) {
      values[target] = offset + min;
      writes += 1;
      emit(11, `Write ${offset + min} to output index ${target}.`, { target }, { min, max, counts: [...counts], writes });
      target += 1;
    }
  });
  completionStep(steps, values, source.length, writes);
  return steps;
};

const radixSort = (source: number[]): SimulationStep[] => {
  if (source.some((value) => !Number.isSafeInteger(value) || value < 0)) {
    throw new Error('Radix Sort requires non-negative safe integers.');
  }
  const values = [...source];
  const steps: SimulationStep[] = [];
  const emit = arrayEmitter(steps, values);
  const max = Math.max(...values);
  let writes = 0;
  for (let exponent = 1; Math.floor(max / exponent) > 0; exponent *= 10) {
    const buckets = Array.from({ length: 10 }, () => [] as number[]);
    values.forEach((value, index) => {
      const digit = Math.floor(value / exponent) % 10;
      buckets[digit].push(value);
      emit(7, `Place ${value} in digit bucket ${digit}.`, { i: index }, { exponent, buckets: buckets.map((bucket) => [...bucket]), writes });
    });
    const flattened = buckets.flat();
    flattened.forEach((value, index) => {
      values[index] = value;
      writes += 1;
    });
    emit(18, `Collect buckets after the ${exponent}s digit pass.`, {}, { exponent, buckets: buckets.map((bucket) => [...bucket]), writes });
  }
  completionStep(steps, values, source.length, writes);
  return steps;
};

const zAlgorithm = (source: string): SimulationStep[] => {
  const values = source.split('');
  const z = new Array(values.length).fill(0) as number[];
  const steps: SimulationStep[] = [];
  let left = 0;
  let right = 0;
  let comparisons = 0;
  const emit = (lineNumber: number, explanation: string, pointers: Record<string, number>) => {
    steps.push({
      lineNumber,
      visualData: {
        type: 'array',
        values,
        pointers,
        vars: { source, z: [...z], left, right, comparisons },
      },
      explanation,
    });
  };
  emit(2, 'Initialize the Z array.', {});
  for (let i = 1; i < values.length; i += 1) {
    if (i <= right) z[i] = Math.min(right - i + 1, z[i - left]);
    emit(4, `Start Z-box evaluation for index ${i}.`, { i, left, right });
    while (i + z[i] < values.length) {
      comparisons += 1;
      emit(6, `Compare source[${z[i]}] with source[${i + z[i]}].`, { i, prefix: z[i], candidate: i + z[i], left, right });
      if (values[z[i]] !== values[i + z[i]]) break;
      z[i] += 1;
    }
    if (i + z[i] - 1 > right) {
      left = i;
      right = i + z[i] - 1;
      emit(7, `Extend the Z-box to ${left}–${right}.`, { i, left, right });
    }
  }
  emit(10, 'The complete Z array has been calculated.', {});
  return steps;
};

interface AdjacentEdge {
  edgeId: string;
  to: string;
  weight: number;
}

const adjacencyFor = (graph: GraphDocumentV1): Map<string, AdjacentEdge[]> => {
  const adjacency = new Map(graph.nodes.map((node) => [node.id, [] as AdjacentEdge[]]));
  for (const edge of graph.edges) {
    adjacency.get(edge.from)?.push({ edgeId: edge.id, to: edge.to, weight: edge.weight ?? 1 });
    if (!graph.directed) {
      adjacency.get(edge.to)?.push({ edgeId: edge.id, to: edge.from, weight: edge.weight ?? 1 });
    }
  }
  return adjacency;
};

const reconstructPath = (parent: Map<string, string>, target?: string): string[] => {
  if (!target) return [];
  const path = [target];
  const seen = new Set(path);
  while (parent.has(path[0])) {
    const next = parent.get(path[0]);
    if (!next || seen.has(next)) break;
    path.unshift(next);
    seen.add(next);
  }
  return path;
};

const graphEmitter = (
  graph: GraphDocumentV1,
  steps: SimulationStep[],
  visited: Set<string>,
  queued: Set<string>,
  activeNode: string | undefined,
  activeEdge: string | undefined,
  path: string[],
  vars: Record<string, TraceValue>,
  lineNumber: number,
  explanation: string,
) => {
  const pathEdges = new Set<string>();
  for (let index = 1; index < path.length; index += 1) {
    const edge = graph.edges.find((candidate) =>
      (candidate.from === path[index - 1] && candidate.to === path[index])
      || (!graph.directed && candidate.to === path[index - 1] && candidate.from === path[index]));
    if (edge) pathEdges.add(edge.id);
  }
  const visualData: GraphVisualData = {
    type: 'graph',
    directed: graph.directed,
    nodes: graph.nodes.map((node) => ({
      ...node,
      state: path.includes(node.id)
        ? 'path'
        : node.id === activeNode
          ? 'active'
          : queued.has(node.id)
            ? 'queued'
            : visited.has(node.id)
              ? 'visited'
              : 'idle',
    })),
    edges: graph.edges.map((edge) => ({
      ...edge,
      state: pathEdges.has(edge.id) ? 'path' : edge.id === activeEdge ? 'active' : 'idle',
    })),
    vars,
  };
  steps.push({ lineNumber, visualData, explanation });
};

const depthFirstSearch = (graph: GraphDocumentV1): SimulationStep[] => {
  const steps: SimulationStep[] = [];
  const adjacency = adjacencyFor(graph);
  const visited = new Set<string>();
  const stack: string[] = [];
  const parent = new Map<string, string>();
  const visit = (nodeId: string, edgeId?: string) => {
    visited.add(nodeId);
    stack.push(nodeId);
    graphEmitter(graph, steps, visited, new Set(stack), nodeId, edgeId, [], {
      current: nodeId,
      visited: [...visited],
      recursionStack: [...stack],
      parent: Object.fromEntries(parent),
    }, 2, `Visit node ${nodeId} and continue depth-first.`);
    for (const edge of adjacency.get(nodeId) ?? []) {
      if (!visited.has(edge.to)) {
        parent.set(edge.to, nodeId);
        graphEmitter(graph, steps, visited, new Set(stack), nodeId, edge.edgeId, [], {
          current: nodeId,
          neighbor: edge.to,
          visited: [...visited],
          recursionStack: [...stack],
        }, 6, `Follow the edge from ${nodeId} to unvisited node ${edge.to}.`);
        visit(edge.to, edge.edgeId);
      }
    }
    stack.pop();
    graphEmitter(graph, steps, visited, new Set(stack), nodeId, undefined, [], {
      current: nodeId,
      visited: [...visited],
      recursionStack: [...stack],
      parent: Object.fromEntries(parent),
    }, 8, `Backtrack from node ${nodeId}.`);
  };
  visit(graph.startId);
  return steps;
};

const breadthFirstSearch = (graph: GraphDocumentV1): SimulationStep[] => {
  const steps: SimulationStep[] = [];
  const adjacency = adjacencyFor(graph);
  const visited = new Set<string>([graph.startId]);
  const queue = [graph.startId];
  const distances: Record<string, number> = { [graph.startId]: 0 };
  const parent: Record<string, string> = {};
  graphEmitter(graph, steps, new Set(), new Set(queue), graph.startId, undefined, [], {
    current: graph.startId, visited: [...visited], queue: [...queue], distances,
  }, 5, `Enqueue start node ${graph.startId}.`);
  while (queue.length > 0) {
    const current = queue.shift() as string;
    graphEmitter(graph, steps, visited, new Set(queue), current, undefined, [], {
      current, visited: [...visited], queue: [...queue], distances: { ...distances }, parent: { ...parent },
    }, 8, `Dequeue node ${current}.`);
    for (const edge of adjacency.get(current) ?? []) {
      if (!visited.has(edge.to)) {
        visited.add(edge.to);
        queue.push(edge.to);
        distances[edge.to] = distances[current] + 1;
        parent[edge.to] = current;
        graphEmitter(graph, steps, visited, new Set(queue), current, edge.edgeId, [], {
          current, neighbor: edge.to, visited: [...visited], queue: [...queue], distances: { ...distances }, parent: { ...parent },
        }, 14, `Discover ${edge.to} at distance ${distances[edge.to]} and enqueue it.`);
      }
    }
  }
  return steps;
};

const shortestPath = (graph: GraphDocumentV1, useHeuristic: boolean): SimulationStep[] => {
  const steps: SimulationStep[] = [];
  const adjacency = adjacencyFor(graph);
  const distances: Record<string, number> = Object.fromEntries(graph.nodes.map((node) => [node.id, Number.POSITIVE_INFINITY]));
  const parent = new Map<string, string>();
  const closed = new Set<string>();
  const open = new Set<string>([graph.startId]);
  distances[graph.startId] = 0;
  const target = graph.targetId;
  const coordinates = new Map(graph.nodes.map((node) => [node.id, node]));
  const ratios = graph.edges
    .map((edge) => {
      const from = coordinates.get(edge.from);
      const to = coordinates.get(edge.to);
      if (!from || !to) return Number.POSITIVE_INFINITY;
      const geometricDistance = Math.hypot(from.x - to.x, from.y - to.y);
      return geometricDistance === 0 ? Number.POSITIVE_INFINITY : (edge.weight ?? 1) / geometricDistance;
    })
    .filter(Number.isFinite);
  const heuristicScale = ratios.length > 0 ? Math.min(...ratios) : 0;
  const heuristic = (nodeId: string) => {
    if (!useHeuristic || !target) return 0;
    const node = coordinates.get(nodeId);
    const goal = coordinates.get(target);
    return node && goal ? Math.hypot(node.x - goal.x, node.y - goal.y) * heuristicScale : 0;
  };
  const score = (nodeId: string) => distances[nodeId] + heuristic(nodeId);
  const serializedDistances = () => Object.fromEntries(
    Object.entries(distances).map(([id, distance]) => [id, Number.isFinite(distance) ? distance : '∞']),
  );

  while (open.size > 0) {
    const current = [...open].sort((left, right) => score(left) - score(right))[0];
    open.delete(current);
    if (closed.has(current)) continue;
    closed.add(current);
    const path = current === target ? reconstructPath(parent, current) : [];
    graphEmitter(graph, steps, closed, open, current, undefined, path, {
      current,
      openSet: [...open],
      closedSet: [...closed],
      distances: serializedDistances(),
      parent: Object.fromEntries(parent),
      heuristicScale,
    }, useHeuristic ? 6 : 7, `Select ${current} with the smallest ${useHeuristic ? 'estimated total' : 'known'} distance.`);
    if (current === target) break;
    for (const edge of adjacency.get(current) ?? []) {
      if (closed.has(edge.to)) continue;
      const candidate = distances[current] + edge.weight;
      if (candidate < distances[edge.to]) {
        distances[edge.to] = candidate;
        parent.set(edge.to, current);
        open.add(edge.to);
        graphEmitter(graph, steps, closed, open, current, edge.edgeId, [], {
          current,
          neighbor: edge.to,
          edgeWeight: edge.weight,
          openSet: [...open],
          closedSet: [...closed],
          distances: serializedDistances(),
          parent: Object.fromEntries(parent),
          heuristic: heuristic(edge.to),
        }, useHeuristic ? 11 : 12, `Relax edge ${current} → ${edge.to}; new distance is ${candidate}.`);
      }
    }
  }
  return steps;
};

const identifyAlgorithm = (name: string, code: string): string => {
  const value = `${name} ${code}`.toLowerCase();
  if (value.includes('depth first') || value.includes('dfs')) return 'dfs';
  if (value.includes('breadth first') || value.includes('bfs')) return 'bfs';
  if (value.includes('dijkstra')) return 'dijkstra';
  if (value.includes('a*') || value.includes('astar')) return 'astar';
  if (value.includes('z-algorithm') || value.includes('zfunction')) return 'z';
  if (value.includes('quick')) return 'quick';
  if (value.includes('merge')) return 'merge';
  if (value.includes('heap')) return 'heap';
  if (value.includes('radix')) return 'radix';
  if (value.includes('counting') || value.includes('countsort')) return 'counting';
  if (value.includes('bubble')) return 'bubble';
  if (value.includes('insertion')) return 'insertion';
  if (value.includes('selection')) return 'selection';
  return 'unknown';
};

export const simulateAlgorithm = (
  algorithmName: string,
  code: string,
  input: SimulationInput,
): SimulationStep[] => {
  const algorithm = identifyAlgorithm(algorithmName, code);
  if (algorithm === 'z') return zAlgorithm(parseStringInput(input.text));
  if (['dfs', 'bfs', 'dijkstra', 'astar'].includes(algorithm)) {
    if (!input.graph) throw new Error('This algorithm requires a graph or tree input.');
    const graph = validateGraphDocument(input.graph);
    if (algorithm === 'dfs') return depthFirstSearch(graph);
    if (algorithm === 'bfs') return breadthFirstSearch(graph);
    return shortestPath(graph, algorithm === 'astar');
  }

  const values = parseArrayInput(input.text);
  if (algorithm === 'quick') return quickSort(values);
  if (algorithm === 'merge') return mergeSort(values);
  if (algorithm === 'heap') return heapSort(values);
  if (algorithm === 'radix') return radixSort(values);
  if (algorithm === 'counting') return countingSort(values);
  if (algorithm === 'bubble') return bubbleSort(values);
  if (algorithm === 'insertion') return insertionSort(values);
  if (algorithm === 'selection') return selectionSort(values);
  return [{
    lineNumber: 1,
    visualData: {
      type: 'variables',
      vars: { message: 'No deterministic simulator matches this custom code yet.' },
    },
    explanation: 'Select a supported preset or use the local assistant to discuss custom code.',
  }];
};
