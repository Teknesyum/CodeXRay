import type {
  ArrayVisualData,
  GraphDocumentV1,
  GraphVisualData,
  SimulationInput,
  SimulationStep,
  StringMatchVisualData,
  RowsVisualData,
  TraceValue,
} from '../types/simulation';
import { parseArrayInput, parseStringInput, validateGraphDocument } from './inputParsers';
import { extendedArraySimulators } from './extendedArraySimulators';
import { extendedGraphSimulators } from './extendedGraphSimulators';
import { manacher } from './extendedStringSimulators';
import { compoundSimulators } from './compoundSimulators';

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
    { phase: 'Sorting · complete', comparisons, writes },
    values.map((_, index) => index),
  );
};

const rowsStep = (
  steps: SimulationStep[], lineNumber: number | null, explanation: string,
  mode: RowsVisualData['mode'], rows: RowsVisualData['rows'], vars: Record<string, TraceValue>,
  active: RowsVisualData['active'] = [],
) => steps.push({ lineNumber, explanation, visualData: { type: 'rows', mode, rows, vars, active } });

const selectionSort = (source: number[]): SimulationStep[] => {
  const values = [...source];
  const steps: SimulationStep[] = [];
  const emit = arrayEmitter(steps, values);
  let comparisons = 0;
  let writes = 0;
  emit(2, 'Selection Sort · initialize unsorted range.', { i: 0 }, {
    phase: 'Selection Sort · initialize unsorted range', sortedPrefixEnd: -1, comparisons, writes,
  });
  for (let i = 0; i < values.length - 1; i += 1) {
    let minIndex = i;
    emit(3, `Start pass ${i + 1}; ${values[i]} is the current minimum.`, { i, minIndex }, { phase: 'Selection Sort · start unsorted scan', sortedPrefixEnd: i - 1, comparisons, writes });
    for (let j = i + 1; j < values.length; j += 1) {
      comparisons += 1;
      emit(5, `Compare ${values[j]} with ${values[minIndex]}.`, { i, j, minIndex }, { phase: 'Selection Sort · compare current minimum', sortedPrefixEnd: i - 1, comparisons, writes });
      if (values[j] < values[minIndex]) minIndex = j;
    }
    if (minIndex !== i) {
      [values[i], values[minIndex]] = [values[minIndex], values[i]];
      writes += 2;
    }
    emit(7, `Place the smallest remaining value at index ${i}.`, { i, minIndex }, { phase: 'Selection Sort · place minimum', sortedPrefixEnd: i, comparisons, writes }, Array.from({ length: i + 1 }, (_, index) => index));
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
  emit(2, 'Bubble Sort · initialize unsettled array.', {}, {
    phase: 'Bubble Sort · initialize unsettled array', settledSuffixStart: values.length, comparisons, writes,
  });
  for (let i = 0; i < values.length - 1; i += 1) {
    let swapped = false;
    for (let j = 0; j < values.length - i - 1; j += 1) {
      comparisons += 1;
      emit(4, `Compare adjacent values ${values[j]} and ${values[j + 1]}.`, { i, j, next: j + 1 }, { phase: 'Bubble Sort · compare adjacent pair', settledSuffixStart: values.length - i, comparisons, writes });
      if (values[j] > values[j + 1]) {
        [values[j], values[j + 1]] = [values[j + 1], values[j]];
        writes += 2;
        swapped = true;
        emit(5, 'Swap the out-of-order pair.', { i, j, next: j + 1 }, { phase: 'Bubble Sort · swap inversion', settledSuffixStart: values.length - i, comparisons, writes });
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
  emit(2, 'Insertion Sort · initialize sorted prefix.', { i: 0 }, {
    phase: 'Insertion Sort · initialize sorted prefix', sortedPrefixEnd: 0, comparisons, writes,
  }, [0]);
  for (let i = 1; i < values.length; i += 1) {
    const key = values[i];
    let j = i - 1;
    emit(3, `Take ${key} as the next insertion key.`, { i, j }, { phase: 'Insertion Sort · lift key', key, sortedPrefixEnd: i - 1, comparisons, writes });
    while (j >= 0) {
      comparisons += 1;
      emit(5, `Compare ${values[j]} with key ${key}.`, { i, j }, { phase: 'Insertion Sort · compare key', key, sortedPrefixEnd: i - 1, comparisons, writes });
      if (values[j] <= key) break;
      values[j + 1] = values[j];
      writes += 1;
      emit(6, `Shift ${values[j]} one position to the right.`, { i, j, write: j + 1 }, { phase: 'Insertion Sort · shift right', key, insertionGap: j, comparisons, writes });
      j -= 1;
    }
    values[j + 1] = key;
    writes += 1;
    emit(9, `Insert ${key} at index ${j + 1}.`, { i, insert: j + 1 }, { phase: 'Insertion Sort · fill insertion gap', key, sortedPrefixEnd: i, comparisons, writes });
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
    emit(2, `Choose ${pivot} as pivot for range ${low}–${high}.`, { low, high, pivot: high }, { phase: 'Quick Sort · choose pivot range', pivot, activeRange: [low, high], comparisons, writes }, [...sorted]);
    for (let j = low; j < high; j += 1) {
      comparisons += 1;
      emit(5, `Compare ${values[j]} with pivot ${pivot}.`, { low, high, i, j, pivot: high }, { phase: 'Quick Sort · scan partition', pivot, activeRange: [low, high], leftPartitionEnd: i, comparisons, writes }, [...sorted]);
      if (values[j] < pivot) {
        i += 1;
        [values[i], values[j]] = [values[j], values[i]];
        writes += 2;
        emit(7, 'Move the smaller value to the pivot’s left partition.', { i, j, pivot: high }, { phase: 'Quick Sort · move into left partition', pivot, activeRange: [low, high], comparisons, writes }, [...sorted]);
      }
    }
    [values[i + 1], values[high]] = [values[high], values[i + 1]];
    writes += 2;
    sorted.add(i + 1);
    emit(10, `Put pivot ${pivot} in its final position.`, { pivot: i + 1 }, { phase: 'Quick Sort · settle pivot', pivot, activeRange: [low, high], comparisons, writes }, [...sorted]);
    return i + 1;
  };

  const sort = (low: number, high: number) => {
    if (low > high) return;
    if (low === high) {
      sorted.add(low);
      emit(2, `Range ${low}–${high} is already a one-value base case.`, { low, high }, {
        phase: 'Quick Sort · base case range', activeRange: [low, high], comparisons, writes,
      }, [...sorted]);
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
  let comparisons = 0;
  let writes = 0;
  const splitLevels = new Map<number, string[]>();

  const merge = (left: number, middle: number, right: number) => {
    const leftValues = values.slice(left, middle + 1);
    const rightValues = values.slice(middle + 1, right + 1);
    let i = 0;
    let j = 0;
    let target = left;
    rowsStep(steps, 2, `Merge sorted ranges ${left}–${middle} and ${middle + 1}–${right}.`, 'rows', [
      { label: 'output', values: [...values] }, { label: 'left', values: leftValues }, { label: 'right', values: rightValues },
    ], { phase: 'Merge Sort · expose split buffers', left, middle, right, comparisons, writes });
    while (i < leftValues.length && j < rightValues.length) {
      comparisons += 1;
      values[target] = leftValues[i] <= rightValues[j] ? leftValues[i++] : rightValues[j++];
      writes += 1;
      rowsStep(steps, 9, `Write the smaller front value at index ${target}.`, 'rows', [
        { label: 'output', values: [...values] }, { label: 'left', values: leftValues }, { label: 'right', values: rightValues },
      ], { phase: 'Merge Sort · compare buffer fronts', left, middle, right, i, j, target, comparisons, writes }, [
        { row: 0, column: target, role: 'result' },
        ...(i < leftValues.length ? [{ row: 1, column: i, role: 'dependency' as const }] : []),
        ...(j < rightValues.length ? [{ row: 2, column: j, role: 'dependency' as const }] : []),
      ]);
      target += 1;
    }
    while (i < leftValues.length) {
      values[target] = leftValues[i++];
      writes += 1;
      rowsStep(steps, 12, 'Copy the remaining value from the left buffer.', 'rows', [
        { label: 'output', values: [...values] }, { label: 'left', values: leftValues }, { label: 'right', values: rightValues },
      ], { phase: 'Merge Sort · drain left buffer', target, comparisons, writes }, [{ row: 0, column: target, role: 'result' }]);
      target += 1;
    }
    while (j < rightValues.length) {
      values[target] = rightValues[j++];
      writes += 1;
      rowsStep(steps, 13, 'Copy the remaining value from the right buffer.', 'rows', [
        { label: 'output', values: [...values] }, { label: 'left', values: leftValues }, { label: 'right', values: rightValues },
      ], { phase: 'Merge Sort · drain right buffer', target, comparisons, writes }, [{ row: 0, column: target, role: 'result' }]);
      target += 1;
    }
  };

  const sort = (left: number, right: number, depth = 0) => {
    const level = splitLevels.get(depth) ?? [];
    level.push(`${left}–${right}: [${values.slice(left, right + 1).join(', ')}]`);
    splitLevels.set(depth, level);
    rowsStep(steps, 4, left === right ? `Reach leaf range ${left}–${right}.` : `Split range ${left}–${right} into two children.`, 'rows',
      [...splitLevels.entries()].sort(([a], [b]) => a - b).map(([treeDepth, ranges]) => ({ label: `split depth ${treeDepth}`, values: ranges })),
      { phase: left === right ? 'Merge Sort · reach split-tree leaf' : 'Merge Sort · grow split tree', left, right, depth, comparisons, writes },
      [{ row: depth, column: level.length - 1, role: left === right ? 'result' : 'active' }]);
    if (left >= right) return;
    const middle = Math.floor((left + right) / 2);
    sort(left, middle, depth + 1);
    sort(middle + 1, right, depth + 1);
    merge(left, middle, right);
  };
  sort(0, values.length - 1);
  completionStep(steps, values, comparisons, writes);
  return steps;
};

const heapSort = (source: number[]): SimulationStep[] => {
  const values = [...source];
  const steps: SimulationStep[] = [];
  const heapRows = (size: number) => {
    const rows: RowsVisualData['rows'] = [{ label: 'array', values: [...values] }];
    for (let start = 0, width = 1, level = 0; start < size; start += width, width *= 2, level += 1) {
      rows.push({ label: `L${level}`, values: values.slice(start, Math.min(size, start + width)) });
    }
    return rows;
  };
  rowsStep(steps, 2, 'Treat the complete array as the initial heap candidate.', 'heap', heapRows(values.length), {
    phase: 'Heap Sort · initialize heap view', heapSize: values.length, comparisons: 0, writes: 0,
  });
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
    rowsStep(steps, 4, `Find the largest value in the heap rooted at ${root}.`, 'heap', heapRows(size), {
      phase: 'Heap Sort · compare parent and children', heapSize: size, root, left, right, largest, comparisons, writes,
    }, [{ row: 0, column: root, role: 'active' }, ...(left < size ? [{ row: 0, column: left, role: 'dependency' as const }] : []), ...(right < size ? [{ row: 0, column: right, role: 'dependency' as const }] : [])]);
    if (largest !== root) {
      [values[root], values[largest]] = [values[largest], values[root]];
      writes += 2;
      rowsStep(steps, 7, 'Swap the root with its larger child.', 'heap', heapRows(size), {
        phase: 'Heap Sort · restore heap property', heapSize: size, root, largest, comparisons, writes,
      }, [{ row: 0, column: root, role: 'active' }, { row: 0, column: largest, role: 'dependency' }]);
      heapify(size, largest);
    }
  };

  for (let root = Math.floor(values.length / 2) - 1; root >= 0; root -= 1) {
    heapify(values.length, root);
  }
  for (let end = values.length - 1; end > 0; end -= 1) {
    [values[0], values[end]] = [values[end], values[0]];
    writes += 2;
    rowsStep(steps, 14, `Move the current maximum to final index ${end}.`, 'heap', heapRows(end), {
      phase: 'Heap Sort · extract maximum', heapSize: end, settledSuffix: [end, values.length - 1], comparisons, writes,
    }, [{ row: 0, column: end, role: 'result' }]);
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
  const counts = new Array(max - min + 1).fill(0) as number[];
  const domain = Array.from({ length: counts.length }, (_, index) => min + index);
  const output = new Array(source.length).fill('·') as Array<number | string>;
  let writes = 0;
  source.forEach((value, index) => {
    counts[value - min] += 1;
    rowsStep(steps, 6, `Count value ${value}.`, 'rows', [
      { label: 'input', values: [...source] },
      { label: 'domain', values: [...domain] },
      { label: 'frequency', values: [...counts] },
    ], { phase: 'Counting Sort · count frequency', min, max, writes }, [
      { row: 0, column: index, role: 'active' },
      { row: 2, column: value - min, role: 'result' },
    ]);
  });
  for (let index = 1; index < counts.length; index += 1) {
    counts[index] += counts[index - 1];
    rowsStep(steps, 9, `Accumulate the final position boundary for ${domain[index]}.`, 'rows', [
      { label: 'domain', values: [...domain] },
      { label: 'cumulative', values: [...counts] },
    ], { phase: 'Counting Sort · accumulate positions', min, max, writes }, [
      { row: 1, column: index - 1, role: 'dependency' },
      { row: 1, column: index, role: 'result' },
    ]);
  }
  for (let index = source.length - 1; index >= 0; index -= 1) {
    const value = source[index];
    const bucket = value - min;
    counts[bucket] -= 1;
    const target = counts[bucket];
    output[target] = value;
    writes += 1;
    rowsStep(steps, 13, `Place ${value} at stable output index ${target}.`, 'rows', [
      { label: 'input', values: [...source] },
      { label: 'domain', values: [...domain] },
      { label: 'next position', values: [...counts] },
      { label: 'output', values: [...output] },
    ], { phase: 'Counting Sort · stable output placement', min, max, sourceIndex: index, target, writes }, [
      { row: 0, column: index, role: 'active' },
      { row: 2, column: bucket, role: 'dependency' },
      { row: 3, column: target, role: 'result' },
    ]);
  }
  output.forEach((value, index) => { values[index] = Number(value); });
  completionStep(steps, values, source.length, writes);
  return steps;
};

const radixSort = (source: number[]): SimulationStep[] => {
  if (source.some((value) => !Number.isSafeInteger(value) || value < 0)) {
    throw new Error('Radix Sort requires non-negative safe integers.');
  }
  const values = [...source];
  const steps: SimulationStep[] = [];
  const max = Math.max(...values);
  let writes = 0;
  rowsStep(steps, 2, 'Initialize ten stable digit buckets.', 'buckets', [
    { label: 'array', values: [...values] },
    ...Array.from({ length: 10 }, (_, bucket) => ({ label: String(bucket), values: [] })),
  ], { phase: 'Radix Sort · initialize digit buckets', exponent: 1, writes });
  for (let exponent = 1; Math.floor(max / exponent) > 0; exponent *= 10) {
    const buckets = Array.from({ length: 10 }, () => [] as number[]);
    values.forEach((value, index) => {
      const digit = Math.floor(value / exponent) % 10;
      buckets[digit].push(value);
      rowsStep(steps, 7, `Place ${value} in digit bucket ${digit}.`, 'buckets', [
        { label: 'array', values: [...values] },
        ...buckets.map((bucket, bucketIndex) => ({ label: String(bucketIndex), values: [...bucket] })),
      ], { phase: 'Radix Sort · distribute by digit', exponent, digit, index, buckets: buckets.map((bucket) => [...bucket]), writes }, [{ row: digit + 1, column: buckets[digit].length - 1, role: 'active' }]);
    });
    const flattened = buckets.flat();
    flattened.forEach((value, index) => {
      values[index] = value;
      writes += 1;
    });
    rowsStep(steps, 18, `Collect buckets after the ${exponent}s digit pass.`, 'buckets', [
      { label: 'array', values: [...values] },
      ...buckets.map((bucket, bucketIndex) => ({ label: String(bucketIndex), values: [...bucket] })),
    ], { phase: 'Radix Sort · stable bucket collection', exponent, buckets: buckets.map((bucket) => [...bucket]), writes }, values.map((_, column) => ({ row: 0, column, role: 'result' })));
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
  const emit = (lineNumber: number, explanation: string, pointers: Record<string, number>, phase: string) => {
    const activeText = Object.values(pointers).filter((value) => Number.isInteger(value));
    const visualData: StringMatchVisualData = {
      type: 'string-match', text: source, pattern: source.slice(0, z[pointers.i ?? 0] ?? 0),
      alignment: pointers.i ?? 0, activeText, activePattern: pointers.prefix !== undefined ? [pointers.prefix] : [],
      window: right >= left ? [left, right] : undefined,
      vars: { phase, source, z: [...z], left, right, comparisons },
    };
    steps.push({
      lineNumber,
      visualData,
      explanation,
    });
  };
  emit(2, 'Initialize the Z array.', {}, 'Z · initialize array');
  for (let i = 1; i < values.length; i += 1) {
    if (i <= right) z[i] = Math.min(right - i + 1, z[i - left]);
    emit(4, `Start Z-box evaluation for index ${i}.`, { i, left, right }, i <= right ? 'Z · reuse mirror inside box' : 'Z · start new box');
    while (i + z[i] < values.length) {
      comparisons += 1;
      emit(6, `Compare source[${z[i]}] with source[${i + z[i]}].`, { i, prefix: z[i], candidate: i + z[i], left, right }, 'Z · extend prefix match');
      if (values[z[i]] !== values[i + z[i]]) break;
      z[i] += 1;
    }
    if (i + z[i] - 1 > right) {
      left = i;
      right = i + z[i] - 1;
      emit(7, `Extend the Z-box to ${left}–${right}.`, { i, left, right }, 'Z · commit new box');
    }
  }
  emit(10, 'The complete Z array has been calculated.', {}, 'Z · complete');
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
  const traceEdgeIds = (key: string) => new Set(
    Array.isArray(vars[key]) ? (vars[key] as TraceValue[]).filter((value): value is string => typeof value === 'string') : [],
  );
  const visitedEdges = traceEdgeIds('treeEdges');
  const rejectedEdges = traceEdgeIds('rejectedEdges');
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
      state: pathEdges.has(edge.id)
        ? 'path'
        : rejectedEdges.has(edge.id)
            ? 'rejected'
          : edge.id === activeEdge
            ? 'active'
            : visitedEdges.has(edge.id)
              ? 'visited'
              : 'idle',
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
  const treeEdges = new Set<string>();
  const visit = (nodeId: string, edgeId?: string) => {
    visited.add(nodeId);
    stack.push(nodeId);
    if (edgeId) treeEdges.add(edgeId);
    graphEmitter(graph, steps, visited, new Set(), nodeId, edgeId, [...stack], {
      phase: 'DFS · descend',
      decision: `${nodeId} enters the recursion stack.`,
      current: nodeId,
      visited: [...visited],
      recursionStack: [...stack],
      parent: Object.fromEntries(parent),
      treeEdges: [...treeEdges],
    }, 2, `Visit node ${nodeId} and continue depth-first.`);
    for (const edge of adjacency.get(nodeId) ?? []) {
      if (!visited.has(edge.to)) {
        parent.set(edge.to, nodeId);
        graphEmitter(graph, steps, visited, new Set(), nodeId, edge.edgeId, [...stack], {
          phase: 'DFS · inspect edge',
          decision: `${edge.to} is unvisited, so this edge becomes part of the DFS tree.`,
          current: nodeId,
          neighbor: edge.to,
          visited: [...visited],
          recursionStack: [...stack],
          treeEdges: [...treeEdges],
        }, 6, `Follow the edge from ${nodeId} to unvisited node ${edge.to}.`);
        visit(edge.to, edge.edgeId);
      }
    }
    stack.pop();
    graphEmitter(graph, steps, visited, new Set(), nodeId, undefined, [...stack], {
      phase: 'DFS · backtrack',
      decision: `${nodeId} has no remaining unvisited neighbor; return to ${stack.at(-1) ?? 'the caller'}.`,
      current: nodeId,
      visited: [...visited],
      recursionStack: [...stack],
      parent: Object.fromEntries(parent),
      treeEdges: [...treeEdges],
    }, 8, `Backtrack from node ${nodeId}.`);
  };
  visit(graph.startId);
  graphEmitter(graph, steps, visited, new Set(), undefined, undefined, [], {
    phase: 'DFS · complete reachable component',
    decision: `${visited.size} node${visited.size === 1 ? '' : 's'} reachable from ${graph.startId} were visited; the recursion stack is empty.`,
    visited: [...visited],
    recursionStack: [],
    parent: Object.fromEntries(parent),
    treeEdges: [...treeEdges],
  }, 8, `Complete DFS from ${graph.startId}; ${visited.size} reachable node${visited.size === 1 ? '' : 's'} were visited.`);
  return steps;
};

const breadthFirstSearch = (graph: GraphDocumentV1): SimulationStep[] => {
  const steps: SimulationStep[] = [];
  const adjacency = adjacencyFor(graph);
  const visited = new Set<string>([graph.startId]);
  const queue = [graph.startId];
  const distances: Record<string, number> = { [graph.startId]: 0 };
  const parent: Record<string, string> = {};
  const treeEdges = new Set<string>();
  graphEmitter(graph, steps, new Set(), new Set(queue), graph.startId, undefined, [], {
    phase: 'BFS · initialize', decision: `Start at level 0 and enqueue ${graph.startId}.`,
    current: graph.startId, visited: [...visited], queue: [...queue], distances,
  }, 5, `Enqueue start node ${graph.startId}.`);
  while (queue.length > 0) {
    const current = queue.shift() as string;
    graphEmitter(graph, steps, visited, new Set(queue), current, undefined, [], {
      phase: 'BFS · dequeue', decision: `${current} is the oldest queued node; expand its neighbors now.`,
      current, visited: [...visited], queue: [...queue], distances: { ...distances }, parent: { ...parent },
    }, 8, `Dequeue node ${current}.`);
    for (const edge of adjacency.get(current) ?? []) {
      if (!visited.has(edge.to)) {
        visited.add(edge.to);
        queue.push(edge.to);
        distances[edge.to] = distances[current] + 1;
        parent[edge.to] = current;
        treeEdges.add(edge.edgeId);
        graphEmitter(graph, steps, visited, new Set(queue), current, edge.edgeId, [], {
          phase: 'BFS · discover',
          decision: `${edge.to} is first reached at level ${distances[edge.to]}; enqueue it exactly once.`,
          current, neighbor: edge.to, visited: [...visited], queue: [...queue], distances: { ...distances }, parent: { ...parent },
          treeEdges: [...treeEdges],
        }, 14, `Discover ${edge.to} at distance ${distances[edge.to]} and enqueue it.`);
      }
    }
  }
  graphEmitter(graph, steps, visited, new Set(), undefined, undefined, [], {
    phase: 'BFS · complete reachable component',
    decision: `${visited.size} node${visited.size === 1 ? '' : 's'} reachable from ${graph.startId} were assigned final breadth levels.`,
    visited: [...visited], queue: [], distances: { ...distances }, parent: { ...parent }, treeEdges: [...treeEdges],
  }, 17, `Complete BFS from ${graph.startId}; ${visited.size} reachable node${visited.size === 1 ? '' : 's'} were visited.`);
  return steps;
};

const shortestPath = (graph: GraphDocumentV1, useHeuristic: boolean): SimulationStep[] => {
  if (graph.edges.some((edge) => (edge.weight ?? 1) < 0)) {
    throw new Error('Negative edge weights are not supported by Dijkstra or A*.');
  }
  const steps: SimulationStep[] = [];
  const adjacency = adjacencyFor(graph);
  const distances: Record<string, number> = Object.fromEntries(graph.nodes.map((node) => [node.id, Number.POSITIVE_INFINITY]));
  const parent = new Map<string, string>();
  const parentEdge = new Map<string, string>();
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
  const serializedScores = () => Object.fromEntries(graph.nodes.map((node) => [
    node.id,
    Number.isFinite(score(node.id)) ? Number(score(node.id).toFixed(2)) : '∞',
  ]));
  const treeEdges = () => [...parentEdge.values()];
  const serializedDistances = () => Object.fromEntries(
    Object.entries(distances).map(([id, distance]) => [id, Number.isFinite(distance) ? distance : '∞']),
  );

  graphEmitter(graph, steps, new Set(), open, graph.startId, undefined, [], {
    phase: useHeuristic ? 'A* · initialize frontier' : 'Dijkstra · initialize frontier',
    decision: `${graph.startId} starts at distance 0; every other node starts at ∞.`,
    current: graph.startId,
    openSet: [...open],
    closedSet: [],
    distances: serializedDistances(),
    parent: {},
    heuristicScale,
    fScores: useHeuristic ? serializedScores() : {},
    treeEdges: [],
  }, useHeuristic ? 3 : 4, `Initialize the shortest-path frontier at ${graph.startId}.`);

  while (open.size > 0) {
    const current = [...open].sort((left, right) => score(left) - score(right))[0];
    open.delete(current);
    if (closed.has(current)) continue;
    closed.add(current);
    const path = current === target ? reconstructPath(parent, current) : [];
    graphEmitter(graph, steps, closed, open, current, undefined, path, {
      phase: useHeuristic ? 'A* · select minimum f' : 'Dijkstra · settle minimum distance',
      decision: `${current} now has the smallest ${useHeuristic ? 'f = g + h' : 'tentative distance'} in the frontier.`,
      current,
      openSet: [...open],
      closedSet: [...closed],
      distances: serializedDistances(),
      parent: Object.fromEntries(parent),
      heuristicScale,
      fScores: useHeuristic ? serializedScores() : {},
      treeEdges: treeEdges(),
    }, useHeuristic ? 6 : 7, `Select ${current} with the smallest ${useHeuristic ? 'estimated total' : 'known'} distance.`);
    if (current === target) break;
    for (const edge of adjacency.get(current) ?? []) {
      if (closed.has(edge.to)) continue;
      const candidate = distances[current] + edge.weight;
      if (candidate < distances[edge.to]) {
        const previous = distances[edge.to];
        distances[edge.to] = candidate;
        parent.set(edge.to, current);
        parentEdge.set(edge.to, edge.edgeId);
        open.add(edge.to);
        graphEmitter(graph, steps, closed, open, current, edge.edgeId, [], {
          phase: useHeuristic ? 'A* · relax edge' : 'Dijkstra · relax edge',
          decision: `${candidate} improves ${edge.to} from ${Number.isFinite(previous) ? previous : '∞'}; update its predecessor.`,
          current,
          neighbor: edge.to,
          edgeWeight: edge.weight,
          openSet: [...open],
          closedSet: [...closed],
          distances: serializedDistances(),
          parent: Object.fromEntries(parent),
          heuristic: heuristic(edge.to),
          fScores: useHeuristic ? serializedScores() : {},
          treeEdges: treeEdges(),
        }, useHeuristic ? 11 : 12, `Relax edge ${current} → ${edge.to}; new distance is ${candidate}.`);
      } else {
        graphEmitter(graph, steps, closed, open, current, edge.edgeId, [], {
          phase: useHeuristic ? 'A* · reject relaxation' : 'Dijkstra · reject relaxation',
          decision: `${candidate} does not improve ${edge.to}'s current distance ${distances[edge.to]}; keep the existing predecessor.`,
          current,
          neighbor: edge.to,
          edgeWeight: edge.weight,
          candidate,
          openSet: [...open],
          closedSet: [...closed],
          distances: serializedDistances(),
          fScores: useHeuristic ? serializedScores() : {},
          parent: Object.fromEntries(parent),
          treeEdges: treeEdges(),
          rejectedEdges: [edge.edgeId],
        }, useHeuristic ? 11 : 12, `Inspect ${current} → ${edge.to}; ${candidate} is not an improvement.`);
      }
    }
  }
  const finalPath = target && Number.isFinite(distances[target]) ? reconstructPath(parent, target) : [];
  graphEmitter(graph, steps, closed, new Set(), target ?? graph.startId, undefined, finalPath, {
    phase: useHeuristic ? 'A* · complete shortest path' : 'Dijkstra · complete shortest path',
    decision: finalPath.length
      ? `The settled predecessor chain reconstructs ${finalPath.join(' → ')}.`
      : 'The frontier is empty, so the target is unreachable.',
    current: target ?? graph.startId,
    openSet: [],
    closedSet: [...closed],
    distances: serializedDistances(),
    parent: Object.fromEntries(parent),
    heuristicScale,
    fScores: useHeuristic ? serializedScores() : {},
    treeEdges: treeEdges(),
    path: finalPath,
  }, useHeuristic ? 15 : 16, finalPath.length
    ? `Complete the shortest path to ${target}.`
    : 'Finish with no reachable target.');
  return steps;
};

const identifyAlgorithm = (name: string, code: string): string => {
  const exact: Record<string, string> = {
    "Kruskal's MST": 'kruskal',
    "Prim's MST": 'prim',
    'Bellman-Ford Algorithm': 'bellmanFord',
    'Floyd-Warshall Algorithm': 'floydWarshall',
    'Topological Sort': 'topologicalSort',
    "Kosaraju's SCC": 'kosaraju',
    "Tarjan's SCC": 'tarjan',
    'Edmonds-Karp Max Flow': 'edmondsKarp',
    "Dinic's Max Flow": 'dinic',
    'Bipartite Matching (Hopcroft-Karp)': 'hopcroftKarp',
    'Graph Coloring': 'graphColoring',
    'Eulerian Path/Circuit': 'eulerianPath',
    'Hamiltonian Cycle': 'hamiltonianCycle',
    'Articulation Points': 'articulationPoints',
    'Bridges in Graph': 'bridges',
    "Johnson's Algorithm": 'johnson',
    "Kadane's Algorithm": 'kadane',
    'Longest Palindromic Substring (Manacher\'s)': 'manacher',
    'Prefix Sum Array': 'prefix',
    'Dutch National Flag': 'dutch',
    "Moore's Voting Algorithm": 'moore',
    'Trapping Rain Water': 'rain',
    'Longest Increasing Subsequence': 'lis',
    'Matrix Chain Multiplication': 'matrixChain',
    'Unique Paths': 'uniquePaths',
    'Binary Tree Inorder Traversal': 'inorder',
    'Binary Tree Preorder Traversal': 'preorder',
    'Binary Tree Postorder Traversal': 'postorder',
    'Lowest Common Ancestor (LCA)': 'lca',
    'Sieve of Eratosthenes': 'sieve',
    'Fast Exponentiation (Modular)': 'modularPower',
    'Reverse Linked List': 'reverseList',
    'Knuth-Morris-Pratt (KMP)': 'kmp',
    'Rabin-Karp Algorithm': 'rabinKarp',
    'Boyer-Moore Algorithm': 'boyerMoore',
    'Sliding Window Maximum': 'slidingWindowMaximum',
    'Trie Insert & Search': 'trieInsertSearch',
    'Two Pointers Technique': 'twoPointers',
    'Minimum Window Substring': 'minimumWindow',
    'Merge Intervals': 'mergeIntervals',
    'Binary Search': 'binarySearch',
    'Ternary Search': 'ternarySearch',
    '0/1 Knapsack': 'knapsack',
    'Longest Common Subsequence': 'lcs',
    'Edit Distance': 'editDistance',
    'Coin Change': 'coinChange',
    'Detect Cycle in Linked List': 'detectCycle',
  };
  if (exact[name]) return exact[name];
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

export class UnsupportedCustomSimulationError extends Error {
  constructor() {
    super('Custom source requires deterministic tracer execution.');
    this.name = 'UnsupportedCustomSimulationError';
  }
}

export const simulateAlgorithm = (
  algorithmName: string,
  code: string,
  input: SimulationInput,
): SimulationStep[] => {
  const algorithm = identifyAlgorithm(algorithmName, code);
  if (algorithm === 'unknown') throw new UnsupportedCustomSimulationError();
  if (algorithm === 'z') return zAlgorithm(parseStringInput(input.text));
  if (algorithm === 'manacher') return manacher(parseStringInput(input.text));
  if (compoundSimulators[algorithm]) return compoundSimulators[algorithm](input);
  if (
    ['dfs', 'bfs', 'dijkstra', 'astar'].includes(algorithm)
    || extendedGraphSimulators[algorithm]
  ) {
    if (!input.graph) throw new Error('This algorithm requires a graph or tree input.');
    const graph = validateGraphDocument(input.graph);
    if (algorithm === 'dfs') return depthFirstSearch(graph);
    if (algorithm === 'bfs') return breadthFirstSearch(graph);
    if (algorithm === 'dijkstra' || algorithm === 'astar') {
      return shortestPath(graph, algorithm === 'astar');
    }
    return extendedGraphSimulators[algorithm](graph);
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
  if (extendedArraySimulators[algorithm]) return extendedArraySimulators[algorithm](values);
  throw new Error(`No curated simulator is registered for '${algorithm}'.`);
};
