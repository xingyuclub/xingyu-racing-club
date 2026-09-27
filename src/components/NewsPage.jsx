import { useEffect, useState } from 'react';
import { useRevealOnScroll } from '../hooks/useRevealOnScroll.js';
import { sortNewsPinnedFirstByDateDesc } from '../data/siteConfig.js';

export function NewsPage({ news, categories, onOpenItem }) {
  const categoryTabs = Array.isArray(categories) ? categories : [];
  const tabs = [...categoryTabs, '全部'];
  const defaultTab = categoryTabs[0] || '全部';
  const [activeTab, setActiveTab] = useState(defaultTab);
  useRevealOnScroll(true, activeTab);
  const list = Array.isArray(news) ? news : [];
  const visible = activeTab === '全部'
    ? list
    : list.filter((item) => item.category === activeTab);
  const sorted = sortNewsPinnedFirstByDateDesc(visible);
  const tabsKey = tabs.join('\u0000');

  useEffect(() => {
    if (!tabs.includes(activeTab)) setActiveTab(defaultTab);
  }, [activeTab, defaultTab, tabsKey]);

  return (
    <section className="album-page news-page" aria-label="资讯列表">
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
              onClick={(event) => {
                if (!onOpenItem) return;
                event.preventDefault();
                onOpenItem(item);
              }}
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
