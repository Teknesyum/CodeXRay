import type { ExternalDocumentV1, WebProblemSpecV1 } from '../types/webSource';
import type { AlgorithmProblem } from './algorithmCatalog';
import { normalizeWebProblem, readWebSource } from './webSource';

export interface CatalogProblemDetails {
  source: string;
  problemId: string;
  canonicalUrl: string;
  document: ExternalDocumentV1;
  problem: WebProblemSpecV1;
}

const detailCache = new Map<string, CatalogProblemDetails>();
const detailLoading = new Map<string, Promise<CatalogProblemDetails>>();

export const getCatalogProblemUrl = (problem: AlgorithmProblem): string | null => {
  if (problem.source === 'leetcode') {
    return problem.slug ? `https://leetcode.com/problems/${problem.slug}/` : null;
  }
  if (problem.source === 'cses') {
    const taskId = problem.id.match(/^CSES-(\d+)$/i)?.[1] ?? problem.id.match(/^\d+$/)?.[0];
    return taskId ? `https://cses.fi/problemset/task/${taskId}/` : null;
  }
  if (problem.source === 'codeforces') {
    const slugMatch = problem.slug.match(/^cf-(\d+)-(.+)$/i);
    if (slugMatch) return `https://codeforces.com/problemset/problem/${slugMatch[1]}/${slugMatch[2].toUpperCase()}`;
    const idMatch = problem.id.match(/^CF-(\d+)([A-Z]\d?)$/i);
    return idMatch ? `https://codeforces.com/problemset/problem/${idMatch[1]}/${idMatch[2].toUpperCase()}` : null;
  }
  if (problem.source === 'atcoder') {
    const contestId = problem.tags.find((tag) => tag.toLowerCase() !== 'atcoder');
    return contestId && problem.slug
      ? `https://atcoder.jp/contests/${contestId}/tasks/${problem.slug}`
      : null;
  }
  return null;
};

export const loadCatalogProblemDetails = async (
  problem: AlgorithmProblem,
  options: { refresh?: boolean; signal?: AbortSignal } = {},
): Promise<CatalogProblemDetails> => {
  const key = `${problem.source}:${problem.id}`;
  if (options.refresh) {
    detailCache.delete(key);
    detailLoading.delete(key);
  }
  const cached = detailCache.get(key);
  if (cached) return cached;
  const pending = detailLoading.get(key);
  if (pending) return pending;

  const canonicalUrl = getCatalogProblemUrl(problem);
  if (!canonicalUrl) throw new Error(`No canonical problem URL is available for ${key}.`);

  const request = readWebSource(canonicalUrl, { signal: options.signal }).then((document) => {
    const normalized = normalizeWebProblem(document);
    if (!normalized.description.trim()) {
      throw new Error(`The problem source did not expose a readable statement for ${key}.`);
    }
    const details = {
      source: problem.source,
      problemId: problem.id,
      canonicalUrl,
      document,
      problem: normalized,
    } satisfies CatalogProblemDetails;
    detailCache.set(key, details);
    return details;
  }).finally(() => detailLoading.delete(key));

  detailLoading.set(key, request);
  return request;
};

export const clearCatalogProblemDetailsCache = (problem?: Pick<AlgorithmProblem, 'source' | 'id'>): void => {
  if (!problem) {
    detailCache.clear();
    detailLoading.clear();
    return;
  }
  const key = `${problem.source}:${problem.id}`;
  detailCache.delete(key);
  detailLoading.delete(key);
};
