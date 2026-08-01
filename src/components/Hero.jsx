import TextType from './TextType.jsx';

export function Hero({ team }) {
  const heroLines = Array.isArray(team.heroLines) && team.heroLines.length
    ? team.heroLines
    : [team.name];
  const mediaStyle = team.heroImage
    ? { '--hero-image': `url("${team.heroImage}")` }
    : undefined;

  return (
    <>
      <div className="hero-brand-bar">
        <h1 id="team-title" className="hero-brand" aria-label={heroLines.join('\n')}>
          {heroLines.map((line, index) => (
            <TextType
              as="span"
              className="hero-brand-line"
              key={`${line}-${index}`}
              text={line}
              typingSpeed={75}
              pauseDuration={1500}
              deletingSpeed={35}
              loop={false}
              showCursor={index === heroLines.length - 1}
              cursorCharacter="|"
            />
          ))}
        </h1>
      </div>
      <section
        className={`hero-section${team.heroImage ? '' : ' hero-section--empty'}`}
        aria-labelledby="team-title"
      >
        {team.heroImage ? (
          <img className="hero-media" src={team.heroImage} alt="" aria-hidden="true" />
        ) : (
          <div className="hero-media" style={mediaStyle} aria-hidden="true" />
        )}
      </section>
    </>
  );
}
