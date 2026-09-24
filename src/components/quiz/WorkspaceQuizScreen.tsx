import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import type {
  StationMark,
  WorkspaceAnswerType,
  WorkspaceFeedbackInfo,
  WorkspaceQuestion,
} from '../../hooks/useWorkspaceQuizEngine';
import type { Point2D } from '../../types/workspace';

interface Props {
  question: WorkspaceQuestion;
  index: number;
  total: number;
  answerType: WorkspaceAnswerType;
  timeLimit: number;
  timeLeft: number;
  feedback: WorkspaceFeedbackInfo | null;
  marks: StationMark[];
  onAnswerClassify: (value: string) => void;
  onClickIdentify: (coords: Point2D, imgW: number, imgH: number) => { hit: boolean };
  onNext: () => void;
}

const MCQ_KEYS = ['1', '2', '3', '4'];

const PALETTE = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#06b6d4',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
];

export default function WorkspaceQuizScreen({
  question,
  index,
  total,
  answerType,
  timeLimit,
  timeLeft,
  feedback,
  marks,
  onAnswerClassify,
  onClickIdentify,
  onNext,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [imgElement, setImgElement] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Point2D>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<Point2D>({ x: 0, y: 0 });
  const pointerDownPosRef = useRef<Point2D>({ x: 0, y: 0 });

  const [inputValue, setInputValue] = useState('');
  const [selectedOpt, setSelectedOpt] = useState<string | null>(null);
  const [missToast, setMissToast] = useState(false);
  const missToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Assign stable random vibrant colors for each object in this question
  const objectColorMap = useMemo(() => {
    const map = new Map<string, string>();
    question.allObjects.forEach((obj, idx) => {
      map.set(obj.id, PALETTE[idx % PALETTE.length]);
    });
    return map;
  }, [question.id, question.allObjects]);

  // Load image file
  useEffect(() => {
    const url = URL.createObjectURL(question.imageFile);
    const img = new Image();
    img.src = url;
    img.onload = () => {
      setImgElement(img);
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
  }, [question.imageFile]);

  // Reset inputs on question change
  useEffect(() => {
    setInputValue('');
    setSelectedOpt(null);
    setMissToast(false);
  }, [question]);

  const answeredAtRef = useRef(0);

  // Hotkey handlers
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (feedback) {
        if (e.key === 'Enter') {
          if (Date.now() - answeredAtRef.current < 350) return;
          onNext();
        }
        return;
      }

      if (question.kind === 'classify') {
        if (answerType === 'input' && e.key === 'Enter') {
          answeredAtRef.current = Date.now();
          onAnswerClassify(inputValue);
        } else if (answerType === 'mcq' && MCQ_KEYS.includes(e.key) && question.mcqOptions) {
          const opt = question.mcqOptions[parseInt(e.key, 10) - 1];
          if (opt !== undefined) {
            answeredAtRef.current = Date.now();
            setSelectedOpt(opt);
            onAnswerClassify(opt);
          }
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  // Screen to image coordinates
  const screenToImageCoords = useCallback(
    (clientX: number, clientY: number): Point2D => {
      if (!containerRef.current) return { x: 0, y: 0 };
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = clientX - rect.left;
      const mouseY = clientY - rect.top;
      return {
        x: (mouseX - pan.x) / zoom,
        y: (mouseY - pan.y) / zoom,
      };
    },
    [pan, zoom]
  );

  // Animation and canvas rendering loop
  useEffect(() => {
    let animId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = (time: number) => {
      if (!containerRef.current) return;
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      ctx.clearRect(0, 0, width, height);

      ctx.save();
      ctx.translate(pan.x, pan.y);
      ctx.scale(zoom, zoom);

      // 1. Draw base image
      if (imgElement) {
        ctx.drawImage(imgElement, 0, 0);
      }

      // 2. Render depending on mode:
      if (question.kind === 'classify') {
        // Arrow pulsing opacity from 80% to 100%
        const arrowAlpha = 0.9 + 0.1 * Math.sin(time / 150);

        if (question.arrowTip) {
          const { x: tx, y: ty } = question.arrowTip;
          const angle = question.arrowAngleRad ?? Math.PI / 4;

          // Screen-relative tail length ~135px regardless of zoom or image dimensions
          const tailLength = 135 / zoom;
          const sx = tx + Math.cos(angle) * tailLength;
          const sy = ty + Math.sin(angle) * tailLength;

          // Vector from start (tail) to tip
          const dirAngle = Math.atan2(ty - sy, tx - sx);

          // Filled triangle arrowhead dimensions
          const headLength = 22 / zoom;
          const headAngle = Math.PI / 6; // 30 degrees

          const c1x = tx - headLength * Math.cos(dirAngle - headAngle);
          const c1y = ty - headLength * Math.sin(dirAngle - headAngle);
          const c2x = tx - headLength * Math.cos(dirAngle + headAngle);
          const c2y = ty - headLength * Math.sin(dirAngle + headAngle);

          // Where the shaft meets the base of the arrowhead
          const shaftEndX = tx - (headLength * 0.7) * Math.cos(dirAngle);
          const shaftEndY = ty - (headLength * 0.7) * Math.sin(dirAngle);

          ctx.save();
          ctx.globalAlpha = Math.max(0.8, Math.min(1.0, arrowAlpha));

          // ---------------- Layer 1: Outer White Halo Contour ----------------
          // Shaft white contour
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(shaftEndX, shaftEndY);
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 11 / zoom;
          ctx.lineCap = 'round';
          ctx.stroke();

          // Head white contour
          ctx.beginPath();
          ctx.moveTo(tx, ty);
          ctx.lineTo(c1x, c1y);
          ctx.lineTo(c2x, c2y);
          ctx.closePath();
          ctx.fillStyle = '#ffffff';
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 7 / zoom;
          ctx.lineJoin = 'round';
          ctx.stroke();

          // ---------------- Layer 2: Middle Black Frame ----------------
          // Shaft black frame
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(shaftEndX, shaftEndY);
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 7 / zoom;
          ctx.lineCap = 'round';
          ctx.stroke();

          // Head black frame
          ctx.beginPath();
          ctx.moveTo(tx, ty);
          ctx.lineTo(c1x, c1y);
          ctx.lineTo(c2x, c2y);
          ctx.closePath();
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 4 / zoom;
          ctx.lineJoin = 'round';
          ctx.stroke();

          // ---------------- Layer 3: Core Pure Vivid Red Fill ----------------
          // Shaft red core
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(shaftEndX, shaftEndY);
          ctx.strokeStyle = '#ff0000';
          ctx.lineWidth = 4 / zoom;
          ctx.lineCap = 'round';
          ctx.stroke();

          // Head red solid fill
          ctx.beginPath();
          ctx.moveTo(tx, ty);
          ctx.lineTo(c1x, c1y);
          ctx.lineTo(c2x, c2y);
          ctx.closePath();
          ctx.fillStyle = '#ff0000';
          ctx.fill();

          // Decorative tail end pin
          ctx.beginPath();
          ctx.arc(sx, sy, 5 / zoom, 0, Math.PI * 2);
          ctx.fillStyle = '#ff0000';
          ctx.fill();
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 2 / zoom;
          ctx.stroke();

          ctx.restore();
        }
      } else if (question.kind === 'identify') {
        const isReviewingFeedback = feedback !== null;

        if (isReviewingFeedback) {
          // Khi xem đáp án: ẩn các object khác, CHỈ chừa lại các object của caption đúng!
          const correctObjects = question.allObjects.filter(
            (obj) => obj.visible && obj.captionId === question.targetCaptionId
          );

          ctx.save();
          ctx.globalAlpha = 1.0; // Sáng rõ 100% không nhấp nháy

          // Neon green glow
          ctx.shadowColor = '#22c55e';
          ctx.shadowBlur = 18 / zoom;

          correctObjects.forEach((obj) => {
            const limeColor = '#22c55e'; // Xanh lá sáng rõ

            if (obj.type === 'dot') {
              const x = obj.x ?? 0;
              const y = obj.y ?? 0;

              // Outer glowing lime ring
              ctx.beginPath();
              ctx.arc(x, y, 16 / zoom, 0, Math.PI * 2);
              ctx.strokeStyle = limeColor;
              ctx.lineWidth = 3 / zoom;
              ctx.stroke();

              // Solid center dot
              ctx.beginPath();
              ctx.arc(x, y, 10 / zoom, 0, Math.PI * 2);
              ctx.fillStyle = limeColor;
              ctx.fill();
              ctx.strokeStyle = '#000000';
              ctx.lineWidth = 2.5 / zoom;
              ctx.stroke();
            } else if (obj.type === 'highlight' && obj.paths) {
              ctx.strokeStyle = limeColor;
              ctx.lineWidth = (obj.strokeWidth ?? 20) + 4 / zoom;
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
          });

          ctx.restore();
        } else {
          // Lúc đang làm bài: toàn bộ object nhấp nháy opacity 0% - 50%
          const objAlpha = 0.25 + 0.25 * Math.sin(time / 250);

          ctx.save();
          ctx.globalAlpha = Math.max(0, Math.min(0.5, objAlpha));

          question.allObjects.forEach((obj) => {
            if (!obj.visible) return;
            const c = objectColorMap.get(obj.id) || '#ef4444';

            if (obj.type === 'dot') {
              const x = obj.x ?? 0;
              const y = obj.y ?? 0;
              ctx.beginPath();
              ctx.arc(x, y, 9 / zoom, 0, Math.PI * 2);
              ctx.fillStyle = c;
              ctx.fill();
              ctx.strokeStyle = '#000000';
              ctx.lineWidth = 2 / zoom;
              ctx.stroke();
            } else if (obj.type === 'highlight' && obj.paths) {
              ctx.strokeStyle = c;
              ctx.lineWidth = obj.strokeWidth ?? 20;
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
          });

          ctx.restore();
        }
      }

      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [
    imgElement,
    pan,
    zoom,
    question,
    objectColorMap,
    feedback,
  ]);

  // Pointer interactions for pan & click detection
  const handlePointerDown = (e: React.PointerEvent) => {
    pointerDownPosRef.current = { x: e.clientX, y: e.clientY };
    if (e.button === 1 || e.button === 0) {
      setIsPanning(true);
      panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isPanning) {
      setPan({
        x: e.clientX - panStartRef.current.x,
        y: e.clientY - panStartRef.current.y,
      });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsPanning(false);

    // If pointer moved less than 6px, treat as a click
    const moveDist = Math.hypot(
      e.clientX - pointerDownPosRef.current.x,
      e.clientY - pointerDownPosRef.current.y
    );

    if (moveDist <= 6 && !feedback && imgElement) {
      const coords = screenToImageCoords(e.clientX, e.clientY);

      if (question.kind === 'identify') {
        const result = onClickIdentify(coords, imgElement.width, imgElement.height);
        if (!result.hit) {
          // Missed all objects: show temporary toast hint
          setMissToast(true);
          if (missToastTimerRef.current) clearTimeout(missToastTimerRef.current);
          missToastTimerRef.current = setTimeout(() => {
            setMissToast(false);
          }, 1500);
        }
      }
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
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

  const pct = Math.max(0, (timeLeft / timeLimit) * 100);
  const showShake = feedback !== null && !feedback.correct;

  const answerMcq = (opt: string) => {
    if (feedback) return;
    answeredAtRef.current = Date.now();
    setSelectedOpt(opt);
    onAnswerClassify(opt);
  };

  return (
    <div className={`flex-1 flex flex-col bg-cream h-full select-none ${showShake ? 'animate-shake' : ''}`}>
      {/* Top Countdown Progress Bar */}
      <div className="w-full bg-white border-b-2 border-black h-3.5 flex-shrink-0">
        <div
          className={`h-full ${timeLeft < 5 ? 'bg-nb-red' : 'bg-nb-lime'}`}
          style={{ width: `${pct}%`, transition: 'width 1s linear' }}
        />
      </div>

      {/* Station Progress Dots */}
      <div className="bg-white border-b-2 border-black px-3 py-1 flex justify-between items-center overflow-x-auto flex-shrink-0 text-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
          {Array.from({ length: total }, (_, i) => (
            <span
              key={i}
              title={`Trạm ${i + 1}`}
              className={`w-3 h-3 border border-black flex-shrink-0 ${
                i < marks.length
                  ? marks[i] === 'correct'
                    ? 'bg-nb-lime'
                    : 'bg-nb-red'
                  : i === index
                  ? 'bg-nb-yellow ring-2 ring-black'
                  : 'bg-gray-200'
              }`}
            />
          ))}
        </div>

        <div className="font-mono font-bold flex items-center gap-2 pl-2 flex-shrink-0">
          <span className="text-gray-500">Trạm {index + 1}/{total}</span>
          <span className={`px-2 py-0.5 rounded border border-black ${timeLeft < 5 ? 'bg-nb-red text-white animate-pulse' : 'bg-nb-yellow'}`}>
            ⏱️ {timeLeft}s
          </span>
        </div>
      </div>

      {/* Mode Banner / Instruction Header */}
      <div className="bg-nb-yellow/40 border-b-2 border-black px-4 py-2 flex items-center justify-between gap-2 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs uppercase font-bold px-2 py-0.5 rounded bg-black text-white flex-shrink-0">
            {question.kind === 'classify' ? 'Phân loại cấu trúc' : 'Chọn cấu trúc'}
          </span>

          {question.kind === 'classify' ? (
            <span className="text-xs sm:text-sm font-semibold truncate text-gray-800">
              Nhìn theo mũi tên chỉ và xác định tên cấu trúc giải phẫu:
            </span>
          ) : (
            <div className="text-xs sm:text-sm font-bold truncate flex items-center gap-1.5">
              <span>🎯 Hãy chạm / bấm vào vị trí của:</span>
              <span className="bg-nb-cyan border border-black px-2 py-0.5 rounded text-sm text-black">
                {question.targetCaptionName}
              </span>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={handleFitToView}
          className="nb-btn px-2 py-0.5 text-[11px] rounded bg-white flex-shrink-0"
          title="Thu phóng vừa màn hình"
        >
          🔍 Vừa khung
        </button>
      </div>

      {/* Main Interactive Canvas Area */}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
        className="flex-1 min-h-0 relative bg-gray-900 overflow-hidden cursor-crosshair"
      >
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />

        {/* Miss Toast Hint in Identify Mode */}
        {missToast && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-nb-yellow border-2 border-black shadow-[3px_3px_0_#000] px-3 py-1.5 rounded-lg text-xs font-bold animate-bounce z-20 pointer-events-none">
            💡 Chưa trúng cấu trúc nào, hãy nhấp lại vào điểm đánh dấu!
          </div>
        )}

      </div>

      {/* Bottom Answer Controls & Feedback Bar */}
      {feedback ? (
        <div className="bg-white border-t-[3px] border-black p-3 sm:p-4 flex-shrink-0">
          <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
            <div
              className={`w-full sm:w-auto flex-1 p-2.5 sm:p-3 px-4 rounded-xl border-[3px] border-black shadow-[4px_4px_0_#000] flex items-center gap-3 ${
                feedback.correct ? 'bg-nb-lime' : 'bg-nb-pink'
              }`}
            >
              <span className="text-2xl flex-shrink-0">
                {feedback.correct ? '🎉' : feedback.timeout ? '⏰' : '❌'}
              </span>
              <div className="min-w-0">
                <div className="font-display text-base sm:text-lg uppercase tracking-wide">
                  {feedback.correct ? 'Chính xác!' : feedback.timeout ? 'Hết giờ!' : 'Chưa chính xác!'}
                </div>
                {feedback.message && (
                  <div className="text-xs sm:text-sm font-bold text-gray-900 mt-0.5 truncate">
                    {feedback.message}
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={onNext}
              autoFocus
              className="nb-btn bg-nb-yellow py-3 px-8 rounded-full uppercase tracking-wider text-xs sm:text-sm font-bold flex items-center gap-2 flex-shrink-0 w-full sm:w-auto justify-center shadow-[4px_4px_0_#000]"
            >
              <span>Tiếp tục (Enter)</span>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        </div>
      ) : question.kind === 'classify' ? (
        <div className="bg-white border-t-[3px] border-black p-3 sm:p-4 flex-shrink-0">
          {answerType === 'mcq' && question.mcqOptions ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-3xl mx-auto">
              {question.mcqOptions.map((opt, i) => (
                <button
                  type="button"
                  key={opt}
                  onClick={() => answerMcq(opt)}
                  className={`nb-btn py-2.5 px-3 text-left flex items-center justify-between gap-2 text-xs sm:text-sm font-semibold rounded-lg ${
                    selectedOpt === opt ? 'bg-nb-yellow ring-2 ring-black' : 'bg-white hover:bg-cream'
                  }`}
                >
                  <span className="truncate">{opt}</span>
                  <kbd className="text-[10px] bg-black/10 px-1.5 py-0.5 rounded font-mono font-bold flex-shrink-0">
                    {i + 1}
                  </kbd>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex gap-2 max-w-xl mx-auto">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Nhập tên cấu trúc giải phẫu..."
                autoFocus
                className="nb-input flex-1 px-3 py-2 text-sm rounded-lg"
              />
              <button
                type="button"
                onClick={() => {
                  answeredAtRef.current = Date.now();
                  onAnswerClassify(inputValue);
                }}
                disabled={!inputValue.trim()}
                className="nb-btn px-5 py-2 bg-nb-lime text-xs uppercase font-bold rounded-lg disabled:opacity-50"
              >
                Trả lời (Enter)
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white/80 border-t-2 border-black/30 py-2 px-4 text-center text-xs text-gray-600 font-medium">
          💡 Chạm hoặc nhấp chuột trực tiếp vào cấu trúc đánh dấu trên ảnh để trả lời.
        </div>
      )}
    </div>
  );
}
