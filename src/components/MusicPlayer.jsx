import { Pause, Play } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const LONG_PRESS_MS = 650;
const DRAG_THRESHOLD_PX = 6;
const PLAYER_SIZE_PX = 56;
const VIEWPORT_GUTTER_PX = 12;

const getInitialTop = () => Math.round(window.innerHeight * 0.58);

export function MusicPlayer({ src, cover, pauseForMedia = false }) {
  const audioRef = useRef(null);
  const pauseForMediaRef = useRef(pauseForMedia);
  const playerRef = useRef(null);
  const longPressTimerRef = useRef(null);
  const clickResetTimerRef = useRef(null);
  const longPressedRef = useRef(false);
  const dragStartRef = useRef(null);
  const hasDraggedRef = useRef(false);
  const suppressClickRef = useRef(false);
  const topPositionRef = useRef(getInitialTop());
  const [isPlaying, setIsPlaying] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [topPosition, setTopPosition] = useState(topPositionRef.current);
  pauseForMediaRef.current = pauseForMedia;

  useEffect(() => {
    if (isDismissed) return undefined;

    const audio = audioRef.current;
    let active = true;

    const attemptPlay = async (event) => {
      if (
        pauseForMediaRef.current
        || event?.target?.closest?.('.hero-media-stack, .hero-play-button')
      ) {
        if (active) document.addEventListener('pointerdown', attemptPlay, { once: true });
        return;
      }

      try {
        await audio.play();
        if (active && pauseForMediaRef.current) {
          audio.pause();
          setIsPlaying(false);
        } else if (active) {
          setIsPlaying(true);
        }
      } catch {
        if (active) {
          setIsPlaying(false);
          document.addEventListener('pointerdown', attemptPlay, { once: true });
        }
      }
    };

    void attemptPlay();

    return () => {
      active = false;
      document.removeEventListener('pointerdown', attemptPlay);
      window.clearTimeout(longPressTimerRef.current);
      window.clearTimeout(clickResetTimerRef.current);
    };
  }, [isDismissed]);

  useEffect(() => {
    if (!pauseForMedia) return;
    audioRef.current?.pause();
    setIsPlaying(false);
  }, [pauseForMedia]);

  const togglePlayback = async () => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }

    if (longPressedRef.current) {
      longPressedRef.current = false;
      return;
    }

    const audio = audioRef.current;
    if (pauseForMedia) {
      audio.pause();
      setIsPlaying(false);
      return;
    }

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }

    try {
      await audio.play();
      setIsPlaying(true);
    } catch {
      setIsPlaying(false);
    }
  };

  const dismiss = () => {
    longPressedRef.current = true;
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    setIsPlaying(false);
    setIsDismissed(true);
  };

  const startLongPress = () => {
    longPressedRef.current = false;
    longPressTimerRef.current = window.setTimeout(dismiss, LONG_PRESS_MS);
  };

  const clearLongPress = () => window.clearTimeout(longPressTimerRef.current);

  const clampTop = (nextTop, playerHeight) => {
    const maxTop = Math.max(
      VIEWPORT_GUTTER_PX,
      window.innerHeight - playerHeight - VIEWPORT_GUTTER_PX,
    );

    return Math.min(Math.max(nextTop, VIEWPORT_GUTTER_PX), maxTop);
  };

  const startDrag = (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    const player = playerRef.current;
    const rect = player?.getBoundingClientRect();
    const playerHeight = rect?.height || PLAYER_SIZE_PX;
    const visualTop = rect?.height ? rect.top : topPositionRef.current;

    dragStartRef.current = {
      offsetY: event.clientY - visualTop,
      startY: event.clientY,
      playerHeight,
      pointerId: event.pointerId,
    };
    hasDraggedRef.current = false;
    startLongPress();
    player?.setPointerCapture?.(event.pointerId);
  };

  const moveDrag = (event) => {
    const dragStart = dragStartRef.current;
    if (!dragStart) return;

    if (Math.abs(event.clientY - dragStart.startY) > DRAG_THRESHOLD_PX) {
      hasDraggedRef.current = true;
      suppressClickRef.current = true;
      clearLongPress();
    }

    if (!hasDraggedRef.current) return;

    event.preventDefault();
    const nextTop = clampTop(event.clientY - dragStart.offsetY, dragStart.playerHeight);
    topPositionRef.current = nextTop;
    setTopPosition(nextTop);
  };

  const endDrag = (event) => {
    clearLongPress();
    const dragStart = dragStartRef.current;
    if (dragStart && playerRef.current?.hasPointerCapture?.(dragStart.pointerId)) {
      playerRef.current.releasePointerCapture(dragStart.pointerId);
    }
    dragStartRef.current = null;

    if (hasDraggedRef.current) {
      window.clearTimeout(clickResetTimerRef.current);
      clickResetTimerRef.current = window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
    }
  };

  if (isDismissed) return null;

  return (
    <button
      type="button"
      ref={playerRef}
      className={`music-player ${isPlaying ? 'is-playing' : 'is-paused'}`}
      data-entrance
      style={{ top: `${topPosition}px` }}
      aria-label={isPlaying ? '音乐播放中，点击暂停，长按关闭' : '音乐已暂停，点击继续，长按关闭'}
      onClick={togglePlayback}
      onPointerDown={startDrag}
      onPointerMove={moveDrag}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onContextMenu={(event) => event.preventDefault()}
    >
      <audio
        ref={audioRef}
        src={src}
        autoPlay
        loop
        preload="auto"
        onPlay={() => {
          if (pauseForMediaRef.current) {
            audioRef.current?.pause();
            setIsPlaying(false);
          } else {
            setIsPlaying(true);
          }
        }}
        onPause={() => setIsPlaying(false)}
      />
      <img src={cover} alt="" draggable="false" />
      <span className="music-player-state" aria-hidden="true">
        {isPlaying ? <Pause size={12} /> : <Play size={12} />}
      </span>
    </button>
  );
}
