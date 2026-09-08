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

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
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

    const handleMouseUp = () => {
      isDraggingLeft.current = false;
      isDraggingRight.current = false;
      isDraggingLeftSplit.current = false;
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const startDragLeft = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingLeft.current = true;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
  };

  const startDragRight = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRight.current = true;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
  };

  const startDragLeftSplit = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingLeftSplit.current = true;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'row-resize';
  };

  return (
    <div ref={containerRef} className="flex-1 flex w-full h-full overflow-hidden select-none">
      {/* Left Column */}
      <div
        ref={leftPanelRef}
        style={{ width: `${leftWidth}px` }}
        className="flex flex-col bg-cream border-r-2 border-black flex-shrink-0 h-full overflow-hidden"
      >
        <div style={{ height: `${leftTopHeight}px` }} className="flex flex-col min-h-0 overflow-hidden">
          {leftContentTop}
        </div>

        {/* Horizontal Splitter in Left Column */}
        <div
          onMouseDown={startDragLeftSplit}
          className="h-2 bg-gray-200 hover:bg-nb-yellow border-y border-black cursor-row-resize flex items-center justify-center transition-colors flex-shrink-0"
          title="Kéo để điều chỉnh kích thước trên/dưới"
        >
          <div className="w-8 h-1 bg-black rounded-full opacity-60" />
        </div>

        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          {leftContentBottom}
        </div>
      </div>

      {/* Vertical Splitter between Left & Center */}
      <div
        onMouseDown={startDragLeft}
        className="w-2 bg-gray-200 hover:bg-nb-yellow border-r border-black cursor-col-resize flex flex-col items-center justify-center transition-colors flex-shrink-0 z-10"
        title="Kéo để điều chỉnh cột trái"
      >
        <div className="w-1 h-8 bg-black rounded-full opacity-60" />
      </div>

      {/* Center Canvas Area */}
      <div className="flex-1 min-w-0 h-full overflow-hidden flex flex-col relative">
        {centerContent}
      </div>

      {/* Vertical Splitter between Center & Right */}
      <div
        onMouseDown={startDragRight}
        className="w-2 bg-gray-200 hover:bg-nb-yellow border-l border-black cursor-col-resize flex flex-col items-center justify-center transition-colors flex-shrink-0 z-10"
        title="Kéo để điều chỉnh cột Layers"
      >
        <div className="w-1 h-8 bg-black rounded-full opacity-60" />
      </div>

      {/* Right Column (Layers) */}
      <div
        style={{ width: `${rightWidth}px` }}
        className="flex flex-col bg-cream border-l-2 border-black flex-shrink-0 h-full overflow-hidden"
      >
        {rightContent}
      </div>
    </div>
  );
}
