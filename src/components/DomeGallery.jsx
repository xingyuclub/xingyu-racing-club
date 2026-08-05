import { useCallback, useEffect, useMemo, useRef } from 'react';
import './DomeGallery.css';

const DEFAULTS = {
  maxVerticalRotationDeg: 5,
  dragSensitivity: 20,
  segments: 35,
};

const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
const wrapAngleSigned = (deg) => {
  const a = (((deg + 180) % 360) + 360) % 360;
  return a - 180;
};
const getDataNumber = (el, name, fallback) => {
  const attr = el.dataset[name] ?? el.getAttribute(`data-${name}`);
  const n = attr == null ? NaN : parseFloat(attr);
  return Number.isFinite(n) ? n : fallback;
};

function buildItems(pool, seg) {
  // 2x2-segment tiles on a 15-degree grid (columns and rows one segment apart):
  // tiles touch edge to edge without overlapping, so every portrait stays whole
  // instead of being cut into strips by the sphere tiling.
  const xCols = Array.from({ length: seg }, (_, i) => -37 + i * 2);
  const ys = [-4, -2, 0, 2, 4];

  const coords = xCols.flatMap((x) => ys.map((y) => ({ x, y, sizeX: 2, sizeY: 2 })));

  const totalSlots = coords.length;
  if (pool.length === 0) {
    return coords.map((c) => ({ ...c, src: '', alt: '', label: '', srcIndex: 0 }));
  }

  const normalizedImages = pool.map((image, index) => {
    if (typeof image === 'string') return { src: image, alt: '', label: '', srcIndex: index };
    return { src: image.src || '', alt: image.alt || '', label: image.label || '', srcIndex: index };
  });

  const usedImages = Array.from(
    { length: totalSlots },
    (_, i) => normalizedImages[i % normalizedImages.length],
  );

  // Avoid two identical adjacent tiles by swapping in the next different image.
  for (let i = 1; i < usedImages.length; i += 1) {
    if (usedImages[i].src === usedImages[i - 1].src) {
      for (let j = i + 1; j < usedImages.length; j += 1) {
        if (usedImages[j].src !== usedImages[i].src) {
          const tmp = usedImages[i];
          usedImages[i] = usedImages[j];
          usedImages[j] = tmp;
          break;
        }
      }
    }
  }

  return coords.map((c, i) => ({ ...c, ...usedImages[i] }));
}

