import type {
  ArrayVisualData,
  BarVisualData,
  GraphVisualData,
  MatrixCellHighlight,
  MatrixVisualData,
  RowsVisualData,
  SimulationStep,
  TracePrimitive,
  TraceValue,
} from '../types/simulation';

const numberGridStep = (
  steps: SimulationStep[], limit: number, prime: boolean[], explanation: string,
  phase: string, activeValue?: number, vars: Record<string, TraceValue> = {},
) => {
  const columns = Math.min(10, Math.ceil(Math.sqrt(Math.max(1, limit - 1))));
  const rowCount = Math.ceil((limit - 1) / columns);
  const visualData: GraphVisualData = {
    type: 'graph', directed: false, edges: [],
    nodes: Array.from({ length: limit - 1 }, (_, index) => {
      const value = index + 2;
      return {
        id: String(value), label: String(value), x: 8 + (index % columns) * (84 / Math.max(1, columns - 1)),
        y: 8 + Math.floor(index / columns) * (84 / Math.max(1, rowCount - 1)),
        state: value === activeValue ? 'active' as const : prime[value] ? 'visited' as const : 'removed' as const,
      };
    }),
    vars: { phase, limit, activeValue: activeValue ?? null, ...vars },
  };
  steps.push({ lineNumber: phase.includes('initialize') ? 2 : phase.includes('complete') ? 9 : 6, visualData, explanation });
};

const matrixStep = (
  steps: SimulationStep[], explanation: string, values: MatrixVisualData['values'], rowLabels: string[],
  columnLabels: string[], highlights: MatrixCellHighlight[], fillDirection: MatrixVisualData['fillDirection'],
  vars: Record<string, TraceValue>, lineNumber: number | null,
) => steps.push({ lineNumber, explanation, visualData: {
  type: 'matrix', values: values.map((row) => [...row]), rowLabels, columnLabels, highlights, fillDirection, vars,
} });

type Emit = (
  explanation: string,
  pointers?: Record<string, number>,
  vars?: Record<string, TraceValue>,
  shownValues?: TracePrimitive[],
) => void;

const createEmitter = (
  steps: SimulationStep[],
  source: number[],
): Emit => (explanation, pointers = {}, vars = {}, shownValues = source) => {
  const visualData: ArrayVisualData = {
    type: 'array',
    values: [...shownValues],
    pointers: { ...pointers },
    vars: { array: [...source], ...vars },
  };
  const phase = typeof vars.phase === 'string' ? vars.phase : '';
  const lineNumber = phase.startsWith('Kadane · initialize') ? 2
    : phase.startsWith('Kadane · choose') ? 4
      : phase.startsWith('Kadane · update best') ? 6
        : phase.startsWith('Kadane · complete') ? 8
          : phase.startsWith('Prefix Sum · initialize') ? 2
            : phase.startsWith('Prefix Sum · accumulate') ? 3
              : phase.startsWith('Prefix Sum · complete') ? 4
                : phase.startsWith('Dutch Flag') ? (phase.includes('initialize') ? 2 : phase.includes('complete') ? 9 : 5)
                  : phase.startsWith('Moore') ? (phase.includes('verify') ? 8 : phase.includes('complete') ? 10 : 4)
                    : null;
  steps.push({ lineNumber, visualData, explanation });
};

