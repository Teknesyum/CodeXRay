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

  it('separates collapsed numbered steps and summary labels without changing code', () => {
    const answer = [
      'Çözüm: 1. İlk adımı uygula. 2. İkinci adımı uygula. 3. Sonucu döndür.',
      'Doğruluk: Her öğe bir kez işlenir. Karmaşıklık: O(n).',
      '',
      '```java',
      'double value = 2. 0;',
      '```',
    ].join('\n');
    const cleaned = sanitizeLocalModelAnswer(answer);

    expect(cleaned).toContain('**Çözüm:**\n\n1. İlk adımı uygula.\n2. İkinci adımı uygula.\n3. Sonucu döndür.');
    expect(cleaned).toContain('**Doğruluk:** Her öğe bir kez işlenir.');
    expect(cleaned).toContain('**Karmaşıklık:** O(n).');
    expect(cleaned).toContain('double value = 2. 0;');
  });

  it('repairs malformed emphasis around structural labels', () => {
    expect(sanitizeLocalModelAnswer(
      '****Doğruluk: Her düğüm işlenir.**Karmaşıklık: O(n).',
    )).toBe('**Doğruluk:** Her düğüm işlenir.\n\n**Karmaşıklık:** O(n).');
  });

  it('separates collapsed inline substeps into distinct bullet items', () => {
    const cleaned = sanitizeLocalModelAnswer(
      '4. **Uygulama:** - **Dış döngü:** Satırları gezer. - **İç döngü:** Sütunları gezer. - **Koşul:** Hücreyi işler.',
    );

    expect(cleaned).toContain([
      '4. **Uygulama:**',
      '   - **Dış döngü:** Satırları gezer.',
      '   - **İç döngü:** Sütunları gezer.',
      '   - **Koşul:** Hücreyi işler.',
    ].join('\n'));
  });

  it('removes accidental numbering before correctness and complexity labels', () => {
    expect(sanitizeLocalModelAnswer(
      '1. İlk adım. 2. İkinci adım. 5.Doğruluk: Sonuç geçerlidir. 6.Karmaşıklık: O(n).',
    )).toBe([
      '1. İlk adım.',
      '2. İkinci adım.',
      '',
      '**Doğruluk:** Sonuç geçerlidir.',
      '',
      '**Karmaşıklık:** O(n).',
    ].join('\n'));
  });
});
