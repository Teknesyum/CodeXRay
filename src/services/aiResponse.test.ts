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
});
