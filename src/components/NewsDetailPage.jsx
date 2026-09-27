import { useEffect, useState } from 'react';
import { Share2 } from 'lucide-react';
import { BackButton } from './BackButton.jsx';
import { useRevealOnScroll } from '../hooks/useRevealOnScroll.js';

function copyText(value) {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    return navigator.clipboard
      .writeText(value)
      .then(() => true)
      .catch(() => false);
  }
  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  const ok = document.execCommand('copy');
  document.body.removeChild(textarea);
  return Promise.resolve(ok);
}

export function NewsDetailPage({ news, newsId, onBack = () => { window.location.hash = 'news'; } }) {
  useRevealOnScroll(true);
  const list = Array.isArray(news) ? news : [];
  const item = list.find((entry) => String(entry.id) === String(newsId));
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const handleShare = () => {
    copyText(window.location.href).then((ok) => {
      setToast(ok ? '链接已复制，去微信粘贴分享吧' : '复制失败，请长按地址栏手动复制');
    });
  };

  if (!item) {
    return (
      <section className="album-page news-page" aria-label="资讯详情">
        <div className="news-detail-toolbar" data-reveal>
          <BackButton label="返回资讯" onClick={onBack} />
        </div>
        <p className="empty-state">该资讯不存在或已删除</p>
      </section>
    );
  }

  return (
    <section className="album-page news-page" aria-label="资讯详情">
      <div className="news-detail-toolbar" data-reveal>
        <BackButton label="返回资讯" onClick={onBack} />
        <h1 className="news-detail-title">{item.title}</h1>
        <button className="share-button" type="button" onClick={handleShare}>
          <Share2 aria-hidden="true" size={16} />
          分享
        </button>
      </div>

      {item.bodyHtml ? (
        <div
          className="news-article-content"
          dangerouslySetInnerHTML={{ __html: item.bodyHtml }}
        />
      ) : (
        <p className="news-article-legacy">{item.body || item.summary}</p>
      )}

      {toast && (
        <div className="share-toast" role="status">
          {toast}
        </div>
      )}
    </section>
  );
}
