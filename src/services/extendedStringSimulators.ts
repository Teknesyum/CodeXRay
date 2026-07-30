import type { SimulationStep } from '../types/simulation';

export const manacher = (source: string): SimulationStep[] => {
  const transformed = `^#${source.split('').join('#')}#$`;
  const radii = new Array(transformed.length).fill(0) as number[];
  const steps: SimulationStep[] = [];
  let center = 0;
  let right = 0;
  let bestCenter = 0;
  let bestRadius = 0;
  const emit = (explanation: string, index?: number) => {
    steps.push({
      lineNumber: null,
      visualData: {
        type: 'array',
        values: transformed.split(''),
        pointers: index === undefined ? {} : { index, center, right },
        vars: {
          source,
          transformed,
          radii: [...radii],
          center,
          right,
          bestRadius,
        },
      },
      explanation,
    });
  };
  emit('Insert separators so odd and even palindromes share one representation.');
  for (let index = 1; index < transformed.length - 1; index += 1) {
    const mirror = 2 * center - index;
    if (index < right) radii[index] = Math.min(right - index, radii[mirror] ?? 0);
    while (
      transformed[index + radii[index] + 1]
      === transformed[index - radii[index] - 1]
    ) radii[index] += 1;
    if (index + radii[index] > right) {
      center = index;
      right = index + radii[index];
    }
    if (radii[index] > bestRadius) {
      bestRadius = radii[index];
      bestCenter = index;
    }
    emit(`Expand the palindrome centered at transformed index ${index}.`, index);
  }
  const start = Math.floor((bestCenter - bestRadius) / 2);
  const palindrome = source.slice(start, start + bestRadius);
  emit(`The longest palindromic substring is "${palindrome}".`);
  const finalStep = steps.at(-1);
  if (finalStep) {
    Object.assign(finalStep.visualData.vars, {
      palindrome,
      start,
      length: bestRadius,
    });
  }
  return steps;
};