const kadane = (source: number[]): SimulationStep[] => {
  const steps: SimulationStep[] = [];
  const emit = createEmitter(steps, source);
  let current = source[0];
  let best = source[0];
  let start = 0;
  let bestRange = [0, 0];
  emit('Initialize the best subarray with the first value.', { current: 0, start: 0, bestStart: 0, bestEnd: 0 }, {
    phase: 'Kadane · initialize segments', current, best, currentRange: [0, 0], bestRange,
  });
  for (let index = 1; index < source.length; index += 1) {
    const extendSum = current + source[index];
    const restart = source[index] > extendSum;
    if (restart) {
      current = source[index];
      start = index;
    } else {
      current += source[index];
    }
    emit(`Choose whether to extend or restart at index ${index}.`, { index, start }, {
      phase: 'Kadane · choose extend or restart', decision: restart ? `${source[index]}>${extendSum} ⇒ restart` : `${extendSum}≥${source[index]} ⇒ extend`,
      current, best, currentRange: [start, index], bestRange: [...bestRange],
    });
    if (current > best) {
      best = current;
      bestRange = [start, index];
      emit(`Update the best segment through index ${index}.`, { index, start, bestStart: start, bestEnd: index }, {
        phase: 'Kadane · update best segment', current, best, currentRange: [start, index], bestRange: [...bestRange],
      });
    }
  }
  emit(`Maximum subarray sum is ${best}.`, { bestStart: bestRange[0], bestEnd: bestRange[1] }, {
    phase: 'Kadane · complete', best, bestRange,
  });
  return steps;
};

const prefixSum = (source: number[]): SimulationStep[] => {
  const steps: SimulationStep[] = [];
  const prefix = [...source];
  const emit = (explanation: string, phase: string, active: RowsVisualData['active'], vars: Record<string, TraceValue>, lineNumber: number | null) => {
    const visualData: RowsVisualData = {
      type: 'rows', mode: 'rows', rows: [
        { label: 'source', values: [...source] }, { label: 'prefix', values: [...prefix] },
      ], active, vars: { phase, source: [...source], prefix: [...prefix], ...vars },
    };
    steps.push({ lineNumber, visualData, explanation });
  };
  emit('Copy the first value into the prefix array.', 'Prefix Sum · initialize first cell',
    [{ row: 0, column: 0, role: 'dependency' }, { row: 1, column: 0, role: 'result' }], { dependency: [0] }, 2);
  for (let index = 1; index < prefix.length; index += 1) {
    prefix[index] += prefix[index - 1];
    emit(`Add prefix[${index - 1}] to source[${index}].`, 'Prefix Sum · accumulate dependency', [
      { row: 1, column: index - 1, role: 'dependency' }, { row: 0, column: index, role: 'dependency' },
      { row: 1, column: index, role: 'result' },
    ], { previous: index - 1, index, dependency: [index - 1, index] }, 5);
  }
  const queryLeft = source.length > 1 ? 1 : 0;
  const queryRight = source.length - 1;
  const rangeSum = prefix[queryRight] - (queryLeft > 0 ? prefix[queryLeft - 1] : 0);
  emit(`Compute range ${queryLeft}–${queryRight} by subtracting prefix boundaries.`, 'Prefix Sum · answer range query', [
    { row: 1, column: queryRight, role: 'dependency' },
    ...(queryLeft > 0 ? [{ row: 1, column: queryLeft - 1, role: 'dependency' as const }] : []),
  ], { queryRange: [queryLeft, queryRight], rangeSum }, 7);
  emit('The prefix-sum array is complete.', 'Prefix Sum · complete',
    prefix.map((_, column) => ({ row: 1, column, role: 'result' })), { queryRange: [queryLeft, queryRight], rangeSum }, 4);
  return steps;
};

