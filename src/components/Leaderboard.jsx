import ElectricBorder from './ElectricBorder.jsx';

export function Leaderboard({ rows, onOpenDetails }) {
  return (
    <section className="section-block" aria-labelledby="leaderboard-title" data-reveal>
      <div className="section-heading section-heading--action-right">
        <div className="section-heading-copy">
          <p className="eyebrow">SEASON POINTS</p>
          <h2 id="leaderboard-title">星屿积分榜</h2>
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
      <ElectricBorder className="leaderboard-frame" color="#4690ff" speed={0.9} chaos={0.12} thickness={2} borderRadius={12}>
        <div className="leaderboard">
          {rows.slice(0, 10).map((row, index) => (
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
      </ElectricBorder>
    </section>
  );
}
