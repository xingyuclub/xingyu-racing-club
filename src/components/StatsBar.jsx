import StarBorder from './StarBorder.jsx';

const STAT_THEMES = [
  { accent: '#2e7cff', strong: '#0b4ec4', tint: '#edf4ff' },
  { accent: '#925cff', strong: '#6634bd', tint: '#f5efff' },
  { accent: '#00b8d9', strong: '#007b95', tint: '#eafbff' },
  { accent: '#ff4f9a', strong: '#b72c68', tint: '#fff0f6' },
];

function StatValue({ value }) {
  const ordinal = String(value).match(/^(\d+)(st|nd|rd|th)$/);

  if (!ordinal) return value;

  return (
    <span className="stat-value">
      <span>{ordinal[1]}</span>
      <sup className="ordinal-suffix">{ordinal[2]}</sup>
    </span>
  );
}

export function StatsBar({ stats }) {
  return (
    <section className="stats-bar" aria-label="赛季核心数据" data-reveal>
      {stats.map((item, index) => (
        <StarBorder
          as="div"
          className="stat-card-shell"
          color={STAT_THEMES[index % STAT_THEMES.length].accent}
          speed="5s"
          thickness={1}
          key={item.label}
          style={{
            '--stat-accent': STAT_THEMES[index % STAT_THEMES.length].accent,
            '--stat-accent-strong': STAT_THEMES[index % STAT_THEMES.length].strong,
            '--stat-tint': STAT_THEMES[index % STAT_THEMES.length].tint,
          }}
        >
          <div className={`stat-card${index === 0 ? ' stat-card--featured' : ''}`}>
            {typeof item.value === 'object' ? (
              <strong className="stat-number stat-breakdown stat-breakdown--stacked">
                <span className="gender-stat" aria-label={`男性单身成员 ${item.value.male}`}>
                  <img
                    className="gender-icon"
                    src="/images/icons/gender-male.png"
                    alt=""
                    aria-hidden="true"
                  />
                  {item.value.male}
                </span>
                <span className="gender-stat" aria-label={`女性单身成员 ${item.value.female}`}>
                  <img
                    className="gender-icon"
                    src="/images/icons/gender-female.png"
                    alt=""
                    aria-hidden="true"
                  />
                  {item.value.female}
                </span>
              </strong>
            ) : (
              <strong className="stat-number"><StatValue value={item.value} /></strong>
            )}
            <span className="stat-label">{item.label}</span>
          </div>
        </StarBorder>
      ))}
    </section>
  );
}
