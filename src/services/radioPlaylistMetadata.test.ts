import { describe, expect, it } from 'vitest';
import {
  getEmbeddedRadioPlaylist,
  getRadioTrackTitle,
} from './radioPlaylistMetadata';

const DEFAULT_PLAYLIST_ID = 'OLAK5uy_kojiLJf49fStilkx_cFUhxqoDXzcSyfg0';

describe('radioPlaylistMetadata', () => {
  it('provides the complete default playlist without waiting for YouTube', () => {
    const playlist = getEmbeddedRadioPlaylist(DEFAULT_PLAYLIST_ID);

    expect(playlist).toHaveLength(46);
    expect(playlist[0]).toEqual({ id: 'YHH7NKb8m5c', title: 'Imitation' });
    expect(playlist).toContainEqual({ id: '8zj8h15VmQw', title: 'Up' });
  });

  it('does not claim metadata for a custom playlist', () => {
    expect(getEmbeddedRadioPlaylist('custom-playlist')).toEqual([]);
    expect(getRadioTrackTitle('custom-playlist', '8zj8h15VmQw')).toBeUndefined();
  });
});
