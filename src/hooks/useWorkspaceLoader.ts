import { useState, useCallback } from 'react';
import type { LoadedWorkspace, WorkspaceFile } from '../types/workspace';
import { generateId, getRandomColor } from '../utils/geometry';

interface FoundWorkspace {
  handle: FileSystemDirectoryHandle;
  name: string;
  data: WorkspaceFile;
  imageFiles: Map<string, File>;
}

// Helper to collect all image files inside a directory handle (and subdirs that don't have their own workspace.json)
async function collectImagesInDir(
  dirHandle: FileSystemDirectoryHandle,
  imageFiles: Map<string, File>,
  currentSubPath = ''
) {
  for await (const entry of (dirHandle as unknown as { values: () => AsyncIterable<FileSystemFileHandle | FileSystemDirectoryHandle> }).values()) {
    if (entry.kind === 'file') {
      const fileHandle = entry as FileSystemFileHandle;
      const lower = fileHandle.name.toLowerCase();
      if (
        lower.endsWith('.png') ||
        lower.endsWith('.jpg') ||
        lower.endsWith('.jpeg') ||
        lower.endsWith('.webp')
      ) {
        const file = await fileHandle.getFile();
        const relPath = currentSubPath ? `${currentSubPath}/${fileHandle.name}` : fileHandle.name;
        imageFiles.set(relPath, file);
      }
    } else if (entry.kind === 'directory') {
      const subDir = entry as FileSystemDirectoryHandle;
      // If the subdirectory itself contains a workspace.json, it belongs to its own workspace, so skip collecting it here
      const hasItsOwnWs = await subDir.getFileHandle('workspace.json').then(() => true).catch(() => false);
      if (!hasItsOwnWs) {
        const nextSubPath = currentSubPath ? `${currentSubPath}/${subDir.name}` : subDir.name;
        await collectImagesInDir(subDir, imageFiles, nextSubPath);
      }
    }
  }
}

// Recursive search for all workspace.json files in the directory tree
async function findWorkspacesRecursive(
  dirHandle: FileSystemDirectoryHandle,
  results: FoundWorkspace[]
) {
  let wsFileHandle: FileSystemFileHandle | null = null;
  try {
    wsFileHandle = await dirHandle.getFileHandle('workspace.json');
  } catch {
    wsFileHandle = null;
  }

  if (wsFileHandle) {
    try {
      const file = await wsFileHandle.getFile();
      const text = await file.text();
      const data: WorkspaceFile = JSON.parse(text);
      const imageFiles = new Map<string, File>();
      await collectImagesInDir(dirHandle, imageFiles);

      results.push({
        handle: dirHandle,
        name: dirHandle.name,
        data: {
          workspaceId: data.workspaceId || generateId('ws'),
          name: data.name || dirHandle.name,
          createdAt: data.createdAt || new Date().toISOString(),
          updatedAt: data.updatedAt || new Date().toISOString(),
          images: data.images || {},
        },
        imageFiles,
      });
    } catch (err) {
      console.warn('Failed parsing workspace.json in', dirHandle.name, err);
    }
  }

  // Recurse into subdirectories to find other workspace.json (e.g. multi-workspace folders)
  for await (const entry of (dirHandle as unknown as { values: () => AsyncIterable<FileSystemFileHandle | FileSystemDirectoryHandle> }).values()) {
    if (entry.kind === 'directory') {
      await findWorkspacesRecursive(entry as FileSystemDirectoryHandle, results);
    }
  }
}

