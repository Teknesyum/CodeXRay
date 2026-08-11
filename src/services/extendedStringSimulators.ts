import type { SimulationStep, StringMatchVisualData } from '../types/simulation';

export const manacher = (source: string): SimulationStep[] => {
  const characters = Array.from(source);
  const transformedTokens = ['^', '#', ...characters.flatMap((character) => [character, '#']), '$'];
  const transformed = transformedTokens.join('');
  const radii = new Array(transformedTokens.length).fill(0) as number[];
  const steps: SimulationStep[] = [];
  let center = 0;
  let right = 0;
  let bestCenter = 0;
  let bestRadius = 0;
  const emit = (explanation: string, phase: string, index?: number, mirror?: number) => {
    const radius = index === undefined ? 0 : radii[index];
    const visualData: StringMatchVisualData = {
      type: 'string-match', text: transformed,
      activeText: index === undefined ? [] : [index, ...(mirror === undefined ? [] : [mirror])],
      matchedText: index === undefined ? [] : Array.from({ length: radius * 2 + 1 }, (_, offset) => index - radius + offset),
      window: right > 0 ? [Math.max(0, 2 * center - right), right] : undefined,
      vars: { phase, source, transformed, radii: [...radii], center, right, mirror: mirror ?? null, bestRadius },
    };
    steps.push({
      lineNumber: phase.includes('transform') ? 2 : phase.includes('complete') ? 12 : phase.includes('expand') ? 7 : 5,
      visualData,
      explanation,
    });
  };
  emit('Insert separators so odd and even palindromes share one representation.', 'Manacher · transform string');
  for (let index = 1; index < transformedTokens.length - 1; index += 1) {
    const mirror = 2 * center - index;
    if (index < right) {
      radii[index] = Math.min(right - index, radii[mirror] ?? 0);
      emit(`Reuse mirror ${mirror} inside the current palindrome boundary.`, 'Manacher · reuse mirror radius', index, mirror);
    }
    while (
      transformedTokens[index + radii[index] + 1]
      === transformedTokens[index - radii[index] - 1]
    ) {
      radii[index] += 1;
      emit(`Expand the palindrome centered at transformed index ${index}.`, 'Manacher · expand radius', index, mirror);
    }
    if (index + radii[index] > right) {
      center = index;
      right = index + radii[index];
    }
    if (radii[index] > bestRadius) {
      bestRadius = radii[index];
      bestCenter = index;
    }
    emit(`Commit center ${center} and right boundary ${right}.`, 'Manacher · commit center boundary', index, mirror);
  }
  const start = Math.floor((bestCenter - bestRadius) / 2);
  const palindrome = characters.slice(start, start + bestRadius).join('');
  emit(`The longest palindromic substring is "${palindrome}".`, 'Manacher · complete', bestCenter);
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
