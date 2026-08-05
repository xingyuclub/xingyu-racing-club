import { useState } from 'react';

const formatDate = (dateKey) => {
  if (!dateKey) return '';
  const [year, month, day] = dateKey.split('-').map(Number);
  return `${year}年${month}月${day}日`;
};

export function Leaderboard({ rows, onOpenDetails, scoreDate }) {
  const [showAll, setShowAll] = useState(false);
  const visibleRows = showAll ? rows : rows.slice(0, 10);
  return (
    <section className="section-block" aria-labelledby="leaderboard-title" data-reveal>
      <div className="section-heading section-heading--action-right">
        <div className="section-heading-copy">
          <p className="eyebrow">SEASON POINTS</p>
          <h2 id="leaderboard-title">星屿积分榜</h2>
          {scoreDate && <p className="leaderboard-date">截至 {formatDate(scoreDate)}</p>}
        </div>
        <button className="text-action text-action--stacked" type="button" onClick={onOpenDetails}>
          <img
            className="score-search-icon"
            src="/images/icons/search.png"
            alt=""
            aria-hidden="true"
          />
          查找
        </button>
      </div>
      <div className="leaderboard-frame">
        <div className="leaderboard">
          {visibleRows.map((row, index) => (
            <article
              className={`leader-row${index < 3 ? ' is-podium' : ''}`}
              key={row.id}
              style={{ '--stagger-index': index }}
            >
              <span className="rank">{String(index + 1).padStart(2, '0')}</span>
              <span className="leader-identity">
                <small>DRIVER</small>
                <strong>{row.name}</strong>
              </span>
              <span className="leader-score">
                <strong>{row.points}</strong>
                <small>分</small>
              </span>
            </article>
          ))}
        </div>
      </div>
      {rows.length > 10 && !showAll && (
        <button className="leaderboard-more" type="button" onClick={() => setShowAll(true)}>
          查看完整榜单
        </button>
      )}
    </section>
  );
}
