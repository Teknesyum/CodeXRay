const DEFAULT_RADIO_PLAYLIST_ID = 'OLAK5uy_kojiLJf49fStilkx_cFUhxqoDXzcSyfg0';

const DEFAULT_RADIO_TRACK_TITLES: Record<string, string> = {
  YHH7NKb8m5c: 'Imitation',
  SX69IjN7PLc: 'Demons',
  HmLQxyvrKxU: 'Our Music (Remastered 2025)',
  '-Yk1p0OevRw': 'Push',
  PfMAIp9P7t8: 'Imitation (Piano Version)',
  axcZ9mZ3IVk: 'The Game Has Changed (Remastered 2025)',
  'zEf1R13-fBo': 'Warriors Fall',
  zuJf_b5KRJE: 'Mekansm',
  'G-tGd2QXp18': 'Saturday',
  y2WlnlwQBcE: 'Renew (Remastered 2025)',
  KPh6ZQL5F1A: 'Terrasque',
  bRgXgitiNJA: 'Revenge in Numbers (Remastered 2025)',
  'vH-L7PSstUY': 'Nero',
  TbrvYEnBitc: 'The Beast (Remastered 2025)',
  W7bTYr87T0Q: "Don't Go (Remastered 2025)",
  ZYFywD0aZ9M: 'Time',
  '7S1z33Y4MSY': 'Legacy',
  wVZUSmEKRjE: 'Cell',
  'SozjU1UPE-c': 'Hex',
  yl7SJcTJeps: 'Once Again (Remastered 2025)',
  '6zhwpnj_snc': 'Earthshatter',
  YQgKPvyF0qo: 'Stalker',
  'c-sXvpaZWzI': 'Launch',
  m2UWQa_mzno: 'Drive (Remastered 2025)',
  'LWzCd0-5pkc': 'After Dark',
  tuo1I2pb7HY: 'Rampage',
  xUn5EHhJIcU: 'Echoes of the End',
  sohOR3FYX6I: 'Mind',
  ucNJdF4snM8: 'Above All',
  a55cLADgCKI: 'Ultra',
  Y6ODZ55P2Zc: 'Misery',
  oU__HvbGXyc: 'Skyline (Remastered 2025)',
  X3C1OWibFoE: 'March of the Machines',
  ClB0oOJIprQ: '2 You',
  sPLDXO7QI1w: 'Rise',
  gw0eOXJNjQc: 'Six Lions',
  '0UUK55kZwko': 'Deeper Nights Deeper Dreams',
  r0knkYfe1KY: 'FaceSmash (Remastered 2025)',
  '7eN4NlC1qfg': "Won't Stay Down",
  '8zj8h15VmQw': 'Up',
  '1nFCOKAGwS0': 'Final Walk',
  'rytOU2-jCic': 'Fight Epic (Remastered 2025)',
  '7dIR5CpGjWg': 'Caves',
  uRBe2JTMTMw: 'Pink',
  W_5YMLkO_u8: 'Balanço da Vida',
  PLBvKmOkC5Y: 'The Test (Remastered 2025)',
};

// The album playlist points Demons at a Topic upload that rejects iframe
// playback with YouTube error 150. Keep the playlist position and metadata,
// but load the artist's embeddable upload when that item is selected.
const DEFAULT_RADIO_PLAYBACK_OVERRIDES: Record<string, string> = {
  SX69IjN7PLc: 'gNp624IXWI4',
};

const DEFAULT_RADIO_UNPLAYABLE_TRACK_IDS = new Set(['-Yk1p0OevRw']);

export interface EmbeddedRadioTrack {
  id: string;
  title: string;
}

const DEFAULT_RADIO_TRACKS: readonly EmbeddedRadioTrack[] = Object.entries(
  DEFAULT_RADIO_TRACK_TITLES,
)
  .filter(([id]) => !DEFAULT_RADIO_UNPLAYABLE_TRACK_IDS.has(id))
  .map(([id, title]) => ({ id, title }));

export const getEmbeddedRadioPlaylist = (
  playlistId: string,
): readonly EmbeddedRadioTrack[] =>
  playlistId === DEFAULT_RADIO_PLAYLIST_ID ? DEFAULT_RADIO_TRACKS : [];

export const getRadioTrackTitle = (playlistId: string, videoId: string) =>
  playlistId === DEFAULT_RADIO_PLAYLIST_ID
    ? DEFAULT_RADIO_TRACK_TITLES[videoId]
    : undefined;

export const getRadioPlaybackVideoId = (playlistId: string, videoId: string) =>
  playlistId === DEFAULT_RADIO_PLAYLIST_ID
    ? DEFAULT_RADIO_PLAYBACK_OVERRIDES[videoId] || videoId
    : videoId;
