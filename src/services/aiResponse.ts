const normalize = (value: string): string =>
  value.toLocaleLowerCase().replace(/\s+/g, ' ').trim();

const stripInternalBlocks = (value: string): string => value
  .replace(/<(think|analysis|reasoning|system|developer)(?:\s[^>]*)?>[\s\S]*?<\/\1>/gi, '')
  .replace(/<(think|analysis|reasoning|system|developer)(?:\s[^>]*)?>[\s\S]*$/gi, '');

const startsWithInternalNarration = (value: string): boolean =>
  /^(?:reasoning|analysis|system prompt|system instructions?|developer instructions?|snapshot metadata|workspace snapshot|my task is|wait(?:\b|[,:])|let(?:'|’)s check(?:\b|[,:]))/i
    .test(value.trim());

const cleanProse = (value: string): string => {
  const seenSentences = new Set<string>();
  const cleanedParagraphs: string[] = [];

  for (const paragraph of stripInternalBlocks(value).split(/\n{2,}/)) {
    const trimmed = paragraph.trim();
    if (!trimmed || startsWithInternalNarration(trimmed)) continue;
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
  const segments = answer.split(/(```[\s\S]*?```)/g);
  const cleaned = segments
    .map((segment) => segment.startsWith('```') ? segment : cleanProse(segment))
    .filter(Boolean)
    .join('\n\n')
    .trim();
  return cleaned;
};

