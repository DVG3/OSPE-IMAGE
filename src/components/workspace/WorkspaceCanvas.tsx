import React, { useRef, useEffect, useState, useCallback } from 'react';
import type {
  ActiveTool,
  CanvasObjectItem,
  ImageAnnotationData,
  Point2D,
  ReviewDisplayMode,
  SelectedLayerItem,
  WorkspaceMode,
} from '../../types/workspace';
import {
  distance,
  getObjectCenter,
  getRandomColor,
  trimPathWithCircle,
  generateId,
} from '../../utils/geometry';

interface WorkspaceCanvasProps {
  imageFile: File | null;
  annotationData: ImageAnnotationData;
  onUpdateAnnotation: (data: ImageAnnotationData) => void;
  mode: WorkspaceMode;
  activeTool: ActiveTool;
  color: string;
  brushSize: number;
  eraserSize: number;
  dotRadius: number;
  reviewDisplayMode: ReviewDisplayMode;
  reviewFontSize: number;
  selectedItems: SelectedLayerItem[];
  onSelectItems: (items: SelectedLayerItem[]) => void;
  onOpenQuickCaption?: (initialChar?: string) => void;
  onObjectCreated?: (objId: string) => void;
  onChangeBrushSize?: (size: number) => void;
  onChangeEraserSize?: (size: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export default function WorkspaceCanvas({
  imageFile,
  annotationData,
  onUpdateAnnotation,
  mode,
  activeTool,
  color,
  brushSize,
  eraserSize,
  dotRadius,
  reviewDisplayMode,
  reviewFontSize,
  selectedItems,
  onSelectItems,
  onOpenQuickCaption,
  onObjectCreated,
  onChangeBrushSize,
  onChangeEraserSize,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}: WorkspaceCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Viewport transform
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Point2D>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<Point2D>({ x: 0, y: 0 });
  const spacePressedRef = useRef(false);

  // Loaded HTML Image
  const [imgElement, setImgElement] = useState<HTMLImageElement | null>(null);

  // Drawing state
  const isDrawingRef = useRef(false);
  const currentPathRef = useRef<Point2D[]>([]);
  const draggingDotRef = useRef<{ id: string; isResizing: boolean } | null>(null);
  const cursorPosRef = useRef<Point2D | null>(null);

  // Canvas context menu state
  const [canvasContextMenu, setCanvasContextMenu] = useState<{
    clientX: number;
    clientY: number;
    objId: string;
  } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const touchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartPosRef = useRef<Point2D>({ x: 0, y: 0 });

  // Close context menu on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setCanvasContextMenu(null);
      }
    };
    window.addEventListener('mousedown', handleOutsideClick);
    return () => window.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Load image whenever imageFile changes
  useEffect(() => {
    if (!imageFile) {
      setImgElement(null);
      return;
    }
    const url = URL.createObjectURL(imageFile);
    const img = new Image();
    img.src = url;
    img.onload = () => {
      setImgElement(img);
      // Fit to container initially
      if (containerRef.current) {
        const cw = containerRef.current.clientWidth;
        const ch = containerRef.current.clientHeight;
        const scale = Math.min((cw - 40) / img.width, (ch - 40) / img.height, 1);
        setZoom(scale > 0 ? scale : 1);
        setPan({
          x: (cw - img.width * scale) / 2,
          y: (ch - img.height * scale) / 2,
        });
      }
    };
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [imageFile]);

  // Handle Space key for quick panning
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !spacePressedRef.current && (e.target as HTMLElement).tagName !== 'INPUT') {
        spacePressedRef.current = true;
        if (containerRef.current) containerRef.current.style.cursor = 'grab';
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spacePressedRef.current = false;
        if (containerRef.current) containerRef.current.style.cursor = '';
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Convert screen coordinates to canvas image coordinates
  const screenToImageCoords = useCallback(
    (clientX: number, clientY: number): Point2D => {
      if (!containerRef.current) return { x: 0, y: 0 };
      const rect = containerRef.current.getBoundingClientRect();
      const sx = clientX - rect.left;
      const sy = clientY - rect.top;
      return {
        x: (sx - pan.x) / zoom,
        y: (sy - pan.y) / zoom,
      };
    },
    [pan, zoom]
  );

  // Helper to determine if an object is selected or in a selected caption/group
  const isObjectSelected = useCallback(
    (obj: CanvasObjectItem): boolean => {
      if (selectedItems.some((s) => s.type === 'object' && s.id === obj.id)) {
        return true;
      }
      if (selectedItems.some((s) => s.type === 'caption' && s.id === obj.captionId)) {
        return true;
      }
      const caption = annotationData.captions.find((c) => c.id === obj.captionId);
      if (caption?.groupId) {
        if (selectedItems.some((s) => s.type === 'group' && s.id === caption.groupId)) {
          return true;
        }
      }
      return false;
    },
    [selectedItems, annotationData]
  );

  // Caption map for numbers and visibility
  const captionMap = annotationData.captions.reduce((acc, cap, idx) => {
    acc[cap.id] = { ...cap, numberIndex: idx + 1 };
    return acc;
  }, {} as Record<string, typeof annotationData.captions[0] & { numberIndex: number }>);

  // Group visibility map
  const groupMap = annotationData.groups.reduce((acc, grp) => {
    acc[grp.id] = grp;
    return acc;
  }, {} as Record<string, typeof annotationData.groups[0]>);

  const isObjectVisible = useCallback(
    (obj: CanvasObjectItem): boolean => {
      if (!obj.visible) return false;
      const caption = captionMap[obj.captionId];
      if (caption && !caption.visible) return false;
      if (caption?.groupId) {
        const grp = groupMap[caption.groupId];
        if (grp && !grp.visible) return false;
      }
      return true;
    },
    [captionMap, groupMap]
  );

  // Main render function
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !containerRef.current) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Resize canvas to match display container
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    // Clear background
    ctx.clearRect(0, 0, width, height);

