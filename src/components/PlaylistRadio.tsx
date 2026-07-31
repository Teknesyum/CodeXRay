import { ExternalLink, Music2, Radio, Volume2, VolumeX, Minus, Play, Pause, SkipBack, SkipForward, Repeat, Shuffle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTimeline } from '../context/TimelineContext';
import { t } from '../i18n/translations';
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
  getVideoData: () => { title: string } | null;
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
  const { locale, radioPlaylistId, radioAutoplay, radioMinimizeSeconds } = useTimeline();
  const [minimized, setMinimized] = useState(!radioAutoplay);
  const [hasStarted, setHasStarted] = useState(radioAutoplay);
  const [volume, setVolume] = useState(25);
  const [muted, setMuted] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isLooping, setIsLooping] = useState(true);
  const [isShuffled, setIsShuffled] = useState(false);
  const [playlist, setPlaylist] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [showRing, setShowRing] = useState(false);
  const [trackData, setTrackData] = useState<Record<number, { title: string; thumb: string }>>({});
  const trackDataFetched = useRef(false);
  const hoverTimeoutRef = useRef<number | null>(null);
  const extractListId = (urlOrId: string) => {
    let id = urlOrId;
    const match = urlOrId.match(/[?&]list=([^&]+)/);
    if (match) {
      id = match[1];
    }
    
    // Mixes (RD...) do not expose playlist data via API, fallback to a known working playlist
    if (id.startsWith('RD') || id.includes('http')) {
      id = 'PLRBp0Fe2Gpglq-J-Hv0p-y0wk3lQk570u';
    }
    return id;
  };
  
  const initialPlaylistId = useRef(extractListId(radioPlaylistId));
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const volumeRef = useRef(volume);
  volumeRef.current = volume;

  useEffect(() => {
    if (extractListId(radioPlaylistId) !== initialPlaylistId.current) {
      setMinimized(false);
      setHasStarted(true);
    }
  }, [radioPlaylistId]);

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
              setMuted(target.isMuted());
              setPlayerReady(true);
              setDuration(target.getDuration());
            },
            onStateChange: (event) => {
              const player = event.target as YouTubePlayer;
              if (event.data === 1) setIsPlaying(true);
              else if (event.data === 2) setIsPlaying(false);
              
              const pl = player.getPlaylist();
              if (pl && pl.length > 0) {
                setPlaylist(pl);
                // Sadece ilk seferde tüm listeyi fetch et
                if (!trackDataFetched.current) {
                  trackDataFetched.current = true;
                  pl.forEach((id, idx) => {
                    fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${id}`)
                      .then((r) => r.json())
                      .then((data) => {
                        if (data && data.title) {
                          setTrackData((prev) => ({
                            ...prev,
                            [idx]: { title: data.title, thumb: data.thumbnail_url },
                          }));
                        }
                      })
                      .catch(() => {});
                  });
                }
              }
              
              const idx = player.getPlaylistIndex();
              if (idx !== undefined && idx !== -1) setCurrentIndex(idx);
              
              const vData = player.getVideoData();
              if (vData && vData.title && idx !== undefined && idx !== -1) {
                setTrackData((prev) => ({
                  ...prev,
                  [idx]: { title: vData.title, thumb: prev[idx]?.thumb || '' },
                }));
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
  }, [hasStarted]);

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

      hoverTimeoutRef.current = window.setTimeout(() => {
        setShowRing(true);
        hoverTimeoutRef.current = window.setTimeout(() => {
          setMinimized(true);
          setShowRing(false);
        }, radioMinimizeSeconds * 1000);
      }, 1000);
    } else {
      setShowRing(false);
    }
    return () => {
      if (hoverTimeoutRef.current) window.clearTimeout(hoverTimeoutRef.current);
    };
  }, [isHovered, minimized, hasStarted]);

  useEffect(() => {
    if (playerReady && playerRef.current) {
      setTrackData({});
      trackDataFetched.current = false;
      playerRef.current.loadPlaylist({
        listType: 'playlist',
        list: extractListId(radioPlaylistId)
      });
    }
  }, [radioPlaylistId, playerReady]);

  const embedUrl = [
    'https://www.youtube.com/embed',
    `?listType=playlist&list=${initialPlaylistId.current}`,
    `&hl=${locale}&playsinline=1&loop=1&rel=0&controls=0&enablejsapi=1&autoplay=${radioAutoplay ? 1 : 0}`,
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
                <svg className="countdown-ring" width="24" height="24" style={{ animationDuration: `${radioMinimizeSeconds}s` }}>
                  <rect x="2" y="2" width="20" height="20" rx="4" />
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
            {trackData[currentIndex]?.thumb ? (
              <img 
                src={trackData[currentIndex].thumb} 
                alt="cover" 
                className="album-art" 
              />
            ) : (
              <div className="album-art-placeholder"><Music2 size={32} /></div>
            )}
            
            <div className="waves-container">
              <div className="wave wave-1"></div>
              <div className="wave wave-2"></div>
            </div>
            
            <div className="track-info">
              {trackData[currentIndex]?.title || 'Müzik Yükleniyor...'}
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
                if (!player) return;
                if (isPlaying) player.pauseVideo();
                else player.playVideo();
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
              title={t('loop', locale)}
              onClick={() => {
                if (!playerRef.current) return;
                const newLoop = !isLooping;
                playerRef.current.setLoop(newLoop);
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
                    <img src={trackData[index].thumb} alt="thumb" className="track-thumb" />
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
