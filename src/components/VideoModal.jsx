import { useEffect, useRef } from 'react';
import ShinyText from './ShinyText.jsx';

export function VideoModal({ member, onClose }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;

    return () => {
      video.pause();
      video.removeAttribute('src');
      video.load();
    };
  }, [member?.videoUrl]);

  useEffect(() => {
    if (!member) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };

    document.body.classList.add('modal-open');
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.classList.remove('modal-open');
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [member, onClose]);

  if (!member) return null;

  return (
    <div
      className="modal-backdrop video-modal-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="video-modal member-video-modal" data-entrance role="dialog" aria-modal="true">
        {member.signature?.trim() && (
          <p className="member-video-signature">
            <ShinyText
              text={member.signature.trim()}
              color="#7C3AED"
              shineColor="#ffffff"
              speed={3.8}
              direction="left"
            />
          </p>
        )}
        {member.videoUrl ? (
          <video ref={videoRef} src={member.videoUrl} autoPlay muted controls playsInline preload="metadata" />
        ) : (
          <div className="video-fallback">高光视频素材待替换</div>
        )}
      </section>
    </div>
  );
}
