import { useEffect, useRef, useState } from 'react';

const BASE_SPEED = 360 / 34;
const ACCEL_RANGE = 28;
const BASE_SMOOTHING = 0.1;
const ROTATION_STEP_MS = 16;
const DRAG_ROTATION_SCALE = 0.6;
const VISIBLE_SPAN = 86;
const POINTER_DRAG_THRESHOLD = 4;
const TOUCH_DRAG_THRESHOLD = 12;

function wrapAngle(angle) {
  const wrapped = angle % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getCircularOffset(index, rotation, count) {
  if (!count) return 0;

  const step = 360 / count;
  let offset = index * step - rotation;

  while (offset > 180) offset -= 360;
  while (offset < -180) offset += 360;

  return offset;
}

export function Roster({ members, onSelect = () => {} }) {
  const [phase, setPhase] = useState('idle');
  const rotationRef = useRef(0);
  const speedRef = useRef(BASE_SPEED);
  const targetSpeedRef = useRef(BASE_SPEED);
  const phaseRef = useRef('idle');
  const frameTimeRef = useRef(null);
  const animationFrameRef = useRef(0);
  const lastPointerX = useRef(null);
  const draggingRef = useRef(false);
  const touchActiveRef = useRef(false);
  const hoveredRef = useRef(false);
  const hoveredCardRef = useRef(null);
  const suppressClick = useRef(false);
  const cylinderRef = useRef(null);
  const cardRefs = useRef([]);

  const writeMotionStyles = (nextRotation, nextSpeed) => {
    const cylinder = cylinderRef.current;
    if (!cylinder) return;

    cylinder.style.setProperty('--rotation', `${nextRotation.toFixed(3)}deg`);
    cylinder.style.setProperty('--speed', `${nextSpeed.toFixed(3)}deg/s`);

    let centeredIndex = 0;
    let centeredOffset = Number.POSITIVE_INFINITY;

    members.forEach((member, index) => {
      const offset = Math.abs(getCircularOffset(index, nextRotation, members.length));
      if (offset < centeredOffset) {
        centeredIndex = index;
        centeredOffset = offset;
      }
    });

    members.forEach((member, index) => {
      const card = cardRefs.current[index];
      if (!card) return;

      const offset = getCircularOffset(index, nextRotation, members.length);
      const opacity = Math.max(0, 1 - Math.abs(offset) / VISIBLE_SPAN);
      const centerRange = 180 / members.length;
      const centerFocus = Math.max(0, 1 - Math.abs(offset) / centerRange);
      const scale = 0.82 + opacity * 0.18 + centerFocus * 0.12;
      const isVisible = opacity > 0.06;

      card.style.setProperty('--card-opacity', opacity.toFixed(3));
      card.style.setProperty('--card-scale', scale.toFixed(3));
      card.style.setProperty('--card-lift', `${(centerFocus * 46).toFixed(3)}px`);
      card.style.zIndex = index === centeredIndex ? '500' : String(Math.round(100 - Math.abs(offset)));
      card.classList.toggle('is-centered', index === centeredIndex);
      card.classList.toggle('is-visible', isVisible);
      if (isVisible) {
        card.removeAttribute('aria-hidden');
        card.tabIndex = 0;
      } else {
        card.setAttribute('aria-hidden', 'true');
        card.tabIndex = -1;
      }
    });
  };

  useEffect(() => {
    return () => {
      phaseRef.current = 'idle';
    };
  }, []);

  useEffect(() => {
    if (members.length < 2) return undefined;

    const step = (frameTime) => {
      const previousFrameTime = frameTimeRef.current;
      frameTimeRef.current = frameTime;
      const deltaMs = previousFrameTime == null ? ROTATION_STEP_MS : Math.min(frameTime - previousFrameTime, 32);
      const smoothing = 1 - Math.pow(1 - BASE_SMOOTHING, deltaMs / ROTATION_STEP_MS);
      const nextSpeed = speedRef.current + (targetSpeedRef.current - speedRef.current) * smoothing;
      const targetSpeed = targetSpeedRef.current;
      const settled =
        !draggingRef.current &&
        ((hoveredRef.current && Math.abs(nextSpeed) < 0.03) ||
          (!hoveredRef.current && Math.abs(nextSpeed - BASE_SPEED) < 0.03));
      const clampedSpeed = settled ? targetSpeed : nextSpeed;

      speedRef.current = clampedSpeed;
      rotationRef.current = wrapAngle(rotationRef.current + clampedSpeed * (deltaMs / 1000));

      writeMotionStyles(rotationRef.current, clampedSpeed);

      if (settled) {
        const nextPhase = hoveredRef.current ? 'paused' : 'idle';
        if (phaseRef.current !== nextPhase) {
          phaseRef.current = nextPhase;
          setPhase(nextPhase);
        }
      }
      animationFrameRef.current = window.requestAnimationFrame(step);
    };

    animationFrameRef.current = window.requestAnimationFrame(step);

    return () => {
      window.cancelAnimationFrame(animationFrameRef.current);
      frameTimeRef.current = null;
    };
  }, [members.length]);

  const setPhaseState = (nextPhase) => {
    if (phaseRef.current === nextPhase) return;
    phaseRef.current = nextPhase;
    setPhase(nextPhase);
  };

  const handlePointerDown = (event) => {
    lastPointerX.current = event.clientX;
    draggingRef.current = false;
    suppressClick.current = false;
    touchActiveRef.current = event.pointerType === 'touch';
    if (touchActiveRef.current) {
      speedRef.current = 0;
      targetSpeedRef.current = 0;
      writeMotionStyles(rotationRef.current, 0);
      setPhaseState('paused');
    }
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event) => {
    if (lastPointerX.current === null) return;

    const delta = event.clientX - lastPointerX.current;
    const dragThreshold = touchActiveRef.current ? TOUCH_DRAG_THRESHOLD : POINTER_DRAG_THRESHOLD;
    if (Math.abs(delta) < dragThreshold) return;

    draggingRef.current = true;
    suppressClick.current = true;
    rotationRef.current = wrapAngle(rotationRef.current - delta * DRAG_ROTATION_SCALE);
    if (touchActiveRef.current) {
      speedRef.current = 0;
      targetSpeedRef.current = 0;
    } else {
      targetSpeedRef.current = clamp(BASE_SPEED - delta * 0.45, -ACCEL_RANGE, ACCEL_RANGE);
    }
    writeMotionStyles(rotationRef.current, speedRef.current);
    setPhaseState(touchActiveRef.current ? 'paused' : 'accelerating');
    lastPointerX.current = event.clientX;
  };

  const handlePointerEnd = () => {
    const wasTouchActive = touchActiveRef.current;
    touchActiveRef.current = false;

    lastPointerX.current = null;
    if (!draggingRef.current && !wasTouchActive) return;

    draggingRef.current = false;
    targetSpeedRef.current = hoveredRef.current ? 0 : BASE_SPEED;
    setPhaseState(hoveredRef.current ? 'paused' : 'settling');
  };

  const handlePointerEnter = (event) => {
    if (event.pointerType && event.pointerType !== 'mouse') return;
    hoveredRef.current = true;
    targetSpeedRef.current = 0;
    speedRef.current = 0;
    writeMotionStyles(rotationRef.current, 0);
    if (!draggingRef.current) setPhaseState('paused');
  };

  const handlePointerLeave = (event) => {
    if (event.pointerType && event.pointerType !== 'mouse') return;
    handlePointerEnd();
    hoveredRef.current = false;
    hoveredCardRef.current = null;
    cardRefs.current.forEach((card) => card?.classList.remove('is-hovered'));
    if (!draggingRef.current) {
      targetSpeedRef.current = BASE_SPEED;
      setPhaseState('settling');
    }
  };

  const handleCardEnter = (event, index) => {
    if (event.pointerType && event.pointerType !== 'mouse') return;
    if (hoveredCardRef.current !== null) {
      cardRefs.current[hoveredCardRef.current]?.classList.remove('is-hovered');
    }
    hoveredCardRef.current = index;
    cardRefs.current[index]?.classList.add('is-hovered');
  };

  const handleCardLeave = (event, index) => {
    if (event.pointerType && event.pointerType !== 'mouse') return;
    if (hoveredCardRef.current !== index) return;
    hoveredCardRef.current = null;
    cardRefs.current[index]?.classList.remove('is-hovered');
  };

  const handleCardClick = (event, member) => {
    if (suppressClick.current) {
      event.preventDefault();
      suppressClick.current = false;
      return;
    }

    onSelect(member);
  };

  return (
    <section className="section-block" aria-labelledby="roster-title" data-reveal>
      <div className="section-heading">
        <p className="eyebrow">FULL ROSTER</p>
        <h2 id="roster-title">队员阵容</h2>
      </div>
      <div
        className={`roster-grid roster-wheel roster-wheel--cinematic roster-wheel--ambient roster-wheel--cylindrical${
          phase === 'accelerating' ? ' is-accelerating' : ''
        }${phase === 'settling' ? ' is-settling' : ''}${phase === 'paused' ? ' is-paused' : ''}`}
        data-testid="roster-grid"
        aria-label="队员阵容横向滚动列表"
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
      >
        <div
          ref={cylinderRef}
          className="roster-cylinder"
          data-testid="roster-cylinder"
          style={{
            '--member-count': String(members.length),
            '--rotation': '0deg',
            '--speed': `${BASE_SPEED.toFixed(3)}deg/s`,
          }}
        >
          {members.map((member, index) => {
            const offset = getCircularOffset(index, 0, members.length);
            const opacity = Math.max(0, 1 - Math.abs(offset) / VISIBLE_SPAN);
            const centerRange = 180 / members.length;
            const centerFocus = Math.max(0, 1 - Math.abs(offset) / centerRange);
            const scale = 0.82 + opacity * 0.18 + centerFocus * 0.12;
            const isVisible = opacity > 0.06;

            return (
              <button
                ref={(node) => {
                  cardRefs.current[index] = node;
                }}
                className={`roster-card${index === 0 ? ' is-centered' : ''}${isVisible ? ' is-visible' : ''}`}
                data-testid="roster-card"
                key={member.id}
                type="button"
                onClick={(event) => handleCardClick(event, member)}
                onPointerEnter={(event) => handleCardEnter(event, index)}
                onPointerLeave={(event) => handleCardLeave(event, index)}
                aria-label={`查看${member.name} 卡片详情`}
                aria-hidden={isVisible ? undefined : 'true'}
                tabIndex={isVisible ? 0 : -1}
                style={{
                  '--stagger-index': index,
                  '--card-angle': `${(360 / members.length) * index}deg`,
                  '--card-opacity': opacity.toFixed(3),
                  '--card-scale': scale.toFixed(3),
                  '--card-lift': `${(centerFocus * 46).toFixed(3)}px`,
                  zIndex: index === 0 ? 500 : Math.round(100 - Math.abs(offset)),
                }}
              >
                <span className="roster-avatar" data-testid="roster-avatar" aria-hidden="true">
                  {member.avatar ? <img src={member.avatar} alt="" draggable="false" /> : null}
                  <span className="roster-mark" />
                </span>
                <span className="roster-identity">
                  <strong>{member.name}</strong>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
