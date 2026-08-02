export interface AlgorithmProblem {
  id: string;
  source: string;
  title: string;
  slug: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  category: string;
  derivedCategories?: string[];
  tags: string[];
}

const catalogCache = new Map<string, AlgorithmProblem[]>();
const catalogLoading = new Map<string, Promise<AlgorithmProblem[]>>();

function isValidSchema(data: any): data is AlgorithmProblem[] {
  if (!Array.isArray(data)) return false;
  for (const item of data) {
    if (!item || typeof item !== 'object') return false;
    if (typeof item.id !== 'string') return false;
    if (typeof item.source !== 'string') return false;
    if (typeof item.title !== 'string') return false;
    if (!Array.isArray(item.tags)) return false;
  }
  return true;
}

export const loadCatalog = async ({ source, retryCount = 0 }: { source: string; retryCount?: number }): Promise<AlgorithmProblem[]> => {
  if (catalogCache.has(source)) {
    return catalogCache.get(source)!;
  }

  if (catalogLoading.has(source)) {
    return catalogLoading.get(source)!;
  }

  const promise = (async () => {
    try {
      const baseUrl = import.meta.env?.BASE_URL || '/';
      const url = `${baseUrl}data/catalog/${source}.json`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to load catalog ${source}: ${response.statusText}`);
      }

      const data = await response.json();

      if (!isValidSchema(data)) {
        throw new Error(`Invalid schema for catalog ${source}`);
      }

      catalogCache.set(source, data);
      return data;
    } catch (e) {
      if (retryCount < 2) {
        console.warn(`Retrying loadCatalog for ${source}...`, e);
        catalogLoading.delete(source);
        return loadCatalog({ source, retryCount: retryCount + 1 });
      }
      throw e;
    } finally {
      if (catalogLoading.has(source)) {
        catalogLoading.delete(source);
      }
    }
  })();

  catalogLoading.set(source, promise);
  return promise;
};

export const getProblem = async ({ source, id }: { source: string; id: string }): Promise<AlgorithmProblem | null> => {
  const problems = await loadCatalog({ source });
  return problems.find(p => p.id === id) ?? null;
};

export const getProblemBySlug = async ({ source, slug }: { source: string; slug: string }): Promise<AlgorithmProblem | null> => {
  const problems = await loadCatalog({ source });
  return problems.find(p => p.slug === slug) ?? null;
};

export const getProblemsByDerivedCategory = async ({ source, category }: { source: string; category: string }): Promise<AlgorithmProblem[]> => {
  const problems = await loadCatalog({ source });
  return problems.filter(p => p.derivedCategories?.includes(category));
};

export const getRandomProblemByDerivedCategory = async ({ source, category }: { source: string; category: string }): Promise<AlgorithmProblem | null> => {
  const filtered = await getProblemsByDerivedCategory({ source, category });
  if (filtered.length === 0) return null;
  return filtered[Math.floor(Math.random() * filtered.length)];
};

export const clearCatalogCache = (source?: string) => {
  if (source) {
    catalogCache.delete(source);
    catalogLoading.delete(source);
  } else {
    catalogCache.clear();
    catalogLoading.clear();
  }
};
