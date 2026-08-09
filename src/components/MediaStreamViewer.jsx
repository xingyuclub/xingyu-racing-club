import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, Download, ExternalLink, Expand, Minimize, Volume2, VolumeX } from 'lucide-react';
import ShinyText from './ShinyText.jsx';

const clampIndex = (value, length) => Math.max(0, Math.min(value, length - 1));

export function MediaStreamViewer({ items, startIndex = 0, onClose, showActions = false }) {
  const [activeSlideIndex, setActiveSlideIndex] = useState(() => clampIndex(startIndex, items.length));
  const [muted, setMuted] = useState(true);
  const [landscapeIds, setLandscapeIds] = useState(() => new Set());
  const [expandedIndex, setExpandedIndex] = useState(null);
  const viewerRef = useRef(null);
  const backButtonRef = useRef(null);
  const previousFocusRef = useRef(null);
  const loopResetTimerRef = useRef(null);
  const containerRef = useRef(null);
  const itemRefList = useRef([]);
  const stageRefList = useRef([]);
  const videoRefList = useRef([]);
  const streamItems = items.length > 1 ? [...items, items[0]] : items;
  const activeIndex = items.length ? activeSlideIndex % items.length : 0;

  const setItemRef = useCallback((index) => (node) => {
    itemRefList.current[index] = node;
  }, []);
  const setStageRef = useCallback((index) => (node) => {
    stageRefList.current[index] = node;
  }, []);
  const setVideoRef = useCallback((index) => (node) => {
    videoRefList.current[index] = node;
  }, []);

  useLayoutEffect(() => {
    if (!items.length) return;
    const nextIndex = clampIndex(startIndex, items.length);
    setActiveSlideIndex(nextIndex);
    const track = containerRef.current;
    const item = itemRefList.current[nextIndex];
    if (track && item) {
      const itemTop = item.offsetTop || nextIndex * (track.clientHeight || window.innerHeight);
      track.scrollTop = itemTop;
    }
  }, [items.length, startIndex]);

  const handleTrackScroll = useCallback((event) => {
    const track = event.currentTarget;
    if (!track.clientHeight) return;
    const nextIndex = clampIndex(
      Math.round(track.scrollTop / track.clientHeight),
      streamItems.length,
    );
    setActiveSlideIndex(nextIndex);
    window.clearTimeout(loopResetTimerRef.current);
    if (items.length > 1 && nextIndex === items.length) {
      loopResetTimerRef.current = window.setTimeout(() => {
        const currentTrack = containerRef.current;
        if (!currentTrack) return;
        currentTrack.scrollTop = 0;
        setActiveSlideIndex(0);
      }, 120);
    }
  }, [items.length, streamItems.length]);

  // Auto-play the active video, pause the rest.
  useEffect(() => {
    videoRefList.current.forEach((video, index) => {
      if (!video) return;
      if (index === activeSlideIndex) {
        video.muted = muted;
        const promise = video.play && video.play();
        if (promise && typeof promise.catch === 'function') promise.catch(() => {});
      } else {
        video.pause && video.pause();
      }
    });
  }, [activeSlideIndex, muted]);

  // Apply the shared mute state to every video whenever it changes.
  useEffect(() => {
    videoRefList.current.forEach((video) => {
      if (video) video.muted = muted;
    });
  }, [muted]);

  // Lock body scroll while the viewer is open.
  useEffect(() => {
    if (!items.length) return undefined;
    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    document.body.classList.add('modal-open');
    const frame = window.requestAnimationFrame(() => backButtonRef.current?.focus());
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(loopResetTimerRef.current);
      document.body.classList.remove('modal-open');
      previousFocusRef.current?.focus?.();
    };
  }, [items.length]);

  const scrollToIndex = useCallback((index) => {
    const clamped = clampIndex(index, streamItems.length);
    const node = itemRefList.current[clamped];
    if (node && node.scrollIntoView) node.scrollIntoView({ behavior: 'auto', block: 'start' });
  }, [streamItems.length]);

  // Keyboard: Esc closes, ArrowUp/ArrowDown navigate.
  useEffect(() => {
    if (!items.length) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        if (expandedIndex !== null) {
          setExpandedIndex(null);
          return;
        }
        onClose && onClose();
      } else if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
        event.preventDefault();
        scrollToIndex(activeSlideIndex + 1);
      } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
        event.preventDefault();
        scrollToIndex(activeSlideIndex - 1);
      } else if (event.key === 'Tab') {
        const viewer = viewerRef.current;
        if (!viewer) return;
        const focusable = Array.from(viewer.querySelectorAll('button:not([disabled]), a[href]'));
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!viewer.contains(document.activeElement)) {
          event.preventDefault();
          first.focus();
        } else if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [items.length, activeSlideIndex, onClose, scrollToIndex, expandedIndex]);

  // Sync landscape-expand state with native fullscreen changes.
  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        setExpandedIndex(null);
      }
    };
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
    };
  }, []);

  // Release sources after a real unmount; StrictMode's effect rehearsal keeps the viewer connected.
  useEffect(() => {
    if (!items.length) return undefined;
    const videos = videoRefList.current.slice();
    const viewer = viewerRef.current;
    return () => {
      videos.forEach((video) => {
        if (!video) return;
        if (video.pause) video.pause();
      });
      window.setTimeout(() => {
        if (viewer?.isConnected) return;
        videos.forEach((video) => {
          if (!video) return;
          video.removeAttribute('src');
          if (video.load) video.load();
        });
      }, 0);
    };
  }, [items.length]);

  const toggleMute = useCallback(() => setMuted((value) => !value), []);

  const handleVideoMetadata = useCallback((index) => (event) => {
    const video = event.currentTarget;
    if (!video) return;
    if ((video.videoWidth || 0) > (video.videoHeight || 0)) {
      setLandscapeIds((current) => {
        if (current.has(index)) return current;
        const next = new Set(current);
        next.add(index);
        return next;
      });
    }
  }, []);

  const handleImageLoad = useCallback((index) => (event) => {
    const image = event.currentTarget;
    if (!image || image.naturalWidth <= image.naturalHeight) return;
    setLandscapeIds((current) => {
      if (current.has(index)) return current;
      const next = new Set(current);
      next.add(index);
      return next;
    });
  }, []);

  const enterLandscape = useCallback((index) => () => {
    setExpandedIndex((current) => {
      if (current === index) return null;
      const stage = stageRefList.current[index];
      if (stage) {
        const request = stage.requestFullscreen || stage.webkitRequestFullscreen;
        if (typeof request === 'function') {
          Promise.resolve(request.call(stage)).catch(() => {});
        }
      }
      return index;
    });
  }, []);

  const exitLandscape = useCallback(() => {
    const exit = document.exitFullscreen || document.webkitExitFullscreen;
    if (typeof exit === 'function') {
      const promise = exit.call(document);
      if (promise && typeof promise.catch === 'function') promise.catch(() => {});
    }
    setExpandedIndex(null);
  }, []);

  if (!items.length) return null;
  const activeItem = items[activeIndex];

  return (
    <div ref={viewerRef} className="media-stream-viewer" data-entrance role="dialog" aria-modal="true" aria-label="媒体预览">
      <header className="media-stream-topbar">
        <button
          className="media-stream-back"
          ref={backButtonRef}
          type="button"
          onClick={onClose}
          aria-label="返回"
        >
          <ArrowLeft aria-hidden="true" size={22} />
        </button>
        {showActions && activeItem && activeItem.downloadSrc && (
          <a
            className="media-stream-action"
            href={activeItem.downloadSrc}
            download
            target="_blank"
            rel="noreferrer"
            aria-label={'下载' + (activeItem.title || '')}
          >
            <Download aria-hidden="true" size={20} />
          </a>
        )}
        {showActions && activeItem && activeItem.originalUrl && (
          <a
            className="media-stream-action"
            href={activeItem.originalUrl}
            target="_blank"
            rel="noreferrer"
            aria-label={activeItem.kind === 'video' ? '在线播放原视频' : '查看原图'}
          >
            <ExternalLink aria-hidden="true" size={20} />
          </a>
        )}
        <span className="media-stream-counter">
          {activeIndex + 1} / {items.length}
        </span>
      </header>

      <div className="media-stream-track" ref={containerRef} onScroll={handleTrackScroll}>
        {streamItems.map((item, index) => {
          const isVideo = item.kind === 'video';
          const isActive = index === activeSlideIndex;
          const isLandscape = landscapeIds.has(index)
            || (Number(item.width) > Number(item.height));
          const isExpanded = expandedIndex === index;
          return (
            <div
              className="media-stream-item"
              ref={setItemRef(index)}
              data-index={index}
              key={`${item.key}${index === items.length ? '--loop' : ''}`}
            >
              <div className={'media-stream-stage' + (isExpanded ? ' is-expanded' : '')} ref={setStageRef(index)}>
                {isVideo ? (
                  item.src ? (
                    <video
                      ref={setVideoRef(index)}
                      className="media-stream-media"
                      src={item.src}
                      poster={item.poster}
                      autoPlay={index === activeSlideIndex}
                      muted={muted}
                      loop
                      playsInline
                      preload="metadata"
                      onClick={isExpanded ? undefined : toggleMute}
                      onLoadedMetadata={handleVideoMetadata(index)}
                    />
                  ) : (
                    <div className="media-stream-fallback">视频素材待替换</div>
                  )
                ) : item.src ? (
                  <img
                    className="media-stream-media"
                    src={item.src}
                    alt={item.title || ''}
                    onLoad={handleImageLoad(index)}
                  />
                ) : (
                  <div className="media-stream-fallback">照片素材待替换</div>
                )}

                {isExpanded && (
                  <button
                    className="media-stream-exit"
                    type="button"
                    onClick={exitLandscape}
                    aria-label="退出全屏"
                  >
                    <Minimize aria-hidden="true" size={20} />
                  </button>
                )}
              </div>

              {isActive && isVideo && !isExpanded && (
                <button
                  className="media-stream-sound"
                  type="button"
                  onClick={toggleMute}
                  aria-label={muted ? '开启声音' : '关闭声音'}
                >
                  {muted ? <VolumeX aria-hidden="true" size={22} /> : <Volume2 aria-hidden="true" size={22} />}
                </button>
              )}
              {isActive && isLandscape && !isExpanded && (
                <button
                  className="media-stream-landscape"
                  type="button"
                  onClick={enterLandscape(index)}
                  aria-label={isVideo ? '横屏播放' : '全屏查看'}
                >
                  <Expand aria-hidden="true" size={18} />
                  {isVideo ? '横屏播放' : '全屏查看'}
                </button>
              )}

              {isActive && !isExpanded && (item.title || item.signature || item.subtitle) && (
                <div className="media-stream-caption">
                  {item.title && <strong className="media-stream-name">{item.title}</strong>}
                  {item.subtitle && <span className="media-stream-subtitle">{item.subtitle}</span>}
                  {item.signature && item.signature.trim() && (
                    <span className="media-stream-signature">
                      <ShinyText
                        text={item.signature.trim()}
                        color="#c9d4ff"
                        shineColor="#ffffff"
                        speed={3.8}
                        direction="left"
                        respectReducedMotion={false}
                      />
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
