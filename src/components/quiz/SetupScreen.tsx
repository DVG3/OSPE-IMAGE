import { useRef } from 'react';
import type { QuizMode } from '../../hooks/useQuizEngine';
import type { FolderData } from '../../hooks/useImageFolders';
import type { LoadedWorkspace } from '../../types/workspace';
import type { WorkspaceAnswerType } from '../../hooks/useWorkspaceQuizEngine';

export type QuizSourceType = 'flashcard' | 'workspace';

interface Props {
  sourceType: QuizSourceType;
  onSourceTypeChange: (type: QuizSourceType) => void;

  // Flash Card mode props
  folders: FolderData[];
  onAddFolder: (files: FileList | null) => void;
  onRemoveFolder: (id: number) => void;
  totalCount: number;
  uniqueAnswers: number;
  mode: QuizMode;
  onModeChange: (mode: QuizMode) => void;

  // Workspace mode props
  workspaces: LoadedWorkspace[];
  onAddWorkspace: () => void;
  onAddWorkspaceFallback: (files: FileList | null) => void;
  onRemoveWorkspace: (id: string) => void;
  workspaceQuestionCount: number;
  classifyMode: boolean;
  onClassifyModeChange: (val: boolean) => void;
  identifyMode: boolean;
  onIdentifyModeChange: (val: boolean) => void;
  workspaceAnswerType: WorkspaceAnswerType;
  onWorkspaceAnswerTypeChange: (type: WorkspaceAnswerType) => void;

