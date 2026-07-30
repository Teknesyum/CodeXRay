import type {
  ArrayVisualData,
  SimulationStep,
  TracePrimitive,
  TraceValue,
} from '../types/simulation';

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
  steps.push({ lineNumber: null, visualData, explanation });
};

const kadane = (source: number[]): SimulationStep[] => {
  const steps: SimulationStep[] = [];
  const emit = createEmitter(steps, source);
  let current = source[0];
  let best = source[0];
  let start = 0;
  let bestRange = [0, 0];
  emit('Initialize the best subarray with the first value.', { current: 0 }, { current, best, bestRange });
  for (let index = 1; index < source.length; index += 1) {
    if (source[index] > current + source[index]) {
      current = source[index];
      start = index;
    } else {
      current += source[index];
    }
    if (current > best) {
      best = current;
      bestRange = [start, index];
    }
    emit(`Update the maximum subarray ending at index ${index}.`, { index, start }, {
      current,
      best,
      bestRange,
    });
  }
  emit(`Maximum subarray sum is ${best}.`, {}, { best, bestRange });
  return steps;
};

const prefixSum = (source: number[]): SimulationStep[] => {
  const steps: SimulationStep[] = [];
  const prefix = [...source];
  const emit = createEmitter(steps, source);
  emit('Copy the first value into the prefix array.', { index: 0 }, { prefix: [...prefix] }, prefix);
  for (let index = 1; index < prefix.length; index += 1) {
    prefix[index] += prefix[index - 1];
    emit(`Add prefix[${index - 1}] to source[${index}].`, { index }, { prefix: [...prefix] }, prefix);
  }
  emit('The prefix-sum array is complete.', {}, { prefix: [...prefix] }, prefix);
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
  emit('Initialize the low, middle, and high partitions.', { low, middle, high });
  while (middle <= high) {
    if (values[middle] === 0) {
      [values[low], values[middle]] = [values[middle], values[low]];
      low += 1;
      middle += 1;
    } else if (values[middle] === 1) {
      middle += 1;
    } else {
      [values[middle], values[high]] = [values[high], values[middle]];
      high -= 1;
    }
    emit('Move the current value into its color partition.', { low, middle, high }, {
      zeroEnd: low - 1,
      twoStart: high + 1,
    });
  }
  emit('All 0s, 1s, and 2s are partitioned.', {}, { result: [...values] });
  return steps;
};

const mooreVoting = (source: number[]): SimulationStep[] => {
  const steps: SimulationStep[] = [];
  const emit = createEmitter(steps, source);
  let candidate = source[0];
  let count = 0;
  source.forEach((value, index) => {
    if (count === 0) candidate = value;
    count += value === candidate ? 1 : -1;
    emit(`Process ${value}; update the majority candidate.`, { index }, { candidate, count });
  });
  const occurrences = source.filter((value) => value === candidate).length;
  const hasMajority = occurrences > source.length / 2;
  emit(
    hasMajority ? `${candidate} is the majority value.` : 'No strict majority value exists.',
    {},
    { candidate, occurrences, hasMajority },
  );
  return steps;
};

const trappingRainWater = (source: number[]): SimulationStep[] => {
  if (source.some((value) => value < 0)) throw new Error('Bar heights must be non-negative.');
  const steps: SimulationStep[] = [];
  const emit = createEmitter(steps, source);
  let left = 0;
  let right = source.length - 1;
  let leftMax = 0;
  let rightMax = 0;
  let water = 0;
  emit('Start two pointers at the outside bars.', { left, right }, { leftMax, rightMax, water });
  while (left <= right) {
    if (leftMax <= rightMax) {
      leftMax = Math.max(leftMax, source[left]);
      water += leftMax - source[left];
      left += 1;
    } else {
      rightMax = Math.max(rightMax, source[right]);
      water += rightMax - source[right];
      right -= 1;
    }
    emit('Accumulate water using the smaller boundary.', { left, right }, { leftMax, rightMax, water });
  }
  emit(`The bars trap ${water} units of water.`, {}, { water });
  return steps;
};