const dutchNationalFlag = (source: number[]): SimulationStep[] => {
  if (source.some((value) => ![0, 1, 2].includes(value))) {
    throw new Error('Dutch National Flag requires values containing only 0, 1, and 2.');
  }
  const values = [...source];
  const steps: SimulationStep[] = [];
  const emit = createEmitter(steps, values);
  let low = 0;
  let middle = 0;
  let high = values.length - 1;
  emit('Initialize the low, middle, and high partitions.', { low, middle, high }, {
    phase: 'Dutch Flag · initialize regions', regions: { zero: [0, -1], unknown: [0, high], two: [high + 1, values.length - 1] },
  });
  while (middle <= high) {
    const inspected = values[middle];
    let action = '';
    if (values[middle] === 0) {
      [values[low], values[middle]] = [values[middle], values[low]];
      low += 1;
      middle += 1;
      action = 'swap(mid,low); low++; mid++';
    } else if (values[middle] === 1) {
      middle += 1;
      action = 'mid++';
    } else {
      [values[middle], values[high]] = [values[high], values[middle]];
      high -= 1;
      action = 'swap(mid,high); high--';
    }
    emit('Move the current value into its color partition.', { low, middle, high }, {
      phase: 'Dutch Flag · classify current value', inspected, action,
      zeroEnd: low - 1, twoStart: high + 1,
      regions: { zero: [0, low - 1], one: [low, middle - 1], unknown: [middle, high], two: [high + 1, values.length - 1] },
    });
  }
  emit('All 0s, 1s, and 2s are partitioned.', {}, { phase: 'Dutch Flag · complete', result: [...values] });
  return steps;
};

const mooreVoting = (source: number[]): SimulationStep[] => {
  const steps: SimulationStep[] = [];
  const emit = createEmitter(steps, source);
  let candidate = source[0];
  let count = 0;
  const cancelled: number[] = [];
  source.forEach((value, index) => {
    const reset = count === 0;
    if (reset) candidate = value;
    if (value === candidate) count += 1;
    else { count -= 1; cancelled.push(index); }
    emit(`Process ${value}; update the majority candidate.`, { index, candidate: index }, {
      phase: reset ? 'Moore · select candidate' : value === candidate ? 'Moore · support candidate' : 'Moore · cancel pair',
      candidate, count, cancelled: [...cancelled],
    });
  });
  let occurrences = 0;
  source.forEach((value, index) => {
    if (value === candidate) occurrences += 1;
    emit('Verify the surviving candidate in a second pass.', { index, candidate: index }, {
      phase: 'Moore · verify candidate', candidate, occurrences, threshold: Math.floor(source.length / 2) + 1,
    });
  });
  const hasMajority = occurrences > source.length / 2;
  emit(
    hasMajority ? `${candidate} is the majority value.` : 'No strict majority value exists.',
    {},
    { phase: 'Moore · complete', candidate, occurrences, hasMajority },
  );
  return steps;
};

const trappingRainWater = (source: number[]): SimulationStep[] => {
  if (source.some((value) => value < 0)) throw new Error('Bar heights must be non-negative.');
  const steps: SimulationStep[] = [];
  const emit = (explanation: string, phase: string, pointers: Record<string, number>, vars: Record<string, TraceValue>, waterLevels: number[]) => {
    const visualData: BarVisualData = { type: 'bars', values: [...source], water: [...waterLevels], pointers, vars: { phase, ...vars } };
    steps.push({ lineNumber: phase.includes('Start') ? 2 : phase.includes('complete') ? 8 : 4, visualData, explanation });
  };
  let left = 0;
  let right = source.length - 1;
  let leftMax = 0;
  let rightMax = 0;
  let water = 0;
  const waterLevels = new Array(source.length).fill(0) as number[];
  emit('Start two pointers at the outside bars.', 'Rain Water · Start boundaries', { left, right }, { leftMax, rightMax, water }, waterLevels);
  while (left <= right) {
    if (leftMax <= rightMax) {
      leftMax = Math.max(leftMax, source[left]);
      waterLevels[left] = leftMax - source[left];
      water += waterLevels[left];
      left += 1;
    } else {
      rightMax = Math.max(rightMax, source[right]);
      waterLevels[right] = rightMax - source[right];
      water += waterLevels[right];
      right -= 1;
    }
    emit('Accumulate water using the smaller boundary.', 'Rain Water · fill from smaller boundary', { left, right }, { leftMax, rightMax, water }, waterLevels);
  }
  emit(`The bars trap ${water} units of water.`, 'Rain Water · complete', {}, { water }, waterLevels);
  return steps;
};

