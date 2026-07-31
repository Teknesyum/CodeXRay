const normalize = (value: string): string =>
  value.toLocaleLowerCase().replace(/\s+/g, ' ').trim();

const cleanProse = (value: string): string => {
  const seenSentences = new Set<string>();
  const cleanedParagraphs: string[] = [];

  for (const paragraph of value.split(/\n{2,}/)) {
    const trimmed = paragraph.trim();
    if (!trimmed) continue;
    const sentences = trimmed.split(/(?<=[.!?])\s+/);
    const uniqueSentences = sentences.filter((sentence) => {
      const key = normalize(sentence);
      if (!key || seenSentences.has(key)) return false;
      seenSentences.add(key);
      return true;
    });
    if (uniqueSentences.length) cleanedParagraphs.push(uniqueSentences.join(' '));
  }

  const last = cleanedParagraphs.at(-1);
  if (last && !/[.!?;:`)\]}]$/.test(last)) {
    const normalizedLast = normalize(last);
    const duplicatesEarlierStart = cleanedParagraphs
      .slice(0, -1)
      .some((paragraph) => normalize(paragraph).startsWith(normalizedLast));
    if (duplicatesEarlierStart) cleanedParagraphs.pop();
  }

  return cleanedParagraphs.join('\n\n');
};

export const sanitizeLocalModelAnswer = (answer: string): string => {
  // DeepSeek R1 gibi modellerin <think> bloklarını tamamen kaldır.
  const withoutThink = answer.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

  const segments = withoutThink.split(/(```[\s\S]*?```)/g);
  const cleaned = segments
    .map((segment) => segment.startsWith('```') ? segment : cleanProse(segment))
    .filter(Boolean)
    .join('\n\n')
    .trim();
  return cleaned || withoutThink.trim();
};

