const LOCAL_DEVELOPMENT_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  '[::1]',
]);

/**
 * The full problem catalog is an internal development aid. It is deliberately
 * absent from production builds; localhost alone must not enable it in a
 * production preview.
 */
export const isInternalProblemCatalogVisible = (
  hostname: string,
  isDevelopment: boolean,
): boolean => isDevelopment && LOCAL_DEVELOPMENT_HOSTS.has(hostname.trim().toLowerCase());