const longestIncreasingSubsequence = (source: number[]): SimulationStep[] => {
  const steps: SimulationStep[] = [];
  const lengths = new Array(source.length).fill(1) as number[];
  const predecessor = new Array(source.length).fill(-1) as number[];
  const emit = (
    explanation: string, phase: string, active: RowsVisualData['active'], vars: Record<string, TraceValue>,
  ) => {
    const visualData: RowsVisualData = {
      type: 'rows', mode: 'rows',
      rows: [
        { label: 'input', values: [...source] },
        { label: 'LIS ending here', values: [...lengths] },
        { label: 'predecessor', values: predecessor.map((value) => value < 0 ? '∅' : value) },
      ], active, vars: { phase, ...vars },
    };
    steps.push({ lineNumber: phase.includes('initialize') ? 2 : phase.includes('complete') ? 10 : phase.includes('traceback') ? 9 : 7, visualData, explanation });
  };
  emit('Initialize every position as a length-one subsequence.', 'LIS · initialize per-index DP',
    source.map((_, column) => ({ row: 1, column, role: 'result' })), { lengths: [...lengths], predecessor: [...predecessor] });
  for (let index = 1; index < source.length; index += 1) {
    for (let previous = 0; previous < index; previous += 1) {
      const increasing = source[previous] < source[index];
      const improves = increasing && lengths[previous] + 1 > lengths[index];
      if (improves) {
        lengths[index] = lengths[previous] + 1;
        predecessor[index] = previous;
      }
      emit(`Compare predecessor candidate ${source[previous]} with ${source[index]}.`, 'LIS · compare predecessor candidate', [
        { row: 0, column: previous, role: 'dependency' },
        { row: 0, column: index, role: 'active' },
        { row: 1, column: index, role: improves ? 'result' : 'active' },
      ], {
        index, previous, increasing, improves, lengths: [...lengths], predecessor: [...predecessor],
        decision: !increasing ? 'not increasing ⇒ reject' : improves ? 'extend predecessor subsequence' : 'does not improve current length',
      });
    }
  }
  let cursor = lengths.reduce((best, length, index) => length > lengths[best] ? index : best, 0);
  const sequenceIndices: number[] = [];
  while (cursor >= 0) {
    sequenceIndices.unshift(cursor);
    emit(`Follow predecessor ${cursor} while reconstructing the LIS.`, 'LIS · traceback sequence', [
      { row: 0, column: cursor, role: 'result' }, { row: 2, column: cursor, role: 'dependency' },
    ], { cursor, sequenceIndices: [...sequenceIndices], sequence: sequenceIndices.map((index) => source[index]) });
    cursor = predecessor[cursor];
  }
  const sequence = sequenceIndices.map((index) => source[index]);
  emit(`Longest increasing subsequence length is ${sequence.length}.`, 'LIS · complete',
    sequenceIndices.map((column) => ({ row: 0, column, role: 'result' })),
    { length: sequence.length, sequence, sequenceIndices, lengths: [...lengths], predecessor: [...predecessor] });
  return steps;
};

