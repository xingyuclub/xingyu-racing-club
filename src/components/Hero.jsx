import GradientText from './GradientText.jsx';

export function Hero({ team }) {
  const mediaStyle = team.heroImage
    ? { '--hero-image': `url("${team.heroImage}")` }
    : undefined;

  return (
    <section className="hero-section" aria-labelledby="team-title">
      <div className="hero-media" style={mediaStyle} aria-hidden="true" />
      <div className="hero-content">
        <GradientText
          as="h1"
          id="team-title"
          className="hero-brand hero-brand--centered"
          colors={['#ffffff', '#9bd6ff', '#ffffff', '#6faaff', '#ffffff']}
          animationSpeed={6}
          pauseOnHover
        >
          欢迎来到星屿车队
        </GradientText>
      </div>
    </section>
  );
}
