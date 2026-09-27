import { ArrowRight, PlayCircle } from 'lucide-react';

export function GalleryPreview({ photos, onOpenPhoto, onOpenAlbum }) {
  const featuredPhotos = photos.filter((photo) => photo.featured).slice(0, 5);

  return (
    <section className="section-block gallery-section" aria-labelledby="gallery-title" data-reveal>
      <div className="section-heading section-heading--action-right">
        <p className="eyebrow">TEAM ALBUM</p>
        <h2 id="gallery-title">相册空间</h2>
        <button className="text-action gallery-more" type="button" onClick={onOpenAlbum}>
          查看更多相册
          <ArrowRight aria-hidden="true" size={17} />
        </button>
      </div>
      {featuredPhotos.length ? (
        <div className="gallery-preview-grid">
          {featuredPhotos.map((photo) => {
            const isVideo = photo.mediaType === 'video' || Boolean(photo.videoUrl);

            return (
              <button
                className="photo-card"
                data-testid="featured-photo"
                key={photo.id}
                type="button"
                onClick={() => onOpenPhoto(photo, featuredPhotos)}
                aria-label={`${isVideo ? '查看视频' : '查看'}${photo.title}`}
              >
                {(photo.cardSrc || photo.src) && <img src={photo.cardSrc || photo.src} alt="" loading="lazy" />}
                {isVideo && (
                  <span className="photo-video-badge" aria-hidden="true">
                    <PlayCircle size={16} />
                  </span>
                )}
                <span className="photo-card-copy">
                  <strong>{photo.title}</strong>
                  <small>{photo.date}</small>
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <p className="empty-state">相册照片待添加</p>
      )}
    </section>
  );
}
