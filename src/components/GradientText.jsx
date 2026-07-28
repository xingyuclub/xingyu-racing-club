import { useState } from 'react';
import './GradientText.css';

export function GradientText({
  as: Component = 'span',
  children,
  className = '',
  colors = ['#5227FF', '#FF9FFC', '#B497CF'],
  animationSpeed = 8,
  direction = 'horizontal',
  pauseOnHover = false,
  yoyo = true,
  showBorder = false,
  ...rest
}) {
  const [isPaused, setIsPaused] = useState(false);
  const gradientAngle =
    direction === 'vertical' ? 'to bottom' : direction === 'diagonal' ? 'to bottom right' : 'to right';
  const gradientSize = direction === 'vertical' ? '100% 300%' : '300% 300%';
  const gradientColors = [...colors, colors[0]].join(', ');

  return (
    <Component
      {...rest}
      className={`animated-gradient-text${showBorder ? ' with-border' : ''}${className ? ` ${className}` : ''}`}
      data-paused={isPaused && pauseOnHover ? 'true' : undefined}
      onMouseEnter={pauseOnHover ? () => setIsPaused(true) : undefined}
      onMouseLeave={pauseOnHover ? () => setIsPaused(false) : undefined}
      style={{
        '--gradient-angle': gradientAngle,
        '--gradient-size': gradientSize,
        '--gradient-colors': gradientColors,
        '--gradient-speed': `${animationSpeed}s`,
        '--gradient-direction': yoyo ? 'alternate' : 'normal',
        ...rest.style,
      }}
    >
      {showBorder && <span className="gradient-border" aria-hidden="true" />}
      <span className="gradient-text-content">{children}</span>
    </Component>
  );
}

export default GradientText;
