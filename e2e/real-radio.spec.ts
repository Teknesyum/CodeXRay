import { expect, test } from '@playwright/test';

const TRACK_TIMEOUT_MS = 8_000;

interface TrackAuditResult {
  index: number;
  label: string;
  title: string;
  status: 'playing' | 'error' | 'timeout';
  notice: string;
}

test.describe('real YouTube radio playlist', () => {
  test.skip(
    process.env.CODEXRAY_REAL_RADIO !== '1',
    'Run explicitly with npm run test:e2e:radio-live.',
  );

  test('every embedded default track reaches confirmed playback', async ({ page }) => {
    test.setTimeout(8 * 60 * 1_000);

    await page.addInitScript(() => {
      localStorage.setItem('codexray.locale', 'en');
      localStorage.setItem('codexray.radio.autoplay', 'true');
      localStorage.setItem('codexray.radio.minimizeSeconds', '16');
    });
    await page.goto('/');

    const radio = page.getByRole('complementary', { name: 'Radio' });
    await expect(radio).toBeVisible();
    await expect(radio.locator('.mute-btn')).toBeEnabled({ timeout: 20_000 });

    const items = radio.locator('.playlist-item');
    // The curated queue intentionally excludes Push because both known
    // official uploads reject iframe playback. Keep this assertion explicit so
    // a metadata regression cannot silently shrink the audited queue.
    await expect(items).toHaveCount(45);
    const labels = await items.allTextContents();
    const results: TrackAuditResult[] = [];
    const startIndex = Math.max(0, Number(process.env.CODEXRAY_RADIO_START || 0));
    const requestedLimit = Number(process.env.CODEXRAY_RADIO_LIMIT || labels.length);
    const endIndex = Math.min(labels.length, startIndex + requestedLimit);
    const noticeLocator = radio.locator('.radio-playback-notice');
    const readNotice = async () => (await noticeLocator.count()) > 0
      ? (await noticeLocator.textContent())?.trim() || ''
      : '';

    for (let index = startIndex; index < endIndex; index += 1) {
      await items.nth(index).click();
      const deadline = Date.now() + TRACK_TIMEOUT_MS;
      let result: TrackAuditResult | undefined;
      let autoplayRetried = false;

      while (Date.now() < deadline) {
        const notice = await readNotice();
        const activeIndex = await items.evaluateAll((buttons) =>
          buttons.findIndex((button) => button.classList.contains('active')));
        const isPlaying = await radio.locator('button[title="Pause"]').isVisible();
        const currentTitle = (await radio.locator('.track-info').textContent())?.trim() || '';

        if (/blocked by the browser/i.test(notice) && !autoplayRetried) {
          autoplayRetried = true;
          const play = radio.locator('button[title="Play"]');
          if (await play.isVisible()) await play.click();
          await page.waitForTimeout(150);
          continue;
        }
        if (notice) {
          result = {
            index: index + 1,
            label: labels[index].trim(),
            title: (await radio.locator('.track-info').textContent())?.trim() || '',
            status: 'error',
            notice,
          };
          break;
        }
        // PlaylistRadio clears isPlaying before playVideoAt. Seeing Pause here
        // therefore proves that YouTube emitted a fresh PLAYING event for this
        // selection; it cannot be inherited from the previous track.
        if (activeIndex === index && isPlaying) {
          await page.waitForTimeout(300);
          const lateNotice = await readNotice();
          result = {
            index: index + 1,
            label: labels[index].trim(),
            title: currentTitle,
            status: lateNotice ? 'error' : 'playing',
            notice: lateNotice,
          };
          break;
        }
        await page.waitForTimeout(150);
      }

      const completedResult = result || {
        index: index + 1,
        label: labels[index].trim(),
        title: (await radio.locator('.track-info').textContent())?.trim() || '',
        status: 'timeout',
        notice: '',
      };
      results.push(completedResult);
      console.log(`[radio-live] ${JSON.stringify(completedResult)}`);
    }

    const failures = results.filter(({ status }) => status !== 'playing');
    console.log(`[radio-live] ${JSON.stringify(results, null, 2)}`);
    expect(failures, `Unplayable radio tracks:\n${JSON.stringify(failures, null, 2)}`).toEqual([]);
  });
});
