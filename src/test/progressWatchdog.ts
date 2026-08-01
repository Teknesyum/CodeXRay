export type ProgressTerminalState = 'ready' | 'failed';

export interface ProgressWatchdogSnapshot {
  progress: number | null;
  status: string;
  terminal?: ProgressTerminalState;
}

interface WaitForProgressOptions {
  readSnapshot: () => Promise<ProgressWatchdogSnapshot>;
  inactivityTimeoutMs: number;
  pollIntervalMs: number;
  onChange?: (snapshot: ProgressWatchdogSnapshot) => void;
  now?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
}

const formatSnapshot = ({ progress, status }: ProgressWatchdogSnapshot) =>
  `${progress === null ? 'unknown' : `${progress}%`} — ${status || 'no status text'}`;

export const waitForProgressTerminalState = async ({
  readSnapshot,
  inactivityTimeoutMs,
  pollIntervalMs,
  onChange,
  now = Date.now,
  sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
}: WaitForProgressOptions): Promise<ProgressWatchdogSnapshot> => {
  const startedAt = now();
  let lastActivityAt = startedAt;
  let lastFingerprint = '';
  let lastSnapshot: ProgressWatchdogSnapshot = { progress: null, status: 'not observed' };
  const changes: string[] = [];

  while (true) {
    const snapshot = await readSnapshot();
    const observedAt = now();
    const fingerprint = JSON.stringify([snapshot.progress, snapshot.status, snapshot.terminal]);

    if (fingerprint !== lastFingerprint) {
      lastFingerprint = fingerprint;
      lastActivityAt = observedAt;
      lastSnapshot = snapshot;
      changes.push(`${observedAt - startedAt}ms: ${formatSnapshot(snapshot)}`);
      if (changes.length > 8) changes.shift();
      onChange?.(snapshot);
    }

    if (snapshot.terminal) return snapshot;

    if (observedAt - lastActivityAt >= inactivityTimeoutMs) {
      throw new Error(
        `No model initialization progress for ${inactivityTimeoutMs}ms. `
        + `Last observation: ${formatSnapshot(lastSnapshot)}. `
        + `Changes: ${changes.join(' | ') || 'none'}`,
      );
    }

    await sleep(pollIntervalMs);
  }
};
