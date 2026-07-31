import { ExternalLink, Music2, Radio, Volume2, VolumeX, Minus, Play, Pause, SkipBack, SkipForward, Repeat, Shuffle } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTimeline } from '../context/TimelineContext';
import { GOD_MODE_UI_EVENT, isGodModeUiEvent } from '../services/godModeUiControl';
import { t } from '../i18n/translations';
import {
  getEmbeddedRadioPlaylist,
  getRadioTrackTitle,
} from '../services/radioPlaylistMetadata';
import './PlaylistRadio.css';

interface YouTubePlayer {
  destroy: () => void;
  isMuted: () => boolean;
  mute: () => void;
  setVolume: (volume: number) => void;
  unMute: () => void;
  playVideo: () => void;
  pauseVideo: () => void;
  getPlayerState: () => number;
  nextVideo: () => void;
  previousVideo: () => void;
  setLoop: (loopPlaylists: boolean) => void;
  setShuffle: (shufflePlaylist: boolean) => void;
  getPlaylist: () => string[] | null;
  getPlaylistIndex: () => number;
  getVideoData: () => { title: string; video_id?: string } | null;
  playVideoAt: (index: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  loadPlaylist: (args: { listType: string; list: string }) => void;
}

interface YouTubeApi {
  Player: new (
    element: HTMLIFrameElement,
    options: { events: { 
      onReady: (event: { target: YouTubePlayer }) => void;
      onStateChange?: (event: { data: number; target: YouTubePlayer }) => void;
    } },
  ) => YouTubePlayer;
}

declare global {
  interface Window {
    YT?: YouTubeApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let youtubeApiPromise: Promise<YouTubeApi> | undefined;
const OPENING_TRACK_VIDEO_ID = '8zj8h15VmQw';
const OPENING_TRACK = {
  title: 'Up — CDK',
  thumb: `https://i.ytimg.com/vi/${OPENING_TRACK_VIDEO_ID}/hqdefault.jpg`,
};

const youtubeThumbnail = (videoId: string) =>
  `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

const extractListId = (urlOrId: string) => {
  let id = urlOrId;
  const match = urlOrId.match(/[?&]list=([^&]+)/);
  if (match) id = match[1];

  // Mixes (RD...) do not expose playlist data via API, fallback to a known working playlist.
  if (id.startsWith('RD') || id.includes('http')) {
    id = 'PLRBp0Fe2Gpglq-J-Hv0p-y0wk3lQk570u';
  }
  return id;
};

const createEmbeddedTrackData = (playlistId: string) =>
  Object.fromEntries(
    getEmbeddedRadioPlaylist(playlistId).map(({ id, title }, index) => [
      index,
      { title, thumb: youtubeThumbnail(id) },
    ]),
  );

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
  const {
    locale,
    radioPlaylistId,
    radioAutoplay,
    radioMinimizeSeconds,
    radioOpenRequest,
  } = useTimeline();
  const initialPlaylistId = useRef(extractListId(radioPlaylistId));
  const embeddedInitialPlaylist = getEmbeddedRadioPlaylist(initialPlaylistId.current);
  const [minimized, setMinimized] = useState(!radioAutoplay);
  const [hasStarted, setHasStarted] = useState(radioAutoplay);
  const [volume, setVolume] = useState(25);
  const [muted, setMuted] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playRequested, setPlayRequested] = useState(radioAutoplay);
  const [isLooping, setIsLooping] = useState(true);
  const [isShuffled, setIsShuffled] = useState(false);
  const [playlist, setPlaylist] = useState<string[]>(() =>
    embeddedInitialPlaylist.map(({ id }) => id),
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [showRing, setShowRing] = useState(false);
  const [trackData, setTrackData] = useState<Record<number, { title: string; thumb: string }>>(
    () => createEmbeddedTrackData(initialPlaylistId.current),
  );
  const [currentTrack, setCurrentTrack] = useState(OPENING_TRACK);
  const handledOpenRequest = useRef(radioOpenRequest);
  const hoverTimeoutRef = useRef<number | null>(null);
  const activePlaylistId = useRef(initialPlaylistId.current);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const volumeRef = useRef(volume);
  const loopRef = useRef(isLooping);
  const shuffleRef = useRef(isShuffled);
  const lastPlayingIndexRef = useRef(0);
  volumeRef.current = volume;
  loopRef.current = isLooping;
  shuffleRef.current = isShuffled;

  const syncPlaylist = useCallback((player: YouTubePlayer) => {
    const nextPlaylist = player.getPlaylist();
    if (!nextPlaylist || nextPlaylist.length === 0) return false;

    setPlaylist(nextPlaylist);
    setTrackData((previous) => Object.fromEntries(
      nextPlaylist.map((id, index) => [index, {
        title: previous[index]?.title
          || getRadioTrackTitle(activePlaylistId.current, id)
          || '',
        thumb: youtubeThumbnail(id),
      }]),
    ));

    const playlistIndex = player.getPlaylistIndex();
    if (playlistIndex >= 0) setCurrentIndex(playlistIndex);
    return true;
  }, []);

  useEffect(() => {
    if (extractListId(radioPlaylistId) !== activePlaylistId.current) {
      setMinimized(false);
      setHasStarted(true);
    }
  }, [radioPlaylistId]);

  useEffect(() => {
    if (!radioAutoplay) return;
    setMinimized(false);
    setHasStarted(true);
    setPlayRequested(true);
  }, [radioAutoplay]);

  useEffect(() => {
    if (radioOpenRequest === handledOpenRequest.current) return;
    handledOpenRequest.current = radioOpenRequest;
    setMinimized(false);
    setHasStarted(true);
  }, [radioOpenRequest]);

  useEffect(() => {
    const handleGodModeRadioAction = (event: Event) => {
      if (!isGodModeUiEvent(event) || event.detail.type !== 'set-radio-state') return;
      if (event.detail.state === 'open') {
        setMinimized(false);
        setHasStarted(true);
        return;
      }
      if (event.detail.state === 'play') {
        setMinimized(false);
        setHasStarted(true);
        setPlayRequested(true);
        playerRef.current?.playVideo();
        return;
      }
      setPlayRequested(false);
      playerRef.current?.pauseVideo();
    };
    window.addEventListener(GOD_MODE_UI_EVENT, handleGodModeRadioAction);
    return () => window.removeEventListener(GOD_MODE_UI_EVENT, handleGodModeRadioAction);
  }, []);

  useEffect(() => {
    if (!hasStarted || !iframeRef.current) return;
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
              // YouTube's loop flag repeats the whole playlist. CodeXRay owns
              // single-track repeat explicitly in onStateChange instead.
              target.setLoop(false);
              target.setShuffle(shuffleRef.current);
              setMuted(target.isMuted());
              setPlayerReady(true);
              setIsPlaying(target.getPlayerState() === 1);
              setDuration(target.getDuration());
              syncPlaylist(target);
            },
            onStateChange: (event) => {
              const player = event.target as YouTubePlayer;
              player.setLoop(false);
              if (event.data === 0 && loopRef.current) {
                setCurrentTime(0);
                setPlayRequested(true);
                // YouTube may advance the playlist index before emitting ENDED.
                // Re-select the last playing item so single-track repeat never
                // leaks into the following track.
                player.playVideoAt(lastPlayingIndexRef.current);
                return;
              }
              setIsPlaying(event.data === 1);
              if (event.data === 1) setPlayRequested(false);
              
              syncPlaylist(player);
              const pl = player.getPlaylist();
              
              const idx = player.getPlaylistIndex();
              if (idx !== undefined && idx !== -1) {
                setCurrentIndex(idx);
                if (event.data === 1) lastPlayingIndexRef.current = idx;
              }
              
              const vData = player.getVideoData();
              if (vData?.title) {
                const activeVideoId = vData.video_id || (idx >= 0 ? pl?.[idx] : undefined);
                const activeTrack = {
                  title: activeVideoId === OPENING_TRACK_VIDEO_ID
                    ? OPENING_TRACK.title
                    : vData.title,
                  thumb: activeVideoId
                    ? youtubeThumbnail(activeVideoId)
                    : OPENING_TRACK.thumb,
                };
                setCurrentTrack(activeTrack);
                if (idx >= 0) {
                  setTrackData((previous) => ({
                    ...previous,
                    [idx]: activeTrack,
                  }));
                }
              }
              
              setDuration(player.getDuration());
            }
          },
        });
      })
      .catch(() => setPlayerReady(false));
    return () => {
      active = false;
      playerRef.current = null;
      setPlayerReady(false);
    };
  }, [hasStarted, syncPlaylist]);

  useEffect(() => {
    if (!playerReady || !playRequested || isPlaying) return;
    const requestPlayback = () => playerRef.current?.playVideo();

    // Try immediately. Browsers may reject audible autoplay until the first
    // user gesture; keep the same request queued for that gesture instead of
    // pretending that playback has already started.
    requestPlayback();
    window.addEventListener('pointerdown', requestPlayback, { capture: true, once: true });
    window.addEventListener('keydown', requestPlayback, { capture: true, once: true });
    return () => {
      window.removeEventListener('pointerdown', requestPlayback, true);
      window.removeEventListener('keydown', requestPlayback, true);
    };
  }, [isPlaying, playRequested, playerReady]);

  useEffect(() => {
    if (!playerReady) return;
    let attempts = 0;
    const timer = window.setInterval(() => {
      const player = playerRef.current;
      attempts += 1;
      if ((player && syncPlaylist(player)) || attempts >= 20) {
        window.clearInterval(timer);
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [playerReady, syncPlaylist]);

  useEffect(() => {
    if (!isPlaying || !playerReady) return;
    const interval = window.setInterval(() => {
      if (playerRef.current) {
        setCurrentTime(playerRef.current.getCurrentTime());
      }
    }, 1000);
    return () => window.clearInterval(interval);
  }, [isPlaying, playerReady]);

  useEffect(() => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    
    if (!isHovered && hasStarted && !minimized) {
      if (radioMinimizeSeconds > 15) {
        setShowRing(false);
        return;
      }

      setShowRing(true);
      hoverTimeoutRef.current = window.setTimeout(() => {
        setMinimized(true);
        setShowRing(false);
      }, radioMinimizeSeconds * 1000);
    } else {
      setShowRing(false);
    }
    return () => {
      if (hoverTimeoutRef.current) window.clearTimeout(hoverTimeoutRef.current);
    };
  }, [isHovered, minimized, hasStarted, radioMinimizeSeconds]);

  useEffect(() => {
    if (playerReady && playerRef.current) {
      const nextPlaylistId = extractListId(radioPlaylistId);
      if (nextPlaylistId === activePlaylistId.current) return;
      activePlaylistId.current = nextPlaylistId;
      const embeddedPlaylist = getEmbeddedRadioPlaylist(nextPlaylistId);
      setTrackData(createEmbeddedTrackData(nextPlaylistId));
      setPlaylist(embeddedPlaylist.map(({ id }) => id));
      playerRef.current.loadPlaylist({
        listType: 'playlist',
        list: nextPlaylistId
      });
      playerRef.current.setLoop(false);
      playerRef.current.setShuffle(shuffleRef.current);
    }
  }, [radioPlaylistId, playerReady]);

  const embedUrl = [
    `https://www.youtube.com/embed/${OPENING_TRACK_VIDEO_ID}`,
    `?listType=playlist&list=${initialPlaylistId.current}`,
    `&hl=${locale}&playsinline=1&loop=0&rel=0&controls=0&enablejsapi=1&autoplay=${radioAutoplay ? 1 : 0}`,
    `&origin=${encodeURIComponent(window.location.origin)}`,
  ].join('');

  return (
    <>
      {minimized && (
        <button
          type="button"
          className="radio-launcher"
          aria-label={t('openRadio', locale)}
          onClick={() => {
            setMinimized(false);
            setHasStarted(true);
          }}
        >
          <Radio size={16} />
          <span>{t('radio', locale)}</span>
        </button>
      )}

      {hasStarted && (
        <aside 
          className="playlist-radio" 
          aria-label={t('radio', locale)}
          style={{ display: minimized ? 'none' : 'block' }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <div className="playlist-radio-header">
            <Music2 size={16} />
            <span>CodeXRay Radio</span>
            <a
              href={`https://music.youtube.com/playlist?list=${extractListId(radioPlaylistId)}`}
              target="_blank"
              rel="noreferrer"
              aria-label={t('openPlaylist', locale)}
              title={t('openPlaylist', locale)}
            >
              <ExternalLink size={14} />
            </a>
            <div className="minimize-btn-wrapper">
              {!isHovered && !minimized && showRing && (
                <svg className="countdown-ring" width="24" height="24">
                  <rect
                    x="2"
                    y="2"
                    width="20"
                    height="20"
                    rx="4"
                    style={{ animationDuration: `${radioMinimizeSeconds}s` }}
                  />
                </svg>
              )}
              <button
                type="button"
                className="minimize-btn"
                aria-label={t('closeRadio', locale)}
                title={t('closeRadio', locale)}
                onClick={() => setMinimized(true)}
              >
                <Minus size={15} />
              </button>
            </div>
          </div>
          <iframe
            ref={iframeRef}
            src={embedUrl}
            title={t('playlistPlayer', locale)}
            className="hidden-iframe"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />

          <div className={`radio-visualizer ${isPlaying ? 'playing' : ''}`}>
            {currentTrack.thumb ? (
              <img 
                src={currentTrack.thumb}
                alt={currentTrack.title}
                className="album-art" 
              />
            ) : (
              <div className="album-art-placeholder"><Music2 size={32} /></div>
            )}
            
            <div className="waves-container">
              <div className="wave wave-1"></div>
              <div className="wave wave-2"></div>
              <div className="wave wave-3"></div>
              <div className="wave wave-4"></div>
            </div>
            
            <div className="track-info">
              {currentTrack.title}
            </div>
          </div>
          
          <div className="playlist-radio-controls">
            <button
              type="button"
              className={`control-btn ${isShuffled ? 'active' : ''}`}
              title={t('shuffle', locale)}
              onClick={() => {
                if (!playerRef.current) return;
                const newShuffle = !isShuffled;
                shuffleRef.current = newShuffle;
                playerRef.current.setShuffle(newShuffle);
                setIsShuffled(newShuffle);
              }}
            >
              <Shuffle size={14} />
            </button>
            <button
              type="button"
              className="control-btn"
              title={t('previousTrack', locale)}
              onClick={() => playerRef.current?.previousVideo()}
            >
              <SkipBack size={16} />
            </button>
            <button
              type="button"
              className="control-btn play-pause-btn"
              title={isPlaying ? t('pause', locale) : t('play', locale)}
              onClick={() => {
                const player = playerRef.current;
                if (isPlaying) {
                  setPlayRequested(false);
                  player?.pauseVideo();
                } else {
                  setPlayRequested(true);
                  player?.playVideo();
                }
              }}
            >
              {isPlaying ? <Pause size={18} /> : <Play size={18} />}
            </button>
            <button
              type="button"
              className="control-btn"
              title={t('nextTrack', locale)}
              onClick={() => playerRef.current?.nextVideo()}
            >
              <SkipForward size={16} />
            </button>
            <button
              type="button"
              className={`control-btn ${isLooping ? 'active' : ''}`}
              aria-pressed={isLooping}
              title={t('loop', locale)}
              onClick={() => {
                if (!playerRef.current) return;
                const newLoop = !isLooping;
                loopRef.current = newLoop;
                playerRef.current.setLoop(false);
                setIsLooping(newLoop);
              }}
            >
              <Repeat size={14} />
            </button>
          </div>

          <div className="playlist-radio-progress">
            <span className="time-text">{formatTime(currentTime)}</span>
            <input
              type="range"
              min="0"
              max={duration || 100}
              value={currentTime}
              className="progress-slider neon-slider"
              onChange={(e) => {
                const time = Number(e.target.value);
                setCurrentTime(time);
                playerRef.current?.seekTo(time, true);
              }}
            />
            <span className="time-text">{formatTime(duration)}</span>
          </div>

          <div className="playlist-radio-volume">
            <button
              type="button"
              className="mute-btn time-text"
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
            <input
              type="range"
              min="0"
              max="100"
              value={volume}
              className="neon-slider progress-slider"
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
            <span className="time-text">{volume}%</span>
          </div>

          {playlist.length > 0 && (
            <div className="radio-playlist-menu">
              {playlist.map((_, index) => (
                <button
                  key={index}
                  className={`playlist-item ${index === currentIndex ? 'active' : ''}`}
                  onClick={() => playerRef.current?.playVideoAt(index)}
                >
                  <span className="track-number">{index + 1}</span>
                  {trackData[index]?.thumb ? (
                    <img
                      src={trackData[index].thumb}
                      alt="thumb"
                      className="track-thumb"
                      loading="lazy"
                    />
                  ) : (
                    <div className="track-thumb-placeholder"><Music2 size={12} /></div>
                  )}
                  <span className="track-title">{trackData[index]?.title || `Şarkı ${index + 1}`}</span>
                  {index === currentIndex && isPlaying && <Music2 size={12} className="playing-icon" />}
                </button>
              ))}
            </div>
          )}
        </aside>
      )}
    </>
  );
};

function formatTime(seconds: number) {
  if (!seconds || isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}