const matrixChainMultiplication = (dimensions: number[]): SimulationStep[] => {
  if (
    dimensions.length < 2
    || dimensions.length > 30
    || dimensions.some((value) => !Number.isInteger(value) || value <= 0)
  ) {
    throw new Error('Matrix Chain Multiplication needs 2–30 positive integer dimensions.');
  }
  const matrixCount = dimensions.length - 1;
  const costs = Array.from({ length: matrixCount }, () =>
    new Array(matrixCount).fill(0) as number[]);
  const splits = Array.from({ length: matrixCount }, () => new Array(matrixCount).fill(-1) as number[]);
  const steps: SimulationStep[] = [];
  const labels = Array.from({ length: matrixCount }, (_, index) => `A${index + 1}`);
  matrixStep(steps, 'Initialize single-matrix multiplication costs to zero.', costs, labels, labels,
    labels.map((_, index) => ({ row: index, column: index, role: 'base' })), 'diagonal',
    { phase: 'Matrix Chain · initialize diagonal', dimensions: [...dimensions] }, 2);
  for (let length = 2; length <= matrixCount; length += 1) {
    for (let left = 0; left <= matrixCount - length; left += 1) {
      const right = left + length - 1;
      costs[left][right] = Number.POSITIVE_INFINITY;
      for (let split = left; split < right; split += 1) {
        const candidate = costs[left][split] + costs[split + 1][right]
          + dimensions[left] * dimensions[split + 1] * dimensions[right + 1];
        const previous = costs[left][right];
        if (candidate < previous) {
          costs[left][right] = candidate;
          splits[left][right] = split;
        }
        matrixStep(steps, `Try split ${split + 1} for matrices ${left + 1}–${right + 1}.`,
          costs.map((row) => row.map((value) => Number.isFinite(value) ? value : '∞')), labels, labels, [
            { row: left, column: split, role: 'dependency', label: 'left chain' },
            { row: split + 1, column: right, role: 'dependency', label: 'right chain' },
            { row: left, column: right, role: 'active', label: candidate < previous ? 'new minimum' : 'rejected split' },
          ], 'diagonal', {
            phase: 'Matrix Chain · evaluate split', chainLength: length, left, right, split, candidate,
            scalarCost: dimensions[left] * dimensions[split + 1] * dimensions[right + 1],
            bestSplit: splits[left][right], decision: candidate < previous ? 'accept lower cost' : 'keep current minimum',
          }, 8);
      }
    }
  }
  const buildParenthesization = (left: number, right: number): string => {
    if (left === right) return `A${left + 1}`;
    const split = splits[left][right];
    return `(${buildParenthesization(left, split)} × ${buildParenthesization(split + 1, right)})`;
  };
  const parenthesization = buildParenthesization(0, matrixCount - 1);
  const traceParenthesization = (left: number, right: number) => {
    if (left === right) return;
    const split = splits[left][right];
    matrixStep(steps, `Reconstruct the optimal split for matrices ${left + 1}–${right + 1}.`, costs, labels, labels, [
      { row: left, column: right, role: 'result', label: `split ${split + 1}` },
      { row: left, column: split, role: 'dependency' },
      { row: split + 1, column: right, role: 'dependency' },
    ], 'diagonal', { phase: 'Matrix Chain · traceback parenthesization', left, right, split, parenthesization }, 11);
    traceParenthesization(left, split);
    traceParenthesization(split + 1, right);
  };
  traceParenthesization(0, matrixCount - 1);
  matrixStep(steps, `Minimum scalar multiplication cost is ${costs[0][matrixCount - 1]}.`, costs, labels, labels,
    [{ row: 0, column: matrixCount - 1, role: 'result' }], 'diagonal',
    { phase: 'Matrix Chain · complete', minimumCost: costs[0][matrixCount - 1], parenthesization, splits }, 13);
  return steps;
};

