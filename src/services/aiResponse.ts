const normalize = (value: string): string =>
  value.toLocaleLowerCase().replace(/\s+/g, ' ').trim();

const stripInternalBlocks = (value: string): string => value
  .replace(/<(think|analysis|reasoning|system|developer)(?:\s[^>]*)?>[\s\S]*?<\/\1>/gi, '')
  .replace(/<(think|analysis|reasoning|system|developer)(?:\s[^>]*)?>[\s\S]*$/gi, '');

export interface SplitModelAnswer {
  content: string;
  reasoning: string;
}

export const splitLocalModelAnswer = (answer: string): SplitModelAnswer => {
  const reasoning = [...answer.matchAll(
    /<(think|analysis|reasoning)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi,
  )]
    .map((match) => match[2].trim())
    .filter(Boolean)
    .join('\n\n');
  return {
    content: sanitizeLocalModelAnswer(answer),
    reasoning,
  };
};

const startsWithInternalNarration = (value: string): boolean =>
  /^(?:reasoning|analysis|system prompt|system instructions?|developer instructions?|snapshot metadata|workspace snapshot|my task is|wait(?:\b|[,:])|let(?:'|’)s check(?:\b|[,:]))/i
    .test(value.trim());

const normalizeProseLayout = (value: string): string => {
  let formatted = value.replace(
    /[ \t]*(?:\d{1,2}\.[ \t]*)?\*{0,4}(Çözüm|Solution|Doğruluk|Correctness|Karmaşıklık|Complexity|Zaman Karmaşıklığı|Alan Karmaşıklığı):\*{0,4}[ \t]*/gi,
    (_match, label: string, offset: number) => {
      const precedingText = value.slice(0, offset).trimEnd();
      const separator = precedingText && !precedingText.endsWith('\n') ? '\n\n' : '';
      return `${separator}**${label}:** `;
    },
  );
  const numberedMarkers = formatted.match(/(?:^|\s)\d{1,2}\.\s+/g) ?? [];
  if (numberedMarkers.length >= 2) {
    formatted = formatted
      .replace(/(\*\*(?:Çözüm|Solution):\*\*)[ \t]*(?=\d{1,2}\.[ \t]+)/gi, '$1\n\n')
      .replace(/([^\n])[ \t]+(?=\d{1,2}\.[ \t]+)/g, '$1\n');
  }
  const inlineBulletMarkers = formatted.match(
    /[ \t]+-[ \t]+(?=(?:\*\*)?[A-ZÇĞİÖŞÜ])/gu,
  ) ?? [];
  if (inlineBulletMarkers.length >= 2) {
    formatted = formatted.replace(
      /([^\n])[ \t]+(?=-[ \t]+(?=(?:\*\*)?[A-ZÇĞİÖŞÜ]))/gu,
      '$1\n   ',
    );
  }
  return formatted;
};

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
    .map((segment) => segment.startsWith('```') ? segment : normalizeProseLayout(cleanProse(segment)))
    .filter(Boolean)
    .join('\n\n')
    .trim();
  return cleaned;
};

