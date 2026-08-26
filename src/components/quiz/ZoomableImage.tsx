import { useCallback, useEffect, useRef, useState } from 'react';
import { isTouchpadActive, markWheelSource, TOUCHPAD_DRAG_FACTOR } from '../../utils/touchpad';

const MIN_SCALE = 0.5;
const MAX_SCALE = 10;
const WHEEL_FACTOR = 1.15;
const BUTTON_STEP = 1.25;

interface Point {
  x: number;
  y: number;
}

interface Props {
  src: string;
  alt?: string;
}

interface Transform {
  scale: number;
  x: number;
  y: number;
}

function clampScale(s: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));
}

export default function ZoomableImage({ src, alt = 'Question' }: Props) {
  const holderRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Single source of truth, updated synchronously in event handlers so rapid
  // pointermove events never compound against stale React state.
  const transform = useRef<Transform>({ scale: 1, x: 0, y: 0 });

  const [uiScale, setUiScale] = useState(1);
  const [uiOffset, setUiOffset] = useState<Point>({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);

  const pointers = useRef<Map<number, Point>>(new Map());
  const pinchDist = useRef(0);
  const lastMid = useRef<Point | null>(null); // holder-center-relative coords
  const lastSingle = useRef<Point | null>(null);
  const lastTapTime = useRef(0);
  const lastTapPos = useRef<Point>({ x: 0, y: 0 });
  const syncRaf = useRef(0);

  const scheduleSync = useCallback(() => {
    if (syncRaf.current) return;
    syncRaf.current = requestAnimationFrame(() => {
      syncRaf.current = 0;
      setUiScale(transform.current.scale);
      setUiOffset({ x: transform.current.x, y: transform.current.y });
    });
  }, []);

  const applyTransform = useCallback(() => {
    const img = imgRef.current;
    if (!img) return;
    const { scale, x, y } = transform.current;
    img.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
    scheduleSync();
  }, [scheduleSync]);

  const setTransform = useCallback(
    (next: Transform) => {
      const scale = clampScale(next.scale);
      transform.current = { scale, x: next.x, y: next.y };
      applyTransform();
    },
    [applyTransform],
  );

  const resetView = useCallback(() => {
    transform.current = { scale: 1, x: 0, y: 0 };
    applyTransform();
  }, [applyTransform]);

  // Local coords relative to the holder center (transform origin)
  const getLocal = useCallback((clientX: number, clientY: number): Point => {
    const rect = holderRef.current!.getBoundingClientRect();
    return {
      x: clientX - rect.left - rect.width / 2,
      y: clientY - rect.top - rect.height / 2,
    };
  }, []);

  // Anchored zoom: the content point under the focal point stays there.
  // offset' = L - (L - offset) * k   (the "translation = S - scale * F" rule)
  const zoomAtFocal = useCallback(
    (deltaScale: number, focalLocal: Point) => {
      const t = transform.current;
      const scale = clampScale(t.scale * deltaScale);
      if (scale === t.scale) return;
      const k = scale / t.scale;
      setTransform({
        scale,
        x: focalLocal.x - (focalLocal.x - t.x) * k,
        y: focalLocal.y - (focalLocal.y - t.y) * k,
      });
    },
    [setTransform],
  );

  const zoomCenter = useCallback(
    (deltaScale: number) => {
      zoomAtFocal(deltaScale, { x: 0, y: 0 });
    },
    [zoomAtFocal],
  );

  // Reset view when the image changes
  useEffect(() => {
    transform.current = { scale: 1, x: 0, y: 0 };
    applyTransform();
    pointers.current.clear();
    pinchDist.current = 0;
    lastMid.current = null;
    lastSingle.current = null;
  }, [src, applyTransform]);

  // Non-passive wheel handler so page doesn't scroll while zooming
  useEffect(() => {
    const holder = holderRef.current;
    if (!holder) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      markWheelSource(e);
      const factor = e.deltaY < 0 ? WHEEL_FACTOR : 1 / WHEEL_FACTOR;
      zoomAtFocal(factor, getLocal(e.clientX, e.clientY));
    };
    holder.addEventListener('wheel', onWheel, { passive: false });
    return () => holder.removeEventListener('wheel', onWheel);
  });

  const dist = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);

  const onPointerDown = (e: React.PointerEvent) => {
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    const pts = [...pointers.current.values()];
    if (pts.length === 2) {
      pinchDist.current = dist(pts[0], pts[1]);
      lastMid.current = getLocal(
        (pts[0].x + pts[1].x) / 2,
        (pts[0].y + pts[1].y) / 2,
      );
      lastSingle.current = null;
    } else if (pts.length === 1) {
      lastSingle.current = { x: e.clientX, y: e.clientY };
      setDragging(true);

      // Double-tap detection (touch or mouse)
      const now = Date.now();
      const rect = holderRef.current!.getBoundingClientRect();
      const pos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const isNear =
        Math.hypot(pos.x - lastTapPos.current.x, pos.y - lastTapPos.current.y) < 30;
      if (now - lastTapTime.current < 300 && isNear) {
        const t = transform.current;
        if (t.scale > 1.01 || Math.abs(t.x) > 1 || Math.abs(t.y) > 1) {
          resetView();
        } else {
          zoomAtFocal(2.5 / t.scale, getLocal(e.clientX, e.clientY));
        }
        lastTapTime.current = 0;
      } else {
        lastTapTime.current = now;
        lastTapPos.current = pos;
      }
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    const t = transform.current;

    if (pts.length >= 2 && lastMid.current) {
      const newDist = dist(pts[0], pts[1]);
      if (pinchDist.current > 0) {
        // Canonical pinch (GoogleChromeLabs/pinch-zoom): scale about the
        // PREVIOUS midpoint, then pan by the midpoint's movement — the content
        // under the fingers stays glued to the fingers.
        const newMid = getLocal(
          (pts[0].x + pts[1].x) / 2,
          (pts[0].y + pts[1].y) / 2,
        );
        const prevMid = lastMid.current;
        const k = clampScale(t.scale * (newDist / pinchDist.current)) / t.scale;
        setTransform({
          scale: t.scale * k,
          x: newMid.x - (prevMid.x - t.x) * k,
          y: newMid.y - (prevMid.y - t.y) * k,
        });
      }
      lastMid.current = getLocal(
        (pts[0].x + pts[1].x) / 2,
        (pts[0].y + pts[1].y) / 2,
      );
      pinchDist.current = newDist;
    } else if (lastSingle.current) {
      const factor = isTouchpadActive() ? TOUCHPAD_DRAG_FACTOR : 1;
      const dx = (e.clientX - lastSingle.current.x) * factor;
      const dy = (e.clientY - lastSingle.current.y) * factor;
      lastSingle.current = { x: e.clientX, y: e.clientY };
      setTransform({ ...t, x: t.x + dx, y: t.y + dy });
    }
  };

  const endPointer = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) {
      lastSingle.current = null;
      pinchDist.current = 0;
      lastMid.current = null;
      setDragging(false);
    } else if (pointers.current.size === 1) {
      const remaining = [...pointers.current.values()][0];
      lastSingle.current = { x: remaining.x, y: remaining.y };
      pinchDist.current = 0;
      lastMid.current = null;
    }
  };

  return (
    <div className="absolute inset-0">
      <div
        ref={holderRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        className={`absolute inset-0 flex items-center justify-center overflow-hidden touch-none select-none ${
          dragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
      >
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          draggable={false}
          className="max-w-full max-h-full object-contain"
        />
      </div>

      {/* Controls overlay */}
      <div className="absolute bottom-3 right-3 flex gap-2 z-10">
        <button
          onClick={() => zoomCenter(BUTTON_STEP)}
          className="nb-btn w-9 h-9 rounded-lg text-lg leading-none"
          title="Phóng to"
        >
          +
        </button>
        <button
          onClick={() => zoomCenter(1 / BUTTON_STEP)}
          className="nb-btn w-9 h-9 rounded-lg text-lg leading-none"
          title="Thu nhỏ"
        >
          −
        </button>
        <button
          onClick={resetView}
          disabled={uiScale === 1 && uiOffset.x === 0 && uiOffset.y === 0}
          className="nb-btn px-3 rounded-lg text-xs uppercase tracking-wider"
          title="Vừa khung"
        >
          Vừa khung
        </button>
      </div>

      <span className="absolute top-3 left-3 bg-nb-yellow border-2 border-black px-2 py-0.5 text-xs font-bold shadow-[2px_2px_0_#000] z-10">
        {Math.round(uiScale * 100)}%
      </span>
    </div>
  );
}
