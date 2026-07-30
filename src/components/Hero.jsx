export function Hero({ team }) {
  const mediaStyle = team.heroImage
    ? { '--hero-image': `url("${team.heroImage}")` }
    : undefined;

  return (
    <>
      <div className="hero-brand-bar">
        <h1 id="team-title" className="hero-brand">
          欢迎来到星屿车队
        </h1>
      </div>
      <section className="hero-section" aria-labelledby="team-title">
        <div className="hero-media" style={mediaStyle} aria-hidden="true" />
      </section>
    </>
  );
}
