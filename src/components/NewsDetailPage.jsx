import { useEffect, useState } from 'react';
import { ArrowLeft, Share2 } from 'lucide-react';
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

export function NewsDetailPage({ news, newsId }) {
  useRevealOnScroll(true);
  const list = Array.isArray(news) ? news : [];
  const item = list.find((entry) => String(entry.id) === String(newsId));
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const handleBack = () => {
    if (window.history.length > 1) window.history.back();
    else window.location.hash = 'news';
  };

  const handleShare = () => {
    copyText(window.location.href).then((ok) => {
      setToast(ok ? '链接已复制，去微信粘贴分享吧' : '复制失败，请长按地址栏手动复制');
    });
  };

  if (!item) {
    return (
      <section className="album-page news-page" aria-labelledby="news-detail-title">
        <header className="album-header" data-reveal>
          <button className="text-action" type="button" onClick={handleBack}>
            <ArrowLeft aria-hidden="true" size={17} />
            返回
          </button>
          <p className="eyebrow">NEWS</p>
          <h1 id="news-detail-title">资讯不存在</h1>
        </header>
        <p className="empty-state">该资讯不存在或已删除</p>
      </section>
    );
  }

  return (
    <section className="album-page news-page" aria-labelledby="news-detail-title">
      <header className="album-header" data-reveal>
        <div className="news-detail-nav">
          <button className="text-action" type="button" onClick={handleBack}>
            <ArrowLeft aria-hidden="true" size={17} />
            返回
          </button>
          <button className="share-button" type="button" onClick={handleShare}>
            <Share2 aria-hidden="true" size={16} />
            分享
          </button>
        </div>
        <h1 id="news-detail-title">{item.title}</h1>
        <div className="news-modal-meta">
          <p className="eyebrow">{item.category}</p>
          <time dateTime={item.date}>{item.date}</time>
        </div>
      </header>

      <p className="news-lead" data-reveal>{item.summary}</p>
      {item.bodyHtml ? (
        <div
          className="news-article-content"
          data-reveal
          dangerouslySetInnerHTML={{ __html: item.bodyHtml }}
        />
      ) : (
        <p className="news-article-legacy" data-reveal>{item.body || item.summary}</p>
      )}

      {toast && (
        <div className="share-toast" role="status">
          {toast}
        </div>
      )}
    </section>
  );
}
