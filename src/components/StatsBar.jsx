import StarBorder from './StarBorder.jsx';

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
          color="#4690ff"
          speed="5s"
          thickness={1}
          key={item.label}
        >
          <div className={`stat-card${index === 0 ? ' stat-card--featured' : ''}`}>
            {typeof item.value === 'object' ? (
              <strong className="stat-breakdown stat-breakdown--stacked">
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
              <strong><StatValue value={item.value} /></strong>
            )}
            <span>{item.label}</span>
          </div>
        </StarBorder>
      ))}
    </section>
  );
}
