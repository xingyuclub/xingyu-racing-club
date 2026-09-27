import { useEffect, useMemo, useState } from 'react';
import { LockKeyhole, PlayCircle, X } from 'lucide-react';
import { BackButton } from './BackButton.jsx';
import { useRevealOnScroll } from '../hooks/useRevealOnScroll.js';

const TABS = [
  { key: 'photos', label: '照片' },
  { key: 'videos', label: '视频' },
  { key: 'albums', label: '相册' },
];

const isVideoMedia = (item) => item.mediaType === 'video' || Boolean(item.videoUrl);
const mediaKey = (item, index) => item.id || item.videoUrl || item.src || String(index);
const mediaPoster = (item) => item.videoPosterSrc || item.cardSrc || item.src || item.thumbSrc;

function AlbumPasswordDialog({ album, onCancel, onUnlock }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  const submit = (event) => {
    event.preventDefault();
    if (onUnlock(password)) return;
    setError('密码错误，请重新输入');
  };

  return (
    <div
      className="modal-backdrop album-password-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <form
        className="album-password-dialog"
        data-entrance
        role="dialog"
        aria-modal="true"
        aria-labelledby="album-password-title"
        onSubmit={submit}
      >
        <button className="icon-button" type="button" onClick={onCancel} aria-label="关闭密码输入">
          <X aria-hidden="true" size={19} />
        </button>
        <LockKeyhole aria-hidden="true" className="album-password-icon" size={24} />
        <h2 id="album-password-title">访问受保护相册</h2>
        <p>{album.name}</p>
        <label>
          相册密码
          <input
            autoFocus
            type="password"
            value={password}
            autoComplete="current-password"
            onChange={(event) => {
              setPassword(event.target.value);
              setError('');
            }}
          />
        </label>
        {error && <p className="album-password-error" role="alert">{error}</p>}
        <button className="album-password-submit" type="submit">进入相册</button>
      </form>
    </div>
  );
}

function PinnedMedia({ item, onOpen }) {
  if (!item) return null;
  const isVideo = isVideoMedia(item);
  const poster = mediaPoster(item);

  return (
    <button
      className="media-pin"
      type="button"
      onClick={() => onOpen(item, [item])}
      aria-label={`查看置顶${isVideo ? '视频' : '照片'} ${item.title}`}
    >
      {poster && <img src={poster} alt="" />}
      {isVideo && (
        <span className="media-pin-play" aria-hidden="true">
          <PlayCircle size={28} />
        </span>
      )}
      <span className="media-pin-copy">
        <small>置顶内容</small>
        <strong>{item.title}</strong>
        <span>{item.date}</span>
      </span>
    </button>
  );
}

