import React, { useState, useRef, useEffect } from 'react';

interface ResizableLayoutProps {
  leftContentTop: React.ReactNode;
  leftContentBottom: React.ReactNode;
  centerContent: React.ReactNode;
  rightContent: React.ReactNode;
}

export default function ResizableLayout({
  leftContentTop,
  leftContentBottom,
  centerContent,
  rightContent,
}: ResizableLayoutProps) {
  const [leftWidth, setLeftWidth] = useState(270);
  const [rightWidth, setRightWidth] = useState(290);
  const [leftTopHeight, setLeftTopHeight] = useState(340);

  const containerRef = useRef<HTMLDivElement>(null);
  const leftPanelRef = useRef<HTMLDivElement>(null);

  const isDraggingLeft = useRef(false);
  const isDraggingRight = useRef(false);
  const isDraggingLeftSplit = useRef(false);

  // Pointer events (not mouse-only) so splitters also drag on touch screens.
  // pointercancel / lostpointercapture end the drag so a cancelled gesture
  // never leaves the layout stuck in a dragging state.
  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (isDraggingLeft.current && containerRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const newWidth = Math.max(180, Math.min(480, e.clientX - containerRect.left));
        setLeftWidth(newWidth);
      } else if (isDraggingRight.current && containerRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const newWidth = Math.max(200, Math.min(500, containerRect.right - e.clientX));
        setRightWidth(newWidth);
      } else if (isDraggingLeftSplit.current && leftPanelRef.current) {
        const leftRect = leftPanelRef.current.getBoundingClientRect();
        const newHeight = Math.max(120, Math.min(leftRect.height - 120, e.clientY - leftRect.top));
        setLeftTopHeight(newHeight);
      }
    };

    const endDrag = () => {
      isDraggingLeft.current = false;
      isDraggingRight.current = false;
      isDraggingLeftSplit.current = false;
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', endDrag);
      window.removeEventListener('pointercancel', endDrag);
    };
  }, []);

  const startDragLeft = (e: React.PointerEvent) => {
    e.preventDefault();
    isDraggingLeft.current = true;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
  };

  const startDragRight = (e: React.PointerEvent) => {
    e.preventDefault();
    isDraggingRight.current = true;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
  };

  const startDragLeftSplit = (e: React.PointerEvent) => {
    e.preventDefault();
    isDraggingLeftSplit.current = true;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'row-resize';
  };

  return (
    <div
      ref={containerRef}
      className="flex-1 flex flex-col md:flex-row w-full h-full min-h-0 overflow-y-auto md:overflow-hidden select-none"
    >
      {/* Left Column: full-width stacked on mobile, fixed rail on desktop */}
      <div
        ref={leftPanelRef}
        style={{ '--panel-w': `${leftWidth}px` } as React.CSSProperties}
        className="flex flex-col bg-cream border-b-2 md:border-b-0 md:border-r-2 border-black flex-shrink-0 w-full md:w-[var(--panel-w)] md:h-full overflow-hidden"
      >
        <div
          style={{ '--top-h': `${leftTopHeight}px` } as React.CSSProperties}
          className="flex flex-col min-h-0 overflow-hidden h-64 md:h-[var(--top-h)] flex-shrink-0"
        >
          {leftContentTop}
        </div>

        {/* Horizontal Splitter in Left Column (desktop only) */}
        <div
          onPointerDown={startDragLeftSplit}
          className="hidden md:flex h-2 bg-gray-200 hover:bg-nb-yellow border-y border-black cursor-row-resize items-center justify-center transition-colors flex-shrink-0 touch-none"
          title="Kéo để điều chỉnh kích thước trên/dưới"
        >
          <div className="w-8 h-1 bg-black rounded-full opacity-60" />
        </div>

        <div className="flex-1 min-h-0 overflow-hidden flex flex-col max-h-72 md:max-h-none">
          {leftContentBottom}
        </div>
      </div>

      {/* Vertical Splitter between Left & Center (desktop only) */}
      <div
        onPointerDown={startDragLeft}
        className="hidden md:flex w-2 bg-gray-200 hover:bg-nb-yellow border-r border-black cursor-col-resize flex-col items-center justify-center transition-colors flex-shrink-0 z-10 touch-none"
        title="Kéo để điều chỉnh cột trái"
      >
        <div className="w-1 h-8 bg-black rounded-full opacity-60" />
      </div>

      {/* Center Canvas Area: first-class 55vh stage on mobile */}
      <div className="w-full md:flex-1 md:min-w-0 min-h-[55vh] md:min-h-0 md:h-full overflow-hidden flex flex-col relative flex-shrink-0 md:flex-shrink">
        {centerContent}
      </div>

      {/* Vertical Splitter between Center & Right (desktop only) */}
      <div
        onPointerDown={startDragRight}
        className="hidden md:flex w-2 bg-gray-200 hover:bg-nb-yellow border-l border-black cursor-col-resize flex-col items-center justify-center transition-colors flex-shrink-0 z-10 touch-none"
        title="Kéo để điều chỉnh cột Layers"
      >
        <div className="w-1 h-8 bg-black rounded-full opacity-60" />
      </div>

      {/* Right Column (Layers): stacked below canvas on mobile */}
      <div
        style={{ '--panel-w-r': `${rightWidth}px` } as React.CSSProperties}
        className="flex flex-col bg-cream border-t-2 md:border-t-0 md:border-l-2 border-black flex-shrink-0 w-full md:w-[var(--panel-w-r)] md:h-full overflow-hidden"
      >
        {rightContent}
      </div>
    </div>
  );
}
