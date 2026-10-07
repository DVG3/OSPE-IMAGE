import { useEffect, useRef } from 'react';

export type ShortcutRoute = 'quiz' | 'lamde' | 'workspace';

interface ShortcutItem {
  keys: string;
  action: string;
}

const GROUPS: Record<ShortcutRoute | 'common', { title: string; items: ShortcutItem[] }> = {
  common: {
    title: 'Chung',
    items: [
      { keys: '?', action: 'Mở / đóng bảng phím tắt này' },
      { keys: 'Esc', action: 'Đóng bảng, menu đang mở' },
    ],
  },
  quiz: {
    title: 'Ôn tập (trong lúc thi)',
    items: [
      { keys: 'Enter', action: 'Trả lời / sang câu tiếp theo' },
      { keys: '1 – 4', action: 'Chọn đáp án trắc nghiệm' },
    ],
  },
  lamde: {
    title: 'Tạo đề (chú thích ảnh)',
    items: [
      { keys: 'Ctrl + S', action: 'Lưu ảnh đang chú thích' },
      { keys: 'C', action: 'Đổi tên file ảnh' },
      { keys: 'Space + kéo', action: 'Di chuyển khung nhìn' },
      { keys: 'Lăn chuột', action: 'Zoom tại con trỏ' },
      { keys: 'Delete', action: 'Xóa đối tượng đang chọn' },
      { keys: 'Chuột phải', action: 'Mở menu nhanh tại vị trí' },
    ],
  },
  workspace: {
    title: 'Workspace (chấm giải phẫu)',
    items: [
      { keys: 'D / H / E / V', action: 'Chấm điểm / Tô vùng / Tẩy / Chọn' },
      { keys: 'C', action: 'Đặt tên caption cho điểm đang chọn' },
      { keys: 'Space + kéo', action: 'Di chuyển khung nhìn' },
      { keys: 'Ctrl + Z / Y', action: 'Hoàn tác / làm lại' },
      { keys: 'Ctrl + S', action: 'Lưu workspace' },
    ],
  },
};

interface Props {
  route: ShortcutRoute;
  onClose: () => void;
}

export default function ShortcutsDialog({ route, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const ordered: (ShortcutRoute | 'common')[] = [route, 'common', ...(['quiz', 'lamde', 'workspace'] as const).filter((r) => r !== route)];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Bảng phím tắt"
        onClick={(e) => e.stopPropagation()}
        className="relative bg-white border-[3px] border-black rounded-xl shadow-[8px_8px_0_#000] px-5 py-4 max-w-md w-full max-h-[80vh] overflow-y-auto"
      >
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Đóng bảng phím tắt"
          className="absolute top-2 right-2 w-11 h-11 flex items-center justify-center border-2 border-black rounded-full bg-white font-bold leading-none hover:bg-nb-yellow"
        >
          ×
        </button>
        <p className="font-display text-xl uppercase tracking-wide pr-12">Phím tắt</p>
        <div className="mt-3 space-y-4">
          {ordered.map((key) => (
            <div key={key}>
              <p className="text-xs font-bold uppercase tracking-wider text-gray-600 mb-1.5">
                {GROUPS[key].title}
              </p>
              <dl className="space-y-1.5">
                {GROUPS[key].items.map((item) => (
                  <div key={item.keys + item.action} className="flex items-center gap-2.5 text-sm">
                    <dt className="flex-shrink-0 min-w-24">
                      <kbd className="inline-block font-mono font-bold text-xs bg-gray-100 border-2 border-black rounded px-1.5 py-0.5 whitespace-nowrap">
                        {item.keys}
                      </kbd>
                    </dt>
                    <dd className="font-medium text-gray-800">{item.action}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
