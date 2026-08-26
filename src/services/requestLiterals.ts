export const extractQuotedLiteral = (request: string): string | null =>
  request.match(/["“]([^"”]*)["”]/)?.[1] ?? null;

export const extractNumericArrayLiteral = (request: string): number[] | null => {
  const raw = request.match(/\[[^\]]*\]/)?.[0];
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      && parsed.every((value) => typeof value === 'number' && Number.isFinite(value))
      ? parsed : null;
  } catch {
    return null;
  }
};
