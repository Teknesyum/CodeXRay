import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const loadFresh = async () => {
  vi.resetModules();
  const translations = await import('../i18n/translations');
  const context = await import('./TimelineContext');
  return { ...translations, ...context };
};

describe('TimelineProvider runtime text gate', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it('withholds children in Turkish until the runtime table is loaded, then renders them', async () => {
    localStorage.setItem('codexray.locale', 'tr');
    const { TimelineProvider, isRuntimeTextReady, translateRuntimeText, useTimeline } = await loadFresh();
    expect(isRuntimeTextReady('tr')).toBe(false);

    const Probe = () => {
      const { locale } = useTimeline();
      return <output data-testid="probe">{translateRuntimeText('split depth 2', locale)}</output>;
    };

    render(
      <TimelineProvider>
        <Probe />
      </TimelineProvider>,
    );

    expect(screen.queryByTestId('probe')).toBeNull();
    const probe = await screen.findByTestId('probe');
    expect(probe).toHaveTextContent('bölünme derinliği 2');
    expect(isRuntimeTextReady('tr')).toBe(true);
  });

  it('renders children immediately in English and loads the table before switching to Turkish', async () => {
    localStorage.setItem('codexray.locale', 'en');
    const { TimelineProvider, isRuntimeTextReady, translateRuntimeText, useTimeline } = await loadFresh();

    const Probe = () => {
      const { locale, setLocale } = useTimeline();
      return (
        <>
          <output data-testid="probe">{translateRuntimeText('split depth 2', locale)}</output>
          <button type="button" onClick={() => setLocale('tr')}>tr</button>
        </>
      );
    };

    render(
      <TimelineProvider>
        <Probe />
      </TimelineProvider>,
    );

    expect(screen.getByTestId('probe')).toHaveTextContent('split depth 2');
    expect(isRuntimeTextReady('tr')).toBe(false);

    await act(async () => {
      screen.getByRole('button', { name: 'tr' }).click();
    });
    await screen.findByText('bölünme derinliği 2');
    expect(isRuntimeTextReady('tr')).toBe(true);
  });
});
