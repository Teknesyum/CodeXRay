import { ExternalLink, Music2, Radio, Volume2, VolumeX, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTimeline } from '../context/TimelineContext';
import { t } from '../i18n/translations';
import './PlaylistRadio.css';

const PLAYLIST_ID = 'OLAK5uy_kojiLJf49fStilkx_cFUhxqoDXzcSyfg0';
const PLAYLIST_URL = `https://music.youtube.com/playlist?list=${PLAYLIST_ID}`;

interface YouTubePlayer {
  destroy: () => void;
  isMuted: () => boolean;
  mute: () => void;
  setVolume: (volume: number) => void;
  unMute: () => void;
}

interface YouTubeApi {
  Player: new (
    element: HTMLIFrameElement,
    options: { events: { onReady: (event: { target: YouTubePlayer }) => void } },
  ) => YouTubePlayer;
}

declare global {
  interface Window {
    YT?: YouTubeApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let youtubeApiPromise: Promise<YouTubeApi> | undefined;

const loadYouTubeApi = (): Promise<YouTubeApi> => {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (youtubeApiPromise) return youtubeApiPromise;
  youtubeApiPromise = new Promise((resolve, reject) => {
    const previousCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousCallback?.();
      if (window.YT?.Player) resolve(window.YT);
      else reject(new Error('YouTube player API did not initialize.'));
    };
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://www.youtube.com/iframe_api"]',
    );
    if (existing) return;
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.onerror = () => reject(new Error('YouTube player API failed to load.'));
    document.head.append(script);
  });
  return youtubeApiPromise;
};

export const PlaylistRadio = () => {
  const { locale } = useTimeline();
  const [open, setOpen] = useState(false);
  const [volume, setVolume] = useState(55);
  const [muted, setMuted] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const volumeRef = useRef(volume);
  volumeRef.current = volume;

  useEffect(() => {
    if (!open || !iframeRef.current) return;
    let active = true;
    void loadYouTubeApi()
      .then((api) => {
        if (!active || !iframeRef.current) return;
        playerRef.current = new api.Player(iframeRef.current, {
          events: {
            onReady: ({ target }) => {
              if (!active) return;
              playerRef.current = target;
              target.setVolume(volumeRef.current);
              setMuted(target.isMuted());
              setPlayerReady(true);
            },
          },
        });
      })
      .catch(() => setPlayerReady(false));
    return () => {
      active = false;
      playerRef.current = null;
      setPlayerReady(false);
    };
  }, [open]);

  if (!open) {
    return (
      <button
        type="button"
        className="radio-launcher"
        aria-label={t('openRadio', locale)}
        onClick={() => setOpen(true)}
      >
        <Radio size={16} />
        <span>{t('radio', locale)}</span>
      </button>
    );
  }

  const embedUrl = [
    'https://www.youtube.com/embed',
    `?listType=playlist&list=${PLAYLIST_ID}`,
    `&hl=${locale}&playsinline=1&loop=1&rel=0&controls=1&enablejsapi=1`,
    `&origin=${encodeURIComponent(window.location.origin)}`,
  ].join('');

  return (
    <aside className="playlist-radio" aria-label={t('radio', locale)}>
      <div className="playlist-radio-header">
        <Music2 size={16} />
        <span>CodeXRay Radio</span>
        <a
          href={PLAYLIST_URL}
          target="_blank"
          rel="noreferrer"
          aria-label={t('openPlaylist', locale)}
          title={t('openPlaylist', locale)}
        >
          <ExternalLink size={14} />
        </a>
        <button
          type="button"
          aria-label={t('closeRadio', locale)}
          title={t('closeRadio', locale)}
          onClick={() => setOpen(false)}
        >
          <X size={15} />
        </button>
      </div>
      <iframe
        ref={iframeRef}
        src={embedUrl}
        title={t('playlistPlayer', locale)}
        width="360"
        height="203"
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
      />
      <div className="playlist-radio-volume">
        <button
          type="button"
          aria-label={muted ? t('unmuteRadio', locale) : t('muteRadio', locale)}
          title={muted ? t('unmuteRadio', locale) : t('muteRadio', locale)}
          disabled={!playerReady}
          onClick={() => {
            const player = playerRef.current;
            if (!player) return;
            if (muted) player.unMute();
            else player.mute();
            setMuted(!muted);
          }}
        >
          {muted || volume === 0 ? <VolumeX size={15} /> : <Volume2 size={15} />}
        </button>
        <label>
          <span>{t('volume', locale)}</span>
          <input
            type="range"
            min="0"
            max="100"
            value={volume}
            aria-label={t('radioVolume', locale)}
            onChange={(event) => {
              const nextVolume = Number(event.target.value);
              setVolume(nextVolume);
              playerRef.current?.setVolume(nextVolume);
              if (nextVolume > 0 && muted) {
                playerRef.current?.unMute();
                setMuted(false);
              }
            }}
          />
          <output>{volume}%</output>
        </label>
      </div>
      <p>{t('radioFallback', locale)}</p>
    </aside>
  );
};
