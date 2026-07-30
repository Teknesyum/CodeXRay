import { ExternalLink, Music2, Radio, X } from 'lucide-react';
import { useState } from 'react';
import { useTimeline } from '../context/TimelineContext';
import { t } from '../i18n/translations';
import './PlaylistRadio.css';

const PLAYLIST_ID = 'OLAK5uy_kojiLJf49fStilkx_cFUhxqoDXzcSyfg0';
const PLAYLIST_URL = `https://music.youtube.com/playlist?list=${PLAYLIST_ID}`;

export const PlaylistRadio = () => {
  const { locale } = useTimeline();
  const [open, setOpen] = useState(false);

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
    `&hl=${locale}&playsinline=1&loop=1&rel=0`,
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
        src={embedUrl}
        title={t('playlistPlayer', locale)}
        width="360"
        height="203"
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
      />
      <p>{t('radioFallback', locale)}</p>
    </aside>
  );
};

