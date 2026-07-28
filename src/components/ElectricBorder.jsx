import { useEffect, useRef } from 'react';
import './ElectricBorder.css';

function roundedRectPoint(t, width, height, radius, padding) {
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;
  const straightWidth = innerWidth - radius * 2;
  const straightHeight = innerHeight - radius * 2;
  const corner = (Math.PI * radius) / 2;
  const perimeter = straightWidth * 2 + straightHeight * 2 + corner * 4;
  let distance = t * perimeter;

  if (distance < straightWidth) return { x: padding + radius + distance, y: padding };
  distance -= straightWidth;
  if (distance < corner) {
    const a = -Math.PI / 2 + (distance / corner) * (Math.PI / 2);
    return { x: width - padding - radius + Math.cos(a) * radius, y: padding + radius + Math.sin(a) * radius };
  }
  distance -= corner;
  if (distance < straightHeight) return { x: width - padding, y: padding + radius + distance };
  distance -= straightHeight;
  if (distance < corner) {
    const a = (distance / corner) * (Math.PI / 2);
    return { x: width - padding - radius + Math.cos(a) * radius, y: height - padding - radius + Math.sin(a) * radius };
  }
  distance -= corner;
  if (distance < straightWidth) return { x: width - padding - radius - distance, y: height - padding };
  distance -= straightWidth;
  if (distance < corner) {
    const a = Math.PI / 2 + (distance / corner) * (Math.PI / 2);
    return { x: padding + radius + Math.cos(a) * radius, y: height - padding - radius + Math.sin(a) * radius };
  }
  distance -= corner;
  if (distance < straightHeight) return { x: padding, y: height - padding - radius - distance };
  distance -= straightHeight;
  const a = Math.PI + (distance / corner) * (Math.PI / 2);
  return { x: padding + radius + Math.cos(a) * radius, y: padding + radius + Math.sin(a) * radius };
}

export function ElectricBorder({
  children,
  color = '#5227FF',
  speed = 1,
  chaos = 0.12,
  borderRadius = 24,
  thickness = 2,
  className = '',
  style,
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return undefined;

    if (navigator.userAgent.includes('jsdom')) return undefined;

    const context = canvas.getContext('2d');
    if (!context) {
      return undefined;
    }

    let frameId = 0;
    let lastTime = 0;
    let elapsed = 0;
    let width = 0;
    let height = 0;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.ceil(width * dpr);
      canvas.height = Math.ceil(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = (time) => {
      if (!lastTime) lastTime = time;
      elapsed += ((time - lastTime) / 1000) * speed;
      lastTime = time;
      context.clearRect(0, 0, width, height);
      context.strokeStyle = color;
      context.lineWidth = thickness;
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.shadowColor = color;
      context.shadowBlur = 10;
      context.beginPath();

      const sampleCount = Math.max(48, Math.floor((width + height) / 3));
      const radius = Math.min(borderRadius, Math.min(width, height) / 2);
      for (let index = 0; index <= sampleCount; index += 1) {
        const progress = index / sampleCount;
        const point = roundedRectPoint(progress, width, height, radius, thickness + 3);
        const wave = Math.sin(progress * 38 + elapsed * 5) * chaos * 3;
        const x = point.x + Math.cos(progress * 19 + elapsed * 3) * wave;
        const y = point.y + Math.sin(progress * 17 + elapsed * 3.4) * wave;
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.closePath();
      context.stroke();
      frameId = window.requestAnimationFrame(draw);
    };

    resize();
    const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
    resizeObserver?.observe(container);
    frameId = window.requestAnimationFrame(draw);

    return () => {
      window.cancelAnimationFrame(frameId);
      resizeObserver?.disconnect();
    };
  }, [borderRadius, chaos, color, speed, thickness]);

  return (
    <div
      ref={containerRef}
      className={`electric-border${className ? ` ${className}` : ''}`}
      style={{
        '--electric-border-color': color,
        '--electric-border-radius': `${borderRadius}px`,
        ...style,
      }}
    >
      <canvas ref={canvasRef} className="electric-border-canvas" aria-hidden="true" />
      <span className="electric-border-glow electric-border-glow--soft" aria-hidden="true" />
      <span className="electric-border-glow electric-border-glow--sharp" aria-hidden="true" />
      <div className="electric-border-content">{children}</div>
    </div>
  );
}

export default ElectricBorder;
