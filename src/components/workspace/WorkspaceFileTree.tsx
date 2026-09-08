import React, { useState, useEffect, useMemo } from 'react';
import type { LoadedWorkspace } from '../../types/workspace';

interface WorkspaceFileTreeProps {
  workspaces: LoadedWorkspace[];
  currentWorkspaceId: string | null;
  currentRelPath: string | null;
  onSelectImage: (workspaceId: string, relPath: string) => void;
}

interface TreeNode {
  name: string;
  relPath: string;
  isFolder: boolean;
  children: Record<string, TreeNode>;
  file?: File;
  objectCount?: number;
}

export default function WorkspaceFileTree({
  workspaces,
  currentWorkspaceId,
  currentRelPath,
  onSelectImage,
}: WorkspaceFileTreeProps) {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());

  // Build tree for each workspace and auto-expand folders on workspace change
  const workspaceTrees = useMemo(() => {
    return workspaces
      .filter((ws) => ws.visible)
      .map((ws) => {
        const root: TreeNode = {
          name: ws.name,
          relPath: '',
          isFolder: true,
          children: {},
        };

        const allFolderPaths: string[] = [`ws_${ws.workspaceId}`];

        ws.imageFiles.forEach((file, relPath) => {
          // Normalize path separators to forward slash
          const normalizedPath = relPath.replace(/\\/g, '/');
          const parts = normalizedPath.split('/').filter(Boolean);

          let current = root;
          let currentFolderPath = `ws_${ws.workspaceId}`;

          for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            const isLast = i === parts.length - 1;

            if (isLast) {
              // File
              const imgData = ws.data.images[normalizedPath] || ws.data.images[relPath];
              current.children[part] = {
                name: part,
                relPath: normalizedPath,
                isFolder: false,
                children: {},
                file,
                objectCount: imgData?.objects?.length || 0,
              };
            } else {
              // Directory
              currentFolderPath += `/${part}`;
              allFolderPaths.push(currentFolderPath);

              if (!current.children[part]) {
                current.children[part] = {
                  name: part,
                  relPath: currentFolderPath,
                  isFolder: true,
                  children: {},
                };
              }
              current = current.children[part];
            }
          }
        });

        return {
          workspace: ws,
          root,
          allFolderPaths,
          imageCount: ws.imageFiles.size,
        };
      });
  }, [workspaces]);

  // Auto-expand all folders on load
  useEffect(() => {
    const allPaths = new Set<string>();
    workspaceTrees.forEach((wt) => {
      wt.allFolderPaths.forEach((p) => allPaths.add(p));
    });
    setExpandedPaths((prev) => new Set([...prev, ...allPaths]));
  }, [workspaceTrees]);

  const toggleExpand = (pathKey: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(pathKey)) {
        next.delete(pathKey);
      } else {
        next.add(pathKey);
      }
      return next;
    });
  };

  // Render a directory node and its children recursively
  const renderTreeNode = (
    node: TreeNode,
    workspaceId: string,
    workspaceColor: string,
    parentPathKey: string,
    depth: number
  ) => {
    const currentPathKey = `${parentPathKey}/${node.name}`;
    const isExpanded = expandedPaths.has(currentPathKey);
    const sortedChildren = Object.values(node.children).sort((a, b) => {
      if (a.isFolder === b.isFolder) return a.name.localeCompare(b.name);
      return a.isFolder ? -1 : 1; // Folders first
    });

    if (node.isFolder) {
      return (
        <div key={currentPathKey} className="flex flex-col">
          <div
            onClick={(e) => toggleExpand(currentPathKey, e)}
            className="flex items-center gap-1.5 py-1 px-1.5 rounded hover:bg-gray-200 cursor-pointer select-none text-xs font-semibold text-gray-800"
            style={{ paddingLeft: `${depth * 14 + 6}px` }}
          >
            <span className="text-[10px] w-3 text-center text-gray-500">
              {isExpanded ? '▼' : '▶'}
            </span>
            <span className="text-sm">{isExpanded ? '📂' : '📁'}</span>
            <span className="truncate">{node.name}</span>
          </div>

          {isExpanded && (
            <div className="flex flex-col">
              {sortedChildren.map((child) =>
                renderTreeNode(child, workspaceId, workspaceColor, currentPathKey, depth + 1)
              )}
            </div>
          )}
        </div>
      );
    }

    // Image File Node
    const isSelected = workspaceId === currentWorkspaceId && node.relPath === currentRelPath;

    return (
      <div
        key={currentPathKey}
        onClick={() => onSelectImage(workspaceId, node.relPath)}
        className={`flex items-center justify-between py-1 px-2 rounded cursor-pointer select-none text-xs transition-all border ${
          isSelected
            ? 'bg-nb-yellow border-black font-bold shadow-[2px_2px_0_#000]'
            : 'border-transparent hover:bg-gray-100 text-gray-700'
        }`}
        style={{ paddingLeft: `${depth * 14 + 18}px` }}
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <span className="text-xs flex-shrink-0">🖼️</span>
          <span className="truncate" title={node.name}>
            {node.name}
          </span>
        </div>

        {node.objectCount !== undefined && node.objectCount > 0 && (
          <span
            className={`text-[10px] px-1.5 py-0.2 rounded-full border flex-shrink-0 font-mono ${
              isSelected ? 'bg-black text-white border-black' : 'bg-gray-200 text-gray-700 border-gray-300'
            }`}
          >
            {node.objectCount}
          </span>
        )}
      </div>
    );
  };

  const totalImageCount = workspaceTrees.reduce((sum, wt) => sum + wt.imageCount, 0);

  return (
    <div className="flex flex-col h-full bg-white border-b border-black select-none">
      {/* Header */}
      <div className="px-3 py-1.5 bg-gray-100 border-b border-black flex items-center justify-between flex-shrink-0">
        <span className="font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
          <span>🌳 Cây thư mục ảnh</span>
          <span className="px-1.5 py-0.2 bg-black text-white rounded-full text-[10px]">
            {totalImageCount}
          </span>
        </span>
      </div>

      {/* Tree Content */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1 min-h-0 text-xs">
        {workspaceTrees.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-4 text-center text-gray-500 text-xs leading-relaxed">
            <span className="text-2xl mb-2">📁</span>
            <p className="font-semibold text-gray-700 mb-1">Chưa có Workspace nào được mở</p>
            <p className="text-gray-500 text-[11px]">
              Vui lòng vào <span className="font-bold text-black">File → Load Workspace...</span> ở thanh menu trên để bắt đầu.
            </p>
          </div>
        ) : (
          workspaceTrees.map(({ workspace, root, imageCount }) => {
            const wsKey = `ws_${workspace.workspaceId}`;
            const isWsExpanded = expandedPaths.has(wsKey);
            const sortedRootChildren = Object.values(root.children).sort((a, b) => {
              if (a.isFolder === b.isFolder) return a.name.localeCompare(b.name);
              return a.isFolder ? -1 : 1;
            });

            return (
              <div
                key={workspace.workspaceId}
                className="border-2 border-black/30 rounded-lg p-1 bg-cream/20 overflow-hidden mb-2"
              >
                {/* Workspace Root Node */}
                <div
                  onClick={(e) => toggleExpand(wsKey, e)}
                  className="flex items-center justify-between p-1 rounded hover:bg-gray-200/80 cursor-pointer font-bold text-xs"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[10px] w-3 text-center text-gray-600">
                      {isWsExpanded ? '▼' : '▶'}
                    </span>
                    <span
                      className="w-2.5 h-2.5 rounded-full border border-black flex-shrink-0"
                      style={{ backgroundColor: workspace.color }}
                    />
                    <span className="truncate text-gray-900" title={workspace.name}>
                      {workspace.name}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono bg-black text-white px-1.5 py-0.2 rounded-full">
                    {imageCount} ảnh
                  </span>
                </div>

                {/* Subfolders and images */}
                {isWsExpanded && (
                  <div className="mt-1 pl-1 space-y-0.5 border-l-2 border-black/15 ml-2">
                    {sortedRootChildren.map((child) =>
                      renderTreeNode(
                        child,
                        workspace.workspaceId,
                        workspace.color,
                        wsKey,
                        0
                      )
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
