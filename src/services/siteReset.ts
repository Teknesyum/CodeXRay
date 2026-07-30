const CODEXRAY_STORAGE_PREFIX = 'codexray.';
const INTERFACE_STORAGE_KEYS = [
  'codexray.layout.v1',
  'codexray.layout.v2',
] as const;

export const resetCodeXRaySiteState = (storage: Storage = localStorage): number => {
  const keysToRemove: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key?.startsWith(CODEXRAY_STORAGE_PREFIX)) keysToRemove.push(key);
  }
  for (const key of keysToRemove) storage.removeItem(key);
  return keysToRemove.length;
};

export const resetCodeXRayInterfaceState = (
  storage: Storage = localStorage,
): number => {
  let removed = 0;
  for (const key of INTERFACE_STORAGE_KEYS) {
    if (storage.getItem(key) === null) continue;
    storage.removeItem(key);
    removed += 1;
  }
  return removed;
};
