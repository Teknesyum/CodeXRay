import { expect, test } from '@playwright/test';

test('autoplay opens the radio, requests playback, and reflects the confirmed player state', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('codexray.locale', 'en');
    localStorage.setItem('codexray.radio.autoplay', 'true');
    localStorage.setItem('codexray.radio.minimizeSeconds', '16');

    type PlayerEvents = {
      onReady: (event: { target: MockPlayer }) => void;
      onStateChange?: (event: { data: number; target: MockPlayer }) => void;
    };
    const radioWindow = window as Window & {
      __radioPlayCalls: number;
      __confirmRadioPlay: () => void;
      __endRadioTrack: () => void;
      __radioPlayAtIndices: number[];
      __radioSeekCalls: number[];
      YT?: { Player: typeof MockPlayer };
    };
    radioWindow.__radioPlayCalls = 0;
    radioWindow.__confirmRadioPlay = () => undefined;
    radioWindow.__endRadioTrack = () => undefined;
    radioWindow.__radioPlayAtIndices = [];
    radioWindow.__radioSeekCalls = [];

    class MockPlayer {
      private state = -1;
      private index = 0;
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
      getPlaylist() { return ['8zj8h15VmQw', 'next-track']; }
      getPlaylistIndex() { return this.index; }
      getVideoData() { return { title: this.index === 0 ? 'Up' : 'Next', video_id: this.index === 0 ? '8zj8h15VmQw' : 'next-track' }; }
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
      loadPlaylist(_args: { listType: string; list: string }) {}
    }

    Object.defineProperty(radioWindow, 'YT', {
      configurable: true,
      value: { Player: MockPlayer },
    });
  });

  await page.goto('/');
  const radio = page.getByRole('complementary', { name: 'Radio' });
  await expect(radio).toBeVisible();
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
});
