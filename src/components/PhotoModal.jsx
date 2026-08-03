import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

export function PhotoModal({ photo, onClose }) {
  const [imageFailed, setImageFailed] = useState(false);
  const isVideo = photo && (photo.mediaType === 'video' || Boolean(photo.videoUrl));

  useEffect(() => {
    if (!photo) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };

    setImageFailed(false);
    document.body.classList.add('modal-open');
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.classList.remove('modal-open');
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [photo, onClose]);

  if (!photo) return null;

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="photo-modal" data-entrance role="dialog" aria-modal="true" aria-labelledby="photo-title">
        <button className="icon-button" type="button" onClick={onClose} aria-label="关闭照片预览">
          <X aria-hidden="true" size={20} />
        </button>
        <p className="eyebrow">{isVideo ? '车队视频' : '车队相册'}</p>
        <h2 id="photo-title">{photo.title}</h2>
        {isVideo ? (
          photo.videoUrl ? (
            <video
              src={photo.videoUrl}
              poster={photo.src}
              autoPlay
              muted
              controls
              playsInline
            />
          ) : (
            <div className="video-fallback">视频素材待替换</div>
          )
        ) : photo.src && !imageFailed ? (
          <img src={photo.src} alt={photo.alt} onError={() => setImageFailed(true)} />
        ) : (
          <div className="photo-fallback">照片素材待替换</div>
        )}
      </section>
    </div>
  );
}