const longestIncreasingSubsequence = (source: number[]): SimulationStep[] => {
  const steps: SimulationStep[] = [];
  const emit = createEmitter(steps, source);
  const tails: number[] = [];
  source.forEach((value, index) => {
    let low = 0;
    let high = tails.length;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (tails[middle] < value) low = middle + 1;
      else high = middle;
    }
    tails[low] = value;
    emit(`Place ${value} at tails index ${low}.`, { index, tailsIndex: low }, {
      tails: [...tails],
      length: tails.length,
    });
  });
  emit(`Longest increasing subsequence length is ${tails.length}.`, {}, {
    tails: [...tails],
    length: tails.length,
  });
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
  const steps: SimulationStep[] = [];
  const emit = createEmitter(steps, dimensions);
  emit('Initialize single-matrix multiplication costs to zero.', {}, {
    dimensions: [...dimensions],
    costs: costs.map((row) => [...row]),
  });
  for (let length = 2; length <= matrixCount; length += 1) {
    for (let left = 0; left <= matrixCount - length; left += 1) {
      const right = left + length - 1;
      costs[left][right] = Number.POSITIVE_INFINITY;
      for (let split = left; split < right; split += 1) {
        const candidate = costs[left][split] + costs[split + 1][right]
          + dimensions[left] * dimensions[split + 1] * dimensions[right + 1];
        costs[left][right] = Math.min(costs[left][right], candidate);
      }
      emit(`Compute the minimum cost for matrices ${left + 1}–${right + 1}.`, {
        left,
        right,
      }, {
        chainLength: length,
        minimumCost: costs[left][right],
        costs: costs.map((row) => row.map((value) =>
          Number.isFinite(value) ? value : '∞')),
      });
    }
  }
  emit(`Minimum scalar multiplication cost is ${costs[0][matrixCount - 1]}.`, {}, {
    minimumCost: costs[0][matrixCount - 1],
  });
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
  const emit = createEmitter(steps, source);
  const ways = new Array(columns).fill(1n) as bigint[];
  emit('The first grid row has one path to every cell.', {}, {
    rows,
    columns,
    ways: ways.map(String),
  });
  for (let row = 1; row < rows; row += 1) {
    for (let column = 1; column < columns; column += 1) {
      ways[column] += ways[column - 1];
    }
    emit(`Accumulate paths for grid row ${row + 1}.`, { row }, {
      ways: ways.map(String),
    });
  }
  emit(`The grid has ${ways[columns - 1]} unique paths.`, {}, {
    uniquePaths: String(ways[columns - 1]),
  });
  return steps;
};

const sieveOfEratosthenes = (source: number[]): SimulationStep[] => {
  const limit = source[0];
  if (!Number.isInteger(limit) || limit < 2 || limit > 5_000) {
    throw new Error('Sieve of Eratosthenes needs an integer limit from 2 to 5,000.');
  }
  const steps: SimulationStep[] = [];
  const emit = createEmitter(steps, source);
  const prime = new Array(limit + 1).fill(true) as boolean[];
  prime[0] = false;
  prime[1] = false;
  emit(`Assume every value from 2 through ${limit} is prime.`, {}, { limit });
  for (let value = 2; value * value <= limit; value += 1) {
    if (!prime[value]) continue;
    for (let multiple = value * value; multiple <= limit; multiple += value) {
      prime[multiple] = false;
    }
    emit(`Mark multiples of ${value} as composite.`, { value }, {
      primeCount: prime.filter(Boolean).length,
    });
  }
  const primes = prime.flatMap((isPrime, value) => isPrime ? [value] : []);
  emit(`Found ${primes.length} primes through ${limit}.`, {}, { primes });
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
  let base = BigInt(baseValue) % BigInt(modulusValue);
  let exponent = BigInt(exponentValue);
  const modulus = BigInt(modulusValue);
  let result = 1n % modulus;
  const steps: SimulationStep[] = [];
  const emit = createEmitter(steps, source);
  emit('Reduce the base modulo the modulus.', {}, {
    base: String(base),
    exponent: String(exponent),
    result: String(result),
  });
  while (exponent > 0n) {
    if ((exponent & 1n) === 1n) result = (result * base) % modulus;
    exponent >>= 1n;
    base = (base * base) % modulus;
    emit('Consume one exponent bit and square the base.', {}, {
      base: String(base),
      exponent: String(exponent),
      result: String(result),
    });
  }
  emit(`The modular power is ${result}.`, {}, { result: String(result) });
  return steps;
};

const reverseLinkedList = (source: number[]): SimulationStep[] => {
  const values = [...source];
  const steps: SimulationStep[] = [];
  const emit = createEmitter(steps, values);
  const reversed: number[] = [];
  emit('Initialize previous as null and current as the head.', { current: 0 }, {
    previous: null,
    reversed,
  });
  for (let current = 0; current < source.length; current += 1) {
    reversed.unshift(source[current]);
    emit(`Redirect the node containing ${source[current]} to the previous node.`, {
      current,
    }, {
      previous: source[current],
      reversed: [...reversed],
    }, reversed);
  }
  emit('The previous node is the new linked-list head.', {}, { reversed }, reversed);
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
