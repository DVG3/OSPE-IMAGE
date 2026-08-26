import type { QuizMode } from '../../hooks/useQuizEngine';
import type { FolderData } from '../../hooks/useImageFolders';

interface Props {
  folders: FolderData[];
  onAddFolder: (files: FileList | null) => void;
  onRemoveFolder: (id: number) => void;
  totalCount: number;
  uniqueAnswers: number;
  mode: QuizMode;
  onModeChange: (mode: QuizMode) => void;
  timeText: string;
  onTimeTextChange: (v: string) => void;
  limitText: string;
  onLimitTextChange: (v: string) => void;
  onStart: () => void;
}

function SectionHeader({ step, title }: { step: string; title: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="inline-flex items-center justify-center w-9 h-9 bg-nb-yellow border-2 border-black shadow-[3px_3px_0_#000] font-display text-lg">
        {step}
      </span>
      <h2 className="font-display text-lg sm:text-xl uppercase tracking-wide">{title}</h2>
    </div>
  );
}

export default function SetupScreen({
  folders,
  onAddFolder,
  onRemoveFolder,
  totalCount,
  uniqueAnswers,
  mode,
  onModeChange,
  timeText,
  onTimeTextChange,
  limitText,
  onLimitTextChange,
  onStart,
}: Props) {
  return (
    <div className="flex-1 flex flex-col items-center p-4 sm:p-6 space-y-6 overflow-y-auto">
      <p className="font-medium text-gray-700 text-center sm:text-left">
        Cách dùng web tại đây:{' '}
        <a
          href="https://www.youtube.com/playlist?list=PLu6-ZCM0S2P_-v7mOTdCX9_EpzMUHXEc8"
          target="_blank"
          rel="noopener noreferrer"
          className="font-bold underline decoration-nb-blue decoration-[3px] underline-offset-2 hover:text-nb-blue"
        >
          Hướng dẫn sử dụng
        </a>
      </p>

      <div className="w-full max-w-2xl space-y-4">
        <SectionHeader step="1" title="Chọn dữ liệu ảnh" />

        <div className="border-[3px] border-dashed border-black rounded-lg p-5 text-center cursor-pointer relative bg-white group transition-colors hover:bg-nb-cyan/20">
          <input
            type="file"
            multiple
            {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
            onChange={(e) => {
              onAddFolder(e.target.files);
              e.target.value = '';
            }}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          />
          <div className="flex items-center justify-center gap-3 pointer-events-none">
            <span className="inline-flex items-center justify-center w-10 h-10 bg-nb-yellow border-2 border-black shadow-[2px_2px_0_#000] transition-transform duration-150 group-hover:rotate-90">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </span>
            <span className="font-bold text-gray-800">Thêm thư mục ảnh</span>
          </div>
        </div>

        <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
          {folders.length === 0 ? (
            <p className="text-sm text-gray-400 italic text-center py-2 border-2 border-dashed border-gray-300 rounded-lg">
              Chưa có thư mục nào được chọn
            </p>
          ) : (
            folders.map((folder) => (
              <div key={folder.id} className="nb-card rounded-lg p-3 flex justify-between items-center gap-2">
                <div className="flex items-center gap-2 overflow-hidden">
                  <span className="inline-flex items-center justify-center w-8 h-8 bg-nb-yellow border-2 border-black flex-shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                    </svg>
                  </span>
                  <span className="font-bold truncate text-gray-800" title={folder.name}>
                    {folder.name}
                  </span>
                  <span className="text-xs bg-nb-cyan border-2 border-black font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
                    {folder.files.length} ảnh
                  </span>
                </div>
                <button
                  onClick={() => onRemoveFolder(folder.id)}
                  aria-label={`Xóa ${folder.name}`}
                  className="border-2 border-black bg-white text-nb-red p-1 shadow-[2px_2px_0_#000] transition-all duration-100 hover:bg-nb-red hover:text-white active:translate-x-0.5 active:translate-y-0.5 active:shadow-none flex-shrink-0"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </div>
            ))
          )}
        </div>

        <div className="text-right">
          <span className="text-xs font-bold uppercase tracking-wider text-gray-600">Tổng số ảnh: </span>
          <span className="font-display text-2xl">{totalCount}</span>
        </div>
      </div>

      <hr className="w-full max-w-2xl border-t-2 border-dashed border-black/30" />

      <div className="w-full max-w-2xl space-y-4">
        <SectionHeader step="2" title="Cấu hình thi" />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border-2 border-black rounded-lg p-3 shadow-[3px_3px_0_#000]">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">
              Chế độ thi
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onModeChange('input')}
                className={`flex-1 cursor-pointer border-2 border-black py-2 transition-all duration-100 ${
                  mode === 'input'
                    ? 'bg-nb-blue text-white shadow-[inset_3px_3px_0_rgba(0,0,0,0.3)]'
                    : 'bg-white shadow-[2px_2px_0_#000] hover:-translate-y-0.5 hover:shadow-[4px_4px_0_#000]'
                }`}
              >
                Tự luận
              </button>
              <button
                type="button"
                onClick={() => onModeChange('mcq')}
                className={`flex-1 cursor-pointer border-2 border-black py-2 transition-all duration-100 ${
                  mode === 'mcq'
                    ? 'bg-nb-blue text-white shadow-[inset_3px_3px_0_rgba(0,0,0,0.3)]'
                    : 'bg-white shadow-[2px_2px_0_#000] hover:-translate-y-0.5 hover:shadow-[4px_4px_0_#000]'
                }`}
              >
                Trắc nghiệm
              </button>
            </div>
          </div>

          <div className="bg-white border-2 border-black rounded-lg p-3 shadow-[3px_3px_0_#000]">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">
              Thời gian (giây)
            </label>
            <input
              type="number"
              value={timeText}
              min={5}
              onChange={(e) => onTimeTextChange(e.target.value)}
              className="nb-input w-full text-center"
            />
          </div>

          <div className="bg-white border-2 border-black rounded-lg p-3 shadow-[3px_3px_0_#000]">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">
              Số trạm thi
            </label>
            <input
              type="number"
              value={limitText}
              placeholder={totalCount > 0 ? `Max: ${totalCount}` : 'Tất cả'}
              min={1}
              max={totalCount || undefined}
              disabled={totalCount === 0}
              onChange={(e) => onLimitTextChange(e.target.value)}
              className="nb-input w-full text-center disabled:bg-gray-200 disabled:text-gray-400"
            />
          </div>
        </div>

        {mode === 'mcq' && totalCount > 0 && uniqueAnswers < 4 && (
          <p className="text-sm font-bold text-red-700 bg-nb-red/20 border-2 border-red-600 rounded-lg px-3 py-2">
            ⚠ Dữ liệu chỉ có {uniqueAnswers} đáp án duy nhất — trắc nghiệm cần ít nhất 4 để không
            quá dễ đoán.
          </p>
        )}
      </div>

      <div className="w-full max-w-2xl pt-4">
        <button
          onClick={onStart}
          disabled={totalCount === 0}
          className="w-full bg-nb-lime border-[3px] border-black rounded-lg font-display uppercase tracking-widest text-lg py-4 shadow-[6px_6px_0_#000] transition-all duration-100 hover:-translate-y-0.5 hover:shadow-[8px_8px_0_#000] active:translate-x-1 active:translate-y-1 active:shadow-[1px_1px_0_#000] disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-[6px_6px_0_#000]"
        >
          Vào thi ngay
        </button>
      </div>
    </div>
  );
}
