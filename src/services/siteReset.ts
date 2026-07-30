const CODEXRAY_STORAGE_PREFIX = 'codexray.';

export const resetCodeXRaySiteState = (storage: Storage = localStorage): number => {
  const keysToRemove: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key?.startsWith(CODEXRAY_STORAGE_PREFIX)) keysToRemove.push(key);
  }
  for (const key of keysToRemove) storage.removeItem(key);
  return keysToRemove.length;
};

