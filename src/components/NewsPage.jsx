import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useRevealOnScroll } from '../hooks/useRevealOnScroll.js';
import { sortNewsByDateDesc } from '../data/siteConfig.js';

export function NewsPage({ news, categories, onBack }) {
  const [activeTab, setActiveTab] = useState('全部');
  useRevealOnScroll(true, activeTab);
  const list = Array.isArray(news) ? news : [];
  const tabs = ['全部', ...(Array.isArray(categories) ? categories : [])];
  const visible = activeTab === '全部'
    ? list
    : list.filter((item) => item.category === activeTab);
  const sorted = sortNewsByDateDesc(visible);

  return (
    <section className="album-page news-page" aria-labelledby="news-page-title">
      <header className="album-header" data-reveal>
        <button className="text-action" type="button" onClick={onBack}>
          <ArrowLeft aria-hidden="true" size={17} />
          返回首页
        </button>
        <p className="eyebrow">NEWS / {String(list.length).padStart(2, '0')}</p>
        <h1 id="news-page-title">车队动态</h1>
      </header>

      <div className="news-tabs" role="tablist" aria-label="新闻分类">
        {tabs.map((tab) => (
          <button
            className={`news-tab${activeTab === tab ? ' is-active' : ''}`}
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {sorted.length > 0 ? (
        <div className="news-list" data-reveal>
          {sorted.map((item, index) => (
            <a
              className="news-item"
              href={`#news/${encodeURIComponent(item.id)}`}
              key={item.id}
              style={{ '--stagger-index': Math.min(index, 5) }}
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
            </a>
          ))}
        </div>
      ) : (
        <p className="empty-state">该分类下暂无资讯</p>
      )}
    </section>
  );
}