export default function DomeGallery({
  images = [],
  fit = 0.5,
  fitBasis = 'auto',
  minRadius = 600,
  maxRadius = Infinity,
  overlayBlurColor = '#120F17',
  maxVerticalRotationDeg = DEFAULTS.maxVerticalRotationDeg,
  dragSensitivity = DEFAULTS.dragSensitivity,
  segments = DEFAULTS.segments,
  dragDampening = 2,
  imageBorderRadius = '30px',
  grayscale = true,
  onTileSelect = () => {},
}) {
  const rootRef = useRef(null);
  const mainRef = useRef(null);
  const sphereRef = useRef(null);

  const rotationRef = useRef({ x: 0, y: 0 });
  const startRotRef = useRef({ x: 0, y: 0 });
  const startPosRef = useRef(null);
  const lastMovePosRef = useRef(null);
  const lastMoveTimeRef = useRef(0);
  const velocityRef = useRef({ x: 0, y: 0 });
  const draggingRef = useRef(false);
  const movedRef = useRef(false);
  const inertiaRAF = useRef(null);
  const lastDragEndAt = useRef(0);

  const items = useMemo(() => buildItems(images, segments), [images, segments]);
  const onTileSelectRef = useRef(onTileSelect);
  onTileSelectRef.current = onTileSelect;

  const applyTransform = useCallback((xDeg, yDeg) => {
    const el = sphereRef.current;
    if (el) {
      el.style.transform = `translateZ(calc(var(--radius) * -1)) rotateX(${xDeg}deg) rotateY(${yDeg}deg)`;
    }
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    if (typeof ResizeObserver === 'undefined') {
      applyTransform(rotationRef.current.x, rotationRef.current.y);
      return undefined;
    }

    const ro = new ResizeObserver((entries) => {
      const cr = entries[0].contentRect;
      const w = Math.max(1, cr.width);
      const h = Math.max(1, cr.height);
      const minDim = Math.min(w, h);
      const maxDim = Math.max(w, h);
      const aspect = w / h;
      let basis;
      switch (fitBasis) {
        case 'min':
          basis = minDim;
          break;
        case 'max':
          basis = maxDim;
          break;
        case 'width':
          basis = w;
          break;
        case 'height':
          basis = h;
          break;
        default:
          basis = aspect >= 1.3 ? w : minDim;
      }
      let radius = basis * fit;
      const heightGuard = h * 1.35;
      radius = Math.min(radius, heightGuard);
      radius = clamp(radius, minRadius, maxRadius);
      root.style.setProperty('--radius', `${Math.round(radius)}px`);
      root.style.setProperty('--overlay-blur-color', overlayBlurColor);
      root.style.setProperty('--tile-radius', imageBorderRadius);
      root.style.setProperty('--image-filter', grayscale ? 'grayscale(1)' : 'none');
      applyTransform(rotationRef.current.x, rotationRef.current.y);
    });
    ro.observe(root);
    return () => ro.disconnect();
  }, [
    fit,
    fitBasis,
    minRadius,
    maxRadius,
    overlayBlurColor,
    grayscale,
    imageBorderRadius,
    applyTransform,
  ]);

  useEffect(() => {
    applyTransform(rotationRef.current.x, rotationRef.current.y);
  }, [applyTransform]);

  const stopInertia = useCallback(() => {
    if (inertiaRAF.current) {
      cancelAnimationFrame(inertiaRAF.current);
      inertiaRAF.current = null;
    }
  }, []);

  useEffect(() => () => stopInertia(), [stopInertia]);

  const startInertia = useCallback(
    (vx, vy) => {
      const MAX_V = 1.4;
      let vX = clamp(vx, -MAX_V, MAX_V) * 80;
      let vY = clamp(vy, -MAX_V, MAX_V) * 80;
      let frames = 0;
      const d = clamp(dragDampening ?? 0.6, 0, 1);
      const frictionMul = 0.94 + 0.055 * d;
      const stopThreshold = 0.015 - 0.01 * d;
      const maxFrames = Math.round(90 + 270 * d);
      const step = () => {
        vX *= frictionMul;
        vY *= frictionMul;
        if (Math.abs(vX) < stopThreshold && Math.abs(vY) < stopThreshold) {
          inertiaRAF.current = null;
          return;
        }
        if (++frames > maxFrames) {
          inertiaRAF.current = null;
          return;
        }
        const nextX = clamp(
          rotationRef.current.x - vY / 200,
          -maxVerticalRotationDeg,
          maxVerticalRotationDeg,
        );
        const nextY = wrapAngleSigned(rotationRef.current.y + vX / 200);
        rotationRef.current = { x: nextX, y: nextY };
        applyTransform(nextX, nextY);
        inertiaRAF.current = requestAnimationFrame(step);
      };
      stopInertia();
      inertiaRAF.current = requestAnimationFrame(step);
    },
    [dragDampening, maxVerticalRotationDeg, stopInertia, applyTransform],
  );

  const handlePointerDown = useCallback(
    (event) => {
      stopInertia();
      if (typeof event.currentTarget.setPointerCapture === 'function') {
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          /* pointer already gone */
        }
      }
      draggingRef.current = true;
      movedRef.current = false;
      startRotRef.current = { ...rotationRef.current };
      startPosRef.current = { x: event.clientX, y: event.clientY };
      lastMovePosRef.current = { x: event.clientX, y: event.clientY };
      lastMoveTimeRef.current = performance.now();
      velocityRef.current = { x: 0, y: 0 };
    },
    [stopInertia],
  );

  const handlePointerMove = useCallback(
    (event) => {
      if (!draggingRef.current || !startPosRef.current) return;
      const dxTotal = event.clientX - startPosRef.current.x;
      const dyTotal = event.clientY - startPosRef.current.y;
      if (!movedRef.current) {
        const dist2 = dxTotal * dxTotal + dyTotal * dyTotal;
        if (dist2 > 100) movedRef.current = true;
      }
      const now = performance.now();
      const prevPos = lastMovePosRef.current;
      if (prevPos) {
        const dt = Math.max(1, now - lastMoveTimeRef.current);
        const vx = (event.clientX - prevPos.x) / dt;
        const vy = (event.clientY - prevPos.y) / dt;
        velocityRef.current = {
          x: velocityRef.current.x * 0.7 + vx * 0.3,
          y: velocityRef.current.y * 0.7 + vy * 0.3,
        };
      }
      lastMovePosRef.current = { x: event.clientX, y: event.clientY };
      lastMoveTimeRef.current = now;

      const nextX = clamp(
        startRotRef.current.x - dyTotal / dragSensitivity,
        -maxVerticalRotationDeg,
        maxVerticalRotationDeg,
      );
      const nextY = wrapAngleSigned(startRotRef.current.y + dxTotal / dragSensitivity);
      if (rotationRef.current.x !== nextX || rotationRef.current.y !== nextY) {
        rotationRef.current = { x: nextX, y: nextY };
        applyTransform(nextX, nextY);
      }
    },
    [dragSensitivity, maxVerticalRotationDeg, applyTransform],
  );

  const handlePointerEnd = useCallback(
    (event) => {
      if (!draggingRef.current) return;
      const start = startPosRef.current;
      const lastMove = lastMovePosRef.current;
      const endX = Number.isFinite(event.clientX) ? event.clientX : (lastMove ? lastMove.x : (start ? start.x : 0));
      const endY = Number.isFinite(event.clientY) ? event.clientY : (lastMove ? lastMove.y : (start ? start.y : 0));
      draggingRef.current = false;
      startPosRef.current = null;
      lastMovePosRef.current = null;

      const mx = start ? endX - start.x : 0;
      const my = start ? endY - start.y : 0;

      let vx = velocityRef.current.x;
      let vy = velocityRef.current.y;
      if (Math.abs(vx) < 0.001 && Math.abs(vy) < 0.001) {
        vx = clamp((mx / dragSensitivity) * 0.02, -1.2, 1.2);
        vy = clamp((my / dragSensitivity) * 0.02, -1.2, 1.2);
      }
      velocityRef.current = { x: 0, y: 0 };
      if (Math.abs(vx) > 0.005 || Math.abs(vy) > 0.005) startInertia(vx, vy);
      if (movedRef.current) lastDragEndAt.current = performance.now();
      movedRef.current = false;
    },
    [dragSensitivity, startInertia],
  );

  const handlePointerCancel = useCallback(() => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    startPosRef.current = null;
    lastMovePosRef.current = null;
    velocityRef.current = { x: 0, y: 0 };
    movedRef.current = false;
  }, []);

  const openTile = useCallback((event) => {
    if (draggingRef.current || movedRef.current) return;
    if (performance.now() - lastDragEndAt.current < 80) return;
    const parent = event.currentTarget.parentElement;
    const srcIndex = getDataNumber(parent, 'srcIndex', 0);
    onTileSelectRef.current(srcIndex);
  }, []);

  const openTileOnPointerUp = useCallback(
    (event) => {
      if (event.pointerType !== 'touch') return;
      openTile(event);
    },
    [openTile],
  );

  return (
    <div
      ref={rootRef}
      className="sphere-root"
      style={{
        ['--segments-x']: segments,
        ['--segments-y']: segments,
        ['--overlay-blur-color']: overlayBlurColor,
        ['--tile-radius']: imageBorderRadius,
        ['--image-filter']: grayscale ? 'grayscale(1)' : 'none',
      }}
    >
      <main
        ref={mainRef}
        className="sphere-main"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerCancel}
      >
        <div className="stage">
          <div ref={sphereRef} className="sphere" data-testid="roster-sphere">
            {items.map((it, i) => (
              <div
                key={`${it.x},${it.y},${i}`}
                className="item"
                data-src={it.src}
                data-src-index={it.srcIndex}
                data-offset-x={it.x}
                data-offset-y={it.y}
                data-size-x={it.sizeX}
                data-size-y={it.sizeY}
                style={{
                  ['--offset-x']: it.x,
                  ['--offset-y']: it.y,
                  ['--item-size-x']: it.sizeX,
                  ['--item-size-y']: it.sizeY,
                }}
              >
                <div
                  className="item__image"
                  role="button"
                  tabIndex={0}
                  data-testid="roster-tile"
                  aria-label={it.alt || 'Open image'}
                  onClick={openTile}
                  onPointerUp={openTileOnPointerUp}
                >
                  {it.src ? (
                    <img src={it.src} draggable={false} alt={it.alt} loading="lazy" decoding="async" />
                  ) : (
                    <span className="item__placeholder" data-initial={it.label ? [...it.label][0] : ''}>
                      <span className="item__placeholder-name">{it.label}</span>
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="overlay" />
      </main>
    </div>
  );
}
