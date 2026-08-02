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
  const gradientSize = direction === 'vertical' ? '100% 300%' : '300% 100%';
  const gradientColors = [...colors, colors[0]].join(', ');
  const gradientStyle = {
    backgroundImage: `linear-gradient(${gradientAngle}, ${gradientColors})`,
    backgroundSize: gradientSize,
  };

  return (
    <Component
      {...rest}
      className={`animated-gradient-text${showBorder ? ' with-border' : ''}${className ? ` ${className}` : ''}`}
      data-paused={isPaused && pauseOnHover ? 'true' : undefined}
      onMouseEnter={pauseOnHover ? () => setIsPaused(true) : undefined}
      onMouseLeave={pauseOnHover ? () => setIsPaused(false) : undefined}
      style={{
        '--gradient-speed': `${animationSpeed}s`,
        '--gradient-direction': yoyo ? 'alternate' : 'normal',
        ...rest.style,
      }}
    >
      {showBorder && <span className="gradient-border" aria-hidden="true" />}
      <span className="gradient-text-content" style={gradientStyle}>{children}</span>
    </Component>
  );
}

export default GradientText;
