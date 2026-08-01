import { useEffect, useRef, useState } from 'react';
import { Play } from 'lucide-react';

function getPosition(index, activeIndex, count) {
  const distance = (index - activeIndex + count) % count;

  if (distance === 0) return 'is-active';
  if (distance === 1) return 'is-next';
  if (distance === count - 1) return 'is-prev';
  if (distance === 2) return 'is-far-next';
  if (distance === count - 2) return 'is-far-prev';
  return 'is-hidden';
}

export function FeaturedMembers({ members, onSelect }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [interactionKey, setInteractionKey] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const pointerStart = useRef(null);
  const didSwipe = useRef(false);

  useEffect(() => {
    if (isDragging || members.length < 2) return undefined;

    const timer = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % members.length);
    }, 4000);

    return () => window.clearInterval(timer);
  }, [interactionKey, isDragging, members.length]);

  const selectIndex = (index) => {
    setActiveIndex((index + members.length) % members.length);
    setInteractionKey((key) => key + 1);
  };

  const handlePointerDown = (event) => {
    pointerStart.current = event.clientX;
    didSwipe.current = false;
    setIsDragging(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handlePointerUp = (event) => {
    if (pointerStart.current === null) return;

    const distance = event.clientX - pointerStart.current;
    if (Math.abs(distance) >= 45) {
      didSwipe.current = true;
      selectIndex(activeIndex + (distance < 0 ? 1 : -1));
    }

    pointerStart.current = null;
    setIsDragging(false);
  };

  const handlePointerCancel = () => {
    pointerStart.current = null;
    setIsDragging(false);
  };

  return (
    <section className="section-block featured-section" aria-labelledby="featured-title" data-reveal>
      <div className="section-heading">
        <p className="eyebrow">FEATURED DRIVERS</p>
        <h2 id="featured-title">车队风采</h2>
      </div>
      <div
        className={`carousel-viewport${isDragging ? ' is-dragging' : ''}`}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        {members.map((member, index) => (
          <button
            className={`driver-card ${getPosition(index, activeIndex, members.length)}`}
            key={member.id}
            type="button"
            onClick={() => {
              if (didSwipe.current) {
                didSwipe.current = false;
                return;
              }
              onSelect(member);
            }}
            aria-label={`查看${member.name} 高光视频`}
          >
            <span
              className="driver-portrait"
              style={member.avatar ? { '--member-image': `url("${member.avatar}")` } : undefined}
              aria-hidden="true"
            />
            <span className="driver-footer">
              <span className="member-meta">
                <span>{member.role}</span>
                <strong>{member.name}</strong>
              </span>
              <span className="play-button" aria-hidden="true">
                <Play size={16} />
              </span>
            </span>
          </button>
        ))}
      </div>
      <div className="carousel-dots" aria-label="车队风采轮播位置">
        {members.map((member, index) => (
          <button
            className={`carousel-dot${index === activeIndex ? ' is-active' : ''}`}
            key={member.id}
            type="button"
            onClick={() => selectIndex(index)}
            aria-label={`切换至${member.name}`}
            aria-current={index === activeIndex ? 'true' : undefined}
          />
        ))}
      </div>
    </section>
  );
}
