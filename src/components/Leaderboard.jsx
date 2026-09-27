import { useMemo, useState } from 'react';
import { ArrowDown, Search } from 'lucide-react';
import { resolvePublicAssetPath } from '../utils/publicAsset.js';

const formatDate = (dateKey) => {
  if (!dateKey) return '';
  const [year, month, day] = dateKey.split('-').map(Number);
  return `${year}年${month}月${day}日`;
};

const formatCompactDate = (dateKey) => {
  if (!dateKey) return '';
  const [year, month, day] = dateKey.split('-');
  return `${year}.${month}.${day}`;
};

const getIsoWeek = (dateKey) => {
  if (!dateKey) return '';
  const date = new Date(`${dateKey}T00:00:00`);
  const thursday = new Date(date);
  thursday.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  const firstThursday = new Date(thursday.getFullYear(), 0, 4);
  firstThursday.setDate(firstThursday.getDate() + 3 - ((firstThursday.getDay() + 6) % 7));
  return 1 + Math.round((thursday - firstThursday) / 604800000);
};

const sortRows = (rows, sortKey) => [...rows].sort((left, right) => {
  const primaryDifference = Number(right[sortKey] || 0) - Number(left[sortKey] || 0);
  if (primaryDifference) return primaryDifference;
  const secondaryKey = sortKey === 'seasonPoints' ? 'points' : 'seasonPoints';
  return Number(right[secondaryKey] || 0) - Number(left[secondaryKey] || 0)
    || left.name.localeCompare(right.name);
});

export function LeaderboardList({
  rows,
  limit,
  seasonLabel = 'S54赛季',
  scoreDate = '',
  onOpenDetails,
  titleId,
}) {
  const [sortKey, setSortKey] = useState('seasonPoints');
  const seasonCode = seasonLabel.replace(/赛季$/, '');
  const seasonWeek = getIsoWeek(scoreDate);
  const visibleRows = useMemo(() => {
    const sortedRows = sortRows(rows, sortKey);
    return limit ? sortedRows.slice(0, limit) : sortedRows;
  }, [limit, rows, sortKey]);

  return (
    <div className={`leaderboard-frame${onOpenDetails ? ' leaderboard-frame--season' : ''}`}>
      <div className="leaderboard">
        {onOpenDetails && (
          <section className="leaderboard-season-head" aria-label="赛季积分榜信息">
            <div className="leaderboard-season-top">
              <div className="leaderboard-season-code">
                {seasonCode}
              </div>
              <div className="leaderboard-season-copy">
                <h1 id={titleId}>赛季积分榜</h1>
                {scoreDate && (
                  <p>
                    截至 {formatCompactDate(scoreDate)}
                    {seasonWeek ? ` · 第 ${seasonWeek} 周` : ''}
                  </p>
                )}
              </div>
              <button className="leaderboard-season-search" type="button" onClick={onOpenDetails}>
                <Search aria-hidden="true" size={15} />
                按日期查找
              </button>
            </div>
          </section>
        )}
        <div className="leaderboard-header">
          <span className="leaderboard-nickname-header">车手</span>
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
