import { describe, expect, it } from 'vitest';
import { isInternalProblemCatalogVisible } from './internalFeatures';

describe('internal feature visibility', () => {
  it.each(['localhost', '127.0.0.1', '::1', '[::1]'])(
    'shows the problem catalog on the local development host %s',
    (hostname) => {
      expect(isInternalProblemCatalogVisible(hostname, true)).toBe(true);
    },
  );

  it('does not expose the catalog in a production build', () => {
    expect(isInternalProblemCatalogVisible('localhost', false)).toBe(false);
  });

  it('does not expose the catalog on a non-local development host', () => {
    expect(isInternalProblemCatalogVisible('serkanozel.me', true)).toBe(false);
  });
});