    ctx.save();
    // Apply viewport transform (pan & zoom)
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // 1. Draw Image
    if (imgElement) {
      ctx.drawImage(imgElement, 0, 0);
    } else {
      // Placeholder grid if no image
      ctx.fillStyle = '#f3f4f6';
      ctx.fillRect(0, 0, 800, 600);
      ctx.strokeStyle = '#e5e7eb';
      ctx.lineWidth = 1;
      for (let i = 0; i < 800; i += 40) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, 600);
        ctx.stroke();
      }
      for (let j = 0; j < 600; j += 40) {
        ctx.beginPath();
        ctx.moveTo(0, j);
        ctx.lineTo(800, j);
        ctx.stroke();
      }
    }

    // 2. Draw Objects
    annotationData.objects.forEach((obj) => {
      if (!isObjectVisible(obj)) return;
      const selected = isObjectSelected(obj);

      // Determine object color: all objects with same caption share caption.color
      const cap = captionMap[obj.captionId];
      const drawColor = cap?.color || obj.color;

      ctx.save();

      // Neon Glow effect if selected
      if (selected) {
        ctx.shadowColor = '#06b6d4'; // Cyan neon glow
        ctx.shadowBlur = 16 / zoom;
      }

      if (obj.type === 'dot') {
        const x = obj.x ?? 0;
        const y = obj.y ?? 0;
        const r = obj.radius ?? 35;

        // Circular boundary (dashed ring)
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.strokeStyle = selected ? '#0891b2' : `${drawColor}aa`;
        ctx.lineWidth = (selected ? 3 : 2) / zoom;
        ctx.setLineDash([6 / zoom, 4 / zoom]);
        ctx.fillStyle = `${drawColor}15`; // faint fill inside boundary
        ctx.fill();
        ctx.stroke();
        ctx.setLineDash([]);

        // Center dot
        ctx.beginPath();
        ctx.arc(x, y, 7 / zoom, 0, Math.PI * 2);
        ctx.fillStyle = drawColor;
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2 / zoom;
        ctx.stroke();

        // If selected in edit mode: draw resize handle on boundary edge
        if (selected && mode === 'edit') {
          ctx.beginPath();
          ctx.arc(x + r, y, 5 / zoom, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 2 / zoom;
          ctx.fill();
          ctx.stroke();
        }
      } else if (obj.type === 'highlight') {
        // Draw highlight strokes
        if (obj.paths && obj.paths.length > 0) {
          ctx.strokeStyle = `${drawColor}80`; // ~50% opacity
          ctx.lineWidth = (obj.strokeWidth ?? 20);
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';

          obj.paths.forEach((subPath) => {
            if (subPath.length < 2) return;
            ctx.beginPath();
            ctx.moveTo(subPath[0].x, subPath[0].y);
            for (let i = 1; i < subPath.length; i++) {
              ctx.lineTo(subPath[i].x, subPath[i].y);
            }
            ctx.stroke();
          });
        }
      }

      ctx.restore();

      // 3. Review Mode Overlays: Numbers or Captions
      if (mode === 'review' && reviewDisplayMode !== 'markers_only') {
        const center = getObjectCenter(obj);
        ctx.save();

        const fontSize = reviewFontSize / zoom;
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        if (reviewDisplayMode === 'show_numbers') {
          const numText = String(cap?.numberIndex ?? '?');
          const badgeRadius = Math.max(fontSize * 0.75, 12 / zoom);

          // Badge circle
          ctx.beginPath();
          ctx.arc(center.x, center.y, badgeRadius, 0, Math.PI * 2);
          ctx.fillStyle = selected ? '#facc15' : '#ffffff';
          ctx.fill();
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 2 / zoom;
          ctx.stroke();

          // Badge number
          ctx.fillStyle = '#000000';
          ctx.fillText(numText, center.x, center.y);
        } else if (reviewDisplayMode === 'show_captions') {
          const capText = cap?.name || '(Chưa có caption)';
          const textMetrics = ctx.measureText(capText);
          const paddingX = 8 / zoom;
          const paddingY = 4 / zoom;
          const boxWidth = textMetrics.width + paddingX * 2;
          const boxHeight = fontSize + paddingY * 2;

          // Background pill
          ctx.fillStyle = selected ? '#facc15' : '#ffffff';
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 2 / zoom;

          const rx = center.x - boxWidth / 2;
          const ry = center.y - boxHeight / 2;
          ctx.beginPath();
          ctx.roundRect(rx, ry, boxWidth, boxHeight, 4 / zoom);
          ctx.fill();
          ctx.stroke();

          // Text
          ctx.fillStyle = '#000000';
          ctx.fillText(capText, center.x, center.y);
        }

        ctx.restore();
      }
    });

    // 4. Draw currently dragging highlight stroke (preview)
    if (isDrawingRef.current && currentPathRef.current.length > 1 && activeTool === 'highlight') {
      ctx.save();
      ctx.strokeStyle = `${color}80`;
      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(currentPathRef.current[0].x, currentPathRef.current[0].y);
      for (let i = 1; i < currentPathRef.current.length; i++) {
        ctx.lineTo(currentPathRef.current[i].x, currentPathRef.current[i].y);
      }
      ctx.stroke();
      ctx.restore();
    }

    // 5. Draw dashed brush cursor preview (for highlight and eraser tools)
    if (cursorPosRef.current && mode === 'edit' && !isPanning && !spacePressedRef.current) {
      const c = cursorPosRef.current;
      if (activeTool === 'highlight') {
        const radius = brushSize / 2;
        ctx.save();
        ctx.beginPath();
        ctx.arc(c.x, c.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = `${color}25`;
        ctx.fill();
        ctx.setLineDash([4 / zoom, 4 / zoom]);
        ctx.lineWidth = 1.5 / zoom;
        ctx.strokeStyle = '#000000';
        ctx.stroke();
        ctx.lineDashOffset = 4 / zoom;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
        ctx.restore();
      } else if (activeTool === 'eraser') {
        const radius = eraserSize / 2;
        ctx.save();
        ctx.beginPath();
        ctx.arc(c.x, c.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
        ctx.fill();
        ctx.setLineDash([4 / zoom, 4 / zoom]);
        ctx.lineWidth = 1.5 / zoom;
        ctx.strokeStyle = '#ef4444';
        ctx.stroke();
        ctx.lineDashOffset = 4 / zoom;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
        ctx.restore();
      }
    }

    ctx.restore();
  }, [
    imgElement,
    pan,
    zoom,
    annotationData,
    isObjectVisible,
    isObjectSelected,
    captionMap,
    mode,
    activeTool,
    color,
    brushSize,
    eraserSize,
    reviewDisplayMode,
    reviewFontSize,
  ]);

  // Trigger render whenever dependencies change
  useEffect(() => {
    let animId: number;
    const loop = () => {
      renderCanvas();
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [renderCanvas]);

  // Pointer & Mouse interactions
  const handlePointerDown = (e: React.PointerEvent) => {
    // If context menu was open, clicking consumes the click to dismiss menu without creating objects
    if (canvasContextMenu) {
      setCanvasContextMenu(null);
      return;
    }

    // Touch long-press detection
    if (e.pointerType === 'touch') {
      touchStartPosRef.current = { x: e.clientX, y: e.clientY };
      if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
      touchTimerRef.current = setTimeout(() => {
        const coords = screenToImageCoords(e.clientX, e.clientY);
        const clicked = [...annotationData.objects].reverse().find((obj) => {
          if (!isObjectVisible(obj)) return false;
          if (obj.type === 'dot') {
            return distance(coords, { x: obj.x ?? 0, y: obj.y ?? 0 }) <= (obj.radius ?? 35);
          }
          if (obj.type === 'highlight' && obj.paths) {
            return obj.paths.some((p) => p.some((pt) => distance(coords, pt) <= (obj.strokeWidth ?? 20) / 2));
          }
          return false;
        });

        if (clicked) {
          onSelectItems([{ type: 'object', id: clicked.id }]);
          setCanvasContextMenu({
            clientX: e.clientX,
            clientY: e.clientY,
            objId: clicked.id,
          });
        }
      }, 500);
    }

    // Middle click or Space or Select tool with Alt/shift -> Pan
    if (e.button === 1 || spacePressedRef.current || (activeTool === 'select' && e.button === 0 && e.altKey)) {
      setIsPanning(true);
      panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
      return;
    }

    if (e.button !== 0) return; // Only primary button for canvas tools

    const coords = screenToImageCoords(e.clientX, e.clientY);

    // In Review Mode: clicking objects selects them and glowing
    if (mode === 'review') {
      // Find clicked object
      const clicked = [...annotationData.objects].reverse().find((obj) => {
        if (!isObjectVisible(obj)) return false;
        if (obj.type === 'dot') {
          return distance(coords, { x: obj.x ?? 0, y: obj.y ?? 0 }) <= (obj.radius ?? 35);
        }
        if (obj.type === 'highlight' && obj.paths) {
          return obj.paths.some((p) => p.some((pt) => distance(coords, pt) <= (obj.strokeWidth ?? 20) / 2));
        }
        return false;
      });

      if (clicked) {
        onSelectItems([{ type: 'object', id: clicked.id }]);
      } else {
        onSelectItems([]);
      }
      return;
    }

    // In Edit Mode:
    if (activeTool === 'select') {
      // Check if clicked on a selected Dot's resize handle
      const selectedDot = annotationData.objects.find(
        (o) => o.type === 'dot' && selectedItems.some((s) => s.type === 'object' && s.id === o.id)
      );

      if (selectedDot) {
        const handleX = (selectedDot.x ?? 0) + (selectedDot.radius ?? 35);
        const handleY = selectedDot.y ?? 0;
        if (distance(coords, { x: handleX, y: handleY }) <= 14 / zoom) {
          draggingDotRef.current = { id: selectedDot.id, isResizing: true };
          return;
        }
      }

      // Check if clicked on any object
      const clicked = [...annotationData.objects].reverse().find((obj) => {
        if (!isObjectVisible(obj)) return false;
        if (obj.type === 'dot') {
          return distance(coords, { x: obj.x ?? 0, y: obj.y ?? 0 }) <= (obj.radius ?? 35);
        }
        if (obj.type === 'highlight' && obj.paths) {
          return obj.paths.some((p) => p.some((pt) => distance(coords, pt) <= (obj.strokeWidth ?? 20) / 2));
        }
        return false;
      });

      if (clicked) {
        onSelectItems([{ type: 'object', id: clicked.id }]);
        if (clicked.type === 'dot') {
          draggingDotRef.current = { id: clicked.id, isResizing: false };
        }
      } else {
        onSelectItems([]);
        // Click on empty space in select tool starts pan
        setIsPanning(true);
        panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
      }
    } else if (activeTool === 'dot') {
      // 1. First check if clicking on the resize handle of a selected Dot
      const selectedDot = annotationData.objects.find(
        (o) => o.type === 'dot' && selectedItems.some((s) => s.type === 'object' && s.id === o.id)
      );

      if (selectedDot) {
        const handleX = (selectedDot.x ?? 0) + (selectedDot.radius ?? 35);
        const handleY = selectedDot.y ?? 0;
        if (distance(coords, { x: handleX, y: handleY }) <= 14 / zoom) {
          draggingDotRef.current = { id: selectedDot.id, isResizing: true };
          return;
        }
      }

      // 2. Check if clicking inside ANY existing Dot's circular boundary
      const existingDot = [...annotationData.objects].reverse().find((obj) => {
        if (!isObjectVisible(obj) || obj.type !== 'dot') return false;
        return distance(coords, { x: obj.x ?? 0, y: obj.y ?? 0 }) <= (obj.radius ?? 35);
      });

      if (existingDot) {
        // Select and allow dragging or resizing this existing dot!
        onSelectItems([{ type: 'object', id: existingDot.id }]);
        draggingDotRef.current = { id: existingDot.id, isResizing: false };
        return;
      }

      // 3. Otherwise, create new Dot on empty space
      const newCaptionId = generateId('cap');
      const newDotId = generateId('obj');
      const dotColor = getRandomColor();

      const newCaption = {
        id: newCaptionId,
        name: '',
        visible: true,
        groupId: null,
        color: dotColor,
      };

      const newDot: CanvasObjectItem = {
        id: newDotId,
        captionId: newCaptionId,
        type: 'dot',
        visible: true,
        color: dotColor,
        x: coords.x,
        y: coords.y,
        radius: dotRadius,
      };

      onUpdateAnnotation({
        ...annotationData,
        captions: [...annotationData.captions, newCaption],
        objects: [...annotationData.objects, newDot],
      });

      onSelectItems([{ type: 'object', id: newDotId }]);
      if (onObjectCreated) onObjectCreated(newDotId);
    } else if (activeTool === 'highlight') {
      // Start freeform highlight stroke
      isDrawingRef.current = true;
      currentPathRef.current = [coords];
    } else if (activeTool === 'eraser') {
      // Erase immediately on click
      isDrawingRef.current = true;
      eraseAt(coords.x, coords.y);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (touchTimerRef.current) {
      if (distance({ x: e.clientX, y: e.clientY }, touchStartPosRef.current) > 10) {
        clearTimeout(touchTimerRef.current);
        touchTimerRef.current = null;
      }
    }

    if (isPanning) {
      setPan({
        x: e.clientX - panStartRef.current.x,
        y: e.clientY - panStartRef.current.y,
      });
      return;
    }

    const coords = screenToImageCoords(e.clientX, e.clientY);
    cursorPosRef.current = coords;

    // Dragging dot center or resizing dot boundary
    if (draggingDotRef.current) {
      const dotId = draggingDotRef.current.id;
      const isResizing = draggingDotRef.current.isResizing;

      const updatedObjects = annotationData.objects.map((obj) => {
        if (obj.id === dotId && obj.type === 'dot') {
          if (isResizing) {
            const newRadius = Math.max(10, distance({ x: obj.x ?? 0, y: obj.y ?? 0 }, coords));
            return { ...obj, radius: Math.round(newRadius) };
          } else {
            return { ...obj, x: Math.round(coords.x), y: Math.round(coords.y) };
          }
        }
        return obj;
      });

      onUpdateAnnotation({
        ...annotationData,
        objects: updatedObjects,
      });
      return;
    }

    if (!isDrawingRef.current) return;

    if (activeTool === 'highlight') {
      currentPathRef.current.push(coords);
    } else if (activeTool === 'eraser') {
      eraseAt(coords.x, coords.y);
    }
  };

  const handlePointerUp = () => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }

    if (isPanning) {
      setIsPanning(false);
    }

    if (draggingDotRef.current) {
      draggingDotRef.current = null;
    }

    if (isDrawingRef.current) {
      isDrawingRef.current = false;

      // Commit new highlight object
      if (activeTool === 'highlight' && currentPathRef.current.length > 1) {
        const newCaptionId = generateId('cap');
        const newObjId = generateId('obj');

        const newCaption = {
          id: newCaptionId,
          name: '',
          visible: true,
          groupId: null,
          color,
        };

        const newHighlight: CanvasObjectItem = {
          id: newObjId,
          captionId: newCaptionId,
          type: 'highlight',
          visible: true,
          color,
          paths: [currentPathRef.current],
          strokeWidth: brushSize,
        };

        onUpdateAnnotation({
          ...annotationData,
          captions: [...annotationData.captions, newCaption],
          objects: [...annotationData.objects, newHighlight],
        });

        onSelectItems([{ type: 'object', id: newObjId }]);
        if (onObjectCreated) onObjectCreated(newObjId);
        currentPathRef.current = [];
      }
    }
  };

  // Erase function: trims highlights vectorially and deletes touched dots
  const eraseAt = (cx: number, cy: number) => {
    const er = eraserSize / 2;
    let modified = false;

    const remainingObjects: CanvasObjectItem[] = [];

    annotationData.objects.forEach((obj) => {
      if (!obj.visible) {
        remainingObjects.push(obj);
        return;
      }

      if (obj.type === 'dot') {
        const d = distance({ x: cx, y: cy }, { x: obj.x ?? 0, y: obj.y ?? 0 });
        if (d <= er + 7) {
          // Erase dot
          modified = true;
          return;
        }
        remainingObjects.push(obj);
      } else if (obj.type === 'highlight') {
        if (!obj.paths) {
          remainingObjects.push(obj);
          return;
        }

        const newPaths: Point2D[][] = [];
        let pathsChanged = false;

        obj.paths.forEach((subPath) => {
          const trimmed = trimPathWithCircle(subPath, cx, cy, er);
          if (trimmed.length !== 1 || trimmed[0]?.length !== subPath.length) {
            pathsChanged = true;
          }
          trimmed.forEach((p) => newPaths.push(p));
        });

        if (pathsChanged) {
          modified = true;
          if (newPaths.length > 0) {
            remainingObjects.push({
              ...obj,
              paths: newPaths,
            });
          }
        } else {
          remainingObjects.push(obj);
        }
      }
    });

    if (modified) {
      onUpdateAnnotation({
        ...annotationData,
        objects: remainingObjects,
      });
    }
  };

  // Mouse wheel: zoom or resize selected dot / tool
  const handleWheel = (e: React.WheelEvent) => {
    // 1. Highlight tool: scroll wheel changes brush size
    if (activeTool === 'highlight' && onChangeBrushSize && !e.ctrlKey) {
      e.preventDefault();
      const step = brushSize < 20 ? 2 : brushSize < 100 ? 5 : 15;
      const delta = e.deltaY < 0 ? step : -step;
      const newSize = Math.max(5, Math.min(500, brushSize + delta));
      onChangeBrushSize(newSize);
      return;
    }

    // 2. Eraser tool: scroll wheel changes eraser size
    if (activeTool === 'eraser' && onChangeEraserSize && !e.ctrlKey) {
      e.preventDefault();
      const step = eraserSize < 30 ? 2 : 5;
      const delta = e.deltaY < 0 ? step : -step;
      const newSize = Math.max(10, Math.min(150, eraserSize + delta));
      onChangeEraserSize(newSize);
      return;
    }

    // 3. If selecting a dot, scroll wheel resizes its radius in select or dot tool
    const selectedDot = annotationData.objects.find(
      (o) => o.type === 'dot' && selectedItems.some((s) => s.type === 'object' && s.id === o.id)
    );

    if (selectedDot && (activeTool === 'select' || activeTool === 'dot') && !e.ctrlKey) {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 3 : -3;
      const newRadius = Math.max(10, Math.min(250, (selectedDot.radius ?? 35) + delta));
      onUpdateAnnotation({
        ...annotationData,
        objects: annotationData.objects.map((o) =>
          o.id === selectedDot.id ? { ...o, radius: newRadius } : o
        ),
      });
      return;
    }

    // Default: zoom in/out centered around cursor
    e.preventDefault();
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const newZoom = Math.max(0.1, Math.min(15, zoom * zoomFactor));

    setPan({
      x: mouseX - (mouseX - pan.x) * (newZoom / zoom),
      y: mouseY - (mouseY - pan.y) * (newZoom / zoom),
    });
    setZoom(newZoom);
  };

  const handleFitToView = () => {
    if (!imgElement || !containerRef.current) return;
    const cw = containerRef.current.clientWidth;
    const ch = containerRef.current.clientHeight;
    const scale = Math.min((cw - 40) / imgElement.width, (ch - 40) / imgElement.height, 1);
    setZoom(scale > 0 ? scale : 1);
    setPan({
      x: (cw - imgElement.width * scale) / 2,
      y: (ch - imgElement.height * scale) / 2,
    });
  };

  const handleResetZoom = () => {
    if (!imgElement || !containerRef.current) return;
    const cw = containerRef.current.clientWidth;
    const ch = containerRef.current.clientHeight;
    setZoom(1);
    setPan({
      x: (cw - imgElement.width) / 2,
      y: (ch - imgElement.height) / 2,
    });
  };

  // Right-click Context Menu on canvas objects
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const coords = screenToImageCoords(e.clientX, e.clientY);
    const clicked = [...annotationData.objects].reverse().find((obj) => {
      if (!isObjectVisible(obj)) return false;
      if (obj.type === 'dot') {
        return distance(coords, { x: obj.x ?? 0, y: obj.y ?? 0 }) <= (obj.radius ?? 35);
      }
      if (obj.type === 'highlight' && obj.paths) {
        return obj.paths.some((p) => p.some((pt) => distance(coords, pt) <= (obj.strokeWidth ?? 20) / 2));
      }
      return false;
    });

    if (clicked) {
      onSelectItems([{ type: 'object', id: clicked.id }]);
      setCanvasContextMenu({
        clientX: e.clientX,
        clientY: e.clientY,
        objId: clicked.id,
      });
    } else {
      setCanvasContextMenu(null);
    }
  };

  const PRESET_PALETTE = ['#ff0000', '#f59e0b', '#10b981', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#ffffff', '#000000'];

  const handleChangeColor = (newColor: string) => {
    if (!canvasContextMenu) return;
    const targetObj = annotationData.objects.find((o) => o.id === canvasContextMenu.objId);
    if (!targetObj) return;

    const capId = targetObj.captionId;
    const updatedCaptions = annotationData.captions.map((c) =>
      c.id === capId ? { ...c, color: newColor } : c
    );
    const updatedObjects = annotationData.objects.map((o) =>
      o.captionId === capId ? { ...o, color: newColor } : o
    );

    onUpdateAnnotation({
      ...annotationData,
      captions: updatedCaptions,
      objects: updatedObjects,
    });
    setCanvasContextMenu(null);
  };

  const handleDeleteObject = () => {
    if (!canvasContextMenu) return;
    const targetObj = annotationData.objects.find((o) => o.id === canvasContextMenu.objId);
    if (!targetObj) return;

    const remainingObjects = annotationData.objects.filter((o) => o.id !== targetObj.id);
    const activeCapIds = new Set(remainingObjects.map((o) => o.captionId));
    const remainingCaptions = annotationData.captions.filter((c) => activeCapIds.has(c.id));

    onUpdateAnnotation({
      ...annotationData,
      captions: remainingCaptions,
      objects: remainingObjects,
    });
    onSelectItems([]);
    setCanvasContextMenu(null);
  };

  return (
    <div
      ref={containerRef}
      className="relative flex-1 w-full h-full bg-[#1e293b] overflow-hidden select-none cursor-crosshair"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={() => {
        cursorPosRef.current = null;
      }}
      onWheel={handleWheel}
      onContextMenu={handleContextMenu}
      style={{
        cursor: isPanning || spacePressedRef.current ? 'grab' : activeTool === 'select' ? 'default' : 'crosshair',
      }}
    >
      <canvas ref={canvasRef} className="absolute inset-0 block w-full h-full" />

      {/* Floating Bottom Toolbar */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur border-2 border-black rounded-xl p-1.5 shadow-[4px_4px_0_#000] flex items-center gap-1.5 z-20 text-xs">
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          className="nb-btn px-2 py-1 rounded text-xs disabled:opacity-40"
          title="Hoàn tác (Ctrl+Z)"
        >
          ↩ Hoàn tác
        </button>
        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          className="nb-btn px-2 py-1 rounded text-xs disabled:opacity-40"
          title="Làm lại (Ctrl+Y)"
        >
          ↪ Làm lại
        </button>

        <div className="w-[1px] h-5 bg-gray-300 mx-1" />

        <button
          type="button"
          onClick={() => {
            setZoom((z) => Math.max(0.2, z * 0.8));
          }}
          className="nb-btn w-7 h-7 rounded text-xs"
          title="Thu nhỏ"
        >
          -
        </button>

        <span className="font-mono font-bold w-12 text-center text-xs">
          {Math.round(zoom * 100)}%
        </span>

        <button
          type="button"
          onClick={() => {
            setZoom((z) => Math.min(10, z * 1.25));
          }}
          className="nb-btn w-7 h-7 rounded text-xs"
          title="Phóng to"
        >
          +
        </button>

        <button
          type="button"
          onClick={handleFitToView}
          className="nb-btn px-2 py-1 rounded text-xs"
          title="Vừa màn hình"
        >
          Fit
        </button>

        <button
          type="button"
          onClick={handleResetZoom}
          className="nb-btn px-2 py-1 rounded text-xs"
          title="Tỷ lệ 100%"
        >
          1:1
        </button>
      </div>

      {/* Canvas Object Context Menu */}
      {canvasContextMenu && (
        <div
          ref={contextMenuRef}
          style={{ top: `${canvasContextMenu.clientY}px`, left: `${canvasContextMenu.clientX}px` }}
          className="fixed bg-white border-2 border-black rounded-lg shadow-[4px_4px_0_#000] p-2 z-50 text-xs min-w-44 font-medium flex flex-col gap-2"
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="font-bold text-[11px] text-gray-500 uppercase tracking-wider pb-1 border-b">
            Tùy chọn đối tượng
          </div>

          {/* Color Picker Palette */}
          <div>
            <div className="text-[11px] font-semibold mb-1">🎨 Đổi màu (toàn Caption):</div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {PRESET_PALETTE.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => handleChangeColor(c)}
                  className="w-4 h-4 rounded-full border border-black cursor-pointer hover:scale-125 transition-transform"
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
              <input
                type="color"
                onChange={(e) => handleChangeColor(e.target.value)}
                className="w-5 h-5 rounded cursor-pointer border border-black"
                title="Chọn màu khác"
              />
            </div>
          </div>

          <hr className="border-black/20" />

          {/* Change Caption Button */}
          <button
            type="button"
            onClick={() => {
              if (onOpenQuickCaption) onOpenQuickCaption();
              setCanvasContextMenu(null);
            }}
            className="w-full text-left px-2 py-1 hover:bg-nb-yellow rounded flex items-center gap-2"
          >
            <span>🏷️ Đổi Caption (Phím C)</span>
          </button>

          {/* Delete Object Button */}
          <button
            type="button"
            onClick={handleDeleteObject}
            className="w-full text-left px-2 py-1 hover:bg-red-100 text-red-600 rounded flex items-center gap-2"
          >
            <span>🗑️ Xóa đối tượng</span>
          </button>
        </div>
      )}
    </div>
  );
}
