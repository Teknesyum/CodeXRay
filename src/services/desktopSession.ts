const SESSION_MARKER_KEY = 'codexray.desktop-session.active.v1';
const TRANSIENT_LOCAL_KEYS = [
  'codexray.ai-chat.v1',
  'codexray.workspace.v1',
  'codexray.pinned-variables.v1',
] as const;

export const beginDesktopSession = (
  desktop: boolean,
  persistentStorage: Storage = localStorage,
  transientStorage: Storage = sessionStorage,
): boolean => {
  if (!desktop || transientStorage.getItem(SESSION_MARKER_KEY) !== null) return false;
  for (const key of TRANSIENT_LOCAL_KEYS) persistentStorage.removeItem(key);
  transientStorage.clear();
  transientStorage.setItem(SESSION_MARKER_KEY, '1');
  return true;
};
