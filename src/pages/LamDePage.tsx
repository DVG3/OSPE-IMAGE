import { useEffect, useRef, useState } from 'react';
import { Canvas, Circle, IText, Image as FabricImage, Path, Point, Rect } from 'fabric';
import NavBar from '../components/NavBar';
import { isTouchpadActive, markWheelSource, TOUCHPAD_DRAG_FACTOR } from '../utils/touchpad';

const MAX_UNDO_STEPS = 30;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 10;

interface ImageRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

function getFormattedTime(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

function deleteActiveObjects(canvas: Canvas) {
  const activeObjects = canvas.getActiveObjects();
  if (activeObjects.length) {
    activeObjects.forEach((obj) => canvas.remove(obj));
    canvas.discardActiveObject();
  }
}

export default function LamDePage() {
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const centerRef = useRef<HTMLDivElement>(null);
  const fabricRef = useRef<Canvas | null>(null);
  const imageRectRef = useRef<ImageRect | null>(null);
  const saveDirRef = useRef<{ name: string; getFileHandle: (name: string, opts: { create: boolean }) => Promise<{ createWritable: () => Promise<{ write: (b: Blob) => Promise<void>; close: () => Promise<void> }> }> } | null>(null);

  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const filesRef = useRef<File[]>([]);
  const indexRef = useRef(-1);
  const loadEpochRef = useRef(0);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [fileName, setFileName] = useState('');
  const fileNameInputRef = useRef<HTMLInputElement>(null);
  const saveImageRef = useRef<() => Promise<void>>(async () => {});
  const [color, setColor] = useState('#ff0000');
  const [saveDirName, setSaveDirName] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [thumbs, setThumbs] = useState<Record<number, string>>({});
  const [loadingImage, setLoadingImage] = useState(false);
  const [panMode, setPanMode] = useState(false);
  const [zoom, setZoom] = useState(1);

  // Undo stack
  const undoStackRef = useRef<string[]>([]);
  const restoringRef = useRef(false);
  const [canUndo, setCanUndo] = useState(false);
  const undoRef = useRef<() => void>(() => {});
  const snapshotRef = useRef<() => void>(() => {});
  const [deleteToast, setDeleteToast] = useState<{ count: number } | null>(null);
  const deleteToastTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const showDeleteToast = (count: number) => {
    if (deleteToastTimerRef.current) clearTimeout(deleteToastTimerRef.current);
    setDeleteToast({ count });
    try {
      (navigator as unknown as { vibrate?: (p: number) => boolean }).vibrate?.(20);
    } catch {
      // ignore
    }
    deleteToastTimerRef.current = setTimeout(() => setDeleteToast(null), 4000);
  };

  interface CtxMenu {
    clientX: number;
    clientY: number;
    canvasX: number;
    canvasY: number;
    target: unknown | null;
  }
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null);
  const ctxMenuRef = useRef<HTMLDivElement | null>(null);
  const lastTapRef = useRef<{ t: number; x: number; y: number }>({ t: 0, x: 0, y: 0 });

  const clientToCanvas = (clientX: number, clientY: number): Point => {
    const canvas = fabricRef.current;
    const centerEl = centerRef.current;
    if (!canvas || !centerEl) return new Point(0, 0);
    const rect = centerEl.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    const vt = canvas.viewportTransform as unknown as number[];
    const zoom = vt[0] || 1;
    return new Point((sx - vt[4]) / zoom, (sy - vt[5]) / zoom);
  };

  const closeCtxMenu = () => setCtxMenu(null);

  // Live refs for canvas event handlers
  const panModeRef = useRef(false);
  const spaceRef = useRef(false);
  panModeRef.current = panMode;

  useEffect(() => () => {
    if (deleteToastTimerRef.current) clearTimeout(deleteToastTimerRef.current);
  }, []);

  useEffect(() => {
    if (!ctxMenu) return;
    const onPointerDown = (e: PointerEvent) => {
      const el = ctxMenuRef.current;
      if (el && !el.contains(e.target as Node)) closeCtxMenu();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeCtxMenu();
    };
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [ctxMenu]);

  // Global shortcuts: C → focus filename input, Ctrl/Cmd+S → save image
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && key === 's') {
        e.preventDefault();
        void saveImageRef.current();
        return;
      }
      if (key === 'c' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        fileNameInputRef.current?.focus();
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Thumbnail object URLs for the file list. Raw file URLs show up instantly;
  // each entry is then upgraded in the background to a small 96px blob so we
  // never decode full photos just for 32px boxes. Per-item timeout guards
  // against browsers whose createImageBitmap hangs instead of rejecting.
  useEffect(() => {
    const urls: string[] = [];
    let cancelled = false;
    const map: Record<number, string> = {};
    imageFiles.forEach((f, i) => {
      map[i] = URL.createObjectURL(f);
      urls.push(map[i]);
    });
    setThumbs(map);

    const upgrade = async () => {
      if (typeof createImageBitmap !== 'function') return;
      for (let i = 0; i < imageFiles.length; i++) {
        if (cancelled) return;
        try {
          const f = imageFiles[i];
          const bmp = await Promise.race([
            createImageBitmap(f, { resizeWidth: 96 }),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('thumb timeout')), 4000),
            ),
          ]);
          const cnv = document.createElement('canvas');
          cnv.width = bmp.width;
          cnv.height = bmp.height;
          cnv.getContext('2d')!.drawImage(bmp, 0, 0);
          bmp.close();
          const blob = await new Promise<Blob | null>((res) => cnv.toBlob(res, 'image/png'));
          if (!blob || cancelled) continue;
          const url = URL.createObjectURL(blob);
          urls.push(url);
          setThumbs((prev) => ({ ...prev, [i]: url }));
        } catch {
          // Keep the raw object URL for this entry
        }
      }
    };
    void upgrade();

    return () => {
      cancelled = true;
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [imageFiles]);

  const snapshot = () => {
    const canvas = fabricRef.current;
    if (!canvas || restoringRef.current) return;
    undoStackRef.current.push(JSON.stringify(canvas.toJSON()));
    if (undoStackRef.current.length > MAX_UNDO_STEPS) undoStackRef.current.shift();
    setCanUndo(true);
  };

  const undo = () => {
    const canvas = fabricRef.current;
    if (!canvas || restoringRef.current || undoStackRef.current.length === 0) return;
    const prev = undoStackRef.current.pop();
    restoringRef.current = true;
    canvas.loadFromJSON(prev!).then(() => {
      canvas.requestRenderAll();
      restoringRef.current = false;
      setCanUndo(undoStackRef.current.length > 0);
    });
  };
  undoRef.current = undo;
  snapshotRef.current = snapshot;

  const resetView = () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    setZoom(1);
  };

  // Pan-mode canvas flags
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    canvas.selection = !panMode;
    canvas.skipTargetFind = panMode;
    canvas.defaultCursor = panMode ? 'grab' : 'default';
    canvas.requestRenderAll();
  }, [panMode]);

  // Fabric canvas lifecycle (created once)
  useEffect(() => {
    const centerEl = centerRef.current!;
    const canvas = new Canvas(canvasElRef.current!, {
      fireRightClick: true,
      stopContextMenu: true,
      preserveObjectStacking: true,
    });
    fabricRef.current = canvas;

    // Canvas fills the entire center viewport; resize with it
    const resize = () => {
      canvas.setDimensions({
        width: Math.max(200, centerEl.clientWidth),
        height: Math.max(200, centerEl.clientHeight),
      });
      canvas.requestRenderAll();
    };
    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(centerEl);

    // --- Zoom via wheel (fabric gives us the event with correct coords) ---
    canvas.on('mouse:wheel', (opt) => {
      const e = opt.e as WheelEvent;
      e.preventDefault();
      e.stopPropagation();
      markWheelSource(e);
      const touchpad = isTouchpadActive();

      // Trackpad pinch (Ctrl + wheel) → zoom at quarter rate (half of the
      // previous half) so a normal pinch no longer slams into MAX_ZOOM
      if (e.ctrlKey) {
        const step = e.deltaY < 0 ? Math.pow(1.15, 0.25) : Math.pow(1 / 1.15, 0.25);
        const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, canvas.getZoom() * step));
        canvas.zoomToPoint(new Point(e.offsetX, e.offsetY), next);
        setZoom(next);
        return;
      }

      // Trackpad two-finger scroll → pan the viewport (inverted direction)
      if (touchpad) {
        canvas.relativePan(new Point(-e.deltaX, -e.deltaY));
        return;
      }

      // Plain mouse wheel → zoom (unchanged)
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, canvas.getZoom() * factor));
      canvas.zoomToPoint(new Point(e.offsetX, e.offsetY), next);
      setZoom(next);
    });

    // --- Keyboard: space-pan + delete + undo ---
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undoRef.current();
        return;
      }
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      if (e.code === 'Space') {
        spaceRef.current = true;
        return;
      }
      if ((canvas.getActiveObject() as unknown as { isEditing?: boolean } | undefined)?.isEditing) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const n = canvas.getActiveObjects().length;
        if (n) {
          snapshotRef.current();
          deleteActiveObjects(canvas);
          showDeleteToast(n);
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') spaceRef.current = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // --- Mouse/touch interactions on canvas: pan-drag ---
    let pressTimer: ReturnType<typeof setTimeout> | undefined;
    let panning = false;
    let last: Point | null = null;
    const clearPress = () => pressTimer !== undefined && clearTimeout(pressTimer);

    // --- Swipe fling to switch images (single-finger on empty background) ---
    let swipeStart: Point | null = null;
    let swipeStartTime = 0;
    let swipeBlocked = false;
    let swipeArmed: 'prev' | 'next' | null = null;

    const openCtxMenuAt = (clientX: number, clientY: number, target: unknown | null) => {
      const pt = clientToCanvas(clientX, clientY);
      // Clamp menu inside viewport a bit so it never renders off-screen
      const pad = 8;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const approxW = 240;
      const approxH = 320;
      const clampedX = Math.min(Math.max(pad, clientX), vw - approxW - pad);
      const clampedY = Math.min(Math.max(pad, clientY), vh - approxH - pad);
      setCtxMenu({ clientX: clampedX, clientY: clampedY, canvasX: pt.x, canvasY: pt.y, target });
    };

    const onMouseDown = (options: { target?: any; e: Event }) => {
      const mouseEvent = options.e as MouseEvent;
      const middleButton = mouseEvent.button === 1;
      // Right-click (native button 2) → open context menu at cursor.
      // fabric fires mouse:down for right-click but does NOT set options.button,
      // so we read the real button off the DOM event.
      if (mouseEvent.button === 2) {
        mouseEvent.preventDefault();
        const target = fabricRef.current?.findTarget(mouseEvent) ?? options.target ?? null;
        openCtxMenuAt(mouseEvent.clientX, mouseEvent.clientY, target);
        return;
      }
      // Double-tap (touch) → open quick menu at tap position
      const pe = mouseEvent as unknown as PointerEvent;
      const isTouch = pe.pointerType === 'touch' || pe.pointerType === 'pen';
      if (isTouch) {
        const now = Date.now();
        const prev = lastTapRef.current;
        const dist = Math.hypot(mouseEvent.clientX - prev.x, mouseEvent.clientY - prev.y);
        const isDouble = now - prev.t < 300 && dist < 30;
        // Always update the tap record for the next detection
        lastTapRef.current = { t: now, x: mouseEvent.clientX, y: mouseEvent.clientY };
        if (isDouble) {
          openCtxMenuAt(mouseEvent.clientX, mouseEvent.clientY, options.target ?? canvas.getActiveObject() ?? null);
          lastTapRef.current = { t: 0, x: 0, y: 0 };
          // Prevent fabric from treating the second tap as a drag start
          swipeStart = null;
          swipeArmed = null;
          return;
        }
      }
      // Decide whether a swipe fling is eligible: only on empty background
      if (swipeStart) {
        if (panModeRef.current || spaceRef.current || middleButton || options.target) {
          swipeBlocked = true;
        } else {
          swipeBlocked = false;
        }
      }
      if (panModeRef.current || spaceRef.current || middleButton) {
        if (middleButton) mouseEvent.preventDefault();
        panning = true;
        last = new Point(mouseEvent.clientX, mouseEvent.clientY);
        canvas.defaultCursor = 'grabbing';
        return;
      }
      // Selecting an object — no auto-delete; delete is via context menu
      if (!options.target) return;
    };

    const onMouseMove = (options: { e: Event }) => {
      if (panning && last) {
        const mouseEvent = options.e as MouseEvent;
        const factor = isTouchpadActive() ? TOUCHPAD_DRAG_FACTOR : 1;
        canvas.relativePan(
          new Point(
            (mouseEvent.clientX - last.x) * factor,
            (mouseEvent.clientY - last.y) * factor,
          ),
        );
        last = new Point(mouseEvent.clientX, mouseEvent.clientY);
        return;
      }
      clearPress();
    };

    const onMouseUp = () => {
      panning = false;
      last = null;
      canvas.defaultCursor = panModeRef.current ? 'grab' : 'default';
      clearPress();
    };

    canvas.on('mouse:down', onMouseDown);
    canvas.on('mouse:move', onMouseMove);
    canvas.on('mouse:up', onMouseUp);

    // --- Two-finger pinch-zoom / pan (touch devices) ---
    // Capture-phase pointer handlers: during a 2-finger gesture we stopPropagation
    // so fabric never sees the moves, and keep blocking until all fingers lift.
    const container = canvasElRef.current!.parentElement!;
    container.style.touchAction = 'none';
    const activePointers = new Map<number, Point>();
    let pinchDist = 0;
    let pinching = false;
    let suppressUntilLift = false;
    let lastMid: Point | null = null;

    const containerRect = () => container.getBoundingClientRect();
    const midOf = (pts: Point[]): Point => {
      let x = 0;
      let y = 0;
      pts.forEach((p) => {
        x += p.x;
        y += p.y;
      });
      return new Point(x / pts.length, y / pts.length);
    };

    // Prevent native context menu on the canvas container
    const onContextMenu = (e: MouseEvent) => e.preventDefault();
    container.addEventListener('contextmenu', onContextMenu);

    const onPointerDownC = (e: PointerEvent) => {
      activePointers.set(e.pointerId, new Point(e.clientX, e.clientY));
      if (activePointers.size === 2 && !pinching) {
        e.stopPropagation();
        pinching = true;
        swipeStart = null;
        swipeArmed = null;
        swipeBlocked = true;
        lastTapRef.current = { t: 0, x: 0, y: 0 };
        canvas.discardActiveObject();
        const pts = [...activePointers.values()];
        pinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        lastMid = midOf(pts);
        return;
      }
      if (activePointers.size === 1 && !pinching && !suppressUntilLift) {
        swipeStart = new Point(e.clientX, e.clientY);
        swipeStartTime = Date.now();
        swipeBlocked = false;
        swipeArmed = null;
      }
    };

    const onPointerMoveC = (e: PointerEvent) => {
      if (!activePointers.has(e.pointerId)) return;
      activePointers.set(e.pointerId, new Point(e.clientX, e.clientY));
      if (pinching && activePointers.size >= 2 && lastMid) {
        e.stopPropagation();
        const pts = [...activePointers.values()];
        const newDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        const newMid = midOf(pts);
        if (pinchDist > 0) {
          // Canonical pinch (GoogleChromeLabs/pinch-zoom): scale about the
          // PREVIOUS midpoint so the content stays under the fingers, then pan
          // by the midpoint's movement.
          const factor = newDist / pinchDist;
          const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, canvas.getZoom() * factor));
          const r = containerRect();
          canvas.zoomToPoint(
            new Point(lastMid.x - r.left, lastMid.y - r.top),
            next,
          );
          canvas.relativePan(new Point(newMid.x - lastMid.x, newMid.y - lastMid.y));
          setZoom(next);
        }
        pinchDist = newDist;
        lastMid = newMid;
        return;
      }
      if (suppressUntilLift) {
        e.stopPropagation();
        return;
      }
      // Single-finger swipe fling on empty background → switch images
      if (swipeStart && !swipeBlocked && activePointers.size === 1) {
        if (swipeArmed) {
          e.stopPropagation();
          return;
        }
        const dx = e.clientX - swipeStart.x;
        const dy = e.clientY - swipeStart.y;
        const dt = Date.now() - swipeStartTime;
        if (dt < 500 && Math.abs(dx) > 70 && Math.abs(dx) > 2 * Math.abs(dy)) {
          swipeArmed = dx > 0 ? 'prev' : 'next';
          e.stopPropagation();
        }
      } else if (swipeArmed) {
        e.stopPropagation();
      }
    };

    const onPointerUpC = (e: PointerEvent) => {
      const hadSwipe = swipeArmed;
      activePointers.delete(e.pointerId);
      if (hadSwipe) {
        const dir = swipeArmed;
        swipeStart = null;
        swipeArmed = null;
        swipeBlocked = false;
        if (dir === 'prev') loadImage(indexRef.current - 1);
        else if (dir === 'next') loadImage(indexRef.current + 1);
        e.stopPropagation();
        // Keep suppressUntilLift off — swipe consumes the gesture
        if (pinching && activePointers.size < 2) {
          pinching = false;
          pinchDist = 0;
          lastMid = null;
        }
        return;
      }
      if (activePointers.size === 0) {
        swipeStart = null;
        swipeArmed = null;
        swipeBlocked = false;
      }
      if (pinching && activePointers.size < 2) {
        pinching = false;
        pinchDist = 0;
        lastMid = null;
        if (activePointers.size > 0) suppressUntilLift = true;
      }
      if (suppressUntilLift && activePointers.size === 0) {
        suppressUntilLift = false;
        e.stopPropagation();
      }
    };

    container.addEventListener('pointerdown', onPointerDownC, true);
    container.addEventListener('pointermove', onPointerMoveC, true);
    container.addEventListener('pointerup', onPointerUpC, true);
    container.addEventListener('pointercancel', onPointerUpC, true);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      resizeObserver.disconnect();
      container.removeEventListener('contextmenu', onContextMenu);
      container.removeEventListener('pointerdown', onPointerDownC, true);
      container.removeEventListener('pointermove', onPointerMoveC, true);
      container.removeEventListener('pointerup', onPointerUpC, true);
      container.removeEventListener('pointercancel', onPointerUpC, true);
      void canvas.dispose();
      fabricRef.current = null;
    };
  }, []);

  const loadImage = (idx: number) => {
    const files = filesRef.current;
    if (idx < 0 || idx >= files.length) return;

    indexRef.current = idx;
    setCurrentIndex(idx);

    const file = files[idx];
    const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
    setFileName(baseName);

    const canvas = fabricRef.current;
    const centerEl = centerRef.current;
    if (!canvas || !centerEl) return;

    // Generation guard: a newer tap always wins over an in-flight decode
    const epoch = ++loadEpochRef.current;

    const applyImage = async (img: InstanceType<typeof FabricImage>, revoke?: () => void) => {
      if (epoch !== loadEpochRef.current) {
        revoke?.();
        return;
      }
      const imgW = img.width || 1;
      const imgH = img.height || 1;
      const vw = centerEl.clientWidth;
      const vh = centerEl.clientHeight;
      // Fit the image inside the viewport, centered; never upscale
      const scale = Math.min(vw / imgW, vh / imgH, 1);
      const left = Math.round((vw - imgW * scale) / 2);
      const top = Math.round((vh - imgH * scale) / 2);

      img.set({ originX: 'left', originY: 'top', scaleX: scale, scaleY: scale, left, top });
      canvas.backgroundImage = img;
      imageRectRef.current = { left, top, width: imgW * scale, height: imgH * scale };
      canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
      setZoom(1);
      setLoadingImage(false);
      // Clean up BEFORE the deferred render — but never destroy the element
      // fabric is about to draw (that was blanking the background)
      revoke?.();
      canvas.requestRenderAll();
    };

    setLoadingImage(true);
    // Fast path: off-main-thread native decode, blitted onto a canvas element
    // (fabric needs an ImageSource). Some mobile browsers hang instead of
    // rejecting, so race a timeout and fall back to blob URL + fromURL.
    const decodeTimeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('decode timeout')), 4000),
    );
    const fastLoad = async () => {
      const bmp = await Promise.race([createImageBitmap(file), decodeTimeout]);
      const cnv = document.createElement('canvas');
      cnv.width = bmp.width;
      cnv.height = bmp.height;
      cnv.getContext('2d')!.drawImage(bmp, 0, 0);
      const img = new FabricImage(cnv);
      // The canvas element stays alive — it is now fabric's image source.
      // Only the decoded bitmap can be released.
      await applyImage(img, () => bmp.close());
    };
    const urlLoad = async () => {
      const url = URL.createObjectURL(file);
      try {
        const img = await FabricImage.fromURL(url, { crossOrigin: 'anonymous' });
        await applyImage(img, () => URL.revokeObjectURL(url));
      } catch (err) {
        URL.revokeObjectURL(url);
        throw err;
      }
    };

    (async () => {
      try {
        if (typeof createImageBitmap === 'function') {
          await fastLoad();
        } else {
          await urlLoad();
        }
      } catch {
        if (epoch !== loadEpochRef.current) return;
        try {
          await urlLoad();
        } catch {
          if (epoch === loadEpochRef.current) setLoadingImage(false);
        }
      }
    })();
  };

  const onFolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith('image/'));
    if (files.length === 0) {
      alert('Không tìm thấy ảnh nào trong thư mục này!');
      return;
    }
    setImageFiles(files);
    filesRef.current = files;
    undoStackRef.current = [];
    setCanUndo(false);
    loadImage(0);
    e.target.value = '';
  };

  const onColorChange = (value: string) => {
    setColor(value);
    const canvas = fabricRef.current;
    if (!canvas) return;
    const activeObject = canvas.getActiveObject();
    if (!activeObject) return;
    if ((activeObject as unknown as { type: string }).type === 'i-text' || activeObject.fill !== 'transparent') {
      activeObject.set({ fill: value });
    } else {
      activeObject.set({ stroke: value });
    }
    canvas.requestRenderAll();
  };

  const hollowOptions = () => ({
    left: 100,
    top: 100,
    strokeWidth: 4,
    fill: 'transparent',
    stroke: color,
  });
  const fillOptions = () => ({
    left: 100,
    top: 100,
    fill: color,
    stroke: 'transparent',
  });
  const hollowOptionsAt = (x: number, y: number) => ({
    left: x,
    top: y,
    strokeWidth: 4,
    fill: 'transparent',
    stroke: color,
  });
  const fillOptionsAt = (x: number, y: number) => ({
    left: x,
    top: y,
    fill: color,
    stroke: 'transparent',
  });

  const addText = () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    snapshot();
    const text = new IText('Nhập chữ...', {
      left: 100,
      top: 100,
      fontFamily: 'Arial',
      fill: color,
      fontSize: 26,
      fontWeight: 'bold',
    });
    canvas.add(text);
    canvas.setActiveObject(text);
    canvas.requestRenderAll();
  };
  const addTextAt = (at: Point) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    snapshot();
    const text = new IText('Nhập chữ...', {
      left: at.x,
      top: at.y,
      fontFamily: 'Arial',
      fill: color,
      fontSize: 26,
      fontWeight: 'bold',
    });
    canvas.add(text);
    canvas.setActiveObject(text);
    canvas.requestRenderAll();
  };

  const addArrow = () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    snapshot();
    canvas.add(
      new Path('M 0 0 L 70 0 M 70 0 L 52 -18 M 70 0 L 52 18', {
        ...hollowOptions(),
        strokeWidth: 5,
      }),
    );
    canvas.requestRenderAll();
  };
  const addArrowAt = (at: Point) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    snapshot();
    canvas.add(
      new Path('M 0 0 L 70 0 M 70 0 L 52 -18 M 70 0 L 52 18', {
        left: at.x,
        top: at.y,
        strokeWidth: 5,
        fill: 'transparent',
        stroke: color,
      }),
    );
    canvas.requestRenderAll();
  };

  const addRectAt = (x: number, y: number, filled: boolean) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    snapshot();
    // Center the shape under the click: offset by half its logical size
    const opts = filled ? fillOptionsAt(x - 60, y - 50) : hollowOptionsAt(x - 60, y - 50);
    canvas.add(new Rect({ ...opts, width: 120, height: 100 }));
    canvas.requestRenderAll();
  };
  const addCircleAt = (x: number, y: number, filled: boolean) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    snapshot();
    const opts = filled ? fillOptionsAt(x, y) : hollowOptionsAt(x, y);
    // hollow/filled circle is centered differently; fabric Circle origin is left/top of bounding box, so offset by radius
    const c = new Circle({ ...opts, radius: 55, left: x - 55, top: y - 55 });
    canvas.add(c);
    canvas.requestRenderAll();
  };
  const handleCtxDelete = () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const target = (ctxMenu?.target as unknown) ?? canvas.getActiveObject();
    const n = target ? 1 : canvas.getActiveObjects().length;
    if (n === 0) return;
    snapshot();
    if (target) {
      canvas.remove(target as never);
      canvas.discardActiveObject();
    } else {
      deleteActiveObjects(canvas);
    }
    showDeleteToast(n);
    closeCtxMenu();
    canvas.requestRenderAll();
  };

  const pickSaveDirectory = async () => {
    try {
      const handle = await (window as unknown as { showDirectoryPicker: (o: { mode: string }) => Promise<never> }).showDirectoryPicker({ mode: 'readwrite' });
      saveDirRef.current = handle as typeof saveDirRef.current;
      setSaveDirName((handle as unknown as { name: string }).name);
    } catch {
      // User cancelled or API unsupported
    }
  };

  const saveImage = async () => {
    const canvas = fabricRef.current;
    if (!canvas || filesRef.current.length === 0) return;
    const finalFileName = `${fileName.trim() || 'edited'}_${getFormattedTime()}.png`;

    // Export only the original image area: reset the viewport, crop to image rect
    const vpt = canvas.viewportTransform;
    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    canvas.discardActiveObject();
    canvas.renderAll();
    const rect = imageRectRef.current;
    const dataURL = rect
      ? canvas.toDataURL({
          format: 'png',
          quality: 1,
          multiplier: 1,
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
        })
      : canvas.toDataURL({ format: 'png', quality: 1, multiplier: 1 });
    canvas.setViewportTransform(vpt);
    canvas.requestRenderAll();

    if (saveDirRef.current) {
      try {
        const blob = await (await fetch(dataURL)).blob();
        const writable = await (await saveDirRef.current.getFileHandle(finalFileName, { create: true })).createWritable();
        await writable.write(blob);
        await writable.close();
        setSavedFlash(true);
        setTimeout(() => setSavedFlash(false), 1000);
        return;
      } catch (err) {
        console.error('Lỗi ghi file:', err);
      }
    }

    const link = document.createElement('a');
    link.href = dataURL;
    link.download = finalFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  saveImageRef.current = saveImage;

  return (
    <div className="h-screen flex flex-col overflow-hidden font-sans bg-cream">
      <NavBar />
      <div className="flex-1 flex overflow-hidden">
        <div className="w-64 bg-white border-r-[3px] border-black flex flex-col">
          <div className="p-4 border-b-2 border-black">
            <h2 className="font-display text-base uppercase tracking-wide mb-3">Tải thư mục</h2>
            <input
              type="file"
              multiple
              {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
              onChange={onFolderChange}
              className="block w-full text-xs text-gray-600 file:mr-2 file:cursor-pointer file:py-2 file:px-3 file:rounded-lg file:border-2 file:border-black file:text-xs file:font-bold file:bg-nb-cyan file:shadow-[2px_2px_0_#000] hover:file:-translate-y-0.5 hover:file:shadow-[3px_3px_0_#000] file:transition-all"
            />
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {imageFiles.length === 0 ? (
              <p className="text-gray-400 text-sm text-center italic mt-4">Chưa có ảnh nào</p>
            ) : (
              imageFiles.map((file, idx) => (
                <div
                  key={idx}
                  onClick={() => loadImage(idx)}
                  className={`flex items-center gap-2 p-2 text-sm cursor-pointer truncate rounded-lg mb-1.5 border-2 transition-all duration-100 ${
                    idx === currentIndex
                      ? 'bg-nb-cyan border-black font-bold shadow-[2px_2px_0_#000]'
                      : 'border-transparent hover:border-black hover:bg-white hover:shadow-[2px_2px_0_#000] text-gray-700'
                  }`}
                >
                  {thumbs[idx] ? (
                    <img
                      src={thumbs[idx]}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="w-8 h-8 object-cover border-2 border-black flex-shrink-0"
                    />
                  ) : (
                    <span className="w-8 h-8 flex-shrink-0" />
                  )}
                  <span className="truncate">{file.name}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col">
          <div ref={centerRef} className="flex-1 bg-[#efe8d8] relative overflow-hidden">
            <canvas ref={canvasElRef} className="absolute inset-0" />
            {loadingImage && (
              <span className="absolute top-3 left-3 bg-nb-yellow border-2 border-black px-2 py-1 text-xs font-bold shadow-[2px_2px_0_#000] z-10">
                Đang tải...
              </span>
            )}
          </div>

          <div className="bg-white border-t-[3px] border-black flex flex-wrap justify-center items-center gap-2 px-2 py-2">
            <button
              onClick={() => loadImage(indexRef.current - 1)}
              disabled={currentIndex <= 0}
              className="nb-btn px-3 py-2 rounded-lg text-sm"
            >
              ❮ Trước
            </button>
            <span className="bg-nb-yellow border-2 border-black px-3 py-1 font-bold text-sm shadow-[2px_2px_0_#000]">
              {currentIndex + 1} / {imageFiles.length}
            </span>
            <button
              onClick={() => loadImage(indexRef.current + 1)}
              disabled={currentIndex < 0 || currentIndex >= imageFiles.length - 1}
              className="nb-btn px-3 py-2 rounded-lg text-sm"
            >
              Sau ❯
            </button>
            <button
              onClick={undo}
              disabled={!canUndo}
              title="Hoàn tác (Ctrl+Z)"
              className="nb-btn px-3 py-2 rounded-lg text-sm"
            >
              ↩️ Hoàn tác
            </button>
            <button
              onClick={() => setPanMode((v) => !v)}
              title="Chế độ di chuyển (kéo để pan)"
              className={`nb-btn px-3 py-2 rounded-lg text-sm ${panMode ? 'bg-nb-cyan' : ''}`}
            >
              ✋ Di chuyển
            </button>
            <button onClick={resetView} title="Vừa khung" className="nb-btn px-3 py-2 rounded-lg text-sm">
              Vừa khung
            </button>
            <span className="bg-nb-cyan border-2 border-black px-2 py-1 font-bold text-xs shadow-[2px_2px_0_#000]">
              {Math.round(zoom * 100)}%
            </span>
          </div>
        </div>

        <div className="w-72 bg-white border-l-[3px] border-black p-4 flex flex-col gap-6 overflow-y-auto">
          <div>
            <h3 className="font-display text-sm uppercase tracking-wide mb-2 inline-block bg-nb-pink border-2 border-black px-2 py-0.5 shadow-[2px_2px_0_#000]">
              Đổi tên &amp; Lưu
            </h3>
            <input
              ref={fileNameInputRef}
              type="text"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              placeholder="Tên ảnh mới..."
              className="nb-input w-full rounded-lg py-2 mb-2 text-sm"
            />

            <button onClick={pickSaveDirectory} className="nb-btn w-full py-2 rounded-lg mb-1.5 text-sm">
              📁 Chọn thư mục lưu (Chrome/Edge)
            </button>
            {saveDirName && (
              <p className="text-xs font-bold text-emerald-600 mb-2 truncate">📁 Lưu tại: {saveDirName}</p>
            )}

            <button
              onClick={saveImage}
              className={`w-full border-2 border-black rounded-lg font-bold py-2 uppercase tracking-wider shadow-[3px_3px_0_#000] transition-all duration-100 hover:-translate-y-0.5 hover:shadow-[5px_5px_0_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none ${
                savedFlash ? 'bg-nb-lime text-black' : 'bg-nb-blue text-white'
              }`}
            >
              {savedFlash ? '✅ Đã lưu xong!' : 'Lưu ảnh'}
            </button>
          </div>

          <hr className="border-t-2 border-dashed border-black/30" />
          <div className="border-2 border-black rounded-lg p-3 bg-white shadow-[3px_3px_0_#000]">
            <h3 className="font-bold mb-3 flex items-center gap-2">🎨 Thuộc tính</h3>
            <div className="flex items-center gap-3 border-2 border-black rounded-lg p-2 bg-white">
              <input
                type="color"
                value={color}
                onChange={(e) => onColorChange(e.target.value)}
                className="w-12 h-12 border-none cursor-pointer rounded bg-transparent"
              />
              <div className="flex flex-col">
                <span className="text-sm font-bold text-gray-800">Màu đối tượng</span>
                <span className="text-xs text-gray-500">
                  Áp dụng cho đối tượng mới hoặc đang chọn
                </span>
              </div>
            </div>
          </div>
          <div>
            <h3 className="font-bold mb-2">Thêm đối tượng</h3>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={addText} className="tool-btn">🔤 Thêm Text</button>
              <button onClick={addArrow} className="tool-btn">↗️ Mũi tên</button>

              <button
                onClick={() => {
                  if (!fabricRef.current) return;
                  snapshot();
                  fabricRef.current.add(new Rect({ ...hollowOptions(), width: 120, height: 100 }));
                }}
                className="tool-btn"
              >
                ◻️ Vuông (Rỗng)
              </button>
              <button
                onClick={() => {
                  if (!fabricRef.current) return;
                  snapshot();
                  fabricRef.current.add(new Rect({ ...fillOptions(), width: 120, height: 100 }));
                }}
                className="tool-btn"
              >
                ⬛ Vuông (Đặc)
              </button>

              <button
                onClick={() => {
                  if (!fabricRef.current) return;
                  snapshot();
                  fabricRef.current.add(new Circle({ ...hollowOptions(), radius: 55 }));
                }}
                className="tool-btn"
              >
                ◯ Tròn (Rỗng)
              </button>
              <button
                onClick={() => {
                  if (!fabricRef.current) return;
                  snapshot();
                  fabricRef.current.add(new Circle({ ...fillOptions(), radius: 55 }));
                }}
                className="tool-btn"
              >
                ⬤ Tròn (Đặc)
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-3 text-center">
              💡 <b>Xóa:</b> Chọn đối tượng rồi bấm Delete hoặc mở menu (chuột phải / chạm 2 lần) rồi chọn Xóa.
              <br />
              🔍 <b>Zoom:</b> Lăn chuột / véo 2 ngón. <b>Di chuyển:</b> nút ✋, giữ Space, hoặc
              chuột giữa.
            </p>
          </div>
        </div>
      </div>
      {deleteToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-white border-2 border-black shadow-[4px_4px_0_#000] rounded-lg px-4 py-3 flex items-center gap-3">
          <span className="text-sm font-bold">Đã xóa {deleteToast.count} đối tượng</span>
          <button
            onClick={() => {
              undoRef.current();
              if (deleteToastTimerRef.current) clearTimeout(deleteToastTimerRef.current);
              setDeleteToast(null);
            }}
            className="nb-btn px-3 py-1.5 rounded-lg text-sm bg-nb-yellow"
          >
            Hoàn tác
          </button>
          <button
            onClick={() => {
              if (deleteToastTimerRef.current) clearTimeout(deleteToastTimerRef.current);
              setDeleteToast(null);
            }}
            className="w-7 h-7 flex items-center justify-center border-2 border-black rounded-full bg-white font-bold leading-none"
            aria-label="Đóng"
          >
            ×
          </button>
        </div>
      )}
      {ctxMenu && (
        <div
          ref={ctxMenuRef}
          style={{ left: ctxMenu.clientX, top: ctxMenu.clientY }}
          className="fixed z-50 w-64 bg-white border-2 border-black shadow-[4px_4px_0_#000] rounded-lg p-3 flex flex-col gap-3"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-sm">Menu nhanh</h4>
            <button
              onClick={closeCtxMenu}
              className="w-7 h-7 flex items-center justify-center border-2 border-black rounded-full bg-white font-bold leading-none"
              aria-label="Đóng"
            >
              ×
            </button>
          </div>
          <div className="border-2 border-black rounded-lg p-2 bg-white">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={color}
                onChange={(e) => onColorChange(e.target.value)}
                className="w-8 h-8 border-none cursor-pointer rounded bg-transparent"
              />
              <span className="text-xs font-bold">Màu: {color}</span>
            </div>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider mb-2">Thêm đối tượng tại vị trí này</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  addTextAt(new Point(ctxMenu.canvasX, ctxMenu.canvasY));
                  closeCtxMenu();
                }}
                className="tool-btn text-xs py-2"
              >
                🔤 Text
              </button>
              <button
                onClick={() => {
                  addArrowAt(new Point(ctxMenu.canvasX, ctxMenu.canvasY));
                  closeCtxMenu();
                }}
                className="tool-btn text-xs py-2"
              >
                ↗️ Mũi tên
              </button>
              <button
                onClick={() => {
                  addRectAt(ctxMenu.canvasX, ctxMenu.canvasY, false);
                  closeCtxMenu();
                }}
                className="tool-btn text-xs py-2"
              >
                ◻️ Vuông
              </button>
              <button
                onClick={() => {
                  addRectAt(ctxMenu.canvasX, ctxMenu.canvasY, true);
                  closeCtxMenu();
                }}
                className="tool-btn text-xs py-2"
              >
                ⬛ Vuông đặc
              </button>
              <button
                onClick={() => {
                  addCircleAt(ctxMenu.canvasX, ctxMenu.canvasY, false);
                  closeCtxMenu();
                }}
                className="tool-btn text-xs py-2"
              >
                ◯ Tròn
              </button>
              <button
                onClick={() => {
                  addCircleAt(ctxMenu.canvasX, ctxMenu.canvasY, true);
                  closeCtxMenu();
                }}
                className="tool-btn text-xs py-2"
              >
                ⬤ Tròn đặc
              </button>
            </div>
          </div>
          <button
            onClick={handleCtxDelete}
            disabled={
              !ctxMenu.target &&
              (!fabricRef.current || fabricRef.current.getActiveObjects().length === 0)
            }
            className="nb-btn w-full py-2 rounded-lg text-sm bg-nb-red text-white disabled:opacity-40 disabled:cursor-not-allowed"
          >
            🗑️ Xóa đối tượng
          </button>
        </div>
      )}
    </div>
  );
}
