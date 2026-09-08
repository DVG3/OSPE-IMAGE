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

  // Helper to scan directory recursively
  const scanDirectoryRecursive = async (
    dirHandle: FileSystemDirectoryHandle,
    imageFiles: Map<string, File>,
    currentPath = ''
  ): Promise<string | null> => {
    let rootWorkspaceJsonText: string | null = null;
    for await (const entry of (dirHandle as unknown as { values: () => AsyncIterable<FileSystemFileHandle | FileSystemDirectoryHandle> }).values()) {
      if (entry.kind === 'file') {
        const fileHandle = entry as FileSystemFileHandle;
        const file = await fileHandle.getFile();
        const lowerName = file.name.toLowerCase();
        const relPath = currentPath ? `${currentPath}/${file.name}` : file.name;

        if (lowerName === 'workspace.json' && !currentPath) {
          try {
            rootWorkspaceJsonText = await file.text();
          } catch (e) {
            console.warn('Cannot read workspace.json', e);
          }
        } else if (
          lowerName.endsWith('.png') ||
          lowerName.endsWith('.jpg') ||
          lowerName.endsWith('.jpeg') ||
          lowerName.endsWith('.webp')
        ) {
          imageFiles.set(relPath, file);
        }
      } else if (entry.kind === 'directory') {
        const subDirHandle = entry as FileSystemDirectoryHandle;
        const subPath = currentPath ? `${currentPath}/${subDirHandle.name}` : subDirHandle.name;
        await scanDirectoryRecursive(subDirHandle, imageFiles, subPath);
      }
    }
    return rootWorkspaceJsonText;
  };

  // Load workspace via File System Access API or input fallback
  const handleLoadWorkspace = async () => {
    if ('showDirectoryPicker' in window) {
      try {
        const dirHandle = await (window as unknown as { showDirectoryPicker: () => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker();
        const imageFiles = new Map<string, File>();
        const workspaceJsonText = await scanDirectoryRecursive(dirHandle, imageFiles);

        let workspaceJsonData: WorkspaceFile | null = null;
        if (workspaceJsonText) {
          try {
            workspaceJsonData = JSON.parse(workspaceJsonText);
          } catch (e) {
            console.warn('Cannot parse workspace.json, will recreate', e);
          }
        }

        const wsId = workspaceJsonData?.workspaceId || generateId('ws');
        const wsName = dirHandle.name; // Tên workspace luôn là tên thư mục chứa workspace.json

        const finalData: WorkspaceFile = {
          workspaceId: wsId,
          name: wsName,
          createdAt: workspaceJsonData?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          images: workspaceJsonData?.images || {},
        };

        // Nếu chưa có workspace.json thì tạo ngay trên đĩa
        if (!workspaceJsonData) {
          try {
            const fileHandle = await dirHandle.getFileHandle('workspace.json', { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(new Blob([JSON.stringify(finalData, null, 2)], { type: 'application/json' }));
            await writable.close();
          } catch (createErr) {
            console.warn('Could not auto-create workspace.json on disk', createErr);
          }
        }

        const newLoadedWorkspace: LoadedWorkspace = {
          handle: dirHandle,
          workspaceId: wsId,
          name: wsName,
          color: getRandomColor(),
          visible: true,
          data: finalData,
          imageFiles,
          isDirty: false,
        };

        setWorkspaces((prev) => [...prev, newLoadedWorkspace]);
        setCurrentWorkspaceId(wsId);

        // Select first image
        const firstImgPath = Array.from(imageFiles.keys())[0];
        if (firstImgPath) {
          setCurrentRelPath(firstImgPath);
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

    const imageFiles = new Map<string, File>();
    let workspaceJsonData: WorkspaceFile | null = null;
    let folderName = 'Workspace';

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const lowerName = file.name.toLowerCase();
      let relPath = file.name;
      if (file.webkitRelativePath) {
        const parts = file.webkitRelativePath.split('/');
        if (parts.length > 1) {
          folderName = parts[0];
          relPath = parts.slice(1).join('/');
        }
      }

      if (lowerName === 'workspace.json' && (!file.webkitRelativePath || file.webkitRelativePath.split('/').length <= 2)) {
        try {
          const text = await file.text();
          workspaceJsonData = JSON.parse(text);
        } catch (err) {
          console.warn('Cannot parse workspace.json fallback', err);
        }
      } else if (
        lowerName.endsWith('.png') ||
        lowerName.endsWith('.jpg') ||
        lowerName.endsWith('.jpeg') ||
        lowerName.endsWith('.webp')
      ) {
        imageFiles.set(relPath, file);
      }
    }

    const wsId = workspaceJsonData?.workspaceId || generateId('ws');
    const wsName = folderName;

    const finalData: WorkspaceFile = {
      workspaceId: wsId,
      name: wsName,
      createdAt: workspaceJsonData?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      images: workspaceJsonData?.images || {},
    };

    const newLoadedWorkspace: LoadedWorkspace = {
      handle: null,
      workspaceId: wsId,
      name: wsName,
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
