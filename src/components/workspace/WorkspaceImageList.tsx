import { useMemo } from 'react';
import type { LoadedWorkspace } from '../../types/workspace';

export interface ImageListItem {
  workspaceId: string;
  workspaceName: string;
  workspaceColor: string;
  fileName: string;
  file: File;
  objectCount: number;
}

interface WorkspaceImageListProps {
  workspaces: LoadedWorkspace[];
  currentWorkspaceId: string | null;
  currentFileName: string | null;
  onSelectImage: (workspaceId: string, fileName: string) => void;
  onLoadWorkspace: () => void;
}

export default function WorkspaceImageList({
  workspaces,
  currentWorkspaceId,
  currentFileName,
  onSelectImage,
  onLoadWorkspace,
}: WorkspaceImageListProps) {
  // Aggregate images from all visible workspaces
  const allImages = useMemo(() => {
    const list: ImageListItem[] = [];
    const nameCounts: Record<string, number> = {};

    workspaces.forEach((ws) => {
      if (!ws.visible) return;
      ws.imageFiles.forEach((_, fileName) => {
        nameCounts[fileName] = (nameCounts[fileName] || 0) + 1;
      });
    });

    workspaces.forEach((ws) => {
      if (!ws.visible) return;
      ws.imageFiles.forEach((file, fileName) => {
        const imgData = ws.data.images[fileName];
        const count = imgData?.objects?.length || 0;
        list.push({
          workspaceId: ws.workspaceId,
          workspaceName: ws.name,
          workspaceColor: ws.color,
          fileName,
          file,
          objectCount: count,
        });
      });
    });

    return { list, nameCounts };
  }, [workspaces]);

  const { list: images, nameCounts } = allImages;

  return (
    <div className="flex flex-col h-full bg-white border-b border-black select-none">
      <div className="px-3 py-1.5 bg-gray-100 border-b border-black flex items-center justify-between">
        <span className="font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
          <span>🖼️ Danh sách ảnh</span>
          <span className="px-1.5 py-0.2 bg-black text-white rounded-full text-[10px]">
            {images.length}
          </span>
        </span>
        {workspaces.length === 0 && (
          <button
            type="button"
            onClick={onLoadWorkspace}
            className="nb-btn px-2 py-0.5 text-[11px] rounded bg-nb-yellow"
          >
            + Mở thư mục
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1.5 min-h-0">
        {images.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4 text-gray-500 text-xs">
            <p className="mb-2">Chưa có ảnh nào được nạp</p>
            <button
              type="button"
              onClick={onLoadWorkspace}
              className="nb-btn px-3 py-1.5 text-xs rounded bg-nb-yellow"
            >
              📂 Mở thư mục Workspace
            </button>
          </div>
        ) : (
          images.map((item) => {
            const isSelected =
              item.workspaceId === currentWorkspaceId && item.fileName === currentFileName;
            const hasDuplicateName = (nameCounts[item.fileName] || 0) > 1;

            return (
              <button
                type="button"
                key={`${item.workspaceId}_${item.fileName}`}
                onClick={() => onSelectImage(item.workspaceId, item.fileName)}
                className={`w-full text-left p-2 rounded-lg border-2 transition-all flex items-center gap-2 relative overflow-hidden ${
                  isSelected
                    ? 'border-black shadow-[3px_3px_0_#000] ring-2 ring-black'
                    : 'border-black/30 hover:border-black bg-white hover:bg-cream/40'
                }`}
                style={{
                  backgroundColor: isSelected ? undefined : `${item.workspaceColor}18`,
                  borderColor: isSelected ? '#000' : undefined,
                }}
              >
                {/* Workspace Indicator Strip */}
                <div
                  className="w-1.5 self-stretch rounded-full flex-shrink-0"
                  style={{ backgroundColor: item.workspaceColor }}
                />

                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-xs truncate text-gray-900">
                    {item.fileName}
                    {hasDuplicateName && (
                      <span className="text-[10px] text-gray-500 ml-1 font-normal">
                        ({item.workspaceName})
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-[10px] text-gray-500">
                    <span>{item.objectCount} đánh dấu</span>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
