import { useMemo, useState } from 'react';
import { ArrowDown } from 'lucide-react';
import { resolvePublicAssetPath } from '../utils/publicAsset.js';

const formatDate = (dateKey) => {
  if (!dateKey) return '';
  const [year, month, day] = dateKey.split('-').map(Number);
  return `${year}年${month}月${day}日`;
};

const sortRows = (rows, sortKey) => [...rows].sort((left, right) => {
  const primaryDifference = Number(right[sortKey] || 0) - Number(left[sortKey] || 0);
  if (primaryDifference) return primaryDifference;
  const secondaryKey = sortKey === 'seasonPoints' ? 'points' : 'seasonPoints';
  return Number(right[secondaryKey] || 0) - Number(left[secondaryKey] || 0)
    || left.name.localeCompare(right.name);
});

export function LeaderboardList({ rows, limit }) {
  const [sortKey, setSortKey] = useState('seasonPoints');
  const visibleRows = useMemo(() => {
    const sortedRows = sortRows(rows, sortKey);
    return limit ? sortedRows.slice(0, limit) : sortedRows;
  }, [limit, rows, sortKey]);

  return (
    <div className="leaderboard-frame">
      <div className="leaderboard">
        <div className="leaderboard-header">
          <span className="leaderboard-nickname-header">昵称</span>
          {[
            ['points', '本周积分'],
            ['seasonPoints', '赛季总分'],
          ].map(([key, label]) => (
            <button
              className={`leaderboard-sort-button${sortKey === key ? ' is-active' : ''}`}
              type="button"
              aria-label={`按${label}从高到低排序`}
              aria-pressed={sortKey === key}
              key={key}
              onClick={() => setSortKey(key)}
            >
              <span>{label}</span>
              <ArrowDown aria-hidden="true" size={13} strokeWidth={2.5} />
            </button>
          ))}
        </div>
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
            <span className="leader-score leader-week-score">
              <strong>{row.points}</strong>
              <small>分</small>
            </span>
            <span className="leader-score leader-season-score">
              <strong>{row.seasonPoints ?? 0}</strong>
              <small>分</small>
            </span>
          </article>
        ))}
      </div>
    </div>
  );
}

export function Leaderboard({ rows, onOpenDetails, onOpenFull, scoreDate }) {
  return (
    <section className="section-block" aria-labelledby="leaderboard-title" data-reveal>
      <div className="section-heading section-heading--action-right">
        <div className="section-heading-copy">
          <p className="eyebrow">SEASON POINTS</p>
          <h2 id="leaderboard-title">
            星屿积分榜 <span className="leaderboard-season-label">S54赛季</span>
          </h2>
          {scoreDate && <p className="leaderboard-date">截至 {formatDate(scoreDate)}</p>}
        </div>
        <button className="text-action text-action--stacked" type="button" onClick={onOpenDetails}>
          <img
            className="score-search-icon"
            src={resolvePublicAssetPath('/images/icons/search.png')}
            alt=""
            aria-hidden="true"
          />
          查找
        </button>
      </div>
      <LeaderboardList rows={rows} limit={10} />
      {rows.length > 10 && (
        <a
          className="leaderboard-more"
          href="#leaderboard"
          onClick={(event) => {
            if (!onOpenFull) return;
            event.preventDefault();
            onOpenFull();
          }}
        >
          查看完整榜单
        </a>
      )}
    </section>
  );
}
