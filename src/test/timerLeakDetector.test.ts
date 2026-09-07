import { describe, expect, it } from 'vitest';
import { installTimerLeakDetector, type TimerHandler, type TimerHost, type TimerId } from './timerLeakDetector';

const createHost = () => {
  const callbacks = new Map<TimerId, TimerHandler>();
  let nextId = 1;
  const host: TimerHost = {
    setInterval: (handler, _timeout, ..._args) => {
      const id = { node: nextId };
      nextId += 1;
      callbacks.set(id, handler);
      return id;
    },
    clearInterval: (id) => {
      callbacks.delete(id);
    },
  };
  return { host, callbacks };
};

describe('timer leak detector', () => {
  it('names the test that left an interval running', () => {
    const { host } = createHost();
    let testName = 'renders exactly five ordered stages';
    const detector = installTimerLeakDetector(host, () => testName, () => false);

    host.setInterval(() => undefined, 250);
    testName = 'a later, innocent test';

    const report = detector.collect();

    expect(report).toContain('1 interval timer(s) were still running when the test finished.');
    expect(report).toContain('every 250 ms, registered by: renders exactly five ordered stages');
    expect(report).toContain('ReferenceError: window is not defined');
    detector.uninstall();
  });

  it('reports nothing when every interval is cleared', () => {
    const { host } = createHost();
    const detector = installTimerLeakDetector(host, () => 'tidy test', () => false);

    const id = host.setInterval(() => undefined, 10);
    host.clearInterval(id);

    expect(detector.collect()).toBeNull();
    detector.uninstall();
  });

  it('reports each leaked interval once and then forgets it', () => {
    const { host } = createHost();
    const detector = installTimerLeakDetector(host, () => 'leaky test', () => false);

    host.setInterval(() => undefined, 5);
    host.setInterval(() => undefined, 7);

    expect(detector.collect()).toContain('2 interval timer(s)');
    expect(detector.collect()).toBeNull();
    detector.uninstall();
  });

  it('throws with the registering test name when a leaked interval fires after teardown', () => {
    const { host, callbacks } = createHost();
    let tornDown = false;
    let fired = 0;
    const detector = installTimerLeakDetector(host, () => 'the test that leaked', () => tornDown);

    const id = host.setInterval(() => { fired += 1; }, 250);
    const guarded = callbacks.get(id);

    guarded?.();
    expect(fired).toBe(1);

    tornDown = true;
    expect(() => guarded?.()).toThrowError(/leaked interval fired after its test environment was torn down/);
    expect(() => guarded?.()).toThrowError(/Registered by: the test that leaked \(every 250 ms\)/);
    expect(fired).toBe(1);

    detector.collect();
    detector.uninstall();
  });

  it('restores the host timers on uninstall', () => {
    const { host } = createHost();
    const original = host.setInterval;
    const detector = installTimerLeakDetector(host, () => 'x', () => false);

    expect(host.setInterval).not.toBe(original);
    detector.uninstall();
    expect(host.setInterval).toBe(original);
  });
});
