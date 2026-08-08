import { useEffect, useRef, useState } from 'react';
import { ExternalLink, Play } from 'lucide-react';
import GradientText from './GradientText.jsx';
import { resolvePublicAssetPath } from '../utils/publicAsset.js';

const HERO_GRADIENT_COLORS = ['#40ffaa', '#4079ff', '#a85cff', '#ff5e9f', '#40ffaa'];
const DEFAULT_HERO_FALLBACK_IMAGE = resolvePublicAssetPath('/images/album/placeholder-01.jpg');

export function Hero({ team, showMedia = true, onVideoPlaybackChange }) {
  const heroLines = Array.isArray(team.heroLines) && team.heroLines.length
    ? team.heroLines
    : [team.name];
  const primaryMedia = team.heroMedia && typeof team.heroMedia === 'object'
    ? team.heroMedia
    : { src: team.heroImage || '', type: 'image' };
  const videoRef = useRef(null);
  const [videoFailed, setVideoFailed] = useState(false);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [videoStarted, setVideoStarted] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  const fallbackImage = team.heroFallbackImage || DEFAULT_HERO_FALLBACK_IMAGE;
  const posterImage = primaryMedia.posterSrc || fallbackImage;
  const isVideo = primaryMedia.type === 'video' && Boolean(primaryMedia.src) && !videoFailed;
  const isImage = primaryMedia.type === 'image' && Boolean(primaryMedia.src);
  const mediaSrc = isVideo || isImage ? primaryMedia.src : fallbackImage;
  const hasMedia = Boolean(mediaSrc) && !imageFailed;

  useEffect(() => {
    setVideoFailed(false);
    setVideoPlaying(false);
    setVideoStarted(false);
    setImageFailed(false);
    onVideoPlaybackChange?.(false);
  }, [showMedia, primaryMedia.src, primaryMedia.type, posterImage, fallbackImage, onVideoPlaybackChange]);

  const handlePlaybackClick = () => {
    const video = videoRef.current;
    if (!video) return;

    if (videoPlaying) {
      video.pause();
      return;
    }

    video.muted = false;
    onVideoPlaybackChange?.(true);
    video.play()?.catch(() => {
      setVideoFailed(true);
      onVideoPlaybackChange?.(false);
    });
  };

  const handlePlaying = () => {
    setVideoStarted(true);
    setVideoPlaying(true);
    onVideoPlaybackChange?.(true);
  };

  const handlePause = () => {
    setVideoPlaying(false);
    onVideoPlaybackChange?.(false);
  };

  const handleVideoError = () => {
    setVideoFailed(true);
    setVideoStarted(false);
    onVideoPlaybackChange?.(false);
  };

  const handleVideoKeyDown = (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    handlePlaybackClick();
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
              src={posterImage}
              alt=""
              aria-hidden="true"
              onError={() => setImageFailed(true)}
            />
            <video
              ref={videoRef}
              className={`hero-media hero-media--video${videoStarted ? '' : ' hero-media--pending'}`}
              src={mediaSrc}
              loop
              playsInline
              preload="none"
              aria-hidden={videoPlaying ? undefined : true}
              aria-label={videoPlaying ? '暂停车队视频' : undefined}
              role={videoPlaying ? 'button' : undefined}
              tabIndex={videoPlaying ? 0 : undefined}
              onClick={videoPlaying ? handlePlaybackClick : undefined}
              onKeyDown={videoPlaying ? handleVideoKeyDown : undefined}
              onPlaying={handlePlaying}
              onPause={handlePause}
              onError={handleVideoError}
            />
            {!videoPlaying && (
              <button
                type="button"
                className="hero-play-button"
                aria-label="播放车队视频"
                onClick={handlePlaybackClick}
              >
                <Play aria-hidden="true" />
              </button>
            )}
            {primaryMedia.originalSrc && primaryMedia.originalSrc !== primaryMedia.src && (
              <a
                className="media-original-action hero-original-action"
                href={primaryMedia.originalSrc}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink aria-hidden="true" size={15} />
                在线播放原视频
              </a>
            )}
          </div>
        ) : hasMedia ? (
          <>
            <img
              className="hero-media"
              src={mediaSrc}
              alt=""
              aria-hidden="true"
              onError={() => setImageFailed(true)}
            />
            {isImage && primaryMedia.originalSrc && primaryMedia.originalSrc !== primaryMedia.src && (
              <a
                className="media-original-action hero-original-action"
                href={primaryMedia.originalSrc}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink aria-hidden="true" size={15} />
                查看原图
              </a>
            )}
          </>
        ) : (
          <div className="hero-media" aria-hidden="true" />
        )}
      </section>
      )}
    </div>
  );
}
