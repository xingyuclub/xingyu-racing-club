import { LeaderboardList } from './Leaderboard.jsx';
import { useRevealOnScroll } from '../hooks/useRevealOnScroll.js';

export function LeaderboardPage({ rows, scoreDate, seasonCode, onOpenDetails }) {
  useRevealOnScroll(true);

  return (
    <section className="leaderboard-page" aria-labelledby="leaderboard-page-title">
      <div className="leaderboard-page-board" data-reveal>
        <LeaderboardList
          rows={rows}
          scoreDate={scoreDate}
          seasonLabel={`${seasonCode || 'S55'}赛季`}
          onOpenDetails={onOpenDetails}
          titleId="leaderboard-page-title"
        />
      </div>
    </section>
  );
}
