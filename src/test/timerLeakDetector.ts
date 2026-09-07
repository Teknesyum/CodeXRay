export type TimerHandler = (...args: unknown[]) => void;

export type TimerId = unknown;

export interface TimerHost {
  setInterval: (handler: TimerHandler, timeout?: number, ...args: unknown[]) => TimerId;
  clearInterval: (id?: TimerId) => void;
}

export interface TimerLeakDetector {
  collect: () => string | null;
  uninstall: () => void;
}

interface Registration {
  test: string;
  delay: number;
  stack: string;
}

const describeLeak = (leaks: Registration[]): string => {
  const lines = leaks.map((leak) => `  every ${leak.delay} ms, registered by: ${leak.test}`);
  return [
    `${leaks.length} interval timer(s) were still running when the test finished.`,
    'An interval that outlives its test keeps firing after the jsdom environment is torn down,',
    'which surfaces as an ownerless "ReferenceError: window is not defined" on an unrelated file.',
    ...lines,
    '',
    leaks[0].stack,
  ].join('\n');
};

export const installTimerLeakDetector = (
  host: TimerHost,
  currentTestName: () => string,
  isEnvironmentTornDown: () => boolean,
): TimerLeakDetector => {
  const live = new Map<TimerId, Registration>();
  const originalSetInterval = host.setInterval;
  const originalClearInterval = host.clearInterval;

  host.setInterval = (handler: TimerHandler, timeout?: number, ...args: unknown[]): TimerId => {
    const registration: Registration = {
      test: currentTestName(),
      delay: timeout ?? 0,
      stack: new Error('interval registered here').stack ?? '<no stack>',
    };
    const guarded = (...callbackArgs: unknown[]): void => {
      if (isEnvironmentTornDown()) {
        throw new Error(
          [
            'A leaked interval fired after its test environment was torn down.',
            `Registered by: ${registration.test} (every ${registration.delay} ms)`,
            '',
            registration.stack,
          ].join('\n'),
        );
      }
      if (typeof handler === 'function') handler(...callbackArgs);
    };
    const id = originalSetInterval(guarded, timeout, ...args);
    live.set(id, registration);
    return id;
  };

  host.clearInterval = (id?: TimerId): void => {
    live.delete(id);
    originalClearInterval(id);
  };

  return {
    collect: () => {
      if (live.size === 0) return null;
      const leaks = [...live.values()];
      live.clear();
      return describeLeak(leaks);
    },
    uninstall: () => {
      host.setInterval = originalSetInterval;
      host.clearInterval = originalClearInterval;
      live.clear();
    },
  };
};
