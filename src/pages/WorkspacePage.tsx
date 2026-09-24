import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import NavBar from '../components/NavBar';
import WorkspaceHeader from '../components/workspace/WorkspaceHeader';
import ResizableLayout from '../components/workspace/ResizablePanels';
import WorkspaceFileTree from '../components/workspace/WorkspaceFileTree';
import WorkspaceTools from '../components/workspace/WorkspaceTools';
import WorkspaceCanvas from '../components/workspace/WorkspaceCanvas';
import WorkspaceLayers from '../components/workspace/WorkspaceLayers';
import type {
  ActiveTool,
  ImageAnnotationData,
  LoadedWorkspace,
  ReviewDisplayMode,
  SelectedLayerItem,
  WorkspaceFile,
  WorkspaceMode,
} from '../types/workspace';
import { generateId, getRandomColor } from '../utils/geometry';

const MAX_UNDO_STACK = 30;

const DEFAULT_ANNOTATION: ImageAnnotationData = {
  groups: [],
  captions: [],
  objects: [],
};

export default function WorkspacePage() {
  const [searchParams] = useSearchParams();
  const modeParam = searchParams.get('mode');
  const mode: WorkspaceMode = modeParam === 'review' ? 'review' : 'edit';

  // Workspaces state
  const [workspaces, setWorkspaces] = useState<LoadedWorkspace[]>([]);
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(null);
  const [currentRelPath, setCurrentRelPath] = useState<string | null>(null);

  // Tools state (Edit mode)
  const [activeTool, setActiveTool] = useState<ActiveTool>('dot');
  const [color, setColor] = useState('#ff0000');
  const [brushSize, setBrushSize] = useState(20);
  const [eraserSize, setEraserSize] = useState(30);
  const [dotRadius, setDotRadius] = useState(35);
  const [globalDotOpacity, setGlobalDotOpacity] = useState(100);

  // Review mode display options
  const [reviewDisplayMode, setReviewDisplayMode] = useState<ReviewDisplayMode>('markers_only');
  const [reviewFontSize, setReviewFontSize] = useState(16);

  // Selection & quick caption
  const [selectedItems, setSelectedItems] = useState<SelectedLayerItem[]>([]);
  const [quickCaptionOpen, setQuickCaptionOpen] = useState(false);
  const [initialQuickCaptionChar, setInitialQuickCaptionChar] = useState('');
  const justCreatedObjIdRef = useRef<string | null>(null);

  const handleOpenQuickCaption = useCallback((char?: string) => {
    setInitialQuickCaptionChar(char || '');
    setQuickCaptionOpen(true);
  }, []);

  const handleObjectCreated = useCallback((objId: string) => {
    justCreatedObjIdRef.current = objId;
  }, []);

  // Undo / Redo history for active image
  const undoStackRef = useRef<Record<string, ImageAnnotationData[]>>({});
  const redoStackRef = useRef<Record<string, ImageAnnotationData[]>>({});
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Fallback hidden input for folder upload
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Get active workspace and current image
  const currentWorkspace = useMemo(
    () => workspaces.find((w) => w.workspaceId === currentWorkspaceId) ?? null,
    [workspaces, currentWorkspaceId]
  );

  const currentImageFile = useMemo(() => {
    if (!currentWorkspace || !currentRelPath) return null;
    return currentWorkspace.imageFiles.get(currentRelPath) ?? null;
  }, [currentWorkspace, currentRelPath]);

  const currentAnnotationData: ImageAnnotationData = useMemo(() => {
    if (!currentWorkspace || !currentRelPath) return DEFAULT_ANNOTATION;
    return currentWorkspace.data.images[currentRelPath] ?? DEFAULT_ANNOTATION;
  }, [currentWorkspace, currentRelPath]);

  // Aggregate all captions in all workspaces for autocomplete
  const allWorkspaceCaptions = useMemo(() => {
    const set = new Set<string>();
    workspaces.forEach((ws) => {
      Object.values(ws.data.images).forEach((imgData) => {
        imgData.captions?.forEach((c) => {
          if (c.name.trim()) set.add(c.name.trim());
        });
      });
    });
    return Array.from(set);
  }, [workspaces]);

  const isAnyDirty = useMemo(() => workspaces.some((w) => w.isDirty), [workspaces]);

  // Warn before closing/reloading if dirty
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isAnyDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isAnyDirty]);

  // Update undo/redo availability
  const updateUndoRedoState = useCallback((key: string) => {
    const uStack = undoStackRef.current[key] || [];
    const rStack = redoStackRef.current[key] || [];
    setCanUndo(uStack.length > 0);
    setCanRedo(rStack.length > 0);
  }, []);

  // Update annotation with undo snapshot
  const handleUpdateAnnotation = useCallback(
    (newData: ImageAnnotationData, pushUndo = true) => {
      if (!currentWorkspaceId || !currentRelPath) return;

      const historyKey = `${currentWorkspaceId}_${currentRelPath}`;

      if (pushUndo) {
        const uStack = undoStackRef.current[historyKey] || [];
        uStack.push(currentAnnotationData);
        if (uStack.length > MAX_UNDO_STACK) uStack.shift();
        undoStackRef.current[historyKey] = uStack;
        // Clear redo stack on new action
        redoStackRef.current[historyKey] = [];
        updateUndoRedoState(historyKey);
      }

      setWorkspaces((prev) =>
        prev.map((ws) => {
          if (ws.workspaceId !== currentWorkspaceId) return ws;
          return {
            ...ws,
            isDirty: true,
            data: {
              ...ws.data,
              updatedAt: new Date().toISOString(),
              images: {
                ...ws.data.images,
                [currentRelPath]: newData,
              },
            },
          };
        })
      );
    },
    [currentWorkspaceId, currentRelPath, currentAnnotationData, updateUndoRedoState]
  );

  // Undo
  const handleUndo = useCallback(() => {
    if (!currentWorkspaceId || !currentRelPath) return;
    const historyKey = `${currentWorkspaceId}_${currentRelPath}`;
    const uStack = undoStackRef.current[historyKey] || [];
    if (uStack.length === 0) return;

    const prevSnapshot = uStack.pop()!;
    const rStack = redoStackRef.current[historyKey] || [];
    rStack.push(currentAnnotationData);
    redoStackRef.current[historyKey] = rStack;

    handleUpdateAnnotation(prevSnapshot, false);
    updateUndoRedoState(historyKey);
  }, [currentWorkspaceId, currentRelPath, currentAnnotationData, handleUpdateAnnotation, updateUndoRedoState]);

  // Redo
  const handleRedo = useCallback(() => {
    if (!currentWorkspaceId || !currentRelPath) return;
    const historyKey = `${currentWorkspaceId}_${currentRelPath}`;
    const rStack = redoStackRef.current[historyKey] || [];
    if (rStack.length === 0) return;

    const nextSnapshot = rStack.pop()!;
    const uStack = undoStackRef.current[historyKey] || [];
    uStack.push(currentAnnotationData);
    undoStackRef.current[historyKey] = uStack;

    handleUpdateAnnotation(nextSnapshot, false);
    updateUndoRedoState(historyKey);
  }, [currentWorkspaceId, currentRelPath, currentAnnotationData, handleUpdateAnnotation, updateUndoRedoState]);

  // Save current workspace to workspace.json
  const handleSaveWorkspace = useCallback(async () => {
    if (!currentWorkspace) return;
    try {
      if (currentWorkspace.handle) {
        const fileHandle = await currentWorkspace.handle.getFileHandle('workspace.json', {
          create: true,
        });
        const writable = await fileHandle.createWritable();
        const jsonString = JSON.stringify(currentWorkspace.data, null, 2);
        await writable.write(new Blob([jsonString], { type: 'application/json' }));
        await writable.close();

        setWorkspaces((prev) =>
          prev.map((w) => (w.workspaceId === currentWorkspace.workspaceId ? { ...w, isDirty: false } : w))
        );
      } else {
        // Fallback: download workspace.json
        const blob = new Blob([JSON.stringify(currentWorkspace.data, null, 2)], {
          type: 'application/json',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'workspace.json';
        a.click();
        URL.revokeObjectURL(url);

        setWorkspaces((prev) =>
          prev.map((w) => (w.workspaceId === currentWorkspace.workspaceId ? { ...w, isDirty: false } : w))
        );
      }
    } catch (err) {
      console.error('Error saving workspace:', err);
      alert('Không thể lưu file workspace.json: ' + String(err));
    }
  }, [currentWorkspace]);

  // Save all workspaces
  const handleSaveAllWorkspaces = useCallback(async () => {
    for (const ws of workspaces) {
      if (!ws.isDirty) continue;
      try {
        if (ws.handle) {
          const fileHandle = await ws.handle.getFileHandle('workspace.json', { create: true });
          const writable = await fileHandle.createWritable();
          await writable.write(new Blob([JSON.stringify(ws.data, null, 2)], { type: 'application/json' }));
          await writable.close();
        }
      } catch (err) {
        console.error('Error saving workspace', ws.name, err);
      }
    }
    setWorkspaces((prev) => prev.map((w) => ({ ...w, isDirty: false })));
  }, [workspaces]);

  // Export JSON fallback
  const handleExportJson = useCallback(() => {
    if (!currentWorkspace) return;
    const blob = new Blob([JSON.stringify(currentWorkspace.data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentWorkspace.name}_workspace.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [currentWorkspace]);

  // Hotkey listener (D, H, E, V, C, Space, Ctrl+Z, Ctrl+Y, Ctrl+S)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const targetTag = (e.target as HTMLElement).tagName;
      if (targetTag === 'INPUT' || targetTag === 'TEXTAREA' || targetTag === 'SELECT') {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSaveWorkspace();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
        return;
      }

      if (mode === 'edit') {
        const hasSelectedObject = selectedItems.some((s) => s.type === 'object');

        // Shortcut 'C' always opens quick caption for selected object
        if (e.key.toLowerCase() === 'c') {
          if (hasSelectedObject) {
            e.preventDefault();
            justCreatedObjIdRef.current = null;
            handleOpenQuickCaption('');
          }
          return;
        }

        // Tool hotkeys (D, H, E, V): ALWAYS switch tool and reset fresh-object state
        const toolKeyMap: Record<string, ActiveTool> = {
          d: 'dot',
          h: 'highlight',
          e: 'eraser',
          v: 'select',
        };
        const pressedTool = toolKeyMap[e.key.toLowerCase()];

        if (pressedTool && !e.ctrlKey && !e.altKey && !e.metaKey) {
          e.preventDefault();
          justCreatedObjIdRef.current = null;
          setActiveTool(pressedTool);
          return;
        }

        // Type-to-Caption ONLY for freshly created object (first keystroke right after creation)
        const isFreshlyCreated =
          justCreatedObjIdRef.current &&
          selectedItems.some((s) => s.type === 'object' && s.id === justCreatedObjIdRef.current);

        if (isFreshlyCreated && e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey && e.key !== ' ') {
          e.preventDefault();
          justCreatedObjIdRef.current = null;
          handleOpenQuickCaption(e.key);
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSaveWorkspace, handleUndo, handleRedo, selectedItems, mode, handleOpenQuickCaption]);

  interface FoundWs {
    handle: FileSystemDirectoryHandle;
    name: string;
    data: WorkspaceFile;
    imageFiles: Map<string, File>;
  }

  // Collect image files inside a directory handle (excluding subdirectories that contain their own workspace.json)
  const collectImagesInDirHandle = async (
    dirHandle: FileSystemDirectoryHandle,
    imageFiles: Map<string, File>,
    currentSubPath = ''
  ) => {
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
        const hasItsOwnWs = await subDir.getFileHandle('workspace.json').then(() => true).catch(() => false);
        if (!hasItsOwnWs) {
          const nextSubPath = currentSubPath ? `${currentSubPath}/${subDir.name}` : subDir.name;
          await collectImagesInDirHandle(subDir, imageFiles, nextSubPath);
        }
      }
    }
  };

  // Find all workspace.json files recursively
  const findWorkspacesRecursive = async (
    dirHandle: FileSystemDirectoryHandle,
    results: FoundWs[]
  ) => {
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
        await collectImagesInDirHandle(dirHandle, imageFiles);

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

    for await (const entry of (dirHandle as unknown as { values: () => AsyncIterable<FileSystemFileHandle | FileSystemDirectoryHandle> }).values()) {
      if (entry.kind === 'directory') {
        await findWorkspacesRecursive(entry as FileSystemDirectoryHandle, results);
      }
    }
  };

  // Load workspace via File System Access API or input fallback
  const handleLoadWorkspace = async () => {
    if ('showDirectoryPicker' in window) {
      try {
        const dirHandle = await (window as unknown as { showDirectoryPicker: () => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker();
        const foundWorkspaces: FoundWs[] = [];
        await findWorkspacesRecursive(dirHandle, foundWorkspaces);

        if (foundWorkspaces.length > 0) {
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

          // Focus first loaded workspace
          const firstWs = newLoadedList[0];
          setCurrentWorkspaceId(firstWs.workspaceId);
          const firstImgPath = Array.from(firstWs.imageFiles.keys())[0];
          if (firstImgPath) {
            setCurrentRelPath(firstImgPath);
          }
        } else {
          // No workspace.json found: ask user to initialize a new workspace
          const confirmCreate = window.confirm(
            `Không tìm thấy file workspace.json nào trong thư mục "${dirHandle.name}".\n\nBạn có muốn khởi tạo một Workspace mới cho thư mục ảnh này không?`
          );
          if (!confirmCreate) return;

          const imageFiles = new Map<string, File>();
          await collectImagesInDirHandle(dirHandle, imageFiles);

          const wsId = generateId('ws');
          const wsName = dirHandle.name;
          const finalData: WorkspaceFile = {
            workspaceId: wsId,
            name: wsName,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            images: {},
          };

          try {
            const fileHandle = await dirHandle.getFileHandle('workspace.json', { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(new Blob([JSON.stringify(finalData, null, 2)], { type: 'application/json' }));
            await writable.close();
          } catch (createErr) {
            console.warn('Could not auto-create workspace.json on disk', createErr);
          }

          const newWs: LoadedWorkspace = {
            handle: dirHandle,
            workspaceId: wsId,
            name: wsName,
            color: getRandomColor(),
            visible: true,
            data: finalData,
            imageFiles,
            isDirty: false,
          };

          setWorkspaces((prev) => [...prev, newWs]);
          setCurrentWorkspaceId(wsId);
          const firstImgPath = Array.from(imageFiles.keys())[0];
          if (firstImgPath) {
            setCurrentRelPath(firstImgPath);
          }
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error('Directory picker error:', err);
        }
      }
    } else {
      // Fallback
      if (folderInputRef.current) {
        folderInputRef.current.click();
      }
    }
  };

  // Fallback directory upload handler
  const handleFallbackFolderChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Find all workspace.json files in the uploaded folder tree
    const wsFiles: File[] = [];
    for (let i = 0; i < files.length; i++) {
      if (files[i].name.toLowerCase() === 'workspace.json') {
        wsFiles.push(files[i]);
      }
    }

    if (wsFiles.length > 0) {
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

      if (newWorkspaces.length > 0) {
        setWorkspaces((prev) => {
          const newIds = new Set(newWorkspaces.map((nw) => nw.workspaceId));
          const filtered = prev.filter((w) => !newIds.has(w.workspaceId));
          return [...filtered, ...newWorkspaces];
        });

        setCurrentWorkspaceId(newWorkspaces[0].workspaceId);
        const firstImg = Array.from(newWorkspaces[0].imageFiles.keys())[0];
        if (firstImg) {
          setCurrentRelPath(firstImg);
        }
      }
    } else {
      // No workspace.json: ask to create
      const confirmCreate = window.confirm(
        'Không tìm thấy file workspace.json nào trong thư mục đã tải lên. Bạn có muốn tạo Workspace mới cho các ảnh này không?'
      );
      if (!confirmCreate) return;

      const imageFiles = new Map<string, File>();
      let folderName = 'Workspace';

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const lower = file.name.toLowerCase();
        let relPath = file.name;
        if (file.webkitRelativePath) {
          const parts = file.webkitRelativePath.split('/');
          if (parts.length > 1) {
            folderName = parts[0];
            relPath = parts.slice(1).join('/');
          }
        }
        if (
          lower.endsWith('.png') ||
          lower.endsWith('.jpg') ||
          lower.endsWith('.jpeg') ||
          lower.endsWith('.webp')
        ) {
          imageFiles.set(relPath, file);
        }
      }

      const wsId = generateId('ws');
      const finalData: WorkspaceFile = {
        workspaceId: wsId,
        name: folderName,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        images: {},
      };

      const newLoadedWorkspace: LoadedWorkspace = {
        handle: null,
        workspaceId: wsId,
        name: folderName,
        color: getRandomColor(),
        visible: true,
        data: finalData,
        imageFiles,
        isDirty: false,
      };

      setWorkspaces((prev) => [...prev, newLoadedWorkspace]);
      setCurrentWorkspaceId(wsId);
      const firstImgPath = Array.from(imageFiles.keys())[0];
      if (firstImgPath) {
        setCurrentRelPath(firstImgPath);
      }
    }
  };

  // Workspace visibility toggle
  const handleToggleWorkspaceVisibility = (workspaceId: string) => {
    setWorkspaces((prev) =>
      prev.map((w) => (w.workspaceId === workspaceId ? { ...w, visible: !w.visible } : w))
    );
  };

  // Close workspace
  const handleCloseWorkspace = (workspaceId: string) => {
    const ws = workspaces.find((w) => w.workspaceId === workspaceId);
    if (ws?.isDirty) {
      const confirmClose = window.confirm(
        `Workspace "${ws.name}" có thay đổi chưa lưu. Bạn có chắc muốn đóng không?`
      );
      if (!confirmClose) return;
    }

    setWorkspaces((prev) => prev.filter((w) => w.workspaceId !== workspaceId));
    if (currentWorkspaceId === workspaceId) {
      const remaining = workspaces.filter((w) => w.workspaceId !== workspaceId);
      if (remaining.length > 0) {
        setCurrentWorkspaceId(remaining[0].workspaceId);
        const firstImg = Array.from(remaining[0].imageFiles.keys())[0];
        setCurrentRelPath(firstImg || null);
      } else {
        setCurrentWorkspaceId(null);
        setCurrentRelPath(null);
      }
    }
  };

  // Rename image
  const handleRenameImage = useCallback(
    async (workspaceId: string, oldRelPath: string, newFileName: string) => {
      const ws = workspaces.find((w) => w.workspaceId === workspaceId);
      if (!ws) return;

      const trimmedName = newFileName.trim();
      if (!trimmedName) {
        alert('Tên tệp không được để trống.');
        return;
      }

      const oldExt = oldRelPath.includes('.') ? oldRelPath.substring(oldRelPath.lastIndexOf('.')) : '';
      const finalFileName = trimmedName.includes('.') ? trimmedName : `${trimmedName}${oldExt}`;

      const parts = oldRelPath.replace(/\\/g, '/').split('/');
      parts[parts.length - 1] = finalFileName;
      const newRelPath = parts.join('/');

      if (newRelPath === oldRelPath) return;

      if (ws.imageFiles.has(newRelPath)) {
        alert('Tên tệp này đã tồn tại trong workspace!');
        return;
      }

      // Handle disk rename if directory handle is present
      if (ws.handle) {
        try {
          let parentDir = ws.handle;
          for (let i = 0; i < parts.length - 1; i++) {
            parentDir = await parentDir.getDirectoryHandle(parts[i]);
          }

          const oldFileName = oldRelPath.replace(/\\/g, '/').split('/').pop()!;
          const oldFileHandle = await parentDir.getFileHandle(oldFileName);
          const oldFile = await oldFileHandle.getFile();

          const newFileHandle = await parentDir.getFileHandle(finalFileName, { create: true });
          const writable = await newFileHandle.createWritable();
          await writable.write(oldFile);
          await writable.close();

          await parentDir.removeEntry(oldFileName);
        } catch (err) {
          console.error('Error renaming on disk:', err);
          alert('Không thể đổi tên tệp trên ổ đĩa: ' + String(err));
          return;
        }
      }

      const oldFileObj = ws.imageFiles.get(oldRelPath);
      const newFileObj = oldFileObj
        ? new File([oldFileObj], finalFileName, { type: oldFileObj.type })
        : null;

      setWorkspaces((prev) =>
        prev.map((w) => {
          if (w.workspaceId !== workspaceId) return w;

          const newImageFiles = new Map(w.imageFiles);
          newImageFiles.delete(oldRelPath);
          if (newFileObj) {
            newImageFiles.set(newRelPath, newFileObj);
          }

          const newImages = { ...w.data.images };
          if (newImages[oldRelPath]) {
            newImages[newRelPath] = newImages[oldRelPath];
            delete newImages[oldRelPath];
          }

          return {
            ...w,
            isDirty: true,
            imageFiles: newImageFiles,
            data: {
              ...w.data,
              images: newImages,
              updatedAt: new Date().toISOString(),
            },
          };
        })
      );

      if (currentWorkspaceId === workspaceId && currentRelPath === oldRelPath) {
        setCurrentRelPath(newRelPath);
      }
    },
    [workspaces, currentWorkspaceId, currentRelPath]
  );

  // Delete image
  const handleDeleteImage = useCallback(
    async (workspaceId: string, relPath: string) => {
      const ws = workspaces.find((w) => w.workspaceId === workspaceId);
      if (!ws) return;

      const fileName = relPath.replace(/\\/g, '/').split('/').pop()!;
      const confirmed = window.confirm(`Bạn có chắc chắn muốn xóa ảnh "${fileName}" không? Thao tác này không thể hoàn tác.`);
      if (!confirmed) return;

      if (ws.handle) {
        try {
          const parts = relPath.replace(/\\/g, '/').split('/');
          let parentDir = ws.handle;
          for (let i = 0; i < parts.length - 1; i++) {
            parentDir = await parentDir.getDirectoryHandle(parts[i]);
          }
          await parentDir.removeEntry(fileName);
        } catch (err) {
          console.error('Error deleting on disk:', err);
          alert('Không thể xóa tệp trên ổ đĩa: ' + String(err));
          return;
        }
      }

      setWorkspaces((prev) =>
        prev.map((w) => {
          if (w.workspaceId !== workspaceId) return w;

          const newImageFiles = new Map(w.imageFiles);
          newImageFiles.delete(relPath);

          const newImages = { ...w.data.images };
          delete newImages[relPath];

          return {
            ...w,
            isDirty: true,
            imageFiles: newImageFiles,
            data: {
              ...w.data,
              images: newImages,
              updatedAt: new Date().toISOString(),
            },
          };
        })
      );

      if (currentWorkspaceId === workspaceId && currentRelPath === relPath) {
        const remainingImages = Array.from(ws.imageFiles.keys()).filter((p) => p !== relPath);
        setCurrentRelPath(remainingImages.length > 0 ? remainingImages[0] : null);
      }
    },
    [workspaces, currentWorkspaceId, currentRelPath]
  );

  // Select image
  const handleSelectImage = (workspaceId: string, relPath: string) => {
    justCreatedObjIdRef.current = null;
    setCurrentWorkspaceId(workspaceId);
    setCurrentRelPath(relPath);
    setSelectedItems([]);
    setQuickCaptionOpen(false);
    updateUndoRedoState(`${workspaceId}_${relPath}`);
  };

  return (
    <div className="h-screen flex flex-col bg-cream overflow-hidden">
      {/* Hidden input for fallback directory loading */}
      <input
        type="file"
        ref={folderInputRef}
        onChange={handleFallbackFolderChange}
        className="hidden"
        {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
      />

      {/* Main Top Navigation */}
      <NavBar />

      {/* Sub-header for Workspace (File & Workspace menus) */}
      <WorkspaceHeader
        workspaces={workspaces}
        currentWorkspaceId={currentWorkspaceId}
        onLoadWorkspace={handleLoadWorkspace}
        onSaveWorkspace={handleSaveWorkspace}
        onSaveAllWorkspaces={handleSaveAllWorkspaces}
        onExportJson={handleExportJson}
        onToggleWorkspaceVisibility={handleToggleWorkspaceVisibility}
        onCloseWorkspace={handleCloseWorkspace}
        isAnyDirty={isAnyDirty}
      />

      {/* 3-Column Resizable Body */}
      <div className="flex-1 min-h-0 relative">
        <ResizableLayout
          leftContentTop={
            <WorkspaceFileTree
              workspaces={workspaces}
              currentWorkspaceId={currentWorkspaceId}
              currentRelPath={currentRelPath}
              onSelectImage={handleSelectImage}
              onRenameImage={handleRenameImage}
              onDeleteImage={handleDeleteImage}
            />
          }
          leftContentBottom={
            <WorkspaceTools
              mode={mode}
              activeTool={activeTool}
              onChangeActiveTool={(t) => {
                justCreatedObjIdRef.current = null;
                setActiveTool(t);
              }}
              color={color}
              onChangeColor={setColor}
              brushSize={brushSize}
              onChangeBrushSize={setBrushSize}
              eraserSize={eraserSize}
              onChangeEraserSize={setEraserSize}
              dotRadius={dotRadius}
              onChangeDotRadius={setDotRadius}
              globalDotOpacity={globalDotOpacity}
              onChangeGlobalDotOpacity={setGlobalDotOpacity}
              reviewDisplayMode={reviewDisplayMode}
              onChangeReviewDisplayMode={setReviewDisplayMode}
              reviewFontSize={reviewFontSize}
              onChangeReviewFontSize={setReviewFontSize}
            />
          }
          centerContent={
            <WorkspaceCanvas
              imageFile={currentImageFile}
              annotationData={currentAnnotationData}
              onUpdateAnnotation={handleUpdateAnnotation}
              mode={mode}
              activeTool={activeTool}
              color={color}
              brushSize={brushSize}
              eraserSize={eraserSize}
              dotRadius={dotRadius}
              globalDotOpacity={globalDotOpacity}
              reviewDisplayMode={reviewDisplayMode}
              reviewFontSize={reviewFontSize}
              selectedItems={selectedItems}
              onSelectItems={(items) => {
                if (!items.some((i) => i.type === 'object' && i.id === justCreatedObjIdRef.current)) {
                  justCreatedObjIdRef.current = null;
                }
                setSelectedItems(items);
              }}
              onOpenQuickCaption={handleOpenQuickCaption}
              onObjectCreated={handleObjectCreated}
              onChangeBrushSize={setBrushSize}
              onChangeEraserSize={setEraserSize}
              onUndo={handleUndo}
              onRedo={handleRedo}
              canUndo={canUndo}
              canRedo={canRedo}
            />
          }
          rightContent={
            <WorkspaceLayers
              annotationData={currentAnnotationData}
              onUpdateAnnotation={handleUpdateAnnotation}
              selectedItems={selectedItems}
              onSelectItems={setSelectedItems}
              allWorkspaceCaptions={allWorkspaceCaptions}
              mode={mode}
              reviewDisplayMode={reviewDisplayMode}
              quickCaptionOpen={quickCaptionOpen}
              onCloseQuickCaption={() => {
                setQuickCaptionOpen(false);
                setInitialQuickCaptionChar('');
              }}
              initialQuickCaptionChar={initialQuickCaptionChar}
            />
          }
        />
      </div>
    </div>
  );
}
