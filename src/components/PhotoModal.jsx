import { useEffect, useRef, useState } from 'react';
import { Download, X } from 'lucide-react';

export function PhotoModal({ photo, onClose }) {
  const videoRef = useRef(null);
  const [imageFailed, setImageFailed] = useState(false);
  const isVideo = photo && (photo.mediaType === 'video' || Boolean(photo.videoUrl));

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;

    return () => {
      video.pause();
      video.removeAttribute('src');
      video.load();
    };
  }, [photo?.videoUrl]);

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
  const downloadSrc = isVideo
    ? photo.videoOriginalUrl || photo.videoUrl
    : photo.originalSrc || photo.src;

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="photo-modal photo-viewer" data-entrance role="dialog" aria-modal="true" aria-labelledby="photo-title">
        <header className="photo-viewer-toolbar">
          <div>
            <p className="eyebrow">{isVideo ? '车队视频' : '车队相册'}</p>
            <h2 id="photo-title">{photo.title}</h2>
          </div>
          <div className="photo-viewer-actions">
            {downloadSrc && (
              <a
                className="icon-button photo-viewer-action"
                href={downloadSrc}
                download
                aria-label={`下载${photo.title}`}
                title="下载"
              >
                <Download aria-hidden="true" size={19} />
              </a>
            )}
            <button
              className="icon-button photo-viewer-action"
              type="button"
              onClick={onClose}
              aria-label="关闭照片预览"
            >
              <X aria-hidden="true" size={20} />
            </button>
          </div>
        </header>
        <div className="photo-screenshot-frame">
          <div className="photo-screenshot-bar" aria-hidden="true">
            <span />
            <span />
            <span />
            <small>{photo.date || photo.title}</small>
          </div>
          <div className="photo-screenshot-canvas">
            {isVideo ? (
              photo.videoUrl ? (
                <video
                  ref={videoRef}
                  src={photo.videoUrl}
                  poster={photo.src}
                  autoPlay
                  muted
                  controls
                  playsInline
                  preload="metadata"
                />
              ) : (
                <div className="video-fallback">视频素材待替换</div>
              )
            ) : photo.src && !imageFailed ? (
              <img src={photo.src} alt={photo.alt} onError={() => setImageFailed(true)} />
            ) : (
              <div className="photo-fallback">照片素材待替换</div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
