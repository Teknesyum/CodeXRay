import { expect, test } from '@playwright/test';

test('confirms autoplay, routes Demons to its embeddable upload, and surfaces player errors', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('codexray.locale', 'en');
    localStorage.setItem('codexray.radio.autoplay', 'true');
    localStorage.setItem('codexray.radio.minimizeSeconds', '16');

    type PlayerEvents = {
      onReady: (event: { target: MockPlayer }) => void;
      onStateChange?: (event: { data: number; target: MockPlayer }) => void;
      onError?: (event: { data: number; target: MockPlayer }) => void;
    };
    const radioWindow = window as Window & {
      __radioPlayCalls: number;
      __confirmRadioPlay: () => void;
      __endRadioTrack: () => void;
      __radioPlayAtIndices: number[];
      __radioSeekCalls: number[];
      __failRadioWithError: (code: number) => void;
      YT?: { Player: typeof MockPlayer };
    };
    radioWindow.__radioPlayCalls = 0;
    radioWindow.__confirmRadioPlay = () => undefined;
    radioWindow.__endRadioTrack = () => undefined;
    radioWindow.__radioPlayAtIndices = [];
    radioWindow.__radioSeekCalls = [];
    radioWindow.__failRadioWithError = () => undefined;

    class MockPlayer {
      private state = -1;
      private index = 0;
      private playlist = ['8zj8h15VmQw', 'YHH7NKb8m5c', 'gNp624IXWI4'];
      private readonly events: PlayerEvents;

      constructor(_element: HTMLIFrameElement, options: { events: PlayerEvents }) {
        this.events = options.events;
        radioWindow.__confirmRadioPlay = () => {
          this.state = 1;
          this.events.onStateChange?.({ data: 1, target: this });
        };
        radioWindow.__endRadioTrack = () => {
          this.state = 0;
          this.index = 1;
          this.events.onStateChange?.({ data: 0, target: this });
        };
        radioWindow.__failRadioWithError = (code: number) => {
          this.state = -1;
          this.events.onError?.({ data: code, target: this });
        };
        window.setTimeout(() => this.events.onReady({ target: this }), 0);
      }

      destroy() {}
      isMuted() { return false; }
      mute() {}
      unMute() {}
      setVolume(_volume: number) {}
      setLoop(_loop: boolean) {}
      setShuffle(_shuffle: boolean) {}
      pauseVideo() {
        this.state = 2;
        this.events.onStateChange?.({ data: 2, target: this });
      }
      playVideo() {
        radioWindow.__radioPlayCalls += 1;
      }
      getPlayerState() { return this.state; }
      nextVideo() {}
      previousVideo() {}
      getPlaylist() { return this.playlist; }
      getPlaylistIndex() { return this.index; }
      getVideoData() {
        const tracks = [
          { title: 'Up', video_id: '8zj8h15VmQw' },
          { title: 'Imitation', video_id: 'YHH7NKb8m5c' },
          { title: 'Demons', video_id: 'gNp624IXWI4' },
        ];
        return tracks[this.index] || tracks[0];
      }
      playVideoAt(index: number) {
        radioWindow.__radioPlayAtIndices.push(index);
        this.index = index;
        this.state = 1;
        this.events.onStateChange?.({ data: 1, target: this });
      }
      getCurrentTime() { return 0; }
      getDuration() { return 191; }
      seekTo(seconds: number, _allowSeekAhead: boolean) {
        radioWindow.__radioSeekCalls.push(seconds);
      }
      loadPlaylist(_args: { listType: string; list: string; index?: number }) {}
    }

    Object.defineProperty(radioWindow, 'YT', {
      configurable: true,
      value: { Player: MockPlayer },
    });
  });

  await page.goto('/');
  const radio = page.getByRole('complementary', { name: 'Radio' });
  await expect(radio).toBeVisible();
  await expect(page.getByTitle('CodeXRay YouTube playlist player')).toHaveAttribute(
    'src',
    /playlist=.*gNp624IXWI4/,
  );
  await expect(page.getByTitle('CodeXRay YouTube playlist player')).not.toHaveAttribute(
    'src',
    /SX69IjN7PLc/,
  );
  await expect(page.getByTitle('CodeXRay YouTube playlist player')).not.toHaveAttribute(
    'src',
    /-Yk1p0OevRw/,
  );
  await expect(radio.getByText('Push', { exact: true })).toHaveCount(0);
  await expect(radio.locator('button[title="Play"]')).toBeVisible();
  await expect.poll(() => page.evaluate(() => (
    window as Window & { __radioPlayCalls: number }
  ).__radioPlayCalls)).toBeGreaterThan(0);
  await page.evaluate(() => (
    window as Window & { __confirmRadioPlay: () => void }
  ).__confirmRadioPlay());
  await expect(radio.locator('button[title="Pause"]')).toBeVisible();

  await page.evaluate(() => (
    window as Window & { __endRadioTrack: () => void }
  ).__endRadioTrack());
  await expect.poll(() => page.evaluate(() => (
    window as Window & { __radioPlayAtIndices: number[] }
  ).__radioPlayAtIndices)).toEqual([0]);
  expect(await page.evaluate(() => (
    window as Window & { __radioSeekCalls: number[] }
  ).__radioSeekCalls)).toEqual([]);
  await expect(radio.locator('button[title="Pause"]')).toBeVisible();

  await radio.getByRole('button', { name: /3 thumb Demons/ }).click();
  await expect.poll(() => page.evaluate(() => (
    window as Window & { __radioPlayAtIndices: number[] }
  ).__radioPlayAtIndices)).toEqual([0, 2]);
  await expect(radio.getByText('Demons', { exact: true }).first()).toBeVisible();
  await expect(radio.locator('button[title="Pause"]')).toBeVisible();

  await page.evaluate(() => (
    window as Window & { __failRadioWithError: (code: number) => void }
  ).__failRadioWithError(150));
  await expect(radio.getByRole('status')).toContainText('error 150');
  await expect(radio.getByRole('status')).toHaveAttribute('data-youtube-error-code', '150');
  await expect(radio.locator('button[title="Play"]')).toBeVisible();
});
