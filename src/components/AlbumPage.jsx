import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';

export function AlbumPage({ albums, onBack, onOpenPhoto }) {
  const [activeAlbumId, setActiveAlbumId] = useState(null);
  const activeAlbum = albums.find((album) => album.id === activeAlbumId);
  const totalPhotos = albums.reduce((sum, album) => sum + album.photos.length, 0);

  const handleBack = () => {
    if (activeAlbum) {
      setActiveAlbumId(null);
      return;
    }
    onBack();
  };

  return (
    <section className="album-page" aria-labelledby="album-title">
      <header className="album-header">
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
              <div className="album-grid">
                {activeAlbum.photos.map((photo) => {
                  const isVideo = photo.mediaType === 'video' || Boolean(photo.videoUrl);

                  return (
                    <button
                      className="album-photo"
                      data-testid="album-photo"
                      key={photo.id}
                      type="button"
                      onClick={() => onOpenPhoto(photo)}
                      aria-label={`${isVideo ? '查看视频' : '查看'}${photo.title}`}
                    >
                      {photo.src && <img src={photo.src} alt="" loading="lazy" />}
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
              <div className="album-folder-grid">
                {albums.map((album) => (
                  <button
                    className="album-folder"
                    data-testid="album-folder"
                    key={album.id}
                    type="button"
                    onClick={() => setActiveAlbumId(album.id)}
                    aria-label={`打开文件夹${album.name}`}
                  >
                    {album.coverSrc && <img src={album.coverSrc} alt="" loading="lazy" />}
                    <span className="album-folder-copy">
                      <strong>{album.name}</strong>
                      <small>{`${album.photos.length} 张 · ${album.date}`}</small>
                    </span>
                  </button>
                ))}
              </div>
            )
          : <p className="empty-state">相册文件夹待添加</p>}
    </section>
  );
}
