import { useEffect } from 'react';
import { X } from 'lucide-react';

export function VideoModal({ member, onClose }) {
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
      <section className="video-modal member-video-modal" data-entrance role="dialog" aria-modal="true" aria-labelledby="video-title">
        <button className="icon-button" type="button" onClick={onClose} aria-label="关闭视频弹窗">
          <X aria-hidden="true" size={20} />
        </button>
        <header className="member-video-header">
          <h2 id="video-title">{member.name}</h2>
        </header>
        {member.videoUrl ? (
          <video src={member.videoUrl} autoPlay muted controls playsInline />
        ) : (
          <div className="video-fallback">高光视频素材待替换</div>
        )}
      </section>
    </div>
  );
}
