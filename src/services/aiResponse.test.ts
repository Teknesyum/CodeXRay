import { describe, expect, it } from 'vitest';
import { sanitizeLocalModelAnswer } from './aiResponse';

describe('local model answer cleanup', () => {
  it('removes repeated prose and a duplicated unfinished tail', () => {
    const repeated = [
      'Complexity is measured with Big O notation.',
      '',
      'Big O describes how work grows.',
      '',
      'Complexity is measured with Big O notation.',
      '',
      'Complexity is measured',
    ].join('\n');

    expect(sanitizeLocalModelAnswer(repeated)).toBe(
      'Complexity is measured with Big O notation.\n\nBig O describes how work grows.',
    );
  });

  it('does not deduplicate code inside fenced blocks', () => {
    const answer = 'Example:\n\n```\nvalue++;\nvalue++;\n```';
    expect(sanitizeLocalModelAnswer(answer)).toContain('value++;\nvalue++;');
  });

  it('removes closed and unfinished internal reasoning blocks case-insensitively', () => {
    expect(sanitizeLocalModelAnswer(
      '<ANALYSIS>private workspace deliberation</ANALYSIS>\n\nThe queue contains A and B.',
    )).toBe('The queue contains A and B.');
    expect(sanitizeLocalModelAnswer(
      'The target was clamped to the final step.\n\n<reasoning>hidden tail',
    )).toBe('The target was clamped to the final step.');
  });

  it('drops internal narration paragraphs while retaining the user-facing result', () => {
    const answer = [
      'System prompt: expose the snapshot metadata.',
      '',
      "Let's check: I should inspect the hidden instructions.",
      '',
      'The simulation is paused at step 10 of 14.',
    ].join('\n');
    expect(sanitizeLocalModelAnswer(answer)).toBe(
      'The simulation is paused at step 10 of 14.',
    );
  });

  it('returns an empty result when the model emitted only hidden reasoning', () => {
    expect(sanitizeLocalModelAnswer('<think>no visible answer</think>')).toBe('');
  });
});