export function useWorkspaceLoader() {
  const [workspaces, setWorkspaces] = useState<LoadedWorkspace[]>([]);

  // Add workspace via Directory Picker (with automatic workspace.json discovery & error if missing)
  const addWorkspace = useCallback(async () => {
    if ('showDirectoryPicker' in window) {
      try {
        const dirHandle = await (window as unknown as { showDirectoryPicker: () => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker();
        const foundWorkspaces: FoundWorkspace[] = [];
        await findWorkspacesRecursive(dirHandle, foundWorkspaces);

        if (foundWorkspaces.length === 0) {
          alert('Không tìm thấy file workspace.json nào trong thư mục đã chọn! Vui lòng chọn đúng thư mục chứa Workspace.');
          return;
        }

        const newLoadedList: LoadedWorkspace[] = foundWorkspaces.map((fw) => ({
          handle: fw.handle,
          workspaceId: fw.data.workspaceId,
          name: fw.name,
          color: getRandomColor(),
          visible: true,
          data: fw.data,
          imageFiles: fw.imageFiles,
          isDirty: false,
        }));

        setWorkspaces((prev) => {
          const newIds = new Set(newLoadedList.map((nl) => nl.workspaceId));
          const filtered = prev.filter((w) => !newIds.has(w.workspaceId));
          return [...filtered, ...newLoadedList];
        });
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error('Directory picker error:', err);
          alert('Lỗi khi mở thư mục: ' + String(err));
        }
      }
    }
  }, []);

  // Fallback add workspace via input[webkitdirectory]
  const addWorkspaceFallback = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    // Find all workspace.json files in the uploaded folder tree
    const wsFiles: File[] = [];
    for (let i = 0; i < files.length; i++) {
      if (files[i].name.toLowerCase() === 'workspace.json') {
        wsFiles.push(files[i]);
      }
    }

    if (wsFiles.length === 0) {
      alert('Không tìm thấy file workspace.json nào trong thư mục đã chọn! Vui lòng chọn đúng thư mục chứa Workspace.');
      return;
    }

    const newWorkspaces: LoadedWorkspace[] = [];

    for (const wsFile of wsFiles) {
      try {
        const text = await wsFile.text();
        const data: WorkspaceFile = JSON.parse(text);

        const fullRelPath = wsFile.webkitRelativePath || wsFile.name;
        const parts = fullRelPath.split('/');
        const dirParts = parts.slice(0, -1);
        const dirPrefix = dirParts.join('/');
        const wsFolderName = dirParts.length > 0 ? dirParts[dirParts.length - 1] : 'Workspace';

        // Collect images belonging to this workspace folder
        const imageFiles = new Map<string, File>();
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const lower = file.name.toLowerCase();
          if (
            lower.endsWith('.png') ||
            lower.endsWith('.jpg') ||
            lower.endsWith('.jpeg') ||
            lower.endsWith('.webp')
          ) {
            const fPath = file.webkitRelativePath || file.name;
            if (dirPrefix === '' || fPath.startsWith(dirPrefix + '/')) {
              // Check if file belongs to another deeper workspace.json
              const isDeeperWs = wsFiles.some(
                (otherWs) =>
                  otherWs !== wsFile &&
                  (otherWs.webkitRelativePath || otherWs.name).startsWith(dirPrefix + '/') &&
                  fPath.startsWith((otherWs.webkitRelativePath || otherWs.name).split('/').slice(0, -1).join('/') + '/')
              );
              if (!isDeeperWs) {
                const subRelPath = dirPrefix === '' ? fPath : fPath.substring(dirPrefix.length + 1);
                imageFiles.set(subRelPath, file);
              }
            }
          }
        }

        const wsId = data.workspaceId || generateId('ws');
        const finalData: WorkspaceFile = {
          workspaceId: wsId,
          name: data.name || wsFolderName,
          createdAt: data.createdAt || new Date().toISOString(),
          updatedAt: data.updatedAt || new Date().toISOString(),
          images: data.images || {},
        };

        newWorkspaces.push({
          handle: null,
          workspaceId: wsId,
          name: finalData.name,
          color: getRandomColor(),
          visible: true,
          data: finalData,
          imageFiles,
          isDirty: false,
        });
      } catch (err) {
        console.warn('Error reading fallback workspace.json', err);
      }
    }

    if (newWorkspaces.length === 0) {
      alert('Không thể đọc dữ liệu file workspace.json! Vui lòng kiểm tra định dạng tệp.');
      return;
    }

    setWorkspaces((prev) => {
      const existingIds = new Set(newWorkspaces.map((nw) => nw.workspaceId));
      const filtered = prev.filter((w) => !existingIds.has(w.workspaceId));
      return [...filtered, ...newWorkspaces];
    });
  }, []);

  const removeWorkspace = useCallback((workspaceId: string) => {
    setWorkspaces((prev) => prev.filter((w) => w.workspaceId !== workspaceId));
  }, []);

  const clearWorkspaces = useCallback(() => {
    setWorkspaces([]);
  }, []);

  return {
    workspaces,
    addWorkspace,
    addWorkspaceFallback,
    removeWorkspace,
    clearWorkspaces,
  };
}
