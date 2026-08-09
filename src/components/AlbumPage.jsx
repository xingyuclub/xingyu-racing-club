import { useEffect, useState } from 'react';
import { ArrowLeft, LockKeyhole, X } from 'lucide-react';
import { useRevealOnScroll } from '../hooks/useRevealOnScroll.js';

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

export function AlbumPage({ albums, onBack, onOpenPhoto }) {
  const [activeAlbumId, setActiveAlbumId] = useState(null);
  const [lockedAlbum, setLockedAlbum] = useState(null);
  const [unlockedAlbumIds, setUnlockedAlbumIds] = useState(() => new Set());
  useRevealOnScroll(true, activeAlbumId);
  const activeAlbum = albums.find((album) => album.id === activeAlbumId);
  const totalPhotos = albums.reduce((sum, album) => sum + album.photos.length, 0);

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

  const handleBack = () => {
    if (activeAlbum) {
      setActiveAlbumId(null);
      return;
    }
    onBack();
  };

  return (
    <section className="album-page" aria-labelledby="album-title">
      <header className="album-header" data-reveal>
        <button className="text-action" type="button" onClick={handleBack}>
          <ArrowLeft aria-hidden="true" size={17} />
          {activeAlbum ? '返回文件夹' : '返回首页'}
        </button>
        <p className="eyebrow">
          {activeAlbum
            ? `${activeAlbum.name} / ${String(activeAlbum.photos.length).padStart(2, '0')}`
            : `ALBUMS / ${String(albums.length).padStart(2, '0')} · PHOTOS / ${String(totalPhotos).padStart(2, '0')}`}
        </p>
        <h1 id="album-title">{activeAlbum ? activeAlbum.name : '车队相册'}</h1>
      </header>

      {activeAlbum
        ? activeAlbum.photos.length
          ? (
              <div className="album-grid" data-reveal>
                {activeAlbum.photos.map((photo, index) => {
                  const isVideo = photo.mediaType === 'video' || Boolean(photo.videoUrl);

                  return (
                    <button
                      className="album-photo"
                      data-testid="album-photo"
                      key={photo.id}
                      type="button"
                      style={{ '--stagger-index': Math.min(index, 5) }}
                      onClick={() => onOpenPhoto(photo, activeAlbum.photos)}
                      aria-label={`${isVideo ? '查看视频' : '查看'}${photo.title}`}
                    >
                      {(photo.thumbSrc || photo.src) && <img src={photo.thumbSrc || photo.src} alt="" loading="lazy" />}
                      {isVideo && (
                        <span className="photo-video-badge" aria-hidden="true">
                          视频
                        </span>
                      )}
                      <span>
                        <strong>{photo.title}</strong>
                        <small>{photo.date}</small>
                      </span>
                    </button>
                  );
                })}
              </div>
            )
          : <p className="empty-state">该文件夹暂无照片</p>
        : albums.length
          ? (
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
                    {(album.coverThumbSrc || album.coverSrc) && <img src={album.coverThumbSrc || album.coverSrc} alt="" loading="lazy" />}
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
            )
          : <p className="empty-state">相册文件夹待添加</p>}
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