const uniquePaths = (source: number[]): SimulationStep[] => {
  const [rows, columns] = source;
  if (
    source.length < 2
    || !Number.isInteger(rows)
    || !Number.isInteger(columns)
    || rows < 1
    || columns < 1
    || rows > 100
    || columns > 100
  ) throw new Error('Unique Paths needs row and column counts between 1 and 100.');
  const steps: SimulationStep[] = [];
  const ways: bigint[][] = Array.from({ length: rows }, (_, row) => Array.from({ length: columns }, (_, column) => row === 0 || column === 0 ? 1n : 0n));
  const display = () => ways.map((row) => row.map(String));
  const rowLabels = Array.from({ length: rows }, (_, index) => `r${index}`);
  const columnLabels = Array.from({ length: columns }, (_, index) => `c${index}`);
  matrixStep(steps, 'The top row and left column each have one path.', display(), rowLabels, columnLabels,
    [...ways.map((_, row) => ({ row, column: 0, role: 'base' as const })), ...ways[0].slice(1).map((_, column) => ({ row: 0, column: column + 1, role: 'base' as const }))],
    'row', { phase: 'Unique Paths · initialize grid borders', rows, columns }, 2);
  for (let row = 1; row < rows; row += 1) {
    for (let column = 1; column < columns; column += 1) {
      ways[row][column] = ways[row - 1][column] + ways[row][column - 1];
      matrixStep(steps, `Add paths from above and left at (${row}, ${column}).`, display(), rowLabels, columnLabels, [
        { row: row - 1, column, role: 'dependency', label: 'from above' },
        { row, column: column - 1, role: 'dependency', label: 'from left' },
        { row, column, role: 'active' },
      ], 'row', { phase: 'Unique Paths · add top and left', row, column }, 6);
    }
  }
  matrixStep(steps, `The grid has ${ways[rows - 1][columns - 1]} unique paths.`, display(), rowLabels, columnLabels,
    [{ row: rows - 1, column: columns - 1, role: 'result' }], 'row',
    { phase: 'Unique Paths · complete', uniquePaths: String(ways[rows - 1][columns - 1]) }, 9);
  return steps;
};

const sieveOfEratosthenes = (source: number[]): SimulationStep[] => {
  const limit = source[0];
  if (!Number.isInteger(limit) || limit < 2 || limit > 5_000) {
    throw new Error('Sieve of Eratosthenes needs an integer limit from 2 to 5,000.');
  }
  const steps: SimulationStep[] = [];
  const prime = new Array(limit + 1).fill(true) as boolean[];
  prime[0] = false;
  prime[1] = false;
  numberGridStep(steps, limit, prime, `Assume every value from 2 through ${limit} is prime.`, 'Sieve · initialize number grid');
  for (let value = 2; value * value <= limit; value += 1) {
    if (!prime[value]) continue;
    numberGridStep(steps, limit, prime, `Keep ${value} as the next prime base.`, 'Sieve · select prime base', value, { primeBase: value });
    for (let multiple = value * value; multiple <= limit; multiple += value) {
      if (!prime[multiple]) continue;
      prime[multiple] = false;
      numberGridStep(steps, limit, prime, `Cross out ${multiple} because it is a multiple of ${value}.`,
        'Sieve · cross out composite', multiple, { primeBase: value, multiple });
    }
  }
  const primes = prime.flatMap((isPrime, value) => isPrime ? [value] : []);
  numberGridStep(steps, limit, prime, `Found ${primes.length} primes through ${limit}.`, 'Sieve · complete', undefined, { primes });
  return steps;
};

