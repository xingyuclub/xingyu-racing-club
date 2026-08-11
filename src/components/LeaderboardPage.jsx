import { ArrowLeft, Search } from 'lucide-react';
import { LeaderboardList } from './Leaderboard.jsx';
import { useRevealOnScroll } from '../hooks/useRevealOnScroll.js';

const formatDate = (dateKey) => {
  if (!dateKey) return '';
  const [year, month, day] = dateKey.split('-').map(Number);
  return `${year}年${month}月${day}日`;
};

export function LeaderboardPage({ rows, scoreDate, onBack, onOpenDetails }) {
  useRevealOnScroll(true);

  return (
    <section className="leaderboard-page" aria-labelledby="leaderboard-page-title">
      <header className="leaderboard-page-header" data-reveal>
        <div className="leaderboard-page-actions">
          <button className="text-action" type="button" onClick={onBack}>
            <ArrowLeft aria-hidden="true" size={17} />
            返回首页
          </button>
          <button className="leaderboard-page-search" type="button" onClick={onOpenDetails}>
            <Search aria-hidden="true" size={17} />
            按日期查找
          </button>
        </div>
        <p className="eyebrow">SEASON POINTS / {String(rows.length).padStart(2, '0')}</p>
        <h1 id="leaderboard-page-title">星屿积分榜</h1>
        {scoreDate && <p className="leaderboard-date">截至 {formatDate(scoreDate)}</p>}
      </header>

      <div className="leaderboard-page-board" data-reveal>
        <LeaderboardList rows={rows} />
      </div>
    </section>
  );
}
