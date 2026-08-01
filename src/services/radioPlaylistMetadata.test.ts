import { describe, expect, it } from 'vitest';
import {
  getEmbeddedRadioPlaylist,
  getRadioPlaybackVideoId,
  getRadioTrackTitle,
} from './radioPlaylistMetadata';

const DEFAULT_PLAYLIST_ID = 'OLAK5uy_kojiLJf49fStilkx_cFUhxqoDXzcSyfg0';

describe('radioPlaylistMetadata', () => {
  it('provides the complete default playlist without waiting for YouTube', () => {
    const playlist = getEmbeddedRadioPlaylist(DEFAULT_PLAYLIST_ID);

    expect(playlist).toHaveLength(45);
    expect(playlist[0]).toEqual({ id: '8zj8h15VmQw', title: 'Up' });
    expect(playlist).toContainEqual({ id: 'YHH7NKb8m5c', title: 'Imitation' });
    expect(playlist).not.toContainEqual({ id: '-Yk1p0OevRw', title: 'Push' });
  });

  it('does not claim metadata for a custom playlist', () => {
    expect(getEmbeddedRadioPlaylist('custom-playlist')).toEqual([]);
    expect(getRadioTrackTitle('custom-playlist', '8zj8h15VmQw')).toBeUndefined();
  });

  it('uses the embeddable artist upload for the Demons playlist item', () => {
    const demons = getEmbeddedRadioPlaylist(DEFAULT_PLAYLIST_ID)
      .find(({ title }) => title === 'Demons');

    expect(demons?.id).toBe('SX69IjN7PLc');
    expect(getRadioPlaybackVideoId(DEFAULT_PLAYLIST_ID, demons?.id || ''))
      .toBe('gNp624IXWI4');
  });

  it('does not rewrite unrelated videos or custom playlists', () => {
    expect(getRadioPlaybackVideoId(DEFAULT_PLAYLIST_ID, 'YHH7NKb8m5c'))
      .toBe('YHH7NKb8m5c');
    expect(getRadioPlaybackVideoId('custom-playlist', 'SX69IjN7PLc'))
      .toBe('SX69IjN7PLc');
  });
});