function MediaGrid({ items, onOpen }) {
  const [dimensions, setDimensions] = useState({});

  const updateDimensions = (key, width, height) => {
    if (!width || !height) return;
    setDimensions((current) => {
      const previous = current[key];
      if (previous?.width === width && previous?.height === height) return current;
      return { ...current, [key]: { width, height } };
    });
  };

  return (
    <div className="album-media-grid" data-reveal>
      {items.map((item, index) => {
        const key = mediaKey(item, index);
        const isVideo = isVideoMedia(item);
        const knownDimensions = dimensions[key] || {
          width: Number(item.width || item.videoWidth) || 0,
          height: Number(item.height || item.videoHeight) || 0,
        };
        const isLandscape = Boolean(
          knownDimensions.width
          && knownDimensions.height
          && knownDimensions.width > knownDimensions.height,
        );
        const mediaAspectRatio = knownDimensions.width && knownDimensions.height
          ? `${knownDimensions.width} / ${knownDimensions.height}`
          : undefined;
        const poster = mediaPoster(item);

        return (
          <button
            className={`album-media-item ${isLandscape ? 'is-landscape' : 'is-portrait'}`}
            type="button"
            key={key}
            data-testid="album-media-item"
            style={{ '--media-aspect-ratio': mediaAspectRatio }}
            onClick={() => onOpen(item, items)}
            aria-label={`查看${isVideo ? '视频' : ''}${item.title}`}
          >
            {isVideo ? (
              <video
                src={item.videoUrl}
                poster={poster}
                muted
                playsInline
                preload="metadata"
                onLoadedMetadata={(event) => updateDimensions(
                  key,
                  event.currentTarget.videoWidth,
                  event.currentTarget.videoHeight,
                )}
              />
            ) : (
              <img
                src={item.thumbSrc || item.cardSrc || item.src}
                alt=""
                loading="lazy"
                onLoad={(event) => updateDimensions(
                  key,
                  event.currentTarget.naturalWidth,
                  event.currentTarget.naturalHeight,
                )}
              />
            )}
            {isVideo && (
              <span className="album-media-play" aria-hidden="true">
                <PlayCircle size={26} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function AlbumPage({ albums = [], gallery = [], onOpenPhoto, resetKey = 0 }) {
  const [activeTab, setActiveTab] = useState('photos');
  const [activeAlbumId, setActiveAlbumId] = useState(null);
  const [lockedAlbum, setLockedAlbum] = useState(null);
  const [unlockedAlbumIds, setUnlockedAlbumIds] = useState(() => new Set());
  useRevealOnScroll(true, `${activeAlbumId || 'root'}:${activeTab}`);

  const lockedMediaKeys = useMemo(() => {
    const keys = new Set();
    albums
      .filter((album) => album.password)
      .forEach((album) => {
        (album.photos || []).forEach((item, index) => {
          keys.add(mediaKey(item, index));
        });
      });
    return keys;
  }, [albums]);

  const allMedia = useMemo(() => {
    const source = [
      ...(Array.isArray(gallery) ? gallery : []),
      ...albums.flatMap((album) => album.photos || []),
    ];
    const unique = new Map();
    source.forEach((item, index) => {
      const key = mediaKey(item, index);
      if (lockedMediaKeys.has(key)) return;
      if (!unique.has(key)) unique.set(key, item);
    });
    return [...unique.values()];
  }, [albums, gallery, lockedMediaKeys]);

  const photos = allMedia.filter((item) => !isVideoMedia(item));
  const videos = allMedia.filter(isVideoMedia);
  const pinnedMedia = allMedia.find((item) => item.featured) || allMedia[0] || null;
  const activeAlbum = albums.find((album) => album.id === activeAlbumId);

  useEffect(() => {
    if (resetKey <= 0) return;
    setActiveAlbumId(null);
    setActiveTab('albums');
  }, [resetKey]);

  const openAlbum = (album) => {
    if (!album.password || unlockedAlbumIds.has(album.id)) {
      setActiveAlbumId(album.id);
      return;
    }
    setLockedAlbum(album);
  };

  const unlockAlbum = (password) => {
    if (password !== lockedAlbum?.password) return false;
    setUnlockedAlbumIds((current) => new Set(current).add(lockedAlbum.id));
    setActiveAlbumId(lockedAlbum.id);
    setLockedAlbum(null);
    return true;
  };

  if (activeAlbum) {
    return (
      <section className="album-page album-page--detail" aria-label={activeAlbum.name}>
        <div className="album-detail-toolbar">
          <BackButton label="返回相册" onClick={() => setActiveAlbumId(null)} />
        </div>
        {activeAlbum.photos?.length
          ? <MediaGrid items={activeAlbum.photos} onOpen={onOpenPhoto} />
          : <p className="empty-state">该文件夹暂无照片</p>}
      </section>
    );
  }

  const tabItems = activeTab === 'photos'
    ? photos
    : activeTab === 'videos'
      ? videos
      : [];

  return (
    <section className="album-page" aria-label="相册">
      <PinnedMedia item={pinnedMedia} onOpen={onOpenPhoto} />

      <div className="album-content-tabs" role="tablist" aria-label="相册内容分类">
        {TABS.map((tab) => (
          <button
            className={activeTab === tab.key ? 'is-active' : ''}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'albums' ? (
        albums.length ? (
          <div className="album-folder-grid" data-reveal>
            {albums.map((album, index) => (
              <button
                className="album-folder"
                data-testid="album-folder"
                key={album.id}
                type="button"
                style={{ '--stagger-index': Math.min(index, 5) }}
                onClick={() => openAlbum(album)}
                aria-label={`打开文件夹${album.name}`}
              >
                {(album.coverThumbSrc || album.coverSrc) && (
                  <img src={album.coverThumbSrc || album.coverSrc} alt="" loading="lazy" />
                )}
                {album.password && (
                  <span className="album-folder-lock" aria-hidden="true">
                    <LockKeyhole size={15} />
                  </span>
                )}
                <span className="album-folder-copy">
                  <strong>{album.name}</strong>
                  <small>{`${album.photos.length} 张 · ${album.date}`}</small>
                </span>
              </button>
            ))}
          </div>
        ) : <p className="empty-state">相册文件夹待添加</p>
      ) : (
        tabItems.length
          ? <MediaGrid items={tabItems} onOpen={onOpenPhoto} />
          : <p className="empty-state">{activeTab === 'videos' ? '暂无视频' : '暂无照片'}</p>
      )}

      {lockedAlbum && (
        <AlbumPasswordDialog
          album={lockedAlbum}
          onCancel={() => setLockedAlbum(null)}
          onUnlock={unlockAlbum}
        />
      )}
    </section>
  );
}
