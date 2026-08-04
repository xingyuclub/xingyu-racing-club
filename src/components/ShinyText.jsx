import { useCallback, useEffect, useRef } from 'react';
import {
  motion,
  useAnimationFrame,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from 'motion/react';
import './ShinyText.css';

export default function ShinyText({
  text,
  disabled = false,
  speed = 2,
  className = '',
  color = '#b5b5b5',
  shineColor = '#ffffff',
  spread = 120,
  yoyo = false,
  pauseOnHover = false,
  direction = 'left',
  delay = 0,
}) {
  const isReducedMotion = useReducedMotion() === true;
  const isPaused = useRef(false);
  const progress = useMotionValue(0);
  const elapsed = useRef(0);
  const lastTime = useRef(null);
  const directionValue = useRef(direction === 'left' ? 1 : -1);
  const animationDuration = Math.max(speed, 0.1) * 1000;
  const delayDuration = Math.max(delay, 0) * 1000;
  const isStatic = disabled || isReducedMotion;

  useAnimationFrame((time) => {
    if (isStatic || isPaused.current) {
      lastTime.current = null;
      return;
    }

    if (lastTime.current === null) {
      lastTime.current = time;
      return;
    }

    const delta = time - lastTime.current;
    lastTime.current = time;
    elapsed.current += delta;

    const cycleDuration = animationDuration + delayDuration;
    const cycleTime = elapsed.current % (yoyo ? cycleDuration * 2 : cycleDuration);
    let nextProgress;

    if (yoyo && cycleTime >= cycleDuration) {
      const reverseTime = cycleTime - cycleDuration;
      nextProgress = reverseTime < animationDuration
        ? 100 - (reverseTime / animationDuration) * 100
        : 0;
    } else if (cycleTime < animationDuration) {
      nextProgress = (cycleTime / animationDuration) * 100;
    } else {
      nextProgress = 100;
    }

    progress.set(directionValue.current === 1 ? nextProgress : 100 - nextProgress);
  });

  useEffect(() => {
    directionValue.current = direction === 'left' ? 1 : -1;
    elapsed.current = 0;
    progress.set(0);
  }, [direction, progress]);

  const backgroundPosition = useTransform(progress, (value) => `${150 - value * 2}% center`);
  const handleMouseEnter = useCallback(() => {
    if (pauseOnHover) isPaused.current = true;
  }, [pauseOnHover]);
  const handleMouseLeave = useCallback(() => {
    if (pauseOnHover) isPaused.current = false;
  }, [pauseOnHover]);

  const classNames = ['shiny-text', isStatic ? 'shiny-text--static' : '', className]
    .filter(Boolean)
    .join(' ');
  const staticStyle = isStatic ? { color } : undefined;
  const animatedStyle = {
    color,
    backgroundImage: `linear-gradient(${spread}deg, ${color} 0%, ${color} 35%, ${shineColor} 50%, ${color} 65%, ${color} 100%)`,
    backgroundSize: '200% auto',
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundPosition,
  };

  if (isStatic) {
    return <span className={classNames} style={staticStyle}>{text}</span>;
  }

  return (
    <motion.span
      className={classNames}
      style={animatedStyle}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {text}
    </motion.span>
  );
}