const fastModularExponentiation = (source: number[]): SimulationStep[] => {
  const [baseValue, exponentValue, modulusValue] = source;
  if (
    source.length < 3
    || ![baseValue, exponentValue, modulusValue].every(Number.isSafeInteger)
    || exponentValue < 0
    || modulusValue <= 0
  ) throw new Error('Fast Exponentiation needs safe integer [base, non-negative exponent, positive modulus].');
  const modulus = BigInt(modulusValue);
  let base = ((BigInt(baseValue) % modulus) + modulus) % modulus;
  let exponent = BigInt(exponentValue);
  let result = 1n % modulus;
  const steps: SimulationStep[] = [];
  const history: Array<{ bit: string; base: string; result: string }> = [];
  const emit = (explanation: string, phase: string, vars: Record<string, TraceValue>) => {
    const visualData: RowsVisualData = {
      type: 'rows', mode: 'rows',
      rows: [
        { label: 'exponent bit', values: history.map((entry) => entry.bit) },
        { label: 'base power', values: history.map((entry) => entry.base) },
        { label: 'accumulator', values: history.map((entry) => entry.result) },
      ],
      active: history.length > 0 ? [0, 1, 2].map((row) => ({ row, column: history.length - 1, role: row === 2 ? 'result' as const : 'active' as const })) : [],
      vars: { phase, modulus: String(modulus), ...vars },
    };
    steps.push({ lineNumber: phase.includes('initialize') ? 2 : phase.includes('complete') ? 10 : 6, visualData, explanation });
  };
  emit('Reduce the base modulo the modulus.', 'Modular Power · initialize', {
    base: String(base), exponent: String(exponent), result: String(result),
  });
  while (exponent > 0n) {
    const bit = (exponent & 1n) === 1n;
    const baseBeforeSquare = base;
    if (bit) result = (result * base) % modulus;
    history.push({ bit: bit ? '1 × include' : '0 × skip', base: String(baseBeforeSquare), result: String(result) });
    emit(bit ? 'The current exponent bit is 1, so multiply the accumulator.' : 'The current exponent bit is 0, so keep the accumulator.',
      'Modular Power · consume exponent bit', {
        bit: bit ? 1 : 0, base: String(baseBeforeSquare), exponent: String(exponent), result: String(result),
        decision: bit ? 'multiply accumulator' : 'skip multiplication',
      });
    exponent >>= 1n;
    base = (base * base) % modulus;
  }
  emit(`The modular power is ${result}.`, 'Modular Power · complete', { result: String(result) });
  return steps;
};

const reverseLinkedList = (source: number[]): SimulationStep[] => {
  const steps: SimulationStep[] = [];
  const next = source.map((_, index) => index + 1 < source.length ? index + 1 : -1);
  const emit = (explanation: string, phase: string, current: number, previous: number, savedNext: number | null) => {
    const visualData: GraphVisualData = {
      type: 'graph', directed: true,
      nodes: source.map((value, index) => ({
        id: String(index), label: String(value), x: 10 + index * (80 / Math.max(1, source.length - 1)), y: 50,
        state: index === current ? 'active' : index === previous ? 'path' : 'idle',
      })),
      edges: next.flatMap((target, index) => target >= 0 ? [{
        id: `${index}->${target}`, from: String(index), to: String(target), state: index === current ? 'active' as const : 'visited' as const,
      }] : []),
      vars: { phase, current: current >= 0 ? current : null, previous: previous >= 0 ? previous : null, savedNext, next: [...next] },
    };
    steps.push({ lineNumber: phase.includes('initialize') ? 2 : phase.includes('complete') ? 9 : 6, visualData, explanation });
  };
  let previous = -1;
  let current = source.length > 0 ? 0 : -1;
  emit('Initialize previous as null and current as the head.', 'Reverse List · initialize pointers', current, previous, null);
  while (current >= 0) {
    const savedNext = next[current];
    emit(`Save the next pointer after node ${source[current]}.`, 'Reverse List · save next pointer', current, previous, savedNext);
    next[current] = previous;
    emit(`Redirect the node containing ${source[current]} to the previous node.`, 'Reverse List · reverse current arrow', current, previous, savedNext);
    previous = current;
    current = savedNext;
  }
  emit('The previous node is the new linked-list head.', 'Reverse List · complete', current, previous, null);
  const finalStep = steps.at(-1);
  if (finalStep) finalStep.visualData.vars.reversed = [...source].reverse();
  return steps;
};

export const extendedArraySimulators: Record<string, (source: number[]) => SimulationStep[]> = {
  kadane,
  prefix: prefixSum,
  dutch: dutchNationalFlag,
  moore: mooreVoting,
  rain: trappingRainWater,
  lis: longestIncreasingSubsequence,
  matrixChain: matrixChainMultiplication,
  uniquePaths,
  sieve: sieveOfEratosthenes,
  modularPower: fastModularExponentiation,
  reverseList: reverseLinkedList,
};
