import type {
  ActiveTool,
  ReviewDisplayMode,
  WorkspaceMode,
} from '../../types/workspace';

interface WorkspaceToolsProps {
  mode: WorkspaceMode;
  activeTool: ActiveTool;
  onChangeActiveTool: (tool: ActiveTool) => void;
  color: string;
  onChangeColor: (color: string) => void;
  brushSize: number;
  onChangeBrushSize: (size: number) => void;
  eraserSize: number;
  onChangeEraserSize: (size: number) => void;
  dotRadius: number;
  onChangeDotRadius: (radius: number) => void;
  reviewDisplayMode: ReviewDisplayMode;
  onChangeReviewDisplayMode: (mode: ReviewDisplayMode) => void;
  reviewFontSize: number;
  onChangeReviewFontSize: (size: number) => void;
}

const PRESET_COLORS = [
  '#ff0000', // Đỏ
  '#f59e0b', // Vàng cam
  '#10b981', // Xanh lá
  '#06b6d4', // Xanh ngọc
  '#3b82f6', // Xanh dương
  '#8b5cf6', // Tím
  '#ec4899', // Hồng
];

export default function WorkspaceTools({
  mode,
  activeTool,
  onChangeActiveTool,
  color,
  onChangeColor,
  brushSize,
  onChangeBrushSize,
  eraserSize,
  onChangeEraserSize,
  dotRadius,
  onChangeDotRadius,
  reviewDisplayMode,
  onChangeReviewDisplayMode,
  reviewFontSize,
  onChangeReviewFontSize,
}: WorkspaceToolsProps) {
  if (mode === 'review') {
    return (
      <div className="p-3 bg-cream flex flex-col gap-3 h-full overflow-y-auto select-none">
        <div className="font-bold text-xs uppercase tracking-wider text-gray-700 flex items-center gap-1">
          <span>👁️ Chế độ hiển thị (Review)</span>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-gray-700">Tùy chọn hiển thị:</label>
          <select
            value={reviewDisplayMode}
            onChange={(e) => onChangeReviewDisplayMode(e.target.value as ReviewDisplayMode)}
            className="nb-input py-1.5 text-xs rounded-md cursor-pointer"
          >
            <option value="markers_only">📍 Chỉ hiện đánh dấu</option>
            <option value="show_numbers">🔢 Hiện số (theo Caption)</option>
            <option value="show_captions">🏷️ Hiện Caption</option>
          </select>
        </div>

        {reviewDisplayMode !== 'markers_only' && (
          <div className="flex flex-col gap-1.5 bg-white p-2.5 rounded-lg border-2 border-black">
            <div className="flex justify-between items-center text-xs font-semibold">
              <span>Cỡ chữ (Font Size):</span>
              <span className="font-mono bg-nb-yellow px-1.5 rounded">{reviewFontSize}px</span>
            </div>
            <input
              type="range"
              min="10"
              max="48"
              step="1"
              value={reviewFontSize}
              onChange={(e) => onChangeReviewFontSize(Number(e.target.value))}
              className="w-full accent-black cursor-pointer"
            />
          </div>
        )}

        <div className="mt-auto bg-white/80 p-2.5 rounded-lg border border-black/30 text-[11px] text-gray-600 leading-relaxed">
          <p className="font-bold text-black mb-1">💡 Mẹo xem lại:</p>
          <p>• Nhấp vào điểm đánh dấu trên ảnh hoặc ở bảng Layers để viền phát sáng (Glow) vị trí cần học.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 bg-cream flex flex-col gap-3 h-full overflow-y-auto select-none">
      <div className="font-bold text-xs uppercase tracking-wider text-gray-700">
        🛠️ Công cụ vẽ (Edit)
      </div>

      {/* Tool Selector Buttons */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onChangeActiveTool('dot')}
          className={`tool-btn py-2 text-xs flex items-center justify-center gap-1.5 ${
            activeTool === 'dot' ? 'bg-nb-yellow ring-2 ring-black font-bold' : ''
          }`}
          title="Thêm điểm đánh dấu kèm vòng biên tròn (Phím D)"
        >
          <span>🎯 Dot</span>
          <kbd className="text-[10px] bg-black/10 px-1 rounded">D</kbd>
        </button>

        <button
          type="button"
          onClick={() => onChangeActiveTool('highlight')}
          className={`tool-btn py-2 text-xs flex items-center justify-center gap-1.5 ${
            activeTool === 'highlight' ? 'bg-nb-yellow ring-2 ring-black font-bold' : ''
          }`}
          title="Tô dạ quang nổi bật (Phím H)"
        >
          <span>🖍️ Highlight</span>
          <kbd className="text-[10px] bg-black/10 px-1 rounded">H</kbd>
        </button>

        <button
          type="button"
          onClick={() => onChangeActiveTool('eraser')}
          className={`tool-btn py-2 text-xs flex items-center justify-center gap-1.5 ${
            activeTool === 'eraser' ? 'bg-nb-yellow ring-2 ring-black font-bold' : ''
          }`}
          title="Gôm xóa nét vẽ (Phím E)"
        >
          <span>🧹 Eraser</span>
          <kbd className="text-[10px] bg-black/10 px-1 rounded">E</kbd>
        </button>

        <button
          type="button"
          onClick={() => onChangeActiveTool('select')}
          className={`tool-btn py-2 text-xs flex items-center justify-center gap-1.5 ${
            activeTool === 'select' ? 'bg-nb-yellow ring-2 ring-black font-bold' : ''
          }`}
          title="Chọn / Di chuyển đối tượng (Phím V)"
        >
          <span>👆 Chọn / Pan</span>
          <kbd className="text-[10px] bg-black/10 px-1 rounded">V</kbd>
        </button>
      </div>

      {/* Tool-specific Settings */}
      {activeTool === 'dot' && (
        <div className="bg-white p-2.5 rounded-lg border-2 border-black flex flex-col gap-2">
          <div className="flex justify-between items-center text-xs font-semibold">
            <span>Bán kính biên:</span>
            <span className="font-mono bg-nb-cyan px-1.5 rounded">{dotRadius}px</span>
          </div>
          <input
            type="range"
            min="10"
            max="120"
            value={dotRadius}
            onChange={(e) => onChangeDotRadius(Number(e.target.value))}
            className="w-full accent-black cursor-pointer"
          />
          <p className="text-[10px] text-gray-500 italic">
            * Có thể cuộn chuột để phóng to/thu nhỏ bán kính khi đang chọn Dot.
          </p>
        </div>
      )}

      {activeTool === 'highlight' && (
        <div className="bg-white p-2.5 rounded-lg border-2 border-black flex flex-col gap-2">
          <div className="flex justify-between items-center text-xs font-semibold">
            <span>Đầu bút highlight:</span>
            <span className="font-mono bg-nb-cyan px-1.5 rounded">{brushSize}px</span>
          </div>
          <input
            type="range"
            min="5"
            max="500"
            value={brushSize}
            onChange={(e) => onChangeBrushSize(Number(e.target.value))}
            className="w-full accent-black cursor-pointer"
          />
          <div className="flex flex-col gap-1.5 pt-1">
            <span className="text-xs font-semibold">Màu sắc:</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {PRESET_COLORS.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => onChangeColor(c)}
                  className={`w-5 h-5 rounded-full border border-black cursor-pointer transition-transform ${
                    color === c ? 'scale-125 ring-2 ring-black' : 'hover:scale-110'
                  }`}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
              <input
                type="color"
                value={color}
                onChange={(e) => onChangeColor(e.target.value)}
                className="w-6 h-6 rounded cursor-pointer border border-black"
                title="Chọn màu tùy ý"
              />
            </div>
          </div>
          <p className="text-[10px] text-gray-500 italic">
            * Có thể cuộn chuột lên/xuống để tăng giảm cỡ nét vẽ.
          </p>
        </div>
      )}

      {activeTool === 'eraser' && (
        <div className="bg-white p-2.5 rounded-lg border-2 border-black flex flex-col gap-2">
          <div className="flex justify-between items-center text-xs font-semibold">
            <span>Kích thước gôm:</span>
            <span className="font-mono bg-nb-cyan px-1.5 rounded">{eraserSize}px</span>
          </div>
          <input
            type="range"
            min="10"
            max="80"
            value={eraserSize}
            onChange={(e) => onChangeEraserSize(Number(e.target.value))}
            className="w-full accent-black cursor-pointer"
          />
          <p className="text-[10px] text-gray-500 italic">
            * Xóa vector trực tiếp (cắt đoạn nét highlight hoặc xóa dot khi quét qua).
          </p>
        </div>
      )}

      {/* Shortcuts Guide */}
      <div className="mt-auto bg-white/70 p-2 rounded-lg border border-black/30 text-[11px] text-gray-600">
        <p className="font-bold text-black mb-1">⌨️ Phím tắt hữu ích:</p>
        <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
          <span><kbd className="font-mono bg-gray-200 px-1 rounded">C</kbd> Đặt Caption</span>
          <span><kbd className="font-mono bg-gray-200 px-1 rounded">Space</kbd> Kéo Pan</span>
          <span><kbd className="font-mono bg-gray-200 px-1 rounded">Ctrl+Z</kbd> Hoàn tác</span>
          <span><kbd className="font-mono bg-gray-200 px-1 rounded">Ctrl+S</kbd> Lưu tệp</span>
        </div>
      </div>
    </div>
  );
}
