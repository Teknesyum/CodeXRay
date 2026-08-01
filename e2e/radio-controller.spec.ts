import { expect, test } from '@playwright/test';

test('honors confirmed playback, transport, audio, loop, and minimize contracts', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('codexray.locale', 'en');
    localStorage.setItem('codexray.radio.autoplay', 'true');
    localStorage.setItem('codexray.radio.minimizeSeconds', '16');
    type Events = {
      onReady: (event: { target: RadioPlayer }) => void;
      onStateChange?: (event: { data: number; target: RadioPlayer }) => void;
      onError?: (event: { data: number; target: RadioPlayer }) => void;
      onAutoplayBlocked?: (event: { target: RadioPlayer }) => void;
    };
    const target = window as Window & {
      __radioCalls: { play: number; at: number[]; shuffle: boolean[]; volume: number[]; load: string[]; mute: number; unmute: number };
      __blockAutoplay: () => void;
      __confirmPlayback: () => void;
      __endTrack: () => void;
      YT?: { Player: typeof RadioPlayer };
    };
    target.__radioCalls = { play: 0, at: [], shuffle: [], volume: [], load: [], mute: 0, unmute: 0 };
    target.__blockAutoplay = () => undefined;
    target.__confirmPlayback = () => undefined;
    target.__endTrack = () => undefined;

    class RadioPlayer {
      private state = -1;
      private index = 0;
      private muted = false;
      private readonly events: Events;
      private readonly tracks = [
        { title: 'Up', video_id: '8zj8h15VmQw' },
        { title: 'Imitation', video_id: 'YHH7NKb8m5c' },
        { title: 'Demons', video_id: 'gNp624IXWI4' },
      ];
      constructor(_element: HTMLIFrameElement, options: { events: Events }) {
        this.events = options.events;
        target.__blockAutoplay = () => this.events.onAutoplayBlocked?.({ target: this });
        target.__confirmPlayback = () => {
          this.state = 1;
          this.events.onStateChange?.({ data: 1, target: this });
        };
        target.__endTrack = () => {
          this.state = 0;
          this.index = (this.index + 1) % this.tracks.length;
          this.events.onStateChange?.({ data: 0, target: this });
        };
        queueMicrotask(() => this.events.onReady({ target: this }));
      }
      destroy() {}
      isMuted() { return this.muted; }
      mute() { this.muted = true; target.__radioCalls.mute += 1; }
      unMute() { this.muted = false; target.__radioCalls.unmute += 1; }
      setVolume(value: number) { target.__radioCalls.volume.push(value); }
      setLoop() {}
      setShuffle(value: boolean) { target.__radioCalls.shuffle.push(value); }
      pauseVideo() { this.state = 2; this.events.onStateChange?.({ data: 2, target: this }); }
      playVideo() { target.__radioCalls.play += 1; }
      getPlayerState() { return this.state; }
      nextVideo() { this.index = (this.index + 1) % this.tracks.length; this.state = 1; this.events.onStateChange?.({ data: 1, target: this }); }
      previousVideo() { this.index = (this.index + this.tracks.length - 1) % this.tracks.length; this.state = 1; this.events.onStateChange?.({ data: 1, target: this }); }
      getPlaylist() { return this.tracks.map((track) => track.video_id); }
      getPlaylistIndex() { return this.index; }
      getVideoData() { return this.tracks[this.index]; }
      playVideoAt(index: number) {
        target.__radioCalls.at.push(index);
        this.index = index;
        this.state = 1;
        this.events.onStateChange?.({ data: 1, target: this });
      }
      getCurrentTime() { return 0; }
      getDuration() { return 191; }
      seekTo() {}
      loadPlaylist(options: { list: string }) { target.__radioCalls.load.push(options.list); }
    }
    Object.defineProperty(target, 'YT', { configurable: true, value: { Player: RadioPlayer } });
  });

  await page.goto('/');
  const radio = page.getByRole('complementary', { name: 'Radio' });
  await expect(radio).toBeVisible();
  await expect(radio.locator('button[title="Play"]')).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as Window & { __radioCalls: { play: number } }).__radioCalls.play)).toBeGreaterThan(0);
  const callsBeforeRetry = await page.evaluate(() => (window as Window & { __radioCalls: { play: number } }).__radioCalls.play);
  await page.evaluate(() => (window as Window & { __blockAutoplay: () => void }).__blockAutoplay());
  await expect(radio.getByRole('status')).toContainText('blocked by the browser');
  await expect(radio.locator('button[title="Play"]')).toBeVisible();
  await page.mouse.click(2, 2);
  await expect.poll(() => page.evaluate(() => (window as Window & { __radioCalls: { play: number } }).__radioCalls.play)).toBeGreaterThan(callsBeforeRetry);
  await page.evaluate(() => (window as Window & { __confirmPlayback: () => void }).__confirmPlayback());
  await expect(radio.locator('button[title="Pause"]')).toBeVisible();

  await radio.locator('button[title="Next track"]').click();
  await expect(radio.getByText('Imitation', { exact: true }).first()).toBeVisible();
  await radio.locator('button[title="Previous track"]').click();
  await expect(radio.getByText('Up — CDK', { exact: true }).first()).toBeVisible();
  await radio.locator('button[title="Shuffle"]').click();
  await expect.poll(() => page.evaluate(() => (window as Window & { __radioCalls: { shuffle: boolean[] } }).__radioCalls.shuffle.at(-1))).toBe(true);

  await radio.getByLabel('Radio volume').fill('60');
  await expect(radio.getByText('60%', { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as Window & { __radioCalls: { volume: number[] } }).__radioCalls.volume.at(-1))).toBe(60);
  await radio.getByRole('button', { name: 'Mute radio' }).click();
  await expect(radio.getByRole('button', { name: 'Unmute radio' })).toBeVisible();

  const loop = radio.locator('button[title="Loop current track"]');
  await expect(loop).toHaveAttribute('aria-pressed', 'true');
  await loop.click();
  await expect(loop).toHaveAttribute('aria-pressed', 'false');
  await page.evaluate(() => (window as Window & { __endTrack: () => void }).__endTrack());
  await expect(radio.getByText('Imitation', { exact: true }).first()).toBeVisible();
  expect(await page.evaluate(() => (window as Window & { __radioCalls: { at: number[] } }).__radioCalls.at)).toEqual([]);

  await loop.click();
  await page.evaluate(() => (window as Window & { __confirmPlayback: () => void }).__confirmPlayback());
  await page.evaluate(() => (window as Window & { __endTrack: () => void }).__endTrack());
  await expect.poll(() => page.evaluate(() => (window as Window & { __radioCalls: { at: number[] } }).__radioCalls.at)).toEqual([1]);
  await expect(radio.getByText('Imitation', { exact: true }).first()).toBeVisible();

  await radio.dispatchEvent('mouseleave');
  await page.waitForTimeout(1_100);
  await expect(radio).toBeVisible();
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: /Radio Settings/ }).click();
  const minimizeSection = page.locator('.settings-section').filter({ hasText: 'Automatic minimize delay' });
  await minimizeSection.locator('input[type="range"]').fill('1');
  const preset = page.getByRole('button', { name: 'Synthwave & Retrowave' });
  await preset.click();
  await expect.poll(() => page.evaluate(() => (window as Window & { __radioCalls: { load: string[] } }).__radioCalls.load.at(-1)))
    .toBe('PLOtNYlNIGer0jmWpFtTWqMkfP56iuZg1w');
  const customPlaylist = page.locator('.custom-playlist-input');
  await customPlaylist.fill('https://www.youtube.com/playlist?list=PL_CUSTOM_FAST_LOAD');
  await customPlaylist.locator('xpath=following-sibling::button').click();
  await expect.poll(() => page.evaluate(() => (window as Window & { __radioCalls: { load: string[] } }).__radioCalls.load.at(-1)))
    .toBe('PL_CUSTOM_FAST_LOAD');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('codexray.radio.playlist')))
    .toContain('PL_CUSTOM_FAST_LOAD');
  await page.getByRole('button', { name: 'Close settings' }).click();
  await radio.hover();
  await page.mouse.move(0, 0);
  await expect(radio.locator('.countdown-ring')).toBeVisible();
  await page.waitForTimeout(250);
  await radio.hover();
  await expect(radio.locator('.countdown-ring')).toBeHidden();
  await page.waitForTimeout(1_100);
  await expect(radio).toBeVisible();
  await page.mouse.move(0, 0);
  await expect(radio.locator('.countdown-ring')).toBeVisible();
  await page.waitForTimeout(650);
  await expect(radio).toBeVisible();
  await expect(radio).toBeHidden({ timeout: 2_000 });
  await expect(page.getByRole('button', { name: 'Open CodeXRay Radio' })).toBeVisible();
});