  // Shared settings
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
  sourceType,
  onSourceTypeChange,
  folders,
  onAddFolder,
  onRemoveFolder,
  totalCount,
  uniqueAnswers,
  mode,
  onModeChange,
  workspaces,
  onAddWorkspace,
  onAddWorkspaceFallback,
  onRemoveWorkspace,
  workspaceQuestionCount,
  classifyMode,
  onClassifyModeChange,
  identifyMode,
  onIdentifyModeChange,
  workspaceAnswerType,
  onWorkspaceAnswerTypeChange,
  timeText,
  onTimeTextChange,
  limitText,
  onLimitTextChange,
  onStart,
}: Props) {
  const wsFallbackInputRef = useRef<HTMLInputElement>(null);

  const hasAtLeastOneMode = classifyMode || identifyMode;
  const isWorkspaceReady = workspaces.length > 0 && workspaceQuestionCount > 0 && hasAtLeastOneMode;
  const isFlashcardReady = totalCount > 0;

  return (
    <div className="flex-1 flex flex-col items-center p-4 sm:p-6 space-y-6 overflow-y-auto">
      {/* Hidden input for workspace fallback folder picker */}
      <input
        type="file"
        ref={wsFallbackInputRef}
        onChange={(e) => {
          onAddWorkspaceFallback(e.target.files);
          e.target.value = '';
        }}
        className="hidden"
        {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
      />

      <p className="font-medium text-gray-700 text-center sm:text-left text-xs sm:text-sm">
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

      {/* Mode Switcher Toggle (Flash Card vs Workspace) */}
      <div className="w-full max-w-md bg-white border-[3px] border-black p-1.5 rounded-xl shadow-[4px_4px_0_#000] flex gap-2">
        <button
          type="button"
          onClick={() => onSourceTypeChange('flashcard')}
          className={`flex-1 py-2 px-3 text-xs sm:text-sm font-bold uppercase tracking-wider rounded-lg border-2 transition-all flex items-center justify-center gap-1.5 ${
            sourceType === 'flashcard'
              ? 'bg-nb-yellow border-black shadow-[2px_2px_0_#000]'
              : 'border-transparent text-gray-600 hover:text-black hover:bg-gray-100'
          }`}
        >
          <span>🃏 Flash Card</span>
        </button>

        <button
          type="button"
          onClick={() => onSourceTypeChange('workspace')}
          className={`flex-1 py-2 px-3 text-xs sm:text-sm font-bold uppercase tracking-wider rounded-lg border-2 transition-all flex items-center justify-center gap-1.5 ${
            sourceType === 'workspace'
              ? 'bg-nb-cyan border-black shadow-[2px_2px_0_#000]'
              : 'border-transparent text-gray-600 hover:text-black hover:bg-gray-100'
          }`}
        >
          <span>🔬 Workspace</span>
          <span className="text-[10px] bg-black text-white px-1.5 py-0.2 rounded font-mono font-normal">
            Exp
          </span>
        </button>
      </div>

      {/* ================= FLASH CARD MODE ================= */}
      {sourceType === 'flashcard' && (
        <>
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
                ⚠ Dữ liệu chỉ có {uniqueAnswers} đáp án duy nhất — trắc nghiệm cần ít nhất 4 để không quá dễ đoán.
              </p>
            )}
          </div>
        </>
      )}

      {/* ================= WORKSPACE MODE (EXPERIMENTAL) ================= */}
      {sourceType === 'workspace' && (
        <>
          <div className="w-full max-w-2xl space-y-4">
            <SectionHeader step="1" title="Chọn Workspace (Experimental)" />

            <div
              onClick={() => {
                if ('showDirectoryPicker' in window) {
                  onAddWorkspace();
                } else {
                  wsFallbackInputRef.current?.click();
                }
              }}
              className="border-[3px] border-dashed border-black rounded-lg p-5 text-center cursor-pointer bg-white group transition-colors hover:bg-nb-cyan/20 relative"
            >
              <div className="flex items-center justify-center gap-3">
                <span className="inline-flex items-center justify-center w-10 h-10 bg-nb-cyan border-2 border-black shadow-[2px_2px_0_#000] transition-transform duration-150 group-hover:rotate-90">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                </span>
                <span className="font-bold text-gray-800">Thêm thư mục Workspace</span>
              </div>
            </div>

            {/* List of loaded workspaces */}
            <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
              {workspaces.length === 0 ? (
                <p className="text-sm text-gray-400 italic text-center py-3 border-2 border-dashed border-gray-300 rounded-lg">
                  Chưa có workspace nào được nạp. Hãy chọn thư mục đã lưu cấu trúc giải phẫu để bắt đầu!
                </p>
              ) : (
                workspaces.map((ws) => {
                  const imageCount = ws.imageFiles.size;
                  let objCount = 0;
                  Object.values(ws.data.images).forEach((d) => {
                    objCount += d.objects?.length || 0;
                  });

                  return (
                    <div key={ws.workspaceId} className="nb-card rounded-lg p-3 flex justify-between items-center gap-2">
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        <span
                          className="w-4 h-4 rounded-full border border-black flex-shrink-0"
                          style={{ backgroundColor: ws.color }}
                        />
                        <span className="font-bold truncate text-gray-800 text-sm" title={ws.name}>
                          {ws.name}
                        </span>
                        <span className="text-[11px] bg-nb-yellow border border-black font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
                          {imageCount} ảnh
                        </span>
                        <span className="text-[11px] bg-nb-cyan border border-black font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
                          {objCount} điểm giải phẫu
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => onRemoveWorkspace(ws.workspaceId)}
                        aria-label={`Gỡ ${ws.name}`}
                        className="border-2 border-black bg-white text-nb-red p-1 shadow-[2px_2px_0_#000] transition-all duration-100 hover:bg-nb-red hover:text-white active:translate-x-0.5 active:translate-y-0.5 active:shadow-none flex-shrink-0"
                        title="Gỡ workspace khỏi danh sách ôn tập"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path
                            fillRule="evenodd"
                            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            <div className="text-right">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-600">
                Tổng số trạm thi có thể tạo:{' '}
              </span>
              <span className="font-display text-2xl text-nb-blue">{workspaceQuestionCount}</span>
            </div>
          </div>

          <hr className="w-full max-w-2xl border-t-2 border-dashed border-black/30" />

          <div className="w-full max-w-2xl space-y-4">
            <SectionHeader step="2" title="Cấu hình thi Workspace" />

            {/* Checkbox for Quiz Modes */}
            <div className="bg-white border-2 border-black rounded-lg p-3.5 shadow-[3px_3px_0_#000] space-y-2.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
                Chế độ làm bài (Mode làm bài)
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <label className="flex items-start gap-2.5 p-2 rounded-lg border-2 border-black/40 hover:border-black cursor-pointer transition-all bg-cream/30 hover:bg-cream">
                  <input
                    type="checkbox"
                    checked={classifyMode}
                    onChange={(e) => onClassifyModeChange(e.target.checked)}
                    className="w-4 h-4 mt-0.5 accent-black cursor-pointer"
                  />
                  <div className="text-xs">
                    <p className="font-bold text-gray-900">🏹 Phân loại cấu trúc</p>
                    <p className="text-[11px] text-gray-600 mt-0.5">
                      Vẽ mũi tên chỉ vào điểm/vùng giải phẫu, người học điền tên hoặc chọn trắc nghiệm.
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 p-2 rounded-lg border-2 border-black/40 hover:border-black cursor-pointer transition-all bg-cream/30 hover:bg-cream">
                  <input
                    type="checkbox"
                    checked={identifyMode}
                    onChange={(e) => onIdentifyModeChange(e.target.checked)}
                    className="w-4 h-4 mt-0.5 accent-black cursor-pointer"
                  />
                  <div className="text-xs">
                    <p className="font-bold text-gray-900">🎯 Chọn cấu trúc</p>
                    <p className="text-[11px] text-gray-600 mt-0.5">
                      Đưa tên cấu trúc, người học chạm/click trực tiếp vào vị trí giải phẫu trên ảnh.
                    </p>
                  </div>
                </label>
              </div>

              {!hasAtLeastOneMode && (
                <div className="bg-nb-pink border-2 border-black p-2 rounded text-xs font-bold text-red-900">
                  ⚠ Vui lòng chọn ít nhất 1 chế độ làm bài (Phân loại cấu trúc hoặc Chọn cấu trúc) mới có thể vào thi!
                </div>
              )}
            </div>

            {/* Answer format, Timer & Station limit */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white border-2 border-black rounded-lg p-3 shadow-[3px_3px_0_#000]">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">
                  Hình thức (Phân loại)
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={!classifyMode}
                    onClick={() => onWorkspaceAnswerTypeChange('input')}
                    className={`flex-1 cursor-pointer border-2 border-black py-2 text-xs transition-all duration-100 disabled:opacity-40 ${
                      workspaceAnswerType === 'input'
                        ? 'bg-nb-blue text-white shadow-[inset_3px_3px_0_rgba(0,0,0,0.3)]'
                        : 'bg-white shadow-[2px_2px_0_#000] hover:-translate-y-0.5 hover:shadow-[4px_4px_0_#000]'
                    }`}
                  >
                    Tự luận
                  </button>
                  <button
                    type="button"
                    disabled={!classifyMode}
                    onClick={() => onWorkspaceAnswerTypeChange('mcq')}
                    className={`flex-1 cursor-pointer border-2 border-black py-2 text-xs transition-all duration-100 disabled:opacity-40 ${
                      workspaceAnswerType === 'mcq'
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
                  placeholder={workspaceQuestionCount > 0 ? `Max: ${workspaceQuestionCount}` : 'Tất cả'}
                  min={1}
                  max={workspaceQuestionCount || undefined}
                  disabled={workspaceQuestionCount === 0}
                  onChange={(e) => onLimitTextChange(e.target.value)}
                  className="nb-input w-full text-center disabled:bg-gray-200 disabled:text-gray-400"
                />
              </div>
            </div>
          </div>
        </>
      )}

      {/* Start Button */}
      <div className="w-full max-w-2xl pt-4">
        <button
          onClick={onStart}
          disabled={sourceType === 'flashcard' ? !isFlashcardReady : !isWorkspaceReady}
          className="w-full bg-nb-lime border-[3px] border-black rounded-lg font-display uppercase tracking-widest text-lg py-4 shadow-[6px_6px_0_#000] transition-all duration-100 hover:-translate-y-0.5 hover:shadow-[8px_8px_0_#000] active:translate-x-1 active:translate-y-1 active:shadow-[1px_1px_0_#000] disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-[6px_6px_0_#000]"
        >
          Vào thi ngay
        </button>
      </div>
    </div>
  );
}
