import { useRef, useState } from 'react';
import GradientText from './GradientText.jsx';

const HERO_GRADIENT_COLORS = ['#40ffaa', '#4079ff', '#a85cff', '#ff5e9f', '#40ffaa'];
const DEFAULT_HERO_FALLBACK_IMAGE = '/images/hero-home.png';

export function Hero({ team, showMedia = true }) {
  const heroLines = Array.isArray(team.heroLines) && team.heroLines.length
    ? team.heroLines
    : [team.name];
  const primaryMedia = team.heroMedia && typeof team.heroMedia === 'object'
    ? team.heroMedia
    : { src: team.heroImage || '', type: 'image' };
  const videoRef = useRef(null);
  const [videoFailed, setVideoFailed] = useState(false);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  const fallbackImage = team.heroFallbackImage || DEFAULT_HERO_FALLBACK_IMAGE;
  const isVideo = primaryMedia.type === 'video' && Boolean(primaryMedia.src) && !videoFailed;
  const isImage = primaryMedia.type === 'image' && Boolean(primaryMedia.src);
  const mediaSrc = isVideo || isImage ? primaryMedia.src : fallbackImage;
  const hasMedia = Boolean(mediaSrc) && !imageFailed;

  const handlePlayClick = () => {
    videoRef.current?.play()?.catch(() => setVideoFailed(true));
  };

  return (
    <div className="hero-module" data-reveal>
      <div className="hero-brand-bar">
        <h1 id="team-title" className="hero-brand" aria-label={heroLines.join('\n')}>
          {heroLines.map((line, index) => (
            <GradientText
              className="hero-brand-line"
              key={`${line}-${index}`}
              colors={HERO_GRADIENT_COLORS}
              animationSpeed={3}
              showBorder={false}
            >
              {line}
            </GradientText>
          ))}
        </h1>
      </div>
      {showMedia && (
      <section
        className={`hero-section${hasMedia ? '' : ' hero-section--empty'}`}
        aria-labelledby="team-title"
      >
        {isVideo ? (
          <div className="hero-media-stack">
            <img
              className="hero-media hero-media--poster"
              src={fallbackImage}
              alt=""
              aria-hidden="true"
              onError={() => setImageFailed(true)}
            />
            <video
              ref={videoRef}
              className={`hero-media hero-media--video${videoPlaying ? '' : ' hero-media--pending'}`}
              src={mediaSrc}
              muted
              loop
              playsInline
              preload="none"
              aria-hidden="true"
              onPlaying={() => setVideoPlaying(true)}
              onError={() => setVideoFailed(true)}
            />
            {!videoPlaying && (
              <button
                type="button"
                className="hero-play-button"
                aria-label="播放车队视频"
                onClick={handlePlayClick}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path d="M8 5v14l11-7z" fill="currentColor" />
                </svg>
              </button>
            )}
          </div>
        ) : hasMedia ? (
          <img
            className="hero-media"
            src={mediaSrc}
            alt=""
            aria-hidden="true"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="hero-media" aria-hidden="true" />
        )}
      </section>
      )}
    </div>
  );
}
