import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

export function NewsFeed({ items }) {
  const [selectedNews, setSelectedNews] = useState(null);

  useEffect(() => {
    if (!selectedNews) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setSelectedNews(null);
    };

    document.body.classList.add('modal-open');
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.classList.remove('modal-open');
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedNews]);

  return (
    <>
      <section className="section-block news-section" aria-labelledby="news-title" data-reveal>
        <div className="section-heading">
          <p className="eyebrow">TEAM UPDATES</p>
          <h2 id="news-title">车队动态</h2>
        </div>
        <div className="news-list">
          {items.map((item, index) => (
            <button
              className="news-item"
              type="button"
              key={item.id}
              style={{ '--stagger-index': index }}
              onClick={() => setSelectedNews(item)}
              aria-label={`查看资讯 ${item.title}`}
            >
              <span className="news-thumb">
                <img
                  className="news-image"
                  data-testid="news-image"
                  src={item.imageSrc}
                  alt={item.imageAlt}
                />
              </span>
              <div className="news-body">
                <div className="news-meta">
                  <span>{item.category}</span>
                  <time dateTime={item.date}>{item.date}</time>
                </div>
                <div className="news-copy">
                  <h3>{item.title}</h3>
                  <p>{item.summary}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>
      {selectedNews && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) setSelectedNews(null);
          }}
        >
          <section
            className="photo-modal news-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="news-modal-title"
          >
            <button
              className="icon-button"
              type="button"
              onClick={() => setSelectedNews(null)}
              aria-label="关闭资讯弹窗"
            >
              <X aria-hidden="true" size={20} />
            </button>
            <p className="eyebrow">{selectedNews.category}</p>
            <h2 id="news-modal-title">{selectedNews.title}</h2>
            <img src={selectedNews.imageSrc} alt={selectedNews.imageAlt} />
            <p>{selectedNews.summary}</p>
            <p>{selectedNews.body || selectedNews.summary}</p>
          </section>
        </div>
      )}
    </>
  );
}
