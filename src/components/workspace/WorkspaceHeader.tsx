import { useState, useRef, useEffect } from 'react';
import type { LoadedWorkspace } from '../../types/workspace';

interface WorkspaceHeaderProps {
  workspaces: LoadedWorkspace[];
  currentWorkspaceId: string | null;
  onLoadWorkspace: () => void;
  onSaveWorkspace: () => void;
  onSaveAllWorkspaces: () => void;
  onExportJson: () => void;
  onToggleWorkspaceVisibility: (workspaceId: string) => void;
  onCloseWorkspace: (workspaceId: string) => void;
  isAnyDirty: boolean;
}

export default function WorkspaceHeader({
  workspaces,
  currentWorkspaceId,
  onLoadWorkspace,
  onSaveWorkspace,
  onSaveAllWorkspaces,
  onExportJson,
  onToggleWorkspaceVisibility,
  onCloseWorkspace,
  isAnyDirty,
}: WorkspaceHeaderProps) {
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const [wsMenuOpen, setWsMenuOpen] = useState(false);

  const fileMenuRef = useRef<HTMLDivElement>(null);
  const wsMenuRef = useRef<HTMLDivElement>(null);

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (fileMenuRef.current && !fileMenuRef.current.contains(e.target as Node)) {
        setFileMenuOpen(false);
      }
      if (wsMenuRef.current && !wsMenuRef.current.contains(e.target as Node)) {
        setWsMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeWs = workspaces.find((w) => w.workspaceId === currentWorkspaceId);

  return (
    <header className="bg-white border-b-2 border-black px-3 py-1.5 flex items-center justify-between gap-3 flex-shrink-0 z-20 text-sm">
      <div className="flex items-center gap-2">
        {/* File Menu */}
        <div className="relative" ref={fileMenuRef}>
          <button
            type="button"
            onClick={() => {
              setFileMenuOpen(!fileMenuOpen);
              setWsMenuOpen(false);
            }}
            className={`nb-btn px-2.5 py-1 text-xs rounded-md ${fileMenuOpen ? 'bg-nb-yellow' : ''}`}
          >
            📁 File
          </button>
          {fileMenuOpen && (
            <div className="absolute left-0 top-full mt-1 w-52 bg-white border-2 border-black shadow-[4px_4px_0_#000] rounded-lg py-1 z-50 text-xs font-medium">
              <button
                type="button"
                className="w-full text-left px-3 py-1.5 hover:bg-nb-yellow flex items-center justify-between"
                onClick={() => {
                  setFileMenuOpen(false);
                  onLoadWorkspace();
                }}
              >
                <span>📂 Load Workspace...</span>
              </button>
              <button
                type="button"
                className="w-full text-left px-3 py-1.5 hover:bg-nb-yellow flex items-center justify-between"
                onClick={() => {
                  setFileMenuOpen(false);
                  onSaveWorkspace();
                }}
              >
                <span>💾 Lưu (workspace.json)</span>
                <span className="text-[10px] text-gray-500 font-mono">Ctrl+S</span>
              </button>
              {workspaces.length > 1 && (
                <button
                  type="button"
                  className="w-full text-left px-3 py-1.5 hover:bg-nb-yellow flex items-center justify-between"
                  onClick={() => {
                    setFileMenuOpen(false);
                    onSaveAllWorkspaces();
                  }}
                >
                  <span>💾 Lưu tất cả Workspace</span>
                </button>
              )}
              <hr className="my-1 border-black" />
              <button
                type="button"
                className="w-full text-left px-3 py-1.5 hover:bg-nb-yellow flex items-center justify-between"
                onClick={() => {
                  setFileMenuOpen(false);
                  onExportJson();
                }}
              >
                <span>⬇️ Tải file JSON về máy</span>
              </button>
            </div>
          )}
        </div>

        {/* Workspace List Menu */}
        <div className="relative" ref={wsMenuRef}>
          <button
            type="button"
            onClick={() => {
              setWsMenuOpen(!wsMenuOpen);
              setFileMenuOpen(false);
            }}
            className={`nb-btn px-2.5 py-1 text-xs rounded-md flex items-center gap-1.5 ${
              wsMenuOpen ? 'bg-nb-cyan' : ''
            }`}
          >
            <span>🗂️ Workspaces</span>
            <span className="px-1.5 py-0.2 bg-black text-white rounded-full text-[10px] font-mono">
              {workspaces.length}
            </span>
          </button>
          {wsMenuOpen && (
            <div className="absolute left-0 top-full mt-1 w-64 bg-white border-2 border-black shadow-[4px_4px_0_#000] rounded-lg py-1.5 z-50 text-xs">
              <div className="px-3 py-1 font-bold text-gray-700 border-b border-gray-200">
                <span>Danh sách Workspace</span>
              </div>
              <div className="max-h-60 overflow-y-auto divide-y divide-gray-100">
                {workspaces.length === 0 ? (
                  <div className="p-3 text-gray-500 text-center italic">Chưa có workspace nào được mở</div>
                ) : (
                  workspaces.map((ws) => (
                    <div
                      key={ws.workspaceId}
                      className="px-3 py-1.5 flex items-center justify-between gap-2 hover:bg-gray-50"
                    >
                      <label className="flex items-center gap-2 cursor-pointer truncate flex-1">
                        <input
                          type="checkbox"
                          checked={ws.visible}
                          onChange={() => onToggleWorkspaceVisibility(ws.workspaceId)}
                          className="w-3.5 h-3.5 accent-black rounded cursor-pointer"
                        />
                        <span
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0 border border-black"
                          style={{ backgroundColor: ws.color }}
                        />
                        <span className="truncate font-medium" title={ws.name}>
                          {ws.name}
                        </span>
                        {ws.isDirty && (
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" title="Chưa lưu" />
                        )}
                      </label>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onCloseWorkspace(ws.workspaceId);
                        }}
                        className="p-1 hover:bg-red-100 hover:text-red-600 rounded text-gray-400 font-bold"
                        title="Đóng workspace này"
                      >
                        ✕
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Current Active Workspace Indicator */}
        {activeWs && (
          <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 bg-gray-100 border border-black rounded text-xs">
            <span
              className="w-2 h-2 rounded-full border border-black"
              style={{ backgroundColor: activeWs.color }}
            />
            <span className="font-semibold truncate max-w-[150px]">{activeWs.name}</span>
          </div>
        )}
      </div>

      {/* Right side: Save Status & Quick Save Button */}
      <div className="flex items-center gap-2">
        <span
          className={`text-xs px-2 py-0.5 rounded-md border font-medium ${
            isAnyDirty
              ? 'bg-red-100 text-red-800 border-red-400 animate-pulse'
              : 'bg-green-100 text-green-800 border-green-400'
          }`}
        >
          {isAnyDirty ? '● Chưa lưu' : '✓ Đã lưu'}
        </span>
        <button
          type="button"
          onClick={onSaveWorkspace}
          className="nb-btn px-2.5 py-1 text-xs rounded-md bg-nb-lime"
          title="Lưu workspace hiện tại (Ctrl+S)"
        >
          💾 Lưu
        </button>
      </div>
    </header>
  );
}
