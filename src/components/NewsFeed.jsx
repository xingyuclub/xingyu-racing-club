export function NewsFeed({ items }) {
  return (
    <section className="section-block news-section" aria-labelledby="news-title" data-reveal>
      <div className="section-heading">
        <p className="eyebrow">TEAM UPDATES</p>
        <h2 id="news-title">车队动态</h2>
      </div>
      <div className="news-list">
        {items.map((item, index) => (
          <a
            className="news-item"
            href={`#news/${encodeURIComponent(item.id)}`}
            key={item.id}
            style={{ '--stagger-index': index }}
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
      <a className="news-more" href="#news">
        查看更多动态
      </a>
    </section>
  );
}
