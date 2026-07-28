import './StarBorder.css';

export function StarBorder({
  as: Component = 'div',
  className = '',
  color = '#4690ff',
  speed = '6s',
  thickness = 1,
  children,
  style,
  ...rest
}) {
  return (
    <Component
      {...rest}
      className={`star-border-container${className ? ` ${className}` : ''}`}
      style={{
        '--star-border-color': color,
        '--star-border-speed': speed,
        '--star-border-thickness': `${thickness}px`,
        ...style,
      }}
    >
      <span className="border-gradient-bottom" aria-hidden="true" />
      <span className="border-gradient-top" aria-hidden="true" />
      <span className="star-border-inner">{children}</span>
    </Component>
  );
}

export default StarBorder;
